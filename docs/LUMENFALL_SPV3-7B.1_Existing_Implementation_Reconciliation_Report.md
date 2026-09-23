# LUMENFALL — SPV3-7B.1 Existing Blade Master 7B Canonical Reconciliation

Status: **AUDITED, MINIMALLY CORRECTED, TESTED**  
Tanggal: 2026-09-23

## 1. Ringkasan

SPV3-7B sudah ada sebelum fase ini karena checkout repository yang diaudit
telah memuat registry 9 skill, adapter runtime, resolver impact, transient
state, clean fixture, test 7B, dan laporan SPV3-7B. Ini bukan hasil
re-implementasi pada fase 7B.1.

Audit menemukan dua koreksi data/path yang diperlukan:

1. Tempo Drive masih memakai fallback `0 MP / 0 detik`; sekarang memakai
   Mana `14/15/16/17/18` dan cooldown `24/23/22/21/20`.
2. Twin Blade Mastery sekarang juga mengurangi Mana cast Tempo Drive. Active
   Mana efficiency dari Tempo Drive sendiri tetap hanya berlaku pada
   Twin Assault, Cross Sever, dan Blade Tempest, sehingga tidak mengurangi
   biaya aktivasi dirinya sendiri.

Selain itu, ditemukan gate lama yang hanya mengizinkan generator Tempo ketika
Tempo Drive atau Blade Tempest telah dipelajari. Gate tersebut dihapus dari
jalur impact; Twin Assault/Cross Sever kini dapat menghasilkan Tempo setelah
impact valid selama Mastery dan Dual Wield aktif, sesuai kontrak owner.

Tidak ada perubahan pada damage, cooldown selain canonical Tempo Drive,
Stun, Flow formula, Dual Wield, Berserker, SP economy, atau skill 7A.

## 2. Comparison read-only sebelum perubahan

Comparison ini dilakukan sebelum koreksi kode.

| Area | Implementasi sebelum | Canonical owner | Status sebelum |
|---|---|---|---|
| Cross Sever registry | 5 rank, level `66/69/72/76/80`, SP 3 | Sama | MATCH |
| Cross Sever mode | Satu hit `BOTH`, tag `dual-combined` | `DUAL_COMBINED`, satu impact | MATCH |
| Cross Sever values | Coeff `1.20/1.28/1.35/1.43/1.50`; STR `0.12–0.20`; DEX `0.18–0.30`; Mana `16/17/18/20/21`; CD `8/7.8/7.6/7.4/7.2` | Sama | MATCH |
| Piercing registry | 5 rank, level `68/71/74/77/80`, SP 3 | Sama | MATCH |
| Piercing sequence | 3 hit, Main Hand, weights `0.30/0.30/0.40` | Sama | MATCH |
| Piercing values | Coeff `1.15/1.25/1.35/1.45/1.55`; STR `0.08–0.14`; DEX `0.20–0.36`; Mana `15/16/17/18/20`; CD `8.5/8.1/7.7/7.3/7` | Sama | MATCH |
| Piercing Armor Break | Caster-owned query; Accuracy +10 seluruh sequence; Crit +10 pada hit ketiga | Sama | MATCH* |
| Tempo cap/lifetime | Cap 3; lifetime Mastery `5/5.5/6/6.5/7`; refresh expiry | Sama | MATCH |
| Tempo generator | Twin Assault/Cross Sever, satu stack per cast valid | Sama, tetapi world gate masih mensyaratkan consumer 7B | MISMATCH |
| Tempo clear | Clear saat capability/style/specialization tidak valid dan saat transient clear | Sama | MATCH |
| Tempo Drive rank/level/SP | R5, `71/73/75/78/80`, SP 3 | Sama | MATCH |
| Tempo Drive Mana/CD | `0/0/0/0/0` fallback | Mana `14/15/16/17/18`; CD `24/23/22/21/20` | MISMATCH |
| Mastery reduction pada Drive cast | Tidak termasuk skill reduction set | Harus berlaku pada cast Drive | MISMATCH |
| Drive active efficiency scope | Twin Assault/Cross Sever/Blade Tempest | Sama | MATCH |
| Drive duration | `5.5/7/8.5` berdasarkan stack yang dikonsumsi | Sama | MATCH |
| Drive ASPD | Rank `4/5/6/7/8` + 4 per stack | Sama | MATCH |
| Drive reduction | Rank `2/3/4/5/6` + 4 per stack; strongest wins | Sama | MATCH |
| Blade Tempest rank/level/SP | R3, `75/78/80`, SP 5 | Sama | MATCH |
| Blade Tempest sequence | `MAIN/OFF/MAIN/OFF/BOTH`, 5 impact | Sama | MATCH |
| Tempest coefficients | `0.25/0.25/0.25/0.25/0.75`; `0.28...0.88`; `0.30...1.05` | Sama | MATCH |
| Tempest shared weights | `0.15/0.15/0.15/0.15/0.40`, total 1 | Sama | MATCH |
| Tempest finisher | Snapshot 3 Tempo: Crit +25 dan final damage +10% pada hit 5 | Sama | MATCH |
| Tempest fixed timing | Delay `0/0.18/0.36/0.54/0.72`, tidak dikompres ASPD | Sama | MATCH |
| AoE/CC | Semua single-target; tidak ada AoE/Stun/knockback | Sama | MATCH |

`MATCH*`: field Accuracy +10 sudah dimasukkan ke resolved hit. Engine umum
belum memiliki roll hit-chance skill yang mengonsumsi Accuracy; karena itu
angka tersebut tersimpan pada hit context, tetapi belum memiliki dampak
miss/hit terpisah. Tidak ada accuracy system baru yang dibuat pada fase ini.

## 3. Cross Sever

Cross Sever sudah cocok dengan kontrak canonical:

- `v3-blade-master-cross-sever`, max R5, level `66/69/72/76/80`, 3 SP/rank.
- Prerequisite Twin Assault R3.
- Hanya konfigurasi Dual One-Hand Sword yang valid.
- Satu synchronized impact dengan hand `BOTH` dan shared contribution 1.0.
- Coefficient, STR/DEX scaling, Mana, cooldown, single target, satu crit roll,
  tanpa AoE, Stun, dan knockback tetap cocok.
- Twin Blade Mastery reduction berlaku; Tempo Drive active reduction juga
  berlaku bila Drive sedang aktif.
- Impact valid menghasilkan maksimal satu Tempo.

Tidak ada perubahan pada Cross Sever.

## 4. Piercing Sequence

Piercing Sequence sudah cocok dengan kontrak canonical:

- R5 pada level `68/71/74/77/80`, 3 SP/rank.
- Prerequisite Blade Rush R2 dan Warrior Armor Breaker R3.
- Valid untuk One-Hand Sword, Two-Hand Sword, dan Dual Wield yang valid.
- Tiga hit nyata dengan distribusi `30% / 30% / 40%` dan shared weights yang
  sama.
- Pada Dual Wield, setiap hit memakai raw Main Hand; Offhand raw ATK tidak
  ikut masuk otomatis sebagai weapon layer kedua.
- Coefficient total, STR/DEX, Mana, cooldown, independent crit, single target,
  tanpa AoE/Stun/knockback cocok.
- `BladeMasterImpactSession` mengambil Armor Break milik caster saja:
  Accuracy +10 untuk seluruh sequence dan Critical Rate +10 percentage points
  hanya pada hit ketiga.
- Tidak ada final-damage bonus yang ditambahkan.

Tidak ada perubahan pada Piercing Sequence.

## 5. Tempo

Tempo tetap merupakan transient combat state, bukan Mana/FP/resource permanen.

- Maksimal 3 stack.
- Generator hanya Twin Assault dan Cross Sever.
- Satu cast yang menghasilkan satu atau lebih damaging impact valid memberi
  maksimal satu stack.
- Invalid cast atau tidak ada impact valid tidak memberi stack.
- Lifetime berasal dari rank Twin Blade Mastery dan refresh untuk seluruh
  stack saat stack baru valid diperoleh.
- Basic Attack, Blade Rush, Counterflow, Blade Focus, Piercing Sequence,
  Blade Tempest, dan skill Warrior tidak menghasilkan Tempo.
- State tidak masuk save dan dibersihkan oleh `TransientCombatState.clear()`;
  kehilangan Dual Wield/specialization/style dibersihkan saat update runtime.

Perbaikan 7B.1 menghapus gate yang sebelumnya menunggu rank Tempo Drive atau
Blade Tempest. Resolver impact tetap membatasi generator berdasarkan set
`BLADE_MASTER_TEMPO_GENERATORS`, Dual Wield aktif, dan Mastery R1+, sehingga
tidak ada skill lain yang ikut menghasilkan Tempo.

## 6. Tempo Drive

### Data canonical setelah koreksi

| Rank | Level | Mana | Cooldown | Base ASPD | Base Mana reduction |
|---:|---:|---:|---:|---:|---:|
| R1 | 71 | 14 | 24s | 4% | 2% |
| R2 | 73 | 15 | 23s | 5% | 3% |
| R3 | 75 | 16 | 22s | 6% | 4% |
| R4 | 78 | 17 | 21s | 7% | 5% |
| R5 | 80 | 18 | 20s | 8% | 6% |

Perubahan mengganti fallback zero dengan array rank values data-driven.

### Cast dan konsumsi

- Requires valid Dual One-Hand Swords dan prerequisite Twin Assault R4.
- Dengan 0 Tempo, cast ditolak dengan `TEMPO_REQUIRED`.
- Cast valid mengonsumsi 1, 2, atau 3 stack sekaligus.
- Durasi tetap `5.5/7/8.5` detik berdasarkan stack yang dikonsumsi; rank
  tidak mengubah durasi.
- Twin Blade Mastery reduction berlaku pada biaya cast Tempo Drive.
- Drive yang sedang aktif tidak mengurangi biaya aktivasi yang sudah dibayar,
  dan tidak dipakai untuk mengurangi dirinya sendiri pada resolver.

### Buff

ASPD final = base rank `4/5/6/7/8%` + `4 percentage points × stack`.  
Mana reduction final = base rank `2/3/4/5/6%` + `4 percentage points × stack`.

Active Mana reduction hanya memengaruhi Twin Assault, Cross Sever, dan Blade
Tempest. Policy strongest applicable tetap dipakai, bukan penjumlahan sumber.

## 7. Blade Tempest

Blade Tempest tetap sesuai canonical:

- R3, level `75/78/80`, 5 SP/rank.
- Requires Twin Blade Mastery R3 dan investasi minimal 18 SP di Blade Master.
- Valid hanya dengan Dual One-Hand Swords.
- Single target, tepat lima impact: `MAIN/OFF/MAIN/OFF/BOTH`.
- Empat hit pertama memiliki crit roll masing-masing; final synchronized hit
  memiliki satu crit roll.
- Shared weights `0.15/0.15/0.15/0.15/0.40`, total 1.0.
- Total coefficients R1/R2/R3 `1.75/2.00/2.25` dan distribusi hit cocok.
- Flow memberi +5 percentage points ke semua lima hit dan dikonsumsi pada
  first valid damaging impact.
- Snapshot tepat 3 Tempo memberi final hit +25 Crit Rate points dan +10%
  final damage pada hit kelima saja. Snapshot 0/1/2 tidak dikonsumsi.
- Timing internal tetap fixed dan tidak dipadatkan oleh Tempo Drive ASPD.
- Tidak ada AoE, Stun, knockback, Stagger, atau displacement.

Tidak ada perubahan pada Blade Tempest.

## 8. File yang diubah

- `lib/game/blade-master-v3.ts`
  - canonical Tempo Drive Mana/cooldown;
  - set terpisah untuk Mastery reduction versus active Drive reduction.
- `lib/game/rules.ts`
  - menerapkan Twin Blade Mastery reduction pada cast Tempo Drive;
  - mempertahankan active Drive reduction hanya pada tiga skill canonical.
- `lib/game/world.ts`
  - mengizinkan generator Tempo canonical setelah impact valid tanpa menunggu
    skill consumer 7B dipelajari.
- `lib/game/blade-master-v3-advanced.test.ts`
  - deterministic test R1–R5 Mana/cooldown, Mastery reduction, dan larangan
    self-reduction dari Drive.
- `docs/LUMENFALL_SPV3-7B.1_Existing_Implementation_Reconciliation_Report.md`
  - laporan ini.

Tidak ada file map, asset, monster, PvP, Crimson Blade, Executioner, atau
Thief V3 yang diubah.

## 9. Damage sanity matrix

Matrix berasal dari clean 7B fixture pada equipment dual-wield terkontrol
Main ATK 100 dan Offhand ATK 70. Ini diagnostik, bukan rebalance.

| Level | Dual Basic Main | Dual Basic Off | Twin Assault | Cross Sever | Piercing | Piercing + own Armor Break | Counterflow | Tempest | Tempest + Flow | Tempest + 3 Tempo | Tempest + Flow + 3 Tempo |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 75 | 189 | 159 | 173.35 | 329.75 | 241.19 | 247.56 | 288.29 | 346.70 | 355.22 | 388.79 | 397.75 |
| 80 | 195 | 165 | 195.58 | 376.04 | 286.28 | 293.79 | 312.74 | 466.74 | 478.21 | 524.97 | 537.04 |

Pembanding Berserker:

| Level | Crushing Blow | Earth Splitter |
|---:|---:|---:|
| 75 | 354.63 | 333.33 |
| 80 | 386.29 | 388.14 |

Tidak ditemukan coefficient explosion baru atau duplikasi shared character
core pada perubahan ini.

## 10. Clean runtime fixture

Runner `node scripts/verify-blade-master-7b.mjs` lulus dengan:

```text
status = PASS
worldImported = false
mapLoaded = false
exactSkillCount = 9
errors = []
```

Fixture memvalidasi Cross Sever, Piercing Sequence, Tempo 1→2→3/cap,
Tempo Drive 1/2/3 stack, Blade Tempest 5 hit, Flow, dan 3-Tempo finisher
tanpa mengimpor `world.ts`, map, terrain, GLB, NPC, audio, atau Flaris.

## 11. Test dan build

Focused Blade Master 7A/7B:

```text
17 passed / 0 failed
```

Full `lib/game`:

```text
441 passed / 0 failed
```

Production build:

```text
vinext build — PASS
```

Build menampilkan warning yang sudah dikenal tentang optional import
`@tailwindcss/vite` dan `nitro/vite` pada checkout dependency lokal, serta
warning chunk besar dan route dynamic classification. Semua environment build
berhasil ditransform dan build selesai; warning tersebut bukan failure dan
tidak berasal dari Blade Master 7B.1.

## 12. Remaining limitations

1. Engine belum memiliki general skill hit-chance roll; Accuracy +10
   Piercing sudah masuk ke hit context, tetapi belum dapat memengaruhi
   miss/hit sampai sistem Accuracy umum tersedia.
2. Tempo Drive kini memiliki angka Mana/cooldown canonical, tetapi angka
   tersebut belum dipublikasikan ke deployment public pada laporan ini.
3. Fixture adalah clean combat fixture, bukan headed full-world animation
   validation.

## 13. Readiness

SPV3-7B existing implementation telah diaudit dan dikoreksi minimal terhadap
nilai canonical owner. Skill 7A tetap preserved, Dual Wield/Flow/Stun/Armor
Break/Berserker tidak direwrite, focused test dan full regression hijau.

Status: **SPV3-7B.1 RECONCILED — READY FOR WARRIOR LINEAGE FINAL REGRESSION**

STOP setelah fase ini. Tidak ada implementasi Crimson Blade, Executioner,
Advanced Job, PvP, monster rebalance, final animation, atau Thief V3.
