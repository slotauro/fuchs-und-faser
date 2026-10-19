import { randomBytes, randomInt } from 'node:crypto';
import {
  ANIMAL_IDS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROOM_CODE_LENGTH,
  applyAction,
  createGame,
  getMap,
  isMapId,
  toGameAction,
  type Ack,
  type AnimalId,
  type ClientAction,
  type ErrorCode,
  type GameEvent,
  type GameState,
  type GameStatePayload,
  type JoinedPayload,
  type LobbyState,
} from '@fuf/shared';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** So lange bleibt ein getrennter Spieler in der Lobby reserviert. */
export const RECONNECT_GRACE_MS = 60_000;
/** So lange bleibt ein Raum ohne verbundene Spieler bestehen. */
export const EMPTY_ROOM_TTL_MS = 5 * 60_000;

interface RoomPlayer {
  id: string;
  token: string;
  name: string;
  animal: AnimalId;
  ready: boolean;
  socketId: string | null;
  disconnectedAt: number | null;
}

interface Room {
  code: string;
  hostId: string;
  mapId: string;
  phase: 'lobby' | 'playing';
  players: RoomPlayer[];
  game: GameState | null;
  lastEvents: GameEvent[];
  emptySince: number | null;
}

export interface Broadcast {
  lobby(code: string, lobby: LobbyState): void;
  game(code: string, payload: GameStatePayload): void;
}

const fail = (code: ErrorCode, message: string): { ok: false; error: { code: ErrorCode; message: string } } => ({
  ok: false,
  error: { code, message },
});

/**
 * Verwaltet Räume, Lobby und den maßgeblichen Spielzustand.
 * Unabhängig von Socket.IO, damit es direkt getestet werden kann.
 */
export class RoomManager {
  private rooms = new Map<string, Room>();
  private sockets = new Map<string, { code: string; playerId: string }>();

  constructor(
    private broadcast: Broadcast,
    private now: () => number = Date.now,
  ) {}

  get roomCount(): number {
    return this.rooms.size;
  }

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  lobbyState(room: Room): LobbyState {
    return {
      code: room.code,
      mapId: room.mapId,
      phase: room.phase,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        animal: p.animal,
        ready: p.ready,
        connected: p.socketId !== null,
        isHost: p.id === room.hostId,
      })),
    };
  }

  private gamePayload(room: Room): GameStatePayload | null {
    return room.game ? { state: room.game, events: room.lastEvents, serverNow: this.now() } : null;
  }

  private pushLobby(room: Room): void {
    this.broadcast.lobby(room.code, this.lobbyState(room));
  }

  private pushGame(room: Room): void {
    const payload = this.gamePayload(room);
    if (payload) this.broadcast.game(room.code, payload);
  }

  private attach(room: Room, player: RoomPlayer, socketId: string): JoinedPayload {
    player.socketId = socketId;
    player.disconnectedAt = null;
    room.emptySince = null;
    this.sockets.set(socketId, { code: room.code, playerId: player.id });
    return {
      playerId: player.id,
      token: player.token,
      lobby: this.lobbyState(room),
      game: this.gamePayload(room),
    };
  }

  private newPlayer(name: string, animal: AnimalId): RoomPlayer {
    return {
      id: `p_${randomBytes(4).toString('hex')}`,
      token: randomBytes(16).toString('hex'),
      name,
      animal,
      ready: false,
      socketId: null,
      disconnectedAt: null,
    };
  }

  create(socketId: string, name: string, animal: AnimalId): Ack<JoinedPayload> {
    this.leave(socketId);
    const player = this.newPlayer(name, animal);
    player.ready = true;
    const room: Room = {
      code: this.newCode(),
      hostId: player.id,
      // Die kleine Tierstadt ist als Einstieg ins gemeinsame Bauen gedacht
      mapId: 'tierstadt',
      phase: 'lobby',
      players: [player],
      game: null,
      lastEvents: [],
      emptySince: null,
    };
    this.rooms.set(room.code, room);
    return { ok: true, ...this.attach(room, player, socketId) };
  }

  join(socketId: string, code: string, name: string): Ack<JoinedPayload> {
    const room = this.rooms.get(code);
    if (!room) return fail('NOT_ALLOWED', `Raum ${code} wurde nicht gefunden.`);
    if (room.phase !== 'lobby') return fail('NOT_ALLOWED', 'In diesem Raum läuft bereits eine Runde.');
    if (room.players.length >= MAX_PLAYERS) return fail('NOT_ALLOWED', 'Der Raum ist voll (max. 4 Spieler).');
    this.leave(socketId);
    const taken = room.players.map((p) => p.animal);
    const animal = ANIMAL_IDS.find((a) => !taken.includes(a))!;
    const player = this.newPlayer(name, animal);
    room.players.push(player);
    const joined = this.attach(room, player, socketId);
    this.pushLobby(room);
    return { ok: true, ...joined, lobby: this.lobbyState(room) };
  }

  rejoin(socketId: string, code: string, token: string): Ack<JoinedPayload> {
    const room = this.rooms.get(code);
    const player = room?.players.find((p) => p.token === token);
    if (!room || !player) return fail('NOT_ALLOWED', 'Wiederbeitritt nicht möglich – der Platz ist verfallen.');
    if (player.socketId && player.socketId !== socketId) this.sockets.delete(player.socketId);
    const joined = this.attach(room, player, socketId);
    this.pushLobby(room);
    return { ok: true, ...joined, lobby: this.lobbyState(room) };
  }

  private context(socketId: string): { room: Room; player: RoomPlayer } | null {
    const entry = this.sockets.get(socketId);
    const room = entry && this.rooms.get(entry.code);
    const player = room?.players.find((p) => p.id === entry!.playerId);
    return room && player ? { room, player } : null;
  }

  roomOf(socketId: string): string | null {
    return this.context(socketId)?.room.code ?? null;
  }

  private removePlayer(room: Room, player: RoomPlayer): void {
    room.players = room.players.filter((p) => p !== player);
    if (room.hostId === player.id && room.players.length > 0) {
      const next = room.players.find((p) => p.socketId) ?? room.players[0];
      room.hostId = next.id;
      next.ready = true;
    }
    if (room.players.length === 0) this.rooms.delete(room.code);
  }

  /** Bewusstes Verlassen: in der Lobby wird der Platz frei, im Spiel bleibt die Figur erhalten. */
  leave(socketId: string): void {
    const ctx = this.context(socketId);
    this.sockets.delete(socketId);
    if (!ctx) return;
    const { room, player } = ctx;
    if (room.phase === 'lobby') {
      this.removePlayer(room, player);
    } else {
      player.socketId = null;
      player.disconnectedAt = this.now();
    }
    this.markEmpty(room);
    if (this.rooms.has(room.code)) this.pushLobby(room);
  }

  disconnect(socketId: string): void {
    const ctx = this.context(socketId);
    this.sockets.delete(socketId);
    if (!ctx || ctx.player.socketId !== socketId) return;
    ctx.player.socketId = null;
    ctx.player.disconnectedAt = this.now();
    this.markEmpty(ctx.room);
    this.pushLobby(ctx.room);
  }

  private markEmpty(room: Room): void {
    if (room.players.every((p) => p.socketId === null)) room.emptySince ??= this.now();
  }

  updateLobby(socketId: string, update: { animal?: AnimalId; ready?: boolean; mapId?: string }): Ack {
    const ctx = this.context(socketId);
    if (!ctx) return fail('NOT_ALLOWED', 'Du bist in keinem Raum.');
    const { room, player } = ctx;
    if (room.phase !== 'lobby') return fail('NOT_ALLOWED', 'Die Runde läuft bereits.');
    if (update.animal !== undefined && update.animal !== player.animal) {
      if (room.players.some((p) => p !== player && p.animal === update.animal)) {
        return fail('NOT_ALLOWED', 'Dieses Tier ist bereits vergeben.');
      }
      player.animal = update.animal;
    }
    if (update.ready !== undefined) player.ready = player.id === room.hostId ? true : update.ready;
    if (update.mapId !== undefined) {
      if (player.id !== room.hostId) return fail('NOT_ALLOWED', 'Nur der Host wählt die Karte.');
      if (!isMapId(update.mapId)) return fail('INVALID_ACTION', 'Unbekannte Karte.');
      room.mapId = update.mapId;
    }
    this.pushLobby(room);
    return { ok: true };
  }

  start(socketId: string): Ack {
    const ctx = this.context(socketId);
    if (!ctx) return fail('NOT_ALLOWED', 'Du bist in keinem Raum.');
    const { room, player } = ctx;
    if (player.id !== room.hostId) return fail('NOT_ALLOWED', 'Nur der Host kann die Runde starten.');
    if (room.phase !== 'lobby') return fail('NOT_ALLOWED', 'Die Runde läuft bereits.');
    const active = room.players.filter((p) => p.socketId !== null);
    if (active.length < MIN_PLAYERS) return fail('NOT_ALLOWED', 'Es werden mindestens zwei Spieler benötigt.');
    if (active.some((p) => !p.ready)) return fail('NOT_ALLOWED', 'Noch nicht alle Spieler sind bereit.');
    // Getrennte Spieler, die in der Lobby warten, nehmen nicht teil.
    room.players = active;
    room.game = createGame(
      getMap(room.mapId),
      'coop',
      active.map((p) => ({ id: p.id, name: p.name, animal: p.animal })),
      this.now(),
    );
    room.lastEvents = [];
    room.phase = 'playing';
    this.pushLobby(room);
    this.pushGame(room);
    return { ok: true };
  }

  returnToLobby(socketId: string): void {
    const ctx = this.context(socketId);
    if (!ctx || ctx.room.phase !== 'playing' || ctx.room.game?.status === 'playing') return;
    const { room } = ctx;
    room.phase = 'lobby';
    room.game = null;
    room.players.forEach((p) => (p.ready = p.id === room.hostId));
    this.pushLobby(room);
  }

  action(socketId: string, action: ClientAction): Ack<{ duplicate?: boolean }> {
    const ctx = this.context(socketId);
    if (!ctx || !ctx.room.game) return fail('NOT_ALLOWED', 'Es läuft keine Runde.');
    const { room, player } = ctx;
    const result = applyAction(room.game!, toGameAction(action, player.id), this.now());
    if (!result.ok) return result;
    if (result.duplicate) return { ok: true, duplicate: true };
    room.game = result.state;
    room.lastEvents = result.events;
    this.pushGame(room);
    return { ok: true };
  }

  planTarget(socketId: string): { code: string; playerId: string } | null {
    const ctx = this.context(socketId);
    if (!ctx || ctx.room.phase !== 'playing') return null;
    return { code: ctx.room.code, playerId: ctx.player.id };
  }

  /** Wird regelmäßig aufgerufen: Zeitlimit prüfen und verwaiste Räume/Plätze aufräumen. */
  tick(): void {
    const now = this.now();
    for (const room of [...this.rooms.values()]) {
      if (room.game?.status === 'playing') {
        const result = applyAction(room.game, { type: 'tick' }, now);
        if (result.ok && result.state !== room.game) {
          room.game = result.state;
          room.lastEvents = result.events;
          this.pushGame(room);
        }
      }
      if (room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
        this.rooms.delete(room.code);
        continue;
      }
      if (room.phase === 'lobby') {
        const expired = room.players.filter(
          (p) => p.disconnectedAt !== null && now - p.disconnectedAt > RECONNECT_GRACE_MS,
        );
        if (expired.length > 0) {
          expired.forEach((p) => this.removePlayer(room, p));
          if (this.rooms.has(room.code)) this.pushLobby(room);
        }
      }
    }
  }

  /** Nur für Tests: direkter Zugriff auf den Spielzustand. */
  gameOf(code: string): GameState | null {
    return this.rooms.get(code)?.game ?? null;
  }
}
