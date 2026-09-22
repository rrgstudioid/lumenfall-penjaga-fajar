# LUMENFALL — Job Skill V2 Phase 1A

Tanggal: 19 September 2026. Status: implementasi foundation lokal selesai; belum dipublish. Tidak ada skill Warrior/Berserker/Blade Master baru yang diregistrasikan.

## 1. File yang berubah pada Phase 1A

| File | Perubahan |
| --- | --- |
| `lib/game/skills.ts` | Schema rank opt-in, rank mechanics, hit sequence, frontal arc, Warrior weapon requirements. |
| `lib/game/skill-action.ts` (baru) | Pure resolver, resolved action/hit, rumus raw hit bersama, ringkasan coefficient, queue hit, tes geometri frontal arc. |
| `lib/game/rules.ts` | Adapter Hero → resolver; mana/cooldown/preview memakai hasil resolver; weapon eligibility bersama. |
| `lib/game/world.ts` | Eksekusi resolved action, scheduling, snapshot stat, per-hit mitigation, status adapter, parry event, cleanup lifecycle. |
| `lib/game/combat-power.ts` | Evaluasi hit individual dari resolver yang sama, eligibility senjata, pelaporan efek yang belum dinilai. |
| `lib/game/combat-power-config.ts` | Config version 3; benchmark frontal arc satu target. |
| `lib/game/combat-mechanics.ts` | Konstanta armor-break multiplier 0,8 yang sebelumnya literal pada world. Nilainya tidak berubah. |
| `lib/game/combat-status.ts` (baru) | Compatibility status helpers dan defense event sementara. |
| `lib/game/weapon-style.ts` (baru) | Resolver style berdasarkan equipment aktual dan alias greatsword. |
| `lib/game/items.ts` | One-hand sword dapat ditempatkan di off-hand; validasi pasangan dua instance berbeda. |
| `lib/game/skill-runtime-v2.test.ts` (baru) | 15 regression/integration tests, mencakup kebutuhan A–S. |
| Dokumen ini | Laporan implementasi dan batas kemampuan. |

Perubahan Phase 0 yang sudah ada pada working tree, termasuk `combat-power.test.ts`, dipertahankan. File user lain dan penghapusan dokumen sementara yang sudah ada tidak disentuh.

## 2. Schema baru dan perluasan

`SkillDefinition` menerima field optional:

- `progressionMode: 'legacy' | 'rank_values'`
- `rankValues: SkillRankValues[]`
- `rankMechanics: { [rank]: { values?, addStatuses?, addTags?, hitSequence? } }`
- `physicalCoefficient`, `magicCoefficient`, `skillPowerCoefficient`, `damageType`
- `hitSequence`, `statuses`, `stagger`, `angle`, `maxTargets`, `canCrit`
- `targetType: 'frontal_arc'` sebagai tambahan bentuk existing.

Tidak ada ID skill baru di registry. Fixture dalam test hanya dipasang sementara selama test, lalu dilepas.

## 3. Bentuk ResolvedSkillAction

`resolveHeroSkill()` mengumpulkan final stats, rank, mastery, equipment modifier, dan eligibility senjata. `resolveSkillAction()` menghasilkan object baru melalui clone definition. Object ini tidak disimpan ke save.

```text
ResolvedSkillAction
  skillId, rank, damageType
  baseDamage
  physicalCoefficient, magicCoefficient, skillPowerCoefficient
  damageMultiplier
  manaCost, cooldown, castingTime
  range, radius/areaRadius, duration, stagger
  targetType, actionType, tags, statuses
  angle, maxTargets
  weaponAllowed, resolvedWeaponStyle
  timing: castStart, impact, castEnd
  hitSequence: ResolvedSkillHit[]
```

Resolved hit membawa delay, coefficient masing-masing, baseDamage, damage channel, damage multiplier, izin crit, status aplikasi, dan stagger multiplier. Object dapat diperluas oleh modifier masa depan tanpa memodifikasi registry. Phase ini belum membuat conditional passive engine.

## 4. Legacy progression

Definition tanpa `progressionMode` tetap legacy. Damage progression tetap:

```text
legacy rank factor = 1 + (rank - 1) × 0,12
```

Rank nol tetap dapat dipreview sebagaimana runtime sebelumnya. Test membandingkan seluruh registry pada rank nol sampai max rank dengan formula sebelum Phase 1A. Angka physical/magic coefficient legacy tetap berasal dari `skillCombatScaling` dan `damageCoefficient` existing.

Mastery power, equipment skill modifier, Skill Damage, mana-cost reduction, dan cooldown reduction tetap memakai sumber existing. Economy SP, reset/promotion, dan inheritance tidak berubah.

## 5–6. V2 rank_values dan anti-double-scaling

V2 opt-in dengan `progressionMode: 'rank_values'`. Nilai dimulai dari base definition, kemudian patch rank 1 sampai rank terpilih diterapkan berurutan. Field kosong mewarisi nilai aman sebelumnya. Nilai numerik non-finite tidak diterapkan.

Field rank yang didukung: baseDamage, ketiga coefficient, manaCost, cooldown, castingTime, range, radius, duration, stagger.

V2 memakai rank factor **1**, bukan `1 + (rank - 1) × 0,12`. Physical/Magic/Skill Power coefficient V2 yang tidak diberikan default ke nol. Rank mechanics di threshold yang sudah tercapai dapat menambah status/tag, mengubah parameter, atau mengganti hit sequence.

Bukti test: Rank 5 dengan baseDamage 50 dan physicalCoefficient 2 menghasilkan raw damage `50 + 2 × PhysicalAttack`, tanpa dikalikan 1,48. Rank 3 membuka armor_break, dan Rank 5 mengubah radius. Modifikasi hasil resolver tidak mengubah definition asal.

## 7–8. Hit sequence dan scheduling runtime

Contoh schema yang diuji, bukan skill yang ditambahkan ke game:

```ts
hitSequence: [
  { delay: 0, physicalCoefficient: 0.35 },
  { delay: 0.16, physicalCoefficient: 0.35 },
  { delay: 0.32, physicalCoefficient: 0.50 }
]
```

Field damage yang kosong pada structured hit menjadi nol. Hit tidak mewarisi full coefficient/baseDamage milik cast secara otomatis. Tanpa sequence, resolver menghasilkan satu hit delay nol dengan parameter resolved skill.

```text
rawHit = baseDamage
       + PhysicalAttack × physicalCoefficient
       + MagicAttack × magicCoefficient
       + SkillPower × skillPowerCoefficient

hitDamage = rawHit × rankFactor × masteryPower
                   × (1 + itemSkillModifier)
                   × (1 + SkillDamage / 100)
```

World membayar mana dan menetapkan cooldown sekali. Stat penyerang di-snapshot saat cast, termasuk crit, penetration, bonus elite/boss, dan attacker level untuk hit berikutnya. Setiap hit melakukan roll crit sendiri jika `canCrit`, lalu pembulatan damage dan `hurtEnemy()`/mitigation existing. Legacy default tidak crit.

`SkillHitQueue` dimiliki world dan di-update memakai delta waktu simulasi. Hit delay nol langsung dijalankan; hit selanjutnya menunggu deadline. Tidak memakai setTimeout. Pause menghentikan kemajuan sequence. Ketika beberapa deadline lewat dalam satu frame, hit tetap dieksekusi terpisah dan berurutan.

Target dipilih saat cast. Validasi tiap hit memastikan world belum disposed, sedang aktif, caster hidup, region build masih sama, target masih ada, masih hidup, dan masih instance spawn yang sama. Target yang mati dalam sequence tidak dapat terkena sisa hit setelah revive. Queue dibersihkan saat ganti region, ganti karakter, kembali ke menu, kematian caster, dan disposal.

Timing dalam detik relatif cast start: `castStart = 0`, `impact = delay hit pertama`, `castEnd = max(castingTime, delay hit terakhir)`. Ini metadata timeline, bukan animation lock/GCD/channel. Frame timing tidak tersinkronisasi dengan marker animasi GLB.

## 9. Combat Power multi-hit

CP menerima `hitSequence` dari `resolveHeroSkill()` yang sama dengan world. `skillHitDamage()` juga dipakai keduanya. CP menjumlahkan expected damage tiap hit setelah crit, rounding, target defense, penetration, dan elite/boss bonus.

```text
expectedCastDamage = Σ expectedMitigatedDamage(hit)
DPS = expectedCastDamage × usableCastRate
```

Mana demand dan cooldown dihitung sekali per cast. Tidak ada pengalian buta satu coefficient dengan hit count. Ringkasan coefficient hanya dipakai untuk compatibility API dan physical/magic relevance; damage CP memakai hit individual.

Untuk rank status `armor_break`, CP memperhitungkan pengurangan defense pada hit berikutnya dalam sequence selama duration aktif, memakai konstanta 0,8 yang sama dengan world. Test membandingkan actual HP loss world dengan expected DPS CP. Status synergy lintas beberapa skill/rotasi tetap di luar estimator ini.

Parry uptime dan status yang belum punya evaluator diberi label pada `unsupportedEffects`; tidak diberi CP statis dari nama/deskripsi.

## 10. Status helper

API: `hasStatus`, `getStatus`, `applyStatus`, `removeStatus`.

Adapter memakai field enemy existing (`stun`, `slow`, `root`, `poison`, `defenseDown`, `marked`, `weakPoint`) jika field tersebut tersedia, atau dictionary `statusEffects` untuk Hero/status tambahan. Tidak memigrasikan save atau menggandakan storage.

Alias:

| ID | Storage existing |
| --- | --- |
| armor_break | defenseDown |
| mark | marked |
| weak_point | weakPoint |

Status numerik memakai refresh max duration. Boolean marked/weakPoint tetap mengikuti perilaku legacy: sampai dilepas/reset/respawn, bukan duration-based stack. Timer tambahan enemy berkurang saat simulation update dan dibersihkan saat respawn. ID baru dapat disimpan/dicari, tetapi tidak otomatis memiliki efek damage/control yang belum diimplementasikan. Guard tidak di-alias ke parry.

## 11–12. Defense result, expiry, consume

State world-only:

```ts
lastDefenseEvent: {
  result: 'none' | 'hit' | 'blocked' | 'parried',
  timestamp: number, // milidetik waktu simulasi aktif
  sourceId?: string,
  consumed: boolean
}
```

Pada incoming attack yang diterima oleh damage handler, window `parry` diperiksa lebih dahulu. Parry berhasil mencatat event dan meniadakan damage hit tersebut. Kalau tidak parry, evasion/mitigation tetap berjalan, lalu block chance atau tombol guard menghasilkan `blocked`; sisanya `hit`. Source enemy ID diteruskan. Invulnerability/death gate existing tetap berlaku.

API world: `wasRecentlyParried(windowMs)` dan `consumeRecentDefenseEvent(result, windowMs)`. Event hanya valid di window yang diminta, dibatasi maksimum 5.000 ms simulasi. Window infinity ditolak. Consume menandai event sehingga tidak dapat dipakai dua kali. Event baru menggantikan event sebelumnya. Lifecycle cleanup juga menghapus event. Tidak ada event bus atau passive counter otomatis.

## 13–15. Weapon taxonomy dan dual sword

Koreksi audit sebelumnya: `EquipmentType` sudah memiliki `one_hand_sword`, `two_hand_sword`, dan `shield` sebelum Phase 1A. Yang diperluas adalah skill requirement/style `WeaponType`.

Canonical combat style: `one_hand_sword`, `greatsword`, `dual_sword`, `shield`. Requirement `two_hand_sword` adalah alias `greatsword`. Item tetap menyimpan identity equipment type existing.

`dual_sword` membutuhkan dua item ID berbeda, kedua equipmentType one_hand_sword, keduanya one_hand, dan bukan twoHanded, di mainHand/offHand. Satu item tidak dianggap dua senjata; label weaponType `dual_sword` pada satu item juga tidak cukup. One-hand sword sekarang dapat dipasang melalui equip validation existing ke off-hand, tanpa menambah template palsu atau mengubah angka item.

Resolver baru digunakan live eligibility dan CP. Legacy weapon labels dan requirement tetap lewat jalur compatibility existing; tidak ada hardcode ID skill/job V2.

Full dual-wield damage **belum dibuat**: tidak ada alternating hand, off-hand attack coefficient, atau damage event basic tambahan. Koreksi audit sebelumnya: generic equipment aggregation existing sudah menjumlahkan modifier item di kedua slot, satu kali per item ID. Perilaku itu dipertahankan; bonus stat sword off-hand juga mengikuti pipeline tersebut. Ini bukan formula serangan per tangan yang baru.

## 16. Frontal arc

Pada bidang X/Z:

```text
distance(caster, target) <= range
dot(normalized forward, normalized target direction) >= cos(angle / 2)
```

Angle dalam derajat, default 90. Target hidup yang lolos diurutkan dari jarak terdekat, lalu dibatasi `maxTargets` jika diberikan. Enemy di belakang/out-of-range/out-of-angle tidak terpilih. Origin/forward berasal dari actor/direction runtime yang sama dengan basic attack.

Tidak ada collision raycast, obstacle occlusion atau ground targeting. CP memakai `COMBAT_POWER_CONFIG.frontalArcExpectedTargets = 1`, sehingga tidak ada perkalian AoE spekulatif per skill. Test membuktikan arah depan/samping/belakang, range, rotasi forward, dan maxTargets.

## 17–18. Save dan existing skill compatibility

Resolved actions, pending hits, serta defense events bukan field Hero/save. `skillLevels`, passiveLevels, skillPoints, masteryChoices, job/coreJob/specialization dan equipment ID tidak diubah formatnya. Tidak ada wipe/mass migration. Dua sword ID dalam slot existing lolos save/load regression.

Skill tanpa field baru tetap memakai single hit immediate, legacy scaling dan validation existing. `activeSkillsFor(coreJob, specialization)` tidak diubah. SP tetap satu per level, active/passive satu pool, reset/promotion tetap existing. Tidak ada skill registration, job rename, Advanced Job, atau Capstone baru.

Perubahan gameplay terarah yang disengaja: window parry existing kini benar-benar menangkis damage; one-hand sword dapat memenuhi kombinasi off-hand sword. Equipment/monster/base stat balance tidak diubah.

## 19–21. Tests dan TypeScript

**307 test lulus, 0 gagal**: 292 existing + 15 baru. Build production `vinext build` berhasil. Build memberi warning chunk >500 kB dan klasifikasi route unknown; build tidak gagal. Tidak ada publish atau pengujian visual animasi baru.

Test baru menggunakan method `Game.castSkill`, `Game.applySkill`, `Game.hurtEnemy`, `Game.hurtHero` sebenarnya, dengan renderer/audio/storage stub di headless harness. Ini menguji jalur runtime, bukan hanya menjumlahkan array fixture.

| Test baru | Requirement |
| --- | --- |
| Seluruh legacy skill, rank 0–max, dibanding formula baseline | A, R |
| Explicit rank fallback/mechanic/registry isolation, tanpa 12% | B, C |
| Real cast 3 hit terpisah, cost/cooldown sekali | D, E, F, G |
| Target mati dan revive tidak menerima hit sisa | H |
| Pause/dead/disposed/region invalid membersihkan sequence | H/lifecycle |
| CP per-hit crit/round/mitigation sama dengan resolver | I, S |
| Status read/apply/remove dan aliases legacy | J |
| Real parry, timestamp, expire, hard max age, consume sekali | K, L, M |
| Dua sword distinct, single/spoof rejected, save/load | N, O, Q |
| Alias greatsword/two_hand_sword | Warrior requirement |
| Frontal arc runtime dan batas target | P |
| Rank armor break mengubah hit berikutnya dan CP cocok HP loss | C, I |
| Magic + Skill Power multi-hit memakai snapshot yang sama | I, S |
| V2 self support tanpa phantom enemy damage/CP | Consistency |
| Invalid/missing coefficient menghasilkan nilai finite | S |

TypeScript: **6 error sebelum → 6 error sesudah**, pada masalah yang sama. Tidak ada error TypeScript baru dari Phase 1A:

- 4 error tipe string pada appearance fallback di `rules.ts`.
- 1 error properti `scale` di `ui-layout.ts`.
- 1 error fixture Snapshot tanpa `cameraMode` di `tests/browser/real-components.tsx`.

## 22–24. Limitations, kesiapan, dan blocker

Foundation siap menerima skill Warrior V2 yang memakai kemampuan Phase 1A: rank explicit, rank unlock status/parameter, hit sequence, parry window/event konsumsi, sword style, dan frontal arc. Tidak diperlukan replacement combat pipeline, skill registry, equipment system, atau save.

Batas yang harus dibaca sebelum menulis desain:

1. **Skill Power baseline Phase 0 belum sesuai laporan lamanya.** Runtime masih menghitung `INT × 0,45 + modifier` di derivedStats. Phase 1A sengaja mempertahankan hasil stat existing. V2 physical dengan magicCoefficient=0 dan skillPowerCoefficient=0 tidak scale INT; jika Skill Power coefficient dipilih positif, INT masih dapat ikut melalui final Skill Power. Pemisahan sumber Skill Power harus dituntaskan sebelum desain mengandalkan Skill Power independen dari INT. Ini bukan error baru Phase 1A.
2. Damage channel masih physical/magic. Mixed attack coefficients bisa dipakai, tetapi tiap action memilih satu mitigation channel; belum ada split physical/magic mitigation per hit.
3. `stagger` memakai besaran knock/displacement existing pada hurtEnemy (boss multiplier existing tetap berlaku), bukan meter poise/stagger baru. Jangan memasukkan angka desain 10/20 dengan asumsi itu poise point.
4. Sequence memilih target saat cast; tidak retarget/recheck posisi tiap hit, tidak ada line of sight. Frame update membatasi presisi timing. CastEnd bukan action lock. Tidak ada animation marker sync, cancel, channel atau GCD.
5. Rank mechanic `addStatuses` memberi efek nyata hanya untuk status yang dibaca runtime; string status baru tidak menciptakan mechanic baru otomatis. Conditional callback/passive belum dibuat.
6. Mark/weakPoint boolean mengikuti lifetime legacy. Tidak ada generic stack/replace-stronger/DoT engine.
7. CP menilai expected damage sequence dan armor-break dalam cast; tidak menyimulasikan survival target, movement, cancel, conditional passive, parry uptime, atau rotasi status lintas skill. Efek yang belum punya evaluator tidak diberi rating palsu.
8. Equipment restrictions core/specialization legacy tetap berlaku. Requirement baru tidak mengaktifkan job Berserker/Blade Master atau menambah toolkit mereka.
9. Tidak ada Rage, Flow, off-hand strike tambahan, alternating attacks, summon, turret, deployable atau projectile engine.
10. Enam masalah TypeScript lama tetap menjadi hambatan untuk clean typecheck project, walaupun runtime regression dan build berhasil.

Blocker Phase 1A yang belum dikerjakan: tidak ada untuk capability yang diminta. Ada keputusan lanjutan sebelum skill set final: semantik stagger/poise, sumber Skill Power independen dari INT, dan pemetaan job V2 ke registry job existing. Ketiganya dicatat; tidak diubah atau diasumsikan diam-diam pada task ini.

Pekerjaan berhenti pada foundation ini. Warrior Skill V2 belum dimulai.
