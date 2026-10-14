import { chromium } from "../output/whispering-tools/node_modules/playwright/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const output = "work/meteorfall-citadel/revision3/qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const ready = () =>
  page.waitForFunction(
    () =>
      window.__meteorfallQA?.game?.started &&
      !window.__meteorfallQA.game.transitioning &&
      window.__meteorfallQA.game.meteorfall,
    null,
    { timeout: 120000 },
  );
try {
  await page.goto("http://127.0.0.1:3006/meteorfall-citadel.html");
  await page
    .getByRole("button", { name: "CONTINUE", exact: true })
    .click({ timeout: 120000 });
  await ready();
  await page.evaluate(() => {
    const g = window.__meteorfallQA.game,
      e = g.enemies.find((e) => e.id === 0);
    g.invincible = Infinity;
    Object.assign(g.hero, {
      x: e.group.position.x,
      z: e.group.position.z + 0.5,
    });
    g.placeActor();
  });
  await page.waitForTimeout(400);
  const combat = await page.evaluate(() => {
    const { game: g, layout: l } = window.__meteorfallQA;
    g.invincible = Infinity;
    g.paused = false;
    const normal = g.enemies.find((e) => e.id === 0),
      boss = g.enemies.find((e) => e.id === 100);
    Object.assign(g.hero, {
      x: normal.group.position.x,
      z: normal.group.position.z + 0.5,
    });
    g.placeActor();
    g.setCurrentTarget(normal);
    const hp = normal.hp;
    for (let i = 0; i < 16 && normal.hp === hp; i++) {
      g.attackTimer = 0;
      g.attack(true);
    }
    const basicHit = normal.hp < hp;
    const beforeProgress = g.hero.fieldProgress[l.METEORFALL_ID] ?? 0;
    g.hurtEnemy(normal, normal.max * 20, 2000);
    const normalSafe = g.meteorfall.navigation.valid(
      normal.group.position,
      0.55,
    );
    Object.assign(g.hero, { x: 0, z: -348.5 });
    g.placeActor();
    g.hurtEnemy(boss, 100, 2000);
    const bossSafe = g.meteorfall.navigation.valid(boss.group.position, 1.8);
    g.hurtEnemy(boss, boss.max * 20, 0);
    const deadlines = Object.fromEntries(
      Object.entries(g.hero.monsterRespawnState).filter(
        ([key]) =>
          key === "meteorfall-citadel-0:spawn:0" ||
          key === "meteorfall-citadel-5:spawn:100",
      ),
    );
    const history = g.hero.defeatedFieldBosses.includes(l.METEORFALL_ID),
      progress = (g.hero.fieldProgress[l.METEORFALL_ID] ?? 0) > beforeProgress;
    // Invalid current coordinates recover to an actual last-safe surface without HP loss.
    const health = g.hero.hp;
    g.hero.lastSafePosition = { x: 0, z: 380 };
    Object.assign(g.hero, { x: 490, z: -490 });
    g.placeActor();
    return {
      basicHit,
      normalSafe,
      bossSafe,
      deadlines,
      history,
      progress,
      invalidPositionRecovery:
        g.hero.x === 0 && g.hero.z === 380 && g.hero.hp === health,
    };
  });
  console.log(JSON.stringify(combat));
  for (const key of [
    "basicHit",
    "normalSafe",
    "bossSafe",
    "history",
    "progress",
    "invalidPositionRecovery",
  ])
    assert(combat[key], key);
  assert.equal(Object.keys(combat.deadlines).length, 2);
  assert(Object.values(combat.deadlines).every((v) => v > Date.now()));
  await page.evaluate(() =>
    window.__meteorfallQA.game.changeRegion("jayantara"),
  );
  await page.waitForFunction(() => !window.__meteorfallQA.game.transitioning);
  await page.evaluate(() =>
    window.__meteorfallQA.game.changeRegion("meteorfall-citadel"),
  );
  await ready();
  const restored = await page.evaluate(() => {
    const g = window.__meteorfallQA.game;
    return {
      normalHP: g.enemies.find((e) => e.id === 0).hp,
      bossHP: g.enemies.find((e) => e.id === 100).hp,
      timers: g.hero.monsterRespawnState,
    };
  });
  assert.equal(restored.normalHP, 0);
  assert.equal(restored.bossHP, 0);
  for (const [key, value] of Object.entries(combat.deadlines))
    assert.equal(restored.timers[key], value);
  const movement = await page.evaluate(() => {
    const { game: g, three: T } = window.__meteorfallQA;
    const reset = () => {
      Object.assign(g.hero, { x: 138, z: 355 });
      g.placeActor();
    };
    reset();
    // Invoke the existing simulation executor; this does not unlock or rebalance a skill.
    g.startThiefMovement(
      new T.Vector3(1, 0, 0),
      12,
      () => true,
      () => {},
    );
    g.updateThiefMovement(1);
    const dash = {
      x: g.hero.x,
      z: g.hero.z,
      valid: g.meteorfall.navigation.valid(g.hero),
    };
    reset();
    const random = g.rand;
    g.rand = () => 0.999;
    g.invincible = 0;
    g.hurtHero(1, undefined, { x: 2000, z: 0 });
    g.rand = random;
    g.invincible = Infinity;
    const knockback = {
      x: g.hero.x,
      z: g.hero.z,
      valid: g.meteorfall.navigation.valid(g.hero),
    };
    return { dash, knockback };
  });
  for (const result of Object.values(movement))
    assert(
      result.valid && result.x > 138 && result.x < 140,
      "player movement stops at the void boundary",
    );
  // Explicit low-orbit inspection, using existing camera limits, and a separate asset preview.
  await page.evaluate(() => {
    const g = window.__meteorfallQA.game;
    g.invincible = Infinity;
    Object.assign(g.hero, { x: 0, z: -180 });
    g.placeActor();
    g.cameraFocus.copy(g.actor.position);
    g.followView.yaw = g.followView.targetYaw = 0;
    g.followView.pitch = g.followView.targetPitch = 0.08;
    g.followView.distance = g.followView.targetDistance = 28;
    g.updateCamera(0);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${output}/citadel-approach.png` });
  const preview = await page.evaluate(() => {
    const { game: g, three: T } = window.__meteorfallQA;
    cancelAnimationFrame(g.frame);
    g.frame = 0;
    const scene = new T.Scene();
    scene.background = new T.Color("#353039");
    const mesh = g.meteorfall.root.getObjectByName("Meteor monolith facets");
    const clone = new T.Mesh(mesh.geometry, mesh.material);
    scene.add(clone);
    const box = new T.Box3().setFromObject(clone),
      center = box.getCenter(new T.Vector3());
    const camera = new T.PerspectiveCamera(40, 1440 / 900, 0.1, 1000);
    camera.position.copy(center).add(new T.Vector3(70, 35, 115));
    camera.lookAt(center);
    scene.add(new T.HemisphereLight("#eee9e2", "#51424c", 3));
    const sun = new T.DirectionalLight("#fff0dc", 3);
    sun.position.copy(center).add(new T.Vector3(-30, 60, 60));
    sun.target.position.copy(center);
    scene.add(sun, sun.target);
    g.renderer.render(scene, camera);
    return g.renderer.domElement.toDataURL("image/png");
  });
  await writeFile(
    `${output}/meteor-cleaned-preview.png`,
    Buffer.from(preview.split(",")[1], "base64"),
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  await writeFile(
    `${output}/combat-report.json`,
    JSON.stringify({ combat, restored, movement, errors }, null, 2),
  );
  console.log(
    "PASS Basic attack, player dash executor, player/normal/boss knockback, kill progression, respawn identities, invalid-position recovery and map round trip",
  );
} finally {
  await browser.close();
}
