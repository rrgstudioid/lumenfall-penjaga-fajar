# Padang Arunika — material overhaul

Applied to the local Lumenfall project, 16 September 2026. Region: `verdant-plains` only. Not published.

## Updated groups and names

All new surface names use the `arunika.` prefix.

| Objects | Material names | Treatment |
| --- | --- | --- |
| Existing dirt paths | `path_dirt` | Compacted warm earth, dry/dark patches, small stones, roughness and shallow shader relief. Uses the original road mask and blended edges. |
| Boulders / coastline / distant crags | `rock_natural`, `cliff_rock`, `distant_rock` | Mineral variation, weathering, restrained seams and moss. Distant geometry has broad color variation only, without bump detail. |
| Candi, stairs, foundations, gate bases and ruins | `temple_stone` | Carved block joints, individual block tones, fine surface weathering. Separate from natural rock. |
| Bridges, railings, buildings, crates, cart, signposts | `wood_planks`, `wood_beams`, `wood_props` | Directional grain, board seams, distinct structural and worn timber. |
| Gate/building/tower roofs | `roof_tiles` | Staggered terracotta tile rows, curved shading and softened joints; no recolored wood. |
| Stream / pond / falls / outer sea / splash shapes | `water_river`, `water_pond`, `waterfall`, `distant_water`, `water_foam` | Differing flow speeds, ripples, depth/shore tint, restrained foam, roughness and stylized grazing-angle sky reflection. Existing bridge footprints suppress water above the deck; no geometry or collision edits. |
| Tents and hanging banners | `fabric_canvas`, `fabric_banner` | Fine woven detail, soft fold shading, matte cloth and banner trim. |
| Cultivated plots and crop rows | `soil_tilled`, `crop_foliage` | Dark fertile soil with furrows; green/gold foliage response instead of tinted rock. |
| Small flowers | `flower_foliage` | Petal/center tones and position-based color variation, within existing instances. |
| Existing campfire | `fire_effect`, `embers`, `wood_props` | Animated orange flame with broken opacity, glowing embers, separate charred fuel. |
| Sanctuary, crystal and travel rings | `shrine_stone`, `crystal_material`, `portal_effect` | Aged sacred stone, pulsing inner crystal light, animated energy and rune bands. |

## Preserved

- All existing triangles, world transforms, instance placements and field layout data match the recorded pre-change snapshot (position precision 0.0001 world units).
- Terrain remains 6,144 triangles; grass remains 781 instances with six triangles per tuft; enemy population remains 42.
- Existing Rocky Terrain 02 and Grass Medium 01 textures, proportions and asset files are unchanged.
- Stylized Tree and Unreal Normandy imported assets are not overwritten.
- Roads, buildings, props, NPCs, bridges, quest and combat code, navigation and colliders are not moved or redesigned.
- Original sanctuary materials are restored when leaving Padang, including repeated visits. Other region material assignments remain unchanged.
- Only additional geometry: eight tiny ember quads and three short decorative fuel logs inside the existing campfire ring. These do not participate in interaction or collision.

## Rendering and performance

- No new image downloads, texture dependencies, reflection render targets, dynamic lights, shadow maps or post-processing.
- Surface details are procedural and use existing standard lighting. Height detail is shading only, not displacement.
- Materials are reused by family/tint; 37 instances cover 23 surface families plus the dirt layer in the existing terrain shader.
- Animated surfaces share one region-owned time value updated by the existing frame loop. No extra animation loop or global timer.
- Transparent single-layer water/ember surfaces avoid an unnecessary back-face prepass. Distant rocks use a simpler shader.
- Comparable overview in isolated desktop Chrome: draw calls increased from 242 to 250 (+8, approximately 3.3%). Short frame samples stayed around 16.7 ms (roughly 60 FPS). This is a refresh-limited local measurement, not a guarantee for mobile devices or busy combat.
- More shader programs are compiled on the first visit. Existing texture memory costs from the approved rocky/grass assets are unchanged.

## Validation

- 21 focused material, terrain, navigation, population, grass and tree-collision tests passed.
- Geometry/layout snapshot comparison passed for Padang and East Gate; East Gate material assignments unchanged.
- Browser checks: movement, bridge crossing, NPC panel, travelling to Arunika / East Gate / Ironveil and back passed.
- Visible animation verified by rendering identical scenes at two material-clock values: campfire, gate ring, pond, sanctuary.
- No browser console/runtime/shader errors in the checked views. Normal and roughness changes verified with image comparisons. Rendering also checked with shadows disabled.
- Production build passed. Whole-project typecheck still reports three pre-existing unrelated errors in `items.ts`, `ui-layout.ts`, and `tests/browser/real-components.tsx`; this pass does not change those files.
- Screenshots and reports are in `work/arunika-material/overhaul-complete-*`.

## Geometry limitations

This is deliberately a material pass, not a remodeling pass. Distant cone-shaped hills, coarse angular boulders, the triangular tent body, straight box-shaped crop rows, geometric flowers and the original cone-shaped flame envelope still have their existing silhouettes. Material detail cannot turn those silhouettes into sculpted terrain, individual leaves or realistic fabric folds. The waterfall remains partly obscured by the existing coastline geometry; its placement is not changed. The shallow pond uses an approximate shoreline depth tint, not a depth-buffer simulation. Water reflection is a lightweight stylized lighting approximation, not a real reflection of surrounding objects. Flames/portals are emissive but no bloom or additional light casting was added. Optional flag wind and smoke were left out to keep this pass focused and lightweight.
