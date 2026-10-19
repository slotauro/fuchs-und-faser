import { describe, expect, it } from 'vitest';
import { ANIMALS, routeAbility, type PlayerState } from '../src';

const player = (animal: PlayerState['animal'], abilityUsed = false): PlayerState =>
  ({ id: 'p1', name: 'Tester', animal, abilityUsed });

describe('Aktivierung der Fähigkeiten', () => {
  it('Maulwurf, Biber und Dachs wirken automatisch, der Fuchs per Knopf', () => {
    expect(ANIMALS.mole.kind).toBe('passive');
    expect(ANIMALS.beaver.kind).toBe('passive');
    expect(ANIMALS.badger.kind).toBe('passive');
    expect(ANIMALS.fox.kind).toBe('instant');
  });

  it('Bau-Fähigkeiten gelten ohne Aktivierung, bis sie verbraucht sind', () => {
    expect(routeAbility(player('badger'))).toBe('badger');
    expect(routeAbility(player('mole'))).toBe('mole');
    expect(routeAbility(player('beaver'))).toBe('beaver');
    expect(routeAbility(player('beaver', true))).toBeNull();
    expect(routeAbility(player('fox'))).toBeNull();
  });
});
