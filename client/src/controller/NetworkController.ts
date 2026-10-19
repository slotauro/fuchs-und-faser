import { getMap, type Cell, type ClientAction, type GameState, type GameStatePayload, type MapDef } from '@fuf/shared';
import type { GameSocket } from '../net/NetworkGateway';
import { request } from '../net/NetworkGateway';
import { newActionId, type ControllerResult, type GameController, type PlanListener, type StateListener } from './GameController';

/**
 * Multiplayer: Aktionen werden nur vorgeschlagen, der Server prüft und verteilt
 * den maßgeblichen Zustand an alle Spieler im Raum.
 */
export class NetworkController implements GameController {
  readonly map: MapDef;
  readonly canPause = false;
  private state: GameState;
  private clockOffset: number;
  private listeners = new Set<StateListener>();
  private planListeners = new Set<PlanListener>();
  private lastPlanSent = 0;
  private pendingPlan: number | null = null;

  constructor(
    private socket: GameSocket,
    readonly localPlayerId: string,
    initial: GameStatePayload,
  ) {
    this.map = getMap(initial.state.mapId);
    this.state = initial.state;
    this.clockOffset = initial.serverNow - Date.now();
    socket.on('game:state', this.onState);
    socket.on('game:plan', this.onPlan);
  }

  private onState = (payload: GameStatePayload): void => {
    if (payload.state.mapId !== this.state.mapId || payload.state.startedAt !== this.state.startedAt) return;
    if (payload.state.version < this.state.version) return;
    this.clockOffset = payload.serverNow - Date.now();
    const events = payload.state.version > this.state.version ? payload.events : [];
    this.state = payload.state;
    this.listeners.forEach((l) => l(this.state, events));
  };

  private onPlan = (p: { playerId: string; cells: Cell[] }): void => {
    this.planListeners.forEach((l) => l(p.playerId, p.cells));
  };

  getState(): GameState {
    return this.state;
  }

  now(): number {
    return Date.now() + this.clockOffset;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onPeerPlan(listener: PlanListener): () => void {
    this.planListeners.add(listener);
    return () => this.planListeners.delete(listener);
  }

  /** Sendet eine Aktion; bei Zeitüberschreitung wird sie mit derselben ID wiederholt (idempotent). */
  private async send(action: ClientAction): Promise<ControllerResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await request<{ ok: boolean; error?: ControllerResult['error'] }>((ack) =>
          this.socket.emit('game:action', action, ack as never),
        );
        return response.ok ? { ok: true } : { ok: false, error: response.error };
      } catch {
        // erneuter Versuch mit gleicher actionId
      }
    }
    return { ok: false, error: { code: 'NOT_ALLOWED', message: 'Keine Antwort vom Server – bitte erneut versuchen.' } };
  }

  buildRoute(cells: Cell[]): Promise<ControllerResult> {
    return this.send({ type: 'buildRoute', actionId: newActionId(), cells });
  }

  useScout(): Promise<ControllerResult> {
    return this.send({ type: 'useScout', actionId: newActionId() });
  }

  forfeit(): Promise<ControllerResult> {
    return this.send({ type: 'forfeit', actionId: newActionId() });
  }

  pause(): void {}
  resume(): void {}

  sendPlan(cells: Cell[]): void {
    const flush = () => {
      this.pendingPlan = null;
      this.lastPlanSent = Date.now();
      this.socket.emit('game:plan', cells);
    };
    if (this.pendingPlan !== null) window.clearTimeout(this.pendingPlan);
    const wait = 150 - (Date.now() - this.lastPlanSent);
    if (wait <= 0) flush();
    else this.pendingPlan = window.setTimeout(flush, wait);
  }

  dispose(): void {
    if (this.pendingPlan !== null) window.clearTimeout(this.pendingPlan);
    this.socket.off('game:state', this.onState);
    this.socket.off('game:plan', this.onPlan);
    this.listeners.clear();
    this.planListeners.clear();
  }
}
