# Gameplay HUD — direct interaction revision

The latest owner-supplied Padang Arunika screenshot is the master visual target. This revision replaces the earlier Edit HUD / Atur Hotbar workflow. Local implementation only; no deployment or original asset changes.

## Controls

- There is no HUD/hotbar edit mode, lock, unlock, or replacement toggle. Panels move directly via small dot grips or frame/header strips. Interactive content remains separate: slots, chat history/input/tabs, portrait, journal button, and minimap click actions retain their functions.
- Player, Quest, minimap/utility cluster, Chat, combined Q–primary–E cluster, and active Buff/Tempo are independently positioned and resize directly from all four corners. Corners show a diagonal resize cursor without persistent arrows or labels. Icon panels scale uniformly (50–180% of the global scale); expanded Chat changes width/height independently. The opposite corner stays fixed and the entire panel stays in the safe viewport. Escape cancels an active drag/resize without opening pause on that keypress. Blur, pointer cancel, viewport/scale changes, modal entry, and death cancel pending HUD gestures.
- Drag a learned active skill from Job Skill or a usable inventory item directly onto a slot. Existing validation rejects unavailable, passive, incompatible, and stale references. Existing deduplication swaps an already-assigned reference safely instead of duplicating it.
- Click an empty **+** to open the compact picker. One choice assigns immediately and closes it. Q/E use the same picker with their existing validation. Drag between slots to move/swap; right-click removes only the shortcut. Intentional drop onto the world background also removes a shortcut, retaining existing behavior.
- A click activates a filled slot normally. Binding drag starts after 6 px; HUD movement after 5 px. Release-click after a drag cannot cast or consume items. Hotkeys **1–0 / Q / E** remain unchanged.
- **Reset HUD** is a direct action in the hotbar header, resetting the six cluster positions, individual panel sizes, and Chat dimensions. Panel scales are saved in the existing HUD layout record; older records without scales retain default sizes. Assignments, character data, legacy dialog positions, and global UI scale are preserved.
- Chat starts expanded in the lower-left. Enter focuses it; Enter after typing sends locally and immediately releases focus. A second Enter with an empty or whitespace-only draft releases focus without sending, so gameplay resumes immediately. IME confirmation and held-key repeats do not dismiss the composer. Messages remain in Dunia/Semua and appear above the character for six seconds. Filters, unread, scroll anchoring, and local-only delivery retain the previous implementation. The minus button can compact chat for the current session.

## Presentation

At 1920×1080 / 100%: safe margin 34 px; Player 396×120; Quest 300×274 with a 24 px gap below Player; minimap 212 px in its 224 px cluster; Chat 454×226; Q–primary–E 1140×156; Buff cards 172×96. Quest retains the additional class information and journal button absent from the master screenshot, so its height accommodates those existing functions. Long quests scroll.

The hotbar centers in the viewport when space permits. At reference width it shifts just enough to sit beside Chat, matching the supplied bottom row. At larger UI scales Chat docks above it. Custom positions may overlap but stay within the viewport. The existing 50–150% scale remains available, with uniform compaction below 1920×1080. Larger displays retain desktop CSS sizes. Buffs grow leftward/upward in up to four columns, without a scroll container. Additional rows expand the measured cluster; the existing viewport fit keeps the entire tray reachable.

BuffTray presents a dedicated blue blade emblem for Tempo, three stack segments driven by actual engine values, and distinct framed skill/status icons. Titles and durations have separate space. Card ornaments stay inside the border, fixing the previous overflow that triggered scrollbars even for one Tempo card. This is presentation only; skill artwork, effect timing, and combat calculations are unchanged.

Deep emerald panels use thinner antique-gold borders, curled corner accents, smaller Player/Quest icons, a circular emblem and compact level badge, serif headings, and clean body/numeric text. Utility buttons are circular, currency stays compact, names can wrap inside slots, and Tempo's small progress bar uses its actual stack ratio.

No portrait bitmap exists in the current HUD assets; the portrait frame reuses the existing sword icon. Skill/item artwork, world graphics, and minimap contents retain their existing sources. No fabricated gameplay values, weather simulation, remote messages, or online status were added.

## Architecture and boundaries

GameplayHUD owns presentation and input coordination. HUDLayoutProvider retains anchor-relative normalized offsets and Chat dimensions in lumenfall:hud-layout:v1. Old positions remain available; viewport clamping never rewrites user preferences. Storage failure falls back to session state. UI scale, character save schema, and dialog layout storage are unchanged.

The pointer gesture hook owns capture, threshold, animation-frame updates, cancellation, and release-click suppression. The hud-drag input owner is active only during a gesture; chat and item-drag owners remain independent. No full-panel overlay intercepts interactive content.

PrimaryHotbar reuses entry resolution, cooldown overlays, action methods, and binding validation. The former engine hotbarEditMode field, setter, and mutation/cast gates are removed; assignment entrypoints instead validate lifecycle availability. These are UI interaction boundaries, not changes to combat, resource, cooldown, movement, skill, quest, or save calculations. canDrop retains an optional availability argument for isolated callers; production binding does not use a mode.

The one minimap canvas remains mounted across layout/fullscreen/scale/map transitions. The hotbar portal retains its elevated layer over Inventory/Job Skill, while confirmations remain above it. World HP/MP remains engine-owned and unchanged by this revision.

## Verification

Final run: **172 browser checks pass**, with zero browser runtime errors, including empty-chat Enter dismissal and immediate gameplay input, four-corner resizing, size persistence, Escape cancellation, and Tempo resizing/dragging. Typecheck and focused lint pass. The production build passed on the preceding resize revision; this small chat key-handler change was verified in the actual browser without another build.

Run node scripts/test-hud-browser.mjs for the real Home/Game regression in disposable Chromium storage against localhost. It never touches the owner's browser saves. The --bindings-only option narrows diagnosis to binding/lifecycle checks.

Coverage includes direct grips/frame dragging, gesture cancellation, input cleanup, local chat/idle focus, picker, Q/E, move/swap/remove/replace, sub-threshold clicks, no release-cast, save reload, actual potion use and skill damage, minimap identity, utility controls, buffs/Tempo, and death.

Visual matrix: 1366×768, 1672×941, 1920×1080, 2560×1440, 3440×1440 at 50/80/100/120/150%. Screenshots and final check results live in ignored output/hud-redesign/. The final field screenshot uses a disposable Blade Master/currency fixture to exercise real art and long gold values, without altering the owner's character.

Latest resize revision: **14/14 focused HUD geometry, chat, and input tests pass**, including opposite-corner anchoring, proportional sizing, viewport limits, old-layout compatibility, independent scale persistence, and trays with 13–20 effects. The earlier hotbar, quick-hotbar, drag/drop, drag geometry, UI layout/scale baseline was **47/48 pass**. Its pre-existing canonical visual test fails for berserker-fury, blade-master-tempo, berserker-capstone, and blade_master-capstone; unrelated asset definitions were not changed.

Typecheck, focused lint, and production build pass. Build retains its existing large-chunk and Vinext route-classification warnings. Whole-repository lint has pre-existing prefer-tag-over-role findings in character-preview.tsx and tests/browser/blade-master-offhand-ui.tsx; those files are unchanged.
