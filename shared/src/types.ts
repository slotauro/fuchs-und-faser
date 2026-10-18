// Alle Kosten und Budgets werden intern in halben Punkten (ganzzahlig) geführt,
// damit 0,5 Punkte für Leerrohre ohne Rundungsfehler funktionieren.
export type HalfPoints = number;

export type TileType =
  | 'meadow'
  | 'sidewalk'
  | 'road'
  | 'rock'
  | 'roots'
  | 'water'
  | 'bridgeSite'
  | 'conduit'
  | 'hiddenConduit'
  | 'foreignLine'
  | 'distributor'
  | 'building'
  | 'connection';

export interface Cell {
  x: number;
  y: number;
}

export type AnimalId = 'fox' | 'mole' | 'beaver' | 'badger';

export interface BuildingDef {
  id: string;
  name: string;
  /** Hausanschlusspunkt (Kachel vom Typ `connection`). */
  connection: Cell;
}

export interface MapDef {
  id: string;
  name: string;
  description: string;
  tips: string[];
  width: number;
  height: number;
  tiles: TileType[][]; // tiles[y][x]
  buildings: BuildingDef[];
  budget: HalfPoints;
  timeLimitSec: number;
  /** Kostenobergrenzen (inklusive) für zwei bzw. drei Sterne. */
  stars: { two: HalfPoints; three: HalfPoints };
  /** Referenzkosten für die Effizienzwertung (gute Lösung ohne Fähigkeiten). */
  parCost: HalfPoints;
}

export interface PlayerState {
  id: string;
  name: string;
  animal: AnimalId;
  abilityUsed: boolean;
}

export interface BuiltRoute {
  actionId: string;
  playerId: string;
  cells: Cell[];
  cost: HalfPoints;
  abilityUsed: boolean;
}

export type GameMode = 'solo' | 'coop';
export type GameStatus = 'playing' | 'won' | 'lost';
export type LossReason = 'time' | 'budget' | 'forfeit';

export interface ScoreLine {
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface ScoreResult {
  total: number;
  stars: 0 | 1 | 2 | 3;
  lines: ScoreLine[];
}

export interface GameState {
  mapId: string;
  mode: GameMode;
  status: GameStatus;
  lossReason?: LossReason;
  startBudget: HalfPoints;
  budget: HalfPoints;
  spent: HalfPoints;
  routes: BuiltRoute[];
  /** Schlüssel "x,y" aller gebauten Leitungskacheln. */
  builtCells: string[];
  connected: string[];
  players: PlayerState[];
  scoutRevealed: boolean;
  hint: Cell[] | null;
  startedAt: number;
  endsAt: number;
  pausedAt: number | null;
  finishedAt: number | null;
  appliedActionIds: string[];
  version: number;
  result: ScoreResult | null;
}

export type GameAction =
  | { type: 'buildRoute'; actionId: string; playerId: string; cells: Cell[]; useAbility: boolean }
  | { type: 'useScout'; actionId: string; playerId: string }
  | { type: 'tick' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'forfeit'; actionId: string; playerId: string };

export type ErrorCode =
  | 'EMPTY_ROUTE'
  | 'OUT_OF_BOUNDS'
  | 'START_NOT_CONNECTED'
  | 'GAP'
  | 'REPEATED_CELL'
  | 'ALREADY_BUILT'
  | 'BLOCKED'
  | 'PASSES_ENDPOINT'
  | 'END_NOT_CONNECTION'
  | 'ALREADY_CONNECTED'
  | 'OVER_BUDGET'
  | 'ABILITY_USED'
  | 'ABILITY_NOT_APPLICABLE'
  | 'ROOTS_TOO_LONG'
  | 'GAME_OVER'
  | 'UNKNOWN_PLAYER'
  | 'NOT_ALLOWED'
  | 'INVALID_ACTION';

export interface GameError {
  code: ErrorCode;
  message: string;
  /** Index der problematischen Kachel in der Route, falls zutreffend. */
  cellIndex?: number;
}

export type GameEvent =
  | { type: 'routeBuilt'; playerId: string; cost: HalfPoints; cells: Cell[] }
  | { type: 'buildingConnected'; buildingId: string; playerId: string }
  | { type: 'abilityUsed'; playerId: string; animal: AnimalId }
  | { type: 'roundWon' }
  | { type: 'roundLost'; reason: LossReason };

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[]; duplicate?: boolean }
  | { ok: false; error: GameError };
