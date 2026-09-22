# LUMENFALL — SPV3-7A.2 Live Job Integration Report

Status akhir: **PASS — implementasi, runtime browser, regression, dan production build tervalidasi.**

Fase ini hanya menghubungkan progression V3 yang sudah ada ke flow pemain. Tidak ada perubahan damage, Mana, Stun, Armor Break, Dual Wield formula, SP economy, monster, atau konten SPV3-7B.

## 1. Mengapa job sebelumnya tidak tersedia di game aktual

Backend sudah memiliki transisi `chooseV3Warrior()`, `chooseV3Berserker()`, dan `chooseV3BladeMaster()`, tetapi lapisan presentasi tidak membaca seluruh state tersebut:

- panel Job V3 di `app/page.tsx` hanya menampilkan tombol Berserker;
- `job-presentation.ts` mengembalikan satu specialization V3 dan mengunci nama/hint ke Berserker;
- K panel belum memasukkan registry Blade Master ke lookup definisi V3;
- Character Overview belum menampilkan identitas V3 dan progression view mengunci stage specialization ke Berserker;
- hotbar lookup belum mengenali active skill Blade Master;
- normalisasi save V3 hanya memulihkan Berserker, sehingga `blade_master` berisiko turun kembali menjadi `null` setelah reload.

Akibatnya, runtime combat Blade Master sudah ada, tetapi jalur UI dan reload belum dapat mencapainya dengan aman.

## 2. Routing Job Trainer sebelum dan sesudah perbaikan

Sebelum perbaikan, UI membuat asumsi Berserker dan memanggil satu pilihan hardcoded. Sesudah perbaikan:

1. UI meminta daftar pilihan dari `getVisibleJobArchitecture(hero)`.
2. V3 Adventurer Lv15+ memakai transisi Warrior yang sudah ada.
3. V3 Warrior Lv60+ tanpa specialization menerima tepat dua pilihan: Berserker dan Blade Master.
4. Klik pilihan meneruskan ID ke `Game.chooseSpecialization()`.
5. `Game` tetap memvalidasi lokasi Specialization Trainer dan mendelegasikan ke resolver progression V3 yang kanonik.
6. UI tidak memiliki salinan logika refund, gate, atau mutasi lineage.

NPC V3 juga sekarang menampilkan label dan penjelasan yang sesuai: Core Job Trainer pada Lv15 dan Specialization Trainer pada Lv60.

## 3. Perilaku karakter V2 dan V3

- Save V2/legacy tidak dikonversi secara diam-diam dan tetap memakai registry/routing lama.
- Save V3 menggunakan `skillArchitectureVersion: 3`, `chosenCoreJob`, dan `chosenSpecialization`.
- Audit read-only pada profil browser pemilik yang tersedia di `localhost:3001` menemukan **tidak ada karakter tersimpan**: Continue dan Load Game nonaktif, hanya New Game tersedia. Karena itu profil tersebut bukan V2, V3, legacy-migrated, maupun development-only V3, dan tidak ada save pemilik yang dimutasi.
- Empat fixture eksplisit tersedia untuk pengujian tanpa grinding: `warrior-15`, `warrior-60`, `berserker-60`, dan `blade-master-60`. Helper ini tidak dipasang ke production UI.

## 4. Transisi Warrior Lv15 live

V3 Adventurer dapat memilih Warrior mulai Lv15 melalui `chooseCoreJob()` yang mendelegasikan ke transisi V3 yang sudah ada. Setelah berhasil:

- `chosenCoreJob = warrior`;
- rank berbayar Adventurer dikembalikan;
- `totalEarnedSP` tetap;
- tidak ada skill Warrior yang dibeli otomatis;
- job history dan status trainer tersimpan.

Gate dan transisi ini tervalidasi oleh focused tests; UI tidak membuat jalur Warrior kedua.

## 5. Transisi Berserker Lv60 live

Pada V3 Warrior Lv60, Berserker tampil sebagai pilihan aktif dengan identitas `Two-Hand Sword / AoE / Mobbing`. Pemilihan melalui NPC aktual menghasilkan:

- `specialization = berserker`;
- `chosenSpecialization = berserker`;
- Blade Master tidak dapat dipilih setelahnya;
- K panel menampilkan tepat 9 skill Berserker V3;
- tidak ada skill Blade Master atau specialization legacy pada stage tersebut.

## 6. Transisi Blade Master Lv60 live

Pada V3 Warrior Lv60, Blade Master tampil sebagai pilihan aktif dengan identitas `Dual Wield / Single Target / Precision`. Pemilihan melalui NPC aktual menghasilkan:

- `specialization = blade_master`;
- `chosenSpecialization = blade_master`;
- Berserker tidak dapat dipilih setelahnya;
- K panel menampilkan tepat 9 skill Blade Master V3;
- Twin Blade Mastery terlihat dan dapat dibeli;
- Dual Wield tetap `false` pada rank 0 dan baru berasal dari Twin Blade Mastery R1.

Kartu Twin Blade Mastery sekarang juga diberi label **MASTERY**, tanpa menampilkan Mana/cooldown/damage preview seolah-olah merupakan active combat skill.

## 7. SP refund

Job Trainer memanggil operasi transisi SPV3 yang sudah ada. Pengujian memastikan bahwa pada Warrior → specialization:

- seluruh rank berbayar direfund;
- `totalEarnedSP` tidak berubah;
- Warrior tetap menjadi ancestry;
- specialization terpilih tetap tersimpan;
- sibling specialization tetap tertutup.

Tidak ada perhitungan refund baru di komponen UI.

## 8. Hasil K panel

K panel sekarang membentuk ancestry yang benar:

- Adventurer → Warrior → Berserker; atau
- Adventurer → Warrior → Blade Master.

Stage specialization membaca registry sesuai pilihan. Rank, SP cost, next-rank level gate, prerequisite, dan status locked/available memakai resolver SPV3 yang sama dengan runtime. Hotbar lookup juga sekarang mengenali skill aktif Blade Master yang sudah dipelajari.

## 9. Hasil Character Overview

Character Overview sekarang menampilkan bagian `Job Identity V3` dengan dua nilai eksplisit:

- `Core Job: Warrior`
- `Specialization: Berserker` atau `Specialization: Blade Master`

Label specialization legacy tidak digunakan pada jalur V3.

## 10. Save/reload

Normalisasi save sekarang memulihkan kedua ID V3: `berserker` dan `blade_master`. Browser test melakukan reload nyata setelah masing-masing pilihan dan memastikan:

- `skillArchitectureVersion = 3` tetap;
- Core Job Warrior tetap;
- specialization yang dipilih tetap;
- Job Trainer tidak menawarkan pilihan specialization lagi;
- K panel menggunakan registry specialization yang dipulihkan.

## 11. Bukti actual in-game

Verifier menggunakan route game development aktual `/`, world runtime aktual, NPC `jaya-1`, dialog Job aktual, K panel aktual, Character Overview aktual, dan local save/reload pada browser context terisolasi. Ia bukan isolated combat fixture.

Evidence tersimpan di `output/spv3-7a2-live-job-evidence/`:

1. `01-lv59-specializations-locked.png` — kedua pilihan terlihat dan terkunci dengan `Requires Level 60`.
2. `02-berserker-selected.png` — Berserker aktif melalui Job Trainer.
3. `03-berserker-k-panel.png` — 9 skill Berserker V3.
4. `04-berserker-character-overview.png` — Core Job/Spec Berserker.
5. `05-blade-master-selected.png` — Blade Master aktif melalui Job Trainer.
6. `06-blade-master-k-panel.png` — 9 skill dan Twin Blade Mastery purchasable.
7. `07-blade-master-character-overview.png` — Core Job/Spec Blade Master.
8. `results.json` — assertion browser dan error collection.

Hasil browser: **PASS**, 0 page error, 0 console warning/error, dan 0 failed request untuk seluruh profil uji.

## 12. Focused tests

Perintah focused mencakup live integration, presentation/routing, SPV3, Adventurer, Warrior, Berserker, Blade Master 7A, dan Dual Wield foundation.

Hasil: **53 passed / 0 failed**.

Test baru mencakup:

- dua sibling terlihat dengan level gate yang benar;
- refund dan exclusivity Berserker;
- Blade Master tanpa auto-Dual-Wield;
- Twin Blade Mastery R1 sebagai capability source;
- save/reload kedua specialization;
- separasi V2;
- copy NPC V3 dan empat development fixture.

## 13. Full regression

Full `lib/game/*.test.ts`:

- **440 passed**
- **0 failed**
- 0 skipped/cancelled/todo

Warrior, Berserker, Blade Master, Dual Wield, Armor Break, Stun, Thief V2, equipment, Rune, world, dan save regression tetap hijau.

## 14. Production build

`vinext build` menyelesaikan semua lima tahap:

- client references;
- server references;
- RSC environment;
- client environment;
- SSR environment.

Hasil: **PASS**, route `/` terbentuk.

Lingkungan dependency lokal yang dipakai untuk verifikasi masih mengeluarkan warning bahwa `@tailwindcss/vite` dan `nitro/vite` tidak tersedia di shared dependency tree, serta warning chunk >500 kB. Keduanya tidak menghentikan build dan bukan perubahan SPV3-7A.2.

## 15. File yang berubah dan batasan tersisa

File implementasi utama:

- `app/page.tsx`
- `app/character-screen.css`
- `components/game/job-architecture-preview.tsx`
- `components/game/job-skill.tsx`
- `components/game/menu-presentation.tsx`
- `lib/game/job-presentation.ts`
- `lib/game/character-view.ts`
- `lib/game/hotbar.ts`
- `lib/game/regions.ts`
- `lib/game/rules.ts`
- `lib/game/world.ts`

Validasi:

- `lib/game/live-job-integration-v3.test.ts`
- `scripts/verify-live-job-integration-v3.mjs`

Batasan yang sengaja dipertahankan:

- tidak ada conversion tool save V2 → V3;
- tidak ada cheat/dev selector di production UI;
- tidak ada redesign penuh K panel;
- tidak ada perubahan skill/balance SPV3-7B;
- tidak ada Advanced Job;
- build chunk besar tetap menjadi pekerjaan optimasi terpisah.

**STOP: SPV3-7A.2 selesai. Tidak melanjutkan ke implementasi SPV3-7B.**
