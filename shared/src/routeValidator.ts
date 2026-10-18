import { MOLE_MAX_TUNNEL } from './abilitySystem';
import { tileCost } from './costCalculator';
import { TILE_INFO, cellKey, formatPoints, isAdjacent } from './tiles';
import type { AnimalId, Cell, GameError, GameState, HalfPoints, MapDef } from './types';

export interface RouteAnalysis {
  /** Summe der bis zum ersten Fehler berechenbaren Kosten. */
  cost: HalfPoints;
  perCell: (HalfPoints | null)[];
  abilityApplied: boolean;
  /** Route endet an einem unversorgten Hausanschluss. */
  complete: boolean;
  buildingId?: string;
  error?: GameError;
}

export interface AnalyzeOptions {
  /** Tier, dessen Route-Fähigkeit für diese Route aktiv ist. */
  activeAbility?: AnimalId | null;
  /** Unvollständige Routen (noch ohne Ziel) nicht als Fehler werten. */
  partial?: boolean;
}

export function networkKeys(map: MapDef, state: GameState): Set<string> {
  const keys = new Set(state.builtCells);
  map.tiles.forEach((row, y) =>
    row.forEach((tile, x) => {
      if (tile === 'distributor') keys.add(cellKey({ x, y }));
    }),
  );
  return keys;
}

export function buildingAt(map: MapDef, cell: Cell) {
  return map.buildings.find((b) => b.connection.x === cell.x && b.connection.y === cell.y);
}

/**
 * Prüft eine geplante Route gegen Karte und aktuellen Spielzustand.
 * Deterministisch und ohne Seiteneffekte – wird von Client und Server genutzt.
 */
export function analyzeRoute(
  map: MapDef,
  state: GameState,
  cells: Cell[],
  options: AnalyzeOptions = {},
): RouteAnalysis {
  const activeAbility = options.activeAbility ?? null;
  const result: RouteAnalysis = { cost: 0, perCell: [], abilityApplied: false, complete: false };
  const fail = (code: GameError['code'], message: string, cellIndex?: number): RouteAnalysis => {
    result.error = { code, message, cellIndex };
    return result;
  };

  if (cells.length === 0) return fail('EMPTY_ROUTE', 'Es ist noch keine Route geplant.');

  const network = networkKeys(map, state);
  const built = new Set(state.builtCells);
  const seen = new Set<string>();
  let rootRuns = 0;
  let currentRun = 0;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (
      !Number.isInteger(cell.x) || !Number.isInteger(cell.y) ||
      cell.x < 0 || cell.y < 0 || cell.x >= map.width || cell.y >= map.height
    ) {
      return fail('OUT_OF_BOUNDS', 'Die Route verlässt die Karte.', i);
    }
    const key = cellKey(cell);
    if (seen.has(key)) return fail('REPEATED_CELL', 'Die Route kreuzt sich selbst.', i);
    seen.add(key);

    if (i === 0) {
      const touchesNetwork = [...network].some((k) => {
        const [x, y] = k.split(',').map(Number);
        return isAdjacent({ x, y }, cell);
      });
      if (!touchesNetwork && !network.has(key)) {
        return fail(
          'START_NOT_CONNECTED',
          'Die Route muss direkt am Netzverteiler oder an einer gebauten Leitung beginnen.',
          i,
        );
      }
    } else if (!isAdjacent(cells[i - 1], cell)) {
      return fail('GAP', 'Route ist unterbrochen – Kacheln müssen direkt aneinandergrenzen.', i);
    }

    if (built.has(key)) return fail('ALREADY_BUILT', 'Hier liegt bereits eine Leitung.', i);

    const raw = map.tiles[cell.y][cell.x];
    if (raw === 'connection') {
      const building = buildingAt(map, cell);
      if (building && state.connected.includes(building.id)) {
        return fail('ALREADY_CONNECTED', `${building.name} ist bereits angeschlossen.`, i);
      }
      if (i !== cells.length - 1) {
        return fail('PASSES_ENDPOINT', 'Die Route muss am Hausanschlusspunkt enden.', i);
      }
      result.buildingId = building?.id;
    }

    const { cost, viaAbility } = tileCost(raw, state.scoutRevealed, activeAbility);
    if (cost === null) {
      result.perCell.push(null);
      return fail('BLOCKED', TILE_INFO[raw].blockedMessage ?? 'Hier kann nicht gebaut werden.', i);
    }

    if (raw === 'roots' && viaAbility) {
      if (currentRun === 0) rootRuns++;
      currentRun++;
      if (rootRuns > 1 || currentRun > MOLE_MAX_TUNNEL) {
        result.perCell.push(null);
        return fail(
          'ROOTS_TOO_LONG',
          `Der Maulwurfstunnel reicht nur für eine Wurzelzone mit bis zu ${MOLE_MAX_TUNNEL} Kacheln.`,
          i,
        );
      }
    } else {
      currentRun = 0;
    }

    result.perCell.push(cost);
    result.cost += cost;
    result.abilityApplied ||= viaAbility;

    if (result.cost > state.budget) {
      return fail(
        'OVER_BUDGET',
        `Budget reicht nicht (benötigt mindestens ${formatPoints(result.cost)}, verfügbar ${formatPoints(state.budget)}).`,
        i,
      );
    }
  }

  result.complete = result.buildingId !== undefined;
  if (!result.complete && !options.partial) {
    return fail(
      'END_NOT_CONNECTION',
      'Die Route endet nicht an einem Hausanschlusspunkt.',
      cells.length - 1,
    );
  }
  return result;
}
