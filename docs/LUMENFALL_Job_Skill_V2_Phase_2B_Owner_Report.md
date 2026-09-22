# LUMENFALL — Phase 2B: Ringkasan untuk pemilik game

Tanggal: 19 September 2026. Status: fondasi diimplementasikan dan diuji secara lokal; tidak dipublish.

## 1. Apa yang berubah

Fondasi sekarang membedakan progression legacy dan development V2, mencatat rank skill yang dibeli versus diberikan gratis, serta mendukung buff sementara, bonus berdasarkan tag/senjata, counter, kondisi target, dan stack sementara. Semua tetap terhubung ke perhitungan stat dan aksi combat yang sudah ada.

## 2. Apa yang belum berubah

Belum ada skill/passive Warrior V2 baru. Berserker, Blade Master, dan Advanced Job belum diaktifkan. Tidak ada Rage, Flow, UI baru, perubahan equipment/monster, atau kurva EXP baru. Perhitungan Skill Power dan stagger hasil Phase 1B tetap dipertahankan.

## 3. Dampak terhadap pemain legacy

Level maksimum tetap 50; aturan job legacy tetap Lv10/Lv25. Save tidak dihapus, karakter tidak dipindahkan ke V2, dan sistem reset tetap membutuhkan 500 GOLD. Perubahan yang memang terlihat adalah perbaikan pengembalian SP: Rank 1 yang dibeli tidak lagi keliru dianggap gratis.

## 4. Apakah Lv80 sudah live?

Tidak. Lv80 hanya kemampuan development/test dengan penanda eksplisit `v2_test`. Jalur pembuatan karakter biasa tetap legacy. Batas teknis 100 hanya disediakan sebagai konfigurasi; Lv81–100 belum menjadi konten playable. Pengujian mencapai Lv80 melalui formula EXP existing, bukan kurva production baru yang dianggap sudah seimbang.

## 5. Apakah Warrior V2 sudah playable?

Belum. Metadata syarat Core Lv15 dan Specialization Lv60 tersedia, tetapi NPC dan pilihan job tidak dibuka. Factory karakter uji tidak memasang tree Warrior V2.

## 6. Apakah paid/granted SP sudah benar?

Ya untuk sumber rank yang tercatat: beli Rank 1 mengembalikan 1 SP saat reset; 1 rank gratis + 2 rank dibeli mengembalikan 2 SP; rank gratis sendiri tidak menghasilkan refund. Syarat investasi tree menghitung rank berbayar saat ini, bukan total belanja seumur karakter.

Save lama tidak selalu memiliki bukti apakah suatu rank gratis atau dibeli. Fallback menganggap asal yang tidak diketahui sebagai refundable dan menandainya sebagai tidak pasti, agar pemain tidak kehilangan SP yang pernah dibayar. Konsekuensinya, sebagian pemain lama mungkin mendapat pengembalian ekstra satu kali dari rank yang dahulu sebenarnya gratis. Ini bukan rekonstruksi riwayat yang pasti. Setelah reset normal, rank tersebut tidak dapat direfund berulang tanpa pembelian baru.

## 7. Apakah runtime buff/passive sudah siap?

Fondasi yang diminta sudah berfungsi dalam tes memakai definisi uji, bukan konten pemain:

- Buff benar-benar mengubah stat lalu hilang saat durasi habis.
- Bonus heavy bisa menaikkan stagger tanpa menaikkan knockback.
- Satu kesempatan block/parry memperkuat satu cast counter valid; preview tidak menghabiskannya.
- Multi-hit dan AoE hanya menghasilkan maksimal satu stack per cast yang benar-benar memberikan damage; basic attack tidak menghasilkan stack.
- Bonus baru tidak mengubah hit yang sudah mengambil snapshot pada cast sebelumnya.
- Bonus khusus dual sword berhenti berlaku saat kombinasi senjatanya tidak sesuai.

## 8. Keputusan desain yang masih dibutuhkan

Angka setiap rank, durasi buff/window, nilai bonus, dan threshold low-HP tetap menunggu desain konten. Kurva serta tempo progression Lv51–80 perlu disetujui sebelum aktivasi live. Keputusan terbaru sudah dicatat: Relentless Assault membutuhkan Battle Focus Rank 2 + Combat Instinct Rank 2; Awakening Lv59 membutuhkan 25 rank Warrior berbayar, bukan cabang Severing Arc.

## 9. Risiko terbesar dan hasil verifikasi

Risiko utama adalah ambiguitas asal rank save lama, serta menganggap hasil development Lv80 sebagai balance live yang sudah final. Combat Power tidak mengarang nilai uptime counter, stack, stagger, atau anti-chain yang belum bisa dievaluasi dengan andal.

Hasil akhir: **347 tes lulus, 0 gagal; production build berhasil.** TypeScript tetap memiliki **6 error existing, tanpa tambahan**. Pengujian runtime memakai metode world/game asli dengan fixture tanpa renderer; sesi bermain visual di browser tidak diuji pada task ini.

## 10. Langkah berikutnya

Fondasi siap menerima definisi dan balance Warrior V2 pada task berikutnya. Aktivasi progression/job dan penyesuaian UI harus tetap dilakukan secara eksplisit, bukan otomatis karena fondasi ini tersedia. Pekerjaan berhenti di Phase 2B; tidak ada konten Warrior V2 yang diregistrasikan dan tidak ada deploy.
