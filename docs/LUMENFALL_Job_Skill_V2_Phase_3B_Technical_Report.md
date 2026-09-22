# LUMENFALL — Phase 3B technical report

2026-09-20. Scope: development world harness, rendered-browser playtest, two observed bug fixes. **No numerical balance edits. No publish.**

## 1. Entrypoint and safety boundary

Separate Vite test server: `tests/browser/warrior-world.config.ts`, bound to127.0.0.1:3003. Entrypoint: `/warrior-world.html?level=59&build=general`. It imports the existing `app/page.tsx` and real `Game`, not a replacement combat scene.

`warrior-world.tsx` rejects non-localhost and non-development execution. Before any game/UI module is dynamically imported, it installs in-memory implementations of localStorage and sessionStorage on this document. Native storage is never read, enumerated, cleared, or written. The real save/parse/autosave path operates against these memory stores. A dedicated browser context reported `cookies:[]`, `origins:[]` after play. Reload discards the fixture.

This is not a production query switch, player character-creation option, migration, or live job authorization. Normal app routes never import the harness. No production save slots were converted. `createV2TestHero` and existing `authorizeV2Warrior` authorize only the isolated memory hero.

Observation wrappers capture real cast/action/hit/incoming/dispose results without replacing calculations. `window.__warriorQA` exposes the live game and bounded event history (maximum4000 entries). Diagnostics polling is optional,300ms, and its interval is cleaned up. Refill/relocation/endurance buttons explicitly mark fixture actions. Endurance clones an entity's definition; it does not mutate shared monster definitions.

## 2. Configuration and loadouts

Parameters: `level=15|30|45|59`, `build=general|counter|great|dual|blank|all`, optional total `sp=0..200`, unallocated `stats=0..500`. Normal defaults are level−1 SP and3×(level−1) unallocated stat points. The preset purchases ranks through existing learn functions and recursive prerequisites; it does not bypass ownership or the 25-paid-rank gate.

| Preset | Actual equipment | Content |
|---|---|---|
| general | Training Sword (`field-verdant-plains-sword`) | Strike, Charge, Sweep, Armor, Cry, Ground, Finale; Conditioning/Momentum |
| counter | Training Sword + existing Ironveil shield | Guard, Counter Slash, Iron Reversal, Unbroken, Strike; guard/counter/durability passives |
| great | `jayantara-two-hand-sword` atLv24+, otherwise Training fallback | Rising, Ground, Severing, Finale; Heavy Impact/Great Familiarity/Great Momentum |
| dual | Two separate Training Sword items in main/offhand | Focus, Relentless, Strike/Charge; Instinct/Twin Familiarity/Rhythm/Momentum |
| blank | Training Sword | Root grant, manually spend via K |
| all | Training Sword | All eligible nodes; explicit SP200 used only for diagnostic rank/animation coverage |

Level gates still apply: lower-level presets intentionally cannot own every named high-level skill. The general preset is not silently granted Battle Focus; for the90MP experiment its actual prerequisites/rank were purchased with available SP.

Observed legal checkpoints:

| Level/build | Budget | Paid Warrior ranks | Remaining SP | Baseline MP |
|---|---:|---:|---:|---:|
| 15 general | 14 | 3 | 11 | 100 |
| 30 general | 29 | 10 | 19 | 100 |
| 45 dual | 44 | 19 | 25 | 100 |
| 59 great | 58 | 29 | 29 | 100 |
| 59 general | 58 | 23 | 35 | 100 |

`all&sp=200` purchased135 paid ranks plus the granted Warrior root, with65 points remaining. It is explicitly not representative of legal tree economy.

## 3. Audit surface and files changed

Audited runtime paths: `world.ts` pointer selection/attack/cast/apply/queue/incoming damage/movement/region/death/menu/disposal; `targeting.ts`, `target-presentation.ts`; `skill-action.ts`; `combat-status.ts`, `stagger.ts`, `combat-transient.ts`, `combat-modifiers.ts`; `warrior-v2.ts`, `skills.ts`, `rules.ts`, `rank-ownership.ts`, `hotbar.ts`, `items.ts`; `tree-collision.ts`, field-terrain integration; `app/page.tsx`, `components/game/job-skill.tsx`, draggable-window and drag/drop styles; existing Phase3A and runtime tests/reports.

Changes for this task (the checkout already contains unrelated earlier-phase work):

| File | Change |
|---|---|
| `tests/browser/warrior-world.config.ts` | New separate development server, real assets, isolated optimizer cache |
| `tests/browser/warrior-world.html` | New test entry document |
| `tests/browser/warrior-world-fixture.ts` | Memory Warrior presets and legal purchase paths |
| `tests/browser/warrior-world.tsx` | Actual Home/world entry, storage isolation, observational telemetry, DEV controls |
| `tests/browser/warrior-world-drag-regression.mjs` | Reproducible browser regression for observed drag bug |
| `lib/game/ui-layout.ts` | Read-only `WindowFocusManager.topZIndex` |
| `components/game/draggable-window.tsx` | Publish actual foreground layer as CSS variable |
| `app/drag-drop.css` | Raise binding destination/ghost relative to actual window stack |
| `lib/game/ui-layout.test.ts` | One regression for actual binding-layer defect |
| `lib/game/world.ts` | Charge final-gap obstruction check only for actions with explicit `dash` metadata |
| `lib/game/skill-runtime-v2.test.ts` | One runtime regression for close blocked Charge |
| `docs/LUMENFALL_Job_Skill_V2_Phase_3B_Owner_Report.md` | Owner report |
| `docs/LUMENFALL_Job_Skill_V2_Phase_3B_Technical_Report.md` | This report |

Generated evidence: `output/warrior-phase3b/` contains screenshot captures and `playtest-evidence.json`. No skill registry/rank rows, item values, monster definitions, EXP tables, or combat stat formulas were edited in Phase3B.

## 4. Browser/world environment and method

Windows, installed Google Chrome151.0.7922.108,1440×1000 viewport, Playwright. WebGL rendered actual Three.js world. Broad trials used rendered headless Chrome with screenshots; final selection/basic/WASD/K drag and collision retests also ran in **visible headed Chrome**. This is not a claim based solely on isolated/headless domain tests.

Main map: `verdant-plains` / Padang Arunika,42 existing enemies. City Arunika transition exercised cleanup. All four presets were entered through actual Continue→world startup. Real camera/collision/model/assets/hotbar/labels/K were used. Native browser contexts were isolated and test browsers closed afterward; the localhost development server remains available for the owner.

Natural trials used unmodified enemies. Controlled trials reused real enemy entities with cloned HP30000 definitions, controlled initial positions, and temporarily delayed incoming attacks where needed. Diagnostic cases are named in evidence. Incoming stagger used the actual `hurtHero` route with an explicit fixture stagger amount. RNG was fixed only in a diagnostic comparison of Awakening scope, not production code.

These tests do not establish hardware FPS, audio quality, gamepad/mobile behavior, all-map collision correctness, human reaction statistics, or sustained combat balance against level-matched enemies.

## 5. Targeting, lifecycle, lock and input results

- First actual mouse click: selected Small Slime, HP46 unchanged, zero hit events. Same target second click: basic attack killed it and target/frame cleared.
- Switching A→B: no hit. Empty world: clear. Click on target frame: no click-through attack/selection.
- Selected distant A with closer B: `TARGET_OUT_OF_RANGE`; MP unchanged; no fallback hit. Self Cry, circle Ground, frontal Sweep worked without target.
- Changing selection toB between Relentless hits did not redirect hit2/3: all three real events retainedA.
- Death, spawn-generation change, scene removal, region change, player death, menu and disposal cleared selection without replacement. Disposal left zero `.current-target-frame` nodes; region change left zero attached `current-target-ring` objects.
- Initial diagnostic changed only `respawnDeadline`, which is not the authoritative targeting generation. That trial did not invalidate the current target; corrected generation/removal tests did. This is not misreported as a target bug.
- WASD movement worked at zero Stamina. Finale movement stayed at(7,7.5) during its early lock, then moved after expiry. Focus allowed movement during its lock.
- Early second-skill attempts returned `ACTION_LOCKED` rather than silently spending MP. No buffer/animation cancel/GCD was added. Existing basic attack cooldown logic retained.

Picking remains the existing raycaster/pick-proxy path. No duplicate input listeners or camera lock were introduced. Presentation gaps: small enemy occlusion by the player, label overlap, and target-frame overlap with the camera hint.

## 6. Observed bugs and fixes

### BUG-3B-01 — K dialog covers hotbar drop target

Real dialog layer was1004 in the failing case; hotbar binding still used61 and drag preview1000. `elementFromPoint` at the destination returned the dialog. This was not an ownership/SP or pointer-distance problem.

The existing focus manager now exposes its top layer. Draggable windows update `--lumenfall-window-top-z`; the existing hotbar binding destination uses top+2, preview top+4. Existing alertdialog blocking is preserved. No layout redesign or skill-data change.

Browser retest: active skill assigned correctly, passive refused. Reproducible script asserts actual pointer hit destination, updated hero binding, no runtime errors and no native storage writes. React/browser skill review guided the narrow UI fix and verification; no new UI framework was introduced.

### BUG-3B-02 — short-range Charge damage crosses a trunk

Original movement correctly stopped before long-distance obstacles, but final impact eligibility checked distance only. A target2m away with a real trunk between actor and target took212.67 damage at the tested Rank2, despite the obstruction.

`Game.hasClearDashImpact` now checks range, then probes the remaining actor→target gap through the **existing ground and trunk movement resolver**, without mutating actor position. Small bounded steps reject blocked/sliding deviation. Only explicit `skill.dash` impact validity uses it; legacy generic dash and all other melee/basic formulas are untouched. No pathfinding, mesh raycast engine, new collision geometry, or global line-of-sight framework.

Payment stays at accepted cast time. After fix: same trunk2m caseHP30000 unchanged, MP100→92 and Rank2 cooldown6.8 still set once. Clear2m control hit normally. Longer trunk/rock cases also whiffed without teleport. Four unobstructed slopes atx24/26/30/35, z−42→−49 still hit; height differences about0.55–0.66m were handled by existing terrain movement. The earlier x18 slope crosses a second existing tree in its final gap and now correctly does not hit.

Regression exercises both trunk and ground blockers inside impact range, unchanged one-time cost/CD, no movement from the probe, and a subsequent clear cast. This changes erroneous hit eligibility, **not numerical balance**. Conservative ground-movement reachability is not full visual LOS; irregular mesh/bridge edges on other maps remain outside the sampled coverage.

## 7. Combat, Mana and Charge evidence

All16 registered active actions were cast in the real world, with corrected canonical IDs for inherited versus Warrior Guard Stance. Recorded Rank5/R3 locks: Strike.30, Charge.55, Sweep.45, Guard.25, Rising.50, Armor.55, Cry.30, Counter.35, Ground.65, Focus.25, Severing.60, Relentless.75, Unbroken.30, Reversal.50, Finale.85, Awakening.45 seconds. **These were observed, not edited.**

Charge cases covered open ground, clear slope, close1/2m,8.49m just inside Rank5 range8.5, out-of-range9.9m, trunk crossing, rock crossing and target behind a close trunk. Open8m case moved5.5m, then its existing.3 knockback made final separation2.8m. Do not confuse post-hit knockback with overshoot. Out-of-range spent nothing; accepted blocked casts spent8MP and their rank cooldown. No auto-target switch/pathfinding.

Low-INT Mana: derived baseline100MP,8MP/sec regeneration. Actual Cry→Armor→Rising→Ground→Finale paid76MP; first-to-last cast2.3395sim seconds; last payment left42.716MP. Focus adds14 for90MP total,2.6165seconds first-to-last; last payment left30.932MP. Four separate Lv15 Arunika engagements consumed6MP Strike each, with Mana restored by the next engagement and no refill. These weak enemies cannot justify high-level balance conclusions.

## 8. Counter, stagger, target-condition and passive evidence

Both counter policies still use2500ms simulation-time. Manual F produced a real blocked event; Reversal cast normal and left that event available, then Slash consumed it once. Pausing for wall time did not advance the event clock. Natural close-contact Sikap Penjaga produced parry at2.4865sim seconds and Slash at3.0031; snapshot accepted. Controlled-contact Reversal committed at13.3058 against event11.1226, age2.1832seconds, accepted/consumed. Its later screenshot time must not be mistaken for cast time.

Unforced outer-contact parry trials sometimes missed because inherited Sikap's knockback/stun changed enemy contact timing; a closer initial contact succeeded without forcing windup. No legacy parry numbers changed. Readability remains insufficient to declare the counter window too short or too long.

Endurance-target stagger preserved actual target resistance/threshold. In the all-ranks diagnostic, Armor16 + Rising30 + Ground34 + Severing22 (plus actual eligible passives/resistance) left99.913/100 gauge. Finale then broke the target but received only the pre-existing Armor payoff: about1349.05HP damage. Repeating with an extra Strike that broke first, Finale at0.3834seconds after break dealt about1461.64 with both payoff conditions. Both trials used the same current stack context; no self-break bonus was invented. CC.35seconds and recent-break1.5seconds remained distinct.

Relentless atLv45 dual: three events around0/.19/.42seconds (frame quantization), approximately155/170/269damage; final hit strongest. One cast produced one Battle Momentum and one Twin Rhythm stack, not three. Basic added none. Target switch retained stacks; inactivity6.2seconds removed both. Ground hitting two different entities also produced one Momentum stack. Great Ground opened the5second window; subsequent Severing consumed it without immediate rearming.

Controlled incoming `hurtHero(..., staggerDamage=200)` broke the real player gauge and applied distinct `staggered` plus Indomitable's3second modifier at the tested rank. Ordinary monster calls currently omit incoming stagger; therefore normal fights do not establish anti-chain balance or Unbroken/Indomitable utility. No monster threshold/attack was changed to disguise this limitation.

Awakening R1/R2/R3: cost32 each, subsequent Relentless cost18/18/17 after existing rounding. Hit damage factors1.06/1.08/1.10 and stagger factors1.10/1.15/1.20 came from existing data. Fixed-RNG per-hit basic damage393.196 and Adventurer423.059 were unchanged with/without Awakening; Adventurer cost15 unchanged. Existing actual-Game regression protects queued-hit snapshots. Current Relentless finishes before its action lock permits Awakening, so no legitimate live input can insert it halfway through this particular sequence.

## 9. K panel and ownership

Real panel showed30 nodes, real levels/ranks/requirements. DefaultLv59 general had23 paid ranks and35SP; root2→4 spent2SP, reached25paid and unlocked Awakening. Free grant excluded. Purchase, active drag and passive rejection were exercised. J opened Quest Journal.

Runtime reset with exactly500 fixtureGold returned23SP (35→58), preserved Strike's granted Rank1, charged500Gold, cleared transient effects, and did not make unlearned skills usable. K currently has no reset button; reset/refund verification used the existing Game method, not an invented UI control. Legacy header copy and “Locked · Lv” shorthand can obscure unmet prerequisites despite detailed requirements being correct.

## 10. Per-active animation/VFX review

Categories: A=acceptable prototype presentation; B=understandable placeholder; C=misleading/needs replacement before wider test. These are visual diagnoses, not permission to change combat numbers.

| Active | Category | Actual presentation and issue |
|---|---|---|
| Warrior Strike | A | Basic attack motion; simple single strike is understandable |
| Iron Charge | B | Existing dash animation with immediate stepped movement; no bespoke travel timing |
| Sweeping Slash | C | Basic swing + generic circle/ring;120° arc not communicated |
| Guard Stance | B | Magic-cast-style activation, no persistent guard pose/timer |
| Rising Slash | C | Ordinary swing, no clearly rising/high-stagger impact |
| Armor Breaker | B | Ordinary hit; debuff identity/duration not visible |
| Battle Cry | B | Generic buff cast/particles, no distinct cry feedback |
| Counter Slash | C | Normal swing; empowered block/parry variant visually unclear |
| Ground Breaker | C | Generic basic motion/ring; lacks ground-slam impact |
| Battle Focus | B | Generic buff cast; visually overlaps Cry |
| Severing Arc | C | Basic swing/ring; narrower70° geometry not communicated |
| Relentless Assault | C | Three real events but one generic attack cue, insufficient three-hit choreography |
| Unbroken Stance | B | Generic buff cast; anti-disruption state not readable |
| Iron Reversal | C | Ordinary swing; little visible distinction from normal Counter Slash |
| Crushing Finale | C | Generic swing shorter than perceived heavy lock; payoff conditions invisible |
| Warrior Awakening | C | Brief generic buff effect, not a readable empowered state |

World routing uses `dash` for dash_damage, `magic_cast` for buffs/parry and `basic_attack` for these physical skills. Warrior definitions reuse `visualEffect: damage`, including pale-green generic effects. No16-animation asset set was created. Existing icons alone do not explain actual arc/hit timing or buff uptime.

## 11. Remaining issue classification

| Category | Finding | Treatment |
|---|---|---|
| BUG | K destination blocked by dialog | Fixed and browser-regressed |
| BUG | Charge short impact crosses trunk | Fixed; actual terrain retested |
| PRESENTATION / UX | No persistent stack/counter/Armor/Break/buff indicators | Report only; no new gameplay HUD |
| PRESENTATION / UX | Target frame overlaps camera hint; small target occlusion | Report only |
| PRESENTATION / UX | K says four skills/J to close; HP maximum exposes floating decimals; legacy specialization-ready hint on dev V2 | Report only |
| MISSING ASSET / ANIMATION | Generic motion obscures heavy/multi-hit/counter/arc identity | Report only |
| BALANCE QUESTION | 8MP/sec recovery and pre-buff economy against level-matched enemies | No number changes; requires representative combat |
| BALANCE QUESTION | Counter2.5s/Finale1.5s reaction comfort, buff overlap, heavy-window maintenance | Human/readability test needed before tuning |
| EXPECTED LIMITATION | Ordinary AI has no incoming stagger; K lacks a reset control; no full dual-basic engine | Existing capabilities retained |
| EXPECTED LIMITATION | Only Arunika terrain samples; no all-map LOS/pathfinding/FPS benchmark | Not claimed complete |

No confirmed crash/invalid character remained in final world sessions. Conditional CP uptime limitations from Phase3A were not hidden or compensated; CP code was not changed.

## 12. Tests, build, TypeScript and console

| Check | Before Phase3B | Final |
|---|---|---|
| `lib/game/*.test.ts` | 420passed,0failed (rerun) | **422passed,0failed**, no skip/cancel |
| New tests | — | 2, only for observed bugs: focus layer and Charge obstruction |
| Browser regression | Failed real K pointer drop before fix | Pass: actual Home/K→slot, native storage empty, no page errors |
| TypeScript | 6 existing errors (rerun) | **6 same errors,0new**; command still exits1 |
| Production build | Prior Phase3A successful build recorded; not a fresh pristine-checkout build | Successful final build after both fixes |

Old TypeScript errors: `rules.ts:358–361` four appearance string/union fallbacks; `ui-layout.ts:64` inferred position lacks scale; `tests/browser/real-components.tsx:177` snapshot lacks cameraMode. They were not attributed to Phase3B or suppressed. Production build is not proof of a passing full TypeScript check.

Scoped lint on new harness/browser-script/draggable-window/test files passed. Including all of ui-layout reports its existing scale error and pre-existing unnecessary spread fallback at122; those were left outside scope. Prototype observer captures have narrow documented unbound-method exemptions because each actual call uses the live `this` explicitly.

Build warnings: client chunk over500kB, plugin timing notice, vinext static route classification unknown. No deploy was performed. One earlier development-browser console entry reported an unspecified404; it was not captured as a failing game-asset response, and was not reproduced on the final clean load. Final clean-load console capture empty, game-asset error responses empty, headed-world page errors empty. Early harness setup failures (duplicate React optimization cache, wrong diagnostic skill/item ID, stale browser-helper handle) were corrected/retried and are not claimed as gameplay defects or successful trials. Invalid diagnostic attempts remain labelled in evidence.

## 13. Reproduction

Using Node22.13+ (tested24.19.0):

```text
node node_modules/vite/bin/vite.js --config tests/browser/warrior-world.config.ts
# http://127.0.0.1:3003/warrior-world.html?level=59&build=general
# http://127.0.0.1:3003/warrior-world.html?level=59&build=counter
# http://127.0.0.1:3003/warrior-world.html?level=59&build=great
# http://127.0.0.1:3003/warrior-world.html?level=45&build=dual
node --experimental-strip-types --test lib/game/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vinext/dist/cli.js build
node tests/browser/warrior-world-drag-regression.mjs
```

Browser script uses installed Chrome and an available Playwright package. If not a project dependency, set `PLAYWRIGHT_MODULE` to its installed absolute module directory; optional `CHROME_PATH` selects installed Chrome. `WARRIOR_TEST_URL` may change only to another localhost test origin. No dependency installation is required in this project.

Useful evidence: `13-headed-world.png`, `14-headed-k-hotbar.png`, `04-drag-blocked.png`, `05-drag-fixed.png`, `drag-regression.png`, per-skill screenshots, and `playtest-evidence.json`. The JSON distinguishes natural, diagnostic, failed harness attempt, before-fix and after-fix observations. Do not treat its records as422 independent automated tests.

## 14. Final boundary and next decision

**Zero numerical balance deviations:** damage/coefficients, MP, cooldown/duration, locks, stagger values, counter2500ms, recent-break1.5sec, passive percentages, prerequisites, SP/EXP, item/monster stats all retained. Charge hit eligibility and UI layering were the only production behavior fixes. No Stamina was introduced; no production save migration.

Ready for owner/developer Warrior testing with this isolated entry. Before wider tests: make opportunities/statuses visible and supply critical animation cues, then test against representative level-matched enemies with humans. Berserker/Blade Master/Rage/Flow and further balance work were not started. **STOP after Phase3B.**
