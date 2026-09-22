# LUMENFALL — World & Monster V2 Phase 5A
## Discovery Audit: Map, Monster, Progression, Spawn, Drop, dan Equipment

Tanggal audit: 20 September 2026  
Scope: source/runtime aktual, read-only.  
Perubahan production: **0**.

## Ringkasan untuk pemilik game

World saat ini adalah Chapter 1 dengan dua kota dan enam field progression utama. Ada dua field tambahan (`East Gate Arunika` dan `Sands Location`) yang memakai ulang konten monster/loot Verdant, bukan progression band baru.

Rantai konten utama yang benar-benar tersedia adalah:

`Kota Arunika → Padang Arunika → Tambang Selubung Besi → Rimba Bisik → Kota Jayantara → Dataran Bara-Beku → Reruntuhan Tenggelam → Benteng Hujan Meteor`

Konten monster production berakhir pada Lv50. Engine legacy cap juga 50; `v2_test` dapat berjalan sampai 80, tetapi belum memiliki map, monster, quest, atau loot progression di atas Lv50. Karena itu game belum menyediakan jalur alami Lv1–59 tanpa gap besar pada Lv51–59.

Monster saat ini seluruhnya memakai satu pola AI melee sederhana: deteksi jarak, chase, wind-up, serangan jarak dekat, cooldown, leash/return-home, stun/root/stagger pause, mati, lalu respawn. Tidak ditemukan monster ranged, caster, threat table, social aggro, party loot, summon, deployable, atau monster skill aktif yang benar-benar dipakai.

Loot sudah cukup extensible: drop chance per variant, family roll, rarity roll, rune, unique rune boss, socket/unique-stat generation, material, potion, pet, dan optimizer. Namun semua equipment juga tersedia di Equipment Merchant kota, sehingga sumber monster belum menjadi jalur acquisition yang eksklusif.

Tidak ada perubahan balance, spawn, map, monster, EXP, quest, drop, atau item pada audit ini.

---

## 1. Current World Overview

### Kota

| ID | Nama | Tipe | Reachable | Level deklaratif | Fungsi |
|---|---|---|---|---|---|
| `arunika` | Kota Arunika | town | ya, start | 1–24 | story, tutorial, core trainer, forge, equipment, consumable, storage, healer, pet, teleport, quest |
| `jayantara` | Kota Jayantara | town | ya saat level 24; `unlockQuest` tercatat tetapi tidak ditegakkan oleh `unlockReason` | 24–50 | specialization/mastery preview, forge, seal, equipment, consumable, storage, healer, pet, teleport, quest |

`WORLD_CONFIG.chapterCap = 1`, sehingga belum ada chapter kedua. `jayantara` adalah kota kedua yang nyata secara registry/runtime, bukan placeholder, tetapi progression-nya masih Chapter 1.

### Field/map

| ID | Display name | Kota | Kategori | Reachable | Level field | Monster level | Sub-area | Sambungan |
|---|---|---|---|---|---:|---|---|---|
| `verdant-plains` | Padang Arunika | Arunika | field | ya | 1–8 | 1,3,5,7,8 elite,10 boss | Gerbang Fajar; Padang Lumbung; Kuil Akar Tua | → `ironveil-mines` |
| `ironveil-mines` | Tambang Selubung Besi | Arunika | field | ya | 8–16 | 9,10,12,14,16 elite,18 boss | Pos Tambang Barat; Lorong Bijih Dalam; Galeri Runtuh | → `whispering-wilds` |
| `whispering-wilds` | Rimba Bisik | Arunika | field | ya | 16–24 | 16,17,20,22,24 elite,26 boss | Jalur Bambu; Hutan Kabut; Kanopi Leluhur | → `frostfire-highlands` |
| `frostfire-highlands` | Dataran Bara-Beku | Jayantara | field | ya | 24–32 | 24,25,28,30,32 elite,34 boss | Punggung Bara; Jalur Es Beku; Kaldera Abu | → `sunken-ruins` |
| `sunken-ruins` | Reruntuhan Tenggelam | Jayantara | field | ya | 32–42 | 32,33,37,40,42 elite,44 boss | Halaman Candi Terendam; Ruang Penjaga; Gudang Harta Banjir | → `meteorfall-citadel` |
| `meteorfall-citadel` | Benteng Hujan Meteor | Jayantara | field | ya | 42–50 | 42,43,46,48,49 elite,50 boss | Gerbang Bintang Jatuh; Padang Meteor; Inti Benteng Meteorfall | terminal |
| `east-gate-arunika` | East Gate Arunika | Arunika | field overlay/test-like expansion | ya | mewarisi 1–8 | mewarisi Verdant | Gerbang Timur; Dusun Purnama; Lembah Cahaya | → `ironveil-mines` |
| `sands-location` | Sands Location | Arunika | imported/showcase field | ya | mewarisi 1–8 | mewarisi Verdant | Pantai Pasir; Kuil Tenggelam; Dataran Oasis | terminal |

`east-gate-arunika` memakai `contentFamilyId: verdant-plains`; `sands-location` juga memakai konten Verdant. Keduanya bukan monster catalog baru.

### Dimensi dan terrain

- Kota memakai `WORLD_CONFIG.cityScale = 1.5`; layout runtime memakai half-extent kota sekitar 67.5 world units.
- Field procedural memakai `FIELD_LAYOUT.areaMultiplier = 2`, `FIELD_SCALE = sqrt(2)`, dan half-extent sekitar 63.64.
- Padang Arunika memiliki terrain authored: boundary radial, sungai, jembatan, pond, path, camp, sanctuary, arena, dan collision terrain.
- East Gate memiliki terrain authored sendiri dengan spawn zone/arena.
- Field lain menggunakan terrain/layout prosedural atau imported khusus Sands; tidak semuanya mempunyai landmark/zone runtime terpisah walaupun nama sub-area ada di registry.
- NPC field/camp berjumlah satu per field identity; kota Arunika dan Jayantara masing-masing memiliki 11 NPC plus Developer Material Lab di Arunika.
- Setiap field production memiliki 36 normal spawn, 5 elite spawn, dan 1 boss spawn = 42 instance runtime ketika field dibangun.

---

## 2. Map connection graph

```text
Main Menu
  └─ New Game / Load
      └─ Kota Arunika
          ├─ Padang Arunika
          │   └─ Tambang Selubung Besi
          │       └─ Rimba Bisik
          │           └─ unlock story-whispering-wilds → Kota Jayantara
          │               └─ Dataran Bara-Beku
          │                   └─ Reruntuhan Tenggelam
          │                       └─ Benteng Hujan Meteor
          ├─ East Gate Arunika → Tambang Selubung Besi
          └─ Sands Location (terminal showcase/imported field)
```

Travel juga dapat dilakukan melalui teleport service/map selection untuk region yang sudah lolos `unlockReason`. Field/city access saat ini terutama level-based; story/boss tidak menjadi gate umum karena `unlockReason` tidak memeriksa `unlockQuest`.

Tidak ditemukan one-way production transition yang memiliki destination tanpa registry. Exit/portal dibuat ulang saat `changeRegion`; map lama dibuang dan field baru dibangun. Sands tidak memiliki `nextMap`.

---

## 3. Fresh-character baseline

- Start region: Kota Arunika / spawn `arunika-start`, lalu field awal melalui alur world entry.
- Fresh level: 1.
- Starting stat/equipment berasal dari `freshHero()` dan starter data di `rules.ts`; starter inventory memuat gear awal dan item consumable yang didefinisikan source tersebut.
- Main quest pertama: `main-verdant-bisikan`, “Bisikan di Lembah”, membunuh 6 target objective di Verdant.
- First field: Padang Arunika.
- First normal monster: Small Slime Lv1.
- First field camp/shop: Penjaga Pos Arunika di Padang Arunika.
- First city equipment/consumable merchants: NPC equipment dan consumable di Kota Arunika.
- First field boss technically accessible: Ancient Treant Lv10 di arena utara; tidak ada special level gate di `spawnBoss`, tetapi game flow/level membuatnya bukan target baseline Lv1.
- Starting progression gives 3 stat points per level dan 1 skill point per level.

---

## 4. Level coverage

| Band | Map | Monster | Quest | Equipment source | Status |
|---|---|---|---|---|---|
| Lv1–10 | Padang Arunika; overlay East Gate/Sands | Lv1–10 | main + 3 field quest | Training tier Lv1, city merchant, normal/elite/boss loot | **SUFFICIENT secara data awal**, tetapi boss/field loop masih Chapter 1 sederhana |
| Lv11–20 | Tambang, Rimba awal | Lv9–20 | Tambang + Rimba | Lv8 dan Lv16 field weapon; named Lv10; city merchant | **PARTIAL**: overlap level ada, variasi map/quest terbatas |
| Lv21–30 | Rimba akhir, Frostfire awal | Lv20–30 | Rimba + Frostfire | Lv16 dan Lv24 weapons; greatsword Lv24 | **PARTIAL**: transisi tersedia, tetapi gear tier 24 menjadi lompatan utama |
| Lv31–40 | Frostfire akhir, Sunken | Lv30–40 | Frostfire + Sunken | Lv32 tier; no Lv30/36 weapon tier | **PARTIAL**: coverage monster ada, equipment intermediate tipis |
| Lv41–50 | Sunken akhir, Meteorfall | Lv40–50 | Sunken + Meteorfall | Lv42 tier; city merchant; named/catalog items | **PARTIAL**: field tersedia, tetapi terminal content dan chapter masih sama |
| Lv51–59 | tidak ada field/monster/quest/gear production | none | none | no level 51–59 field tier | **MISSING** |
| Lv60+ | tidak ada production content | none | none | none | **MISSING**, walaupun V2 test cap bisa 80 |

Kesimpulan: current world tidak mendukung progression alami Lv1–59 secara penuh. Gap pasti berada pada Lv51–59; band 31–50 masih playable tetapi content density dan equipment tier-nya parsial.

---

## 5. Technical/content cap

- `WORLD_CONFIG.levelCap = 50` adalah cap dunia/legacy yang terlihat di region config.
- `LEGACY_CONTENT_CAP = 50` adalah cap progression legacy.
- `V2_TEST_CONTENT_CAP = 80` dan `ABSOLUTE_MAX_LEVEL = 100` adalah capability/development limits, bukan content availability.
- Actual meaningful world content cap: **Lv50**, dengan final boss Meteorfall Overlord Lv50.
- Actual narrative cap: **Chapter 1**.

### XP formula

Source: `lib/game/rules.ts`.

```text
xpNeeded(level) = 90 + level × 40
```

| Target | Total XP dari Lv1/awal band |
|---|---:|
| 1 → 15 | 5,460 |
| 15 → 30 | 14,550 |
| 30 → 45 | 23,550 |
| 45 → 59 | 30,100 |
| 59 → 60 | 2,450 |
| 60 → 80 | 57,400 |

Monster XP memakai `monsterXP(monster, playerLevel)`: base `monster.exp`, lalu penalti 8% per level difference setelah player lebih tinggi 5 level, minimum 5% dari base. Kill reward runtime juga menambah default gold 12 (boss 150), dan XP fallback 35 (boss 160) bila definition tidak tersedia; production field definitions memakai `monsterXP`.

Quest EXP:

- main Bisikan di Lembah: 80 EXP, 80 gold.
- field quest: `field.minLevel × 35 × {1, 1.8, 3}` untuk Easy/Veteran/Elite.
- field quest target: 5/10/15 kills; reward material tier field 2/3/5.
- class quests tidak memberi EXP.

Perkiraan kill sangat bergantung pada monster dan level penalty. Sebagai baseline tanpa quest: XP Lv1→15 membutuhkan 5,460; itu setara sekitar 546 Small Slime base-XP sebelum penalty atau sekitar 105 Wild Boar base-XP. Karena area dan monster naik bertahap, actual kill count akan berada di antara angka tersebut dan berubah berdasarkan target yang dipilih. Angka ini adalah observasi pacing, bukan rekomendasi balance.

---

## 6. Complete monster catalog

Semua monster production dihasilkan dari `seeds` pada `lib/game/regions.ts`. Kolom ringkas di bawah adalah nilai runtime yang benar-benar terbentuk.

| ID | Nama | Lv | Class | HP | Atk | Def/MDef | Atk speed/range | Move | Stagger res. | EXP | Drop | Respawn |
|---|---|---:|---|---:|---:|---:|---|---:|---:|---:|---:|---:|
| `verdant-plains-0` | Small Slime | 1 | normal melee | 46 | 10 | 5/4 | 1.8/1.8 | 2.1 | 15 | 10 | .35 | 25s |
| `verdant-plains-1` | Wild Boar | 3 | normal melee | 78 | 15 | 7/6 | 1.8/1.8 | 2.1 | 15 | 52 | .35 | 25s |
| `verdant-plains-2` | Forest Piya | 5 | normal melee | 110 | 19 | 10/8 | 1.8/1.8 | 2.1 | 15 | 112 | .35 | 25s |
| `verdant-plains-3` | Stoneback Beetle | 7 | normal melee | 142 | 23 | 12/10 | 1.8/1.8 | 2.1 | 15 | 185 | .35 | 25s |
| `verdant-plains-4` | Giant Rootling | 8 | elite melee | 395 | 38 | 16/14 | 1.45/1.8 | 1.7 | 45 | 452 | .70 | 60s |
| `verdant-plains-5` | Ancient Treant | 10 | field boss melee | 1,900 | 60 | 23/20 | 1.2/5.6 | 1.3 | 80 | 1,580 | .95 | 120s |
| `ironveil-mines-0` | Cave Bat | 9 | normal melee | 174 | 28 | 14/12 | 1.8/1.8 | 2.1 | 15 | 270 | .35 | 25s |
| `ironveil-mines-1` | Ore Grub | 10 | normal melee | 190 | 30 | 15/13 | 1.8/1.8 | 2.1 | 15 | 400 | .35 | 25s |
| `ironveil-mines-2` | Ironfang Bat | 12 | normal melee | 222 | 34 | 17/15 | 1.8/1.8 | 2.1 | 15 | 520 | .35 | 25s |
| `ironveil-mines-3` | Tunnel Marauder | 14 | normal melee | 254 | 39 | 19/17 | 1.8/1.8 | 2.1 | 15 | 650 | .35 | 25s |
| `ironveil-mines-4` | Ironhide Golem | 16 | elite melee | 715 | 65 | 27/24 | 1.45/1.8 | 1.7 | 45 | 900 | .70 | 60s |
| `ironveil-mines-5` | Mine Tyrant | 18 | field boss melee | 3,180 | 95 | 36/32 | 1.2/5.6 | 1.3 | 80 | 3,820 | .95 | 120s |
| `whispering-wilds-0` | Moss Sprite | 16 | normal melee | 286 | 43 | 22/19 | 1.8/1.8 | 2.1 | 15 | 640 | .35 | 25s |
| `whispering-wilds-1` | Thorn Wolf | 17 | normal melee | 302 | 45 | 23/20 | 1.8/1.8 | 2.1 | 15 | 701 | .35 | 25s |
| `whispering-wilds-2` | Whispering Wisp | 20 | normal melee | 350 | 52 | 26/23 | 1.8/1.8 | 2.1 | 15 | 894 | .35 | 25s |
| `whispering-wilds-3` | Vineshade Panther | 22 | normal melee | 382 | 56 | 28/25 | 1.8/1.8 | 2.1 | 15 | 1,030 | .35 | 25s |
| `whispering-wilds-4` | Elder Vine | 24 | elite melee | 1,035 | 91 | 38/34 | 1.45/1.8 | 1.7 | 45 | 1,500 | .70 | 60s |
| `whispering-wilds-5` | Forest Warden | 26 | field boss melee | 4,460 | 130 | 49/44 | 1.2/5.6 | 1.3 | 80 | 6,630 | .95 | 120s |
| `frostfire-highlands-0` | Ember Yak | 24 | normal melee | 414 | 61 | 30/27 | 1.8/1.8 | 2.1 | 15 | 1,180 | .35 | 25s |
| `frostfire-highlands-1` | Frost Wolf | 25 | normal melee | 430 | 63 | 32/28 | 1.8/1.8 | 2.1 | 15 | 1,250 | .35 | 25s |
| `frostfire-highlands-2` | Magma Imp | 28 | normal melee | 478 | 70 | 35/31 | 1.8/1.8 | 2.1 | 15 | 1,490 | .35 | 25s |
| `frostfire-highlands-3` | Frostfire Wyrm | 30 | normal melee | 510 | 74 | 37/33 | 1.8/1.8 | 2.1 | 15 | 1,700 | .35 | 25s |
| `frostfire-highlands-4` | Cinderhorn | 32 | elite melee | 1,355 | 118 | 49/44 | 1.45/1.8 | 1.7 | 45 | 2,300 | .70 | 60s |
| `frostfire-highlands-5` | Twin Elemental Lord | 34 | field boss melee | 5,740 | 166 | 62/56 | 1.2/5.6 | 1.3 | 80 | 9,915 | .95 | 120s |
| `sunken-ruins-0` | Drowned Warrior | 32 | normal melee | 542 | 78 | 39/35 | 1.8/1.8 | 2.1 | 15 | 1,700 | .35 | 25s |
| `sunken-ruins-1` | Drowned Soldier | 33 | normal melee | 558 | 81 | 40/36 | 1.8/1.8 | 2.1 | 15 | 1,896 | .35 | 25s |
| `sunken-ruins-2` | Leech Wraith | 37 | normal melee | 622 | 89 | 45/40 | 1.8/1.8 | 2.1 | 15 | 2,300 | .35 | 25s |
| `sunken-ruins-3` | Ruin Guardian | 40 | normal melee | 670 | 96 | 48/43 | 1.8/1.8 | 2.1 | 15 | 2,700 | .35 | 25s |
| `sunken-ruins-4` | Sunken Sentinel | 42 | elite melee | 1,755 | 151 | 63/56 | 1.45/1.8 | 1.7 | 45 | 3,600 | .70 | 60s |
| `sunken-ruins-5` | Leviathan | 44 | field boss melee | 7,340 | 210 | 79/71 | 1.2/5.6 | 1.3 | 80 | 14,595 | .95 | 120s |
| `meteorfall-citadel-0` | Meteor Wisp | 42 | normal melee | 702 | 100 | 50/45 | 1.8/1.8 | 2.1 | 15 | 2,500 | .35 | 25s |
| `meteorfall-citadel-1` | Meteor Hound | 43 | normal melee | 718 | 103 | 51/46 | 1.8/1.8 | 2.1 | 15 | 2,820 | .35 | 25s |
| `meteorfall-citadel-2` | Astral Golem | 46 | normal melee | 766 | 109 | 55/49 | 1.8/1.8 | 2.1 | 15 | 3,200 | .35 | 25s |
| `meteorfall-citadel-3` | Void Knight | 48 | normal melee | 798 | 114 | 57/51 | 1.8/1.8 | 2.1 | 15 | 3,700 | .35 | 25s |
| `meteorfall-citadel-4` | Meteor Titan | 49 | elite melee | 2,035 | 174 | 72/65 | 1.45/1.8 | 1.7 | 45 | 4,700 | .70 | 60s |
| `meteorfall-citadel-5` | Meteorfall Overlord | 50 | field boss melee | 8,300 | 236 | 89/80 | 1.2/5.6 | 1.3 | 80 | 17,680 | .95 | 120s |

Duplicate definitions: East Gate dan Sands merujuk ulang enam definition Verdant, sehingga tidak menambah monster species/stat baru. Monster source tidak memiliki field terpisah untuk aggro range, leash, incoming staggerDamage, status immunity, atau AI skill list; runtime memakai default berdasarkan variant.

---

## 7. Monster curve dan archetype

Formula source:

```text
normal HP = round((30 + level × 16) × 1)
elite HP = round((30 + level × 16) × 2.5)
boss HP = round((30 + level × 16) × 10)
normal attack = round((8 + level × 2.2) × 1)
elite attack = ×1.5
boss attack = ×2
normal defense = round((4 + level × 1.1) × 1)
elite/boss defense = ×1.25 / ×1.5
magic defense = round((3 + level) × variant defense multiplier)
```

Curve naik monoton pada catalog canonical; tidak ditemukan higher-level normal yang lebih lemah dari lower-level normal pada data saat ini. Outlier strukturalnya adalah variant multiplier yang besar dan gap level 50→tidak ada 51–59.

Archetype aktual:

- basic melee: seluruh 24 normal definitions.
- elite melee/bruiser: enam elite.
- field boss melee: enam boss.
- fast melee, armored, ranged, caster, controller, support: **NONE sebagai AI/data behavior terpisah**.
- Beberapa nama seperti Bat, Wisp, Elemental, atau Knight tidak mengubah behavior; classification tetap mengikuti runtime melee sederhana.

---

## 8. AI, aggro, group, dan control

Runtime `updateEnemy` melakukan:

1. skip jika respawn/dead;
2. tick stun, slow, root, poison, defenseDown, statusEffects;
3. jika stun/root/staggered, berhenti;
4. jika windup aktif, countdown lalu damage player bila masih dekat;
5. jika player tidak safe dan dalam detection range, chase sampai attack range;
6. bila cooldown siap, masuk windup;
7. bila terlalu jauh dari home, kembali ke home;
8. mati → drop/EXP/gold/quest progress, lalu respawn deadline.

Detection range: normal 10, elite 12, boss 15. Leash efektif sekitar 20 dari home. Boss attack range 5.6/impact sekitar 3.7; normal/elite attack range 1.8/impact sekitar 1.4.

Aggro saat ini adalah single-player proximity aggro. Tidak ada:

- aggro table atau threat score;
- damage-based threat;
- taunt/forced target;
- target switching;
- social aggro/call nearby;
- shared pack aggro;
- party ownership.

Multiple enemy dapat menyerang satu player hanya karena masing-masing berada dalam detection range; spawn cluster bukan group AI.

Control yang runtime kenal pada enemy: stun, slow, root, poison, defenseDown/Armor Break, staggered. Tidak ada per-monster immunity/resistance/duration reduction field. Boss hanya lebih sulit karena `staggerResistance` dan variant behavior, bukan immunity table.

Monster→player staggerDamage: **NONE pada production definitions/runtime attack call**. `hurtHero` dipanggil tanpa nilai staggerDamage dari enemy attack.

---

## 9. Skill monster dan ranged audit

| Mekanik enemy | Status aktual |
|---|---|
| Single-target melee | READY, dipakai semua monster |
| Ranged attack/projectile | NOT IMPLEMENTED sebagai monster behavior |
| AoE/stun/slow/root/poison/knockback | NOT IMPLEMENTED sebagai active monster skill |
| Buff/debuff/heal/shield/dash/summon | NOT IMPLEMENTED |
| Stagger response | READY melalui shared player damage/control pipeline |

Walaupun boss memiliki `attackRange = 5.6`, runtime tetap melakukan chase dan wind-up melee; ini bukan ranged monster. Tidak ada minimum range, projectile, reposition ranged, ammo, atau caster state.

---

## 10. Stagger dan control relevance

Semua normal memiliki resistance 15, elite 45, boss 80. Monster memiliki threshold/staggerState runtime fallback, tetapi tidak ada balancing profile per monster di catalog. Break dapat terjadi melalui shared stagger system, lalu state/status dibersihkan saat respawn.

Normal level tinggi dan elite/boss cukup durable untuk membuat Stagger relevan. Normal level rendah dapat mati sebelum gauge penuh; ini adalah observasi data, bukan penilaian Warrior balance. Boss memiliki HP dan resistance lebih tinggi, tetapi tidak memiliki special boss immunity.

---

## 11. Spawn dan respawn

### Spawn model

| Tipe | Jumlah | ID | Sumber posisi |
|---|---:|---|---|
| Normal | 36 | 0–35 | deterministic lattice / terrain spawn zones, definition round-robin 4 species |
| Elite | 5 | 90–94 | fixed elite points atau `terrain.eliteSpawns` |
| Field boss | 1 | 100 | `terrain.arena` atau Sands arena |

Normal procedural default memakai grid 8×8, filter safe/water/boss area, lalu mengambil 36 titik stabil. Verdant dan East Gate memakai terrain-aware zone placement; Sands memakai grid imported footprint. Spawn identity stabil dan disimpan dalam `monsterRespawnState`.

### Respawn

- normal: 25 detik;
- elite: 60 detik;
- field boss: 120 detik;
- deadline disimpan runtime/save berdasarkan `respawnKey`;
- saat deadline habis, instance yang sama direvive di home position;
- region change membangun ulang enemy set dan membersihkan current target.

Tidak ada random spawn count/position pada production path; variasi hanya berasal dari pemilihan terrain-safe point dan fixed arrays.

### Density

Setiap field memuat 42 actor aktif secara konseptual. Densitas terbesar berada pada lattice/zone, camp/safe area dan boss arena dikecualikan. Map prosedural memiliki area kosong antar lattice; Verdant/East Gate memiliki jalur, sungai, jembatan, camp, sanctuary, dan arena. Tidak ada culling AI per jarak pada loop runtime.

---

## 12. Loot pipeline aktual

Urutan saat monster mati di `world.ts`:

```text
enemy HP <= 0
→ set respawn deadline/state
→ hitung EXP (monsterXP) dan gold
→ gainXP + pet EXP
→ grantMonsterLoot
→ loot family roll
→ template roll
→ rarity roll untuk equipment/rune
→ createItem/createRuneItem
→ socket/unique effect/unique stat generation sesuai source dan rarity
→ inventory atau pendingLoot jika penuh
```

### Monster drop chance dan family weights

Drop chance independent: normal 35%, elite 70%, boss 95%, sebelum bonus item-drop rate.

| Variant | Material | Potion | Supplies | Equipment | Rune | Pet | Fate | Seal | Optimizer | Unique Rune |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Normal | 44 | 25 | 8 | 18 | 3 | .5 | 1 | 0 | .5 | 0 |
| Elite | 28 | 15 | 5 | 35 | 10 | 1 | 3 | 1 | 2 | 0 |
| Boss | 12 | 4 | 1 | 50 | 20 | 1 | 3 | 3 | 4 | 2 |

Equipment rarity: normal `common 60 / uncommon 28 / rare 10 / epic 2`; elite `uncommon 25 / rare 50 / epic 23 / legendary 2`; boss `epic 70 / legendary 28 / mythic 2`.

Rune rarity: normal `cracked 65 / simple 30 / refined 5`; elite `refined 65 / rare 30 / epic 5`; boss `epic 70 / legendary 29 / ancient 1`.

Field material roll memakai material table field: primary material chance .65; high-tier second material .15. Potion tier mengikuti field minLevel: `<16` tier1, `<32` tier2, `>=32` tier3. Supplies: arrows 60, rice-meal 30, magnifier 10. Boss unique rune memakai `BOSS_RUNE_DROPS` per canonical field.

### Sockets dan Unique Stats

- Socket rolling dilakukan saat equipment dibuat jika source eligible; source/rareness policy ada di `rollEquipmentSockets`/`createItem`.
- Unique Stats hanya eligible untuk source/rareness tertentu; normal drops tidak otomatis memperoleh opsi locked seperti boss-eligible equipment.
- Locked Unique Stats dibuka lewat Magnifier; tidak dibuka saat drop.
- Rune normal/elite/boss memiliki source table di `monster-loot.ts`; boss unique rune adalah satu template khusus per field.
- Ownership saat ini single-player: loot langsung masuk hero inventory/pendingLoot. Tidak ada party contribution, first-hit, last-hit, atau shared loot.

### Drop table per field

| Field | Normal/elite/boss material | Field `dropTable` metadata | Boss unique rune |
|---|---|---|---|
| Padang | iron, lumut-fiber | health-potion-1, forest-vest, adventurer-pet-egg | `rune-akar-purba` |
| Tambang | iron, titanium | metadata sama | `rune-penjaga-langit` |
| Rimba | titanium | metadata sama | `rune-bayangan-caroq` |
| Bara-Beku | titanium, vibranium | metadata sama | `rune-inti-bara` |
| Sunken | vibranium | metadata sama | `rune-mata-jayantara` |
| Meteorfall | vibranium, meteorite-core | metadata sama | `rune-raja-meteor` |

Catatan: `FieldDefinition.dropTable` adalah metadata field lama; actual monster roll memakai `MONSTER_LOOT_PROFILES` dan `lootItemPool`, jadi jangan membacanya sebagai daftar final semua drop.

---

## 13. Field boss catalog

| ID | Nama | Map | Lv | HP | Def/MDef | Atk | Stagger res. | Respawn | AI/drop reality |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| `verdant-plains-5` | Ancient Treant | Padang | 10 | 1,900 | 23/20 | 60 | 80 | 120s | variant boss melee, boss loot, unique rune |
| `ironveil-mines-5` | Mine Tyrant | Tambang | 18 | 3,180 | 36/32 | 95 | 80 | 120s | sama |
| `whispering-wilds-5` | Forest Warden | Rimba | 26 | 4,460 | 49/44 | 130 | 80 | 120s | sama |
| `frostfire-highlands-5` | Twin Elemental Lord | Bara-Beku | 34 | 5,740 | 62/56 | 166 | 80 | 120s | sama; nama elemental tidak menambah element AI |
| `sunken-ruins-5` | Leviathan | Sunken | 44 | 7,340 | 79/71 | 210 | 80 | 120s | sama |
| `meteorfall-citadel-5` | Meteorfall Overlord | Meteorfall | 50 | 8,300 | 89/80 | 236 | 80 | 120s | high-tier boss source untuk unique rune/loot |

Field boss adalah classification runtime (`variant:'boss'`, spawn id 100), bukan AI engine terpisah. Ada visual scale/name color/ring, HP bar/announcement flow, respawn timer, boss gold/XP, boss loot profile, dan quest completion hooks. Tidak ada threat ownership, special skill list, boss immunity table, atau contribution reward.

---

## 14. Equipment catalog dan acquisition

Total equipment template yang terdaftar saat audit: **60**.

### Level tiers aktual

| Tier | Field weapons yang ada | Tipe |
|---|---|---|
| Lv1 | Training Sword, Training Dagger, Training Staff, Training Bow, Training Mace | Common |
| Lv8 | Iron Sword, Iron Dagger, Iron Staff, Iron Bow, Iron Mace | Common |
| Lv16 | Wildwood Sword, Wildwood Dagger, Wildwood Staff, Wildwood Bow, Wildwood Mace | Common |
| Lv24 | Frostfire Sword, Frostfire Dagger, Frostfire Staff, Frostfire Bow, Frostfire Mace | Common + Jayantara Greatsword Lv24 Epic |
| Lv32 | Ruin Sword, Ruin Dagger, Ruin Staff, Ruin Bow, Ruin Mace | Common |
| Lv42 | Meteor Sword, Meteor Dagger, Meteor Staff, Meteor Bow, Meteor Mace | Common, dengan Meteor Sword fixed `legacy` |

### Named/structural equipment

| ID | Nama | Lv | Type/slot | Job/source reality |
|---|---|---:|---|---|
| `legacy-fajar-blade` | Dawnblade | 1 | one-hand sword/main | catalog legacy, city shop; tidak ada dedicated monster source |
| `guntur-knuckle` | Thunder Knuckle | 10 | knuckle/main | city equipment shop; tidak ada field-specific source |
| `garda-mace` | Gatewarden Mace | 10 | mace/main | city shop |
| `garda-shield` | Nusantara Aegis | 10 | shield/off | city shop |
| `caroq-daggers` | Caroq Twin Blades | 10 | dagger/main | city shop; dual setup tetap memerlukan off-hand |
| `anom-sword` | Silent Markblade | 10 | one-hand sword/main | city shop |
| `anom-dagger` | Veilless Shadow Dagger | 10 | off-hand dagger/off | city shop |
| `srikandi-bow` | Srikandi's Eagleeye Bow | 10 | bow/main | city shop |
| `jagawana-bow` | Wildsnare Bow | 10 | bow/main | city shop |
| `resi-staff` | Fivefold Element Staff | 10 | staff/main | city shop |
| `pujangga-wand` | Hexscript Wand | 10 | wand/main | city shop |
| `pandita-relic` | Relic of Compassion | 10 | talisman/main | city shop |
| `bajra-knuckle` | Bajra Sanctfist | 10 | knuckle/main | city shop |
| `jayantara-two-hand-sword` | Jayantara Greatsword | 24 | two-hand sword/main | city shop + eligible monster equipment pool |
| `ironveil-shield` | Ironveil Shield | 8 | shield/off | city/field equipment pool |
| `whispering-offhand-dagger` | Wildside Dagger | 16 | off-hand dagger/off | city/field equipment pool |
| `arcana-tome` | Arcane Script Tome | 16 | tome/off | city/field equipment pool |
| `resi-orb` | Fivefold Arcana Orb | 24 | orb/off | city/field equipment pool |
| `hunter-quiver` | Srikandi's Quiver | 8 | quiver/off | city/field equipment pool |
| `pujangga-talisman` | Pujangga Hex Talisman | 24 | talisman/off | city/field equipment pool |

Armor/accessory baseline: Wildwarden Vest, Dawnfire Necklace, Arunika Dawn Circlet, Bronzegrip Gauntlets, Woven Trailguards, Wildwood Striders, Dawnfire Ring, Duskveil Ring, Suncrest Earring, Moonveil Earring; all level 1 and city/eligible equipment-pool obtainable.

### Source rules

- City Equipment Merchant: all catalog entries in categories weapon/armor/accessory, priced by `buyValue` or fallback price. This is a broad source, not level-gated by shop.
- Field camp shop: potions, arrows, rice-meal, and the field weapon set matching field tier.
- Monster equipment: `equipmentDropPool(field.maxLevel)` includes equipment with level requirement ≤ field max, excludes quest/soulbound, respects special-job requirement.
- Quest rewards: current field quests reward material, not equipment.
- Crafting: no equipment creation catalog/source is implemented in this audit scope; forge enhances/rerolls existing equipment rather than providing a full recipe progression.
- Unobtainable via normal catalog source: no ordinary equipment template was found without at least city merchant availability; some named legacy entries lack a dedicated field/boss source but remain buyable.

### Warrior coverage

- One-hand sword: complete field tier Lv1/8/16/24/32/42 plus named swords.
- Greatsword: one named Lv24 source (`Jayantara Greatsword`); no tiered greatsword progression.
- Dual sword: system can use two compatible one-hand swords, but natural off-hand one-hand sword catalog is not a dedicated progression; the existing off-hand path is more explicit for daggers.

### Thief coverage

- Main dagger field tiers: Lv1/8/16/24/32/42.
- Off-hand dagger: `Wildside Dagger` Lv16 and `Veilless Shadow Dagger` Lv10.
- Dual dagger setup is therefore possible after acquiring a second compatible dagger, but the field tier system does not generate a matching off-hand dagger at every tier.
- `Caroq Twin Blades` is a main-hand dagger-style named item; it is not a fake two-item identity by itself.
- Natural future Thief gap: off-hand dagger progression at Lv1/8/24/32/42 is absent from the explicit catalog, even though city merchant and equipment pool allow broader catalog access.

### Future weapon availability

| Weapon family | Current status |
|---|---|
| one-hand sword | READY, tiered |
| greatsword/two-hand sword | READY but single named tier |
| dagger/off-hand dagger | READY, main tiered; off-hand sparse |
| bow | READY, tiered |
| staff | READY, tiered |
| wand | named only (`pujangga-wand`) |
| book/tome | off-hand named only (`arcana-tome`) |
| knuckle | named only |
| shield | two named off-hand shields |
| spear | MISSING catalog entry |
| axe | MISSING catalog entry |
| hammer | MISSING catalog entry; mace exists but is not hammer |

---

## 15. Shops and potions

### City services

Kota Arunika: Adipati Aruna, Pemandu Pijar, Mahaguru Aksara, Empu Wira, Pande Gana, Nyi Raras, Juru Simpan Lumbung, Tabib Sekar, Pawang Lestari, Penjaga Gerbang Bayu, Papan Warta Arunika, plus Developer Material Lab.

Kota Jayantara: Adipati Jayan, Mahaguru Silsilah, Empu Niskala, Juru Segel, Pande Jayantara, Saudagar Puncak, Juru Simpan Candi, Tabib Amerta, Pawang Niskala, Penjaga Gerbang Langit, Papan Titah Jayantara.

Equipment Merchant menjual seluruh 60 equipment catalog. General/Consumable Merchant menjual rice-meal, magnifier, Mana Potion I–III, Health Potion I–III, dan arrows.

### Field shops

Semua field camp shop menjual resource yang sama: rice-meal, Mana/Health Potion I–III, arrows, plus five field weapon templates untuk field content family. Harga weapon tier: Lv1 98, Lv8 224, Lv16 368, Lv24 512, Lv32 656, Lv42 836.

### Potions

| Item | Restore | Harga | Cooldown |
|---|---:|---:|---:|
| Health Potion I | 30% Max HP | 20 | 3s shared health tier |
| Health Potion II | 60% Max HP | 40 | 3s |
| Health Potion III | 100% Max HP | 60 | 3s |
| Mana Potion I | 30% Max Mana | 25 | 3s shared mana tier |
| Mana Potion II | 60% Max Mana | 50 | 3s |
| Mana Potion III | 100% Max Mana | 75 | 3s |

---

## 16. Quest and chapter dependencies

### Main/class quests

| Quest | Map/NPC | Objective/reward |
|---|---|---|
| `main-verdant-bisikan` | Arunika → Padang | 6 objective kills; 80 EXP, 80 gold |
| `class-core` | Arunika | core job; no EXP |
| `class-specialization` | Jayantara | specialization; no EXP |
| `class-mastery` | Jayantara | mastery; no EXP |

### Field quests

Each canonical field has Easy/Veteran/Elite with 5/10/15 kills, required levels derived from field span at 0%, 35%, 70%, and rewards from `regionQuestReward`. Full IDs:

```text
verdant: field-verdant-plains-{easy,veteran,elite}
ironveil: field-ironveil-mines-{easy,veteran,elite}
whispering: field-whispering-wilds-{easy,veteran,elite}
frostfire: field-frostfire-highlands-{easy,veteran,elite}
sunken: field-sunken-ruins-{easy,veteran,elite}
meteorfall: field-meteorfall-citadel-{easy,veteran,elite}
overlays: field-east-gate-arunika-{easy,veteran,elite}, field-sands-location-{easy,veteran,elite}
```

Quest objectives target field progress aggregate, not a specific monster ID, except main quest’s legacy objective label `verdant-plains-normal`. Quest map/NPC dependency is stored in the field registry and field camp IDs. Adding chapters/maps can be appended if old IDs remain stable; changing field IDs or content family mappings is migration-risky.

Narrative currently stops at Chapter 1. `story-whispering-wilds` muncul sebagai marker/metadata pada alur boss/story tertentu, tetapi akses Jayantara yang benar-benar dijalankan `unlockReason` saat ini berbasis level 24, bukan completion quest.

---

## 17. Map capacity and spatial planning

### Existing usable space

- Padang: explicit roads, river crossings, farm/camp, sanctuary, temple/arena north, open outer zones; good candidate for multiple sub-zones, but current monster spawn is still four normal species plus one elite/boss.
- East Gate: explicit eastern frontier terrain and village/valley landmarks; content family reuse means spatial capacity exists but progression identity is not authored.
- Tambang/Rimba/Bara-Beku/Sunken/Meteorfall: current map runtime uses procedural/region renderer definitions with named sub-areas, but source does not encode rich authored zone objects for each map at the same level as Verdant.
- Sands: imported narrow island; not a good generic multi-band field without redesigning its finite footprint.

Existing maps can hold a small number of additional local zones only where geometry supports it. The data does not currently define final level bands per sub-area, so assigning north/south progression would be design work, not an existing fact.

Likely new field need: Lv51–59 and any post-60 progression. Lv31–50 can technically continue using current field chain, but additional authored zones/quests/equipment tiers would be needed for meaningful variety.

Second city: exists as Jayantara and is connected in code; it is not a separate chapter hub yet.

---

## 18. Monster gameplay gaps for Warrior and Thief

Current monsters can test basic DPS, selected-target combat, melee danger, Armor Break, poison, and stagger buildup on durable variants. They cannot meaningfully test:

- monster attacks with non-zero incoming staggerDamage for Unbroken/Indomitable systems;
- readable attack patterns worth deliberate Block/Parry timing;
- true armored/resistant targets with per-monster control policy;
- ranged pressure or mobility pressure for Thief;
- facing/rear-readable attacks and positional counterplay;
- long-lived targets where Mark/Poison/crit setup can be evaluated independently from raw HP;
- social camps or multi-target pressure with pack identity.

Future-class caution:

- Archer needs projectile/ranged target validation and ranged enemy benchmark.
- Mage needs element/status/projectile/ground-target foundations before monster resistance is meaningful.
- Acolyte needs ally/party target objects, heal/buff/barrier/cleanse targets.
- Knight needs threat/taunt/protection semantics; proximity-only AI is not enough.
- Smith needs deployable ownership, lifetime, HP, AI, and cleanup.

---

## 19. Performance and world simulation

- `world.ts` updates every enemy in `this.enemies` every active frame; there is no distance-based AI culling.
- Renderer-level frustum behavior is delegated to Three.js, but simulation, enemy status timers, labels, and AI loop are not spatially culled.
- All field actors are built when a region is built; there is no chunk streaming or LOD system in the gameplay runtime.
- Region changes clear enemies/labels/target map and rebuild the region. Imported terrain/decor may load asynchronously with build-token checks.
- Current baseline is 42 enemy actors per field, which is manageable for current simple AI. Doubling/tripling active enemies increases per-frame AI, labels, status ticking, target registration, and mesh cost linearly. Large boss fights would need profiling before adding more actors or effects.
- Particles/rings/beams are cleaned from arrays when their life expires. No production world-wide monster simulation is persisted across maps.

---

## 20. Capability matrix

| Capability | Status | Source/reality |
|---|---|---|
| Hard target enemy | READY | `targeting.ts`, `world.ts` |
| Self target | READY | skill target resolver |
| Circle AoE | READY | active skill runtime |
| Frontal arc | READY | Phase 1A/2D foundation |
| Targeted dash | READY/PARTIAL | target snapshot + terrain movement; no pathfinding |
| Ground-target AoE | NOT IMPLEMENTED | no player-selected ground point |
| Projectile | NOT IMPLEMENTED for monsters; player ranged foundation limited | no projectile collision system |
| Multi-hit | READY for player skills | `hitSequence`; not monster skill authoring |
| DoT | PARTIALLY READY | poison runtime exists; generic DoT engine absent |
| HoT | NOT IMPLEMENTED as generic effect |
| Heal | SELF/player-side foundation only | no ally target model |
| Party heal/buff | NOT IMPLEMENTED | no party members |
| Buff/debuff | PARTIALLY READY | status/modifier helpers; no generic enemy skill system |
| Barrier/cleanse | NOT IMPLEMENTED as general target mechanics |
| Stealth/mark | READY for Thief/player | not enemy AI |
| Root/slow/stun | READY as player-applied enemy states | enemy active casts absent |
| Stagger/knockback | READY for player→enemy | incoming monster staggerDamage is zero |
| Block/parry/counter | READY player-side | no monster-specific attack telegraph semantics |
| Threat/taunt | NOT IMPLEMENTED | single-player proximity aggro |
| Summon/pet combat | Pet data exists, full combat summon AI absent |
| Deployable/turret/bomb | NOT IMPLEMENTED |
| Element damage/resistance | LIMITED/NOT READY as gameplay family | magic/physical exist; named element metadata does not drive monster behavior |
| Weapon requirements | READY for current catalog | taxonomy incomplete for spear/axe/hammer |
| Dual wield | PARTIALLY READY | equipment style/Thief dual dagger; no generic off-hand basic attack engine |
| Shield requirement | READY for existing shield items; no Knight tank package |
| Ammo | READY for player bow path | no monster ammo |
| Cast time | PARTIALLY READY | skill casting/action lock; no full channel/cancel |
| Channel | NOT IMPLEMENTED |
| Temporary stack | READY for Warrior/Thief transient states |
| Conditional passive | PARTIALLY READY | scoped modifiers and selected conditions; no universal event bus |
| Rear positional check | READY for Thief/player target snapshot |
| Party system | NOT IMPLEMENTED |

---

## 21. Recommended development order

1. Freeze this world audit as the source of truth; do not tune against old documents.
2. Decide the content-cap policy: either extend production world to Lv59 or keep V2 test above Lv50 explicitly as development-only.
3. Define neutral class benchmarks before monster rebalance: single target, armored, magic-resistant, stagger/poise, endurance, incoming damage, and multi-target pack.
4. Build shared future foundations in dependency order: party/ally target model, projectile/ground target, element/resistance, per-monster control profile, and threat/aggro.
5. Then design the next Core Job. From a technical dependency perspective, **Thief is already the safest second reference and is frozen**, while the next new job should be **Acolyte only after ally-target/heal/buff/barrier foundations exist**. Do not start Acolyte content before that foundation; otherwise self-only substitutes would misrepresent the class.
6. After class ecosystem direction is stable, perform neutral monster/equipment progression design. No production rebalance belongs in Phase 5A.

---

## 22. Exact files audited

Primary source/runtime files:

- `lib/game/regions.ts` — city/field/monster/quest registry, level bands, field graph, boss definitions.
- `lib/game/field-layout.ts` — field dimensions, spawn lattice, spawn IDs, respawn keys.
- `lib/game/field-terrain.ts` — Verdant terrain, safe zones, river/pond, collision, paths, terrain walkability.
- `lib/game/east-gate-layout.ts` — East Gate geometry/spawn zones.
- `lib/game/world.ts` — region build/dispose, enemy runtime, AI loop, attack/windup, death, respawn, XP/gold/loot integration, map transition, rendering lifecycle.
- `lib/game/rules.ts` — Hero schema, fresh hero, XP formula, gainXP, stat/level progression, save normalization.
- `lib/game/progression.ts` — legacy/V2 caps and progression rules.
- `lib/game/monster-loot.ts` — drop chance, family weights, rarity, rune, equipment pool, unique boss rune.
- `lib/game/items.ts` — item catalog, source metadata, potions, equipment generation, sockets, Unique Stats, rune creation.
- `lib/game/city-services.ts` — city/field shop stock and prices.
- `lib/game/gameplay-config.ts` — resource policy relevant to stamina/legacy compatibility.
- `lib/game/combat-mechanics.ts`, `lib/game/combat-status.ts`, `lib/game/stagger.ts` — mitigation/status/stagger behavior used by player/monster interaction.
- `lib/game/field-terrain-renderer.ts`, `lib/game/imported-map.ts`, `lib/game/unreal-normandy-map.ts` — map/decor loading paths.

No production file was modified. No test, build, or publish artifact was created for this discovery task.

## Final boundary confirmation

- Map edits: 0
- Monster edits: 0
- Spawn edits: 0
- EXP edits: 0
- Drop edits: 0
- Item edits: 0
- Quest edits: 0
- Warrior/Thief edits: 0
- Publish: 0

Phase 5A berhenti pada audit dan report.
