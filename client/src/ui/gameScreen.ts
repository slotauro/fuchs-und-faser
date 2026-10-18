import {
  ANIMALS,
  TILE_INFO,
  formatPoints,
  type AnimalId,
  type GameState,
  type TileType,
} from '@fuf/shared';
import type Phaser from 'phaser';
import type { GameController } from '../controller/GameController';
import { createBoard } from '../game/BoardScene';
import { Planner } from '../game/planner';
import { renderTileSwatch } from '../game/art/terrain';
import { distributorSvg, socketSvg, svgDataUrl } from '../game/art/svgAssets';
import { animalSvg } from './animalArt';
import { ICONS } from './icons';
import { $, app, escapeHtml, hideOverlay, resetScroll, showOverlay, toast } from './dom';
import type { Settings } from './settings';

export interface GameScreenOptions {
  settings: Settings;
  /** Buttons im Ergebnisdialog. */
  resultActions: { label: string; primary?: boolean; run: () => void }[];
  onLeave: () => void;
  extraInfo?: string;
}

const LEGEND: TileType[] = [
  'meadow', 'sidewalk', 'road', 'rock', 'roots', 'water', 'bridgeSite', 'conduit', 'foreignLine', 'distributor', 'connection',
];

const LOSS_TEXT: Record<string, string> = {
  time: 'Die Zeit ist abgelaufen.',
  budget: 'Das Budget reicht für keinen weiteren Anschluss.',
  forfeit: 'Der Auftrag wurde abgebrochen.',
};

/** Hindernis, vor dem Maulwurf und Biber ihre Fähigkeit einsetzen. */
const OBSTACLE: Record<AnimalId, { name: string; dative: string }> = {
  mole: { name: 'Wurzelzone', dative: 'einer Wurzelzone' },
  beaver: { name: 'Querungsstelle', dative: 'einer Querungsstelle am Wasser' },
  badger: { name: 'Felsen', dative: 'Felsen' },
  fox: { name: '', dative: '' },
};

const tiles = (n: number) => `${n} ${n === 1 ? 'Kachel' : 'Kacheln'}`;

function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Legendensymbol: dieselbe Grafik wie auf dem Spielfeld (Verteiler und Anschluss als Vektor-Objekt). */
function legendIcon(tile: TileType): HTMLElement {
  if (tile !== 'distributor' && tile !== 'connection') return renderTileSwatch(tile);
  const img = document.createElement('img');
  img.alt = '';
  img.src = svgDataUrl(tile === 'distributor' ? distributorSvg() : socketSvg(false));
  return img;
}

export interface MountedGame {
  destroy(): void;
}

export function mountGameScreen(controller: GameController, options: GameScreenOptions): MountedGame {
  const { map } = controller;
  const planner = new Planner(controller);
  const me = () => controller.getState().players.find((p) => p.id === controller.localPlayerId)!;
  const animal = ANIMALS[me().animal];
  let building = false;
  let resultShown = false;

  resetScroll();
  const stat = (id: string, icon: string, label: string, testid: string, extra = '') =>
    `<div class="stat" id="${id}">${icon}<div class="stat-body"><span class="k">${label}</span><span class="v" data-testid="${testid}"></span>${extra}</div></div>`;
  app.innerHTML = `
    <div class="game" data-testid="game">
      <div class="hud" aria-label="Status">
        <div class="stat map-name">${ICONS.map}<div class="stat-body"><span class="k">Auftrag</span><span class="v">${escapeHtml(map.name)}</span></div></div>
        ${stat('stat-budget', ICONS.coin, 'Budget', 'budget', '<span class="meter" aria-hidden="true"><i class="rest" id="meter-rest"></i><i class="plan" id="meter-plan"></i></span>')}
        ${stat('stat-planned', ICONS.route, 'Geplant', 'planned')}
        ${stat('stat-length', ICONS.cable, 'Verlegt', 'length')}
        ${stat('stat-connected', ICONS.house, 'Angeschlossen', 'connected')}
        ${stat('stat-time', ICONS.clock, 'Zeit', 'time')}
      </div>
      <div class="main-col">
        <div class="board-wrap"><div id="board" data-testid="board" data-cols="${map.width}" data-rows="${map.height}"></div></div>
        <div class="dock">
          <div class="plan-info" id="plan-info" role="status" aria-live="polite"><span class="plan-dot" aria-hidden="true"></span><span class="msg" data-testid="plan-msg"></span>
            <button class="btn ghost" id="btn-pause">${controller.canPause ? ICONS.pause : ICONS.exit}<span>${controller.canPause ? 'Pause' : 'Verlassen'}</span></button></div>
          <div class="actions">
            <button class="btn primary" id="btn-build" data-testid="build" title="Taste B oder Enter">${ICONS.build}<span>Route bauen</span><kbd>B</kbd></button>
            <button class="btn" id="btn-undo" title="Rechtsklick oder Rücktaste">${ICONS.undo}<span>Rückgängig</span><kbd>⌫</kbd></button>
            <button class="btn" id="btn-clear" title="Escape">${ICONS.clear}<span>Planung verwerfen</span><kbd>Esc</kbd></button>
            <button class="btn ability-btn ability-${animal.id}" id="btn-ability" data-testid="ability" title="Taste F"><span class="ability-ico">${animalSvg(animal.id, undefined, 'portrait')}</span><span id="ability-label"></span><kbd>F</kbd></button>
          </div>
        </div>
      </div>
      <aside class="side">
        <div class="panel animal-panel ability-${animal.id}">
          <div class="animal-stage">${animalSvg(animal.id, animal.name)}</div>
          <div>
            <span class="eyebrow">Dein Tier</span>
            <h3>${animal.name}</h3>
            <p class="ability-name">${animal.abilityName}</p>
            <p class="muted small">${animal.abilityText}</p>
            <span class="chip" id="ability-status"></span>
          </div>
        </div>
        ${controller.getState().mode === 'coop' ? `<div class="panel"><h3>Team</h3><ul class="team" id="team"></ul>${options.extraInfo ?? ''}</div>` : ''}
        ${options.settings.showTips ? `<details class="panel tips" open><summary><h3>${ICONS.bulb} Tipps</h3></summary><ul>${map.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></details>` : ''}
        <details class="panel" open><summary><h3>Legende</h3></summary><ul class="legend" id="legend"></ul></details>
        <div class="panel controls"><h3>${ICONS.keys} Steuerung</h3>
          <ul>
            <li><span><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd></span> Tier bewegen, Leitung legen</li>
            <li><span><kbd>B</kbd><kbd>Enter</kbd></span> Route bauen</li>
            <li><span><kbd>⌫</kbd></span> letztes Feld zurück</li>
            <li><span><kbd>F</kbd></span> Fähigkeit</li>
            <li><span><kbd>Esc</kbd></span> verwerfen / Pause</li>
            <li class="muted">Maus: klicken oder ziehen, Rechtsklick nimmt zurück</li>
          </ul>
        </div>
      </aside>
    </div>`;

  const legend = $('#legend');
  for (const tile of LEGEND) {
    const li = document.createElement('li');
    li.appendChild(legendIcon(tile));
    const info = TILE_INFO[tile];
    const cost = info.cost === null ? 'gesperrt' : `${formatPoints(info.cost)} P`;
    const label = document.createElement('span');
    label.innerHTML = `${info.label}<small class="${info.cost === null && tile !== 'distributor' && tile !== 'connection' ? 'blocked' : ''}">${tile === 'connection' ? '3 P pauschal' : tile === 'distributor' ? 'Start' : cost}</small>`;
    li.appendChild(label);
    legend.appendChild(li);
  }

  const game: Phaser.Game = createBoard($('#board'), controller, planner, {
    onHint: (msg) => toast(msg),
    reduceMotion: options.settings.reduceMotion,
  });

  const buildBtn = $('#btn-build') as HTMLButtonElement;
  const abilityBtn = $('#btn-ability') as HTMLButtonElement;

  function renderHud(state: GameState): void {
    const analysis = planner.analysis();
    $('[data-testid="budget"]').textContent = `${formatPoints(state.budget)} / ${formatPoints(state.startBudget)}`;
    $('#stat-budget').classList.toggle('warn', state.budget < state.startBudget * 0.2);
    $('[data-testid="planned"]').textContent = planner.cells.length ? formatPoints(analysis.cost) : '–';
    const planned = planner.cells.length ? analysis.cost : 0;
    const share = (v: number) => `${Math.max(0, Math.min(100, (v / state.startBudget) * 100))}%`;
    $('#meter-rest').style.width = share(state.budget - Math.min(planned, state.budget));
    $('#meter-plan').style.width = share(Math.min(planned, state.budget));
    $('#stat-planned').classList.toggle('warn', planned > state.budget);
    $('#stat-planned').classList.toggle('active', planned > 0 && planned <= state.budget);
    $('[data-testid="length"]').textContent = tiles(state.builtCells.length);
    $('[data-testid="connected"]').textContent = `${state.connected.length} / ${map.buildings.length}`;

    const player = me();
    const playing = state.status === 'playing';
    buildBtn.disabled = !playing || building || planner.cells.length === 0 || state.pausedAt !== null;
    ($('#btn-undo') as HTMLButtonElement).disabled = !playing || planner.cells.length === 0;
    ($('#btn-clear') as HTMLButtonElement).disabled = !playing || planner.cells.length === 0;

    // Maulwurf und Biber nur direkt vor ihrem Hindernis, der Dachs wirkt ganz ohne Knopf
    const canArm = planner.canArm;
    abilityBtn.disabled =
      !playing ||
      player.abilityUsed ||
      state.pausedAt !== null ||
      animal.kind === 'passive' ||
      (animal.kind === 'route' && !planner.abilityArmed && !canArm);
    abilityBtn.classList.toggle('armed', planner.abilityArmed);
    abilityBtn.classList.toggle('ready', canArm && !planner.abilityArmed);
    $('#ability-label').textContent = player.abilityUsed
      ? `${animal.abilityName} (verbraucht)`
      : animal.kind === 'instant'
        ? `${animal.abilityName} einsetzen`
        : animal.kind === 'passive'
          ? `${animal.abilityName} (automatisch)`
          : planner.abilityArmed
            ? `${animal.abilityName}: scharf ✓`
            : `${animal.abilityName} scharf schalten`;
    abilityBtn.setAttribute('aria-pressed', String(planner.abilityArmed));
    const status = $('#ability-status');
    status.textContent = player.abilityUsed
      ? 'Bereits eingesetzt'
      : planner.abilityArmed
        ? 'Scharf – wirkt in dieser Planung'
        : animal.kind === 'passive'
          ? 'Wirkt automatisch auf Felsen · 1× pro Runde'
          : animal.kind === 'route'
            ? `Direkt vor ${OBSTACLE[animal.id].dative} einsetzbar · 1× pro Runde`
            : 'Verfügbar · 1× pro Runde';
    status.className = `chip ${player.abilityUsed ? 'used' : planner.abilityArmed ? 'armed' : 'ok'}`;

    const info = $('#plan-info');
    const msg = $('[data-testid="plan-msg"]');
    const error = planner.rejected ?? analysis.error;
    info.classList.toggle('error', !!error && planner.cells.length > 0);
    info.classList.toggle('ready', !error && analysis.complete);
    if (!playing) msg.textContent = 'Runde beendet.';
    else if (state.pausedAt !== null) msg.textContent = 'Pausiert.';
    else if (planner.cells.length === 0) {
      msg.textContent = state.routes.length
        ? 'Plane die nächste Route – sie kann an jeder gebauten Leitung abzweigen.'
        : 'Lauf mit den Pfeiltasten los (oder klicke auf ein Feld neben dem Netzverteiler) – dein Tier legt die Leitung.';
    } else if (error) {
      msg.textContent = `⚠ ${error.message}${canArm && !planner.abilityArmed ? ` – Taste F: ${animal.abilityName}` : ''}`;
    } else if (canArm && !planner.abilityArmed) {
      msg.textContent = `${OBSTACLE[animal.id].name} voraus – drücke F für ${animal.abilityName}.`;
    } else if (analysis.complete) {
      const b = map.buildings.find((x) => x.id === analysis.buildingId);
      msg.textContent = `✓ Route zu ${b?.name} kostet ${formatPoints(analysis.cost)} Punkte${analysis.abilityApplied ? ` (mit ${animal.abilityName})` : ''}. Jetzt bauen!`;
    } else {
      msg.textContent = `${tiles(planner.cells.length)}, bisher ${formatPoints(analysis.cost)} Punkte – weiter bis zu einem Hausanschluss (gelb).`;
    }

    const team = document.getElementById('team');
    if (team) {
      team.innerHTML = state.players
        .map(
          (p) => `<li>${animalSvg(p.animal, ANIMALS[p.animal].name, 'portrait')} <span>${escapeHtml(p.name)}${p.id === controller.localPlayerId ? ' (du)' : ''}</span>
          <span class="badge ${p.abilityUsed ? '' : 'ok'}">${p.abilityUsed ? 'Fähigkeit genutzt' : 'Fähigkeit bereit'}</span></li>`,
        )
        .join('');
    }
    renderTime(state);
    if (state.status !== 'playing' && !resultShown) showResult(state);
  }

  function renderTime(state: GameState): void {
    const remaining = state.status !== 'playing'
      ? state.endsAt - (state.finishedAt ?? state.endsAt)
      : state.endsAt - (state.pausedAt ?? controller.now());
    $('[data-testid="time"]').textContent = state.pausedAt !== null ? `${formatTime(remaining)} ⏸` : formatTime(remaining);
    $('#stat-time').classList.toggle('warn', state.status === 'playing' && remaining < 30_000);
  }

  function showResult(state: GameState): void {
    resultShown = true;
    const result = state.result!;
    const won = state.status === 'won';
    const stars = [1, 2, 3].map((i) => `<span class="${i <= result.stars ? 'on' : 'off'}">★</span>`).join('');
    const el = showOverlay(`
      <div data-testid="result">
        <div class="result-title ${won ? 'won' : 'lost'}">${won ? 'Alle Gebäude sind am Netz!' : 'Auftrag nicht geschafft'}</div>
        <p class="muted">${won ? `${escapeHtml(map.name)} erfolgreich angeschlossen.` : LOSS_TEXT[state.lossReason ?? 'forfeit']}</p>
        <div class="stars" aria-label="${result.stars} von 3 Sternen">${stars}</div>
        <table class="score-table">
          ${result.lines.map((l) => `<tr><td>${l.label}<span class="detail">${escapeHtml(l.detail)}</span></td><td class="pts">${l.points} / ${l.max}</td></tr>`).join('')}
          <tr class="total"><td>Gesamt</td><td class="pts" data-testid="score">${result.total} / 100</td></tr>
        </table>
        <p class="muted" style="font-size:0.9rem">Verbaut: ${formatPoints(state.spent)} Punkte · Budget übrig: ${formatPoints(state.budget)} · ★★ ab ≤ ${formatPoints(map.stars.two)}, ★★★ ab ≤ ${formatPoints(map.stars.three)} Punkten</p>
        <div class="row" id="result-actions"></div>
      </div>`);
    const actions = $('#result-actions', el);
    for (const action of options.resultActions) {
      const btn = document.createElement('button');
      btn.className = `btn${action.primary ? ' primary' : ''}`;
      btn.textContent = action.label;
      btn.onclick = () => {
        hideOverlay();
        action.run();
      };
      actions.appendChild(btn);
    }
    (actions.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  async function build(): Promise<void> {
    if (building || planner.cells.length === 0) return;
    building = true;
    renderHud(controller.getState());
    const result = await controller.buildRoute(planner.cells, planner.abilityArmed);
    building = false;
    if (result.ok) {
      planner.finishBuild();
    } else if (result.error) {
      planner.reject(result.error);
      toast(result.error.message, 'error');
    }
    renderHud(controller.getState());
  }

  async function ability(): Promise<void> {
    if (me().abilityUsed) return;
    if (animal.kind === 'instant') {
      const result = await controller.useScout();
      if (result.ok) toast('Spürnase: Hinweis und verborgene Leerrohre sind sichtbar.', 'ok');
      else if (result.error) toast(result.error.message, 'error');
    } else if (animal.kind === 'passive') {
      toast(`${animal.abilityName} wirkt automatisch, sobald deine Route über Felsen führt.`);
    } else if (!planner.setArmed(!planner.abilityArmed)) {
      toast(`${animal.abilityName} geht nur direkt vor ${OBSTACLE[animal.id].dative}.`);
    }
  }

  function pauseOrLeave(): void {
    if (controller.getState().status !== 'playing') {
      options.onLeave();
      return;
    }
    if (controller.canPause) controller.pause();
    const el = showOverlay(`
      <h2>${controller.canPause ? 'Pause' : 'Runde verlassen?'}</h2>
      <p class="muted">${controller.canPause ? 'Die Zeit ist angehalten.' : 'Dein Team spielt weiter. Du kannst über den Raumcode wieder beitreten.'}</p>
      <div class="row">
        <button class="btn primary" id="p-continue">Weiterspielen</button>
        ${controller.canPause ? '<button class="btn" id="p-forfeit">Auftrag aufgeben</button>' : ''}
        <button class="btn" id="p-leave">Zum Hauptmenü</button>
      </div>`);
    $('#p-continue', el).onclick = () => {
      hideOverlay();
      controller.resume();
    };
    el.querySelector<HTMLElement>('#p-forfeit')?.addEventListener('click', () => {
      hideOverlay();
      controller.resume();
      void controller.forfeit();
    });
    $('#p-leave', el).onclick = () => {
      hideOverlay();
      options.onLeave();
    };
  }

  buildBtn.onclick = () => void build();
  abilityBtn.onclick = () => void ability();
  $('#btn-undo').onclick = () => planner.undo();
  $('#btn-clear').onclick = () => planner.clear();
  $('#btn-pause').onclick = pauseOrLeave;

  const ARROWS: Record<string, [number, number]> = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    const overlayOpen = !document.getElementById('overlay')!.hidden;
    if (e.key === 'Escape') {
      if (overlayOpen) {
        if (controller.getState().status === 'playing') {
          hideOverlay();
          controller.resume();
        }
      } else if (planner.cells.length) planner.clear();
      else pauseOrLeave();
      return;
    }
    if (overlayOpen) return;
    const step = ARROWS[e.key];
    if (step) {
      e.preventDefault();
      const state = controller.getState();
      if (state.status !== 'playing' || state.pausedAt !== null) return;
      const message = planner.step(step[0], step[1]);
      if (message) toast(message);
      return;
    }
    if (e.key === 'Enter' || e.key.toLowerCase() === 'b') {
      if (e.key === 'Enter' && e.target instanceof HTMLButtonElement) return; // fokussierter Button behält Enter
      // verhindert, dass dasselbe Enter den danach fokussierten Ergebnis-Button auslöst
      e.preventDefault();
      void build();
    }
    else if (e.key === 'Backspace' || e.key.toLowerCase() === 'z') planner.undo();
    else if (e.key.toLowerCase() === 'f') void ability();
  };
  window.addEventListener('keydown', onKey);

  const unsubState = controller.subscribe((state, events) => {
    for (const event of events) {
      if (event.type === 'buildingConnected') {
        const b = map.buildings.find((x) => x.id === event.buildingId);
        const who = state.players.find((p) => p.id === event.playerId);
        const by = state.mode === 'coop' && who ? ` (${who.name})` : '';
        toast(`${b?.name} ist angeschlossen!${by}`, 'ok');
      }
    }
    renderHud(state);
  });
  const unsubPlan = planner.onChange(() => renderHud(controller.getState()));
  const clock = window.setInterval(() => renderTime(controller.getState()), 250);
  renderHud(controller.getState());

  return {
    destroy() {
      window.removeEventListener('keydown', onKey);
      window.clearInterval(clock);
      unsubState();
      unsubPlan();
      game.destroy(true);
      controller.dispose();
      hideOverlay();
    },
  };
}
