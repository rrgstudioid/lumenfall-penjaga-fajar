# CFV3-1.1 — Foundation Closure & Extended Validation

## Hasil

- Legacy Stagger suites dibersihkan; subsystem Stagger tidak dikembalikan.
- Full `lib/game`: **367 passed, 0 failed**.
- Matrix diperluas ke Lv1, 10, 14, 15, 30, 59, 60, 70, 80, 100.
- Formula skill, monster, FP, Stun, dan equipment balance tidak diubah.

## Base-15 handling

Implementasi memakai:

```text
(effective STR - 15) × weapon factor
```

Base STR 15 adalah baseline universal dan tidak dihitung lagi sebagai serangan
tambahan ketika karakter baru memakai senjata. Pada Lv15 build A
(`43 STR / 15 VIT / 15 DEX / 15 INT`), allocation STR adalah 28; dengan factor
1, kontribusi STR = 28, bukan 43.

Dengan Base Physical ATK 23 dan Dawnblade +8:

```text
23 + 28 + 8 = 59 Physical Attack Power
```

Tanpa senjata hasilnya 51; Basic Attack memakai koefisien 1.0 sebelum combo,
critical, dan mitigasi.

## Lv59 → Lv60

| Level | Base Physical ATK | Earned points |
|---:|---:|---:|
| 59 | 71 | 116 |
| 60 | 73 | 118 |

Tidak ada reset Base Stats, allocated stat, atau hidden ATK bonus. Specialization
belum aktif secara publik dan belum mengubah kalkulator universal.

## Build investigation

`vinext build --debug` kembali berhenti di `[1/5] analyze client references`
dan `transforming...`. Saat proses itu berjalan, child Node build terukur
mencapai sekitar **9.4 GB working set** tanpa output error; setelah dihentikan,
memori dilepas dan tidak ada crash CFV3. Ini paling konsisten dengan memory
pressure/workspace build-analysis problem, bukan regression kalkulator combat.
Production build tetap **UNCONFIRMED / INVESTIGATION NEEDED** dan tidak boleh
dinyatakan sukses.

TypeScript full workspace masih melaporkan 82 error karena artefak/output dan
baseline lama; file production CFV3 tidak menambah error. Primary source error
yang tersisa pada pass ini adalah empat narrowing error appearance lama di
`lib/game/rules.ts` baris 381–384.

## Double-scaling audit

Tidak ada lagi global `STR × 2` pada Physical Attack. Physical skill formulas
tetap memakai pipeline skill masing-masing; fondasi ini hanya mengganti sumber
Physical Attack Power dan resolver basic attack. Tidak ada bonus STR kedua yang
ditambahkan pada fase ini.

## Artefak

- `docs/LUMENFALL_CFV3-1_Report.md`
- `docs/LUMENFALL_CFV3-1_Physical_Attack_Matrix.json`
- `lib/game/post-stagger-v2-regression.test.ts`
