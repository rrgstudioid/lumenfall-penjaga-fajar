// Real M-menu access and runtime QA in an isolated profile; never reads owner saves.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createV3AdventurerHero, SAVE_KEY } from '../lib/game/rules.ts';
import {
  IRONVEIL_ID,
  IRONVEIL_PATHS,
  IRONVEIL_POCKETS,
  IRONVEIL_ENTRY,
  ironveilProps,
  ironveilGroundHeight,
} from '../lib/game/ironveil-mines-layout.ts';
const { chromium } = await import(
  pathToFileURL(
    'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = process.env.IRONVEIL_QA_SKY ? 'output/ironveil/scorching-sky-qa' : 'output/ironveil/qa';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  }),
  page = await context.newPage();
const errors = [],
  expectedLoadErrors = [],
  failedRequests = [],
  checks = [],
  performance = [],
  memory = [];
let injectingFailure = false;
page.on('pageerror', (e) =>
  (injectingFailure ? expectedLoadErrors : errors).push(e.message),
);
page.on('console', (m) => {
  if (m.type() === 'error')
    (injectingFailure ? expectedLoadErrors : errors).push(m.text());
});
page.on('requestfailed', (r) =>
  failedRequests.push({
    url: r.url(),
    error: r.failure()?.errorText,
    expected: injectingFailure,
  }),
);
const check = (name, value = true) => {
  assert(value, name);
  checks.push(name);
  console.log('PASS', name);
};
await page.route(/\/lib\/game\/world\.ts/, async (route) => {
  const response = await route.fetch();
  await route.fulfill({
    response,
    body: (await response.text()).replace(
      'this.renderer = new T.WebGLRenderer',
      'window.__ironveilQA = this; window.__ironveilThree = T; this.renderer = new T.WebGLRenderer',
    ),
  });
});
const hero = createV3AdventurerHero('slot-1');
Object.assign(hero, {
  characterId: 'ironveil-exploration-qa',
  characterName: 'Ironveil Explorer',
  inCity: true,
  currentCity: 'arunika',
  level: 1,
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
    localStorage.setItem('lumenfall:graphics-quality:v1', 'light');
  },
  { key: SAVE_KEY, fixture },
);
const ready = () =>
  page.waitForFunction(
    () =>
      window.__ironveilQA?.started &&
      window.__ironveilQA?.ironveil &&
      !window.__ironveilQA.transitioning &&
      !window.__ironveilQA.regionLoadError,
    null,
    { timeout: 120000 },
  );
async function locate(x, z) {
  await page.evaluate(
    ({ x, z }) => {
      const g = window.__ironveilQA;
      Object.assign(g.hero, { x, z });
      g.placeActor();
      g.cameraFocus.copy(g.actor.position);
      g.updateCamera(1);
      g.ironveil.update(g.camera, g.hero);
    },
    { x, z },
  );
}
async function inspectView(name, eye, target) {
  await page.evaluate(
    ({ eye, target }) => {
      const g = window.__ironveilQA,
        T = window.__ironveilThree;
      g.paused = true;
      cancelAnimationFrame(g.frame);
      const camera = new T.PerspectiveCamera(50, 1920 / 1080, 0.1, 1400);
      camera.position.fromArray(eye);
      camera.lookAt(...target);
      camera.updateMatrixWorld();
      g.ironveil.update(camera, g.hero);
      g.renderer.render(g.scene, camera);
    },
    { eye, target },
  );
  await page.screenshot({ path: out + '/' + name + '.png' });
  await page.evaluate(() => {
    const g = window.__ironveilQA;
    g.paused = false;
    g.lastTime = 0;
    g.frame = requestAnimationFrame(g.tick);
  });
}
try {
  await page.goto(process.env.LUMENFALL_QA_URL || 'http://localhost:3000/', {
    waitUntil: 'domcontentloaded',
  });
  await page
    .getByRole('button', { name: 'CONTINUE', exact: true })
    .click({ timeout: 60000 });
  await page.waitForFunction(() => window.__ironveilQA?.started, null, {
    timeout: 120000,
  });
  await page.keyboard.press('m');
  const enter = page
    .locator('.region-card')
    .filter({
      has: page.getByRole('heading', { name: 'Ironveil Mines', exact: true }),
    })
    .getByRole('button');
  await enter.waitFor();
  check('Ironveil is level-gated at eight', !(await enter.isEnabled()));
  check(
    'old Ironveil map card is permanently absent',
    (await page
      .locator('.region-card')
      .filter({ hasText: 'Tambang Selubung Besi' })
      .count()) === 0,
  );
  await page.screenshot({ path: out + '/map-menu.png' });
  await page.evaluate(() => {
    const g = window.__ironveilQA;
    g.hero.level = 8;
    g.restoreSavedPosition();
    g.emit();
  });
  await enter.click();
  await ready();
  await page.waitForTimeout(1200);
  check(
    'correct map and arrival with 120 normal monsters, 8 elites and one boss',
    await page.evaluate(() => {
      const g = window.__ironveilQA;
      return (
        g.hero.currentField === 'ironveil-mines-exterior-v1' &&
        g.hero.x === 0 &&
        g.hero.z === 440 &&
        g.enemies.length === 129 &&
        g.enemies.filter((e) => e.definition.variant === 'normal').length ===
          120 &&
        g.enemies.filter((e) => e.definition.variant === 'elite').length ===
          8 &&
        g.enemies.filter((e) => e.boss).length === 1 &&
        g.enemies.every(
          (e) => e.definition.level >= 8 && e.definition.level <= 16,
        ) &&
        g.npcLabels.length === 0
      );
    }),
  );
  await page.screenshot({ path: out + '/arrival.png' });
  check(
    'Ironveil UDS sky animates, follows camera, and matches the midday light',
    await page.evaluate(async () => {
      const g = window.__ironveilQA,
        T = window.__ironveilThree;
      const sky = g.ironveil.root.getObjectByName(
        'Ironveil UDS hot midday sky',
      );
      if (!sky) return false;
      const u = sky.material.uniforms,
        time = u.uTime.value;
      await new Promise((r) => setTimeout(r, 150));
      let matchesLight = false;
      g.worldLightRig.traverse((o) => {
        if (o instanceof T.DirectionalLight)
          matchesLight =
            o.position
              .clone()
              .sub(o.target.position)
              .normalize()
              .distanceTo(u.uSun.value) < 0.001 && o.intensity === 4.8;
      });
      return (
        u.uTime.value > time &&
        sky.position.distanceTo(g.camera.position) < 0.01 &&
        u.uSun.value.y > 0.8 &&
        u.uNight.value === 0 &&
        matchesLight &&
        u.uClouds.value.image.width === 1024 &&
        u.uClouds.value.colorSpace === T.NoColorSpace &&
        u.uZenith.value.getHexString() === '60a7e5' &&
        sky.material.depthWrite === false
      );
    }),
  );
  if(process.env.IRONVEIL_QA_SKY) {
    for(const quality of ['office','light','balanced','high']) {
      await page.evaluate(quality=>window.__ironveilQA.setGraphicsQuality(quality,false),quality);
      await page.waitForTimeout(400);
      check(`${quality}: no fog, clear sky profile and stronger sunlight`,await page.evaluate(()=>{
        const g=window.__ironveilQA,u=g.ironveil.root.getObjectByName('Ironveil UDS hot midday sky').material.uniforms;
        return g.scene.fog===null&&g.renderer.toneMappingExposure===1.3&&u.uClearMidday.value===1&&getComputedStyle(document.querySelector('.vignette')).display==='none';
      }));
    }
    await page.evaluate(()=>{const g=window.__ironveilQA;g.setGraphicsQuality('balanced',false);g.invincible=100000;});
    await locate(0,220);
    await inspectView('sunlit-mountain-approach',[0,20,260],[190,85,-35]);
    await inspectView('clear-blue-sky',[0,25,260],[-130,450,120]);
    await locate(220,-35);
    await inspectView('sunlit-mine-entrance',[220,21,40],[220,32,-55]);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'CONTINUE',exact:true}).click();await ready();
    check('fog stays removed after reload',await page.evaluate(()=>window.__ironveilQA.scene.fog===null));
  } else {
  check(
    'only owner cypress and rock meshes populate the arid exterior',
    await page.evaluate(() => {
      const g = window.__ironveilQA,
        T = window.__ironveilThree;
      const counts = { cypress: 0, rock01: 0, rock04: 0 };
      const rockTextures = new Set();
      let valid = true;
      g.ironveil.root.traverse((o) => {
        if (/Ironveil (pine|shrub)|Ore pile/.test(o.name)) valid = false;
        for (const kind of Object.keys(counts)) {
          if (o.name !== 'Ironveil ' + kind + ' instances') continue;
          counts[kind] += o.count;
          if (!o.material.map || o.material.map.image.width !== 1024)
            valid = false;
          if (kind === 'cypress') {
            if (o.geometry.attributes.position.count !== 2154) valid = false;
            const m = new T.Matrix4(),
              p = new T.Vector3(),
              q = new T.Quaternion(),
              s = new T.Vector3();
            for (let i = 0; i < o.count; i++) {
              o.getMatrixAt(i, m);
              m.decompose(p, q, s);
              if (s.y < 32 || s.y > 46 || Math.abs(s.x - s.y) > 0.001)
                valid = false;
              if (g.ironveil.groundHeight(p.x, p.z) - p.y < 1.4) valid = false;
            }
          } else rockTextures.add(o.material.map);
        }
      });
      const metrics = g.ironveil.metrics();
      const ground = g.ironveil.surfaces.children.find(
        (o) => o.name === 'Outdoor terrain',
      );
      return (
        valid &&
        counts.cypress === 42 &&
        counts.rock01 === 12 &&
        counts.rock04 === 12 &&
        rockTextures.size === 1 &&
        metrics.grass === 0 &&
        metrics.shrubs === 0 &&
        metrics.pines === 0 &&
        ground.material.customProgramCacheKey() === 'ironveil-arid-terrain-v2'
      );
    }),
  );
  check(
    'WASD moves the player at the southern arrival',
    await page.evaluate(async () => {
      const g = window.__ironveilQA;
      const z = g.hero.z;
      g.keys.add('w');
      await new Promise((r) => setTimeout(r, 700));
      g.keys.clear();
      return Math.hypot(g.hero.x, g.hero.z - z) > 1;
    }),
  );
  await locate(IRONVEIL_ENTRY.x, IRONVEIL_ENTRY.z);
  for (const path of IRONVEIL_PATHS) {
    await locate(path.points[0].x, path.points[0].z);
    for (const b of path.points.slice(1))
      check(
        'main/side route movement reaches ' + b.x + ',' + b.z,
        await page.evaluate((b) => {
          const g = window.__ironveilQA;
          g.move(b.x - g.hero.x, b.z - g.hero.z);
          return Math.hypot(g.hero.x - b.x, g.hero.z - b.z) < 0.05;
        }, b),
      );
  }
  for (const c of IRONVEIL_POCKETS) {
    const x = (c.minU + c.maxU) / 2 - 500,
      z = (c.minV + c.maxV) / 2 - 500;
    await locate(x, z);
    check(
      c.name + ' is valid',
      await page.evaluate(() =>
        window.__ironveilQA.ironveil.navigation.valid(window.__ironveilQA.hero),
      ),
    );
  }
  check(
    'Ironveil enemies chase, obey forced-movement collision, die and respawn',
    await page.evaluate(() => {
      const g = window.__ironveilQA;
      const e = g.enemies.find(
        (e) => e.definition.variant === 'normal' && e.definition.level === 8,
      );
      Object.assign(g.hero, { x: e.home.x + 7, z: e.home.z });
      g.placeActor();
      const before = e.group.position.clone();
      g.updateEnemy(e, 0.25);
      const chased = e.group.position.distanceTo(before) > 0;
      g.moveEnemy(e, 0, -1000);
      const blocked =
        g.ironveil.navigation.valid(e.group.position, 0.55) &&
        e.group.position.z >= 0;
      e.group.position.copy(e.home);
      const kills = g.hero.kills;
      g.hurtEnemy(e, e.max * 10, 0);
      const killed =
        e.hp === 0 &&
        g.hero.kills === kills + 1 &&
        g.hero.monsterRespawnState[e.respawnKey] > Date.now();
      e.respawnDeadline = Date.now() - 1;
      g.updateEnemy(e, 0.01);
      return (
        chased &&
        blocked &&
        killed &&
        e.hp === e.max &&
        e.group.position.distanceTo(e.home) < 0.01
      );
    }),
  );
  await locate(345, 136);
  await page.waitForTimeout(300);
  await inspectView('mine-tyrant-field-boss', [365, 25, 143], [345, 16, 105]);
  check(
    'mountain dash blocked',
    await page.evaluate(() => {
      const g = window.__ironveilQA;
      Object.assign(g.hero, { x: 0, z: 15 });
      g.placeActor();
      g.move(0, -500);
      return g.hero.z >= 0.45 && g.ironveil.navigation.valid(g.hero);
    }),
  );
  check(
    'continuous mountain terrain joins field and staging without gaps',
    await page.evaluate(() => {
      const mesh = window.__ironveilQA.ironveil.root.getObjectByName(
        'Mountain continuous terrain',
      );
      if (!mesh?.geometry.index || mesh.material.flatShading) return false;
      const p = mesh.geometry.attributes.position;
      let peak = 0;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i);
        peak = Math.max(peak, y);
        if (
          ((z === 0 && Math.abs(x) <= 480) ||
            ((x === 180 || x === 260) && z >= -50)) &&
          Math.abs(y - 12) > 0.001
        )
          return false;
      }
      // Tall perimeter revision: the strongest mass must be around the mine.
      const heightAt = (x, z) => {
        for (let i = 0; i < p.count; i++)
          if (p.getX(i) === x && p.getZ(i) === z) return p.getY(i);
        return 0;
      };
      return (
        peak > 250 &&
        peak < 400 &&
        heightAt(220, -50) > 80 &&
        heightAt(170, -70) > 100
      );
    }),
  );
  check(
    'perimeter terrain shares cliff material, closes corners and joins northern terrain',
    await page.evaluate(() => {
      const g = window.__ironveilQA,
        T = window.__ironveilThree;
      const north = g.ironveil.root.getObjectByName(
        'Mountain continuous terrain',
      );
      const rim = g.ironveil.root.getObjectByName('Mountain perimeter terrain');
      if (!rim?.geometry.index || rim.material !== north.material) return false;
      const n = north.geometry.attributes.position,
        p = rim.geometry.attributes.position;
      const edge = new Map();
      for (let i = 0; i < n.count; i++)
        if (n.getZ(i) === 0) edge.set(n.getX(i), n.getY(i));
      for (let i = 0; i < p.count; i++)
        if (
          p.getZ(i) === 0 &&
          Math.abs(p.getY(i) - edge.get(p.getX(i))) > 0.001
        )
          return false;
      g.scene.updateMatrixWorld(true);
      const ray = new T.Raycaster();
      for (const [x, z] of [
        [-490, 490],
        [490, 490],
        [-490, 1],
        [490, 1],
        [-490, 250],
        [490, 250],
        [0, 490],
      ]) {
        ray.set(new T.Vector3(x, 200, z), new T.Vector3(0, -1, 0));
        const hit = ray.intersectObject(rim)[0];
        if (!hit || hit.point.y < 60) return false;
      }
      return true;
    }),
  );
  check(
    'outer mountain ranges extend 550 units with matching inner seams and broad ridges',
    await page.evaluate(() => {
      const g = window.__ironveilQA,
        T = window.__ironveilThree;
      const root = g.ironveil.root;
      const original = [
        root.getObjectByName('Mountain continuous terrain'),
        root.getObjectByName('Mountain perimeter terrain'),
      ];
      const edge = new Map();
      const key = (x, z) => `${x.toFixed(3)},${z.toFixed(3)}`;
      for (const mesh of original) {
        const p = mesh.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i),
            z = p.getZ(i);
          if (Math.abs(x) === 500 || Math.abs(z) === 500)
            edge.set(key(x, z), p.getY(i));
        }
      }
      const ranges = [0, 1, 2, 3].map((i) =>
        root.getObjectByName('Mountain outer range ' + i),
      );
      if (ranges.some((r) => !r)) return false;
      for (const mesh of ranges) {
        const p = mesh.geometry.attributes.position;
        let extent = 0;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i),
            y = p.getY(i),
            z = p.getZ(i);
          if (!Number.isFinite(y)) return false;
          extent = Math.max(extent, Math.abs(x), Math.abs(z));
          if (Math.max(Math.abs(x), Math.abs(z)) === 500) {
            const h = edge.get(key(x, z));
            if (h === undefined || Math.abs(h - y) > 0.001) return false;
          }
        }
        if (extent !== 1050) return false;
      }
      g.scene.updateMatrixWorld(true);
      const ray = new T.Raycaster();
      for (const [x, z] of [
        [700, 0],
        [-700, 0],
        [0, 700],
        [0, -700],
      ]) {
        ray.set(new T.Vector3(x, 800, z), new T.Vector3(0, -1, 0));
        const hit = ray.intersectObjects(ranges)[0];
        if (!hit || hit.point.y < 180) return false;
      }
      return true;
    }),
  );
  check(
    'west east south and corner movement remains blocked',
    await page.evaluate(() => {
      const g = window.__ironveilQA;
      for (const [x, z, dx, dz] of [
        [-470, 250, -100, 0],
        [470, 250, 100, 0],
        [0, 470, 0, 100],
        [-470, 470, -100, 100],
        [470, 470, 100, 100],
      ]) {
        const p = g.ironveil.move({ x, z }, dx, dz);
        if (
          !g.ironveil.navigation.valid(p) ||
          Math.abs(p.x) > 479.55 ||
          p.z > 479.55
        )
          return false;
      }
      return true;
    }),
  );
  check(
    'mine aperture is clear and collar has no coplanar tunnel caps',
    await page.evaluate(() => {
      const g = window.__ironveilQA,
        T = window.__ironveilThree;
      const collar = g.ironveil.root.getObjectByName(
        'Mountain mine rock collar',
      );
      const lining = g.ironveil.root.getObjectByName(
        'Continuous tunnel lining',
      );
      const north = g.ironveil.root.getObjectByName(
        'Mountain continuous terrain',
      );
      g.scene.updateMatrixWorld(true);
      const ray = new T.Raycaster();
      for (const x of [212.25, 216, 220, 224, 227.75]) {
        for (const y of [12.25, 18, 23.75]) {
          ray.set(new T.Vector3(x, y, -48), new T.Vector3(0, 0, -1));
          const hit = ray.intersectObjects([collar, lining, north])[0];
          if (!hit || Math.abs(hit.point.z + 62) > 0.001) return false;
        }
        ray.set(new T.Vector3(x, 25, -48), new T.Vector3(0, 0, -1));
        const frontHits = ray
          .intersectObjects([collar, lining])
          .filter((h) => Math.abs(h.point.z + 50) < 0.001);
        if (
          new Set(frontHits.map((h) => h.object)).size !== 1 ||
          frontHits[0].object !== collar
        )
          return false;
      }
      return true;
    }),
  );
  check(
    'camera cannot cross the mountain face',
    await page.evaluate(() => {
      const g = window.__ironveilQA,
        T = window.__ironveilThree;
      g.scene.updateMatrixWorld(true);
      const p = g.ironveil.constrainCamera(
        new T.Vector3(0, 14, 8),
        new T.Vector3(0, 20, -30),
      );
      return p.z > -30 && p.distanceTo(new T.Vector3(0, 14, 8)) < 38;
    }),
  );
  await locate(220, -40);
  const travelInside = page.getByRole('button', {
    name: 'To Inside Mines',
    exact: true,
  });
  await travelInside.click();
  check(
    'entrance travel button enforces approach distance',
    await page.evaluate(
      () => window.__ironveilQA.notice === 'Move closer to the mine entrance.',
    ),
  );
  await locate(220, -50);
  await page.evaluate(()=>{const g=window.__ironveilQA;g.interactIronveilEntrance();g.interactIronveilEntrance();});
  await page.waitForFunction(()=>window.__ironveilQA?.mineInterior&&!window.__ironveilQA.transitioning,null,{timeout:120000});
  check('repeated entrance clicks produce one interior load',await page.evaluate(()=>window.__ironveilQA.enemies.length===480&&window.__ironveilQA.hero.interiorId==='ironveil-mines-interior-v1'));
  await page.screenshot({path:out+'/travel-inside-mines.png'});
  await page.evaluate(()=>{const g=window.__ironveilQA;Object.assign(g.hero,{x:0,z:447});g.placeActor();g.interactIronveilExit();});
  await ready();
  check('door return preserves the exterior population',await page.evaluate(()=>window.__ironveilQA.enemies.length===129&&!window.__ironveilQA.hero.interiorId));
  await locate(220, 2);
  await page.screenshot({ path: out + '/entrance-follow.png' });
  await inspectView('entrance-close', [220, 20, -26], [220, 20, -55]);
  await inspectView('entrance-oblique', [205, 19, -32], [220, 19, -54]);
  await inspectView('entrance-height', [270, 100, 190], [220, 125, -95]);
  await inspectView('hot-midday-sky', [0, 18, 260], [-200, 430, -140]);
  await inspectView('perimeter-west', [-445, 19, 240], [-500, 26, 240]);
  await inspectView('perimeter-east', [445, 19, 240], [500, 26, 240]);
  await inspectView('perimeter-south-corner', [440, 15, 438], [495, 24, 494]);
  await locate(220, 120);
  await page.evaluate(() => {
    const g = window.__ironveilQA;
    Object.assign(g.followView, {
      yaw: 0,
      targetYaw: 0,
      pitch: 0.12,
      targetPitch: 0.12,
      distance: 22,
      targetDistance: 22,
    });
    g.cameraFocus.copy(g.actor.position);
    g.updateCamera(1);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/mountain-approach.png' });
  await locate(85, 8);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/cliff-detail.png' });
  const ownerTree = ironveilProps().find(
    (p) => p.kind === 'cypress' && p.z < 250 && Math.abs(p.x) < 430,
  );
  const ownerRock = ironveilProps().find((p) => p.kind === 'rock');
  await inspectView('scenery-distribution', [0, 730, 540], [0, 0, 230]);
  const treeGround = ironveilGroundHeight(ownerTree.x, ownerTree.z);
  await inspectView(
    'cypress-root-grounding',
    [ownerTree.x + 14, treeGround + 5, ownerTree.z + 20],
    [ownerTree.x, treeGround + 2, ownerTree.z],
  );
  for (const [name, prop] of [
    ['owner-cypress', ownerTree],
    ['owner-rocks', ownerRock],
  ]) {
    const y = ironveilGroundHeight(prop.x, prop.z);
    await inspectView(
      name,
      [prop.x + 30, y + prop.height * 0.55, prop.z + 55],
      [prop.x, y + prop.height * 0.45, prop.z],
    );
  }
  check(
    'cliff keeps slope blending with arid terrain textures',
    await page.evaluate(() => {
      const g = window.__ironveilQA;
      const mesh = g.ironveil.root.getObjectByName(
        'Mountain continuous terrain',
      );
      return (
        mesh.material.customProgramCacheKey() ===
          'whispering-forest-triplanar-v2' &&
        mesh.material.map.image.src.includes('/verdant-plains-v2/dirt.webp') &&
        !!mesh.geometry.attributes.forestMask &&
        !!mesh.geometry.attributes.uv
      );
    }),
  );
  await locate(220, 2);
  for (const quality of ['office', 'light', 'balanced', 'high']) {
    await page.evaluate(
      (q) => window.__ironveilQA.setGraphicsQuality(q, false),
      quality,
    );
    await page.waitForTimeout(1800);
    const d = await page.evaluate(() =>
      window.__ironveilQA.getPerformanceDiagnostics(),
    );
    performance.push(d);
    check(
      'quality ' + quality + ' preserves collision and budgets',
      d.ironveilMines?.mineEntrances === 1 &&
        d.ironveilMines.mountainTriangles <= 50000 &&
        d.ironveilMines.textureBytes <= 96 * 1024 * 1024 &&
        d.render.calls <= 120 &&
        d.render.triangles <= 300000,
    );
  }
  await page.evaluate(() => {
    const g = window.__ironveilQA;
    g.setGraphicsQuality('light', false);
    g.setCameraMode('free');
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/entrance-free.png' });
  // Full-layout inspection render uses an independent camera; gameplay cameras stay intact.
  await page.evaluate(() => {
    const g = window.__ironveilQA,
      T = window.__ironveilThree;
    g.paused = true;
    cancelAnimationFrame(g.frame);
    const camera = new T.PerspectiveCamera(50, 1920 / 1080, 0.1, 4000);
    camera.position.set(1350, 1450, 1750);
    camera.lookAt(0, 60, 0);
    camera.updateMatrixWorld();
    g.ironveil.update(camera, { x: 0, z: 150 });
    const fog = g.scene.fog;
    g.scene.fog = null;
    g.renderer.render(g.scene, camera);
    g.scene.fog = fog;
  });
  await page.screenshot({ path: out + '/overview.png' });
  await page.evaluate(() => {
    const g = window.__ironveilQA;
    g.paused = false;
    g.lastTime = 0;
    g.frame = requestAnimationFrame(g.tick);
  });
  // Save/reload a distant valid point: catches legacy coordinate clamping.
  await locate(-300, 380);
  await page.evaluate(() => window.__ironveilQA.save());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page
    .getByRole('button', { name: 'CONTINUE', exact: true })
    .click({ timeout: 60000 });
  await ready();
  check(
    'reload preserves exterior position outside legacy bounds',
    await page.evaluate(() => {
      const h = window.__ironveilQA.hero;
      return h.x === -300 && h.z === 380;
    }),
  );
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.__ironveilQA.changeRegion('arunika'));
    await page.waitForFunction(
      () =>
        !window.__ironveilQA.transitioning && window.__ironveilQA.hero.inCity,
      null,
      { timeout: 120000 },
    );
    await page.evaluate(
      (id) => window.__ironveilQA.changeRegion(id),
      IRONVEIL_ID,
    );
    await ready();
    await page.waitForTimeout(100);
    memory.push(
      await page.evaluate(() => ({
        ...window.__ironveilQA.renderer.info.memory,
      })),
    );
  }
  check(
    'ten return trips keep resources bounded',
    Math.max(...memory.slice(2).map((m) => m.geometries)) -
      Math.min(...memory.slice(2).map((m) => m.geometries)) <
      8 &&
      Math.max(...memory.slice(2).map((m) => m.textures)) -
        Math.min(...memory.slice(2).map((m) => m.textures)) <
        8,
  );
  // Migrate an actual old-region save in this isolated profile.
  await page.evaluate(() => {
    const g = window.__ironveilQA;
    g.hero.inCity = false;
    g.hero.currentField = 'ironveil-mines';
    g.hero.x = 30;
    g.hero.z = -20;
    g.save();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  check(
    'old Ironveil browser save arrives in the sole replacement map',
    await page.evaluate(() => {
      const g = window.__ironveilQA;
      return (
        g.hero.currentField === 'ironveil-mines-exterior-v1' &&
        g.hero.x === 0 &&
        g.hero.z === 440 &&
        g.enemies.length === 129
      );
    }),
  );
  await page.evaluate(() => window.__ironveilQA.changeRegion('arunika'));
  await page.waitForFunction(() => !window.__ironveilQA.transitioning);
  // Exercise actual failure overlay and Retry, rather than a fake successful transition.
  injectingFailure = true;
  await page.route('**/ironveil-mines-exterior-v1/owner-rock-01.glb', (route) =>
    route.abort('failed'),
  );
  await page.evaluate(
    (id) => window.__ironveilQA.changeRegion(id),
    IRONVEIL_ID,
  );
  await page.getByRole('alertdialog').waitFor({ timeout: 120000 });
  check(
    'failed asset produces English retry state',
    await page
      .getByRole('alertdialog')
      .getByText(
        'Unable to load Ironveil Mines. Check the connection and retry.',
      )
      .isVisible(),
  );
  check(
    'movement freezes during failed load',
    await page.evaluate(() => {
      const g = window.__ironveilQA,
        x = g.hero.x,
        z = g.hero.z;
      g.move(10, 10);
      return g.hero.x === x && g.hero.z === z;
    }),
  );
  await page.unroute('**/ironveil-mines-exterior-v1/owner-rock-01.glb');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await ready();
  injectingFailure = false;
  check(
    'Retry loads exterior successfully',
    await page.evaluate(() =>
      window.__ironveilQA.ironveil.navigation.valid(window.__ironveilQA.hero),
    ),
  );
  }
  check('no runtime/shader errors', errors.length === 0);
  await writeFile(
    out + '/results.json',
    JSON.stringify(
      {
        checks,
        errors,
        expectedLoadErrors,
        failedRequests,
        performance,
        memory,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: out + '/failure.png' }).catch(() => {});
  await writeFile(
    out + '/results.json',
    JSON.stringify(
      {
        checks,
        errors,
        expectedLoadErrors,
        failedRequests,
        performance,
        memory,
        failure: String(error),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
