import { describe, expect, it } from 'vitest';
import { MAPS, cheapestRoutes, createGame, tileCost, type MapDef } from '../src';

/** Gieriges Anschließen aller Gebäude ohne Fähigkeiten. */
function greedyCost(map: MapDef, blocked: Set<string> = new Set()): number | null {
  let state = createGame(map, 'solo', [{ id: 'p', name: 'p', animal: 'fox' }], 0);
  let total = 0;
  while (state.connected.length < map.buildings.length) {
    const blockedState = { ...state, builtCells: [...state.builtCells] };
    const [best] = cheapestRoutes(map, blockedState, (t) => tileCost(t, false, null).cost).filter(
      (r) => !r.cells.some((c) => blocked.has(`${c.x},${c.y}`)),
    );
    if (!best) return null;
    total += best.cost;
    state = {
      ...state,
      connected: [...state.connected, best.buildingId],
      builtCells: [...state.builtCells, ...best.cells.map((c) => `${c.x},${c.y}`)],
    };
  }
  return total;
}

describe.each(MAPS.map((m) => [m.id, m] as const))('Karte %s', (_id, map) => {
  it('ist ohne Fähigkeiten innerhalb des Budgets lösbar', () => {
    const cost = greedyCost(map);
    expect(cost).not.toBeNull();
    expect(cost!).toBeLessThanOrEqual(map.budget);
    expect(cost!).toBeLessThanOrEqual(map.parCost);
  });

  it('hat sinnvolle Sterne-Schwellen', () => {
    expect(map.stars.three).toBeLessThanOrEqual(map.stars.two);
    expect(map.stars.two).toBeLessThanOrEqual(map.budget);
  });

  it('bietet mindestens zwei verschiedene Routen zum ersten Gebäude', () => {
    const state = createGame(map, 'solo', [{ id: 'p', name: 'p', animal: 'fox' }], 0);
    const [best] = cheapestRoutes(map, state, (t) => tileCost(t, false, null).cost);
    // Sperrt man die Mitte der besten Route, muss es weiterhin einen Weg im Budget geben.
    const middle = best.cells[Math.floor(best.cells.length / 2)];
    const alt = cheapestRoutes(
      map,
      { ...state, builtCells: [`${middle.x},${middle.y}`] },
      (t) => tileCost(t, false, null).cost,
    ).find((r) => r.buildingId === best.buildingId);
    expect(alt).toBeDefined();
    expect(alt!.cost).toBeLessThanOrEqual(map.budget);
  });
});
