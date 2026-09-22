# LUMENFALL — Global Hard Targeting: Laporan Pemilik

> Laporan historis rollout awal. Enam keputusan yang dahulu ditunda kini selesai; lihat [laporan final](LUMENFALL_Global_Hard_Targeting_Final_Report.md).

20 September 2026. Perubahan lokal saja, belum dipublish.

## Hasil

Basic attack kini wajib menggunakan musuh yang dipilih untuk karakter normal/legacy maupun V2. Sebelumnya aturan ini hanya aktif untuk karakter v2_test; syarat tersebut sekarang dilepas, tanpa mengubah job karakter.

- Klik pertama pada musuh: memilih, tidak menyerang.
- Klik kedua pada musuh yang sama: menyerang target itu.
- Klik musuh lain: pindah pilihan, tidak langsung menyerang.
- Klik tanah kosong: menghapus pilihan.
- Tanpa target: basic attack tidak menyerang siapa pun.
- Target terlalu jauh: aksi gagal, target tetap dipilih; tidak berjalan otomatis atau mencari musuh terdekat.
- Target mati/hilang atau pemain berpindah world/menu: pilihan dibersihkan tanpa mengganti target otomatis.

Skill satu musuh yang sudah jelas, termasuk dash, menggunakan target pilihan. Gagal karena tidak ada target atau terlalu jauh tidak menghabiskan Mana/cooldown. Self-buff, heal diri, AoE sekitar, dan frontal arc tetap dapat digunakan tanpa target. Frontal arc mengikuti arah karakter atau menghadap sekali ke target pilihan. Kamera tidak dikunci.

Ring dan panel nama/level/HP target kini bekerja untuk karakter publik/legacy. Klik panel tidak menyerang musuh di belakangnya. Kombo beberapa hit tetap mengenai target saat cast dimulai, bukan target baru yang dipilih di tengah kombo.

## Enam skill yang kamu tunda

Sesuai jawabanmu, skill berikut BELUM diputuskan ulang bentuk targetnya dan tetap menggunakan perilaku lama:

- Hantaman Langit — gatotkaca-3.
- Kebangkitan Rogue — rogue-awakening.
- Tarian Caroq — caroq-4.
- Kidung Kehancuran — pujangga-4.
- Doa Keselamatan — pandita-4.
- Telapak Penolak — bajra-3.

Ini pengecualian nyata: komponen lama yang mencari musuh terdekat pada keenam skill tersebut masih dipertahankan. Saya tidak menonaktifkan atau menebak desainnya. Jadi jangan menyebut rollout ini sudah 100% tanpa auto-nearest. Audit lengkap mencakup80 skill:74 jelas diterapkan,6 ditunda.

## Save, job, balance dan CP

Save, job, level, skill ownership, SP, equipment, monster dan progression tidak dimigrasikan. Target tidak disimpan permanen. Warrior V2 tetap tidak aktif untuk pemain publik. Tidak ada skill baru, Rage, Flow atau resource baru.

Tidak ada angka damage/coefficient/Mana/cooldown/rank yang diubah. Ada konsekuensi perbaikan penerima target: skill self-only yang sebelumnya secara tidak sengaja juga menghantam musuh terdekat sekarang hanya bekerja pada diri sendiri. CP membaca aturan self yang sama agar tidak menghitung damage musuh yang sudah tidak terjadi; bobot/formula CP tidak di-rebalance. Keenam skill yang ditunda tidak terkena perubahan semantik ini.

## Bukti pengujian

- Sebelum:422 test lulus. Sesudah:456 test lulus,0 gagal; seluruh test lama tetap ada.
- Uji browser Chrome di map asli Padang Arunika dengan karakter legacy sementara berhasil: klik pertama tidak melukai, klik kedua melukai A saja meski B lebih dekat, pindah pilihan tidak menyerang, klik tanah membersihkan, target jauh gagal tanpa biaya, target mati menghilangkan panel.
- Pengujian memakai save dalam memori, bukan save pemain. Tidak ditemukan page error.
- Production build berhasil.
- TypeScript source utama:6 error lama sebelum dan sesudah,0 baru. Scan seluruh folder juga membaca salinan output publish/tool dan menghasilkan error tambahan; itu dipisahkan dari pemeriksaan source utama, bukan diklaim bersih.

## Aman dipublish?

Bagian yang sudah diterapkan lulus pengujian dan build, tetapi saya menyarankan menyelesaikan keputusan enam skill tersebut sebelum menerbitkan sebagai rollout hard-target global lengkap. Jika nanti kamu memilih publish dengan pengecualian itu, batasannya harus tetap diketahui. Pada task ini tidak ada publish.

Laporan teknis, seluruh klasifikasi80 skill, file yang berubah, hasil test dan batasan berada di LUMENFALL_Global_Hard_Targeting_Technical_Report.md. Task berhenti di sini; tidak melanjutkan konten Job V2.
