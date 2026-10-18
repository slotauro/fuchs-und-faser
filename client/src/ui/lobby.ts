import {
  ANIMALS,
  MIN_PLAYERS,
  getMap,
  type Ack,
  type AnimalId,
  type GameStatePayload,
  type JoinedPayload,
  type LobbyState,
} from '@fuf/shared';
import { NetworkController } from '../controller/NetworkController';
import { connect, loadSession, request, saveSession, type GameSocket } from '../net/NetworkGateway';
import { animalSvg } from './animalArt';
import { $, app, escapeHtml, resetScroll, setConnectionBanner, toast } from './dom';
import { mountGameScreen, type MountedGame } from './gameScreen';
import { animalCards, mapCards } from './menu';
import { cleanName, saveSettings, type Settings } from './settings';

/**
 * Multiplayer-Ablauf: Name/Code eingeben → Lobby → gemeinsame Runde → Ergebnis → Lobby.
 */
export function startMultiplayer(
  settings: Settings,
  mode: 'create' | 'join',
  onExit: () => void,
  presetCode?: string,
): void {
  let socket: GameSocket | null = null;
  let playerId = '';
  let lobby: LobbyState | null = null;
  let game: MountedGame | null = null;
  let currentGameStart = 0;
  let closed = false;
  let animal: AnimalId = 'fox';

  const exit = () => {
    closed = true;
    game?.destroy();
    game = null;
    if (socket) {
      socket.emit('room:leave');
      socket.disconnect();
    }
    // Sitzung bleibt erhalten: In einer laufenden Runde kann man per Link/Code zurückkehren.
    setConnectionBanner(null);
    onExit();
  };

  function ensureSocket(): GameSocket {
    if (socket) return socket;
    const s = connect();
    socket = s;
    let everConnected = false;
    s.on('connect', () => {
      setConnectionBanner(null);
      if (everConnected) void rejoin(true);
      everConnected = true;
    });
    s.on('disconnect', () => {
      if (!closed) setConnectionBanner('Verbindung verloren – versuche erneut zu verbinden …');
    });
    s.on('connect_error', () => {
      if (!closed) setConnectionBanner('Server nicht erreichbar – versuche erneut zu verbinden …');
    });
    s.on('error:rate', () => toast('Zu viele Aktionen – bitte kurz warten.', 'error'));
    s.on('lobby:state', (state) => {
      lobby = state;
      if (!game) renderLobby();
    });
    s.on('game:state', (payload) => {
      // Neue Runde (auch wenn man noch das alte Ergebnis ansieht).
      if (lobby && (!game || payload.state.startedAt !== currentGameStart)) startGame(payload);
    });
    return s;
  }

  function entered(result: JoinedPayload): void {
    playerId = result.playerId;
    lobby = result.lobby;
    saveSession({ code: result.lobby.code, token: result.token });
    history.replaceState(null, '', `?room=${result.lobby.code}`);
    resetScroll();
    if (result.game && result.lobby.phase === 'playing') startGame(result.game);
    else renderLobby();
  }

  async function rejoin(silent: boolean): Promise<boolean> {
    const session = loadSession();
    if (!session || !socket) return false;
    try {
      const result = await request<Ack<JoinedPayload>>((ack) => socket!.emit('room:rejoin', session, ack));
      if (!result.ok) {
        if (!silent) return false;
        toast(result.error.message, 'error');
        saveSession(null);
        exit();
        return false;
      }
      // Laufendes Spiel behalten, sonst neu aufbauen.
      if (game) {
        playerId = result.playerId;
        lobby = result.lobby;
        if (result.lobby.phase !== 'playing') {
          game.destroy();
          game = null;
          renderLobby();
        }
      } else {
        entered(result);
      }
      if (silent) toast('Wieder verbunden.', 'ok');
      return true;
    } catch {
      return false;
    }
  }

  function startGame(payload: GameStatePayload): void {
    game?.destroy();
    currentGameStart = payload.state.startedAt;
    const controller = new NetworkController(ensureSocket(), playerId, payload);
    game = mountGameScreen(controller, {
      settings,
      onLeave: exit,
      extraInfo: `<p class="muted" style="margin:8px 0 0">Raum <strong>${lobby?.code}</strong> · gemeinsames Budget</p>`,
      resultActions: [
        {
          label: 'Zur Lobby',
          primary: true,
          run: () => {
            game?.destroy();
            game = null;
            socket?.emit('lobby:return');
            renderLobby();
            resetScroll();
          },
        },
        { label: 'Hauptmenü', run: exit },
      ],
    });
  }

  function renderEntry(): void {
    const session = loadSession();
    app.innerHTML = `
      <div class="screen-head"><button class="btn small" id="back">← Zurück</button>
        <h2>${mode === 'create' ? 'Multiplayer-Raum erstellen' : 'Multiplayer beitreten'}</h2></div>
      <div class="panel" style="display:grid;gap:16px;max-width:560px">
        <p class="muted" style="margin:0">Gemeinsam ans Netz: 2–4 Spieler verbinden zusammen alle Gebäude, bevor die Zeit abläuft. Ihr teilt euch ein Budget.</p>
        <label class="field">Dein Name
          <input type="text" id="name" maxlength="16" value="${escapeHtml(settings.name)}" placeholder="z. B. Buddelbert" data-testid="mp-name" />
        </label>
        ${mode === 'join' ? `<label class="field">Raumcode
          <input type="text" id="code" class="code" maxlength="6" value="${escapeHtml(presetCode ?? '')}" placeholder="ABC123" autocomplete="off" data-testid="mp-code" />
        </label>` : `<div class="section-label" style="margin:0">Dein Tier</div><div class="grid-cards" id="animals">${animalCards(animal)}</div>`}
        <div><button class="btn primary" id="go" data-testid="mp-go">${mode === 'create' ? 'Raum erstellen' : 'Beitreten'}</button></div>
      </div>`;
    $('#back').onclick = exit;
    app.querySelectorAll<HTMLElement>('[data-animal]').forEach((el) => {
      el.onclick = () => {
        settings.name = cleanName(($('#name') as HTMLInputElement).value);
        animal = el.dataset.animal as AnimalId;
        renderEntry();
      };
    });
    const go = $('#go') as HTMLButtonElement;
    go.onclick = async () => {
      const name = cleanName(($('#name') as HTMLInputElement).value);
      if (!name) {
        toast('Bitte gib einen Namen ein.', 'error');
        return;
      }
      settings.name = name;
      saveSettings(settings);
      const code = mode === 'join' ? ($('#code') as HTMLInputElement).value.trim().toUpperCase() : '';
      if (mode === 'join' && code.length !== 6) {
        toast('Der Raumcode hat 6 Zeichen.', 'error');
        return;
      }
      go.disabled = true;
      const s = ensureSocket();
      try {
        // Nach Neuladen derselben Seite: alten Platz wieder einnehmen.
        if (mode === 'join' && session?.code === code && (await rejoin(false))) return;
        const result = await request<Ack<JoinedPayload>>((ack) =>
          mode === 'create'
            ? s.emit('room:create', { name, animal }, ack)
            : s.emit('room:join', { code, name }, ack),
        );
        if (result.ok) entered(result);
        else toast(result.error.message, 'error');
      } catch {
        toast('Der Server antwortet nicht. Läuft er? (npm run dev)', 'error');
      } finally {
        go.disabled = false;
      }
    };
  }

  async function update(change: { animal?: AnimalId; ready?: boolean; mapId?: string }): Promise<void> {
    try {
      const result = await request<Ack>((ack) => socket!.emit('lobby:update', change, ack));
      if (!result.ok) toast(result.error.message, 'error');
    } catch {
      toast('Keine Antwort vom Server.', 'error');
    }
  }

  function renderLobby(): void {
    if (!lobby || game) return;
    const me = lobby.players.find((p) => p.id === playerId);
    if (!me) return;
    const isHost = me.isHost;
    const taken = lobby.players.map((p) => p.animal);
    const connected = lobby.players.filter((p) => p.connected);
    const canStart = isHost && connected.length >= MIN_PLAYERS && connected.every((p) => p.ready);
    const link = `${location.origin}${location.pathname}?room=${lobby.code}`;
    const map = getMap(lobby.mapId);

    app.innerHTML = `
      <div class="screen-head"><button class="btn small" id="leave">← Raum verlassen</button><h2>Lobby</h2></div>
      <div class="panel" style="display:grid;gap:12px;margin-bottom:12px">
        <div class="row"><span>Raumcode:</span><span class="room-code" data-testid="room-code">${lobby.code}</span>
          <button class="btn small" id="copy">Einladungslink kopieren</button></div>
        <p class="muted" style="margin:0">Teile den Code oder den Link. Bis zu 4 Spieler, jedes Tier einmal.</p>
      </div>
      <div class="lobby-grid">
        <div>
          <div class="section-label">Dein Tier</div>
          <div class="grid-cards" id="animals">${animalCards(me.animal, taken)}</div>
          <div class="section-label">Karte ${isHost ? '(du wählst als Host)' : ''}</div>
          ${isHost ? `<div class="grid-cards" id="maps">${mapCards(lobby.mapId)}</div>` : `<div class="panel"><strong>${escapeHtml(map.name)}</strong><br/><span class="muted">${escapeHtml(map.description)}</span></div>`}
        </div>
        <aside class="panel">
          <h3>Spieler (${lobby.players.length}/4)</h3>
          <ul class="player-list" data-testid="players">
            ${lobby.players.map((p) => `<li>${animalSvg(p.animal, ANIMALS[p.animal].name, 'portrait')}
              <span style="flex:1"><strong>${escapeHtml(p.name)}</strong>${p.id === playerId ? ' (du)' : ''}<br/>
              <span class="muted" style="font-size:0.85rem">${ANIMALS[p.animal].name}${p.isHost ? ' · Host' : ''}</span></span>
              ${!p.connected ? '<span class="badge off">getrennt</span>' : p.ready ? '<span class="badge ok">bereit</span>' : '<span class="badge">wartet</span>'}
            </li>`).join('')}
          </ul>
          <div style="margin-top:16px;display:grid;gap:8px">
            ${isHost
              ? `<button class="btn primary" id="start" data-testid="mp-start" ${canStart ? '' : 'disabled'}>Runde starten</button>
                 <span class="muted" style="font-size:0.9rem">${connected.length < MIN_PLAYERS ? 'Warte auf mindestens einen weiteren Spieler …' : canStart ? 'Alle bereit!' : 'Warte, bis alle bereit sind …'}</span>`
              : `<button class="btn ${me.ready ? '' : 'primary'}" id="ready" data-testid="mp-ready">${me.ready ? 'Doch nicht bereit' : 'Ich bin bereit'}</button>
                 <span class="muted" style="font-size:0.9rem">Der Host startet die Runde.</span>`}
          </div>
        </aside>
      </div>`;

    $('#leave').onclick = exit;
    $('#copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(link);
        toast('Einladungslink kopiert.', 'ok');
      } catch {
        toast(link);
      }
    };
    app.querySelectorAll<HTMLElement>('#animals [data-animal]').forEach((el) => {
      el.onclick = () => void update({ animal: el.dataset.animal as AnimalId });
    });
    app.querySelectorAll<HTMLElement>('#maps [data-map]').forEach((el) => {
      el.onclick = () => void update({ mapId: el.dataset.map });
    });
    document.getElementById('ready')?.addEventListener('click', () => void update({ ready: !me.ready }));
    document.getElementById('start')?.addEventListener('click', async () => {
      try {
        const result = await request<Ack>((ack) => socket!.emit('lobby:start', ack));
        if (!result.ok) toast(result.error.message, 'error');
      } catch {
        toast('Keine Antwort vom Server.', 'error');
      }
    });
  }

  // Direkter Wiederbeitritt nach Neuladen, wenn eine Sitzung zum Link passt.
  const session = loadSession();
  if (mode === 'join' && presetCode && session?.code === presetCode.toUpperCase()) {
    app.innerHTML = '<p class="muted">Verbinde mit Raum …</p>';
    const s = ensureSocket();
    const tryRejoin = () =>
      void rejoin(false).then((ok) => {
        if (!ok) renderEntry();
      });
    if (s.connected) tryRejoin();
    else s.once('connect', tryRejoin);
    return;
  }
  renderEntry();
}
