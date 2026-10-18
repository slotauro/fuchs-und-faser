import Phaser from 'phaser';
import type { MapDef } from '@fuf/shared';
import { buildingBlocks, marginDecorations, DECO_SIZE, type BuildingBlock } from '../art/layout';
import { HOUSE_OVERHANG, houseSvg, svgDataUrl, svgSize, worldAssets } from '../art/svgAssets';
import { renderTerrain } from '../art/terrain';
import { DEPTH, MARGIN, TILE, center } from './constants';

/** Vektor-Texturen werden doppelt so groß gerastert, damit sie auf hochauflösenden Displays scharf bleiben. */
const SVG_SCALE = 2;

/** Boden, Häuser, Verteiler, Hausanschlüsse, Randdekoration und Beschriftungen. */
export class TerrainLayer {
  private ground: Phaser.GameObjects.Image | null = null;
  private sockets = new Map<string, Phaser.GameObjects.Image>();
  private blocks: BuildingBlock[];
  private revealed: boolean | null = null;

  constructor(private scene: Phaser.Scene, private map: MapDef) {
    this.blocks = buildingBlocks(map);
  }

  /** Lädt alle Vektor-Assets (im `preload` der Szene aufrufen). */
  static preload(scene: Phaser.Scene, map: MapDef): void {
    const load = (key: string, svg: string) => {
      const size = svgSize(svg);
      scene.load.svg(key, svgDataUrl(svg), { width: size.width * SVG_SCALE, height: size.height * SVG_SCALE });
    };
    for (const asset of worldAssets()) load(asset.key, asset.svg);
    buildingBlocks(map).forEach((block, i) => load(`house-${i}`, houseSvg(houseOptions(block))));
  }

  create(revealed: boolean): void {
    this.drawGround(revealed);
    const { scene, map } = this;

    // Häuser: unten verankert, Dach ragt etwas nach oben
    this.blocks.forEach((block, i) => {
      const { x, y, w, h } = block.bounds;
      scene.add
        .image(x * TILE, (y + h) * TILE, `house-${i}`)
        .setOrigin(0, 1)
        .setDisplaySize(w * TILE, (h + HOUSE_OVERHANG) * TILE)
        .setDepth(DEPTH.houses);
    });

    // Netzverteiler
    map.tiles.forEach((row, y) =>
      row.forEach((tile, x) => {
        if (tile !== 'distributor') return;
        const c = center({ x, y });
        scene.add.image(c.x, c.y + TILE * 0.38, 'distributor').setOrigin(0.5, 1).setDisplaySize(TILE * 0.9, TILE * 0.99).setDepth(DEPTH.props);
        this.label(c.x, c.y + TILE * 0.42, 'Verteiler', false);
      }),
    );

    // Hausanschlüsse
    for (const b of map.buildings) {
      const c = center(b.connection);
      const img = scene.add.image(c.x, c.y, 'socket').setDisplaySize(TILE * 0.62, TILE * 0.62).setDepth(DEPTH.props);
      this.sockets.set(b.id, img);
    }

    // Gebäudenamen als Schild auf dem Dach
    for (const block of this.blocks) {
      if (!block.building) continue;
      const { x, y, w } = block.bounds;
      this.label((x + w / 2) * TILE, (y - HOUSE_OVERHANG * 0.2) * TILE + TILE * 0.1, block.building.name, true);
    }

    // Randdekoration (nie auf bespielbaren Feldern)
    for (const d of marginDecorations(map, TILE, MARGIN)) {
      const size = DECO_SIZE[d.key];
      scene.add
        .image(d.x, d.y, d.key)
        .setOrigin(0.5, 1)
        .setDisplaySize(size.w * TILE * d.scale, size.h * TILE * d.scale)
        .setFlipX(d.flip)
        .setDepth(DEPTH.houses + d.y / 100000);
    }
  }

  /** Neu zeichnen, wenn die Spürnase verborgene Leerrohre aufgedeckt hat. */
  setRevealed(revealed: boolean): void {
    if (revealed !== this.revealed) this.drawGround(revealed);
  }

  setConnected(connected: string[]): void {
    for (const [id, img] of this.sockets) img.setTexture(connected.includes(id) ? 'socket-on' : 'socket');
  }

  socketPosition(buildingId: string): { x: number; y: number } | null {
    const img = this.sockets.get(buildingId);
    return img ? { x: img.x, y: img.y } : null;
  }

  private drawGround(revealed: boolean): void {
    const key = `terrain-${this.map.id}-${revealed ? 1 : 0}`;
    if (!this.scene.textures.exists(key)) {
      this.scene.textures.addCanvas(key, renderTerrain(this.map, revealed, TILE, MARGIN));
    }
    if (this.ground) this.ground.setTexture(key);
    else this.ground = this.scene.add.image(-MARGIN, -MARGIN, key).setOrigin(0).setDepth(DEPTH.terrain);
    this.revealed = revealed;
  }

  private label(x: number, y: number, text: string, prominent: boolean): void {
    const t = this.scene.add
      .text(0, 0, text, {
        fontFamily: '"Nunito Variable", Nunito, system-ui, sans-serif',
        fontSize: prominent ? '19px' : '16px',
        fontStyle: '800',
        color: '#3b2f25',
      })
      .setOrigin(0.5);
    const w = t.width + 18;
    const h = t.height + 6;
    const g = this.scene.add.graphics();
    g.fillStyle(0x3b2f25, 0.25).fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, h / 2);
    g.fillStyle(0xfffaf0, 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.lineStyle(2, prominent ? 0xff8a1f : 0x3b2f25, prominent ? 1 : 0.35).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    this.scene.add.container(x, y, [g, t]).setDepth(DEPTH.labels);
  }
}

function houseOptions(block: BuildingBlock) {
  const { x, y, w, h } = block.bounds;
  const conn = block.building?.connection;
  const inside = conn && conn.x >= x && conn.x < x + w && conn.y >= y && conn.y < y + h;
  return { variant: block.variant, w, h, socketColumn: inside ? conn.x - x : null };
}
