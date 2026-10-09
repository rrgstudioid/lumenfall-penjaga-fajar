# Sunken Ruins — local development preview

Visual revision 2 and its current validation are documented in [sunken-ruins-visual-revision.md](sunken-ruins-visual-revision.md). The original performance/asset figures below describe the first accepted implementation, not the newer marine kit and textures.

Implemented for the approved environment/swimming stage. Open the local development game, press **M**, and select **Sunken Ruins** with a level 32+ character. Level 31 remains locked. The original **Reruntuhan Tenggelam** field is unchanged.

The new ID is `sunken-ruins-underwater-v1`. Production omits its registry entry, dynamic map loader and asset-serving middleware. A development save opened in production returns to Kota Jayantara while retaining character progression. Nothing has been published.

## Runtime and layout

`lib/game/sunken-ruins-layout.ts` owns the 1000 × 1000 design, five zone anchors, nine connected routes, three gates, safe areas and structural collision footprints. North is −Z; design coordinates map to `(u − 500, v − 500)`. The visible seabed, navigation, placement and minimap consume this data.

| Integration | Changed files |
| --- | --- |
| Registration and M access | [regions.ts](../lib/game/regions.ts), [page.tsx](../app/page.tsx) |
| Map lifecycle, movement, combat presentation and portals | [world.ts](../lib/game/world.ts), new `sunken-ruins-*` modules |
| Swimming and attachment order | [character-animation.ts](../lib/game/character-animation.ts), [character-model.ts](../lib/game/character-model.ts), [underwater-motion.ts](../lib/game/underwater-motion.ts) |
| Large-map saves and empty/safe preview population | [rules.ts](../lib/game/rules.ts), [field-layout.ts](../lib/game/field-layout.ts) |
| Local assets and authoring | [vite.config.ts](../vite.config.ts), [sunken-dev-assets.ts](../scripts/sunken-dev-assets.ts), [build-sunken-kit.py](../scripts/build-sunken-kit.py) |
| Verification | `lib/game/sunken-ruins.test.ts`, corrected `character-model.test.ts`, `tests/browser/sunken-*`, `scripts/test-sunken-*`, export/report scripts |

| Zone / gate        | World X, Z | Behavior                                            |
| ------------------ | ---------- | --------------------------------------------------- |
| Coral Entrance     | 45, 225    | Menu arrival and respawn, outside portal activation |
| Sunken Pathway     | −100, 100  | Southwest junction                                  |
| Ancient Ruins      | 45, −90    | Largest clearing and ruins                          |
| Deep Abyss Section | −245, −220 | Blue/purple western clearing                        |
| Abyssal Throne     | 45, −370   | Empty northern arena with a smooth raised platform  |
| Southern exit      | 45, 350    | Kota Jayantara at 0, 8                              |
| Southwest warp     | −350, 200  | Kota Jayantara at 0, 8                              |
| Northeast warp     | 340, −325  | Whispering Wilds at 90, 410                         |

Portals require a click within the existing 4.5-unit interaction radius. Gate supports collide; the opening remains traversable. No proximity-only teleport or self destination is registered. Ordinary preview population, boss, quests and reward tables are empty.

The map contract includes root/surfaces, bounds, entry, navigation, ground height, update, minimap, quality, metrics and disposal. Swept horizontal collision also serves skill movement and fixture monsters. The bounded local A* router handles obstacles within the existing monster home leash. It is not a new world-scale hunting/navigation system.

The original modular kit supplies coral, vegetation, rocks, ruins, portals and decorative wildlife. Placement is deterministic, instanced by geometry/material and 64-unit sectors; terrain uses 50-unit chunks. The full map contains 131 sectors, 184 terrain chunks and 18,154 static instances. Coral density stays full in nearby sectors and decreases smoothly between sector-center distances of 90 and 200 units; the far density is 25/35/45/55% for Low/Medium/High/Ultra. Instance ordering is spatially scattered so LOD does not remove entire rows. Light shafts, jellyfish and portals use bounded transparency; fish use instanced motion rather than combat AI. Caustics and vegetation deformation run in map shaders. Low keeps coral and caustics, reduces ambience and disables dynamic shadows. The existing preset IDs remain unchanged.

Near tall structures, a segment/proxy test retracts the existing camera orbit. It never raycasts all decorative geometry during gameplay. Map-owned geometry, materials, instance buffers and ambience are explicitly disposed on departure or a stale/failed load.

## Swimming and combat

`CharacterMotion` accepts optional movement mode, local movement direction and yaw change. `underwater-motion.ts` composes a procedural swimming pose onto existing actions, with a 0.2-second transition. The visual body floats; the actor, collision radius, attack clocks and navigation remain grounded in X/Z. Native Walk/Run and native ground attacks are suppressed while swimming; the existing retargeting binding synchronizes equipment after the final pose.

Idle, forward, backward, side, turn, attack, casting, dodge, parry, hit and death presentations are exercised on the loaded male modular V2 and female models. There is no vertical movement control or permanent underwater save flag. Mode is derived from the active map. Land native locomotion resumes after leaving.

The localhost-only browser fixture replaces both browser storage objects with in-memory storage before loading the application. It can create two normal monsters, one elite and one existing boss for tests; none are registered in the preview population. It tests registered Adventurer, Warrior, Berserker, Blade Master, Thief, Rogue, Assassin, Hunter, Wizard and Acolyte configurations. Temporary loadouts and deterministic random values isolate map presentation from existing combat calculations.

No job formula, skill definition, public combat API or `adventurer-v3.ts` is changed. Horizontal range validation uses actor coordinates. Assassin projectiles use visual hand sockets underwater; target picking and labels account for monster hover, while target rings and ground effects remain on the navigation surface. Incoming damage text is rounded like outgoing damage text; HP still receives the original calculated value. Fixture deaths explicitly skip rewards and progression, avoiding any lookup into the preview's empty loot tables.

## Assets and provenance

Blender MCP was activated and inspected against the separate work file **`work/sunken-ruins/Sunken_Ruins_Kit.blend`**. The existing city source and original assets were not opened for modification. Blender 5.2.2 LTS was used. The installed addon uses protocol 7 while the MCP server reports 13; the scene, Python execution and viewport operations used here worked through the available fallback path. No addon upgrade was required.

| Output                                                          | Source / author                                                                            | Rights and modifications                                                                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev-assets/sunken-ruins-underwater-v1/kit.glb` (388,568 bytes) | Original project geometry created by `scripts/build-sunken-kit.py` for this implementation | Blender primitives, bevels, vertex colors and joined prototypes; glTF export. No third-party asset dependency. Distribution terms remain with the project owner. |
| `dev-assets/sunken-ruins-underwater-v1/manifest.json`           | Same generator                                                                             | Per-model triangle counts, dimensions, source, author and rights record                                                                                          |
| `work/sunken-ruins/Sunken_Ruins_Kit.blend` (148,033 bytes)      | Same generator                                                                             | New authoring/gallery file, separate from original source scenes                                                                                                 |
| Runtime placement and materials                                 | `sunken-ruins-map.ts`, `sunken-ruins-materials.ts`, `sunken-ruins-vfx.ts`                  | Original code and deterministic placements; no external texture downloads                                                                                        |

The 17 prototypes are branching/fan/plate/tube coral, seaweed, kelp, reef rock, pillar, broken pillar, arch, slab, broken wall, oceanic statue, trident, fish, jellyfish and ray. Geometry ranges from 20 to 572 triangles per prototype. The kit uses vertex colors and runtime materials, with no texture atlas or compression-loader dependency.

`dev-assets/sunken-ruins-underwater-v1/placements.json` contains the actual 18,154 runtime transforms and linear RGB colors in 827 instance groups (2,108,607 bytes). It is exported by `scripts/export-sunken-placements.mjs` from the authoritative runtime, not a second placement algorithm, and is a review/export artifact rather than a required network download. Its kit SHA-256 is `7c980006f502fdf12c5d5056bc229b688704aba7eccde76d45b51394ecf2ec16`.

Generated files live in the repository's existing ignored `work/` and `dev-assets/` directories. The generator is tracked. To regenerate, open a **new empty Blender file**, name the scene with the `Sunken Ruins` prefix, then run `scripts/build-sunken-kit.py`. The script refuses to modify a different saved Blender file. It exports both the kit and a gallery work file. `/__sunken-dev/kit.glb` is served only by the Vite development middleware; it is never copied into `public/` or production output.

## Reproducing validation

Run the fixture server separately:

```powershell
node node_modules/vite/bin/vite.js --config tests/browser/vite.config.ts
```

Open `http://127.0.0.1:3002/sunken-ruins.html`. Optional fixture parameters include `?gender=female`, `?level=31&map=sunken-ruins`, and `?map=verdant-plains-v2`. This page uses disposable saves and is intended only for local review.

```powershell
node scripts/test-sunken-browser.mjs
node scripts/test-sunken-lifecycle.mjs
node scripts/test-sunken-zones.mjs
node scripts/test-sunken-performance.mjs
node scripts/export-sunken-placements.mjs
node scripts/report-sunken-performance.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/oxlint/bin/oxlint
node node_modules/vinext/dist/cli.js build
```

The browser runners use Chrome and the existing Codex Playwright installation; set `PLAYWRIGHT_MODULE` to a different installed Playwright entry point when needed. Do not run browser/GPU benchmarks concurrently. `SUNKEN_MAPS`, `SUNKEN_QUALITIES`, `SUNKEN_SAMPLE_SECONDS` and `SUNKEN_REPORT` can select shorter diagnostic runs; the acceptance comparison uses the default 60 seconds, all three maps and all four presets.

Test evidence is written to `output/sunken-ruins/`: combat parity, lifecycle, per-zone screenshots, the overview, menu/portal/Retry screenshots and benchmark JSON. These are local review artifacts and remain excluded from publication.

## Final validation record

| Check                           | Result                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Relevant unit/regression suites | 97/97 passed: character models, retargeting, layout, camera, targeting, rules/save, hotbars and input ownership                                                                 |
| Combat parity                   | 223 comparisons across 10 job configurations; 116 accepted actions, 107 matching rejections; no differences in damage, mana, healing, cooldown, attack timer, buffs or statuses |
| Defensive/critical parity       | Hit, guard, parry, evade, death and forced critical outcomes match the ground fixture                                                                                           |
| Monster lifecycle               | Both normal monsters, elite and boss chase around a pillar, attack, return, die and respawn on valid ground; zero rewards/progression from fixture deaths                       |
| Loaded male/female animation    | 11 visual states each; finite skinned vertices, feet above seabed, both dagger grips attached, no native ground clip active underwater                                          |
| M / travel                      | Level 31 locked, level 32 open; three clickable portals arrive at exact destination spawns; Run resumes with zero swim weight on land                                           |
| Failure/recovery                | Aborted GLB request locks movement; Retry succeeds; actual page reload retains northern position; respawn returns to Coral Entrance                                             |
| Camera                          | 32 sampled near-statue orbits across follow/free have no structural render geometry between camera and target                                                                   |
| Repeated visits                 | Three return visits each report 75 renderer geometries, 9 textures, 3 portal labels and zero enemies at the entrance                                                            |
| Zone/quality review             | 20 screenshots (five zones × four presets), no browser/shader errors, Low shadows disabled                                                                                      |
| TypeScript / lint               | Typecheck passed; lint reported zero diagnostics                                                                                                                                |
| Production build                | Passed; no `__sunken-dev`, `Environment Preview` or `sunken-ruins-map` loader found in client output                                                                            |

The previous twin-blades attachment test failure was a stale fixture: daggers were equipped on an incompatible fresh non-Thief. The test now uses a Thief and two unique dagger instances; runtime equipment restrictions are unchanged. Build warnings remain for existing large chunks, plugin timing and vinext's route classification; there were no build errors.

Combat tests compare actual accepted/rejected runtime actions, not a claim that every skill is usable with one loadout. Displacement comparison allows 0.15 units for the existing substep boundary (observed difference about 0.09); damage, resources, cooldown and status comparisons are exact. The fixture runs local combat code and does not exercise a multiplayer server.

Performance was measured on 9 October 2026 (Asia/Bangkok) in Chrome 155 / WebGL through ANGLE Direct3D11, NVIDIA GeForce RTX 3060 Laptop GPU, 16 logical cores, 1280 × 720 viewport/drawing buffer and DPR 1. Each map/preset receives a 10-second warm-up, then three sequential 60-second captures: moving follow-camera traversal, a free-camera crowded scene, and another moving follow-camera route. Each scene also settles for three seconds. Traversals cover about 454 world units per capture; the crowded Sunken scene uses only the four temporary fixture monsters.

| Preset | Verdant p95 | Whispering p95 | Sunken p50 / p95 / p99 | Sunken CPU p95 | Calls p95 | Triangles p95 | Geometries / textures | Result |
| ------ | ----------: | -------------: | ---------------------: | -------------: | --------: | ------------: | --------------------: | ------ |
| Low    |     16.9 ms |        16.8 ms |  16.7 / 16.8 / 17.0 ms |         2.6 ms |       106 |       474,538 |               137 / 5 | PASS   |
| Medium |     16.8 ms |        16.8 ms |  16.7 / 16.8 / 17.0 ms |         2.9 ms |       142 |       586,452 |               153 / 5 | PASS   |
| High   |     16.8 ms |        16.8 ms |  16.7 / 16.8 / 17.0 ms |         3.4 ms |       203 |       851,378 |               167 / 6 | PASS   |
| Ultra  |     16.8 ms |        16.8 ms |  16.7 / 16.8 / 17.0 ms |         3.8 ms |       283 |     1,234,648 |               175 / 6 | PASS   |

Values are the worst capture quantile for each preset, rounded to 0.1 ms. Resource columns are the largest sampled renderer counts. Sunken passes when its p95 is no greater than the heavier reference at the same preset. These captures are approximately 60 Hz limited; they demonstrate the required comparison on this setup, not uncapped GPU headroom or a promise for lower-end hardware. CPU includes engine update/submission, not GPU execution time. Resource counts do not measure VRAM bytes.

The original 36 captures remain in `comparison.json`; the additional 12 Verdant captures are retained in `reference-closure.json`. The initial implementation exceeded the strict same-preset p95 limit by 0.1 ms on Medium and High. This prompted actual distant-coral density LOD; all 12 measurements of the revised content are in `sunken-density-lod.json`. The table uses the revised content and all six Verdant captures per preset, retaining the earlier Sunken implementation as a before-optimization record. No threshold was relaxed and no capture within a content revision was discarded. `scripts/report-sunken-performance.mjs` validates the complete datasets and writes [budget.json](../output/sunken-ruins/budget.json); its final assertion passes.

Triangle p95 decreased from 688,116 / 956,024 / 1,476,042 / 1,943,900 to the values above: reductions of 31.0%, 38.7%, 42.3% and 36.5%. The tested content envelope is 18,154 static placements with the recorded density/range profiles; further increases require profiling again rather than treating the 60 Hz cap as spare GPU capacity.

Unique successful asset responses under `/assets/` and `/__sunken-dev/` totaled 25,865,094 bytes for Verdant, 5,384,433 for Whispering, and 2,764,385 for Sunken in these runs, including shared character/UI assets. The Sunken map kit itself is 388,568 bytes. These figures use response content lengths and exclude application JavaScript and the optional placement export; they are not VRAM or complete application download sizes.

Selected visual evidence:

- [Coral Entrance](../output/sunken-ruins/zone-1-balanced.png), [Sunken Pathway](../output/sunken-ruins/zone-2-balanced.png), [Ancient Ruins](../output/sunken-ruins/zone-3-balanced.png), [Deep Abyss](../output/sunken-ruins/zone-4-balanced.png), [Abyssal Throne](../output/sunken-ruins/zone-5-balanced.png).
- [Full runtime layout](../output/sunken-ruins/layout-overview.png), [male swimming](../output/sunken-ruins/male-follow.png), [female swimming](../output/sunken-ruins/female-follow.png), [M access](../output/sunken-ruins/world-map-access.png).
- [Combat record](../output/sunken-ruins/combat-parity.json), [lifecycle record](../output/sunken-ruins/lifecycle.json), [zone record](../output/sunken-ruins/zones.json).

## Fidelity and scope limits

- This is a stylized low-poly environment preview. The five anchors, path branches, loops and portal arrangement follow the blueprint; the floor boundary uses analytic clearings and path corridors, not a pixel-exact coastline trace.
- The atmosphere reference informs cyan water, colorful coral, caustics and overhead light. This implementation does not claim to reproduce the reference's art density, detailed characters or cinematic rendering.
- Swimming is procedural retargeting, not a newly authored native swimming animation library. Combat fixtures establish local compatibility; they do not validate future hunting balance or multiplayer.
- Performance results apply to the recorded machine, browser, viewport and camera scenarios. CPU update/submission time is not GPU time, and renderer resource counts are not byte measurements of VRAM.
