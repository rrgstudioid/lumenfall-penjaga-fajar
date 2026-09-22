# LUMENFALL — Phase 3C-PRE: Legacy Job Visibility Cleanup

20 September 2026. Local implementation only; no public deployment or migration.

## REPORT A — Game owner

### Hasil

Tampilan karakter V2 kini dipisahkan dari progression legacy. V2 Warrior menampilkan Adventurer → Warrior, dengan Berserker / Blade Master berstatus Locked / not yet implemented. Preview arsitektur lengkap memakai nama canonical, termasuk **Assasin**, dan tidak menyediakan tombol untuk mengaktifkan job yang belum selesai.

Legacy sebelumnya masih terlihat dari daftar kelas/promotion bersama, petunjuk HUD yang menyebut specialization/Mastery/capstone lama, layanan dan deskripsi NPC, serta class quests di jurnal. Registry yang sama juga memasok nama item/rune dan tooltip yang menyebut job lama. K sudah memfilter skill V2, tetapi subtitle masih menyebut “empat skill aktif” dan tombol J; emblem karakter juga belum memfilter arsitektur passive.

Yang diperbaiki:

- K: tetap 16 active + 14 passive Warrior V2 pada tahap Core, dan konten Adventurer pada tahap awal. Tidak memasukkan tree Warrior legacy, Gatotkaca, Garda, Mastery atau Capstone. Petunjuk kini menyebut **K**, bukan J.
- C: label/emblem mengikuti arsitektur karakter. Tombol **Job view** membuka informasi arsitektur, tanpa mengubah ukuran area stats/equipment. Future jobs terkunci; tidak ada promotion baru.
- Job/promotion: V2 menampilkan preview saja, bukan pilihan specialization legacy. Legacy tetap mendapat pilihan fungsional aslinya.
- HUD, NPC trainer/specialization, label layanan pada map, deskripsi layanan, dan jurnal: informasi progression lama tidak lagi digunakan untuk V2. Quest non-class tetap ada; data class quest lama tidak dihapus.
- Item/rune yang menyebut sepuluh nama job lama memakai alias tampilan **Legacy** di V2 pada daftar, detail/tooltip, equipment, hotbar, drag preview, forge, dan notifikasi. Nama/ID/restriction item di registry dan save tetap asli. Ini bukan pemetaan job lama ke job V2.
- Pemain legacy tetap melihat nama job/item aslinya. Character selection/save labels menggunakan resolver label arsitektur yang sama. Character creation tetap Adventurer existing, tidak menawarkan job V2 baru.

### Yang sengaja tetap ada bagi karakter publik legacy

| Surface publik legacy | Keputusan |
|---|---|
| Job yang sudah dimiliki, label karakter/HUD/save slot | **REQUIRES JOB V2 MIGRATION FIRST** sebelum identitas ini boleh diganti/disembunyikan |
| K legacy: Core, specialization, Mastery, Capstone existing | **REQUIRES JOB V2 MIGRATION FIRST**; konten yang sah tetap tersedia |
| NPC/promotion Core dan specialization, persyaratan/quest progression | **REQUIRES JOB V2 MIGRATION FIRST**; tidak mencabut pilihan yang dibutuhkan pemain |
| Nama/requirements equipment dan rune legacy | **REQUIRES JOB V2 MIGRATION FIRST** sebelum penggantian menyeluruh; item/restriction tidak diubah pada fase ini |
| Subtitle “Empat skill aktif … J untuk tutup” | **SAFE TO HIDE NOW**; sudah diganti petunjuk netral dengan K |
| Preview informasi nonfungsional jika kelak dipublikasikan | **SAFE TO HIDE/REPLACE NOW**, asalkan future jobs jelas terkunci; preview baru saat ini hanya untuk V2 |

Tidak ada old class yang dihapus dari data. Semua 10 specialization lama diuji tetap dapat dimuat, ditampilkan, dan menyediakan skill miliknya. Tidak ada Gatotkaca → Berserker atau Garda → Blade Master conversion. Tidak ada perubahan level, SP, damage, cooldown, progression, equipment balance, atau Global Hard Targeting.

### Validasi

- Baseline 456 → **461 passed, 0 failed**; semua tes existing dipertahankan.
- **5 test baru** khusus presentation, canonical metadata, seluruh specialization legacy, quest/NPC dan alias item tanpa mutasi.
- Browser: tidak menemukan sepuluh nama legacy, Capstone, atau Mastery pada normal UI V2 yang diuji: HUD; K Core/Adventurer; C dan full Job preview; J; NPC specialization; Job/promotion; Equipment Merchant; tooltip item legacy.
- Legacy browser: K tetap menampilkan Gatotkaca / Garda; kedua pilihan specialization tetap enabled untuk karakter uji yang memenuhi level. Tidak ada pilihan yang ditekan, sehingga job tidak berubah.
- TypeScript primary source: **6 existing sebelum → 6 sesudah; 0 baru**.
- Production build: berhasil. Situs publik belum diubah.

**Kesimpulan:** job architecture lama tidak lagi bocor pada jalur normal V2 yang diaudit/diperiksa. Ini tidak berarti data legacy dihapus, nama yang diketik pemain disensor, atau seluruh legacy UI publik sudah dimigrasikan. Public V2 migration dan Berserker/Blade Master tidak dimulai.

## REPORT B — Technical

### Visibility classification (A–E)

A = internal compatibility; B = functional legacy UI; C = V2 leak; D = shared architecture-aware surface; E = stale/static copy.

| File/surface audited | Classification | Treatment |
|---|---|---|
| lib/game/skills.ts legacy Core/spec/passive/skill registries | A; B when consumed for legacy | Retained unchanged by this phase. ALL_SKILLS authorization remains authoritative. |
| lib/game/job-registry-v2.ts | A / canonical metadata | Reused 7 Core, 14 specialization, 14 future Advanced IDs. playable remains false in metadata. |
| lib/game/rules.ts parsers, save fields, chooseCoreJob/chooseSpecialization/chooseMastery, restrictions | A / B | No migration or gameplay changes. Only displayLabel becomes architecture-aware. |
| lib/game/items.ts job restrictions, names/descriptions, alias tables | A / B / D | Source identity/requirements retained. Read-only V2 display alias at UI boundary. |
| lib/game/character-view.ts getJobProgression/getJobSkillNodes | D | V2 canonical label; two implemented K stages retained. Existing skillArchitectureAllowed filter unchanged. Legacy five-stage path retained. |
| components/game/job-skill.tsx | B / D | V2 cannot start on a stale legacy specialization stage or show saved legacy Mastery footer. Nodes use resolved valid stage. Legacy controls remain. |
| app/page.tsx old class/promotion panel | C / D | Shared selector removes actionable legacy choices for V2; read-only canonical preview instead. Legacy choices preserved. |
| app/page.tsx Job Skill subtitle | E | Replaced stale four-skill/J text with active/passive/K instruction for both architectures. |
| lib/game/world.ts snapshot.classQuest | C / D | V2 hint from presentation selector; original legacy hint chain retained. |
| lib/game/world.ts NPC world labels; app NPC/map dialogs; regions.ts service descriptions | C / D | getNpcServiceLabel accepts optional hero; V2 job services become preview-only labels and honest unavailable descriptions. Legacy default unchanged. |
| regions.ts class-core/class-specialization/class-mastery journal rows | C / D / B | getAllQuestJournalEntries filters class rows for V2 presentation only. Quest registry/execution and legacy journal untouched. |
| components/game/character-screen.tsx | D | Canonical characterLabel; emblem uses skillArchitectureAllowed; V2 Job view in existing Popover primitive. No legacy C rewrite. |
| components/game/menu-presentation.tsx selection/save roster labels | D, already shared label caller | characterLabel now handles V2 at source. No separate menu implementation or save write. |
| Character creation/main menu | No actionable V2 job list found | Existing Adventurer creation and save-slot flow unchanged. No fake future character options. |
| app merchant/inventory/storage/detail/sell UI; item-hover.tsx, inventory-grid.tsx | D | Visible text and relevant accessible names apply presentation-only alias. Hover remains read-only. |
| primary-hotbar.tsx and drag-drop-provider.tsx | D | Existing allowed skill resolver retained; displayed item/rune labels and descriptions pass presentation boundary. No ownership/binding/drag-rule changes. |
| character-screen.tsx equipment; forge-panel.tsx; rune-forge-panel.tsx; rune-details.tsx | D | Text/requirement labels and confirmation strings get display alias, not mutation of selected object or action arguments. |
| Skill ownership display | D, existing authorization already correct | V2 inherited Adventurer + Warrior V2 only; paid/granted/ranks/selection logic untouched. |
| tests/browser/warrior-world.tsx and warrior-world-fixture.ts | A / developer surface | Memory-only harness reused. Debug diagnostics remain opt-in raw technical state, not player job navigation. No public query entrypoint added. |
| rules.test.ts, character-ui.test.ts, city-layout.test.ts and historical docs/export scripts | A / historical | Legacy fixtures and old terminology intentionally retained. No deletion to satisfy text search. |

The source audit searched app, components, lib, tests and scripts for all ten names plus Mastery/Capstone; also traced dynamic consumers of CORE_JOBS, SPECIALIZATIONS, characterLabel, getJobProgression, NPC labels, quest entries, item labels and hotbar entries. Generated builds, archived source packages, assets and historical reports are not executable normal V2 UI and are not mass-cleaned.

### Implementation

`lib/game/job-presentation.ts` contains `getVisibleJobArchitecture(hero)`, `showJobQuest` and `presentJobText`. It is read-only, imports Hero as a type, and does not call gameplay mutation or persistence. The architecture check is centralized. V2 canonical branches are derived once from JOB_V2_REGISTRY; display metadata does not grant playable authorization. No legacy-to-V2 equivalence table exists.

`getVisibleJobArchitecture` returns currentName, legacyProgression, coreChoices, specializationChoices, futureSpecializations, canonical branches and HUD hint. V2 receives no actionable legacy choices. Warrior is marked implemented/development-only; other Core and all specialization jobs are not implemented/locked; Tier3 is future/locked. Spelling Assasin is preserved. Adventurer/Warrior are the only implemented content described.

`JobArchitecturePreview` is shared by C Job view and the existing Job/promotion panel. All job names are information, not buttons. C uses the installed Base UI Popover so the full architecture does not expand the Character header and compress equipment/stats. The preview opts out of window dragging and uses a bounded scrolling area.

`JobPresentationContext` carries the current hero to small text renderers, including React portals. `JobText` and `presentJobText` substitute exact whole-word legacy names with Legacy only for V2 presentation. No dictionary key, item ID, object passed to a trade/equip action, source name, or save field is rewritten. Substring words such as Resin/resistance remain unchanged. This alias does not imply that a legacy-restricted item is usable by a V2 job.

K continues to use `getJobSkillNodes` with architecture filtering. No new future K nodes are registered. Choosing a future job in the preview is impossible because there is no promotion callback. J/K input mappings are untouched; only incorrect help copy changed.

### Files changed this phase

New:

- lib/game/job-presentation.ts
- lib/game/job-presentation.test.ts
- components/game/job-architecture-preview.tsx
- components/game/job-presentation-context.tsx
- tests/browser/job-visibility-regression.mjs
- docs/LUMENFALL_Phase_3C_PRE_Visibility_Report.md

Updated:

- app/page.tsx
- lib/game/character-view.ts
- lib/game/rules.ts (display label only)
- lib/game/regions.ts (NPC/journal presentation only)
- lib/game/world.ts (HUD hint/NPC label only in this phase)
- components/game/character-screen.tsx
- components/game/job-skill.tsx
- components/game/item-hover.tsx
- components/game/inventory-grid.tsx
- components/game/primary-hotbar.tsx
- components/game/drag-drop-provider.tsx
- components/game/forge-panel.tsx
- components/game/rune-forge-panel.tsx
- components/game/rune-details.tsx

Other dirty files from previous targeting work and unrelated user files are preserved, not part of this phase's implementation.

### Tests and evidence

Five new unit regressions:

1. Canonical V2 view, locked metadata, 30 Warrior nodes, inherited Adventurer, no hero mutation.
2. Stale legacy specialization/Mastery data cannot leak through V2 label/progression/nodes.
3. All ten legacy specializations survive parseSave, keep original labels, skills and progression choices; hard targeting remains enabled.
4. NPC/class-quest presentation differs by architecture; non-class quests unchanged.
5. Item display aliases preserve legacy output and substring words; no registry rename.

Full game suite: 456 before, **461 passed / 0 failed / 0 skipped** after. No existing test removed or weakened. An interim test failure from adding a third K progression stage was resolved by keeping the original two implemented stages and using a separate nonfunctional preview; the old assertion remains intact.

Browser verification uses installed Chrome + existing Playwright on localhost:3003 memory-only harness. agent-browser skill was consulted, but its CLI is unavailable. No browser package installation, no production save access, no native storage writes. Real Home/Continue/Padang runtime and UI components were used. The animation loop was frozen for deterministic UI assertions; NPC dialog tests dispatched the existing NPC-open UI event, not a claimed physical walk to every NPC.

`tests/browser/job-visibility-regression.mjs` scans visible body text with whole-word forbidden-name checks over ten V2 surfaces, confirms 30 K nodes, inherited Adventurer, canonical locked preview including Assasin, no future job buttons, legacy K and enabled legacy promotion choices. Browser page errors: none. Memory test job remains unchanged. Evidence: output/job-visibility/browser-evidence.json, v2-character.png, v2-job.png, legacy-job.png. Character screenshot visually checked; the preview no longer compresses stats/equipment.

Existing global-targeting browser regression is also rerun separately: real click select/attack/switch/clear, selected recipient despite closer enemy, range rejection, target ring/frame, UI click exclusion and death cleanup. No targeting implementation changes in this phase.

Selection/create/save-label compatibility is verified through source tracing and label/save unit tests; not every individual menu slot, forge confirmation or arbitrary inventory combination is exhaustively clicked. Internal IDs and user-authored names are not sanitized. Optional raw developer diagnostics are not a claim of player-facing canonical navigation.

### Build, TypeScript, safety

Production build succeeds using the installed vinext entrypoint. The existing Sites build wrapper still cannot locate its Windows package-manager shim; no dependency/config rewrite was used. Existing nonfatal warnings remain: large client chunk, plugin timing and unknown route classification.

Primary-source TypeScript baseline from completed previous phase: 6. Final: 6, no new errors. Existing errors are rules.ts appearance fallback four string-union errors, ui-layout.ts scale, and tests/browser/real-components.tsx cameraMode. Line offsets may shift after imports. Comparison uses the existing compiler config with generated output excluded in memory, not a tsconfig edit; raw archive/template-inclusive workspace typecheck is not claimed clean.

Sites guidance preserved the existing project/preview. React checklist influenced using existing Popover, stable module-level metadata, no new event listeners or effect-based data synchronization, and presentation-only derived values rather than saved fields. No backend, combat/stat/CP formula, job activation, progression level, save schema, registry deletion, skill content or balance change. No publish performed. Stop at this phase; public migration and specialization work require a separate task.
