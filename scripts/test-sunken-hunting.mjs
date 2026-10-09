import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = 'output/sunken-ruins/revision7';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
async function ready() {
  await page.waitForFunction(
    () =>
      window.__sunkenQA?.game?.sunken && !window.__sunkenQA.game.transitioning,
    null,
    { timeout: 120000 },
  );
  await page.evaluate(() => window.__sunkenQA.game.characterModel.ready);
}
try {
  await page.goto('http://127.0.0.1:3002/sunken-ruins.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  const population = await page.evaluate(() => {
    const { game: g, sunkenLayout: l } = window.__sunkenQA;
    cancelAnimationFrame(g.frame);
    g.frame = 0;
    return {
      count: g.enemies.length,
      species: g.enemies.reduce((a, e) => {
        const key = e.definition.name + ' Lv' + e.definition.level;
        a[key] = (a[key] ?? 0) + 1;
        return a;
      }, {}),
      valid: g.enemies.every(
        (e) => l.sunkenWalkable(e.home, 3) && !l.sunkenSafe(e.home, 24),
      ),
      boss: g.enemies.find((e) => e.boss).definition.name,
    };
  });
  assert.equal(population.count, 324);
  assert.ok(population.valid);
  for (const shot of ['warrior', 'elite', 'boss', 'deep-slope']) {
    const png = await page.evaluate((shot) => {
      const { game: g, three: T, sunkenLayout: l } = window.__sunkenQA;
      const enemy = g.enemies.find((e) =>
        shot === 'boss'
          ? e.boss
          : shot === 'elite'
            ? e.definition.variant === 'elite'
            : e.definition.id === 'sunken-ruins-0',
      );
      let target = { x: enemy.home.x, z: enemy.home.z };
      if (shot === 'deep-slope') {
        target = { x: -100, z: 470 };
        while (l.sunkenFloorDistance(target) > 0) target.z -= 0.25;
      }
      Object.assign(
        g.hero,
        g.sunken.navigation.restore({ x: target.x + 8, z: target.z - 8 }),
      );
      g.placeActor();
      g.setGraphicsQuality('high', false);
      g.sunken.update(g.camera, target, 0);
      for (const e of g.enemies) g.updateEnemy(e, 0);
      const ground = l.sunkenGroundHeight(target.x, target.z);
      const camera = new T.PerspectiveCamera(52, 1440 / 900, 0.1, 2000);
      camera.position.set(
        target.x + 14,
        ground + (shot === 'boss' ? 12 : 7),
        target.z + 20,
      );
      if (shot === 'deep-slope')
        camera.position.set(target.x, ground + 32, target.z - 24);
      camera.lookAt(
        target.x,
        ground + (shot === 'deep-slope' ? -12 : shot === 'boss' ? 4 : 1),
        target.z + (shot === 'deep-slope' ? 35 : 0),
      );
      g.renderer.render(g.scene, camera);
      return g.renderer.domElement.toDataURL('image/png');
    }, shot);
    await writeFile(
      `${out}/${shot}.png`,
      Buffer.from(png.split(',')[1], 'base64'),
    );
  }
  const rewards = await page.evaluate(() => {
    const { game: g, rules: R } = window.__sunkenQA;
    const oldRand = g.rand;
    g.rand = () => 0.01;
    const results = [];
    for (const variant of ['normal', 'elite', 'boss']) {
      const e = g.enemies.find((e) => e.definition.variant === variant);
      Object.assign(
        g.hero,
        g.sunken.navigation.restore({ x: e.home.x + 8, z: e.home.z }),
      );
      g.placeActor();
      const before = {
        xp: g.hero.xp,
        level: g.hero.level,
        kills: g.hero.kills,
        gold: g.groundGold.length,
        loot: g.groundLoot.length,
      };
      g.updateEnemy(e, 0);
      g.setCurrentTarget(e);
      const targeted = g.currentTarget?.instanceId === e.group.uuid;
      g.hurtEnemy(e, 1e8, 0);
      results.push({
        variant,
        id: e.id,
        key: e.respawnKey,
        targeted,
        dead: e.hp === 0,
        xp: g.hero.xp !== before.xp || g.hero.level > before.level,
        kills: g.hero.kills === before.kills + 1,
        gold: g.groundGold.length > before.gold,
        loot: g.groundLoot.length > before.loot,
        deadline: g.hero.monsterRespawnState[e.respawnKey],
        duration: e.respawn,
      });
    }
    g.rand = oldRand;
    const saved = R.parseSave(JSON.stringify(g.hero));
    return {
      results,
      restored: results.every(
        (r) => saved.monsterRespawnState[r.key] === r.deadline,
      ),
      bossRecorded: g.hero.defeatedFieldBosses.includes(g.hero.currentField),
    };
  });
  for (const r of rewards.results)
    for (const key of ['targeted', 'dead', 'xp', 'kills', 'gold', 'loot'])
      assert.ok(r[key], `${r.variant} ${key}`);
  assert.ok(rewards.restored && rewards.bossRecorded);
  // Reload replay uses Storage.key because MemoryStorage intentionally has no enumerable save keys.
  await page.evaluate(() => {
    window.name =
      'sunken-review:' +
      JSON.stringify(
        Array.from({ length: localStorage.length }, (_, i) => {
          const k = localStorage.key(i);
          return [k, localStorage.getItem(k)];
        }),
      );
  });
  await page.goto('http://127.0.0.1:3002/sunken-ruins.html?replay=1');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  const respawn = await page.evaluate(
    (ids) => {
      const { game: g, sunkenLayout: l } = window.__sunkenQA;
      cancelAnimationFrame(g.frame);
      g.frame = 0;
      return ids.map((id) => {
        const e = g.enemies.find((e) => e.id === id);
        const hidden = e.hp === 0 && e.respawnDeadline > Date.now();
        e.respawnDeadline = Date.now() - 1;
        g.updateEnemy(e, 1 / 60);
        return {
          id,
          hidden,
          alive: e.hp === e.max,
          home: e.group.position.distanceTo(e.home) < 0.001,
          valid: l.sunkenWalkable(e.group.position),
          cleared: !g.hero.monsterRespawnState[e.respawnKey],
        };
      });
    },
    rewards.results.map((r) => r.id),
  );
  assert.ok(
    respawn.every((r) => r.hidden && r.alive && r.home && r.valid && r.cleared),
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/hunting.json`,
    JSON.stringify({ population, rewards, respawn, errors }, null, 2),
  );
  console.log(JSON.stringify({ population, rewards, respawn, errors }));
} finally {
  await browser.close();
}
