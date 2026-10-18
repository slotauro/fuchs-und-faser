import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import type { ClientToServer, ServerToClient } from '@fuf/shared';
import { RateLimiter } from './rateLimiter';
import { RoomManager } from './roomManager';
import { cleanAction, cleanCells, cleanCode, cleanName, isAnimal } from './validation';

const STATIC_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../client/dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

/** Liefert im Produktionsbetrieb den gebauten Client aus (ein Port für alles). */
function serveStatic(url: string, res: import('node:http').ServerResponse): void {
  if (!existsSync(STATIC_DIR)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Fuchs & Faser Server läuft. Client mit "npm run dev" oder "npm run build" starten.');
    return;
  }
  const path = normalize(decodeURIComponent(url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(STATIC_DIR, path);
  if (!file.startsWith(STATIC_DIR) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(STATIC_DIR, 'index.html');
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

export function startServer(port: number): { http: HttpServer; io: Server; rooms: RoomManager; close(): Promise<void> } {
  const http = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.roomCount }));
      return;
    }
    serveStatic(req.url ?? '/', res);
  });

  const io = new Server<ClientToServer, ServerToClient>(http, {
    cors: { origin: process.env.NODE_ENV === 'production' ? false : '*' },
    maxHttpBufferSize: 32_000,
    connectionStateRecovery: undefined,
  });

  const rooms = new RoomManager({
    lobby: (code, lobby) => io.to(code).emit('lobby:state', lobby),
    game: (code, payload) => io.to(code).emit('game:state', payload),
  });

  io.on('connection', (socket) => {
    const limiter = new RateLimiter();
    let lastPlan = 0;

    const guard = <A extends unknown[]>(handler: (...args: A) => void) =>
      (...args: A) => {
        if (!limiter.allow()) {
          socket.emit('error:rate');
          const ack = args[args.length - 1];
          if (typeof ack === 'function') {
            ack({ ok: false, error: { code: 'NOT_ALLOWED', message: 'Zu viele Aktionen – bitte kurz warten.' } });
          }
          return;
        }
        try {
          handler(...args);
        } catch (err) {
          console.error('Fehler bei Nachricht', err);
        }
      };

    const invalid = { ok: false as const, error: { code: 'INVALID_ACTION' as const, message: 'Ungültige Anfrage.' } };
    const isFn = (f: unknown): f is (...a: never[]) => void => typeof f === 'function';

    const enter = (code: string) => {
      for (const r of socket.rooms) if (r !== socket.id) void socket.leave(r);
      void socket.join(code);
    };

    socket.on('room:create', guard((p, ack) => {
      if (!isFn(ack)) return;
      const name = cleanName(p?.name);
      if (!name || !isAnimal(p?.animal)) return ack(invalid);
      const result = rooms.create(socket.id, name, p.animal);
      if (result.ok) enter(result.lobby.code);
      ack(result);
    }));

    socket.on('room:join', guard((p, ack) => {
      if (!isFn(ack)) return;
      const name = cleanName(p?.name);
      const code = cleanCode(p?.code);
      if (!name || !code) return ack({ ok: false, error: { code: 'INVALID_ACTION', message: 'Bitte Name und 6-stelligen Raumcode angeben.' } });
      const result = rooms.join(socket.id, code, name);
      if (result.ok) enter(code);
      ack(result);
    }));

    socket.on('room:rejoin', guard((p, ack) => {
      if (!isFn(ack)) return;
      const code = cleanCode(p?.code);
      if (!code || typeof p?.token !== 'string') return ack(invalid);
      const result = rooms.rejoin(socket.id, code, p.token);
      if (result.ok) enter(code);
      ack(result);
    }));

    socket.on('room:leave', guard(() => {
      const code = rooms.roomOf(socket.id);
      rooms.leave(socket.id);
      if (code) void socket.leave(code);
    }));

    socket.on('lobby:update', guard((p, ack) => {
      if (!isFn(ack)) return;
      const update: { animal?: import('@fuf/shared').AnimalId; ready?: boolean; mapId?: string } = {};
      if (p?.animal !== undefined) {
        if (!isAnimal(p.animal)) return ack(invalid);
        update.animal = p.animal;
      }
      if (typeof p?.ready === 'boolean') update.ready = p.ready;
      if (typeof p?.mapId === 'string') update.mapId = p.mapId;
      ack(rooms.updateLobby(socket.id, update));
    }));

    socket.on('lobby:start', guard((ack) => {
      if (!isFn(ack)) return;
      ack(rooms.start(socket.id));
    }));

    socket.on('lobby:return', guard(() => rooms.returnToLobby(socket.id)));

    socket.on('game:action', guard((raw, ack) => {
      if (!isFn(ack)) return;
      const action = cleanAction(raw);
      if (!action) return ack(invalid);
      ack(rooms.action(socket.id, action));
    }));

    // Planungsvorschau: gedrosselt und nicht maßgeblich, daher ohne Rate-Limit-Strafe verworfen.
    socket.on('game:plan', (raw) => {
      const now = Date.now();
      if (now - lastPlan < 100) return;
      lastPlan = now;
      const cells = cleanCells(raw);
      if (!cells) return;
      const target = rooms.planTarget(socket.id);
      if (target) socket.to(target.code).emit('game:plan', { playerId: target.playerId, cells });
    });

    socket.on('disconnect', () => rooms.disconnect(socket.id));
  });

  const ticker = setInterval(() => rooms.tick(), 1000);
  http.listen(port);

  return {
    http,
    io,
    rooms,
    close: () =>
      new Promise<void>((done) => {
        clearInterval(ticker);
        io.close(() => done());
      }),
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT ?? 3001);
  startServer(port);
  console.log(`Fuchs & Faser Server läuft auf http://localhost:${port}`);
}
