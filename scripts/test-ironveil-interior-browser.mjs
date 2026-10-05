// Isolated localStorage fixture; never reads or writes the owner's browser profile.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createV3AdventurerHero, SAVE_KEY } from '../lib/game/rules.ts';
import {
  MINE_CURVES,
  MINE_ROOMS,
  MINE_ENTRY,
} from '../lib/game/ironveil-interior-layout.ts';
const { chromium } = await import(
  pathToFileURL(
    'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = process.env.IRONVEIL_QA_LIGHTING ? 'output/ironveil-interior/lighting-qa' : process.env.IRONVEIL_QA_QUICK
  ? 'output/ironveil-interior/ui-qa'
  : 'output/ironveil-interior/revision-qa';
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
const checks = [],
  errors = [],
  performance = [],
  memory = [];
let injectingFailure = false;
const check = (name, value = true) => {
  assert(value, name);
  checks.push(name);
  console.log('PASS', name);
};
page.on('pageerror', (e) => {
  if (!injectingFailure) errors.push(e.message);
});
page.on('console', (m) => {
  if (m.type() === 'error' && !injectingFailure) errors.push(m.text());
});
await page.route(/\/lib\/game\/world\.ts/, async (route) => {
  const response = await route.fetch();
  await route.fulfill({
    response,
    body: (await response.text()).replace(
      'this.renderer = new T.WebGLRenderer',
      'window.__mineQA = this; window.__mineThree = T; this.renderer = new T.WebGLRenderer',
    ),
  });
});
const hero = createV3AdventurerHero('slot-1');
Object.assign(hero, {
  characterId: 'interior-qa-only',
  characterName: 'Mine Explorer',
  level: 8,
  inCity: false,
  currentCity: 'averion',
  currentField: 'ironveil-mines-exterior-v1',
  x: 220,
  z: -49,
  lastSafePosition: { x: 220, z: -49 },
});
const fixture = {
  version: 3,
  activeSlot: 'slot-1',
  lastPlayedCharacterId: hero.characterId,
  characters: { 'slot-1': hero },
};
await context.addInitScript(
  ({ fixture, key }) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify(fixture));
    localStorage.setItem('lumenfall:graphics-quality:v1', 'light');
  },
  { fixture, key: SAVE_KEY },
);
const ready = (inside) =>
  page.waitForFunction(
    (inside) => {
      const g = window.__mineQA;
      return (
        g?.started &&
        !g.transitioning &&
        !g.regionLoadError &&
        (inside ? g.mineInterior : g.ironveil)
      );
    },
    inside,
    { timeout: 120000 },
  );
async function locate(p) {
  await page.evaluate((p) => {
    const g = window.__mineQA;
    g.invincible = 100000;
    Object.assign(g.hero, p);
    g.placeActor();
    g.cameraFocus.copy(g.actor.position);
    g.updateCamera(1);
    if (g.mineInterior)
      g.mineInterior.update(g.camera, g.hero, performance.now() / 1000);
  }, p);
}
async function screenshot(name) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${name}.png` });
}
async function enter() {
  await locate({ x: 220, z: -49 });
  await page
    .getByRole('button', { name: 'To Inside Mines', exact: true })
    .click();
  await ready(true);
}
async function leave() {
  await locate({ x: 0, z: 447 });
  await page
    .getByRole('button', { name: 'To Outside Mines', exact: true })
    .click();
  await ready(false);
}
async function inspect(name, eye, target, location) {
  await locate(location);
  await page.evaluate(
    ({ eye, target }) => {
      const g = window.__mineQA,
        T = window.__mineThree;
      g.paused = true;
      cancelAnimationFrame(g.frame);
      g.actor.visible = false;
      const camera = new T.PerspectiveCamera(58, 1920 / 1080, 0.1, 300);
      camera.position.fromArray(eye);
      camera.lookAt(...target);
      camera.updateMatrixWorld();
      g.mineInterior.update(camera, g.hero, performance.now() / 1000);
      g.renderer.render(g.scene, camera);
    },
    { eye, target },
  );
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.evaluate(() => {
    const g = window.__mineQA;
    g.actor.visible = true;
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
  await ready(false);
  check(
    'exterior still has 129 monsters',
    await page.evaluate(() => window.__mineQA.enemies.length === 129),
  );
  await locate({ x: 220, z: -35 });
  check(
    'distant entrance click rejected',
    await page.evaluate(() => {
      const g = window.__mineQA;
      g.interactIronveilEntrance();
      return !g.hero.interiorId && !g.transitioning;
    }),
  );
  await enter();
  await screenshot('entrance-follow');
  check(
    'shell loaded and within total triangle budget',
    await page.evaluate(() => {
      const m = window.__mineQA.mineInterior.metrics();
      return m.shellTriangles > 100000 && m.totalTriangles < 500000;
    }),
  );
  check(
    'arrival is interior with 480 monsters and disabled outdoor lighting',
    await page.evaluate(() => {
      const g = window.__mineQA;
      return (
        g.hero.interiorId === 'ironveil-mines-interior-v1' &&
        g.hero.x === 0 &&
        g.hero.z === 436 &&
        g.enemies.length === 480 &&
        !g.worldLightRig.visible &&
        !g.ironveil &&
        !g.terrain.visible &&
        !g.shrine.visible
      );
    }),
  );
  check(
    'teleport functions reject all exits and direct entry',
    await page.evaluate(() => {
      const g = window.__mineQA;
      return (
        !g.changeRegion('averion') &&
        !g.changeRegion('ironveil-mines-exterior-v1') &&
        !g.changeRegion('ironveil-mines-interior-v1')
      );
    }),
  );
  await page.keyboard.press('m');
  await page.getByText('LOCAL CAVE MAP', { exact: true }).waitFor();
  check(
    'M opens only local map without travel or return city buttons',
    (await page.locator('.region-card').count()) === 0 &&
      (await page
        .getByRole('button', {
          name: /Return to city|Teleport field|Enter Ironveil Mines/,
        })
        .count()) === 0,
  );
  await screenshot('local-map');
  await page.keyboard.press('Escape');
  if(process.env.IRONVEIL_QA_LIGHTING) {
    const attachments=await page.evaluate(async()=>{
      const g=window.__mineQA,T=window.__mineThree,{mineLanterns}=await import('/lib/game/ironveil-interior-layout.ts');
      const walls=[],timber=[];g.mineInterior.root.updateMatrixWorld(true);
      g.mineInterior.root.traverse(o=>{if(o.isMesh){if(o.userData.surface==='rock')walls.push(o);if(o.material?.color?.getHexString()==='aa8657')timber.push(o);}});
      const failures=[];
      for(const [i,l] of mineLanterns().entries()){
        const mount=new T.Vector3(l.mount.x,l.mount.y,l.mount.z);
        const origin=l.support==='wall'?new T.Vector3(l.x,l.mount.y,l.z):mount.clone().add(new T.Vector3(0,-2,0));
        const ray=new T.Raycaster(origin,mount.clone().sub(origin).normalize(),0,origin.distanceTo(mount)+1);
        const hit=ray.intersectObjects(l.support==='wall'?walls:timber,false).sort((a,b)=>a.point.distanceTo(mount)-b.point.distanceTo(mount))[0];
        if(!hit||hit.point.distanceTo(mount)>(l.support==='wall'?.16:.4))failures.push({i,support:l.support,offset:hit?.point.distanceTo(mount),light:l});
      }
      return {failures,metrics:g.mineInterior.metrics()};
    });
    console.log('LANTERN_ATTACHMENTS',JSON.stringify(attachments));
    check('every wall bracket and chain is attached to actual rendered rock or timber',attachments.failures.length===0);
    check('all 280 lights hang, with zero floor-mounted lanterns',attachments.metrics.wallLanterns+attachments.metrics.beamLanterns===280&&attachments.metrics.floorLanterns===0);
    await inspect('receiving-wall-lights',[12,10,375],[-20,7,332],{x:0,z:340});
    await inspect('tunnel-hanging-lights',[0,4,413],[0,17,386],{x:0,z:413});
    for(const roomId of ['A','C1','D']){
      await locate(MINE_ROOMS.find(r=>r.id===roomId));
      await page.evaluate(()=>{const g=window.__mineQA;g.setCameraMode('follow');g.invincible=0;g.enemies.forEach(e=>e.cooldown=100);g.renderPerformance.reset();});
      await screenshot(`wall-lighting-${roomId}`);
      await page.waitForTimeout(2500);
      performance.push({roomId,...await page.evaluate(()=>window.__mineQA.getPerformanceDiagnostics())});
    }
    check('no unexpected browser errors',errors.length===0);
  }
  if (!process.env.IRONVEIL_QA_QUICK && !process.env.IRONVEIL_QA_LIGHTING) {
    for (const room of MINE_ROOMS) {
      await locate(room);
      await page.waitForTimeout(90);
      check(
        `room ${room.id} has valid grounding`,
        await page.evaluate(() => {
          const g = window.__mineQA;
          return (
            g.mineInterior.navigation.valid(g.hero) &&
            Math.abs(
              g.actor.position.y -
                g.mineInterior.groundHeight(g.hero.x, g.hero.z),
            ) < 0.05
          );
        }),
      );
    }
    // Exercise every actual movement segment (including the bridge), never teleport over walls.
    for (const route of MINE_CURVES) {
      await locate(route.id === 'main' ? MINE_ENTRY : route.points[0]);
      check(
        `walk ${route.id}`,
        await page.evaluate((points) => {
          const g = window.__mineQA;
          for (const target of points.slice(1)) {
            const p = g.mineInterior.move(
              g.hero,
              target.x - g.hero.x,
              target.z - g.hero.z,
            );
            if (Math.hypot(p.x - target.x, p.z - target.z) > 0.2) return false;
            g.invincible = 100000;
            Object.assign(g.hero, p);
          }
          g.placeActor();
          g.cameraFocus.copy(g.actor.position);
          return true;
        }, route.points),
      );
    }
    for (const id of ['A', 'C1', 'D']) {
      await locate(MINE_ROOMS.find((r) => r.id === id));
      await screenshot(`chamber-${id}`);
    }
    await inspect('ceiling-vault', [0, 6, 380], [0, 27, 345], { x: 0, z: 380 });
    await inspect('bridge-fissure', [164, 5, 158], [148, -7, 149], {
      x: 155,
      z: 145,
    });
    for (const quality of ['office', 'light', 'balanced', 'high'])
      for (const mode of ['follow', 'free']) {
        await locate(MINE_ENTRY);
        await page.evaluate(
          ({ quality, mode }) => {
            const g = window.__mineQA;
            g.setGraphicsQuality(quality, false);
            g.setCameraMode(mode);
          },
          { quality, mode },
        );
        await page.waitForTimeout(1500);
        const result = await page.evaluate(() => {
          const g = window.__mineQA;
          return {
            metrics: g.mineInterior.metrics(),
            position: g.camera.position.toArray(),
            diagnostics: g.getPerformanceDiagnostics(),
            sun: g.worldLightRig.visible,
          };
        });
        check(
          `${quality}/${mode} stays indoors and uses bounded light pool`,
          !result.sun &&
            result.metrics.activeLights <=
              { office: 4, light: 6, balanced: 8, high: 10 }[quality],
        );
        check(
          `${quality}/${mode} camera near plane remains inside shell`,
          await page.evaluate(async () => {
            const g = window.__mineQA,
              T = window.__mineThree,
              { mineDistance, mineCeiling, mineGroundHeight } =
                await import('/lib/game/ironveil-interior-layout.ts');
            for (const x of [-1, 0, 1])
              for (const y of [-1, 0, 1]) {
                const p = new T.Vector3(x, y, -1).unproject(g.camera);
                if (
                  mineDistance(p.x, p.z) < 0 ||
                  p.y < mineGroundHeight(p.x, p.z) ||
                  p.y > mineCeiling(p.x, p.z)
                )
                  return false;
              }
            return true;
          }),
        );
        performance.push({ quality, mode, ...result });
        await screenshot(`entrance-${quality}-${mode}`);
      }
    // Walking must translate the orbit without introducing any yaw/pitch rotation.
    for (const mode of ['follow', 'free']) {
      await locate({ x: 0, z: 340 });
      await page.evaluate((mode) => {
        const g = window.__mineQA;
        g.setCameraMode(mode);
        g.invincible = 100000;
      }, mode);
      await page.waitForTimeout(2200);
      const before = await page.evaluate(() => ({
        q: window.__mineQA.camera.quaternion.toArray(),
        x: window.__mineQA.hero.x,
        z: window.__mineQA.hero.z,
      }));
      await page.keyboard.down('w');
      await page.waitForTimeout(1200);
      await page.keyboard.up('w');
      const after = await page.evaluate(() => ({
        q: window.__mineQA.camera.quaternion.toArray(),
        x: window.__mineQA.hero.x,
        z: window.__mineQA.hero.z,
      }));
      check(
        `${mode} walking preserves camera orientation`,
        Math.abs(before.q.reduce((sum, v, i) => sum + v * after.q[i], 0)) >
          0.99999 && Math.hypot(after.x - before.x, after.z - before.z) > 1,
      );
      await screenshot(`walking-${mode}`);
    }
    await inspect('steel-rail-turnout', [12, 12, 370], [-15, -2, 341], {
      x: 0,
      z: 340,
    });
    check(
      'interior combat, independent respawn and safe entrance',
      await page.evaluate(() => {
        const g = window.__mineQA,
          e = g.enemies.find(
            (e) => e.hp > 0 && e.home.z < 350 && e.home.z > 300,
          );
        const exteriorCount = g.hero.fieldProgress[g.hero.currentField] ?? 0;
        Object.assign(g.hero, { x: e.home.x + 1, z: e.home.z });
        g.placeActor();
        g.hurtEnemy(e, 1000000, 0);
        const key = e.respawnKey,
          deadline = g.hero.monsterRespawnState[key];
        g.respawn();
        return (
          e.hp === 0 &&
          deadline > Date.now() &&
          g.hero.monsterRespawnState[key] === deadline &&
          (g.hero.fieldProgress[g.hero.currentField] ?? 0) === exteriorCount &&
          g.hero.x === 0 &&
          g.hero.z === 436
        );
      }),
    );
    await page.evaluate(() => window.__mineQA.setCameraMode('follow'));
    await locate(MINE_ROOMS.find((r) => r.id === 'C1'));
    await page.evaluate(() => window.__mineQA.save());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page
      .getByRole('button', { name: 'CONTINUE', exact: true })
      .click({ timeout: 60000 });
    await ready(true);
    check(
      'save reload resumes interior location',
      await page.evaluate(() => {
        const g = window.__mineQA;
        return g.hero.x === -20 && g.hero.z === -70 && g.enemies.length === 480;
      }),
    );
    check(
      'invalid position recovery stays on interior floor',
      await page.evaluate(() => {
        const g = window.__mineQA;
        g.hero.x = 9000;
        g.hero.z = 9000;
        g.restoreSavedPosition();
        g.placeActor();
        return g.isMineInterior && g.mineInterior.navigation.valid(g.hero);
      }),
    );
    check(
      'death respawns at the interior entrance',
      await page.evaluate(() => {
        const g = window.__mineQA;
        g.dead = true;
        g.hero.hp = 0;
        g.respawn();
        return (
          !g.dead && g.hero.x === 0 && g.hero.z === 436 && g.isMineInterior
        );
      }),
    );
    await leave();
    check(
      'exit returns to exterior staging, with original population',
      await page.evaluate(() => {
        const g = window.__mineQA;
        return (
          !g.hero.interiorId &&
          g.hero.x === 220 &&
          g.hero.z === -35 &&
          g.enemies.length === 129
        );
      }),
    );
    for (let i = 0; i < 10; i++) {
      await enter();
      await leave();
      memory.push(
        await page.evaluate(() => ({
          ...window.__mineQA.renderer.info.memory,
        })),
      );
    }
    check(
      'ten round trips do not accumulate GPU resources',
      memory.at(-1).geometries <= memory[1].geometries + 8 &&
        memory.at(-1).textures <= memory[1].textures + 2,
    );
    injectingFailure = true;
    await page.route('**/ironveil-mines-interior-v1/cave-shell.glb', (route) =>
      route.abort(),
    );
    await locate({ x: 220, z: -49 });
    await page
      .getByRole('button', { name: 'To Inside Mines', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Retry', exact: true })
      .waitFor({ timeout: 60000 });
    check(
      'failed interior load locks movement without teleporting away',
      await page.evaluate(() => {
        const g = window.__mineQA,
          p = { x: g.hero.x, z: g.hero.z };
        g.move(10, 10);
        return (
          !!g.regionLoadError &&
          g.hero.interiorId === 'ironveil-mines-interior-v1' &&
          g.hero.x === p.x &&
          g.hero.z === p.z
        );
      }),
    );
    await page.unroute('**/ironveil-mines-interior-v1/cave-shell.glb');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await ready(true);
    injectingFailure = false;
    check('Retry completes the same pending interior arrival');
    await page.evaluate(() => {
      const g = window.__mineQA;
      g.setGraphicsQuality('light', false);
      g.renderPerformance.reset();
    });
    await page.waitForTimeout(12000);
    performance.push({
      representative: 'Medium entrance 12 second sample',
      ...(await page.evaluate(() =>
        window.__mineQA.getPerformanceDiagnostics(),
      )),
    });
    for (const roomId of ['C1', 'D']) {
      await locate(MINE_ROOMS.find((r) => r.id === roomId));
      await page.evaluate(() => window.__mineQA.renderPerformance.reset());
      await page.waitForTimeout(8000);
      const metrics = await page.evaluate(() => {
        const g = window.__mineQA,
          visible = g.actor.visible;
        g.actor.visible = false;
        const enemyVisibility = g.enemies.map((e) => e.group.visible);
        g.enemies.forEach((e) => (e.group.visible = false));
        g.renderer.render(g.scene, g.camera);
        const environment = { ...g.renderer.info.render };
        g.actor.visible = visible;
        g.enemies.forEach((e, i) => (e.group.visible = enemyVisibility[i]));
        g.renderer.render(g.scene, g.camera);
        return { ...g.getPerformanceDiagnostics(), environment };
      });
      performance.push({ representative: `Medium ${roomId}`, ...metrics });
      check(
        `${roomId} visible geometry and texture budget`,
        metrics.environment.triangles <= 250000 &&
          metrics.ironveilInterior.textureMiB <= 96,
      );
      check(
        `${roomId} environment draw-call budget`,
        metrics.environment.calls <= 120,
      );
    }
    check('no unexpected browser errors', errors.length === 0);
  }
} finally {
  await writeFile(
    `${out}/results.json`,
    JSON.stringify({ checks, errors, performance, memory }, null, 2),
  );
  await browser.close();
}
