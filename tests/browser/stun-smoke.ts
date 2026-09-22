import * as T from 'three';
import { Game } from '../../lib/game/world';
import { createV3AdventurerHero, chooseV3Warrior } from '../../lib/game/rules';
import { FIELDS } from '../../lib/game/regions';

const style = document.createElement('style');
style.textContent = 'body{margin:0;background:#172020;color:#f5dfb0;font:15px sans-serif}main{padding:18px}#scene{height:58vh;min-height:420px;border:1px solid #9b7b45;margin:12px 0}canvas{display:block;width:100%;height:100%}.controls{display:flex;gap:8px;flex-wrap:wrap}.controls button{background:#293a35;color:#f5dfb0;border:1px solid #cfa75a;padding:8px 12px;border-radius:4px}pre{white-space:pre-wrap;background:#101615;padding:12px;max-height:30vh;overflow:auto}';
document.head.appendChild(style);

const host = document.querySelector<HTMLDivElement>('#scene')!;
const out = document.querySelector<HTMLPreElement>('#result')!;
window.addEventListener('error', (event) => { out.textContent = `RUNTIME ERROR\n${String(event.error?.stack ?? event.message)}`; });
window.addEventListener('unhandledrejection', (event) => { out.textContent = `UNHANDLED REJECTION\n${String((event as PromiseRejectionEvent).reason?.stack ?? (event as PromiseRejectionEvent).reason)}`; });

const memory = new Map<string, string>();
Object.defineProperty(window, 'localStorage', { value: {
  get length() { return memory.size; }, clear() { memory.clear(); },
  getItem: (key: string) => memory.get(key) ?? null,
  key: (index: number) => [...memory.keys()][index] ?? null,
  removeItem: (key: string) => memory.delete(key),
  setItem: (key: string, value: string) => memory.set(String(key), String(value)),
}, configurable: false });

const hero = createV3AdventurerHero('spv3-4-2-smoke', 'SPV3-4.2 Smoke Warrior');
hero.level = 59;
hero.currentField = 'verdant-plains';
hero.inCity = false;
Object.assign(hero, FIELDS['verdant-plains'].entry);
hero.lastSafePosition = { x: hero.x, z: hero.z };
chooseV3Warrior(hero);
hero.skillProgressionV3!.totalEarnedSP = 200;
hero.skillProgressionV3!.skillRanks['v3-warrior-iron-charge'] = 1;
hero.skillLevels['v3-warrior-iron-charge'] = 1;
hero.mana = hero.maxMana = 999;
hero.hp = 9999;

const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setSize(host.clientWidth, host.clientHeight);
host.appendChild(renderer.domElement);
const labelHost = document.createElement('div');
host.appendChild(labelHost);
const minimap = document.createElement('canvas');
const game = new Game(host, labelHost, minimap, () => {}, () => {}, 'spv3-4-2-smoke');
game.hero = hero;
game.started = true;
game.paused = false;
game.dead = false;
game.rand = () => 0;
game.buildEnemies();
game.renderer.setAnimationLoop(null);

const target = game.enemies.find((enemy) => enemy.hp > 0)!;
game.setCurrentTarget(target);
type TraceEvent = Record<string, unknown>;
let trace: TraceEvent[] = [];
game.developmentTrace = (event) => trace.push(event);

function reset(distance: number, immune = false) {
  game.clearSkillRuntime();
  trace = [];
  game.hero.stunState = undefined;
  target.stunState = undefined;
  target.stun = 0;
  target.stunImmune = immune;
  target.hp = target.max = 30000;
  game.hero.x = 0;
  game.hero.z = 0;
  game.actor.position.set(0, game.groundHeight(0, 0), 0);
  target.group.position.set(0, game.groundHeight(0, distance), distance);
  game.setCurrentTarget(target);
  game.skillCooldowns = {};
  game.hero.mana = 999;
  game.combatTime = 0;
  game.emit();
}

function state(start: { x: number; z: number }) {
  const stun = target.stunState;
  return {
    movement: { start, end: { x: game.actor.position.x, z: game.actor.position.z }, travelDistance: Math.hypot(game.actor.position.x - start.x, game.actor.position.z - start.z) },
    damage: 30000 - target.hp,
    targetHp: target.hp,
    targetPosition: { x: target.group.position.x, z: target.group.position.z },
    stunned: Boolean(stun && stun.expiresAt > game.combatTime),
    stunRemaining: stun ? Math.max(0, stun.expiresAt - game.combatTime) : 0,
    stunImmune: Boolean(target.stunImmune),
    trace,
  };
}

function resolveImpact() { game.stepSkillRuntime(0.8); }

function cast(distance: number, immune = false) {
  reset(distance, immune);
  const start = { x: game.actor.position.x, z: game.actor.position.z };
  const accepted = game.castSkill('v3-warrior-iron-charge');
  resolveImpact();
  return { castAccepted: accepted, ...state(start) };
}

function write(label: string, data: unknown) { out.textContent = `${label}\n${JSON.stringify(data, null, 2)}`; }

document.querySelector('#short')!.addEventListener('click', () => write('CASE A — SHORT CHARGE', cast(2.5)));
document.querySelector('#long')!.addEventListener('click', () => write('CASE B — LONG CHARGE / DETERMINISTIC PROC', cast(6)));
document.querySelector('#lock')!.addEventListener('click', () => {
  const result = cast(6);
  const before = { x: game.actor.position.x, z: game.actor.position.z };
  game.move(1, 0);
  const moved = Math.hypot(game.actor.position.x - before.x, game.actor.position.z - before.z) > 0.001;
  const basicBefore = target.hp;
  game.attack();
  const basicDamage = basicBefore - target.hp;
  const skillAccepted = game.castSkill('v3-warrior-iron-charge');
  write('CASE D1 — STUN CONTROL LOCK', { ...result, movedWhileStunned: moved, basicDamageWhileStunned: basicDamage, skillAcceptedWhileStunned: skillAccepted, stunned: Boolean(target.stunState && target.stunState.expiresAt > game.combatTime) });
});
document.querySelector('#recover')!.addEventListener('click', () => {
  cast(6);
  game.combatTime += 1.6;
  const before = { x: game.actor.position.x, z: game.actor.position.z };
  game.move(1, 0);
  write('CASE D2 — RECOVERY', { before, after: { x: game.actor.position.x, z: game.actor.position.z }, movedAfterExpiry: Math.hypot(game.actor.position.x - before.x, game.actor.position.z - before.z) > 0.001, stunned: Boolean(target.stunState && target.stunState.expiresAt > game.combatTime), remaining: Math.max(0, (target.stunState?.expiresAt ?? 0) - game.combatTime), trace });
});
document.querySelector('#immune')!.addEventListener('click', () => write('CASE C — IMMUNITY', cast(6, true)));
document.querySelector('#basic')!.addEventListener('click', () => { reset(2.5); const before = target.hp; game.attack(); write('CASE E — BASIC ATTACK', { damage: before - target.hp, stunned: Boolean(target.stunState), knockback: 'none', targetPosition: { x: target.group.position.x, z: target.group.position.z } }); });
document.querySelector('#reset')!.addEventListener('click', () => { reset(2.5); write('RESET', state({ x: 0, z: 0 })); });

reset(2.5);
function runLockCase() {
  const result = cast(6);
  const before = { x: game.actor.position.x, z: game.actor.position.z };
  game.move(1, 0);
  const moved = Math.hypot(game.actor.position.x - before.x, game.actor.position.z - before.z) > 0.001;
  const basicBefore = target.hp;
  game.attack();
  const basicDamage = basicBefore - target.hp;
  const skillAccepted = game.castSkill('v3-warrior-iron-charge');
  return { ...result, movedWhileStunned: moved, basicDamageWhileStunned: basicDamage, skillAcceptedWhileStunned: skillAccepted, stunned: Boolean(target.stunState && target.stunState.expiresAt > game.combatTime) };
}
function runRecoveryCase() {
  cast(6);
  game.combatTime += 1.6;
  const before = { x: game.actor.position.x, z: game.actor.position.z };
  game.move(1, 0);
  return { before, after: { x: game.actor.position.x, z: game.actor.position.z }, movedAfterExpiry: Math.hypot(game.actor.position.x - before.x, game.actor.position.z - before.z) > 0.001, stunned: Boolean(target.stunState && target.stunState.expiresAt > game.combatTime), remaining: Math.max(0, (target.stunState?.expiresAt ?? 0) - game.combatTime), trace };
}
// Cases are intentionally run one at a time from the headed controls. This
// keeps the browser responsive and makes each evidence snapshot attributable.
const clock = new T.Clock();
// Keep this smoke harness headed but deterministic: the gameplay simulation is
// stepped explicitly above; no continuous render loop is needed for evidence.
clock.getDelta();
game.updateTargetPresentation();
renderer.render(game.scene, game.camera);
window.addEventListener('pagehide', () => { renderer.setAnimationLoop(null); game.dispose(); }, { once: true });
