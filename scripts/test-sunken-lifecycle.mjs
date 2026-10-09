import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const browser = await chromium.launch({ channel: 'chrome', headless: true }),
  errors = [],
  report = { genders: [], portals: [], resources: [] };
await mkdir('output/sunken-ruins', { recursive: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(e.message));
async function ready() {
  await page.waitForFunction(
    () =>
      window.__sunkenQA?.game?.started &&
      !window.__sunkenQA.game.transitioning &&
      !window.__sunkenQA.game.regionLoadError,
    null,
    { timeout: 120000 },
  );
  await page.evaluate(() => window.__sunkenQA.game.characterModel.ready);
  await page.waitForTimeout(400);
}
async function enter(url = '') {
  await page.goto(`http://127.0.0.1:3002/sunken-ruins.html${url}`);
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
}
async function region(id) {
  await page.evaluate((id) => window.__sunkenQA.game.changeRegion(id), id);
  await ready();
}
try {
  await enter('?level=31&map=sunken-ruins');
  await page.keyboard.press('m');
  const card = page.locator('.region-card').filter({
    has: page.getByRole('heading', { name: 'Sunken Ruins', exact: true }),
  });
  assert.equal(await card.getByRole('button').isDisabled(), true);
  report.level31Locked = true;
  await enter();
  await page.keyboard.press('m');
  assert.equal(await card.getByRole('button').isEnabled(), true);
  report.level32Open = true;
  await page.screenshot({ path: 'output/sunken-ruins/world-map-access.png' });
  await page.keyboard.press('m');
  for (const [name, x, z, destination, spawn] of [
    ['Kembali ke Kota Jayantara', 45, 350, 'jayantara', [0, 8]],
    ['Warp ke Kota Jayantara', -350, 200, 'jayantara', [0, 8]],
    ['Warp to Whispering Wilds', 340, -325, 'whispering-wilds-v2', [90, 410]],
  ]) {
    await page.evaluate(
      ({ x, z }) => {
        const g = window.__sunkenQA.game;
        const gate = g.sunken.root.children.find(
          (o) =>
            o.userData.destination && o.position.x === x && o.position.z === z,
        );
        const yaw = gate.rotation.y;
        Object.assign(g.hero, {
          x: x + Math.sin(yaw) * 3,
          z: z + Math.cos(yaw) * 3,
        });
        g.placeActor();
        g.cameraFocus.copy(g.actor.position);
        g.invincible = 0;
      },
      { x, z },
    );
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `output/sunken-ruins/portal-${String(destination)}-${String(x)}.png`,
    });
    await page
      .locator('button.npc-service-badge')
      .filter({ hasText: name })
      .click();
    await ready();
    const state = await page.evaluate(() => {
      const g = window.__sunkenQA.game;
      return {
        id: g.activeLocationId,
        x: g.hero.x,
        z: g.hero.z,
        mode: g.actor.userData.movementMode,
        sunken: g.sunken !== null,
        fog: g.scene.fog?.color.getHexString(),
      };
    });
    assert.equal(state.id, destination);
    assert.deepEqual([state.x, state.z], spawn);
    assert.equal(state.mode, 'ground');
    assert.equal(state.sunken, false);
    report.portals.push(state);
    await page.keyboard.down('w');
    await page.waitForTimeout(500);
    const restored = await page.evaluate(() => {
      const g = window.__sunkenQA.game;
      return {
        pitch: g.characterModel.rig.root.rotation.x,
        swim: g.characterModel.animator.snapshot().swim,
        native: g.actor.userData.activeNativeAnimation,
      };
    });
    await page.keyboard.up('w');
    assert.equal(restored.pitch, 0);
    assert.equal(restored.swim, 0);
    assert.match(restored.native, /Run|Walk/);
    state.groundRecovery = restored;
    await region('sunken-ruins-underwater-v1');
    await page.waitForTimeout(600);
    const memory = await page.evaluate(() => {
      const g = window.__sunkenQA.game;
      return {
        enemies: g.enemies.length,
        labels: g.portalLabels.length,
        ...g.renderer.info.memory,
      };
    });
    assert.equal(memory.enemies, 324);
    assert.equal(memory.labels, 4);
    report.resources.push(memory);
  }
  assert.ok(
    report.resources.at(-1).geometries <= report.resources[0].geometries + 2,
    'bounded repeated visits',
  );
  // A failed request must keep input locked; Retry rebuilds one clean map.
  await region('jayantara');
  await page.route('**/__sunken-dev/kit.glb', (route) => route.abort());
  await page.evaluate(() =>
    window.__sunkenQA.game.changeRegion('sunken-ruins-underwater-v1'),
  );
  await page.waitForFunction(() => !!window.__sunkenQA.game.regionLoadError);
  await page.screenshot({ path: 'output/sunken-ruins/loading-retry.png' });
  const locked = await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    const before = g.actor.position.clone();
    g.move(5, 0);
    return before.equals(g.actor.position);
  });
  assert.ok(locked);
  await page.unroute('**/__sunken-dev/kit.glb');
  await page.evaluate(() => window.__sunkenQA.game.retryLocationLoad());
  await ready();
  report.retry = true;
  await enter('?replay=1');
  await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    Object.assign(g.hero, { x: 45, z: -370 });
    g.placeActor();
    g.save();
    const entries = Array.from({ length: localStorage.length }, (_, i) => {
      const key = localStorage.key(i);
      return [key, localStorage.getItem(key)];
    });
    window.name = 'sunken-review:' + JSON.stringify(entries);
  });
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  const reload = await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    return [g.hero.x, g.hero.z, g.actor.userData.movementMode];
  });
  assert.deepEqual(reload, [45, -370, 'underwater']);
  report.reload = reload;
  await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    g.hero.hp = 0;
    g.dead = true;
    g.respawn();
  });
  await page.waitForTimeout(350);
  const respawn = await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    return {
      position: [g.hero.x, g.hero.z],
      mode: g.actor.userData.movementMode,
      swim: g.characterModel.animator.snapshot().swim,
      enemies: g.enemies.length,
      dead: g.dead,
    };
  });
  assert.deepEqual(respawn, {
    position: [45, 225],
    mode: 'underwater',
    swim: 1,
    enemies: 324,
    dead: false,
  });
  report.respawn = respawn;
  // Inspect camera orbits through the cleared former statue location.
  report.camera = await page.evaluate(() => {
    const { game: g, three: T } = window.__sunkenQA;
    cancelAnimationFrame(g.frame);
    g.frame = 0;
    Object.assign(g.hero, { x: 101, z: -109 });
    g.placeActor();
    g.cameraFocus.copy(g.actor.position);
    g.invincible = 0;
    const rows = [],
      ray = new T.Raycaster();
    let time = performance.now();
    g.lastTime = time;
    for (const mode of ['follow', 'free'])
      for (let angle = 0; angle < 16; angle++) {
        g.setCameraMode(mode);
        const yaw = (angle * Math.PI) / 8;
        Object.assign(g.followView, {
          yaw,
          targetYaw: yaw,
          pitch: 0.38,
          targetPitch: 0.38,
          distance: 22,
          targetDistance: 22,
        });
        g.yaw = yaw;
        g.cameraZoom.yaw = yaw;
        for (let i = 0; i < 3; i++) {
          time += 1000 / 60;
          g.tick(time);
          cancelAnimationFrame(g.frame);
          g.frame = 0;
        }
        const target = g.cameraOrbitTarget.clone(),
          distance = g.camera.position.distanceTo(target);
        ray.set(g.camera.position, target.sub(g.camera.position).normalize());
        ray.far = distance - 0.1;
        const solids = [];
        g.sunken.root.traverse((o) => {
          if (o instanceof T.InstancedMesh && o.name.endsWith(':stone'))
            solids.push(o);
        });
        const blocked = ray
          .intersectObjects(solids, false)
          .filter((hit) => hit.object.visible && hit.object.parent.visible);
        rows.push({
          mode,
          angle,
          distance,
          blocked: blocked.map((h) => h.object.name),
        });
      }
    g.lastTime = 0;
    g.frame = requestAnimationFrame(g.tick);
    return rows;
  });
  assert.ok(
    report.camera.every((r) => r.blocked.length === 0),
    'render geometry does not cover the orbit target',
  );
  for (const gender of ['male', 'female']) {
    await enter(`?gender=${gender}`);
    const equipment = await page.evaluate(async () => {
      const { game: g, rules: R } = window.__sunkenQA;
      g.hero.equipment = R.emptyEquipment();
      const promoted = R.chooseV3Thief(g.hero),
        equipped = [];
      for (const slot of ['mainHand', 'offHand']) {
        const item = R.createItem('anom-dagger');
        g.hero.inventory.push(item);
        equipped.push(R.equipItem(g.hero, item.id, slot));
      }
      g.rebuildHeroAppearance();
      await g.characterModel.ready;
      return { promoted, equipped };
    });
    assert.ok(
      equipment.promoted && equipment.equipped.every((result) => result.ok),
      JSON.stringify(equipment),
    );
    const states = await page.evaluate(async () => {
      const { game: g, three: T } = window.__sunkenQA;
      cancelAnimationFrame(g.frame);
      g.frame = 0;
      g.invincible = 0;
      g.actor.visible = true;
      const states = [
        ['idle', {}],
        ['forward', { moving: true }],
        ['backward', { moving: true, localForward: -1 }],
        ['side', { moving: true, localRight: 1 }],
        ['turn', { turn: 1 }],
        ['attack', {}, 'basic_attack'],
        ['cast', {}, 'magic_cast'],
        ['dodge', {}, 'dash'],
        ['parry', { blocking: true }],
        ['hit', {}, 'hit'],
        ['death', { dead: true }],
      ];
      const result = [];
      for (const [name, motion, action] of states) {
        g.characterModel.animator.reset();
        g.characterModel.animator.update(0.2, { movementMode: 'underwater' });
        if (action) g.characterModel.animator.play(action, 0.6);
        for (let i = 0; i < 20; i++)
          g.characterModel.animator.update(1 / 60, {
            ...motion,
            movementMode: 'underwater',
          });
        g.actor.updateMatrixWorld(true);
        let finite = true,
          minY = Infinity,
          maxDistance = 0;
        g.actor.traverse((o) => {
          if (o instanceof T.SkinnedMesh) {
            o.skeleton.update();
            const p = new T.Vector3();
            for (let i = 0; i < o.geometry.attributes.position.count; i += 19) {
              o.getVertexPosition(i, p);
              p.applyMatrix4(o.matrixWorld);
              finite &&= p.toArray().every(Number.isFinite);
              minY = Math.min(minY, p.y - g.actor.position.y);
              maxDistance = Math.max(
                maxDistance,
                p.distanceTo(g.actor.position),
              );
            }
          }
        });
        const gripDistances = ['mainHand', 'offHand'].map((slot) => {
          const grip = g.actor
            .getObjectByName(`equipment:${slot}`)
            ?.getObjectByName('DaggerGrip');
          const hand =
            slot === 'mainHand'
              ? g.characterModel.rig.rightHand
              : g.characterModel.rig.leftHand;
          return (
            grip
              ?.getWorldPosition(new T.Vector3())
              .distanceTo(hand.getWorldPosition(new T.Vector3())) ?? Infinity
          );
        });
        result.push({
          name,
          finite,
          minY,
          maxDistance,
          gripDistances,
          native: g.actor.userData.activeNativeAnimation ?? '',
          rootPitch: g.characterModel.rig.root.rotation.x,
        });
      }
      g.characterModel.animator.reset();
      g.characterModel.animator.update(0.3, {
        movementMode: 'underwater',
        moving: true,
      });
      g.lastTime = 0;
      g.frame = requestAnimationFrame(g.tick);
      g.rebuildHeroAppearance();
      await g.characterModel.ready;
      return { model: g.actor.userData.assetKind, states: result };
    });
    for (const s of states.states) {
      assert.ok(s.finite && s.maxDistance < 6, `${gender} ${s.name} finite`);
      assert.ok(s.minY > -0.1, `${gender} ${s.name} above seabed: ${s.minY}`);
      assert.ok(s.gripDistances.every((d) => d < 1e-5));
      assert.equal(s.native, '');
    }
    report.genders.push({ gender, equipment, ...states });
    for (const camera of ['follow', 'free']) {
      await page.evaluate((camera) => {
        const g = window.__sunkenQA.game;
        g.setCameraMode(camera);
        g.keys.add('w');
      }, camera);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `output/sunken-ruins/${gender}-${camera}.png`,
      });
      await page.keyboard.up('w');
      await page.evaluate(() => window.__sunkenQA.game.keys.clear());
    }
  }
  assert.deepEqual(errors, []);
  report.errors = errors;
  console.log(JSON.stringify(report));
} finally {
  await writeFile(
    'output/sunken-ruins/lifecycle.json',
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
