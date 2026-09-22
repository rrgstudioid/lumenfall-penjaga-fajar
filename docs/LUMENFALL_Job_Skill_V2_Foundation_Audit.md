# LUMENFALL — Job Skill V2 Foundation Audit

## Scope

Audit dan refactor ini hanya menyiapkan fondasi. Tidak ada skill Job Skill V2 baru, job baru, Advanced Job, Capstone baru, perubahan progression, level cap, rebalance monster/equipment, atau migration destruktif.

## Existing runtime findings

| Area | Status | Finding |
| --- | --- | --- |
| `derivedStats(hero)` | A — already supported | Source of truth untuk final effective stats. |
| `calculateFinalCharacterStats(hero)` | A | Alias/runtime entry point ke pipeline yang sama. |
| Physical Attack | A | STR, weapon, equipment dan modifier masuk melalui derived stats. |
| Magic Attack | A | INT, equipment dan modifier masuk melalui derived stats. |
| Skill Power | B — small extension | Sebelumnya `INT × 0.45` dan otomatis dipakai semua skill. Sekarang tetap ada sebagai stat, tetapi scaling skill harus eksplisit. |
| Skill Damage | B | Sekarang menjadi modifier percentage pada skill action saja; basic attack tidak memakai jalur ini. |
| Physical/Magic scaling | B | Sudah satu jalur bersama, sekarang mendukung coefficient physical, magic, dan optional Skill Power. |
| Damage mitigation | A | Combat memakai `mitigateDamage` terpusat dengan physical/magic defense dan penetration. |
| Critical / crit damage | A | Menggunakan stat final dan combat mechanics yang sama. |
| Block / evasion / damage reduction | A | Sudah memiliki formula runtime dan dibaca Combat Power. |
| Modifier order | B | Dipisah menjadi progression/mastery/item modifier, explicit Skill Power, lalu Skill Damage percentage. |
| Skill registry | B | Registry existing dipertahankan; schema kini punya action type, tags, optional prerequisites, dan explicit Skill Power coefficient. |
| Active skill rank | A/B | `skillLevels` dan `maxLevel` sudah ada; rank-specific curve per parameter belum ada. |
| Passive registry | B/C | Passive flat-stat sudah ada; conditional/event passive belum tersedia. |
| Prerequisites | B | ID prerequisite existing dipertahankan; schema baru dapat menyimpan required rank. Multiple prerequisites dapat dibaca. |
| Weapon requirement | A | Validasi existing sudah data-driven, tetapi taxonomy future seperti greatsword belum ditambahkan. |
| Multi-hit | C | Label `rapid_damage` ada, namun runtime masih menerapkan satu damage action; structured hit count belum ada. |
| DoT / periodic | B/C | Poison fixed timer didukung; generic duration/tick/stacking engine belum ada. |
| Status effects | B | Status existing tetap digunakan, tetapi evaluator generik/conditional belum ada. |
| Resource | B | Mana, stamina, barrier ada; resource secondary seperti Rage/Flow belum dibuat. |
| Combat Power | A/B | Membaca final stats, usable skills, mitigation, DPS/EHP/sustain/utility; kini juga membaca explicit Skill Power coefficient. |
| Save/load | A | Save tidak menyimpan CP sebagai source of truth; parser mempertahankan field lama dan default aman. |
| Automated tests | A | Test existing tetap lulus dan regression test baru ditambahkan. |

## Refactor yang diterapkan

### 1. Skill Power tidak lagi implicit dari INT

Formula lama pada jalur skill:

```text
Skill Power = INT × 0.45 + equipment/passive Skill Power
Skill damage = raw × (1 + (Skill Power + Skill Damage) / 100)
```

Perubahan:

```text
Skill Power = equipment/passive/buff Skill Power
raw skill damage = baseDamage
                + Physical Attack × physicalCoefficient
                + Magic Attack × magicCoefficient
                + Skill Power × skillPowerCoefficient
modified skill damage = raw skill damage
                      × progression/mastery/item modifier
                      × (1 + Skill Damage / 100)
```

`skillPowerCoefficient` default `0`. Karena itu INT tidak lagi menjadi hidden damage stat untuk physical skill. Skill masa depan dapat mengaktifkan Skill Power secara eksplisit.

### 2. Damage type dan hybrid foundation

`skillCombatScaling` sekarang mengembalikan physical, magic, damage type, dan Skill Power coefficient. Schema existing mendukung coefficient physical dan magic secara bersamaan sehingga hybrid skill dapat ditambahkan tanpa membuat combat pipeline baru.

### 3. Healing tetap terpisah

Direct `INT²` pada healing preview dihapus untuk mencegah double scaling. Healing tetap memakai Magic Attack dan Healing Power; Skill Power hanya ikut jika skill secara eksplisit memberikan coefficient.

### 4. Future-compatible schema kecil

`SkillDefinition` kini memiliki optional:

- `actionType`
- `tags`
- `prerequisites: [{ skillId, requiredRank }]`
- `skillPowerCoefficient`
- optional `combatScaling.skillPower`

Tidak ada engine summon, turret, Rage/Flow, DoT generic, atau event passive baru yang dibuat.

### 5. Combat Power

`PowerAction` sekarang membawa `skillPowerCoefficient`. Preview dan kalkulator CP memakai coefficient tersebut sehingga CP mengikuti effective skill scaling, bukan gear score atau bonus Skill Power statis.

## Affected existing skills

Semua skill aktif damaging yang sebelumnya menerima multiplier generic Skill Power tidak lagi menerima kontribusi implicit dari INT. ID yang terpengaruh oleh koreksi ini:

`fajar-step`, `fajar-strike`, `nova-fajar`, `warrior-breaker`, `warrior-charge`, `warrior-awakening`, `rogue-step`, `rogue-flurry`, `rogue-awakening`, `hunter-aim`, `hunter-volley`, `hunter-bind`, `hunter-awakening`, `wizard-bolt`, `wizard-circle`, `wizard-chain`, `wizard-awakening`, `acolyte-awakening`, seluruh skill `gatotkaca`, `garda`, `caroq`, `anom`, `srikandi`, `jagawana`, `resi`, `pujangga`, `pandita`, dan `bajra` yang terdaftar sebagai action damaging.

Magic skill tetap scale dari Magic Attack, sehingga perubahan ini tidak menghapus fungsi INT untuk magic combat. Physical skill sekarang tidak meningkat hanya karena INT naik.

## Files modified

- `lib/game/skills.ts` — optional scaling/action/tag/prerequisite schema.
- `lib/game/rules.ts` — explicit skill scaling, Skill Damage stage, healing correction, rank prerequisite support.
- `lib/game/combat-power.ts` — Skill Power coefficient masuk ke CP action evaluation.
- `lib/game/combat-power.test.ts` — formula expectation diperbarui dan regression tests ditambahkan.

## Regression validation

Full runtime test suite: **292 passed, 0 failed**.

Validated cases:

1. Physical skill tidak berubah ketika INT naik jika kedua coefficient Skill Power dan Magic sama-sama nol.
2. Magic skill meningkat melalui Magic Attack.
3. Skill Damage tetap bekerja pada physical dan magic skill.
4. Basic attack tidak memakai Skill Damage skill stage.
5. Skill Power hanya bekerja jika coefficient eksplisit tersedia.
6. Hybrid action menghasilkan physical dan magic coefficient terpisah.
7. Existing save/load, skill unlock, cooldown, mana, weapon validation dan job inheritance tetap lulus.
8. Combat Power tetap finite dan tidak menyimpan CP sebagai authoritative save field.
9. Mitigation, penetration, critical, block, evasion dan equipment preview tetap lulus.

TypeScript check masih melaporkan 6 error lama yang berada di area appearance fallback, UI layout, dan browser snapshot test (`rules.ts` appearance fields, `ui-layout.ts`, `tests/browser/real-components.tsx`). Tidak ada error baru yang berasal dari refactor Job Skill V2 foundation.

## Remaining limitations before Job Skill V2

- Multi-hit perlu schema hit list atau `hitCount/coefficientPerHit` sebelum skill combo V2 dibuat.
- Generic DoT perlu tick interval, duration, stacking dan refresh policy.
- Passive conditional/event evaluator belum ada.
- Future weapon types seperti greatsword/dual sword specialization perlu ditambahkan melalui registry, bukan hardcode skill.
- Rank-specific parameter curves belum dimodelkan; `maxLevel` existing tetap aman untuk rank dasar.
- Secondary resource, summon, turret dan deployable belum tersedia.
- Existing registry masih memiliki passive/capstone legacy; task ini tidak mengaktifkan atau menghapusnya.

## Stop condition

Foundation refactor selesai dan pekerjaan berhenti di sini. Tidak ada implementasi Job Skill V2 yang dibuat pada task ini.
