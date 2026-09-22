import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {
  createV2TestHero,
  freshHero,
  derivedStats,
  resolveHeroSkill,
} from './rules.ts';
import { ALL_SKILLS, type SkillDefinition } from './skills.ts';
import { applyStatus } from './combat-status.ts';
import { addTemporaryModifier, resolveTargetHit } from './combat-modifiers.ts';
import { skillHitDamage } from './skill-action.ts';
import {
  ActionLock,
  targetIdentity,
  validTarget,
  needsSelectedTarget,
} from './targeting.ts';
import { TargetPresentation } from './target-presentation.ts';
const near = (a: number, b: number) =>
  assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const fixture = (patch: Partial<SkillDefinition> = {}): SkillDefinition => ({
  ...ALL_SKILLS[0],
  progressionMode: 'rank_values',
  baseDamage: 40,
  physicalCoefficient: 1,
  magicCoefficient: 0,
  skillPowerCoefficient: 0,
  weaponRequirement: [],
  ...patch,
});
void test('2D V2 normal bonuses add and explicit counter payoff multiplies total raw damage; legacy remains multiplicative', () => {
  for (const hero of [createV2TestHero(), freshHero()]) {
    for (const [i, value] of [4.5, 4, 10].entries())
      addTemporaryModifier(
        hero,
        { id: String(i), action: { damagePercent: value } },
        5,
      );
    const skill = fixture({
      modifiers: [
        {
          id: 'payoff',
          layer: 'payoff',
          condition: { counter: ['blocked'] },
          action: { damagePercent: 55 },
        },
      ],
    });
    const stats = { ...derivedStats(hero), physicalAttack: 60 };
    const original = JSON.stringify(skill);
    const action = resolveHeroSkill(hero, skill, 1, stats, {
      result: 'blocked',
    });
    const factor =
      hero.progressionArchitecture === 'v2_test' ? 1.185 : 1.045 * 1.04 * 1.1;
    near(skillHitDamage(action.hitSequence[0], stats), 100 * factor * 1.55);
    assert.equal(action.physicalCoefficient, 1);
    assert.equal(action.baseDamage, 40);
    assert.equal(JSON.stringify(skill), original);
  }
});
void test('2D deferred target normal bonuses share additive bucket, payoff separate, no same-hit mutation', () => {
  const hero = createV2TestHero(),
    stats = { ...derivedStats(hero), physicalAttack: 60 };
  addTemporaryModifier(
    hero,
    { id: 'normal', action: { damagePercent: 10 } },
    5,
  );
  const action = resolveHeroSkill(
    hero,
    fixture({
      modifiers: [
        {
          id: 'target-normal',
          condition: { targetStatuses: ['armor_break'] },
          action: { damagePercent: 20 },
        },
      ],
    }),
    1,
    stats,
  );
  const target = { statusEffects: {} };
  applyStatus(target, 'armor_break', 5);
  near(
    skillHitDamage(
      resolveTargetHit(
        action.hitSequence[0],
        action.targetModifiers,
        target,
      ),
      stats,
    ),
    130,
  );
  near(
    skillHitDamage(
      resolveTargetHit(
        action.hitSequence[0],
        action.targetModifiers,
        target,
      ),
      stats,
    ),
    130,
  );
  near(skillHitDamage(action.hitSequence[0], stats), 110);
  near(
    skillHitDamage(
      resolveTargetHit(action.hitSequence[0], action.targetModifiers, target),
      stats,
    ),
    130,
  );
});
void test('2D action lock clock and selected-target classification reuse existing target types', () => {
  const lock = new ActionLock();
  lock.start(0, 0.5, false);
  assert(lock.active(0.499));
  assert(!lock.active(0.5));
  lock.clear();
  assert(!lock.active(0));
  for (const targetType of ['self', 'area', 'frontal_arc'])
    assert(!needsSelectedTarget({ targetType, effect: 'damage' }));
  assert(needsSelectedTarget({ targetType: 'single', effect: 'damage' }));
  assert(needsSelectedTarget({ targetType: 'single', effect: 'dash_damage' }));
});
void test('2D identity is immutable runtime data, rejects stale generation/region/group replacement', () => {
  const scene = new T.Scene(),
    group = new T.Group();
  scene.add(group);
  const enemy = { id: 1, hp: 10, spawnGeneration: 0, group },
    map = new Map([[1, enemy]]),
    identity = targetIdentity(enemy, 4);
  assert(Object.isFrozen(identity));
  assert.equal(
    validTarget(identity, (id) => map.get(id), 4, scene),
    enemy,
  );
  assert(!validTarget(identity, (id) => map.get(id), 5, scene));
  enemy.spawnGeneration = 1;
  assert(!validTarget(identity, (id) => map.get(id), 4, scene));
});
void test('2D target frame/ring reuse, correct HP updates, hidden clear and disposal without leaked objects', () => {
  class ElementFixture {
    children: ElementFixture[] = [];
    parent?: ElementFixture;
    dataset: Record<string, string> = {};
    attributes: Record<string, string> = {};
    className = '';
    hidden = false;
    textContent = '';
    max = 0;
    value = 0;
    setAttribute(k: string, v: string) {
      this.attributes[k] = v;
    }
    appendChild(e: ElementFixture) {
      this.children.push(e);
      e.parent = this;
      return e;
    }
    remove() {
      if (this.parent)
        this.parent.children = this.parent.children.filter((e) => e !== this);
      this.parent = undefined;
    }
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => new ElementFixture() },
  });
  try {
    const host = new ElementFixture(),
      view = new TargetPresentation(host as unknown as HTMLElement),
      a = new T.Group(),
      b = new T.Group();
    const target = {
      id: 1,
      instanceId: a.uuid,
      name: 'Enemy A',
      level: 15,
      hp: 80,
      maxHP: 100,
    };
    view.show(a, target);
    const frame = host.children[0];
    assert(!frame.hidden);
    assert.equal(frame.children[0].textContent, 'Enemy A · Lv15');
    assert.equal(frame.children[1].value, 80);
    assert.equal(view.ring.parent, a);
    view.show(a, { ...target, hp: 25 });
    assert.equal(frame.children[1].value, 25);
    assert.equal(frame.children[2].textContent, '25 / 100 HP');
    view.show(b, { ...target, id: 2, instanceId: b.uuid, name: 'Enemy B' });
    assert.equal(a.children.length, 0);
    assert.equal(b.children.length, 1);
    assert.equal(host.children.length, 1);
    view.clear();
    assert(frame.hidden);
    assert.equal(b.children.length, 0);
    let disposed = 0;
    view.ring.geometry.addEventListener('dispose', () => disposed++);
    view.ring.material.addEventListener('dispose', () => disposed++);
    view.dispose();
    assert.equal(disposed, 2);
    assert.equal(host.children.length, 0);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
