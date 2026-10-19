import { ANIMALS, findPlayer, routeAbility } from './abilitySystem';
import { tileCost } from './costCalculator';
import { getMap } from './maps';
import { cheapestRoutes } from './pathfinder';
import { analyzeRoute } from './routeValidator';
import { scoreGame } from './scoring';
import { cellKey } from './tiles';
import type {
  ActionResult,
  GameAction,
  GameError,
  GameEvent,
  GameState,
  LossReason,
  MapDef,
} from './types';

const reject = (code: GameError['code'], message: string, cellIndex?: number): ActionResult => ({
  ok: false,
  error: { code, message, cellIndex },
});

function finish(map: MapDef, state: GameState, won: boolean, now: number, reason?: LossReason): GameState {
  const done: GameState = {
    ...state,
    status: won ? 'won' : 'lost',
    lossReason: won ? undefined : reason,
    finishedAt: now,
    hint: null,
  };
  return { ...done, result: scoreGame(map, done, now) };
}

/**
 * Optimistische Prüfung, ob mit dem Restbudget überhaupt noch ein Gebäude erreichbar ist.
 * Alle noch nicht genutzten Fähigkeiten werden als verfügbar angenommen.
 */
export function canStillConnect(map: MapDef, state: GameState): boolean {
  const unused = new Set(state.players.filter((p) => !p.abilityUsed).map((p) => p.animal));
  const revealed = state.scoutRevealed || unused.has('fox');
  const routes = cheapestRoutes(map, state, (tile) => {
    let best = tileCost(tile, revealed, null).cost;
    for (const animal of unused) {
      const special = tileCost(tile, revealed, animal).cost;
      if (special !== null && (best === null || special < best)) best = special;
    }
    return best;
  });
  return routes.some((r) => r.cost <= state.budget);
}

export function applyAction(state: GameState, action: GameAction, now: number): ActionResult {
  const map = getMap(state.mapId);

  if ('actionId' in action && state.appliedActionIds.includes(action.actionId)) {
    return { ok: true, state, events: [], duplicate: true };
  }

  const commit = (next: GameState, events: GameEvent[]): ActionResult => {
    const ids = 'actionId' in action ? [...next.appliedActionIds, action.actionId] : next.appliedActionIds;
    return { ok: true, state: { ...next, appliedActionIds: ids, version: state.version + 1 }, events };
  };

  if (action.type === 'tick') {
    if (state.status !== 'playing' || state.pausedAt !== null || now < state.endsAt) {
      return { ok: true, state, events: [] };
    }
    return commit(finish(map, state, false, now, 'time'), [{ type: 'roundLost', reason: 'time' }]);
  }
  if (action.type === 'pause') {
    if (state.mode !== 'solo') return reject('NOT_ALLOWED', 'Im Multiplayer kann nicht pausiert werden.');
    if (state.status !== 'playing' || state.pausedAt !== null) return { ok: true, state, events: [] };
    return commit({ ...state, pausedAt: now }, []);
  }
  if (action.type === 'resume') {
    if (state.pausedAt === null) return { ok: true, state, events: [] };
    return commit({ ...state, endsAt: state.endsAt + (now - state.pausedAt), pausedAt: null }, []);
  }

  if (state.status !== 'playing') return reject('GAME_OVER', 'Die Runde ist bereits beendet.');
  if (state.pausedAt !== null) return reject('NOT_ALLOWED', 'Das Spiel ist pausiert.');
  if (now >= state.endsAt) return reject('GAME_OVER', 'Die Zeit ist abgelaufen.');

  const player = findPlayer(state, action.playerId);
  if (!player) return reject('UNKNOWN_PLAYER', 'Unbekannter Spieler.');

  switch (action.type) {
    case 'forfeit':
      return commit(finish(map, state, false, now, 'forfeit'), [{ type: 'roundLost', reason: 'forfeit' }]);

    case 'useScout': {
      if (player.animal !== 'fox') return reject('NOT_ALLOWED', 'Nur der Fuchs hat die Spürnase.');
      if (player.abilityUsed) return reject('ABILITY_USED', 'Die Spürnase wurde bereits eingesetzt.');
      const revealed = { ...state, scoutRevealed: true };
      const [best] = cheapestRoutes(map, revealed, (tile) => tileCost(tile, true, null).cost);
      const next: GameState = {
        ...revealed,
        hint: best ? best.cells : null,
        players: state.players.map((p) => (p.id === player.id ? { ...p, abilityUsed: true } : p)),
      };
      return commit(next, [{ type: 'abilityUsed', playerId: player.id, animal: 'fox' }]);
    }

    case 'buildRoute': {
      if (!Array.isArray(action.cells) || action.cells.length > map.width * map.height) {
        return reject('INVALID_ACTION', 'Ungültige Route.');
      }
      // Die passive Fähigkeit (Dachs) wirkt ohne Aktivierung; ein mitgeschicktes `useAbility` ist dann bedeutungslos
      if (action.useAbility && ANIMALS[player.animal].kind !== 'passive') {
        if (ANIMALS[player.animal].kind !== 'route') {
          return reject('NOT_ALLOWED', `${ANIMALS[player.animal].name} hat keine Bau-Fähigkeit.`);
        }
        if (player.abilityUsed) {
          return reject('ABILITY_USED', `${ANIMALS[player.animal].abilityName} wurde bereits eingesetzt.`);
        }
      }
      const analysis = analyzeRoute(map, state, action.cells, {
        activeAbility: routeAbility(player, action.useAbility),
      });
      if (analysis.error) return { ok: false, error: analysis.error };

      const buildingId = analysis.buildingId!;
      const events: GameEvent[] = [
        { type: 'routeBuilt', playerId: player.id, cost: analysis.cost, cells: action.cells },
        { type: 'buildingConnected', buildingId, playerId: player.id },
      ];
      if (analysis.abilityApplied) {
        events.unshift({ type: 'abilityUsed', playerId: player.id, animal: player.animal });
      }

      let next: GameState = {
        ...state,
        budget: state.budget - analysis.cost,
        spent: state.spent + analysis.cost,
        routes: [
          ...state.routes,
          {
            actionId: action.actionId,
            playerId: player.id,
            cells: action.cells.map(({ x, y }) => ({ x, y })),
            cost: analysis.cost,
            abilityUsed: analysis.abilityApplied,
          },
        ],
        builtCells: [...state.builtCells, ...action.cells.map(cellKey)],
        connected: [...state.connected, buildingId],
        hint: null,
        players: analysis.abilityApplied
          ? state.players.map((p) => (p.id === player.id ? { ...p, abilityUsed: true } : p))
          : state.players,
      };

      if (next.connected.length === map.buildings.length) {
        next = finish(map, next, true, now);
        events.push({ type: 'roundWon' });
      } else if (!canStillConnect(map, next)) {
        next = finish(map, next, false, now, 'budget');
        events.push({ type: 'roundLost', reason: 'budget' });
      }
      return commit(next, events);
    }
  }
}
