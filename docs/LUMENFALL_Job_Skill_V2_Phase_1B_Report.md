# LUMENFALL — Job Skill V2 Phase 1B

Tanggal: 19 September 2026. Status: implementasi foundation lokal selesai, tidak dipublish. Tidak ada skill atau job playable baru.

## 1. Cakupan dan audit runtime

Audit dilakukan sebelum perubahan formula, pada `rules.ts`, `skills.ts`, `skill-action.ts`, `world.ts`, `combat-mechanics.ts`, `combat-status.ts`, `weapon-style.ts`, `combat-power.ts`, `combat-power-config.ts`, `items.ts`, `regions.ts`, `character-screen.ts`, `character-view.ts`, serta regression tests Phase 0/1A. Save normalization dan serialization berada di `rules.ts`.

Temuan penting:

- `derivedStats(hero)` tetap satu final stat pipeline; `calculateFinalCharacterStats` merupakan alias fungsi yang sama.
- Seluruh 64 skill registry memiliki coefficient Skill Power nol. Tidak ada existing effect yang menggunakan generic Skill Power di luar jalur damage/heal/CP tersebut.
- Passive `wizard-foundation` dan `mantra-lore` memang memberi explicit Skill Power +2 per rank; tidak dihapus.
- `stagger` sebelumnya merupakan displacement, bukan poise damage.
- `staggerResistance` belum dipakai oleh formula combat aktif. Nilai karakter berasal dari Tenacity, dibatasi 0–50; monster normal/elite/boss bernilai 15/45/80. Nilai dan cap existing tidak diubah.
- Registrasi job playable existing masih 5 core job dan 10 specialization. Registry baru sengaja tidak dimasukkan ke daftar tersebut.

## 2. File yang diubah pada Phase 1B

| File | Perubahan Phase 1B |
| --- | --- |
| `lib/game/rules.ts` | Melepas INT dari Skill Power; healing membaca coefficient Skill Power dari resolved action. |
| `lib/game/skills.ts` | Optional `staggerDamage`, `knockbackStrength`, rank/hit fields; status ID `staggered`; dokumentasi legacy displacement. |
| `lib/game/skill-action.ts` | Resolve dua mekanik terpisah, termasuk rank values/mechanics dan per-hit. |
| `lib/game/stagger.ts` **baru** | Profile, runtime state, resistance, threshold/break, recovery, config terpusat. |
| `lib/game/world.ts` | Integrasi poise per-hit, incoming player capability, action-disable, recovery, cleanup/respawn. |
| `lib/game/regions.ts` | MonsterDefinition menerima optional StaggerProfile; tidak mengubah data monster. |
| `lib/game/combat-power.ts` | Diagnostics capability stagger dan unsupported-effects disclosure; tanpa skor spekulatif. |
| `lib/game/combat-power-config.ts` | Version 3 → 4 untuk perubahan semantic; balance weights tetap. |
| `lib/game/job-registry-v2.ts` **baru** | Canonical metadata, parent relations, versioned resolver, inactive flags. |
| `lib/game/character-screen.ts` | Skill Power dan Tenacity ditampilkan sebagai point/rating, bukan persen. |
| `components/game/stat-block-list.tsx` | Label/unit equipment mengikuti semantic tersebut. |
| `lib/game/phase-1b.test.ts` **baru** | 11 regression tests untuk stat, poise, CP compatibility, registry dan save. |
| `lib/game/skill-runtime-v2.test.ts` | 6 integration tests baru memakai class Game asli; merapikan promise registration dan unused parameter test. |
| Dokumen ini | Laporan implementasi dan batas kemampuan. |

Perubahan Phase 0/1A yang sudah ada, file user, serta penghapusan file sementara yang sudah ada sebelum task tetap dipertahankan. Tidak ada reset repository atau penghapusan asset.

## 3. Skill Power — formula sebelum dan sesudah

Sebelum:

```text
SkillPower = round1(INT_final × 0.45 + explicitSkillPowerModifiers)
```

Sesudah:

```text
SkillPower = round1(explicitSkillPowerModifiers)
baseline = 0
```

Modifier mengikuti pipeline equipment/passive existing: base item stats, active/unlocked Unique Stats, socket/rune, enhancement yang memang memodifikasi stat, serta passive. Tidak ada tambahan skor berdasarkan rarity atau enhancement level.

Equipment affix lama yang sudah dinonaktifkan oleh sistem existing TIDAK diaktifkan kembali. Belum ada generic Skill Power buff/mastery baru; sumber masa depan harus memasukkan explicit modifier ke pipeline yang sama, bukan membaca INT tersembunyi.

Raw damage tetap berasal dari resolved hit:

```text
rawHit = (baseDamage
        + physicalAttack × physicalCoefficient
        + magicAttack × magicCoefficient
        + skillPower × skillPowerCoefficient)
        × resolvedDamageMultiplier
```

Coefficient nol berarti kanal tersebut tidak berkontribusi. Legacy +12% per rank dan opt-in `rank_values` tetap dipisahkan. Tidak ada double scaling rank baru.

Healing existing tetap:

```text
rawHeal = max(35, resolvedBaseDamage || 35)
        + magicAttack × 0.25
        + healingPower × max(0.1, damageCoefficient || 0.65)
        + skillPower × resolvedSkillPowerCoefficient
heal = round(rawHeal × existingProgression/Mastery/EquipmentMultiplier)
```

Seluruh coefficient legacy healing yang terdaftar bernilai nol untuk Skill Power. Perubahan ke resolved coefficient menyiapkan opt-in rank-based healing, bukan membuat healing engine baru.

## 4. Audit seluruh existing skill dan compatibility

Semua ID berikut memiliki `skillCombatScaling(...).skillPower = 0` dan `skillPowerCoefficient = 0`/tidak diset. Tidak ada hitSequence legacy yang menambahkan kanal Skill Power.

| Kelompok | Semua skill ID yang diaudit | Coefficient SP | Dampak penghapusan INT→SP pada output existing |
| --- | --- | --- | --- |
| Adventurer | fajar-step, fajar-strike, guard-stance, nova-fajar | 0 | Tidak ada |
| Warrior | warrior-breaker, warrior-charge, warrior-guard, warrior-awakening | 0 | Tidak ada |
| Rogue legacy | rogue-step, rogue-flurry, rogue-vanish, rogue-awakening | 0 | Tidak ada |
| Hunter | hunter-aim, hunter-volley, hunter-bind, hunter-awakening | 0 | Tidak ada |
| Wizard | wizard-bolt, wizard-circle, wizard-chain, wizard-awakening | 0 | Tidak ada |
| Acolyte | acolyte-blessing, acolyte-heal, acolyte-barrier, acolyte-awakening | 0 | Tidak ada |
| Gatotkaca | gatotkaca-1, gatotkaca-2, gatotkaca-3, gatotkaca-4 | 0 | Tidak ada |
| Garda | garda-1, garda-2, garda-3, garda-4 | 0 | Tidak ada |
| Caroq | caroq-1, caroq-2, caroq-3, caroq-4 | 0 | Tidak ada |
| Anom | anom-1, anom-2, anom-3, anom-4 | 0 | Tidak ada |
| Srikandi | srikandi-1, srikandi-2, srikandi-3, srikandi-4 | 0 | Tidak ada |
| Jagawana | jagawana-1, jagawana-2, jagawana-3, jagawana-4 | 0 | Tidak ada |
| Resi | resi-1, resi-2, resi-3, resi-4 | 0 | Tidak ada |
| Pujangga | pujangga-1, pujangga-2, pujangga-3, pujangga-4 | 0 | Tidak ada |
| Pandita | pandita-1, pandita-2, pandita-3, pandita-4 | 0 | Tidak ada |
| Bajra | bajra-1, bajra-2, bajra-3, bajra-4 | 0 | Tidak ada |

Affected registered skill IDs dengan perubahan damage/heal akibat decoupling: **tidak ada**. Karena itu tidak diperlukan compatibility fallback, coefficient compensation, deprecated per-skill rule, atau hidden global dependency. Angka Skill Power yang ditampilkan turun sebesar komponen INT lama, bukan stat magic/healing.

Regression membandingkan damage seluruh skill pada rank 0 sampai maxRank, legacy healing, dan CP build legacy dengan snapshot Skill Power sebelum/sesudah penghapusan kontribusi INT. Output tetap sama.

## 5. Bukti fungsi INT dan optional Skill Power

Fixture identik dengan INT +100 menghasilkan:

| Stat | Delta |
| --- | ---: |
| Generic Skill Power | **0** |
| Magic Attack | +200 |
| Magic Defense | +50 |
| Max MP | +600 |
| Healing Power | +25 |

Physical action dengan magic/SP coefficient nol menghasilkan raw damage yang sama. Magic action dengan magicCoefficient positif meningkat melalui Magic Attack. Equipment Skill Power +30 memberi raw damage +60 pada coefficient 2, tetapi tidak mengubah action dengan coefficient nol. Passive Wizard rank 2 tetap memberi Skill Power +4, independen dari INT.

INT masih dapat memengaruhi total CP melalui magic/healing kit, MP/sustain dan manfaat yang benar-benar aktif; bukan melalui generic Skill Power. Magic Defense CP tetap mengikuti keterbatasan combat existing, tidak dibuat aktif secara sepihak.

## 6. Semantic final stagger vs displacement

| Property | Arti dan perilaku |
| --- | --- |
| `staggerDamage` | Raw damage terhadap gauge keseimbangan; tidak menggerakkan actor. |
| `knockbackStrength` | Displacement strength; tidak menambah gauge. |
| legacy `stagger` | Alias/fallback displacement lama, BUKAN staggerDamage. |
| legacy hit `staggerMultiplier` | Mengalikan displacement saja. |

Explicit `knockbackStrength` menang atas legacy `stagger` pada definition/rank patch yang sama. Legacy default displacement 0.45 atau 1.4 dan boss knockback multiplier 0.15 dipertahankan. Tidak ada mass conversion data skill.

Skill tanpa `staggerDamage` menghasilkan 0 poise damage. Dengan demikian 64 skill existing tidak otomatis mendapat mechanic/balance baru. Skill mendatang dapat memiliki high staggerDamage dengan knockbackStrength 0, atau sebaliknya.

## 7. Formula resistance dan profile

```text
effectiveStaggerDamage = max(0, rawStaggerDamage)
                      × 100 / (100 + max(0, staggerResistance))
```

0 / 25 / 50 / 100 resistance menerima 100% / 80% / 66.67% / 50% dari raw stagger. Nilai negatif diperlakukan nol; input non-finite ditangani aman. Tidak ada hard immunity pada rating biasa.

Player membaca `derivedStats(hero).staggerResistance`, yaitu Tenacity existing. Monster membaca `definition.staggerResistance`. Tidak ada reinterpretasi formula runtime lama karena sebelumnya stat ini belum dipakai combat. Cap stat player yang sudah ada tidak diubah.

`StaggerProfile` mempunyai optional threshold, duration, recovery delay/rate, resistance. `MonsterDefinition` menerima profile ini tanpa harus menulis ulang seluruh roster. Player mempunyai runtime `heroStaggerProfile` untuk threshold/duration; resistance tetap dari final stats.

## 8. Runtime state, threshold, break dan recovery

`StaggerState` berisi:

```text
currentStagger
staggerThreshold
lastStaggerDamageTime    (seconds of active simulation, nullable)
lastUpdateTime
lastBreak { timestamp, duration } | null
```

State disimpan pada Enemy runtime dan Game.heroStagger, tidak di Hero/save. Enemy mengalokasikan state secara lazy hanya saat benar-benar menerima positive stagger damage.

Central defaults di `STAGGER_CONFIG`:

| Parameter | Foundation default — belum final balance |
| --- | ---: |
| staggerThreshold | 100 |
| staggerDuration | 0.35 detik |
| staggerRecoveryDelay | 2 detik |
| staggerRecoveryPerSecond | 25 point/detik |
| resetOnBreak | 0 |

Setelah damage ditambahkan, gauge >= threshold memicu break, reset ke 0 tanpa carry-over, mencatat lastBreak dan mengembalikan `{effectiveDamage, broke}`. Durasi ditentukan profile target/config, bukan skill. Ini bukan event bus atau permanent trigger; future consumer harus memperhatikan timestamp.

Status helper menerapkan **`staggered`**, bukan alias `stun`. Enemy AI menggunakan control gate yang sama untuk berhenti sementara, tetapi status identity tetap berbeda. Player tidak dapat memulai movement, basic attack, nova atau cast baru selama staggered. Tidak dibuat animation-interrupt/cancel framework; sequence yang sudah berjalan mengikuti policy Phase 1A.

Gauge mulai berkurang setelah recovery delay, memakai elapsed active simulation time dan floor 0. Hit positif memperbarui last damage time; hit nol tidak menunda recovery. Pause menghentikan simulation recovery. Region/character/world lifecycle cleanup mereset state, respawn juga menghapus state enemy. Death/invalid target tidak menerima lanjutan hit atau stagger.

## 9. Multi-hit, critical, incoming damage

Setiap `ResolvedSkillHit` membawa own `staggerDamage`. Sequence 5 / 5 / 15 benar-benar menambah gauge bertahap sebanyak 5 / 5 / 15 pada resistance nol. Explicit sequence yang mengosongkan field mendapat **0**, bukan full cast staggerDamage. Single-hit fallback mewarisi cast staggerDamage satu kali. Rank values/mechanics dapat mengubah fields melalui resolver yang sama.

Critical hanya memodifikasi HP damage; tidak mengalikan staggerDamage. Poise tidak dikalikan Skill Damage, legacy rank multiplier, bossDamage, maupun displacement multiplier secara implisit.

Incoming player API menerima optional staggerDamage (default 0). Existing monster attacks masih mengirim 0 sehingga tidak ada mass monster rebalance. Parry/evasion/invulnerability menolak incoming hit sebelum poise; hit yang diterima memakai resistance final player. Block/barrier belum memiliki bonus pengurangan poise khusus: tidak diarang pada Phase 1B.

## 10. Combat Power

CP tetap membaca resolved action/hit dan final stats yang sama dengan combat. Test membandingkan actual HP loss dari cast dengan expected DPS pada profile target yang sama.

`inspectStaggerCapability(hits, targetProfile)` mengekspos raw total, effective total sesuai resistance, threshold dan `evaluated:false`. Ini diagnostics capability, bukan proyeksi timing, recovery, jumlah break, atau DPS tambahan.

Skill dengan poise damage dicatat pada `unsupportedEffects` sebagai stagger break yang belum dinilai berdasarkan threshold/resistance/uptime. **Tidak ada CP bonus baru untuk stagger atau rating arbitrary untuk Tenacity.** Config version dinaikkan untuk semantic/cache; semua balance coefficient CP dipertahankan. Nilai normal HP damage dan mitigation tetap dinilai seperti Phase 1A.

## 11. Canonical Job V2 registry — seluruh IDs dan display names

Tier 0: `adventurer` → **Adventurer**.

| Core (Tier 1) | Specialization (Tier 2) | Future Advanced (Tier 3) |
| --- | --- | --- |
| `warrior` — Warrior | `berserker` — Berserker | `executioner` — Executioner |
| `warrior` — Warrior | `blade_master` — Blade Master | `crimson_blade` — Crimson Blade |
| `thief` — Thief | `rogue` — Rogue | `spectre` — Spectre |
| `thief` — Thief | `assasin` — Assasin | `reaper` — Reaper |
| `acolyte` — Acolyte | `luminary` — Luminary | `stellar` — Stellar |
| `acolyte` — Acolyte | `sacred_fist` — Sacred Fist | `warmonk` — Warmonk |
| `archer` — Archer | `ranger` — Ranger | `astral_ranger` — Astral Ranger |
| `archer` — Archer | `marksman` — Marksman | `sniper` — Sniper |
| `knight` — Knight | `vanguard` — Vanguard | `royal_guard` — Royal Guard |
| `knight` — Knight | `phalanx` — Phalanx | `gladiator` — Gladiator |
| `mage` — Mage | `summoner` — Summoner | `warlock` — Warlock |
| `mage` — Mage | `sorcerer` — Sorcerer | `arcanist` — Arcanist |
| `smith` — Smith | `blacksmith` — Blacksmith | `mastersmith` — Mastersmith |
| `smith` — Smith | `specialist` — Specialist | `siege` — Siege |

Total 36 immutable metadata records: 1 + 7 + 14 + 14. Semua record V2 memiliki `playable:false`; Tier 3 memiliki `activation:'future_locked'`, lainnya `inactive`. Bahkan nama core yang sama bukan grant playable melalui registry ini; akses legacy tetap dari registry lama. Tidak ada alias `assassin`: spelling yang digunakan tepat **Assasin / assasin**.

## 12. Versioned resolver dan compatibility legacy/save

`JobV2Identity` adalah schema metadata terpisah:

```text
jobArchitectureVersion: 2
coreJob: CoreJobV2Id | null
specialization: SpecializationV2Id | null
advancedJob?: AdvancedJobV2Id | null
```

`resolveJobV2Lineage()` memvalidasi tier/parent dan menghasilkan Adventurer + Core + Specialization + optional advanced metadata. Advanced pada lineage bukan authorization untuk skill/play. Invalid parent chain ditolak.

`resolveJobMetadata(id, architectureVersion)` default ke legacy, versi 2 harus explicit. Ini penting karena `rogue` adalah legacy Core tetapi V2 Specialization; `ranger` dan `arcanist` juga memiliki collision dengan original legacy job. Tidak ada alias/mapping Gatotkaca→Berserker atau Garda→Blade Master.

Registry lama tidak dihapus atau ditulis ulang. `activeSkillsFor(coreJob, specialization)` dan current authorization tetap dipakai tanpa duplicate registration. Metadata lineage disiapkan untuk adapter activation sesi berikutnya.

Tidak ada field V2 yang ditambahkan ke seluruh Hero, tidak ada rewrite save format, migration, wipe, atau perubahan character existing. Save parsing/serialization existing tidak diubah. Semua 10 legacy specialization diuji round-trip dengan skill level dan skill points tetap. Gauge poise bukan property Hero sehingga tidak masuk JSON save; status timer menggunakan storage status existing dan dibersihkan pada lifecycle reset.

## 13. Semua regression tests baru

11 tests dalam `phase-1b.test.ts`:

1. INT +100: SP tetap, Magic Attack/Defense/MP/Healing tetap meningkat; final stat alias sama.
2. Physical/magic/SP independent; equipment SP opt-in dan save round-trip.
3. Passive SP tetap bekerja tanpa INT.
4. Audit semua 64 skill/rank, old/new damage/heal dan legacy-build CP equivalence.
5. Zero/invalid poise, diminishing resistance tanpa ordinary immunity.
6. Accumulation, custom threshold/duration, break reset, distinct staggered identity.
7. Recovery delay, interruption, time-rewind safety, floor zero.
8. Rank stagger vs displacement, per-hit no inheritance, CP diagnostics threshold/resistance.
9. Semua 36 exact IDs/names/tiers/parents dan inactive flags.
10. Legacy/version collisions dan semua legacy specialization save round-trips, tanpa mapping V2.
11. Metadata lineage Warrior→Berserker/Blade Master, optional locked advanced, invalid-parent rejection, tidak ada skill baru.

6 tests ditambahkan pada `skill-runtime-v2.test.ts`, menggunakan class Game asli tanpa constructor WebGL:

12. Actual 3-hit gauge 5/5/15, termasuk forced crit/noncrit dan zero knockback.
13. Legacy displacement multiplier tetap 1/4 dalam fixture; zero poise tidak membuat gauge.
14. Actual break menahan enemy windup, status expiry berbeda dari stun, recovery pause/resume dan cleanup.
15. Incoming player memakai final resistance, menahan aksi, gauge tidak masuk save, reset world.
16. Killed target/invalid sequence tidak menerima poise lanjutan.
17. Actual Skill Power HP damage = CP expected damage; stagger dilaporkan tetapi tidak menambah CP.

Seluruh coverage Phase 0/1A tetap dijalankan, termasuk rank legacy/explicit, true multi-hit, mana/cooldown sekali per cast, dead/world invalidation, status alias, parry expiry/consume, weapon styles, frontal arc, save/load, dan sistem equipment/stat existing.

## 14. Hasil verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| Baseline regression sebelumnya | 307 passed, 0 failed |
| Regression Phase 1B baru | 17 passed |
| Full suite `lib/game/**/*.test.ts` | **324 passed, 0 failed, 0 skipped** |
| Production build | **Berhasil**, exit code 0 |
| TypeScript before | **6 existing errors** |
| TypeScript after | **6 existing errors**, tidak ada tambahan |
| Focused lint 5 module/test files baru/extended | Berhasil, exit code 0 |

Enam TypeScript error tetap: empat narrowing appearance fallback pada rules.ts:348–351, satu ui-layout.ts:64 (`scale`), satu tests/browser/real-components.tsx:177 (`Snapshot.cameraMode`). Typecheck belum bersih, tetapi tidak ada error baru dari Phase 1B. Tidak mengklaim error lama sebagai akibat task ini.

Build mempunyai warning chunk besar, plugin timing, dan route classification static analysis; build tetap sukses. Tidak melakukan perubahan bundling di luar scope. Tidak ada visual browser playtest pada task ini; validasi runtime memakai headless Game integration tests. Tidak deploy/publish.

## 15. Readiness, batasan dan STOP

Foundation siap merepresentasikan Warrior V2 dengan optional Skill Power, explicit ranks, rank mechanics, hitSequence, frontal arc, parry result, greatsword/dual_sword styles, staggerDamage terpisah dan canonical job lineage.

Tidak ditemukan kebutuhan major rewrite yang memicu stop condition. Remaining work sebelum konten playable:

- Desain/balance final skill tree, target threshold/duration/recovery dan equipment/skill eligibility untuk activation berikutnya.
- Sambungkan V2 identity/lineage ke promotion/skill authorization secara eksplisit saat pengguna mengizinkan aktivasi; metadata saat ini sengaja tidak membuat Berserker/Blade Master playable atau persisten pada Hero.
- CP belum mengevaluasi nilai crowd-control/poise uptime secara andal; tidak memberi fake score.
- Belum ada stagger HUD, dedicated animation, interrupt framework, boss immunity/diminishing CC chain, atau block/barrier-specific poise rule. Existing sequence mengikuti policy Phase 1A.
- Legacy healing architecture dipertahankan, bukan full new healing/summon scaling framework.
- Enam error TypeScript existing tetap perlu task terpisah jika ingin project-wide typecheck bersih.

Tidak membuat Rage, Flow, passive event bus, DoT engine, summon/turret, GCD, full animation system, off-hand basic damage, Advanced Mastery, Capstone baru, progression changes, monster/equipment rebalance atau destructive migration.

**Tidak ada Warrior/Berserker/Blade Master/Advanced Job skill baru dan tidak ada Job V2 yang diaktifkan. Phase 1B berhenti di sini; Warrior Skill Tree V2 menunggu task berikutnya.**
