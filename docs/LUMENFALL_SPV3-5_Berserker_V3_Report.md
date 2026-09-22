# LUMENFALL — SPV3-5 Berserker V3 Report

Status: **IMPLEMENTED / RUNTIME VALIDATED**

Tanggal: 2026-09-22

## Ringkasan

Berserker V3 sudah ditambahkan sebagai specialization pertama pada jalur:

`Adventurer → Warrior → Berserker`

Implementasi memakai fondasi CFV3, SPV3, resolver Stun universal, dan clean combat fixture. Fixture browser tidak mengimpor `world.ts`, terrain, GLB, map, NPC, monster population, atau Flaris.

## 1. Specialization job change

- Minimum level: Lv60.
- Skill SP yang sudah dibeli direfund saat Warrior → Berserker.
- `totalEarnedSP` tetap.
- `chosenCoreJob = warrior` tetap.
- `chosenSpecialization = berserker` tersimpan.
- Tidak ada skill Berserker yang otomatis dibeli.
- Adventurer dan Warrior tetap menjadi ancestry yang dapat diakses.
- Blade Master tetap sibling branch yang terkunci.
- Karakter V2 tidak dimigrasikan otomatis.

## 2. Sembilan skill canonical

1. Two-Hand Sword Mastery
2. Raging Cleave
3. Crushing Blow
4. Iron Blood
5. Breaker Entry
6. Earth Splitter
7. Ruinous Arc
8. Fury Harvest
9. Berserker Trance

Tidak ada passive filler tambahan.

## 3. Rank, SP, dan prerequisite

- Skill normal: 3 SP/rank.
- Two-Hand Sword Mastery: 4 SP/rank.
- Berserker Trance: 5 SP/rank.
- Total teoritis full tree: 149 SP.
- Rank level gate, cross-tier prerequisite, job-investment requirement, dan ultimate gate memakai resolver SPV3 generik.
- `Raging Cleave` memakai Warrior Sweeping Slash R4.
- `Breaker Entry` memakai Iron Charge R3.
- `Earth Splitter` memakai Raging Cleave R3.
- `Ruinous Arc` memakai Armor Breaker R3.
- `Fury Harvest` memakai Earth Splitter R3 dan Iron Blood R2.
- `Berserker Trance` memakai Mastery R3 dan minimum 18 SP investasi Berserker.

## 4. Weapon rules

- Mastery, Raging Cleave, Crushing Blow, Earth Splitter, Ruinous Arc, Fury Harvest, dan Trance memerlukan Two-Hand Sword sesuai kontrak.
- Breaker Entry menerima One-Hand Sword atau Two-Hand Sword karena merupakan follow-up dari Warrior frontline.
- Warrior ancestry tetap dapat dipakai dengan One-Hand Sword maupun Two-Hand Sword.
- Mastery tidak membuka weapon baru, tidak menambah Weapon ATK, STR, atau hidden physical-damage multiplier.

## 5. Two-Hand Sword Mastery

Saat Two-Hand Sword aktif, Mastery memberi Accuracy +2/+4/+6/+8/+10 dan pengurangan Mana 2%/4%/6%/8%/10% hanya untuk skill Berserker V3 berbasis Two-Hand Sword. Skill Warrior ancestry tidak ikut mendapat pengurangan Mana.

## 6. Scaling dan damage

Seluruh serangan memakai CFV3 Physical Attack dan explicit Bonus STR scaling dari data V3. Tidak ada global STR ×2, legacy `hero.weapon × 8`, atau Stagger scaling baru. Semua hit tetap satu gameplay hit kecuali aturan target AoE yang dinyatakan oleh skill.

Ruinous Arc memberi payoff 8% satu kali saat target memiliki Armor Break. Belum ada penggandaan payoff tambahan. Sumber status Armor Break masih mengikuti status combat yang tersedia saat ini dan akan memerlukan source-owner hardening bila status sharing lintas aktor dibuka di fase berikutnya.

## 7. Iron Blood

Iron Blood memberi temporary Max HP dan Damage Reduction sesuai rank. Max HP sementara dihitung aman terhadap HP saat ini; aktivasi berulang tidak membuat heal gratis, dan expiry melakukan clamp kembali ke Max HP yang valid.

## 8. Breaker Entry window

Successful Iron Charge impact membuka `BREAKER_ENTRY_WINDOW` selama 4 detik. Window dibuka oleh impact sukses, bukan oleh Stun. Breaker Entry tidak melakukan charge kedua. Cast yang valid mengonsumsi window; cast invalid tidak mengonsumsinya.

Iron Charge damage, movement, stop distance, impact validation, Stun threshold, chance, duration, cooldown, dan Mana tidak diubah.

## 9. Earth Splitter dan Stun

Earth Splitter memakai subsystem `stun.ts` yang sama dengan Iron Charge. Chance per target: 8%/10%/12%/15%/18%; PvE duration 1.5 detik; PvP override 0.75 detik hanya disimpan sebagai profile data, tanpa PvP runtime.

Setiap target melakukan roll sendiri. Damage tetap terjadi walaupun Stun gagal. `stunImmune`/policy menolak Stun tanpa membatalkan damage. Reapplication tetap non-additive. Knockback tetap nol.

## 10. Fury Harvest

Recovery dihitung dari target yang benar-benar berhasil terkena, maksimum lima target. Nilai per target adalah 0.6%/0.7%/0.8%/0.9%/1.0% Max HP. Target invalid atau miss tidak dihitung.

## 11. Berserker Trance dan Frenzy Guard

Trance memerlukan Two-Hand Sword dan memberi final damage Berserker V3 Two-Hand sebesar 6%/8%/10% selama 12/14/16 detik. Warrior ancestry tidak ikut bonus. AoE cap Berserker bertambah satu hanya selama state aktif.

Jika skill damage Berserker berhasil mengenai minimal tiga target aktual, Frenzy Guard memberi Damage Reduction 4%/5%/6% selama 2 detik. Refresh diperbolehkan, stacking tidak.

## 12. Ancestry, hotbar, dan save

- Sembilan skill muncul pada registry Berserker V3.
- Delapan skill aktif dapat dipakai pada PrimaryHotbar setelah dipelajari.
- Mastery tidak assignable ke hotbar.
- Skill Warrior dan Adventurer tetap dapat dipilih melalui ancestry.
- Blade Master tidak dapat dipurchase.
- Rank, specialization, total SP, dan hotbar reference aman saat save/reload.
- Stun, Breaker Entry window, Trance duration, dan Frenzy Guard tidak dipersist.

## 13. Damage sanity

Diagnostic Berserker fixture memakai CFV3 attack path dengan representasi Two-Hand Sword. Contoh runtime rank tinggi yang terekam:

| Skenario | Physical hit | Hasil |
|---|---:|---|
| Earth Splitter R5, target normal | 369 | damage masuk, Stun eligible |
| Fury Harvest R5, target aktual | 287 | 7 target aktual, heal dibatasi 5 target |
| Raging Cleave R8 saat Trance R3 | 332 | final bonus 10% dan cap Trance aktif |
| Breaker Entry R1 | 163 | window dikonsumsi setelah cast sukses |

Nilai ini adalah diagnostic runtime dengan fixture level 80 dan target defense fixture, bukan rebalance monster.

## 14. AoE sanity

- Earth Splitter rank tinggi mengenai 8 target fixture sesuai cap.
- Setiap target Earth Splitter memiliki hasil Stun independen.
- Target kedelapan yang diberi `stunImmune` menerima damage tetapi tidak Stun.
- Fury Harvest memproses 7 target aktual namun healing tetap dibatasi lima target.
- Trance menaikkan cap Raging Cleave dan Frenzy Guard aktif ketika target aktual minimal tiga.
- Tidak ada phantom target counting.

## 15. Browser/runtime fixture evidence

Fixture:

`tests/browser/berserker-fixture.html`

Bundle development-only:

`tests/browser/berserker-fixture.bundle.js`

Verifier memakai Chromium headless, satu server Vite fixture pada port 3016, tanpa Cloudflare/Sites plugin dan tanpa full world import. Hasil:

`PASS — errors: [] — worldImported: false`

Evidence:

- [JSON runtime evidence](../tests/browser/berserker-evidence/01-full-fixture.json)
- [Screenshot fixture](../tests/browser/berserker-evidence/01-full-fixture.png)

## 16. Test results

Focused SPV3/Warrior/Stun/Berserker tests: **35 passed / 0 failed**.

Full `lib/game` regression: **405 passed / 0 failed**.

Clean Berserker browser fixture: **PASS**.

Browser diagnostics: **0 console error/warning, 0 page error, 0 failed request** pada verification run.

TypeScript workspace-wide check masih melaporkan error baseline di area legacy UI, publish output, dan kontrak lama yang berada di luar scope SPV3-5. Error tersebut tidak muncul sebagai kegagalan pada focused test, full `lib/game`, atau browser fixture Berserker.

## 17. Known limitations

- Belum ada Blade Master, Dual Wield, Executioner, PvP runtime, monster rebalance, final animation, atau full K-panel redesign.
- Source ownership Armor Break masih mengikuti status combat yang tersedia; hardening lintas-actor dapat dilakukan pada fase combat-status berikutnya.
- Clean browser fixture memvalidasi combat runtime terisolasi, bukan traversal pada world/map.
- Global SP income curve belum dikunci.

## 18. Rekomendasi sebelum Dual Wield / Blade Master

Owner review disarankan pada tiga hal: identitas Berserker Two-Hand versus Warrior AoE, source ownership Armor Break, dan angka 149 SP terhadap economy curve. Setelah review, fase berikutnya dapat mengaudit Blade Master tanpa mengubah Berserker yang sudah tervalidasi.

**STOP CONDITION TERPENUHI:** Berserker V3 sudah diimplementasikan, diuji, divalidasi pada clean runtime fixture, dan didokumentasikan. Tidak ada implementasi otomatis ke Blade Master atau Dual Wield.
