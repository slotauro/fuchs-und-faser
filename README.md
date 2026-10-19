# Fuchs & Faser

Ein kleines Browser-Strategiespiel über Glasfaserausbau: Plane eine Route vom Netzverteiler bis zum Hausanschluss, umgehe Hindernisse, bleib im Budget – allein oder kooperativ mit 2–4 Spielern online.

## Schnellstart

Voraussetzung: Node.js 20+ und npm.

```bash
npm install
npm run dev
```

Danach `http://localhost:5173` öffnen. `npm run dev` startet Client (Vite, Port 5173) und Multiplayer-Server (Port 3001) gemeinsam; der Client leitet `/socket.io` an den Server weiter. Für den Singleplayer wird der Server nicht benötigt.

Zum Multiplayer-Testen ein zweites Browserfenster (oder privates Fenster) öffnen und über Raumcode oder Einladungslink beitreten.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklung: Client + Server mit Hot Reload |
| `npm test` | Unit- und Integrationstests (Vitest) |
| `npm run test:e2e` | Browsertests (Playwright, startet `npm run dev` bei Bedarf) |
| `npm run typecheck` | TypeScript-Prüfung aller Pakete |
| `npm run build` | Client für den Produktivbetrieb bauen |
| `npm start` | Produktivserver: liefert Client und Socket.IO auf einem Port aus (`PORT`, Standard 3001) |

Vor dem ersten E2E-Lauf einmalig: `npx playwright install chromium`.

## Spielen

1. Dein Tier steht als Figur am Netzverteiler. Mit den **Pfeiltasten** läuft es los und legt hinter sich die Leitung. Alternativ Felder anklicken oder ziehen.
2. Weiterlaufen, bis die Route auf einem gelben Hausanschluss endet. Ein Schritt zurück nimmt das letzte Feld wieder weg.
3. **Route bauen** (oder `B`/`Enter`). Ungültige Routen werden mit Grund und markierter Stelle abgelehnt.
4. Die Fähigkeit des Tiers nutzen: Der Fuchs setzt seine Spürnase jederzeit mit `F` ein. Maulwurf, Biber und Dachs wirken automatisch, sobald die Route durch Wurzeln, über eine Querungsstelle bzw. über Felsen führt.

Nach dem Bau bleibt die Figur am Hausanschluss stehen und kann über gebaute Leitungen zu einem Abzweig laufen. Mitspieler sieht man als Figur am Ende ihrer geplanten Route.

Steuerung: Pfeiltasten bewegen die Figur, Rechtsklick oder `Rücktaste` entfernt das letzte Feld, `Esc` verwirft die Planung bzw. öffnet die Pause.

## Projektstruktur

```
shared/   Reine Spielregeln (TypeScript, ohne DOM): Kosten, Routenprüfung,
          Fähigkeiten, Wegfindung, Reducer, Wertung, Karten, Protokolltypen
client/   Vite + Phaser 3 (Spielfeld) + HTML/CSS (Menüs, HUD, Lobby)
          game/art     prozedurale Grafik: Gelände (Canvas), Häuser/Objekte (SVG)
          game/layers  Zeichenebenen: Gelände, Glasfaser, Planung, Figuren
server/   Node.js + Socket.IO: Räume, maßgeblicher Spielzustand, Validierung
e2e/      Playwright-Tests der Szenarien A–F aus dem PRD
docs/     Designentscheidungen
```

Client und Server rufen denselben Reducer `applyAction` aus `shared/src/gameReducer.ts` auf. Im Singleplayer läuft er im Browser (`LocalController`), im Multiplayer nur auf dem Server (`NetworkController` schlägt Aktionen vor und zeigt den Serverzustand an).

## Tests

- `client/test`: Gebäudegruppierung, Dekoration nur im Randbereich, deterministische Weltgenerierung.
- `shared/test`: Kostenmodell, Routenvalidierung, alle vier Fähigkeiten, Wertung, Zeitablauf, Budget-Niederlage, Lösbarkeit und Routenvielfalt jeder Karte.
- `server/test`: Raumcodes, Raumgröße, Startbedingungen, doppelte Nachrichten, ungültige Aktionen, Wiederbeitritt, Aufräumen, Rate-Limit sowie ein echter Socket.IO-Durchlauf mit zwei Clients.
- `e2e`: Szenario A (Singleplayer), B (ungültige Route), C (Maulwurfstunnel), D (zwei Spieler, inkl. Neuladen und Wiederbeitritt), F (Zeitablauf). Szenario E ist auf Server-Ebene getestet.

## Stand und bekannte Einschränkungen

- Alle MVP-Muss-Kriterien aus dem PRD sind umgesetzt (Phase 1–4).
- Räume liegen nur im Arbeitsspeicher des Servers; ein Neustart beendet alle Räume.
- Wer eine laufende Runde verlässt oder die Verbindung verliert, kann im selben Tab über Link oder Raumcode wieder einsteigen (Token in `sessionStorage`). Neue Spieler können erst in der nächsten Runde dazukommen.
- Touch funktioniert (Tippen und Ziehen), ist aber nicht gezielt optimiert.
- Kein Sound, keine Ranglisten, keine Konten (bewusst nicht im MVP).
- Das Client-Bundle ist wegen Phaser etwa 1,6 MB groß (390 kB gzip). Alle Grafiken sind prozedural (Canvas/SVG aus Code), es werden keine Bilddateien geladen. Details: `docs/assets.md`.
- Hosting: Jeder Node-Host mit WebSocket-Unterstützung genügt: `npm install && npm run build`, Startbefehl `npm start`. Für Render liegt ein Blueprint in `render.yaml` (kostenloser Tarif, eine Instanz). Im Render-Dashboard „New → Blueprint“ wählen und dieses Repo verbinden. Der kostenlose Dienst schläft nach etwa 15 Minuten ohne Besucher ein, der erste Aufruf danach dauert bis zu einer Minute.
