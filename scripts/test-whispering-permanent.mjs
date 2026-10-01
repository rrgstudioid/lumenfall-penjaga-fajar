import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = 'output/whispering-permanent';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [],
  report = {};
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  await page.goto('http://127.0.0.1:3004/whispering-wilds.html');
  await page
    .getByRole('button', { name: 'CONTINUE', exact: true })
    .click({ timeout: 120000 });
  await page.waitForFunction(
    () =>
      window.__wildsQA?.game?.started && !window.__wildsQA.game.transitioning,
    null,
    { timeout: 120000 },
  );
  await page.keyboard.press('m');
  const card = page
    .locator('.region-card')
    .filter({
      has: page.getByRole('heading', { name: 'Whispering Wilds', exact: true }),
    });
  await card.waitFor();
  assert.equal(await card.count(), 1);
  report.cards = await page.locator('.region-card h3').allTextContents();
  assert(!report.cards.includes('Rimba Bisik'));
  assert.equal(
    report.cards.indexOf('Whispering Wilds'),
    report.cards.indexOf('Tambang Selubung Besi') + 1,
  );
  assert.equal(
    report.cards.indexOf('Frostfire Highlands'),
    report.cards.indexOf('Whispering Wilds') + 1,
  );
  assert.match(await card.innerText(), /16–24/);
  const enter = card.getByRole('button', {
    name: 'Enter Whispering Wilds',
    exact: true,
  });
  assert(await enter.isEnabled());
  await page.evaluate(() => {
    const g = window.__wildsQA.game;
    g.hero.level = 15;
    g.emit();
  });
  await page.waitForFunction(() => window.__wildsQA.game.hero.level === 15);
  await card
    .getByRole('button', { name: 'Membutuhkan level 16.', exact: true })
    .waitFor();
  assert(await card.getByRole('button').isDisabled());
  report.levelGate = await page.evaluate(() => {
    const g = window.__wildsQA.game;
    g.changeRegion('arunika');
    return g.hero.inCity;
  });
  await page.waitForFunction(() => !window.__wildsQA.game.transitioning);
  await page.evaluate(() =>
    window.__wildsQA.game.changeRegion('whispering-wilds-v2'),
  );
  assert(await page.evaluate(() => window.__wildsQA.game.hero.inCity));
  await page.evaluate(() => {
    const g = window.__wildsQA.game;
    g.hero.level = 16;
    g.emit();
  });
  if (!(await card.isVisible())) await page.keyboard.press('m');
  await enter.waitFor();
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/map-menu.png` });
  await enter.click();
  await page.waitForFunction(
    () => !window.__wildsQA.game.transitioning && window.__wildsQA.game.isWilds,
    null,
    { timeout: 120000 },
  );
  if (await card.isVisible()) await page.keyboard.press('m');
  await page.evaluate(() => {
    const g = window.__wildsQA.game;
    g.paused = true;
    g.updateCamera = () => {};
  });
  report.sky = [];
  for (const quality of ['office', 'balanced']) {
    const result = await page.evaluate((quality) => {
      const { game: g, three: T, layout: l } = window.__wildsQA;
      g.setWildsQuality(quality, false);
      g.camera = new T.PerspectiveCamera(65, 1400 / 900, 0.1, 1400);
      const p = { x: -190, z: 280 };
      Object.assign(g.hero, p);
      g.placeActor();
      const y = l.wildsGroundHeight(p.x, p.z) + 5;
      g.camera.position.set(p.x, y, p.z);
      g.camera.lookAt(p.x + 80, y + 170, p.z - 160);
      g.camera.updateMatrixWorld();
      g.wilds.update(g.camera, g.hero, 0.1, g.renderer.getPixelRatio());
      g.renderer.render(g.scene, g.camera);
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(g.renderer.domElement, 0, 0, 120, 80);
      const data = ctx.getImageData(0, 0, 120, 60).data;
      const rgb = [0, 0, 0];
      for (let i = 0; i < data.length; i += 4)
        for (let j = 0; j < 3; j++) rgb[j] += data[i + j] / (data.length / 4);
      return { rgb, png: g.renderer.domElement.toDataURL().split(',')[1] };
    }, quality);
    await writeFile(
      `${output}/${quality}-cyan-sky.png`,
      Buffer.from(result.png, 'base64'),
    );
    delete result.png;
    assert(
      result.rgb[2] > 45 && result.rgb[1] > 20 && result.rgb[2] > result.rgb[0],
    );
    report.sky.push({ quality, ...result });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ ...report, errors }, null, 2),
  );
  console.log(
    'PASS one forest in the correct M-menu order, level15 blocked / level16 enabled, working travel and visible cyan-blue sky at Low/High',
  );
} finally {
  await browser.close();
}
