# LUMENFALL Skill Information Presentation V3

Status implementasi: **siap untuk owner review**, dengan validasi runtime/browser yang masih menunggu toolchain Node tersedia pada environment ini.

## 1. Arsitektur presentation

Alur baru adalah `SkillDefinitionV3` + runtime `SkillDefinition` -> `resolveSkillPresentation` -> renderer K-panel. Model generic berada di `lib/game/skill-presentation-v3.ts` dan tidak menyimpan formula skill per skill.

## 2. Integrasi source of truth

Metadata nama, deskripsi, rank, targeting, weapon, effect, prerequisite, status, dan scaling dibaca dari registry V3. Nilai rank yang telah diadaptasi runtime dibaca dari `rankValues` dan `rankEffects`.

## 3. Field yang dibaca

Resolver membaca `damageProfile`, `statScaling`, `targeting`, `resourceCost`, `cooldown`, `rankLevelRequirements`, `spCostPerRank`, `prerequisiteSkills`, `weaponRequirement`, `effects`, `stunProfile`, status Armor Break, dan sequence hit runtime.

## 4. Formula resolver

Preview damage memanggil `resolveHeroSkill` lalu `skillHitDamage`. Tidak ada formula kedua di UI, tidak ada random Critical/Accuracy, dan tidak ada target Defense.

## 5. Current preview resolver

Preview memakai stat, equipment, weapon, mastery, passive state, dan komposisi hit yang sama dengan runtime. Resolver pure dan tidak mengubah HP, Mana, cooldown, Flow, Tempo, status, inventory, atau save.

## 6. Damage skill

K-panel V3 menampilkan Damage Type, Hits, Physical Attack, hanya stat scaling yang relevan, area/targeting, resource, serta total raw damage sebelum Defense target.

## 7. Buff

Buff menampilkan effect canonical dan nilai modifier rank. Battle Cry menggunakan label **Physical Damage**, bukan Physical Attack.

## 8. Heal

Renderer mempertahankan jalur heal existing dan menggunakan `skillHealingPreview` untuk preview heal berbasis state karakter saat ini.

## 9. Passive

Passive existing tetap memakai deskripsi dan effect registry. Tidak ada fake Mana/Cooldown cast pada passive.

## 10. Multi-hit

Total dan breakdown per hit ditampilkan dari `hitSequence` yang resolved. Sequence tidak diasumsikan sama rata.

## 11. Dual Wield

Label player-facing memetakan main/off/both ke bahasa pemain. Twin Assault dan Blade Tempest memakai sequence hit runtime; Cross Sever menampilkan Both Swords.

## 12. Conditional mechanics

Payoff hanya ditampilkan sebagai mechanic kontekstual. Base preview tetap merupakan raw damage normal dan tidak otomatis menambahkan kondisi yang belum aktif.

## 13. Flow

Tag Flow yang canonical diterjemahkan menjadi `Successful skill +1 Flow`, tanpa mengekspos token internal.

## 14. Tempo

Tag dan effect Tempo diterjemahkan menjadi mechanic player-facing. Tidak ada angka Tempo baru di UI.

## 15. Armor Break

Armor Breaker membaca strength dan duration dari runtime. Crushing Finale menampilkan `Your Armor Break` sebagai payoff, bukan sebagai bonus pada hit penerap Armor Break.

## 16. Stun

Chance, durasi PvE, dan minimum travel distance dibaca dari `stunProfile`. Earth Splitter tetap dipresentasikan sebagai per-target chance.

## 17. Next-rank comparison

Section hanya menampilkan field yang berubah: coefficient, stat scaling, Mana, cooldown, radius, target cap, dan stun chance. Skill max rank menampilkan `MAX RANK`.

## 18. Locked skill

Metadata skill tetap dapat dirender walaupun rank 0. Status K-panel tetap berasal dari status progression existing sehingga skill locked tidak diperlakukan sebagai usable.

## 19. K-panel UI

Right detail panel existing dipertahankan. Jalur V3 mendapatkan section Requirements, Damage Scaling/Effect, Special Mechanic, Area/Targeting, Resource, Current Preview, dan Next Rank dengan scroll internal compact.

## 20. Screenshots

Belum diambil pada sesi ini karena `node`, `npm`, dan `pnpm` tidak tersedia di PATH environment. Browser acceptance perlu dijalankan setelah toolchain aktif.

## 21. Focused tests

Ditambahkan `lib/game/skill-presentation-v3.test.ts` dengan coverage Warrior Strike, Twin Assault, Earth Splitter, Armor Breaker, Battle Cry, Fury Harvest, dan Blade Tempest.

## 22. Full regression

Belum dijalankan karena runner Node/package manager tidak tersedia pada environment saat implementasi.

## 23. Production build

Belum dijalankan karena `pnpm` tidak tersedia.

## 24. Browser errors/warnings

Belum dapat diverifikasi tanpa dev server/browser runner. Tidak ada warning compiler/editor pada file yang disentuh.

## 25. Known limitations

Validasi executable, headed browser, screenshot, dan pengukuran preview terhadap controlled character masih pending. Beberapa mechanic khusus yang belum memiliki metadata canonical terstruktur hanya menampilkan effect/tag yang tersedia.

## 26. Future jobs

Model sudah memisahkan physical/magic/stat scaling dan menggunakan field generic, sehingga dapat diperluas untuk Mage/Acolyte tanpa mengubah renderer utama. Implementasi fase ini tidak mengubah combat, progression, equipment, save, monster, atau balance.