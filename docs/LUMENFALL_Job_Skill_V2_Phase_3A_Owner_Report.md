# REPORT A — Warrior V2 Owner Summary

Tanggal: 20 September 2026. Acuan: kontrak Phase 3A terlampir dan keputusan final Counter Window 2.500 ms.

## Hasil

**16 active + 14 passive Warrior V2 sudah dibuat dan terhubung ke runtime. Hanya untuk development/test. Tidak dipublish.**

1. **30 node:** nama, ID, level, rank, prasyarat, dan angka mengikuti kontrak Phase 3A. Warrior Strike Rank 1 diberikan gratis; rank berikutnya memakai SP.
2. **Akses:** hanya karakter `v2_test`, Core Job Warrior, minimal Lv15. Ada fungsi otorisasi development khusus. Trainer, pembuatan karakter, NPC, dan save pemain lama tidak diubah menjadi Warrior V2.
3. **Active yang berfungsi:** Warrior Strike, Iron Charge, Sweeping Slash, Guard Stance, Rising Slash, Armor Breaker, Battle Cry, Counter Slash, Ground Breaker, Battle Focus, Severing Arc, Relentless Assault, Unbroken Stance, Iron Reversal, Crushing Finale, Warrior Awakening. Pembayaran Mana, cooldown, rank, targeting, dan action lock memakai runtime yang sama dengan skill lain.
4. **Target:** skill single-target menyerang musuh yang diklik, bukan musuh terdekat. Self buff dan serangan area tetap dapat dipakai tanpa memilih target. Charge adalah satu-satunya gerakan mendekati target pada konten ini.
5. **Counter:** Counter Slash menerima Block/Parry; Iron Reversal hanya mendapat payoff Parry. Keduanya memakai **2,5 detik waktu simulasi**. Pause tidak mengurangi window. Preview, target tidak ada/terlalu jauh, senjata salah, dan Mana tidak cukup tidak menghabiskan kesempatan. Cast yang sudah sah menghabiskannya meskipun kemudian gagal mengenai target. Counter Training memakai kesempatan yang sama, bukan konsumsi kedua. Block yang tidak dipakai Iron Reversal tetap tersedia untuk Counter Slash selama belum kedaluwarsa. Parry dapat berasal dari skill Adventurer **Sikap Penjaga** yang diwarisi; Guard Stance Warrior bukan sumber Parry baru.
6. **Stagger/Armor Break:** stagger terpisah dari damage HP dan dorongan. Crit tidak memperbesar stagger. Armor Breaker memasang efek setelah damage pukulannya sendiri; efek existing membuat Defense target menjadi 80%. Crushing Finale R3 mendapat faktor 1,30 bila kedua syarat aktif, bukan 1,32.
7. **Momentum/jalur senjata:** Battle Momentum dan Twin Blade Rhythm bertambah maksimal satu stack per cast yang benar-benar menghasilkan damage, bukan per hit/target. Great Weapon Momentum membuka bonus heavy berikutnya setelah hit berhasil; cast pemakai bonus tidak membuka ulang bonusnya sendiri. Efek yang membutuhkan senjata tertentu gugur saat gaya senjata tidak lagi sesuai. Tidak ada Rage, Flow, atau tambahan basic attack off-hand.
8. **Awakening:** buff sementara pada skill Warrior V2 yang dieksekusi sesudahnya. Tidak memperkuat basic attack, Adventurer, atau hit yang sudah dijadwalkan. Rank 3 juga mengurangi biaya Mana skill Warrior berikutnya sesuai kontrak. Memerlukan 25 rank berbayar dalam tree Warrior, tanpa menghitung root gratis.
9. **Lv15–59:** persyaratan runtime mendukung rentang ini; semua 16 active diuji melalui jalur cast sebenarnya. Ini bukan klaim sudah menjalani seluruh perjalanan leveling secara manual. Total seluruh node 136 rank; dengan root gratis, 135 rank dibeli. Ekonomi +1 SP/level tidak berubah.
10. **UI:** panel K existing dapat menampilkan dan membeli 30 node, rank, prasyarat, Mana, cooldown, range, durasi, serta stagger. Hotbar memakai ID skill, tidak otomatis diisi 16 skill. Belum ada tampilan tree bercabang final, meter Momentum/Rhythm, atau indikator khusus kesempatan counter. J tetap tidak diubah.
11. **Verifikasi visual:** panel K terisolasi sudah diuji di browser: 30 node, pembelian rank, SP berkurang, prasyarat terbuka, Awakening terkunci, dan panel legacy terpisah. Tidak ada error/warning console dalam sesi itu. **Animasi/feel combat Warrior V2 pada world 3D penuh belum diuji manual di browser.** Pengujian combat menjalankan metode Game produksi dengan renderer diganti fixture pengujian.
12. **Risiko:** animasi/VFX masih memakai yang tersedia, bukan 16 animasi baru. Indomitable Will membutuhkan incoming stagger; monster existing yang memberikan nol stagger tidak memicunya. CP belum mengasumsikan frekuensi counter, buildup stack, atau uptime buff secara otomatis. Enam error TypeScript lama masih ada; tidak ditutup-tutupi sebagai hasil bersih.
13. **Balance:** tidak ada perubahan angka kontrak, equipment, monster, EXP, primary stats, bobot CP, atau Stamina. Counter memakai keputusan pemilik 2.500 ms; batas pengaman 5.000 ms tidak digunakan sebagai balance.
14. **Berikutnya:** playtest Warrior V2 di world browser melalui lingkungan development yang terkontrol, menilai rasa gerak, animasi, keterbacaan counter/stack, dan konsumsi Mana. Aktivasi live serta perubahan balance tetap memerlukan instruksi berikutnya.

## Bukti verifikasi

| Pemeriksaan | Hasil |
|---|---|
| Suite sebelum | 378 passed, 0 failed |
| Suite setelah | **420 passed, 0 failed** — 42 tes baru; tes lama tidak dihapus |
| Production build | Berhasil; warning ukuran chunk besar tetap ada |
| TypeScript sebelum → sesudah | **6 → 6**, masalah lama yang sama, 0 error baru |
| Browser | Panel K dan pembelian rank terverifikasi; tidak mengakses save pemain |
| Mana sanity R1 | 76 MP; dengan Battle Focus 90 MP |
| Damage sanity PA 200 | Strike 228; Sweep 228/target; Rising 272; Armor 284; Ground 244/target; Severing 338; Relentless 400 total; Reversal normal 232; Finale 476 |

General melee, control/stagger, guard/counter, great-weapon, dan dual-sword dapat direpresentasikan tanpa membuka specialization. Tidak ditemukan dominasi jalur akibat double scaling dalam tes. Penilaian keseimbangan praktis dan kenyamanan bermain tetap memerlukan playtest, bukan kesimpulan dari angka tes saja.

**Berserker, Blade Master, Advanced Job, Rage, Flow, dan skill mereka tidak dibuat. Tidak ada publish. Pekerjaan berhenti pada Phase 3A.**
