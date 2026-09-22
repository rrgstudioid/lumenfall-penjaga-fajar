// Development-only full app entry. Install memory storage BEFORE importing any game/UI module.
// Native storage is never read, cleared, enumerated, or written. All autosaves/preferences are ephemeral.
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import '../../app/globals.css';
if (
  !['127.0.0.1', 'localhost'].includes(location.hostname) ||
  !import.meta.env.DEV
)
  throw new Error('Warrior playtest is development/localhost only.');
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(String(key)) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(String(key));
  }
  setItem(key: string, value: string) {
    this.data.set(String(key), String(value));
  }
}
Object.defineProperty(window, 'localStorage', {
  value: new MemoryStorage(),
  configurable: false,
});
Object.defineProperty(window, 'sessionStorage', {
  value: new MemoryStorage(),
  configurable: false,
});
const [{ makeWorldFixture, presets }, rules, { Game }, { default: Home }] =
  await Promise.all([
    import('./warrior-world-fixture'),
    import('../../lib/game/rules'),
    import('../../lib/game/world'),
    import('../../app/page'),
  ]);
const fixture = makeWorldFixture(new URLSearchParams(location.search));
rules.saveCharacter(fixture.hero, true);
type World = InstanceType<typeof Game>;
const events: Record<string, unknown>[] = [];
const qa = {
  game: null as World | null,
  summary: fixture.summary,
  events,
  storage: 'memory-only',
  record(kind: string, data: Record<string, unknown>) {
    events.push({ kind, time: qa.game?.combatTime ?? 0, ...data });
    if (events.length > 4000) events.shift();
  },
  state() {
    const g = qa.game;
    if (!g) return null;
    return {
      time: g.combatTime,
      started: g.started,
      paused: g.paused,
      dead: g.dead,
      hero: {
        x: g.hero.x,
        z: g.hero.z,
        hp: g.hero.hp,
        mana: g.hero.mana,
        level: g.hero.level,
      },
      target: g.getCurrentTarget()?.id,
      notice: g.notice,
      stacks: [...g.transientCombat.stacks.values()],
      windows: [...g.transientCombat.windows.entries()],
      buffs: g.hero.temporaryModifiers,
      counter: g.defenseEvents.snapshot(
        ['blocked', 'parried'],
        2500,
        g.combatTime * 1000,
      ),
    };
  },
};
Object.assign(window, { __warriorQA: qa, __lumenfallRules: rules });
// Observers deliberately capture prototype methods; each call/apply below supplies the live instance.
// oxlint-disable-next-line typescript/unbound-method
const start = Game.prototype.start;
Game.prototype.start = function () {
  qa.game = this;
  start.call(this);
  qa.record('start', { field: this.hero.currentField });
};
// oxlint-disable-next-line typescript/unbound-method
const cast = Game.prototype.castSkill;
Game.prototype.castSkill = function (id) {
  const mp = this.hero.mana;
  const ok = cast.call(this, id);
  qa.record('cast', {
    id,
    ok,
    mpBefore: mp,
    mpAfter: this.hero.mana,
    reason: this.lastActionFailure,
    notice: this.notice,
  });
  return ok;
};
// oxlint-disable-next-line typescript/unbound-method
const apply = Game.prototype.applySkill;
Game.prototype.applySkill = function (...args) {
  const a = args[3];
  qa.record('action', {
    id: args[0].id,
    action: a ? structuredClone(a) : null,
  });
  return apply.apply(this, args);
};
// oxlint-disable-next-line typescript/unbound-method
const hurt = Game.prototype.hurtEnemy;
Game.prototype.hurtEnemy = function (...args) {
  const e = args[0],
    before = e.hp;
  const result = hurt.apply(this, args);
  qa.record('hit', {
    target: e.id,
    before,
    after: e.hp,
    damage: before - e.hp,
  });
  return result;
};
// oxlint-disable-next-line typescript/unbound-method
const incoming = Game.prototype.hurtHero;
Game.prototype.hurtHero = function (...args) {
  const hp = this.hero.hp;
  const result = incoming.apply(this, args);
  qa.record('incoming', {
    before: hp,
    after: this.hero.hp,
    event: this.defenseEvents.snapshot(
      ['blocked', 'parried'],
      2500,
      this.combatTime * 1000,
    ),
  });
  return result;
};
// oxlint-disable-next-line typescript/unbound-method
const dispose = Game.prototype.dispose;
Game.prototype.dispose = function () {
  dispose.call(this);
  qa.record('dispose', {});
  if (qa.game === this) qa.game = null;
};
function DevBar() {
  const [diagnostics, setDiagnostics] = useState(false),
    [readout, setReadout] = useState('');
  useEffect(() => {
    if (!diagnostics) return;
    const timer = setInterval(() => {
      const s = qa.state();
      setReadout(JSON.stringify(s, null, 2));
    }, 300);
    return () => clearInterval(timer);
  }, [diagnostics]);
  return (
    <details
      style={{
        position: 'fixed',
        left: 8,
        top: 8,
        zIndex: 99999,
        background: '#172020',
        color: '#fff',
        padding: 8,
        fontSize: 12,
        maxWidth: 460,
        maxHeight: '85vh',
        overflow: 'auto',
      }}
    >
      <summary>
        DEV {fixture.hero.coreJob === 'thief' ? 'Thief' : 'Warrior'} · MEMORY ONLY · {fixture.summary.build} Lv
        {fixture.summary.level}
      </summary>
      <form action="/warrior-world.html">
        {fixture.hero.coreJob === 'thief' ? <input type="hidden" name="core" value="thief" /> : null}
        <label>
          Level{' '}
          <select name="level" defaultValue={fixture.summary.level}>
            {[15, 30, 45, 59].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>{' '}
        <label>
          Build{' '}
          <select name="build" defaultValue={fixture.summary.build}>
            {(fixture.hero.coreJob === 'thief' ? ['thief', 'all'] : Object.keys(presets)).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <br />
        <label>
          Total SP override{' '}
          <input
            name="sp"
            type="number"
            min="0"
            max="200"
            placeholder="level − 1"
            style={{ width: 100 }}
          />
        </label>
        <br />
        <label>
          Unallocated stat points{' '}
          <input
            name="stats"
            type="number"
            min="0"
            max="500"
            placeholder="3 × (level − 1)"
            style={{ width: 100 }}
          />
        </label>
        <br />
        <button type="submit">New memory fixture (discard session)</button>
      </form>
      <p>
        Use Continue. Real world/UI, no player saves. K = skills, J = quests.
        All + SP200 = diagnostic sandbox, NOT legal economy. Reload discards
        changes.
      </p>
      <p>
        Paid {fixture.hero.coreJob === 'thief' ? 'Thief' : 'Warrior'}: {'paidThief' in fixture.summary ? fixture.summary.paidThief : fixture.summary.paidWarrior} · Remaining SP:{' '}
        {fixture.summary.unspentSP} · Baseline MP: {fixture.summary.maxMana}
      </p>
      <button
        onClick={() => {
          const g = qa.game;
          if (!g) return;
          const s = rules.derivedStats(g.hero);
          g.hero.hp = s.maxHP;
          g.hero.mana = s.maxMana;
          g.skillCooldowns = {};
          g.cooldown = 0;
          g.emit();
          qa.record('fixture-reset-resources', {});
        }}
      >
        DEV refill HP/MP + cooldown reset
      </button>{' '}
      <button
        onClick={() => {
          const g = qa.game;
          if (!g) return;
          const e = g.enemies
            .filter((e) => e.hp > 0)
            .sort(
              (a, b) =>
                a.group.position.distanceTo(g.actor.position) -
                b.group.position.distanceTo(g.actor.position),
            )[0];
          if (!e) return;
          g.clearSkillRuntime();
          g.hero.x = e.group.position.x;
          g.hero.z = e.group.position.z + 6;
          g.placeActor();
          g.cameraFocus.copy(g.actor.position);
          qa.record('fixture-relocate', { enemy: e.id });
        }}
      >
        DEV go near living enemy
      </button>{' '}
      <button
        onClick={() => {
          const g = qa.game,
            e = g?.getCurrentTarget();
          if (!g || !e?.definition) return;
          e.definition = {
            ...e.definition,
            name: 'DEV endurance target',
            maxHP: 30000,
          };
          e.hp = e.max = 30000;
          g.updateTargetPresentation();
          qa.record('fixture-endurance', { target: e.id, hp: 30000 });
        }}
      >
        DEV selected target HP 30,000
      </button>
      <label>
        <input
          type="checkbox"
          checked={diagnostics}
          onChange={(e) => setDiagnostics(e.target.checked)}
        />{' '}
        DEV diagnostics (not player UI)
      </label>
      {diagnostics ? (
        <pre style={{ maxHeight: 250, overflow: 'auto', fontSize: 11 }}>
          {readout}
        </pre>
      ) : null}
    </details>
  );
}
createRoot(document.getElementById('root')!).render(
  <>
    <Home />
    <DevBar />
  </>,
);
