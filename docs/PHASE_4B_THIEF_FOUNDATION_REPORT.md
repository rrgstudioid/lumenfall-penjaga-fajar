# LUMENFALL — Phase 4B: Thief V2 Foundation & Design Readiness

Tanggal: 20 September 2026. Status: foundation lokal selesai; tidak dipublikasikan.

## REPORT A — Ringkasan untuk pemilik game

**Kita sudah dapat mulai mendesain tree Thief Lv15–59. Ini belum merupakan implementasi kelas Thief yang playable.**

| Area | Hasil dan batasannya |
|---|---|
| Identitas Thief | `thief` dapat dipakai karakter uji V2, berbeda dari core `rogue` legacy. Tidak memperoleh skill Rogue atau Warrior. |
| Akses publik | Karakter baru tetap Adventurer; Warrior tetap satu-satunya pilihan Core yang tersedia pada Lv15. Thief tetap locked. |
| Dual dagger | Memerlukan dua instance dagger one-hand berbeda. Satu dagger, sword + dagger, label lama “dual dagger”, dan satu item di dua tangan tidak mencukupi. |
| Posisi | FRONT/SIDE/REAR sudah bisa diperiksa berdasarkan posisi X/Z dan arah hadap target. Kamera tidak berpengaruh. Tidak otomatis memberi bonus. |
| Stealth | Enter, exit, expiry, pilihan pemicu pembatalan, indikator dan feedback tersedia. Durasi/bonus final belum ditentukan. |
| Stealth versus AI | **Bukan invisibility/detection system.** Musuh masih mengetahui posisi dan mengejar pemain menurut AI lama. |
| Mark | Target-local, kondisi modifier, indikator MARKED tersedia. Aplikasi baru lewat helper dapat memakai timer; mark boolean legacy tetap mengikuti perilaku lamanya. |
| Kepemilikan Mark | Saat ini source-agnostic. “Marked by THIS Thief” belum tersedia; lihat usulan metadata source pada laporan teknis. |
| Critical | Bonus conditional Critical Rate, Critical Damage dan skill damage tersedia pada action/hit, tanpa mengubah stat global atau angka Warrior. |
| ASPD | Formula basic attack lama dipertahankan. Tidak mempercepat waktu hit skill, cast, atau action lock. Tidak ada engine serangan off-hand baru. |
| Mobility | Dash ke target sudah ada. Directional step/backstep tanpa target belum merupakan action skill; ekstensi kecil perlu disepakati jika tree memakainya. |
| Evasion | Temporary Evasion melalui modifier stat tersedia. Cap dodge existing 50%. Accuracy belum dilawankan dengan Evasion dalam roll combat. |
| Readability | Label STEALTH + timer, feedback masuk/keluar, dan MARKED pada selected-target telah dilihat di Chrome, dalam map Padang Arunika. Model pemain tetap terlihat. |

### Keputusan desain yang masih diperlukan

1. Pilih pemicu pembatalan stealth per skill: saat cast ofensif diterima, saat damage berhasil, basic attack, atau menerima HP damage. Tidak ada kebijakan Thief final yang dibuat diam-diam.
2. Tentukan bonus/angle rear dan apakah sebuah bonus dibekukan saat cast atau diperiksa ulang saat impact. Foundation mendukung keduanya.
3. Tentukan apakah Mark boleh dipakai semua sumber atau hanya pembuatnya, termasuk aturan refresh/overwrite.
4. Jika desain wajib mempunyai backstep/directional step, perlukan extension movement action kecil. Jika wajib mempunyai AI invisibility, perlukan foundation deteksi tersendiri. Keduanya belum boleh diasumsikan tersedia.
5. Siapkan profil angka Thief dan akses equipment Thief pada tahap konten berikutnya. Fixture sekarang memakai baseline Adventurer yang sudah ada, **bukan** menyalin balance Rogue. Banyak dagger produksi masih dibatasi untuk Rogue legacy; tidak diubah dalam task ini.

Tidak ada blocker untuk **menulis desain** Thief yang mematuhi batasan di atas. Belum siap untuk mengaktifkan Thief publik atau menilai balance finalnya.

## REPORT B — Laporan teknis

### 1. Audit dan perubahan file

Audit langsung, bukan mengasumsikan laporan fase sebelumnya:

| File | Bagian yang diperiksa / perubahan Phase 4B |
|---|---|
| `lib/game/skills.ts` | CoreJobId legacy, active/passive schema, scaling fallback, inheritance; tambah RuntimeCoreJobId, dagger, optional stealthPolicy. Tidak menambah registry skill. |
| `lib/game/job-registry-v2.ts` | Audit canonical IDs, tier/lineage, metadata locked dan pemisahan Rogue legacy versus specialization Rogue. Tidak diubah. |
| `lib/game/progression.ts` | Audit Lv15/Lv60, architecture policy. Tidak diubah. |
| `lib/game/rules.ts` | Audit final stats, profile, authorization, equipment aggregation, selectors, save; tambah fixture Thief, optional impact context, parsing canonical identity tanpa conversion, buang transient V2 stealth dari save/load. |
| `lib/game/job-presentation.ts` | Lookup legacy aman terhadap union runtime; status Thief tetap locked. |
| `lib/game/character-view.ts` | Lookup legacy aman untuk canonical runtime ID; tidak mengubah tree atau UI progression. |
| `lib/game/items.ts` | Audit catalog/restrictions/slot/off-hand; izinkan dagger one-hand di offHand dengan pair validation; cegah instance yang sama. Tidak mengubah template/stat/rarity/restriction job. |
| `lib/game/weapon-style.ts` | Canonical dagger dan dual_dagger berdasarkan dua item aktual; Warrior styles dipertahankan. |
| `lib/game/combat-position.ts` — baru | Helper world-plane FRONT/SIDE/REAR dan adapter yaw actor. |
| `lib/game/stealth.ts` — baru | Lifecycle/policy stealth, memakai status timer existing dan WeakMap policy runtime-only. |
| `lib/game/combat-status.ts` | Timer mark opt-in melalui helper; boolean legacy tetap dibaca; alias dan remove tetap satu sumber. |
| `lib/game/combat-modifiers.ts` | Kondisi posisi/stealth, timing cast/impact, action-local crit/accuracy bonuses. |
| `lib/game/skill-action.ts` | Hit membawa snapshot Critical Rate, Critical Damage, Accuracy dari final stats. |
| `lib/game/world.ts` | Sambungkan impact context, per-hit crit, stealth lifecycle/feedback/HUD, Mark target presentation. Audit AI, attack interval, movement, damage, cleanup. |
| `lib/game/target-presentation.ts` | MARKED dan remaining time bila mark timed; tidak ada target/input system baru. |
| `lib/game/combat-power.ts` | Expected crit memakai nilai per-hit resolved yang sama. Tidak mengarang uptime rear/stealth. |
| `lib/game/combat-mechanics.ts` | Audit crit/evasion/block cap dan mitigation. Tidak diubah. |
| `lib/game/combat-power-config.ts` | Audit ASPD coefficient/clamp. Tidak diubah. |
| `lib/game/gameplay-config.ts` | Audit Mana/no-Stamina policy. Tidak diubah. |
| `lib/game/warrior-v2.ts` | Audit referensi action/rank/modifiers. **Tidak diubah.** |
| `app/page.tsx`, `app/globals.css` | Label player STEALTH yang dapat dibaca + timer pada status row existing. |
| `tests/browser/warrior-world.tsx`, `warrior-world.config.ts`, `vite.config.ts` | Audit/use harness real-world memory-only. Tidak diubah Phase 4B. |
| `lib/game/thief-foundation.test.ts` — baru | Tujuh regresi pure foundation. |
| `lib/game/skill-runtime-v2.test.ts` | Tambah lima regresi yang menjalankan Game runtime. |

Workspace sudah memiliki perubahan fase sebelumnya; daftar di atas membedakan kontribusi task ini. File lain yang dirty tidak dihapus atau diklaim sebagai perubahan Phase 4B.

### 2. Canonical job-ID strategy dan keselamatan save

- `CoreJobId` tetap domain key registry legacy; tidak menambahkan Thief ke `CORE_JOBS` legacy karena itu juga akan membuat konten legacy otomatis.
- `RuntimeCoreJobId = CoreJobId | CoreJobV2Id` dipakai Hero serta definisi active/passive dan input selector. Canonical IDs berasal dari registry V2 existing, bukan daftar alias baru.
- `legacyCoreJob()` memberi lookup optional. ID yang tidak punya profile produksi tidak lagi mengakibatkan akses `.name/.weapon` pada undefined.
- `createV2CoreFoundationHero('thief', level)` adalah factory development/fixture; tidak dipanggil creation, trainer, atau promotion UI. Tidak memberikan tree/pasif baru. Level fixture dibatasi 15–59, bukan perubahan level cap game.
- Profil numerik fixture tetap fallback Adventurer. Label UI menggunakan metadata Thief. Profil numerik Thief belum disetujui.
- Parser dapat mempertahankan canonical V2 core identity; tidak mengubah Rogue menjadi Thief, tidak mengaktifkan job, tidak menambah grants, tidak memigrasikan karakter produksi. Identity parsing bukan promotion authorization.
- Save lama masih diproses dengan aturan clean-break existing. Tidak ada versi save baru, wipe, atau penggantian ID legacy.
- Stealth V2 adalah state combat sementara, tidak disimpan sebagai state aktif ketika load. Save menyalin statusEffects sebelum membuang stealth sehingga hero hidup tidak dimutasi.

### 3. Dual dagger

Canonical `dagger` = equipmentType dagger, one_hand, bukan twoHanded.
Off-hand dagger lama (`off_hand_dagger`, handedness off_hand) dikenali sebagai bentuk slot-specific dagger satu tangan, bukan “senjata dua tangan”.

`dual_dagger` memerlukan main canonical dagger, off dagger kompatibel, dan ID instance berbeda. Dagger biasa bisa dipasang di offHand; slot compatibility tetap divalidasi. Sword+dagger tidak menghasilkan style ini. Label weaponType `dual_dagger` tanpa dua item tidak lolos requirement.

Tidak ada penggandaan Attack berbasis style, serangan basic kedua, pergantian tangan, atau koefisien off-hand baru. **Koreksi audit penting:** pipeline equipment existing memang menjumlahkan stat semua item equipped yang ID-nya unik, termasuk stat Attack item off-hand. Kontribusi existing itu tetap dipertahankan; jangan menyebut off-hand tidak berkontribusi sama sekali.

Catalog dagger produksi dan job restriction tidak diubah. Regresi memakai clone fixture All Job agar tidak mengubah ekonomi item produksi.

### 4. Positional math dan timing

Gunakan vektor horizontal dari target ke attacker dan forward target yang dinormalisasi:

`dot = dot(attacker - target, targetForward) / (distance × forwardLength)`

- FRONT jika `dot >= cos(frontAngle / 2)`.
- REAR jika `-dot >= cos(rearAngle / 2)`.
- Selain itu SIDE.
- Sudut menerima derajat penuh cone, dibatasi 0–180. Default geometris foundation 90° front/90° rear; bukan keputusan bonus/angle final Thief.
- Posisi berhimpitan, forward nol atau input nonfinite menghasilkan undefined; tidak memberikan rear payoff.
- Actor engine menghadap local -Z: `forward = {-sin(yaw), -cos(yaw)}`. Tidak ada parameter kamera.

Modifier dapat menyatakan `condition.targetPosition`, `condition.positionAngles`, `condition.attackerStealthed`, `condition.targetStatuses`, serta selector weaponStyles.

`conditionTiming: 'impact'` (default untuk kondisi target/stealth): disimpan pada action.targetModifiers, diperiksa lagi per hit nyata. World memasok posisi attacker dan **cast target asli** serta rotasi target saat impact. Target selection baru tidak mengalihkan sequence.

`conditionTiming: 'cast'`: diperiksa saat resolve final accepted action, sebelum break-stealth-on-commit. Hasilnya masuk ke snapshot hit; perubahan posisi/state sesudahnya tidak mengubah bonus. Kondisi cast-target tanpa target context dianggap tidak terbukti dan tidak diberi bonus. Ini terutama siap untuk target tunggal; jangan mengasumsikan AoE memiliki satu rear relation bersama.

Invalid target, out-of-range atau kurang Mana tidak membatalkan stealth-on-offensive-commit. Modifier tidak mengubah registry global.

### 5. Stealth audit, policy dan presentation

Sebelum Phase 4B: effect stealth menulis `hero.statusEffects.stealth = duration`. Loop status mengurangi durasi saat simulasi aktif. Tidak ada break-on-attack/damage yang terpusat. AI tidak membaca stealth. Target selection tetap tersedia.

Sekarang:

- `enterStealth`, `exitStealth`, `isStealthed`, `breakStealth` tersedia. Durasi wajib finite dan positif; recast mengganti duration seperti assignment legacy.
- Policy `breakOn` dapat memilih `offensive_skill`, `damage_dealt`, `basic_attack`, `received_damage`. Policy tersimpan WeakMap, bukan field save atau timer kedua.
- Tanpa policy, legacy default tetap expiry-only. Tidak ada production Thief policy/durasi yang dibuat.
- Hook offensive sekarang berarti accepted non-self damaging action; pure non-damaging offensive debuff membutuhkan keputusan/cakupan tambahan jika nanti didesain. Self-buff tidak diperlakukan sebagai serangan hanya karena metadata raw-nya berisi angka.
- Basic hook terjadi setelah valid target/range/ammo validation. Successful damage hook hanya saat benar-benar memberi damage; dapat termasuk periodic damage sumber pemain existing. Received hook setelah mitigation/barrier: perlu HP damage positif. Parry, evade atau barrier yang menyerap seluruh damage tidak memicu hook ini.
- Pause menghentikan status ticking existing. ClearSkillRuntime pada death/world/region/character cleanup menghapus stealth dan policy.
- STEALTH + remaining timer pada shared combat feedback dan status row player; enter/exit menggunakan float text + ring prototype. Tidak memodifikasi material/model menjadi invisible. Efek ring dibersihkan melalui lifecycle VFX existing.

**Batas AI:** updateEnemy tetap menghitung jarak terhadap satu player, safe-area, leash dan windup; tidak mempunyai stealth detection, LOS, detection radius berbasis stealth, atau kehilangan aggro. Stealth adalah kondisi/presentation, bukan janji tidak bisa diserang.

### 6. Mark dan ownership

- Alias `mark` mengarah ke `marked`; kondisi target memakai hasStatus terhadap cast target, bukan nearest enemy.
- Legacy effect mark tetap menulis boolean `enemy.marked = true`, bertahan sampai lifecycle/reset target seperti sebelumnya.
- Aplikasi baru `applyStatus(target,'mark',duration)` memakai `statusEffects.marked`, ditick oleh existing enemy loop; refresh mempertahankan duration maksimum. Jika ada legacy boolean true, legacy mark tetap aktif ketika timer baru habis.
- Target UI menampilkan MARKED; timer ditampilkan hanya jika sumbernya timed. Switch target membaca target baru, bukan cache status lama.
- Belum source-aware. Tidak mengklaim “this Thief owns the mark”.

Usulan minimum untuk desain berikutnya bila ownership dibutuhkan: tambahkan metadata runtime per status `{sourceActorId, sourceGeneration, sourceSkillId}` dan predicate `markedBy(sourceId)`; duration tetap dari status timer existing. Tentukan dahulu apakah refresh mengganti owner atau perlu lebih dari satu mark. Hindari mengimplementasikan collection multiplayer sebelum kebutuhannya disetujui.

### 7. Critical / Accuracy / stat pipeline

Final stat source tetap `derivedStats` / `calculateFinalCharacterStats`; tidak ada pipeline stat Thief terpisah.

- Critical Rate baseline: `2 + DEX × 0.1 + modifier`, display-stat maksimum 100; **roll combat dibatasi 80%** oleh criticalChance.
- Critical Damage baseline 150%, ditambah gear/pasif/temporary stat modifiers existing. Tidak ditemukan upper cap khusus Crit Damage. Critical Damage 150 berarti hit ×1.5, bukan +150%.
- Resolved hit menyalin final criticalRate, criticalDamage, accuracy. Generic action modifier dapat menambah `criticalRateBonus`, `criticalDamageBonus`, `accuracyBonus` (percentage points/stat points), dan `damagePercent`.
- Sumber modifier dapat berasal dari definisi skill, passive, weapon-scoped atau temporary modifiers existing. Tidak perlu hardcode ID Thief.
- Target-local conditional bonuses masuk ke hit, bukan mengubah derivedStats global. Stat modifiers global existing tetap lewat pipeline lama; jangan menduplikasi bonus yang sama di stats dan action.
- Conditional skill crit memerlukan canCrit yang memang true. Critical tidak menggandakan stagger.
- Accuracy baseline `90 + DEX + gear accuracy`; **belum ada actual player hit/miss roll yang memakai Accuracy**. AccuracyBonus dapat direpresentasikan di resolved hit, tetapi belum memberi hit chance/CP tambahan. Tidak dibuat formula accuracy baru.

CP mengevaluasi expected damage per-hit dari resolved hit yang sama, termasuk conditional crit yang memang sudah ter-resolve. Rear/stealth/Mark uptime tidak ditebak di benchmark tanpa context. Unknown conditional uptime tetap dilaporkan unsupported, tidak diberi score dari deskripsi. Accuracy factor tetap 1.

### 8. ASPD / mobility / Evasion

Basic attack:

`interval = (profile.cooldown + finisherDelay jika hit combo ketiga) / (finalAttackSpeed / 100)`

ASPD berasal dari baseline 100 + DEX ×0.15 + gear, lalu modifier existing. FinisherDelay tetap 0.22. Tidak ada minimum interval/cap APS eksplisit di path attack ini. Ini batasan yang harus ditangani saat mendesain Rogue ASPD tinggi, bukan dibalance sekarang.

- Action lock menolak basic maupun active baru sampai berakhir.
- ASPD tidak mengubah cooldown skill, animation/castingTime, actionLockDuration atau delay hitSequence.
- CP menggunakan speed factor basic `clamp(1 + 0.7 × (ASPD/100 − 1), 0.7, 1.5)`; active skills tidak memakai factor ini. Ini estimator terkontrol existing, bukan simulasi APS penuh; divergence ASPD tinggi dilaporkan, tidak diubah.

Mobility: targeted dash memakai selected target, stopDistance/impactRange, dan langkah kecil yang menggunakan Game.move/terrain collision. Tidak ada runtime skill directional step/backstep yang target-free. Rekomendasi minimum: optional movement descriptor direction=facing/backward/input + distance, dieksekusi memakai collision movement existing; tanpa pathfinding, stamina, active-dodge system atau target auto-pick. Belum diimplementasikan.

Evasion: `DEX ×0.1 + gear evasion`, dapat dipengaruhi temporary stat modifiers. Incoming hit melakukan `random < min(0.5, Evasion/100)` setelah invincibility/parry checks. Tidak ada lawan Accuracy attacker dalam formula itu. Nilai dan urutan existing tidak diubah.

### 9. Benchmark fixture yang direkomendasikan

| Fixture netral | Tujuan, bukan balance produksi |
|---|---|
| Neutral single target | Bandingkan accepted casts, total actual damage, Mana dan cooldown; tidak mengklaim final DPS Thief dari fallback Adventurer. |
| Endurance target | Target tahan untuk mengukur sustain, crit variance, Mana dan periode tanpa serangan. |
| Mobility course | Flat/slope/obstacle, selected dash range dan collision; directional step hanya jika extension disetujui. |
| Rear-position target | Posisi/yaw deterministik, mode stationary dan rotating; rekam cast context serta actual hit context. |
| Marked target | Timed mark, expiry, refresh, switch target; tambahkan ownership fixture setelah kebijakan source disetujui. |

Tidak ada monster produksi, HP/Defense fixture sebagai angka final, overall class score, atau ranking yang dibuat.

### 10. Verifikasi dan bukti

Baseline yang benar-benar dijalankan sebelum edit: **465 passed / 0 failed**.
Sesudah: **477 passed / 0 failed**, seluruh 465 tes lama tetap ada.

12 tes baru meliputi: identity/public lock/save isolation; two-instance dagger dan Warrior style; math posisi; stealth finite lifecycle/policy; timer Mark; conditional crit/damage selectors; cast-vs-impact dan CP; actual three-hit target rotation; actual hit critical; invalid/valid cast stealth break; received/dealt/basic/cleanup; enemy-loop mark expiry.

Production build: **berhasil**, exit 0. Warning bundle >500 kB, plugin timings, route classification vinext masih terlihat; bukan build failure.

Primary-source TypeScript: **6 sebelum / 6 sesudah, 0 baru**. Tidak mengklaim typecheck bersih. Empat diagnostic appearance literal fallback di rules.ts, satu ui-layout.ts scale, satu fixture real-components.tsx Snapshot.cameraMode. Filter laporan ini mengikuti scope `lib/app/components/tests`; bukan klaim semua generated/staging copy dalam workspace bebas error.

Browser tambahan: Chrome visible melalui bundled Playwright, `127.0.0.1:3003/warrior-world.html?level=59&build=general`, harness actual Three.js/React di Padang Arunika. Panduan skill agent-browser digunakan untuk alur inspeksi; CLI tidak tersedia sehingga memakai Playwright bawaan. Tidak menggunakan save produksi.

- State dimasukkan lewat helper runtime pada memory-only fixture, **bukan melalui skill Thief produksi yang belum ada**.
- STEALTH timer terlihat menurun; setelah status expiry label hilang pada refresh HUD berikutnya. Tidak ada UI timer terpisah.
- MARKED tampil pada selected Small Slime, timer hilang saat expired.
- Model player tetap visible; enter/exit text/ring terlihat. Ini presentation prototype, bukan asset final stealth.
- Runtime hero kemudian diganti fixture Thief memory-only: UI menampilkan THIEF dan activeSkills hanya empat definisi Adventurer. Tidak ada grant Rogue.
- Page errors yang tertangkap: **0**. Tidak mengklaim seluruh console warning/WebGL warning sudah diaudit menyeluruh.
- Screenshot menunjukkan fixed shared indicator strip bisa berdekatan/bertumpuk dengan player panel, dan camera hint dapat melintas target frame. Label STEALTH dalam player status row ditambahkan agar state tetap terbaca; general HUD-layout polish bukan redesign task ini.

Evidence: `outputs/phase4b/stealth-mark-readable.png`, `stealth-mark-expired.png`, `thief-canonical-memory.png`. Capture awal `stealth-mark-runtime.png` juga disimpan sebagai kondisi sebelum perbaikan label player.

### 11. Kesimpulan dan freeze

**0 production Thief active skills, 0 production Thief passives ditambahkan.** Warrior tetap 16 active +14 passive; formula, angka/rank/biaya/counter/stagger Warrior tidak diubah. Tidak ada numerical balance change pada equipment, monster, EXP, stat, duration skill, atau resources. Perubahan dagger eligibility dan configurable stealth/conditional semantics merupakan foundation yang diminta, bukan rebalance.

Tidak ada universal Stamina, Energy, Combo Points, Rage, Flow, Rogue/Assasin implementation, AI stealth rewrite, atau publish. Berhenti pada Phase 4B; tunggu instruksi desain tree berikutnya.
