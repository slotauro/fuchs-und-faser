import type { BuildingDef, Cell, MapDef } from '@fuf/shared';
import { cellRng, hashString, mulberry32 } from './rng';

/** Zusammenhängender Block aus Gebäudekacheln, der als ein Haus gezeichnet wird. */
export interface BuildingBlock {
  cells: Cell[];
  bounds: { x: number; y: number; w: number; h: number };
  building: BuildingDef | null;
  variant: HouseVariant;
}

export type HouseVariant = 'cottage' | 'villa' | 'bakery' | 'school';

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function variantFor(building: BuildingDef | null, index: number): HouseVariant {
  const name = building?.name.toLowerCase() ?? '';
  if (name.includes('bäckerei')) return 'bakery';
  if (name.includes('schule')) return 'school';
  return index % 2 === 0 ? 'cottage' : 'villa';
}

/** Gruppiert die Gebäudekacheln per Flood-Fill und ordnet jedem Block seinen Hausanschluss zu. */
export function buildingBlocks(map: MapDef): BuildingBlock[] {
  const seen = new Set<string>();
  const blocks: BuildingBlock[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.tiles[y][x] !== 'building' || seen.has(`${x},${y}`)) continue;
      const cells: Cell[] = [];
      const stack = [{ x, y }];
      seen.add(`${x},${y}`);
      while (stack.length) {
        const c = stack.pop()!;
        cells.push(c);
        for (const [dx, dy] of STEPS) {
          const n = { x: c.x + dx, y: c.y + dy };
          const key = `${n.x},${n.y}`;
          if (n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height) continue;
          if (seen.has(key) || map.tiles[n.y][n.x] !== 'building') continue;
          seen.add(key);
          stack.push(n);
        }
      }
      const xs = cells.map((c) => c.x);
      const ys = cells.map((c) => c.y);
      const bounds = { x: Math.min(...xs), y: Math.min(...ys), w: 0, h: 0 };
      bounds.w = Math.max(...xs) - bounds.x + 1;
      bounds.h = Math.max(...ys) - bounds.y + 1;
      // Anschluss: innerhalb des Rechtecks (an der Hauswand) oder direkt daneben
      const building =
        map.buildings.find((b) => cells.some((c) => Math.abs(c.x - b.connection.x) + Math.abs(c.y - b.connection.y) === 1)) ??
        null;
      blocks.push({ cells, bounds, building, variant: variantFor(building, blocks.length) });
    }
  }
  return blocks;
}

export interface Decoration {
  key: string;
  /** Mittelpunkt des Bodenkontakts in Weltkoordinaten (Pixel). */
  x: number;
  y: number;
  scale: number;
  flip: boolean;
}

/** Größe der Dekorationsobjekte relativ zur Kachelgröße (Breite, Höhe ab Bodenkontakt nach oben). */
export const DECO_SIZE: Record<string, { w: number; h: number }> = {
  'tree-0': { w: 1.15, h: 1.35 },
  'tree-1': { w: 1.0, h: 1.45 },
  'tree-2': { w: 1.2, h: 1.2 },
  'bush-0': { w: 0.7, h: 0.5 },
  'bush-1': { w: 0.62, h: 0.46 },
  stone: { w: 0.5, h: 0.34 },
};

export function decorationBox(d: Decoration, tile: number) {
  const size = DECO_SIZE[d.key];
  const w = size.w * tile * d.scale;
  const h = size.h * tile * d.scale;
  return { left: d.x - w / 2, right: d.x + w / 2, top: d.y - h, bottom: d.y };
}

/**
 * Hohe Dekoration (Bäume, Büsche, Steine) nur im Randbereich außerhalb des Spielrasters,
 * damit sie niemals Hindernisse verdeckt oder die Bedienung stört.
 */
export function marginDecorations(map: MapDef, tile: number, margin: number): Decoration[] {
  const rng = mulberry32(hashString(`deco:${map.id}`));
  const result: Decoration[] = [];
  const W = map.width * tile;
  const H = map.height * tile;
  const overlapsGrid = (d: Decoration) => {
    const b = decorationBox(d, tile);
    return b.right > 0 && b.left < W && b.bottom > 0 && b.top < H;
  };
  const place = (x: number, y: number, candidates: string[]) => {
    const scale = 0.85 + rng() * 0.25;
    const flip = rng() < 0.5;
    const first = Math.floor(rng() * candidates.length);
    // vom gewürfelten Objekt aus kleinere probieren, bis es das Raster nicht berührt
    for (let i = first; i < candidates.length; i++) {
      const d = { key: candidates[i], x, y, scale, flip };
      if (!overlapsGrid(d)) {
        result.push(d);
        return;
      }
    }
  };
  const all = ['tree-0', 'tree-1', 'tree-2', 'bush-0', 'bush-1', 'stone'];
  const small = ['bush-0', 'bush-1', 'stone'];
  const side = ['tree-1', 'bush-0', 'bush-1', 'stone'];
  const step = tile * 0.85;
  for (let x = -margin * 0.3; x < W + margin * 0.3; x += step * (0.7 + rng() * 0.6)) {
    if (rng() < 0.85) place(x + rng() * tile * 0.2, -margin * 0.08 - rng() * margin * 0.1, all);
    if (rng() < 0.6) place(x + rng() * tile * 0.2, H + margin * (0.6 + rng() * 0.35), small);
  }
  for (let y = tile * 0.9; y < H + margin * 0.5; y += step * (0.9 + rng() * 0.9)) {
    if (rng() < 0.6) place(-margin * (0.45 + rng() * 0.1), y, side);
    if (rng() < 0.6) place(W + margin * (0.45 + rng() * 0.1), y, side);
  }
  return result.sort((a, b) => a.y - b.y);
}

/** Ob eine Weltposition (Pixel) innerhalb des Spielrasters liegt. */
export function insideGrid(map: MapDef, tile: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width * tile && y < map.height * tile;
}

export { cellRng };
