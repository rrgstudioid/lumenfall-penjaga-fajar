# LUMENFALL — Combat Foundation V3 / CFV3-1

## Status

CFV3-1 diterapkan pada fondasi stat dan serangan fisik. Tidak ada Stun,
FP, specialization, skill baru, perubahan skill Warrior, perubahan monster,
atau publish.

## Kontrak yang sekarang aktif

- Primary stat canonical: `STR / VIT / DEX / INT`.
- Base primary stat karakter baru: `15` masing-masing.
- Stat point: `+2` setiap level yang diperoleh; total level 15 = `28`, level 59 = `116`.
- Base Physical ATK: `7 + floor(level × 1.1)`.
- Basic attack membaca kalkulator pusat dengan koefisien `1.0` sebelum critical,
  combo, dan mitigasi pertahanan.
- MP sekarang terpisah sebagai base MP + kontribusi INT (`3 MP / INT`) + gear/buff.
- HP sekarang dipisah sebagai base HP + level growth + kontribusi VIT yang
  level-scaled + gear/buff. Faktor VIT disimpan sebagai konfigurasi audit,
  bukan disebar ke skill/job.
- Tidak ada `Stagger Resistance` atau `staggerDamage` yang ditambahkan kembali.

## Layer stat

Kalkulator membedakan `BASE (15)`, `ALLOCATED`, `EQUIPMENT/PASSIVE/BUFF`, dan
`FINAL`. K panel menampilkan Base/Allocated pada baris utama; tooltip
menampilkan Bonus dan Final.

Kontribusi ofensif tidak lagi memakai aturan global `STR × 2`. Ada konfigurasi
`PHYSICAL_WEAPON_STAT_FACTORS`; faktor sementara neutral untuk weapon fisik,
dan `0` untuk karakter benar-benar tanpa senjata. Kontribusi STR yang dipakai
adalah `(effective STR - base STR) × factor`, sehingga base 15 tidak terhitung
dua kali. Nilai ini adalah fondasi provisional untuk audit lintas class, bukan
keputusan balance final setiap weapon family.

## Tabel Base Physical ATK

| Level | Base Physical ATK | Earned stat points |
|---:|---:|---:|
| 1 | 8 | 0 |
| 5 | 12 | 8 |
| 10 | 18 | 18 |
| 14 | 22 | 26 |
| 15 | 23 | 28 |
| 20 | 29 | 38 |
| 30 | 40 | 58 |
| 40 | 51 | 78 |
| 50 | 62 | 98 |
| 59 | 71 | 116 |
| 60 | 73 | 118 |
| 70 | 84 | 138 |
| 80 | 95 | 158 |
| 100 | 117 | 198 |

Diagnostic dengan Dawnblade/starter attack `+8` dan tanpa alokasi menghasilkan
Physical ATK `16, 20, 26, 30, 31, 48, 59, 70, 79` pada level di atas sampai
level 59. Unarmed menghilangkan kontribusi weapon tersebut dan membaca baseline
level saja ketika STR belum dialokasikan.

Build level 15 menggunakan 28 point:

- A: final `STR 43 / VIT 15 / DEX 15 / INT 15` → allocated STR 28.
- B: final `STR 29 / VIT 29 / DEX 15 / INT 15` → allocated STR/VIT 14.
- C: final `STR 15 / VIT 15 / DEX 43 / INT 15` → allocated DEX 28.

Untuk contoh A level 15 dengan Dawnblade: Base ATK `23`, STR contribution
`28`, weapon contribution `8`, total Physical Attack `59`; unarmed Basic Attack
`51`, normal weapon Basic Attack `59`.

## Job-change reset

First Core Job change mengembalikan allocation primary stat ke nol dan
mengembalikan seluruh earned points berdasarkan level. Equipment dan buff tidak
di-reset. Jalur V2 development Warrior/Thief dan jalur legacy promotion
menggunakan helper yang sama; legacy Core Job juga menunggu level 15 pada
kontrak baru.

## File yang disentuh untuk CFV3-1

- `lib/game/rules.ts` — konstanta/fondasi stat, derived stats, basic attack,
  SP growth, dan first Core Job allocation reset.
- `lib/game/world.ts` — basic attack memakai resolver pusat.
- `lib/game/character-screen.ts` — layer atribut dan tooltip.
- `components/game/character-screen.tsx` — Base/Allocated/Bonus/Final UI.
- `lib/game/combat-foundation-v3.test.ts` — regression tests baru.
- Ekspektasi test lama yang memang mengunci formula sebelum CFV3-1 diselaraskan
  dengan kontrak baru.

## Verifikasi

- Focused CFV3-1 + character-screen: **10 passed, 0 failed**.
- Full `lib/game` run: **367 tests, 367 passed, 0 failed**. Dua suite legacy
  yang masih menguji subsystem Stagger dihapus dan digantikan oleh
  `post-stagger-v2-regression.test.ts`.
- TypeScript: error CFV3 baru **0**. Error source utama yang masih ada berasal
  dari baseline lama (empat narrowing appearance di `rules.ts`; output build
  juga memuat artefak/output lama dan test Stagger yang sudah tidak valid).
- Production build dimulai dengan `vinext build`, tetapi kembali berhenti pada
  tahap `transforming...` tanpa hasil sukses sebelum dihentikan. Tidak ada
  indikasi error CFV3 dari proses tersebut.

## Catatan pemilik

Perubahan angka pada fondasi memang dilakukan karena itu adalah isi kontrak
CFV3-1: base stat 15, +2 SP/level, Base Physical ATK, VIT/INT layer. Tidak ada
angka damage skill, mana skill, cooldown skill, stagger, monster, equipment
attack, atau item balance yang diubah.

`calculateTotalStatPoints` tidak lagi memotong level pada content cap; content
cap tetap mengatur progression/XP, sedangkan earned stat points mengikuti level
aktual. Karena itu level 100 memiliki 198 point secara matematis.

Langkah berikut yang aman: owner review matriks stat ini sebelum faktor tiap
weapon family dan formula job-specific dikunci.
