import { describe, expect, it } from 'vitest';
import { canArmAt, getMap, routeAbility, type PlayerState } from '../src';

const wurzelallee = getMap('wurzelallee');
const player = (animal: PlayerState['animal'], abilityUsed = false): PlayerState =>
  ({ id: 'p1', name: 'Tester', animal, abilityUsed });

describe('Aktivierung der Fähigkeiten', () => {
  it('der Maulwurf kann nur direkt vor (oder auf) Wurzeln scharf schalten', () => {
    expect(canArmAt(wurzelallee, 'mole', { x: 6, y: 4 })).toBe(true);
    expect(canArmAt(wurzelallee, 'mole', { x: 7, y: 4 })).toBe(true);
    expect(canArmAt(wurzelallee, 'mole', { x: 5, y: 4 })).toBe(false);
    // Wurzeln hinter der Figur (schon geplant) zählen nicht
    expect(canArmAt(wurzelallee, 'mole', { x: 9, y: 4 }, new Set(['8,4']))).toBe(false);
  });

  it('der Biber kann nur direkt vor einer Querungsstelle scharf schalten, nicht vor beliebigem Wasser', () => {
    expect(canArmAt(wurzelallee, 'beaver', { x: 6, y: 3 })).toBe(true);
    expect(canArmAt(wurzelallee, 'beaver', { x: 6, y: 1 })).toBe(false);
    expect(canArmAt(wurzelallee, 'beaver', { x: 6, y: 4 })).toBe(false);
  });

  it('Dachs und Fuchs schalten nichts scharf', () => {
    expect(canArmAt(wurzelallee, 'badger', { x: 6, y: 6 })).toBe(false);
    expect(canArmAt(wurzelallee, 'fox', { x: 6, y: 4 })).toBe(false);
  });

  it('der Dachs wirkt ohne Aktivierung, Maulwurf und Biber nur scharf geschaltet', () => {
    expect(routeAbility(player('badger'), false)).toBe('badger');
    expect(routeAbility(player('badger', true), false)).toBeNull();
    expect(routeAbility(player('mole'), false)).toBeNull();
    expect(routeAbility(player('mole'), true)).toBe('mole');
    expect(routeAbility(player('beaver', true), true)).toBeNull();
    expect(routeAbility(player('fox'), true)).toBeNull();
  });
});
