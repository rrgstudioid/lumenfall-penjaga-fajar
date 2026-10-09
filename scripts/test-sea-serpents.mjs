import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  GUARDIAN_ATTACKS,
  BOSS_ATTACKS,
} from '../lib/game/sea-serpent-combat.ts';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = 'output/sunken-ruins/revision13';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true }),
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  report = {};
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  await page.goto(
    'http://127.0.0.1:3002/sunken-ruins.html?map=abysal-trench-underwater-v1&level=60',
  );
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__sunkenQA?.game?.sunken &&
      !window.__sunkenQA.game.transitioning &&
      !window.__sunkenQA.game.regionLoadError,
    null,
    { timeout: 120000 },
  );
  await page.evaluate(() => window.__sunkenQA.game.characterModel.ready);
  await page.waitForTimeout(400);
  report.population = await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    cancelAnimationFrame(g.frame);
    return {
      count: g.enemies.length,
      visible: g.enemies.filter((e) => e.group.visible).length,
      ready: g.enemies.filter((e) => e.group.children[0].userData.serpentVisual)
        .length,
    };
  });
  assert.equal(report.population.count, 201);
  assert.equal(report.population.ready, 201);
  report.poseEnvelopes = await page.evaluate(
    ({ guardian, boss }) => {
      const { game: g, three: T } = window.__sunkenQA;
      return [guardian, boss].flatMap((attacks, index) => {
        const e = g.enemies.find((e) => e.boss === !!index),
          body = e.group.children[0],
          visual = body.userData.serpentVisual;
        return attacks.map((a) => {
          visual.update(0.2, a.id, 0, 0);
          let minY = Infinity,
            maxY = -Infinity;
          const frames = Math.ceil((a.windup + a.recovery) * 30);
          for (let i = 0; i <= frames; i++) {
            visual.update(0, a.id, i / 30, 0);
            body.updateMatrixWorld(true);
            body.traverse((o) => {
              if (o instanceof T.SkinnedMesh && o.visible) {
                o.computeBoundingBox();
                minY = Math.min(minY, o.boundingBox.min.y);
                maxY = Math.max(maxY, o.boundingBox.max.y);
              }
            });
          }
          return { id: a.id, minY, maxY, pickMaxY: e.pickBounds.max.y };
        });
      });
    },
    { guardian: GUARDIAN_ATTACKS, boss: BOSS_ATTACKS },
  );
  for (const pose of report.poseEnvelopes) {
    assert.ok(
      pose.minY >= 0 && Number.isFinite(pose.maxY),
      `${pose.id} intersects seabed`,
    );
    assert.ok(pose.pickMaxY >= pose.maxY, `${pose.id} escapes pick bounds`);
  }
  for (const boss of [false, true]) {
    const result = await page.evaluate((boss) => {
      const { game: g, three: T } = window.__sunkenQA,
        e = g.enemies.find((e) => e.boss === boss),
        body = e.group.children[0];
      if (!boss) e.home.set(-390, g.groundHeight(-390, 260), 260);
      e.group.position.copy(e.home);
      e.group.rotation.y = 0;
      Object.assign(g.hero, { x: e.home.x + 10, z: e.home.z + 12 });
      g.placeActor();
      g.invincible = 999;
      for (const a of g.enemies) a.group.visible = a === e;
      g.setGraphicsQuality('high', false);
      body.userData.serpentVisual.update(0, 'idle');
      const p = e.group.position,
        c = new T.PerspectiveCamera(45, 1440 / 900, 0.1, 1800);
      g.worldLightRig.traverse((o) => {
        if (o instanceof T.DirectionalLight) {
          o.position.set(
            g.actor.position.x - 25,
            g.actor.position.y + 60,
            g.actor.position.z + 20,
          );
          o.target.position.copy(g.actor.position);
          o.target.updateMatrixWorld();
        }
      });
      c.position.set(
        p.x + (boss ? 43 : 15),
        p.y + (boss ? 20 : 7),
        p.z - (boss ? 36 : 16),
      );
      c.lookAt(p.x, p.y + (boss ? 5 : 2), p.z);
      g.sunken.update(c, g.hero, 0);
      g.renderer.render(g.scene, c);
      const originalCamera = g.camera;
      g.camera = c;
      g.pointer.set(0, 0);
      const picked = g.pickEnemy()?.id === e.id;
      g.camera = originalCamera;
      const boxes = [];
      body.traverse((o) => {
        if (o instanceof T.SkinnedMesh && o.visible) {
          o.computeBoundingBox();
          boxes.push({
            name: o.name,
            vertices: o.geometry.attributes.position.count,
            bones: o.skeleton.bones.length,
            box: [
              ...o.boundingBox.min.toArray(),
              ...o.boundingBox.max.toArray(),
            ],
          });
        }
      });
      return { image: g.renderer.domElement.toDataURL(), boxes, picked };
    }, boss);
    await writeFile(
      `${out}/${boss ? 'boss' : 'guardian'}-runtime.png`,
      Buffer.from(result.image.split(',')[1], 'base64'),
    );
    delete result.image;
    report[boss ? 'bossModel' : 'guardianModel'] = result;
    assert.equal(result.boxes.length, 1);
    assert.ok(result.picked, 'Visible serpent can be picked');
    assert.equal(result.boxes[0].bones, 18);
    assert.ok(result.boxes[0].box.every(Number.isFinite));
  }
  report.attacks = [];
  for (const [boss, attacks] of [
    [false, GUARDIAN_ATTACKS],
    [true, BOSS_ATTACKS],
  ])
    for (let index = 0; index < attacks.length; index++) {
      const result = await page.evaluate(
        ({ boss, index, attack }) => {
          const { game: g, three: T } = window.__sunkenQA,
            e = g.enemies.find((e) => e.boss === boss),
            body = e.group.children[0],
            shape = body.userData.combatShape;
          g.clearSerpentAttack(e);
          e.group.position.copy(e.home);
          e.group.rotation.y = 0;
          e.windup = e.cooldown = e.stun = e.root = e.poison = 0;
          e.hp = e.max;
          e.navigation = undefined;
          e.serpentAttackIndex = index;
          Object.assign(g.hero, {
            x: e.home.x,
            z: e.home.z - (shape.halfLength + shape.radius + 1),
            hp: 100000,
            barrier: 0,
          });
          g.placeActor();
          g.invincible = 0;
          g.dead = false;
          g.rand = () => 0.99;
          const step = () => {
            g.elapsed += 1 / 60;
            g.combatTime += 1 / 60;
            g.invincible = Math.max(0, g.invincible - 1 / 60);
            g.updateEnemy(e, 1 / 60);
          };
          step();
          if (!e.serpentStrike)
            throw Error(`No strike ${attack.id} distance ${g.enemyRange(e)}`);
          const tell = !!e.serpentTell && e.serpentTell.visible;
          while (e.serpentStrike.elapsed < attack.windup - 0.04) step();
          const hpBeforeImpact = g.hero.hp;
          const bones = [];
          body.traverse((o) => {
            if (o instanceof T.Bone) bones.push([...o.quaternion.toArray()]);
          });
          const p = e.group.position,
            c = new T.PerspectiveCamera(45, 1440 / 900, 0.1, 1800);
          c.position.set(
            p.x + (boss ? 48 : 18),
            p.y + (boss ? 25 : 9),
            p.z - (boss ? 35 : 18),
          );
          c.lookAt(p.x, p.y + (boss ? 6 : 2), p.z);
          g.worldLightRig.traverse((o) => {
            if (o instanceof T.DirectionalLight) {
              o.position.set(
                g.actor.position.x - 25,
                g.actor.position.y + 60,
                g.actor.position.z + 20,
              );
              o.target.position.copy(g.actor.position);
              o.target.updateMatrixWorld();
            }
          });
          for (const a of g.enemies) a.group.visible = a === e;
          g.sunken.update(c, g.hero, 0);
          g.renderer.render(g.scene, c);
          const image = g.renderer.domElement.toDataURL();
          for (let i = 0; i < 8; i++) step();
          const damage = 100000 - g.hero.hp;
          for (let i = 0; i < 30; i++) step();
          const doubleHit = 100000 - g.hero.hp !== damage;
          // Replay the same attack, then leave its locked tell before impact.
          g.clearSerpentAttack(e);
          e.windup = e.cooldown = 0;
          e.serpentAttackIndex = index;
          g.hero.hp = 100000;
          g.invincible = 0;
          step();
          Object.assign(g.hero, { x: 0, z: 320 });
          g.placeActor();
          for (let i = 0; i < Math.ceil((attack.windup + 0.1) * 60); i++)
            step();
          const safeDamage = 100000 - g.hero.hp;
          g.clearSerpentAttack(e);
          e.windup = 0;
          return {
            id: attack.id,
            tell,
            hpBeforeImpact,
            damage,
            doubleHit,
            safeDamage,
            clip: body.userData.activeSerpentAnimation,
            bones,
            image,
          };
        },
        { boss, index, attack: attacks[index] },
      );
      await writeFile(
        `${out}/${result.id}-windup.png`,
        Buffer.from(result.image.split(',')[1], 'base64'),
      );
      delete result.image;
      report.attacks.push(result);
      assert.ok(result.tell);
      assert.equal(result.hpBeforeImpact, 100000);
      assert.ok(result.damage > 0, `${result.id} missed`);
      assert.equal(result.doubleHit, false);
      assert.equal(result.safeDamage, 0);
      assert.equal(result.clip, result.id);
    }
  report.death = await page.evaluate(() => {
    const { game: g, rules: R } = window.__sunkenQA,
      e = g.enemies.find((e) => e.boss);
    g.clearSerpentAttack(e);
    e.hp = e.max;
    g.hurtEnemy(e, 1e9, 0);
    const deadline = e.respawnDeadline,
      key = e.respawnKey,
      saved = R.parseSave(JSON.stringify(g.hero)).monsterRespawnState[key];
    g.dead = true;
    g.respawn();
    const stayedDead = e.hp === 0;
    e.respawnDeadline = Date.now() - 1;
    g.updateEnemy(e, 0.02);
    return { deadline, saved, stayedDead, respawned: e.hp === e.max };
  });
  assert.equal(report.death.deadline, report.death.saved);
  assert.ok(report.death.stayedDead && report.death.respawned);
  const map = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 768;
    window.__sunkenQA.game.sunken.drawMinimap(c.getContext('2d'), 768);
    return c.toDataURL();
  });
  await writeFile(
    `${out}/minimap.png`,
    Buffer.from(map.split(',')[1], 'base64'),
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      population: report.population,
      attacks: report.attacks.length,
      errors,
    }),
  );
} finally {
  await writeFile(
    `${out}/browser.json`,
    JSON.stringify({ ...report, errors }, null, 2),
  );
  await browser.close();
}
