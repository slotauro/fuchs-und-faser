import { describe, expect, it } from 'vitest';
import { analyzeRoute, tileCost, TILE_INFO, formatPoints } from '../src';
import { MAP1_DETOUR, MAP1_ROCKS, route, solo } from './helpers';

describe('Kostenmodell', () => {
  it('nutzt die Werte aus dem PRD in halben Punkten', () => {
    expect(TILE_INFO.meadow.cost).toBe(2);
    expect(TILE_INFO.sidewalk.cost).toBe(2);
    expect(TILE_INFO.road.cost).toBe(8);
    expect(TILE_INFO.rock.cost).toBe(6);
    expect(TILE_INFO.conduit.cost).toBe(1);
    expect(TILE_INFO.connection.cost).toBe(6);
    expect(TILE_INFO.roots.cost).toBeNull();
    expect(TILE_INFO.water.cost).toBeNull();
  });

  it('behandelt verborgene Leerrohre erst nach Aufdeckung als Leerrohr', () => {
    expect(tileCost('hiddenConduit', false, null).cost).toBe(2);
    expect(tileCost('hiddenConduit', true, null).cost).toBe(1);
  });

  it('wendet Fähigkeitskosten nur auf passende Kacheln an', () => {
    expect(tileCost('rock', false, 'badger')).toEqual({ cost: 1, viaAbility: true });
    expect(tileCost('roots', false, 'mole')).toEqual({ cost: 2, viaAbility: true });
    expect(tileCost('bridgeSite', false, 'beaver')).toEqual({ cost: 2, viaAbility: true });
    expect(tileCost('water', false, 'beaver').cost).toBeNull();
    expect(tileCost('meadow', false, 'badger')).toEqual({ cost: 2, viaAbility: false });
  });

  it('formatiert halbe Punkte deutsch', () => {
    expect(formatPoints(7)).toBe('3,5');
    expect(formatPoints(30)).toBe('15');
  });
});

describe('Routenvalidierung', () => {
  it('akzeptiert eine gültige Route und berechnet die Kosten', () => {
    const { map, state } = solo('erstes-haus');
    const a = analyzeRoute(map, state, MAP1_DETOUR);
    expect(a.error).toBeUndefined();
    expect(a.complete).toBe(true);
    expect(a.cost).toBe(30);
    expect(a.buildingId).toBe('b1');
  });

  it('rechnet Felsen teurer', () => {
    const { map, state } = solo('erstes-haus');
    expect(analyzeRoute(map, state, MAP1_ROCKS).cost).toBe(34);
  });

  it('lehnt unterbrochene Routen ab und nennt die Stelle', () => {
    const { map, state } = solo('erstes-haus');
    const a = analyzeRoute(map, state, route('1,4 1,5 3,5'));
    expect(a.error?.code).toBe('GAP');
    expect(a.error?.cellIndex).toBe(2);
  });

  it('verlangt einen Start am Netz', () => {
    const { map, state } = solo('erstes-haus');
    expect(analyzeRoute(map, state, route('5,5 6,5')).error?.code).toBe('START_NOT_CONNECTED');
  });

  it('erklärt nicht bebaubare Kacheln', () => {
    const { map, state } = solo('wurzelallee');
    const a = analyzeRoute(map, state, route('2,4 3,4 4,4 5,4 6,4 7,4'));
    expect(a.error?.code).toBe('BLOCKED');
    expect(a.error?.message).toContain('Wurzelzone');
    expect(a.error?.cellIndex).toBe(5);
  });

  it('erkennt Selbstkreuzungen, Kartenrand und Routen ohne Ziel', () => {
    const { map, state } = solo('erstes-haus');
    expect(analyzeRoute(map, state, route('1,4 1,5 1,4')).error?.code).toBe('REPEATED_CELL');
    expect(analyzeRoute(map, state, route('0,3 -1,3')).error?.code).toBe('OUT_OF_BOUNDS');
    expect(analyzeRoute(map, state, route('1,4 1,5')).error?.code).toBe('END_NOT_CONNECTION');
    expect(analyzeRoute(map, state, route('1,4 1,5'), { partial: true }).error).toBeUndefined();
    expect(analyzeRoute(map, state, []).error?.code).toBe('EMPTY_ROUTE');
  });

  it('lehnt Routen über dem Budget ab', () => {
    const { map, state } = solo('erstes-haus');
    const a = analyzeRoute(map, { ...state, budget: 20 }, MAP1_DETOUR);
    expect(a.error?.code).toBe('OVER_BUDGET');
  });

  it('lässt keine Leitung über bereits gebaute Kacheln zu', () => {
    const { map, state } = solo('erstes-haus');
    const a = analyzeRoute(map, { ...state, builtCells: ['1,5'] }, route('1,4 1,5'), { partial: true });
    expect(a.error?.code).toBe('ALREADY_BUILT');
  });

  it('begrenzt den Maulwurfstunnel auf eine zusammenhängende Wurzelzone', () => {
    const { map, state } = solo('wurzelallee', 'mole');
    // senkrecht durch vier Wurzelkacheln (7,4..7,5 und nach Fels 7,7..7,8) => zwei Abschnitte
    const twoRuns = route('2,4 3,4 4,4 5,4 6,4 7,4 7,5 7,6 7,7');
    expect(analyzeRoute(map, state, twoRuns, { activeAbility: 'mole', partial: true }).error?.code).toBe(
      'ROOTS_TOO_LONG',
    );
  });
});
