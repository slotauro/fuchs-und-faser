import { describe, expect, it } from 'vitest';
import { applyAction, createGame, getMap, type GameState } from '../src';
import { MAP1_DETOUR, MAP2_TUNNEL, route, solo } from './helpers';

const build = (state: GameState, cells = MAP1_DETOUR, extra: { useAbility?: boolean; actionId?: string } = {}) =>
  applyAction(
    state,
    { type: 'buildRoute', actionId: extra.actionId ?? 'a1', playerId: 'p1', cells, useAbility: !!extra.useAbility },
    1000,
  );

describe('Szenario A – Singleplayer', () => {
  it('schließt das Haus an, reduziert das Budget und zeigt ein Ergebnis', () => {
    const { state } = solo('erstes-haus');
    const r = build(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.budget).toBe(state.budget - 30);
    expect(r.state.connected).toEqual(['b1']);
    expect(r.state.status).toBe('won');
    expect(r.state.result?.stars).toBe(3);
    expect(r.state.result?.lines.map((l) => l.label)).toEqual(['Anschluss', 'Kosteneffizienz', 'Zeit']);
    expect(r.events.map((e) => e.type)).toContain('roundWon');
  });
});

describe('Szenario B – ungültige Route', () => {
  it('lässt das Budget unverändert und markiert die Stelle', () => {
    const { state } = solo('wurzelallee');
    const r = build(state, route('2,4 3,4 4,4 5,4 6,4 7,4'));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.cellIndex).toBe(5);
    expect(state.budget).toBe(getMap('wurzelallee').budget);
  });
});

describe('Szenario C – Spezialfähigkeit', () => {
  it('der Maulwurf unterquert die Wurzelzone genau einmal', () => {
    const { state } = solo('wurzelallee', 'mole');
    const r = build(state, MAP2_TUNNEL, { useAbility: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players[0].abilityUsed).toBe(true);
    expect(r.state.spent).toBe(30); // 10 Wiese à 2 + 2 Wurzel à 2 + Anschluss 6
    expect(r.events[0]).toMatchObject({ type: 'abilityUsed', animal: 'mole' });
  });

  it('ohne Fähigkeit ist die Wurzelzone gesperrt', () => {
    const { state } = solo('wurzelallee', 'mole');
    expect(build(state, MAP2_TUNNEL).ok).toBe(false);
  });

  it('ein abgelehnter Bau verbraucht die Fähigkeit nicht', () => {
    const { state } = solo('wurzelallee', 'mole');
    const r = build({ ...state, budget: 4 }, MAP2_TUNNEL, { useAbility: true });
    expect(r.ok).toBe(false);
    expect(state.players[0].abilityUsed).toBe(false);
  });

  it('eine verbrauchte Fähigkeit kann nicht erneut genutzt werden', () => {
    const { state } = solo('wurzelallee', 'mole');
    const used = { ...state, players: state.players.map((p) => ({ ...p, abilityUsed: true })) };
    const r = build(used, MAP2_TUNNEL, { useAbility: true });
    expect(!r.ok && r.error.code).toBe('ABILITY_USED');
  });

  it('der Dachs macht Felsen günstiger – ganz ohne Aktivierung', () => {
    const { state } = solo('erstes-haus', 'badger');
    const r = build(state, route('2,3 2,4 3,4 4,4 5,4 6,4 7,4 8,4 9,4 10,4 11,4'));
    expect(r.ok && r.state.spent).toBe(24);
    expect(r.ok && r.state.players[0].abilityUsed).toBe(true);
    expect(r.ok && r.events[0]).toMatchObject({ type: 'abilityUsed', animal: 'badger' });
  });

  it('die passive Fähigkeit des Dachses wirkt nur einmal und wird nicht abgelehnt', () => {
    const { state } = solo('erstes-haus', 'badger');
    const used = { ...state, players: state.players.map((p) => ({ ...p, abilityUsed: true })) };
    const r = build(used, route('2,3 2,4 3,4 4,4 5,4 6,4 7,4 8,4 9,4 10,4 11,4'), { useAbility: true });
    expect(r.ok && r.state.spent).toBeGreaterThan(24);
  });

  it('der Biber überbrückt die Querungsstelle', () => {
    const { state } = solo('wurzelallee', 'beaver');
    const cells = route('1,3 2,3 3,3 4,3 5,3 6,3 7,3 8,3 9,3 10,3 11,3 12,3 13,3 13,4 14,4');
    expect(build(state, cells).ok).toBe(false);
    const r = build(state, cells, { useAbility: true });
    expect(r.ok && r.state.spent).toBe(34);
  });

  it('erklärt nach verbrauchtem Übergang, warum die Querungsstelle gesperrt ist', () => {
    const { state } = solo('wurzelallee', 'beaver');
    const cells = route('1,3 2,3 3,3 4,3 5,3 6,3 7,3 8,3 9,3 10,3 11,3 12,3 13,3 13,4 14,4');
    const used = { ...state, players: state.players.map((p) => ({ ...p, abilityUsed: true })) };
    const r = build(used, cells);
    expect(!r.ok && r.error.code).toBe('BLOCKED');
    expect(!r.ok && r.error.message).toContain('schon verbraucht');
    const fresh = build(state, cells);
    expect(!fresh.ok && fresh.error.message).toContain('nur der Biber');
  });

  it('der Fuchs deckt Leerrohre auf und zeigt einen Hinweis', () => {
    const { state } = solo('wurzelallee', 'fox');
    const r = applyAction(state, { type: 'useScout', actionId: 's1', playerId: 'p1' }, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.scoutRevealed).toBe(true);
    expect(r.state.hint?.length).toBeGreaterThan(0);
    const again = applyAction(r.state, { type: 'useScout', actionId: 's2', playerId: 'p1' }, 20);
    expect(!again.ok && again.error.code).toBe('ABILITY_USED');
  });

  it('nur der Fuchs hat die Spürnase', () => {
    const { state } = solo('wurzelallee', 'mole');
    const r = applyAction(state, { type: 'useScout', actionId: 's1', playerId: 'p1' }, 10);
    expect(!r.ok && r.error.code).toBe('NOT_ALLOWED');
  });
});

describe('Szenario E – doppelte Aktion', () => {
  it('verbucht dieselbe actionId nur einmal', () => {
    const map = getMap('tierstadt');
    const state = createGame(map, 'coop', [{ id: 'p1', name: 'A', animal: 'fox' }], 0);
    const cells = route('1,6 1,5 2,5 2,4 2,3 3,3 4,3 5,3 5,2 5,1');
    const first = build(state, cells);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = build(first.state, cells);
    expect(second.ok && second.duplicate).toBe(true);
    expect(second.ok && second.state.budget).toBe(first.state.budget);
    const fresh = build(first.state, cells, { actionId: 'other' });
    expect(fresh.ok).toBe(false);
  });
});

describe('Szenario F – Rundenende', () => {
  it('beendet die Runde bei Zeitablauf als Niederlage mit Auswertung', () => {
    const { state } = solo('erstes-haus');
    const r = applyAction(state, { type: 'tick' }, state.endsAt + 1);
    expect(r.ok && r.state.status).toBe('lost');
    expect(r.ok && r.state.lossReason).toBe('time');
    expect(r.ok && r.state.result?.stars).toBe(0);
  });

  it('erkennt, wenn das Budget nicht mehr reicht', () => {
    const map = getMap('tierstadt');
    let state = createGame(map, 'coop', [{ id: 'p1', name: 'A', animal: 'badger' }], 0);
    state = { ...state, budget: 30 };
    const r = build(state, route('1,6 1,5 2,5 2,4 2,3 3,3 4,3 5,3 5,2 5,1'));
    expect(r.ok && r.state.status).toBe('lost');
    expect(r.ok && r.state.lossReason).toBe('budget');
  });

  it('pausiert im Solo-Spiel und verschiebt das Zeitlimit', () => {
    const { state } = solo('erstes-haus');
    const paused = applyAction(state, { type: 'pause' }, 1000);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(build(paused.state).ok).toBe(false);
    const resumed = applyAction(paused.state, { type: 'resume' }, 6000);
    expect(resumed.ok && resumed.state.endsAt).toBe(state.endsAt + 5000);
  });
});
