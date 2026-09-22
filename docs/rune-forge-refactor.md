# LUMENFALL — Laporan Refactor Rune Forge

Tanggal: 11 September 2026. Status: diimplementasikan dan diuji di project lokal. Situs publik belum diperbarui.

## 1. Penyebab masalah

Optimizer lama menulis hasil ke `equipment.affixes`, bukan ke Rune. Pemilihan stat memakai irisan tema Rune, warna optimizer, dan jenis equipment. UI menampilkan kumpulan tersebut sebagai “Opsi Tambahan”, sehingga Meteor Staff dengan Rune of Focus dapat memperlihatkan stat yang bukan milik Focus. Pemindahan Rune ke socket sebelumnya juga memakai salinan sebagian field, berisiko kehilangan metadata instance ketika dilepas.

Arsitektur baru menggunakan satu inventory dan state Hero yang sama: stat Rune hanya berasal dari instance Rune dalam socket. Unique Stats tetap milik equipment.

## 2. File yang diubah dalam refactor ini

Runtime:

- `lib/game/items.ts`: schema, registry optimizer, konfigurasi peluang, factory, migrasi, dan agregasi stat.
- `lib/game/rules.ts`: install/remove, transaksi reroll, crafting, pending result, migrasi save, dan breakdown Character.
- `lib/game/world.ts`: akses Forge Master, transaksi penyimpanan atomik, pembatalan saat meninggalkan Forge.
- `lib/game/monster-loot.ts`: mengganti keluaran optimizer lama dengan item kanonis.
- `lib/game/item-icon-manifest.ts`: mapping empat ID baru; menghapus mapping ID yang dinonaktifkan.
- `app/page.tsx`: menghapus dialog optimizer/aksi Rune jarak jauh, menghubungkan tab Rune Forge, detail inventory read-only, dan resep NPC.
- `app/forge-panel.css`: tambahan styling Rune dengan visual Forge yang sudah ada.
- `components/game/rune-forge-panel.tsx`: panel Pasang Rune/Reroll Rune; menyimpan selection ID dan konfirmasi saja.
- `components/game/rune-details.tsx`: presentasi Rune read-only yang dipakai ulang.
- `components/game/forge-panel.tsx`: enhancement tetap berjalan; menghapus Additional Options dari detail.
- `components/game/character-overview.tsx`: menghapus akses optimizer jarak jauh dan agregasi/tampilan opsi equipment lama.

Pengujian:

- `lib/game/rune-forge.test.ts` (baru).
- `lib/game/rules.test.ts`, `mana-potions.test.ts`, `character-ui.test.ts`, `forge.test.ts`, `unique-stats.test.ts`, dan `item-descriptions.test.ts`.
- `scripts/test-rune-forge-browser.mjs` (baru) dan `scripts/test-forge-browser.mjs`.

Aset baru di `public/assets/icons/items/`:

- `rune-stabilizer.webp`
- `rune-optimizer-chromatic.webp`
- `rune-optimizer-greater-chromatic.webp`
- `rune-optimizer-perfect-chromatic.webp`

Keempat ikon memakai ulang artwork optimizer tier lama yang kini tidak aktif, dengan path kanonis baru. Bukan gambar baru hasil generasi. Perubahan terrain, kota, dan file lain yang sudah ada di worktree sebelum refactor ini tidak dihapus atau diakui sebagai perubahan Rune.

## 3. Schema instance Rune

Field existing dipertahankan: `runeRarity` adalah **quality Rune**, bukan property `runeQuality` kedua. `affixes` pada Rune menyimpan pilihan stat dan nilainya.

```ts
equipment.sockets[index].rune = {
  ...runeInstance, // seluruh ItemData, bukan proyeksi sebagian field
  id, templateId,
  runeTheme,
  runeRarity,
  affixes,
  uniqueEffect,
  runeQualityFixed,
  runeJobRequirement,
  source, runeSource, sourceLabel,
  optimizerHistory,
  runeSchemaVersion: 2
}
```

Inventory → socket → inventory mempertahankan ID, quality, nilai, efek, asal item, soulbound, lock, dan metadata lainnya. Rune dipindahkan, bukan digandakan. JSON save menyimpan instance lengkap di socket yang memilikinya.

## 4. Schema equipment

Base stats, bonus/Unique Stats, status reveal, enhancement, slot, rarity, syarat job/level, sumber item, dan equipped state tetap memakai schema existing.

`equipment.affixes` dinormalisasi menjadi array kosong sebagai kompatibilitas schema lama. Data `additionalOptions`, `equipmentOptions`, `optimizerOptions`, dan fokus warna dibuang saat migrasi. Riwayat optimizer equipment yang tidak lagi berlaku dikosongkan; riwayat reroll baru disimpan pada Rune. Data tersebut tidak dikonversi menjadi Rune affix.

## 5. Penghapusan Additional Options

Generator affix equipment, kapasitas tambah opsi, pool optimizer berwarna, pilihan target affix equipment, lock per-opsi equipment, preview lama, dan apply-preview lama sudah dihapus.

Agregasi Character/combat kini memakai base equipment, Unique Stats yang sudah terbuka, dan Rune terpasang. Fungsi `calculateEquipmentUniqueStats` tidak memasukkan generic equipment affixes. Breakdown tidak lagi memiliki kolom Rune Optimizer yang menghitung stat kedua kali.

Rumus enhancement dan batas stat existing tetap dipakai. Total stat pada save yang sebelumnya memiliki opsi equipment salah dapat turun: ini penghapusan bonus tidak valid, bukan hilangnya Rune atau Unique Stats.

## 6. Perbaikan Unique Stats

Equipment `unique` dan `legacy`, termasuk alias tampilan Unique, Unique (Legacy), dan Unique Legacy, diperiksa saat dibuat/dimuat. Bila tidak memiliki bonus yang valid, `rollUniqueStats` existing mengisi stat tersembunyi memakai seed deterministik dari ID instance.

Hasil hanya dibuat untuk instance yang memang kosong. Bonus valid yang sudah ada dan status revealed tidak diacak ulang. Hasil migrasi ikut disimpan ketika karakter mulai dimainkan atau memakai jalur save normal.

## 7. Arcane Magnifier

Tetap terpisah dari Rune Forge. Satu Magnifier membuka Unique Stats tersembunyi sekali. Magnifier yang dikunci tidak dikonsumsi. Equipment terkunci, non-equipment, dan kekurangan Magnifier ditolak.

Domain test dan klik browser membuktikan reveal tidak mengubah socket, Rune, quality, affix, unique Rune effect, atau enhancement. Reload mempertahankan hasil reveal.

## 8. Akses hanya dari Forge Master

Alur: klik NPC Forge Master → **Tempa** → tab **Rune Forge**.

Akses memakai `forgeAccessReason` existing: kota yang benar, NPC terdaftar dengan identitas layanan Forge Master, layanan forge, dan jarak interaksi. Game juga memerlukan karakter hidup serta sesi yang dibuka lewat interaksi NPC.

Empu Wira (`aruna-3`) dan Empu Niskala (`jaya-2`) diuji. Juru Segel tidak memperoleh akses hanya karena memiliki alias layanan forge lama. Inventory, Character, hotbar, field, serta pemanggilan tanpa sesi tidak membuka modifikasi Rune.

Perubahan region, penutupan Forge, atau interaksi yang menggantikan sesi menutup panel. Snapshot game menutup UI yang kehilangan akses; setiap transaksi memvalidasi ulang, bukan mempercayai tombol React.

## 9. Pasang dan lepas Rune

- Pilih equipment, socket kosong, dan Rune dari inventory.
- Tampilkan kompatibilitas job, quality, affix, sumber, dan preview stat equipment.
- Konfirmasi memindahkan instance asli; pemasangan tidak membutuhkan optimizer dan gratis.
- Pelepasan tetap **250 GOLD**, memerlukan ruang inventory, dan mengembalikan instance utuh.
- Equipment/Rune terkunci, job tidak cocok, socket penuh, identitas Rune yang sudah dipasang, atau inventory penuh ditolak tanpa konsumsi.

Detail Rune di luar Forge bersifat read-only.

## 10. Basic Rune Optimizer

Biaya: **1 Basic + 250 GOLD** per roll.

Mengacak seluruh pilihan dan nilai affix dari tema Rune yang sama, mempertahankan quality dan jumlah affix saat ini. Rare Focus dengan dua affix tetap Rare dengan dua affix. Pool Focus hanya MP Recovery, Critical Rate, Mana Cost Reduction, dan Accuracy.

Tetap memakai `rollRuneAffixes` existing, bukan tabel stat baru. Rune Fortune tidak mendapat stat tambahan di luar tiga anggota pool-nya.

## 11. Chromatic dan transaksi hasil

Chromatic memilih quality baru, kemudian memakai aturan jumlah/nilai affix quality tersebut dan tema Rune yang sama. Unique effect dan identitas Rune tidak berubah. Keenam Rune boss dengan quality fixed tetap Ancient.

Sebelum hasil ditampilkan, Game membuat salinan Hero, memvalidasi, mengurangi biaya, membuat satu pending receipt, lalu menyimpan seluruh transaksi ke localStorage. Baru setelah save berhasil state utama dan UI diganti.

- Konfirmasi sebelum roll dapat dibatalkan tanpa biaya.
- Setelah roll: **Keep Current** mempertahankan Rune lama, **Accept New** menerapkan kandidat.
- Keduanya tidak mengembalikan biaya roll.
- Hanya satu kandidat aktif. Klik berulang dan receipt yang sudah dipakai tidak dapat diterapkan lagi.
- Accept memeriksa identitas/signature Rune saat ini; tidak menimpa Rune yang sudah berubah.
- Reload dapat melanjutkan kandidat yang sudah dibayar setelah kembali mengakses Forge Master yang sama.
- Menutup sesi Forge atau pindah region membatalkan kandidat, tanpa refund.
- Jika penyimpanan transaksi gagal, item/GOLD tidak terpakai dan kandidat tidak ditampilkan.

## 12. Peluang Greater/Perfect dan biaya

Konfigurasi terpusat: `RUNE_REFORGE_WEIGHTS`, `RUNE_REFORGE_STEP_WEIGHT`, dan `RUNE_OPTIMIZER_TIER_RULES` di `items.ts`.

| Optimizer | Downgrade | Quality sama | Upgrade | GOLD/roll |
| --- | ---: | ---: | ---: | ---: |
| Chromatic | 45% | 45% | 10% | 1.200 |
| Greater Chromatic | 25% | 55% | 20% | 2.500 |
| Perfect Chromatic | 10% | 60% | 30% | 5.000 |

Ini nilai balancing awal, bukan peluang resmi yang sebelumnya ada. Tiap arah dapat mencapai semua quality yang tersedia; setiap langkah tambahan memiliki bobot 0,2 kali langkah sebelumnya. Bobot dinormalisasi dalam arah tersebut. Jika tidak ada quality di arah itu (Cracked/Ancient), bobotnya dipindahkan ke quality sama.

UI menampilkan distribusi aktual setelah mempertimbangkan batas quality, Stabilizer, dan Rune fixed. Perfect meningkatkan peluang, tidak menjamin Ancient. Power existing tetap 0,3 / 0,5 / 1 / 1,5 / 2,2 / 3 / 4. Tidak ada stat ceiling khusus optimizer.

## 13. Rune Stabilizer

Rarity Rare. Opsional untuk tiga tipe Chromatic, bukan Basic. Memakai satu Stabilizer bersama satu optimizer dan biaya GOLD tier saat roll dikonfirmasi.

Aturan `clamp-to-current-quality`: probabilitas downgrade dipindahkan ke quality saat ini, bukan menjadi upgrade. Epic hanya dapat menghasilkan Epic, Legendary, atau Ancient. Rune yang sudah fixed tidak kehilangan perlindungan quality atau unique effect.

## 14. Item legacy, drop, dan crafting

Konversi satu-banding-satu, ID instance dan jumlah tetap:

| ID template lama | ID template baru |
| --- | --- |
| rune-optimizer-refined | rune-stabilizer |
| rune-optimizer-rare | rune-optimizer-chromatic |
| rune-optimizer-epic | rune-optimizer-greater-chromatic |
| rune-optimizer-legendary | rune-optimizer-perfect-chromatic |
| rune-optimizer-grey | rune-optimizer-basic |
| rune-optimizer-red | rune-optimizer-basic |
| rune-optimizer-magenta | rune-optimizer-basic |
| rune-optimizer-yellow | rune-optimizer-basic |
| rune-optimizer-blue-arcana | rune-optimizer-basic |
| rune-optimizer-blue-vitality | rune-optimizer-basic |

Konversi warna ke Basic dipilih konservatif agar tidak memberi mass-upgrade ke optimizer premium. Seluruh konversi berada dalam satu tabel migrasi. ID lama tidak dapat dibuat melalui factory aktif.

Hanya lima template terkait optimizer yang aktif: Basic, Stabilizer, Chromatic, Greater Chromatic, Perfect Chromatic. Katalog menjadi **98 item aktif** dari 104 sebelumnya karena penggantian 11 template lama menjadi 5.

Drop tetap memakai gate dan keluarga loot existing; keluarga optimizer sekarang memberi Basic dari normal, Stabilizer dari elite, dan distribusi boss Chromatic 60 / Stabilizer 25 / Greater 12 / Perfect 3 (bobot bersyarat setelah keluarga optimizer terpilih, bukan persentase absolut per kill). Tidak mengubah stat monster atau item lain.

Crafting memakai resep existing dengan keluaran baru: Basic 3 Iron + 150 GOLD; Stabilizer 3 Titanium + 400 GOLD; Chromatic 2 Vibranium + 900 GOLD; Greater 1 Meteorite Core + 2.000 GOLD; Perfect 3 Meteorite Core + 4.500 GOLD. Kedua Forge Master memakai resep yang sama. Deskripsi material dan optimizer lama yang dikenali diperbarui.

## 15. Save migration

Tetap memakai save collection v3 dan key localStorage existing. `runeSystemVersion: 2` serta `runeSchemaVersion: 2` menandai revisi Rune, tanpa save progression terpisah.

Migrasi berlaku pada inventory, storage, pending loot, archived/retired items, dan Rune di socket. Alias `runeQuality`/`runeAffixes` diterjemahkan ke schema existing. Rune valid yang kosong dapat diperbaiki deterministik melalui pool/quality-nya sendiri, bukan dari opsi equipment lama.

Rune legacy yang temanya tidak dapat dikenali tetap dimiliki dan dapat dilepas; reroll ditolak dengan alasan jelas. Tidak diberi tema tebakan. Level, job, quest, equipped state, GOLD, dan kepemilikan tidak di-reset.

## 16. Pengujian

- **184/184 tes logika lolos** di suite game, termasuk migrasi optimizer generik dari save sangat lama dan pemisahan konsumsi Stabilizer.
- **19/19 skenario Rune browser lolos**, termasuk toggle Stabilizer ON/OFF, perpindahan Chromatic → Basic → Chromatic, dan pemilihan optimizer terbuka saat stack optimizer lain terkunci.
- **20/20 skenario regresi enhancement browser lolos**, termasuk material, Fate Rune, Eternal Seal, downgrade, maksimum +12, kedua kota, larangan field, dan drag.
- Browser memakai Chrome dengan context/karakter tes terpisah. Save browser pemain tidak disentuh.
- Rune Forge diperiksa pada 1366×768, 1920×1080, dan 2560×1440, dengan UI scale 75%, 100%, dan 150%. Drag berpindah 1:1 mengikuti pointer; konten panjang dapat di-scroll.
- **98/98 ikon item valid**, tanpa HTTP asset error.
- TypeScript dan lint pada file yang diubah lolos.
- Build produksi berhasil. Game dijalankan/diperiksa melalui server lokal existing di port 3001.
- Kedua suite browser mencatat **0 console/runtime/hydration error**.

Bukti lokal: `work/rune-forge/results.json`, `work/forge/browser-results.json`, dan screenshot di kedua direktori tersebut. Folder work tidak menjadi aset runtime.

## 17. Batasan dan status publikasi

- Belum dipublikasikan ke situs publik; perlu perintah publikasi untuk memperbarui website yang dimainkan pengguna lain.
- Empat ikon baru memakai ulang artwork tier lama, belum artwork khusus Chromatic/Stabilizer.
- Ekonomi dan save masih client-side sesuai arsitektur game. Transaksi mencegah free-preview/replay dalam alur aplikasi, bukan manipulasi manual localStorage/devtools atau konflik antar-tab. Ini bukan sistem anti-cheat server.
- Peluang dan biaya adalah balancing awal yang mudah dituning; belum merupakan hasil pengujian ekonomi jangka panjang.
- Efek unik existing dipertahankan, bukan dibuat ulang atau diberi mekanik combat baru.
- Build memberi peringatan chunk lebih dari 500 kB dan keterbatasan klasifikasi route vinext; keduanya tidak menggagalkan build. Helper build Sites mengalami kegagalan pemanggilan shim Windows, sehingga build dijalankan melalui CLI vinext existing yang sama.
- Pengujian visual difokuskan pada desktop dan sistem yang terdampak. Tidak mengklaim seluruh perangkat mobile atau semua panel game diuji ulang.
