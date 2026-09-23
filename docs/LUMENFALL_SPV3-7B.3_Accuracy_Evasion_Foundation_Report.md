# LUMENFALL SPV3-7B.3 — Accuracy vs Evasion Foundation Report

Status: **IMPLEMENTED — MODEL B VALIDATED**

## 1. Model B yang diimplementasikan

Resolver umum yang digunakan adalah:

- \`accuracyPressure = (attackerAccuracy - 90) × 0.1\`
- \`effectiveEvasion = clamp(targetEvasion - accuracyPressure, 0, 50)\`
- \`hitChance = 1 - effectiveEvasion / 100\`

Resolver mengembalikan data terstruktur:

- Accuracy attacker;
- Evasion target;
- Accuracy pressure;
- Effective Evasion;
- Hit Chance;
- RNG roll;
- hasil \`HIT\` atau \`EVADED\`.

Tidak ada dua roll terpisah Accuracy lalu Evasion.

## 2. Neutral anchor dan batas formula

Accuracy 90 adalah anchor netral. Formula Accuracy dan Evasion yang sudah ada tidak diubah:

- Accuracy tetap berasal dari 90, DEX, equipment, Rune, Unique Stats, dan modifier aktif.
- Evasion tetap berasal dari DEX × 0.1 serta kontribusi equipment/Rune/Unique Stats/modifier yang tersedia.

Tidak ada Accuracy cap baru.

Effective Evasion dibatasi 0–50, sehingga Hit Chance minimum adalah 50% dan maksimum 100%.

## 3. Basic Attack

Basic Attack sekarang menggunakan resolver yang sama sebelum Critical dan damage.

Urutannya:

1. validasi target;
2. resolver Accuracy vs Evasion;
3. jika evaded, hit berhenti;
4. Critical roll;
5. damage;
6. mitigation dan HP.

Monster yang tidak memiliki Evasion diperlakukan sebagai Evasion 0. Dengan demikian perilaku PvE normal tetap efektif 100% hit dan tidak mengalami perubahan damage yang tidak diinginkan.

Basic Attack tetap tidak memberikan Stun dan tidak menambahkan knockback baru.

## 4. Active skill dan urutan impact

Setiap gameplay hit skill aktif menggunakan resolver setelah target/impact valid dan sebelum Critical.

Jika hasilnya \`EVADED\`:

- tidak ada damage;
- tidak ada Critical roll;
- tidak ada Stun;
- tidak ada Armor Break/debuff;
- tidak ada proc berbasis damage;
- tidak ada Flow consumption;
- tidak ada Tempo generation;
- tidak ada Fury Harvest recovery dari target tersebut.

Critical tidak pernah dijalankan sebelum hit lolos.

## 5. Multi-hit

Resolver dipanggil satu kali untuk setiap gameplay hit:

- Twin Assault: 2 roll;
- Piercing Sequence: 3 roll;
- Blade Tempest: 5 roll;
- skill multi-target: satu roll per target.

Hit yang evaded tidak membatalkan hit berikutnya. Sequence tetap berjalan selama target/action masih valid.

## 6. Flow dan Tempo

Flow hanya dikonsumsi pada successful damaging impact pertama. Hit yang evaded tidak mengonsumsi Flow.

Tempo hanya dihasilkan bila generator yang disetujui memiliki setidaknya satu successful damaging impact:

- kedua hit Twin Assault evaded: 0 Tempo;
- salah satu hit Twin Assault berhasil: tepat +1 Tempo;
- Cross Sever evaded: 0 Tempo;
- Cross Sever berhasil: +1 Tempo.

Fixture deterministik memvalidasi Flow dan Tempo pada kombinasi hit berhasil/evaded.

## 7. Piercing Sequence dan Armor Break

Bonus Armor Break milik caster tetap +10 Accuracy untuk Piercing Sequence. Bonus ini masuk ke Accuracy sebelum resolver, bukan dikonversi menjadi Critical atau damage.

Bukti fixture dengan target Evasion 10 dan roll 0.93:

- tanpa Armor Break milik caster: effective Evasion 7.5%, Hit Chance 92.5% → EVADED;
- Armor Break milik actor lain: tetap EVADED;
- Armor Break milik caster +10 Accuracy: effective Evasion 6.5%, Hit Chance 93.5% → HIT.

Jadi bonus source-owned Armor Break benar-benar mengubah hasil hit sesuai kontrak.

## 8. Bonus Accuracy yang sekarang masuk resolver

Nilai canonical yang sudah ada dipertahankan dan kini mengalir ke resolver melalui Accuracy attacker:

- Warrior Battle Focus: +5 / +7 / +9 / +11 / +13;
- Blade Focus: +6 / +9 / +12 / +15 / +18;
- Berserker Two-Hand Sword Mastery: +2 / +4 / +6 / +8 / +10;
- Blade Master Twin Blade Mastery: +2 / +4 / +6 / +8 / +10.

Tidak ada double-counting Accuracy atau Critical.

## 9. Movement skill

Movement terjadi lebih dahulu dan tidak dibatalkan apabila impact kemudian evaded.

Untuk Iron Charge dan Blade Rush:

- charge/movement tetap selesai;
- impact tetap divalidasi;
- resolver dilakukan di impact;
- jika evaded, damage dan efek yang bergantung pada hit tidak diterapkan.

Khusus Iron Charge, impact yang evaded tidak menerapkan Stun.

## 10. AoE dan target individual

Skill AoE memproses setiap target secara independen.

Fixture Earth Splitter membuktikan:

- target yang hit dapat menerima damage dan melanjutkan ke Stun roll;
- target yang evaded tidak menerima damage dan tidak menerima Stun.

Fury Harvest hanya menghitung target yang benar-benar berhasil terkena damage. Target yang evaded tidak dihitung sebagai target healing. Batas maksimum lima target tetap dipertahankan.

## 11. Monster → Player

Jalur incoming monster tetap dipertahankan dan tidak dipindahkan ke Model B:

Parry → Evasion → mitigation → Block/Guard → barrier → HP.

Tidak ada Accuracy stat monster baru dan tidak ada Evasion baru yang ditambahkan ke definisi monster.

## 12. Combat Power

Combat Power tidak diubah. \`accuracyFactor\` tetap 1.

Karena benchmark monster saat ini memiliki Evasion 0, Accuracy belum mengubah expected PvE damage. Evaluasi Accuracy dalam Combat Power ditunda sampai target Evasion/PvP menjadi benchmark nyata.

## 13. Clean runtime fixture

Fixture baru:

- \`lib/game/accuracy-evasion-fixture.ts\`
- \`lib/game/accuracy-evasion.test.ts\`

Fixture bersifat world-free dan tidak mengimpor \`world.ts\`, terrain, map, GLB, NPC, audio, atau Flaris.

Fixture menggunakan komponen combat aktual yang relevan:

- skill hit resolution;
- \`ResolvedSkillHit\`;
- hit queue dan multi-hit session;
- Flow/Tempo;
- source-owned Armor Break;
- Stun;
- Model B resolver.

Kasus yang divalidasi:

- formula A–E;
- Basic Attack hit/evade;
- Twin Assault mixed-hit dan all-evade;
- Piercing ownership bonus;
- Blade Tempest mixed sequence;
- Earth Splitter per-target evasion dan Stun;
- Fury Harvest successful-target count.

## 14. Counterflow dan batasan yang dipertahankan

Counterflow tetap menggunakan kebijakan committed-cast yang sudah ada. Perubahan ini tidak membuat refund baru.

Jika impact Counterflow evaded, tidak ada damage atau Stun dan tidak ada efek yang mensyaratkan successful impact. Perilaku konsumsi CounterContext tetap mengikuti jalur yang sudah tervalidasi.

Validasi penuh HP-heal numerik Fury Harvest tidak dibuat ulang di fixture; yang diuji adalah sumber jumlah target berhasil yang masuk ke recovery dan cap lima target tetap tidak berubah.

Belum ada PvP runtime, monster Evasion/Accuracy, atau integrasi UI besar. Feedback evaded memakai feedback ringkas \`EVADE\`.

## 15. File yang diubah

- \`lib/game/combat-mechanics.ts\` — resolver Model B generik.
- \`lib/game/world.ts\` — integrasi Basic Attack dan skill impact sebelum Critical/damage.
- \`lib/game/accuracy-evasion-fixture.ts\` — fixture combat world-free.
- \`lib/game/accuracy-evasion.test.ts\` — deterministic tests.
- Dokumentasi audit SPV3-7B.2 tetap dipertahankan sebagai baseline read-only.

## 16. Hasil test

Focused suite:

- Accuracy/Evasion;
- Blade Master 7A/7B;
- Warrior;
- Berserker.

Hasil: **35 passed / 0 failed**.

Full \`lib/game\` regression:

- **444 passed / 0 failed**.

Production build:

- **berhasil / exit 0**.

Build hanya menampilkan warning non-fatal yang sudah bersifat umum pada workspace, termasuk optional import Vite/Nitro dan peringatan ukuran chunk. Tidak ada error build.

## 17. Kesimpulan dan readiness

**SPV3-7B.3 MODEL B — IMPLEMENTED, TESTED, DOCUMENTED.**

Foundation siap untuk review dan dapat menjadi dasar SPV3-8. Tahap berikutnya tetap harus menunggu keputusan owner.

Tidak diimplementasikan pada fase ini:

- monster Evasion;
- monster Accuracy;
- PvP;
- Combat Power Accuracy scoring;
- Thief V3;
- Advanced Jobs;
- final animation.

