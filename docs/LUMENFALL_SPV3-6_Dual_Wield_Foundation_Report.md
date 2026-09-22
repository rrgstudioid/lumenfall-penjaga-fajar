# LUMENFALL — SPV3-6 Dual Wield Foundation Report

Status: **IMPLEMENTED / TESTED / RUNTIME VALIDATED**

Fase ini hanya membangun fondasi Dual Wield. Blade Master, Twin Blade Mastery,
dan seluruh skill Blade Master belum dibuat atau diaktifkan.

## 1. Arsitektur equipment sebelum perubahan

LUMENFALL sudah memiliki `mainHand` dan `offHand` pada `EquipmentLoadout`,
serta item equipment tetap disimpan sebagai instance inventory terpisah.
Jalur lama masih memiliki kompatibilitas dual weapon untuk karakter V2.

## 2. Slot dan capability

Ditambahkan capability eksplisit `canDualWieldOneHandSwords`.
Nilai default karakter baru adalah `false`. Jalur V3 hanya menerima dua
One-Hand Sword berbeda jika capability ini secara eksplisit `true` melalui
fixture development. Warrior dan Berserker tidak diberi capability tersebut.

V2 tetap memakai perilaku legacy agar coexistence dan save lama tidak rusak.

## 3. Validasi konfigurasi

Konfigurasi Dual Wield yang valid adalah Main Hand One-Hand Sword + Off Hand
One-Hand Sword. Two-Hand Sword tidak valid sebagai Off Hand dan konflik dengan
Off Hand Sword ditolak menggunakan reason code:

- `DUAL_WIELD_CAPABILITY_REQUIRED`
- `TWO_HAND_CONFLICT_WITH_OFFHAND_WEAPON`
- `OFFHAND_WEAPON_REQUIRES_ONE_HAND_SWORD`
- `SHIELD_CONFLICT_WITH_OFFHAND_WEAPON`

Operasi ditolak sebelum equipment dimutasi. Item tidak dihapus, ditimpa, atau
dipindahkan ke slot lain secara diam-diam. Shield tetap kompatibel dengan
One-Hand Sword, tetapi tidak dapat hidup bersamaan dengan Off Hand Sword.

## 4. Full item value

Tidak ada `offhandPenalty`. Main dan Off Hand mempertahankan Weapon ATK,
enhancement, Rune, affix, Unique Stats, socket, rarity, dan identitas item
masing-masing.

## 5. Shared character contribution

`aggregateEquipmentStatOnce()` menggabungkan kontribusi karakter dari kedua
item menjadi satu layer. Contoh fixture: STR +8 dan +7 menjadi +15, Crit +2%
dan +3% menjadi +5%. Konversi primary stat tetap dilakukan sekali pada layer
karakter, bukan sekali per senjata.

## 6. Weapon Attack context

Modul `lib/game/dual-wield.ts` menyediakan context eksplisit:

- `sharedPhysicalCore`
- `mainHandWeaponAttack`
- `offHandWeaponAttack`
- `totalWeaponAttack`

Mode yang tersedia:

- `SINGLE_MAIN`
- `SINGLE_OFF`
- `DUAL_COMBINED`
- `DUAL_SEQUENCE`

`SINGLE_MAIN` hanya memakai Main Hand raw Weapon ATK. `DUAL_COMBINED`
menggunakan kedua layer penuh tanpa penalti 50%. `DUAL_SEQUENCE` menyediakan
metadata hand, shared contribution weight, weapon coefficient, skill
coefficient, dan delay agar total shared contribution tidak terduplikasi.

## 7. Unique Effect

Item mendukung metadata stabil `uniqueEffectData` berisi ID, magnitude,
priority, dan `stackable`. Duplicate effect ID non-stackable memilih magnitude
terbesar; tie memakai priority lalu Main Hand sebagai tie-break deterministik.
Effect berbeda dapat aktif bersamaan. Effect yang eksplisit `stackable` dapat
aktif lebih dari satu. Display text tidak digunakan sebagai identitas utama.

## 8. Save/reload dan inventory safety

Main Hand dan Off Hand tetap direferensikan melalui dua ID instance terpisah.
Save/reload mempertahankan kedua ID serta `uniqueEffectData`; normalizer tidak
meratakan keduanya menjadi synthetic item. Capability disimpan sebagai flag
opsional dan default aman `false`.

Active Dual Wield combat state belum ada sehingga tidak ada transient combat
state baru yang perlu dipersist.

## 9. Fixture runtime bersih

Fixture browser development-only:

`tests/browser/dual-wield-foundation-fixture.html`

Tidak mengimpor `world.ts`, terrain, map, GLB, NPC, population, audio, atau
Flaris. Evidence fixture:

| Check | Hasil |
|---|---:|
| Main Hand layer | 100 |
| Off Hand layer | 70 |
| SINGLE_MAIN raw attack | 100 |
| DUAL_COMBINED raw attack | 170 |
| Shared physical core | 200 |
| Equipment STR | +15 |
| Equipment Crit | +5% |
| Duplicate Unique Effect aktif | 1 instance, magnitude 10 |
| World/map loaded | false |
| Browser errors/warnings | 0 |

## 10. Regression dan compatibility

- Focused Dual Wield + equipment UI tests: **20 passed / 0 failed**.
- Full `lib/game`: **418 passed / 0 failed**.
- Clean browser fixture: **PASS**.
- Production build: **PASS**, seluruh tahap Vite/Vinext selesai.
- Warrior V3 dan Berserker V3 tetap lulus dalam full regression.
- Armor Break ownership/numeric reconciliation dan Stun tetap lulus dalam full regression.
- V2 dual-weapon compatibility tetap dipertahankan; capability gate ketat
  hanya diterapkan pada jalur V3.

## 11. Known limitations

Fondasi ini belum mengaktifkan player-facing Dual Wield capability dan belum
mengubah Basic Attack menjadi alternating-hand attack. Belum ada Blade Master,
Twin Blade Mastery, skill sequence nyata, PvP, proc redesign, atau UI Character
Power khusus yang menampilkan tiga layer secara visual. Sistem proc lama belum
dimigrasikan seluruhnya ke metadata Unique Effect baru; resolver generik sudah
tersedia untuk fixture dan integrasi berikutnya.

## 12. File yang ditambahkan/diubah

- `lib/game/dual-wield.ts`
- `lib/game/items.ts`
- `lib/game/rules.ts`
- `lib/game/dual-wield-foundation.test.ts`
- `lib/game/dual-wield-foundation-fixture.ts`
- `tests/browser/dual-wield-foundation-fixture.html`
- `tests/browser/dual-wield-foundation-fixture.ts`
- `scripts/verify-dual-wield-foundation.mjs`

## 13. Rekomendasi SPV3-7

Sebelum Blade Master, lakukan owner review terhadap API capability dan pilih
skill Blade Master pertama yang akan mengaktifkannya. Jangan mengaktifkan
capability secara global; aktivasi harus tetap berasal dari rank skill/job
yang disetujui pada fase berikutnya.
