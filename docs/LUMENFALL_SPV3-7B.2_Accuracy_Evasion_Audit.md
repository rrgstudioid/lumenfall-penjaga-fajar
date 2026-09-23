# LUMENFALL — SPV3-7B.2 Accuracy / Evasion Combat Foundation Audit

Status: READ-ONLY AUDIT — tidak ada perubahan gameplay  
Tanggal audit: 2026-09-23

## Ringkasan eksekutif

Accuracy saat ini mempunyai formula dan dibawa ke ResolvedSkillHit, tetapi belum mempunyai resolver hit/miss. Karena itu Accuracy belum memengaruhi keberhasilan serangan, termasuk Piercing Sequence dengan bonus Accuracy +10.

Evasion mempunyai formula dan roll runtime, tetapi roll tersebut hanya terjadi ketika karakter pemain menerima serangan melalui Game.hurtHero(). Monster tidak mempunyai stat Evasion di registry dan serangan pemain ke monster tidak menjalankan roll Evasion, Block, atau Parry pada target.

Combat Power mengabaikan Accuracy sepenuhnya (accuracyFactor: 1), sementara Evasion hanya dipakai sebagai estimasi defensive EHP. Tidak ada formula baru, balancing, atau perubahan code gameplay pada audit ini.

## 1. Formula Accuracy saat ini

Sumber utama berada di lib/game/rules.ts, fungsi derivedStats():

    Accuracy = 90
             + Effective DEX
             + Equipment/Rune/Unique Accuracy
             + conditional mastery Accuracy

Nilai dibulatkan ke satu angka desimal.

Effective DEX berasal dari base DEX 15, alokasi stat, dan kontribusi stat karakter yang masuk melalui pipeline equipment/passive. hero.weapon legacy tidak ikut menjadi sumber Accuracy.

Conditional mastery Accuracy:

- Berserker Two-Hand Sword Mastery: +2/+4/+6/+8/+10 apabila memakai Two-Hand Sword.
- Blade Master Twin Blade Mastery: +2/+4/+6/+8/+10 apabila memakai konfigurasi Dual Sword.

Belum ada cap Accuracy karena belum ada roll hit yang memakai nilai tersebut.

## 2. Seluruh sumber Accuracy

| Sumber | Jalur agregasi | Live gameplay sekarang | Combat Power |
|---|---|---|---|
| Base Accuracy 90 | derivedStats() | hanya menjadi nilai stats | tidak |
| DEX | base + allocation + kontribusi karakter | belum menjadi hit chance | tidak langsung |
| Equipment base/bonus | calculateEquipmentStats() | belum menjadi hit chance | tidak |
| Rune affix | socket → calculateRuneStats() → equipment stats | belum menjadi hit chance | tidak |
| Unique Stats | item bonus/unique pipeline | belum menjadi hit chance | tidak |
| Berserker Two-Hand Mastery | conditional masteryAccuracy | belum menjadi hit chance | tidak |
| Twin Blade Mastery | conditional masteryAccuracy | belum menjadi hit chance | tidak |
| Warrior V3 Battle Focus | temporary modifier +5/+7/+9/+11/+13 | tersimpan sebagai buff stat, belum di-roll | tidak |
| Blade Focus | temporary modifier +6/+9/+12/+15/+18 | tersimpan sebagai buff stat, belum di-roll | tidak |
| Piercing Sequence own Armor Break | hit-local accuracy +10 di BladeMasterImpactSession | tidak berpengaruh pada hit success | tidak |
| Legacy V2 modifiers | jalur V2 masing-masing | hanya pada jalur V2 yang memakainya | tidak untuk Accuracy |

Equipment dan Rune tidak diduplikasi: item base stats, bonus/unique stats, dan socket affix dijumlahkan melalui items.calculateEquipmentStats(), lalu equipment aktif dijumlahkan satu kali oleh rules.calculateEquipmentStats().

combat-modifiers.ts memang dapat menambahkan accuracyBonus ke field Accuracy pada hit, tetapi field tersebut hanya dibawa sebagai data. Tidak ada fungsi live yang membandingkannya dengan Evasion.

## 3. Formula dan runtime Evasion

Formula rules.ts:

    Evasion = Effective DEX × 0.1 + Equipment/Rune/Unique Evasion

Nilai dibulatkan ke satu angka desimal. Modifier sementara dapat menambah Evasion melalui applyStatModifiers().

Roll runtime combat-mechanics.ts:

    evasionChance(rate) = min(50%, rate / 100)

Jalur yang memakai roll:

- Monster → Player: YA, di Game.hurtHero(), setelah Parry dan sebelum mitigasi damage.
- Player Basic Attack → Monster: TIDAK.
- Player active physical skill → Monster: TIDAK.
- Player magic skill → Monster: TIDAK.
- Player → Player/PvP: runtime PvP belum aktif.
- Combat Power: hanya estimasi defensive EHP, bukan gameplay roll.

MonsterDefinition di lib/game/regions.ts tidak memiliki field Evasion. Tidak ada nilai Evasion monster tersembunyi yang ditemukan.

## 4. Urutan resolver aktual

### Player active skill → Monster

Urutan dari castSkill(), applySkill(), SkillHitQueue, dan hurtEnemy():

1. Cek action lock, Stun, game state, skill registry, level/weapon/mana/cooldown.
2. Snapshot target terpilih.
3. Auto-approach untuk skill bertarget atau movement dash bila diperlukan.
4. Ambil target berdasarkan tipe skill.
5. Jadwalkan setiap hit pada SkillHitQueue.
6. Saat impact, validasi actor/game aktif, target hidup, target masih terdaftar, target identity, dan impact range untuk dash.
7. Terapkan target modifier/source-owned status.
8. Roll Critical jika hit.canCrit.
9. Hitung skillHitDamage().
10. hurtEnemy() menerapkan boss/elite bonus, Armor Break, penetration, dan mitigateDamage().
11. Kurangi HP.
12. Knockback/feedback hanya jika knockbackStrength lebih besar dari nol.

Pada target monster tidak ada tahap live Parry, Evasion/Dodge, Block, atau invulnerability terpisah. targetAlive dan identity validation adalah validasi target, bukan invulnerability system.

### Player Basic Attack → Monster

1. Cek Stun, action lock, attack timer, target/range/facing.
2. Roll Critical dari stats.criticalRate.
3. Hitung Basic Attack power dan combo multiplier.
4. Panggil hurtEnemy() langsung.
5. Mitigasi, HP damage, dan knockback legacy bila ada.

Basic Attack juga tidak menjalankan Accuracy, Evasion, Block, atau Parry roll terhadap monster.

### Monster → Player

Urutan hurtHero():

1. Invincible/dead check.
2. Status Parry; jika aktif, serangan diparry.
3. Roll Evasion; jika berhasil, serangan berhenti.
4. Physical mitigation.
5. Transient damage reduction seperti Frenzy Guard.
6. Roll Block/manual guard.
7. Incoming modifiers.
8. Barrier absorption.
9. HP damage.
10. Displacement dan hit reaction.

Jadi urutan Parry → Evasion → Block → mitigation → barrier → HP hanya berlaku secara praktis untuk incoming monster attack, bukan serangan player ke monster.

## 5. Basic Attack versus active skill

| Aspek | Basic Attack | Active skill |
|---|---|---|
| Accuracy | tidak dipakai | field ada, tetapi tidak di-roll |
| Evasion target | tidak ada | tidak ada |
| Critical | satu roll per Basic Attack | satu roll per gameplay hit |
| Block/Parry target | tidak ada | tidak ada |
| Damage resolver | langsung lalu hurtEnemy() | resolveHeroSkill() → skillHitDamage() → hurtEnemy() |
| Multi-hit | combo adalah serangan terpisah | SkillHitQueue |
| Flow/Tempo | tidak berlaku | Blade Master impact session |

Keduanya memakai mitigasi target yang sama melalui hurtEnemy(), tetapi belum mempunyai attack hit-chance system.

## 6. Multi-hit Blade Master

### Twin Assault

- Dua impact nyata: MAIN lalu OFF.
- Setiap impact memiliki callback dan Critical roll sendiri.
- Tidak ada Evasion/Block/Parry target.
- Flow diambil pada first damaging impact yang valid.
- Tempo dihasilkan maksimal sekali untuk satu skill execution, bukan sekali per hit.

### Piercing Sequence

- Tiga impact nyata dengan bobot 30/30/40.
- Setiap hit dapat Critical secara independen.
- Bonus Accuracy +10 dari Armor Break caster sendiri hanya mengubah field hit-local dan belum memengaruhi hasil.
- Jika satu callback tidak valid, hit itu dilewati; hit terjadwal berikutnya masih dapat berjalan jika valid.
- Flow/Tempo menggunakan first valid damaging impact policy.

### Blade Tempest

- Lima impact nyata.
- Empat hit awal dan final hit mempunyai Critical roll masing-masing.
- Flow aktif pada first valid damaging impact dan dipakai untuk sequence.
- Enhanced finisher 3 Tempo hanya pada hit final.
- Tidak ada Evasion/Block/Parry target.

SkillHitQueue memvalidasi setiap hit secara terpisah. BladeMasterImpactSession mencegah konsumsi Flow/Tempo berulang melalui firstDamagingImpact.

## 7. Representative numeric ranges

Nilai berikut adalah controlled audit fixtures, bukan klaim bahwa semua gear sudah menjadi production item pada level yang sama.

Fixture:

- A: base stats, tidak ada allocation, equipment, Rune, mastery, atau buff.
- B: alokasi DEX yang masih berada dalam budget level.
- C: fixture B + equipment/Rune fixture +10 Accuracy dan +5 Evasion; Berserker/Blade Master juga memakai mastery R5 dengan weapon kompatibel.

| Karakter | Fixture | DEX efektif | Accuracy | Evasion |
|---|---|---:|---:|---:|
| Lv1 Adventurer | A | 15 | 105.0 | 1.5 |
| Lv1 Adventurer | B | 15 | 105.0 | 1.5 |
| Lv1 Adventurer | C | 15 | 115.0 | 6.5 |
| Lv15 Warrior | A | 15 | 105.0 | 1.5 |
| Lv15 Warrior | B (+10 DEX) | 25 | 115.0 | 2.5 |
| Lv15 Warrior | C | 25 | 125.0 | 7.5 |
| Lv60 Warrior | A | 15 | 105.0 | 1.5 |
| Lv60 Warrior | B (+30 DEX) | 45 | 135.0 | 4.5 |
| Lv60 Warrior | C | 45 | 145.0 | 9.5 |
| Lv80 Berserker | A | 15 | 105.0 | 1.5 |
| Lv80 Berserker | B (+40 DEX) | 55 | 145.0 | 5.5 |
| Lv80 Berserker | C, Two-Hand Mastery R5 | 55 | 155.0 | 10.5 |
| Lv80 Blade Master | A | 15 | 105.0 | 1.5 |
| Lv80 Blade Master | B (+40 DEX) | 55 | 145.0 | 5.5 |
| Lv80 Blade Master | C, Twin Blade Mastery R5 | 55 | 155.0 | 10.5 |

Pada fixture C, +10 Accuracy/+5 Evasion sengaja dikategorikan controlled fixture agar tidak disalahartikan sebagai drop/gear balance resmi. Level sendiri tidak menaikkan Accuracy/Evasion tanpa perubahan DEX, gear, Rune, passive, atau mastery.

## 8. Accuracy V3 yang saat ini tidak aktif

1. ResolvedSkillHit.accuracy menyimpan Accuracy hasil stats.
2. combat-modifiers.ts dapat menambahkan accuracyBonus.
3. BladeMasterImpactSession menambahkan +10 untuk Piercing Sequence bila Armor Break milik caster aktif.
4. Tidak ada fungsi yang membaca field tersebut untuk menghasilkan hit/miss.
5. Game.hurtEnemy() langsung memproses damage setelah Critical.
6. Combat Power menetapkan accuracyFactor: 1.

Kesimpulan: bonus Accuracy tersebut saat ini adalah resolved data only, bukan gameplay hit chance.

## 9. Model A — hit chance terpisah lalu Evasion

Bentuk: roll Accuracy/Hit Chance, lalu roll Evasion target.

Kelebihan: mudah dipahami, mudah memetakan bonus Accuracy, dan dapat memberi skill always-hit atau hit bonus.

Kekurangan: dua roll avoidance dapat menghasilkan miss terlalu sering; Accuracy dan Evasion berisiko sama-sama mandatory di PvP.

Dampak saat ini: serangan player yang selalu mendarat mulai dapat miss. Migrasinya sedang karena field Accuracy sudah tersedia tetapi resolver baru dan test semua jalur diperlukan.

PvE: berisiko menambah miss tanpa stat Evasion monster. PvP: berisiko double avoidance.

## 10. Model B — Accuracy mengurangi Evasion, satu roll

Bentuk: Accuracy attacker dan Evasion target menghasilkan satu net hit/avoidance roll.

Kelebihan: menghindari double miss, mudah menjaga PvE karena monster saat ini Evasion 0, dan bonus Accuracy tetap bermakna.

Kekurangan: perlu keputusan net formula, minimum hit chance, dan perilaku saat Accuracy lebih tinggi/rendah.

Dampak saat ini: perubahan utama berada di satu titik sebelum Critical, dengan risiko migrasi rendah-menengah jika monster tetap Evasion 0 pada tahap pertama.

PvE: paling mudah dikendalikan. PvP: tetap perlu cap/diminishing rule untuk high-DEX build.

## 11. Model C — unified Accuracy-vs-Evasion formula

Bentuk: satu formula final langsung menghasilkan hit probability dari Accuracy, Evasion, level, dan modifier.

Kelebihan: satu source of truth untuk Basic Attack, skill, dan PvP masa depan.

Kekurangan: paling invasif, paling sulit dituning, dan perlu adapter V2/V3 agar tidak mengubah legacy path.

Dampak saat ini: semua serangan dapat bergantung pada formula baru. Risiko migrasi tinggi.

PvE: fleksibel tetapi mudah membuat normal monster terlalu sering miss. PvP: kuat secara arsitektur tetapi berisiko DEX overload.

## 12. Semantik bonus skill

| Bonus | Model A | Model B | Model C |
|---|---|---|---|
| Piercing Sequence +10 Accuracy | bonus hit roll sequence | mengurangi effective target Evasion | input unified formula |
| Battle Focus | bonus hit roll sementara | bonus net Accuracy sementara | input unified formula |
| Blade Focus | bonus Accuracy sementara, terpisah dari Crit | bonus net Accuracy | input formula tanpa double-count |
| Twin Blade Mastery Accuracy | bonus saat Dual aktif | bonus net saat Dual aktif | input formula dengan weapon selector |

Semua bonus sebaiknya tetap menjadi Accuracy, bukan diam-diam menjadi Critical, Damage, atau Weapon ATK. Fase implementasi nanti harus menetapkan apakah Accuracy disnapshot saat cast atau diambil per hit.

## 13. Boss dan Monster policy

Monster registry tidak mempunyai Evasion. Boss/Elite hanya memiliki tuning HP, Attack, Defense/Magic Defense, speed, range, reward, dan multiplier terkait. Tidak ada Evasion value yang perlu dipertahankan atau dibuat pada fase ini.

## 14. Combat Power

Accuracy saat ini tidak berkontribusi langsung atau tidak langsung ke CP. Bukti:

- calculateCombatPowerFromStats() mengembalikan accuracyFactor: 1.
- Test inactive accuracy menetapkan Accuracy 99999 tetap menghasilkan CP yang sama.
- Evasion berbeda: dipakai untuk dodgeChance dan defensive EHP, tetapi bukan player attack gameplay roll.

Setelah Accuracy diaktifkan, CP sebaiknya memakai expected successful damage/hit reliability satu kali saja. Jangan menambahkan CP sebelum model hit disetujui owner.

## 15. File yang diaudit

- lib/game/rules.ts — DerivedStats, derivedStats(), equipment/passive aggregation, skill resolution.
- lib/game/combat-mechanics.ts — caps dan chance helpers.
- lib/game/combat-modifiers.ts — accuracyBonus, temporary modifiers, stat application.
- lib/game/skill-action.ts — ResolvedSkillHit, SkillHitQueue, per-hit damage.
- lib/game/world.ts — castSkill(), applySkill(), Basic Attack, hurtEnemy(), hurtHero().
- lib/game/items.ts — StatBlock, equipment/Rune/unique aggregation.
- lib/game/warrior-v3.ts — Battle Focus.
- lib/game/berserker-v3.ts — Two-Hand Sword Mastery.
- lib/game/blade-master-v3.ts — Twin Blade Mastery, Blade Focus, skill accuracy data.
- lib/game/blade-master-impact.ts — Piercing conditional Accuracy and Flow/Tempo state.
- lib/game/regions.ts — MonsterDefinition and monster registry.
- lib/game/combat-power.ts — CP evaluation.
- lib/game/combat-power.test.ts — inactive Accuracy and Evasion/Block cap assertions.
- lib/game/blade-master-7b-fixture.ts — world-free multi-hit fixture.

## 16. Rekomendasi implementasi berikutnya

1. Jangan mengubah damage, Critical, Block, Parry, monster stats, atau CP pada audit ini.
2. Pilih satu unified hit resolver yang dipanggil Basic Attack dan setiap gameplay hit.
3. Secara teknis Model B paling aman sebagai titik awal: satu roll Accuracy-versus-Evasion, monster Evasion tetap 0 sampai ada keputusan owner.
4. Pisahkan hit chance dari Critical; Critical hanya di-roll setelah hit berhasil.
5. Tetapkan per-hit behavior untuk multi-hit; Flow/Tempo tetap mengikuti first valid impact.
6. Tambahkan deterministic tests untuk Accuracy/Evasion 0 dan bonus, cap, Basic Attack, single-hit, Twin Assault, Piercing Sequence, Blade Tempest, target invalid, dan target immunity bila nanti dibutuhkan.
7. Jangan membuat Evasion monster atau PvP values sebelum policy target disetujui.
8. Evaluasi CP hanya setelah gameplay Accuracy benar-benar aktif.

## Kesimpulan dan STOP

Audit factual SPV3-7B.2 selesai. Tidak ada formula, stat, damage, Critical, Block, Parry, skill, Rune, monster, atau Combat Power yang diubah.

Keputusan owner yang diperlukan sebelum fase implementasi:

- memilih Model A, B, atau C;
- menetapkan apakah setiap hit melakukan roll sendiri;
- menetapkan minimum hit chance dan cap Accuracy;
- menetapkan apakah monster tetap Evasion 0;
- menetapkan kapan Accuracy masuk Combat Power.

STOP setelah audit.
