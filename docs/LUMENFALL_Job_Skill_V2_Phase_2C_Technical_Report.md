# Phase 2C — No-Stamina V2: Technical Report

19 September 2026. Scope: audit → architecture-aware safe disable → backward compatibility. Tidak ada deploy.

## 1. Files audited

Pencarian case-insensitive stamina/maxStamina/staminaMax beserta jalur movement, guard, evade, skill costs, equipment requirements dan CP dilakukan pada source `lib`, `app`, `components`, `tests`; lalu registry hasil generate diperiksa melalui import runtime read-only.

File relevan: `gameplay-config.ts`, `progression.ts`, `rules.ts`, `world.ts`, `city-services.ts`, `items.ts`, `regions.ts`, `skills.ts`, `skill-action.ts`, `combat-modifiers.ts`, `combat-mechanics.ts`, `combat-power.ts`, `combat-power-config.ts`, `character-screen.ts`, `webmcp.ts`, `app/page.tsx`, `app/globals.css`, `components/game/stat-block-list.tsx`, existing `hotbar.test.ts`, `item-descriptions.test.ts`, `skill-runtime-v2.test.ts`, dan `tests/browser/real-components.tsx`.

Audit selesai sebelum perubahan runtime. Baseline:347 tests pass;6 existing TypeScript errors. Temuan pembeda utama: `STAMINA_ENABLED=false` sudah ada sebelum Phase2C.

## 2. Files changed

| File | Perubahan |
|---|---|
| `lib/game/gameplay-config.ts` | Centralized resource policy dan neutral derived stamina helper; legacy switch tetapfalse. |
| `lib/game/rules.ts` | V2 staminaMax0; consumable gating menggunakan policy hero. |
| `lib/game/city-services.ts` | healAtCity membaca enabled resource hero. |
| `lib/game/world.ts` | Player bars, regeneration, healer/refill/reset-stat clamp membaca policy hero. |
| `lib/game/webmcp.ts` | Resource enabled/value presentation mengikuti hero. |
| `app/page.tsx` | HUD stamina conditional memakai policy, bukan global switch. |
| `lib/game/phase-2c.test.ts` |6 regression tests baru. |
| `lib/game/skill-runtime-v2.test.ts` |4 runtime/UI-label tests tambahan. |
| Dua report Phase2C di `docs/` | Laporan pemilik dan teknis. |

Tidak mengubah `items.ts`, `skills.ts`, `regions.ts`, formula CP, equipment balance, atau metadata progression. Working tree memuat perubahan fase sebelumnya; bukan semua git diff adalah perubahan Phase2C.

## 3. Semua dependency Stamina dan klasifikasi

Klasifikasi: **A** active gameplay dependency, **B** UI only, **C** save/backward compatibility, **D** inactive/unused legacy, **E** development/test only. D berarti jalur masih dipertahankan tetapi off pada konfigurasi sekarang, bukan harus dihapus.

| File/fungsi atau data | Pemakaian aktual sebelum perubahan | Kelas |
|---|---|---|
| gameplay-config / STAMINA_ENABLED | Globalfalse menonaktifkan semua pemulihan/bar. | D, config |
| rules / Hero.stamina, freshHero, parseSave, saveCharacter | Current value default100; parser clamp0..9999; save mempertahankan current field. | C |
| rules / derivedStats.staminaMax | `round(100 + VIT×4 + gear.stamina)` masih dihitung walau resource off. Tidak dipakai biaya action. | C/D, internal derived value |
| rules / consumeInventoryItem | Efek stamina ditolak sebelum consume/cooldown jika off; cabang pemulihan ke max masih ada. | D |
| city-services / healAtCity | Pemulihan stamina gated; HP/MP/status tetap bekerja. | D |
| world / field stamina, constructor, character load, snapshot, save, respawn, useItem | Mirror current value, synchronization, default reset100; bukan cost atau requirement. | C |
| world / cityAction, action('heal'), addStat clamp | Refill/clamp gated oleh enabled flag. | D |
| world / tick | Regeneration18/sec jika enabled; tidak ada drain. | D |
| world / createPlayerStatusLabel, updateFloating | Bar dunia, title, aria label, normalized value. | B |
| app/page / initial snapshot, HUD stamina-line | Snapshot placeholder dan conditional bar. | B/C |
| globals.css | Styling stamina-line/bar dan world-resource bar, tidak dihapus. | B/D |
| webmcp / progress | enabled flag dan nullable stamina output; raw Hero tetap compatibility data. | B/C |
| items / StatBlock.stamina, normalizeStatBlock, FLAT_STATS, ItemUseEffect, normalizeItem | Bisa menerima bonus/effect stamina dari data lama; bukan requirement equipment. | C/D |
| items / rice-meal, description helpers | Consumable stamina retained dan teks inactive. | B/D |
| regions / serviceDescriptions.healer | Teks global berdasarkan legacy switchfalse. | B |
| hotbar.test, item-descriptions.test, browser snapshot fixture | Legacy disabled food, preserved state, presentation tests. | E |

**A: tidak ditemukan action gameplay aktif yang bergantung pada Stamina pada konfigurasi baseline.** Skill/dash, manual guard, lari, evasion, equip authorization dan CP tidak memiliki biaya/requirement Stamina. Tidak ada runtime field stamina regeneration/cost reduction sebagai mechanic aktif.

## 4. Resource policy implementation

`resourcePolicy(hero, legacyStaminaEnabled = STAMINA_ENABLED)` menyediakan HP/Mana true dan Stamina `legacy && legacyStaminaEnabled`. Override legacy boolean hanya digunakan untuk menguji bahwa V2 tetapfalse saat legacytrue. Call sites produksi menggunakan defaultfalse.

`isResourceEnabled(hero, 'hp'|'mana'|'stamina')` menjadi helper gameplay/display. Pengecekan `progressionArchitecture === 'v2_test'` tidak disebarkan ke consumers; policy menggunakan discriminator yang sudah ada. Tidak ada resource engine atau cost system kedua.

`retainLegacyStaminaStat` memisahkan preservation formula lama dari enabled gameplay; legacy tetap menyimpan rumus kapasitas lamanya walau flag off. `staminaDerivedValue` memberi0 khusus V2.

## 5. V2 disable behavior

Skill/movement/guard tetap tidak mempunyai stamina gate. Pemulihan, regeneration, UI bar, dan consume effect stamina sekarang membaca hero policy. Bahkan bila sakelar legacy diganti menjadi true, V2 consumers tetapfalse. V2 staminaMax0 merupakan safe inactive value; HUD tidak membaginya karena resource tidak dirender. World normalization memiliki guard max1 dan stamina key tidak ditambahkan untuk inactive resource.

Current Hero/world stamina number tetap ada untuk compatibility. Menyimpan atau menginisialisasi angka tersebut bukan mengaktifkan stamina gameplay. Tidak ada stamina requirement pada skill/equipment atau alasan cast/movement ditolak karena nilainya nol. Penggunaan consumable khusus stamina tetap ditolak agar item tidak terbuang pada resource inactive—bukan pembatas combat.

## 6. Legacy compatibility

Legacy flagfalse tetapfalse, tidak menghidupkan resource lama. Branch pemulihan/regenerasi dan field tidak dihapus. Legacy formula kapasitas tetap identik. Existing disabled-food tests tetap lulus. Jalur paid/granted ranks, job progression, mana, stagger/poise, dan save version tidak diganti.

## 7. VIT / derived stat

Legacy: `round(100 + vit×4 + gear.stamina)`. V2:0 sebagai compatibility field, bukan build stat. Tidak memindahkan VIT×4 ke HP/MP atau menambah bonus kompensasi.

Test +10 allocatedVIT masih menghasilkan +100HP, +5 physicalDefense dan +1 Tenacity sesuai baseline; staggerResistance tetap alias Tenacity. Character stat rows dan VIT tooltip sudah tidak memuat staminaMax sebelum task, dan tetap demikian.

Penting: `sta` pada data equipment lama dinormalisasi ke `vit`. Itu Vitality alias, **bukan** resource `stamina`, sehingga tidak dinetralkan/dihapus.

## 8. Dodge behavior

Audit tidak menemukan active dodge method/input/cooldown. F mengaktifkan manual guard; movement selalu run. Defensive automatic evasion berada di `hurtHero`, memakai derived evasion chance dan RNG; tidak membaca Stamina.

Required testB ditangani dengan tes mechanic yang benar-benar tersedia: evasion dengan positive evasion rating tetap berhasil pada stamina0, untuklegacy danV2. **Tidak mengklaim active dodge telah diimplementasikan/diuji.** Future active dodge adalah keputusan/task terpisah; tidak dibangun sebagai pengganti Stamina.

## 9. Guard behavior

F toggles blocking. `hurtHero` menerapkan multiplier manual guard existing0.3, setelah mitigation dan dalam reduction group existing; tidak ada drain/tick/cost. Runtime test membandingkan damage guarded versus unguarded pada stamina0. Parry tetap state terpisah. Tidak mengubah nilai guard atau membuat Guard Stance skill.

## 10. Movement behavior

`moveVector`, `move`, `moveHeroOnGround` dan collision tidak membaca Stamina. Tick tetap memakai moderate always-run speed `6.2 × movementSpeed/100 ×1.22`; Shift bukan sprint resource toggle. Dash skill masih memakai existing movement path serta mana/cooldown. Real movement/collision path dan dash cast diuji saat Stamina0; tidak ada movement rewrite.

## 11. Skill costs dan requirements

Semua runtime-generated `ALL_SKILLS` diperiksa: tidak ada staminaCost, requirement atau scaling stamina. `canCastSkill`/final mana payment tetap menggunakan Mana dan cooldown/context sesuai Phase2B. Runtime test memverifikasi mana berkurang satu kali, cooldown terpasang, dan mana0 tetap menolak cast walau Stamina diabaikan. Equipment validation tidak memiliki stamina requirement.

## 12. UI behavior

HUD `app/page.tsx` dan world player label/bar update sekarang memakai policy hero. V2 tidak membuat world Stamina bar, title, aria label maupun nilai resource output. DOM fixture menjalankan `createPlayerStatusLabel` asli dan menghasilkan hanya dua bar: HP/Mana. Character derived stat list tidak menampilkan staminaMax. WebMCP mengembalikan staminaEnabledfalse dan stamina null; rawHero.stamina tidak dibuang demi compatibility.

Tidak ada redesign. Panduan Next.js diterapkan hanya untuk menjaga kondisi tampilan tetap sebagai kalkulasi client-safe tanpa server/client boundary baru. Static CSS dan teks katalog disabled item tetap ada. Inspector raw bonus item impor dapat menampilkan field data lama; itu bukan player resource atau bonus stat efektif. Teks global katalog/healer perlu review jika legacy flag diaktifkan lagi; flag tersebut tidak diubah pada task ini.

## 13. Save compatibility

`Hero.stamina` default100 dan parser0..9999 dipertahankan. Save fixture legacy/V2 dengan stamina17 bertahan melalui parse/round-trip. Missing stamina diterima dengan default existing. Tambahan `maxStamina`, `staminaMax`, atau `staminaRegen` tidak membuat parser crash; field tersebut memang bukan declared persisted Hero schema, dan tetap diabaikan seperti sebelumnya, bukan ditambahkan migration baru.

Raw StatBlock bonus stamina dipertahankan oleh normalizer/item save; V2 calculator mengabaikan efeknya melalui neutral derived field. Tidak mengakses/menghapus save pengguna, tidak melakukan bulk migration, dan tidak mengganti save version.

## 14. Equipment / affix / rune / passive audit

Hasil enumerasi registry runtime serta source pools:

| Kategori | Semua temuan terkait Stamina |
|---|---|
| Equipment template dengan bonus stamina | Tidak ada. |
| Affix generation pool stamina | Tidak ada; FLAT_STATS masih mengenali key legacy untuk compatibility. |
| Rune theme pools / registered rune templates | Tidak ada. |
| Unique Stat pool | Tidak ada. |
| ALL_PASSIVES / PASSIVE_EFFECTS | Tidak ada. |
| ALL_SKILLS stamina costs/scaling | Tidak ada. |
| Consumable | `rice-meal` — Blessed Rice Meal, `useEffect:{type:'stamina'}`. |
| Import/save arbitrary bonus | StatBlock.stamina accepted; unknown finite stat keys bisa disimpan tetapi bukan gameplay mechanic aktif. |

Blessed Rice Meal tetap ada dengan quantity/cooldown untouched saat ditolak. Tidak ada replacement stat. Test memakai bonus stamina999, regen99 dan costReduction90 sebagai fixture data impor, **bukan stat/item baru**. Final V2 stats/CP tidak berubah dan bonus stamina tetap ada setelah load.

## 15. Combat Power

Tidak ada formula CP yang membaca currentStamina/staminaMax/staminaRegen/staminaCostReduction. Power calculator secara eksplisit memakai offense, HP/mitigation, mana/sustain, utility dan efek yang didukung, bukan menjumlah semua derived fields. Karena itu tidak diperlukan architecture-specific CP formula kedua.

Regresi: ubah current stamina0→9999 dan equipped bonus stamina → final V2stats dan CP tetap identik. Pure CP evaluator juga diberi stats.staminaMax99999 dan hasil tetapidentik. Cache/definition existing tidak direwrite.

## 16. Tests added

Enam tests `phase-2c.test.ts`:

1. Policy HP/Mana selaluactive; legacyfalse/true dan V2false di kedua konfigurasi.
2. VIT meaningful stats, V2staminaMax0, hidden character stat/tooltip, legacy formula preserved.
3. Imported equipment stamina/regen/cost-reduction data tidak mengubah finalV2stats/CP; item data survives load.
4. Legacy/V2 save present/missing stamina dan tolerated extra aliases.
5. City healer HP/MP tetap bekerja; inactive food tidak consume/cooldown/mutate.
6. Registry audit invariants; resource presentation consumers menggunakan centralized helper.

Empat tests tambahan `skill-runtime-v2.test.ts`:

7. V2 stamina0 dash skill succeeds; actualmana/cooldown charged; insufficientmana stillrejects.
8. Manual guard/automatic evasion atstamina0 untuk kedua architectures.
9. Actual moveVector + move/collision path bergerak pada stamina0.
10. Actual world label method renders HP/Mana only, no stamina tooltip/title/aria.

Tidak ada legacy test dihapus atau expected result lama diturunkan. Test fixtures tidak diregistrasikan sebagai content production.

## 17. Full regression result

Before:347passed,0failed. After:**357passed,0failed,0skipped**. Full `lib/game` Node test suite dijalankan, termasuk Phase0/1A/1B/2B. Focused lint pada policy/newtests/integrationtests exit0. Metode runtime diuji headless, bukan sesi WebGL gameplay lengkap; browser playtest tidak dilakukan pada task ini.

## 18. Production build

`node node_modules/vinext/dist/cli.js build`: berhasil, exit0, lima build stages selesai. Warning chunk>500kB, plugin timings, dan route classification existing tidak menyebabkan failure. Tidak ada devserver/deploy yang dijalankan untuk task ini.

## 19. TypeScript before / after

Before6; after6; new0. TypeScript tetap belum clean:4 string/literal-union appearance errors di rules.ts356–359, ui-layout.ts64 missing scale, dan browser snapshot fixture real-components.tsx177 missing cameraMode. Tidak diubah di Phase2C, tidak diklaim sebagai error baru, dan tidak ditutupi oleh build success.

## 20. Remaining TODO dan batas akhir

- Tetap gunakan centralized resource policy pada future gameplay/UI consumers; jangan menjadikan global legacy flag sebagai otoritas V2.
- Bila active dodge dibutuhkan Warrior design, tentukan action availability/cooldown pada task terpisah. Jangan menganggap automatic evasion sebagai tombol dodge.
- Jika legacy Stamina dihidupkan kembali, audit teks katalog global agar tidak memberi informasi pemulihan yang keliru kepada V2; gameplay V2 tetap off lewat helper.
- Keputusan mengganti/menghapus makanan atau raw stamina bonus dari save impor adalah item-balance/cleanup task terpisah. Saat ini datanya tidak dibuang.
- Legacy fields/CSS/regen branches sengaja dipertahankan. Cleanup final baru setelah stabil dan mendapat instruksi.

Tidak ada blocker Stamina untuk mulai balance skill berbasis Mana/cooldown. Tidak ada skill/passive Warrior V2, Rage/Flow, job activation, monster/equipment/EXP rebalance, save wipe, atau mass deletion. Phase2C berhenti di sini, menunggu instruksi berikutnya.
