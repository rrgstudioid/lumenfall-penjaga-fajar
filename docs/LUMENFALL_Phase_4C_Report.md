# LUMENFALL — Phase 4C: Thief V2

Tanggal: 20 September 2026. Status: Phase 4C FINALIZED secara lokal, termasuk kedua keputusan final pemilik. Thief tetap development-only. Tidak dipublikasikan.

## Ringkasan finalisasi

Finalisasi hanya mengubah keterangan kontrak di lib/game/thief-v2.ts, menambah dua regression tests di thief-v2.test.ts dan skill-runtime-v2.test.ts, serta memperbarui kedua laporan Phase 4C. Tidak diperlukan perubahan formula/execution: perilaku draft sudah sesuai keputusan final. Perbandingan hash definition Thief dan Warrior, dengan description dikecualikan, identik sebelum/sesudah; angka, prerequisite, dan jumlah node tidak berubah.

Hasil akhir: 502 passed/0 failed; production build berhasil; diagnostic primary-source TypeScript persis sama, 6 sebelum/6 sesudah. Tidak menjalankan world balance/playtest baru, audit monster/map, implementasi specialization atau publish pada finalisasi ini.

## REPORT A — Pemilik game

### Hasil utama

- Registry berisi tepat **16 active + 14 passive Thief V2**. Jumlah maksimal 140 rank: 1 granted, 139 paid.
- Quick Stab Rank 1 diberikan melalui otorisasi development, gratis dan tetap ada setelah Reset Skill.
- Thief tetap terkunci pada pilihan job normal. Warrior tetap satu-satunya Core Job publik yang tersedia. Tidak ada konversi legacy Rogue menjadi Thief.
- Personal Mark benar-benar milik caster/generation tertentu, hanya satu target per caster, refresh/move sesuai cast, tidak dikonsumsi serangan Thief, dan tidak disimpan permanen.
- Smoke Veil memakai Stealth combat existing. Mark, memilih target, gerak dan buff tidak mengakhirinya. Cast offensive valid mengambil snapshot lalu mengakhiri Stealth; kegagalan target/Mana tidak mengonsumsi. Positive HP damage mengakhirinya; full barrier tidak. Ini bukan AI invisibility.
- Rear memakai sektor belakang 90° berdasarkan arah target di dunia, bukan kamera. Rear diperiksa pada impact. Crippling hanya memperpanjang Slow; Rear Rend meningkatkan damage; Weakpoint menggabungkan bonus own-Mark dan Rear secara aditif dalam satu payoff group.
- Slipstep membaca arah input gerak, fallback arah hadap. Disengage mundur dari arah hadap saat cast tanpa memutar karakter. Keduanya collision-aware, tidak butuh target, tanpa iframe/Stamina.
- Twin Fang dan Blade Flurry membutuhkan dua dagger berbeda di main/off hand. Damage memakai hitSequence nyata, bukan visual palsu atau basic attack ganda.
- Instinct memengaruhi action Thief yang baru di-resolve. Tidak mengubah basic/Adventurer/sequence yang sudah berjalan. R3 memakai jalur pembulatan Mana existing: Blade Flurry 15 menjadi 14 MP.
- K menampilkan 30 node, detail rank/prasyarat/weapon/Mana/CD, jarak movement, dan deskripsi passive. Active memakai hotbar existing; passive tidak bisa dipasang. Tidak mengisi semua 16 active otomatis.
- Chrome headed berhasil membuka Padang Arunika dengan karakter memory-only. STEALTH, MARKED, Instinct, tiga hit Flurry, dan Reset lewat K diperiksa di aplikasi sebenarnya.

### Diagnostik Crit dan Mana — bukan rekomendasi rebalance

Build contoh legal Lv59 menggunakan 58 paid SP dan 174 alokasi stat: STR90, VIT24, DEX60, INT0; dua dagger Common existing yang hanya diotorisasi untuk fixture. Tidak memakai semua passive max.

| Konteks | Crit Rate |
|---|---:|
| Stat permanen, termasuk Keen Instinct | 10,5% |
| Action Thief dengan Dual Dagger Familiarity | 13% |
| Marked Strike R5 terhadap personal Mark, termasuk Opportunist | 32% |
| Rear Rend dengan Rear Awareness, benar-benar dari belakang | 18% |
| Silent Opening R5 dari Stealth | 37% |
| Silent Opening + Instinct R3 | 47% |
| Setelah cap combat 80% | 47% |

Bonus di atas bukan dijumlahkan semuanya ke setiap skill. Marked Strike bukan rear-synergy; Silent Opening bukan mark-synergy. Fixture ini tidak mencapai cap secara trivial. Ini bukan pembuktian bahwa semua kombinasi equipment masa depan aman.

Rotasi precision sesuai biaya dasar: 8+12+14+10+15+22 = **81 MP**. Rotasi Core biasa: 5+9+8+10+15 = **47 MP**. Biaya tidak diubah. Mana regen/monster/gear tidak ditune.

### Bug yang diperbaiki

1. Dialog Reset berada di belakang panel K: sekarang menggunakan window/dialog manager existing; tombol Cancel/Confirm dapat diklik secara normal.
2. Copy Reset masih menyebut Warrior Strike: sekarang nama job dan daftar granted rank dibaca dari ownership aktual, termasuk Quick Stab.
3. Predicate HP rendah default memakai Max HP baseline: Evasive Instinct kini opt-in ke Max HP setelah bonus unconditional, termasuk Agile Conditioning. Predicate Warrior tidak diubah.
4. Slow Thief 20% dapat tertinggal saat legacy Slow diterapkan kemudian: jalur legacy mempertahankan potency lamanya; tidak melemah akibat metadata Thief.
5. CP/presentation tidak boleh menganggap Mark Prey memberi phantom damage; personal Mark diperlakukan sebagai non-damaging action.

### Keputusan pemilik — FINAL

**1. Range melee 3,5m**

- Twin Fang, Crippling Cut, Venom Edge, Marked Strike, Blade Flurry, Silent Opening, Rear Rend dan Weakpoint Assault memakai range final tepat 3,5m pada semua rank, tanpa range scaling.
- Quick Stab tetap 3,5m; Mark Prey tetap 8m; Shadow Lunge tetap 6,5/6,75/7/7,5/8m sesuai rank.
- Nilai runtime tidak berubah dari draft; statusnya sekarang kontrak final yang disetujui.

**2. Silent Opportunity pada multi-hit**

- OPTION B disetujui: satu snapshot cast-time Stealth berlaku pada seluruh hit dari tepat satu eligible offensive Thief cast.
- Bukan trigger/consume/stack baru per hit. R1/R2/R3 tetap +5/+10/+15 Crit Damage.
- Accepted offensive commit memutus Stealth melalui ordering existing. Delayed hits mempertahankan snapshot; cast berikutnya tidak mendapat bonus kecuali masuk Stealth lagi.
- Test runtime membuktikan semua hit tetap mendapat bonus walaupun passive diubah setelah hit pertama, lalu cast berikutnya tanpa Stealth tidak mendapat bonus.

Kedua keputusan sudah final. Tidak ada rebalance atau perubahan angka dari draft. Tidak ada Rogue/Assasin V2, Rage/Flow/Energy/Combo Point yang dibuat. Balance/playtest fase berikutnya tetap menunggu instruksi terpisah.

### Hasil pemeriksaan

| Pemeriksaan | Sebelum | Sesudah |
|---|---:|---:|
| Full lib/game test | 477 sebelum implementasi; 500 sebelum finalisasi | 502 passed, 0 failed |
| Error TS source utama | 6 | 6, tidak ada tambahan |
| Production build | Baseline berhasil | Berhasil |

Raw TypeScript tetap gagal: selain 6 error source utama, tsconfig turut membaca salinan source/template lama di output/. Jangan menafsirkan laporan ini sebagai clean tsc. Arsip itu tidak dihapus untuk menyembunyikan error.

## REPORT B — Teknis

### File yang diaudit

Registry/resolver: skills.ts, warrior-v2.ts, thief-v2.ts, skill-action.ts, combat-modifiers.ts, combat-transient.ts, rank-ownership.ts, weapon-style.ts.

Stat/otorisasi/save: rules.ts, job-registry-v2.ts, progression.ts, job-presentation.ts, items.ts, character-view.ts, hotbar.ts; resource policy existing tidak diganti.

Combat/presentation: world.ts, combat-position.ts, stealth.ts, combat-status.ts, stagger.ts, combat-mechanics.ts, combat-power.ts, combat-feedback UI, job-skill.tsx, draggable-window.tsx, skill-visuals.ts.

Tests: seluruh lib/game suite, terutama thief-foundation.test.ts, skill-runtime-v2.test.ts, warrior-v2.test.ts; harness tests/browser/warrior-world*.

### File yang diubah/dibuat

| File | Peran |
|---|---|
| lib/game/thief-v2.ts (baru) | 30 definition + rank tables/modifier selectors |
| lib/game/personal-mark.ts (baru) | Source-aware runtime-only Mark |
| lib/game/directional-movement.ts (baru) | Arah gerak dan substep collision callback |
| lib/game/skills.ts | Registrasi 30 node; optional movement/personalMark/status fields |
| lib/game/skill-action.ts | Resolve movementDistance dan status duration hasil modifier |
| lib/game/combat-modifiers.ts | Own-Mark predicate; durasi/movement modifiers; HP threshold basis opt-in |
| lib/game/rules.ts | Dev Thief grant/otorisasi, reset state cleanup |
| lib/game/world.ts | Cast/impact integration, Mark lifecycle, movement, Slow potency, HUD/VFX |
| lib/game/combat-power.ts | Non-damage Mark; poison status duration; limitation reporting |
| lib/game/skill-visuals.ts | Ikon unik menggunakan glyph existing |
| components/game/job-skill.tsx | Movement detail, grant/copy reset, dialog layering |
| lib/game/thief-v2.test.ts (baru) | 16 test kontrak/diagnostik |
| lib/game/skill-runtime-v2.test.ts | 7 test Game runtime baru; count registry diperbarui |
| lib/game/thief-foundation.test.ts | Asersi fase tanpa content diperbarui menjadi 16+14; boundary lama tetap diuji |
| tests/browser/thief-world-fixture.ts (baru) | Memory-only Thief loadout |
| tests/browser/warrior-world-fixture.ts | Route fixture `core=thief` |
| tests/browser/warrior-world.tsx | Label/form dev sesuai Core Job |
| tests/browser/thief-v2-smoke.mjs (baru) | Headed real-world/K/reset regression dan screenshot |

Tidak ada edit angka warrior-v2.ts, katalog item, monster, drops, formula primary stats, EXP, promotion publik atau save schema. Penghapusan lock-file Word yang sudah ada sebelum task tidak disentuh.

### Pipeline

Registry → explicit rank_values → passive/equipment/temporary modifiers → ResolvedSkillAction → target validation/cast commit → queued per-hit impact.

- Physical raw = baseDamage + final Physical Attack × coefficient. Magic/Skill Power coefficient 0. Tidak ada STR/DEX/INT kedua atau legacy +12% rank multiplier.
- Normal scoped bonus dijumlahkan. Payoff group Weakpoint menjumlahkan Mark dan Rear sebelum menjadi satu multiplier total raw.
- Crit Rate/Crit Damage action-local; tiap hit melakukan roll sendiri melalui fungsi combat existing, cap 80%. Crit tidak memperbesar stagger, Slow, Mark atau Poison duration.
- Cast Stealth condition dibekukan saat resolve, sebelum commit menghapus Stealth. Positional/own-Mark condition default diperiksa per impact terhadap original cast target.
- Queue, target lifecycle, mana satu kali, cooldown satu kali, action lock existing dipakai ulang. Tidak ada multi-hit retarget saat currentTarget diganti.

### Personal Mark

WeakMap target → source-key → entry, dikelola PersonalMarks per world. Key berisi sourceActorId + sourceGeneration; payload sourceSkillId + remaining. Apply clear hanya Mark source itu, bukan source lain. Recast reset remaining, bukan menumpuk durasi.

Valid callback memakai targetIdentity/cast generation dan entity hidup. Update simulation dt menghapus expiry/death/invalid spawn. clearSkillRuntime membersihkan map saat reset/death/transition/dispose. Tidak masuk Hero save atau equipment. HUD memilih Mark milik player, bukan sumber lain; legacy Mark tetap kompatibel. Ini bukan fondasi multiplayer/party baru.

### Movement dan status

Slipstep memakai moveVector actual yang sudah camera-relative, dinormalisasi; tanpa input memakai direction caster. Disengage membekukan -direction saat cast. Substep ≤0,25m memanggil move existing; collision/terrain tetap authoritative. Lock tidak membuat vector input hilang karena vector diambil sebelum lock dipasang.

Shadow Lunge memakai path targeted dash collision-aware existing, range rank dari kontrak; stopDistance/impactRange 2,5m dipakai ulang dari path existing sebagai jarak kontak, tanpa teleport belakang atau pathfinding baru.

Slow memakai optional potency 0,20; legacy default tetap 0,58. Rear menambah hanya durasi. Poison memakai timer/formula existing: interval 0,6s, coefficient attack 0,08, minimum 2; sumber final attack tetap perilaku runtime existing, bukan snapshot engine DoT baru. Durasi Venom Edge memakai status duration langsung, bukan legacy +3 detik. Venomcraft menambah duration, tidak damage tick.

### Passive / stat / CP

Stat modifiers tetap melewati derivedStats. Evasive Instinct memakai basis unconditional-final Max HP agar tidak recursive; default predicate lama tidak berubah. Condition baseline baru tidak menulis HP/Max HP baru ke save.

Action modifiers menggunakan selector tree/tags/style. Durasi Stealth, personal Mark, Poison dan directional distance memiliki extension kecil pada modifier stage existing, bukan special-case puluhan ID dalam damage engine.

CP membaca resolved sequence dan per-hit crit yang sama. Personal Mark tidak punya hit phantom; Stealth/Rear/Mark uptime yang tidak diketahui tidak diberikan bonus spekulatif. Directional utility, positional uptime dan poison refresh contention masih limitation evaluator; tidak dibuat arbitrary CP compensation.

### Dev entry / browser evidence

`http://127.0.0.1:3003/warrior-world.html?core=thief&level=59&build=all&sp=200`

Localhost + DEV guard existing; memory localStorage/sessionStorage dipasang sebelum game import. Tidak membaca/mengubah save user. `build=all&sp=200` adalah sandbox nonlegal untuk inspeksi 30 node, bukan contoh build Lv59 legal. Gunakan tanpa SP override untuk ekonomi level normal.

Real map Padang Arunika, Three.js, Chrome visible 1440×1000. Masuk lewat Continue, K melalui keyboard, reset lewat click UI. Cast combat dijalankan lewat authoritative Game API pada fixture, dengan pause/manual simulation steps untuk menangkap state singkat. Ini smoke/integration pass, **bukan sesi feel/balance manual penuh**, bukan verifikasi semua expiry melalui waktu browser normal.

Bukti dalam output/phase4c-browser/:

1. 01-menu.png — menu dev memory.
2. 02-world.png — map sebenarnya.
3. 03-k-panel.png — 30 node dan hotbar.
4. 04-stealth.png — Stealth.
5. 05-marked-stealth.png — personal Mark tanpa memutus Stealth.
6. 06-instinct.png — Instinct + Mark + Stealth.
7. 07-flurry.png — resolved three-hit cast; result.json mencatat tiga damage events dan cost14 pada Instinct R3.
8. 08-reset-confirmation.png — dialog foreground, grant/cost benar.
9. 09-reset-complete.png — paid139 refunded, SP61→200, Gold1000→500, Quick Stab1, Instinct0, target/indikator bersih.

result.json mencatat assertion/state. Browser tidak menghasilkan JS page exception atau resource game gagal. Ada satu console 404 untuk `/favicon.ico` milik harness, dilaporkan dan tidak disamarkan sebagai error gameplay. warnings kosong.

### Test coverage dan hasil

17 tests baru thief-v2.test.ts: jumlah/ownership/public lock; semua rank/lock; golden damage tables; raw fixture 200 attack; ownership Mark/generation/refresh/expiry; movement; passive scope; mark/rear timing; multi-hit per rank; Mana81/47 + Instinct; paid25/root/reset; CP/INT; final-MaxHP threshold; seluruh prerequisite; semua multi-hit coefficient; legal Lv59 Crit; final range semua rank dan pengecualian Mark/Lunge.

8 tests Game runtime baru: Mark/payment/lifecycle; real independent hits/crit/cast-target snapshot/death; Stealth commit and HP barrier ordering; actual movement path; rear Slow/Poison/nonconsume; world reset cleanup; legacy Slow overlap; Silent Opportunity R1–3 one-cast/all-hits snapshot, next cast tanpa bonus, dan re-Stealth. Test lama tidak dihapus. Dua assertion registry lama disesuaikan terhadap content baru (80→96 active definitions dan Thief30).

`node --experimental-strip-types --test lib/game/*.test.ts`: **502 passed / 0 failed / 0 skipped**. Baseline implementasi477, sebelum finalisasi500; finalisasi menambah2 regression tests. Log output/phase4c-final-tests.log.

Production build vinext: berhasil setelah finalisasi. Ada warning ukuran chunk dan informasi klasifikasi route Unknown dari tooling existing; tidak dianggap bukti performa final. Log output/phase4c-final-build.log.

Primary TS: empat appearance fallback di rules.ts, satu ui-layout.scale, satu snapshot cameraMode di tests/browser/real-components.tsx; **6 sebelum / 6 sesudah finalisasi**. Raw tsc juga membaca output arsip/template dan tetap nonzero. Log output/phase4c-final-tsc-before.log dan output/phase4c-final-tsc-after.log.

### Keterbatasan dan gate

- Kedua keputusan range/Silent Opportunity telah dikunci; tidak ada blocker desain tersisa untuk finalisasi Phase 4C ini.
- Thief memakai Adventurer stat profile development, tidak menyamar sebagai legacy Rogue. Katalog equipment produksi belum diotorisasi ulang untuk Thief; fixture memakai dua item existing dengan override authorization saja, tanpa bonus tambahan.
- Animation/VFX masih prototype basic-attack + existing particles; beda hit/opener/finisher dan REAR cue tersedia, bukan dedicated dagger animations.
- Small enemy bisa tertutup badan player; HUD buff row dekat panel HP dapat overlap pada layout fixture. Bukan klaim presentation final.
- Weakpoint/Mark/rear CP belum menaksir uptime situasional secara andal.
- No universal Stamina, no dual-basic engine, no new resource, no AI stealth detection, no generic DoT/event engine.
- **Tidak ada Rogue/Assasin V2 content**, advanced, specialization activation atau public Thief activation. Legacy registry yang sudah ada bukan implementasi specialization V2 baru.
- Tidak publish. Tidak mulai balance pass atau fase berikutnya.

Tabel lengkap ID/rank/prerequisite berada di dokumen pendamping `LUMENFALL_Phase_4C_Rank_Contract.md` dan definition source `lib/game/thief-v2.ts`.
