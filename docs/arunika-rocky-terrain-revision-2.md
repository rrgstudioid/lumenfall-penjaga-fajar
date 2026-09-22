# Padang Arunika — Rocky Terrain 02, revision 2

Local rendering-only revision. No publishing, layout edits, new meshes, displacement, collision changes, gameplay changes, or save migration.

## What changed

- `lib/game/arunika-terrain-material.ts`: replaces the weak, green-tinted overlay with full-strength rocky patch interiors. Albedo blending runs after vertex color. Normal and roughness use the same patch mask and matching texture coordinates. All data maps are linear; albedo is sRGB. Grass uses continuous procedural detail instead of the old square-block texture. Roads retain their existing centerlines and two-unit half-width, with soft edges and subtle dirt detail.
- `lib/game/arunika-terrain-mask.ts` (new): authoring-time spatial mask based on layered value noise, existing path distance, rock-prop proximity, height, slope and cliff distance. Does not modify the terrain definition.
- `scripts/prepare-arunika-terrain.mjs` (new): reproducible conversion from the supplied ZIP, preserving the source archive. EXR rows are corrected to top-down; each 2K output pixel averages four source pixels. Normal vectors are renormalized. It also bakes the mask, avoiding a roughly 700ms runtime generation stall.
- `lib/game/arunika-terrain-material.test.ts` and `scripts/check-arunika-material-browser.mjs` (new): targeted regression tests and isolated-browser visual/lighting checks. No player browser profile or save is used.
- `public/assets/materials/terrain/arunika/rocky-terrain-02/manifest.json`: updated runtime paths and truthful spatial coverage.

## Runtime assets

| Asset | Resolution | Purpose |
| --- | --- | --- |
| `rocky_terrain_02_diff_2k.jpg` | 2048² | Existing source albedo, reused unchanged |
| `rocky_terrain_02_nor_gl_2k_v2.webp` | 2048² | Corrected OpenGL normal; lossless |
| `rocky_terrain_02_rough_2k_v2.webp` | 2048² | Corrected roughness; lossless |
| `arunika_surface_mask_v2.webp` | 512² | Spatial layer weights and macro variation; lossless |

The three WebP files are new. Earlier PNG conversions remain on disk but are no longer requested by the material. All runtime images are top-down and loaded with `flipY=true`.

- Tile size: 12 world units. Offset sampling with the same coordinates for all PBR channels reduces repetition without rotating normal vectors incorrectly.
- Normal strength: 0.58, applied only within rocky patches.
- Rocky roughness: 0.76–0.98; grass/road roughness: 0.94; metalness: 0.
- Mask coverage by world-area samples: 28.19% rocky-dominant, 58.67% grass, 5.67% road, 7.47% transition. The road percentage reflects the existing layout, not artificially enlarged roads.
- Patch interiors reach 100% rocky contribution. Coverage is not an opacity limit.
- Material and texture requests are reused. Failed texture loads retain the original material and permit a subsequent retry. Disposed terrain is not modified when pending loads resolve.
- No true displacement, subdivision, extra terrain meshes, extra terrain draw calls, global lighting changes or effects.

## Verification

- 15 targeted tests passed: layer mask, fallback/retry, region isolation, unchanged vertex/index buffers, terrain traversal, bridge/coast collision, population, expansion and tree collision.
- Actual localhost game rendered without JavaScript/shader errors.
- Same-camera before/after images: `work/arunika-material/before-detail.png`, `after-detail.png`, plus entry and overview views. These are game renders, not generated illustrations.
- Pixel comparison with the normal disabled changed 128,870 pixels in the tested crop. Substituting an independent roughness texture changed 167,235 pixels. This verifies both maps affect lighting; it is not a visual-quality score.
- Shader also rendered with shadows disabled; WebGL error code was zero.
- Runtime movement, bridge crossing, NPC opening, travel to Kota Arunika / East Gate / Tambang and return to Padang passed. Other tested regions did not have the new material ID.
- Terrain remains 6,144 triangles. The tested overview remains 242 draw calls and 664,782 total scene triangles.
- Median frame interval in the same local test was approximately 16.7ms before and after (~60 FPS), with final p95 approximately 16.9ms. This is a short local desktop test, not a guarantee for mobile devices or all camera views.
- Active material downloads total 10,271,457 bytes (~9.80 MiB), down from 15,313,397 bytes. GPU texture memory is not reduced by WebP: 2K textures with mipmaps are approximately 64 MiB combined, plus ~1 MiB for the mask. Offset sampling adds texture lookups, but no geometry or draw calls.
- Production build succeeded. Type checking still reports the three pre-existing errors in `items.ts`, `ui-layout.ts`, and `tests/browser/real-components.tsx`; none originates in this revision.

Regenerate the surface mask with the preparation script if the terrain layout changes in a later task. Its exported coverage must be kept in sync with the material configuration and manifest; the regression test checks the configured coverage.
