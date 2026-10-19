import type { AnimalId } from '@fuf/shared';
import type { AnimalPose, AnimalView } from '../../ui/animalArt';

/** Blickrichtung einer Figur auf dem Spielfeld. */
export type Facing = 'down' | 'up' | 'left' | 'right';

/**
 * Blickrichtung aus einer Bewegung: Die längere Achse entscheidet. Ohne Bewegung bleibt die
 * bisherige Richtung – die Figur hält im Stand die letzte Laufrichtung.
 */
export function facingFor(dx: number, dy: number, previous: Facing): Facing {
  if (dx === 0 && dy === 0) return previous;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** Ansicht zur Blickrichtung; nach links wird die Seitenansicht gespiegelt. */
export function viewFor(facing: Facing): { view: AnimalView; flipX: boolean } {
  if (facing === 'up') return { view: 'back', flipX: false };
  if (facing === 'down') return { view: 'front', flipX: false };
  return { view: 'side', flipX: facing === 'left' };
}

export function textureKey(animal: AnimalId, view: AnimalView, pose: AnimalPose): string {
  return `animal-${animal}-${view}-${pose}`;
}
