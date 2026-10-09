import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const browser = await chromium.launch({ channel: 'chrome', headless: true }),
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const out = process.env.SUNKEN_HUNTING_OUTPUT ?? 'output/sunken-ruins/revision11',
  errors = [],
  report = {};
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
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
  await page.evaluate(() => window.__sunkenQA.game.characterModel.ready);
  report.population = await page.evaluate(() => {
    const { game: g } = window.__sunkenQA;
    cancelAnimationFrame(g.frame);
    g.invincible = 9999;
    return {
      count: g.enemies.length,
      species: g.enemies.reduce((a, e) => {
        const k = e.definition.name + ' Lv' + e.definition.level;
        a[k] = (a[k] ?? 0) + 1;
        return a;
      }, {}),
      visible: g.enemies.filter((e) => e.group.visible).length,
    };
  });
  assert.equal(report.population.count, 335);
  assert.ok(report.population.visible < 50);
  for (const slug of [
    'goblin-shark',
    'baracuda',
    'marlyn',
    'giant-squid',
    'giant-squid-elite',
    'megalodon',
  ]) {
    const png = await page.evaluate((slug) => {
      const { game: g, three: T } = window.__sunkenQA,
        e = g.enemies.find(
          (e) => e.definition.id === `deep-ocean-underwater-v1-${slug}`,
        ),
        p = e.home;
      Object.assign(g.hero, { x: p.x + 7, z: p.z - 4 });
      g.placeActor();
      g.actor.visible = true;
      g.setGraphicsQuality('high', false);
      for (const a of g.enemies) g.updateEnemy(a, 0);
      g.worldLightRig.traverse((o) => {
        if (o instanceof T.DirectionalLight) {
          o.position.set(p.x - 25, p.y + 60, p.z + 20);
          o.target.position.copy(p);
          o.target.updateMatrixWorld();
        }
      });
      const c = new T.PerspectiveCamera(52, 1440 / 900, 0.1, 2000),
        large = e.boss;
      c.position.set(
        p.x + (large ? 24 : 9),
        p.y + (large ? 14 : 5),
        p.z + (large ? 28 : 10),
      );
      c.lookAt(p.x, p.y + (large ? 5 : 1.5), p.z);
      g.sunken.update(c, g.hero, 0);
      g.renderer.render(g.scene, c);
      return g.renderer.domElement.toDataURL();
    }, slug);
    await writeFile(
      `${out}/${slug}.png`,
      Buffer.from(png.split(',')[1], 'base64'),
    );
  }
  report.combat = await page.evaluate(() => {
    const { game: g, rules: R } = window.__sunkenQA;
    g.rand = () => 0.01;
    const results = [];
    for (const variant of ['normal', 'elite', 'boss']) {
      const e = g.enemies.find((e) => e.definition.variant === variant);
      e.group.rotation.y = 0;
      const shape = e.group.children[0].userData.combatShape;
      Object.assign(g.hero, { x: e.home.x + shape.radius + 8, z: e.home.z });
      g.placeActor();
      if (!g.autoApproachTarget(e, 1)) throw Error('Cannot approach body surface');
      g.updateEnemy(e, 0);
      g.invincible = 9999;
      g.setCurrentTarget(e);
      g.attackTimer = 0;
      g.actionLock.clear();
      const contact = g.enemyContact(e);
      if (!g.hasClearDashImpact(contact, 3.5)) throw Error('Body-surface dash impact rejected');
      const hp = e.hp;
      g.attack();
      const hit = e.hp < hp;
      const before = g.hero.kills,
        loot = g.groundLoot.length;
      g.hurtEnemy(e, 1e8, 0);
      const dead = e.hp === 0,
        deadline = g.hero.monsterRespawnState[e.respawnKey];
      const saved = R.parseSave(JSON.stringify(g.hero));
      e.respawnDeadline = Date.now() - 1;
      g.updateEnemy(e, 1 / 60);
      results.push({
        variant,
        hit,
        dead,
        reward: g.hero.kills === before + 1 && g.groundLoot.length > loot,
        saved: saved.monsterRespawnState[e.respawnKey] === deadline,
        respawn: e.hp === e.max && e.group.position.distanceTo(e.home) < 0.001,
      });
    }
    const e = g.enemies.find((e) => !e.boss),
      home = e.home.clone();
    Object.assign(g.hero, { x: home.x + 8, z: home.z });
    g.placeActor();
    for (let i = 0; i < 60; i++) g.updateEnemy(e, 1 / 30);
    const chased = e.group.position.distanceTo(home) > 1;
    Object.assign(g.hero, { x: 0, z: 320 });
    g.placeActor();
    for (let i = 0; i < 300; i++) g.updateEnemy(e, 1 / 30);
    return {
      results,
      chased,
      returned: e.group.position.distanceTo(home) <= 1.1,
    };
  });
  for (const r of report.combat.results)
    for (const key of ['hit', 'dead', 'reward', 'saved', 'respawn'])
      assert.ok(r[key], `${r.variant} ${key}`);
  assert.ok(report.combat.chased && report.combat.returned);
  assert.deepEqual(errors, []);
  report.errors = errors;
  console.log(JSON.stringify(report));
} finally {
  await writeFile(`${out}/hunting.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
