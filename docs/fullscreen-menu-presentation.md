# LUMENFALL — Fullscreen menu presentation

Implemented 17 September 2026 from both supplied v1 documents. The Visual Presentation Specification defines the visual target; the Astra Prompt defines the implementation and regression boundaries.

## Presentation

- Main Menu: dedicated fullscreen fantasy vista, centered wordmark and Continue / New Game / Load Game / Options / Quit Game. Continue is derived from the existing valid last-played character, not a new save flag.
- Selection: three real save slots, name, level, job, region, playtime and last played date, live equipment/model preview, gold Enter World, Back and confirmed Delete. New Game cannot overwrite occupied slots; Load Game cannot enter empty slots.
- Creation: appearance controls on the left, actual character model in the center, name/validation/Create on the right. Drag, wheel and keyboard-accessible rotation/zoom controls affect only this preview. Creation shows the body without a weapon; the existing starting equipment is still granted normally in gameplay.
- Loading: dedicated full-screen scene. No countdown or invented percentage. Model, required region/collision tasks, optional terrain-material tasks and shader preparation settle before gameplay begins. Essential asset failure returns to the title screen without deleting the save; retry is supported.
- Options keep the existing device audio preference and browser fullscreen API. Browser Quit retains the existing confirmation/safe-title behavior.

## Scene lifecycle

Previously the page constructed Game on mount, built Arunika and ran its frame loop behind the start panel. It now reads roster/audio only on mount. Character Selection/Creation use a separate small preview renderer. Game is dynamically imported and instantiated only when the user enters a saved/new character.

During loading there is no simulation frame loop, movement, combat, playtime increment or autosave. `prepareWorld()` awaits the real character and region work, including asynchronously spawned map/tree/collision tasks. The optional Padang texture fallback behavior is unchanged; only readiness is exposed to the loading gate. The follow camera is prepared before the first gameplay frame.

Returning to Main Menu calls the existing save/return behavior, then disposes the world instance, frame loop, listeners, labels, audio and WebGL context. Character preview renderers are also disposed on unmount. The quest UI clock runs only in-world. The portaled hotbar is mounted only in-world.

## Files

- `app/page.tsx`: existing flow controller uses the dedicated presentation; deferred world lifecycle; existing save utilities; device audio options independent from Game.
- `components/game/menu-presentation.tsx`: fullscreen UI, accessible preset controls, metadata, name validation and loading presentation.
- `app/menu-presentation.css`: scoped menu styles, responsive layouts and reduced-motion support.
- `components/game/character-preview.tsx`: optional menu presentation, model loading feedback, scoped camera input and accessible controls. Equipment-panel mode is retained.
- `lib/game/world.ts`: preparation gate, lifecycle/disposal and input suppression before start. No combat formulas, rewards, region layouts or character stats changed.
- `lib/game/field-terrain-renderer.ts`: returns the existing grass-material readiness promise; no geometry, materials, placements or terrain parameters changed.
- `public/assets/menu/vista.webp`, `terrace.webp`: cleaned fantasy backgrounds based on the supplied visual references, generated with ImageGen. No baked UI or baked preview character. Combined runtime size about 0.91 MB.
- `docs/assets/menu/*-source.png`: editable source artwork retained outside public runtime assets.
- `scripts/check-menu-presentation.mjs`: repeatable browser regression using an isolated profile and test-only saves. Local runtime paths can be supplied through `CODEX_NODE_MODULES`; URL through `MENU_TEST_URL`.

## Verification

Production build passed. All 289 existing game tests passed after the lifecycle changes.

36 browser assertions passed covering: no world/model loading at launch; empty-save Continue/Load; independent audio persistence; Quit confirmation; valid last-played Continue; real slot metadata; locked empty slots in Load; preview without a world; Delete cancel/confirm; name validation; responsive layout at 1440, 1024, 800 and 390px; draft isolation; female creation and appearance persistence; model/collider readiness before start; C/K/J and 1–0/Q/E; old identity/level/gold/inventory/position retention; save on return; disposed world; no simulation in menus; reload/Continue; corrupt-save handling; real asset-delay loading; safe asset-failure recovery and successful retry. No runtime/hydration errors occurred in successful flows. The negative asset test intentionally produces a failed request.

Screenshots and the machine-readable report are in `output/menu-qa/` locally. No test touches the player's browser profile or save storage.

## Boundaries and known limitations

- This is a presentation overhaul, not a new character creator or model replacement. Existing face/hair style IDs are preserved and saved, but the current character renderer does not contain separate face/hair meshes or morphs for every preset. Those controls cannot produce geometry that the existing model does not provide. Hair/skin color remains subject to the model's existing material naming/masking; this task does not repaint the GLBs.
- Narrow layouts stack and scroll controls; desktop remains fullscreen and column-based. Fullscreen can be denied by browser policy. No application attempts to forcibly close a browser tab.
- Optional terrain/grass texture failures retain the existing basic-material fallback; essential character/map/collider failures block entry. No gameplay timing or material fallback was rebalanced.
- Full-project TypeScript checking still reports six pre-existing errors in `rules.ts` (four appearance preset generic types), `ui-layout.ts` and `tests/browser/real-components.tsx`. None originates in the new menu/lifecycle files. These unrelated type-only issues were not rewritten in this presentation task.
- No save schema, stat calculation, inventory/equipment rules, combat, job progression, drop table, economy or world map content was replaced.
