# World entry loading regression — 2026-09-17

## Cause

Version 74 waits for region preparation before starting simulation. Normandy
decoration failures were accidentally promoted to fatal region errors. Its
runtime files existed locally but the entire source library was ignored by Git,
so a source-based cloud build omitted them. Online grass/rock GLBs returned 404;
the character GLB returned 200. Continue/Enter World caught the region error and
returned to Main Menu.

## Fix

- Settle Normandy mesh requests individually. Successful decorations remain;
  failed visual-only decorations warn without setting `regionLoadError`.
- Keep the existing required character, imported terrain and tree/collision
  readiness gates. No simulation/autosave starts while these are loading.
- Publish the seven GLBs used by the existing layout and their seven mapped
  textures explicitly, not the entire Unreal export library.
- Preserve GLB bytes, placement, scale and materials. Runtime texture copies
  use full-resolution WebP: six lossless, stone near-lossless quality 90 because
  its lossless file exceeds the host's 25 MiB per-file ceiling. Original PNGs
  remain untouched. Fourteen runtime assets total 100,031,506 bytes.
- No changes to save schema/data, combat, equipment, progression or menu design.

## Repeatable checks

`scripts/prepare-normandy-runtime.mjs --check` validates runtime file sizes,
embedded GLB dependencies and Git tracking so a remote build has the files.
Run without `--check` only to regenerate WebP copies from the local source PNGs.

`scripts/check-world-entry.mjs` uses a fresh browser context per case, never the
player's profile. `WORLD_TEST_URL` chooses the local or published origin.
Checks Continue, Load → Enter World, one missing decoration, all missing
decorations, essential character failure, pause/return, save identity/level/
gold/inventory retention, uncaught errors and all fourteen asset responses.
Reports and screenshots stay in `output/world-entry-qa/<hostname>/`.

Local regression: 35 assertions passed. The required character failure still
blocks entry safely; optional decoration failures do not. Production build and
deployed-origin verification must also succeed before completion is reported.
