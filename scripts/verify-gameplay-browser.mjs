import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Optional local Playwright installation; no downloads or personal browser profile.
const output = 'outputs/gameplay-migration';
mkdirSync(output, { recursive: true });
if (existsSync(output + '/browser-validation.json')) copyFileSync(output + '/browser-validation.json', output + '/browser-attempt-' + Date.now() + '.json');
const report = { kind: 'isolated-browser-canonical-fixture', status: 'not-run',
  fullGameplayParity: false, personalSaveAccess: false, errors: [], warnings: [], failedResponses: [], blockedExternalRequests: [] };
let server, browser;
try {
  if (!process.env.PLAYWRIGHT_MODULE) throw Error('Local PLAYWRIGHT_MODULE is required; no automatic install');
  const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
  server = await createServer({ configFile: false, root: resolve('tests/browser'), publicDir: resolve('public'),
    plugins: [react()], resolve: { alias: { '@': process.cwd() } },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [process.cwd()] } } });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/') || /^(data|blob):/.test(url)) return route.continue();
    report.blockedExternalRequests.push(url); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (['warning','error'].includes(message.type())) report.warnings.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.failedResponses.push({url:response.url(),status:response.status()}); });
  await page.goto(origin + '/canonical-gameplay.html', { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('#canonical-results').waitFor({ timeout: 30000 });
  const evidence = JSON.parse(await page.locator('#canonical-results').innerText());
  assert(evidence.worldMatches && evidence.displayMatches && evidence.saveRoundtrip);
  assert.equal(evidence.sp80, 199); assert.equal(evidence.sp100, 199);
  assert.equal(evidence.criticalDamage, 150);
  assert.deepEqual(report.errors, []);
  report.browser = browser.version(); report.evidence = evidence;
  report.buttons = await page.getByRole('button').allTextContents();
  const advanced = page.getByRole('button', { name: 'Advanced Stats', exact: true });
  await advanced.click();
  assert.equal(await advanced.getAttribute('aria-expanded'), 'true');
  await advanced.focus(); await page.keyboard.press('Enter');
  assert.equal(await advanced.getAttribute('aria-expanded'), 'false');
  report.inputChecks = ['Advanced Stats expands on mouse click', 'Advanced Stats collapses on keyboard Enter'];
  await page.screenshot({ path: output + '/canonical-browser.png', fullPage: true });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.failedResponses, []);
  report.status = 'passed-fixture';
  report.limitations = ['Synthetic in-memory hero; no personal storage', 'World damage sink uses render/audio stubs',
    'No full-world movement/combat input, AI, collision, or 120-second boss parity validation',
    'Screenshot requires separate visual inspection'];
} catch (error) {
  report.status = 'failed'; report.failure = String(error); process.exitCode = 1;
} finally {
  await browser?.close(); await server?.close();
  writeFileSync(output + '/browser-validation.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
