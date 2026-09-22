# LUMENFALL SPV3-2 — Adventurer V3 Report

Status: **Implemented / development-reference path**

Adventurer adalah konten pertama yang memakai Skill Progression V3. Warrior
V3, Thief V2 migration, Berserker, Blade Master, Stun, FP, Dual Wield,
full K-panel redesign, dan final animation tidak dikerjakan pada fase ini.

## 1. Integrasi V3 state ke Hero/save

Ditambahkan jalur development eksplisit:

- `createV3AdventurerHero()` menghasilkan karakter dengan
  `skillArchitectureVersion = 3`.
- `createNewCharacter(..., 'v3_adventurer')` tersedia sebagai jalur pembuatan
  karakter baru yang eksplisit.
- Karakter V2 lama tidak dikonversi otomatis.
- State disimpan pada `skillProgressionV3`.
- `parseSave()` menormalisasi dan mempertahankan state V3, rank, total SP, dan
  lineage.
- `isCompatibleCharacterSave()` menerima karakter V3 development bersama V2.

State V3 menyimpan `totalEarnedSP`, `skillRanks`, `grantedRanks`, dan pilihan
lineage. `grantedRanks` memastikan Quick Slash R1 tidak dihitung sebagai SP
yang dibayar.

## 2. Tiga skill Adventurer V3

Tree V3 hanya mengekspos:

1. `v3-adventurer-quick-slash` — Quick Slash
2. `v3-adventurer-power-strike` — Power Strike
3. `v3-adventurer-minor-heal` — Minor Heal

Skill Adventurer legacy tidak muncul pada active skill list karakter V3.
Definisi legacy tetap tersedia untuk coexistence V2.

## 3. Quick Slash granted behavior

Quick Slash R1 diberikan saat karakter V3 dibuat:

- R1 tidak mengonsumsi SP.
- R2–R5 membutuhkan 1 SP per rank.
- Rank gate: Lv1, Lv3, Lv6, Lv9, Lv13.
- Coefficient: 1.05, 1.08, 1.12, 1.16, 1.20.
- Bonus STR eksplisit: 0.02 sampai 0.06.
- Mana: 3, 3, 4, 4, 5.
- Cooldown: 3.2s sampai 2.8s.
- One-Hand Sword, single target, satu hit.

## 4. Rank gates

Power Strike:

- R1–R5: Lv4, Lv7, Lv10, Lv12, Lv14.
- Coefficient: 1.20, 1.26, 1.32, 1.38, 1.45.
- Mana: 5, 5, 6, 6, 7.
- Cooldown: 6.0s sampai 5.0s.

Minor Heal:

- R1–R3: Lv2, Lv8, Lv14.
- Heal: 6%, 8%, 10% Max HP.
- Mana: 8, 10, 12.
- Cooldown: 30s, 28s, 26s.
- Self-only.

## 5. SP purchase/refund

Pembelian memakai resolver SPV3-1. Biaya teoritis seluruh rank berbayar:

- Quick Slash R2–R5: 4 SP
- Power Strike R1–R5: 5 SP
- Minor Heal R1–R3: 3 SP
- Total: 12 SP

Job-change refund menggunakan `transitionSkillJobV3()`. Rank berbayar
dikosongkan dan `totalEarnedSP` tetap. Granted Quick Slash R1 tetap aman.
Pilihan Core Job tetap tersimpan.

## 6. Damage formulas

Quick Slash dan Power Strike memakai resolver fisik CFV3 melalui runtime skill
adapter. Tidak ada global STR tersembunyi, Stagger, Stun, knockback, AoE, atau
multi-hit pada kedua skill.

Coefficient dan STR scaling dideklarasikan per rank melalui data V3 dan
diterjemahkan ke rank values runtime. Nilai ini tetap provisional sesuai
kontrak SPV3-2 dan bukan final monster-balance tuning.

## 7. Heal formula

Minor Heal memakai persentase Max HP eksplisit:

```text
R1 = 6% Max HP
R2 = 8% Max HP
R3 = 10% Max HP
```

Tidak menggunakan Magic Attack besar dan tidak menjadi pengganti Acolyte.

## 8. Mana/cooldown

Semua skill V3 memakai Mana dan cooldown runtime yang sudah ada. Tidak ada FP
baru. Mana reduction dan cooldown modifier tetap melewati resolver yang sama.

## 9. Basic Attack knockback cleanup

Pada karakter dengan `skillArchitectureVersion === 3`, Basic Attack sekarang
menggunakan displacement `0`. Hit reaction visual tetap dapat berjalan, tetapi
tidak ada perpindahan gameplay. Jalur Basic Attack V2 tidak diubah.

Skill-specific knockback lain tidak diubah.

## 10. Hotbar/casting validation

Hotbar sekarang dapat menemukan dan menampilkan tiga skill V3. Assignment ke
PrimaryHotbar memakai resolver yang sama, dan casting memakai `canCastSkill()`
serta `resolveHeroSkill()` runtime yang sudah ada.

Tidak ada full K-panel redesign.

## 11. Save/reload result

Save/reload berhasil mempertahankan:

- `skillArchitectureVersion = 3`
- `totalEarnedSP`
- purchased ranks
- granted Quick Slash R1
- chosen Core lineage metadata

V2 save tetap berada pada jalur V2 dan tidak mendapat skill V3.

## 12. V2 coexistence

Tidak ada migrasi otomatis terhadap karakter V2 yang sudah ada. Thief V2 dan
Warrior V2 tidak diubah. Runtime memilih active skill list V3 hanya ketika
karakter secara eksplisit memiliki `skillArchitectureVersion = 3`.

## 13. Focused tests

Focused Adventurer/SPV3 tests: **15 passed, 0 failed**. Hotbar integration
validation juga lulus sebagai bagian dari regression suite.

Coverage mencakup:

- canonical three-skill tree;
- granted Quick Slash tanpa SP;
- seluruh rank-level gates;
- insufficient SP;
- Minor Heal self-only dan persentase Max HP;
- Mana/cooldown cast checks;
- PrimaryHotbar assignment;
- Core refund;
- save/reload;
- motion metadata;
- SPV3 foundation regression.

## 14. Full lib/game regression

Full regression dijalankan setelah implementasi. Hasil final dicatat pada
owner response dan harus tetap **0 failed**.

## 15. Known limitations

- Full K-panel V3 belum dibuat.
- Job Trainer belum mengaktifkan Warrior V3.
- Job-change UI V3 belum dibuat; refund engine dan development fixture sudah
  tersedia.
- Tidak ada final animation asset; metadata motion baru bersifat kontrak
  presentasi.
- Tidak ada PvP mode runtime.
- Tidak ada monster rebalance.
- Quick Slash dan Power Strike masih menggunakan runtime adapter menuju
  resolver skill lama, dengan data gameplay yang berasal dari definisi V3.

## 16. Recommendation SPV3-3

Setelah owner review, fase berikutnya dapat mengaudit dan memigrasikan Warrior
V3 memakai schema yang sama. Jangan mengaktifkan Berserker, Blade Master,
Stun, Dual Wield, atau animasi final sebelum Warrior V3 selesai diaudit dan
disetujui.
