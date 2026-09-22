# Padang Arunika — Grass Medium 01

Source: user-supplied `grass_medium_01_4k.blend.zip`. Local-only update; not published.

The source is an alpha atlas of grass blades and tufts, not a seamless ground photograph. Its green diffuse, alpha, OpenGL normal and roughness maps are used. The dry diffuse variant is not used. The source ZIP and extracted Blender file remain untouched; this update processes the supplied texture data, not a Blender re-export of the complete model.

## Application

- Ground: an opaque tile baked from 2,600 overlapping, rotated source tufts, wrapping stamps across tile edges. RGB, alpha, normal orientation and roughness follow identical stamp placements. This replaces only the old green grass layer, with 4.8-world-unit tiling and moderate normal strength 0.32.
- Raised grass: the existing 781 instanced grass positions now use three crossing alpha-cutout cards per tuft, sampling source atlas regions. Each tuft remains six triangles within a 0.44 × 0.7 footprint. Two-sided lighting is biased toward sky illumination so thin cards do not shade like dark walls. No emissive/glow effect is used.
- The rocky textures, spatial mask, rocky strength, road material and terrain geometry are unchanged. No new grass placements, terrain displacement, collision edits or gameplay changes.
- Texture load failure preserves fallback materials. Loading is cached, retriable, and guarded against applying to disposed objects.

## Runtime files

Under `public/assets/materials/terrain/arunika/grass-medium-01/`:

- `grass_ground_color_2k.webp`: 2048² opaque color, sRGB.
- `grass_ground_normal_rough_1k.webp`: 1024² linear normal RGB + roughness A.
- `grass_tuft_color_alpha_2k.webp`: 2048² source color + cutout alpha, sRGB.
- `grass_tuft_normal_rough_1k.webp`: 1024² linear normal RGB + roughness A.
- `manifest.json`: provenance and material settings.

EXR rows are corrected to top-down and filtered normals are renormalized. Packed normal/roughness is lossless, unpremultiplied data; its alpha is roughness, not opacity. The ground-color WebP uses quality 94. The original 4K sources remain in the supplied ZIP. Intermediate 2K normal/roughness masters are retained under `work/grass-medium-source/`, outside runtime assets.

The four active files add 10,108,150 bytes (~9.64 MiB) of download and approximately 53 MiB of uncompressed GPU texture storage including mipmaps. Shared caching avoids repeated downloads on region visits. There are additional terrain shader samples, but no additional draw calls or triangles in the tested scene.

## Code and verification

- New: `lib/game/arunika-grass-material.ts`, `scripts/prepare-arunika-grass.mjs`, `lib/game/arunika-grass-material.test.ts`, assets and this note.
- Updated: `lib/game/arunika-terrain-material.ts`, the grass-only integration in `lib/game/field-terrain-renderer.ts`, and the existing material/browser regression tests.
- 17 focused tests passed. Vertex/index layout, grass instance transforms, fallback/retry, bridge traversal and tree collision remain valid.
- Actual localhost checks: movement, bridge crossing, NPC opening, travel to Kota Arunika / East Gate / Tambang and return passed. Other tested regions remain unchanged. No JavaScript, shader or WebGL errors.
- Test scene: 781 grass tufts, 6 triangles each; 6,144 terrain triangles; 664,782 total scene triangles; 242 draw calls (unchanged). Median local frame time ~16.7ms, p95 ~16.8ms. This is a short desktop test, not a guarantee for mobile hardware.
- Production build passed. The three existing unrelated TypeScript errors in `items.ts`, `ui-layout.ts`, and `tests/browser/real-components.tsx` remain; no new errors were introduced.
- Actual game captures: `work/arunika-material/grass-after-entry.png`, `grass-after-detail.png`, `grass-after-tufts.png`. Browser results: `grass-after-results.json` in the same folder.
