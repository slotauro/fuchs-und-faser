import { cellKey, neighbors, parseCellKey } from './tiles';
import { networkKeys } from './routeValidator';
import type { Cell, GameState, HalfPoints, MapDef, TileType } from './types';

export type CostFn = (tile: TileType) => HalfPoints | null;

export interface PathResult {
  buildingId: string;
  cost: HalfPoints;
  cells: Cell[];
}

/**
 * Dijkstra vom gesamten Netz aus zu allen unversorgten Hausanschlüssen.
 * Hausanschlüsse sind nur als Endpunkt erlaubt, gebaute Kacheln nicht erneut bebaubar.
 */
export function cheapestRoutes(map: MapDef, state: GameState, costFn: CostFn): PathResult[] {
  const network = networkKeys(map, state);
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const open = new Set<string>();

  for (const key of network) {
    for (const n of neighbors(parseCellKey(key), map.width, map.height)) {
      const nKey = cellKey(n);
      if (network.has(nKey)) continue;
      const cost = costFn(map.tiles[n.y][n.x]);
      if (cost === null) continue;
      if (cost < (dist.get(nKey) ?? Infinity)) {
        dist.set(nKey, cost);
        prev.set(nKey, null);
        open.add(nKey);
      }
    }
  }

  const done = new Set<string>();
  while (open.size > 0) {
    let current = '';
    let best = Infinity;
    for (const key of open) {
      const d = dist.get(key)!;
      if (d < best) {
        best = d;
        current = key;
      }
    }
    open.delete(current);
    done.add(current);
    const cell = parseCellKey(current);
    // Über einen Hausanschluss wird nicht weitergebaut.
    if (map.tiles[cell.y][cell.x] === 'connection') continue;

    for (const n of neighbors(cell, map.width, map.height)) {
      const nKey = cellKey(n);
      if (done.has(nKey) || network.has(nKey)) continue;
      const cost = costFn(map.tiles[n.y][n.x]);
      if (cost === null) continue;
      const candidate = best + cost;
      if (candidate < (dist.get(nKey) ?? Infinity)) {
        dist.set(nKey, candidate);
        prev.set(nKey, current);
        open.add(nKey);
      }
    }
  }

  const results: PathResult[] = [];
  for (const building of map.buildings) {
    if (state.connected.includes(building.id)) continue;
    const key = cellKey(building.connection);
    const cost = dist.get(key);
    if (cost === undefined) continue;
    const cells: Cell[] = [];
    let step: string | null = key;
    while (step) {
      cells.unshift(parseCellKey(step));
      step = prev.get(step) ?? null;
    }
    results.push({ buildingId: building.id, cost, cells });
  }
  return results.sort((a, b) => a.cost - b.cost);
}
