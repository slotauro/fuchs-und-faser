import type { AnimalId, GameState, HalfPoints, PlayerState, TileType } from './types';

export interface AnimalInfo {
  id: AnimalId;
  name: string;
  role: string;
  abilityName: string;
  abilityText: string;
  character: string;
  /** Bei `instant` wird die Fähigkeit sofort ausgelöst, sonst für die nächste Route scharf geschaltet. */
  kind: 'instant' | 'route';
}

export const ANIMALS: Record<AnimalId, AnimalInfo> = {
  fox: {
    id: 'fox',
    name: 'Fuchs',
    role: 'Der clevere Planer',
    abilityName: 'Spürnase',
    abilityText:
      'Deckt verborgene Leerrohre auf und zeigt die günstigste Route zum nächsten Gebäude als Hinweis.',
    character: 'Schlau, schnell und strategisch.',
    kind: 'instant',
  },
  mole: {
    id: 'mole',
    name: 'Maulwurf',
    role: 'Der Tunnelprofi',
    abilityName: 'Maulwurfstunnel',
    abilityText:
      'Die nächste Route darf eine zusammenhängende Wurzelzone (bis 3 Kacheln) unterqueren – 1 Punkt pro Kachel.',
    character: 'Ruhig, robust und ein echter Tiefbau-Profi.',
    kind: 'route',
  },
  beaver: {
    id: 'beaver',
    name: 'Biber',
    role: 'Der Infrastruktur-Bauer',
    abilityName: 'Cleverer Übergang',
    abilityText:
      'Die nächste Route darf Wasser an markierten Querungsstellen überbrücken – 1 Punkt pro Kachel.',
    character: 'Praktisch, handwerklich begabt und zuverlässig.',
    kind: 'route',
  },
  badger: {
    id: 'badger',
    name: 'Dachs',
    role: 'Der Felsenspezialist',
    abilityName: 'Hart im Nehmen',
    abilityText: 'In der nächsten Route kostet felsiger Untergrund nur 0,5 statt 3 Punkte pro Kachel.',
    character: 'Ausdauernd, kräftig und unerschrocken.',
    kind: 'route',
  },
};

export const ANIMAL_IDS = Object.keys(ANIMALS) as AnimalId[];

export const MOLE_MAX_TUNNEL = 3;

/**
 * Kosten einer Kachel, wenn die Route-Fähigkeit des Tiers aktiv ist.
 * Gibt `undefined` zurück, wenn die Fähigkeit diese Kachel nicht verändert.
 */
export function abilityTileCost(animal: AnimalId, tile: TileType): HalfPoints | undefined {
  if (animal === 'mole' && tile === 'roots') return 2;
  if (animal === 'beaver' && tile === 'bridgeSite') return 2;
  if (animal === 'badger' && tile === 'rock') return 1;
  return undefined;
}

export function findPlayer(state: GameState, playerId: string): PlayerState | undefined {
  return state.players.find((p) => p.id === playerId);
}

export function canUseAbility(player: PlayerState): boolean {
  return !player.abilityUsed;
}
