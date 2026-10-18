import Phaser from 'phaser';
import { cellKey, type AnimalId, type BuiltRoute, type Cell, type GameState, type MapDef } from '@fuf/shared';
import { PALETTE as P, hex } from '../art/palette';
import { cellRng } from '../art/rng';
import { abilityTrace, abilityTraces, type AbilityCell, type AbilityTrace } from './abilityCells';
import { DEPTH, TILE, center } from './constants';
import { buildDuration } from './FiberLayer';
import type { Pt } from './fiberPath';

const GOLD = 0xffd54d;

const mid = (a: Cell, b: Cell): Pt => ({ x: (center(a).x + center(b).x) / 2, y: (center(a).y + center(b).y) / 2 });

/** Deckkraft der Vorschau während der Planung; beim Bau wird die Spur „echt“. */
const PREVIEW_ALPHA = 0.85;
/** frisch ausgehobene, helle Erde – hebt sich deutlich von der dunklen Wurzelzone ab */
const DUG = 0xc29a66;
const TRENCH_FLOOR = 0x3f2a16;

/**
 * Spuren und Animationen der Tierfähigkeiten.
 * Bleibend (aus dem Spielstand gezeichnet): Biberbrücke, Maulwurfsgraben, gespaltener Fels.
 * Schon während der Planung verwandeln sich die betroffenen Kacheln (Vorschau), damit klar ist, warum dort gebaut werden kann.
 * Einmalig: Planken fallen ein, Erdbuckel wandert durch den Graben, Felsschläge, Suchwelle der Spürnase.
 */
export class AbilityLayer {
  /** unter der Leitung: Graben, Felsrinne */
  private under: Phaser.GameObjects.Graphics;
  /** Vorschau der eigenen Planung */
  private previewG: Phaser.GameObjects.Graphics;
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  /** Zellen, deren Spur erst erscheint, wenn die Bauanimation sie erreicht */
  private hidden = new Set<string>();
  private state: GameState | null = null;
  private previewTrace: AbilityTrace | null = null;
  private drawnKey = '';

  constructor(
    private scene: Phaser.Scene,
    private map: MapDef,
    private reduceMotion: boolean,
  ) {
    this.under = scene.add.graphics().setDepth(DEPTH.structures);
    this.previewG = scene.add.graphics().setDepth(DEPTH.structures).setAlpha(PREVIEW_ALPHA);
    AbilityLayer.makeFxTextures(scene);
  }

  private static makeFxTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('fx-drop')) {
      const g = scene.make.graphics({}, false);
      g.fillStyle(0xffffff, 1).fillCircle(8, 10, 5).fillTriangle(3.5, 9, 12.5, 9, 8, 1);
      g.generateTexture('fx-drop', 16, 16).destroy();
    }
    if (!scene.textures.exists('fx-shard')) {
      const g = scene.make.graphics({}, false);
      g.fillStyle(0xffffff, 1).fillPoints([{ x: 2, y: 9 }, { x: 7, y: 1 }, { x: 15, y: 5 }, { x: 12, y: 14 }, { x: 5, y: 15 }], true);
      g.generateTexture('fx-shard', 16, 16).destroy();
    }
  }

  /**
   * Vorschau der eigenen Planung: Kacheln, auf denen die Fähigkeit wirken wird (bis zur ersten ungültigen Kachel).
   * `null` blendet die Vorschau aus.
   */
  preview(cells: Cell[] | null, animal: AnimalId | null): void {
    const route: BuiltRoute | null =
      cells?.length && animal ? { actionId: 'plan', playerId: '', cells, cost: 0, abilityUsed: true } : null;
    this.previewTrace = route && animal ? abilityTrace(this.map, route, animal) : null;
    if (this.state) this.draw(this.state);
  }

  draw(state: GameState): void {
    this.state = state;
    const traces = abilityTraces(this.map, state);
    const plan = this.previewTrace;
    const key = [
      traces.map((t) => t.route.actionId).join('|'),
      [...this.hidden].join(';'),
      plan ? `${plan.animal}:${plan.route.cells.map(cellKey).join(';')}` : '',
    ].join('#');
    if (key === this.drawnKey) return;
    this.drawnKey = key;
    this.under.clear();
    this.previewG.clear();
    const wanted = new Map<string, () => Phaser.GameObjects.Image>();
    const add = (trace: AbilityTrace, g: Phaser.GameObjects.Graphics, prefix: string, alpha: number) => {
      const visible = trace.cells.filter((c) => !this.hidden.has(cellKey(c.cell)));
      if (trace.animal === 'beaver')
        for (const c of visible) wanted.set(`${prefix}bridge:${cellKey(c.cell)}`, () => this.bridge(c).setAlpha(alpha));
      if (trace.animal === 'badger') for (const c of visible) this.splitRock(g, c);
      if (trace.animal === 'mole') this.trench(g, trace.route.cells, visible);
    };
    for (const trace of traces) add(trace, this.under, '', 1);
    if (plan) add(plan, this.previewG, 'plan-', PREVIEW_ALPHA);
    for (const [k, sprite] of this.sprites) {
      if (wanted.has(k)) continue;
      sprite.destroy();
      this.sprites.delete(k);
    }
    for (const [k, make] of wanted) if (!this.sprites.has(k)) this.sprites.set(k, make());
  }

  // ------------------------------------------------------------ bleibende Spuren

  private bridge(c: AbilityCell): Phaser.GameObjects.Image {
    const p = center(c.cell);
    return this.scene.add
      .image(p.x, p.y, 'bridge')
      .setDisplaySize(TILE, TILE)
      .setAngle(c.axis === 'v' ? 90 : 0)
      .setDepth(DEPTH.structures);
  }

  /**
   * Maulwurfsgraben: aufgewühlte Erde deckt die Wurzelkachel ganz ab, in der Mitte ein offener Graben,
   * an dessen Wänden die gekappten Wurzeln enden. Die Leitung liegt sichtbar im Graben.
   */
  private trench(g: Phaser.GameObjects.Graphics, route: Cell[], visible: AbilityCell[]): void {
    const shown = new Set(visible.map((c) => c.index));
    const trenchCells = new Set(visible.map((c) => cellKey(c.cell)));
    // Grabenstücke: von jeder Zelle zu ihren Nachbarn in der Route (bis zur Kachelkante, wenn dort kein Graben ist)
    const pieces: [Pt, Pt][] = [];
    for (const { index } of visible) {
      const c = center(route[index]);
      pieces.push([c, c]);
      for (const n of [index - 1, index + 1]) {
        if (!route[n] || (shown.has(n) && n < index)) continue;
        pieces.push([c, shown.has(n) ? center(route[n]) : mid(route[index], route[n])]);
      }
    }
    const band = (width: number, color: number, alpha = 1) => {
      g.fillStyle(color, alpha);
      for (const [a, b] of pieces) {
        g.fillRoundedRect(
          Math.min(a.x, b.x) - width / 2,
          Math.min(a.y, b.y) - width / 2,
          Math.abs(a.x - b.x) + width,
          Math.abs(a.y - b.y) + width,
          width * 0.3,
        );
      }
    };

    for (const { cell } of visible) {
      const x0 = cell.x * TILE;
      const y0 = cell.y * TILE;
      g.fillStyle(DUG, 1).fillRect(x0, y0, TILE, TILE);
      // dunkler Rand nur dort, wo kein weiterer Graben anschließt
      g.fillStyle(hex(P.soilDark), 1);
      if (!trenchCells.has(cellKey({ x: cell.x, y: cell.y - 1 }))) g.fillRect(x0, y0, TILE, 4);
      if (!trenchCells.has(cellKey({ x: cell.x, y: cell.y + 1 }))) g.fillRect(x0, y0 + TILE - 4, TILE, 4);
      if (!trenchCells.has(cellKey({ x: cell.x - 1, y: cell.y }))) g.fillRect(x0, y0, 4, TILE);
      if (!trenchCells.has(cellKey({ x: cell.x + 1, y: cell.y }))) g.fillRect(x0 + TILE - 4, y0, 4, TILE);
      // Erdkrümel
      const rnd = cellRng(`${this.map.id}:trench`, cell.x, cell.y);
      for (let i = 0; i < 10; i++) {
        g.fillStyle(rnd() < 0.5 ? hex(P.soilDark) : hex(P.soil), 0.6);
        g.fillCircle(x0 + 8 + rnd() * (TILE - 16), y0 + 8 + rnd() * (TILE - 16), TILE * (0.012 + rnd() * 0.012));
      }
    }

    // Grabenwand, Schatten und Sohle
    band(TILE * 0.68, hex(P.outline), 0.35);
    band(TILE * 0.62, hex(P.soilDark));
    band(TILE * 0.5, TRENCH_FLOOR);

    for (const { cell, index, axis } of visible) {
      const rnd = cellRng(`${this.map.id}:trench-roots`, cell.x, cell.y);
      const p = center(cell);
      const prev = route[index - 1];
      const next = route[index + 1];
      const straight = !prev || !next || prev.x === next.x || prev.y === next.y;
      // gekappte Wurzeln: laufen von außen auf den Graben zu und enden mit heller Schnittfläche an der Wand
      if (straight) {
        for (const side of [-1, 1]) {
          for (let i = 0; i < 2; i++) {
            const along = (i === 0 ? -0.22 : 0.18) * TILE + (rnd() - 0.5) * TILE * 0.12;
            const tilt = (rnd() - 0.5) * TILE * 0.14;
            const wall = side * TILE * 0.31;
            const outer = side * TILE * 0.47;
            const pt = (a: number, q: number) => (axis === 'h' ? { x: p.x + a, y: p.y + q } : { x: p.x + q, y: p.y + a });
            const from = pt(along + tilt, outer);
            const to = pt(along, wall);
            g.lineStyle(TILE * 0.05, hex(P.root), 1).lineBetween(from.x, from.y, to.x, to.y);
            g.fillStyle(hex(P.rootLight), 1).fillCircle(to.x, to.y, TILE * 0.03);
            g.lineStyle(1.5, hex(P.outline), 0.6).strokeCircle(to.x, to.y, TILE * 0.03);
          }
        }
      }
      // ausgehobene Erde in den Ecken
      for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (rnd() < 0.35) continue;
        const hx = p.x + cx * TILE * (0.36 + rnd() * 0.04);
        const hy = p.y + cy * TILE * (0.38 + rnd() * 0.03);
        const r = TILE * (0.045 + rnd() * 0.02);
        g.fillStyle(hex(P.outline), 0.25).fillEllipse(hx + 2, hy + 3, r * 2.4, r * 1.6);
        g.fillStyle(hex(P.soil), 1).fillEllipse(hx, hy, r * 2.4, r * 1.7);
        g.fillStyle(hex(P.rootLight), 1).fillEllipse(hx - r * 0.2, hy - r * 0.3, r * 1.4, r * 0.8);
      }
    }
  }

  /** Gespaltener Fels: Risse von der Leitung aus und Geröll zu beiden Seiten. */
  private splitRock(g: Phaser.GameObjects.Graphics, c: AbilityCell): void {
    const rnd = cellRng(`${this.map.id}:split`, c.cell.x, c.cell.y);
    const p = center(c.cell);
    // Freigeschlagene Schotterrinne entlang der Leitung, zu den Nachbarkacheln hin offen
    const [w, h] = c.axis === 'h' ? [TILE, TILE * 0.46] : [TILE * 0.46, TILE];
    g.fillStyle(hex(P.stoneDark), 1).fillRect(p.x - w / 2, p.y - h / 2 - 3, w, h + 6);
    g.fillStyle(0xa89d88, 1).fillRect(p.x - w / 2, p.y - h / 2, w, h);
    for (let i = 0; i < 14; i++) {
      const x = p.x + (rnd() - 0.5) * (w - 6);
      const y = p.y + (rnd() - 0.5) * (h - 6);
      g.fillStyle(rnd() < 0.5 ? hex(P.stoneLight) : hex(P.stoneDark), 0.9).fillCircle(x, y, TILE * (0.012 + rnd() * 0.014));
    }
    for (let i = 0; i < 4; i++) {
      // Risse quer zur Leitung, abwechselnd zu beiden Seiten
      const side = i % 2 ? 1 : -1;
      const base = c.axis === 'h' ? Math.PI / 2 : 0;
      const a = base + (side < 0 ? Math.PI : 0) + (rnd() - 0.5) * 1.1;
      // Risse beginnen an der Rinnenkante und laufen in den Fels
      const along = (rnd() - 0.5) * TILE * 0.6;
      const edge = side * TILE * 0.23;
      const pts: Pt[] = [c.axis === 'h' ? { x: p.x + along, y: p.y + edge } : { x: p.x + edge, y: p.y + along }];
      let len = 0;
      while (len < TILE * (0.12 + rnd() * 0.1)) {
        len += TILE * 0.06;
        const j = a + (rnd() - 0.5) * 0.9;
        const last = pts[pts.length - 1];
        pts.push({ x: last.x + Math.cos(j) * TILE * 0.06, y: last.y + Math.sin(j) * TILE * 0.06 });
      }
      g.lineStyle(TILE * 0.04, hex(P.outline), 0.75).strokePoints(pts as Phaser.Types.Math.Vector2Like[]);
      g.lineStyle(TILE * 0.015, hex(P.stoneLight), 0.9).strokePoints(pts.map((q) => ({ x: q.x + 1.5, y: q.y + 1.5 })));
    }
    for (const side of [-1, 1]) {
      const off = side * TILE * 0.33;
      const cx = p.x + (c.axis === 'h' ? (rnd() - 0.5) * TILE * 0.4 : off);
      const cy = p.y + (c.axis === 'h' ? off : (rnd() - 0.5) * TILE * 0.4);
      for (let i = 0; i < 4; i++) {
        const x = cx + (rnd() - 0.5) * TILE * 0.2;
        const y = cy + (rnd() - 0.5) * TILE * 0.08;
        const r = TILE * (0.03 + rnd() * 0.03);
        g.fillStyle(hex(P.outline), 0.3).fillCircle(x + 2, y + 2, r);
        g.fillStyle(hex(P.stone), 1).fillCircle(x, y, r);
        g.lineStyle(2, hex(P.outline), 0.8).strokeCircle(x, y, r);
        g.fillStyle(hex(P.stoneLight), 1).fillCircle(x - r * 0.3, y - r * 0.3, r * 0.4);
      }
    }
  }

  // ------------------------------------------------------------ Animationen beim Bau

  /**
   * Bereitet die Bauanimation der Fähigkeit vor. Liefert einen Rückruf, den die Leitungsanimation pro
   * erreichter Kachel aufruft (`FiberLayer.animate`), oder `null`, wenn nichts zu animieren ist.
   */
  animate(state: GameState, route: BuiltRoute, animal: AnimalId): ((index: number) => void) | null {
    const trace = abilityTrace(this.map, route, animal);
    if (!trace || this.reduceMotion) {
      this.draw(state);
      return null;
    }
    for (const c of trace.cells) this.hidden.add(cellKey(c.cell));
    this.draw(state);
    const actions = new Map<number, (() => void)[]>();
    const on = (index: number, action: () => void) => actions.set(index, [...(actions.get(index) ?? []), action]);
    if (animal === 'beaver') for (const c of trace.cells) on(c.index, () => this.dropPlank(c));
    if (animal === 'badger') for (const c of trace.cells) on(c.index, () => this.smash(c));
    if (animal === 'mole') this.dig(trace, buildDuration(route.cells.length) / route.cells.length, on);
    return (index) => actions.get(index)?.forEach((action) => action());
  }

  private reveal(cell: Cell): void {
    this.hidden.delete(cellKey(cell));
    if (this.state) this.draw(this.state);
  }

  /** Biber: Planke fällt wackelnd ein, Wasser spritzt. */
  private dropPlank(c: AbilityCell): void {
    const p = center(c.cell);
    const base = c.axis === 'v' ? 90 : 0;
    const plank = this.scene.add
      .image(p.x, p.y - TILE * 0.4, 'bridge')
      .setDisplaySize(TILE, TILE)
      .setAngle(base - 10)
      .setAlpha(0.3)
      .setDepth(DEPTH.structures + 0.1);
    this.scene.tweens.add({
      targets: plank,
      y: p.y,
      angle: base,
      alpha: 1,
      duration: 160,
      ease: 'Back.easeOut',
      onComplete: () => {
        plank.destroy();
        this.reveal(c.cell);
        this.burst(p.x, p.y, 'fx-drop', [hex(P.foam), hex(P.water), 0xffffff], 12, 260);
      },
    });
  }

  /** Dachs: Funkenblitz, Gesteinssplitter, kurzes Beben. */
  private smash(c: AbilityCell): void {
    const p = center(c.cell);
    this.reveal(c.cell);
    const flash = this.scene.add.graphics().setDepth(DEPTH.fx).setPosition(p.x, p.y);
    flash.fillStyle(0xffffff, 0.9).fillCircle(0, 0, TILE * 0.22);
    flash.fillStyle(GOLD, 0.6).fillCircle(0, 0, TILE * 0.32);
    this.scene.tweens.add({ targets: flash, scale: 1.6, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
    this.burst(p.x, p.y, 'fx-shard', [hex(P.stone), hex(P.stoneLight), hex(P.stoneDark)], 14, 330);
    this.scene.cameras.main.shake(90, 0.003);
  }

  /**
   * Maulwurf: Erde spritzt am Eingang, ein Buckel wandert von Kachel zu Kachel durch den Graben,
   * am Ausgang spritzt wieder Erde. `step` ist die ungefähre Zeit, die die Leitung pro Kachel braucht.
   */
  private dig(trace: AbilityTrace, step: number, on: (index: number, action: () => void) => void): void {
    const route = trace.route.cells;
    const tunnel = new Set(trace.cells.map((c) => c.index));
    let bump: Phaser.GameObjects.Image | null = null;
    const moveBump = (from: Pt, to: Pt) => {
      bump ??= this.scene.add
        .image(from.x, from.y, 'molehill')
        .setOrigin(0.5, 0.8)
        .setDisplaySize(TILE * 0.36, TILE * 0.26)
        .setDepth(DEPTH.tunnel + 0.02);
      this.scene.tweens.killTweensOf(bump);
      bump.setPosition(from.x, from.y);
      this.scene.tweens.add({ targets: bump, x: to.x, y: to.y, duration: step });
    };
    for (const p of trace.portals) {
      const edge = mid(p.cell, p.toward);
      const entering = tunnel.has(p.index + 1);
      on(p.index, () => {
        this.popHill(edge);
        if (entering) moveBump(edge, center(p.toward));
        else {
          bump?.destroy();
          bump = null;
        }
      });
    }
    for (const c of trace.cells) {
      const next = route[c.index + 1];
      on(c.index, () => {
        this.reveal(c.cell);
        const here = center(c.cell);
        this.burst(here.x, here.y, 'fx-dirt', [0xffffff], 4, 140);
        if (next && tunnel.has(c.index + 1)) moveBump(here, center(next));
        else if (next) moveBump(here, mid(c.cell, next));
        else {
          bump?.destroy();
          bump = null;
        }
      });
    }
  }

  /** Erde spritzt am Grabeneingang bzw. -ausgang. */
  private popHill(p: Pt): void {
    this.burst(p.x, p.y, 'fx-dirt', [0xffffff], 14, 260);
  }

  // ------------------------------------------------------------ Spürnase

  /** Fuchs: goldene Suchwelle ab `origin`; aufgedeckte Leerrohre leuchten auf, wenn die Welle sie erreicht. */
  scout(origin: Pt): void {
    if (this.reduceMotion) return;
    const conduits: Cell[] = [];
    this.map.tiles.forEach((row, y) => row.forEach((t, x) => t === 'hiddenConduit' && conduits.push({ x, y })));
    const W = this.map.width * TILE;
    const H = this.map.height * TILE;
    const maxR = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - origin.x, y - origin.y)));
    const duration = 1300;
    const ring = this.scene.add.graphics().setDepth(DEPTH.fx);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 1;
        ring.clear();
        ring.lineStyle(TILE * 0.12 * (1 - t) + 2, GOLD, 0.8 * (1 - t) + 0.1).strokeCircle(origin.x, origin.y, maxR * t);
        ring.lineStyle(3, 0xfffaf0, 0.7 * (1 - t)).strokeCircle(origin.x, origin.y, maxR * t * 0.92);
      },
      onComplete: () => ring.destroy(),
    });
    for (const cell of conduits) {
      const p = center(cell);
      // Zeitpunkt, zu dem die Welle (Sine.easeOut) die Kachel erreicht
      const f = Math.min(1, Math.hypot(p.x - origin.x, p.y - origin.y) / maxR);
      const delay = (duration * Math.asin(f) * 2) / Math.PI;
      const glow = this.scene.add.graphics().setDepth(DEPTH.structures).setAlpha(0);
      glow.fillStyle(GOLD, 0.55).fillRoundedRect(p.x - TILE * 0.46, p.y - TILE * 0.46, TILE * 0.92, TILE * 0.92, TILE * 0.18);
      glow.lineStyle(4, 0xfffaf0, 0.9).strokeRoundedRect(p.x - TILE * 0.4, p.y - TILE * 0.4, TILE * 0.8, TILE * 0.8, TILE * 0.14);
      this.scene.tweens.add({
        targets: glow,
        alpha: 1,
        delay,
        duration: 220,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
        onComplete: () => glow.destroy(),
      });
    }
  }

  private burst(x: number, y: number, texture: string, tints: number[], count: number, speed: number): void {
    const emitter = this.scene.add.particles(x, y, texture, {
      speed: { min: speed * 0.4, max: speed },
      angle: { min: 200, max: 340 },
      gravityY: 700,
      lifespan: { min: 450, max: 800 },
      scale: { start: 1, end: 0.2 },
      rotate: { min: 0, max: 360 },
      tint: tints,
      emitting: false,
    });
    emitter.setDepth(DEPTH.fx);
    emitter.explode(count);
    this.scene.time.delayedCall(1100, () => emitter.destroy());
  }
}
