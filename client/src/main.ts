import '@fontsource-variable/nunito';
import './style.css';
import { MAPS, type AnimalId } from '@fuf/shared';
import { LocalController } from './controller/GameController';
import { toast } from './ui/dom';
import { mountGameScreen, type MountedGame } from './ui/gameScreen';
import { showAnimals, showMenu, showSettings, showSoloSetup } from './ui/menu';
import { applySettings, loadSettings } from './ui/settings';
import { startMultiplayer } from './ui/lobby';

// Schrift früh laden, damit auch die Beschriftungen im Spielfeld (Canvas) sie verwenden
void document.fonts?.load('800 16px "Nunito Variable"').catch(() => undefined);

const settings = loadSettings();
applySettings(settings);

let current: MountedGame | null = null;
let lastSolo = { mapId: MAPS[0].id, animal: 'fox' as AnimalId };

function leaveGame(): void {
  current?.destroy();
  current = null;
}

function menu(): void {
  leaveGame();
  history.replaceState(null, '', location.pathname);
  showMenu({
    solo: soloSetup,
    createRoom: () => startMultiplayer(settings, 'create', menu),
    joinRoom: () => startMultiplayer(settings, 'join', menu),
    animals: () => showAnimals(menu),
    settings: () => showSettings(settings, menu),
  });
}

function soloSetup(): void {
  leaveGame();
  showSoloSetup(settings, lastSolo, startSolo, menu);
}

function startSolo(mapId: string, animal: AnimalId): void {
  leaveGame();
  lastSolo = { mapId, animal };
  const controller = new LocalController(mapId, animal, settings.name || 'Gast');
  const index = MAPS.findIndex((m) => m.id === mapId);
  const next = MAPS[index + 1];
  current = mountGameScreen(controller, {
    settings,
    onLeave: menu,
    resultActions: [
      ...(next ? [{ label: `Nächste Karte: ${next.name}`, primary: true, run: () => startSolo(next.id, animal) }] : []),
      { label: 'Nochmal', primary: !next, run: () => startSolo(mapId, animal) },
      { label: 'Andere Karte / Tier', run: soloSetup },
      { label: 'Hauptmenü', run: menu },
    ],
  });
}

const roomFromLink = new URLSearchParams(location.search).get('room');
if (roomFromLink) {
  startMultiplayer(settings, 'join', menu, roomFromLink);
} else {
  menu();
}

window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  toast('Unerwarteter Fehler – bitte erneut versuchen.', 'error');
});
