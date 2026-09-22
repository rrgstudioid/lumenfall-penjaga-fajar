# LUMENFALL — Stagger Removal Dependency Inventory

Status: inventory sebelum perubahan kode.

## 1. Runtime subsystem

- `lib/game/stagger.ts`: konfigurasi, state, buildup, threshold, break,
  recovery, dan recent-break window.
- `lib/game/world.ts`: state Stagger pada hero/enemy, recovery tick, break
  event, reset/cleanup, action/movement restrictions, AI interruption, dan
  hit processing.
- `lib/game/skill-action.ts`: `staggerDamage`, `staggerMultiplier`, dan
  resolved hit/action payload.
- `lib/game/skills.ts`: data `staggerDamage`, status `staggered`, dan tag
  Stagger pada skill definitions.

## 2. Combat modifiers and stats

- `lib/game/combat-modifiers.ts`: `staggerResistance`, `staggerPercent`,
  `staggerMultiplier`, recent-break condition, dan scaling Stagger.
- `lib/game/rules.ts`: `DerivedStats.staggerResistance` dan combat support
  yang khusus membaca recent Stagger Break.
- `lib/game/regions.ts`: `MonsterDefinition.staggerResistance` dan profil
  Stagger monster.
- `lib/game/combat-power.ts`: inspeksi capability, modifier, dan diagnostics
  yang khusus menghitung Stagger.

## 3. Warrior dependencies requiring later redesign

The following are not replaced with Stun or another effect in this phase:

- `Firm Footing`: Stagger resistance dependency removed; mark
  `REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT`.
- `Heavy Impact`: Stagger amplification dependency removed; mark
  `REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT`.
- `Indomitable Will`: recent Stagger Break dependency removed; mark
  `REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT`.
- `Rising Slash`: Stagger buildup dependency removed; mark
  `REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT`.
- `Ground Breaker`: Stagger buildup dependency removed; mark
  `REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT`.
- `Crushing Finale`: recent-break payoff removed; Armor Break behavior is
  retained, and the skill is marked for later redesign.
- Other Warrior weapon/counter modifiers lose only their Stagger component;
  their non-Stagger behavior remains unchanged.

## 4. UI / presentation

- `lib/game/target-presentation.ts`: target Stagger gauge and `STAGGERED`
  target status.
- `components/game/job-skill.tsx`: Stagger tooltip/stat presentation.
- `app/globals.css`: target Stagger gauge styles.
- `lib/game/world.ts`: `STAGGER BREAK` combat feedback and target snapshot
  fields.

## 5. Tests and documentation

- Stagger-specific assertions in `lib/game/*.test.ts`, especially
  `skill-runtime-v2.test.ts`, `warrior-v2.test.ts`, `thief-v2.test.ts`,
  `phase-1b.test.ts`, and related combat/stat tests.
- Historical design documents may mention Stagger; they are not runtime
  dependencies and will only be updated where they would otherwise describe
  the current implementation incorrectly.

## 6. Preserved behavior

- Generic status/CC infrastructure remains available for future Stun.
- Ordinary hit reaction/flinch and existing knockback/displacement behavior
  remain when they are not part of the removed Stagger subsystem.
- No damage, Mana, cooldown, duration, or new crowd-control replacement is
  introduced by this removal.
