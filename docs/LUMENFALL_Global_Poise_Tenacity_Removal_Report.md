# LUMENFALL — Global Gameplay Removal Report

Tanggal: 2026-09-22  
Status: **SELESAI — DEVELOPMENT**

## Hasil

Sistem poise/Stagger telah dihapus dari source gameplay aktif. Tenacity juga telah dihapus sebagai stat gameplay, modifier stat, Rune affix, dan tampilan Character Sheet.

Hit reaction visual dan displacement biasa tetap tersedia melalui `knockbackStrength`. Field legacy bernama `stagger` tidak lagi menjadi bagian dari skill schema, rank values, resolved action, atau modifier pipeline.

Stun tidak ditambahkan.

## Yang dihapus

- Stagger/poise payload dari resolved skill action dan hit.
- Legacy stagger rank values dan alias stagger→knockback.
- Stagger-specific skill tags dan conditional payoff.
- Stagger multiplier di incoming modifier.
- Stagger-only Warrior effects pada Rising Slash, Ground Breaker, Crushing Finale, Firm Footing, Heavy Impact, Indomitable Will, Counter Training, Great Weapon Familiarity, Great Weapon Momentum, dan Unbroken Stance.
- Tenacity dari `StatBlock`, `DerivedStats`, modifier stat, kalkulasi VIT, dan cap stat.
- Tenacity dari Battle Cry.
- Tenacity dari Rune Guardian pool dan label stat.
- Tenacity dari Character Sheet dan stat-block display.
- Test lama yang bergantung pada subsystem Stagger; diganti dengan regression test netral untuk memastikan action tetap memiliki knockback dan stat poise tidak muncul.

## Yang dipertahankan

- `knockbackStrength` sebagai displacement/hit reaction gameplay yang terpisah dari gauge atau break system.
- Generic status framework, termasuk kemampuan future `stun`, tanpa mengaktifkan Stun pada skill mana pun.
- Armor Break, slow, poison, guard, counter, damage, cooldown, Mana, dan identitas non-poise lainnya.
- Historical design/audit documents sebagai arsip; dokumen lama tidak dianggap sebagai runtime source.

## File runtime utama

- `lib/game/skills.ts`
- `lib/game/skill-action.ts`
- `lib/game/rules.ts`
- `lib/game/items.ts`
- `lib/game/combat-modifiers.ts`
- `lib/game/warrior-v2.ts`
- `lib/game/thief-v2.ts`
- `lib/game/character-screen.ts`
- `components/game/stat-block-list.tsx`

Test baru/yang diperbarui:

- `lib/game/control-stat-removal.test.ts`
- `lib/game/phase-1b.test.ts`
- `lib/game/phase-2b.test.ts`
- `lib/game/phase-2c.test.ts`
- `lib/game/stat-system-final.test.ts`
- `lib/game/combat-power.test.ts`
- `lib/game/thief-v2.test.ts`

## Validasi

Perintah test runtime:

```text
node --experimental-strip-types --test lib/game/*.test.ts
```

Hasil:

- **369 passed**
- **0 failed**
- **0 cancelled**

TypeScript checker mandiri (`tsc`) tidak tersedia sebagai executable lokal, sehingga validasi yang tersedia pada environment ini adalah full runtime test suite.

## Catatan scope

Perubahan ini tidak mengubah skill damage, cooldown, Mana cost, monster, Rune rarity, FP, Stun, Specialization, map, atau production publishing. Historical report dan generated output lama tetap disimpan sebagai arsip dan tidak dibaca sebagai runtime gameplay.
