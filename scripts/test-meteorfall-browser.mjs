// Isolated test browser and memory-only fixture; never touches owner saves.
import { chromium } from "../output/whispering-tools/node_modules/playwright/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const output = "work/meteorfall-citadel/revision3/qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [],
  checks = [];
let expectedFailure = false;
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !expectedFailure) errors.push(m.text());
});
const check = (name, condition) => {
  assert(condition, name);
  checks.push(name);
  console.log("PASS", name);
};
const ready = () =>
  page.waitForFunction(
    () =>
      window.__meteorfallQA?.game?.started &&
      !window.__meteorfallQA.game.transitioning &&
      !window.__meteorfallQA.game.regionLoadError &&
      window.__meteorfallQA.game.meteorfall,
    null,
    { timeout: 120000 },
  );
try {
  await page.goto("http://127.0.0.1:3006/meteorfall-citadel.html", {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("button", { name: "CONTINUE", exact: true })
    .click({ timeout: 120000 });
  await ready();
  await page.waitForTimeout(1800);
  const state = await page.evaluate(() => {
    const g = window.__meteorfallQA.game;
    return {
      field: g.hero.currentField,
      position: { x: g.hero.x, y: g.actor.position.y, z: g.hero.z },
      enemies: g.enemies.length,
      npcs: g.npcLabels.length,
      metrics: g.getPerformanceDiagnostics(),
    };
  });
  console.log(JSON.stringify(state));
  check(
    "Meteorfall loads with 288 normals, five elites, one boss and one NPC",
    state.field === "meteorfall-citadel" &&
      state.enemies === 294 &&
      state.npcs === 1,
  );
  check(
    "save parser admits the 1000-unit arrival without legacy clamp",
    state.position.x === 0 &&
      state.position.z === 380 &&
      state.position.y === 0,
  );
  await page.screenshot({ path: `${output}/arrival.png` });
  await page.keyboard.press("m");
  await page
    .getByRole("button", { name: "Enter Meteorfall Citadel", exact: true })
    .waitFor();
  check(
    "M exposes one Meteorfall entry",
    (await page
      .getByRole("button", { name: "Enter Meteorfall Citadel", exact: true })
      .count()) === 1,
  );
  await page.screenshot({ path: `${output}/world-map.png` });
  await page.keyboard.press("Escape");
  const overview = await page.evaluate(() => {
    const { game: g, three: T } = window.__meteorfallQA;
    g.paused = false;
    g.invincible = Infinity;
    cancelAnimationFrame(g.frame);
    g.frame = 0;
    const cam = new T.OrthographicCamera(-720, 720, 450, -450, 0.1, 1600);
    cam.position.set(60, 420, 620);
    cam.lookAt(0, -30, 0);
    cam.updateMatrixWorld();
    g.meteorfall.update(cam, g.hero, 0);
    g.renderer.render(g.scene, cam);
    return g.renderer.domElement.toDataURL("image/png");
  });
  await writeFile(
    `${output}/overview.png`,
    Buffer.from(overview.split(",")[1], "base64"),
  );
  const traversal = await page.evaluate(() => {
    const { game: g, layout: l, three: T } = window.__meteorfallQA,
      failures = [],
      heightErrors = [];
    g.paused = false;
    const maxRadius = Math.max(
      ...g.enemies.map(
        (e) =>
          e.group.children[0]?.userData.navigationRadius ??
          (e.boss ? 1.8 : 0.55),
      ),
    );
    const ray = new T.Raycaster();
    for (const b of l.METEORFALL_BRIDGES)
      for (const [a, c] of [
        [b.a, b.b],
        [b.b, b.a],
      ]) {
        Object.assign(g.hero, a);
        g.placeActor();
        g.move(c.x - a.x, c.z - a.z);
        g.placeActor();
        if (Math.hypot(g.hero.x - c.x, g.hero.z - c.z) > 0.001)
          failures.push(b.id);
        if (!g.meteorfall.navigation.clear(a, c, maxRadius))
          failures.push(b.id + " monster");
        for (let i = 0; i <= 10; i++)
          for (const offset of [
            -b.clearWidth / 2 + 0.6,
            0,
            b.clearWidth / 2 - 0.6,
          ]) {
            const p = l.meteorBridgePoint(b, i / 10, offset);
            ray.set(new T.Vector3(p.x, 200, p.z), new T.Vector3(0, -1, 0));
            const hit = ray.intersectObject(g.meteorfall.surfaces, true)[0];
            heightErrors.push(
              hit ? Math.abs(hit.point.y - l.meteorGroundHeight(p)) : 999,
            );
          }
      }
    for (const p of l.METEORFALL_PLATFORMS) {
      Object.assign(g.hero, p);
      g.placeActor();
      g.move(1500, 1500);
      if (!g.meteorfall.navigation.valid(g.hero))
        failures.push(p.id + " long displacement");
    }
    ray.set(new T.Vector3(490, 200, -490), new T.Vector3(0, -1, 0));
    const voidHits = ray.intersectObject(g.meteorfall.surfaces, true).length;
    const e = g.enemies.find((e) => e.id === 100),
      before = e.group.position.clone();
    g.moveEnemy(e, 2000, 2000);
    const bossSafe = g.meteorfall.navigation.valid(e.group.position, maxRadius);
    e.group.position.copy(before);
    Object.assign(g.hero, l.METEORFALL_ENTRY);
    g.placeActor();
    g.cameraFocus.copy(g.actor.position);
    g.setCameraMode("follow");
    g.updateCamera(0);
    g.meteorfall.update(g.camera, g.hero, 0);
    return {
      failures,
      maxRadius,
      maxHeightError: Math.max(...heightErrors),
      voidHits,
      bossSafe,
    };
  });
  console.log("TRAVERSAL", JSON.stringify(traversal));
  check(
    "all 28 bridge traversals, swept displacement and boss movement stay on ground",
    !traversal.failures.length && traversal.bossSafe,
  );
  check(
    "bridge render and height query agree; void has no raycast floor",
    traversal.maxHeightError < 0.0001 && traversal.voidHits === 0,
  );
  const camera = await page.evaluate(() => {
    const { game: g, layout: l, three: T } = window.__meteorfallQA;
    const ray = new T.Raycaster(),
      bad = [];
    let samples = 0;
    for (const p of [
      l.METEORFALL_ENTRY,
      { x: 0, z: 30 },
      { x: 0, z: -350 },
      { x: 22, z: -258 },
      l.meteorBridgePoint(l.METEORFALL_BRIDGES[3], 0.5),
    ])
      for (const distance of [2.2, 28])
        for (const pitch of [0.08, 1.25])
          for (let i = 0; i < 24; i++) {
            const focus = new T.Vector3(
                p.x,
                l.meteorGroundHeight(p) + 1.65,
                p.z,
              ),
              wanted = focus
                .clone()
                .add(
                  new T.Vector3(
                    Math.sin((i * Math.PI) / 12) * Math.cos(pitch) * distance,
                    Math.sin(pitch) * distance,
                    Math.cos((i * Math.PI) / 12) * Math.cos(pitch) * distance,
                  ),
                );
            const actual = g.meteorfall.constrainCamera(focus, wanted).clone();
            if (!Number.isFinite(actual.x + actual.y + actual.z))
              bad.push("nonfinite");
            const dir = actual.clone().sub(focus),
              length = dir.length();
            ray.set(focus, dir.normalize());
            ray.far = length - 0.05;
            const blockers = [
              "Twelve crown pylons",
              "Crown silhouettes",
              "Open fortress ring",
              "Pylon cornices",
              "Fortress coping",
              "Fortress battlements",
            ].map((n) => g.meteorfall.root.getObjectByName(n));
            if (ray.intersectObjects(blockers, true).length)
              bad.push({ p, distance, pitch, i });
            samples++;
          }
    return { samples, bad };
  });
  check(
    "full camera orbits at minimum/maximum zoom avoid fortress geometry",
    camera.bad.length === 0,
  );
  await page.evaluate(() => {
    const g = window.__meteorfallQA.game;
    Object.assign(g.hero, { x: 25, z: 375 });
    g.placeActor();
    g.cameraFocus.copy(g.actor.position);
    g.updateCamera(0);
    g.renderer.render(g.scene, g.camera);
    g.start();
  });
  check(
    "existing NPC services open at the new arrival anchor",
    await page.evaluate(() => {
      const g = window.__meteorfallQA.game;
      return (
        g.openNpc("field-npc-meteor") &&
        g.currentNpc.services.join(",") === "buy,sell,teleport,quest"
      );
    }),
  );
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.evaluate(() => {
    const { game: g, layout: l } = window.__meteorfallQA;
    Object.assign(g.hero, l.METEORFALL_EXIT);
    g.placeActor();
    g.cameraFocus.copy(g.actor.position);
  });
  await page.waitForTimeout(350);
  await page
    .getByRole("button", { name: "Jayantara · Click to travel", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      window.__meteorfallQA.game.hero.inCity &&
      !window.__meteorfallQA.game.transitioning,
  );
  check(
    "return portal reaches the existing city",
    await page.evaluate(
      () => window.__meteorfallQA.game.hero.currentCity === "jayantara",
    ),
  );
  await page.keyboard.press("m");
  await page
    .getByRole("button", { name: "Enter Meteorfall Citadel", exact: true })
    .click();
  await ready();
  check(
    "M travel returns to arrival",
    await page.evaluate(() => window.__meteorfallQA.game.hero.z === 380),
  );
  // Failed asset transaction releases partial loads and existing retry UI rebuilds it.
  await page.evaluate(() =>
    window.__meteorfallQA.game.changeRegion("jayantara"),
  );
  await page.waitForFunction(() => !window.__meteorfallQA.game.transitioning);
  expectedFailure = true;
  await page.route(
    "**/assets/maps/meteorfall-citadel/meteor-monolith.glb",
    (route) => route.abort("failed"),
  );
  await page.evaluate(() =>
    window.__meteorfallQA.game.changeRegion("meteorfall-citadel"),
  );
  await page.waitForFunction(
    () =>
      !!window.__meteorfallQA.game.regionLoadError &&
      !window.__meteorfallQA.game.transitioning,
  );
  check(
    "failed map load holds movement",
    await page.evaluate(() => {
      const g = window.__meteorfallQA.game,
        p = { x: g.hero.x, z: g.hero.z };
      g.move(100, 100);
      return g.hero.x === p.x && g.hero.z === p.z && !g.meteorfall;
    }),
  );
  await page.unroute("**/assets/maps/meteorfall-citadel/meteor-monolith.glb");
  await page.getByRole("button", { name: /retry/i }).click();
  await ready();
  expectedFailure = false;
  check(
    "Retry recovers the failed transaction",
    await page.evaluate(() => !!window.__meteorfallQA.game.meteorfall),
  );
  const cycles = [];
  for (let i = 0; i < 10; i++) {
    const instanceDisposal = await page.evaluate(async () => {
      const g = window.__meteorfallQA.game;
      let count = 0,
        disposed = 0;
      g.meteorfall.root.traverse((o) => {
        if (o.isInstancedMesh) {
          count++;
          o.addEventListener("dispose", () => disposed++);
        }
      });
      await g.changeRegion("jayantara");
      return { count, disposed };
    });
    check(
      `exit ${i + 1} releases every instance buffer`,
      instanceDisposal.count > 0 &&
        instanceDisposal.count === instanceDisposal.disposed,
    );
    await page.waitForFunction(() => !window.__meteorfallQA.game.transitioning);
    await page.waitForTimeout(150);
    cycles.push(
      await page.evaluate(() => ({
        geometries: window.__meteorfallQA.game.renderer.info.memory.geometries,
        textures: window.__meteorfallQA.game.renderer.info.memory.textures,
        npcLabels: window.__meteorfallQA.game.npcLabels.length,
        portalLabels: window.__meteorfallQA.game.portalLabels.length,
      })),
    );
    const blocked = await page.evaluate(() => {
      const g = window.__meteorfallQA.game;
      g.changeRegion("meteorfall-citadel");
      return g.changeRegion("jayantara") === false;
    });
    check(`loading transaction ${i + 1} rejects overlapping travel`, blocked);
    await ready();
  }
  check(
    "ten exits restore stable geometry, texture and label counts",
    cycles
      .slice(2)
      .every((c) => JSON.stringify(c) === JSON.stringify(cycles[2])),
  );
  const benchmarks = [];
  for (const quality of ["office", "light"])
    for (const [name, x, z, rotate] of [
      ["entry", 0, 380, false],
      ["intersection", 0, 30, false],
      ["bridge", 0, -215, false],
      ["citadel", 0, -300, false],
      ["orbit", 0, -350, true],
    ]) {
      await page.evaluate(
        ({ quality, x, z }) => {
          const g = window.__meteorfallQA.game;
          g.setGraphicsQuality(quality, false);
          g.invincible = Infinity;
          Object.assign(g.hero, { x, z });
          g.placeActor();
          g.cameraFocus.copy(g.actor.position);
          g.setCameraMode("follow");
          g.followView.distance = g.followView.targetDistance = 28;
          g.followView.yaw = g.followView.targetYaw = 0;
          g.updateCamera(0);
        },
        { quality, x, z },
      );
      await page.waitForTimeout(1200);
      await page.evaluate(() =>
        window.__meteorfallQA.game.renderPerformance.reset(),
      );
      if (rotate)
        await page.evaluate(() => {
          const g = window.__meteorfallQA.game;
          window.__meteorOrbit = setInterval(() => {
            g.followView.yaw += 0.06;
            g.followView.targetYaw = g.followView.yaw;
          }, 30);
        });
      await page.waitForTimeout(4200);
      if (rotate)
        await page.evaluate(() => clearInterval(window.__meteorOrbit));
      const result = await page.evaluate(() => {
        const g = window.__meteorfallQA.game;
        const d = g.getPerformanceDiagnostics(),
          objects = [g.actor, ...g.enemies.map((e) => e.group)],
          previous = objects.map((o) => o.visible);
        objects.forEach((o) => (o.visible = false));
        g.renderer.render(g.scene, g.camera);
        const environment = { ...g.renderer.info.render };
        objects.forEach((o, i) => (o.visible = previous[i]));
        return { ...d, environment };
      });
      benchmarks.push({ view: name, ...result });
      console.log(
        "BENCH",
        quality,
        name,
        JSON.stringify({
          fps: result.fpsMedian,
          p95: result.frameMs.p95,
          environment: result.environment,
        }),
      );
      if (quality === "light")
        await page.screenshot({ path: `${output}/${name}-medium.png` });
    }
  const proxies = [];
  for (const count of [4, 12]) {
    await page.evaluate((count) => {
      const { game: g, three: T } = window.__meteorfallQA;
      const root = new T.Group();
      root.name = "QA player proxies";
      for (let i = 0; i < count; i++) {
        const clone = window.__meteorfallQA.cloneActor();
        clone.position.set(
          g.hero.x + Math.sin((i * 6.28) / count) * 7,
          g.actor.position.y,
          g.hero.z + Math.cos((i * 6.28) / count) * 7,
        );
        root.add(clone);
      }
      g.scene.add(root);
      window.__meteorProxies = root;
    }, count);
    await page.waitForTimeout(1000);
    await page.evaluate(() =>
      window.__meteorfallQA.game.renderPerformance.reset(),
    );
    await page.waitForTimeout(4200);
    proxies.push({
      count,
      kind: "Static render proxies sharing actor assets; no networking or independent animation",
      ...(await page.evaluate(() =>
        window.__meteorfallQA.game.getPerformanceDiagnostics(),
      )),
    });
    await page.evaluate(() => window.__meteorProxies.removeFromParent());
  }
  await writeFile(
    `${output}/runtime-report.json`,
    JSON.stringify(
      { checks, errors, state, traversal, camera, cycles, benchmarks, proxies },
      null,
      2,
    ),
  );
  check("no unexpected runtime or shader errors", errors.length === 0);
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` });
  console.log(
    "FAILURE STATE",
    JSON.stringify(
      await page.evaluate(() => {
        const g = window.__meteorfallQA?.game;
        return {
          text: document.body.innerText.slice(-4000),
          labels: g?.portalLabels.map((p) => ({ html: p.element.outerHTML })),
          hero: g && { x: g.hero.x, z: g.hero.z },
          frame: g?.frame,
          paused: g?.paused,
          started: g?.started,
          camera: g?.camera.position.toArray(),
          aria: document.querySelector(".world-labels")?.outerHTML,
        };
      }),
    ),
  );
  throw error;
} finally {
  await browser.close();
}
