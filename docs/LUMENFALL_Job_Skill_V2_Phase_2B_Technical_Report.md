# LUMENFALL — Phase 2B Technical Report

Tanggal: 19 September 2026. Scope: progression readiness dan Warrior runtime support, bukan registrasi konten Warrior V2.

## 1. Files changed

Path relatif terhadap root project. Working tree sudah memiliki perubahan Phase 0/1A/1B dan aset sebelumnya; daftar ini hanya file yang disentuh untuk Phase 2B.

| File | Perubahan Phase 2B |
|---|---|
| `lib/game/progression.ts` | Baru: konfigurasi cap dan threshold legacy/development V2. |
| `lib/game/rank-ownership.ts` | Baru: ledger paid/granted, normalisasi, pembelian, grant, investasi tree. |
| `lib/game/combat-modifiers.ts` | Baru: modifier typed, temporary lifecycle, stat/action/target/incoming evaluator. |
| `lib/game/combat-transient.ts` | Baru: bounded stack dan next-heavy window runtime. |
| `lib/game/rules.ts` | Integrasi progression, ownership/refund, prerequisites, modifier final-stat/action, save filtering. |
| `lib/game/skills.ts` | Optional metadata tree, investment, passive prerequisites, modifiers, support, counter policy, temporary buff. Tidak menambah registry entries. |
| `lib/game/skill-action.ts` | Resolved action membawa target modifiers dan immutable counter snapshot; rank lalu modifier resolver. |
| `lib/game/combat-status.ts` | Snapshot non-consuming pada defense-event helper existing. |
| `lib/game/world.ts` | Valid cast/context, final mana payment, per-cast success, stack/window lifecycle, timed modifiers, incoming support. |
| `lib/game/combat-power.ts` | Resolver/target-hit yang sama, conditional diagnostics, dependency-cache safety. |
| `lib/game/combat-power-config.ts` | Cache/formula version diperbarui menjadi 5. Tidak memberi arbitrary effect score baru. |
| `lib/game/phase-2b.test.ts` | Baru: 15 regression tests. |
| `lib/game/skill-runtime-v2.test.ts` | Ditambah 8 Phase 2B integration tests; suite Phase 1A/1B dipertahankan. |
| `lib/game/character-ui.test.ts` | Koreksi oracle refund yang sebelumnya mempertahankan bug paid Rank 1. |
| Dua report Phase 2B di `docs/` | Ringkasan pemilik dan laporan teknis ini, termasuk design metadata future. |

Tidak ada perubahan UI untuk Phase 2B. Tidak ada deployment, perubahan monster/equipment balance, atau registrasi skill/passive produksi baru.

## 2. Progression configuration

`ProgressionArchitecture = 'legacy' | 'v2_test'`. `Hero.progressionArchitecture` optional. Absen atau nilai tidak dikenal diperlakukan sebagai legacy; bukan inferensi dari job/level. `progressionRules(hero)` memilih config eksplisit. `createV2TestHero()` adalah factory developer/test, tidak ditautkan ke main menu.

Threshold metadata legacy: Core 10, specialization 25. V2 test: Core 15, specialization 60. `advancedPlayable` false. Mutation job legacy menolak karakter `v2_test`, sehingga jalur uji tidak tanpa sengaja memakai trainer legacy untuk aktivasi V2.

## 3. Absolute/test/legacy caps

| Konsep | Nilai | Status |
|---|---:|---|
| Absolute architecture maximum | 100 | Reserved configuration, bukan playable cap. |
| Legacy/live content | 50 | Tetap default. |
| V2 development/test content | 80 | Explicit test path saja. |
| Lv81–100 | — | Tidak dapat dicapai melalui gainXP pada kedua path; load diklem ke cap path. |

Alias `MAX_LEVEL` existing tetap 50. `WORLD_CONFIG` live dan pet level cap tidak diganti menjadi 80/100. Load level, job-history level, dan pengembalian stat points mengikuti cap path yang dipilih.

## 4. XP audit

Runtime menggunakan fungsi `xpNeeded(level) = 90 + level * 40`, bukan tabel yang berakhir pada Lv50. Batas sebelumnya berada pada loop `gainXP`, bukan ketiadaan baris EXP. Tidak ada kurva baru atau angka requirement per-level baru dibuat.

Loop sekarang memakai cap path. Development test dapat menguji level 51–80 dengan fungsi existing tersebut. Ini ekstrapolasi formula existing untuk testing, **bukan persetujuan balance EXP production 51–80**. Reward per-level dihitung loop yang sama.

Audit UI menemukan `app/page.tsx` masih memakai `hero.level === 50` untuk full EXP bar dan label LEVEL MAKSIMAL. Dibiarkan karena UI V2 tidak diaktifkan dan user melarang pekerjaan UI baru. Sebelum V2 menjadi playable melalui UI, dua pengecekan itu harus membaca content cap; saat ini developer harus menggunakan state/test API untuk verifikasi cap80, bukan menganggap HUD legacy sudah V2-ready. ParseSave dan reset stat points yang dahulu membatasi50 sudah menjadi architecture-aware. Pet progression tetap50 dan bukan bagian task.

## 5. Level rewards

Setiap iterasi naik level tetap +1 SP dan +3 stat points. Lv1→50 menghasilkan49/147; Lv1→80 menghasilkan79/237. Tidak mengisi total reward secara hardcoded. XP tambahan ketika sudah cap tidak menghasilkan reward ulang. Stat reset di path80 mengembalikan237 melalui rumus `(level - 1) × 3` dengan clamp cap path.

## 6. Paid/granted rank schema

Optional ledger `rankOwnership: {version:1, active:{[id]:source}, passive:{[id]:source}}`; `source = {granted, paid, legacyUncertain?}`.

Actual rank tetap berasal dari `skillLevels`/`passiveLevels`; ledger tidak menjadi skill-level pipeline kedua. Sanitasi menghitung `granted = min(actualRank, validRecordedGranted)` dan `paid = actualRank - granted`, sehingga metadata rusak tidak menciptakan total rank tambahan. `buyRank` menaikkan actual rank dan paid; `grantRank` hanya mengisi kekurangan menuju floor, tidak mengubah paid rank menjadi free.

Starter grants dicatat saat freshHero benar-benar memberikannya; grant specialization dicatat pada titik pemberian. Bukan tebakan refund berdasarkan job, slot, atau rank1.

## 7. Legacy save compatibility

Save version utama tetap3. Tidak ada bulk rewrite/wipe karakter. Parser menerima ledger optional, mempertahankan rank serta IDs tak dikenal, dan menormalisasi ledger di memory. Penyimpanan terjadi lewat save biasa, bukan operasi migration massal.

Origin pada save tanpa ledger tidak dapat direkonstruksi secara pasti. Kebijakan konservatif: rank tak diketahui dianggap paid/refundable dengan `legacyUncertain:true`. Ini menjaga paid SP tetapi bisa memberi windfall satu kali untuk grant lama yang tidak dapat dibuktikan. Unknown future IDs tetap dipertahankan; refund hanya untuk nodes yang registry sekarang kenal. Tidak mengaku mampu membuktikan origin historis.

Save normal mengecualikan `temporaryModifiers` dan `combatStateModifiers`. Stack/window/defense/poise tetap state runtime. Test save menggunakan memory storage, tidak mengubah localStorage pemain.

## 8. Refund/reset fix

Refund menjumlah paid ranks dari registry active/passive. Reset menahan recorded grants, mengembalikan paid SP, membersihkan hotbar melalui helper existing, dan tetap membutuhkan500 GOLD. Input hero tidak dimutasi oleh fungsi reset preview/result. Promotion core mempertahankan lifecycle reset/refund existing, dengan hitungan paid yang benar. Specialization grants tidak mengubah paid origin menjadi gratis.

Test character UI sebelumnya mengharapkan refund2 setelah tiga pembelian nyata, karena salah satu paid Rank1 dianggap free. Expected result diperbaiki menjadi3, SP+3, dan bought rank kembali0. Ini koreksi oracle untuk bug yang diminta diperbaiki, bukan pengurangan coverage. Seluruh assertions/test progression lain tetap ada.

## 9. Tree investment requirement

`TreeScope = {id, architecture:'legacy'|'v2'}` dan `investmentRequirement = {tree, paidRanks}`. Validator menghitung current paid investment dari metadata node, mengecualikan target ID, granted ranks, scope/version lain, dan duplicate IDs. Maksimum kontribusi mengikuti max rank node. Sesudah respec, investment turun.

Test merepresentasikan requirement25 secara generic dengan fixture tree, bukan daftar ID Warrior dalam validator. Rank1 target tidak dapat membuka dirinya sendiri. Current requirement tetap diperiksa pada pembelian berikutnya; perubahan itu tidak mengaktifkan tree produksi.

## 10. Passive ranked prerequisites

PassiveDefinition menerima optional `prerequisites: [{skillId, requiredRank}]`. Validator AND existing membaca actual rank active maupun passive, ditambah level/job/SP/maxRank checks existing. Contoh Guard Training2 atau Great Weapon Familiarity3 dapat diekspresikan tanpa content registration. `activeSkillsFor` inheritance legacy tidak diganti.

## 11. Temporary modifier architecture

Typed CombatModifier membatasi kemampuan ke selector, condition, secondary-stat flat/percent, action damage/stagger/knockback/cooldown/mana percentages, dan incoming multipliers. Tidak ada arbitrary script/callback dalam save/registry.

`addTemporaryModifier` meng-clone definition, memberi remaining duration, dan refresh/replace berdasarkan ID. Simulation tick mengurangi timer; expired modifier tidak ikut stats/action. Pause membekukan simulation time. Respec/world reset/character change/death/region reset membersihkan state melalui runtime cleanup.

`derivedStats` tetap final-stat authority, dengan extension secondary modifiers pada akhir pipeline existing. Urutan modifier: passive → weapon → temporary → context. Dalam modifier stat, flat diterapkan sebelum percent; modifier berurutan mengomposisikan hasil. Tidak ada formula STR/INT kedua. Alias attack/defense dan tenacity/staggerResistance disinkronkan.

`ResolvedSkillAction` tetap clone per cast. Mana/cooldown dibaca dari action final; validasi struktur dilakukan lebih dulu dan mana dibayar satu kali setelah context/window modifiers diselesaikan. Tidak mengenakan mana per-hit.

## 12. Tag modifier architecture

Selector `tags` memakai all-of match, optional tree scope/version, dan weapon styles. Action modifiers mengubah resolved hit copies, bukan registry. Heavy stagger modifier hanya mengubah `staggerDamage`; HP damage dan displacement tidak ikut berubah kecuali property masing-masing eksplisit diberikan.

Target predicates ditunda ke impact. Tidak ada passive event bus. Nilai/rank curve passive baru belum ditentukan: registry extension menyediakan payload modifiers/support; penyusunan payload per-rank untuk content mendatang tetap harus mengikuti angka desain, bukan memakai angka fixture.

## 13. Weapon condition architecture

Menggunakan resolver equipped style Phase1A: greatsword alias/two-hand, dual_sword dari dua one-hand swords. Generic modifiers mengecek actual style. Runtime membuang stack/window yang tidak kompatibel; payload stack juga membawa weapon selector agar equipment preview sebelum world tick tidak mewarisi bonus invalid.

Tidak ada off-hand basic attack contribution, alternating hand engine, atau double basic attack baru.

## 14. CounterContext

Frozen snapshot `{result:'none'|'blocked'|'parried', timestamp?, sourceId?}`. `counterPolicy` pada skill menentukan accepted results dan recent window. Snapshot diambil setelah structural/weapon/target checks; mana final masih harus berhasil dibayar sebelum event di-consume. Preview tidak mengonsumsi defense event.

Cast valid mengonsumsi satu event sekali. Passive dan active membaca snapshot yang sama, tidak masing-masing consume. Snapshot diteruskan ke resolved action dan tidak berubah saat defense event berikutnya datang. Delayed whiff setelah valid cast tetap menghabiskan kesempatan. Jika mana/target tidak valid, event masih tersedia. Expiry/consume helper Phase1A tetap berlaku.

## 15. Target-condition modifier

`resolveTargetHit` adalah pure helper bersama runtime/CP. Memeriksa `hasStatus` dari compatibility helper, termasuk `armor_break` dan distinct `staggered`. Semua status dalam predicate harus aktif. Snapshot coefficient tidak dimutasi; predicate dibaca per impact sehingga hit belakangan dapat melihat armor break dari hit sebelumnya.

Currently staggered berarti status aktif setelah break, bukan gauge hampir penuh. Target predicates pada fase ini mendukung hit damage/stagger/displacement; target-conditional cost/cooldown/stat bukan implementasi supported dan tidak boleh dipakai oleh definisi content.

## 16. Transient stack implementation

`TransientCombatState` dimiliki world, membawa stackCount/maxStacks/expiry/lastEligibleCastId/optional weaponStyle, next cast identity, dan next-heavy windows. Tidak ditulis ke save atau resource UI.

World menganggap cast successful setelah actual enemy HP berkurang dari damage event valid. Satu local success flag berlaku untuk seluruh targets/hits cast tersebut. Killing hit dihitung sebelum early return untuk target mati. Invalid target/delayed cancellation/basic attack tidak memanggil stack trigger.

Great-weapon window: eligible heavy+greatsword valid cast membuka window; eligible berikutnya memakai snapshot bonus lalu mengonsumsi window. Preview/invalid cast tidak mengonsumsi. Consumption tidak sekaligus rearm pada cast yang sama; expiry/weapon mismatch menghapus window. Tidak ada angka durasi/bonus produksi: seluruhnya data future/fixture.

## 17. Battle Momentum test behavior

Fixture membuktikan multi-hit3 × AoE2targets menghasilkan6 damage events tetapi hanya1 stack. Cast berikutnya memakai bonus stack sebelumnya; cast pertama tidak memperoleh kenaikan retroaktif. Cap3, target-independent state, inactivity timeout, basic0, invalid0, killinghit1, dan world cleanup sudah diuji.

## 18. Twin Blade Rhythm test behavior

Menggunakan stack mechanism sama dengan required style dual_sword. Actual equipment main/off-hand fixture diuji. Single sword tidak menghasilkan Rhythm; melepas off-hand menghapus state saat sync dan derived payload tidak memberikan bonus pada preview incompatible. Tidak ada Flow atau basic-attack double trigger.

## 19. Awakening fixture

Temporary modifier scope `tree:{id:'warrior',architecture:'v2'}` dapat menguatkan resolved Warrior actions saja. Test membandingkan dengan tree Adventurer dan memeriksa registry tidak berubah. Action-only modifier tidak memengaruhi basic attacks. Existing multi-hit memakai immutable stats/action snapshot; hanya cast yang diselesaikan setelah buff aktif menerima bonus baru. Tidak dibuat skill Awakening/legacy ultimate replacement.

## 20. Adrenaline readiness

`hpAtOrBelow` menggunakan HP/maxHP comparison dengan batas inklusif. Stat-stage memakai baseline maxHP yang sudah dihitung pipeline, tanpa memanggil derivedStats secara rekursif. Action/incoming stage memakai final maxHP context. Hindari modifier yang mengubah maxHP sekaligus menggantungkan dirinya pada threshold HP tanpa desain eksplisit karena baseline/final contexts memang berbeda.

Cache CP memasukkan HP ketika ada HP-dependent modifier, termasuk modifier pada skill definition. Low-HP defense fixture mengubah final stats; CP menampilkan kondisi saat ini, bukan mengklaim uptime100% sepanjang pertarungan.

## 21. Indomitable Will readiness

Incoming stagger memakai existing break result/lastBreak. Bila result.broke true, optional learned support memasang timed anti-chain modifier. Hit berikutnya membaca modifier tersebut. Tidak perlu event bus. Test benar-benar menjalankan hurtHero → break → buff → reduced next poise damage. Monster existing masih mengirim stagger0; tidak dibalance ulang agar fixture menjadi aktif di live.

## 22. Guard/Unbroken readiness

Incoming modifier dapat mengubah damage, received stagger dan displacement. Perhitungan defense/DR/manual guard/block existing tetap berlaku. Modifier baru masuk satu reduction group: ambil pengurangan paling kuat dibanding hasil existing, bukan mengalikan setiap buff lagi menuju immunity. Positive safety floor untuk input multiplier baru mencegah nol/negatif; bukan nilai bonus desain.

Guard buff tidak membuat parry window. Parry tetap status dan jalur terpisah. Tenacity/staggerResistance satu rating, bukan dua bonus independen. Incoming displacement menerima vector optional yang tetap melalui collision movement existing. Critical damage tidak menggandakan stagger secara otomatis; canCrit per-action existing tetap tersedia tanpa crit engine baru.

## 23. Combat Power treatment

Final stats dan resolved actions sama dengan combat. CP memakai `resolveTargetHit` untuk status yang benar-benar dimodelkan evaluator: armor break dari earlier hit dalam sequence. Added regression membandingkan expectedDPS dengan actual damage world dari sequence bersyarat tersebut.

Tidak memberi score dari description. Belum menghitung reliable uptime untuk counter opportunities, low-HP, stack generation, next-heavy window, awakening activation, staggered target frequency, atau anti-chain. Ditandai dalam unsupportedEffects. Modifier stat/action yang sedang aktif tetap tercermin sebagai snapshot strength; ini bukan asumsi bahwa buff tersebut permanen. Incoming-only reductions belum diterjemahkan menjadi EHP baru dan dilaporkan terbatas.

Cache mencakup serialized modifier payload, HP bila conditional, equipment/stats/skills/passives existing. Active/expired buff dan perubahan stack mengubah key. Counter context tidak menjadi permanent hero stat atau cached assumed bonus; CP menggunakan neutral context dan menandai keterbatasannya. Tidak ada manual CP compensation.

## 24. Tests added

15 tests di `phase-2b.test.ts`:

1. CP skill-local HP predicate + incompatible weapon stack preview.
2. Save ownership retained, ephemeral modifiers stripped, live hero not mutated.
3. Explicit caps, XP loop/rewards, load clamps, stat reset, locked V2 promotion.
4. Legacy Core10/Specialization25 dan grants.
5. Paid Rank1 refund, GOLD requirement, immutable reset result.
6. Granted1+paid2 refund dan promotion refund.
7. Ambiguous old save, retained unknown IDs, no repeated refund after reset/load.
8. Generic25 investment, passive ranked AND prerequisites, architecture/self/free exclusions, post-respec investment.
9. Real temporary flat/percent stat, expiry, nonrecursive low-HP.
10. Actual greatsword/dual equip gates.
11. Heavy-only stagger, tree scope, target predicates, registry immutability.
12. Immutable blocked/parried snapshots, preview, expiry, consume.
13. Guard strongest-wins group, separate received poise/displacement, positive floor.
14. Stack cap/inactivity/weapon gate + pure window preview/consume.
15. CP cache conditional HP, buff expiry and stack changes; unsupported uptime.

8 integration tests ditambahkan pada `skill-runtime-v2.test.ts`:

1. CP target-conditioned sequence equals real world damage.
2. Heavy window opens, survives invalid cast, consumes valid next cast with final mana cost.
3. Actual multi-hit/AoE one-stack-per-cast and fixed same-cast snapshot.
4. Invalid/basic0, actual killing-hit1 and expiry.
5. Zero-target0 and actual dual-sword Rhythm gate.
6. Invalid counter preserves event; valid delayed whiff consumes once with frozen snapshot.
7. Actual temporary buff cast/expiry and currently-staggered target bonus.
8. Actual break-trigger anti-chain, next received poise/displacement and cleanup.

Fixtures are temporarily registered inside tests and removed in finally blocks. No production skill/passive is added. All numerical bonus/duration values in these tests are assertions, not final balance.

## 25. Full test result

Before:324 passed,0 failed. After:**347 passed,0 failed,0 skipped** (+23 tests). Ran all `lib/game/**/*.test.ts` through Node's test runner with TypeScript stripping. Existing Phase0/1A/1B suites still pass. One refund oracle corrected as explained in section8; no test removed.

Focused lint on new modules, modified action resolver and new/integration tests: exit0. Runtime integration uses actual WorldRuntime methods with a headless world fixture; no claim of manual browser gameplay/visual verification.

## 26. Production build

`node node_modules/vinext/dist/cli.js build`: exit0, all five build stages completed. Existing-style warnings about chunk size >500kB, plugin timings and automatic route classification were informational, not failures. No publish/deploy performed.

## 27. TypeScript before/after

Before:6 existing errors. After:6 existing errors. **New errors:0.** `tsc --noEmit --pretty false` still exits1; this is not a fully clean TypeScript project.

| File/location after changes | Existing error |
|---|---|
| `lib/game/rules.ts:356–359` | Four appearance fallback string/literal-union mismatches. |
| `lib/game/ui-layout.ts:64` | Missing scale on inferred position type. |
| `tests/browser/real-components.tsx:177` | Snapshot fixture missing cameraMode. |

No unrelated type fixes were used to disguise the baseline. Line numbers of appearance errors moved as imports/types were added.

## 28. Remaining blockers and next task

Foundation requirements of this phase are implemented without replacement of combat/stat/save engines. Content implementation still needs approved numerical rank definitions and controlled job/tree authorization wiring; those are not silently supplied here. Development80 is not approval to expose V2 in production. Live activation must address HUD cap checks and level51–80 balance separately.

Current intentional limits: bounded selectors, no arbitrary passive scripts/event bus, no general DoT/summon/turret/resource engine, no per-effect reliable conditional CP uptime, no off-hand basic damage. Passive modifier payloads are explicit metadata; concrete rank-varying passive values will need to be supplied by the approved content definitions rather than automatic legacy scaling. UI counter/window cost preview remains neutral-context; actual cast charges final contextual cost. Future UI may expose that preview when those skills exist.

### Approved future design metadata (not registry)

| Node | Prerequisite intent |
|---|---|
| Iron Charge | Warrior Strike1 |
| Sweeping Slash / Guard Stance | Warrior Strike2 |
| Rising Slash / Battle Cry | Iron Charge2 |
| Armor Breaker | Sweeping Slash2 |
| Counter Slash | Guard Stance3 |
| Ground Breaker | Rising Slash3 |
| Battle Focus | Battle Cry2 |
| Severing Arc | Armor Breaker3 |
| Relentless Assault | **Battle Focus2 AND Combat Instinct2; no Severing Arc prerequisite.** |
| Unbroken Stance | Guard Stance3 AND Battle Cry2 |
| Iron Reversal | Counter Slash3 AND Guard Training3 |
| Crushing Finale | Armor Breaker4 AND Ground Breaker3; future secondary synergy currently staggered, not near-full gauge. |
| Great Weapon Momentum | Great Weapon Familiarity3 |
| Twin Blade Rhythm | Twin Blade Familiarity3 |
| Warrior Awakening | **Lv59 AND25 current PAID Warrior ranks invested**, scoped to V2 tree. |

Direct-damage Warrior skills may opt into existing canCrit; stagger/debuff potency does not automatically crit, and buffs are not crit actions. Nothing in this table registers playable content.

Phase2B ends here. No Warrior/Berserker/Blade Master skill/passive, Rage, Flow, Advanced Job, or Capstone was created or activated. Await next instruction.
