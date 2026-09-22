# LUMENFALL — SPV3-7B Blade Master Advanced Specialization

Status: implementasi lokal selesai; fixture browser bersih PASS, regression `lib/game` 434/434, production build PASS. **Tidak dipublikasikan.**

## 1. Pohon akhir dan biaya SP

Blade Master V3 kini tepat sembilan skill: Twin Blade Mastery, Twin Assault, Blade Rush, Counterflow, Blade Focus (7A), Cross Sever, Piercing Sequence, Tempo Drive, Blade Tempest (7B). Tidak ada AoE khusus Blade Master; Sweeping Slash/Ground Breaker tetap berasal dari Warrior. Total teoritis 38 rank biasa × 3 SP + 5 Mastery × 4 SP + 3 Ultimate × 5 SP = **149 SP**. Kurva pemasukan SP global tidak diubah.

| Skill baru | Rank/level | Prasyarat | Senjata | Jenis |
| --- | --- | --- | --- | --- |
| Cross Sever | R5: 66/69/72/76/80 | Twin Assault R3 | Dua 1H Sword | Satu impact sinkron |
| Piercing Sequence | R5: 68/71/74/77/80 | Blade Rush R2 dan Armor Breaker R3 | 1H/2H/dual | Tiga impact tunggal |
| Tempo Drive | R5: 71/73/75/78/80 | Twin Assault R4 | Dua 1H Sword | Self buff |
| Blade Tempest | R3: 75/78/80 | Mastery R3 dan 18 SP di Blade Master | Dua 1H Sword | Ultimate lima impact |

## 2. Damage, mode senjata, dan prasyarat

Cross Sever: DUAL_COMBINED, satu roll Crit, `shared core × total coefficient + Main Weapon ATK × coefficient + Offhand Weapon ATK × coefficient`, tanpa penalti offhand. Coefficient R1–R5 1.20/1.28/1.35/1.43/1.50; Bonus STR 0.12–0.20, Bonus DEX 0.18–0.30. Mana 16/17/18/20/21; cooldown 8/7.8/7.6/7.4/7.2. Satu hit berhasil dapat menghasilkan **satu** Tempo.

Piercing Sequence: tiga hit 30/30/40 persen, shared contribution 30/30/40 persen, crit independen. Dalam dual-wield, ketiga hit memakai **raw Main Hand saja**; statistik karakter dari kedua item tetap dihitung sekali. Coefficient total 1.15/1.25/1.35/1.45/1.55; Bonus STR 0.08–0.14; Bonus DEX 0.20–0.36. Mana 15/16/17/18/20; cooldown 8.5/8.1/7.7/7.3/7.0. Armor Break *milik caster* menambah Accuracy +10 ke tiap hit dan Critical Rate +10 poin persentase hanya pada hit ketiga. Status milik aktor lain tidak memicu sinergi. Mitigasi Defense tetap mengikuti aplikasi Armor Break terkuat, terpisah dari kepemilikan sinergi.

Blade Tempest: lima hit nyata MAIN/OFF/MAIN/OFF/BOTH, bobot shared 0.15/0.15/0.15/0.15/0.40 (jumlah 1). Koefisien per rank: R1 0.25×4 + 0.75 = 1.75; R2 0.28×4 + 0.88 = 2.00; R3 0.30×4 + 1.05 = 2.25. Bonus STR total 0.18/0.22/0.26 dan Bonus DEX 0.28/0.34/0.40 dibagi dengan bobot yang sama. Mana 36/40/44, cooldown 70/68/65 detik. Timing hit tetap 0/0.18/0.36/0.54/0.72 detik; ASPD Tempo Drive tidak memampatkan sequence. Keempat skill baru tidak memberi Stun, knockback, displacement, atau AoE.

Jalur resolver mempertahankan koefisien deklaratif untuk diagnosis/preview, tetapi memakai `composedPhysicalPower` per hit untuk damage aktual. Stat scaling eksplisit per-hit mengikuti bobot shared; raw weapon layer dipilih oleh MAIN/OFF/BOTH. Twin Assault 7A juga memakai komposisi eksplisit ini supaya shared core tidak terduplikasi dalam dua hit. Tidak ada perubahan pada angka koefisien skill 7A.

## 3. Flow, Tempo, dan Tempo Drive

Flow tetap dibuka Blade Rush/Counterflow. Konsumen sekarang Twin Assault, Cross Sever, Piercing Sequence, Blade Tempest. `BladeMasterImpactSession` dipakai baik oleh world maupun fixture: Flow memberi +5 poin persentase Crit ke seluruh sequence, dikonsumsi hanya setelah damage pertama benar-benar masuk. Cast invalid atau impact gagal tidak mengonsumsi.

Tempo adalah state sementara maksimal tiga stack. Generator hanya Twin Assault dan Cross Sever, masing-masing maksimum **satu stack per cast yang benar-benar melukai target**, bukan per hit. Generasi aktif hanya ketika Tempo Drive R1 atau Blade Tempest R1 dipelajari dan dual-wield valid. Mastery R1–R5 memberi lifetime 5/5.5/6/6.5/7 detik; setiap stack baru menyegarkan expiry seluruh stack. Kehilangan dual capability/perlengkapan/specialization, reset combat, atau reload membersihkan Tempo. Combat feedback memberi indikator `TEMPO` 0–3, bukan resource bar permanen.

Tempo Drive menolak 0 stack dengan `TEMPO_REQUIRED`. Cast sukses memakan semua stack. Durasi 5.5/7/8.5 detik untuk 1/2/3 stack. ASPD = dasar rank 4/5/6/7/8% + 4 poin per stack; Mana reduction = dasar rank 2/3/4/5/6% + 4 poin per stack. Yang dipakai adalah **nilai terbesar** dari pengurangan karakter, Mastery, dan Drive; tidak dijumlahkan. Efisiensi Drive hanya untuk Twin Assault, Cross Sever, Blade Tempest. Attack Speed masuk modifier karakter sementara untuk Basic Attack yang relevan. Tempo Drive tidak menambah raw damage.

**Keputusan owner masih diperlukan:** kontrak 7B tidak memberi angka Mana cost dan cooldown Tempo Drive. Definisi desain menyimpannya sebagai `NOT_DEFINED`; adapter runtime memakai fallback netral 0 MP/0 detik agar skill dapat divalidasi, bukan mengklaim angka balance final. Jangan memfinalkan angka tanpa keputusan owner.

Blade Tempest mengambil snapshot Tempo saat cast. Tepat tiga stack baru dikonsumsi pada hit pertama yang benar-benar melukai target; 0/1/2 stack tetap ada. Finisher hit kelima menerima +25 poin Crit dan +10% damage **khusus hit kelima** jika snapshot tiga stack. Flow dapat menambahkan +5 poin Crit ke kelima hit bersamaan dengan bonus finisher. Tempo Drive dan finisher menggunakan stack yang sama secara eksklusif.

## 4. Save, hotbar, dan berkas

Rank, job, SP, equipment dan hotbar tetap mengikuti save V3. Flow, Tempo, Tempo Drive, CounterContext, urutan basic hand, dan Stun berada pada state runtime; Tempo Drive tidak dimasukkan ke `activeBuffs` tersimpan. PrimaryHotbar sekarang mengenali skill Blade Master V3 yang dipelajari dan menolak passive/unlearned skill; ini memperbaiki bug integrasi 7A yang ditemukan saat pengujian 7B.

Berkas implementasi: `lib/game/blade-master-v3.ts`, `lib/game/blade-master-impact.ts`, `lib/game/combat-transient.ts`, `lib/game/skill-action.ts`, `lib/game/skills.ts`, `lib/game/rules.ts`, `lib/game/world.ts`, `lib/game/hotbar.ts`. Tes/fixture: `lib/game/blade-master-v3-advanced.test.ts`, `lib/game/blade-master-v3.test.ts`, `lib/game/blade-master-7a-fixture.ts`, `lib/game/blade-master-7b-fixture.ts`, `tests/browser/blade-master-7b-fixture.ts`, `tests/browser/blade-master-7b-fixture.html`, `scripts/verify-blade-master-7a.mjs`, `scripts/verify-blade-master-7b.mjs`.

## 5. Matrix sanity (diagnostik, bukan rebalance)

Equipment terkontrol: dual Main ATK 100 + Off ATK 70; perbandingan Berserker memakai 2H ATK 170; target Defense 100. Angka skill adalah perkiraan damage sesudah mitigasi, dengan peluang Crit dihitung sebagai nilai harapan, tanpa monster balance/knockback. Rank yang dipakai tidak melebihi gate level. Bonus Armor Break memakai target Defense turun 9% (contoh rank Warrior), bukan damage multiplier. Basic main/off adalah power sebelum mitigasi.

| Metrik | Lv75 | Lv80 |
| --- | ---: | ---: |
| Dual Basic Main / Off | 189 / 159 | 195 / 165 |
| Twin Assault | 173.35 | 195.58 |
| Cross Sever | 329.75 | 376.04 |
| Piercing Sequence normal / own Armor Break | 241.19 / 247.56 | 286.28 / 293.79 |
| Counterflow (potensi hit; event defense harus valid untuk cast) | 288.29 | 312.74 |
| Blade Tempest normal / Flow | 346.70 / 355.22 | 466.74 / 478.21 |
| Blade Tempest 3 Tempo / Flow+3 Tempo | 388.79 / 397.75 | 524.97 / 537.04 |
| Berserker Crushing Blow / Earth Splitter | 354.63 / 333.33 | 386.29 / 388.14 |

Tempest R3 dengan 3 Tempo mencapai ~525 expected damage Lv80 terhadap target ini, lebih tinggi dari pembanding Berserker tunggal; ini **diagnostik identitas Ultimate**, bukan alasan untuk nerf otomatis. Cross Sever memakai dua full weapon layer sesuai kontrak. Perbandingan Earth Splitter tidak menghitung nilai AoE pack/stun; tidak setara langsung dengan skill single-target Blade Master.

## 6. Fixture browser dan regresi

Fixture browser Chrome headless dibangun sendiri tanpa dev server, tanpa `world.ts`, terrain, map, GLB, NPC, monster population, audio, atau Flaris. Dependency utama: Hero V3/rules → item/dual-wield/CFV3 → skill-action/SkillHitQueue → source-owned combat-status → `BladeMasterImpactSession` → transient combat state. Satu fungsi impact yang sama dipakai `Game.applySkill` dan fixture. RNG dibuat deterministik tanpa memaksa Crit; HP berkurang melalui `skillHitDamage` dan `mitigateDamage` produksi.

Kasus A Cross Sever: 1 impact BOTH, HP 10000→9631, shared core 95 dan weapon 100+70, Tempo 0→1. B Piercing: 3 MAIN, bobot .3/.3/.4; aktor B punya Armor Break tetapi caster A tidak memperoleh +10 Crit; sesudah A memberi Armor Break sendiri hit ketiga 3.5→13.5% Crit; Flow memberi +5 ke ketiganya. C Tempo: 1/2/3/3 stack, refresh dan expiry diuji. D Drive R5: konsumsi 1/2/3; durasi 5.5/7/8.5, ASPD 12/16/20%, penghematan MP 10/14/18%. E Tempest: 5 hit MAIN/OFF/MAIN/OFF/BOTH. F snapshot tiga Tempo 3→0 pada hit pertama; Crit finisher 3.5→28.5%, damage akhir 247→272, empat hit pertama tetap. G Flow+3 Tempo: Flow aktif→habis, kelima hit +5 poin Crit, finisher 33.5% Crit dan bonus damage hanya pada hit terakhir. Tidak ada page/console/request errors. Bukti: `output/release-audit/blade-master-7b/results.json` dan `fixture.png`.

Focused Blade Master/dual-wield/Warrior/Berserker/Stun/Armor Break/SPV3/hotbar: **69 passed, 0 failed**. Fixture 7A dan 7B: **PASS**. Full `node --test lib/game/*.test.ts`: **434 passed, 0 failed**. `vinext build`: **PASS**; hanya peringatan ukuran chunk >500 kB dan klasifikasi route dinamis, bukan error build. TypeScript `tsc --noEmit` seluruh workspace masih memiliki kesalahan lama di beberapa salinan/staging dan modul lain; tidak dinyatakan hijau. Tidak ada error TypeScript baru pada berkas Blade Master/fixture yang diperiksa.

## 7. Keterbatasan dan rekomendasi

Fixture browser membuktikan komponen combat aktual dan lifecycle impact yang sama, tetapi **bukan** uji headed penuh dengan world/animasi/target visual. Tidak ada pengubahan monster, PvP, final asset, atau animasi. Accuracy +10 Piercing tercatat pada hit sequence namun engine saat ini belum mempunyai roll akurasi untuk serangan skill; efek gameplay Accuracy menunggu mekanik hit-chance umum, bukan diimprovisasi khusus Blade Master. Mana/CD Tempo Drive masih `NOT_DEFINED` dalam desain. Setelah review owner atas dua hal tersebut, lakukan regression akhir Warrior lineage V3 dan uji world terarah bila diperlukan; jangan lanjut Crimson Blade/Executioner otomatis.
