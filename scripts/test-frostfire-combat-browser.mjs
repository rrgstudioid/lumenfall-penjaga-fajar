// Actual Home/Game with a disposable browser save; never touches the owner's profile.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createV3AdventurerHero, SAVE_KEY } from '../lib/game/rules.ts';
import {
  FROSTFIRE_ID,
  FROSTFIRE_ENTRY,
} from '../lib/game/frostfire-highlands-layout.ts';
const { chromium } = await import(
  pathToFileURL(
    'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const bossMode = process.argv.includes('--boss');
const out = `output/frostfire-highlands/${bossMode ? 'boss-combat' : 'combat'}`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  }),
  page = await context.newPage();
const errors = [],
  checks = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log('PAGE ERROR', e.message);
});
page.on('console', (m) => {
  if (m.type() === 'error') {
    errors.push(m.text());
    console.log('CONSOLE ERROR', m.text().slice(0, 2500));
  }
});
await page.route(/\/lib\/game\/world\.ts/, async (route) => {
  const response = await route.fetch();
  const body = (await response.text()).replace(
    'this.renderer = new T.WebGLRenderer',
    'window.__frostQA=this;window.__frostThree=T;this.renderer = new T.WebGLRenderer',
  );
  await route.fulfill({ response, body });
});
const hero = createV3AdventurerHero('slot-1');
Object.assign(hero, {
  characterId: 'frostfire-test',
  characterName: 'Frostfire Explorer',
  level: 32,
  inCity: false,
  currentCity: 'averion',
  currentField: FROSTFIRE_ID,
  ...FROSTFIRE_ENTRY,
});
const fixture = {
  version: 3,
  activeSlot: 'slot-1',
  lastPlayedCharacterId: hero.characterId,
  characters: { 'slot-1': hero },
};
await context.addInitScript(
  ({ key, fixture }) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify(fixture));
  },
  { key: SAVE_KEY, fixture },
);
const check = (label, value = true) => {
  assert(value, label);
  checks.push(label);
  console.log('PASS', label);
};
async function ready() {
  await page.waitForFunction(
    () =>
      window.__frostQA?.started &&
      window.__frostQA?.frostfire &&
      !window.__frostQA?.transitioning,
    null,
    { timeout: 120000 },
  );
}
try {
  await page.goto('http://localhost:3000', {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page
    .getByRole('button', { name: 'CONTINUE', exact: true })
    .click({ timeout: 60000 });
  await ready();
  const combat = await page.evaluate(async (bossMode) => {
    const g = window.__frostQA;
    const layout = await import('/lib/game/frostfire-highlands-layout.ts');
    const pop = await import('/lib/game/frostfire-population.ts');
    g.paused = true;
    g.invincible = 1000;
    const e = bossMode ? g.enemies.find(m => m.boss) : g.enemies[0],
      nav = g.frostfire.navigation;
    const bosses = g.enemies.filter(m => m.boss);
    const bossPresent = bosses.length === 1 && bosses[0].definition.level === 34 &&
      bosses[0].definition.name === 'Twin Elemental Lord' && bosses[0].home.z < -160;
    const entrySafe =
      pop.frostSafe(g.hero) &&
      g.enemies.every(
        (m) =>
          Math.hypot(
            m.home.x - layout.FROSTFIRE_ENTRY.x,
            m.home.z - layout.FROSTFIRE_ENTRY.z,
          ) >= 70,
      );
    const placeHero = (x, z) => {
      g.hero.x = x;
      g.hero.z = z;
      g.actor.position.set(x, layout.frostHeight(x, z), z);
    };
    placeHero(e.home.x + 7, e.home.z);
    const before = e.group.position.distanceTo(g.actor.position);
    g.updateEnemy(e, 0.5);
    const chased = e.group.position.distanceTo(g.actor.position) < before;
    const grounded =
      Math.abs(
        e.group.position.y -
          layout.frostHeight(e.group.position.x, e.group.position.z),
      ) < 0.001;
    const far = g.enemies.find(
      (m) => m !== e && m.home.distanceTo(g.actor.position) > 150,
    );
    g.updateEnemy(far, 0.016);
    const distantSleeps = !far.group.visible;
    let collision = false;
    for (const prop of layout.frostProps()) {
      const start = { x: prop.x + prop.radius + 1.5, z: prop.z };
      if (!nav.valid(start, 0.55) || pop.frostSafe(start, 2)) continue;
      e.group.position.set(
        start.x,
        layout.frostHeight(start.x, start.z),
        start.z,
      );
      g.moveEnemy(e, -15, 0);
      collision =
        nav.valid(e.group.position, 0.55) &&
        Math.hypot(e.group.position.x - prop.x, e.group.position.z - prop.z) >=
          prop.radius + 0.55;
      break;
    }
    e.group.position.copy(e.home);
    e.group.visible = true;
    placeHero(e.home.x + 1.2, e.home.z);
    g.setCurrentTarget(e);
    g.attackTimer = 0;
    g.paused = false;
    const hp = e.hp;
    g.attack(true);
    g.paused = true;
    const attacked = e.hp < hp;
    g.cameraFocus.copy(g.actor.position);
    g.updateCamera(0.016);
    window.__combatTargetId = e.id;
    return {
      entrySafe,
      chased,
      grounded,
      distantSleeps,
      collision,
      attacked,
      bossPresent,
      target: { name: e.definition.name, level: e.definition.level, home: e.home },
      count: g.enemies.length,
      population: {
        normal: pop.frostPopulation().normalCount,
        elite: pop.frostPopulation().eliteCount,
        area: pop.frostPopulation().snowArea,
      },
    };
  }, bossMode);
  for (const name of [
    'entrySafe',
    'chased',
    'grounded',
    'distantSleeps',
    'collision',
    'attacked',
    'bossPresent',
  ])
    check(name, combat[name]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/hunting.png' });
  const killed = await page.evaluate(() => {
    const g = window.__frostQA,
      e = g.enemies.find((m) => m.id === window.__combatTargetId),
      old = g.hero.kills;
    g.hurtEnemy(e, 1e8, 0);
    return {
      id: e.id,
      key: e.respawnKey,
      deadline: e.respawnDeadline,
      dead: e.hp === 0 && !e.group.visible,
      kills: g.hero.kills === old + 1,
      bossCredit: !e.boss || (g.hero.defeatedFieldBosses.includes(g.hero.currentField) &&
        !!g.hero.defeatedBossTimestamp[g.hero.currentField] &&
        !g.hero.defeatedFieldBosses.includes('frostfire-highlands-v2')),
      respawnSeconds: e.respawn,
      expectedRespawnSeconds: e.definition.respawnTime,
    };
  });
  check(
    'kill grants credit and saves a map-specific respawn',
    killed.dead &&
      killed.kills &&
      killed.bossCredit &&
      killed.respawnSeconds === killed.expectedRespawnSeconds &&
      killed.key.startsWith('frostfire-highlands:') &&
      killed.deadline > Date.now(),
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  const respawn = await page.evaluate(({ id, deadline }) => {
    const g = window.__frostQA;
    g.paused = true;
    const e = g.enemies.find((m) => m.id === id);
    const restored = e.hp === 0 && e.respawnDeadline === deadline;
    e.respawnDeadline = Date.now() - 1;
    g.updateEnemy(e, 0.016);
    return {
      restored,
      alive:
        e.hp === e.max &&
        e.group.visible &&
        e.group.position.distanceTo(e.home) < 0.001,
      cleared: !g.hero.monsterRespawnState[e.respawnKey],
    };
  }, killed);
  check('death timer survives reload', respawn.restored);
  check(
    'monster respawns at home when its timer expires',
    respawn.alive && respawn.cleared,
  );
  check('no runtime errors', errors.length === 0);
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ checks, errors, combat, killed, respawn }, null, 2),
  );
} finally {
  await browser.close();
}
