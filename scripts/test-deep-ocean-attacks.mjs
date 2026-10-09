import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = process.env.QA_OUTPUT ?? 'output/sunken-ruins/revision12';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let report;
try {
  await page.goto(
    'http://127.0.0.1:3002/sunken-ruins.html?map=deep-ocean-underwater-v1&level=48',
  );
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__sunkenQA?.game?.sunken && !window.__sunkenQA.game.transitioning,
    null,
    { timeout: 120000 },
  );
  report = await page.evaluate(() => {
    const { game: g, FIELDS } = window.__sunkenQA;
    cancelAnimationFrame(g.frame);
    g.rand = () => 0.99; // Deterministic hit rather than evasion; no invincibility.
    const reset = (e) => {
      e.group.position.copy(e.home);
      e.group.rotation.y = 0;
      e.windup = e.cooldown = e.stun = e.root = e.slow = e.poison = 0;
      e.navigation = undefined;
      e.hp = e.max;
      g.hero.hp = 100000;
      g.hero.barrier = 0;
      g.invincible = 0;
      g.dead = false;
    };
    const step = (e) => {
      g.elapsed += 1 / 60;
      g.combatTime += 1 / 60;
      g.invincible = Math.max(0, g.invincible - 1 / 60);
      g.updateEnemy(e, 1 / 60);
    };
    const field = FIELDS[g.hero.currentField];
    const results = [];
    for (const def of [
      ...field.normalMonsters,
      ...field.eliteMonsters,
      field.fieldBoss,
    ]) {
      const e = g.enemies.find((e) => e.definition.id === def.id);
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        reset(e);
        const shape = e.group.children[0].userData.combatShape;
        const distance = shape.radius + shape.halfLength + 6;
        Object.assign(g.hero, {
          x: e.home.x + Math.sin(angle) * distance,
          z: e.home.z + Math.cos(angle) * distance,
        });
        g.placeActor();
        let tells = 0,
          prior = 0,
          visibleTell = false;
        for (let i = 0; i < 1200; i++) {
          step(e);
          if (e.windup > 0 && prior <= 0) tells++;
          prior = e.windup;
          visibleTell ||= e.windup > 0 && e.ring.material.opacity > 0;
        }
        results.push({
          name: def.name,
          angle,
          damage: 100000 - g.hero.hp,
          tells,
          visibleTell,
          returned: false,
        });
        Object.assign(g.hero, { x: 0, z: 320 });
        g.placeActor();
        for (let i = 0; i < 1200; i++) step(e);
        results.at(-1).returned = e.group.position.distanceTo(e.home) < 1.1;
      }
    }
    // Marlyn's long bill needs more boundary clearance than its damage capsule.
    // At the east edge the old 1.4-unit stop threshold cannot be reached, but
    // the player remains inside the species' actual 1.8-unit attack range.
    const e = g.enemies.find((e) => e.definition.id.endsWith('-marlyn'));
    const savedHome = e.home.clone(),
      radius = e.group.children[0].userData.navigationRadius;
    e.home.set(500 - radius, g.groundHeight(500 - radius, 0), 0);
    reset(e);
    const shape = e.group.children[0].userData.combatShape;
    Object.assign(g.hero, {
      x: e.home.x + shape.halfLength + shape.radius + 1.6,
      z: 0,
    });
    g.placeActor();
    const start = e.group.position.clone();
    for (let i = 0; i < 600; i++) step(e);
    const edge = {
      damage: 100000 - g.hero.hp,
      distance: g.enemyRange(e),
      movement: e.group.position.distanceTo(start),
      heroX: g.hero.x,
      radius,
    };
    // Safe arrival remains safe even with an enemy deliberately placed beside it.
    e.home.set(0, g.groundHeight(0, 320), 320);
    reset(e);
    Object.assign(g.hero, { x: 0, z: 320 });
    g.placeActor();
    for (let i = 0; i < 300; i++) step(e);
    const safeDamage = 100000 - g.hero.hp;
    e.home.copy(savedHome);
    reset(e);
    return { results, edge, safeDamage };
  });
  for (const row of report.results) {
    assert.ok(row.damage > 0, `${row.name} angle ${row.angle}: no damage`);
    assert.ok(
      row.tells >= 2 && row.visibleTell,
      `${row.name}: missing repeated windup`,
    );
    assert.ok(row.returned, `${row.name}: cannot return home`);
  }
  assert.ok(
    report.edge.damage > 0 && report.edge.movement < 0.01,
    'in-range boundary attack stalled',
  );
  assert.equal(report.safeDamage, 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report));
} finally {
  await writeFile(
    `${out}/incoming-attacks.json`,
    JSON.stringify({ ...report, errors }, null, 2),
  );
  await browser.close();
}
