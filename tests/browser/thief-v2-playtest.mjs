import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = 'output/phase4d-browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], warnings = [], httpFailures = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`${m.text()} @ ${m.location().url}`);
  if (m.type() === 'warning') warnings.push(m.text());
});
page.on('response', (r) => { if (r.status() >= 400) httpFailures.push({ status: r.status(), url: r.url() }); });
const snapshot = () => page.evaluate(() => {
  const q = window.__warriorQA, g = q.game, s = window.__lumenfallRules.derivedStats(g.hero);
  return {
    summary: q.summary,
    finalStats: { physicalAttack: s.physicalAttack, criticalRate: s.criticalRate, evasion: s.evasion, maxMana: s.maxMana, maxHP: s.maxHP },
    skillLevels: g.hero.skillLevels, passiveLevels: g.hero.passiveLevels,
    equipment: g.hero.equipment, target: g.currentTargetView(), feedback: g.combatFeedbackSnapshot(), events: q.events.slice(-50),
  };
});
try {
  await page.goto('http://127.0.0.1:3003/warrior-world.html?core=thief&level=59&build=thief', { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path: `${out}/01-legal-menu.png` });
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForFunction(() => window.__warriorQA?.game?.started, { timeout: 60000 });
  await page.screenshot({ path: `${out}/02-legal-world.png` });
  const loaded = await snapshot();
  console.log('LEGAL', JSON.stringify(loaded));
  await page.evaluate(() => {
    const g = window.__warriorQA.game, e = g.enemies.find(e => e.hp > 0);
    if (!e) throw Error('No field enemy');
    g.clearSkillRuntime(); g.hero.x = e.group.position.x; g.hero.z = e.group.position.z + 2; g.placeActor(); g.cameraFocus.copy(g.actor.position);
    e.definition = { ...e.definition, name: 'DEV Thief endurance target', maxHP: 30000 }; e.hp = e.max = 30000;
    g.setCurrentTarget(e); g.hero.mana = 100; g.hero.hp = window.__lumenfallRules.derivedStats(g.hero).maxHP; g.skillCooldowns = {};
    g.paused = true; g.emit();
  });
  await page.screenshot({ path: `${out}/03-target-frame.png` });
  const available = await page.evaluate(() => Object.keys(window.__warriorQA.game.hero.skillLevels).filter(id => id.startsWith('v2-thief-')));
  const result = { loaded, available, actions: [] };
  const action = async (id, dt = 0) => {
    const item = await page.evaluate(({ id, dt }) => {
      const q = window.__warriorQA, g = q.game; g.paused = false; g.stepSkillRuntime(.05); g.actionLock.clear(); g.skillCooldowns[id] = 0;
      const mana = g.hero.mana, before = q.events.length, ok = g.castSkill(id); if (dt) g.stepSkillRuntime(dt); g.paused = true; g.emit();
      return { id, ok, manaBefore: mana, manaAfter: g.hero.mana, newEvents: q.events.slice(before), target: g.currentTargetView(), feedback: g.combatFeedbackSnapshot(), pos: { x: g.hero.x, z: g.hero.z } };
    }, { id, dt });
    result.actions.push(item); return item;
  };
  for (const id of ['v2-thief-mark-prey','v2-thief-smoke-veil','v2-thief-slipstep','v2-thief-disengage','v2-thief-twin-fang','v2-thief-blade-flurry','v2-thief-venom-edge','v2-thief-marked-strike']) {
    if (available.includes(id)) await action(id, id.includes('twin-fang') ? .2 : id.includes('blade-flurry') ? .38 : 0);
  }
  result.singleVsDual = await page.evaluate(() => {
    const g = window.__warriorQA.game, main = g.hero.equipment.mainHand, off = g.hero.equipment.offHand;
    g.paused = false; g.clearSkillRuntime(); g.setCurrentTarget(g.enemies.find(e => e.hp > 0)); g.hero.mana = 100; g.skillCooldowns = {}; g.actionLock.clear();
    g.hero.equipment.offHand = null; g.syncCombatModifiers();
    const twinWithoutOffhand = g.castSkill('v2-thief-twin-fang');
    g.skillCooldowns['v2-thief-quick-stab'] = 0; g.actionLock.clear();
    const quickWithSingle = g.castSkill('v2-thief-quick-stab');
    g.hero.equipment.offHand = off; g.hero.equipment.mainHand = main; g.syncCombatModifiers();
    g.paused = true; g.emit();
    return { twinWithoutOffhand, quickWithSingle, restoredDual: Boolean(off), weapon: [main, off] };
  });
  result.evasionAndVenom = await page.evaluate(() => {
    const g = window.__warriorQA.game, s = window.__lumenfallRules.derivedStats(g.hero);
    g.paused = false; g.clearSkillRuntime(); g.setCurrentTarget(g.enemies.find(e => e.hp > 0)); g.hero.mana = 100; g.hero.hp = s.maxHP * .35; g.skillCooldowns = {}; g.actionLock.clear();
    const before = window.__lumenfallRules.derivedStats(g.hero).evasion;
    const feint = g.castSkill('v2-thief-evasive-feint');
    const after = window.__lumenfallRules.derivedStats(g.hero).evasion;
    g.skillCooldowns['v2-thief-venom-edge'] = 0; g.actionLock.clear();
    const venom = g.castSkill('v2-thief-venom-edge');
    g.paused = true; g.emit();
    return { hpRatio: g.hero.hp / s.maxHP, beforeEvasion: before, afterEvasion: after, feint, venom, poisonRemaining: g.getCurrentTarget()?.poison, indicators: g.combatFeedbackSnapshot().indicators };
  });
  await page.screenshot({ path: `${out}/04-rotation-result.png` });
  await page.keyboard.press('k');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/05-legal-k-panel.png` });
  result.kText = await page.locator('body').innerText();
  result.state = await snapshot();
  await writeFile(`${out}/result.json`, JSON.stringify({ result, errors, warnings, httpFailures }, null, 2));
  console.log('RESULT', JSON.stringify({ available, actions: result.actions.map(a => ({ id: a.id, ok: a.ok, manaBefore: a.manaBefore, manaAfter: a.manaAfter, events: a.newEvents.length, feedback: a.feedback.indicators.map(i => i.label) })), singleVsDual: result.singleVsDual, evasionAndVenom: result.evasionAndVenom, errors, warnings, httpFailures }));
  if (errors.some(e => !(e.includes('404') && e.includes('/favicon.ico')))) throw Error(errors.join('\n'));
} finally { await browser.close(); }
