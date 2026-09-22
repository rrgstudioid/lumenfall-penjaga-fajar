# Lumenfall — drag-and-drop implementation

Implemented in the existing game; no replacement inventory, skill progression, renderer, or combat system.

**Quick-hotbar follow-up:** [Quick Hotbars Q/E](quick-hotbars.md) documents the current three-panel integration. Click **Edit Mode** in the hotbar before changing any hotbar binding or moving its header. **J** opens Jurnal Misi and **K** opens Job Skill. Primary retains ten slots (1–0); Q and E are separate single-slot panels. Inventory rearrangement remains independent of hotbar Edit Mode. Historical shortcuts/test totals below refer to the earlier drag-only delivery; current details are in the follow-up document.

## Existing architecture

- `Game.hero` is the authoritative per-character state. `Game.emit()` supplies React snapshots and `Game.save()` uses the existing character save system.
- Skills come from `ALL_SKILLS` / `ALL_PASSIVES`; learned ranks remain in `skillLevels` / `passiveLevels`.
- Inventory is a dense array of unique item instances; equipped slots refer to item IDs.
- PrimaryHotbar already stores ten ID references and resolves live skill costs, cooldowns and inventory quantities. Existing keyboard mapping remains 1–0.
- Inventory previously used native HTML drag events. Hotbar had separate slot-drag handlers. Both now use the same pointer provider. Window-header dragging remains presentation-only in the existing draggable-window system.

## Interaction architecture

`GameDragDropProvider` manages one transient pointer session, a six-pixel threshold, pointer capture, isolated floating preview, target feedback and cancellation. The payload contains IDs and source slots only. Pointer movement updates the preview through requestAnimationFrame, without committing gameplay state or setting React state on every movement.

`canDrop()` centralizes validation. `commitDrop()` revalidates against the current hero and returns an immutable hero update. `Game.commitUIDrop()` applies, saves and emits that update. The existing `moveInventoryItem()` delegates to this path too.

Sources: `skill`, `item`, `hotbar-binding`.

Targets: hotbar slot, inventory slot, intentional empty background, invalid UI.

| Interaction | Result |
| --- | --- |
| Learned active skill → hotbar | Assign a reference; the skill stays learned and in its tree. Repeated assignment swaps/moves the existing shortcut. |
| Locked, unlearned, passive or wrong-job skill → hotbar | Reject and visually return; no progression changes. |
| Usable inventory item → hotbar | Reference the canonical item template; inventory owns all instances and quantities. |
| Inventory → empty inventory slot | Move its slot reference, preserving the empty source position. |
| Inventory → occupied inventory slot | Swap slot references; item metadata and equipped identity stay unchanged. |
| Inventory/skill → invalid destination | Return without changing state. |
| Hotbar → hotbar | Move or swap references. |
| Hotbar → intentional empty background | Remove only that shortcut. |
| Hotbar → another invalid UI panel | Reject; do not remove the shortcut. |
| Escape, blur, pointercancel, lost capture, resize, source closure/movement | Cancel without committing or unbinding. |

Item consumption, changed source slot, job/skill availability and changed character are checked again on release. Combat input is suppressed during the drag, and the post-drag click is suppressed to prevent accidental activation. Ordinary clicks below the threshold retain selection/activation behavior.

The single hotbar is portaled above the Inventory and Job Skill binding windows. Those two windows remain open when focus moves to the hotbar, while gameplay stays paused. Other dialogs keep their existing modal behavior.

## Cards and icons

All 64 active skills and 26 passives have explicit, distinct vector icon compositions, based on their current effects and job identity. The same `SkillIcon` is reused in cards, skill detail, PrimaryHotbar, tooltips, and drag previews. Cards retain the existing Nusantara palette and show type, name, rank, state and active-skill mana cost. No skill rarity or new skill mechanics were invented.

Item visuals reuse the equipment asset resolver, item data and existing rarity palette. No new library was installed.

## Ownership and persistence

- `inventory`, equipment, Rune data, Optimizer data, skill ranks and quantities remain owned by the existing character state.
- New optional `inventoryLayout: (string | null)[]` stores only slot references. It preserves gaps without introducing nulls into the gameplay inventory array.
- Legacy saves without that field display their existing inventory order. Duplicate/missing slot references are repaired when resolved; newly acquired items fill an empty slot.
- PrimaryHotbar retains the existing ten-slot reference format. Migration additionally accepts legacy object bindings with `refId`.
- No character level, GOLD, job, equipment or inventory reset is performed.

## Follow-up fixes (10 September 2026)

The central architecture and canonical icons were already present in the checkout. This pass reproduced and repaired the integration bugs instead of adding a second drag system:

- The generic pressed-button `translateY(1px)` introduced a vertical scrollbar inside the horizontal hotbar scroller. Its grid narrowed, moving later slots and triggering legitimate source-movement cancellation. Drag sources now keep a stationary pressed state and the horizontal scroller explicitly disables vertical overflow. Legitimate window/scale/source movement still cancels safely.
- The generated release-click after a drag remains blocked, but a new deliberate pointer gesture clears that suppression. Close, item inspection, and hotbar activation are immediately usable again.
- Lost capture from an unrelated control no longer cancels the current source. Lost capture from the source still cancels; release is guarded against an unmounted source.
- The preview flips beside viewport edges and clamps in screen coordinates. It reacts to its measured size without scaling the world, and a fast subsequent drag cannot reuse a faded-out preview.
- Added a development-only page mounting the actual InventoryGrid, JobSkill, PrimaryHotbar, window wrapper, and production CSS. This catches integration failures that simple test buttons did not reveal. Its test character never reads/writes real character saves.

Files modified in this follow-up:

- `app/drag-drop.css`
- `app/primary-hotbar.css`
- `components/game/drag-drop-provider.tsx`
- `tests/browser/drag-regression.tsx`
- `tests/browser/vite.config.ts`
- `docs/drag-drop-implementation.md`

Files added in this follow-up:

- `lib/game/drag-geometry.ts`
- `lib/game/drag-geometry.test.ts`
- `tests/browser/real-components.html`
- `tests/browser/real-components.tsx`

No additional gameplay/save migration was necessary in this follow-up.

## Original implementation files (already in the checkout)

Modified:

- `app/page.tsx`
- `components/game/job-skill.tsx`
- `components/game/primary-hotbar.tsx`
- `lib/game/hotbar.ts`
- `lib/game/rules.ts`
- `lib/game/world.ts`

Added:

- `app/drag-drop.css`
- `components/game/drag-drop-provider.tsx`
- `components/game/inventory-grid.tsx`
- `components/game/entry-icon.tsx`
- `components/game/skill-icon.tsx`
- `lib/game/drag-drop.ts`
- `lib/game/skill-visuals.ts`
- `lib/game/drag-drop.test.ts`
- `tests/browser/index.html`
- `tests/browser/drag-regression.tsx`
- `tests/browser/vite.config.ts`
- `docs/drag-drop-implementation.md`

## Verification results — rerun 10 September 2026

These results supersede the previous 98/27 report. Browser fixture coverage is listed separately from actual-game checks; it must not be reported as full-game coverage.

- TypeScript checking: passed.
- Targeted lint for changed UI, drag domain and browser fixture: passed.
- Full Node regression suite: **100/100 passed**, including equipment, Rune/Optimizer, progression, potions, hotbar, BGM and window-layout tests. Drag-domain tests cover all active skills, all passives, item catalog eligibility, ownership, stale references, live quantity, skill upgrade, and save migration. Two additional geometry tests cover edge placement, viewport sizes and source scales.
- Isolated browser fixture using the production provider and domain functions: **30/30 passed**. Includes 75%/100%/150% transforms, enlarged font, hit testing/preview alignment, click threshold, swaps, removal, invalid drops, Esc, pointercancel, lost capture, blur, resize, source closure, scale changes, consumed items, unlearned skill, changed character/slot, rapid drags, unrelated lost capture, preview bounds and immediate deliberate clicks after dragging. These tests dispatch pointer events in the fixture; they are not native mouse tests of the whole game.
- Actual-component fixture with production CSS: native browser mouse drags from **all 10 hotbar slots passed** (each to its opposite slot). Each assertion checked a commit occurred, both references swapped, inventory remained identical and no action activated. Native upgrade click changed Langkah Fajar from rank 1 to 2 and its existing hotbar reference immediately displayed rank 2. Three native Mana Potion clicks consumed the real fixture inventory from 3 to 2 to 1 to 0 using the existing consumption function; the hotbar showed depletion.
- Direct interaction in the running game on localhost:3001: learned Langkah Fajar assignment; hotbar slot 9 to slot 1 swap; intentional background removal and restoration; potion assignment without consuming its stack; inventory move to empty slot and occupied-slot swap; invalid inventory drop; locked Nova Fajar and passive rejection. The game was explicitly started and observed bindings/state were checked after actions.
- Actual game reload: before/after authoritative snapshots matched for inventory (including metadata/quantity), inventoryLayout, primaryHotbar, skillLevels, equipment, GOLD, level, EXP and character slot. The same saved character was selected after reload.
- Window interaction: moved the Job Skill header, waited for its position to settle, then dragged a child card. Window bounds remained identical while the hotbar binding changed. Close worked directly after an invalid drag.
- Final live visual review: Job Skill and PrimaryHotbar rendered with the existing visual identity. Final console reads on the actual game, isolated provider fixture, and actual-component fixture contained **no errors or warnings**.
- Production build: passed via the existing vinext build entrypoint. The Sites build launcher could not find its package-manager path on this Windows environment. Existing large-bundle and route-classification notices remain; no dependency was added.

## Limitations / remaining manual verification

- Manual inventory rearrangement is enabled under **All + Posisi manual**. Filtered/sorted lists still support item-to-hotbar assignment, but intentionally do not change physical slot order.
- No UI Scale / Font Scale setting was found in the current game. Scale validation used real CSS transforms and font enlargement in the isolated browser fixture, not a newly added game setting.
- Icon coverage and all-job eligibility are registry/domain tests, not a manual playthrough of all 64 active skills. The actual-game checks used Adventurer; no progression or combat rebalance was made.
- The hotbar intentionally sits above binding windows. On a short viewport it can cover lower content; scroll the existing panel or move the hotbar header. No unrelated window redesign was performed.
- Public deployment is a separate approval step. Local test success alone does not update the public site.

## Re-run

```powershell
node --experimental-strip-types --test lib/game/*.test.ts
.\node_modules\.bin\tsc.cmd --noEmit
node node_modules/vinext/dist/cli.js build
node node_modules/vite/bin/vite.js --config tests/browser/vite.config.ts
```

The last command starts the isolated fixture at `http://127.0.0.1:3002/`. Click **Run interaction regression**. It never reads or writes the game player's save, and it is outside the production app routes.

`http://127.0.0.1:3002/real-components.html` is the actual-component fixture. Open **Test Job Skill** or **Test Inventory**, drag using the mouse, and inspect its on-page state/counters. **Snapshot fixture / Restore fixture** exercise save parsing in memory (not page-reload persistence). **Reset fixture** restores only test data. Actual page-reload persistence must be tested in the main game, as above.

In the game: **J** opens Skill Tree, **I** opens Inventory. Drag with the left mouse button, use **Esc** to cancel, and retain **1–0** to activate the ten existing hotbar slots.
