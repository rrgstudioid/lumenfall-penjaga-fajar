# LUMENFALL — Global Hard Targeting: Final Six-Skill Report

20 September 2026. Implemented and verified locally. **Not published.**

## A. Laporan pemilik

Enam pengecualian terakhir sudah diselesaikan sesuai keputusan pemilik. Tidak ada lagi daftar skill yang boleh mengambil musuh terdekat sebagai penerima serangan otomatis.

| Skill | Aturan final | Hasil pengujian runtime |
|---|---|---|
| gatotkaca-3 — Hantaman Langit | CURRENT_TARGET_REQUIRED | A yang dipilih menerima damage/control; B yang lebih dekat tidak terkena. Tanpa target atau di luar jangkauan ditolak sebelum Mana/cooldown. Tetap satu target, bukan AoE. |
| rogue-awakening — Kebangkitan Rogue | AREA_AROUND_SELF | Berfungsi tanpa pilihan target; mengenai musuh dalam area lama di sekitar karakter, bukan pilihan di luar area. Temporary states tetap. |
| caroq-4 — Tarian Caroq | AREA_AROUND_SELF | Perilaku area, damage, radius dan temporary states lama tetap. |
| pujangga-4 — Kidung Kehancuran | AREA_AROUND_SELF | Perilaku area ultimate lama tetap, tanpa mekanik curse baru. |
| pandita-4 — Doa Keselamatan | AREA_AROUND_SELF | Ultimate ofensif lama tetap. LEGACY_SEMANTIC_MISMATCH dicatat: deskripsi menyebut healing/protection, tetapi runtime memberikan damage area. Tidak didesain ulang. |
| bajra-3 — Telapak Penolak | SELF | Parry diri sendiri tetap aktif dengan durasi lama. Tidak memberi damage, perpindahan atau control pada musuh dekat maupun musuh terpilih. Serangan masuk tidak mengganti target. |

Angka damage, koefisien, Mana, cooldown, radius, dan durasi tidak diubah. Penghapusan serangan insidental Telapak Penolak adalah perubahan yang secara eksplisit diminta, bukan rebalance. Nama/deskripsi lama belum didesain ulang.

Save dan job aman: tidak ada perubahan parser, migrasi, wipe, job ID, ownership, level, SP, equipment, atau progressionArchitecture. Warrior V2 tetap development-only. currentTarget tetap state sementara dunia, bukan data save.

**Global Hard Targeting selesai untuk seluruh 80 active definitions yang diaudit.** Klik pertama memilih, klik kedua menyerang; tanpa target basic attack tidak menyerang. Self/AoE/frontal tetap dapat digunakan tanpa target. Perubahan ini belum ada di situs publik sampai pemilik meminta publish.

## B. Laporan teknis

### Audit dan perubahan

File diaudit: lib/game/targeting.ts, world.ts, skills.ts, skill-runtime-v2.test.ts, combat-status.ts, serta integrasi CP di combat-power.ts. Browser regression memakai tests/browser/global-targeting-regression.mjs dan memory fixture yang sudah tersedia.

File kode yang diubah pada finalisasi ini:

- **lib/game/targeting.ts** — menghapus DEFERRED_LEGACY_TARGETING, isDeferredLegacyTargeting, serta override enam skill. Resolver bersama sekarang berlaku tanpa pengecualian.
- **lib/game/world.ts** — castSkill selalu memvalidasi selected target untuk single/dash sebelum biaya. applySkill hanya memakai target identity milik cast; area memilih penerima lewat geometri caster, self tidak memiliki enemy-hit recipients. findSkillTarget tidak lagi memindai nearest enemy. Semua hit menggunakan validasi identity/lifecycle yang sama.
- **lib/game/skills.ts** — hanya komentar LEGACY_SEMANTIC_MISMATCH untuk pandita-4. Tidak mengubah nilai definition.
- **lib/game/skill-runtime-v2.test.ts** — memperbarui audit registry dan enam regression cases yang sebelumnya mempertahankan pengecualian menjadi kontrak final pemilik, dengan assertions lebih lengkap.
- **docs/LUMENFALL_Global_Hard_Targeting_Final_Report.md** — laporan ini. Kedua laporan rollout sebelumnya diberi penanda historis/superseded.

Perubahan global pada combat-power.ts dan browser fixture sudah ada dari rollout sebelumnya; finalisasi ini tidak menulis ulang formula CP atau UI.

### Hasil audit 80 definitions

| Klasifikasi final | Jumlah |
|---|---:|
| CURRENT_TARGET_REQUIRED | 29 |
| SELF | 18 |
| AREA_AROUND_SELF | 24 |
| FRONTAL_ARC | 2 |
| TARGETED_DASH | 7 |
| UNKNOWN / DEFERRED | 0 |
| Total | 80 |

Jumlah di atas diuji langsung terhadap ALL_SKILLS (64 legacy + 16 Warrior V2), bukan daftar UI terpisah. Legacy factory menyimpan default targetType=single bahkan untuk heal/parry/ultimate; targetRequirement menafsirkan jalur efek yang telah disetujui. Definition rank_values mempertahankan targeting eksplisitnya. Tidak ada migrasi massal data skill.

Tidak ada nearest-enemy fallback dalam resolusi recipient player skill. Pencarian ray-picking terdekat ke kamera tetap diperlukan untuk memilih objek yang benar-benar diklik; itu bukan auto-target musuh terdekat dari karakter. Pencarian terrain terdekat juga tidak diubah. Helper lama targetNearest pada basic attack masih berupa kode tidak terjangkau karena usesHardTargeting selalu true; tidak ada registered skill yang memanggilnya dan tidak ada jalur fallback gameplay yang aktif.

### Cast, area dan lifecycle

Single/dash memvalidasi identity, HP, spawn generation, scene/region dan resolved range sebelum pembayaran. Kegagalan NO_TARGET, TARGET_INVALID atau TARGET_OUT_OF_RANGE tidak mengonsumsi Mana/cooldown. Tidak ada auto-walk, target pengganti, atau auto-select attacker.

Area ultimates memakai radius existing `skill.areaRadius || 5`, dengan temporary superArmor dan activeBuffs.damageReduction existing. Pemilihan target yang jauh tidak menggeser pusat area dan tidak menambah recipient. Pemindaian area memang diperlukan untuk AoE, tetapi tidak melakukan pencarian nearest recipient. Ring/VFX radius lama juga tidak diubah.

Telapak Penolak tetap menjalankan branch self parry yang sudah ada. Karena targetRequirement=self, daftar enemy recipients kosong: tidak menjadwalkan hit, displacement atau control. CP memakai klasifikasi self yang sama sehingga tidak menilai phantom enemy damage; tidak ada kompensasi CP manual.

Identity snapshot tetap terdiri dari id, instanceId, generation, regionToken. Hit yang dijadwalkan memvalidasi identitas semula; mengganti pilihan tidak mengalihkan hit. Mati/despawn/respawn/region berubah membatalkan penerima yang tidak valid. Target ring/frame, cleanup, kamera, action lock dan counter window tidak diubah.

### Pengujian

**Full lib/game regression: 456 passed, 0 failed, 0 skipped.** Baseline 456 tetap dipertahankan. Enam test pengecualian lama diperbarui satu-per-satu sesuai keputusan yang menggantikan kontrak lama; tidak ada pengurangan jumlah test atau penghapusan suite. Audit count kini menegaskan klasifikasi final semua 80 definitions.

Regression finalisasi:

1. Hantaman Langit: no-target/range failures menjaga Mana/CD, selected A menerima damage/stun, closer B tidak terkena, pembayaran sukses tetap sesuai resolved action.
2. Empat ultimate (satu test per ID): tanpa target tetap mengenai beberapa recipient hingga batas radius lama; target terpilih tepat di luar radius tidak terkena; damage pada recipient yang sama tetap identik; temporary states/CD tetap; lookup single-target akan melempar error jika dipanggil; registry tidak termutasi.
3. Telapak Penolak: self parry tanpa/dengan pilihan, durasi/biaya/CD sama dengan action; zero hurtEnemy/moveEnemy calls, zero queued hits, HP/posisi/stun/slow/root musuh tidak berubah; incoming attack menghasilkan parried tanpa memilih penyerang; CP tidak memiliki hit ofensif.

Existing save, V2 skill suite, selected-target lifecycle, multi-hit snapshot, counter consumption, basic attack, self/AoE/arc dan UI regression tetap lulus.

### Browser check

PASS: Chrome pada local development memory harness, Home → Continue → Padang Arunika. Memakai real renderer, canvas picking, target ring/frame, basic attack dan legacy skill. Klik pertama tidak merusak HP, klik kedua hanya mengenai pilihan, switch hanya memilih, klik ground membersihkan, UI tidak click-through, range failure tidak membayar Mana, death menghilangkan frame. Tidak ada page error; native browser storage origins tetap kosong. Tidak menyentuh save pemain.

Browser ini adalah regresi global input/presentation yang sudah ada; keenam semantic-specific checks dilakukan pada actual Game runtime melalui test harness tanpa constructor WebGL. Tidak mengklaim keenam skill telah diuji visual satu per satu. Bukti browser: output/global-targeting/browser-evidence.json dan screenshots di folder yang sama. Browser uji ditutup setelah selesai.

Skill agent-browser digunakan sebagai panduan verifikasi; CLI tidak tersedia sehingga memakai Playwright proyek yang sudah terpasang, tanpa instalasi paket. Panduan Sites menjaga pemeriksaan proyek dan build tetap lokal, tanpa deployment.

### Build / TypeScript

- **Production build: berhasil**, exit 0, melalui installed vinext build entrypoint. Wrapper Sites gagal menemukan package-manager shim Windows; fallback menjalankan bundler yang sama, tanpa mengubah dependencies/config. Warning nonfatal existing: chunk >500 kB, plugin timing, dan route classification unknown.
- **Primary-source TypeScript: 6 sebelum → 6 sesudah; 0 error baru.** Empat TS2345 appearance fallback rules.ts:358–361, TS2339 ui-layout.ts:64, TS2741 tests/browser/real-components.tsx:177.
- Perbandingan memakai compiler/config yang sama dengan folder output dikecualikan hanya dalam memori, sebelum dan sesudah. Folder output berisi salinan source publikasi/template tooling; raw workspace scan bukan klaim typecheck bersih. tsconfig tidak diedit dan error lama tidak disembunyikan dari laporan.

### Sisa batasan dan keputusan

LEGACY_SEMANTIC_MISMATCH pandita-4 disengaja untuk kompatibilitas dan menunggu konten Job V2. Tidak ada unknown/deferred targeting yang tersisa. Deskripsi Bajra/Gatotkaca lama juga tidak didesain ulang dalam task ini. Tidak ada mekanik baru, rebalance, aktivasi Job V2, atau publish. Pekerjaan berhenti pada finalisasi dan laporan ini.
