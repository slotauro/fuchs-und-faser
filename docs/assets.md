# Grafik-Assets

Alle Grafiken entstehen zur Laufzeit aus Code. Es gibt keine externen Bilddateien, keine Lizenzfragen und keine zusätzlichen Netzwerk-Requests. Die Schrift Nunito ist über `@fontsource-variable/nunito` (SIL Open Font License 1.1) lokal gebündelt.

## Stil

- Kontur: 2–3 px, dunkles Braun `#3b2f25`
- Licht von oben links, Verläufe statt flacher Flächen, weiche Bodenschatten nach rechts unten
- Farben zentral in `client/src/game/art/palette.ts`; die CSS-Variablen in `client/src/style.css` verwenden dieselben Töne (Creme, Waldgrün `#2f5d3a`, Glasfaser-Orange `#ff8a1f`)
- Deterministisch: Zufallsdetails (Halme, Blumen, Steine, Dekoration) kommen aus `art/rng.ts` mit Karten-ID und Zelle als Seed. Jede Karte sieht bei jedem Laden gleich aus.

## Liste

Größen in Weltpixeln. Eine Kachel hat 96 px (`TILE`), der Randbereich ist 96 px breit (`MARGIN`). SVG-Texturen werden doppelt so groß gerastert, damit sie auf hochauflösenden Displays scharf bleiben.

| Schlüssel | Quelle | Format / Größe | Varianten |
| --- | --- | --- | --- |
| `terrain-<mapId>-<0/1>` | `art/terrain.ts` → `renderTerrain` | Canvas, (Breite × 96 + 192) × (Höhe × 96 + 192) | je Karte; 1 = verborgene Leerrohre aufgedeckt |
| Legende | `art/terrain.ts` → `renderTileSwatch` | Canvas 30 × 30 (2× Pixeldichte) | je Kacheltyp |
| `animal-<id>` | `ui/animalArt.ts` → `animalDataUrl` | SVG 128 × 128 | Fuchs, Maulwurf, Biber, Dachs |
| Tierporträt (UI) | `ui/animalArt.ts` → `animalSvg(id, label, 'portrait')` | Inline-SVG, Ausschnitt Kopf | 4 Tiere |
| `house-<n>` | `art/svgAssets.ts` → `houseSvg` | SVG, Grundfläche × 100 px + 30 % Dachüberstand | Cottage, Villa, Bäckerei (Markise, Brezelschild), Schule (Uhr, Glockenturm); Tür liegt gegenüber dem Anschluss |
| `tree-0/1/2` | `treeSvg` | SVG 110–120 × 130–145 | Apfelbaum, Tanne, Laubbaum |
| `bush-0/1` | `bushSvg` | SVG 70 × 50 | rosa bzw. weiße Blüten |
| `stone` | `stoneSvg` | SVG 50 × 34 | – |
| `distributor` | `distributorSvg` | SVG 100 × 110 | Netzverteiler-Schrank mit LEDs und Glasfaser-Logo |
| `shaft` | `shaftSvg` | SVG 40 × 40 | Kabelschacht-Deckel |
| `socket` / `socket-on` | `socketSvg` | SVG 100 × 100 | Hausanschluss offen (gelb) / angeschlossen (grün mit Haken) |
| `badge-<id>` | `abilityBadgeSvg` | SVG 46 × 46 | Lupe, Schaufel, Planke, Spitzhacke |
| `fx-dirt`, `fx-star` | `layers/FigureLayer.ts` | Phaser-Graphics-Textur 16 bzw. 32 px | Partikel für Graben und Anschluss |

## Zeichenebenen (`client/src/game/layers/`)

| Ebene | Inhalt |
| --- | --- |
| `TerrainLayer` | Boden-Textur, Häuser, Verteiler, Hausanschlüsse, Randdekoration, Schilder |
| `FiberLayer` | gebaute Leitung (Schein, Kontur, Orange, Glanz), Kupplungen, Schächte, Bauanimation, Lichtimpuls |
| `PlanLayer` | dezentes Raster, Vorschau (gestrichelt, transparent), mögliche Felder, Warnsymbol, Pfotenspur, Hover |
| `FigureLayer` | Tierfiguren mit Idle, Hüpfen, Graben, Jubeln, Fähigkeits-Aura und -Abzeichen |

Ein neues Asset: SVG-Funktion in `art/svgAssets.ts` ergänzen, in `worldAssets()` eintragen und in der passenden Ebene per Schlüssel verwenden.
