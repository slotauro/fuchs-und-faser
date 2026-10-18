import type { AnimalId, GameMode, GameState, MapDef } from './types';

export interface NewPlayer {
  id: string;
  name: string;
  animal: AnimalId;
}

export function createGame(map: MapDef, mode: GameMode, players: NewPlayer[], now: number): GameState {
  return {
    mapId: map.id,
    mode,
    status: 'playing',
    startBudget: map.budget,
    budget: map.budget,
    spent: 0,
    routes: [],
    builtCells: [],
    connected: [],
    players: players.map((p) => ({ ...p, abilityUsed: false })),
    scoutRevealed: false,
    hint: null,
    startedAt: now,
    endsAt: now + map.timeLimitSec * 1000,
    pausedAt: null,
    finishedAt: null,
    appliedActionIds: [],
    version: 0,
    result: null,
  };
}
