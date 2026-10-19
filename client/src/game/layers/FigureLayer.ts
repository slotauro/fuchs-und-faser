import Phaser from 'phaser';
import { type AnimalId, type Cell, type GameState, type MapDef } from '@fuf/shared';
import { ANIMAL_COLORS, type AnimalPose } from '../../ui/animalArt';
import type { Planner } from '../planner';
import { DEPTH, TILE, center } from './constants';
import { facingFor, textureKey, viewFor, type Facing } from './facing';

interface Figure {
  animal: AnimalId;
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  aura: Phaser.GameObjects.Graphics;
  badge: Phaser.GameObjects.Image;
  cell: Cell;
  offset: number;
  baseScale: number;
  facing: Facing;
  /** wechselt bei jedem Schritt zwischen den beiden Schritt-Posen */
  stepToggle: boolean;
}

/** Ein Schritt einer Tween-Kette; das Ziel gibt die Kette vor. */
type TweenStep = Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>;

const SPRITE = TILE * 1.0;
/** Füße der Figur liegen etwas unterhalb der Zellmitte, damit sie auf dem Feld „steht“. */
const FEET = TILE * 0.3;

/**
 * Tierfiguren auf dem Spielfeld. Eigene Figur am Ende der Planung, Mitspieler am Ende ihrer Vorschau
 * bzw. am Verteiler. Die Figur schaut in Laufrichtung (Front-, Seiten- oder Rückansicht) und behält sie im Stand.
 * Animationen: Idle-Atmen, Schritt-Posen und Hüpfen beim Laufen, Graben beim Bauen, eigene Bewegung je Fähigkeit,
 * Jubeln beim Anschluss.
 */
export class FigureLayer {
  private figures = new Map<string, Figure>();

  constructor(
    private scene: Phaser.Scene,
    private planner: Planner,
    private map: MapDef,
    private localPlayerId: string,
    private reduceMotion: boolean,
  ) {
    FigureLayer.makeFxTextures(scene);
  }

  private static makeFxTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists('fx-dirt')) {
      const g = scene.make.graphics({}, false);
      g.fillStyle(0x7a5230, 1).fillCircle(8, 8, 7);
      g.fillStyle(0xa5774a, 1).fillCircle(6, 6, 3);
      g.generateTexture('fx-dirt', 16, 16).destroy();
    }
    if (!scene.textures.exists('fx-star')) {
      const g = scene.make.graphics({}, false);
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? 6 : 15;
        pts.push({ x: 16 + Math.cos(a) * r, y: 16 + Math.sin(a) * r });
      }
      g.fillStyle(0xffffff, 1).fillPoints(pts, true);
      g.generateTexture('fx-star', 32, 32).destroy();
    }
  }

  refresh(state: GameState, peerPlans: Map<string, Cell[]>): void {
    const me = this.localPlayerId;
    const abilityPlanned = this.planner.cells.length > 0 && this.planner.analysis().abilityApplied;
    const positions = state.players.map((p) => {
      const plan = peerPlans.get(p.id);
      const cell = p.id === me ? this.planner.figure : (plan?.[plan.length - 1] ?? this.planner.start);
      return { player: p, cell };
    });
    for (const [id, figure] of this.figures) {
      if (!state.players.some((p) => p.id === id)) {
        figure.root.destroy();
        this.figures.delete(id);
      }
    }
    for (const { player, cell } of positions) {
      // Mehrere Tiere auf demselben Feld leicht versetzt zeigen
      const sharing = positions.filter((o) => o.cell.x === cell.x && o.cell.y === cell.y);
      const offset =
        sharing.length > 1 ? (sharing.findIndex((o) => o.player.id === player.id) - (sharing.length - 1) / 2) * TILE * 0.32 : 0;
      let figure = this.figures.get(player.id);
      if (!figure) {
        figure = this.create(player.animal, player.id === me, player.name, cell, offset);
        this.figures.set(player.id, figure);
      } else if (figure.cell.x !== cell.x || figure.cell.y !== cell.y || figure.offset !== offset) {
        this.move(figure, cell, offset);
      }
      // Aura und Abzeichen, solange die eigene Planung die Bau-Fähigkeit nutzt
      const armed = player.id === me && abilityPlanned;
      figure.aura.setVisible(armed);
      figure.badge.setVisible(armed);
    }
  }

  /** Bodenpunkt der Figur; auf dem Verteiler steht sie daneben, damit der Schrank sichtbar bleibt. */
  private spot(cell: Cell, offset: number): { x: number; y: number } {
    const p = center(cell);
    const onDistributor = this.map.tiles[cell.y][cell.x] === 'distributor';
    return onDistributor ? { x: p.x + offset + TILE * 0.42, y: p.y + TILE * 0.08 } : { x: p.x + offset, y: p.y };
  }

  private create(animal: AnimalId, isMe: boolean, name: string, cell: Cell, offset: number): Figure {
    const { scene } = this;
    const color = ANIMAL_COLORS[animal];
    const ground = scene.add.graphics();
    // Bodenschatten und Auswahlring (flach, bleibt beim Hüpfen am Boden)
    ground.fillStyle(0x3b2f25, 0.28).fillEllipse(0, FEET, TILE * 0.62, TILE * 0.2);
    if (isMe) {
      ground.lineStyle(5, 0xfffaf0, 0.95).strokeEllipse(0, FEET, TILE * 0.78, TILE * 0.3);
      ground.lineStyle(2.5, 0xff8a1f, 1).strokeEllipse(0, FEET, TILE * 0.86, TILE * 0.36);
    } else {
      ground.lineStyle(4, color, 0.9).strokeEllipse(0, FEET, TILE * 0.78, TILE * 0.3);
    }

    const aura = scene.add.graphics();
    aura.fillStyle(color, 0.22).fillEllipse(0, FEET - TILE * 0.32, TILE * 1.05, TILE * 1.05);
    aura.lineStyle(4, color, 0.85).strokeEllipse(0, FEET - TILE * 0.32, TILE * 1.05, TILE * 1.05);
    aura.setVisible(false);

    const sprite = scene.add.image(0, FEET + TILE * 0.06, textureKey(animal, 'front', 'stand')).setOrigin(0.5, 1).setDisplaySize(SPRITE, SPRITE);
    if (!isMe) sprite.setAlpha(0.92);
    const badge = scene.add.image(TILE * 0.3, FEET - SPRITE * 0.95, `badge-${animal}`).setDisplaySize(TILE * 0.36, TILE * 0.36).setVisible(false);

    const parts: Phaser.GameObjects.GameObject[] = [aura, sprite, badge];
    if (!isMe) {
      const tag = scene.add
        .text(0, FEET + TILE * 0.2, name, {
          fontFamily: '"Nunito Variable", Nunito, system-ui, sans-serif',
          fontSize: '15px',
          fontStyle: '800',
          color: '#fffaf0',
          backgroundColor: Phaser.Display.Color.IntegerToColor(color).rgba,
          padding: { x: 6, y: 1 },
        })
        .setOrigin(0.5, 0);
      parts.push(tag);
    }
    const body = scene.add.container(0, 0, parts);
    const p = this.spot(cell, offset);
    const root = scene.add.container(p.x, p.y, [ground, body]).setDepth(DEPTH.figures + (isMe ? 0.5 : 0));
    const figure: Figure = {
      animal,
      root,
      body,
      sprite,
      aura,
      badge,
      cell,
      offset,
      baseScale: sprite.scaleY,
      facing: 'down',
      stepToggle: false,
    };

    if (!this.reduceMotion) {
      scene.tweens.add({
        targets: sprite,
        scaleY: figure.baseScale * 1.035,
        duration: 900 + Math.random() * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      scene.tweens.add({ targets: aura, alpha: 0.45, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      scene.tweens.add({ targets: badge, y: badge.y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    return figure;
  }

  private move(figure: Figure, cell: Cell, offset: number): void {
    const target = this.spot(cell, offset);
    // Nur ein Zellwechsel dreht die Figur, nicht das Ausweichen auf einem geteilten Feld
    if (cell.x !== figure.cell.x || cell.y !== figure.cell.y) {
      figure.facing = facingFor(cell.x - figure.cell.x, cell.y - figure.cell.y, figure.facing);
    }
    figure.cell = cell;
    figure.offset = offset;
    this.scene.tweens.killTweensOf(figure.root);
    if (this.reduceMotion) {
      this.pose(figure, 'stand');
      figure.root.setPosition(target.x, target.y);
      return;
    }
    figure.stepToggle = !figure.stepToggle;
    this.pose(figure, figure.stepToggle ? 'stepA' : 'stepB');
    this.scene.tweens.add({
      targets: figure.root,
      x: target.x,
      y: target.y,
      duration: 150,
      ease: 'Sine.easeOut',
      onComplete: () => this.pose(figure, 'stand'),
    });
    // kleiner Hüpfer mit Stauchen beim Landen
    this.scene.tweens.killTweensOf(figure.body);
    figure.body.y = 0;
    this.scene.tweens.add({ targets: figure.body, y: -TILE * 0.13, duration: 75, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Zeigt die Ansicht zur aktuellen Blickrichtung in der gewünschten Pose. */
  private pose(figure: Figure, pose: AnimalPose): void {
    const { view, flipX } = viewFor(figure.facing);
    figure.sprite.setTexture(textureKey(figure.animal, view, pose)).setFlipX(flipX);
  }

  /** Graben: Figur wackelt, Erdkrümel fliegen. */
  dig(playerId: string): void {
    const figure = this.figures.get(playerId);
    if (!figure || this.reduceMotion) return;
    this.scene.tweens.add({ targets: figure.body, angle: { from: -9, to: 9 }, duration: 90, yoyo: true, repeat: 4, onComplete: () => figure.body.setAngle(0) });
    this.burst(figure.root.x, figure.root.y + FEET, 'fx-dirt', [0xffffff], 16, 240);
  }

  /** Ungefähre Körpermitte der Figur (Ursprung für Effekte wie die Suchwelle). */
  position(playerId: string): { x: number; y: number } | null {
    const figure = this.figures.get(playerId);
    return figure ? { x: figure.root.x, y: figure.root.y - TILE * 0.1 } : null;
  }

  /** Eigene Bewegung je Tier, wenn es seine Fähigkeit einsetzt. */
  ability(playerId: string, animal: AnimalId): void {
    const figure = this.figures.get(playerId);
    if (!figure || this.reduceMotion) return;
    const { body, root } = figure;
    const reset = () => body.setPosition(0, 0).setAngle(0).setScale(1).setAlpha(1);
    this.scene.tweens.killTweensOf(body);
    reset();
    const chain = (tweens: TweenStep[]) =>
      this.scene.tweens.chain({ targets: body, tweens, onComplete: reset });
    const feet = { x: root.x, y: root.y + FEET };
    if (animal === 'fox') {
      // Schnüffeln: schnelle Nicker, dann ein Hüpfer mit Funken über dem Kopf
      chain([
        { angle: 7, y: 4, duration: 90, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' },
        { y: -TILE * 0.18, duration: 140, yoyo: true, ease: 'Quad.easeOut' },
      ]);
      this.scene.time.delayedCall(540, () => this.burst(root.x, root.y - TILE * 0.7, 'fx-star', [0xffd54d, 0xfffaf0], 8, 180));
    } else if (animal === 'mole') {
      // Abtauchen und wieder auftauchen
      chain([
        { y: TILE * 0.22, scaleY: 0.5, alpha: 0.2, duration: 240, ease: 'Quad.easeIn', hold: 420 },
        { y: -TILE * 0.2, scaleY: 1.08, alpha: 1, duration: 200, ease: 'Quad.easeOut' },
        { y: 0, scaleY: 1, duration: 220, ease: 'Bounce.easeOut' },
      ]);
      this.burst(feet.x, feet.y, 'fx-dirt', [0xffffff], 14, 240);
    } else if (animal === 'beaver') {
      // Hämmern im Takt der Planken
      chain([{ angle: 10, y: 3, duration: 70, yoyo: true, repeat: 6, ease: 'Quad.easeIn' }]);
    } else {
      // Ausholen und kräftig zuschlagen, zweimal
      const swing: TweenStep[] = [
        { angle: -16, duration: 170, ease: 'Sine.easeOut' },
        { angle: 14, duration: 70, ease: 'Quad.easeIn' },
        { angle: 0, duration: 220, ease: 'Back.easeOut' },
      ];
      chain([...swing, ...swing.map((t) => ({ ...t }))]);
    }
  }

  /** Jubeln: Figur springt, wenn sie ein Gebäude angeschlossen hat. */
  celebrate(playerId: string): void {
    const figure = this.figures.get(playerId);
    if (!figure || this.reduceMotion) return;
    this.scene.tweens.killTweensOf(figure.body);
    figure.body.y = 0;
    this.scene.tweens.add({ targets: figure.body, y: -TILE * 0.35, duration: 220, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
  }

  /** Erfolgseffekt am Haus: Lichtring und Sternfunken. */
  houseBurst(x: number, y: number): void {
    if (this.reduceMotion) return;
    const ring = this.scene.add.graphics().setDepth(DEPTH.fx);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 900,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 1;
        ring.clear();
        ring.lineStyle(10 * (1 - t) + 2, 0x7fd08e, 1 - t).strokeCircle(x, y, TILE * (0.3 + t * 1.3));
        ring.lineStyle(4 * (1 - t) + 1, 0xffd54d, 1 - t).strokeCircle(x, y, TILE * (0.2 + t * 0.9));
      },
      onComplete: () => ring.destroy(),
    });
    this.burst(x, y, 'fx-star', [0xffd54d, 0xff8a1f, 0xfffaf0, 0x7fd08e], 22, 420);
  }

  private burst(x: number, y: number, texture: string, tints: number[], count: number, speed: number): void {
    const emitter = this.scene.add.particles(x, y, texture, {
      speed: { min: speed * 0.4, max: speed },
      angle: { min: 200, max: 340 },
      gravityY: 700,
      lifespan: { min: 500, max: 900 },
      scale: { start: texture === 'fx-star' ? 0.8 : 1, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: tints,
      emitting: false,
    });
    emitter.setDepth(DEPTH.fx);
    emitter.explode(count);
    this.scene.time.delayedCall(1200, () => emitter.destroy());
  }
}
