# Sunken Ruins revision 12 — incoming attacks and landmarks

Local development only. Terrain and progression formulas remain unchanged.

## Deep Ocean attacks

The initial isolated baseline already received damage from all six species. The more specific failure was an approach/range mismatch: aquatic enemies could be inside their configured damage range while still trying to reach the smaller hard-coded land stop distance. At the eastern boundary, Deep Marlyn's bill/collision footprint prevents that extra movement, leaving it unable to begin an attack.

Aquatic enemies now face their target before calculating capsule reach, and begin their existing windup when inside their configured attack range. They retain the common enemy AI, windup duration, cooldown, damage calculation, safe zones, aggro and leash. Land enemies retain their original approach threshold. No new damage formula or stat tuning.

`scripts/test-deep-ocean-attacks.mjs` tests actual incoming HP damage without invincibility: all six species from four directions, repeated telegraphs, return home, and safe arrival. The east-edge regression places Marlyn at the maximum allowed center X and the player at X=499.35. With 1.6 units of contact distance, it deals damage without moving its blocked center. Existing outgoing attacks, loot, death/save/respawn and chase/return also pass.

## Shipwrecks

The existing Lost Merchant remains at (-310,65). Two instances of the same revision6 GLB are added:

| Landmark | X | Z | Yaw |
| --- | ---: | ---: | ---: |
| Abyssal Voyager | -335 | -160 | -0.65 |
| Eastern Tidebreaker | 340 | 110 | 0.85 |

They reuse the existing PBR material, three LODs and shared geometry. Each hull has the same five collision circles as the original. Reef exclusion, monster home selection, camera occlusion and minimap read the shared artifact layout. Main path clearances pass, and Sunken's population remains 324.

## Neptune production

Higgsfield produced a complete statue reference with job `d7743e18-045b-4c6f-b62c-5a64a157e699`, model `gpt_image_2_5`, estimated 0.25 Higgsfield credit. The reference and prompt are retained under `work/sunken-ruins/revision12/`.

The owner approved one Tripo image-to-model request: `tripo-v3.1` / `v3.1-20260211`, detailed PBR, smart low poly, 16,000-face limit. Task `f58b2e89-508c-4169-8cf5-12e3e87cceee` succeeded and consumed exactly **50 credits**. No reroll or additional paid conversion was performed.

The complete statue is placed at **(95,-100)** in Ancient Ruins, height approximately 16, with a 3.2-unit pedestal collider. The source had 25,191 triangles despite the requested face limit; local staging enforces 15,995 / 5,118 / 1,598 triangles across its three LODs. The final GLB is **6,152,192 bytes**, with 2048-pixel albedo/ORM JPEG and lossless normal PNG. Its head, face, three trident prongs, feet and rear drapery were inspected in the actual runtime from four sides; all four presets render the statue.

Staging used Blender 4.5.3 LTS in a fresh background scene. Downloaded GLB originals and unrelated Blender files remain unchanged. Runtime files, SHA256, bounds, actual credit receipt and reference provenance are in `dev-assets/sunken-ruins-underwater-v1/revision12/`. The staging scene and source receipt are under `work/sunken-ruins/revision12/`. The dev asset server explicitly allows the new GLB; it is excluded from production publishing.

## Verification

- Relevant Node test suite: 54/54 passed; final artifact placement also passes all 17 layout tests.
- Incoming browser attacks: 24/24 direction/species cases, boundary attack and safe-zone control passed.
- Existing hunting browser fixture: outgoing normal/elite/boss attacks, loot, death/save/respawn, chase and return passed, no errors.
- Artifact browser test: three ships plus Neptune, collision, one shared ship download, ten screenshots including four statue presets and four viewing directions; no console/page errors.
- Lifecycle browser test: both character models, attachments, portal return to land, level gating, Retry, reload, respawn and both cameras passed. Four repeated visits held steady at 139 geometries and 17 textures. This is a resource-count check, not a VRAM measurement or full-map FPS benchmark.
- Typecheck, lint, build and diff whitespace passed. Existing npm configuration warnings and vinext route-classification warning remain.
- This scoped run does not reclassify the three unrelated combat test failures documented in revision11 as fixed.

Evidence: `output/sunken-ruins/revision12/`, including `incoming-attacks.json`, `artifacts.json`, `lifecycle.json`, minimap and screenshots. The local development server was restarted to load its revised asset allowlist. No publication.

Main code changes: `world.ts`, `sunken-ruins-artifact-layout.ts`, `sunken-ruins-map.ts`, and `scripts/sunken-dev-assets.ts`. Staging/packing scripts now accept an explicit isolated revision12 directory. Two new browser regression scripts cover incoming attacks and artifact rendering.
