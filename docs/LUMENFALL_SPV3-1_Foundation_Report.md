# LUMENFALL SPV3-1 — Foundation Report

Status: **Implemented / architecture-only**

SPV3-1 menambahkan fondasi progression skill generik tanpa mengaktifkan atau
migrasikan konten skill V2. Warrior V2, Thief V2, combat foundation, dan
registri skill aktif tetap berjalan melalui jalur lama.

## 1. Schema lama vs V3

Schema lama menyimpan `skillPoints` dan `skillLevels` langsung pada `Hero`,
dengan aturan job/level yang tersebar di registry dan resolver legacy.

SPV3 memperkenalkan `SkillProgressionV3State` terpisah:

- `skillArchitectureVersion: 3`
- `totalEarnedSP`
- `skillRanks` berdasarkan skill ID
- `chosenCoreJob`
- `chosenSpecialization`
- `chosenAdvancedJob`

Definisi skill V3 sekarang mendukung tier, rank-level gate, biaya SP per rank,
prerequisite, ancestry, job investment, profile PvE/PvP, scaling eksplisit,
hit sequence, targeting, resource, effects, presentation, dan motion metadata.

## 2. Files changed

- `lib/game/skill-progression-v3.ts` — engine dan schema foundation.
- `lib/game/skill-progression-v3.test.ts` — fixture dan validation SPV3-1.
- `docs/LUMENFALL_SPV3-1_Foundation_Report.md` — dokumen ini.

Konten skill V2 tidak diubah.

## 3. Skill Point architecture

`spentSkillPointsV3()` menghitung rank yang benar-benar dibeli berdasarkan biaya
rank skill. `availableSkillPointsV3()` selalu menghitung:

```text
availableSP = totalEarnedSP - spentSP
```

Kurva SP belum difinalisasi dan tidak di-hardcode pada engine.

## 4. Job Change refund

`refundAllSkillPointsForJobChange()` mengosongkan `skillRanks`, tetapi menjaga
total SP dan identitas lineage. `transitionSkillJobV3()` menggunakannya saat
berpindah Core, Specialization, atau Advanced.

Level, stat, equipment, Rune, inventory, quest, dan progression job berada di
luar state refund ini dan tidak disentuh.

## 5. Rank Level Gate

`canPurchaseSkillRank()` mengambil requirement dari `rankLevelRequirements[]`.
Jika rank berikutnya belum mencapai level, resolver mengembalikan reason code
`REQUIRES_LEVEL` beserta level yang diperlukan. Max rank 3, 5, 8, 10, atau nilai
lain didukung tanpa perubahan engine.

## 6. Prerequisite resolver

Prerequisite diperiksa per rank melalui `prerequisiteSkills`. Kegagalan
mengembalikan `REQUIRES_SKILL`, ID skill, dan rank yang dibutuhkan.

## 7. Cross-tier prerequisite

Skill pada tier baru dapat meminta skill dari ancestor melalui
`prerequisiteSkills` dan `ancestryRequirement`. Setelah memilih Blade Master,
skill Warrior tetap dapat menjadi prerequisite dan tetap bisa dibeli.

## 8. Job-investment requirement

`jobInvestmentRequirement` menghitung SP yang benar-benar dibelanjakan pada
skill dengan `jobId` tertentu. SP dari job lain tidak ikut dihitung kecuali
deklarasi skill memang mengarah ke job tersebut.

## 9. Ancestry access control

Akses otomatis berisi Adventurer, Core terpilih, Specialization terpilih, dan
Advanced terpilih. Sibling branch seperti Berserker tetap tidak dapat dibeli
oleh Blade Master.

## 10. PvE / PvP profile

`defaultProfile` menjadi baseline. `pvpOverride` hanya menimpa field yang
disediakan dan field lain tetap fallback ke default. Mode PvP belum diaktifkan.

## 11. Stat scaling

Skill V3 mendukung scaling eksplisit `str`, `vit`, `dex`, dan `int`, baik pada
definisi maupun profile. Tidak ada implicit primary-stat conversion baru dan
tidak ada perubahan CFV3-2.1.

## 12. Hit sequence

`damageProfile.hits[]` mendukung beberapa hit dengan coefficient, flat power,
dan delay masing-masing. Foundation tidak memaksa satu skill menjadi satu hit.

## 13. Motion metadata

`motion` berisi archetype, notes, hit style, movement intent, dan animation
no-go. Resolver combat sengaja hanya mengembalikan data combat dan tidak
membaca motion metadata, sehingga motion tidak dapat mengubah damage, SP,
cooldown, atau hitbox.

## 14. Save impact

State V3 memiliki bentuk save mandiri dan normalizer defensif di
`normalizeSkillProgressionV3()`. Belum dipasang ke save live `Hero`; ini
disengaja agar SPV3-1 tidak mengaktifkan migration atau mengubah V2 content.
Integrasi save live dilakukan pada fase migrasi berikutnya.

## 15. Legacy V2 coexistence

V2 tetap menjadi jalur aktif. Modul V3 tidak mengimpor atau mengubah definisi
Warrior/Thief yang sedang dipakai runtime. Tidak ada V3 skill yang otomatis
muncul di hotbar atau dapat dibeli oleh karakter production.

## 16. Tests

Fixture SPV3-1 memvalidasi:

- native purchase;
- level gate;
- insufficient SP;
- prerequisite rank;
- intra-job chain;
- cross-tier prerequisite;
- job investment;
- sibling specialization lock;
- Core dan Specialization refund;
- ultimate level 75 gate;
- PvP fallback;
- variable max rank dan biaya SP;
- motion metadata tidak memengaruhi combat profile.

Focused result: **7 passed, 0 failed**.

Full `lib/game` regression dijalankan setelah implementasi; hasil dicatat pada
owner response.

## 17. Known limitations

- Belum ada migrasi `Hero` V2 ke state V3.
- Belum ada kurva SP final.
- Belum ada UI skill tree V3.
- Belum ada konten Adventurer V3 atau Warrior V3.
- Belum ada implementasi Stun, FP, Dual Wield, animasi, atau PvP runtime.
- Weapon requirement disimpan sebagai schema gate metadata; validasi equipment
  saat cast tetap menjadi tanggung jawab fase combat/content berikutnya.

## 18. Recommendation for SPV3-2

Mulai dengan integrasi satu fixture/reference lineage non-production ke save
development-only, kemudian migrasikan satu job tree secara bertahap setelah
owner menyetujui schema, reason codes, dan aturan refund. Warrior V3 dapat
menjadi referensi pertama; Thief V2 tetap tidak disentuh sampai fase migrasi
yang disetujui.
