# REPORT A — Phase 2D: Classic MMORPG Hard Target

Tanggal: 19 September 2026. Status: implementasi lokal dan verifikasi selesai; belum dipublish.

## 1. Cara targeting sekarang bekerja

Karakter pada jalur `v2_test` memilih satu musuh secara eksplisit. Musuh terdekat tidak otomatis menjadi target. Pilihan ini hanya berlaku selama bermain, tidak disimpan permanen dalam save.

Karakter legacy tetap memakai perilaku lama. Phase ini tidak mengaktifkan Warrior V2 ataupun mengubah karakter/save pemain menjadi V2.

## 2. Klik pertama dan kedua

- Klik musuh yang belum dipilih: hanya memilih, tidak menyerang.
- Klik lagi musuh yang sama: menjalankan basic attack existing, jika siap dan dalam jangkauan.
- Klik musuh lain: mengganti pilihan, tidak langsung menyerang.
- Klik tanah kosong: membatalkan pilihan.
- Tidak ada click-to-move; pergerakan WASD tetap seperti sebelumnya.

## 3. Jika target jauh

Basic attack atau skill yang memerlukan target ditolak dengan pesan di luar jangkauan. Tidak berjalan otomatis, tidak menyerang musuh yang lebih dekat, dan tidak mengganti pilihan. Cast yang ditolak tidak membayar Mana/cooldown atau menghabiskan kesempatan counter.

## 4. Jika target mati atau hilang

Pilihan, cincin, dan panel target dibersihkan. Tidak ada pengganti otomatis. Identitas spawn juga diperiksa sehingga musuh yang respawn tidak dianggap sebagai target lama. Pilihan dibersihkan saat pindah map/karakter, kembali ke menu, pemain mati, dan dunia ditutup.

## 5. Basic attack

Basic attack V2 menyerang musuh yang dipilih saja. Damage, attack speed, cooldown, combo dan pemakaian panah existing dipertahankan. Tanpa target valid, tidak ada basic attack ke musuh terdekat.

## 6. Single-target skill

Menggunakan target yang dipilih saat cast dimulai. Multi-hit tetap menyerang target awal meskipun pemain kemudian memilih musuh lain. Jika target awal mati/hilang, sisa hit berhenti; tidak berpindah ke target baru. Counter/parry tidak otomatis memilih penyerang sebagai target.

## 7. AoE, frontal arc, self, dan dash

Self buff dan AoE sekitar karakter tidak membutuhkan target. Frontal arc menggunakan arah karakter; bila ada target valid, karakter menghadap target sekali saat cast dimulai. Tidak melacaknya terus-menerus. Dash yang memerlukan musuh menggunakan target terpilih melalui jalur gerak existing, bukan pencarian musuh terdekat.

## 8. Visual target

Satu cincin emas di bawah musuh dan panel kecil berisi nama, level bila tersedia, serta HP sekarang/maksimum. HP berubah ketika musuh menerima damage. Panel menerima klik UI tanpa meneruskannya ke dunia. Cincin/panel dipakai ulang, bukan dibuat terus setiap frame.

## 9. Kamera

Tidak ada camera lock-on. Pemilihan target sendiri tidak memutar karakter atau kamera. Hanya aksi combat yang boleh menghadapkan karakter sekali. Perilaku kamera existing tidak dirombak.

## 10. Yang belum dibuat

Tidak ada skill/passive Warrior, Berserker, Blade Master, Rage, Flow, TAB targeting, auto-approach, GCD, channeling, sistem cancel, atau aktivasi Job V2. ESC tetap untuk menu/panel. Stamina tidak diperkenalkan kembali.

Action lock opsional sudah tersedia untuk skill masa depan. Selama lock, skill/basic attack baru ditolak. Definisi aksi menentukan apakah gerakan tetap diperbolehkan. Ini bukan durasi animasi dan bukan GCD.

Bonus skill scoped normal V2 dijumlahkan dalam satu kelompok; bonus payoff eksplisit seperti counter mengalikan seluruh damage mentah. Tidak ada angka Warrior baru yang ditetapkan. Pengecekan recent stagger break 1,5 detik tersedia tanpa mengubah durasi stagger yang melumpuhkan target.

## 11. Kesiapan Warrior V2 dan batas verifikasi

Fondasi Phase 2D siap menerima konten Warrior V2. Tidak ditemukan kebutuhan rewrite besar. Aktivasi dan desain angka skill masih menunggu task berikutnya.

| Pemeriksaan | Hasil |
|---|---|
| Baseline regression sebelum Phase 2D | 357 lulus, 0 gagal |
| Regression akhir, seluruh `lib/game` | **378 lulus, 0 gagal, 0 dilewati** |
| Test baru | 21 |
| Production build | Berhasil, exit 0 |
| TypeScript | 6 error lama sebelum dan sesudah; 0 error baru |
| Focused lint | Lulus |
| Browser fixture | Pilih, serang, pindah, clear, despawn, panel HP dan klik UI lulus; tidak ada warning/error console tercatat |

Uji browser memakai scene terpisah dengan capsule sederhana tetapi memakai input, picking, basic attack dan target presentation production. HP A terlihat 1000 setelah klik pertama, 970 setelah klik kedua; pindah ke B tetap 1000 dan hanya satu cincin. Ini bukan klaim playtest semua map atau semua kombinasi HUD. Skill verifikasi browser mengarahkan pengujian visual ini; CLI tidak tersedia, sehingga dipakai browser bawaan. Save pemain tidak disentuh.

Batas yang masih perlu diperhatikan: picking belum melakukan occlusion terhadap tembok/dekorasi; dash masih memakai perilaku gerak/collision existing; CP belum mensimulasikan seluruh rotasi skill yang berbagi waktu action lock atau peluang kondisi stagger/counter. Hal ini dilaporkan, bukan diberi nilai kekuatan palsu. Detail ada di laporan teknis.

Tidak ada publish, destructive migration, perubahan balance monster/equipment, perubahan progression, atau skill V2 baru. Pekerjaan berhenti setelah Phase 2D.
