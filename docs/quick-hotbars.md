# Quick Hotbars Q / E

**Current shortcut update:** J now opens Jurnal Misi and K opens Job Skill. Use the on-screen **Edit Mode** button to edit all three hotbars. References to K editing or J skills in the historical verification below describe the previous tested release, not the current mapping.

Implemented in the existing PrimaryHotbar, pointer-drag, Game.hero, consumable, skill and save architecture. No replacement inventory, extra learned skills, duplicated items, or old ComboSkillActionHotbar/UtilityHotbar was introduced.

## Controls

- **1–0**: unchanged ten PrimaryHotbar slots.
- **Q / E**: activate the corresponding single-slot quick panel when gameplay is active and Edit Mode is off.
- **Edit Mode button**: shared Edit Mode for Primary, Q and E. Editing permits binding changes and header movement; it suppresses hotbar action activation.
- **J**: open Jurnal Misi.
- **K / I**: open existing Job Skill / Inventory panels, then drag learned active skills or usable items into a hotbar while editing.
- **C**: unchanged Character Overview shortcut.
- Left-drag the **header** to move a panel; left-drag its **slot** to move/swap a reference. Intentional empty-world release removes only the shortcut. Other invalid UI targets and cancellation preserve it.
- **Atur → Reset Layout** restores all three panel positions, without clearing contents or inventory. Escape/blur/pointer cancellation abort drag safely.

The previous hard-coded E shrine heal conflicted with the requested E binding. Healing remains available through the existing visible shrine button and Sanctuary Rest action; E now exclusively dispatches its quick binding.

## Architecture and persistence

`lib/game/hotbar.ts` owns the shared slot address (`0..9`, `q`, `e`), entry resolution, eligibility, immutable binding changes, swaps, migration and layout reset. Q/E resolve the same skill registry and item templates, adding `hotbarCategory: quick` to the resolved view only. A binding is an ID reference, never an owned skill or copied inventory item.

`Game.useHotbarSlot()` is the common activation path for both bar types. It calls the existing skill, potion, attack, dodge and rest implementations. Mana, weapon/job/rank checks, item quantity, cooldown and pause/input gates remain authoritative there and in the existing action functions. No parallel combat/resource calculation was added.

The existing per-character save contains:

```ts
quickHotbars: {
  q: { assignment: string | null, position: { x: number, y: number } | null },
  e: { assignment: string | null, position: { x: number, y: number } | null }
}
```

Old saves default to two empty quick slots. Load sanitizes malformed IDs/positions, duplicate references and unavailable/foreign/unlearned skills. Skill reset and job remapping validate quick references too. Known depleted consumable references are intentionally retained and show quantity 0, allowing restocking without rebinding; unknown/unusable entries are removed. Primary still has exactly ten entries. Progression, equipment, item metadata and inventory quantities are not reset.

`GameDragDropProvider` and `commitDrop` are shared across the three bars. The world passes the actual Edit Mode into validation; both directions of a swap are checked, including a primary locked skill displaced toward a quick slot. Stale source, changed job/item/character and cancellation protections are retained.

The same `PrimaryHotbar` renderer is instantiated for primary, Q and E, avoiding duplicated cooldown/tooltip logic. The quick panel has a separate screen-space position. Its header uses unscaled client-coordinate deltas and the existing viewport clamp. Binding drag never moves the parent panel. Overlap is allowed. Positions are saved per character, and out-of-bounds panels are clamped without resetting all layouts.

## Appearance

`--primary-hotbar-scale: 1` and `--quick-hotbar-scale: .75` define proportional quick dimensions. The 75% reference is **one primary slot plus its header/padding**, not the full ten-slot strip. Primary dimensions remain unchanged. Quick icons/slot height/panel height are approximately 75%; labels retain a 10px readability floor. Item rarity uses existing rarity metadata. Tooltips retain readable size and existing viewport positioning.

At the checked 1117×912 browser viewport, Primary measured 880×146px; each quick panel measured about 75.3×108.5px. Primary slot height was 88px and quick slot height 66px. Defaults form a centered pair immediately above Primary; headers can reposition them independently.

## Files changed

- `lib/game/hotbar.ts`: shared addresses, quick bindings, migration, validation, keys and layout reset.
- `lib/game/drag-drop.ts`: shared drag destinations, swap eligibility and Edit Mode gates.
- `lib/game/rules.ts`: default quick state and reset-skill validation.
- `lib/game/world.ts`: shared activation, Q/E input, Edit Mode, save/layout wrappers.
- `components/game/primary-hotbar.tsx`: shared three-panel renderer and editor.
- `components/game/drag-drop-provider.tsx`: q/e hit testing and Edit Mode enforcement.
- `app/page.tsx`: mount Q/E, shared K shortcut, editor integration and updated control help.
- `app/primary-hotbar.css`: proportional quick-panel styling and edit feedback.
- `lib/game/quick-hotbar.test.ts`: 11 new domain regression tests.
- `tests/browser/drag-regression.tsx`: seven new quick-bar pointer scenarios.
- `tests/browser/real-components.tsx`: actual-component fixture with three panels, typing and potion/cooldown probes.
- `tests/browser/vite.config.ts`: disable fixture HMR so entry-point disposal cannot interrupt an in-progress pointer test. Explicit reload applies source changes; production HMR is unchanged.
- `docs/drag-drop-implementation.md` and this document: current controls and verified coverage.

## Verification — 10 September 2026

- Full Node suite: **111/111 passed**, including 11 new quick tests and existing equipment, Rune, Optimizer, progression, potion, hotbar, BGM and layout regressions.
- Isolated production-provider browser fixture: **37/37 passed**. These are dispatched pointer tests, not 37 full-game playthroughs. Existing coverage includes 75%/100%/150% transforms, enlarged fonts, pointer precision, stale sources and cancellation. Added coverage checks Edit Mode, Q/E assignment/swaps, primary/quick transfer, invalid/background release and Escape.
- Native mouse/keyboard in actual-component fixture: Mana Potion dragged from primary to E; typing E in an input did not activate it; E consumed one of three potions and restored Mana; immediate repeated E was blocked by cooldown. Advancing the fixture clock between uses consumed the remaining two, displayed depletion, and further use was rejected. A new browser tab after disabling fixture HMR reported no console errors/warnings. Earlier hot-reload root-disposal logs belonged to the test harness and were not silently counted as clean results.
- Actual game on localhost:3001 using Adventurer 2: ten primary slots and one each Q/E; Edit OFF rejects binding changes; K toggles all three; primary→Q/E, Q↔E swap, invalid drop, empty-world removal, learned Job Skill→Q and Inventory potion→E worked. Inventory quantity remained 3 after binding the potion. Binding drags left parent panel bounds unchanged.
- Actual-game activation: Q dispatched Dodge with stamina/cooldown, E dispatched Basic Attack after dodge recovery, and Q bound to Langkah Fajar displayed **Mana tidak cukup.** with Mana 0. Potion consumption/cooldown was tested on the isolated actual-component character rather than spending the player's inventory.
- Both actual-game headers were moved independently; E clamped inside the lower-right viewport. Explicit game reload and reselecting the same character restored bindings and both saved coordinates, with inventory unchanged. Reset Layout cleared all three saved positions but retained assignments and inventory. C and J opened the original corresponding panels.
- Final actual-game screenshot retained the existing world/UI appearance; Q/E sat above the original Primary. Final main-game console contained no errors/warnings, including no hydration errors.
- TypeScript, targeted lint and production build passed. The Sites build launcher could not resolve its package-manager path on this Windows setup; the existing direct vinext build succeeded. Existing large-bundle and route-classification notices remain.

## Scope / limitations

- Only entries already supported by the existing usable-entry registry are accepted. No nonexistent mount, combo or situational gameplay ability was invented. New entries still need their normal item/skill action implementation.
- The current checkout has no player-facing UI Scale/Font Size controls. Scale coverage uses the existing isolated transform/font fixture, not an invented setting or exhaustive full-game resolution matrix.
- All-job/reset/save eligibility is covered by domain tests; native full-game checks used Adventurer, not a manual playthrough of every class.
- On short screens the existing hotbar layer can overlap lower binding-window content. Move headers or scroll that window; no unrelated UI redesign was made.
- These changes require separate public deployment approval. Local validation and saving a Sites version do not update the public website.

## Re-run

```powershell
node --experimental-strip-types --test lib/game/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vinext/dist/cli.js build
node node_modules/vite/bin/vite.js --config tests/browser/vite.config.ts
```

The fixture is on `http://127.0.0.1:3002/` (Run interaction regression) and `/real-components.html` (native interaction). Its data is isolated from player saves. Reload explicitly after source changes.
