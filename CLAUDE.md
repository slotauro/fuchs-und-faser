# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

"Fuchs & Faser" is a browser strategy game about fiber-optic rollout. Players plan a route from the distributor to each house connection within a budget, solo or cooperatively with 2–4 players. The code, UI text and docs are in German, so keep new user-facing text and docs in German.

## Commands

Requires Node.js 20+ and npm. This is an npm workspaces monorepo with three packages: `shared`, `client` and `server`.

```bash
npm install
npm run dev          # client (Vite, :5173) + server (tsx watch, :3001); Vite proxies /socket.io
npm test             # Vitest: shared/test, server/test, client/test
npx vitest run shared/test/routeValidator.test.ts   # single file
npx vitest run -t "name of test"                   # single test by name
npm run typecheck    # tsc for shared, client, server (no linter configured)
npm run test:e2e     # Playwright (e2e/), reuses or starts `npm run dev`
npx playwright test e2e/singleplayer.spec.ts       # single e2e file
npm run build        # client production build -> client/dist
npm start            # production server: serves client/dist + Socket.IO on PORT (default 3001)
```

Before the first e2e run, install the browser once with `npx playwright install chromium`. Playwright runs with one worker, serially, against `localhost:5173`.

## Architecture

**The rules live only in `shared/`.** It is pure TypeScript with no DOM. The central function is `applyAction(state, action, now)` in `shared/src/gameReducer.ts`. Around it:

- `costCalculator.ts`: costs are counted internally in half points (integers), so 0.5-point conduits need no floats.
- `routeValidator.ts`
- `abilitySystem.ts`
- `pathfinder.ts`: Dijkstra, used by the fox ability and by the solvability tests.
- `scoring.ts`
- `protocol.ts`: Socket.IO message types.

Clients import the package as `@fuf/shared`, which resolves directly to `shared/src/index.ts` with no build step.

**The same reducer runs on both sides.** Behind the `GameController` interface (`client/src/controller/`):

- Singleplayer: `LocalController` runs the reducer in the browser and needs no server.
- Multiplayer: `NetworkController` only proposes actions, each with a random `actionId`. The server (`server/src/roomManager.ts`) is authoritative. It applies the reducer, deduplicates actions by `actionId`, validates payloads (`validation.ts`) and rate-limits (`rateLimiter.ts`).
- Planned but unbuilt routes are only previews sent to peers and are never authoritative.

**Client split:**

- `client/src/game/planner.ts`: the non-authoritative local route plan. Arrow keys move the figure, which lays cells; stepping back undoes. Clicking or dragging cells also works.
- `client/src/game/BoardScene.ts`: the Phaser 3 scene that coordinates input and the drawing layers in `game/layers/`:
  - `TerrainLayer`, `FiberLayer`, `PlanLayer` and `FigureLayer`.
  - Their depth order comes from `DEPTH` in `layers/constants.ts`.
- `client/src/ui/`: plain HTML/CSS for menus, HUD, lobby and results. There is no UI framework.

**Graphics are fully procedural.** There are no image files.

- `game/art/terrain.ts` renders one Canvas texture per map.
- `game/art/svgAssets.ts` and `ui/animalArt.ts` build SVGs as data URLs.
- Randomness is deterministic: `art/rng.ts` is seeded with the map id and the cell, so a map looks the same on every load.
- Decorations live only in the margin outside the play grid, and `client/test/art.test.ts` enforces this.
- See `docs/assets.md` for the asset list and how to add a new asset.

**Board geometry:** `TILE` is 96 and `MARGIN` is 96. The camera is scrolled to (−MARGIN, −MARGIN), so world (0, 0) is the grid's top-left corner. `#board` exposes `data-tile` and `data-margin`, which `e2e/helpers.ts` uses to convert cells to click positions. Update both if the geometry changes.

**Maps:** maps are ASCII grids in `shared/src/maps/map*.ts`, parsed by `parseMap.ts`. `shared/test/maps.test.ts` checks that every map is solvable within budget without abilities and offers more than one sensible route. Re-run it after editing a map.

## Conventions

- Keep the stable `data-testid` attributes in HUD and dialogs: `budget`, `planned`, `length`, `connected`, `time`, `build`, `ability`, `plan-msg`, `board`, `result`, `score`, `game`. The e2e tests depend on them.
- Respect the "Animationen reduzieren" option (`reduceMotion`) in every new animation.
- Design decisions are recorded in `docs/decisions.md`; update it when you change rules or presentation.
- Do not deploy without the user's explicit consent.
