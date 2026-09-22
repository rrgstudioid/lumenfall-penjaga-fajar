# LUMENFALL — Global Hard Targeting: Technical Report

> Historical initial-rollout report. The six deferred semantics have now been finalized; superseded by [the final report](LUMENFALL_Global_Hard_Targeting_Final_Report.md).

2026-09-20. LOCAL ONLY. No deployment. Owner deferred six conflicting legacy skills; this is a partial rollout, not a claim of universal no-nearest behavior.

## Policy and boundaries

Old usesHardTargeting(hero): progressionArchitecture === 'v2_test'. New: true for playable player combat regardless of progressionArchitecture. There is no job/save migration. Normal characters remain legacy; V2 test authorization and production routes are unchanged.

Basic attack, selection and target presentation now use the existing hard-target path for every player. No new input listeners or target manager. No new Warrior skills, resources, balance numbers, progression, camera lock, click-to-move or TAB cycling.

## Audit and implementation files

Audited: lib/game/targeting.ts, world.ts, target-presentation.ts, skills.ts, warrior-v2.ts, skill-action.ts, combat-power.ts, rules.ts, progression.ts; app/page.tsx; existing Phase 2D/3A/3B tests and browser memory harness.

Production files changed:
- lib/game/targeting.ts — architecture-independent player policy, central semantic target resolver, explicit six-skill owner-deferred compatibility list.
- lib/game/world.ts — use semantic target groups for execution; selected-target validation for all unambiguous skills; preserve deferred skills' existing execution.
- lib/game/combat-power.ts — reuse self-recipient classification so CP does not count enemy hits that a self-only cast no longer performs. No weights, formulas or combat values retuned.

Test files changed/added:
- lib/game/skill-runtime-v2.test.ts — retain all prior tests; explicitly select/register fixture entities now required by global targeting; 34 additional regression tests.
- tests/browser/hard-target.ts — visual picking fixture defaults to legacy; optional architecture=v2_test retains the V2 variant.
- tests/browser/warrior-world-fixture.ts — memory-only legacy Warrior fixture, separate from production creation/save flow.
- tests/browser/global-targeting-regression.mjs — reproducible headed Chrome real-map test.

Reports: docs/LUMENFALL_Global_Hard_Targeting_Owner_Report.md and this file. Existing unrelated working-tree files were preserved.

## Complete active-skill audit

80 registered active skills: 64 legacy + 16 Warrior V2. No line-target skill is currently registered.

A = CURRENT_TARGET_REQUIRED; B = SELF; C = AREA_AROUND_SELF; D = FRONTAL_ARC; E = TARGETED_DASH; F = UNKNOWN/AMBIGUOUS design, owner deferred.

| Family | A | B | C | D | E | F |
|---|---:|---:|---:|---:|---:|---:|
| Legacy | 21 | 12 | 19 | 0 | 6 | 6 |
| Warrior V2 | 7 | 5 | 1 | 2 | 1 | 0 |

The legacy factory defaults targetType to single even for heal/buff/barrier/parry/stealth and aoe_damage/ultimate. The central resolver normalizes those known runtime roles without mass-editing definitions. Explicit rank_values skills keep declared targeting. Circle radius remains the resolved existing areaRadius || 5. An explicit self cast has no enemy recipient, even with a selected enemy; old incidental nearest-enemy damage from self support is no longer executed. Generic damage/heal coefficients and costs themselves are untouched.

| ID | Name | Family | Class | Registry targetType / effect |
|---|---|---|---|---|
| fajar-step | Langkah Fajar | Legacy | E | single / dash_damage |
| fajar-strike | Tebasan Fajar | Legacy | A | single / damage |
| guard-stance | Sikap Penjaga | Legacy | B | single / parry |
| nova-fajar | Nova Fajar | Legacy | C | single / ultimate |
| warrior-breaker | Hantaman Prajurit | Legacy | A | single / stun |
| warrior-charge | Charge Baja | Legacy | E | single / dash_damage |
| warrior-guard | Guard Tekad | Legacy | B | single / barrier |
| warrior-awakening | Kebangkitan Warrior | Legacy | C | single / ultimate |
| rogue-step | Langkah Bayang | Legacy | E | single / dash_damage |
| rogue-flurry | Belati Cepat | Legacy | A | single / rapid_damage |
| rogue-vanish | Vanish | Legacy | B | single / stealth |
| rogue-awakening | Kebangkitan Rogue | Legacy | F | single / ultimate |
| hunter-aim | Bidikan Pemburu | Legacy | A | single / mark |
| hunter-volley | Volley | Legacy | C | single / aoe_damage |
| hunter-bind | Panah Penahan | Legacy | A | single / slow |
| hunter-awakening | Kebangkitan Hunter | Legacy | C | single / ultimate |
| wizard-bolt | Arcane Bolt | Legacy | A | single / elemental |
| wizard-circle | Lingkar Cakrawala | Legacy | C | single / aoe_damage |
| wizard-chain | Rantai Unsur | Legacy | A | single / chain |
| wizard-awakening | Kebangkitan Wizard | Legacy | C | single / ultimate |
| acolyte-blessing | Berkah Awal | Legacy | B | single / buff |
| acolyte-heal | Sembuh Seketika | Legacy | B | single / heal |
| acolyte-barrier | Perisai Cahaya | Legacy | B | single / barrier |
| acolyte-awakening | Kebangkitan Acolyte | Legacy | C | single / ultimate |
| gatotkaca-1 | Lompatan Guntur | Legacy | E | single / dash_damage |
| gatotkaca-2 | Tinju Bumi | Legacy | C | single / aoe_damage |
| gatotkaca-3 | Hantaman Langit | Legacy | F | single / stun |
| gatotkaca-4 | Amukan Gatotkaca | Legacy | C | single / ultimate |
| garda-1 | Charge Perisai | Legacy | E | single / dash_damage |
| garda-2 | Tumbukan Gada | Legacy | A | single / debuff |
| garda-3 | Benteng Nusantara | Legacy | B | self / barrier |
| garda-4 | Sumpah Garda | Legacy | C | single / ultimate |
| caroq-1 | Langkah Caroq | Legacy | E | single / dash_damage |
| caroq-2 | Badai Belati | Legacy | A | single / rapid_damage |
| caroq-3 | Hilang Sekejap | Legacy | B | single / stealth |
| caroq-4 | Tarian Caroq | Legacy | F | single / ultimate |
| anom-1 | Tanda Senyap | Legacy | A | single / mark |
| anom-2 | Tebasan Anom | Legacy | A | single / damage |
| anom-3 | Bayang Tanpa Jejak | Legacy | B | single / stealth |
| anom-4 | Vonis Anom | Legacy | A | single / execute |
| srikandi-1 | Panah Bidik | Legacy | A | single / mark |
| srikandi-2 | Hujan Srikandi | Legacy | C | single / aoe_damage |
| srikandi-3 | Panah Penahan | Legacy | A | single / slow |
| srikandi-4 | Badai Anak Panah | Legacy | C | single / ultimate |
| jagawana-1 | Jerat Rimba | Legacy | A | single / root |
| jagawana-2 | Panah Racun | Legacy | A | single / poison |
| jagawana-3 | Jaring Hutan | Legacy | C | area / root |
| jagawana-4 | Kawasan Perburuan | Legacy | C | single / ultimate |
| resi-1 | Elemental Invocation | Legacy | A | single / elemental |
| resi-2 | Lingkar Cakrawala | Legacy | C | single / aoe_damage |
| resi-3 | Rantai Unsur | Legacy | A | single / chain |
| resi-4 | Murka Lima Unsur | Legacy | C | single / ultimate |
| pujangga-1 | Mantra Tanda | Legacy | A | single / mark |
| pujangga-2 | Kutuk Aksara | Legacy | A | single / debuff |
| pujangga-3 | Bayang Ilusi | Legacy | C | area / illusion |
| pujangga-4 | Kidung Kehancuran | Legacy | F | single / ultimate |
| pandita-1 | Berkah Pandita | Legacy | B | single / buff |
| pandita-2 | Sembuh Seketika | Legacy | B | self / heal |
| pandita-3 | Perisai Dharma | Legacy | B | single / barrier |
| pandita-4 | Doa Keselamatan | Legacy | F | single / ultimate |
| bajra-1 | Pukulan Bajra | Legacy | A | single / stun |
| bajra-2 | Ritus Cahaya | Legacy | C | single / aoe_damage |
| bajra-3 | Telapak Penolak | Legacy | F | single / parry |
| bajra-4 | Amarah Dharma | Legacy | C | single / ultimate |
| v2-warrior-strike | Warrior Strike | V2 | A | single / damage |
| v2-warrior-iron-charge | Iron Charge | V2 | E | single / dash_damage |
| v2-warrior-sweeping-slash | Sweeping Slash | V2 | D | frontal_arc / damage |
| v2-warrior-guard-stance | Guard Stance | V2 | B | self / buff |
| v2-warrior-rising-slash | Rising Slash | V2 | A | single / damage |
| v2-warrior-armor-breaker | Armor Breaker | V2 | A | single / damage |
| v2-warrior-battle-cry | Battle Cry | V2 | B | self / buff |
| v2-warrior-counter-slash | Counter Slash | V2 | A | single / damage |
| v2-warrior-ground-breaker | Ground Breaker | V2 | C | area / damage |
| v2-warrior-battle-focus | Battle Focus | V2 | B | self / buff |
| v2-warrior-severing-arc | Severing Arc | V2 | D | frontal_arc / damage |
| v2-warrior-relentless-assault | Relentless Assault | V2 | A | single / rapid_damage |
| v2-warrior-unbroken-stance | Unbroken Stance | V2 | B | self / buff |
| v2-warrior-iron-reversal | Iron Reversal | V2 | A | single / damage |
| v2-warrior-crushing-finale | Crushing Finale | V2 | A | single / damage |
| v2-warrior-awakening | Warrior Awakening | V2 | B | self / buff |

### Six owner-deferred conflicts — NOT redesigned

| ID/name | Existing runtime retained | Unresolved design interpretation |
|---|---|---|
| gatotkaca-3 / Hantaman Langit | Nearest single enemy receives damage/control; areaRadius 5.5 is not used to select multiple victims | Single impact vs shockwave area described in text |
| rogue-awakening / Kebangkitan Rogue | Around-caster ultimate damage + existing temporary states | Single rapid combo vs area ultimate |
| caroq-4 / Tarian Caroq | Around-caster ultimate damage + existing temporary states | Single dual-dagger sequence vs area ultimate |
| pujangga-4 / Kidung Kehancuran | Around-caster ultimate damage + existing temporary states | Curse payoff on one victim vs area |
| pandita-4 / Doa Keselamatan | Around-caster offensive ultimate, not an implemented area-heal branch | Described AoE healing/protection vs damaging implementation |
| bajra-3 / Telapak Penolak | Self parry plus incidental damage/displacement/control to nearest enemy | Pure defensive self cast vs targeted counter/heal combination |

The user explicitly chose to defer these six. Their registered data, cost, shape, and old nearest-enemy component remain unchanged. Compatibility is keyed to this explicit list, NOT legacy architecture generally. A failure to validate any other skill never falls back into this path. This exception must be removed or resolved after the owner's design decision. Do not advertise this build as a completed 100% global no-nearest rollout.

Additional existing limitations, not new targeting conflicts: wizard-chain/resi-3 remain a single damage action (no real bounce); jagawana-1 remains a targeted root (no trap-placement engine); gatotkaca-1 remains targeted dash without newly invented splash. No mechanics were fabricated from descriptions.

## Input, attack and targeting execution

Canvas left-click first checks existing UI/defaultPrevented/NPC rules. First enemy click selects only; repeated click on the same selected enemy invokes existing attack; another enemy switches only; empty world clears. WASD and camera controls remain unchanged.

Basic attack: resolve current identity, check horizontal range, fail before attack timer/ammo on NO_TARGET/TARGET_INVALID/TARGET_OUT_OF_RANGE. In range, face the selected entity once and damage only it. Existing attack-speed/combo/crit/damage remain intact. No sweep victims, nearest search, or auto-walk on this global path. Generic old targetNearest is unreachable because the global policy always enables hard targeting.

Unambiguous single/dash/counter skill: resolve rank/action, validate selected identity and resolved range BEFORE consuming Mana, cooldown or counter opportunity. Snapshot targetIdentity onto the resolved action. A nearer enemy is irrelevant. Deferred compatibility is selected before validation, never as a fallback from a failed cast.

Self/circle/arc: target-free. Arc may face a valid current target once at cast start. Self-only skills perform no enemy hit and do not face/retarget automatically. Circle victims remain centered on the actor. No line/projectile/pathfinding engine added.

## Identity, lifecycle, multi-hit and presentation

Existing TargetIdentity = id + instanceId + generation + regionToken. Existing indexed lookup validates HP, group visibility, scene parent, generation and region. No world scan just to maintain selection; picking scans bounds only on a click.

Existing clearing on death, despawn, replacement, region, player death, menu, character/world disposal is retained. No replacement is selected. The presentation creates/reuses one ring and frame and disposes them through the existing world teardown. HP/name/level update from the selected entity; UI elements never route clicks to the canvas handler.

Scheduled hits use cast target identity, not live currentTarget. Switching to B does not redirect A's remaining hits; invalid/dead A cancels those hits. Incoming block/parry does not select the attacker. Existing counter snapshot/consume and action-lock timings are unchanged.

## Saves and authorization

currentTarget remains a Game runtime field only. No Hero schema/parser/writer/job registry/progression changes. Test serializing the hero before and after selection gives identical JSON. Existing parseSave still accepts legacy data. DEV fixture writes only in-memory localStorage/sessionStorage installed before importing Home. Browser native storage remained empty. No public save was opened, migrated, wiped or replaced. Warrior V2 is NOT activated publicly.

## Validation

Before: 422 passed, 0 failed. After: **456 passed, 0 failed**. None of the existing 422 tests was deleted. Fixture changes explicitly select damage recipients and register cloned enemies in the scene/entity index; all damage, multi-hit, mitigation, stagger and counter assertions remain. The old CP self test now expects no phantom legacy self hits; its architecture-cache and V2 rate-ceiling assertions remain.

34 new tests cover:
- Global policy for absent/legacy/v2_test architecture, actual canvas first/second/switch/empty click and UI exclusion.
- Public basic attack: no target, selected A vs nearer B, out-of-range no fallback/movement/timer, invalid/dead clear.
- 13 registered legacy offensive skills: Adventurer, Warrior, Rogue, Hunter, Wizard, Garda, Anom, Jagawana, Pujangga and Bajra. No-target/range failure preserves Mana/CD; success hits A only. Bajra test uses its actual required weapon.
- 9 registered self/AoE legacy skills target-free; CP self actions have no enemy hits.
- All 80 registry entries audited and six deferred entries enumerated.
- Six tests preserving each owner-deferred old shape.
- Legacy save identity/ranks/job untouched, despawn and region invalidation.
- Legacy frontal fixture and multi-hit A-to-B snapshot/death cancellation.

Existing Phase 2D/3A/3B regressions remain green, including selected Warrior actions, counter consumption, Charge collision and target UI cleanup.

### Real browser/world

Reused localhost3003 DEV memory harness, real Home -> Continue -> Padang Arunika (verdant-plains), installed Chrome headed via existing Playwright runtime. agent-browser CLI was unavailable; no package was installed. Real Three.js renderer, canvas handler, entity picking, target ring/frame, basic attack and legacy skill execution were used. For repeatability, the animation loop was frozen and two real enemies repositioned with test-only HP10000; this is a targeting test, not a natural combat/balance trial.

Observed: first click A=10000 HP; second click A=9795.28, B=10000; switch B leaves HP unchanged; empty click clears; no-target basic returns NO_TARGET; Warrior Hantaman Prajurit hits A only; out-of-range basic/skill fail with MP80 unchanged and B untouched; target death hides the frame. Exactly one selected ring. Frame click leaves target unchanged. Browser pageerrors: none. Native save origins: empty. Browser closed after capture.

Evidence: output/global-targeting/browser-evidence.json, legacy-selected.png, legacy-attacked.png, legacy-world.png. Script: tests/browser/global-targeting-regression.mjs. Local entry: http://127.0.0.1:3003/warrior-world.html?architecture=legacy . Normal site routes never import this harness.

### Build and TypeScript

Production build succeeded (vinext build). Existing warnings: client chunk >500kB, plugin timing, route classification unknown. Official build helper could not start the existing Windows package-manager shim; invoked the same installed vinext build entrypoint directly. No dependency/config/package-manager changes.

Comparable primary-source TypeScript baseline: **6 before -> 6 after, 0 new**. Four appearance fallback errors in rules.ts, ui-layout.ts scale, browser real-components.tsx cameraMode. The raw repository-wide tsc scan also includes output/publish-20260920-source and downloaded plugin templates; it currently reports72 errors including duplicates/tool templates. The six-to-six comparison uses the same compiler API/config with only output excluded in memory on BOTH runs, not a tsconfig edit or weakened application checking. Raw tsc is not claimed clean.

## Publish readiness / remaining blocker

The implemented portion builds and passes tests; basic attack and the 74 unambiguous active definitions use the intended global semantics. Six owner-deferred definitions remain compatibility exceptions. Their target semantics must be decided before claiming final universal hard targeting. No publish performed. No skill/balance/progression work was continued.
