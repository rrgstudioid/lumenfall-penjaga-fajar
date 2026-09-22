# LUMENFALL — Development Clean Break Report

## Hasil untuk Game Owner

Clean break lokal sudah diterapkan. Karakter yang dibuat melalui menu sekarang memakai `v2_test` sejak awal, dimulai sebagai Adventurer, dan tidak otomatis menjadi Warrior. Pada level 15, hanya Warrior yang tampil sebagai Core Job yang dapat dipilih; enam Core Job lain tampil sebagai locked/not implemented.

Save karakter sebelum clean break tetap dapat dibaca untuk pemeriksaan, tetapi ditandai tidak kompatibel dan tidak dapat masuk ke world. Menu menampilkan pesan singkat bahwa karakter berasal dari development build lama dan meminta pembuatan karakter baru. Slot lama tetap dapat dihapus dari menu. Tidak ada migrasi job, level, skill, equipment, inventory, rune, enhancement, quest, atau currency.

Data template game tidak disentuh. `ITEM_CATALOG`, definisi weapon/armor/accessory, rune, monster, map, material, dan asset tetap berada di source project. Yang dapat hilang hanya instance milik karakter lama ketika slot lama dihapus.

Pengaturan aplikasi seperti audio/UI disimpan melalui storage terpisah dan tidak dihapus oleh validasi karakter.

Warrior V2 tetap terdiri dari 16 active dan 14 passive node, hard targeting global tetap dipertahankan, dan tidak ada perubahan angka damage, Mana, cooldown, stagger, equipment, atau monster.

## Kebijakan Save Baru

- `characterSchemaVersion: 2` + `progressionArchitecture: 'v2_test'` = save yang dapat dimainkan.
- Save tanpa boundary tersebut, termasuk save legacy, = development save lama/incompatible.
- `currentTarget` dan state combat tetap runtime-only; tidak disimpan.
- Tidak ada destructive migration otomatis dan tidak ada mapping legacy job ke V2 job.

## Player Path yang Dipensiunkan

Untuk karakter baru, jalur actionable berikut tidak lagi tersedia: legacy Warrior/Rogue/Hunter/Wizard/Acolyte, Gatotkaca, Garda, Caroq, Anom, Srikandi, Jagawana, Resi, Pujangga, Pandita, Bajra, legacy Mastery, dan Capstone. Data dan runtime legacy masih dipertahankan internal karena sebagian dipakai oleh shared combat behavior, parser compatibility, katalog, dan regression tests.

## Berkas Utama yang Diubah untuk Clean Break

- `lib/game/rules.ts` — schema boundary, kompatibilitas save, factory karakter baru V2, dan promosi Core Warrior V2.
- `lib/game/job-presentation.ts` — pilihan Core V2: Warrior available setelah Lv15, lainnya locked.
- `lib/game/world.ts` — NPC job action memilih resolver V2 Warrior tanpa mengaktifkan legacy promotion pada karakter V2.
- `app/page.tsx` — blokir masuk world untuk save incompatible dan panel pilihan Core V2.
- `components/game/menu-presentation.tsx` — penanda old development save dan tombol Enter World yang aman.
- `app/menu-presentation.css` — gaya pesan old development save.
- `lib/game/clean-break.test.ts` — regression tests clean break.

## Validasi

- Full game test suite: **465 passed, 0 failed**.
- Production build: **berhasil**.
- TypeScript: **6 error lama tetap ada, tidak bertambah**. Error tersebut berada pada appearance fallback, UI layout, dan fixture `real-components`; bukan akibat clean break.
- Browser smoke test lokal: menu New Game → Character Creation → Create Character berhasil dan menampilkan karakter baru `Lv. 1 · Adventurer`.

## Yang Belum Dilakukan

Belum dibuat skill tree Thief, Acolyte, Archer, Knight, Mage, atau Smith. Berserker, Blade Master, Rage, Flow, Advanced Job, dan Combat Readability juga belum dimulai. Project belum dipublish.
