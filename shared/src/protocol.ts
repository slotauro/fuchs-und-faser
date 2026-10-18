import type { AnimalId, Cell, GameAction, GameError, GameEvent, GameState } from './types';

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
export const MAX_NAME_LENGTH = 16;
export const ROOM_CODE_LENGTH = 6;

export interface LobbyPlayer {
  id: string;
  name: string;
  animal: AnimalId;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
}

export interface LobbyState {
  code: string;
  mapId: string;
  phase: 'lobby' | 'playing';
  players: LobbyPlayer[];
}

/** Aktionen, die ein Client im Multiplayer vorschlagen darf (playerId setzt der Server). */
export type ClientAction =
  | { type: 'buildRoute'; actionId: string; cells: Cell[]; useAbility: boolean }
  | { type: 'useScout'; actionId: string }
  | { type: 'forfeit'; actionId: string };

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: GameError };

export interface JoinedPayload {
  playerId: string;
  token: string;
  lobby: LobbyState;
  game: GameStatePayload | null;
}

export interface GameStatePayload {
  state: GameState;
  events: GameEvent[];
  serverNow: number;
}

export interface ClientToServer {
  'room:create': (p: { name: string; animal: AnimalId }, ack: (r: Ack<JoinedPayload>) => void) => void;
  'room:join': (p: { code: string; name: string }, ack: (r: Ack<JoinedPayload>) => void) => void;
  'room:rejoin': (p: { code: string; token: string }, ack: (r: Ack<JoinedPayload>) => void) => void;
  'room:leave': () => void;
  'lobby:update': (p: { animal?: AnimalId; ready?: boolean; mapId?: string }, ack: (r: Ack) => void) => void;
  'lobby:start': (ack: (r: Ack) => void) => void;
  'lobby:return': () => void;
  'game:action': (action: ClientAction, ack: (r: Ack<{ duplicate?: boolean }>) => void) => void;
  'game:plan': (cells: Cell[]) => void;
}

export interface ServerToClient {
  'lobby:state': (lobby: LobbyState) => void;
  'game:state': (payload: GameStatePayload) => void;
  'game:plan': (p: { playerId: string; cells: Cell[] }) => void;
  'error:rate': () => void;
}

export function toGameAction(action: ClientAction, playerId: string): GameAction {
  return { ...action, playerId };
}
