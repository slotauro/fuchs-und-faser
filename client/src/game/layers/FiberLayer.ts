import Phaser from 'phaser';
import { cellKey, type Cell, type GameState, type MapDef } from '@fuf/shared';
import { DEPTH, TILE, center } from './constants';
import { anchorFor, pathLength, pointAt, slicePath, smoothPath, strokePath, type Pt } from './fiberPath';

const FIBER = 0xff8a1f;
const FIBER_DEEP = 0x9c3f0b;
const FIBER_GLOW = 0xffb347;
const FIBER_SHINE = 0xffe2bf;

interface DrawnRoute {
  cells: Cell[];
  pts: Pt[];
  length: number;
}

/** Gebaute Glasfaserleitungen: leuchtende orange Leitung, Kabelschächte, Bauanimation, Lichtimpuls. */
export class FiberLayer {
  private g: Phaser.GameObjects.Graphics;
  private pulseG: Phaser.GameObjects.Graphics;
  private shafts: Phaser.GameObjects.Image[] = [];
  private routes: DrawnRoute[] = [];
  private animating: { cells: Cell[]; progress: number } | null = null;
  private shaftKey = '';

  constructor(
    private scene: Phaser.Scene,
    private map: MapDef,
    private reduceMotion: boolean,
  ) {
    this.g = scene.add.graphics().setDepth(DEPTH.fiber);
    this.pulseG = scene.add.graphics().setDepth(DEPTH.fiber + 0.2).setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Spitze der gerade verlegten Leitung (für Funken und grabende Figur). */
  tip: Pt | null = null;

  draw(state: GameState): void {
    const g = this.g.clear();
    const network = new Set<string>();
    this.routes = [];
    for (const route of state.routes) {
      const anchor = anchorFor(this.map, route.cells, network);
      const cells = anchor ? [anchor, ...route.cells] : route.cells;
      const pts = smoothPath(cells);
      const length = pathLength(pts);
      this.routes.push({ cells: route.cells, pts, length });
      route.cells.forEach((c) => network.add(cellKey(c)));
    }

    // Lagen: weicher Schein → Kontur → Leitung → Glanz
    const visible = this.routes.map((r) => {
      if (this.animating && r.cells === this.animating.cells) return slicePath(r.pts, r.length * this.animating.progress);
      return r.pts;
    });
    for (const pts of visible) strokePath(g, pts, TILE * 0.5, FIBER_GLOW, 0.14);
    for (const pts of visible) strokePath(g, pts, TILE * 0.34, FIBER_GLOW, 0.18);
    for (const pts of visible) strokePath(g, pts, TILE * 0.2, FIBER_DEEP);
    for (const pts of visible) strokePath(g, pts, TILE * 0.14, FIBER);
    for (const pts of visible) {
      const shine = pts.map((p) => ({ x: p.x - TILE * 0.02, y: p.y - TILE * 0.025 }));
      strokePath(g, shine, TILE * 0.04, FIBER_SHINE, 0.9);
    }
    // Verbindungspunkte: Kupplungen an den Zellübergängen
    this.routes.forEach((r, i) => {
      const drawnLength = pathLength(visible[i]);
      r.cells.forEach((c, k) => {
        if (k === 0) return;
        const prev = r.cells[k - 1];
        const p = { x: (center(c).x + center(prev).x) / 2, y: (center(c).y + center(prev).y) / 2 };
        if (drawnLength < r.length && k / r.cells.length > drawnLength / r.length) return;
        g.fillStyle(FIBER_DEEP, 1).fillCircle(p.x, p.y, TILE * 0.075);
        g.fillStyle(FIBER_SHINE, 1).fillCircle(p.x, p.y, TILE * 0.035);
      });
    });
    this.tip = this.animating ? visible[this.routes.findIndex((r) => r.cells === this.animating!.cells)]?.at(-1) ?? null : null;
    if (this.tip) {
      g.fillStyle(0xffffff, 0.9).fillCircle(this.tip.x, this.tip.y, TILE * 0.09);
      g.fillStyle(FIBER_GLOW, 0.5).fillCircle(this.tip.x, this.tip.y, TILE * 0.17);
    }
    this.placeShafts();
  }

  /** Kabelschächte an jedem Routenstart (Abzweig) und an Richtungswechseln, mit Mindestabstand. */
  private placeShafts(): void {
    const spots: Pt[] = [];
    for (const r of this.routes) {
      if (this.animating && r.cells === this.animating.cells) continue;
      let sinceLast = 99;
      r.cells.forEach((c, i) => {
        sinceLast++;
        const prev = r.cells[i - 1];
        const next = r.cells[i + 1];
        const isStart = i === 0;
        const turn = prev && next && prev.x !== next.x && prev.y !== next.y;
        const tile = this.map.tiles[c.y][c.x];
        if (tile === 'connection') return;
        if ((isStart || turn) && sinceLast >= 3) {
          spots.push(center(c));
          sinceLast = 0;
        }
      });
    }
    const key = spots.map((p) => `${p.x},${p.y}`).join('|');
    if (key === this.shaftKey) return;
    this.shaftKey = key;
    this.shafts.forEach((s) => s.destroy());
    this.shafts = spots.map((p) =>
      this.scene.add.image(p.x, p.y, 'shaft').setDisplaySize(TILE * 0.36, TILE * 0.36).setDepth(DEPTH.fiber + 0.1),
    );
  }

  /** Neue Route Abschnitt für Abschnitt einblenden. */
  animate(state: GameState, cells: Cell[], onDone: () => void): void {
    const route = state.routes.find(
      (r) => r.cells.length === cells.length && r.cells.every((c, i) => c.x === cells[i].x && c.y === cells[i].y),
    );
    if (!route || this.reduceMotion) {
      this.draw(state);
      onDone();
      return;
    }
    this.animating = { cells: route.cells, progress: 0 };
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: Math.min(1400, 110 * cells.length),
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        if (this.animating) this.animating.progress = tween.getValue() ?? 1;
        this.draw(state);
      },
      onComplete: () => {
        this.animating = null;
        this.draw(state);
        onDone();
      },
    });
  }

  /** Lichtimpulse, die langsam durch alle gebauten Leitungen wandern. */
  update(time: number): void {
    const g = this.pulseG.clear();
    if (this.reduceMotion) return;
    for (const r of this.routes) {
      if (this.animating && r.cells === this.animating.cells) continue;
      const speed = TILE * 2.2; // Pixel pro Sekunde
      const period = r.length + TILE * 3;
      const pos = ((time / 1000) * speed) % period;
      if (pos > r.length) continue;
      const p = pointAt(r.pts, pos);
      g.fillStyle(FIBER_GLOW, 0.35).fillCircle(p.x, p.y, TILE * 0.14);
      g.fillStyle(0xffffff, 0.75).fillCircle(p.x, p.y, TILE * 0.05);
    }
  }
}
