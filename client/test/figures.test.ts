import { describe, expect, it } from 'vitest';
import { ANIMAL_IDS } from '@fuf/shared';
import { facingFor, textureKey, viewFor } from '../src/game/layers/facing';
import { ANIMAL_POSES, ANIMAL_VIEWS, animalDataUrl } from '../src/ui/animalArt';

describe('Blickrichtung der Figuren', () => {
  it('schaut in Laufrichtung', () => {
    expect(facingFor(1, 0, 'down')).toBe('right');
    expect(facingFor(-1, 0, 'down')).toBe('left');
    expect(facingFor(0, -1, 'down')).toBe('up');
    expect(facingFor(0, 1, 'up')).toBe('down');
  });

  it('nimmt bei Sprüngen die längere Achse', () => {
    expect(facingFor(-3, 1, 'down')).toBe('left');
    expect(facingFor(2, -5, 'down')).toBe('up');
  });

  it('behält ohne Bewegung die letzte Richtung', () => {
    expect(facingFor(0, 0, 'left')).toBe('left');
    expect(facingFor(0, 0, 'up')).toBe('up');
  });

  it('spiegelt nur die Seitenansicht nach links', () => {
    expect(viewFor('down')).toEqual({ view: 'front', flipX: false });
    expect(viewFor('up')).toEqual({ view: 'back', flipX: false });
    expect(viewFor('right')).toEqual({ view: 'side', flipX: false });
    expect(viewFor('left')).toEqual({ view: 'side', flipX: true });
  });
});

describe('Tiergrafiken', () => {
  it('liefert für jede Ansicht und Pose eine eigene Grafik', () => {
    const urls = new Set<string>();
    const keys = new Set<string>();
    for (const id of ANIMAL_IDS)
      for (const view of ANIMAL_VIEWS)
        for (const pose of ANIMAL_POSES) {
          const url = animalDataUrl(id, view, pose);
          expect(url).toMatch(/^data:image\/svg\+xml;base64,.{200,}/);
          urls.add(url);
          keys.add(textureKey(id, view, pose));
        }
    const count = ANIMAL_IDS.length * ANIMAL_VIEWS.length * ANIMAL_POSES.length;
    expect(urls.size).toBe(count);
    expect(keys.size).toBe(count);
  });

  it('zeigt ohne Angaben die stehende Frontansicht', () => {
    for (const id of ANIMAL_IDS) expect(animalDataUrl(id)).toBe(animalDataUrl(id, 'front', 'stand'));
  });
});
