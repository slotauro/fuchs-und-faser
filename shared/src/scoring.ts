import { formatPoints } from './tiles';
import type { GameState, MapDef, ScoreResult } from './types';

/** Transparente Rundenwertung: 50 Anschluss + 30 Kosteneffizienz + 20 Zeit. */
export function scoreGame(map: MapDef, state: GameState, now: number): ScoreResult {
  const total = map.buildings.length;
  const connected = state.connected.length;
  const won = state.status === 'won';

  const connectionPoints = Math.round((50 * connected) / total);

  let efficiency = 0;
  let efficiencyDetail = 'Nur bei erfolgreichem Abschluss';
  if (won) {
    const ratio = Math.min(1, map.parCost / Math.max(1, state.spent));
    efficiency = Math.round(30 * ratio);
    efficiencyDetail = `Referenz ${formatPoints(map.parCost)} / verbaut ${formatPoints(state.spent)}`;
  }

  let timePoints = 0;
  let timeDetail = 'Nur bei erfolgreichem Abschluss';
  if (won) {
    const limitMs = map.timeLimitSec * 1000;
    const finished = state.finishedAt ?? now;
    const remainingMs = Math.max(0, state.endsAt - finished);
    timePoints = Math.round((20 * remainingMs) / limitMs);
    timeDetail = `${Math.round(remainingMs / 1000)} von ${map.timeLimitSec} s übrig`;
  }

  let stars: ScoreResult['stars'] = 0;
  if (won) {
    stars = 1;
    if (state.spent <= map.stars.two) stars = 2;
    if (state.spent <= map.stars.three) stars = 3;
  }

  return {
    total: connectionPoints + efficiency + timePoints,
    stars,
    lines: [
      {
        label: 'Anschluss',
        points: connectionPoints,
        max: 50,
        detail: `${connected} von ${total} Gebäuden angeschlossen`,
      },
      { label: 'Kosteneffizienz', points: efficiency, max: 30, detail: efficiencyDetail },
      { label: 'Zeit', points: timePoints, max: 20, detail: timeDetail },
    ],
  };
}
