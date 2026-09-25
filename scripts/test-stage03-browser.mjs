import { chromium } from 'file:///C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const dir = 'dev-prototypes/mahkota-fajar-stage03-v1/evidence';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    'http://127.0.0.1:3013/tests/browser/mahkota-fajar-stage03.html',
  );
  await page.waitForFunction(
    () =>
      window.stage03?.state().ready ||
      document.querySelector('#status')?.textContent?.startsWith('ERROR'),
    {},
    { timeout: 120000 },
  );
  console.log(await page.locator('#status').innerText());
  const state = await page.evaluate(() => window.stage03?.state());
  console.log(state);
  if (!state?.ready) throw Error('Stage03 failed loading');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/pilot-player.png` });
  if (process.argv.includes('--diagnose')) {
    await page.evaluate(() => {
      window.stage03.game.renderer.shadowMap.enabled = false;
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/no-shadow.png` });
  }
  await page.evaluate(() => window.stage03.setView('overview'));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${dir}/pilot-overview.png` });
  const anchors = await page.evaluate(() =>
    window.stage03.city.anchors.map((a) => ({
      id: a.id,
      position: a.position,
      clearance: window.stage03.city.collision.clearance(
        { x: a.position[0], z: a.position[2] },
        true,
      ),
    })),
  );
  console.log(anchors);
  const routes = await page.evaluate(() => {
    const { city, game } = window.stage03;
    const targets = [
      'warp',
      'guild',
      'merchant',
      'training',
      'job',
      'forge',
      'bank',
      'inn',
      'residential',
    ];
    const results = [];
    function route(a, b) {
      const size = 1.5,
        key = (p) => `${Math.round(p.x / size)},${Math.round(p.z / size)}`;
      const pos = (k) => {
        const [x, z] = k.split(',').map(Number);
        return { x: x * size, z: z * size };
      };
      const start = key(a),
        goal = key(b),
        open = [start],
        cost = new Map([[start, 0]]),
        prev = new Map(),
        closed = new Set();
      const h = (k) => Math.hypot(pos(k).x - b.x, pos(k).z - b.z);
      let found = false;
      while (open.length && closed.size < 50000) {
        open.sort((x, y) => cost.get(y) + h(y) - (cost.get(x) + h(x)));
        const k = open.pop();
        if (closed.has(k)) continue;
        if (k === goal) {
          found = true;
          break;
        }
        closed.add(k);
        const p = pos(k);
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, -1],
          [1, -1],
          [-1, 1],
        ]) {
          const q = { x: p.x + dx * size, z: p.z + dz * size },
            kk = key(q);
          if (closed.has(kk) || !city.collision.valid(q)) continue;
          const moved = city.move(p, q.x - p.x, q.z - p.z);
          if (Math.hypot(moved.x - q.x, moved.z - q.z) > 0.01) continue;
          const clearance = city.collision.clearance(q, true);
          const next =
            cost.get(k) + Math.hypot(dx, dz) * size + 4 / (clearance + 0.1);
          if (next < (cost.get(kk) ?? Infinity)) {
            cost.set(kk, next);
            prev.set(kk, k);
            open.push(kk);
          }
        }
      }
      if (!found) return null;
      const points = [b];
      let k = goal;
      while (k !== start) {
        points.unshift(pos(k));
        k = prev.get(k);
      }
      points.unshift(a);
      return points;
    }
    const anchor = (id) => {
      const a = city.anchors.find((a) => a.id === id);
      return { x: a.position[0], z: a.position[2] };
    };
    for (const target of targets) {
      const a = anchor('central'),
        b = anchor(target),
        path = route(a, b);
      if (!path) {
        results.push({ target, pass: false, reason: 'No route' });
        continue;
      }
      for (const reverse of [false, true]) {
        const points = reverse ? [...path].reverse() : path;
        game.hero.x = points[0].x;
        game.hero.z = points[0].z;
        game.placeActor();
        let distance = 0,
          pass = true;
        for (const q of points.slice(1)) {
          const p = { x: game.hero.x, z: game.hero.z };
          const delta = Math.hypot(q.x - p.x, q.z - p.z);
          const count = Math.max(1, Math.ceil(delta / 0.1));
          for (let i = 0; i < count; i++)
            game.move((q.x - p.x) / count, (q.z - p.z) / count);
          distance += delta;
          if (Math.hypot(game.hero.x - q.x, game.hero.z - q.z) > 0.15) {
            pass = false;
            break;
          }
        }
        results.push({
          target,
          reverse,
          pass,
          distance,
          estimatedWalkSeconds: distance / 7.564,
          points,
        });
      }
    }
    return results;
  });
  console.log(routes.map(({ points: _points, ...r }) => r));
  await writeFile(
    `${dir}/pilot-browser.json`,
    JSON.stringify({ state, anchors, routes, errors }, null, 2),
  );
  if (process.argv.includes('--final')) {
    await page.evaluate(() => {
      window.stage03.teleport('spawn');
      window.stage03.setView('player');
    });
    const keyboardStart = await page.evaluate(() => ({
      x: window.stage03.game.hero.x,
      z: window.stage03.game.hero.z,
    }));
    await page.locator('#world').click({ position: { x: 850, y: 650 } });
    await page.keyboard.down('a');
    await page.waitForTimeout(350);
    await page.keyboard.up('a');
    const keyboardMovement = await page.evaluate((p) => {
      const { game, city } = window.stage03;
      return (
        city.collision.valid(game.hero) &&
        Math.hypot(game.hero.x - p.x, game.hero.z - p.z) > 0.2
      );
    }, keyboardStart);
    const checks = await page.evaluate(() => {
      const { city, game } = window.stage03;
      const gl = game.renderer.getContext(),
        ext = gl.getExtension('WEBGL_debug_renderer_info');
      const hardware = {
        renderer: ext
          ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER),
        vendor: ext
          ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)
          : gl.getParameter(gl.VENDOR),
        userAgent: navigator.userAgent,
        cores: navigator.hardwareConcurrency,
        viewport: [innerWidth, innerHeight],
        dpr: devicePixelRatio,
      };
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      city.root.updateMatrixWorld(true);
      city.root.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox;
        for (let i = 0; i < (o.isInstancedMesh ? o.count : 1); i++) {
          const matrix = o.matrixWorld.clone();
          if (o.isInstancedMesh) {
            const local = matrix.clone();
            o.getMatrixAt(i, local);
            matrix.multiply(local);
          }
          for (const x of [b.min.x, b.max.x])
            for (const y of [b.min.y, b.max.y])
              for (const z of [b.min.z, b.max.z]) {
                const p = game.actor.position
                  .clone()
                  .set(x, y, z)
                  .applyMatrix4(matrix);
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minZ = Math.min(minZ, p.z);
                maxZ = Math.max(maxZ, p.z);
              }
        }
      });
      const boundary = city.move(city.spawn, 0, 300);
      const gateStart = { x: 0, z: 96 };
      const gateEnd = city.move(gateStart, 0, 30);
      const rampStart = { x: 0, z: -53 };
      const rampEnd = city.move(rampStart, 0, -8);
      const recovery = city.move({ x: NaN, z: NaN }, 1, 1);
      const blocker = city.manifest.blockers.find(
        (b) => b.kind === 'polygon' && b.id.includes('Grand_Hall'),
      );
      const center = blocker.points.reduce(
        (p, q) => ({
          x: p.x + q[0] / blocker.points.length,
          z: p.z + q[1] / blocker.points.length,
        }),
        { x: 0, z: 0 },
      );
      const focus = game.actor.position
        .clone()
        .set(
          center.x,
          blocker.minY + 1,
          Math.max(...blocker.points.map((p) => p[1])) + 5,
        );
      const desired = focus.clone().setZ(center.z - 8);
      const constrained = city.constrainCamera(focus, desired);
      return {
        hardware,
        bounds: {
          minX,
          maxX,
          minZ,
          maxZ,
          pass:
            minX >= -125.01 &&
            maxX <= 125.01 &&
            minZ >= -125.01 &&
            maxZ <= 125.01,
        },
        rootScale: city.root.scale.toArray(),
        spawn: city.collision.valid(city.spawn),
        boundaryBlocked: boundary.z < 110,
        gateBlocked: city.collision.valid(gateStart) && gateEnd.z < 104,
        stairRamp:
          Math.abs(rampEnd.z + 61) < 0.05 &&
          city.groundHeight(rampEnd.x, rampEnd.z) >
            city.groundHeight(rampStart.x, rampStart.z) + 0.5,
        roofExcluded: city.groundHeight(center.x, center.z) < blocker.maxY - 3,
        recovered: recovery.x === city.spawn.x && recovery.z === city.spawn.z,
        cameraCollision: constrained.distanceTo(desired) > 0.1,
        playerHeight: game.actor.userData.heightMeters,
      };
    });
    checks.keyboardMovement = keyboardMovement;
    const views = [
      'top',
      'overview',
      'center',
      'guild',
      'merchant',
      'training',
      'job',
      'forge',
      'warp',
      'player',
      'street',
    ];
    await page.evaluate(() => {
      window.stage03.teleport('spawn');
    });
    for (const view of views) {
      await page.evaluate((view) => window.stage03.setView(view), view);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${dir}/runtime-${view}.png` });
    }
    const timed = [];
    for (const r of routes.filter((r) => r.pass)) {
      const result = await page.evaluate(async (route) => {
        const { game, city } = window.stage03;
        window.stage03.setView('player');
        const path = route.reverse ? [...route.points].reverse() : route.points;
        game.hero.x = path[0].x;
        game.hero.z = path[0].z;
        game.placeActor();
        game.cameraFocus.copy(game.actor.position);
        game.clearInput();
        const start = performance.now();
        let i = 1,
          previous = start,
          distance = 0,
          minWidth = Infinity,
          maxDraws = 0,
          maxPrimaryTriangles = 0,
          maxTriangles = 0;
        const frameTimes = [];
        while (i < path.length && performance.now() - start < 60000) {
          await new Promise(requestAnimationFrame);
          const now = performance.now(),
            dt = now - previous;
          previous = now;
          frameTimes.push(dt);
          const q = path[i],
            dx = q.x - game.hero.x,
            dz = q.z - game.hero.z,
            d = Math.hypot(dx, dz);
          const step = Math.min(d, 7.564 * Math.min(dt / 1000, 0.05));
          const before = { x: game.hero.x, z: game.hero.z };
          if (d > 1e-5) game.move((dx / d) * step, (dz / d) * step);
          distance += Math.hypot(
            game.hero.x - before.x,
            game.hero.z - before.z,
          );
          minWidth = Math.min(
            minWidth,
            2 * city.collision.clearance(game.hero, true),
          );
          maxDraws = Math.max(maxDraws, game.renderer.info.render.calls);
          maxPrimaryTriangles = Math.max(
            maxPrimaryTriangles,
            window.stage03.state().primaryTriangles,
          );
          maxTriangles = Math.max(
            maxTriangles,
            game.renderer.info.render.triangles,
          );
          if (Math.hypot(q.x - game.hero.x, q.z - game.hero.z) < 0.08) i++;
        }
        frameTimes.sort((a, b) => a - b);
        return {
          target: route.target,
          reverse: route.reverse,
          pass: i === path.length,
          distance,
          walkSeconds: (performance.now() - start) / 1000,
          minimumObstacleClearWidth: minWidth,
          frameP95: frameTimes[Math.floor(frameTimes.length * 0.95)],
          frameAverage: frameTimes.reduce((a,b)=>a+b,0) / frameTimes.length,
          maxDraws,
          maxTriangles,
          maxPrimaryTriangles,
          frames: frameTimes.length,
        };
      }, r);
      timed.push(result);
      console.log('TIMED', result);
      if (!r.reverse)
        await page.screenshot({ path: `${dir}/destination-${r.target}.png` });
    }
    const reload = [];
    for (let i = 0; i < 3; i++) {
      await page.evaluate(async () => {
        await window.stage03.reload();
      });
      await page.waitForTimeout(500);
      reload.push(
        await page.evaluate(() => ({
          rootChildren: window.stage03.city.root.children.length,
          canvases: document.querySelectorAll('#world canvas').length,
          memory: window.stage03.game.renderer.info.memory,
          state: window.stage03.state(),
        })),
      );
    }
    const failure = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
    await failure.route('**/stage03-assets/runtime/collision.glb.gz', (route) =>
      route.abort(),
    );
    await failure.goto(
      'http://127.0.0.1:3013/tests/browser/mahkota-fajar-stage03.html',
    );
    await failure.waitForFunction(() =>
      document.querySelector('#status').textContent.startsWith('ERROR'),
    );
    const errorDisplayed = await failure.locator('#retry').isVisible();
    await failure.screenshot({ path: `${dir}/error-retry.png` });
    await failure.unroute('**/stage03-assets/runtime/collision.glb.gz');
    await failure.locator('#retry').click();
    await failure.waitForFunction(
      () => window.stage03?.state().ready,
      {},
      { timeout: 120000 },
    );
    const retryPassed = await failure.evaluate(
      () => window.stage03.state().ready,
    );
    await failure.close();
    await writeFile(
      `${dir}/final-browser.json`,
      JSON.stringify(
        {
          checks,
          anchors,
          routes: timed,
          reload,
          errorDisplayed,
          retryPassed,
          errors,
        },
        null,
        2,
      ),
    );
  }
} finally {
  await browser.close();
}
