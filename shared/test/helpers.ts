import { createGame, getMap, type AnimalId, type Cell } from '../src';

/** Kurzschreibweise für Routen: "2,5 3,5 4,5" */
export const route = (s: string): Cell[] =>
  s.trim().split(/\s+/).map((p) => {
    const [x, y] = p.split(',').map(Number);
    return { x, y };
  });

export function solo(mapId: string, animal: AnimalId = 'fox', now = 0) {
  const map = getMap(mapId);
  return { map, state: createGame(map, 'solo', [{ id: 'p1', name: 'Tester', animal }], now) };
}

/** Umweg unter den Felsen auf Karte 1 (15 Punkte). */
export const MAP1_DETOUR = route('1,4 1,5 2,5 3,5 4,5 5,5 6,5 7,5 8,5 9,5 10,5 11,5 11,4');
/** Direkter Weg durch die Felsen auf Karte 1 (17 Punkte). */
export const MAP1_ROCKS = route('2,3 2,4 3,4 4,4 5,4 6,4 7,4 8,4 9,4 10,4 11,4');
/** Karte 2: gerade durch die Wurzelzone (nur mit Maulwurf). */
export const MAP2_TUNNEL = route('2,4 3,4 4,4 5,4 6,4 7,4 8,4 9,4 10,4 11,4 12,4 13,4 14,4');
