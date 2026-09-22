# LUMENFALL — CFV3-2 Primary Stat, Weapon Power & Rune Pipeline Audit

Tanggal: 21 September 2026

Status: audit selesai; tidak ada perubahan gameplay, formula, skill, item, Rune, atau balance.

## Ringkasan owner

Fondasi CFV3-1.1 masih aktif: STR/VIT/DEX/INT berawal dari 15, alokasi mendapat 2 poin per level, dan Universal Base Physical ATK memakai `7 + floor(level × 1.1)`.

Physical path sudah memenuhi diagnostic Lv61 yang diminta. Rune primary stat juga masuk melalui effective stat satu kali. Namun audit menemukan dua keputusan arsitektur yang belum boleh disamarkan sebagai bug balance:

1. `derivedStats().magicAttack` saat ini memasukkan `gear.attack` generik dari senjata apa pun. Karena itu Sword dan Staff dengan Weapon ATK sama-sama menaikkan Magic Attack display/foundation. Ini adalah **weapon compatibility leakage** terhadap kontrak CFV3-2.
2. Rune `magicAttack` dan `resourceEfficiency` berada di pool sebagai affix `percent`, tetapi runtime menerapkannya sebagai angka flat pada `magicAttack` dan `maxMana`. Ini adalah **unit-semantics mismatch**, bukan perubahan yang boleh dilakukan tanpa keputusan owner.

## 1. Sumber runtime yang diaudit

- `lib/game/rules.ts:603-751` — base stats, equipment/Rune aggregation, derived stats, physical/magic display values.
- `lib/game/items.ts:329-335` — Rune rarity and theme pools.
- `lib/game/items.ts:420-458` — Rune labels and flat-stat classification.
- `lib/game/items.ts:995-1004` — Rune affix rolling and Rune instance creation.
- `lib/game/items.ts:1425-1438` — equipment, Unique Stat, Rune, and enhancement aggregation.
- `lib/game/weapon-style.ts:20-77` — current weapon style and requirement resolution.
- `lib/game/rules.ts:840-852` — skill weapon gate and resolver context.
- `lib/game/skill-action.ts:166-263` — skill multiplier and physical/magic coefficient application.
- `lib/game/character-screen.ts:26-66,90-112` — Character Overview stat display and primary-stat breakdown.
- `lib/game/combat-power.ts` — CP-only benchmark consumer; not a second live damage resolver.

## 2. Canonical primary-stat layer

| Layer | Runtime result |
|---|---|
| Base STR/VIT/DEX/INT | 15 each (`BASE_PRIMARY_STAT`) |
| Stat points | 2 per level; `calculateTotalStatPoints` remains separate from content cap |
| Effective primary stat | Base + allocated + equipment/passive/Rune stat |
| STR physical contribution | `max(0, effective STR - 15) × PHYSICAL_WEAPON_STAT_FACTORS[weaponStyle]` |
| VIT | HP/physical defense/tenacity-related derived values; no Stagger Resistance |
| DEX | crit, accuracy, attack speed, evasion |
| INT | max MP, magic/healing-related formulas |

Rune STR/VIT/DEX/INT is aggregated into equipment stats, then read once by `derivedStats`. The existing CP regression `socket STR flows through final stats once` passes.

## 3. Weapon ATK and physical resolver

The live physical display formula is currently:

```text
physicalAttack = round(
  BasePhysicalATK
  + hero.weapon × 8
  + BonusSTR × weaponStyleFactor
  + gear.attack
) × (1 + (gear.attackPercent + gear.physicalDamage) / 100)
```

The canonical Base Physical ATK is correct. Actual equipment `baseStats.attack` enters as `gear.attack`. No Rune theme currently rolls `attack` as a Rune affix, so there is no Rune Weapon ATK family in the current registry.

The field `hero.weapon` is an older separate numeric weapon scalar. It remains in the physical formula and can become a second raw weapon-power source if non-zero while an equipment item also supplies `baseStats.attack`. This is an architecture risk to resolve before declaring the canonical Weapon ATK pipeline fully locked.

## 4. Magic resolver and Character Overview meaning

Current live display formula:

```text
magicAttack = round(
  legacy/core profile attack
  + gear.attack
  + gear.magicAttack
  + effective INT × 2
)
```

Skill damage then consumes `physicalAttack` and/or `magicAttack` according to each skill's physical/magic coefficients. `skillDamage` is applied as a resolved action multiplier in `skill-action.ts`.

Therefore Character Overview `Magic Attack` is a theoretical derived value, not proof that every equipped weapon is compatible with every magic skill. However, the current formula does not itself filter `gear.attack` by magic weapon compatibility.

### Sword versus Staff result

At level 30 with the same `baseStats.attack = 8`:

| Loadout | Magic Attack |
|---|---:|
| No weapon | 197 |
| Staff | 205 |
| Sword | 205 |

Finding: the increase from Sword is **currently expected from the generic runtime formula**, but it is **not compliant with the intended CFV3-2 compatibility contract** for a magic skill that requires Staff/Wand. It is not safe to fix during this audit because doing so changes the shared combat foundation and may affect legacy behavior.

The skill resolver does reject a skill when `skillWeaponAllowed` fails. The remaining question is whether the Character Overview should show generic theoretical Magic Attack or compatibility-filtered Magic Weapon ATK. Owner decision required.

## 5. Weapon compatibility

- `meetsWeaponRequirement` and `skillWeaponAllowed` enforce the skill's declared weapon requirement at cast resolution.
- `resolveWeaponStyle` resolves one-hand sword, greatsword, dual sword, daggers, bow, staff/wand-related styles and other current styles.
- The derived Character Overview attack values are broader than the cast gate: `gear.attack` is aggregated before skill compatibility is applied.
- No distinct runtime `Weapon ATK` field exists yet; the current item field is generic `baseStats.attack`.
- No current Rune modifier is explicitly named or typed as Weapon ATK.

## 6. VIT, DEX, and INT audit

- VIT uses the current CFV3 layer and contributes to HP and physical defense. Stagger Resistance is absent.
- DEX currently contributes `+0.1` percentage point per effective DEX to the displayed critical-rate expression, plus centralized accuracy, attack speed, and evasion formulas. The current formula includes the base 15, so the owner-facing “allocated Bonus DEX only” interpretation should remain explicit when documenting examples.
- INT contributes `+3 MP` per effective INT through `INT_MP_FACTOR`, and `+2` to the current generic Magic Attack formula. The latter is still a generic formula, not a universal final magic coefficient for every spell.
- Healing uses `magicAttack × .25` plus Healing Power and skill power in `skillHealingPreview`; Magic Damage and Healing are not automatically the same stat path.

## 7. Actual Rune catalogue

### Generic Rune families

The registry contains ten generic socket Rune themes. They can be socketed on equipment through the existing socket system; no separate equipment-type eligibility field exists in the Rune family registry. Rune job restriction is only populated for selected unique boss Runes.

| Rune | Runtime family / possible affix pool |
|---|---|
| Rune of Might | `physicalDamage%`, `STR`, `Crit Damage%`, `Boss Damage%` |
| Rune of Precision | `Crit Rate%`, `Accuracy%`, `Crit Damage%`, `Weak Point Damage%` |
| Rune of Swiftness | `Attack Speed%`, `Move Speed%`, `Cooldown Reduction%`, `Evasion%` |
| Rune of Vitality | `HP`, `HP Recovery`, `Defense`, `Damage Reduction%` |
| Rune of Arcana | `Magic Attack`, `resourceEfficiency`, `Skill Damage%`, `Magic Penetration%` |
| Rune of Focus | `MP Recovery`, `Crit Rate%`, `Mana Cost Reduction%`, `Accuracy%` |
| Rune of Elements | `Elemental Damage%`, `Magic Defense`, `Skill Damage%`, `Magic Attack` |
| Rune of Fortune | `EXP Gain%`, `GOLD Drop Rate%`, `Item Drop Rate%` |
| Rune of the Guardian | `Block Rate%`, `Parry Rate%`, `Tenacity%`, `Damage Reduction%` |
| Rune of Shadows | `Evasion%`, `Crit Rate%`, `Crit Damage%`, `Attack Speed%` |

### Unique boss Runes

All six current unique boss Runes use `Ancient` Rune quality, fixed quality, and one theme pool plus a prose `uniqueEffect`. The prose effect is not a generic executable affix in the current resolver.

| Rune | Theme | Job restriction | Unique effect source |
|---|---|---|---|
| Embercore Rune | Elements | None | `rune-inti-bara` |
| Primordial Root Rune | Vitality | None | `rune-akar-purba` |
| Caroq Shadow Rune | Shadows | Rogue | `rune-bayangan-caroq` |
| Skywarden Rune | Guardian | Warrior | `rune-penjaga-langit` |
| Jayantara's Eye Rune | Arcana | Wizard | `rune-mata-jayantara` |
| Meteor King Rune | Might | None | `rune-raja-meteor` |

### Rarity, affix count, and roll ranges

| Quality | Affixes | Power | Flat non-HP range | HP range | Physical Damage range | Other percent range |
|---|---:|---:|---:|---:|---:|---:|
| Cracked | 1 | 0.3 | 0.3–1.2 | 18–36 | 1.35–1.875 | 0.6–1.8 |
| Simple | 1 | 0.5 | 0.5–2 | 30–60 | 2.25–3.125 | 1–3 |
| Refined | 1–2 | 1 | 1–4 | 60–120 | 4.5–6.25 | 2–6 |
| Rare | 2 | 1.5 | 1.5–6 | 90–180 | 6.75–9.375 | 3–9 |
| Epic | 2–3 | 2.2 | 2.2–8.8 | 132–264 | 9.9–13.75 | 4.4–13.2 |
| Legendary | 3 | 3 | 3–12 | 180–360 | 13.5–18.75 | 6–18 |
| Ancient | 3–4 | 4 | 4–16 | 240–480 | 18–25 | 8–24 |

Values are rounded to one decimal by `randomBetween`; the displayed table shows the mathematical range before/after that one-decimal rounding convention. Generic Rune instances support all seven qualities. Unique boss Runes are Ancient and fixed-quality.

## 8. Rune modifier classification and entry layer

| Runtime modifier | Classification | Current entry point | Audit result |
|---|---|---|---|
| `str`, `vit` | PRIMARY_STAT | `gear` → effective primary stat | Correct single stat-layer entry |
| `physicalDamage` | PHYSICAL_DAMAGE_PERCENT | physicalAttack multiplier | Physical-only in live derived formula |
| `magicAttack` | FLAT_MAGIC in current implementation, although rolled as percent | `gear.magicAttack` added to Magic Attack | Unit mismatch; owner decision required |
| `skillDamage` | SKILL_DAMAGE | `skill-action.ts` action multiplier | Applies to resolved skill damage regardless of physical/magic coefficient |
| `critRate`, `critDamage` | CRIT_RATE / CRIT_DAMAGE | derived crit fields | Correct scoped derived stats |
| `attackSpeed` | ATTACK_SPEED | derived attack speed | Correct derived stat path |
| `accuracy` | ACCURACY | derived accuracy | Display/derived only; no live hit roll currently |
| `evasion` | EVASION | derived evasion | Used by incoming/CP paths as implemented |
| `hp`, `hpRecovery` | HP / utility sustain | derived HP/recovery | Flat path |
| `defense`, `magicDefense` | DEFENSE | derived defense | Flat path |
| `damageReduction` | physical/general reduction modifier | derived reduction | Scoped by current generic reduction path |
| `resourceEfficiency`, `mpRecovery` | MP | max mana / recovery | `resourceEfficiency` is treated additively despite percent affix unit |
| `elementalDamage` | ELEMENTAL | stored and derived? | No distinct element-damage resolver was found in the live skill formula |
| `physicalPenetration`, `magicPenetration` | physical/magic mitigation | derived stats; combat/CP consumers | Magic penetration has explicit type path; physical likewise |
| `bossDamage`, `weakPointDamage`, `expGain`, `goldDropRate`, `itemDropRate` | OTHER / utility | derived/CP/loot consumers where implemented | Not Weapon ATK or primary stat |
| `attack` | WEAPON_ATK candidate | equipment base stats → both physical and magic display formulas | No Rune theme currently rolls it; compatibility filtering absent |

No current Rune modifier named `magicDamage%` was found. No current Rune modifier named `flatPhysicalAttack` was found.

## 9. Double-scaling and leakage findings

### Confirmed safe

- Rune STR is added to effective STR, then contributes through the STR formula once. It is not also converted into direct Attack by `calculateRuneStats`.
- Rune physicalDamage is not added to STR or Weapon ATK; it enters the current physicalAttack percentage multiplier once.
- Rune stats are multiplied by equipment enhancement in `calculateEquipmentStats` once before being aggregated.

### Needs owner decision / architecture follow-up

- `gear.attack` contributes to both `physicalAttack` and `magicAttack`, regardless of whether the equipped weapon is compatible with a magic skill. This explains Sword and Staff producing the same Magic Attack when their raw attack is equal.
- `hero.weapon × 8` is a legacy numeric weapon source separate from item `baseStats.attack`. If both represent raw weapon power in a modern character, they can double-count weapon power.
- Rune `magicAttack` and `resourceEfficiency` are rolled with `unit: 'percent'`, but current derived formulas consume them as additive values. This is not a second calculation, but it is a unit contract mismatch.
- `skillDamage` affects the resolved action multiplier for both damage types. That is current global skill-damage semantics, not a physical-only or magic-only Rune.
- Unique `attackPercent` and Rune `physicalDamage` are separate named modifiers but are summed into one physical multiplier. No numeric change is made in this audit.

## 10. Diagnostics

### Lv61 physical test

Fixture: actual CFV3 base, level 61, allocated STR 120, effective STR 135, no Rune/passive/buff.

| Case | Base | Bonus STR | Weapon ATK | Result |
|---|---:|---:|---:|---:|
| Unarmed | 74 | 120 | 0 | **194** |
| Starter Sword `baseStats.attack = 8` | 74 | 120 | 8 | **202** |

The requested Sword +8 expected result `74 + 120 + 8 = 202` passes. Unarmed correctly has no weapon or weapon-dependent STR contribution.

### Magic compatibility test

Level 30, base INT 15, no allocated INT, equivalent weapon attack 8:

| Case | Magic Attack |
|---|---:|
| No weapon | 197 |
| Compatible Staff | 205 |
| Incompatible Sword | 205 |

The first two values demonstrate the current generic Weapon ATK inclusion. The third demonstrates the unresolved compatibility leakage. The skill cast gate still checks `weaponRequirement`; this audit does not rewrite it.

## 11. Test result

- Full `lib/game` regression: **367 passed, 0 failed**.
- Focused CFV3/Rune/Unique suite: **61 passed, 0 failed**.
- No tests were added because this phase found architecture questions rather than approved fixes.
- No gameplay or balance files were changed.

## 12. Owner decisions needed before CFV3-2 can be locked

1. Should Character Overview `Magic Attack` remain a generic theoretical stat that includes any `gear.attack`, or should it expose compatibility-filtered magic Weapon ATK?
2. Should canonical Weapon ATK replace/retire the legacy `hero.weapon × 8` source, or is that field still intentionally separate enhancement power?
3. Should Rune `magicAttack` and `resourceEfficiency` remain additive despite their current percent-unit roll, or should the unit metadata/formula be normalized in a future approved change?
4. Should `skillDamage` remain global to both physical and magic skill actions, or should future Rune families split it into scoped physical/magic damage modifiers?
5. Is `elementalDamage` intentionally stored-only until the future element resolver exists?

No automatic rebalancing, Stun, FP, specialization, or Rune redesign was performed.
