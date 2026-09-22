// Isolated browser save; never attaches to or edits the player's browser data.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { freshHero, SAVE_KEY } from '../lib/game/rules.ts';
import { VERDANT_TERRAIN } from '../lib/game/field-terrain.ts';
import { FIELD_NPCS } from '../lib/game/regions.ts';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const label = process.argv[2] || 'after';
const out = resolve('work/arunika-material');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const hero = freshHero();
Object.assign(hero, { characterName: 'Material QA', inCity: false, currentField: 'verdant-plains', level: 50 }, VERDANT_TERRAIN.entry);
await context.addInitScript(({ key, hero }) => {
  localStorage.setItem(key, JSON.stringify({ version: 3, activeSlot: 'slot-1', characters: { 'slot-1': hero } }));
}, { key: SAVE_KEY, hero });
const page = await context.newPage(), errors = [];
const animationChecks=[];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.route('**/lib/game/world.ts*', async route => {
  const response = await route.fetch();
  const body = (await response.text()).replace('this.renderer = new T.WebGLRenderer', 'window.__materialQA = this; this.renderer = new T.WebGLRenderer');
  await route.fulfill({ response, body });
});
try {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByRole('button', { name: 'Lanjutkan perjalanan', exact: true }).click();
  await page.waitForFunction(() => window.__materialQA?.started && window.__materialQA.terrainSurface?.material.normalMap?.image, null, { timeout: 60000 });
  if (label.startsWith('grass')) await page.waitForFunction(() =>
    window.__materialQA?.terrainSurface?.material.userData.grassMaterialId &&
    window.__materialQA.regionDecor.getObjectByName('field-grass-tufts')?.userData.grassMaterialId, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const movement = await page.evaluate(() => {
    const g = window.__materialQA, before = { x: g.hero.x, z: g.hero.z };
    g.move(1, 0);
    return Math.hypot(g.hero.x - before.x, g.hero.z - before.z);
  });
  assert(movement > .1, 'movement remains available');
  await page.evaluate(() => {
    const g = window.__materialQA;
    g.pause(true);
    // Freeze camera updates only in this QA instance for identical A/B framing.
    g.updateCamera = () => {};
    g.camera = g.freeCamera;
  });
  async function capture(name, x, z, halfHeight, offset) {
    await page.evaluate(({ x, z, halfHeight, offset, name }) => {
      const g = window.__materialQA, y = g.groundHeight(x, z), a = g.host.clientWidth / g.host.clientHeight;
      g.hero.x = x + (name === 'tufts' ? .85 : 0); g.hero.z = z; g.placeActor();
      Object.assign(g.camera, { left: -halfHeight * a, right: halfHeight * a, top: halfHeight, bottom: -halfHeight });
      g.camera.position.set(x + offset[0], y + offset[1], z + offset[2]);
      g.camera.lookAt(x, y, z); g.camera.updateProjectionMatrix(); g.camera.updateMatrixWorld();
      g.renderer.render(g.scene, g.camera);
    }, { x, z, halfHeight, offset, name });
    await page.waitForTimeout(250);
    await page.screenshot({ path: resolve(out, `${label}-${name}.png`) });
    if(label.startsWith('overhaul')&&['gate','camp','pond','shrine'].includes(name)) {
      const result=await page.evaluate(()=>{
        const g=window.__materialQA;if(!g.arunikaMaterials)return null;
        const gl=g.renderer.getContext(),time=g.arunikaMaterials.time;
        const sample=()=>{g.renderer.render(g.scene,g.camera);const bytes=new Uint8Array(600*480*4);gl.readPixels(450,240,600,480,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};
        const saved=time.value,before=sample();time.value+=2.35;const after=sample();time.value=saved;
        let changed=0;for(let i=0;i<before.length;i+=4)if(Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2])>2)changed++;
        return changed;
      });
      if(result!==null){assert.ok(result>50,`${name} surface animation visible`);animationChecks.push({name,changedPixels:result});}
    }
  }
  await capture('entry', 51, 72, 13, [12, 23, 23]);
  if (label.startsWith('overhaul')) {
    await capture('camp', 46, 81, 7, [10, 13, 15]);
    await capture('gate', 56, 96, 9, [12, 14, 18]);
    await capture('temple', -6, -106, 12, [18, 18, 22]);
    await capture('farm', -72, 46, 14, [14, 22, 20]);
    await capture('bridge', 50, -2, 13, [16, 24, 18]);
    await capture('pond', 86, 46, 11, [13, 19, 16]);
    await capture('shrine', 24, 64, 6, [7, 10, 12]);
    const landmarks=await page.evaluate(()=>{
      const g=window.__materialQA;
      return {tent:g.fieldTerrain.props.find(p=>p.kind==='tent'),fall:g.regionDecor.getObjectByName('waterfall')?.position.toArray()};
    });
    if(landmarks.tent)await capture('tent',landmarks.tent.x,landmarks.tent.z,4,[7,7,9]);
    if(landmarks.fall)await capture('waterfall',landmarks.fall[0],landmarks.fall[2],11,[-20,4,22]);
  }
  if (label.startsWith('grass')) {
    const tuft = await page.evaluate(() => {
      const mesh = window.__materialQA.regionDecor.getObjectByName('field-grass-tufts');
      // Find a grass tuft near the player from its existing instance transforms.
      const transforms = mesh.instanceMatrix.array;
      let best = null, distance = Infinity;
      for (let i=0;i<mesh.count;i++) {
        const x=transforms[i*16+12],z=transforms[i*16+14],d=Math.hypot(x-51,z-72);
        if(d<distance){distance=d;best={x,z};}
      }
      return best;
    });
    await capture('tufts', tuft.x, tuft.z, 2.5, [3, 4, 4]);
  }
  await capture('detail', 30, 40, 7, [9, 16, 15]);
  const lighting = label === 'before' ? null : await page.evaluate(() => {
    const g = window.__materialQA, material = g.terrainSurface.material, gl = g.renderer.getContext();
    function pixels() {
      g.renderer.render(g.scene, g.camera);
      const data = new Uint8Array(500*500*4);
      gl.readPixels(450, 190, 500, 500, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return data;
    }
    function difference(a, b) { let changed = 0; for (let i=0; i<a.length; i+=4) if (Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]) > 0) changed++; return changed; }
    const original = pixels(), scale = material.normalScale.clone();
    material.normalScale.setScalar(0); const flat = pixels(); material.normalScale.copy(scale);
    const roughness = material.roughnessMap, canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'black'; ctx.fillRect(0, 0, 2, 2);
    // Texture.clone shares Source; use an independent texture for a real A/B comparison.
    const smoothMap = new roughness.constructor(canvas);
    smoothMap.wrapS = roughness.wrapS; smoothMap.wrapT = roughness.wrapT;
    smoothMap.needsUpdate = true; material.roughnessMap = smoothMap; material.needsUpdate = true;
    const smooth = pixels(); material.roughnessMap = roughness; smoothMap.dispose();
    const shadows = g.renderer.shadowMap.enabled;
    g.renderer.shadowMap.enabled = false; material.needsUpdate = true; pixels();
    g.renderer.shadowMap.enabled = shadows; material.needsUpdate = true; pixels();
    return { normalChangedPixels: difference(original, flat), roughnessChangedPixels: difference(original, smooth), glError: gl.getError() };
  });
  if (lighting) {
    console.log('Lighting response', JSON.stringify(lighting));
    assert.ok(lighting.normalChangedPixels > 1000, 'normal map changes visible lighting');
    assert.ok(lighting.roughnessChangedPixels > 100, 'roughness map changes visible lighting');
    assert.equal(lighting.glError, 0);
  }
  await capture('overview', 0, 12, 78, [0, 120, 60]);
  const metrics = await page.evaluate(async () => {
    const g = window.__materialQA, material = g.terrainSurface.material;
    const frameTimes = [];
    let last = performance.now();
    await new Promise(resolve => {
      const frame = t => { frameTimes.push(t - last); last = t; if (frameTimes.length < 100) requestAnimationFrame(frame); else resolve(); };
      requestAnimationFrame(frame);
    });
    frameTimes.sort((a,b) => a-b);
    return { draws: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles,
      terrainTriangles: g.terrainSurface.geometry.index.count / 3, enemies: g.enemies.length,
      material: material.userData, frameMsMedian: frameTimes[50], frameMsP95: frameTimes[95],
      materialPass: g.arunikaMaterials ? {families:[...new Set([...g.arunikaMaterials.cache.values()].map(m=>m.name))],materialCount:g.arunikaMaterials.cache.size,animatedTime:g.arunikaMaterials.time.value}:null,
      grassTufts: (() => { const mesh=g.regionDecor.getObjectByName('field-grass-tufts'); return mesh ? {
        count:mesh.count,trianglesPerTuft:mesh.geometry.index.count/3,material:mesh.material.name,
        alphaTest:mesh.material.alphaTest,normalResolution:mesh.material.normalMap?.image.width,
        source:mesh.material.userData.grassSource } : null; })(),
      programs: g.renderer.info.programs.map(p => ({ name: p.name, runnable: p.diagnostics?.runnable })),
      normal: material.normalMap.image.width, roughness: material.roughnessMap?.image.width };
  });
  assert.equal(metrics.terrainTriangles, 6144);
  assert.equal(metrics.enemies, 42);
  const travelChecks = label === 'before' ? null : await page.evaluate(({ npc, bridge, camp }) => {
    const g = window.__materialQA;
    g.hero.x = bridge.x; g.hero.z = bridge.z + bridge.length / 2 + 2; g.placeActor();
    g.move(0, -bridge.length-4);
    const crossed = g.hero.z < bridge.z - bridge.length / 2;
    g.hero.x = camp.x; g.hero.z = camp.z; g.placeActor();
    const npcOpened = g.openNpc(npc.id); g.closeNpcMenu();
    const others = ['arunika', 'east-gate-arunika', 'ironveil-mines'].map(id => {
      const moved = g.changeRegion(id);
      const shrineMaterials=[];g.shrine.traverse(o=>{if(o.isMesh)shrineMaterials.push(o.material.name);});
      return { id, moved, rocky: Boolean(g.terrainSurface?.material.userData.terrainMaterialRevision),arunikaPalette:!!g.arunikaMaterials,shrineMaterials };
    });
    const returned = g.changeRegion('verdant-plains');
    return { crossed, npcOpened, others, returned };
  }, { npc: FIELD_NPCS['verdant-plains'], bridge: VERDANT_TERRAIN.bridges[1], camp: VERDANT_TERRAIN.camp });
  if (travelChecks) {
    assert.ok(travelChecks.crossed && travelChecks.npcOpened && travelChecks.returned);
    assert.ok(travelChecks.others.every(region => region.moved && !region.rocky));
    assert.ok(travelChecks.others.every(region => !region.arunikaPalette && region.shrineMaterials.every(name=>!name.startsWith('arunika.'))));
    await page.waitForFunction(() => window.__materialQA.terrainSurface?.material.userData.terrainMaterialRevision >= 2);
  }
  assert.deepEqual(errors, [], 'no shader/console/runtime errors');
  await writeFile(resolve(out, `${label}-results.json`), JSON.stringify({ movement, lighting, animationChecks, travelChecks, metrics, errors }, null, 2));
  console.log(JSON.stringify({ label, movement, lighting, animationChecks, travelChecks, ...metrics, programs: metrics.programs.length, errors }));
} finally { await browser.close(); }
