import { abilityTileCost } from './abilitySystem';
import { TILE_INFO, effectiveTile } from './tiles';
import type { AnimalId, HalfPoints, TileType } from './types';

export interface TileCost {
  cost: HalfPoints | null;
  /** true, wenn die Fähigkeit die Kosten bzw. Bebaubarkeit verändert hat. */
  viaAbility: boolean;
}

/** Kosten einer Kachel unter Berücksichtigung von Aufdeckung und aktiver Fähigkeit. */
export function tileCost(
  rawTile: TileType,
  scoutRevealed: boolean,
  activeAbility: AnimalId | null,
): TileCost {
  const tile = effectiveTile(rawTile, scoutRevealed);
  if (activeAbility) {
    const special = abilityTileCost(activeAbility, tile);
    if (special !== undefined) return { cost: special, viaAbility: true };
  }
  return { cost: TILE_INFO[tile].cost, viaAbility: false };
}
