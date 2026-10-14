import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(
  new URL('../work/character-tools/package.json', import.meta.url),
);
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const out = 'output/character-customization';
await mkdir(out, { recursive: true });
const errors = [],
  requests = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('request', (r) => requests.push(r.url()));
await page.addInitScript(() => {
  window.__previewMatrices = {};
  window.__previewModelViews = [];
  window.__previewDraws = 0;
  const names = new WeakMap();
  for (const type of [WebGLRenderingContext, WebGL2RenderingContext]) {
    // Capture the native method, then explicitly restore its receiver via call.
    // eslint-disable-next-line typescript/unbound-method
    const locate = type.prototype.getUniformLocation;
    type.prototype.getUniformLocation = function (program, name) {
      const result = locate.call(this, program, name);
      if (result) names.set(result, name);
      return result;
    };
    const matrix = type.prototype.uniformMatrix4fv;
    type.prototype.uniformMatrix4fv = function (
      location,
      transpose,
      value,
      ...rest
    ) {
      const name = names.get(location);
      if (
        this.canvas.closest?.('.character-preview') &&
        ['projectionMatrix', 'viewMatrix', 'modelViewMatrix'].includes(name)
      ) {
        window.__previewMatrices[name] = Array.from(value);
        if (name === 'modelViewMatrix')
          window.__previewModelViews.push(Array.from(value));
      }
      return matrix.call(this, location, transpose, value, ...rest);
    };
    for (const name of ['drawElements', 'drawArrays']) {
      const original = type.prototype[name];
      type.prototype[name] = function (...args) {
        if (this.canvas.closest?.('.character-preview'))
          window.__previewDraws++;
        return original.apply(this, args);
      };
    }
  }
});
try {
  await page.goto('http://localhost:3000/');
  await page.getByRole('button', { name: 'NEW GAME', exact: true }).click();
  await page
    .getByRole('button', { name: 'CREATE CHARACTER', exact: true })
    .click();
  await page
    .getByText('Memuat karakter...', { exact: true })
    .waitFor({ state: 'hidden', timeout: 60000 });
  await page.waitForTimeout(1000);
  if (await page.getByRole('tab', { name: 'Facial Hair', exact: true }).count())
    throw Error('Facial Hair tab remains');
  await page.getByRole('tab', { name: 'Skin', exact: true }).click();
  const camera = await page.evaluate(() => window.__previewMatrices);
  if (!camera.projectionMatrix || !camera.modelViewMatrix)
    throw Error('No preview camera matrices captured');
  const originalViews = await page.evaluate(() => window.__previewModelViews);
  for (const tab of ['Hairstyle', 'Hair Color', 'Skin']) {
    await page.evaluate(() => (window.__previewModelViews = []));
    await page.getByRole('tab', { name: tab, exact: true }).click();
    if (tab === 'Hairstyle')
      await page.getByRole('button', { name: 'Mohawk', exact: true }).click();
    await page.waitForTimeout(350);
    const actual = await page.evaluate(() => window.__previewMatrices);
    const renderedViews = await page.evaluate(() => window.__previewModelViews);
    if (
      renderedViews.length &&
      !renderedViews.some((a) =>
        originalViews.some((b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-5)),
      )
    )
      throw Error(`Character framing changed on ${tab}`);
    for (const name of ['projectionMatrix'])
      if (camera[name].some((v, i) => Math.abs(v - actual[name][i]) > 1e-5))
        throw Error(
          `Camera moved on ${tab}: ${name}; before=${camera[name]} after=${actual[name]}`,
        );
  }
  for (const name of ['Very Fair', 'Fair', 'Medium', 'Tan', 'Dark']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(150);
    await page
      .locator('.character-preview')
      .screenshot({ path: `${out}/skin-${name.replaceAll(' ', '-')}.png` });
  }
  await page.getByRole('tab', { name: 'Hair Color', exact: true }).click();
  const plane = page.getByRole('slider', {
    name: 'Hair saturation and brightness',
  });
  const bounds = await plane.boundingBox();
  await page.mouse.click(
    bounds.x + bounds.width * 0.72,
    bounds.y + bounds.height * 0.28,
  );
  const hex = page.getByRole('textbox', { name: 'Hair color hex' });
  if (!/^#[a-f\d]{6}$/i.test(await hex.inputValue()))
    throw Error('Picker did not generate HEX');
  await page.getByRole('slider', { name: 'Hair hue', exact: true }).focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await plane.focus();
  const before = await hex.inputValue();
  await page.keyboard.press('ArrowDown');
  if (before === (await hex.inputValue()))
    throw Error('Picker keyboard brightness failed');
  await page
    .getByRole('spinbutton', { name: 'Hair red', exact: true })
    .fill('255');
  if (!(await hex.inputValue()).startsWith('#ff'))
    throw Error('RGB input did not update HEX');
  await hex.fill('#33aacc');
  await hex.blur();
  if (
    (await page.getByRole('spinbutton', { name: 'Hair red' }).inputValue()) !==
    '51'
  )
    throw Error('HEX to RGB did not update');
  await hex.fill('#oops');
  await hex.blur();
  if ((await hex.inputValue()) !== '#33aacc')
    throw Error('Invalid HEX mutated the color');
  await page.screenshot({ path: `${out}/picker.png` });
  await page.evaluate(() => (window.__previewDraws = 0));
  await page.waitForTimeout(2000);
  const idleDraws = await page.evaluate(() => window.__previewDraws);
  if (idleDraws > 8) throw Error('Preview rendering while idle');
  if (requests.some((u) => /facial_|facial-hair/.test(u)))
    throw Error('Facial hair asset requested');
  if (errors.length) throw Error(errors.join('\n'));
  const result = {
    tabsPreserveCamera: true,
    skinTones: 5,
    picker: {
      pointer: true,
      keyboard: true,
      rgb: true,
      hex: true,
      invalidHex: true,
    },
    facialHairRequests: 0,
    idleDraws,
    errors,
  };
  await writeFile(out + '/verification.json', JSON.stringify(result, null, 2));
  console.log(result);
} catch (e) {
  console.log(errors, await page.evaluate(() => window.__previewMatrices));
  await page.screenshot({ path: out + '/failure.png' });
  throw e;
} finally {
  await browser.close();
}
