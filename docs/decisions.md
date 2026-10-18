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
| Maulwurf – Tunnel | Direkt vor einer Wurzelzone scharf schalten: eine zusammenhängende Wurzelzone mit bis zu 3 Kacheln, 1 Punkt pro Kachel. |
| Biber – Übergang | Direkt vor einer Querungsstelle scharf schalten: markierte Querungsstellen im Wasser, 1 Punkt pro Kachel. |
| Dachs – Hart im Nehmen | Passiv, ohne Aktivierung: in der ersten gebauten Route über Felsen kosten Felsen 0,5 statt 3 Punkte. |

Maulwurf und Biber schalten ihre Fähigkeit nur scharf, wenn die Figur direkt vor (oder auf) dem passenden Hindernis steht (`canArmAt` in `abilitySystem.ts`; Hindernisse hinter der Figur zählen nicht). Davor ist der Knopf gesperrt. Steht die Figur davor, leuchtet er, und die Planungszeile zeigt „Wurzelzone voraus – drücke F …“. Läuft die Figur wieder weg und enthält die Planung kein passendes Hindernis, erlischt die Fähigkeit von selbst. Das ist eine Bedienhilfe im Client. Der Reducer prüft nur, dass die Fähigkeit ausschließlich auf ihren Kacheln wirkt.

Der Dachs hat keinen Knopf mehr, weil die Fähigkeit ohnehin nur auf Felsen wirkt. Welche Fähigkeit für eine Route gilt, entscheidet `routeAbility(player, armed)` für Reducer und Planung gemeinsam. Alle Bau-Fähigkeiten werden **nur verbraucht, wenn sie in einer erfolgreich gebauten Route tatsächlich wirken**. Ein abgelehnter Bau verbraucht nichts (Szenario C).

**Darstellung:** Schon während der Planung verwandeln sich die Kacheln, auf denen die Fähigkeit wirken wird: Wurzeln werden zum Graben, die Querungsstelle bekommt eine Brücke, Fels wird gespalten. So ist sofort klar, warum dort gebaut werden kann. Die Vorschau ist leicht durchscheinend und endet an der ersten ungültigen Kachel. Jede Fähigkeit hat eine eigene Animation. Bau-Fähigkeiten hinterlassen außerdem eine bleibende Spur, die aus dem Spielstand gezeichnet wird. Sie ist deshalb nach dem Neuladen und für Mitspieler sichtbar.

| Tier | Animation | Bleibende Spur |
| --- | --- | --- |
| Fuchs | Schnüffeln mit Funken, goldene Suchwelle, aufgedeckte Leerrohre leuchten auf, Pfotenspur erscheint Abdruck für Abdruck | – (Leerrohre bleiben aufgedeckt) |
| Maulwurf | Taucht ab und wieder auf; Erde spritzt am Eingang, ein Erdbuckel wandert durch den Graben, am Ausgang spritzt wieder Erde | Graben: helle, ausgehobene Erde deckt die Wurzelkachel ganz ab, in der Mitte ein offener Graben mit der Leitung, an den Wänden gekappte Wurzeln, Erdhäufchen in den Ecken |
| Biber | Hämmern; Planken fallen Kachel für Kachel ein, Wasser spritzt | Holzbrücke unter der Leitung |
| Dachs | Ausholen und Zuschlagen; pro Felskachel Funkenblitz, Splitter und kurzes Beben | Freigeschlagene Schotterrinne mit Rissen und Geröll |

Die Effekte hängen am Fortschritt der Leitungsanimation (`FiberLayer.animate` meldet jede erreichte Kachel), nicht an eigenen Timern. So bleiben sie auch unter Last synchron zur Leitungsspitze. Mit „Animationen reduzieren“ entfallen alle Animationen, die Spuren erscheinen sofort.

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
- **Figuren:** Die eigene Figur hat einen cremefarbenen Ring mit oranger Kontur, Mitspieler einen Ring in Tierfarbe und ein Namensschild. Eine scharf geschaltete Fähigkeit (Maulwurf, Biber) zeigt eine pulsierende Aura und ein Abzeichen. Die Figur schaut in Laufrichtung: nach unten von vorne, nach oben von hinten, nach links und rechts im Profil (links ist die gespiegelte Seitenansicht). Im Stand behält sie die letzte Laufrichtung. Beim Laufen wechseln sich zwei Schritt-Posen ab; mit „Animationen reduzieren“ dreht sich die Figur nur, ohne Schrittwechsel.
- Die Option „Animationen reduzieren“ schaltet Bau-, Lauf-, Idle- und Anschlussanimationen sowie den Lichtimpuls ab.
