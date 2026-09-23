# LUMENFALL — Weapon Data & Dual Wield Integration Audit

Status: READ-ONLY audit  
Scope: data weapon, Dual Wield foundation, Blade Master equipment path  
Tanggal audit: 2026-09-23

## Ringkasan eksekutif

`dual_sword` bukan item weapon dan tidak ada template item dengan tipe
`dual_sword` di `ITEM_CATALOG`. `dual_sword` adalah weapon style runtime
yang dihasilkan ketika karakter memiliki dua instance item berbeda dengan
`equipmentType: one_hand_sword`, `handedness: one_hand`, dan keduanya berada
di Main Hand serta Off Hand.

Fondasi Dual Wield sudah benar pada resolver combat/equip. Masalah yang
ditemukan berada pada dua hal:

1. seluruh template One-Hand Sword memakai `equipSlot: mainHand`, sehingga
   tidak ada template katalog yang secara eksplisit bertanda Off Hand Sword;
2. daftar kandidat Off Hand di Character Overview hanya memeriksa
   `item.equipSlot === 'offHand'`, sehingga One-Hand Sword kedua tidak muncul di
   UI walaupun `canEquipItem` dan `equipItem` dapat menerimanya.

Development helper `blade-master-60` juga hanya membuat satu Dawnblade, jadi
fixture tersebut tidak dapat menguji pemasangan dua pedang tanpa menambahkan
instance kedua secara eksplisit.

Tidak ada perubahan gameplay, item, inventory, UI, save, atau combat yang
dilakukan dalam audit ini. Hanya dokumen laporan ini yang ditambahkan.

## 1. Taksonomi weapon yang aktif

### Level item dan equipment

| Field/type | Nilai penting | Makna aktual |
|---|---|---|
| `ItemCategory` | `weapon`, `armor`, `accessory`, dan lainnya | Kategori inventory; bukan penentu langsung gaya serangan. |
| `EquipmentType` | `one_hand_sword`, `two_hand_sword`, `dagger`, `bow`, `knuckle`, `staff`, `wand`, `mace`, `shield`, `off_hand_dagger`, `tome`, `orb`, `quiver`, `talisman`, serta slot armor/accessory | Klasifikasi item canonical yang dipakai validasi equip dan sebagian resolver. |
| `EquipSlot` | `mainHand`, `offHand`, head/body/accessory/pet slots | Slot penyimpanan item pada karakter. |
| `Handedness` | `one_hand`, `two_hand`, `off_hand`, `none` | Aturan jumlah/tipe tangan yang dipakai item. |
| `AttackType` | `melee`, `ranged`, `magic`, `hybrid`, `none` | Jenis serangan/presentasi combat item. |
| `ItemData.itemType` | string seperti `sword`, `oneHandSword`, `twoHandSword`, `shield` | Label/template legacy atau kategori lama; bukan source of truth Dual Wield. |
| `ItemData.weaponType` | `WeaponType` nullable | Label weapon/style lama dan kompatibilitas job tertentu. Untuk normal sword katalog nilainya sering `sword_dagger`. |
| `allowedJobs` | Core Job seperti `warrior`, `rogue`, `wizard` | Pembatas job pada item. Blade Master mewarisi `coreJob: warrior`. |
| `requiredCoreJob` / `requiredSpecialJob` | Optional | Gate tambahan per job. |

### `WeaponType` runtime/skill

Union aktif di `lib/game/skills.ts` berisi:

`dagger`, `one_hand_sword`, `two_hand_sword`, `greatsword`,
`dual_sword`, `shield`, `none`, `knuckle`, `mace`,
`sword_shield`, `dual_dagger`, `sword_dagger`, `bow`, `bow_trap`,
`staff`, `wand`, `talisman`, `relic`, dan `holy_knuckle`.

Nilai ini digunakan sebagai requirement skill/style. Ia tidak selalu identik
dengan `ItemData.equipmentType`.

### Alias equipment

`EQUIPMENT_TYPE_ALIASES` di `lib/game/items.ts` menjaga kompatibilitas data
lama, antara lain:

`sword` → `one_hand_sword`, `oneHandSword` → `one_hand_sword`,
`twoHandSword` → `two_hand_sword`, `dualDagger` → `dagger`,
`offHandDagger` → `off_hand_dagger`, serta alias bow, staff, wand, mace,
shield, tome, orb, quiver, talisman/relic, dan slot armor.

Tidak ada alias `dualSword` → item `dual_sword`; Dual Sword tidak dimodelkan
sebagai item tunggal.

## 2. Arti pasti `dual_sword`

`dual_sword` memiliki tiga fungsi terkait:

1. nilai `WeaponType` untuk requirement skill dan style runtime;
2. hasil `resolveWeaponStyle(main, off)` di `lib/game/weapon-style.ts`;
3. field kompatibilitas legacy/display `hero.weaponType` ketika transisi
   Blade Master dilakukan.

Resolver menghasilkan `dual_sword` hanya jika:

- Main Hand adalah `one_hand_sword` one-hand;
- Off Hand adalah `one_hand_sword` one-hand;
- kedua instance memiliki `id` berbeda;
- item tidak two-handed.

Tidak ada item katalog yang memiliki `itemType`, `equipmentType`, atau
`weaponType` bernilai `dual_sword`. Makna yang benar adalah:

> valid combination of two real One-Hand Sword item instances.

Referensi source utama:

- `lib/game/weapon-style.ts`: pembentukan style dan validasi requirement;
- `lib/game/blade-master-v3.ts`: requirement skill Blade Master;
- `lib/game/rules.ts`: skill resolver, mastery mana reduction, dan legacy field;
- `lib/game/dual-wield.ts`: capability, konflik equip, weapon context, dan
  agregasi stat.

## 3. Requirement skill Blade Master

| Skill | `weaponRequirement` | Makna runtime |
|---|---|---|
| Twin Blade Mastery | tidak ada | Passive/mastery; membuka capability setelah R1. |
| Twin Assault | `['dual_sword']` | Wajib dua One-Hand Sword valid. |
| Blade Rush | `['one_hand_sword', 'two_hand_sword']` | Satu sword biasa, 1H atau 2H. |
| Counterflow | `['one_hand_sword', 'two_hand_sword']` | Satu sword biasa, 1H atau 2H. |
| Blade Focus | `['one_hand_sword', 'two_hand_sword']` | Satu sword biasa, 1H atau 2H. |
| Cross Sever | `['dual_sword']` | Wajib dua One-Hand Sword valid. |
| Piercing Sequence | `['one_hand_sword', 'two_hand_sword']` | Menggunakan Main Hand; Dual Wield tidak otomatis memakai raw Off Hand ATK. |
| Tempo Drive | `['dual_sword']` | Wajib dua One-Hand Sword valid. |
| Blade Tempest | `['dual_sword']` | Wajib dua One-Hand Sword valid. |

Jalur resolver:

`skill.weaponRequirement` → `rules.skillWeaponAllowed()` → item Main/Off
dari equipment → `weapon-style.meetsWeaponRequirement()` →
`resolveWeaponStyle()`.

Blade Master tidak mencari item bernama “Dual Sword”; ia menguji kombinasi dua
item sword normal.

## 4. Template One-Hand Sword yang benar-benar ada

Semua entry berikut berasal dari `ITEM_CATALOG` di `lib/game/items.ts`.

| ID | Nama | Category | `itemType` | `equipmentType` | `weaponType` | Slot template | Hands | Level | Allowed jobs | Base stats |
|---|---|---|---|---|---|---|---|---:|---|---|
| `legacy-fajar-blade` | Dawnblade | weapon | `sword` | `one_hand_sword` | `sword_dagger` | `mainHand` | `one_hand` | 1 | warrior, rogue | attack 8 |
| `anom-sword` | Silent Markblade | weapon | `oneHandSword` | `one_hand_sword` | `sword_dagger` | `mainHand` | `one_hand` | 10 | warrior, rogue; required core rogue, special anom | attack 20, dex 2, critDamage 5 |
| `field-verdant-plains-sword` | Training Sword | weapon | `sword` | `one_hand_sword` | `sword_dagger` | `mainHand` | `one_hand` | 1 | warrior, rogue | attack 8 |
| `field-ironveil-mines-sword` | Iron Sword | weapon | `sword` | `one_hand_sword` | `sword_dagger` | `mainHand` | `one_hand` | 8 | warrior, rogue | attack 14 |
| `field-whispering-wilds-sword` | Wildwood Sword | weapon | `sword` | `one_hand_sword` | `sword_dagger` | `mainHand` | `one_hand` | 16 | warrior, rogue | attack 20 |
| `field-frostfire-highlands-sword` | Frostfire Sword | weapon | `sword` | `one_hand_sword` | `sword_dagger` | `mainHand` | `one_hand` | 24 | warrior, rogue | attack 27 |
| `field-sunken-ruins-sword` | Ruin Sword | weapon | `sword` | `one_hand_sword` | `sword_dagger` | `mainHand` | `one_hand` | 32 | warrior, rogue | attack 33 |
| `field-meteorfall-citadel-sword` | Meteor Sword | weapon | `sword` | `one_hand_sword` | `sword_dagger` | `mainHand` | `one_hand` | 42 | warrior, rogue | attack 41 |

Temuan penting: seluruh template One-Hand Sword memiliki `equipSlot:
mainHand`, tetapi `canEquipItem()` secara khusus memperlakukan item
One-Hand Sword sebagai kompatibel dengan `mainHand` dan `offHand`.

## 5. Apakah ada item Dual Sword aktual?

Tidak ada.

Audit `ITEM_CATALOG` menemukan **0** item dengan `itemType`,
`equipmentType`, atau `weaponType` bernilai `dual_sword`. Tidak ada
template “Dual Sword” yang menyimpan Weapon ATK gabungan.

Ini sesuai kontrak SPV3-6: Main Hand dan Off Hand harus berupa dua instance
item nyata yang terpisah.

## 6. Semua template Off Hand

| ID | Nama | Category | Equipment type | Allowed jobs | Fungsi |
|---|---|---|---|---|---|
| `garda-shield` | Nusantara Aegis | armor | shield | warrior; special garda | Shield |
| `ironveil-shield` | Ironveil Shield | armor | shield | warrior | Shield |
| `anom-dagger` | Veilless Shadow Dagger | weapon | off_hand_dagger | rogue; special anom | Dagger off-hand |
| `whispering-offhand-dagger` | Wildside Dagger | weapon | off_hand_dagger | rogue | Dagger off-hand |
| `arcana-tome` | Arcane Script Tome | accessory | tome | wizard | Tome |
| `resi-orb` | Fivefold Arcana Orb | accessory | orb | wizard | Orb |
| `hunter-quiver` | Srikandi's Quiver | accessory | quiver | hunter | Quiver |
| `pujangga-talisman` | Pujangga Hex Talisman | accessory | talisman | wizard, acolyte | Talisman |

Tidak ada template `offHand` dengan `equipmentType:
one_hand_sword`. Karena itu, Off Hand Sword memakai instance dari template
sword normal, bukan item off-hand khusus.

## 7. Inventory test character

Tidak ditemukan literal character bernama **“Blade Master TestDev”** dalam
source repository. Helper development yang tersedia adalah:

`createV3JobDevelopmentHero('blade-master-60')` di `lib/game/rules.ts`.

Output helper tersebut berisi:

- satu instance `v3-job-blade-master-60-fajar-blade` dari template
  `legacy-fajar-blade` sebagai Main Hand;
- satu potion;
- satu pet egg;
- `equipment.offHand = null`.

Tidak ada instance pedang kedua. Helper tersebut hanya untuk development/test
dan tidak terhubung langsung ke production character creation.

Jadi, untuk karakter test tersebut, penyebab pertama Off Hand kosong adalah
inventory memang belum memiliki item pedang kedua. Namun meskipun item kedua
ditambahkan, masih ada masalah kandidat UI berikut.

## 8. Job compatibility

Template sword biasa memiliki `allowedJobs: ['warrior', 'rogue']`. Blade
Master tetap memiliki `coreJob: 'warrior'` dan `specialization:
'blade_master'`.

`canEquipItem()` memeriksa `allowedJobs` terhadap `coreJob`, sehingga sword
normal valid untuk Blade Master. Tidak ada `requiredSpecialJob` pada sword
normal yang memblokir Blade Master.

`requiredSpecialJob` pada `anom-sword` hanya membatasi item tersebut ke
Rogue/Assasin-style path dan bukan item yang relevan untuk Blade Master.

Foundation capability juga konsisten:

- normal V3 character: capability false;
- Blade Master dengan Twin Blade Mastery R1+: capability true;
- Berserker dan Warrior: tidak otomatis mendapat Dual Wield;
- `chooseV3BladeMaster()` mengisi `hero.weaponType = 'dual_sword'` sebagai
  field kompatibilitas/display, bukan membuat item baru.

## 9. Mengapa pedang kedua tidak muncul di UI Off Hand?

`CHARACTER_SLOTS` di `lib/game/character-view.ts` memang memiliki slot
`offHand`. Namun kandidat equipment di
`components/game/character-screen.tsx` memakai filter:

```ts
!item.isEquipped && item.equipSlot === slot
```

Untuk slot `offHand`, filter ini hanya menerima item template bertanda
`equipSlot: 'offHand'`. Semua One-Hand Sword catalog bertanda `mainHand`,
sehingga tidak masuk daftar kandidat Off Hand.

Ini bukan kegagalan resolver equip. Uji read-only dengan satu hero Blade
Master, satu Main Hand sword, capability Twin Blade Mastery R1, dan satu
instance sword kedua menghasilkan:

| Pemeriksaan | Hasil |
|---|---|
| Kandidat UI Off Hand dari filter saat ini | kosong |
| Tipe item kedua | `one_hand_sword`, `one_hand` |
| `equipItem(secondSword, 'offHand')` | berhasil |
| Equipment setelah resolver | Main Hand dan Off Hand berisi dua ID berbeda |

Kesimpulan langsung: **masalah utama saat ini adalah UI candidate filter,
diperparah oleh development fixture yang hanya menyediakan satu sword**.

## 10. Equip operation dan konflik

Jalur equip di `lib/game/rules.ts` dan `lib/game/items.ts` mendukung:

- `canEquipItem()` mengizinkan One-Hand Sword pada Main Hand maupun Off Hand;
- `validateOffHandCompatibility()` menerima One-Hand Sword dengan template
  `mainHand`, asalkan Main Hand juga One-Hand Sword;
- Main dan Off Hand wajib memiliki instance ID berbeda;
- capability Dual Wield wajib aktif untuk memasang sword kedua;
- Two-Hand Sword bersama Off Hand weapon ditolak dengan structured reason;
- Shield dan Off Hand Sword tidak boleh coexist;
- invalid equip ditolak sebelum commit, sehingga item tidak dihapus;
- item yang sama tidak dapat dipakai sebagai dua instance equipment.

`dual-wield.ts` juga menyediakan mode weapon context:
`SINGLE_MAIN`, `SINGLE_OFF`, `DUAL_COMBINED`, dan `DUAL_SEQUENCE`.

Raw Weapon ATK Off Hand tidak otomatis masuk ke skill `SINGLE_MAIN`,
sedangkan `DUAL_COMBINED` dan sequence dapat mengakses layer Main/Off secara
eksplisit.

## 11. Perbandingan SPV3-6 dengan jalur live

| Kontrak SPV3-6 | Status audit |
|---|---|
| Capability gate default false | Ada dan diterapkan pada V3 equip path. |
| Blade Master mastery membuka capability | Ada; capability diturunkan dari Twin Blade Mastery R1+. |
| Main Hand One-Hand Sword | Ada pada catalog dan starter hero. |
| Off Hand One-Hand Sword memakai item kedua | Didukung resolver; belum ada template Off Hand khusus, sesuai desain. |
| Dua instance item berbeda | Divalidasi. |
| Shield vs second sword conflict | Divalidasi. |
| Two-Hand conflict | Divalidasi dengan rejection terstruktur. |
| Candidate inventory Off Hand | **Mismatch UI**: normal sword template tidak muncul karena filter slot literal. |
| Equip action | **Match**: resolver menerima sword biasa sebagai Off Hand bila valid. |
| Save/reload instance identity | Foundation menyimpan Main/Off sebagai ID instance terpisah; tidak ada flattening pada jalur yang diaudit. |
| Normal Warrior/Berserker tidak otomatis Dual Wield | Match. |

## 12. Label player-facing

Di `components/game/job-skill.tsx`, `weaponRequirement.join(', ')` masih
dapat menampilkan token internal seperti `dual_sword`. Ini menjelaskan mengapa
label teknis dapat terlihat di panel skill.

Untuk pemain, label yang lebih jelas adalah:

> Dual One-Hand Swords

Namun ini hanya rekomendasi presentasi. Tidak diubah dalam audit ini.

## 13. Kesimpulan owner

### 1. Apa arti `dual_sword`?

Style/requirement runtime untuk kombinasi dua instance One-Hand Sword yang valid,
bukan item katalog.

### 2. Apakah ada item Dual Sword aktual?

Tidak. `ITEM_CATALOG` memiliki 0 item dengan tipe `dual_sword`.

### 3. Blade Master seharusnya memakai dua sword 1H biasa?

Ya. Itu implementasi yang sesuai kontrak SPV3-6: dua item nyata, nilai item tetap
penuh, tanpa item gabungan sintetis.

### 4. Apakah test character memiliki sword kedua?

Tidak. `blade-master-60` hanya memiliki satu Dawnblade.

### 5. Mengapa sword kedua tidak muncul di Off Hand UI?

Karena kandidat UI hanya mencari `equipSlot: 'offHand'`, sedangkan semua
template One-Hand Sword ditandai `mainHand`. Selain itu fixture default memang
belum memiliki instance kedua.

### 6. Masalahnya ada di mana?

Bukan pada arti `dual_sword`, bukan pada `canEquipItem`, dan bukan pada
`validateOffHandCompatibility`. Masalah utamanya adalah **UI candidate
filter**; data inventory test juga belum menyediakan sword kedua. Tidak ditemukan
bukti bahwa job restriction atau kombinasi resolver memblokir konfigurasi valid.

### 7. Minimum recommended fix

Untuk implementasi berikutnya, tanpa mengubah model item:

1. ubah candidate filter Off Hand agar menggunakan validasi slot/equip
   (`canEquipItem`/preview resolver), bukan hanya `item.equipSlot === slot`;
2. pertahankan `equipSlot: mainHand` pada template One-Hand Sword agar tidak
   membuat kategori item Dual Sword palsu;
3. pastikan fixture/player memiliki instance sword kedua yang nyata;
4. gunakan label player-facing `Dual One-Hand Swords` untuk requirement skill;
5. tambahkan regression test bahwa sword `mainHand` template muncul sebagai
   kandidat Off Hand hanya ketika capability dan Main Hand valid.

## 14. Verifikasi dan perubahan

Focused read-only tests yang dijalankan:

- `dual-wield-foundation.test.ts`
- `blade-master-v3.test.ts`
- `blade-master-v3-advanced.test.ts`
- `character-screen.test.ts`

Hasil: **27 passed, 0 failed**.

Git working tree bersih sebelum pembuatan laporan. Tidak ada perubahan kode
production, data item, inventory, UI, save schema, atau combat resolver dalam
fase audit ini. File baru fase ini hanya:

`docs/LUMENFALL_Weapon_DualWield_Data_Audit.md`

Audit berhenti di sini sesuai kontrak. Tidak ada implementasi fix yang
dilakukan.



