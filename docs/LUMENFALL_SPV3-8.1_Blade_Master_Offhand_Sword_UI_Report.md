# LUMENFALL SPV3-8.1 — Blade Master Live Offhand Sword UI Integration

Status akhir: implementasi kode dan regresi PASS; validasi headed Character Overview diselesaikan dalam SPV3-8.1A melalui fixture development terpisah.

## 1. Ringkasan

Masalah utama berada pada daftar kandidat equipment di Character Screen. UI sebelumnya memakai filter literal berdasarkan `item.equipSlot`, sehingga tidak menggunakan aturan equipment canonical yang sudah mendukung Dual Wield. Akibatnya Sword B tidak dapat diperlakukan sebagai kandidat Off Hand yang legal walaupun resolver equipment dapat menerimanya.

Perbaikannya adalah menjadikan resolver equipment yang sama sebagai sumber kebenaran UI. Tidak ada perubahan pada damage, Mana, Flow, Tempo, Accuracy/Evasion, Stun, Armor Break, SP, drop table, inventory starter produksi, Rune, atau enhancement.

## 2. Perubahan file

- `lib/game/character-view.ts`
  - Menambahkan `getEquipmentCandidatesForSlot(hero, slot)`.
  - Kandidat divalidasi melalui `previewEquipmentChange`, sehingga UI memakai jalur `equipItem`/aturan equipment yang sama dengan gameplay.
  - Semua item yang sedang terpasang dikeluarkan berdasarkan instance ID, bukan hanya flag tampilan.
- `components/game/character-screen.tsx`
  - Menghapus filter kandidat equipment yang terpisah.
  - Off Hand, shield, ring, earring, dan slot lain sekarang memakai helper canonical.
- `lib/game/rules.ts`
  - Development fixture `blade-master-60` mendapat satu instance Sword B tambahan dengan ID berbeda.
  - Starter inventory produksi tidak berubah.
- `lib/game/weapon-style.ts`
  - Menambahkan label presentasi `Dual One-Hand Swords` untuk nilai internal `dual_sword`.
  - Nilai runtime tetap `dual_sword`.
- `components/game/job-skill.tsx`
  - Menampilkan label player-facing pada requirement senjata.
- `lib/game/blade-master-offhand-ui.test.ts`
  - Menambahkan test deterministik untuk kandidat, konflik, save/reload, capability, dan label.

## 3. Aturan kandidat Off Hand

Sword B hanya muncul apabila seluruh syarat canonical terpenuhi:

- specialization adalah Blade Master;
- Twin Blade Mastery minimal R1;
- main hand adalah One-Hand Sword;
- kandidat adalah instance One-Hand Sword yang berbeda ID;
- tidak sedang terpasang di slot lain;
- tidak konflik dengan Two-Hand Sword, shield, job, level, atau aturan equipment lain.

Karena validasi dipanggil terhadap salinan hero melalui `previewEquipmentChange`, membuka daftar kandidat tidak mengubah equipment atau inventory.

## 4. Hasil skenario equipment

| Skenario | Hasil |
|---|---|
| Blade Master + Mastery R1 + main 1H + Sword B | Sword B tampil sebagai kandidat Off Hand |
| Main Hand instance yang sama | Tidak tampil sebagai kandidat kedua |
| Shield pada Off Hand | Tetap legal sebagai konfigurasi normal |
| Blade Master tanpa Mastery | Sword B tidak tampil |
| Warrior/Berserker | Sword B tidak bocor ke kandidat Off Hand |
| Main Hand Two-Hand Sword | Sword B tidak tampil |
| Sword B dipasang | resolver menghasilkan `dual_sword` |
| Belajar Twin Assault otomatis | Tidak terjadi |
| Capability hilang setelah reload/reconcile | Off Hand dilepas aman, instance item tetap berada di inventory |

## 5. Instance item dan data item

Normal One-Hand Sword tetap menggunakan template normal dan tidak dibuat template `dual_sword` atau `offhand_sword` baru. Fixture hanya menambahkan instance kedua dari template One-Hand Sword yang sama dengan ID unik.

Instance Sword B tetap terpisah saat disimpan dan dimuat kembali. Test mempertahankan enhancement level dan bonus stat instance tersebut. Saat Mastery hilang, item tidak dihapus dan tidak ditimpa; hanya equipment Off Hand yang dikosongkan secara aman.

## 6. Label skill

Nilai internal:

```text
dual_sword
```

Label UI:

```text
Dual One-Hand Swords
```

Tidak ada rename pada enum atau data runtime.

## 7. Test deterministik

Test baru dan test terkait yang dijalankan:

```text
Blade Master offhand UI + Dual Wield + Blade Master 7A/7B + Character Screen
34 passed / 0 failed
```

Verifikasi mencakup kandidat Sword B, eksklusi main instance, requirement Mastery, Warrior/Berserker isolation, Two-Hand conflict, `dual_sword` resolution, save/reload, mastery-loss safety, dan label presentasi.

Full suite `lib/game`:

```text
451 passed / 0 failed
```

Production build `pnpm run build:vercel`:

```text
PASS — seluruh 5 tahap build selesai.
```

Build hanya menghasilkan warning existing terkait ineffective dynamic import pada vinext layout shim dan ukuran chunk. Tidak ada error build baru.

## 8. Browser/runtime evidence pada saat laporan awal

Server development berhasil dijalankan pada port lokal terpisah dan route utama merespons HTTP 200. Namun validasi headed end-to-end pada Character Overview belum dapat menghasilkan bukti final:

- UI awal termuat, tetapi hydration/entry browser tidak stabil pada percobaan clean tab dan kontrol tetap berada pada keadaan loading/disabled.
- Jalur production UI yang tersedia tidak mengekspose `createV3JobDevelopmentHero('blade-master-60')`; helper tersebut secara eksplisit bersifat development/test-only dan tidak terhubung ke menu production.
- Save lokal yang sudah ada tidak dihapus atau ditimpa untuk memaksa fixture baru.

Dengan demikian, bukti runtime yang sudah valid berasal dari resolver dan clean deterministic tests, bukan screenshot Character Overview setelah klik Sword B. Status headed evidence: **BLOCKED**, bukan diklaim PASS.

## 9. Batasan dan keamanan scope

Tidak ada perubahan pada:

- combat resolver atau angka damage;
- Mana, cooldown, Flow, Tempo, Stun, Armor Break, Accuracy/Evasion;
- Warrior, Berserker, Dual Wield combat foundation;
- inventory starter production atau drop table;
- Rune, enhancement, save schema selain memastikan instance tetap aman;
- map, world, Flaris, terrain, atau asset runtime.

## 10. Kesimpulan

Integrasi UI Off Hand sudah benar secara arsitektur dan seluruh regresi kode hijau. Sword B sekarang dipilih melalui aturan equipment canonical, tetap menjadi instance nyata yang terpisah, dan tidak muncul pada karakter non-Blade-Master atau konfigurasi ilegal.

Untuk menandai SPV3-8.1 sebagai runtime-validated sepenuhnya, masih diperlukan satu jalur headed fixture yang aman dan dapat membuka Blade Master development character pada Character Overview tanpa menghapus save lokal produksi.

Pembaruan SPV3-8.1A: jalur fixture tersebut sudah dibuat dan keenam bukti browser lulus. Lihat [laporan validasi headed SPV3-8.1A](LUMENFALL_SPV3-8.1A_Headed_DualWield_UI_Validation_Report.md). Status akhir SPV3-8.1 sekarang **LIVE UI RUNTIME VALIDATED**.
