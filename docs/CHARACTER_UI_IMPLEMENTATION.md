# Character UI — implementasi final

Character (C) kini satu dashboard tanpa tab Overview, Job, atau Equipment dan tanpa tombol Stat Breakdown. Area utama menampilkan identitas/job aktif, atribut, HP/MP, model 3D dengan 13 slot equipment, Combat Stats, dan Survival. Advanced Stats serta detail item dibuka sebagai popup; popup boleh di-scroll, layar utama tidak.

## File dan batas perubahan

- `components/game/character-screen.tsx`: dashboard, tooltip, comparison, equipment picker, reset confirmation.
- `app/character-screen.css`: layout dan styling khusus C, termasuk tampilan pada skala UI 150%.
- `lib/game/character-screen.ts`: daftar stat/slot, data atribut dan adapter Combat Power; memakai kalkulator game yang ada.
- `components/game/stat-block-list.tsx`: komponen stat lama dipindah tanpa perubahan perilaku; tetap dipakai panel Job.
- `components/game/character-overview.tsx`: compatibility export untuk pemanggil lama.
- `app/page.tsx`: menghubungkan dashboard, menghapus state tab lama, mempertahankan hotkey dan dialog lain.
- `lib/game/drag-drop.ts`, `components/game/drag-drop-provider.tsx`, `lib/game/world.ts`: target drop equipment tervalidasi dan refresh visual melalui jalur equip yang sudah ada.
- `lib/game/items.ts`: petunjuk item diperbarui agar tidak menunjuk tab Equipment yang sudah dihapus.
- `lib/game/character-screen.test.ts`, `scripts/test-character-screen-browser.mjs`: pengujian data dan browser terisolasi.

## Fitur yang dipertahankan

Equip/unequip, syarat level/job, aturan Main/Off Hand, rarity/enhancement, Unique Stats, Magnifier, rune/socket, pet/evolusi, alokasi/reset stat, inventory/hotbar, dan save/load tetap memakai implementasi game. Rune/Optimizer tetap melalui Forge Master. Preview dan hover comparison tidak mengubah hero/save; pemasangan two-hand yang melepas Off Hand memerlukan konfirmasi. Drop tidak valid tidak mengubah data.

J tetap Quest dan K tetap Job Skill, sesuai keybinding aktual project. Sistem advancement dan panel Job tidak direwrite.

## Validasi

- 18 pemeriksaan browser pada game localhost berhasil: C, seluruh slot/model, tooltip cleanup, hover comparison, preview, konfirmasi equip, unequip, pointer drag, alokasi/reset, kedua panel lama, save/load, perubahan header setelah promotion, serta tidak ada console/runtime error atau aset gagal dimuat.
- Layar utama tanpa scroll pada 1920×1080, 1366×768, 1024×768 dan skala UI 150% pada 1366×768.
- 55 tes terarah untuk Character, stat, hotbar, dan Rune Forge berhasil.
- Suite keseluruhan: 251/257 berhasil. Enam kegagalan sudah ada sebelum task: legacy inventory layout, tiga ekspektasi field/map, dan dua ekspektasi deskripsi/save item. Tidak ada kegagalan baru.
- Pemeriksaan tipe masih memiliki dua error lama di `ui-layout.ts` dan harness `real-components.tsx`; tidak ada error tipe baru. Lint komponen/data baru berhasil.

## Batasan yang disengaja

Combat Power menampilkan “— / Belum tersedia”. Belum ada formula produksi dalam project. Adapter menerima kalkulator resmi dan rincian kontribusinya jika nanti tersedia; tidak ada angka power buatan atau formula berbasis rarity. Stat resistance elemental generik yang tidak aktif tidak ditambahkan hanya untuk mengikuti contoh dokumen.

Pengujian browser memakai profile/save khusus, bukan save pemain. Model, material, map, dan formula gameplay yang ada tidak diubah oleh task UI ini.
