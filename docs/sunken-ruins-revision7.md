# Sunken Ruins revision 7: wall, G7, population, and Deep Ocean

Local development revision, 9 October 2026. This supersedes the grid, population, wall height, and Deep Ocean environment described in [revision 6](sunken-ruins-deep-ocean.md). No publication or new paid asset generation.

## Terrain and portal

The owner confirmed an **8 x 8 grid**, A-H west to east and 1-8 north to south. Deep Ocean's Sunken portal now sits at the centre of **G7: `(312.5,312.5)`**, outside the retaining wall. Returning from Deep Ocean places the player at `(312.5,322.5)`, clear of the portal's 4.5-unit click interaction area. Deep Ocean entry remains `(0,320)`, with its return gate at `(0,350)`.

**Sunken Ruins terrain was preserved.** The original four terrain support pads are fixed independently of live portal positions, including the old pad at `(150,150)`. Moving the portal therefore does not create a raised inlet, alter a slope, move the wall contour, or reshape the seabed. A before/after comparison of 10,201 samples across the playable square found zero changed heights and zero changed floor-distance values. Evidence: `output/sunken-ruins/revision7/terrain-invariant.json`; baseline: `work/sunken-ruins/revision7/terrain-baseline.json`.

The existing wall follows the same contour and eight openings. Its height increased from 6 to **18 world units**, with the existing slight top variation. Render walls, collision heights, and camera blockers share that height. Player navigation through the openings and across the outer slope remains available.

## Hunting population

The population increased from 177 to **324: 306 normal, 17 elite, and one boss**. Density follows sampled collision-free hunting area in each zone, excluding safe arrivals, landmarks, reserved clearings, and the boss arena. Homes remain at least 24 units apart and inside the wall with a 24-unit contour margin. The area estimate uses valid, jittered 16-unit grid samples; it is not an exact mesh area calculation.

| Zone | Sampled hunting area, square world units | Normal + elite homes |
| --- | ---: | ---: |
| Coral Entrance | 90,880 | 75 |
| Sunken Pathway | 93,696 | 78 |
| Ancient Ruins | 126,976 | 105 |
| Deep Abyss | 54,528 | 45 |
| Abyssal Throne surroundings | 25,088 | 20 |

The boss is additional to the table. Species and levels remain Drowned Warrior 32, Drowned Soldier 33, Leech Wraith 37, Ruin Guardian 40, Sunken Sentinel elite 42, and Abyssal Leviathan boss 42. Existing combat, loot, EXP, cooldown, and respawn formulas are unchanged.

Monsters use a dedicated navigation predicate and routing graph that stay inside the wall. Chase, return, and displacement use this navigation; respawns use the validated homes. Players outside the wall are safe from aggro. Decorative marine life does not participate in combat collision. Browser checks passed swept outward displacement at all eight wall openings and an actual chase/return sequence: the enemy chased 3.675 units, then returned within 0.955 units of home when the player crossed outside, despite the player remaining within its 10-unit aggro distance. Every sampled enemy position stayed inside and navigable.

## Deep Ocean and minimap

Deep Ocean now renders **sand only**, plus the functional return portal's energy effect. It loads no coral, flora, fish, jellyfish, rays, ruins, rocks, artifact kit, shafts, or ambient particle population. Its portal has no stone arch. Runtime metrics confirmed zero decoration instances, kit geometry, PBR resources, and reef colliders, with zero monsters. The floor baseline is -180; arrival is approximately **Y=-184.126** and the trench reaches approximately -250. The deeper terrain change applies only to Deep Ocean.

Both minimaps sample their actual terrain height functions with depth and slope shading. Sunken's walls use the same segments and gaps as rendering; solid reefs, landmarks, and artifact footprints remain visible. The HUD's old 7 x 7 overlay is suppressed on these two maps so it cannot overlap the authoritative 8 x 8 grid. Other maps retain their existing overlay. G7 is visibly outside the wall. Monster dots are smaller on Sunken to keep the terrain legible.

## Validation

- **62/62 relevant Node tests passed**, covering Sunken, field expansion/travel, rules, and camera follow/zoom.
- Final **TypeScript check, lint, production build, and `git diff --check` passed**. Build retains the informational vinext route-classification notice and npm's existing project-config warning.
- Chrome runtime checks passed G7 click travel, correct return spawn, Deep Ocean save/reload, follow/free movement, and empty Deep Ocean environment metrics.
- Normal, elite, and boss targeting, kills, EXP/gold/loot, saved respawn deadlines, and respawn passed.
- All eight wall openings, six prior clearings, four outer bounds, retained reef/ship collision, and slope position reload passed.
- Lifecycle checks passed level 31 lock / level 32 access, the three original portal destinations, recovery of land animations, failed-load Retry, respawn, both character models and equipment attachments, and 32 camera views. Three repeated visits each recorded **139 uploaded geometries / 17 textures** at the entry; this is a resource count, not VRAM usage.
- HUD checks confirmed only the map's own grid in both underwater maps and restoration of the old overlay in Jayantara. No browser page errors occurred in these successful runs.

### Short performance check

Chrome 155, NVIDIA RTX 3060 Laptop GPU, 1280 x 720, DPR 1. Each preset used a 10-second warm-up and three 10-second captures: two traversals and one crowded scene, rendered sequentially. All six captures reported no page errors.

| Preset | p95 frame time | p95 CPU submission | p95 draw calls | p95 triangles |
| --- | ---: | ---: | ---: | ---: |
| Low | 16.9-17.0 ms | 4.7-5.4 ms | 46-151 | 70,784-274,638 |
| Ultra | 16.9-17.0 ms | 5.8-6.5 ms | 49-196 | 144,872-610,444 |

These are smoke measurements, not a new full three-by-60-second comparison with Verdant and Whispering. CPU submission is not GPU timing; geometry/texture counts are not memory bytes. No claim about other hardware follows from these samples.

## Files and evidence

Runtime changes are in `underwater-regions.ts`, `sunken-ruins-layout.ts`, `sunken-ruins-wall-mesh.ts`, `sunken-ruins-population.ts`, `deep-ocean-layout.ts`, `sunken-ruins-map.ts`, `sunken-ruins-terrain.ts`, `sunken-ruins-materials.ts`, `field-layout.ts`, `regions.ts`, `world.ts`, and `components/game/hud/gameplay-hud.tsx`. Browser fixture expectations and `sunken-ruins.test.ts` were updated for the new layout/population.

Evidence is under `output/sunken-ruins/revision7/`:

- `g7-portal.png`, `retaining-wall.png`, `sunken-minimap.png`, `sunken-minimap-hud.png`.
- `deep-ocean-landing.png`, `deep-ocean-trench.png`, `deep-ocean-hud.png`, `deep-ocean-minimap.png`.
- `deep-ocean.json`, `hunting.json`, `clearings.json`, `lifecycle.json`, `hud-and-containment.json`, `terrain-invariant.json`, `performance-smoke.json`.
- `unit.log`, `typecheck.log`, `lint.log`, `build.log` and the browser logs.

Original source assets and the legacy Sunken field remain intact. Existing revision-6 asset acceptance limitations are unchanged and documented in that report.
