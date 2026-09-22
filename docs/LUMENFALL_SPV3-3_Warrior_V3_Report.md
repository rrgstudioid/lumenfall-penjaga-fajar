# LUMENFALL — SPV3-3 Warrior V3 Core Migration Report

Status: **IMPLEMENTED / DEVELOPMENT V3 ONLY**  
Tanggal: 2026-09-22

## Ringkasan

Warrior V3 sekarang tersedia pada jalur Skill Progression V3 sebagai Core Job Lv15–59. Migrasi memakai 11 skill canonical yang ditentukan owner, tetap terpisah dari Warrior V2, dan tidak mengaktifkan Stun, Berserker, Blade Master, Dual Wield, PvP runtime, atau perubahan balance monster.

## 1. Integrasi Job Change

- Adventurer V3 Lv15+ dapat berpindah ke Warrior melalui `chooseV3Warrior`.
- SP skill Adventurer yang sudah dibayar dikembalikan melalui state V3.
- `totalEarnedSP` tidak berubah.
- Warrior skill tidak dibeli otomatis.
- Skill Adventurer tetap menjadi ancestry dan dapat dibeli kembali.
- `chosenCoreJob = warrior`, `skillArchitectureVersion = 3`, dan lineage tersimpan.
- Hotbar aktif dibersihkan agar pemain mengisi ulang skill secara manual.
- Jalur V2 dan save Warrior V2 tidak dimigrasikan otomatis.

## 2. Exact Warrior V3 Skill Set

1. Warrior Strike — R10
2. Iron Charge — R5
3. Sweeping Slash — R8
4. Guard Stance — R5
5. Armor Breaker — R5
6. Battle Cry — R5
7. Counter Slash — R5
8. Battle Focus — R5
9. Ground Breaker — R5
10. Unbroken Stance — R5
11. Crushing Finale — R3

Total: **61 paid ranks × 2 SP = 122 SP** secara teoritis. Kurva SP belum difinalisasi.

Rising Slash, passive Warrior V2, dan skill V2 lain tidak muncul pada tree Warrior V3.

## 3. Gate dan Prerequisite

| Skill | Rank-level requirement | Prerequisite |
|---|---:|---|
| Warrior Strike | 15,18,21,24,28,32,36,41,47,55 | none |
| Iron Charge | 17,26,35,44,53 | none |
| Sweeping Slash | 20,24,29,34,40,46,51,56 | Warrior Strike R2 |
| Guard Stance | 22,30,38,46,54 | none |
| Armor Breaker | 25,33,41,48,55 | Warrior Strike R3 |
| Battle Cry | 28,35,42,49,56 | none |
| Counter Slash | 31,37,44,50,57 | Guard Stance R2 |
| Battle Focus | 34,40,46,52,58 | none |
| Ground Breaker | 38,43,48,53,58 | Sweeping Slash R4 |
| Unbroken Stance | 43,47,51,55,59 | Guard Stance R3 |
| Crushing Finale | 52,56,59 | Armor Breaker R3 |

Semua pembelian memakai resolver SPV3: level, SP, rank maksimum, ancestry, dan prerequisite tetap diperiksa setelah job change.

## 4. Damage dan Stat Scaling

Semua skill damage Warrior V3 memakai:

`CFV3 Physical Attack × physical coefficient + explicit V3 stat scaling`

Scaling STR/DEX sekarang dibawa ke runtime resolver dan diterapkan satu kali pada hit. Tidak ada global STR ×2 dan tidak ada hidden V2 rank multiplier. `Counter Slash` memiliki STR + DEX eksplisit; skill lain mengikuti profil V3 yang ditentukan.

Physical stat dan raw weapon ATK tetap berasal dari CFV3. Unarmed tidak mendapat weapon-dependent Warrior damage karena semua skill ofensif mewajibkan sword.

## 5. Mana dan Cooldown

| Skill | Mana R1 → rank akhir | Cooldown R1 → rank akhir |
|---|---:|---:|
| Warrior Strike | 5 → 10 | 3.2 → 2.8 s |
| Iron Charge | 8 → 12 | 8.0 → 6.5 s |
| Sweeping Slash | 8 → 15 | 6.0 → 5.0 s |
| Guard Stance | 10 → 14 | 18.0 → 16.0 s |
| Armor Breaker | 11 → 15 | 10.0 → 8.5 s |
| Battle Cry | 14 → 18 | 35 s |
| Counter Slash | 9 → 13 | 6.5 → 5.5 s |
| Battle Focus | 14 → 18 | 35 s |
| Ground Breaker | 15 → 19 | 11.0 → 9.5 s |
| Unbroken Stance | 16 → 24 | 28.0 → 26.0 s |
| Crushing Finale | 20 → 24 | 14.0 → 12.0 s |

Tidak ada FP yang ditambahkan.

## 6. Weapon Compatibility

- Semua skill damage Warrior V3 menerima `ONE_HAND_SWORD` dan `TWO_HAND_SWORD` dengan toolkit yang sama.
- Tidak ada skill yang meminta Dual Wield.
- Unarmed menolak skill sword-required.
- Buff tanpa serangan (`Battle Cry`, `Battle Focus`, `Unbroken Stance`) tidak memerlukan weapon.
- Basic Attack V3 dan Iron Charge tidak menghasilkan gameplay knockback.

## 7. Buff dan Stance

- `Guard Stance`: damage reduction dan block bonus sementara, tetap kompatibel dengan CounterContext.
- `Battle Cry`: physical damage percent sesuai rank, tanpa hidden attack multiplier.
- `Battle Focus`: accuracy dan critical rate, tanpa raw Physical Damage.
- `Unbroken Stance`: damage reduction dan displacement resistance; tidak memberi Max HP dan bukan Stun immunity.

## 8. Armor Break

`Armor Breaker` menerapkan satu status `armor_break`/`defenseDown` berdurasi 8 detik. Refresh menggunakan aplikasi terkuat/terbaru yang aman, bukan stacking additive tanpa batas.

`Crushing Finale` mendapat payoff **tepat 10%** hanya ketika target memiliki Armor Break dari pemain tersebut pada fase impact. Bonus ini tidak bertambah berdasarkan rank.

## 9. Counter

`Counter Slash` memiliki satu hit. Tanpa konteks block/parry, tidak ada payoff. Dengan `CounterContext` valid (`blocked` atau `parried`), modifier payoff rank diterapkan satu kali. Tidak dibuat kalkulasi damage kedua.

## 10. Stun dan Knockback

- Stun belum live.
- `Iron Charge` hanya menyimpan metadata `stunIntent` untuk fase berikutnya.
- `Ground Breaker` tidak memakai Stagger, Stun, atau knockback.
- Basic Attack dan Iron Charge dikunci ke zero gameplay knockback.
- Hit reaction visual biasa tetap dapat ditangani layer presentasi tanpa displacement gameplay.

## 11. Motion Metadata

Setiap skill canonical menyimpan `description`, `motionArchetype`, `motionNotes`, dan `animationNoGo` sebagai metadata presentasi. Metadata ini tidak dibaca oleh damage resolver dan tidak membutuhkan clip animasi final. Runtime masih boleh memakai placeholder animation.

## 12. Hotbar dan Development View

- Semua active Warrior V3 yang sudah dipelajari dapat di-assign ke PrimaryHotbar.
- Buff dan stance dapat dicast dari hotbar.
- Skill yang belum dipelajari, tidak kompatibel weapon, atau terkunci tetap ditolak oleh resolver.
- `activeSkills`, `getSkillStatus`, dan resolver SPV3 menyediakan 11 entry beserta rank, max rank, biaya SP, gate level, prerequisite, dan alasan lock untuk development view.
- Tidak ada redesign penuh K-panel pada fase ini.

## 13. Save / Reload

Sudah divalidasi bahwa save/reload mempertahankan:

- `skillArchitectureVersion = 3`
- `chosenCoreJob = warrior`
- rank Warrior V3 yang dibeli
- total SP
- rank granted Adventurer
- referensi hotbar yang valid

Warrior V2 tidak dipaksa bermigrasi ke V3.

## 14. Damage Sanity Matrix

Matrix berikut memakai rank 1, karakter tanpa allocated stat tambahan, weapon reference attack yang sama, dan belum memasukkan mitigation target. Angka adalah raw resolved damage. 1H dan 2H sama-sama kompatibel dengan toolkit Core; perbedaan final weapon power dapat datang dari item actual, bukan dari jalur skill yang berbeda.

| Lv | Weapon | Physical ATK | Basic | Strike | Sweep | Armor Breaker | Counter normal/payoff | Ground Breaker | Finale normal/payoff |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 15 | 1H | 31 | 31 | 32.20 | 28.48 | 32.50 | 30.30 / 34.85 | 34.80 | 48.25 / 53.08 |
| 15 | 2H | 31 | 31 | 32.20 | 28.48 | 32.50 | 30.30 / 34.85 | 34.80 | 48.25 / 53.08 |
| 30 | 1H | 48 | 48 | 49.20 | 43.44 | 49.50 | 45.60 / 52.44 | 52.65 | 72.90 / 80.19 |
| 30 | 2H | 48 | 48 | 49.20 | 43.44 | 49.50 | 45.60 / 52.44 | 52.65 | 72.90 / 80.19 |
| 45 | 1H | 64 | 64 | 65.20 | 57.52 | 65.50 | 60.00 / 69.00 | 69.45 | 96.10 / 105.71 |
| 45 | 2H | 64 | 64 | 65.20 | 57.52 | 65.50 | 60.00 / 69.00 | 69.45 | 96.10 / 105.71 |
| 59 | 1H | 79 | 79 | 80.20 | 70.72 | 80.50 | 73.50 / 84.53 | 85.20 | 117.85 / 129.64 |
| 59 | 2H | 79 | 79 | 80.20 | 70.72 | 80.50 | 73.50 / 84.53 | 85.20 | 117.85 / 129.64 |

> Catatan: baris Lv59 2H mengikuti hasil runtime yang sama untuk attack reference yang digunakan. Final balance belum dinilai pada fase ini.

## 15. Test Results

Focused Warrior V3 test:

- **9 passed / 0 failed**
- mencakup job change, exact 11 skill, gate/prerequisite, 1H/2H/unarmed, buff/stance, Armor Break, CounterContext, save/reload, dan sanity matrix.

Full `lib/game` regression:

- **394 passed / 0 failed**
- tidak ada regression baru pada Adventurer V3, CFV3, SPV3, V2, hotbar, world, equipment, Rune, dan sistem terkait.

## 16. V2 Coexistence

Warrior V2 tetap berada pada registry/arsitektur legacy. Jalur V3 hanya aktif bila karakter memiliki `skillArchitectureVersion = 3` dan memilih Warrior melalui transition V3. Tidak ada duplicate V2 skill atau Rising Slash pada daftar Warrior V3.

## 17. Known Limitations

- Belum ada clip animasi final.
- Belum ada live Stun subsystem; metadata Iron Charge sengaja dormant.
- K-panel final belum didesain ulang.
- Damage sanity matrix belum memakai monster mitigation dan bukan keputusan balance.
- SP income curve global belum dikunci.
- Tidak ada aktivasi Berserker, Blade Master, Dual Wield, PvP runtime, atau monster rebalance.

## 18. Recommendation untuk Fase Berikutnya

STOP pada review Warrior V3 ini. Jika owner menyetujui fondasi, fase terpisah berikutnya dapat mengaudit/mengimplementasikan generic Stun subsystem dan kemudian menghubungkan hanya skill yang disetujui, dimulai dari Iron Charge. Jangan mengaktifkan Stun, Berserker, Blade Master, atau redesign K-panel sebagai bagian dari SPV3-3.
