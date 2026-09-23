import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const url = process.env.FIXTURE_URL ?? 'http://127.0.0.1:3002/warrior-lineage-final-ui.html';
const outDir = path.resolve('tests/browser/warrior-lineage-final-ui-evidence');
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport:{ width:1600, height:1050 } });
const errors = { console:[], warnings:[], page:[], requests:[], http:[] };
page.on('console', (message) => { if (message.type()==='error') errors.console.push(message.text()); if (message.type()==='warning') errors.warnings.push(message.text()); });
page.on('pageerror', (error) => errors.page.push(String(error)));
page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
page.on('response', (response) => { if(response.status()>=400) errors.http.push(`${response.status()} ${response.url()}`); });
const evidence = { cases:{}, errors, status:'FAIL' };
try {
  await page.goto(url, { waitUntil:'domcontentloaded' });
  await page.locator('[data-boot-stage="ready"]').waitFor();
  const state = page.getByTestId('lineage-state');
  assert.equal(await state.getAttribute('data-level'), '15');
  await page.getByRole('button', { name:/^Warrior/ }).click();
  assert.equal(await state.getAttribute('data-core'), 'warrior');
  assert.equal(await state.getAttribute('data-sp'), '14');
  evidence.cases.warrior = { level:15, core:'warrior', sp:14 };
  await page.getByRole('button', { name:'Set Level 60' }).click();
  assert.equal(await state.getAttribute('data-sp'), '90');
  assert.equal(await page.getByRole('button', { name:/^Berserker Available/ }).isEnabled(), true);
  assert.equal(await page.getByRole('button', { name:/^Blade Master Available/ }).isEnabled(), true);
  await page.screenshot({ path:path.join(outDir,'01-specialization-trainer.png'), fullPage:true });

  await page.getByRole('button', { name:/^Berserker Available/ }).click();
  assert.equal(await state.getAttribute('data-specialization'), 'berserker');
  await page.getByText(/Berserker aktif/).waitFor();
  await page.getByRole('button', { name:'Job Skill K' }).click();
  assert.equal(await page.locator('[data-skill-id^="v3-berserker-"]').count(), 9);
  await page.screenshot({ path:path.join(outDir,'02-berserker-k-panel.png'), fullPage:true });
  evidence.cases.berserker = { selected:true, siblingUnavailable:true, skills:9 };

  await page.getByRole('button', { name:'Reset Warrior Lv60' }).click();
  await page.getByRole('button', { name:'Prepare Blade Master Dual' }).click();
  assert.equal(await state.getAttribute('data-specialization'), 'blade_master');
  assert.ok(await state.getAttribute('data-offhand'));
  await page.getByRole('button', { name:'Job Skill K' }).click();
  assert.equal(await page.locator('[data-skill-id^="v3-blade-master-"]').count(), 9);
  await page.locator('[data-skill-id="v3-blade-master-twin-assault"]').click();
  await page.getByText('Dual One-Hand Swords', { exact:true }).waitFor();
  await page.screenshot({ path:path.join(outDir,'03-blade-master-k-panel.png'), fullPage:true });
  await page.getByRole('button', { name:'Character Overview' }).click();
  await page.getByRole('button', { name:/Off Hand: Dawnblade/ }).waitFor();
  await page.screenshot({ path:path.join(outDir,'04-blade-master-overview.png'), fullPage:true });
  evidence.cases.bladeMaster = { selected:true, skills:9, dualOffhand:true, twinRequirement:'Dual One-Hand Swords' };

  evidence.saveIsolation = await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0);
  assert.equal(evidence.saveIsolation, true);
  assert.deepEqual(errors, { console:[], warnings:[], page:[], requests:[], http:[] });
  evidence.browser = await browser.version();
  evidence.status = 'PASS';
} catch (error) { evidence.failure=String(error); }
finally { await fs.writeFile(path.join(outDir,'validation.json'), JSON.stringify(evidence,null,2)); await browser.close(); }
console.log(JSON.stringify(evidence,null,2));
if(evidence.status!=='PASS') process.exitCode=1;
