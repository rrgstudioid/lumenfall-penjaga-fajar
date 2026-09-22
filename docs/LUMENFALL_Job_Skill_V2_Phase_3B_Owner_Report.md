# LUMENFALL — Phase 3B: laporan pemilik game

Tanggal: 20 September 2026. **Tidak ada perubahan angka balance, konten skill baru, aktivasi Job V2 publik, atau publish.**

## Kesimpulan

Warrior V2 sudah bisa dimainkan melalui pintu masuk development yang memakai **world, karakter, musuh, collision, kamera, hotbar, dan panel K asli**. Dua bug ditemukan dan diperbaiki: pemasangan skill ke hotbar dan Charge yang bisa mengenai target melewati batang pada jarak dekat. Hasil akhir: **422 tes lulus, 0 gagal**, production build berhasil, dan **6 error TypeScript lama tetap 6**.

Warrior siap untuk **playtest development terbatas**, belum untuk menyimpulkan balance atau membuka pengujian luas tanpa pendamping. Kekurangan paling nyata adalah keterbacaan: banyak skill berbeda masih terlihat seperti serangan yang sama, dan pemain belum diberi indikator menetap untuk counter, Momentum, Rhythm, Armor Break, atau jendela Stagger Break.

## Cara mencoba dengan aman

Buka [Warrior development](http://127.0.0.1:3003/warrior-world.html?level=59&build=general), lalu **Continue**. Server development harus berjalan di PC ini.

- Panel kecil **DEV Warrior · MEMORY ONLY** di kiri atas menyediakan level 15/30/45/59 dan build general/counter/great/dual.
- K membuka skill; J tetap jurnal quest. Aktifkan Edit Mode hotbar untuk memasang skill.
- Klik musuh pertama memilih; klik musuh yang sama lagi menyerang. WASD tetap untuk bergerak.
- Pilihan `all` dengan SP 200 hanya alat diagnosis, **bukan build legal pemain**.
- Reload membuang karakter uji. Autosave dan pengaturan sesi diarahkan ke memori; save pemain asli tidak dibaca atau ditimpa.
- Tombol DEV refill, pindah dekat musuh, dan target HP 30.000 adalah bantuan uji yang diberi label, bukan fitur game publik.

## Batas pengujian

Map utama yang dimainkan: **Padang Arunika**, dengan 42 entitas musuh asli. Perpindahan ke Kota Arunika juga diuji untuk pembersihan target. Chrome/WebGL merender world asli; mouse, keyboard, hotbar, dan K benar-benar dioperasikan. Pemeriksaan akhir juga diulang di **Chrome berjendela/terlihat**, bukan hanya tes tanpa tampilan.

Ada dua jenis bukti yang tidak boleh dicampur:

1. Musuh Padang Arunika tanpa perubahan: pemilihan target, basic attack, movement, dan empat engagement Lv15.
2. Diagnosis terkontrol: musuh world yang sama dengan HP sementara 30.000, posisi yang diatur untuk pengulangan, atau incoming stagger yang disuntikkan ke jalur damage asli. Ini menguji mekanik, **bukan balance monster**. Registry monster tidak diubah.

Ini bukan studi pemain manusia, benchmark GPU, atau pengujian semua map/lawan selevel. Pendapat tentang rasa bermain berasal dari input, tampilan, dan urutan combat yang diamati.

## 1. Bagaimana Warrior terasa di world

Sudah memiliki beberapa pola bermain yang berbeda: serangan biasa, cleave, engage, armor-break/finisher, counter, dan rangkaian tiga hit. Tombol mengeluarkan aksi yang benar dan lock dapat dibedakan dari cooldown. Namun identitas banyak aksi belum tersampaikan lewat gerakan tubuh atau efek visual.

## 2. Skill yang paling berhasil pada tahap prototipe

- **Warrior Strike:** langsung dan mudah dipahami; pemilihan target menentukan siapa yang terkena.
- **Iron Charge:** mencapai target pada medan terbuka dan berhenti saat terhalang collision.
- **Relentless Assault:** benar-benar tiga damage event; hit terakhir paling kuat, bukan satu damage yang hanya diberi label multi-hit.
- **Armor Breaker → Crushing Finale:** kondisi payoff bekerja; cocok sebagai loop Warrior, tetapi perlu indikator kondisi target.

Penilaian ini tentang fungsi dan keterbacaan relatif, bukan peringkat damage.

## 3. Skill yang terasa canggung

Rising Slash, Ground Breaker, Severing Arc, dan Crushing Finale memakai gerakan serangan umum. Lock terasa nyata tetapi gerakan belum menunjukkan bobot yang setara. Finale menahan movement 0,85 detik sementara animasi umum tidak menjelaskan seluruh durasi itu. Relentless Assault menghasilkan tiga hit tetapi belum punya koreografi tiga-hit yang jelas. Counter Slash dan Iron Reversal belum cukup mudah dibedakan dari serangan biasa.

**MISSING ASSET / ANIMATION**, bukan alasan mengubah damage atau action-lock.

## 4. Aliran Mana

Kategori sementara: **comfortable** untuk skenario yang diuji, bukan terlalu restriktif.

Baseline low-INT yang tidak mengalokasikan stat memiliki 100 MP dan pemulihan existing **8 MP/detik**. Dalam satu rangkaian tanpa refill:

| Rangkaian | Total biaya | MP segera setelah cast terakhir | MP setelah lock terakhir lewat |
|---|---:|---:|---:|
| Cry → Armor → Rising → Ground → Finale | 76 | sekitar 42,72 | sekitar 50,18 |
| Focus + rangkaian di atas | 90 | sekitar 30,93 | sekitar 38,40 |

Pemulihan berlangsung selama aksi, sehingga 90 MP biaya bukan berarti selalu tersisa 10 MP. Empat engagement Lv15 melawan musuh asli HP46/78/110/142 berakhir tanpa menunggu Mana; jeda antar-engagement membuat MP kembali100. Musuh awal terlalu lemah untuk menilai konsumsi jangka panjang Warrior Lv45–59. **BALANCE QUESTION:** apakah pemulihan 8 MP/detik memang target V2? Tidak diubah di sini.

## 5. Counter window 2,5 detik

Tidak diubah. Manual block → Counter Slash bekerja. Block → Iron Reversal tetap cast normal dan tidak menghabiskan kesempatan block; Counter Slash berikutnya masih dapat memakainya.

Parry dari Sikap Penjaga pada jarak dekat berhasil melalui AI musuh tanpa memaksa waktu windup. Counter Slash menerima snapshot parry sekitar 0,52 detik kemudian. Dalam pengujian kontak terkontrol terpisah, Iron Reversal masih mendapat payoff pada usia event sekitar **2,18 detik**. Pause tidak menghabiskan waktu simulasi counter.

Pada beberapa percobaan di tepi jangkauan, knockback/stun Sikap Penjaga mengubah kontak musuh sehingga serangan baru mengenai pemain setelah parry berakhir. Mendekat memperbaiki hasil tanpa mengubah angka. Ini perlu panduan timing/jarak dan uji manusia lebih lanjut, bukan bukti bahwa window counter harus diperpanjang.

**PRESENTATION / UX:** tanda PARRY sesaat ada, tetapi kesempatan counter dan sisa waktunya tidak terlihat menetap. Block juga tidak cukup mudah dibedakan. Karena itu belum layak memutuskan 2,5 detik terlalu singkat/panjang.

## 6. Stagger dan loop Finale

Pada target endurance yang mempertahankan resistance dan threshold asli, Armor → Rising → Ground → Severing meninggalkan gauge sekitar99,91/100. Jika Finale dipakai saat itu, Finale sendiri menimbulkan break, tetapi tidak menerima bonus recent-break miliknya sendiri. Setelah tambahan Strike memicu break terlebih dahulu, Finale yang dicast sekitar0,38 detik kemudian mendapat konteks break dan Armor Break yang sudah aktif.

Break hanya menonaktifkan target sebentar; jendela payoff1,5 detik terpisah dari durasi CC0,35 detik. Secara input bisa digunakan, tetapi **tanpa indikator break pemain sulit mengetahuinya**. Tidak ada kesimpulan bahwa semua monster aman dari stun-lock: pengujian hanya satu profil endurance, bukan boss/elite seluruh map. Musuh awal sering mati sebelum loop selesai.

## 7. Kepadatan buff

| Buff | Fungsi yang terlihat dari runtime | Penilaian penggunaan / overlap |
|---|---|---|
| Guard Stance | Perlindungan sementara; 5–7 detik, CD14–12,5 | Situasional menghadapi serangan; overlap defensif dengan Unbroken, tidak otomatis wajib sebelum semua pertarungan. |
| Battle Cry | Physical Attack + Tenacity; 8–11 detik, CD24–22 | Alasan ofensif untuk pre-buff ada; manfaat durability berbeda dari Focus. Belum terbukti wajib pada musuh selevel. |
| Battle Focus | Accuracy + Critical; 8–10 detik, CD24–22 | Tujuan berbeda, tetapi rasa visual hampir sama dengan Cry. Runtime tidak memberi disruption resistance tambahan; laporan mengikuti Phase3A aktual. |
| Unbroken Stance | Incoming damage/stagger/knockback reduction; 6–8 detik, CD26–25 | Situasional, tetapi nilai anti-stagger tidak muncul pada serangan monster biasa yang saat ini tidak menghasilkan stagger. |
| Warrior Awakening | Penguatan aksi Warrior; 12–14 detik, CD50–46 | Cocok sebagai jendela burst, tetapi efek visual belum menunjukkan bahwa ini cooldown penting. |

Semua dapat dicast. Keuntungan numeriknya terverifikasi, tetapi ikon/durasi buff yang bisa dibaca pemain belum tersedia. Ada risiko kebiasaan menekan Cry+Focus sebelum setiap engagement; belum ada bukti bahwa kelima buff wajib dipakai bersama. Tidak ada perubahan buff pada fase ini.

## 8. Great Weapon path

Dengan greatsword katalog existing, Ground Breaker membuka window5detik dan Severing Arc berikutnya mengonsumsi bonus tanpa langsung membuka ulang window yang sama. Mechanic berfungsi. Tanpa indikator, pemain sulit tahu skill mana yang akan diperkuat. Belum bisa menyimpulkan apakah ini terasa seperti maintenance wajib dari sesi singkat ini. Tidak ada Rage.

## 9. Dual Sword path

Build menggunakan dua item one-hand sword asli. Relentless Assault menghasilkan tiga hit tetapi hanya satu stack Battle Momentum dan satu Twin Blade Rhythm. Basic attack tidak menambahnya, ganti target mempertahankan stack, dan inactivity menghapusnya.

Di Lv45, damage teramati pada satu target endurance: sekitar155/170/269; ini hasil build/target tersebut, bukan angka baru. Rasa multi-hit sudah berbeda secara mekanik, tetapi Rhythm hampir tidak dapat dirasakan sebagai sistem yang jelas tanpa indikator. Belum menyerupai Flow penuh, karena tidak ada resource bar atau basic attack dua tangan otomatis.

## 10. Awakening

Rank1/2/3 diuji pada karakter diagnosis. Semua membayar32MP; Relentless setelahnya membayar18/18/**17**MP, sesuai pembulatan biaya Rank3 existing. Bonus aksi sesuai rank terlihat pada resolved hits. Basic dan Tebasan Fajar menghasilkan damage per-hit yang sama dengan/tanpa Awakening dalam pembandingan RNG terkontrol; biaya Adventurer tetap15MP.

Snapshot sequence yang sudah berjalan juga dijaga tes existing. Pada combo saat ini, action lock mencegah cast Awakening menyela Relentless sebelum hit terakhir, sehingga skenario menyela sequence panjang bukan sesuatu yang bisa dipicu secara normal pada rangkaian ini.

Efek penguatan terasa terlalu tidak terlihat untuk sebuah major cooldown. Belum ada alasan untuk mengubah durasi/biaya sebelum presentasinya jelas.

## 11. Targeting

Klik pertama memilih saja; klik kedua menyerang; pindah pilihan tidak menyerang; tanah kosong menghapus pilihan. Target di luar range gagal tanpa mencari musuh lebih dekat. Self, circle AoE, dan arc tetap dapat digunakan tanpa target. Sequence tiga hit tetap mengenai target awal ketika pilihan berpindah.

Ring dan frame target ada. Dalam kamera follow, model pemain dapat menutupi musuh kecil/label; frame target juga bertumpuk dengan pesan petunjuk kamera. Target mati, spawn generation berubah, entity dihapus, pindah region, pemain mati, menu, dan dispose menghilangkan pilihan tanpa pengganti. Tidak ada camera lock-on.

## 12. Panel K

30 node terlihat:16 active +14 passive. Level/rank/prerequisite/SP aktual dipakai. Pada build59 general,23 paid ranks belum membuka Awakening. Membeli dua rank membuat25 paid ranks dan membukanya. Grant Warrior Strike tidak dihitung sebagai investasi berbayar.

Bug drag active ke hotbar sudah diperbaiki dan diuji ulang, termasuk di Chrome terlihat. Passive tetap tidak bisa dipasang. J tetap quest.

Reset melalui method game asli mengembalikan23SP (35→58) dengan biaya500Gold dan mempertahankan root grant Rank1. **Tidak ada tombol reset di K saat ini**; reset diuji melalui jalur runtime, bukan mengklaim UI tombol yang tidak ada. Beberapa binding lama tetap terlihat tetapi skill yang di-reset tidak menjadi usable secara ilegal.

Teks lama “Empat skill aktif” dan “J untuk tutup” belum sesuai K V2. Ini dicatat sebagai UX, tidak didesain ulang.

## 13. Animasi dan VFX

Audit per16 active tersedia dalam laporan teknis. Prioritas aset: cleave berbentuk arc, tiga-hit Relentless, ground impact, heavy finisher, dan pembeda counter/parry/buff. Jangan memperbaiki kekurangan animasi dengan menaikkan damage.

## 14. Bug yang diperbaiki

**BUG — drag skill K ke hotbar tertutup lapisan dialog.** Window memakai z-index1000+, sedangkan hotbar binding masih61. Pointer drop mengenai dialog, bukan slot. Lapisan binding kini mengikuti lapisan window aktif; alert confirmation tetap dihormati. Tes browser asli membuktikan slot menerima skill; satu tes regresi domain ditambahkan. Tidak ada formula combat yang disentuh.

**BUG — Charge menembus penghalang pada celah impact.** Pada jarak2meter dengan batang pohon di antara pemain dan target, pemeriksaan lama menerima damage karena jaraknya cukup dekat. Kini pemeriksaan celah akhir memakai collision tanah/batang yang sama dengan movement, tanpa menggerakkan pemain. Uji ulang di Chrome terlihat: target di balik batang tidak menerima damage, tetapi8MP dan cooldown tetap terpakai setelah cast sah; target dekat tanpa penghalang dan empat jalur menanjak bebas penghalang tetap terkena. Satu tes regresi runtime ditambahkan. Ini koreksi validitas hit, bukan perubahan angka skill, pathfinding baru, atau perubahan collision map.

## 15. Keputusan balance yang masih membutuhkan pemilik

- Validasi Mana terhadap musuh selevel sebelum menilai regen8MP/detik terlalu murah.
- Setelah indikator tersedia, putuskan apakah Cry+Focus terasa wajib dan apakah overlap Guard/Unbroken diinginkan.
- Lakukan uji manusia untuk counter2,5detik dan Finale1,5detik **setelah** kesempatan tersebut terlihat jelas.
- Tentukan profil incoming stagger untuk skenario uji berikutnya; monster normal saat ini tidak menguji Indomitable secara alami.

Tidak ada permintaan untuk mengganti angka otomatis. Semua angka tetap.

## 16. Status kesiapan

| Area | Hasil |
|---|---|
| Targeting | NEEDS TUNING — fungsi baik, overlap/occlusion visual |
| Movement | GOOD — WASD, lock opsional dan collision kasus teruji bekerja |
| Basic combat | NEEDS TUNING — ritme berfungsi, lock/animasi belum selaras |
| Mana flow | GOOD untuk sampel ini — belum validasi sustained combat selevel |
| Stagger | NEEDS TUNING — mekanik bekerja, gauge/break tidak terbaca |
| Counter | NEEDS TUNING — event/window bekerja, feedback dan jarak parry perlu perhatian |
| Buff density | NEEDS TUNING — belum jelas buff aktif dan prioritas situasional |
| Great Weapon path | NEEDS TUNING — window bonus tidak terlihat |
| Dual Sword path | NEEDS TUNING — Rhythm tidak terlihat, animasi multi-hit placeholder |
| Awakening | NEEDS TUNING — efek major cooldown tidak menonjol |
| K panel | NEEDS TUNING — drag diperbaiki, teks/reset UX masih terbatas |
| Animation readability | NEEDS TUNING — aset khusus belum tersedia |

Bug drag adalah **BLOCKING ISSUE sebelum diperbaiki**, tidak lagi blocking setelah retest. Tidak ditemukan blocker crash pada sesi final. “NEEDS TUNING” adalah diagnosis, bukan izin rebalance.

## 17. Sebelum Berserker / Blade Master

Utamakan indikator counter/buff/stack/status, koreksi teks K, dan animasi penting; kemudian uji Warrior lawan monster selevel dengan beberapa pemain. Gunakan harness ini untuk mengambil bukti sebelum memutuskan angka. **Tidak ada Berserker, Blade Master, Rage, atau Flow yang diimplementasikan. Pekerjaan berhenti pada Phase3B.**
