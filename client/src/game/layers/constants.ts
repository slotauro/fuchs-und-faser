import type { Cell } from '@fuf/shared';

/** Kachelgröße in Weltpixeln (Phaser skaliert das Spielfeld per Scale.FIT auf den verfügbaren Platz). */
export const TILE = 96;
/** Dekorativer Randbereich rund um das Spielraster (Bäume, Büsche). */
export const MARGIN = 96;

/** Zeichenebenen von hinten nach vorn. */
export const DEPTH = {
  terrain: 0,
  grid: 1,
  houses: 2,
  /** Biberbrücke, Maulwurfsgraben und gespaltener Fels liegen unter der Leitung */
  structures: 2.5,
  fiber: 3,
  /** wandernder Erdbuckel beim Graben liegt über der Leitung */
  tunnel: 3.5,
  props: 4,
  plan: 5,
  figures: 7,
  labels: 8,
  hover: 9,
  fx: 10,
} as const;

export const center = (c: Cell) => ({ x: c.x * TILE + TILE / 2, y: c.y * TILE + TILE / 2 });
