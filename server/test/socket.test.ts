import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type { Ack, ClientToServer, GameStatePayload, JoinedPayload, ServerToClient } from '@fuf/shared';
import { startServer } from '../src/index';

type Client = Socket<ServerToClient, ClientToServer>;
const PORT = 3999;
let server: ReturnType<typeof startServer>;
const clients: Client[] = [];

const client = () => {
  const c: Client = connect(`http://localhost:${PORT}`, { transports: ['websocket'], forceNew: true });
  clients.push(c);
  return c;
};
const call = <T>(fn: (ack: (r: T) => void) => void) => new Promise<T>((resolve) => fn(resolve));
const nextState = (c: Client) => new Promise<GameStatePayload>((resolve) => c.once('game:state', resolve));

beforeAll(() => {
  server = startServer(PORT);
});
afterAll(async () => {
  clients.forEach((c) => c.disconnect());
  await server.close();
});

describe('Socket.IO-Server', () => {
  it('synchronisiert eine Bauaktion an beide Spieler und ignoriert Duplikate', async () => {
    const a = client();
    const b = client();
    const created = await call<Ack<JoinedPayload>>((ack) => a.emit('room:create', { name: 'Fiona', animal: 'fox' }, ack));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const joined = await call<Ack<JoinedPayload>>((ack) => b.emit('room:join', { code: created.lobby.code.toLowerCase(), name: 'Moritz' }, ack));
    expect(joined.ok).toBe(true);
    await call<Ack>((ack) => b.emit('lobby:update', { ready: true }, ack));

    const started = Promise.all([nextState(a), nextState(b)]);
    expect((await call<Ack>((ack) => a.emit('lobby:start', ack))).ok).toBe(true);
    const [sa, sb] = await started;
    expect(sa.state.budget).toBe(sb.state.budget);

    const cells = '1,6 1,5 2,5 2,4 2,3 3,3 4,3 5,3 5,2 5,1'.split(' ').map((p) => ({ x: +p.split(',')[0], y: +p.split(',')[1] }));
    const action = { type: 'buildRoute' as const, actionId: 'same-id', cells, useAbility: false };
    const update = Promise.all([nextState(a), nextState(b)]);
    const [r1, r2] = await Promise.all([
      call<Ack<{ duplicate?: boolean }>>((ack) => b.emit('game:action', action, ack)),
      call<Ack<{ duplicate?: boolean }>>((ack) => b.emit('game:action', action, ack)),
    ]);
    expect(r1.ok && r2.ok).toBe(true);
    expect([r1, r2].filter((r) => r.ok && r.duplicate)).toHaveLength(1);
    const [ua, ub] = await update;
    expect(ua.state.budget).toBe(sa.state.budget - 26);
    expect(ub.state.budget).toBe(ua.state.budget);
  });

  it('lehnt fehlerhafte Nutzdaten ab', async () => {
    const c = client();
    const r = await call<Ack<JoinedPayload>>((ack) => c.emit('room:create', { name: '', animal: 'dragon' as never }, ack));
    expect(r.ok).toBe(false);
  });
});
