// Real Chrome/GPU, disposable storage. Never render benchmark maps concurrently.
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const maps = (
  process.env.SUNKEN_MAPS ??
  'verdant-plains-v2,whispering-wilds-v2,sunken-ruins'
).split(',');
const qualities = (
  process.env.SUNKEN_QUALITIES ?? 'office,light,balanced,high'
).split(',');
const seconds = Number(process.env.SUNKEN_SAMPLE_SECONDS ?? 60);
await mkdir('output/sunken-ruins', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const map of maps)
    for (const quality of qualities) {
      const page = await browser.newPage({
          viewport: { width: 1280, height: 720 },
        }),
        errors = [],
        assetRequests = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('response', (r) => {
        if (/\/(assets|__sunken-dev)\//.test(r.url()) && r.ok())
          assetRequests.push({
            url: new URL(r.url()).pathname,
            bytes: Number(r.headers()['content-length'] ?? 0),
          });
      });
      await page.goto(`http://127.0.0.1:3002/sunken-ruins.html?map=${map}`);
      await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
      await page.waitForFunction(
        () =>
          window.__sunkenQA?.game?.started &&
          !window.__sunkenQA.game.transitioning &&
          !window.__sunkenQA.game.regionLoadError,
        null,
        { timeout: 180000 },
      );
      await page.evaluate(async (quality) => {
        const qa = window.__sunkenQA,
          g = qa.game;
        await g.characterModel.ready;
        g.setGraphicsQuality(quality, false);
        g.invincible = 0;
        qa.paths = qa.pathsByMap[g.hero.currentField];
        qa.originalMove = g.moveVector.bind(g);
        qa.originalRecord = g.renderPerformance.record.bind(
          g.renderPerformance,
        );
        qa.maxHP = qa.rules.derivedStats(g.hero).maxHP;
      }, quality);
      await page.waitForTimeout(10000);
      for (let sample = 0; sample < 3; sample++) {
        await page.evaluate((sample) => {
          const qa = window.__sunkenQA,
            g = qa.game;
          g.setCameraMode(sample === 1 ? 'free' : 'follow');
          g.paused = false;
          g.dead = false;
          g.hero.hp = qa.maxHP;
          g.keys.clear();
          g.moveVector = qa.originalMove;
          const path = g.isSunken
            ? sample === 2
              ? qa.paths[5].points
              : qa.paths[0].points.slice(2)
            : sample === 2
              ? [...qa.paths[0].points].reverse()
              : qa.paths[0].points;
          let start = path[0];
          if (sample === 1) {
            if (g.isSunken) {
              start = { x: 108, z: -116 };
              const f = qa.FIELDS['sunken-ruins'];
              [
                f.normalMonsters[0],
                f.normalMonsters[1],
                f.eliteMonsters[0],
                f.fieldBoss,
              ].forEach((d, i) =>
                g.makeEnemy(
                  990 + i,
                  start.x + (i - 1.5) * 3,
                  start.z - 5 - i,
                  i === 3,
                  d,
                ),
              );
            } else {
              const e =
                g.enemies.find(
                  (e) => e.definition?.variant === 'elite' && e.hp > 0,
                ) ?? g.enemies[0];
              start = { x: e.home.x + 4, z: e.home.z + 4 };
            }
          }
          Object.assign(g.hero, start);
          g.placeActor();
          g.cameraFocus.copy(g.actor.position);
          if (sample !== 1) {
            let index = 1;
            g.moveVector = (v = new qa.three.Vector3()) => {
              let target = path[index];
              if (!target) return v.set(0, 0, 0);
              if (Math.hypot(target.x - g.hero.x, target.z - g.hero.z) < 1) {
                index++;
                target = path[index];
              }
              return target
                ? v.set(target.x - g.hero.x, 0, target.z - g.hero.z).normalize()
                : v.set(0, 0, 0);
            };
          }
        }, sample);
        await page.waitForTimeout(3000);
        await page.evaluate(() => {
          const qa = window.__sunkenQA,
            g = qa.game;
          window.__profile = {
            frame: [],
            cpu: [],
            calls: [],
            triangles: [],
            previous: 0,
            travel: 0,
            x: g.hero.x,
            z: g.hero.z,
          };
          g.renderPerformance.record = (timestamp, cpu) => {
            const p = window.__profile;
            if (p.previous) p.frame.push(timestamp - p.previous);
            p.previous = timestamp;
            p.cpu.push(cpu);
            p.calls.push(g.renderer.info.render.calls);
            p.triangles.push(g.renderer.info.render.triangles);
            p.travel += Math.hypot(g.hero.x - p.x, g.hero.z - p.z);
            p.x = g.hero.x;
            p.z = g.hero.z;
            g.hero.hp = qa.maxHP;
            qa.originalRecord(timestamp, cpu);
          };
        });
        // Short waits allow the runner to report progress while measuring real frames.
        for (let elapsed = 0; elapsed < seconds; elapsed += 10)
          await page.waitForTimeout(Math.min(10, seconds - elapsed) * 1000);
        const result = await page.evaluate(() => {
          const qa = window.__sunkenQA,
            g = qa.game,
            p = window.__profile;
          g.moveVector = qa.originalMove;
          const q = (a, n) => {
            a.sort((a, b) => a - b);
            return a.length ? a[Math.floor((a.length - 1) * n)] : null;
          };
          return {
            diagnostics: g.getPerformanceDiagnostics(),
            frames: p.frame.length,
            p50: q(p.frame, 0.5),
            p95: q(p.frame, 0.95),
            p99: q(p.frame, 0.99),
            cpuP95: q(p.cpu, 0.95),
            drawCallsP95: q(p.calls, 0.95),
            trianglesP95: q(p.triangles, 0.95),
            travel: p.travel,
          };
        });
        const assets = [
          ...new Map(assetRequests.map((a) => [a.url, a])).values(),
        ];
        results.push({
          map,
          quality,
          sample,
          scenario: sample === 1 ? 'crowded-free' : 'traversal-follow',
          seconds,
          ...result,
          assets,
          assetBytes: assets.reduce((n, a) => n + a.bytes, 0),
          errors: [...errors],
        });
        console.log(
          JSON.stringify({
            map,
            quality,
            sample,
            frames: result.frames,
            p95: result.p95,
            cpu: result.cpuP95,
            calls: result.drawCallsP95,
            travel: result.travel,
            errors,
          }),
        );
        await writeFile(
          `output/sunken-ruins/${process.env.SUNKEN_REPORT ?? 'comparison'}.json`,
          JSON.stringify(results, null, 2),
        );
        await page.screenshot({
          path: `output/sunken-ruins/perf-${map}-${quality}-${sample}.png`,
        });
      }
      await page.screenshot({
        path: `output/sunken-ruins/${map}-${quality}.png`,
      });
      await page.close();
    }
} finally {
  await browser.close();
}
