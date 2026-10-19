import Phaser from 'phaser';
import {
  TILE_INFO,
  cellKey,
  effectiveTile,
  formatPoints,
  tileCost,
  type Cell,
  type GameState,
  type MapDef,
} from '@fuf/shared';
import { ANIMAL_COLORS } from '../../ui/animalArt';
import type { Planner } from '../planner';
import { DEPTH, TILE, center } from './constants';
import { anchorFor, dashPath, smoothPath, strokePath, type Pt } from './fiberPath';

const PLAN = 0xff8a1f;
const BAD = 0xd64534;
const CREAM = 0xfffaf0;
const INK = 0x3b2f25;

interface PlanSnapshot {
  okPts: Pt[];
  badPts: Pt[];
  cells: Cell[];
  badIndex: number;
  candidates: Cell[];
}

/** Routenplanung: dezentes Raster, Vorschau, mögliche Felder, Fehlermarkierung, Fuchs-Hinweis, Hover. */
export class PlanLayer {
  private gridG: Phaser.GameObjects.Graphics;
  private g: Phaser.GameObjects.Graphics;
  /** Warnsymbol liegt über den Figuren, damit es nie verdeckt wird. */
  private warnG: Phaser.GameObjects.Graphics;
  private hoverG: Phaser.GameObjects.Graphics;
  private tooltip: Phaser.GameObjects.Container;
  private tooltipText: Phaser.GameObjects.Text;
  private tooltipBg: Phaser.GameObjects.Graphics;
  private snapshot: PlanSnapshot | null = null;
  private peers: { pts: Pt[]; color: number }[] = [];
  private hint: Cell[] | null = null;
  /** Startzeit der Pfotenspur-Animation; `null` = noch zu setzen, `-Infinity` = sofort ganz sichtbar */
  private hintShownAt: number | null = -Infinity;
  private gridAlpha = 0;
  private pointerInside = false;

  constructor(
    scene: Phaser.Scene,
    private map: MapDef,
    private planner: Planner,
    private reduceMotion: boolean,
  ) {
    this.gridG = scene.add.graphics().setDepth(DEPTH.grid).setAlpha(0);
    this.drawGrid();
    this.g = scene.add.graphics().setDepth(DEPTH.plan);
    this.warnG = scene.add.graphics().setDepth(DEPTH.labels);
    this.hoverG = scene.add.graphics().setDepth(DEPTH.hover);
    this.tooltipBg = scene.add.graphics();
    this.tooltipText = scene.add.text(0, 0, '', {
      fontFamily: '"Nunito Variable", Nunito, system-ui, sans-serif',
      fontSize: '19px',
      fontStyle: '800',
      color: '#3b2f25',
    });
    this.tooltipText.setOrigin(0.5);
    this.tooltip = scene.add.container(0, 0, [this.tooltipBg, this.tooltipText]).setDepth(DEPTH.hover).setVisible(false);
  }

  private drawGrid(): void {
    const g = this.gridG;
    const W = this.map.width * TILE;
    const H = this.map.height * TILE;
    g.lineStyle(2, 0xfffaf0, 0.9);
    for (let x = 0; x <= this.map.width; x++) g.lineBetween(x * TILE, 0, x * TILE, H);
    for (let y = 0; y <= this.map.height; y++) g.lineBetween(0, y * TILE, W, y * TILE);
  }

  /** Neu berechnen, wenn sich Planung oder Spielzustand ändern (gezeichnet wird pro Frame in `update`). */
  refresh(state: GameState, peerPlans: Map<string, Cell[]>): void {
    this.hint = state.hint;
    this.peers = [];
    for (const [playerId, cells] of peerPlans) {
      const player = state.players.find((p) => p.id === playerId);
      if (!player || cells.length === 0) continue;
      const anchor = anchorFor(this.map, cells, new Set(state.builtCells));
      this.peers.push({ pts: smoothPath(anchor ? [anchor, ...cells] : cells), color: ANIMAL_COLORS[player.animal] });
    }
    if (state.status !== 'playing') {
      this.snapshot = null;
      return;
    }
    const cells = this.planner.cells;
    let badIndex = Infinity;
    if (cells.length) {
      const error = this.planner.rejected ?? this.planner.analysis().error;
      badIndex = error?.cellIndex ?? Infinity;
    }
    const anchor = anchorFor(this.map, cells, new Set(state.builtCells));
    const full = anchor ? [anchor, ...cells] : cells;
    const split = Math.min(cells.length, badIndex) + (anchor ? 1 : 0);
    this.snapshot = {
      cells,
      badIndex,
      // ohne Planung nur die Felder rund um die eigene Figur hervorheben, sonst wird es unübersichtlich
      candidates: cells.length
        ? this.planner.candidates()
        : this.planner.candidates().filter((c) => Math.abs(c.x - this.planner.figure.x) + Math.abs(c.y - this.planner.figure.y) === 1),
      okPts: smoothPath(full.slice(0, split)),
      // ungültiger Teil beginnt an der letzten gültigen Kachel, damit die Linie durchgeht
      badPts: split < full.length ? smoothPath(full.slice(Math.max(0, split - 1))) : [],
    };
  }

  /** Pfotenspur nach dem Einsatz der Spürnase Abdruck für Abdruck einblenden. */
  revealHint(): void {
    if (!this.reduceMotion) this.hintShownAt = null;
  }

  setPointerInside(inside: boolean): void {
    this.pointerInside = inside;
  }

  update(time: number): void {
    const g = this.g.clear();
    this.warnG.clear();
    const t = this.reduceMotion ? 0 : time;
    const planning = !!this.snapshot && this.snapshot.cells.length > 0;

    // Raster nur bei Bedarf dezent einblenden
    const target = planning || this.pointerInside ? 0.22 : 0;
    this.gridAlpha += (target - this.gridAlpha) * 0.15;
    this.gridG.setAlpha(this.gridAlpha);

    if (this.hint) {
      this.hintShownAt ??= time;
      // nach einer kurzen Pause (Suchwelle) ein Abdruck alle 90 ms
      const shown = Math.floor((time - this.hintShownAt - 500) / 90) + 1;
      if (shown > 0) this.drawPaws(g, this.hint.slice(0, shown));
    }

    for (const peer of this.peers) {
      strokePath(g, peer.pts, TILE * 0.18, peer.color, 0.25);
      dashPath(g, peer.pts, TILE * 0.07, peer.color, 0.8, TILE * 0.16, TILE * 0.12, t * 0.04);
    }

    const snap = this.snapshot;
    if (!snap) return;

    // mögliche nächste Felder: weiche, pulsierende Eckmarken
    const pulse = 0.55 + 0.35 * Math.sin(t / 260);
    for (const c of snap.candidates) this.corners(g, c, CREAM, pulse);

    if (!snap.cells.length) return;
    snap.cells.forEach((c, i) => {
      const bad = i >= snap.badIndex;
      g.fillStyle(bad ? BAD : PLAN, bad ? 0.28 : 0.13).fillRoundedRect(c.x * TILE + 4, c.y * TILE + 4, TILE - 8, TILE - 8, 14);
    });

    // gültiger Teil orange, ungültiger Teil rot – beide als transparente, gestrichelte Vorschau
    strokePath(g, snap.okPts, TILE * 0.24, PLAN, 0.22);
    dashPath(g, snap.okPts, TILE * 0.1, PLAN, 0.95, TILE * 0.2, TILE * 0.12, t * 0.05);
    if (snap.badPts.length > 1) {
      strokePath(g, snap.badPts, TILE * 0.24, BAD, 0.22);
      dashPath(g, snap.badPts, TILE * 0.1, BAD, 0.95, TILE * 0.2, TILE * 0.12, t * 0.05);
    }
    snap.cells.forEach((c, i) => {
      const p = center(c);
      g.fillStyle(i >= snap.badIndex ? BAD : PLAN, 1).fillCircle(p.x, p.y, TILE * 0.065);
      g.fillStyle(CREAM, 1).fillCircle(p.x, p.y, TILE * 0.03);
    });

    const bad = snap.cells[snap.badIndex];
    if (bad) this.warnBadge(this.warnG, bad, 1 + (this.reduceMotion ? 0 : 0.06 * Math.sin(t / 180)));
  }

  private corners(g: Phaser.GameObjects.Graphics, c: Cell, color: number, alpha: number): void {
    const x = c.x * TILE;
    const y = c.y * TILE;
    const m = TILE * 0.12;
    const len = TILE * 0.2;
    g.lineStyle(TILE * 0.05, INK, alpha * 0.25);
    const draw = (ox: number) => {
      g.beginPath();
      g.moveTo(x + m + ox, y + m + len + ox); g.lineTo(x + m + ox, y + m + ox); g.lineTo(x + m + len + ox, y + m + ox);
      g.moveTo(x + TILE - m - len + ox, y + m + ox); g.lineTo(x + TILE - m + ox, y + m + ox); g.lineTo(x + TILE - m + ox, y + m + len + ox);
      g.moveTo(x + m + ox, y + TILE - m - len + ox); g.lineTo(x + m + ox, y + TILE - m + ox); g.lineTo(x + m + len + ox, y + TILE - m + ox);
      g.moveTo(x + TILE - m - len + ox, y + TILE - m + ox); g.lineTo(x + TILE - m + ox, y + TILE - m + ox); g.lineTo(x + TILE - m + ox, y + TILE - m - len + ox);
      g.strokePath();
    };
    draw(2);
    g.lineStyle(TILE * 0.045, color, alpha);
    draw(0);
  }

  private warnBadge(g: Phaser.GameObjects.Graphics, c: Cell, scale: number): void {
    // oben rechts auf der Kachel, damit Figur und Badge zusammen sichtbar bleiben
    const x = c.x * TILE + TILE * 0.78;
    const y = c.y * TILE + TILE * 0.2;
    const r = TILE * 0.17 * scale;
    g.fillStyle(INK, 0.3).fillCircle(x + 2, y + 4, r);
    g.fillStyle(CREAM, 1).fillCircle(x, y, r + 4);
    g.fillStyle(BAD, 1).fillCircle(x, y, r);
    const k = r * 0.45;
    g.lineStyle(TILE * 0.055, CREAM, 1);
    g.lineBetween(x - k, y - k, x + k, y + k);
    g.lineBetween(x + k, y - k, x - k, y + k);
  }

  /** Spürnase des Fuchses: Pfotenabdrücke entlang der günstigsten Route. */
  private drawPaws(g: Phaser.GameObjects.Graphics, cells: Cell[]): void {
    cells.forEach((c, i) => {
      const next = cells[i + 1] ?? c;
      const prev = cells[i - 1] ?? c;
      const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
      const side = i % 2 ? 1 : -1;
      const p = center(c);
      const px = p.x + Math.cos(angle + Math.PI / 2) * side * TILE * 0.12;
      const py = p.y + Math.sin(angle + Math.PI / 2) * side * TILE * 0.12;
      const rot = (dx: number, dy: number) => ({
        x: px + dx * Math.cos(angle) - dy * Math.sin(angle),
        y: py + dx * Math.sin(angle) + dy * Math.cos(angle),
      });
      const pad = rot(0, 0);
      g.fillStyle(INK, 0.25).fillEllipse(pad.x + 2, pad.y + 3, TILE * 0.16, TILE * 0.13);
      g.fillStyle(0xf6c94a, 0.95).fillEllipse(pad.x, pad.y, TILE * 0.16, TILE * 0.13);
      for (const [dx, dy] of [[TILE * 0.11, -TILE * 0.07], [TILE * 0.13, 0], [TILE * 0.11, TILE * 0.07]]) {
        const toe = rot(dx, dy);
        g.fillStyle(0xf6c94a, 0.95).fillCircle(toe.x, toe.y, TILE * 0.035);
      }
    });
  }

  hover(cell: Cell | null, state: GameState): void {
    this.hoverG.clear();
    if (!cell) {
      this.tooltip.setVisible(false);
      return;
    }
    const raw = this.map.tiles[cell.y][cell.x];
    const tile = effectiveTile(raw, state.scoutRevealed);
    const { cost } = tileCost(raw, state.scoutRevealed, this.planner.activeAbility);
    const built = state.builtCells.includes(cellKey(cell));
    let text = TILE_INFO[tile].label;
    if (built) text += ' · Leitung';
    else if (cost !== null && tile !== 'distributor') text += ` · ${formatPoints(cost)} P`;
    else if (tile !== 'distributor' && tile !== 'building') text += ' · gesperrt';

    this.hoverG.lineStyle(4, CREAM, 0.95).strokeRoundedRect(cell.x * TILE + 3, cell.y * TILE + 3, TILE - 6, TILE - 6, 12);
    this.hoverG.lineStyle(2, INK, 0.35).strokeRoundedRect(cell.x * TILE + 7, cell.y * TILE + 7, TILE - 14, TILE - 14, 9);

    this.tooltipText.setText(text);
    const w = this.tooltipText.width + 24;
    const h = this.tooltipText.height + 10;
    this.tooltipBg.clear();
    this.tooltipBg.fillStyle(INK, 0.25).fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 12);
    this.tooltipBg.fillStyle(CREAM, 0.98).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    this.tooltipBg.lineStyle(2, PLAN, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    const c = center(cell);
    const tx = Math.min(Math.max(c.x, w / 2 + 4), this.map.width * TILE - w / 2 - 4);
    const ty = cell.y === 0 ? (cell.y + 1) * TILE + h / 2 + 6 : cell.y * TILE - h / 2 - 6;
    this.tooltip.setPosition(tx, ty).setVisible(true);
  }
}
