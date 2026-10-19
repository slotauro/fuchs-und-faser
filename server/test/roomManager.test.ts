import { describe, expect, it } from 'vitest';
import type { Cell, GameStatePayload, LobbyState } from '@fuf/shared';
import { EMPTY_ROOM_TTL_MS, RECONNECT_GRACE_MS, RoomManager } from '../src/roomManager';
import { RateLimiter } from '../src/rateLimiter';
import { cleanAction, cleanCode } from '../src/validation';

const route = (s: string): Cell[] => s.split(' ').map((p) => ({ x: +p.split(',')[0], y: +p.split(',')[1] }));
const B1 = route('1,6 1,5 2,5 2,4 2,3 3,3 4,3 5,3 5,2 5,1');

function setup() {
  let now = 1_000_000;
  const lobbies: LobbyState[] = [];
  const games: GameStatePayload[] = [];
  const rooms = new RoomManager(
    { lobby: (_c, l) => lobbies.push(l), game: (_c, g) => games.push(g) },
    () => now,
  );
  const created = rooms.create('s1', 'Fiona', 'fox');
  if (!created.ok) throw new Error('create failed');
  const code = created.lobby.code;
  return { rooms, code, lobbies, games, advance: (ms: number) => (now += ms), host: created };
}

function startTwo() {
  const ctx = setup();
  const joined = ctx.rooms.join('s2', ctx.code, 'Moritz');
  if (!joined.ok) throw new Error('join failed');
  ctx.rooms.updateLobby('s2', { ready: true });
  expect(ctx.rooms.start('s1').ok).toBe(true);
  return { ...ctx, guest: joined };
}

describe('Räume', () => {
  it('erzeugt kurze, eindeutige Codes ohne verwechselbare Zeichen', () => {
    const { rooms } = setup();
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const r = rooms.create(`x${i}`, 'A', 'fox');
      if (r.ok) codes.add(r.lobby.code);
    }
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('weist beitretenden Spielern ein freies Tier zu und begrenzt auf vier', () => {
    const { rooms, code } = setup();
    const animals = ['s2', 's3', 's4'].map((s, i) => {
      const r = rooms.join(s, code, `P${i}`);
      return r.ok ? r.lobby.players.at(-1)!.animal : null;
    });
    expect(new Set(['fox', ...animals]).size).toBe(4);
    const fifth = rooms.join('s5', code, 'Zu viel');
    expect(!fifth.ok && fifth.error.message).toContain('voll');
  });

  it('meldet unbekannte Räume verständlich', () => {
    const { rooms } = setup();
    const r = rooms.join('s2', 'ZZZZZZ', 'X');
    expect(!r.ok && r.error.message).toContain('nicht gefunden');
  });

  it('startet erst mit zwei bereiten Spielern und nur durch den Host', () => {
    const { rooms, code } = setup();
    expect(rooms.start('s1').ok).toBe(false);
    rooms.join('s2', code, 'Moritz');
    expect(rooms.start('s1').ok).toBe(false); // Gast nicht bereit
    rooms.updateLobby('s2', { ready: true });
    expect(rooms.start('s2').ok).toBe(false); // kein Host
    expect(rooms.start('s1').ok).toBe(true);
    expect(rooms.gameOf(code)?.players).toHaveLength(2);
  });

  it('verhindert doppelte Tiere', () => {
    const { rooms, code } = setup();
    rooms.join('s2', code, 'Moritz');
    expect(rooms.updateLobby('s2', { animal: 'fox' }).ok).toBe(false);
    expect(rooms.updateLobby('s2', { animal: 'badger' }).ok).toBe(true);
  });
});

describe('Spielzustand im Multiplayer', () => {
  it('Szenario D: Bauaktion wird an alle verteilt, Budget ist gemeinsam', () => {
    const { rooms, code, games } = startTwo();
    const before = rooms.gameOf(code)!.budget;
    expect(rooms.action('s2', { type: 'buildRoute', actionId: 'a1', cells: B1 }).ok).toBe(true);
    const last = games.at(-1)!;
    expect(last.state.budget).toBe(before - 26);
    expect(last.state.routes[0].playerId).not.toBe(rooms.gameOf(code)!.players[0].id);
  });

  it('Szenario E: doppelte Nachrichten verbuchen Kosten nur einmal', () => {
    const { rooms, code, games } = startTwo();
    const action = { type: 'buildRoute' as const, actionId: 'dup', cells: B1 };
    rooms.action('s2', action);
    const budget = rooms.gameOf(code)!.budget;
    const count = games.length;
    const again = rooms.action('s2', action);
    expect(again.ok && again.duplicate).toBe(true);
    expect(rooms.gameOf(code)!.budget).toBe(budget);
    expect(games.length).toBe(count);
    // Gleiche Route mit neuer ID (wiederholter Klick) wird als bereits gebaut abgelehnt.
    const repeat = rooms.action('s1', { ...action, actionId: 'other' });
    expect(repeat.ok).toBe(false);
    expect(rooms.gameOf(code)!.budget).toBe(budget);
  });

  it('ungültige Aktionen verändern den Zustand nicht', () => {
    const { rooms, code } = startTwo();
    const before = rooms.gameOf(code);
    const r = rooms.action('s1', { type: 'buildRoute', actionId: 'bad', cells: route('5,5 6,5') });
    expect(r.ok).toBe(false);
    expect(rooms.gameOf(code)).toBe(before);
  });

  it('Fähigkeiten gehören nur dem jeweiligen Tier', () => {
    const { rooms } = startTwo(); // Gast ist Maulwurf
    const r = rooms.action('s2', { type: 'useScout', actionId: 's' });
    expect(!r.ok && r.error.code).toBe('NOT_ALLOWED');
    expect(rooms.action('s1', { type: 'useScout', actionId: 's2' }).ok).toBe(true);
  });

  it('beendet die Runde serverseitig bei Zeitablauf', () => {
    const { rooms, code, advance, games } = startTwo();
    advance(241_000);
    rooms.tick();
    expect(rooms.gameOf(code)?.status).toBe('lost');
    expect(games.at(-1)!.events).toEqual([{ type: 'roundLost', reason: 'time' }]);
  });
});

describe('Verbindungsabbrüche', () => {
  it('erlaubt Wiederbeitritt mit Token, auch während der Runde', () => {
    const { rooms, code, guest } = startTwo();
    rooms.disconnect('s2');
    if (!guest.ok) return;
    const back = rooms.rejoin('s9', code, guest.token);
    expect(back.ok).toBe(true);
    expect(back.ok && back.game?.state.status).toBe('playing');
    expect(rooms.rejoin('s10', code, 'falsch').ok).toBe(false);
  });

  it('gibt Lobby-Plätze nach der Wartezeit frei und übergibt den Host', () => {
    const { rooms, code, advance, lobbies } = setup();
    rooms.join('s2', code, 'Moritz');
    rooms.disconnect('s1');
    advance(RECONNECT_GRACE_MS + 1000);
    rooms.tick();
    const lobby = lobbies.at(-1)!;
    expect(lobby.players).toHaveLength(1);
    expect(lobby.players[0].isHost).toBe(true);
  });

  it('löscht leere Räume nach begrenzter Zeit', () => {
    const { rooms, code, advance } = startTwo();
    rooms.disconnect('s1');
    rooms.disconnect('s2');
    advance(EMPTY_ROOM_TTL_MS - 1000);
    rooms.tick();
    expect(rooms.gameOf(code)).not.toBeNull();
    advance(2000);
    rooms.tick();
    expect(rooms.gameOf(code)).toBeNull();
  });
});

describe('Schutzmechanismen', () => {
  it('begrenzt die Nachrichtenrate', () => {
    let t = 0;
    const limiter = new RateLimiter(10, 20, () => t);
    let allowed = 0;
    for (let i = 0; i < 50; i++) if (limiter.allow()) allowed++;
    expect(allowed).toBe(20);
    t += 1000;
    expect(limiter.allow()).toBe(true);
  });

  it('verwirft fehlerhafte Nachrichten', () => {
    expect(cleanAction({ type: 'buildRoute', actionId: 'x', cells: [{ x: 1.5, y: 2 }] })).toBeNull();
    expect(cleanAction({ type: 'hack', actionId: 'x' })).toBeNull();
    expect(cleanAction({ type: 'buildRoute', cells: [] })).toBeNull();
    expect(cleanAction({ type: 'buildRoute', actionId: 'x', cells: new Array(500).fill({ x: 0, y: 0 }) })).toBeNull();
    expect(cleanCode('abc123')).toBe('ABC123');
    expect(cleanCode('abc')).toBeNull();
  });
});
