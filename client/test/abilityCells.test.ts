import { describe, expect, it } from 'vitest';
import { applyAction, createGame, getMap, type AnimalId, type Cell } from '@fuf/shared';
import { abilityTraces } from '../src/game/layers/abilityCells';
import { svgSize, worldAssets } from '../src/game/art/svgAssets';

const route = (s: string): Cell[] =>
  s.split(' ').map((p) => {
    const [x, y] = p.split(',').map(Number);
    return { x, y };
  });

/** Baut auf der Wurzelallee eine Route mit dem gegebenen Tier und liefert die Fähigkeits-Spuren. */
function build(animal: AnimalId, cells: Cell[]) {
  const map = getMap('wurzelallee');
  const state = createGame(map, 'solo', [{ id: 'p1', name: 'Tester', animal }], 0);
  const r = applyAction(state, { type: 'buildRoute', actionId: 'a1', playerId: 'p1', cells }, 1000);
  if (!r.ok) throw new Error(r.error.message);
  return abilityTraces(map, r.state);
}

describe('Spuren der Fähigkeiten', () => {
  it('Biber: Brücke auf den Querungsstellen, quer zur Laufrichtung', () => {
    const [trace] = build('beaver', route('2,4 3,4 4,4 5,4 6,4 6,3 7,3 8,3 9,3 9,4 10,4 11,4 12,4 13,4 14,4'));
    expect(trace.animal).toBe('beaver');
    expect(trace.cells.map((c) => [c.cell.x, c.cell.y, c.index, c.axis])).toEqual([
      [7, 3, 6, 'h'],
      [8, 3, 7, 'h'],
    ]);
  });

  it('Maulwurf: Tunnel durch die Wurzeln mit Ein- und Ausgang', () => {
    const [trace] = build('mole', route('2,4 3,4 4,4 5,4 6,4 7,4 8,4 9,4 10,4 11,4 12,4 13,4 14,4'));
    expect(trace.cells.map((c) => [c.cell.x, c.cell.y])).toEqual([
      [7, 4],
      [8, 4],
    ]);
    expect(trace.portals.map((p) => [p.cell.x, p.cell.y, p.toward.x])).toEqual([
      [6, 4, 7],
      [9, 4, 8],
    ]);
  });

  it('Dachs: gespaltener Fels auf den Felskacheln', () => {
    const [trace] = build('badger', route('2,4 2,5 2,6 3,6 4,6 5,6 6,6 7,6 8,6 9,6 9,5 9,4 10,4 11,4 12,4 13,4 14,4'));
    expect(trace.cells.map((c) => [c.cell.x, c.cell.y, c.axis])).toEqual([
      [7, 6, 'h'],
      [8, 6, 'h'],
    ]);
  });

  it('ohne Fähigkeit gibt es keine Spur', () => {
    expect(build('fox', route('2,4 2,5 2,6 3,6 4,6 5,6 6,6 7,6 8,6 9,6 9,5 9,4 10,4 11,4 12,4 13,4 14,4'), false)).toEqual([]);
  });
});

describe('Assets der Fähigkeiten', () => {
  it('Brücke und Maulwurfshügel sind registriert und haben eine Größe', () => {
    const assets = new Map(worldAssets().map((a) => [a.key, a.svg]));
    for (const key of ['bridge', 'molehill']) {
      expect(assets.has(key)).toBe(true);
      expect(svgSize(assets.get(key)!).width).toBeGreaterThan(0);
    }
  });
});
