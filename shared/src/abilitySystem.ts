import { cellKey } from './tiles';
import type { AnimalId, Cell, GameState, HalfPoints, MapDef, PlayerState, TileType } from './types';

export interface AnimalInfo {
  id: AnimalId;
  name: string;
  role: string;
  abilityName: string;
  abilityText: string;
  character: string;
  /**
   * `instant`: wird sofort ausgelöst. `route`: wird direkt vor dem passenden Hindernis für die laufende
   * Planung scharf geschaltet. `passive`: wirkt ohne Aktivierung in der ersten Route, in der sie greift.
   */
  kind: 'instant' | 'route' | 'passive';
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
      'Direkt vor einer Wurzelzone einsetzbar: Der Maulwurf gräbt einen Graben durch bis zu 3 Wurzelkacheln – 1 Punkt pro Kachel.',
    character: 'Ruhig, robust und ein echter Tiefbau-Profi.',
    kind: 'route',
  },
  beaver: {
    id: 'beaver',
    name: 'Biber',
    role: 'Der Infrastruktur-Bauer',
    abilityName: 'Cleverer Übergang',
    abilityText:
      'Direkt vor einer markierten Querungsstelle einsetzbar: Der Biber baut eine Brücke über das Wasser – 1 Punkt pro Kachel.',
    character: 'Praktisch, handwerklich begabt und zuverlässig.',
    kind: 'route',
  },
  badger: {
    id: 'badger',
    name: 'Dachs',
    role: 'Der Felsenspezialist',
    abilityName: 'Hart im Nehmen',
    abilityText:
      'Wirkt automatisch: In der ersten Route über Felsen kostet felsiger Untergrund nur 0,5 statt 3 Punkte pro Kachel.',
    character: 'Ausdauernd, kräftig und unerschrocken.',
    kind: 'passive',
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

/**
 * Bau-Fähigkeit, die für eine Route des Spielers gilt: die passive Fähigkeit wirkt immer,
 * eine `route`-Fähigkeit nur, wenn sie scharf geschaltet ist. Verbrauchte Fähigkeiten wirken nicht mehr.
 */
export function routeAbility(player: PlayerState, armed: boolean): AnimalId | null {
  if (player.abilityUsed) return null;
  const { kind } = ANIMALS[player.animal];
  return kind === 'passive' || (kind === 'route' && armed) ? player.animal : null;
}

/**
 * Darf das Tier seine Bau-Fähigkeit auf `cell` scharf schalten? Nur direkt vor (oder auf) einer Kachel,
 * auf der sie wirkt – der Maulwurf vor Wurzeln, der Biber vor einer Querungsstelle.
 * `skip` sind Kacheln, die nicht mehr vor der Figur liegen (z. B. die bereits geplante Strecke).
 */
export function canArmAt(map: MapDef, animal: AnimalId, cell: Cell, skip: Set<string> = new Set()): boolean {
  if (ANIMALS[animal].kind !== 'route') return false;
  const acts = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < map.width && y < map.height && abilityTileCost(animal, map.tiles[y][x]) !== undefined;
  if (acts(cell.x, cell.y)) return true;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(
    ([dx, dy]) => !skip.has(cellKey({ x: cell.x + dx, y: cell.y + dy })) && acts(cell.x + dx, cell.y + dy),
  );
}
