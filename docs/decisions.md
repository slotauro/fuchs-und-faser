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

Jede Fähigkeit gilt einmal pro Runde und Spieler. Ist die Bau-Fähigkeit verbraucht, nennt die Fehlermeldung an der gesperrten Kachel genau das („… ist in dieser Runde schon verbraucht, hier hilft nur ein Umweg“) statt der allgemeinen Sperrmeldung, damit ein Biber vor der zweiten Querungsstelle nicht „nur der Biber kann hier …“ liest (`spentAbility` in `analyzeRoute`). Jede Fehlermeldung der Planung erscheint zusätzlich als rote Sprechblase direkt an der ersten ungültigen Kachel (`PlanLayer`), unter der Kachel bzw. in der letzten Zeile darüber. Eine neue Meldung ploppt kurz auf, mit „Animationen reduzieren“ erscheint sie ohne Animation.

| Tier | Umsetzung |
| --- | --- |
| Fuchs – Spürnase | Sofort: deckt verborgene Leerrohre auf und zeigt per Dijkstra die günstigste Route zum nächsten Gebäude als Pfotenspur. |
| Maulwurf – Tunnel | Automatisch in der ersten gebauten Route durch Wurzeln: eine zusammenhängende Wurzelzone mit bis zu 3 Kacheln, 1 Punkt pro Kachel. |
| Biber – Übergang | Automatisch in der ersten gebauten Route über eine markierte Querungsstelle im Wasser, 1 Punkt pro Kachel. |
| Dachs – Hart im Nehmen | Passiv, ohne Aktivierung: in der ersten gebauten Route über Felsen kosten Felsen 0,5 statt 3 Punkte. |

Maulwurf, Biber und Dachs wirken automatisch (`kind: 'passive'`), wie zuvor schon der Dachs. Früher mussten Maulwurf und Biber ihre Fähigkeit direkt vor dem Hindernis mit `F` scharf schalten. Das ist entfallen: Wurzeln und Querungsstellen sind ohne Fähigkeit ohnehin gesperrt, es gab also nie einen Grund, sie nicht einzusetzen. Mit dem Scharfschalten sind auch `canArmAt` und das Feld `useAbility` der Bauaktion weggefallen. Nur der Fuchs hat noch einen Knopf (`F`). Solange die geplante Route die eigene Fähigkeit nutzt, zeigt die Figur Aura und Abzeichen, und der Status-Chip meldet „Wirkt in dieser Planung“. Welche Fähigkeit für eine Route gilt, entscheidet `routeAbility(player)` für Reducer und Planung gemeinsam. Alle Bau-Fähigkeiten werden **nur verbraucht, wenn sie in einer erfolgreich gebauten Route tatsächlich wirken**. Ein abgelehnter Bau verbraucht nichts (Szenario C).

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
- Im Singleplayer lässt sich das Tier jederzeit über „Tier wechseln“ im Tier-Panel tauschen. Solange der Dialog offen ist, steht die Zeit. Mit dem neuen Tier startet die Karte von vorn (neuer Spielstand, volles Budget, volle Zeit), denn ein Wechsel mitten im Spielstand würde verbrauchte und neue Fähigkeiten vermischen. Im Multiplayer gibt es den Knopf nicht, weil ein Neustart das ganze Team träfe und jedes Tier pro Raum nur einmal vergeben ist.
- Score: 50 × Anteil angeschlossener Gebäude + bis zu 30 für Kosteneffizienz (Referenzkosten der Karte / verbaute Kosten) + bis zu 20 für Restzeit. Effizienz und Zeit zählen nur bei Erfolg.
- Sterne: 1 bei Erfolg, 2 bzw. 3 bei Kosten unter der kartenspezifischen Schwelle. Referenz- und Schwellenwerte stehen in den Kartendateien; `shared/test/maps.test.ts` prüft, dass jede Karte ohne Fähigkeiten im Budget lösbar ist und mehr als eine sinnvolle Route bietet.

## Karten

| Nr. | Karte | Gebäude | Schwerpunkt |
| --- | --- | --- | --- |
| 1 | Das erste Haus | 1 | Einstieg: Felsen oder Umweg |
| 2 | Die Wurzelallee | 1 | Jedes Tier hat einen eigenen Weg |
| 3 | Die kleine Tierstadt | 3 | Verzweigtes Netz, Straße, Leerrohrtrasse; Standardkarte für neue Mehrspielerräume |
| 4 | Am Mühlbach | 3 | Ein Bach teilt die Karte. Ohne Brücke geht es nur unten herum. Wurzelband vor der Mühle, verborgenes Leerrohr am Ufer |
| 5 | Das Felsendorf | 4 | Straße mit zwei günstigen Lücken, das Trafohaus liegt hinter einer Fremdleitung und ist nur von unten erreichbar, viel Fels, verborgene Leerrohre im Süden |

Budget und Referenzkosten der neuen Karten 4 und 5 sind aus dem gierigen Anschließen ohne Fähigkeiten abgeleitet (der Algorithmus aus `maps.test.ts`): Referenz und 2 Sterne liegen genau auf diesen Kosten, das Budget hat rund 18 % Puffer, und 3 Sterne verlangen etwa 10 % Ersparnis durch Fähigkeiten oder ein klügeres Netz.

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
- **Rundenende:** Beendet eine Route die Runde, erscheint die Ergebniskarte erst, wenn die Verlegung vollständig zu sehen war: zuerst die Bauanimation, dann leuchtet das ganze Netz bei einem Sieg zweimal auf, danach folgt eine kurze Pause (zusammen etwa 3 s, `finaleDelay` in `BoardScene.ts`). Mit „Animationen reduzieren“ entfällt das Aufleuchten, die fertige Leitung bleibt aber 1,2 s stehen. Endet die Runde durch Zeitablauf oder Aufgeben, erscheint die Karte sofort. Mit „Spielfeld ansehen“ (oder `Esc`) lässt sich die Ergebniskarte ausblenden, um das fertige Netz zu betrachten. „Ergebnis anzeigen“ in der Planungszeile (oder wieder `Esc`) blendet sie beliebig oft erneut ein.
- **Figuren:** Die eigene Figur hat einen cremefarbenen Ring mit oranger Kontur, Mitspieler einen Ring in Tierfarbe und ein Namensschild. Nutzt die geplante Route die eigene Bau-Fähigkeit (Maulwurf, Biber, Dachs), zeigt die Figur eine pulsierende Aura und ein Abzeichen. Die Figur schaut in Laufrichtung: nach unten von vorne, nach oben von hinten, nach links und rechts im Profil (links ist die gespiegelte Seitenansicht). Im Stand behält sie die letzte Laufrichtung. Beim Laufen wechseln sich zwei Schritt-Posen ab; mit „Animationen reduzieren“ dreht sich die Figur nur, ohne Schrittwechsel.
- Die Option „Animationen reduzieren“ schaltet Bau-, Lauf-, Idle- und Anschlussanimationen sowie den Lichtimpuls ab.
- **Impressum und Datenschutz:** Das Hauptmenü hat eine Fußzeile mit zwei Links, die je einen Dialog öffnen (`client/src/ui/legal.ts`). Die Betreiberangaben stehen dort in `OPERATOR`; leere Felder erscheinen als rote Platzhalter, damit sie vor der Veröffentlichung auffallen. Die E-Mail steht in zwei Teilen (`emailUser`, `emailDomain`) und wird erst beim Öffnen eines Dialogs zusammengesetzt, damit sie nicht am Stück im Bundle steht.
