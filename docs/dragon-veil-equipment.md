Dragon Veil equipment — local implementation and verification, revision 2, finalized 14 October 2026

Head, Armor (including sleeves and gauntlets), Legs and Boots are available for 0 GOLD in Developer Material Lab. All four are Ancient, male-only, all jobs, level 1, non-tradable and non-sellable. Enhancement uses the existing materials/chances through +12. There is no initial socket, set bonus or extra effect. The configured stats are in `lib/game/dragon-veil.ts`.

An Adventurer level 1 with the starter sword and all four pieces at +0 produces **14,630 Max HP, 1,716 Physical ATK and 1,752 Magic ATK**. Movement Speed is **135%**, or **635%** with Dragon Veil Wings. The runtime stat caps remain unchanged.

The three originals under `D:\Item Lumenfall` were read without modification. SHA-256 values were verified again after exports:

| Original | SHA-256 |
| --- | --- |
| Head DV.glb | `58f1f722e2459074df0c28ad76c4643ecd53453513a24ee7e986cb7a794cceb3` |
| Armor Full DV.glb | `043615f0295b5c06b9ac6c93c52bfcbf7c713a4dc8ac6766af4a585cdd1398c1` |
| Pants and Boots DV.glb | `1afe0cbafc50e257ebeb71a064fad8d267a26c5e76171e00e3896bf0af4c1dd8` |

The pants/boots sheet contained multiple views in a single static mesh. The front trousers and paired boots were extracted with their original UVs and material. Revision 2 lowers the source cut from 0.705 to 0.65, uses a plane bisect with interpolated UVs instead of discarding entire crossing faces, and refits the waistband, hip depth and knee spacing. Their seam overlaps below the knees. The uneven upper waist rim extends beneath the tunic, with pelvis/spine weights matching the canonical body's transition; a pelvis-only waistband left a visible gap during bending attacks. The knee and cuff landmarks remain unchanged by that upper-waist correction. Armor sleeves were separated from the torso before unfolding into the actual Male V2 bind pose. Shoulder ornaments retain rigid clavicle attachment; elbows, hips, knees and ankles use blended skin weights. The existing 20-bone skeleton and inverse bind matrices are reused, not approximated with a replacement skeleton.

There are 16 runtime GLBs (four parts × four LODs) in `public/assets/equipment/dragon-veil/`. Their total size is 15,052,988 bytes; the manifest records per-file triangle counts. UV seam vertices are welded before lower-detail decimation to prevent cracks. Original UV/color design is retained; textures are compressed to 2048 pixels at LOD0 and 1024 at the remaining LODs. The staging Blender scene and intermediate files are under `work/dragon-veil/` and are excluded from the TypeScript production check.

The shared Male V2 loader binds these meshes for the game and Character preview. Coverage masks operate in body rest coordinates in the color, depth and distance/shadow passes. Dragon Veil Head retains the selected hairstyle and color while equipped. Both the modular loader and the common skeleton binding preserve its visibility; equipping this open crown no longer forces the bald scalp. LOD changes replace all requested equipment together. Stale requests and disposed actors release their leases. `equipmentStatus` and `equipmentReady` expose initial loading success/failure; the Character preview offers retry and the world reports an equipment loading failure. A failed later LOD request retains the previous valid model.

Four transparent 256 × 256 WebPs are rendered from the fitted, skinned parts with one studio lighting setup. Armor includes hands, Boots includes both boots, and all ornaments fit inside the image. Both item asset metadata and `ITEM_ICON_MANIFEST` map the four template IDs to these images. Revision 2 rerenders the Legs icon and versions model/icon URLs so cached images do not retain the old cut. Existing `ItemArtwork` is used throughout the UI. `extract-item-icons.py --check` verifies that regeneration preserves independently rendered icons; retired sheet recipes are excluded. The unrelated generic `monster-essence` template already lacked artwork and continues to use its existing fallback.

Gloves is removed from active slot types, equipment UI, drag/equip validation and visual attachments. The legacy item type and catalog identity remain readable. Save migration removes an equipped glove from equipment, clears its stat contribution and preserves its ID, enhancement and socketed runes. A newly unequipped glove goes to `pendingLoot` if the bag is full. Repeating migration does not duplicate it. Old inventory/storage items remain available for the existing rune extraction and sale flows. New shop/drop acquisition is disabled.

Revision 2 reran the 37 focused tests, browser permutation/hairstyle/UI suites, TypeScript and production build. The full regression comparison below was recorded for the initial implementation; its 60 existing failures are unrelated to this fitting correction.

Verification results:

| Check | Result |
| --- | --- |
| Focused equipment/character/shop/hair/Wings tests | 37 passed |
| Entire `lib/game/*.test.ts` regression | 679 tests: 619 passed, 60 failed |
| Unmodified HEAD baseline in isolated staging | 675 tests: 615 passed, the same 60 failed |
| Newly introduced regression failures | 0; names compared in `work/dragon-veil/regression-comparison.json` |
| TypeScript, excluding ignored `work` staging | Passed |
| Scoped lint on new TypeScript/JavaScript files | Passed |
| `npm run build` / vinext production build | Passed; no deployment |
| All 16 equipment GLBs | Matching canonical bind matrices/bones, normalized skin weights, decreasing LOD triangle counts |
| Original source hashes | Unchanged |
| Icons | Transparent 256 × 256, padded framing, URLs decoded successfully in real inventory/shop/equipment UI |
| Browser equipment permutations | 16 masks × front/back/side/close, in both runtime and preview configurations |
| Animation snapshots | Idle, walk, sprint, basic attack, ranged pose, magic cast, dash, hit, death and swim; 0.12/0.35/0.70 seconds, with and without Wings |
| Isolated Legs fitting | 60 close snapshots: Legs alone / Legs with Boots × idle/walk/sprint/attack/swim × 0.35/0.70 seconds × front/side/back; inspected after the final waistband correction |
| Additional visual/lifecycle checks | Walk/sprint/stop transitions, four LODs, all 10 visible hair selections under the helm, live hairstyle change with the helm still equipped, delayed LOD race, injected HTTP 503/retry, destruction during pending load, zero remaining equipment cache references after cleanup |
| Real UI flow | Free purchase, four icons, equip/unequip, save/load and absent Gloves slot; injected 503 at startup and in-game, explicit error messages, Continue/retry recovery |

The regression failures predate this work and include existing V3 progression/skill fixtures, city/BGM fixtures and older description/save expectations. They were reproduced from HEAD without resetting or changing the working tree.

Files changed are grouped by responsibility:

- Catalog/stats/economy/migration: `lib/game/dragon-veil.ts`, `items.ts`, `city-services.ts`, `rules.ts`.
- Rendering and readiness: `lib/game/dragon-veil-model.ts`, `modular-male-character.ts`, `character-model.ts`, `revision02-character.ts`, `world.ts`; `app/page.tsx` and `components/game/character-preview.tsx`.
- Slot UI: `lib/game/character-screen.ts`, `character-view.ts` and `components/game/character-screen.tsx`.
- Assets/icons: `public/assets/equipment/dragon-veil/`, four `public/assets/icons/items/dragon-veil-{head,armor,legs,boots}.webp` files and `lib/game/item-icon-manifest.ts`.
- Repeatable asset pipeline: `scripts/build-dragon-veil.py`, `pack-dragon-veil.mjs`, `extract-item-icons.py`.
- Verification: `lib/game/dragon-veil.test.ts`, updated character-model/character-screen/developer-material-shop/equipment-merchant tests; `tests/browser/dragon-veil-fixture.{html,ts}`; `scripts/test-dragon-veil-browser.mjs`, `test-dragon-veil-ui.mjs`, and obsolete Gloves setup removed from the existing accessories/character-screen browser scripts. `tsconfig.json` excludes ignored staging files under `work`.

Visual evidence (local, not published):

- [Full fitted set](../work/dragon-veil/browser/full-quarter.png)
- [Real Character screen with exact stats](../work/dragon-veil/ui/character-equipped.png)
- [Actual game world, front](../work/dragon-veil/ui/world-front.png)
- [Actual game world, back](../work/dragon-veil/ui/world-back.png)
- [Inventory slots](../work/dragon-veil/ui/inventory.png)
- [Four icons](../work/dragon-veil/icons-contact.png)
- [16 preview combinations, side](../work/dragon-veil/browser/contact-preview-side.jpg)
- [16 preview combinations, back](../work/dragon-veil/browser/contact-preview-back.jpg)
- [Animation samples without Wings](../work/dragon-veil/browser/contact-body-poses.jpg)
- [Animation samples with Wings](../work/dragon-veil/browser/contact-wings-poses.jpg)
- [Browser results](../work/dragon-veil/browser/report.json)
- [UI results](../work/dragon-veil/ui/report.json)
- [Startup error](../work/dragon-veil/ui/startup-error.png)
- [Preview error and retry](../work/dragon-veil/ui/load-error.png)

The owner's follow-up correctly identified shortcomings in the first fitting: the knee cut removed part of the leg armor and the waistband did not meet the base clothing properly. Revision 2 corrects those areas and adds isolated Legs captures instead of relying on a full set that conceals the waistband. The hairstyle check now requires a visible mesh, not just a loaded hair asset. This is sampled visual verification, not a mathematical guarantee over every animation frame or every weapon mesh. The original helm is an open crown and the complete selected hair now remains visible; long fringes can cover part of the front ornament. Lower LODs intentionally have more faceted edges. The cloak follows the current skeleton; this implementation does not add cloth physics or new finger bones. No source design was replaced, and nothing was published.

Reproduction uses the existing tools under `work/character-tools`: `node scripts/pack-dragon-veil.mjs --prepare`, the isolated Blender executable with `--background --factory-startup --python scripts/build-dragon-veil.py`, then `node scripts/pack-dragon-veil.mjs`. Browser verification runs with `node scripts/test-dragon-veil-browser.mjs`; real UI verification runs with `node --experimental-transform-types scripts/test-dragon-veil-ui.mjs` against the local dev server (`LUMENFALL_TEST_URL`, default `http://localhost:3000`). Both browsers use private contexts and do not modify the player's browser save.

Revision 2 evidence:

- [Legs equipped alone](../work/dragon-veil/ui/legs-only.png)
- [Legs with Boots](../work/dragon-veil/ui/legs-and-boots.png)
- [All ten hairstyles under the helm](../work/dragon-veil-revision2/hairstyles.jpg)
- [Regenerated Legs icon](../public/assets/icons/items/dragon-veil-legs.webp)
- [Legs animation views, 0.35 seconds](../work/dragon-veil/browser/contact-legs-4-0.35.jpg)
- [Legs animation views, 0.70 seconds](../work/dragon-veil/browser/contact-legs-4-0.7.jpg)
- [Legs and Boots animation views, 0.35 seconds](../work/dragon-veil/browser/contact-legs-12-0.35.jpg)
- [Legs and Boots animation views, 0.70 seconds](../work/dragon-veil/browser/contact-legs-12-0.7.jpg)
- [Isolated leg animation results](../work/dragon-veil/browser/legs-report.json)

Run `node scripts/test-dragon-veil-browser.mjs --legs` to reproduce the isolated animation views. Revision 2 logs are under `work/dragon-veil-revision2/`. The icon, permutation and animation contact sheets linked above were refreshed from the final revision 2 captures.

The subsequent report named the owned item **Dragon Veil Pants**, and described a question-mark icon plus a better appearance after unequipping. A private browser save using `dragon-veil-pants` reproduced both symptoms: the item spawned generic yellow leg capsules, never attached the fitted Legs GLB, and used `unknown-item.svg`. Unequipping removed those capsules and exposed the Armor/Boots underneath. The earlier new-item tests used `dragon-veil-legs` and missed this compatibility case.

The identity resolver now maps `dragon-veil-pants` to `dragon-veil-legs` for save migration, icons and model selection. It also recognizes the exact legacy name on leg armor with an obsolete template ID. Inventory, storage and pending-loot migration retain instance IDs, enhancement, sockets/runes and stats; repeated migration is stable. The runtime resolver handles an already-loaded legacy item as well. Changes are in `lib/game/dragon-veil.ts`, `items.ts`, `character-model.ts`, `item-icons.ts` and `components/game/item-artwork.tsx`. This correction does not change the GLB geometry or source files. The owner confirmed that the equipped model and icons were correct after reloading localhost:3000.

Follow-up validation: **38 focused tests passed**, TypeScript and scoped lint passed, and the production build exited 0. `scripts/test-dragon-veil-pants-ui.mjs` verifies the legacy save in the real UI, including the world and preview meshes, inventory/equipment icons, equip/unequip, and save/load. It also removes every equipped item and verifies that the base ragged shirt and trousers return, hair remains visible, no Dragon Veil mesh remains, and the unequipped state survives reload. The world and preview captures were visually inspected. Follow-up logs are under `work/dragon-veil-pants/`.

- [Reported symptoms reproduced before the identity fix](../work/dragon-veil-pants/before/equipped.png)
- [Legacy Pants equipped correctly after the fix](../work/dragon-veil-pants/after/equipped.png)
- [Legacy Pants inventory icon](../work/dragon-veil-pants/after/inventory.png)
- [All equipment removed: base ragged clothing](../work/dragon-veil-pants/after/all-unequipped-base-clothes.png)
- [Base clothing in the world](../work/dragon-veil-pants/after/all-unequipped-world.png)
- [Base clothing after save/load](../work/dragon-veil-pants/after/all-unequipped-reloaded.png)
- [Legacy Pants UI regression results](../work/dragon-veil-pants/after/report.json)

Enhancement follow-up (14 October 2026): the owner reported that Dragon Veil was absent from the Forge equipment list. Newly acquired Head, Armor, Legs and Boots already enhanced correctly, but `normalizeItem` allowed a saved `maxEnhancementLevel: 0` to override the current catalog cap of +12. The Forge filter then silently excluded those owned instances. A private browser save reproduced this exact list omission; the owner's actual browser save was not read, so its stored cap has not been independently confirmed.

`lib/game/items.ts` now restores the catalog enhancement cap for the four Dragon Veil armor pieces during save normalization, including legacy Dragon Veil Pants. Owned enhancement levels, IDs, stats, sockets/Rune and lock flags remain intact. Inventory, storage and pending loot all use the same migration. Wings keep their existing non-enhanceable +0 definition. Reloading the game applies the migration; no replacement items or manual save edits are needed.

Verification: **26 related tests passed**, including a new regression in `lib/game/dragon-veil.test.ts` that failed before the fix. It covers migration, equipped references, preserved item data, lock protection, repeated save/load and the Wings exclusion. `scripts/test-dragon-veil-forge.mjs` starts with all four armor pieces saved at a disabled cap, verifies their presence in the actual Forge UI, enhances each from +0 to +1, then reloads and checks levels, equipment references and material consumption. Two pieces are equipped and two are in inventory. No browser runtime errors occurred. TypeScript, scoped lint and the production build passed. Only local changes were made.

- [Before: saved armor missing from Forge](../work/dragon-veil-forge/before/list.png)
- [After: all four items listed and enhanced](../work/dragon-veil-forge/after/enhanced.png)
- [Forge browser regression results](../work/dragon-veil-forge/after/report.json)

Reproduce with `node --experimental-transform-types scripts/test-dragon-veil-forge.mjs` against localhost:3000 (or `LUMENFALL_TEST_URL`). The test uses the existing Playwright installation in `work/character-tools` and an isolated browser profile.

The next owner request on 14 October 2026 enables **Dragon Veil Wings enhancement through +12**, superseding the +0 Wings rule above. New Wings use the +12 catalog cap and existing Wings migrate on load, including inventory, storage and pending loot. Existing enhancement levels, instance IDs and item data remain intact. Forge uses its standard material tiers, success rates, lock checks, protection and failure rules. Enhancement scales item stats through the existing calculation; the runtime Movement Speed ceiling remains 635% with Wings.

The owner clarified that the emissive effect applies to **all enhanceable equipment**, including ordinary weapons, armor and accessories. `lib/game/equipment-emissive.ts` adds a steady emission contribution using the equipment's textured surface color. Each integer level from +1 through +12 increases its strength (`0.08 × level + 0.006 × level²`); +0 retains authored shading. Existing emissive textures, the Meteor Sword pulse and sword aura remain active. Skin, hair and base clothes receive no enhancement emission. This is material emission rendered in the world and character preview, with brightness dependent on the scene lighting.

`character-model.ts` applies it to ordinary equipment and asynchronously loaded weapons/Wings. `dragon-veil-wings.ts` applies it after fitting the independently loaded Wings. `dragon-veil-model.ts` and `modular-male-character.ts` pass each armor slot's own enhancement through all four LODs. Enhanced armor has actor-owned material copies; cached source materials, shared textures, geometry and original GLBs are preserved. LOD changes, stale requests and actor disposal release the copies. The existing Forge appearance rebuild and preview equipment key refresh the effect after enhancement, downgrade, destruction or equipment changes.

Validation for this request: **65 related tests passed**, plus TypeScript, scoped lint and production build. The new `equipment-emissive.test.ts` covers every enhancement step, shader/material isolation, authored emission, ordinary equipment types on both genders, skinned materials, delayed Wings loading and resource disposal. Wings regression tests cover old saves, +0 through +12, costs, save/load, lock protection, destruction and Movement Speed caps. The updated Forge browser regression successfully enhances all five saved Dragon Veil pieces, verifies matching Wings emission in the actual world/Character preview, and checks save/load and material consumption.

`scripts/test-equipment-emissive-browser.mjs` renders +0 through +12, checks mixed levels on one character, four LODs, walk/run/attack/swim/death poses, reuse of cached assets at +0, and exact disposal of owned emissive materials. The browser reported no runtime or shader errors. Front/back captures at +0, +1, +6 and +12 are under `work/equipment-emissive/browser`; the +0/+12 captures were visually inspected. No production deployment or source-asset edits were performed.

- [Full set and Wings at +0](../work/equipment-emissive/browser/plus-0-back.png)
- [Full set and Wings at +12](../work/equipment-emissive/browser/plus-12-back.png)
- [Front view at +12](../work/equipment-emissive/browser/plus-12-front.png)
- [Actual Forge result for Wings](../work/dragon-veil-forge/after/enhanced.png)
- [Character preview after forging](../work/dragon-veil-forge/after/preview-enhanced.png)
- [Emission browser results](../work/equipment-emissive/browser/report.json)

Run the visual regression with `node scripts/test-equipment-emissive-browser.mjs`; it builds a local fixture server and uses a private Chrome context. The updated localhost Forge regression remains `node --experimental-transform-types scripts/test-dragon-veil-forge.mjs`.
