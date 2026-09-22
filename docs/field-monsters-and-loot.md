# Field expansion and monster loot — 10 September 2026

## World and population

All six existing fields use twice the playable area: 90 × 90 becomes approximately 127.28 × 127.28 world units. Axes multiply by √2. Cities, player size/speed, camera, and combat ranges remain unchanged. Each field has 36 normal monsters (9 per named species), 5 elite instances, and one unique field boss: 42 total, previously 14.

Species IDs, names, levels, HP, EXP, quest references and existing item IDs are preserved. There are 36 species-specific low-poly model recipes. Body geometry is merged into one mesh per monster; elite/boss aura and attack telegraph are separate. This reduces draw calls relative to rendering every body part separately; it is not an FPS benchmark.

Respawn remains 25 seconds normal, 60 elite, 120 boss. Each instance now has its own saved deadline. Legacy species timestamps migrate to the first matching spawn. New field coordinates survive reload. The entrance, shrine and NPC camp are safe areas.

## Drop probabilities

Source of truth: `MONSTER_LOOT_PROFILES`, `EQUIPMENT_DROP_RARITIES`, `RUNE_DROP_RARITIES` and `lootItemPool` in `lib/game/monster-loot.ts`; monster base chance and material weights remain in `lib/game/regions.ts`.

One independent chance check precedes one item-category roll, then an independent item roll and rarity roll. A kill yields at most one loot entry, possibly a stack. EXP and GOLD rewards are not gated by this check. Inventory overflow goes into the existing pending-loot system.

Base chance: normal 35%, elite 70%, boss 95%. Character Item Drop Rate multiplies it by `1 + bonus / 100`, capped at 100%; it does not bias rarity or item selection. Material Drop Rate separately provides one additional material in a successful material stack.

The following are absolute probabilities **per kill**, without character bonuses:

| Loot category | Normal | Elite | Boss |
| --- | ---: | ---: | ---: |
| Material | 15.4% | 19.6% | 11.4% |
| HP/Mana potion | 8.75% | 10.5% | 3.8% |
| Arrows / food / Magnifier | 2.8% | 3.5% | 0.95% |
| Equipment | 6.3% | 24.5% | 47.5% |
| General socket Rune | 1.05% | 7% | 19% |
| Unique Rune of this field boss | 0% | 0% | 1.9% |
| Pet egg | 0.175% | 0.7% | 0.95% |
| Fate Rune Fragment | 0.35% | 2.1% | 2.85% |
| Eternal Seal | 0% | 0.7% | 2.85% |
| Rune Optimizer | 0.175% | 1.4% | 3.8% |
| No item | 65% | 30% | 5% |

Within a selected category:

- Material selection uses the field material weights, normalized to their total. They are not additional independent percentage checks.
- Potions: HP/Mana equally likely. Tier I in the first two fields, II in the next two, III in the final two.
- Supplies: arrows 60% (10 arrows), food 30%, Magnifier 10%.
- Equipment: only this field's basic weapon set, eligible universal equipment/off-hands, and the player's specialization equipment. Template level requirement cannot exceed the field's maximum. Field weapons have weight 3 each; other eligible equipment weight 1 each. The item's actual requirement is preserved, not replaced with player level.
- General Rune: all ten themes equally likely; no more Arcana/Focus-only bias.
- Optimizer: normal drops Basic, elite Refined. Boss selection: Rare 60%, field-focused 25%, Epic 12%, Legendary 3%.

Equipment rarity, conditional on an equipment drop:

| Variant | Rarity distribution |
| --- | --- |
| Normal | Common 60%, Uncommon 28%, Rare 10%, Epic 2% |
| Elite | Uncommon 25%, Rare 50%, Epic 23%, Legendary 2% |
| Boss | Epic 70%, Legendary 28%, Mythic 2% |

General Rune rarity, conditional on a general Rune drop:

| Variant | Rarity distribution |
| --- | --- |
| Normal | Cracked 65%, Simple 30%, Refined 5% |
| Elite | Refined 65%, Rare 30%, Epic 5% |
| Boss | Epic 70%, Legendary 29%, Ancient 1% |

Existing affix, socket and Rune Optimizer generation is retained. Normal/elite equipment never gains sockets. Unique boss Runes are still exclusive to their original boss and retain restrictions. No new inventory or economy was introduced.

## Field-specific rewards

| Field | Materials | Unique boss Rune | Focused Optimizer |
| --- | --- | --- | --- |
| Padang Arunika | Iron, Arunika Moss Fiber | Primordial Root Rune | Blue · Vitality |
| Tambang Selubung Besi | Iron, Titanium | Skywarden Rune | Red |
| Rimba Bisik | Titanium | Caroq Shadow Rune | Magenta |
| Dataran Bara-Beku | Titanium, Vibranium | Embercore Rune | Grey |
| Reruntuhan Tenggelam | Vibranium | Jayantara's Eye Rune | Blue · Arcana |
| Benteng Hujan Meteor | Vibranium, Meteorite Core | Meteor King Rune | Yellow |

## Validation

118 automated tests passed, including existing gameplay regressions and seven new suites covering bounds, population, safe spawn placement, unique model geometry, per-instance respawn/save compatibility, weighted loot reachability, chance checks and overflow persistence. Type checking, changed-file lint and production build passed. Build retains a large-chunk warning. Preview HTTP returned 200. Browser visual appearance, client console, manual combat and FPS have not been tested for this change.

The older item-drop exports predate this change and describe the previous implementation, not these rates.
