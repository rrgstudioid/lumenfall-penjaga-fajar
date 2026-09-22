# LUMENFALL — CFV3-2.1 Implementation Report

Tanggal: 21 September 2026

## Status

CFV3-2.1 telah diimplementasikan pada pipeline Combat Foundation. Tidak ada
perubahan pada damage skill, monster, Rune rarity, FP, Stun, atau Specialization.

## Perubahan implementasi

### 1. Physical resolver

Resolver live sekarang menggunakan:

```text
Base Physical ATK
+ compatible weapon ATK dari equipment
+ bonus STR × faktor weapon
+ equipment/passive modifiers
× physical modifiers
```

Field legacy `hero.weapon × 8` tidak lagi dibaca oleh Combat V3. Field tersebut
tetap dipertahankan sebagai data lama/non-combat agar tidak memperluas scope
migrasi save.

Unarmed sekarang memiliki:

```text
Weapon ATK = 0
STR weapon contribution = 0
```

Knuckle tetap terdeteksi sebagai weapon style yang valid dan tetap memperoleh
kontribusi STR serta ATK equipment.

### 2. Magic resolver

Raw `baseStats.attack` hanya masuk ke generic Magic Attack foundation bila
main-hand adalah `staff` atau `wand`. Sword dan weapon fisik lain tidak lagi
menambah Magic Attack melalui `gear.attack`.

`gear.magicAttack` tetap masuk sebagai modifier Magic Attack tersendiri.
Weapon requirement skill tetap divalidasi oleh `skillWeaponAllowed` pada cast
resolution.

### 3. Rune semantics

- `magicAttack` Rune sekarang diklasifikasikan sebagai `flat`.
- `resourceEfficiency` sekarang diklasifikasikan sebagai `percent` dan tidak
  lagi ditambahkan ke Max Mana.
- `skillDamage%` tetap global untuk damaging physical dan magic skills.
- `elementalDamage%` tetap tersimpan sebagai data dormant sampai Element
  Resolver tersedia.

Tidak ada Rune roll range atau rarity yang diubah.

## Regression coverage

Regression baru mencakup:

- `hero.weapon` tidak memengaruhi physical combat V3.
- Lv61, STR135, unarmed menghasilkan Physical Attack `74`.
- Staff/Wand ATK memengaruhi Magic Attack.
- Sword ATK tidak memengaruhi Magic Attack.
- magicAttack Rune menambah Magic Attack secara flat.
- resourceEfficiency tidak menambah Max Mana.

## Hasil diagnostic

| Kasus | Hasil |
|---|---:|
| Lv61 unarmed, STR135 | Physical Attack `74` |
| Lv61 sword ATK8, STR135 | Physical Attack `202` |
| Lv30 tanpa weapon | Magic Attack `197` |
| Lv30 sword ATK8 | Magic Attack `197` |
| Lv30 staff ATK20 | Magic Attack `217` |

## Test dan build

- Focused CFV3 suite: **8 passed / 0 failed**
- Full `lib/game` suite: **370 passed / 0 failed**
- Production build: dimulai melalui `vinext build`, tetapi kembali berhenti
  pada tahap `transforming...` tanpa output lanjutan. Proses dihentikan setelah
  tidak menunjukkan progress. Ini belum terbukti sebagai regression CFV3-2.1.
- TypeScript: masih gagal karena error lama/generated workspace, termasuk
  stale `staggerResistance` test, error typing appearance, `ui-layout`,
  generated publish tree, dan dependency template yang tidak tersedia. Tidak
  ditemukan error baru yang berasal dari perubahan CFV3-2.1.

## File diubah

- `lib/game/rules.ts`
- `lib/game/items.ts`
- `lib/game/combat-foundation-v3.test.ts`
- `lib/game/mana-potions.test.ts` — ekspektasi lama yang menganggap
  `resourceEfficiency` sebagai Max MP flat disesuaikan dengan kontrak baru.
- `docs/LUMENFALL_CFV3-2.1_Implementation_Report.md`

## Balance dan scope confirmation

- Adventurer: tidak direbalance.
- Warrior: tidak direbalance.
- Thief: tidak direbalance.
- Monster: tidak diubah.
- Rune rarity/roll range/socket/drop rate: tidak diubah.
- FP: tidak ditambahkan atau diubah.
- Stun: tidak ditambahkan.
- Specialization: tidak diimplementasikan atau diubah.

CFV3-2.1 selesai pada level runtime resolver dan regression test. Production
build tetap memerlukan investigasi workspace terpisah karena hang terjadi pada
tahap transformasi umum.
