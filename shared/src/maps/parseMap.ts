import type { BuildingDef, HalfPoints, MapDef, TileType } from '../types';

export const MAP_LEGEND: Record<string, TileType> = {
  '.': 'meadow',
  '=': 'sidewalk',
  '#': 'road',
  '^': 'rock',
  '%': 'roots',
  '~': 'water',
  b: 'bridgeSite',
  o: 'conduit',
  '?': 'hiddenConduit',
  x: 'foreignLine',
  D: 'distributor',
  B: 'building',
  A: 'connection',
};

export interface MapSource {
  id: string;
  name: string;
  description: string;
  tips: string[];
  grid: string[];
  /** Gebäudenamen in Lesereihenfolge der `A`-Kacheln (zeilenweise, links nach rechts). */
  buildingNames: string[];
  /** Werte in ganzen Punkten – werden in halbe Punkte umgerechnet. */
  budget: number;
  timeLimitSec: number;
  stars: { two: number; three: number };
  parCost: number;
}

const toHalf = (points: number): HalfPoints => Math.round(points * 2);

export function parseMap(src: MapSource): MapDef {
  const height = src.grid.length;
  const width = src.grid[0].length;
  const tiles: TileType[][] = [];
  const buildings: BuildingDef[] = [];
  let distributors = 0;

  src.grid.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${src.id}: Zeile ${y} hat falsche Länge`);
    tiles.push(
      [...row].map((ch, x) => {
        const tile = MAP_LEGEND[ch];
        if (!tile) throw new Error(`${src.id}: unbekanntes Zeichen "${ch}" bei ${x},${y}`);
        if (tile === 'distributor') distributors++;
        if (tile === 'connection') {
          const index = buildings.length;
          const name = src.buildingNames[index];
          if (!name) throw new Error(`${src.id}: kein Gebäudename für Anschluss bei ${x},${y}`);
          buildings.push({ id: `b${index + 1}`, name, connection: { x, y } });
        }
        return tile;
      }),
    );
  });

  if (distributors !== 1) throw new Error(`${src.id}: genau ein Verteiler erwartet`);
  if (buildings.length !== src.buildingNames.length) {
    throw new Error(`${src.id}: Anzahl Gebäudenamen passt nicht zu den Anschlusspunkten`);
  }

  return {
    id: src.id,
    name: src.name,
    description: src.description,
    tips: src.tips,
    width,
    height,
    tiles,
    buildings,
    budget: toHalf(src.budget),
    timeLimitSec: src.timeLimitSec,
    stars: { two: toHalf(src.stars.two), three: toHalf(src.stars.three) },
    parCost: toHalf(src.parCost),
  };
}
