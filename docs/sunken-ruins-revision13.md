# Abysal Trench Sea Serpent revision 13

Abysal Trench now contains 200 elite **Sea Serpent "Guardian"**, level 58, and one **Sea Serpent** field boss, level 60. This implementation remains local and development-only. Terrain, maze layout, portals, and the existing Sunken Ruins and Deep Ocean populations are preserved.

## Population and combat

Guardian homes cover all four quadrants through maze pockets and connecting corridors. Stable instance IDs preserve individual respawn timers. Homes maintain at least 24 units of separation and exclude the arrival safe zone and boss basin. Swept navigation keeps Guardians outside the arena, including during chase and displacement. The boss occupies the existing arena at `(60,-355)` and remains within its basin.

Both creatures reuse the existing stat scaling, incoming damage resolution, defense, invincibility, status handling, loot families, and saved respawn deadlines. Their authored combat cycle adds locked telegraphs and separate attack clips. Damage occurs once at the end of windup; recovery cannot deal a second hit. Damage validation uses horizontal gameplay coordinates and rejects lines through tectonic walls. Returning to safety clears pursuit, while death and player respawn clear pending attacks.

| Creature | Attack | Windup | Recovery | Shape |
| --- | --- | ---: | ---: | --- |
| Guardian | Guardian Bite | 1.45 s | 1.65 s | Forward bite |
| Guardian | Guardian Tail Sweep | 1.60 s | 1.85 s | Surrounding sweep |
| Boss | Crushing Bite | 1.50 s | 2.20 s | Forward bite |
| Boss | Titan Tail Sweep | 1.90 s | 2.20 s | Surrounding sweep |
| Boss | Abyssal Head Slam | 1.80 s | 2.40 s | Locked target area |
| Boss | Coiling Crush | 2.00 s | 2.30 s | Circle |
| Boss skill | Crimson Pressure Jet | 2.40 s | 3.00 s | Forward beam |
| Boss skill | Abyssal Rupture | 2.60 s | 3.20 s | Locked target area |

The gameplay clock drives GLB clip time. Eight combat clips plus idle/swim clips were authored locally on 18-bone rigs. The visual rig includes baked seabed clearance; sampled combat poses remain approximately 0.55 units above the flat local seabed. The gameplay root and hit timing do not bob. Picking refreshes skinned bind transforms before calculating local bounds, preventing the deep map's vertical offset from being applied twice. Bounds include the boss's raised slam pose.

## Assets and credits

Higgsfield generated the two creature references with `gpt_image_2_5`: Guardian job `827fbfa7-6b23-4b5d-9976-3b4349d7e8dc` and boss job `ac59ac44-1649-41c1-80f0-4f6b9f9f2304`. Prompts, job IDs, and references are retained under `work/sunken-ruins/revision13/`; reference provenance is also copied into the runtime asset directory.

The two owner-approved Tripo requests used image-to-model, CLI `tripo-v3.1` mapped to `v3.1-20260211`, detailed PBR, and smart low poly. Actual receipts confirm **100 credits total**, leaving **4,540 credits**, with zero frozen credits.

| Model | Tripo task | Actual charge |
| --- | --- | ---: |
| Guardian | `cd547c2c-ed76-48e2-a3b9-20e682fca833` | 50 = base 30 + detailed 10 + smart low poly 10 |
| Boss | `406848ee-665f-42c3-bc20-c5532a2a36d5` | 50 = base 30 + detailed 10 + smart low poly 10 |

Rigging, all animations, LOD generation, emission masking, and texture packing used local Blender 4.5.3 in new staging scenes. There were no additional paid animation, conversion, or reroll requests. Downloaded originals remain unchanged; source and runtime SHA256 hashes were verified. Generation rights remain subject to the owner's service account terms; no downloaded third-party model was added.

| Runtime asset | Length | Triangles near / middle / far | GLB bytes |
| --- | ---: | --- | ---: |
| `serpent-guardian.glb` | 14 units | 11,995 / 3,838 / 1,199 | 6,716,804 |
| `sea-serpent-boss.glb` | 42 units | 19,994 / 6,397 / 1,999 | 6,620,580 |

The files reside in `dev-assets/sunken-ruins-underwater-v1/revision13/`, total **13,337,384 bytes**. Per-model JSON records source, authoring steps, textures, clips, hashes, and billing. Textures are 2048 pixels; normal maps remain lossless. The boss uses a masked crimson emission texture on its eyes. A small texture-colored ambient contribution preserves skin detail in the existing dark Trench atmosphere. Hit flashes affect each creature's own materials.

Textures and geometry are shared between instances; each creature owns its skeleton, mixer, and material copies. Exactly one of three LODs is visible per creature. Distant healthy idle creatures sleep; combat, return, status effects, and respawn still update when needed. Exiting the map disposes owned resources explicitly.

## Validation

- Relevant Node tests: **57/57 passed**, including population separation, navigation, loot, saved positions, attachments, and camera regression tests.
- Browser fixture: all **201** creature models loaded; Guardian and boss render and can be picked at their visible bodies. All eight clips pass windup, actual HP damage, no double-hit, and escape-to-safety checks. Every baked combat frame sampled at 30 Hz remains above the local seabed and inside the vertical pick envelope. No console/page errors.
- Boss death/save, player respawn, and timed monster respawn pass. Chase, return home, and clearing telegraphs pass.
- Three round trips between Deep Ocean and Trench retain 201 models and stable counts of **62 geometries / 16 textures**. A deliberately aborted GLB request locks movement; Retry restores the models.
- Deep Ocean incoming-attack regression passes all **24 species/direction cases**, the eastern boundary case, and safe-zone control.
- Typecheck, lint, build, and whitespace checks pass. The existing vinext route-classification warning remains. The three unrelated combat failures documented in revision11 are outside this scoped suite and are not claimed fixed.
- Both final GLBs return HTTP 200 with the correct binary MIME type and byte count from the local main server.

Short Chrome headless samples at 1280 × 720 used a 1.2-second warm-up followed by 120 frames per preset. All 201 actors remained allocated. These are smoke measurements, not the earlier plan's three 60-second traversal runs or a cross-device FPS guarantee. They preceded the final local pose-clearance bake, which retained mesh topology, materials, and LOD budgets.

| Scene | Preset | Nearby actors | p50 / p95 frame ms | Draw calls | Triangles |
| --- | --- | ---: | --- | ---: | ---: |
| Boss arena | Low | 1 | 16.7 / 16.8 | 29 | 24,257 |
| Boss arena | Medium | 1 | 16.7 / 16.8 | 29 | 37,978 |
| Boss arena | High | 1 | 16.7 / 16.8 | 35 | 40,399 |
| Boss arena | Ultra | 1 | 16.7 / 16.8 | 35 | 40,399 |
| Guardian maze | Low | 13 | 16.7 / 17.0 | 68 | 50,256 |
| Guardian maze | Medium | 13 | 16.7 / 16.9 | 68 | 76,886 |
| Guardian maze | High | 13 | 16.7 / 17.0 | 68 | 76,886 |
| Guardian maze | Ultra | 13 | 16.7 / 17.0 | 70 | 77,046 |

Resource counts are not VRAM bytes, and these frame intervals are not GPU timings. Long hunting sessions, multiple simultaneous players, and final encounter balance require further playtesting.

Evidence is in `output/sunken-ruins/revision13/`: `browser.json`, eight attack screenshots, `guardian-runtime.png`, `boss-runtime.png`, `lifecycle-performance.json`, `incoming-attacks.json`, test logs, build log, and credit balance receipt.

## Main files

New modules are `lib/game/abysal-trench-population.ts`, `sea-serpent-combat.ts`, `sea-serpent-model.ts`, and `sea-serpent.test.ts`. Integration updates are in `regions.ts`, `field-layout.ts`, `monster-loot.ts`, `sunken-ruins-map.ts`, and `world.ts`. Asset staging uses `scripts/stage-sea-serpents.py`, the existing packing script, and the development asset allowlist. Browser coverage is in `scripts/test-sea-serpents.mjs` and `scripts/test-serpent-lifecycle.mjs`. No publication was performed.
