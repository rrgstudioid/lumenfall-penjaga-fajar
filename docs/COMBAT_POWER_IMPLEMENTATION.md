# Combat Power — implementation and audit

Implemented 17 September 2026 against `LUMENFALL_Combat_Power_System_Specification_FINAL.docx` and the user's detailed instructions. The document was read before edits. Gameplay truth takes precedence over example numbers.

## A. Existing system findings

`calculateFinalCharacterStats` is the existing `derivedStats` pipeline in `lib/game/rules.ts`. CP reads that pipeline, not a second gear-stat calculation.

| Source / effective field | Existing behavior and CP treatment |
| --- | --- |
| Level, job profile, legacy weapon progression | `combatProfile`; HP/attack growth and `hero.weapon * 8` already enter final stats. No extra CP for level or job tier. |
| STR | `allocatedStats.str` + effective gear/passives; +2 physical attack each, then physical modifiers. Never scored separately. |
| VIT / old STA | HP +10, physical defense +0.5, HP recovery +0.1, tenacity +0.1. Only active benefits receive CP. |
| DEX | Accuracy +1, crit rate +0.1 percentage point, attack speed +0.15 percentage point, evasion +0.1. No separate DEX score. |
| INT | Magic attack +2, magic defense +0.5, healing power +0.25, skill power +0.45, mana +6, mana-cost reduction +0.1. Actual benefits are retained even for a physical job. |
| Attack Power / Magic Power | Actual names `physicalAttack` / `magicAttack`; `attack` is an alias, not another contribution. |
| Defense / Magic Defense | `physicalDefense` / `magicDefense`; `defense` is an alias. Shared `mitigateDamage` described below. |
| HP / MP | `maxHP` / `maxMana`. Current HP/MP do not cause fluctuating CP; maximums and actual regeneration determine capability. |
| Critical | `criticalRate`, `criticalDamage` are percentages. Basic attacks roll crit with an 80% cap. Skills currently do not crit. |
| Attack Speed | `attackSpeed = 100` is baseline; live basic interval divides by speed/100. Skills use their own cooldowns. |
| Move Speed | `movementSpeed = 100` baseline, final cap 135. Secondary utility only. |
| Accuracy | `accuracy` exists but combat uses range/facing checks, not a hit-chance roll. CP hit factor stays 1, with no invented Accuracy benefit. |
| Evasion | Live dodge chance `min(0.5, evasion/100)`. Expected incoming damage is multiplied by `(1-dodge)`. |
| Block | Live chance `min(0.5, blockRate/100)`; a block reduces damage by 30%. Expected factor `(1-chance*0.3)`. |
| HP Regen | `hpRecovery` is derived and displayed, but no world recovery tick uses it. Not credited. |
| MP Regen | `manaRecovery` restores mana every tick. Base INT has no passive recovery; effective INT above the base value and explicit equipment MP Recovery provide it, capped at 30 per second. Scored through sustainable skill use, not again as a raw-stat bonus. |
| Healing Power | `healingPower` contributes only through a learned, available healing skill's existing `skillHealingPreview`. |
| Elemental resistance | The old field is zero/deprecated and old values migrate to Magic Defense. No independent resistance mechanic to score. |
| Damage reduction | `damageReduction` is already soft-capped and combined multiplicatively with the active 45% reduction buff by final stats. Applied once to EHP. |
| Tenacity / stagger resistance | Final fields are aliases, but hero combat currently does not consume them. No CP award. |
| CDR | `cooldownReduction`, final cap 30%; real `skillCosts` controls cast frequency. No duplicate utility points. |
| Penetration | `physicalPenetration`, `magicPenetration`; shared mitigation against real level-matched monster defenses. |
| Boss / elite / skill bonuses | `bossDamage`, `eliteDamage`, `skillPower`, `skillDamage` follow existing damage helpers and target rank modifiers. |
| Equipment / pet | Unique equipped instance IDs only; pet `bonusStats` once. All Job restrictions remain in `canEquipItem`/`equipItem`. |
| Enhancement | Existing equipment pipeline multiplies base + unlocked Unique Stats + socket stats by `1 + enhancementLevel*0.08`. CP never adds a score for +N. |
| Rune / socket | Socket rune affixes enter final equipment stats. Loose inventory runes do not contribute. |
| Unique Stats | `bonusStats` only when `uniqueStatsLocked` is false. Magnifier remains the authority for unlocking. Retired generic equipment affixes stay excluded. |
| Passives / mastery | Existing eligibility, levels, mastery choices, skill modifiers and active job kit are reused. No extra score for learning/equipping a passive. |
| Unique effect descriptions | `uniqueEffect` is prose, not an executable proc registry. No invented rarity/effect rating; excluded descriptions are available in debug details. |
| EXP / gold / drop bonuses | Non-combat benefits, excluded. |

Important approved exception: `hurtHero` only accepts physical damage. The user explicitly chose **“Ikuti gameplay sekarang; jangan ubah combat”** after this audit. Combat is unchanged. CP still evaluates both physical and magic survivability against a stable reference benchmark so Magic Defense contributes for every job without inventing a live monster magic-attack channel.

## B. Files

New:

- `lib/game/combat-mechanics.ts`: shared existing mitigation, crit/dodge/block caps, combo, poison and barrier constants.
- `lib/game/combat-power-config.ts`: centralized balance assumptions, weights, caps and debug toggle.
- `lib/game/combat-power.ts`: pure evaluator, action-kit adapter, bounded derived cache, stat preview and debug formatter.
- `components/game/combat-power-preview.tsx`: shared equipment and attribute preview display.
- `lib/game/combat-power.test.ts`: CP tests and gameplay parity checks.
- This report.

Updated:

- `lib/game/skills.ts`: optional mixed `combatScaling` metadata; existing magic skill channel recorded on job metadata.
- `lib/game/rules.ts`: shared skill damage scaling and equipped-weapon resolution; mitigation re-export retained for existing callers.
- `lib/game/world.ts`: consumes the shared helpers with unchanged damage, chances, intervals and effects.
- `lib/game/character-screen.ts`: binds the real calculator by default.
- `lib/game/character-view.ts`: preview returns current/after/delta CP using the existing equipment simulation.
- `components/game/character-screen.tsx`, `app/page.tsx`, `app/character-screen.css`: header breakdown, candidate and inventory previews, attribute +1 preview.
- `lib/game/character-screen.test.ts`, `scripts/test-character-screen-browser.mjs`: production binding and browser regression coverage.
- `lib/game/field-layout.ts`: Sands Location spawn overflow now provides unique positions instead of wrapping onto occupied coordinates.
- `lib/game/drag-drop.test.ts`, `lib/game/east-gate.test.ts`, `lib/game/field-expansion.test.ts`, `lib/game/item-descriptions.test.ts`: stale expectations aligned with current inventory, map, spawn, description, and save/load behavior.

No save schema, inventory restrictions, character model, map, economy, job progression or combat balance was rewritten. The unrelated deleted Office lock file is not part of this change.

## C. Implemented formula

```
CP = round(1.5 * (O + D + S + U + X))
O = 10 * expected damage per second
D = 0.85 * sqrt(physicalEHP * magicEHP)
S = 12 * (expected healing per second + expected shield replenishment per second)
U = min(max(0, MoveSpeed - 100) * 8, 0.10 * (O + D + S))
X = min(sum of distinct evaluated special effects, 0.15 * (O + D + S + U))
```

Currently X is zero: no production item proc evaluator supplies executable metadata. Normal rune/Unique Stat bonuses are already included in O/D/S/U. Poison skill damage is included in O, not counted again as Special Effects.

The offensive benchmark uses actual damage-per-cast rather than a second attack-stat formula:

- Continuous basic combo: hits 1, 1 and 1.65, cycle time `3*jobCooldown + 0.22`.
- Basic expected hit damage: `(1-c)*round(raw) + c*round(raw*critDamage/100)`, with `c=min(0.8, critRate/100)`.
- Basic frequency uses controlled speed `clamp(1 + 0.70*(attackSpeed/100-1), 0.70, 1.50)`. This is deliberate CP compression, not a gameplay speed change.
- Learned, level-eligible, weapon-compatible skills use existing damage coefficients, mastery, skill modifiers and cooldowns. A skill costing more than Max MP is unavailable.
- Mana budget is `maxMana/30 + manaRecovery` per second for a centralized 30-second benchmark. Cast rates cannot exceed actual cooldown limits. Mana is allocated by damage/heal/shield value per mana; learning an inefficient spell does not force it into the rotation. The player hotbar is never changed.
- MP, MP regen, mana-cost reduction and cooldown reduction affect this budget/frequency exactly once; they receive no additional raw-stat score.
- Targets are a centralized, level-matched reference benchmark with a 60% normal / 25% elite / 15% boss rank mix. It does not read mutable `FIELDS`, map data, monster spawns or the current teleport location, so CP cannot change merely because the world roster changes.
- Accuracy factor is 1 because the live game has no Accuracy hit roll.
- Poison uses the live physical coefficient 0.08, minimum 2 damage and 0.6-second tick. Uptime is capped at 100% because the world has one non-stacking poison timer per target.

Each tooltip component is display-scaled. Rounding remainder goes to the largest component so the five displayed rows sum exactly to the header total. Unscaled components remain available for balancing.

## D. Job relevance

No CP branch checks Warrior/Wizard/etc. `skillCombatScaling` reads the production metadata; the world uses that same resolver. Existing wizard/acolyte skills remain magic, other existing skills remain physical. A future skill can specify mixed coefficients and its damage channel once, and both gameplay damage and CP will consume them.

Physical and magic relevance are normalized coefficient-throughput shares across usable actions (including frequency, crit-eligible basics and controlled basic speed). Their sum is 1. They describe the weighted effective attack contribution; they are **not multiplied into damage a second time**.

The current Wizard is not mechanically pure magic: its basic attack and available Adventurer skills still deal physical damage. The tests therefore distinguish a real Wizard's mixed kit from an isolated pure-magic action profile. CP does not pretend the physical attacks are magic just because the job is Wizard.

## E. Defense

The former `rules.mitigateDamage` implementation was moved unchanged and re-exported:

```
effectiveDefense = max(0, defense * (1 - max(0, penetration)/100))
DR = effectiveDefense / (effectiveDefense + 500 + max(1, attackerLevel)*10)
damageAfterDefense = max(0, rawDamage * (1-DR))

incomingMultiplier = max(0.01,
  mitigateDamage(1, defense, hero.level)
  * (1-finalDamageReduction/100)
  * (1-min(0.5, evasion/100))
  * (1-min(0.5, blockRate/100)*0.3))
EHP = maxHP / incomingMultiplier
```

Physical and magic EHP use their respective defense; no job weighting is applied to either stat. Defensive Power uses the balanced geometric mean, `sqrt(PhysicalEHP * MagicEHP)`, so a build cannot maximize CP by stacking only one defense channel. The 1% incoming floor prevents unbounded CP at extreme mitigation. This is a CP benchmark choice and does not alter the live physical-only monster combat path.

## F. Preview, reactivity and persistence

Equipment preview clones equipment/inventory/pet records and calls the **existing** `equipItem` validator/simulator. This handles two-handed weapons, off-hand removal, equipment restrictions and slot replacement. CP before/after are computed from the resulting final stats. Invalid equipment has no “After Equip” value.

Character picker previews the explicitly selected slot. Inventory hover labels the item's default slot; for the second ring/earring slot, choose it in Character. Cancel only closes preview. Only the real Equip action changes persistent state.

The current Character panel allocates points immediately; it has no pending Confirm workflow. The +1 attribute tooltip now includes a read-only CP preview. `previewStatCombatPower` also accepts a temporary allocation for consumers that stage points. Existing point validation/commit rules remain untouched.

CP is not stored on Hero or in saves. A bounded 128-entry content-key cache catches in-place mutations to stats, equipment, enhancement, sockets, unlocked Unique Stats, pet bonuses, job, skill/mastery/passives and active reduction buff presence. HP/MP ticks, positions, remaining cooldowns and buff duration ticks do not rerun the evaluator. A changed character or loaded save derives its score from source state.

Debug is off by default in the central config. `formatCombatPowerDebug` exposes native components, relevance, channel EHP, expected DPS, crit/speed effects, mana budget and unsupported effect descriptions without adding a debug panel to production UI.

## G. Validation

- 27 CP tests: physical, pure-magic action profile, actual Wizard, mixed scaling, All Job gear, physical and active magic EHP for all five jobs, balanced versus extreme defense, geometric symmetry/numeric safety, magic-only defensive gear, unused Magic Attack, rune equivalence, enhancement equivalence, real socket/enhancement/Magnifier actions, locked stats, dual-hand de-duplication, pet stats, preview/equip parity, cancellation, allocation preview, crit/speed/dodge/block caps, sustain relevance, mana budget, job advancement, map/roster-independent reference targets, cache invalidation and save/load.
- Existing skill damage parity test covers **every registered skill** against the prior formula; mitigation parity covers zero/high defense and penetration through/above 100%.
- 25 browser checks against the actual localhost game, in an isolated browser profile: CP header and all breakdown rows, stat allocation, preview/Cancel/Equip, two-hand off-hand removal, drag/drop, reset, save/reload, job header, inventory hover/dismissal, J/K preservation, no browser errors or failed assets. Layout checked at 1024/1366/1920 widths and 150% interface scale.
- Full suite: **284 tests, 284 passed**. The six stale assertions were aligned with the current inventory, imported Sands map, spawn, item-description, and save/load behavior. Sands spawn generation also now avoids duplicate runtime positions.
- Production build passed. Type checking still reports two pre-existing errors: `ui-layout.ts`'s `scale` field and the browser fixture's missing `cameraMode`. There are no new type errors in this implementation. Existing large-chunk build warnings remain.
- Cache probe: 10,000 repeated reads returned the identical cached result; approximately 45–49 ms total on this PC for the tested builds (measurement, not a performance guarantee).

Example deterministic QA builds, not hardcoded UI values: level 50, training weapon, active kit rank 3. Warrior allocation STR100/VIT30/DEX20/INT0; Wizard/Acolyte STR0/VIT30/DEX0/INT100. The “before” column below is the same current build evaluated with the former physical-only defensive formula; it is not a saved value.

| Build | Before (physical-only D) | After (balanced D) | Change |
| --- | ---: | ---: | ---: |
| Warrior | 28,383 | 28,368 | -15 |
| Wizard | 28,940 | 28,961 | +21 |
| Acolyte | 28,485 | 28,513 | +28 |

Ring: STR8, INT8, Attack20, Magic Attack20, Defense50. These values illustrate build-dependent scoring, not permanent item CP.

## H. Limits, intentionally not fabricated

- Live monsters currently have no magic attack, so the gameplay damage path remains physical-only. CP nevertheless includes Magic Defense through the stable global reference benchmark; if live magic threats are added later, the shared mitigation path should be audited again.
- Accuracy, HP Regen, tenacity/stagger resistance, elemental resistance and prose-only special procs are not implemented as active hero mechanics; no imaginary CP is awarded.
- Manual guard uptime, invincibility frames, target positioning, AoE target counts, execute/marked/weak-point conditions and crowd control are not assigned arbitrary CP. Reference damage assumes one in-range target. These remain limitations of a static strength benchmark.
- Active damage-reduction buffs affect final EHP while active; potential future ultimate-buff uptime is not invented. Current barrier amount is not cached as permanent HP; usable barrier skills contribute estimated replenishment instead.
- Heal/shield replenishment assumes enough incoming damage to use the recovery. Overhealing, shield overwrite timing, rotation scheduling and non-stacking poison uptime are approximations, not a claim of exact real-time encounter simulation.
- Existing healing uses **allocated INT squared** in `skillHealingPreview`, not just final INT. CP calls this existing helper once instead of changing that mechanic or adding raw INT points separately.
- Existing support/self skills also deal direct damage through `applySkill`'s target search; CP follows that behavior. Metadata named `scalingStat` is not used by the existing damage formula, so it is not treated as authoritative scaling.
- Legacy `Game.nova()` has no current hotbar/UI action entry. It is not counted as an available action independent of the actual learned skill kit.
- No claim is made that CP predicts every matchup, player skill or tactical situation. It is a centralized, explainable benchmark of the implemented character mechanics.
