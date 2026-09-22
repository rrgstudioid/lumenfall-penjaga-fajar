# REPORT B — Warrior V2 Phase 3A Technical Report

20 September 2026. Source of truth: attachment `d238a77e-a9fc-4b78-a0a1-39ecce103695/Pasted text.txt` plus final owner Counter Window decision (2.500 ms for both counters).

## 1. Files changed in this phase

Worktree already contained changes from earlier phases. The following list describes this phase, not all dirty files in the project.

| File | Phase 3A change |
|---|---|
| `lib/game/warrior-v2.ts` — new | Exact 16/14 content data, rank tables, modifiers, prerequisites, counter policy, branches |
| `lib/game/skills.ts` | Append registry content; architecture gate; optional rank effects/passive rank support/dash metadata |
| `lib/game/rules.ts` | Controlled Warrior authorization/root grant, architecture-aware availability, rank passive resolution, guard context, safe missing-rank load default |
| `lib/game/skill-action.ts` | Resolve rank effect payload before hits; accepted counter snapshot/stagger; no registry mutation |
| `lib/game/combat-modifiers.ts` | Independent SR stat modifiers, guard condition/context, named additive payoff group |
| `lib/game/combat-transient.ts` | Tree-filtered successful-cast triggers and opt-in open-on-success heavy window |
| `lib/game/world.ts` | Wire successful-cast windows, collision-aware charge metadata, impact range recheck, manual guard context |
| `lib/game/combat-power.ts` | Rank-resolved limited-effect diagnostics, guard-sensitive cache; weights unchanged |
| `lib/game/hotbar.ts` | Architecture-aware skill eligibility and chooser; stable IDs retained |
| `lib/game/character-view.ts` | Gate K nodes; minimal V2 development progression view |
| `lib/game/skill-visuals.ts` | 30 distinct icon combinations using existing glyph vocabulary |
| `components/game/job-skill.tsx` | V2 prerequisites/investment, resolved duration/range/stagger, no misleading slot1 label |
| `lib/game/warrior-v2.test.ts` — new | 31 content/rank/domain tests |
| `lib/game/skill-runtime-v2.test.ts` | 11 production-Game runtime tests; legacy formula loop scoped to legacy |
| `lib/game/phase-1b.test.ts`, `combat-power.test.ts`, `mana-potions.test.ts` | Keep 64-skill legacy coverage explicitly scoped to legacy instead of treating newly registered V2 data as legacy |
| `lib/game/drag-drop.test.ts` | Expand actual-job/architecture assignment test to all 80 actives; preserve passive rejection/icon uniqueness |
| `lib/game/phase-2b.test.ts` | Extend transient-save regression to manual guard context |
| `tests/browser/warrior-v2.html`, `warrior-v2.tsx` — new | Isolated real-K-component harness, no player localStorage access or application route |
| Two Phase 3A report files in `docs/` | Owner + technical results |

## 2. Registered IDs, rank caps, levels

All carry `tree: {id:'warrior', architecture:'v2'}`. Legacy definitions retained.

| Type | ID | Display name | Level | Max rank |
|---|---|---|---:|---:|
| Active | v2-warrior-strike | Warrior Strike | 15 | 5 |
| Active | v2-warrior-iron-charge | Iron Charge | 17 | 5 |
| Active | v2-warrior-sweeping-slash | Sweeping Slash | 20 | 5 |
| Active | v2-warrior-guard-stance | Guard Stance | 20 | 5 |
| Active | v2-warrior-rising-slash | Rising Slash | 23 | 5 |
| Active | v2-warrior-armor-breaker | Armor Breaker | 26 | 5 |
| Active | v2-warrior-battle-cry | Battle Cry | 29 | 5 |
| Active | v2-warrior-counter-slash | Counter Slash | 32 | 5 |
| Active | v2-warrior-ground-breaker | Ground Breaker | 35 | 5 |
| Active | v2-warrior-battle-focus | Battle Focus | 38 | 5 |
| Active | v2-warrior-severing-arc | Severing Arc | 41 | 5 |
| Active | v2-warrior-relentless-assault | Relentless Assault | 44 | 5 |
| Active | v2-warrior-unbroken-stance | Unbroken Stance | 47 | 5 |
| Active | v2-warrior-iron-reversal | Iron Reversal | 50 | 3 |
| Active | v2-warrior-crushing-finale | Crushing Finale | 55 | 3 |
| Active | v2-warrior-awakening | Warrior Awakening | 59 | 3 |
| Passive | v2-warrior-conditioning | Warrior Conditioning | 15 | 5 |
| Passive | v2-warrior-weapon-discipline | Weapon Discipline | 18 | 5 |
| Passive | v2-warrior-firm-footing | Firm Footing | 21 | 5 |
| Passive | v2-warrior-guard-training | Guard Training | 24 | 5 |
| Passive | v2-warrior-combat-instinct | Combat Instinct | 27 | 5 |
| Passive | v2-warrior-heavy-impact | Heavy Impact | 30 | 5 |
| Passive | v2-warrior-battle-momentum | Battle Momentum | 34 | 5 |
| Passive | v2-warrior-counter-training | Counter Training | 38 | 5 |
| Passive | v2-warrior-adrenaline | Adrenaline | 43 | 3 |
| Passive | v2-warrior-indomitable-will | Indomitable Will | 48 | 3 |
| Passive | v2-warrior-great-weapon-familiarity | Great Weapon Familiarity | 25 | 5 |
| Passive | v2-warrior-great-weapon-momentum | Great Weapon Momentum | 40 | 3 |
| Passive | v2-warrior-twin-blade-familiarity | Twin Blade Familiarity | 25 | 5 |
| Passive | v2-warrior-twin-blade-rhythm | Twin Blade Rhythm | 40 | 3 |

## 3–5. Authorization, root grant, paid/granted ranks

`authorizeV2Warrior(hero)` accepts only `v2_test`, level >=15, no different core job, no specialization. Sets the existing core/job fields to Warrior and grants a floor of Rank1 Strike using `grantRank`. Repeated authorization is idempotent; no other node, equipment, SP or hotbar grant. New root ownership is explicitly known, not inferred as a legacy purchase. Existing paid ranks are not converted to grants.

Not wired into live character creation, trainer, job selection or NPCs. Legacy `chooseCoreJob`, `chooseSpecialization`, `chooseMastery` keep their existing V2 rejection. Canonical Job V2 metadata is not globally unlocked. Availability combines architecture + core job + unlock level + learned rank. V2 inherits Adventurer but not the legacy Warrior core tree; legacy cannot learn/use V2 nodes even if a rank ID is forged into data.

`learnSkill`/`learnPassive` retain one shared SP pool, 1 SP per purchased rank. +1 SP and +3 stat points/level unchanged. `paidTreeInvestment` excludes the free root and the node being unlocked. Awakening requires 25 paid Warrior ranks. Reset refunds purchases and preserves root grant. 74 active +62 passive ranks =136 total; 135 purchased after the one root grant.

## 6. Rank resolution and data validation

All actives opt into `rank_values`, never the legacy +12% rank multiplier. Existing `ResolvedSkillAction` remains the one action used by runtime, previews and CP.

Optional `rankEffects[rank-1]` carries the selected rank's complete effect payload: temporary buffs, statuses, structured hit sequence, action modifiers, counter-specific stagger. These fields override their base payload when provided. `rankMechanics` continues working afterward. Registry objects are cloned, not mutated. Passive `rankModifiers` and `rankCombatSupport` select learned rank, clamped to its max.

Table-driven tests independently enumerate every single-hit damage/stagger/MP/CD row, all multi-hit rows, all buff duration/MP/CD rows, counter payoff/stagger rows, passive stat/support values, geometry, unlock levels, rank caps, and action locks. They test actual resolved outputs rather than merely rereading the registry. Tests confirm generic Skill Power and INT do not accidentally scale these physical skills (both magic and Skill Power coefficients are zero).

## 7. Prerequisites

Existing AND prerequisite validator reused; active and passive ranks can both satisfy requirements. Each dependency is tested at its required rank and with that one rank missing.

- Charge ← Strike1; Sweep/Guard ← Strike2.
- Rising/Battle Cry ← Charge2; Armor Breaker ← Sweep2.
- Counter Slash ← Guard3; Ground Breaker ← Rising3; Focus ← Cry2; Severing ← Armor3.
- **Relentless ← Focus2 + Combat Instinct2** (Phase 3A contract, not earlier Draft2 Severing requirement).
- Unbroken ← Guard3 + Cry2; Reversal ← Counter3 + Guard Training3.
- Finale ← Armor4 + Ground3; Awakening ← 25 paid Warrior ranks.
- Guard Training ← Guard1; Counter Training ← Guard Training2.
- Great Momentum ← Great Familiarity3; Twin Rhythm ← Twin Familiarity3.

## 8–9. Weapons and targets

All actives accept actual `one_hand_sword`, `greatsword`, or `dual_sword` style via existing equipment resolver. No shield requirement or new equipment template. Great passives require greatsword; Twin passives require two distinct one-hand sword items. No off-hand damage/alternating basic engine added.

Current selected target required: Strike, Charge, Rising, Armor, Counter, Relentless, Reversal, Finale. Sweep/Severing use existing frontal arc and optional once-at-cast facing. Ground Breaker is caster-centered circle; all five buffs are self-only. No nearest fallback, auto walk, camera lock or new targeting engine.

## 10. Iron Charge

Reusable optional `dash:{stopDistance:2.5, impactRange:2.5}` on the definition/action. Validate selected target inside the rank's range first. Movement is `max(0,distance-stopDistance)`, capped by cast range, executed in <=0.25-unit collision substeps using existing `move()`/terrain/tree paths. Substep size is implementation resolution, not balance. Actor does not deliberately overshoot a close target. Recheck cast-target lifecycle and impact distance after movement; blocked Charge has no phantom damage while Mana/CD remain spent. No obstacle pathfinding. Legacy dash without this metadata keeps its previous behavior.

## 11. Armor Break

`armor_break` aliases existing `defenseDown`; existing mitigation uses Defense ×0.8. Applied after the skill's HP hit (then stagger, then statuses), so a fresh Armor Break does not improve its own initial HP damage. Rank durations 4/4.5/5/5.5/6 seconds. Existing status refresh/longer-duration retention used; no additive stacks or mitigation rebalance.

## 12. Counters — final owner decision

Both definitions resolve `counterPolicy.windowMs=2500`. Existing 5000ms safety maximum is untouched and not used as balance. Defense timestamps and checks use `combatTime *1000`, incremented only by active simulation, not wall clock.

- Slash accepted events: blocked/parried. Normal rank damage, rank-specific total-raw payoff and replacement stagger values.
- Reversal: parried only. Block casts normally and does not consume that unused Block opportunity.
- Order: authorization/cooldown → weapon → selected target/range → snapshot accepted defense event → resolve rank/passives/windows → validate/pay actual Mana → action lock/target snapshot → consume accepted event → set cooldown → execute.
- Invalid target/range/weapon/Mana and preview never consume. Accepted cast later invalid at impact still consumes. No second consume in Counter Training.
- Counter Training sees the same immutable accepted context; rejected Block cannot strengthen Reversal through the passive. Its damage/stagger bonuses are normal additive bonuses.
- Raw damage = base + final Physical Attack × coefficient. Payoff multiplies this **whole raw value**, not just coefficient. HP critical/mitigation follows the existing pipeline. Stagger remains separate.
- Parry is already reachable via inherited Adventurer `guard-stance` / Sikap Penjaga. Production methods test that real cast → incoming attack → parried opportunity → Reversal consume works. Warrior Guard Stance does not invent a new Parry.

## 13. Relentless Assault

Real hits at 0/.18/.42 simulation seconds. Per-rank per-hit base/coefficient/stagger, final hit strongest. Each hit crits independently and passes existing mitigation; crit does not amplify poise/knockback. Mana/CD charged once. Per-cast stats/action/target identity remain fixed; changing selected target or gaining buffs/stacks does not rewrite scheduled hits. Dead/invalid original target drops remaining hits, no redirect.

## 14. Buffs and stat passives

Guard Stance: ranked incoming reduction and Block Rate. Battle Cry: Physical Attack percent + Tenacity. Battle Focus: Accuracy + Crit only (no invented disruption/attack-speed bonus). Unbroken: separate incoming damage/stagger/knockback reductions, no immunity. Awakening detailed below. Temporary modifiers refresh same IDs, tick on simulation time, expire and clear with world/reset lifecycle.

Conditioning modifies MaxHP/Physical Defense; Weapon Discipline gates PA by actual style. Firm Footing uses a separate staggerResistance modifier, retaining existing cap50 and Tenacity-derived baseline without increasing Tenacity by mistake. Combat Instinct modifies Accuracy/Crit only. Guard Training works only during manual guard OR actual Guard Stance buff; no free Parry. `manualGuardActive` is transient context copied into stat/equipment previews; save serialization removes it and load ignores it. This avoids artificial CP/stat comparison losses from cloning a guarded hero.

Existing reduction-group safety retained: strongest applicable multiplier within the group wins against existing defense reduction; buffs are not multiplied toward immunity. No new generic passive bus.

## 15–17. Momentum and weapon paths

Successful-cast hook fires once at first positive HP damage, including killing hits, across all hits/targets. New `triggerTree` filters Warrior V2. Existing behavior for definitions without the optional filters remains.

- Battle Momentum: max3, 6s inactivity expiry, .50/.75/1/1.25/1.50% direct Warrior skill damage per stack. Basic/Adventurer/self/zero-hit casts do not build stacks. Target switch preserves them. New stacks affect subsequent resolved casts only.
- Heavy Impact: +3% stagger/rank on heavy Warrior skills; zero damage/knockback bonus.
- Great Familiarity: heavy damage +.8%/rank and stagger +2%/rank only on greatsword.
- Great Momentum: `openOnSuccess:true`; successful heavy Warrior hit opens 5s next-heavy window. Commit returns consumed-window IDs, so the successful hook of the consuming cast cannot re-arm itself. Preview and rejected casts do not consume. Bonus damage 3/4.5/6%, stagger 8/12/16%. Older commit-open window definitions preserved.
- Twin Familiarity: +1 Accuracy, +.5 Crit/rank only with dual sword. Twin Rhythm: max3, 5s, +1/1.5/2% multi-hit damage per stack. Trigger is one damaging Warrior cast, not each hit. Removing off-hand removes incompatible state and bonuses.

No visible resource bars, Rage/Flow, attack-speed bonus or automatic doubled basics.

## 18–19. Adrenaline / Indomitable

Adrenaline evaluates current HP <=35% of actual resolved MaxHP at incoming-hit evaluation; 5/7.5/10% reduction, no offense, no recursion. Indomitable activates from `applyStaggerDamage(...).broke` on the hero, not a description/status guess. Incoming stagger -35/50/65% for 2/2.5/3s. No HP reduction/knockback immunity. Tests inject stagger damage into actual incoming-hit method; live monsters were not rebalanced to trigger it.

## 20. Crushing Finale / modifier ordering

Existing normal V2 scoped damage/stagger buckets remain additive. Separate explicit payoff layer multiplies raw damage. New optional named `payoffGroup` adds percentages inside one local group before multiplication; other payoff groups retain product semantics.

Finale checks the actual cast target at impact via centralized status/recent-break helpers. Armor bonus10/15/20%; recent break5/7.5/10%, within <=1.5s simulation time, independent of CC duration. Both use the same group: R3 =1+(.20+.10)=1.30. Its own newly caused break cannot retroactively amplify the hit that caused it.

Example scoped stacking: Momentum4.5 + Great Familiarity4 + Awakening10 =18.5%, factor1.185; not sequential multiplication.

## 21. Awakening

Duration12/13/14; damage6/8/10% and stagger10/15/20% for future direct physical Warrior V2 skills. Rank3 adds -10% Mana cost to Warrior V2 actions; existing integer cost rounding retained (e.g.18→17). No basic/Adventurer bonus and no rewrite of queued actions. It is a self buff, not legacy ultimate/super-armor/area nuke. No unpriced permanent uptime credit in CP.

## 22. Action locks

| Active | Seconds | Manual movement |
|---|---:|---|
| Strike | .30 | blocked |
| Charge | .55 | blocked; skill-owned collision movement still runs |
| Sweep | .45 | blocked |
| Guard | .25 | allowed |
| Rising | .50 | blocked |
| Armor | .55 | blocked |
| Cry | .30 | allowed |
| Counter | .35 | blocked |
| Ground | .65 | blocked |
| Focus | .25 | allowed |
| Severing | .60 | blocked |
| Relentless | .75 | blocked |
| Unbroken | .30 | allowed |
| Reversal | .50 | blocked |
| Finale | .85 | blocked |
| Awakening | .45 | allowed |

Existing optional V2 ActionLock rejects active/basic starts during the lock. No GCD/channel/cancel framework, no change to legacy actions without locks.

## 23–24. Mana and damage sanity

Rank1 Cry14 + Armor12 + Rising11 + Ground15 + Finale24 =**76 MP**. Add Focus14 =**90 MP**. No cost adjustment for affordability.

At Physical Attack200, no modifiers/crit/defense: Strike228, Sweep228/target, Rising272, Armor284, Ground244/target, Severing338, Relentless400 total, Reversal normal232, Finale476. Tests use the actual resolver/hit damage functions. STR is not added a second time; INT/generic Skill Power do not raise these zero-coefficient actions.

## 25. Combat Power

Same rank-resolved action and structured hits feed existing CP evaluation. No weights or stat formulas rewritten. Explicit diagnostics now inspect resolved rank effects, not only base definitions. Counter opportunities, stack buildup, heavy windows, anti-chain/conditional defense, temporary buff uptime, stagger break and shared rotation occupancy remain limited/unscored where no reliable model exists. Current active final-stat/action buffs may affect a current-state snapshot; they are not assumed permanent from the skill description. Guard context included in cache key and copied previews; no fabricated equipment delta. Stamina remains inactive.

## 26. K panel and browser verification

Small extension only. Shows all30 nodes, rank/max, unlock level, real prerequisite ranks/paid-tree requirement, availability, learn buttons, MP/CD/range/duration/stagger and existing distinct icons. V2 labels do not present compatibility `slot:1` as skill identity. Primary hotbar validation/chooser now pass architecture; manual assignments use IDs and are not wiped/autofilled by authorization. Legacy K keeps its4 active +1 passive core view and legacy progression. J untouched.

Browser harness uses real React panel/styles/domain purchase functions and memory-only fixture; no backend/API or save write involved. Verified flow: UI purchase → production learn function/SP/rank validation → rendered updated rank/prerequisites. Root1→2:58→57 SP; Charge0→1:57→56; Sweep/Guard unlock at Strike2; Awakening remains disabled before25 paid SP; legacy comparison has no V2 nodes. Screenshot inspected; console error/warning capture empty. Temporary test tab/server closed afterward. Browser skills guided the visual/check flow; unavailable agent-browser CLI was replaced with the available browser tool.

## 27–30. Test/build/type results

**Before:**378 passed/0 failed; build success; six pre-existing TypeScript errors.

**After:**420 passed/0 failed; no skipped/cancelled tests. **42 new tests** (31 domain/content +11 actual-Game runtime). Legacy tests retained; legacy-only formula assertions now filter legacy instead of applying old formulas to new V2 content. Drag/drop coverage expanded to all80 actives, and existing icon uniqueness test covers the30 additions.

New tests cover all rank rows/caps/geometry/locks; 16 actual casts; authorization/root grant/purchase/reset/save; prerequisites with each missing dependency; 25-paid investment; 2500ms expiry/pause/consumption/whiff/preview; inherited Parry; accepted Counter Training context; per-hit critical/stagger/target snapshots; multi-target/killing/zero-hit/basic/Adventurer stack rules; heavy-window consume/no-rearm/expiry/style swap; blocked Charge; Armor-after-hit; Finale four contexts/1.5s; actual incoming guard/Adrenaline/Indomitable; buff refresh/expiry/Awakening; CP/preview/no-Stamina; normal additive1.185; Mana76/90 and raw-damage sanity.

Production build: `vinext build` successful. Existing warning: client chunks above500kB; route classification printed unknown/static-analysis limitation. Not a deploy. Lint on touched runtime/UI/test files reports only four existing appearance TypeScript errors in rules; newly introduced lint warnings/errors were corrected.

Full TypeScript: **6 before, 6 after, 0 new**:

- `rules.ts` four appearance fallback string/union mismatches.
- `ui-layout.ts` missing `scale` on inferred `{x,y}`.
- `tests/browser/real-components.tsx` existing snapshot missing `cameraMode`.

These six remain unresolved/outside scope. The production build is not a substitute for a passing full TypeScript check.

Reproduction uses the configured Node runtime:

```text
node --experimental-strip-types --test lib/game/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vinext/dist/cli.js build
node node_modules/vite/bin/vite.js --config tests/browser/vite.config.ts
# isolated panel: http://127.0.0.1:3002/warrior-v2.html
```

## 31. Deviations / compatibility

No intentional numerical/design deviation. Contract's optional stopping distance is2.5m; collision substep .25 is a technical safeguard. Existing Armor Break strength, stat caps, damage rounding and Mana rounding retained. Final owner window2500 overrides the previously unresolved counter duration. Legacy registry/jobs/save/progression remain; no destructive migration or mass deletion. Missing V2 rank defaults0 on load (not legacy slot1 grant), and ephemeral guard/buffs/stacks are excluded from persistence.

## 32. Remaining blockers / playtest boundary

No known blocker to testing the registered Warrior content through development APIs. Interactive full-world V2 browser playtest still needs a controlled world fixture/authorization entrypoint; this phase supplies the authorization function and isolated K harness, not a live character-selection toggle. Do not silently convert a player's save.

Full-world 3D animation/telegraph feel and traversing all real terrain with Charge were not manually validated; collision tests execute existing movement with controlled blocked/unblocked ground fixtures. Skill visuals reuse existing animation/effect routing, not bespoke animations. No buff/stack/counter timer UI was added. Indomitable's live usefulness depends on actual incoming stagger, currently absent from ordinary monster attacks unless provided. CP uptime/rotation limits above remain explicit.

General/control/guard/great-weapon/twin builds are representable; no tested implementation double-scaling dominance detected. Final gameplay balance requires a separate playtest/design decision. **No Berserker/Blade Master/Advanced/Rage/Flow content or live activation; no publish. Stop after Phase3A.**
