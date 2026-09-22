# LUMENFALL — Global Stagger Removal Report

## Status

Runtime removal is implemented locally. Stun was not added and no numerical
combat values were introduced or rebalance-edited.

## Removed from active runtime

- Stagger state allocation, buildup, threshold, break, recovery, and recent
  break window.
- `staggerDamage` and Stagger-specific modifier channels from resolved combat
  actions.
- Stagger Resistance as a derived/equipment/monster gameplay stat.
- Target Stagger gauge and `STAGGERED`/`STAGGER BREAK` presentation.
- Stagger-only player/enemy movement and AI gates.
- Stagger-specific Combat Power inspection.
- Stagger-specific Warrior modifier components.

## Preserved

- Generic status/CC framework, including the ability to add Stun later.
- Existing ordinary hit reaction animation.
- Existing knockback/displacement path. The legacy field named `stagger` is
  retained only as compatibility data for physical displacement, not as a
  poise gauge or crowd-control state.
- Non-Stagger parts of skills, including damage, Mana, cooldown, Armor Break,
  counter damage, and weapon-momentum damage behavior.

## Marked for redesign

`Firm Footing`, `Heavy Impact`, `Indomitable Will`, `Rising Slash`,
`Ground Breaker`, and `Crushing Finale` are marked
`REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT`. No Stun or replacement effect was
added. Crushing Finale retains only its Armor Break payoff for now.

## Verification

- Focused removal regression: 2 passed, 0 failed.
- Existing game run after the first test cleanup: 358 passed, 5 failed. The
  remaining failures are obsolete Phase 1B/3A/4C assertions that explicitly
  require the removed Stagger fields or module; they must be retired or
  rewritten as part of the next test-cleanup pass.
- Primary-source TypeScript still reports the same five visible pre-existing
  source errors in `rules.ts` and `ui-layout.ts`; the full project typecheck
  also reports stale Stagger assertions in historical tests.
- Production build was started but did not complete in the local environment
  before the verification timeout; no build error was emitted before it was
  stopped.
