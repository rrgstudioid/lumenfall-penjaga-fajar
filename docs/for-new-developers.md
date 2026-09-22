# LUMENFALL: panduan untuk developer baru

> Kondisi yang diaudit: 22 September 2026. Dokumen ini adalah peta kerja dan riwayat keputusan, **bukan** pengganti kode atau hasil pengujian terbaru. Bila laporan fase, dokumen ini, dan runtime berbeda, reproduksi perilaku dari source + test terlebih dahulu, lalu klarifikasi dengan owner. Jangan menganggap semua eksperimen atau desain yang pernah dibahas sebagai fitur produksi.

## 1. Gambaran singkat dan status sebenarnya

LUMENFALL adalah prototipe MMORPG **berbasis browser**. Saat ini ia mempunyai world 3D, karakter, monster, quest, inventory/equipment, Rune, enhancement, skill/hotbar, save lokal, serta jalur combat/progression V2 dan V3 yang hidup berdampingan. Istilah MMORPG menyatakan arah desain; repository ini **belum** menyediakan server multiplayer otoritatif, akun bersama, party/PvP live, maupun database karakter online. Save karakter saat ini disimpan pada `localStorage` browser dan terpisah per origin (localhost berbeda dari Site publik). Jangan menjanjikan sinkronisasi karakter antarkomputer.

Game dahulu banyak dibangun secara iteratif melalui prompting. Akibatnya ada beberapa generasi sistem sekaligus, dokumen fase yang panjang, kode world/UI berukuran besar, dan riwayat Git lama yang tercampur aset/arsip hasil publish. Tugas tim baru adalah menstabilkan fondasi dan menjaga fitur yang sudah tervalidasi, bukan menulis ulang mekanik atau mengubah balance tanpa kontrak owner.

**Batas status penting:** pilihan membuat karakter V3 sudah ditambahkan tanpa menghapus karakter V2 lama. Menu utama yang diaudit menampilkan jalur `V2 · Klasik` dan `V3 · Warrior / Berserker`. Kode/runtime V3 Blade Master dan Dual Wield sudah ada beserta test/fixture, tetapi UI job-change utama yang terlihat di `app/page.tsx` pada saat audit masih menawarkan **Berserker** pada Lv60; jangan menyatakan seluruh Blade Master sudah dapat dimainkan dari menu normal sebelum menguji integrasi UI, equipment, save, dan world secara end-to-end. Jalur V2 Thief tetap legacy; Rogue/Assasin dan Advanced Job belum diimplementasikan.

## 2. Mulai dari clone baru

Prasyarat: Git, Node.js **>=22.13.0** (versi lingkungan audit: 24.19.0), dan pnpm yang memahami lockfile v9. Gunakan versi pnpm yang kompatibel dengan `pnpm-lock.yaml`; jangan mencampur npm/yarn install sehingga lockfile berubah tanpa alasan. Aset Blender/Hunyuan/Unreal asli dan folder backup pemilik **bukan** prasyarat menjalankan game.

```powershell
git clone https://github.com/rrgstudioid/lumenfall-penjaga-fajar.git
cd lumenfall-penjaga-fajar
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev --host localhost --port 3000
```

Di terminal lain buka `http://localhost:3000/`. Bila `corepack` tidak tersedia, pasang pnpm versi kompatibel dengan lockfile melalui metode standar di lingkungan Anda dan gunakan `pnpm install --frozen-lockfile` / `pnpm dev --host localhost --port 3000`. **Jangan** membuka `127.0.0.1` secara otomatis jika server hanya bind ke `localhost`/IPv6; gunakan URL yang benar-benar dicetak terminal. Di Windows, pastikan Node ada di `PATH`—pesan `'node' is not recognized` berarti executable belum dapat ditemukan, bukan bug Vite.

Local dev memakai Vinext/Vite, plugin Sites, serta Cloudflare dev integration. Terminal perlu dibiarkan hidup selama pengujian. Browser HTML yang muncul tidak cukup untuk menyatakan server sehat: pastikan JavaScript berjalan, world/UI muncul, Network tanpa modul gagal, dan tidak ada overlay Vite. Jika lingkungan baru meminta autentikasi layanan hosting, **jangan** memasukkan password/token owner ke repo; koordinasikan akses terpisah. `.openai/hosting.json` berisi identitas project/binding non-rahasia; `.env*`, token, dan kredensial lokal tidak boleh dikomit.

Perintah dasar:

```powershell
corepack pnpm build                         # output produksi di dist/
node --test lib/game/*.test.ts              # test engine game (Node modern)
corepack pnpm lint                          # pemeriksaan lint
corepack pnpm exec tsc --noEmit             # typecheck diagnostik; lihat keterbatasan
```

`pnpm start` memakai Wrangler terhadap hasil build di `dist/server/wrangler.json`; **jalankan build terlebih dahulu**. `dist/`, `.vinext/`, `.wrangler/`, `node_modules/`, `output/` dan cache tidak termasuk source Git. Di PowerShell, bila glob test tidak diekspansi oleh shell, gunakan `Get-ChildItem lib/game -Filter *.test.ts | ForEach-Object FullName` sebagai daftar argumen Node; jangan menilai 0 test sebagai PASS.

### Verifikasi awal sesudah clone

1. `git status --short` harus bersih sebelum bekerja.
2. `pnpm install --frozen-lockfile` berhasil tanpa mengubah lockfile.
3. Jalankan full `lib/game`, catat jumlah PASS/FAIL; laporan SPV3-7B lokal terakhir mencatat **434 passed, 0 failed**, tetapi angka dapat berubah sesuai commit baru.
4. `pnpm build` selesai. Peringatan chunk >500 kB pernah muncul dan bukan kegagalan build. Typecheck seluruh workspace pada audit terakhir **belum** hijau karena error lama/staging; jangan melaporkan hijau bila belum diverifikasi.
5. Jalankan localhost, buat karakter uji di browser/profil terpisah, lihat world dan panel, reload, pastikan save/hotbar tetap. Jangan mengubah save owner.

## 3. Peta repository dan aliran runtime

| Lokasi | Fungsi | Catatan pengembangan |
| --- | --- | --- |
| `app/page.tsx`, `app/layout.tsx`, `app/globals.css` | Entry UI React, layout, stylesheet | `page.tsx` besar dan client-side; jangan anggap route ini hanya presentasi pasif. |
| `components/game/` | Menu, HUD, panel, K-panel/skill, hotbar | Uji di viewport/browser; bug CSS dapat membuat panel terlihat di bawah world. |
| `lib/game/world.ts` | Orkestrator `Game`, Three.js world, input, movement, action, impact, rendering | File ini juga memuat koordinasi runtime combat. Jangan import seluruhnya ke unit/clean combat fixture hanya untuk menguji status/damage. |
| `lib/game/rules.ts` | `Hero`, pembuatan/normalisasi karakter, equipment/stat, save dan job routing | Save aktif menggunakan `lumenfall-saves-v3`; kode juga membaca kunci legacy. |
| `lib/game/regions.ts`, `field-layout.ts`, `sands-coordinates.ts`, `imported-map.ts` | Region/map dan koordinat | `WORLD_CONFIG`/chapter lama tidak sama dengan batas teknis progression V3; jangan menyamakan keduanya. |
| `lib/game/combat-*.ts`, `skill-action.ts`, `stun.ts`, `combat-status.ts` | Combat Foundation, resolusi hit/status, source ownership, transient state | Cari kontrak nyata di kode dan test sebelum menambah modifier. |
| `lib/game/skill-progression-v3.ts`, `adventurer-v3.ts`, `warrior-v3.ts`, `berserker-v3.ts`, `blade-master-v3.ts` | Registry/schema dan jalur skill V3 | V2 tetap ada; V3 tidak boleh otomatis mengubah save V2. |
| `lib/game/dual-wield.ts`, `blade-master-impact.ts` | Dua item senjata nyata dan hit sequence Blade Master | Character-wide stat dikonversi sekali; hand weapon layer eksplisit. |
| `lib/game/items.ts`, registry Rune/equipment/enhancement terkait | Item, nilai gear, Rune dan upgrade | Pertahankan identitas setiap instance, enhancement, socket, affix. |
| `public/assets/` | Aset runtime yang benar-benar direferensikan | Hindari memasukkan source Blender/Unreal mentah atau salinan arsip. Validasi request yang hilang setelah cleanup. |
| `tests/browser/`, `scripts/verify-*.mjs`, `lib/game/*.test.ts` | Browser/clean fixture dan regression | Clean fixture menguji komponen combat nyata tanpa world/map penuh; bukan pengganti semua smoke world. |
| `docs/` | Kontrak fase dan laporan implementasi | Banyak laporan historis; cari status dan tanggal, bukan hanya judul. |

Alur umum: menu membuat/memuat `Hero` → `Game` di world menerima input → validasi skill/target/weapon/rank → gerak dan impact → resolver CFV3 menghitung damage/status → HUD dan save memantulkan hasil. UI, engine, dan aset harus diuji bersama ketika mengubah integrasi. Bagi skill bertarget, caster bergerak mendekati target melalui path runtime, bukan langsung memberikan damage saat cast diterima. Hit reaction/flinch visual dibedakan dari Stun gameplay.

## 4. Riwayat keputusan dari pengembangan sejauh ini

Ringkasan ini menyatukan diskusi panjang menjadi keputusan yang masih relevan. Baca kontrak/laporan fase untuk angka lengkap; sejumlah request lama kemudian direvisi oleh fase yang lebih baru.

### Dunia, aset, dan UI

- Prototipe world 3D, map/terrain, karakter, monster, quest, NPC, inventory, item, Rune, enhancement, panel karakter/skill, serta hotbar telah dikembangkan bertahap. PrimaryHotbar **kosong** saat karakter Lv1 dibuat; pemain mengisinya sendiri. NPC development memiliki material anti-pecah enhancement harga 0 dan panel enhancement menyediakan pilihan memakainya atau tidak.
- Kandidat **Ibu Kota Mahkota Fajar** adalah eksperimen development, bukan alasan menimpa city produksi. Source Blender asli di komputer owner bersifat read-only dan berada **di luar** repo; tidak dibutuhkan oleh developer untuk menjalankan gameplay. Aset besar yang tidak dipakai, map eksperimen, dan publish archive pernah membuat source/upload membengkak. Jangan menyalin kembali staging atau menaruh backup di root repo.
- Eksperimen Flyff/Flaris dipindahkan ke backup eksternal setelah audit dependency; bukan dependency produksi. `D:\FlyffUS` adalah sumber eksternal milik owner, jangan disentuh. Hunyuan3D, Blender addon, Unreal Normandy, dan percobaan 3D lain tidak otomatis bagian runtime game. Lihat [audit Flaris](LUMENFALL_Flaris_Removal_Audit.md) dan [audit cleanup release](LUMENFALL_Public_Release_Cleanup_Audit.md).
- Vite pernah macet/boros RAM karena scan/watch source dan staging terlalu luas. Pembatasan Tailwind source scan/watch, pemindahan arsip/staging, dan pemisahan helper map server-safe sudah dilakukan. Jika macet lagi, diagnosis proses, import graph, cache, watcher, dan aset; jangan langsung mengubah gameplay atau menyatakan RAM 32 GB pasti cukup.

### Combat Foundation V3 (CFV3)

- Base STR/VIT/DEX/INT = **15/15/15/15**, memperoleh **2 stat point per level**. Universal Base Physical ATK = `7 + floor(level * 1.1)`. Bonus STR = `max(0, effective STR - 15)` dan kontribusi weapon-dependent hanya berlaku bila senjata fisik kompatibel ada. Unarmed Lv61 STR135 tetap punya Base Physical ATK **74**, bukan 194. Knuckle adalah family senjata, bukan unarmed.
- Satu konsep raw **Weapon ATK**: kontribusi bergantung kompatibilitas skill. Staff/Wand yang sesuai dapat menambah fondasi magic; Sword tidak otomatis masuk skill magic yang mensyaratkan Staff/Wand. Legacy `hero.weapon × 8` tidak boleh kembali masuk live Combat V3. Tidak semua angka Character Overview identik dengan nilai damage final.
- Rune mengikuti registry runtime, bukan asumsi: primary-stat Rune masuk stat layer sekali; `magicAttack` Rune flat; `resourceEfficiency` persen, bukan flat Max Mana; `skillDamage%` global untuk damaging physical+magic; `elementalDamage%` dormant sampai Element Resolver. Jangan menduplikasi konversi STR/INT atau mengubah rarity/roll tanpa persetujuan. Lihat [CFV3-2.1](LUMENFALL_CFV3-2.1_Implementation_Report.md).
- **Stagger dan Tenacity dihapus.** Jangan mengembalikan gauge, Break, resistance, staggerDamage, atau dependency skill lama. Visual flinch boleh tetap tanpa gameplay lock. Stun adalah status CC tersendiri, hanya untuk skill yang secara eksplisit disetujui, bukan setiap skill.

### Skill Progression V3 (SPV3)

- Struktur target: Adventurer Lv1–14 → Core Job Lv15–59 → Specialization Lv60–80 → Advanced Job Lv81–100 (reserved). Engine mendukung ancestry kontinu, rank-level gates, prerequisite antar-tier, biaya SP per-rank, skill-specific stat scaling, PvE/PvP profile data, hit sequence, dan metadata motion yang **tidak** mengendalikan damage. `availableSP = totalEarnedSP - spentSP`. Job change mereset SP yang dibeli, **bukan** level/stat/equipment/lineage. Kurva pemasukan SP global belum final. Lihat [fondasi SPV3-1](LUMENFALL_SPV3-1_Foundation_Report.md).
- Adventurer V3 dimigrasi sebagai referensi; Warrior V3 memiliki **tepat 11** skill Core, memakai 1H/2H Sword bersama, tanpa Dual Wield. Warrior V2 dan Thief V2 tetap tersedia bagi karakter legacy. Lihat [Adventurer](LUMENFALL_SPV3-2_Adventurer_V3_Report.md) dan [Warrior](LUMENFALL_SPV3-3_Warrior_V3_Report.md).
- Universal Stun memblok movement, Basic Attack, dan active skill selama status aktif; transient dan tidak disimpan. Iron Charge adalah sumber pertama: harus benar-benar bergerak dan impact, travel aktual **>=3,5 m** baru eligible roll, rank PvE chance **10/15/20/25/30%**, durasi PvE **1,5 detik**, tanpa knockback; target immune tetap kena damage. Clean browser fixture membuktikan kasus short/long, lock/recovery/immunity tanpa mengimpor `world.ts`. Lihat [Stun](LUMENFALL_SPV3-4_Stun_Foundation_Report.md) dan laporan validasi 4.4 bila tersedia di docs.
- Berserker V3 adalah spesialisasi Warrior 2H/AoE dengan **9 skill**. Earth Splitter memakai Stun generik per target; Breaker Entry hanya setelah impact Iron Charge; Fury Harvest menyembuhkan dari target yang benar-benar terkena; Trance/Frenzy Guard bersifat sementara. Warrior ancestry tetap bisa dipakai. Lihat [Berserker](LUMENFALL_SPV3-5_Berserker_V3_Report.md).
- Armor Break V3 menyimpan `sourceActorId`/`sourceSkillId`, strength, dan waktu aktif per sumber. Multi-source **tidak dijumlahkan**: mitigasi memakai aplikasi aktif terkuat; aplikasi lemah tetap dapat memenuhi synergy **milik caster sendiri**. Rank Warrior Armor Breaker: **6/7,5/9/10,5/12%**, bukan konstanta legacy 20%. Crushing Finale +10% dan Ruinous Arc +8% hanya dari Armor Break milik caster. Lihat [ownership](LUMENFALL_SPV3-5.1_Armor_Break_Ownership_Report.md) dan [rekonsiliasi angka](LUMENFALL_SPV3-5.2_Armor_Break_Numeric_Reconciliation_Report.md).
- Fondasi Dual Wield memakai **dua item 1H Sword nyata**, tidak ada penalti offhand tersembunyi. Main/offhand raw Weapon ATK adalah layer terpisah; character-wide STR/DEX/VIT/INT dikumpulkan lalu dikonversi sekali. Mode attack mencakup single main/off, combined, dan sequence. Shield/2H conflict harus menolak tanpa kehilangan item. Warrior/Berserker tidak mendapat capability ini otomatis. Lihat [SPV3-6](LUMENFALL_SPV3-6_Dual_Wield_Foundation_Report.md).
- Blade Master V3 kini **9 skill**: Twin Blade Mastery, Twin Assault, Blade Rush, Counterflow, Blade Focus, Cross Sever, Piercing Sequence, Tempo Drive, Blade Tempest. Mastery Mana reduction **R1–R5 = 0/2/4/6/8%**; tidak ada rank keenam. Flow/Tempo adalah state transient, bukan resource permanen. Fixture 7A/7B dan 434 regression pernah PASS; bukti itu bukan smoke visual full world. Nilai Mana cost/cooldown **Tempo Drive belum ditetapkan owner**; adapter memakai fallback netral 0/0. Accuracy +10 Piercing Sequence tercatat, tetapi skill hit-chance umum belum punya roll akurasi; jangan mengarang efek khusus. Lihat [7A](LUMENFALL_SPV3-7A_Blade_Master_Core_Report.md), [7A.1](LUMENFALL_SPV3-7A.1_Twin_Blade_Mastery_Mana_Audit.md), [7B](LUMENFALL_SPV3-7B_Blade_Master_Advanced_Report.md).

## 5. Batas desain dan pengujian yang tidak boleh disamakan

| Sudah ada/teruji | Belum final atau perlu validasi lebih jauh |
| --- | --- |
| Save browser lokal; pilihan V2/V3; Adventurer dan Warrior V3; Berserker V3; Stun/Armor Break; Dual Wield foundation; Blade Master 7A+7B engine dan fixture | Backend multiplayer dan cloud-save; Rogue/Assasin; Advanced Job; FP; PvP runtime; final animasi; final monster/skill/Rune rebalance; final SP income; world/UI end-to-end Blade Master |
| Unit/regression `lib/game` dan sejumlah clean browser fixture | Clean fixture **bukan** bukti map, hitbox Three.js, asset loading, UI/hotbar, dan animasi di full world semuanya benar |
| Build produksi terakhir pada laporan 7B PASS | Seluruh repo typecheck bebas error; performa/memory stabil pada setiap mesin; Site publik otomatis sama dengan local |

Jangan memperbaiki test dengan menghidupkan lagi Stagger/legacy combat. Jangan mengubah skill coefficient, cooldown, Mana, monster HP/DEF, Rune rarity, atau membuat Stun baru hanya agar smoke terlihat baik. Untuk bug runtime, telusuri urutan **cast → target snapshot → movement → impact → damage → status**, gunakan trace development-only. Tes yang hanya memastikan cast diterima tidak membuktikan hero bergerak/target HP turun.

## 6. Cara bekerja agar proyek tetap aman

1. Mulai dari issue/kontrak owner, baca definisi runtime dan laporan fase terbaru. Periksa `git status` karena ada perubahan owner yang mungkin belum dikomit; jangan reset/overwrite.
2. Pisahkan perubahan source, asset runtime, fixture development, dan eksperimen. Jangan masukkan backup, `.blend` sumber, GLB raksasa yang tidak dipakai, arsip publish, `node_modules`, cache, atau folder staging ke Git. Pastikan aset produksi yang memang direferensikan tetap tersedia.
3. Untuk perubahan combat, tambah test deterministik dekat modul (`lib/game/*.test.ts`). Untuk integrasi dunia/UI, jalankan smoke browser nyata. Clean fixture boleh menghindari map berat, tetapi laporkan batas klaimnya.
4. Jalankan focused test → full `lib/game` → build → smoke lokal proporsional. Catat status yang benar, termasuk warning dan test yang tidak sempat berjalan. Jangan menyebut PASS jika hanya HTML shell terlihat atau test belum mengeksekusi TypeScript bundle.
5. Pertahankan kontrak save V2/V3. Jangan migrasi/hapus karakter legacy tanpa keputusan owner. Status combat seperti Stun, Armor Break, Tempo, Trance, Flow adalah transient dan tidak boleh hidup kembali sesudah reload.
6. Tinjau ukuran, dependency, lisensi, dan referensi asset sebelum menambah file besar. Satu aset yang diletakkan di Git history tetap membebani clone walau dihapus pada commit berikutnya.

### GitHub berbeda dari Site publik

`origin` GitHub adalah **source repository** untuk kolaborasi. Push commit ke GitHub **tidak** otomatis membuktikan perubahan sudah terdeploy ke `https://lumenfall-penjaga-fajar.gadangkh.chatgpt.site/`. Sebaliknya Site publik dapat tertinggal dari source lokal/GitHub. Jangan mengunggah ulang seluruh repo sebagai arsip Site, dan jangan menganggap upload patch bila platform mensyaratkan full runtime bundle.

**Hak redistribusi aset harus diverifikasi sebelum push ke repository publik.** `public/audio/bgm/arunika/README.md` secara eksplisit menyebut lisensi musik Kota Arunika belum diberikan/diverifikasi; `public/assets/characters/female-rpg/credits.txt` mencatat model dasar CC BY 4.0, tetapi sumber animasi tambahannya memiliki lisensi tersendiri. Status terpasang pada runtime/Site bukan bukti hak untuk menyertakannya dalam clone GitHub publik. Bila repo harus publik, hapus/ganti file yang belum jelas izinnya dan uji fallback runtime; alternatifnya diskusikan repo privat serta hak akses developer dengan owner. Jangan menyatakan semua aset aman hanya dari nama folder atau fakta bahwa ia pernah digunakan lokal.

Workflow publish Site yang disetujui owner: cek versi publik/manifes bila tersedia → bandingkan output produksi lokal terhadap publik → buang arsip lama/duplikat/asset eksperimen dari **paket** → ukur ukuran arsip persis, jumlah file, dan apa yang berubah → minta **approval owner untuk ukuran dan scope pada percakapan publish tersebut** → baru deploy → verifikasi URL publik, build/gameplay/UI, dan laporkan. Jangan melakukan publish otomatis setelah push. Memindahkan file ke backup berbeda dari penghapusan permanen.

## 7. Troubleshooting praktis

- **`'node' is not recognized`**: instal/perbaiki PATH Node; Vite belum dimulai. Jangan berulang-ulang menghapus cache untuk ini.
- **`localhost:3000` tidak terbuka**: cek proses/port, URL bind yang dicetak, terminal error, dan apakah proses masih hidup. `localhost` dan `127.0.0.1` dapat berbeda pada mesin tertentu.
- **Terminal menampilkan `transforming...` terus / RAM melonjak**: pastikan hanya satu server, staging/arsip besar tidak berada di scan/watch tree, cek plugin dan dependency graph. Jangan mengimpor full `world.ts` ke fixture combat. Ukur working set/proses, bukan menyimpulkan dari kapasitas RAM saja.
- **Panel tampil di bawah world**: periksa CSS/layout dan bundle runtime yang dipakai, bandingkan dev vs preview produksi; jangan mengaitkan semua layout bug dengan mode dev tanpa bukti.
- **Source build berhasil, Site tetap lama**: cek apakah deploy dilakukan, version/manifest publik, cache, dan origin. Save localStorage tidak berpindah otomatis ke domain Site.
- **Aset hilang setelah clone**: pastikan file itu produksi dan direferensikan, bukan source eksternal/eksperimen. Jangan mengambil Flyff/Flaris atau Blender source owner tanpa izin/lisensi yang jelas.
- **Typecheck gagal padahal test/build lewat**: audit error per lokasi. TypeScript `include` saat ini luas (`**/*.ts[x]`); staging/eksperimen dan error lama perlu dipisah sebelum menetapkan typecheck sebagai quality gate global. Jangan menyembunyikan error dengan mematikan strict mode secara umum.

## 8. Bacaan berurutan untuk onboarding

1. [CFV3-1.1 closure](LUMENFALL_CFV3-1.1_Closure_Report.md) dan [CFV3-2.1](LUMENFALL_CFV3-2.1_Implementation_Report.md): angka dasar/weapon/Rune.
2. [SPV3-1 foundation](LUMENFALL_SPV3-1_Foundation_Report.md), [Adventurer](LUMENFALL_SPV3-2_Adventurer_V3_Report.md), [Warrior](LUMENFALL_SPV3-3_Warrior_V3_Report.md): schema, ancestry, gameplay awal.
3. [Stun](LUMENFALL_SPV3-4_Stun_Foundation_Report.md), [Berserker](LUMENFALL_SPV3-5_Berserker_V3_Report.md), [Armor Break 5.1](LUMENFALL_SPV3-5.1_Armor_Break_Ownership_Report.md)/[5.2](LUMENFALL_SPV3-5.2_Armor_Break_Numeric_Reconciliation_Report.md).
4. [Dual Wield](LUMENFALL_SPV3-6_Dual_Wield_Foundation_Report.md), [Blade Master 7A](LUMENFALL_SPV3-7A_Blade_Master_Core_Report.md), [7A.1](LUMENFALL_SPV3-7A.1_Twin_Blade_Mastery_Mana_Audit.md), [7B](LUMENFALL_SPV3-7B_Blade_Master_Advanced_Report.md).
5. [Audit cleanup/public](LUMENFALL_Public_Release_Cleanup_Audit.md) dan `AGENTS.md` untuk batas aset/map/publish. Perlakukan laporan historis sebagai evidence bertanggal; kode/test terkini tetap rujukan operasional.

## 9. Hal yang perlu diputuskan/dirapikan bersama owner

- Putuskan angka Mana/cooldown Tempo Drive dan tindak lanjut sistem Accuracy skill secara global.
- Validasi Blade Master melalui menu normal, inventory/equipment, world, hotbar, save/reload, serta rendering aktual sebelum menyebutnya siap publik penuh.
- Susun kurva SP akhir dan quality gates CI setelah seluruh sumber/staging bersih; pecah modul besar secara bertahap dengan regression, bukan rewrite spontan.
- Rancang backend akun/multiplayer/cloud save, party/PvP, job lanjutan, dan pipeline aset sebagai fase terpisah; jangan menganggapnya sudah tersedia.
- Pastikan setiap developer memakai repository GitHub bersih sebagai source of truth dan menguji clone baru pada mesin tanpa backup owner.
