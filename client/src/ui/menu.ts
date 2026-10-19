import { ANIMALS, ANIMAL_IDS, MAPS, formatPoints, type AnimalId } from '@fuf/shared';
import { animalSvg } from './animalArt';
import { $, app, escapeHtml, resetScroll } from './dom';
import { showImprint, showPrivacy } from './legal';
import { cleanName, saveSettings, type Settings } from './settings';

export interface MenuActions {
  solo(): void;
  createRoom(): void;
  joinRoom(): void;
  animals(): void;
  settings(): void;
}

export function showMenu(actions: MenuActions): void {
  resetScroll();
  app.innerHTML = `
    <section class="hero">
      <div class="logo">Fuchs <span class="amp">&amp;</span> <span class="fiber">Faser</span></div>
      <p class="tagline">Plane die Glasfaser-Route vom Verteiler bis zum Hausanschluss – allein oder im Team.</p>
      <div class="hero-stage" aria-hidden="true">
        <svg class="hero-fiber" viewBox="0 0 800 60" preserveAspectRatio="none">
          <path d="M0 40 C120 10 220 52 360 34 S620 12 800 36" stroke="#ffb347" stroke-opacity="0.35" stroke-width="22" fill="none" stroke-linecap="round"/>
          <path d="M0 40 C120 10 220 52 360 34 S620 12 800 36" stroke="#9c3f0b" stroke-width="11" fill="none" stroke-linecap="round"/>
          <path d="M0 40 C120 10 220 52 360 34 S620 12 800 36" stroke="#ff8a1f" stroke-width="7" fill="none" stroke-linecap="round"/>
          <path d="M0 38 C120 8 220 50 360 32 S620 10 800 34" stroke="#ffe2bf" stroke-width="2" fill="none" stroke-linecap="round"/>
        </svg>
        <div class="hero-animals">${ANIMAL_IDS.map((id) => animalSvg(id, ANIMALS[id].name)).join('')}</div>
      </div>
    </section>
    <nav class="menu" aria-label="Hauptmenü">
      <button class="btn primary" data-act="solo" data-testid="menu-play">Spielen</button>
      <button class="btn" data-act="createRoom" data-testid="menu-create">Multiplayer erstellen</button>
      <button class="btn" data-act="joinRoom" data-testid="menu-join">Multiplayer beitreten</button>
      <button class="btn" data-act="animals">Tiere kennenlernen</button>
      <button class="btn" data-act="settings">Einstellungen</button>
    </nav>
    <p class="muted footnote">Keine Anmeldung nötig. Kosten und Regeln sind spielerisch vereinfacht.</p>
    <footer class="legal-links">
      <button class="link" id="imprint" data-testid="imprint">Impressum</button>
      <span aria-hidden="true">·</span>
      <button class="link" id="privacy" data-testid="privacy">Datenschutz</button>
    </footer>`;
  app.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((btn) => {
    btn.onclick = () => actions[btn.dataset.act as keyof MenuActions]();
  });
  $('#imprint').onclick = showImprint;
  $('#privacy').onclick = showPrivacy;
}

function head(title: string, onBack: () => void): string {
  resetScroll();
  queueMicrotask(() => ($('#back') as HTMLButtonElement).addEventListener('click', onBack));
  return `<div class="screen-head"><button class="btn small" id="back">← Zurück</button><h2>${title}</h2></div>`;
}

export function animalCards(selected: AnimalId | null, taken: AnimalId[] = []): string {
  return ANIMAL_IDS.map((id) => {
    const a = ANIMALS[id];
    const isTaken = taken.includes(id) && id !== selected;
    return `<button class="card animal-card" data-animal="${id}" data-testid="animal-${id}" aria-pressed="${id === selected}" ${isTaken ? 'disabled' : ''}>
      ${animalSvg(id, a.name)}
      <span><h3>${a.name}${isTaken ? ' (vergeben)' : ''}</h3>
      <span class="meta">${a.role}</span><br/>
      <span class="ability">${a.abilityName}</span> – <span class="meta">${a.abilityText}</span></span>
    </button>`;
  }).join('');
}

export function mapCards(selected: string): string {
  return MAPS.map(
    (m, i) => `<button class="card" data-map="${m.id}" data-testid="map-${m.id}" aria-pressed="${m.id === selected}">
      <h3>${i + 1}. ${escapeHtml(m.name)}</h3>
      <span class="meta">${escapeHtml(m.description)}</span>
      <span class="meta">${m.buildings.length} ${m.buildings.length === 1 ? 'Gebäude' : 'Gebäude'} · Budget ${formatPoints(m.budget)} · ${Math.round(m.timeLimitSec / 60)} min</span>
    </button>`,
  ).join('');
}

export function showSoloSetup(
  settings: Settings,
  initial: { mapId: string; animal: AnimalId },
  onStart: (mapId: string, animal: AnimalId) => void,
  onBack: () => void,
): void {
  let mapId = initial.mapId;
  let animal = initial.animal;
  const render = () => {
    const y = window.scrollY;
    app.innerHTML = `
      ${head('Anschluss-Challenge', onBack)}
      <div class="section-label">1. Karte wählen</div>
      <div class="grid-cards" id="maps">${mapCards(mapId)}</div>
      <div class="section-label">2. Tier wählen</div>
      <div class="grid-cards" id="animals">${animalCards(animal)}</div>
      <div class="row" style="margin-top:20px">
        <button class="btn primary" id="start" data-testid="start-solo">Auftrag starten</button>
        <span class="muted">Spielt als ${escapeHtml(settings.name || 'Gast')}</span>
      </div>`;
    app.querySelectorAll<HTMLElement>('[data-map]').forEach((el) => {
      el.onclick = () => {
        mapId = el.dataset.map!;
        render();
      };
    });
    app.querySelectorAll<HTMLElement>('[data-animal]').forEach((el) => {
      el.onclick = () => {
        animal = el.dataset.animal as AnimalId;
        render();
      };
    });
    $('#start').onclick = () => onStart(mapId, animal);
    window.scrollTo(0, y);
  };
  resetScroll();
  render();
}

export function showAnimals(onBack: () => void): void {
  app.innerHTML = `
    ${head('Die vier Netzbau-Profis', onBack)}
    <p class="muted">Jedes Tier hat eine Spezialfähigkeit, die es einmal pro Runde einsetzen kann. Keine ist immer die beste – jede Karte hat mehrere sinnvolle Wege.</p>
    <div class="grid-cards">${ANIMAL_IDS.map((id) => {
      const a = ANIMALS[id];
      return `<div class="card animal-card" style="cursor:default">${animalSvg(id, a.name)}<span>
        <h3>${a.name} – ${a.role}</h3><span class="ability">${a.abilityName}</span>
        <p style="margin:4px 0">${a.abilityText}</p><span class="meta">${a.character}</span></span></div>`;
    }).join('')}</div>`;
}

export function showSettings(settings: Settings, onBack: () => void): void {
  app.innerHTML = `
    ${head('Einstellungen', onBack)}
    <div class="panel" style="display:grid;gap:16px;max-width:520px">
      <label class="field">Spielername
        <input type="text" id="name" maxlength="16" value="${escapeHtml(settings.name)}" placeholder="z. B. Flinke Füchsin" />
      </label>
      <label class="check"><input type="checkbox" id="tips" ${settings.showTips ? 'checked' : ''}/> Tipps im Spiel anzeigen</label>
      <label class="check"><input type="checkbox" id="motion" ${settings.reduceMotion ? 'checked' : ''}/> Animationen reduzieren</label>
      <div><button class="btn primary" id="save">Speichern</button></div>
    </div>`;
  $('#save').onclick = () => {
    settings.name = cleanName(($('#name') as HTMLInputElement).value);
    settings.showTips = ($('#tips') as HTMLInputElement).checked;
    settings.reduceMotion = ($('#motion') as HTMLInputElement).checked;
    saveSettings(settings);
    onBack();
  };
}
