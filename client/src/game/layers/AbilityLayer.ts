import Phaser from 'phaser';
import { cellKey, type AnimalId, type BuiltRoute, type Cell, type GameState, type MapDef } from '@fuf/shared';
import { PALETTE as P, hex } from '../art/palette';
import { cellRng } from '../art/rng';
import { abilityTrace, abilityTraces, type AbilityCell, type AbilityTrace } from './abilityCells';
import { DEPTH, TILE, center } from './constants';
import { buildDuration } from './FiberLayer';
import { dashPath, type Pt } from './fiberPath';

const FIBER = 0xff8a1f;
const GOLD = 0xffd54d;

const mid = (a: Cell, b: Cell): Pt => ({ x: (center(a).x + center(b).x) / 2, y: (center(a).y + center(b).y) / 2 });

/**
 * Spuren und Animationen der Tierfähigkeiten.
 * Bleibend (aus dem Spielstand gezeichnet): Biberbrücke, Maulwurfstunnel mit Hügeln, gespaltener Fels.
 * Einmalig: Planken fallen ein, Erdbuckel wandert durch den Tunnel, Felsschläge, Suchwelle der Spürnase.
 */
export class AbilityLayer {
  /** unter der Leitung: Felsrisse und Geröll */
  private under: Phaser.GameObjects.Graphics;
  /** über der Leitung: Erdabdeckung des Tunnels mit unterirdischer Leitung */
  private over: Phaser.GameObjects.Graphics;
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  /** Zellen, deren Spur erst erscheint, wenn die Bauanimation sie erreicht */
  private hidden = new Set<string>();
  private state: GameState | null = null;
  private drawnKey = '';

  constructor(
    private scene: Phaser.Scene,
    private map: MapDef,
    private reduceMotion: boolean,
  ) {
    this.under = scene.add.graphics().setDepth(DEPTH.structures);
    this.over = scene.add.graphics().setDepth(DEPTH.tunnel);
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

  draw(state: GameState): void {
    this.state = state;
    const traces = abilityTraces(this.map, state);
    const key = `${traces.map((t) => t.route.actionId).join('|')}#${[...this.hidden].join(';')}`;
    if (key === this.drawnKey) return;
    this.drawnKey = key;
    this.under.clear();
    this.over.clear();
    const wanted = new Map<string, () => Phaser.GameObjects.Image>();
    for (const trace of traces) {
      const visible = trace.cells.filter((c) => !this.hidden.has(cellKey(c.cell)));
      if (trace.animal === 'beaver') for (const c of visible) wanted.set(`bridge:${cellKey(c.cell)}`, () => this.bridge(c));
      if (trace.animal === 'badger') for (const c of visible) this.splitRock(c);
      if (trace.animal === 'mole') {
        this.tunnel(trace, visible);
        for (const p of trace.portals) {
          if (this.hidden.has(cellKey(p.cell))) continue;
          wanted.set(`hill:${cellKey(p.cell)}`, () => this.molehill(mid(p.cell, p.toward)));
        }
      }
    }
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

  private molehill(p: Pt): Phaser.GameObjects.Image {
    return this.scene.add
      .image(p.x, p.y + TILE * 0.06, 'molehill')
      .setOrigin(0.5, 0.8)
      .setDisplaySize(TILE * 0.56, TILE * 0.41)
      .setDepth(DEPTH.tunnel + 0.01);
  }

  /** Erdstreifen über der Leitung, darauf die unterirdische Leitung gestrichelt und durchscheinend. */
  private tunnel(trace: AbilityTrace, visible: AbilityCell[]): void {
    const g = this.over;
    const route = trace.route.cells;
    const shown = new Set(visible.map((c) => c.index));
    // Teilstücke: von jeder sichtbaren Tunnelzelle zu ihren Nachbarn in der Route (bis zur Kachelkante)
    const pieces: [Pt, Pt][] = [];
    for (const { index } of visible) {
      const c = center(route[index]);
      for (const n of [index - 1, index + 1]) {
        if (!route[n]) continue;
        if (shown.has(n) && n < index) continue; // Verbindung nur einmal zeichnen
        pieces.push([c, shown.has(n) ? center(route[n]) : mid(route[index], route[n])]);
      }
      pieces.push([c, c]);
    }
    for (const [color, width] of [[hex(P.soilDark), TILE * 0.62], [hex(P.soil), TILE * 0.52]] as const) {
      g.fillStyle(color, 1);
      for (const [a, b] of pieces) {
        const x = Math.min(a.x, b.x) - width / 2;
        const y = Math.min(a.y, b.y) - width / 2;
        g.fillRoundedRect(x, y, Math.abs(a.x - b.x) + width, Math.abs(a.y - b.y) + width, width * 0.4);
      }
    }
    // Wurzeln und Krümel auf der Erde
    for (const { cell } of visible) {
      const rnd = cellRng(`${this.map.id}:tunnel`, cell.x, cell.y);
      const p = center(cell);
      g.lineStyle(TILE * 0.035, hex(P.root), 0.9);
      for (let i = 0; i < 2; i++) {
        const a = rnd() * Math.PI * 2;
        const r = TILE * 0.2;
        const sx = p.x + Math.cos(a) * r;
        const sy = p.y + Math.sin(a) * r;
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(sx - Math.cos(a) * r * 0.7 + (rnd() - 0.5) * TILE * 0.1, sy - Math.sin(a) * r * 0.7 + (rnd() - 0.5) * TILE * 0.1);
        g.strokePath();
      }
      g.fillStyle(hex(P.soilDark), 0.8);
      for (let i = 0; i < 4; i++) g.fillCircle(p.x + (rnd() - 0.5) * TILE * 0.4, p.y + (rnd() - 0.5) * TILE * 0.4, TILE * 0.018);
    }
    for (const [a, b] of pieces) if (a !== b) dashPath(g, [a, b], TILE * 0.07, FIBER, 0.7, TILE * 0.1, TILE * 0.08, 0);
  }

  /** Gespaltener Fels: Risse von der Leitung aus und Geröll zu beiden Seiten. */
  private splitRock(c: AbilityCell): void {
    const g = this.under;
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
    for (const p of trace.portals) this.hidden.add(cellKey(p.cell));
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
   * Maulwurf: Erde spritzt am Eingang, ein Buckel wandert von Kachel zu Kachel durch den Tunnel,
   * am Ausgang ploppt der Hügel auf. `step` ist die ungefähre Zeit, die die Leitung pro Kachel braucht.
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
        this.popHill(p.cell, edge);
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

  private popHill(cell: Cell, p: Pt): void {
    this.reveal(cell);
    this.burst(p.x, p.y, 'fx-dirt', [0xffffff], 14, 260);
    const hill = this.sprites.get(`hill:${cellKey(cell)}`);
    if (!hill) return;
    const sx = hill.scaleX;
    const sy = hill.scaleY;
    hill.setScale(sx * 0.2, sy * 0.2);
    this.scene.tweens.add({ targets: hill, scaleX: sx, scaleY: sy, duration: 260, ease: 'Back.easeOut' });
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
