import { abilityTileCost, findPlayer, type AnimalId, type BuiltRoute, type Cell, type GameState, type MapDef } from '@fuf/shared';

/** Laufachse der Route auf einer Zelle: waagerecht oder senkrecht. */
export type Axis = 'h' | 'v';

export interface AbilityCell {
  cell: Cell;
  /** Position in der Route (für den Takt der Bauanimation). */
  index: number;
  axis: Axis;
}

export interface AbilityTrace {
  route: BuiltRoute;
  animal: AnimalId;
  /** Zellen, auf denen die Fähigkeit gewirkt hat (Brücke, Tunnel, Fels). */
  cells: AbilityCell[];
  /** Zellen direkt vor und nach jedem zusammenhängenden Abschnitt (Tunnel-Ein- und -Ausgang). */
  portals: { cell: Cell; index: number; toward: Cell }[];
}

function axisAt(cells: Cell[], i: number): Axis {
  const c = cells[i];
  const prev = cells[i - 1];
  const next = cells[i + 1];
  const ref = prev ?? next;
  if (!ref) return 'h';
  // An einer Ecke zählt die Richtung, aus der die Route kommt
  return ref.y === c.y ? 'h' : 'v';
}

/** Spur einer mit Fähigkeit gebauten Route; `null`, wenn die Route keine Fähigkeit genutzt hat. */
export function abilityTrace(map: MapDef, route: BuiltRoute, animal: AnimalId): AbilityTrace | null {
  if (!route.abilityUsed) return null;
  const cells: AbilityCell[] = [];
  route.cells.forEach((cell, index) => {
    if (abilityTileCost(animal, map.tiles[cell.y][cell.x]) !== undefined) cells.push({ cell, index, axis: axisAt(route.cells, index) });
  });
  if (cells.length === 0) return null;
  const portals: AbilityTrace['portals'] = [];
  const affected = new Set(cells.map((c) => c.index));
  for (const { index } of cells) {
    const before = route.cells[index - 1];
    const after = route.cells[index + 1];
    if (before && !affected.has(index - 1)) portals.push({ cell: before, index: index - 1, toward: route.cells[index] });
    if (after && !affected.has(index + 1)) portals.push({ cell: after, index: index + 1, toward: route.cells[index] });
  }
  return { route, animal, cells, portals };
}

/** Alle Fähigkeits-Spuren des Spielstands in Bau-Reihenfolge. */
export function abilityTraces(map: MapDef, state: GameState): AbilityTrace[] {
  const traces: AbilityTrace[] = [];
  for (const route of state.routes) {
    const player = findPlayer(state, route.playerId);
    const trace = player && abilityTrace(map, route, player.animal);
    if (trace) traces.push(trace);
  }
  return traces;
}
