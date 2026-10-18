import { describe, expect, it } from 'vitest';
import { MAPS } from '@fuf/shared';
import { buildingBlocks, decorationBox, marginDecorations } from '../src/game/art/layout';
import { cellRng } from '../src/game/art/rng';

const TILE = 96;
const MARGIN = 96;

describe('Layout der Spielwelt', () => {
  it('fasst Gebäudekacheln zu genau einem Haus pro Gebäude zusammen', () => {
    for (const map of MAPS) {
      const blocks = buildingBlocks(map);
      expect(blocks).toHaveLength(map.buildings.length);
      const ids = blocks.map((b) => b.building?.id).sort();
      expect(ids).toEqual(map.buildings.map((b) => b.id).sort());
    }
  });

  it('wählt passende Hausvarianten nach Namen', () => {
    const town = MAPS.find((m) => m.id === 'tierstadt')!;
    const variants = Object.fromEntries(buildingBlocks(town).map((b) => [b.building!.name, b.variant]));
    expect(variants['Bäckerei Hase']).toBe('bakery');
    expect(variants['Schule Specht']).toBe('school');
  });

  it('platziert hohe Dekoration nie auf dem Spielraster', () => {
    for (const map of MAPS) {
      const decorations = marginDecorations(map, TILE, MARGIN);
      expect(decorations.length).toBeGreaterThan(10);
      for (const d of decorations) {
        const box = decorationBox(d, TILE);
        const overlaps = box.right > 0 && box.left < map.width * TILE && box.bottom > 0 && box.top < map.height * TILE;
        expect(overlaps, `${map.id}: ${d.key} bei ${Math.round(d.x)},${Math.round(d.y)}`).toBe(false);
      }
    }
  });

  it('erzeugt deterministische Zufallswerte je Zelle', () => {
    expect(cellRng('karte', 3, 4)()).toBe(cellRng('karte', 3, 4)());
    expect(cellRng('karte', 3, 4)()).not.toBe(cellRng('karte', 4, 3)());
    expect(marginDecorations(MAPS[0], TILE, MARGIN)).toEqual(marginDecorations(MAPS[0], TILE, MARGIN));
  });
});
