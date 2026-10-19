import Phaser from 'phaser';
import { ANIMAL_IDS, findPlayer, isAdjacent, type Cell, type GameEvent, type GameState } from '@fuf/shared';
import type { GameController } from '../controller/GameController';
import { ANIMAL_POSES, ANIMAL_VIEWS, animalDataUrl } from '../ui/animalArt';
import { AbilityLayer } from './layers/AbilityLayer';
import { MARGIN, TILE } from './layers/constants';
import { textureKey } from './layers/facing';
import { FINALE_FLASH, FiberLayer, buildDuration } from './layers/FiberLayer';
import { FigureLayer } from './layers/FigureLayer';
import { PlanLayer } from './layers/PlanLayer';
import { TerrainLayer } from './layers/TerrainLayer';
import type { Planner } from './planner';

export { MARGIN, TILE };

/** Pause nach der Bauanimation, bevor am Rundenende die Ergebniskarte erscheint. */
const FINALE_HOLD = 600;

/**
 * Wartezeit bis zur Ergebniskarte, wenn eine Route die Runde beendet: Die Verlegung soll erst
 * vollständig zu sehen sein (Bauanimation, Aufleuchten des Netzes, kurze Pause).
 */
export function finaleDelay(routeLength: number, reduceMotion: boolean): number {
  return reduceMotion ? 1200 : buildDuration(routeLength) + FINALE_FLASH + FINALE_HOLD;
}

export interface BoardOptions {
  onHint(message: string): void;
  reduceMotion: boolean;
}

/**
 * Spielfeld. Koordiniert Eingabe und die Zeichenebenen (Gelände, Fähigkeits-Spuren, Leitungen, Planung, Figuren).
 * Weltkoordinate (0,0) ist die linke obere Ecke des Spielrasters; der Randbereich liegt bei negativen Koordinaten.
 */
export class BoardScene extends Phaser.Scene {
  private terrain!: TerrainLayer;
  private fibers!: FiberLayer;
  private abilities!: AbilityLayer;
  private plan!: PlanLayer;
  private figures!: FigureLayer;
  private peerPlans = new Map<string, Cell[]>();
  private cleanup: (() => void)[] = [];
  private dragging = false;

  constructor(
    private controller: GameController,
    private planner: Planner,
    private options: BoardOptions,
  ) {
    super('board');
  }

  preload(): void {
    for (const id of ANIMAL_IDS)
      for (const view of ANIMAL_VIEWS)
        for (const pose of ANIMAL_POSES)
          this.load.svg(textureKey(id, view, pose), animalDataUrl(id, view, pose), { width: 256, height: 256 });
    TerrainLayer.preload(this, this.controller.map);
  }

  create(): void {
    const { map } = this.controller;
    const state = this.controller.getState();
    const { reduceMotion } = this.options;
    this.cameras.main.setScroll(-MARGIN, -MARGIN);

    this.terrain = new TerrainLayer(this, map);
    this.terrain.create(state.scoutRevealed);
    this.terrain.setConnected(state.connected);
    this.fibers = new FiberLayer(this, map, reduceMotion);
    this.abilities = new AbilityLayer(this, map, reduceMotion);
    this.plan = new PlanLayer(this, map, this.planner, reduceMotion);
    this.figures = new FigureLayer(this, this.planner, map, this.controller.localPlayerId, reduceMotion);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', () => (this.dragging = false));
    this.input.on('gameover', () => this.plan.setPointerInside(true));
    this.input.on('gameout', () => {
      this.dragging = false;
      this.plan.setPointerInside(false);
      this.plan.hover(null, this.controller.getState());
    });

    this.cleanup.push(
      this.controller.subscribe((s, events) => this.onState(s, events)),
      this.planner.onChange(() => this.refresh()),
      this.controller.onPeerPlan((playerId, cells) => {
        if (playerId === this.controller.localPlayerId) return;
        this.peerPlans.set(playerId, cells);
        this.refresh();
      }),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup.forEach((fn) => fn()));
    this.fibers.draw(state);
    this.abilities.draw(state);
    this.refresh();
  }

  update(time: number): void {
    this.fibers.update(time);
    this.plan.update(time);
  }

  private refresh(): void {
    const state = this.controller.getState();
    // Schon beim Planen verwandeln sich Wurzeln in einen Graben, Wasser bekommt eine Brücke, Fels wird gespalten
    const { cells } = this.planner;
    const valid = state.status === 'playing' ? cells.slice(0, this.planner.analysis().error?.cellIndex ?? cells.length) : [];
    this.abilities.preview(valid, this.planner.activeAbility);
    this.plan.refresh(state, this.peerPlans);
    this.figures.refresh(state, this.peerPlans);
  }

  private cellAt(pointer: Phaser.Input.Pointer): Cell | null {
    const x = Math.floor(pointer.worldX / TILE);
    const y = Math.floor(pointer.worldY / TILE);
    const { map } = this.controller;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
    return { x, y };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const cell = this.cellAt(pointer);
    if (!cell || this.controller.getState().status !== 'playing') return;
    if (pointer.rightButtonDown()) {
      this.planner.undo();
      return;
    }
    const message = this.planner.click(cell);
    if (message) this.options.onHint(message);
    this.dragging = true;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const cell = this.cellAt(pointer);
    this.plan.setPointerInside(!!cell);
    this.plan.hover(cell, this.controller.getState());
    if (!cell || !this.dragging || !pointer.isDown) return;
    const last = this.planner.cells[this.planner.cells.length - 1];
    if (!last || isAdjacent(last, cell)) this.planner.drag(cell);
  }

  private onState(state: GameState, events: GameEvent[]): void {
    this.terrain.setRevealed(state.scoutRevealed);
    let animating = false;
    for (const event of events) {
      if (event.type === 'abilityUsed' && event.animal === 'fox') {
        const origin = this.figures.position(event.playerId);
        if (origin) this.abilities.scout(origin);
        this.figures.ability(event.playerId, 'fox');
        this.plan.revealHint();
      }
      if (event.type === 'routeBuilt') {
        this.peerPlans.delete(event.playerId);
        const route = state.routes.at(-1);
        const animal = findPlayer(state, event.playerId)?.animal;
        // Bau-Fähigkeit: eigene Animation und bleibende Spur (Brücke, Tunnel, gespaltener Fels)
        let onCell: ((index: number) => void) | null = null;
        if (route?.abilityUsed && animal) {
          onCell = this.abilities.animate(state, route, animal);
          this.figures.ability(event.playerId, animal);
        } else {
          this.figures.dig(event.playerId);
        }
        animating = true;
        // Anschluss erst zeigen, wenn die Leitung am Haus angekommen ist
        this.fibers.animate(
          state,
          event.cells,
          () => {
            this.terrain.setConnected(state.connected);
            if (state.status === 'won') this.fibers.finale();
          },
          onCell ?? undefined,
        );
      }
      if (event.type === 'buildingConnected') {
        const pos = this.terrain.socketPosition(event.buildingId);
        const delay = this.options.reduceMotion ? 0 : buildDuration(state.routes.at(-1)?.cells.length ?? 0);
        this.time.delayedCall(delay, () => {
          if (pos) this.figures.houseBurst(pos.x, pos.y);
          this.figures.celebrate(event.playerId);
        });
      }
    }
    if (!animating) {
      this.terrain.setConnected(state.connected);
      this.fibers.draw(state);
    }
    this.abilities.draw(state);
    this.refresh();
  }
}

export function createBoard(
  parent: HTMLElement,
  controller: GameController,
  planner: Planner,
  options: BoardOptions,
): Phaser.Game {
  const { map } = controller;
  parent.dataset.margin = String(MARGIN);
  parent.dataset.tile = String(TILE);
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: map.width * TILE + MARGIN * 2,
    height: map.height * TILE + MARGIN * 2,
    backgroundColor: '#8fc75a',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    render: { antialias: true, roundPixels: false },
    scene: new BoardScene(controller, planner, options),
    banner: false,
    audio: { noAudio: true },
  });
}
