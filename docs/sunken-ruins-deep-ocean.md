# Sunken Ruins: retaining walls, landmarks, and Deep Ocean

Local development revision 6, 9 October 2026. No publication. The legacy `sunken-ruins` field and original assets remain unchanged.

The later [revision 7 report](sunken-ruins-revision7.md) supersedes this report's grid, portal coordinates, wall height, population, and Deep Ocean environment. The asset billing and acceptance history below remains unchanged.

## Environment and navigation

The limestone retaining wall follows the existing shelf contour, including concave bays, rather than a rectangular outline. It uses 65 render sectors and eight visible openings. Render faces and collision proxies derive from the same contour. Shared endpoint normals join adjacent segments continuously. The old invisible depth-contour restriction remains removed: only visible solids and the actual ±500 map bounds block movement.

Beyond the playable square, the seabed continues to ±800 and descends roughly another 155 world units through a smoothstep transition. Deep blue shading and distant submerged rock buttresses give the boundary depth. Sunken water fog darkens with player depth; its read distance transitions from 240 to 105 units on the deep outer slope and returns to 240 on ascent. Terrain culling follows the camera, with a diagonal viewport/tile margin beyond the fog distance. Together these avoid a hard offshore silhouette while preserving bright shallow water. These dimensions are world units, not a claim about metres.

## Deep Ocean

G7 uses a 10×10 grid, A–J west to east and 1–10 north to south. Its centre is `(150,150)`. The new clickable portal retains the existing 4.5-unit interaction range.

| Travel | Destination / spawn |
| --- | --- |
| Sunken G7 | `deep-ocean-underwater-v1`, `(0,320)` |
| Deep Ocean return gate `(0,350)` | Sunken Ruins `(150,160)` |

Both arrivals are outside their portal interaction area. Deep Ocean is a separate level-32 development exploration map with a deeper basin, trench, reef gardens, swimming, its own atmosphere/minimap, save restoration and disposal. It has no new monsters, rewards, quests, or NPCs. Sunken retains 177 monsters, including its elite and boss population; the new portal and landmarks reserve clear spawn space.

## Tripo assets

The accepted assets are placed as one 54-unit shipwreck on the southwest shelf `(-310,65)`, six amphorae, and two bronze astronomical relics. `S` marks the ship on the minimap. Marine habitats avoid these landmarks. The planned Neptune placement beside the central ruins `(-27,-90)` is withheld pending an acceptable statue; it has no hidden collider or minimap marker.

Source downloads stay under `work/sunken-ruins/revision6/tripo-out/`. Fresh Blender staging files are under `work/sunken-ruins/revision6/`; the original city scene is never opened or edited. Runtime copies and per-asset provenance manifests live under `dev-assets/sunken-ruins-underwater-v1/revision6/`. These files are served only by the development middleware.

The staging pipeline preserves PBR materials and UVs, normalizes scale/pivot, enforces the requested triangle budget locally, and creates 32%/10% LODs without further paid calls. Hero textures use 2K; smaller props use 1K. Albedo/ORM are JPEG quality 94, normal maps stay lossless. The ship's isolated floating reconstruction debris was removed from the staged copy. Some API outputs exceeded their requested face cap, so runtime budgets use inspected/decimated geometry rather than assuming the API cap held.

Both Neptune meshes were rejected because the head and trident tip were cut off. The raw previews and direct Three.js renders confirmed the defect. The API marked both successful, billing 40 credits for the first and the separately approved 50 credits for the image-to-model replacement. The second staged mesh is quarantined in `work/sunken-ruins/revision6/rejected-staged/`; neither is loaded by the runtime. No further paid re-roll was submitted. The owner has been shown the second result and asked whether to defer the statue, repair it locally, or review a new generation plan. The statue portion is not complete.

| Run order | Operation | Task | Credits |
| --- | --- | --- | ---: |
| 1. Shipwreck | text-to-model | `48619da9-357f-47db-9fa0-7377bacaaaec` | 40 |
| 2. Neptune, rejected | text-to-model | `aa32e485-a8b3-4ddb-aff1-58c40d0ecd10` | 40 |
| 3. Amphora | text-to-model | `3d3ffbb1-ed2b-47af-9bae-cfc53ec92040` | 40 |
| 4. Neptune replacement, rejected | image-to-model | `a4a013a5-bb27-4151-b8b7-6f75883db0c6` | 50 |
| 5. Astronomical relic | text-to-model | `26e7a1b2-0288-48e1-8a6b-e6d8f93db863` | 40 |

Actual billed total: **210 credits**, within the approved total, including **90 credits for the two rejected Neptune results**. Verified remaining balance: **4,690 credits**, frozen: **0**. Each source folder contains the fetched `task.json` confirming the billed amount. No paid conversion or local optimization fees were incurred.

Accepted runtime assets total **9,649,320 bytes** (three GLBs): ship 5,354,632; amphora 2,095,616; armillary sphere 2,199,072. Their base meshes contain 17,254 / 5,996 / 7,996 triangles respectively, with two local LODs each. Nine placements share these resources. Sand contact occlusion includes their measured collision footprints.

## Validation status

- 61/61 relevant Node tests pass, including wall openings, original corridor clearance, G7 travel, Deep Ocean save/return and production hiding of both development maps.
- Final typecheck, lint and build passed. The existing vinext route classification notice remains informational.
- Chrome tests passed G7 entry, Deep Ocean reload, return to G7, real movement in follow/free modes, underwater pose, 177 Sunken monsters and zero Deep Ocean monsters. No page/console errors.
- All eight wall openings, six previously cleared areas, four outer bounds, retained reef collision and position reload passed runtime movement checks.
- Ship collision blocks the hull while the adjacent 48-unit sandy route is fully traversable. Nine artifact instances load successfully; rejected Neptune is absent.
- Lifecycle test passed: level 31 locked / 32 open, three original portal destinations, land animation recovery, Retry, respawn, equipment attachments for both character models, and 32 camera angles. In that lifecycle run, before the final terrain-culling adjustment, three visits stayed at 109 uploaded geometries / 17 textures at the entry. Final short performance captures load more visible terrain chunks; these observations are resource counts, not VRAM bytes.
- Offshore fog reaches 12/105 near/far and restores to 22/240 at G7 after ascent.
- Final performance smoke: Chrome 155 / RTX 3060 Laptop, 1280x720 DPR 1; 10-second warm-up, three 10-second captures per preset (two traversals and one crowded scene). These are short smoke samples, not the planned 3x60-second Verdant/Whispering comparison. CPU submission is not GPU timing; texture counts are not VRAM bytes.

| Preset | p95 frame time, range | p95 CPU submission, range | p95 draw calls, range | p95 triangles, range |
| --- | ---: | ---: | ---: | ---: |
| Low | 16.8 - 16.8 ms | 4.5 - 4.7 ms | 48 - 133 | 70,944 - 242,385 |
| Ultra | 16.8 - 16.8 ms | 5.1 - 5.5 ms | 49 - 182 | 144,872 - 520,282 |

Main changes: `underwater-regions.ts`, `underwater-contour.ts`, `deep-ocean-layout.ts`, Sunken layout/render/navigation/material/VFX modules, `regions.ts`, `rules.ts`, `field-layout.ts`, `world.ts`, and the map menu. Reproducible generation input and dry runs are in the revision6 work folder. `scripts/test-deep-ocean-browser.mjs` captures landmark, wall, offshore, portal and sub-map evidence using disposable browser storage.

## Review evidence

- `output/sunken-ruins/revision6/shipwreck.png`, `amphora.png`, `astrolabe.png`: accepted assets in the actual game renderer.
- `retaining-wall.png`, `offshore-descent.png`, `g7-portal.png`: wall, smooth outer depth transition and G7 warp.
- `deep-ocean-landing.png`, `deep-ocean-trench.png`: sub-map environment.
- `deep-ocean.json`, `clearings.json`, `lifecycle.json`: browser assertions and runtime state.
- `neptune-staged.png`: rejected second Neptune result; retained as evidence rather than shipped.

Remaining limitation: an acceptable Neptune statue is still required to complete the full requested asset set. Deep Ocean is an environment/exploration sub-map; no additional hunting population or quests were introduced there. The work remains local and development-only.
