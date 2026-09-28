// Real Home + Game in an isolated Chrome profile. No owner saves are touched.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createV3AdventurerHero, SAVE_KEY } from '../lib/game/rules.ts';
import {
  PLAINS_ID,
  PLAINS_ENTRY,
  PLAINS_EXIT,
  PLAINS_POCKETS,
  PLAINS_BRIDGE,
  plainsCoast,
  plainsProps,
} from '../lib/game/verdant-plains-layout.ts';
const { chromium } = await import(
  pathToFileURL(
    'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = process.env.VERDANT_QA_OUTPUT || 'output/verdant-plains';
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
  checks = [],
  performance = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log('PAGE ERROR', e.message);
});
page.on('console', (m) => {
  if (m.type() === 'error') {
    errors.push(m.text());
    console.log('CONSOLE', m.text());
  }
});
page.on('requestfailed', (r) =>
  console.log('REQUEST FAILED', r.url(), r.failure()),
);
const check = (name, value = true) => {
  assert.ok(value, name);
  checks.push(name);
  console.log('PASS', name);
};
await page.route(/\/lib\/game\/world\.ts/, async (route) => {
  const response = await route.fetch();
  const body = (await response.text()).replace(
    'this.renderer = new T.WebGLRenderer',
    'window.__plainsQA = this; window.__plainsThree = T; this.renderer = new T.WebGLRenderer',
  );
  await route.fulfill({ response, body });
});
const hero = createV3AdventurerHero('slot-1');
hero.characterId = 'verdant-regression';
hero.characterName = 'Verdant Explorer';
hero.inCity = false;
hero.currentField = PLAINS_ID;
hero.currentCity = 'averion';
hero.x = PLAINS_ENTRY.x;
hero.z = PLAINS_ENTRY.z;
if (process.env.VERDANT_RETIREMENT_ONLY === '1') {
  Object.assign(hero, {currentField:process.env.VERDANT_RETIRED_ID || 'verdant-plains',currentCity:'arunika',x:28,z:39});
}
const fixture = {
  version: 3,
  activeSlot: 'slot-1',
  lastPlayedCharacterId: hero.characterId,
  characters: { 'slot-1': hero },
};
await context.addInitScript(
  ({ key, fixture }) => {
    performance.setResourceTimingBufferSize(10000);
    if (!localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify(fixture));
  },
  { key: SAVE_KEY, fixture },
);
try {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page
    .getByRole('button', { name: 'CONTINUE', exact: true })
    .click({ timeout: 60000 });
  await page.waitForFunction(
    () => window.__plainsQA?.started && window.__plainsQA?.plains,
    null,
    { timeout: 120000 },
  );
  await page.locator('.game-shell.in-world').waitFor({ timeout: 120000 });
  if (process.env.VERDANT_RETIREMENT_ONLY === '1') {
    check('legacy save migrates to new map camp', await page.evaluate(() => {
      const h=window.__plainsQA.hero;
      return h.currentField==='verdant-plains-v2'&&h.x===-380&&h.z===-20;
    }));
    await page.keyboard.press('m');
    const fields=page.locator('.region-card').filter({has:page.getByRole('button',{name:'Teleport field',exact:true})});
    await fields.first().waitFor();
    check('first field in M is Verdant Plains', await fields.first().locator('h3').textContent()==='Verdant Plains');
    check('retired map card absent', await page.locator('.region-card h3').filter({hasText:/^Padang Arunika$/}).count()===0);
    check('Sands Location card absent', await page.locator('.region-card h3').filter({hasText:/^Sands Location$/}).count()===0);
    check('replacement has exactly one card', await page.locator('.region-card h3').filter({hasText:/^Verdant Plains$/}).count()===1);
    await page.screenshot({path:out+'/map-menu.png'});
    for(const name of ['Averion','Verdant Plains']) {
      const card=page.locator('.region-card').filter({has:page.getByRole('heading',{name,exact:true})});
      await card.getByRole('button').click();
      await page.waitForFunction((name)=>{
        const g=window.__plainsQA;
        return !g.transitioning&&(name==='Averion'?g.isAverion:g.isPlains&&g.plains);
      },name,{timeout:120000});
      check('menu travel to '+name);
      if(name==='Averion')await page.keyboard.press('m');
    }
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'CONTINUE',exact:true}).click({timeout:60000});
    await page.waitForFunction(()=>window.__plainsQA?.started&&window.__plainsQA?.plains,null,{timeout:120000});
    check('migrated save reloads in Verdant Plains',await page.evaluate(()=>window.__plainsQA.hero.currentField==='verdant-plains-v2'));
    check('no runtime errors',errors.length===0);
    await writeFile(out+'/retirement.json',JSON.stringify({checks,errors},null,2));
    await browser.close();
    process.exit(0);
  }
  await page.evaluate(() => {
    const g = window.__plainsQA,
      render = g.renderer.render.bind(g.renderer);
    // Three auto-resets AFTER its shadow pass. Reset before render instead.
    g.renderer.info.autoReset = false;
    g.renderer.render = (scene, camera) => {
      g.renderer.info.reset();
      return render(scene, camera);
    };
  });
  check(
    'new map loads at camp',
    await page.evaluate(() => {
      const g = window.__plainsQA;
      return (
        g.hero.x === -380 &&
        g.hero.z === -20 &&
        g.enemies.length === 497 &&
        g.enemies.filter((e) => e.boss).length === 1 &&
        g.enemies.every((e) => e.definition.level <= 8)
      );
    }),
  );
  check(
    'city landmark removed without removing travel gate',
    await page.evaluate(() => {
      const g = window.__plainsQA;
      return (
        !g.plains.root.getObjectByName('Averion distant silhouette') &&
        !!g.plains.root.getObjectByName('Averion travel') &&
        !performance
          .getEntriesByType('resource')
          .some((r) => r.name.includes('averion-silhouette.glb'))
      );
    }),
  );
  await page.waitForTimeout(1500);
  check(
    'Balanced grass is taller, twice as dense and uses one mesh without distance LOD',
    await page.evaluate(() => {
      const root = window.__plainsQA.plains.root;
      const geometry = root.getObjectByName('Grass uniform GPU').geometry;
      const profile = geometry.getAttribute('aBladeProfile');
      let shortTip = false,
        tallTip = false;
      for (let i = 0; i < profile.count; i++) {
        if (profile.getX(i) !== 1) continue;
        shortTip ||= profile.getY(i) < 0.6;
        tallTip ||= profile.getY(i) > 1.4;
      }
      return (
        geometry.instanceCount === 162000 &&
        !root.getObjectByName('Grass near GPU') &&
        !root.getObjectByName('Grass far GPU') &&
        geometry.getAttribute('position').count / 3 === 6 &&
        shortTip &&
        tallTip
      );
    }),
  );
  await page.screenshot({ path: out + '/camp.png' });
  const metrics = await page.evaluate(() => {
    const g = window.__plainsQA;
    return {
      info: g.renderer.info.render,
      map: g.plains.metrics(),
      programs: g.renderer.info.programs.length,
      heavyMeshes: (() => {
        const list = [];
        g.scene.traverse((o) => {
          if (o.geometry) {
            const triangles =
              ((o.geometry.index?.count ??
                o.geometry.attributes.position.count) /
                3) *
              (o.isInstancedMesh ? o.count : 1);
            if (triangles > 20000)
              list.push({
                name: o.name,
                triangles,
                visible: o.visible,
                castShadow: o.castShadow,
              });
          }
        });
        return list.sort((a, b) => b.triangles - a.triangles).slice(0, 12);
      })(),
    };
  });
  console.log('METRICS', JSON.stringify(metrics));
  await writeFile(
    out + '/initial-metrics.json',
    JSON.stringify(metrics, null, 2),
  );
  check(
    'UDS sky owns a linear atlas and matches the scene sunlight',
    await page.evaluate(() => {
      const g = window.__plainsQA,
        T = window.__plainsThree;
      const sky = g.plains.root.getObjectByName('Verdant UDS daylight sky');
      if (!sky) return false;
      let aligned = false;
      g.worldLightRig.traverse((o) => {
        if (o instanceof T.DirectionalLight) {
          const direction = o.position
            .clone()
            .sub(o.target.position)
            .normalize();
          aligned = direction.dot(sky.material.uniforms.uSun.value) > 0.9999;
        }
      });
      return (
        aligned &&
        sky.material.uniforms.uClouds.value.image.width === 2048 &&
        sky.material.uniforms.uClouds.value.colorSpace === T.NoColorSpace &&
        !sky.material.depthWrite &&
        sky.position.distanceTo(g.camera.position) < 0.01
      );
    }),
  );
  await page.evaluate(() => {
    const g = window.__plainsQA;
    g.followView.yaw = g.followView.targetYaw = 0.25;
    g.followView.pitch = g.followView.targetPitch = 0.08;
    g.followView.distance = g.followView.targetDistance = 20;
    g.invincible = 0;
    g.actor.visible = true;
    g.cameraFocus.copy(g.actor.position);
    g.updateCamera(1);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/sunny-meadow.png' });
  const skyAnimation = await page.evaluate(async () => {
    const g = window.__plainsQA,
      T = window.__plainsThree;
    const source = g.plains.root.getObjectByName('Verdant UDS daylight sky');
    const scene = new T.Scene(),
      sky = source.clone();
    scene.add(sky);
    const camera = g.camera.clone();
    camera.updateMatrixWorld();
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 270;
    const ctx = canvas.getContext('2d');
    const capture = () => {
      sky.position.copy(camera.position);
      g.renderer.render(scene, camera);
      ctx.drawImage(g.renderer.domElement, 0, 0, 480, 270);
      return {
        time: source.material.uniforms.uTime.value,
        pixels: ctx.getImageData(0, 0, 480, 270).data,
        png: canvas.toDataURL('image/png').split(',')[1],
      };
    };
    await new Promise(requestAnimationFrame);
    const a = capture();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await new Promise(requestAnimationFrame);
    const b = capture();
    let changed = 0,
      blue = 0,
      bright = 0;
    for (let i = 0; i < a.pixels.length; i += 4) {
      if (
        Math.abs(a.pixels[i] - b.pixels[i]) +
          Math.abs(a.pixels[i + 1] - b.pixels[i + 1]) +
          Math.abs(a.pixels[i + 2] - b.pixels[i + 2]) >
        3
      )
        changed++;
      if (a.pixels[i + 2] > a.pixels[i] + 20) blue++;
      if (a.pixels[i] > 220 && a.pixels[i + 1] > 220 && a.pixels[i + 2] > 200)
        bright++;
    }
    scene.remove(sky);
    g.renderer.render(g.scene, g.camera);
    return {
      changed,
      blue,
      bright,
      elapsed: b.time - a.time,
      frames: [a.png, b.png],
    };
  });
  check(
    'daylight sky has blue atmosphere, bright clouds/sun and real-time cloud motion',
    skyAnimation.blue > 1000 &&
      skyAnimation.bright > 100 &&
      skyAnimation.changed > 100 &&
      skyAnimation.elapsed > 1,
  );
  for (let i = 0; i < 2; i++)
    await writeFile(
      out + '/sky-motion-' + i + '.png',
      Buffer.from(skyAnimation.frames[i], 'base64'),
    );
  await writeFile(
    out + '/sky-motion.json',
    JSON.stringify({ ...skyAnimation, frames: undefined }, null, 2),
  );
  if (process.env.VERDANT_SKY_ONLY === '1') {
    check('sky capture without runtime errors', errors.length === 0);
    await browser.close();
    process.exit(0);
  }
  if (process.env.VERDANT_BAKE_TREE_CARDS === '1') {
    const cards = await page.evaluate(() => {
      const T = window.__plainsThree,
        g = window.__plainsQA,
        results = [];
      const renderer = new T.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(512, 512);
      renderer.setClearColor(0, 0);
      renderer.toneMapping = g.renderer.toneMapping;
      renderer.toneMappingExposure = g.renderer.toneMappingExposure;
      renderer.outputColorSpace = g.renderer.outputColorSpace;
      for (const kind of ['fir', 'tree']) {
        const scene = new T.Scene(),
          rig = g.worldLightRig.clone(true);
        scene.add(rig);
        rig.traverse((o) => {
          if (o.isDirectionalLight) {
            o.position.set(-25, 45, 20);
            o.target.position.set(0, 0, 0);
            scene.add(o.target);
            o.castShadow = false;
          }
        });
        const source = g.plains.root.getObjectByName(kind + ':near'),
          mesh = new T.Mesh(source.geometry, source.material);
        scene.add(mesh);
        const box = new T.Box3().setFromObject(mesh),
          center = box.getCenter(new T.Vector3()),
          size = box.getSize(new T.Vector3()),
          span = Math.max(size.x, size.y, size.z) * 1.12;
        const camera = new T.OrthographicCamera(
          -span / 2,
          span / 2,
          span / 2,
          -span / 2,
          0.1,
          100,
        );
        camera.position.set(center.x, center.y, center.z + 35);
        camera.lookAt(center);
        camera.updateMatrixWorld();
        renderer.render(scene, camera);
        results.push({
          kind,
          size: span,
          centerY: center.y,
          png: renderer.domElement.toDataURL('image/png').split(',')[1],
        });
      }
      renderer.dispose();
      renderer.forceContextLoss();
      return results;
    });
    const { readFile } = await import('node:fs/promises');
    const path = 'public/assets/maps/verdant-plains-v2/';
    const metadata = JSON.parse(
      await readFile(path + 'impostors.json', 'utf8'),
    );
    for (const card of cards) {
      await writeFile(
        path + card.kind + '-far.png',
        Buffer.from(card.png, 'base64'),
      );
      metadata[card.kind] = { size: card.size, centerY: card.centerY };
    }
    await writeFile(
      path + 'impostors.json',
      JSON.stringify(metadata, null, 2) + '\n',
    );
    check('tree LOD cards baked with runtime lighting', errors.length === 0);
    await browser.close();
    process.exit(0);
  }
  if (process.env.VERDANT_PROFILE_ONLY === '1') {
    const profile = await page.evaluate(async () => {
      const g = window.__plainsQA,
        samples = [],
        update = g.plains.update;
      let updateMs = 0;
      g.plains.update = (...args) => {
        const t = performance.now();
        update(...args);
        updateMs = performance.now() - t;
      };
      // Traverse 160 world units, deliberately crossing the former grass/LOD cell boundaries.
      // QA positioning avoids obstacles; camera, rendering and adapter updates stay real.
      let last = performance.now();
      for (let i = 0; i < 480; i++) {
        g.hero.x = -380 + i / 3;
        g.hero.z = -20 - i / 24;
        g.placeActor();
        await new Promise(requestAnimationFrame);
        const now = performance.now();
        samples.push({
          frame: now - last,
          update: updateMs,
          x: g.hero.x,
          calls: g.renderer.info.render.calls,
          triangles: g.renderer.info.render.triangles,
        });
        last = now;
      }
      g.plains.update = update;
      const percentile = (key, q) =>
        samples.map((s) => s[key]).sort((a, b) => a - b)[
          Math.floor(samples.length * q)
        ];
      return {
        samples,
        frame: {
          p50: percentile('frame', 0.5),
          p95: percentile('frame', 0.95),
          p99: percentile('frame', 0.99),
          max: Math.max(...samples.map((s) => s.frame)),
        },
        update: {
          p50: percentile('update', 0.5),
          p95: percentile('update', 0.95),
          p99: percentile('update', 0.99),
          max: Math.max(...samples.map((s) => s.update)),
        },
      };
    });
    await writeFile(
      out + '/traversal-profile.json',
      JSON.stringify(profile, null, 2),
    );
    console.log(
      'TRAVERSAL',
      JSON.stringify({ frame: profile.frame, update: profile.update }),
    );
    check('profile no runtime errors', errors.length === 0);
    await browser.close();
    process.exit(0);
  }
  // Overview is a QA camera only; gameplay camera parameters are unchanged.
  await page.evaluate(() => {
    const g = window.__plainsQA;
    g.paused = true;
    g.__oldCamera = g.camera;
    g.__oldUpdate = g.updateCamera;
    g.updateCamera = () => {};
    g.camera = g.freeCamera;
    g.freeCamera.position.set(450, 1000, 1000);
    Object.assign(g.freeCamera, {
      left: -900,
      right: 900,
      top: 506,
      bottom: -506,
      zoom: 1,
      far: 4000,
    });
    g.freeCamera.updateProjectionMatrix();
    g.freeCamera.lookAt(0, 0, -30);
    g.camera.updateMatrixWorld();
    g.__fog = g.scene.fog;
    g.scene.fog = null;
    g.plains.update(g.camera, g.hero, 0);
    g.renderer.render(g.scene, g.camera);
  });
  await page.screenshot({ path: out + '/overview.png' });
  await page.evaluate(() => {
    const g = window.__plainsQA;
    g.camera = g.__oldCamera;
    g.scene.fog = g.__fog;
    g.updateCamera = g.__oldUpdate;
    g.paused = false;
    g.updateCamera(1);
  });
  if (process.env.VERDANT_SMOKE_ONLY === '1') {
    await writeFile(out + '/errors.json', JSON.stringify(errors, null, 2));
    console.log('ERRORS', JSON.stringify(errors));
  } else {
    const startPosition = await page.evaluate(() => ({
      x: window.__plainsQA.hero.x,
      z: window.__plainsQA.hero.z,
    }));
    await page.keyboard.down('d');
    await page.waitForTimeout(400);
    await page.keyboard.up('d');
    check(
      'keyboard movement works at camp',
      await page.evaluate(
        (p) =>
          Math.hypot(
            window.__plainsQA.hero.x - p.x,
            window.__plainsQA.hero.z - p.z,
          ) > 1,
        startPosition,
      ),
    );
    await page.keyboard.press('m');
    const mapCard = page.locator('.region-card').filter({
      has: page.getByRole('heading', { name: 'Verdant Plains', exact: true }),
    });
    await mapCard
      .getByRole('button', { name: 'Teleport field', exact: true })
      .click();
    await page.waitForFunction(
      () => window.__plainsQA.plains && !window.__plainsQA.transitioning,
      null,
      { timeout: 120000 },
    );
    check(
      'M menu enters at Arunika Rest',
      await page.evaluate(
        () =>
          window.__plainsQA.hero.x === -380 && window.__plainsQA.hero.z === -20,
      ),
    );
    const combat = await page.evaluate(async () => {
      const g = window.__plainsQA;
      const starter = g.enemies.find((e) => e.definition.level === 1);
      Object.assign(g.hero, { x: starter.home.x + 3, z: starter.home.z });
      g.placeActor();
      g.cameraFocus.copy(g.actor.position);
      const before = starter.group.position.clone();
      for (let i = 0; i < 45; i++) await new Promise(requestAnimationFrame);
      const aggro = starter.group.position.distanceTo(before) > 0.1;
      const kills = g.hero.kills,
        progress = g.hero.fieldProgress[g.hero.currentField] ?? 0;
      g.hurtEnemy(starter, 100000, 1);
      const death =
        starter.hp === 0 &&
        !starter.group.visible &&
        g.hero.kills === kills + 1 &&
        g.hero.fieldProgress[g.hero.currentField] === progress + 1 &&
        g.hero.monsterRespawnState[starter.respawnKey] > Date.now();
      const noLegacyClamp = Math.abs(starter.group.position.x) > 100;
      starter.respawnDeadline = Date.now() - 1;
      g.updateEnemy(starter, 0.016);
      const respawn =
        starter.hp === starter.max &&
        starter.group.position.distanceTo(starter.home) < 0.001;
      const boss = g.enemies.find((e) => e.boss);
      Object.assign(g.hero, { x: boss.home.x + 8, z: boss.home.z });
      g.placeActor();
      g.cameraFocus.copy(g.actor.position);
      g.followView.yaw = g.followView.targetYaw = Math.PI / 2;
      g.followView.pitch = g.followView.targetPitch = 0.55;
      g.followView.distance = g.followView.targetDistance = 18;
      g.invincible = 0;
      g.actor.visible = true;
      g.updateCamera(1);
      g.emit();
      return {
        aggro,
        death,
        noLegacyClamp,
        respawn,
        bossLevel: boss.definition.level,
      };
    });
    for (const [name, result] of Object.entries(combat))
      check('combat ' + name, name === 'bossLevel' ? result === 8 : result);
    await page.waitForTimeout(400);
    await page.screenshot({ path: out + '/boss-encounter.png' });
    check(
      'boss kill awards progress and keeps timer through player respawn',
      await page.evaluate(() => {
        const g = window.__plainsQA,
          boss = g.enemies.find((e) => e.boss);
        g.hurtEnemy(boss, 100000, 0);
        const dead =
          boss.hp === 0 &&
          g.hero.defeatedFieldBosses.includes(g.hero.currentField);
        const deadline = boss.respawnDeadline;
        g.respawn();
        const preserved =
          boss.hp === 0 &&
          boss.respawnDeadline === deadline &&
          g.hero.monsterRespawnState[boss.respawnKey] === deadline;
        boss.respawnDeadline = Date.now() - 1;
        g.updateEnemy(boss, 0.016);
        return dead && preserved && boss.hp === boss.max;
      }),
    );
    if (process.env.VERDANT_COMBAT_ONLY === '1') {
      check('combat capture without runtime errors', errors.length === 0);
      await browser.close();
      process.exit(0);
    }
    for (const quality of ['light', 'high', 'balanced']) {
      check(
        'quality preset ' + quality,
        await page.evaluate((q) => {
          const g = window.__plainsQA;
          g.setPlainsQuality(q);
          return (
            g.plains.quality === q &&
            g.renderer.shadowMap.enabled === (q !== 'light')
          );
        }, quality),
      );
    }
    const rock = plainsProps()
      .filter((p) => p.kind === 'rock')
      .sort(
        (a, b) =>
          Math.hypot(a.x + 380, a.z + 20) - Math.hypot(b.x + 380, b.z + 20),
      )[0];
    for (const [name, p] of [
      [
        'bridge',
        {
          x: PLAINS_BRIDGE.x - PLAINS_BRIDGE.dx * 42,
          z: PLAINS_BRIDGE.z - PLAINS_BRIDGE.dz * 42,
        },
      ],
      ['central', PLAINS_POCKETS[1]],
      ['coast', { x: 70, z: plainsCoast(70) - 27 }],
      ['north', PLAINS_EXIT],
      ['rocks', { x: rock.x + rock.radius + 5, z: rock.z + 4 }],
    ]) {
      await page.evaluate(
        ({ p, name, rock }) => {
          const g = window.__plainsQA;
          Object.assign(g.hero, p);
          g.placeActor();
          g.cameraFocus.copy(g.actor.position);
          g.followView.yaw = g.followView.targetYaw =
            name === 'rocks'
              ? Math.atan2(p.x - rock.x, p.z - rock.z)
              : name === 'coast'
                ? Math.PI
                : name === 'north'
                  ? 0
                  : Math.atan2(p.x - 120, p.z + 10);
          g.followView.pitch = g.followView.targetPitch =
            name === 'north' ? 0.12 : 0.38;
          g.invincible = 0;
          g.actor.visible = true;
          g.updateCamera(1);
        },
        { p, name, rock },
      );
      await page.waitForTimeout(900);
      await page.screenshot({
        path: out + '/' + (typeof name === 'string' ? name : 'view') + '.png',
      });
      if (name === 'central' || name === 'coast') {
        const animation = await page.evaluate(async (name) => {
          const g = window.__plainsQA,
            root = g.plains.root,
            states = root.children.map((o) => [o, o.visible]);
          const actorVisible = g.actor.visible;
          g.actor.visible = false;
          const canvas = document.createElement('canvas');
          canvas.width = g.renderer.domElement.width;
          canvas.height = g.renderer.domElement.height;
          const ctx = canvas.getContext('2d'),
            frames = [];
          const update = g.plains.update,
            updateCamera = g.updateCamera,
            times = [];
          g.updateCamera = () => {};
          g.plains.update = (...args) => {
            times.push(args[2]);
            update(...args);
            root.children.forEach(
              (o) =>
                (o.visible =
                  name === 'central'
                    ? o.name.startsWith('Grass ')
                    : o.name === 'Verdant layered water'),
            );
          };
          try {
            await new Promise(requestAnimationFrame);
            for (let frame = 0; frame < 2; frame++) {
              if (frame)
                await new Promise((resolve) => setTimeout(resolve, 800));
              g.actor.visible = false;
              g.renderer.render(g.scene, g.camera);
              ctx.drawImage(g.renderer.domElement, 0, 0);
              frames.push({
                pixels: ctx.getImageData(0, 0, canvas.width, canvas.height)
                  .data,
                png: canvas.toDataURL('image/png').split(',')[1],
              });
            }
          } finally {
            g.plains.update = update;
            g.updateCamera = updateCamera;
          }
          let changed = 0;
          for (let i = 0; i < frames[0].pixels.length; i += 4)
            if (
              Math.abs(frames[0].pixels[i] - frames[1].pixels[i]) +
                Math.abs(frames[0].pixels[i + 1] - frames[1].pixels[i + 1]) +
                Math.abs(frames[0].pixels[i + 2] - frames[1].pixels[i + 2]) >
              12
            )
              changed++;
          states.forEach(([o, v]) => (o.visible = v));
          g.actor.visible = actorVisible;
          return {
            changed,
            elapsed: times.at(-1) - times[0],
            ticks: times.length,
            frames: frames.map((f) => f.png),
          };
        }, name);
        const label = name === 'central' ? 'grass-wind' : 'water-ripples';
        for (let i = 0; i < 2; i++)
          await writeFile(
            out + '/' + label + '-' + i + '.png',
            Buffer.from(animation.frames[i], 'base64'),
          );
        check(
          label + ' animates through real gameplay ticks with fixed camera',
          animation.changed > 1000 &&
            animation.elapsed > 0.65 &&
            animation.ticks > 15,
        );
        await writeFile(
          out + '/' + label + '.json',
          JSON.stringify(
            {
              changedPixels: animation.changed,
              elapsed: animation.elapsed,
              ticks: animation.ticks,
            },
            null,
            2,
          ),
        );
        if (name === 'central') {
          const video = await page.evaluate(async () => {
            const g = window.__plainsQA,
              stream = g.renderer.domElement.captureStream(24),
              parts = [];
            const recorder = new MediaRecorder(stream, {
              mimeType: 'video/webm',
              videoBitsPerSecond: 4000000,
            });
            recorder.ondataavailable = (e) => {
              if (e.data.size) parts.push(e.data);
            };
            const stopped = new Promise(
              (resolve) => (recorder.onstop = resolve),
            );
            recorder.start();
            await new Promise((resolve) => setTimeout(resolve, 2400));
            recorder.stop();
            await stopped;
            stream.getTracks().forEach((t) => t.stop());
            return Array.from(
              new Uint8Array(
                await new Blob(parts, { type: 'video/webm' }).arrayBuffer(),
              ),
            );
          });
          await writeFile(out + '/grass-live.webm', Buffer.from(video));
        }
        if (name === 'central') {
          const start = await page.evaluate(() => ({
            x: window.__plainsQA.hero.x,
            z: window.__plainsQA.hero.z,
          }));
          await page.keyboard.down('w');
          try {
            const video = await page.evaluate(async () => {
              const g = window.__plainsQA,
                stream = g.renderer.domElement.captureStream(24),
                parts = [];
              const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm',
                videoBitsPerSecond: 4000000,
              });
              recorder.ondataavailable = (e) => {
                if (e.data.size) parts.push(e.data);
              };
              const stopped = new Promise(
                (resolve) => (recorder.onstop = resolve),
              );
              recorder.start();
              await new Promise((resolve) => setTimeout(resolve, 2800));
              recorder.stop();
              await stopped;
              stream.getTracks().forEach((t) => t.stop());
              return Array.from(
                new Uint8Array(
                  await new Blob(parts, { type: 'video/webm' }).arrayBuffer(),
                ),
              );
            });
            await writeFile(out + '/grass-walk.webm', Buffer.from(video));
          } finally {
            await page.keyboard.up('w');
          }
          check(
            'character traverses tall grass',
            await page.evaluate(
              (p) =>
                Math.hypot(
                  window.__plainsQA.hero.x - p.x,
                  window.__plainsQA.hero.z - p.z,
                ) > 10,
              start,
            ),
          );
          await page.screenshot({ path: out + '/grass-contact.png' });
        }
      }
    }
    check(
      'vegetation near and far LOD are mutually exclusive',
      await page.evaluate(() => {
        const root = window.__plainsQA.plains.root;
        return ['fir', 'tree', 'shrub'].every((kind) => {
          const near = root.getObjectByName(kind + ':near'),
            far = root.getObjectByName(kind + ':far');
          let hidden = 0;
          for (let i = 0; i < far.count; i++)
            if (far.instanceMatrix.array[i * 16] === 0) hidden++;
          return hidden === near.count;
        });
      }),
    );
    if (process.env.VERDANT_GALLERY_ONLY === '1') {
      check(
        'gameplay gallery without shader/runtime errors',
        errors.length === 0,
      );
      await browser.close();
      process.exit(0);
    }
    await page.evaluate(() => {
      const g = window.__plainsQA;
      g.followView.yaw = g.followView.targetYaw = Math.atan2(
        40 - 120,
        -440 + 10,
      );
      g.followView.pitch = g.followView.targetPitch = 0.38;
    });
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 2560, height: 1440 },
    ]) {
      await page.setViewportSize(viewport);
      for (const p of [
        PLAINS_ENTRY,
        ...PLAINS_POCKETS,
        PLAINS_EXIT,
        {
          x: PLAINS_BRIDGE.x - PLAINS_BRIDGE.dx * 42,
          z: PLAINS_BRIDGE.z - PLAINS_BRIDGE.dz * 42,
        },
      ]) {
        await page.evaluate((p) => {
          const g = window.__plainsQA;
          Object.assign(g.hero, p);
          g.placeActor();
          g.cameraFocus.copy(g.actor.position);
        }, p);
        await page.waitForTimeout(250);
        await page.keyboard.down('w');
        const sample = await page.evaluate(async () => {
          const g = window.__plainsQA,
            times = [],
            calls = [],
            triangles = [];
          let last = performance.now();
          for (let i = 0; i < 90; i++) {
            await new Promise(requestAnimationFrame);
            const now = performance.now();
            times.push(now - last);
            last = now;
            calls.push(g.renderer.info.render.calls);
            triangles.push(g.renderer.info.render.triangles);
          }
          times.sort((a, b) => a - b);
          return {
            p50: times[45],
            p95: times[85],
            calls: Math.max(...calls),
            triangles: Math.max(...triangles),
            memory: g.renderer.info.memory,
            map: g.plains.metrics(),
          };
        });
        await page.keyboard.up('w');
        performance.push({ viewport, point: p, ...sample });
      }
    }
    await writeFile(
      out + '/performance.json',
      JSON.stringify(performance, null, 2),
    );
    check(
      // Explicitly account for requested full-detail grass across the old far
      // range: 972k grass triangles replace 112k. Retain the non-grass budget.
      'Balanced geometry budget with uniform full-detail grass (1.46M)',
      performance.every((p) => p.calls <= 350 && p.triangles <= 1460000),
    );
    await page.evaluate((p) => {
      const g = window.__plainsQA;
      Object.assign(g.hero, p);
      g.placeActor();
      g.save();
    }, PLAINS_EXIT);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
    await page.waitForFunction(
      () => window.__plainsQA?.started && window.__plainsQA?.plains,
      null,
      { timeout: 120000 },
    );
    check(
      'reload retains far coordinate',
      await page.evaluate(() => window.__plainsQA.hero.z === -440),
    );
    check(
      'respawn returns to camp',
      await page.evaluate(() => {
        const g = window.__plainsQA;
        g.respawn();
        return g.hero.x === -380 && g.hero.z === -20;
      }),
    );
    const resources = [];
    for (let i = 0; i < 3; i++) {
      if (i === 0) {
        check(
          'north gate interaction enters Averion',
          await page.evaluate((p) => {
            const g = window.__plainsQA;
            Object.assign(g.hero, p);
            g.placeActor();
            g.cameraFocus.copy(g.actor.position);
            g.followView.yaw = g.followView.targetYaw = 0;
            g.updateCamera(1);
            g.camera.updateMatrixWorld();
            const gate = g.plains.root.getObjectByName('Averion travel');
            const v = gate.position.clone();
            v.y += 2.5;
            v.project(g.camera);
            g.pointer.set(v.x, v.y);
            return g.tryNpcInteraction() && g.hero.inCity;
          }, PLAINS_EXIT),
        );
      } else
        await page.evaluate(() => window.__plainsQA.changeRegion('averion'));
      await page.waitForFunction(
        () => window.__plainsQA.averion && !window.__plainsQA.transitioning,
        null,
        { timeout: 120000 },
      );
      check('Averion travel ' + i);
      await page.evaluate(() =>
        window.__plainsQA.changeRegion('verdant-plains-v2'),
      );
      await page.waitForFunction(
        () => window.__plainsQA.plains && !window.__plainsQA.transitioning,
        null,
        { timeout: 120000 },
      );
      await page.waitForTimeout(300);
      resources.push(
        await page.evaluate(() => ({
          ...window.__plainsQA.renderer.info.memory,
        })),
      );
    }
    check(
      'GPU resources stabilize after repeated travel',
      resources[2].textures <= resources[1].textures &&
        resources[2].geometries <= resources[1].geometries,
    );
    for (const id of ['verdant-plains', 'east-gate-arunika']) {
      await page.evaluate((id) => window.__plainsQA.changeRegion(id), id);
      await page.waitForFunction(
        (id) =>
          window.__plainsQA.hero.currentField === id &&
          !window.__plainsQA.transitioning,
        id,
        { timeout: 120000 },
      );
      check(
        id + ' population retained',
        await page.evaluate(() => window.__plainsQA.enemies.length === 42),
      );
    }
    check('no unexpected errors before retry scenario', errors.length === 0);
    // Reload clears Three's in-memory image cache so this really exercises a failed fetch.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
    await page.waitForFunction(
      () => window.__plainsQA?.started && !window.__plainsQA.transitioning,
      null,
      { timeout: 120000 },
    );
    await page.route('**/assets/maps/verdant-plains-v2/grass.webp', (route) =>
      route.fulfill({ status: 503, body: 'Deliberate regression fixture' }),
    );
    await page.evaluate(() =>
      window.__plainsQA.changeRegion('verdant-plains-v2'),
    );
    await page
      .getByRole('alertdialog', { name: 'Map gagal dimuat' })
      .waitFor({ timeout: 120000 });
    check(
      'failed asset displays retry and blocks movement',
      await page.evaluate(() => {
        const g = window.__plainsQA,
          x = g.hero.x;
        g.move(8, 0);
        return g.hero.x === x && !!g.regionLoadError;
      }),
    );
    await page.unroute('**/assets/maps/verdant-plains-v2/grass.webp');
    const expectedFailureErrors = errors.splice(0);
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.waitForFunction(
      () =>
        window.__plainsQA.plains &&
        !window.__plainsQA.regionLoadError &&
        !window.__plainsQA.transitioning,
      null,
      { timeout: 120000 },
    );
    check(
      'retry restores playable map',
      await page.evaluate(() =>
        window.__plainsQA.plains.navigation.valid(window.__plainsQA.hero),
      ),
    );
    const transfer = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((r) => r.name.includes('/assets/maps/verdant-plains-v2/'))
        .map((r) => ({
          name: r.name,
          transferSize: r.transferSize,
          encodedBodySize: r.encodedBodySize,
          decodedBodySize: r.decodedBodySize,
        })),
    );
    await writeFile(
      out + '/regression.json',
      JSON.stringify(
        {
          checks,
          errors,
          performance,
          resources,
          transfer,
          expectedFailureErrors,
          benchmark: 'Headless Chrome; not a hardware GPU benchmark',
        },
        null,
        2,
      ),
    );
    check('no runtime or missing asset errors', errors.length === 0);
  }
} catch (error) {
  await page.screenshot({ path: out + '/failure.png' }).catch(() => {});
  console.log('ERRORS', JSON.stringify(errors));
  throw error;
} finally {
  await browser.close();
}
