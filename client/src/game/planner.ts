import {
  abilityTileCost,
  analyzeRoute,
  canArmAt,
  cellKey,
  isAdjacent,
  networkKeys,
  routeAbility,
  type AnimalId,
  type Cell,
  type GameError,
  type RouteAnalysis,
} from '@fuf/shared';
import type { GameController } from '../controller/GameController';

/**
 * Lokale Routenplanung des Spielers. Nicht maßgeblich – gebaut wird erst,
 * wenn der Controller (lokal oder Server) die Route akzeptiert.
 */
export class Planner {
  cells: Cell[] = [];
  abilityArmed = false;
  /** Letzte vom Regelwerk abgelehnte Bauaktion (wird bei Änderungen zurückgesetzt). */
  rejected: GameError | null = null;
  /** Netzkachel, auf der die eigene Figur steht, solange nichts geplant ist. */
  home: Cell;
  /** Startfeld aller Figuren: der Netzverteiler. */
  readonly start: Cell;
  private listeners = new Set<() => void>();

  constructor(private controller: GameController) {
    const { map } = controller;
    const y = map.tiles.findIndex((row) => row.includes('distributor'));
    this.start = { x: map.tiles[y].indexOf('distributor'), y };
    this.home = this.start;
  }

  /** Position der eigenen Figur: Ende der Planung oder ihr Standplatz am Netz. */
  get figure(): Cell {
    return this.cells[this.cells.length - 1] ?? this.home;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    this.rejected = null;
    // Ohne passendes Hindernis vor der Figur und in der Planung erlischt die scharf geschaltete Fähigkeit wieder
    if (this.abilityArmed && !this.canArm && !this.plansAbilityTile()) this.abilityArmed = false;
    this.controller.sendPlan(this.cells);
    this.listeners.forEach((l) => l());
  }

  notify(): void {
    this.listeners.forEach((l) => l());
  }

  get player() {
    const state = this.controller.getState();
    return state.players.find((p) => p.id === this.controller.localPlayerId);
  }

  /** Bau-Fähigkeit, die für die aktuelle Planung gilt (scharf geschaltet oder passiv). */
  get activeAbility(): AnimalId | null {
    const player = this.player;
    return player ? routeAbility(player, this.abilityArmed) : null;
  }

  /** Steht die Figur direkt vor dem Hindernis, für das die eigene Bau-Fähigkeit gedacht ist? */
  get canArm(): boolean {
    const player = this.player;
    if (!player || player.abilityUsed) return false;
    const behind = new Set([...this.controller.getState().builtCells, ...this.cells.slice(0, -1).map(cellKey)]);
    return canArmAt(this.controller.map, player.animal, this.figure, behind);
  }

  private plansAbilityTile(): boolean {
    const player = this.player;
    const { tiles } = this.controller.map;
    return !!player && this.cells.some((c) => abilityTileCost(player.animal, tiles[c.y][c.x]) !== undefined);
  }

  analysis(): RouteAnalysis {
    return analyzeRoute(this.controller.map, this.controller.getState(), this.cells, {
      activeAbility: this.activeAbility,
      partial: true,
      spentAbility: this.player?.abilityUsed ? this.player.animal : null,
    });
  }

  /** Kacheln, an denen die Route als Nächstes weitergehen kann. */
  candidates(): Cell[] {
    const { map } = this.controller;
    const state = this.controller.getState();
    const built = new Set(state.builtCells);
    const inPlan = new Set(this.cells.map(cellKey));
    const result: Cell[] = [];
    const network = networkKeys(map, state);
    const from = this.cells.length > 0 ? [this.cells[this.cells.length - 1]] : [...network].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });
    if (this.cells.length > 0 && map.tiles[from[0].y][from[0].x] === 'connection') return [];
    for (const origin of from) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = { x: origin.x + dx, y: origin.y + dy };
        if (c.x < 0 || c.y < 0 || c.x >= map.width || c.y >= map.height) continue;
        const key = cellKey(c);
        if (built.has(key) || inPlan.has(key) || network.has(key)) continue;
        result.push(c);
      }
    }
    return result;
  }

  /** Benachbarte Netzkachel, an der eine Route mit `cell` beginnt (bevorzugt der aktuelle Standplatz). */
  private networkNeighbor(cell: Cell): Cell | null {
    const network = networkKeys(this.controller.map, this.controller.getState());
    if (isAdjacent(this.home, cell) && network.has(cellKey(this.home))) return this.home;
    for (const k of network) {
      const [x, y] = k.split(',').map(Number);
      if (isAdjacent({ x, y }, cell)) return { x, y };
    }
    return null;
  }

  /** Bewegt die eigene Figur um ein Feld (Pfeiltasten). Gibt eine Hinweismeldung zurück, falls nichts passiert. */
  step(dx: number, dy: number): string | null {
    const { map } = this.controller;
    const from = this.figure;
    const to = { x: from.x + dx, y: from.y + dy };
    if (to.x < 0 || to.y < 0 || to.x >= map.width || to.y >= map.height) return null;
    const back = this.cells.length > 1 ? this.cells[this.cells.length - 2] : this.cells.length === 1 ? this.home : null;
    if (back && back.x === to.x && back.y === to.y) {
      this.undo();
      return null;
    }
    const network = networkKeys(map, this.controller.getState());
    const tile = map.tiles[to.y][to.x];
    if (this.cells.length === 0) {
      if (network.has(cellKey(to))) {
        // Auf vorhandenen Leitungen läuft die Figur frei herum, ohne zu planen.
        this.home = to;
        this.notify();
        return null;
      }
    } else {
      if (map.tiles[from.y][from.x] === 'connection') return 'Die Route endet bereits am Hausanschluss – jetzt bauen!';
      if (this.cells.some((c) => c.x === to.x && c.y === to.y)) return 'Die Leitung darf sich nicht selbst kreuzen.';
      if (network.has(cellKey(to))) return 'Hier liegt schon eine Leitung – geh zurück oder verwirf die Planung.';
    }
    if (tile === 'building') return 'Ins Gebäude geht es nur über den gelben Hausanschluss.';
    this.cells = [...this.cells, to];
    this.changed();
    return null;
  }

  private startsAtNetwork(cell: Cell): boolean {
    const network = networkKeys(this.controller.map, this.controller.getState());
    if (network.has(cellKey(cell))) return false;
    return [...network].some((k) => {
      const [x, y] = k.split(',').map(Number);
      return isAdjacent({ x, y }, cell);
    });
  }

  /** Klick auf eine Kachel. Gibt eine Hinweismeldung zurück, falls nichts passiert. */
  click(cell: Cell): string | null {
    const index = this.cells.findIndex((c) => c.x === cell.x && c.y === cell.y);
    if (index === this.cells.length - 1 && index >= 0) {
      this.cells = this.cells.slice(0, -1);
      this.changed();
      return null;
    }
    if (index >= 0) {
      this.cells = this.cells.slice(0, index + 1);
      this.changed();
      return null;
    }
    return this.extend(cell);
  }

  /** Verlängern per Ziehen: nur benachbarte Kacheln, keine Rücknahme. */
  drag(cell: Cell): void {
    const last = this.cells[this.cells.length - 1];
    if (last && last.x === cell.x && last.y === cell.y) return;
    const prev = this.cells[this.cells.length - 2];
    if (prev && prev.x === cell.x && prev.y === cell.y) {
      this.cells = this.cells.slice(0, -1);
      this.changed();
      return;
    }
    if (!this.cells.some((c) => c.x === cell.x && c.y === cell.y)) this.extend(cell);
  }

  private extend(cell: Cell): string | null {
    const last = this.cells[this.cells.length - 1];
    if (!last) {
      const network = networkKeys(this.controller.map, this.controller.getState());
      if (network.has(cellKey(cell))) return null; // Ziehen kann am Netz beginnen
      if (!this.startsAtNetwork(cell)) {
        return 'Starte direkt neben dem Netzverteiler oder einer gebauten Leitung.';
      }
      this.home = this.networkNeighbor(cell) ?? this.home;
      this.cells = [cell];
      this.changed();
      return null;
    }
    if (this.controller.map.tiles[last.y][last.x] === 'connection') {
      return 'Die Route endet bereits am Hausanschluss – jetzt bauen!';
    }
    if (!isAdjacent(last, cell)) {
      if (this.startsAtNetwork(cell)) {
        this.home = this.networkNeighbor(cell) ?? this.home;
        this.cells = [cell];
        this.changed();
        return null;
      }
      return 'Nur direkt benachbarte Felder können angehängt werden.';
    }
    this.cells = [...this.cells, cell];
    this.changed();
    return null;
  }

  undo(): void {
    if (this.cells.length === 0) return;
    this.cells = this.cells.slice(0, -1);
    this.changed();
  }

  clear(): void {
    this.cells = [];
    this.abilityArmed = false;
    this.changed();
  }

  /** Nach erfolgreichem Bau bleibt die Figur am Ende der neuen Leitung stehen. */
  finishBuild(): void {
    this.home = this.figure;
    this.clear();
  }

  /** Schaltet die Bau-Fähigkeit scharf (nur direkt vor dem passenden Hindernis) oder wieder ab. */
  setArmed(armed: boolean): boolean {
    if (armed && !this.canArm) return false;
    this.abilityArmed = armed;
    this.changed();
    return true;
  }

  reject(error: GameError): void {
    this.rejected = error;
    this.notify();
  }
}
