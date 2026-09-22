# LUMENFALL — SPV3-7A Blade Master Core Specialization Report

Status: **IMPLEMENTED / TESTED / CLEAN RUNTIME VALIDATED**

Fase ini mengaktifkan jalur V3 `Warrior → Blade Master` pada level 60. Scope berhenti pada lima skill inti 7A; tidak ada 7B, Tempo, PvP runtime, Blade Tempest, Crimson Blade, atau publish.

## 1. Transition dan ancestry

- `chooseV3BladeMaster()` membutuhkan V3, Core Job `warrior`, specialization kosong, dan level minimal 60.
- Job change mengembalikan SP skill yang sudah dibeli, mempertahankan `totalEarnedSP`, dan tidak membeli skill otomatis.
- `chosenCoreJob = warrior`, `chosenSpecialization = blade_master`.
- Ancestry Adventurer dan Warrior tetap tersedia; Berserker tetap sibling yang tidak dapat dibeli.
- V2 Warrior tidak dimigrasikan otomatis.

## 2. Lima skill canonical

1. Twin Blade Mastery — R5, 4 SP/rank.
2. Twin Assault — R8, 3 SP/rank.
3. Blade Rush — R5, 3 SP/rank.
4. Counterflow — R5, 3 SP/rank.
5. Blade Focus — R5, 3 SP/rank.

Tidak ada Cross Sever, Piercing Sequence, Tempo, Tempo Drive, atau Blade Tempest pada registry Blade Master 7A.

## 3. Capability Dual Wield

Capability live diturunkan dari dua kondisi:

`specialization === blade_master` dan `Twin Blade Mastery rank >= 1`.

Flag generik lama tidak dapat membuka Dual Wield untuk Blade Master. Saat Mastery hilang melalui reset, off-hand dilepas dari equipment secara aman tetapi item dan seluruh datanya tetap berada di inventory.

## 4. Twin Blade Mastery

- R1–R5: level 60/64/68/73/78.
- Akurasi: +2/+4/+6/+8/+10 saat konfigurasi Dual Wield valid.
- Pengurangan Mana Twin Assault dari Twin Blade Mastery: R1 0%, R2 2%, R3 4%, R4 6%, R5 8%. Angka 0 tambahan pada data runtime adalah rank 0 (belum dipelajari), bukan rank keenam. Audit dan bukti resolver: `LUMENFALL_SPV3-7A.1_Twin_Blade_Mastery_Mana_Audit.md`.
- Tidak mengubah Weapon ATK, STR, atau raw Physical Damage.
- Tidak mengaktifkan sistem Tempo; lifetime metadata `[5, 5.5, 6, 6.5, 7]` hanya disimpan untuk fase berikutnya.

## 5. Twin Assault

Twin Assault memakai dua hit nyata: MAIN lalu OFF. Pada R1, koefisien total 0,8 dibagi menjadi 0,4 + 0,4, dengan shared contribution weight 0,5 + 0,5 dan weapon coefficient 1 untuk masing-masing tangan. Total shared contribution tetap 1, sehingga character core tidak terhitung dua kali.

## 6. Blade Rush dan Flow Window

Blade Rush tetap memakai jalur mobility/damage yang ada, menerima One-Hand Sword, Two-Hand Sword, atau konfigurasi Dual Wield yang valid, dan pada Dual Wield memakai `SINGLE_MAIN`. Impact sukses membuka Flow Window tiga detik. Flow bersifat transient, tidak menumpuk, dapat diperpanjang oleh Blade Focus, dan tidak disimpan ke save.

Flow memberi +5 percentage points Critical Rate pada seluruh sequence Twin Assault dan dikonsumsi hanya setelah impact damage pertama yang berhasil. Blade Rush dan Counterflow tidak mengonsumsi Flow.

## 7. Counterflow dan Stun

Counterflow membutuhkan CounterContext `blocked` atau `parried`, memakai `SINGLE_MAIN` pada Dual Wield, mengonsumsi context yang valid, dan membuka Flow setelah impact. Ia memakai subsystem Stun universal yang sudah ada:

- chance 100% setelah syarat CounterContext dan impact terpenuhi;
- PvE 0,8 detik;
- PvP override 0,4 detik sebagai data saja;
- tidak ada Stagger atau Stun gauge baru;
- tidak ada knockback.

## 8. Blade Focus

Blade Focus adalah buff tanpa raw damage:

- Accuracy +6/+9/+12/+15/+18.
- Critical Rate +2/+3/+4/+5/+6 percentage points.
- Durasi 20/22/24/26/28 detik.
- Flow extension saat Flow baru dibuka atau di-refresh: 3,5/3,75/4/4,25/4,5 detik.

## 9. Basic Attack Dual Wield

Saat capability aktif dan dua One-Hand Sword valid terpasang, satu command Basic Attack menghasilkan satu hit dan berganti MAIN → OFF → MAIN → OFF. Tidak ada double hit, Stun, knockback, atau Tempo. Urutan di-reset ke MAIN ketika equipment berubah dan tidak dipersistenkan sebagai combat state.

## 10. Weapon dan save safety

- Kedua item tetap instance terpisah dengan Weapon ATK penuh.
- Tidak ada offhand penalty.
- Character-wide stat contribution tetap dikumpulkan sekali.
- Skill satu senjata tidak otomatis memakai raw Weapon ATK off-hand kedua.
- Equipment conflict tetap atomik; item tidak dihapus saat penolakan.
- Save menyimpan specialization, rank, dan equipment item identity. Flow/urutan Basic Attack adalah transient dan tidak dipulihkan sebagai combat state.

## 11. Clean runtime fixture

Fixture development-only berada di:

- `lib/game/blade-master-7a-fixture.ts`
- `tests/browser/blade-master-7a-fixture.ts`
- `tests/browser/blade-master-7a-fixture.html`
- `scripts/verify-blade-master-7a.mjs`

Fixture tidak mengimpor `world.ts`, terrain, map, GLB, NPC, monster population, audio, atau Flaris. Bukti runtime:

- lima skill terdaftar tepat;
- capability aktif setelah Mastery R1;
- layer MAIN 100 dan OFF 70, combined 170;
- Twin Assault hit hand `MAIN`, `OFF`;
- shared weight total 1;
- urutan Basic Attack `MAIN, OFF, MAIN, OFF`;
- Flow aktif lalu berhasil dikonsumsi;
- Counterflow Stun chance 1 dan durasi PvE 0,8;
- tidak ada console error/warning browser.

Artefak fixture tersimpan di `output/release-audit/blade-master-7a/`.

## 12. Validasi dan regression

- Blade Master focused tests: **4 passed / 0 failed**.
- Dual Wield + Warrior + Berserker + SPV3 focused tests: **8 passed / 0 failed**.
- Clean browser/runtime fixture: **PASS**.
- Full `lib/game`: **422 passed / 0 failed**.
- Production build: **PASS** dengan Vinext/Vite. Ada warning umum chunk client >500 kB, tetapi tidak ada build error.
- `git diff --check`: tidak menemukan whitespace error pada file fase ini.

## 13. Known limitations

- Counterflow runtime memakai CounterContext yang sudah ada; validasi browser fixture untuk input defense event penuh belum dibuat sebagai simulasi world.
- Blade Rush tetap menggunakan adapter movement collision-safe yang sudah tervalidasi; fixture 7A memvalidasi metadata dan flow, bukan full world movement.
- PvP runtime, diminishing return Stun, final animation, dan Tempo belum diaktifkan.
- K-panel belum didesain ulang penuh; registry dan resolver sudah menyediakan data yang dibutuhkan.

## 14. Rekomendasi SPV3-7B

Tunggu owner review. Fase berikutnya baru boleh membahas konten Blade Master lanjutan setelah keputusan terpisah; jangan mengaktifkan Tempo atau skill 7B secara otomatis.
