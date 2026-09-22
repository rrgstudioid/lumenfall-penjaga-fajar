# LUMENFALL — SPV3-7A.1 Twin Blade Mastery Mana Audit

Status: **TERVALIDASI — koreksi dokumentasi saja untuk perilaku production**

## Akar masalah

Deret enam angka `0/0/2/4/6/8%` pada laporan SPV3-7A ikut menampilkan nilai rank 0 di array runtime. Pada `resolveHeroSkill()`, tabel `[0, 0, 2, 4, 6, 8][rank]` diakses menggunakan rank Twin Blade Mastery yang dibeli. Rank 0 berarti belum dipelajari; hanya rank 1–5 yang dapat dibeli. Definisi skill menetapkan `maxRank: 5` dan lima syarat level rank. Tidak ada rank gameplay keenam maupun kesalahan indeks di runtime.

## Nilai aktual R1–R5

| Rank Mastery | Pengurangan sebelum | Pengurangan sesudah | Biaya Twin Assault 100 MP khusus tes | Biaya Twin Assault R8 asli (dasar 17 MP) |
| --- | ---: | ---: | ---: | ---: |
| R1 | 0% | 0% | 100 MP | 17 MP |
| R2 | 2% | 2% | 98 MP | 17 MP |
| R3 | 4% | 4% | 96 MP | 17 MP |
| R4 | 6% | 6% | 94 MP | 16 MP |
| R5 | 8% | 8% | 92 MP | 16 MP |

Diagnostik memakai definisi Twin Assault, aturan equipment Dual Wield, dan jalur `resolveHeroSkill()` yang nyata; hanya biaya Mana di dalam tes yang diubah menjadi 100 MP agar setiap persentase terlihat setelah pembulatan. Nilai R8 pada kolom terakhir memakai definisi production tanpa perubahan. `resolveSkillAction()` membulatkan biaya Mana ke atas ke MP bulat, sehingga beberapa persentase dapat menghasilkan biaya yang sama pada dasar 17 MP.

Tes menetapkan sumber `manaCostReduction` lain ke 0 agar kontribusi Mastery terisolasi. Pada karakter biasa, pengurangan dari INT/equipment/Rune bisa lebih besar; resolver saat ini memakai nilai terbesar antara pengurangan yang sudah ada dan pengurangan Mastery. Audit ini tidak mengubah kebijakan tersebut.

## Perubahan

- Memperbaiki deret enam angka pada `docs/LUMENFALL_SPV3-7A_Blade_Master_Core_Report.md` menjadi label R1–R5 yang jelas dan menjelaskan rank 0.
- Menambahkan tes deterministik lima rank pada `lib/game/blade-master-v3.test.ts`, termasuk verifikasi pembelian rank keenam ditolak.
- **Kode production, data skill, balance Mana, dan skill Blade Master lain tidak berubah.** Nilai runtime sebelum dan sesudah tetap sama.

## Regresi

- Tes terarah Blade Master: **5 lulus / 0 gagal**.
- Tes terarah Blade Master + Dual Wield: **10 lulus / 0 gagal**.
- Seluruh `lib/game`: **423 lulus / 0 gagal**.
- Build production `vinext build` (Vite 8.0.13): **PASS**. Peringatan lama tentang ukuran chunk dan klasifikasi route tetap ada, tetapi tidak menggagalkan build.

SPV3-7A.1 berhenti di sini. SPV3-7B belum dimulai.
