# Designentscheidungen

Wo das PRD Spielraum ließ, wurde die einfachste spielbare Lösung gewählt. Die Werte liegen zentral in `shared/src` und lassen sich ohne Codeänderung an anderer Stelle anpassen.

## Kosten und Budget

- Intern wird in **halben Punkten** gerechnet (Ganzzahlen), damit 0,5 Punkte für Leerrohre ohne Rundungsfehler funktionieren. Angezeigt werden ganze bzw. halbe Punkte.
- Kosten pro Kachel (`tiles.ts`): Wiese 1, Gehweg 1, Straße 4, Felsen 3, Leerrohr 0,5, Hausanschluss 3 pauschal. Wurzelzone, Wasser, Gebäude und Fremdleitungen sind ohne Fähigkeit gesperrt.
- „Straße queren 4 Punkte je Querung“ ist als 4 Punkte **pro Straßenkachel** umgesetzt; Straßen sind eine Kachel breit.
- Eine Route, deren Kosten das Restbudget übersteigen, wird abgelehnt, bevor etwas abgebucht wird.

## Gültige Route

- Eine geordnete Kachelfolge, orthogonal benachbart, ohne Selbstkreuzung.
- Beginnt direkt neben dem Netz (Verteiler oder bereits gebaute Leitung) – so entsteht in Karte 3 ein verzweigtes Netz.
- Endet auf einem noch nicht versorgten Hausanschluss und läuft nicht durch andere Anschlüsse hindurch.
- Darf keine bereits gebaute Kachel enthalten. Das verhindert auch doppelte Kosten bei wiederholten Klicks mit neuer Aktions-ID.

## Fähigkeiten

Jede Fähigkeit gilt einmal pro Runde und Spieler.

| Tier | Umsetzung |
| --- | --- |
| Fuchs – Spürnase | Sofort: deckt verborgene Leerrohre auf und zeigt per Dijkstra die günstigste Route zum nächsten Gebäude als Pfotenspur. |
| Maulwurf – Tunnel | Für die nächste Route: eine zusammenhängende Wurzelzone mit bis zu 3 Kacheln, 1 Punkt pro Kachel. |
| Biber – Übergang | Für die nächste Route: markierte Querungsstellen im Wasser, 1 Punkt pro Kachel. |
| Dachs – Hart im Nehmen | Für die nächste Route: Felsen kosten 0,5 statt 3 Punkte. |

Bau-Fähigkeiten werden „scharf geschaltet“ und **nur verbraucht, wenn sie in einer erfolgreich gebauten Route tatsächlich wirken**. Ein abgelehnter Bau verbraucht nichts (Szenario C).

## Rundenende und Wertung

- Gewonnen: alle Gebäude angeschlossen. Verloren: Zeit abgelaufen, aufgegeben, oder das Restbudget reicht nachweislich für kein weiteres Gebäude (optimistische Prüfung mit allen noch freien Fähigkeiten).
- Jede Karte hat ein Zeitlimit; im Singleplayer kann pausiert werden, im Multiplayer nicht.
- Score: 50 × Anteil angeschlossener Gebäude + bis zu 30 für Kosteneffizienz (Referenzkosten der Karte / verbaute Kosten) + bis zu 20 für Restzeit. Effizienz und Zeit zählen nur bei Erfolg.
- Sterne: 1 bei Erfolg, 2 bzw. 3 bei Kosten unter der kartenspezifischen Schwelle. Referenz- und Schwellenwerte stehen in den Kartendateien; `shared/test/maps.test.ts` prüft, dass jede Karte ohne Fähigkeiten im Budget lösbar ist und mehr als eine sinnvolle Route bietet.

## Multiplayer

- Der Server ist maßgeblich. Clients senden Aktionen mit einer zufälligen `actionId`; bereits angewendete IDs werden ohne erneute Buchung bestätigt. Bei fehlender Antwort wiederholt der Client die Aktion mit derselben ID.
- Raumcodes: 6 Zeichen aus einem Alphabet ohne verwechselbare Zeichen (kein 0/O/1/I), erzeugt mit `crypto.randomInt`.
- Jedes Tier gibt es pro Raum nur einmal. Start durch den Host, sobald mindestens zwei verbundene Spieler bereit sind (der Host gilt als bereit).
- Getrennte Spieler behalten 60 s ihren Lobby-Platz; in einer laufenden Runde bleibt ihre Figur erhalten. Räume ohne verbundene Spieler werden nach 5 Minuten gelöscht.
- Schutz: Token-Bucket (10 Nachrichten/s, Spitzen bis 20), Validierung aller Nutzdaten, maximale Nachrichtengröße 32 kB. Gespeichert wird nur der frei gewählte Anzeigename.
- Geplante (noch nicht gebaute) Routen werden gedrosselt als halbtransparente Vorschau an die Mitspieler gesendet. Sie sind nicht maßgeblich.

## Darstellung und Barrierefreiheit

- **Prozedurale Assets statt Bilddateien:** Gelände als eine Canvas-Textur pro Karte, Figuren, Häuser und Objekte als SVG aus Code (siehe `docs/assets.md`). Es gibt keine Lizenzfragen, keine zusätzlichen Requests, und alles skaliert scharf. Die Spielregeln in `shared/` bleiben davon unberührt.
- **Zusammenhängende Welt:** Flächen gleicher Art werden nachbarschaftsabhängig gezeichnet, mit runden Außenecken, Uferkanten, Bordsteinen und durchlaufenden Wurzeln. Das Raster ist normalerweise unsichtbar und wird nur beim Planen oder beim Zeigen mit der Maus dezent eingeblendet.
- **Dekoration nur im Randbereich:** Bäume, Büsche und Steine stehen in einem 1 Kachel breiten Rand außerhalb des Spielrasters (per Test abgesichert). Sie verdecken nie Hindernisse oder bespielbare Felder. Auf dem Raster gibt es nur flache Bodendetails (Halme, Blüten, Kiesel).
- **Lesbarkeit:** Jeder Kacheltyp hat neben der Farbe eine eigene Form: Felsbrocken, Wurzeln, Wellen, Pfähle an Querungsstellen, Metallabdeckung für Leerrohre, Baustellenbarke für Fremdleitungen.
- **Glasfaser:**
  - Die gebaute Leitung ist kräftig orange mit Schein, Kontur und Glanz, abgerundeten Ecken, Kupplungen und Kabelschächten.
  - Die geplante Route ist eine transparente, gestrichelte Vorschau.
  - Ungültige Abschnitte erscheinen rot gestrichelt mit einem ✕-Symbol, das über der Figur liegt.
  - Angeschlossene Gebäude bekommen einen grünen Anschlusskasten mit Häkchen.
- **Figuren:** Die eigene Figur hat einen cremefarbenen Ring mit oranger Kontur, Mitspieler einen Ring in Tierfarbe und ein Namensschild. Eine scharf geschaltete Fähigkeit zeigt eine pulsierende Aura und ein Abzeichen.
- Die Option „Animationen reduzieren“ schaltet Bau-, Lauf-, Idle- und Anschlussanimationen sowie den Lichtimpuls ab.
