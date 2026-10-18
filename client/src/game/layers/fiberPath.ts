import type { Cell, MapDef } from '@fuf/shared';
import { cellKey } from '@fuf/shared';
import { TILE, center } from './constants';

export interface Pt {
  x: number;
  y: number;
}

/** Netzzelle, an der eine Route beginnt (Verteiler oder zuvor gebaute Leitung). */
export function anchorFor(map: MapDef, cells: Cell[], network: Set<string>): Cell | null {
  const first = cells[0];
  if (!first) return null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = { x: first.x + dx, y: first.y + dy };
    if (c.x < 0 || c.y < 0 || c.x >= map.width || c.y >= map.height) continue;
    if (map.tiles[c.y][c.x] === 'distributor' || network.has(cellKey(c))) return c;
  }
  return null;
}

/**
 * Glatter Linienzug durch die Zellmittelpunkte: Ecken werden mit einer quadratischen
 * Kurve abgerundet, gerade Abschnitte bleiben rechtwinklig sauber.
 */
export function smoothPath(cells: Cell[], radius = TILE * 0.32): Pt[] {
  const pts = cells.map(center);
  if (pts.length < 3) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const straight = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
    if (straight) {
      out.push(b);
      continue;
    }
    const inDir = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };
    const outDir = { x: Math.sign(c.x - b.x), y: Math.sign(c.y - b.y) };
    const p0 = { x: b.x - inDir.x * radius, y: b.y - inDir.y * radius };
    const p2 = { x: b.x + outDir.x * radius, y: b.y + outDir.y * radius };
    const steps = 6;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      out.push({ x: u * u * p0.x + 2 * u * t * b.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * b.y + t * t * p2.y });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function pathLength(pts: Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

/** Teilstück eines Linienzugs von 0 bis `length` Pixel. */
export function slicePath(pts: Pt[], length: number): Pt[] {
  if (pts.length < 2) return pts;
  const out: Pt[] = [pts[0]];
  let left = length;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (seg >= left) {
      const t = seg === 0 ? 0 : left / seg;
      out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t });
      return out;
    }
    out.push(pts[i]);
    left -= seg;
  }
  return out;
}

export function pointAt(pts: Pt[], length: number): Pt {
  const part = slicePath(pts, length);
  return part[part.length - 1];
}

/** Zeichnet einen Linienzug mit runden Enden (Phaser verbindet dicke Linien sonst kantig). */
export function strokePath(g: Phaser.GameObjects.Graphics, pts: Pt[], width: number, color: number, alpha = 1): void {
  if (pts.length === 0) return;
  g.fillStyle(color, alpha);
  if (pts.length === 1) {
    g.fillCircle(pts[0].x, pts[0].y, width / 2);
    return;
  }
  g.lineStyle(width, color, alpha);
  g.strokePoints(pts as Phaser.Types.Math.Vector2Like[], false, false);
  if (alpha >= 1) {
    // runde Gelenke an Knicken und Enden
    g.fillCircle(pts[0].x, pts[0].y, width / 2);
    g.fillCircle(pts[pts.length - 1].x, pts[pts.length - 1].y, width / 2);
  }
}

/** Gestrichelter Linienzug, `offset` lässt die Striche wandern. */
export function dashPath(
  g: Phaser.GameObjects.Graphics,
  pts: Pt[],
  width: number,
  color: number,
  alpha: number,
  dash: number,
  gap: number,
  offset: number,
): void {
  const total = pathLength(pts);
  g.lineStyle(width, color, alpha);
  for (let start = (offset % (dash + gap)) - (dash + gap); start < total; start += dash + gap) {
    const from = Math.max(0, start);
    const to = Math.min(total, start + dash);
    if (to <= from) continue;
    const seg = slicePath(pts, to);
    const head = slicePath(pts, from);
    const piece = [head[head.length - 1], ...seg.slice(head.length - 1)];
    if (piece.length >= 2) g.strokePoints(piece as Phaser.Types.Math.Vector2Like[], false, false);
  }
}
