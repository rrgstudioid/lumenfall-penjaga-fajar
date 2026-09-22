# Forge Master / Enhancement

Implemented locally on 11 September 2026. Not published.

## Access

- Kota Arunika: **Empu Wira** (`aruna-3`).
- Kota Jayantara: **Empu Niskala** (`jaya-2`).
- Click the nearby NPC → **Tempa** → select equipment → review preview → **Konfirmasi Tempa**.
- Inventory and Character no longer offer direct enhancement. Rune installation and Rune Optimizer remain in their existing menus.
- The engine validates the actual city NPC, interaction distance, active NPC session, and living/started character. Closing the panel, changing region, changing character, respawning or reloading invalidates forge access.
- Juru Segel retains existing Rune/Seal services but cannot open equipment enhancement.

## Existing systems preserved

The dedicated panel reads the player's existing inventory and equipment IDs. It uses the existing enhancement preview, stat calculator, item icon catalog, rarity colors, Rune data and character save system. There is no secondary equipment store or gameplay save schema.

Equipment, material quantities and slot references update immutably. Missing materials, locked gear, max enhancement and stale confirmation are rejected before spending. Results save on both successful and failed attempts.

The existing material-only economy and rates are preserved: **0 GOLD** extra fee, maximum **+12**. Iron is used at +0–2, Titanium at +3–5, Vibranium at +6–8, Meteorite Core at +9–11. Fate Rune Fragment adds 8 percentage points and is consumed on every attempt. Eternal Seal is consumed only on a failed attempt it protects. Locked materials/support items are not used.

**Risk:** without a Seal, failure below +8 downgrades by one (minimum +0); failure at +8 or higher destroys the equipment, including attached Rune. This is existing game behavior, not a new penalty. The dedicated confirmation explicitly warns about it. Successful enhancement does not change base stats, rarity, affix rolls, sockets or optimizer history; the existing enhancement multiplier is applied by the shared stat calculation.

## UI fixes

The old flow opened a confirmation in Inventory, defaulting to the equipped weapon and providing limited material feedback. Browser testing also reproduced a nested-window defect: the parent could cover a reopened confirmation, intercepting clicks. The shared draggable wrapper now restores focus when retained dialogs reopen, ignores events bubbled from child portals, and does not animate pointer-driven position changes. Existing positioning, scale and layout persistence are retained.

## Files for this change

- `app/page.tsx`: NPC entry point, dedicated panel, removed direct inventory actions.
- `app/forge-panel.css`: panel styling and responsive layout.
- `app/interface-scale.css`: immediate pointer-driven window positions.
- `components/game/forge-panel.tsx`: equipment list, stats, costs, risk, confirmation and results.
- `components/game/character-overview.tsx`: remove misleading direct Tempa label.
- `components/game/draggable-window.tsx`: nested-dialog focus and reopening fix.
- `lib/game/regions.ts`: canonical city Forge Master access validation.
- `lib/game/rules.ts`: guarded, immutable enhancement transaction and preview.
- `lib/game/world.ts`: ephemeral NPC forge session, transaction, save/re-render.
- `lib/game/forge.test.ts`: 12 new logic tests.
- `scripts/test-forge-browser.mjs`: isolated browser regression suite.

Previous terrain/map changes in the worktree were preserved.

## Verification

- 163 / 163 game logic tests passed, including the 12 new enhancement tests.
- 20 / 20 browser scenarios passed in a disposable Chrome context using a separate test save.
- Browser scenarios cover both Forge Masters; rejected access without an NPC/in fields; no inventory shortcut; repeated confirmation/Cancel; successful weapon and armor enhancement; locked/max gear; material shortage; Fate/Seal consumption; failure downgrade; preserved Rune/optimizer; reload; Escape; and dragging.
- Responsive checks: 1440×960 initial viewport, plus 1366×768 and 1920×1080 at UI scale 75%, 100% and 150%.
- No browser console/runtime/hydration errors or failed asset HTTP requests.
- TypeScript and lint on changed source/test files passed.
- Production build passed. Existing large-bundle (>500 KB) warning remains.
- Browser screenshots/results are in `work/forge/` (local QA output, not game assets).

Only local code was updated; publishing requires a separate request. The player's real browser saves were not used by tests.
