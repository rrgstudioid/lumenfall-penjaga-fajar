# Phase 2C — No-Stamina V2: Ringkasan Pemilik Game

19 September 2026. Implementasi lokal saja; tidak dipublish.

## 1. Di mana Stamina sebelumnya dipakai?

Audit menemukan Stamina **sudah dinonaktifkan secara global** sebelum task ini. Data/formula lama masih ada: kapasitas Stamina dari VIT, regenerasi, pemulihan melalui healer/makanan, dan bar resource, tetapi jalur penggunaan tersebut dibatasi konfigurasi off. Skill, lari, manual guard, dan perhitungan Combat Power tidak memerlukan Stamina.

Tidak ditemukan tombol dodge aktif. Runtime memiliki **automatic evasion** saat menerima serangan, bukan dodge dengan tombol/cooldown. Phase ini tidak membuat dodge baru.

## 2. Apa yang dinonaktifkan untuk V2?

Kebijakan resource sekarang membaca arsitektur karakter. Untuk `v2_test`, Stamina selalu inactive—even jika sakelar legacy suatu hari dihidupkan. Kapasitas Stamina internal dinetralkan menjadi0; VIT/item tidak menghasilkan manfaat melalui resource tersebut. Bar, label resource karakter, pemulihan, dan regenerasi Stamina mengikuti kebijakan ini. HP dan Mana tetap aktif.

## 3. Apakah legacy player berubah?

Tidak ada perubahan gameplay legacy yang disengaja. Konfigurasi legacy tetap Stamina off, seperti sebelumnya. Formula kapasitas lama, data save, item, dan kode kompatibilitas tidak dihapus. Progression tetap seperti Phase2B; tidak ada Job V2 yang diaktifkan.

## 4. Apakah ada item yang menjadi kurang berguna?

Tidak ditemukan equipment, affix pool, rune pool, Unique Stats, atau passive terdaftar yang memberi Stamina. Satu item terkait adalah **Blessed Rice Meal (`rice-meal`)**: consumable pemulih Stamina. Item itu sudah tidak berfungsi sebelum perubahan ini; tetap disimpan, dan penggunaan tidak menghabiskan quantity maupun memasang cooldown. Tidak diubah menjadi HP/Mana atau dijual ulang dengan balance baru.

Jika save impor memiliki bonus Stamina lama, datanya tetap diterima, tetapi tidak menambah kekuatan V2. `STA` adalah alias lama untuk **Vitality**, bukan Stamina; bonus tersebut tidak dihapus.

## 5. Apakah dodge/guard tetap bekerja?

Manual guard dan automatic evasion telah diuji pada Stamina0 untuk legacy maupun V2. Movement dan dash skill juga berjalan pada Stamina0. **Tidak ada klaim bahwa active dodge sudah tersedia**; mechanic itu memang tidak ditemukan dan tidak dibuat pada task ini.

## 6. Apakah VIT masih berguna?

Ya. VIT tetap meningkatkan HP, physical defense, dan Tenacity/Stagger Resistance sesuai rumus sebelumnya. Tidak ada bonus kompensasi. Hanya manfaat kapasitas Stamina yang dihilangkan untuk V2.

## 7. Apakah save aman?

Field `Hero.stamina` tetap dibaca/disimpan. Save dengan field tambahan terkait stamina diterima tanpa crash; field alias yang sebelumnya tidak dikenal tetap diabaikan parser existing. Tidak ada wipe atau penulisan massal save pemain. Tes save menggunakan data fixture, bukan mengubah save pribadi pengguna.

## 8. Apakah Combat Power aman?

Ya dalam pengujian ini: mengubah current Stamina, kapasitas Stamina, dan bonus Stamina tidak mengubah CP V2. Audit memang menemukan formula CP tidak memakai Stamina, sehingga tidak dibangun formula CP pengganti.

## 9. Risiko yang tersisa

UI/metadata item masih menyimpan penjelasan bahwa makanan Stamina inactive, dan inspector item dapat mempertahankan data bonus lama. Itu informasi kompatibilitas, bukan resource aktif. Bila legacy diaktifkan lagi suatu hari, teks katalog yang bersifat global perlu ditinjau agar sesuai karakter; jangan melewati helper resource untuk gameplay/UI karakter baru.

Masih ada6 error TypeScript existing yang sama. Belum dilakukan playtest visual browser; verifikasi mencakup unit tests, metode runtime game asli tanpa renderer, DOM label fixture, dan production build.

## 10. Apakah sudah aman mulai balance Warrior V2?

Fondasi no-Stamina sudah siap untuk balance berbasis **HP, MP, cooldown, counter, dan stagger/poise**. Jika desain berikutnya mengharuskan active dodge, hal tersebut perlu task/desain terpisah karena belum ada. Tidak ada alasan teknis untuk menambahkan cost Stamina ke Warrior V2.

Hasil akhir: **357 tes lulus,0 gagal; production build berhasil; TypeScript6 sebelum dan6 sesudah, tanpa error baru.** Sepuluh tes ditambahkan, tidak ada tes legacy dihapus. Pekerjaan berhenti di Phase2C; tidak membuat Warrior Draft3, Rage, Flow, atau konten job baru.
