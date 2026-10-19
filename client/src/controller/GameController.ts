import {
  applyAction,
  createGame,
  getMap,
  type AnimalId,
  type Cell,
  type GameAction,
  type GameError,
  type GameEvent,
  type GameState,
  type MapDef,
} from '@fuf/shared';

export interface ControllerResult {
  ok: boolean;
  error?: GameError;
}

export type StateListener = (state: GameState, events: GameEvent[]) => void;
export type PlanListener = (playerId: string, cells: Cell[]) => void;

/**
 * Gemeinsame Schnittstelle für Solo (Regeln lokal) und Multiplayer (Server entscheidet).
 * Spielfeld und HUD kennen nur diese Schnittstelle.
 */
export interface GameController {
  readonly map: MapDef;
  readonly localPlayerId: string;
  readonly canPause: boolean;
  getState(): GameState;
  /** Aktuelle Zeit in der Uhr des maßgeblichen Spielzustands. */
  now(): number;
  subscribe(listener: StateListener): () => void;
  onPeerPlan(listener: PlanListener): () => void;
  buildRoute(cells: Cell[]): Promise<ControllerResult>;
  useScout(): Promise<ControllerResult>;
  forfeit(): Promise<ControllerResult>;
  pause(): void;
  resume(): void;
  sendPlan(cells: Cell[]): void;
  dispose(): void;
}

let localActionCounter = 0;
export const newActionId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `a-${Date.now()}-${++localActionCounter}`;

/** Singleplayer: wendet den gemeinsamen Reducer direkt im Browser an. */
export class LocalController implements GameController {
  readonly map: MapDef;
  readonly localPlayerId = 'solo';
  readonly canPause = true;
  private state: GameState;
  private listeners = new Set<StateListener>();
  private timer: number;

  constructor(mapId: string, animal: AnimalId, name: string) {
    this.map = getMap(mapId);
    this.state = createGame(this.map, 'solo', [{ id: this.localPlayerId, name, animal }], Date.now());
    this.timer = window.setInterval(() => this.dispatch({ type: 'tick' }), 250);
  }

  getState(): GameState {
    return this.state;
  }

  now(): number {
    return Date.now();
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onPeerPlan(): () => void {
    return () => undefined;
  }

  private dispatch(action: GameAction): ControllerResult {
    const result = applyAction(this.state, action, Date.now());
    if (!result.ok) return { ok: false, error: result.error };
    if (result.state !== this.state) {
      this.state = result.state;
      this.listeners.forEach((l) => l(this.state, result.events));
    }
    return { ok: true };
  }

  async buildRoute(cells: Cell[]): Promise<ControllerResult> {
    return this.dispatch({ type: 'buildRoute', actionId: newActionId(), playerId: this.localPlayerId, cells });
  }

  async useScout(): Promise<ControllerResult> {
    return this.dispatch({ type: 'useScout', actionId: newActionId(), playerId: this.localPlayerId });
  }

  async forfeit(): Promise<ControllerResult> {
    return this.dispatch({ type: 'forfeit', actionId: newActionId(), playerId: this.localPlayerId });
  }

  pause(): void {
    this.dispatch({ type: 'pause' });
  }

  resume(): void {
    this.dispatch({ type: 'resume' });
  }

  sendPlan(): void {}

  dispose(): void {
    window.clearInterval(this.timer);
    this.listeners.clear();
  }
}
