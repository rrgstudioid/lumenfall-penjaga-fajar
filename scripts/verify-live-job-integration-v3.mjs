import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  SAVE_KEY,
  createV3JobDevelopmentHero,
} from '../lib/game/rules.ts';
import { CITIES } from '../lib/game/regions.ts';

const runtime =
  process.env.CODEX_NODE_MODULES ||
  'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = await import(
  pathToFileURL(`${runtime}/playwright/index.mjs`).href
);
const origin = process.env.LUMENFALL_JOB_TEST_URL || 'http://127.0.0.1:3014/';
const out = resolve('output/spv3-7a2-live-job-evidence');
await mkdir(out, { recursive: true });

const trainer = CITIES.jayantara.npcList.find((npc) => npc.id === 'jaya-1');
assert.ok(trainer, 'Specialization trainer jaya-1 must exist');

function fixtureHero(level = 60) {
  const hero = createV3JobDevelopmentHero('warrior-60');
  hero.slotId = 'slot-1';
  hero.characterId = `live-job-${level}-${Date.now()}`;
  hero.characterName = `Live Job QA Lv${level}`;
  hero.level = level;
  hero.currentCity = 'jayantara';
  hero.inCity = true;
  hero.x = trainer.x;
  hero.z = trainer.z;
  hero.lastSafePosition = { x: trainer.x, z: trainer.z };
  return hero;
}

function saveCollection(hero) {
  return {
    version: 3,
    activeSlot: hero.slotId,
    lastPlayedCharacterId: hero.characterId,
    characters: { [hero.slotId]: hero },
  };
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const results = [];

async function openGame(hero) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  const warnings = [];
  const failedRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  page.on('requestfailed', (request) =>
    failedRequests.push(`${request.failure()?.errorText ?? 'FAILED'} ${request.url()}`),
  );
  await page.route('**/lib/game/world.ts*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      'this.renderer = new T.WebGLRenderer',
      'window.__liveJobQA = this; this.renderer = new T.WebGLRenderer',
    );
    await route.fulfill({ response, body });
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: SAVE_KEY, value: saveCollection(hero) },
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page
    .getByRole('button', {
      name: /^(Lanjutkan perjalanan|Buat karakter & mulai|CONTINUE|ENTER WORLD)$/i,
    })
    .first()
    .click();
  await page.waitForFunction(() => window.__liveJobQA?.started, { timeout: 120000 });
  await page.evaluate(() => {
    const game = window.__liveJobQA;
    game.renderer.setAnimationLoop(null);
    cancelAnimationFrame(game.frame);
  });
  return { context, page, errors, warnings, failedRequests };
}

async function openTrainer(page) {
  const opened = await page.evaluate(() => {
    const game = window.__liveJobQA;
    game.actor.position.set(game.hero.x, 0, game.hero.z);
    return game.openNpc('jaya-1');
  });
  assert.equal(opened, true);
  await page.locator('.npc-menu-dialog').waitFor();
  await page.getByRole('button', { name: 'Job', exact: true }).click();
  await page.locator('.class-panel').waitFor();
}

async function closePanel(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
}

try {
  // Case A: both specializations are visible but locked below level 60.
  {
    const session = await openGame(fixtureHero(59));
    const { page, context, errors, warnings, failedRequests } = session;
    await openTrainer(page);
    const choices = page.locator('[data-v3-specialization-choices] .class-choice');
    assert.equal(await choices.count(), 2);
    assert.deepEqual(await choices.locator('strong').allTextContents(), ['Berserker', 'Blade Master']);
    assert.equal(
      await page.locator('[data-v3-specialization-choices] .class-choice:not(:disabled)').count(),
      0,
    );
    assert.equal(await choices.getByText('Requires Level 60', { exact: true }).count(), 2);
    await page.screenshot({ path: resolve(out, '01-lv59-specializations-locked.png'), fullPage: true });
    results.push({
      case: 'A',
      level: 59,
      choices: ['Berserker', 'Blade Master'],
      enabledChoices: 0,
      errors,
      warnings,
      failedRequests,
    });
    await context.close();
  }

  // Case B: choose Berserker through the actual trainer, inspect K/C, then reload.
  {
    const session = await openGame(fixtureHero(60));
    const { page, context, errors, warnings, failedRequests } = session;
    await openTrainer(page);
    const choices = page.locator('[data-v3-specialization-choices] .class-choice');
    assert.equal(
      await page.locator('[data-v3-specialization-choices] .class-choice:not(:disabled)').count(),
      2,
    );
    await choices.filter({ hasText: 'Berserker' }).click();
    await page.waitForFunction(() => window.__liveJobQA.hero.specialization === 'berserker');
    await page.screenshot({ path: resolve(out, '02-berserker-selected.png'), fullPage: true });

    await closePanel(page);
    await page.keyboard.press('k');
    await page.locator('.job-skill').waitFor();
    assert.equal(await page.locator('.js-node').count(), 9);
    assert.match(await page.locator('.job-skill').innerText(), /Berserker/);
    assert.doesNotMatch(await page.locator('.job-skill').innerText(), /Twin Blade Mastery/);
    await page.screenshot({ path: resolve(out, '03-berserker-k-panel.png'), fullPage: true });

    await page.keyboard.press('k');
    await page.keyboard.press('c');
    await page.locator('[data-character-dashboard]').waitFor();
    const identity = await page.locator('[data-v3-job-identity]').innerText();
    assert.match(identity, /Core Job:\s*Warrior/);
    assert.match(identity, /Specialization:\s*Berserker/);
    await page.screenshot({ path: resolve(out, '04-berserker-character-overview.png'), fullPage: true });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: /^(Lanjutkan perjalanan|CONTINUE)$/i }).first().click();
    await page.waitForFunction(() => window.__liveJobQA?.started, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__liveJobQA.hero.specialization), 'berserker');
    results.push({
      case: 'B',
      selected: 'berserker',
      skillCount: 9,
      identity,
      reloadPersisted: true,
      errors,
      warnings,
      failedRequests,
    });
    await context.close();
  }

  // Case C/D: choose Blade Master, verify no automatic Dual Wield, K/C and reload.
  {
    const session = await openGame(fixtureHero(60));
    const { page, context, errors, warnings, failedRequests } = session;
    await openTrainer(page);
    const choices = page.locator('[data-v3-specialization-choices] .class-choice');
    await choices.filter({ hasText: 'Blade Master' }).click();
    await page.waitForFunction(() => window.__liveJobQA.hero.specialization === 'blade_master');
    const beforeMastery = await page.evaluate(() => ({
      specialization: window.__liveJobQA.hero.specialization,
      capability: window.__liveJobQA.hero.capabilities?.canDualWieldOneHandSwords ?? false,
      masteryRank:
        window.__liveJobQA.hero.skillProgressionV3?.skillRanks?.[
          'v3-blade-master-twin-blade-mastery'
        ] ?? 0,
    }));
    assert.deepEqual(beforeMastery, {
      specialization: 'blade_master',
      capability: false,
      masteryRank: 0,
    });
    await page.screenshot({ path: resolve(out, '05-blade-master-selected.png'), fullPage: true });

    await closePanel(page);
    await page.keyboard.press('k');
    await page.locator('.job-skill').waitFor();
    assert.equal(await page.locator('.js-node').count(), 9);
    const skillPanelText = await page.locator('.job-skill').innerText();
    assert.match(skillPanelText, /Blade Master/);
    assert.match(skillPanelText, /Twin Blade Mastery/);
    assert.doesNotMatch(skillPanelText, /Raging Cleave/);
    const masteryNode = page.locator('[data-skill-id="v3-blade-master-twin-blade-mastery"]');
    assert.equal(await masteryNode.count(), 1);
    await masteryNode.click();
    assert.match(await page.locator('.js-detail').innerText(), /Available/i);
    assert.equal(await page.locator('.js-learn:not(:disabled)').count(), 1);
    await page.screenshot({ path: resolve(out, '06-blade-master-k-panel.png'), fullPage: true });

    await page.keyboard.press('k');
    await page.keyboard.press('c');
    await page.locator('[data-character-dashboard]').waitFor();
    const identity = await page.locator('[data-v3-job-identity]').innerText();
    assert.match(identity, /Core Job:\s*Warrior/);
    assert.match(identity, /Specialization:\s*Blade Master/);
    await page.screenshot({ path: resolve(out, '07-blade-master-character-overview.png'), fullPage: true });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: /^(Lanjutkan perjalanan|CONTINUE)$/i }).first().click();
    await page.waitForFunction(() => window.__liveJobQA?.started, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__liveJobQA.hero.specialization), 'blade_master');
    results.push({
      case: 'C/D',
      selected: 'blade_master',
      skillCount: 9,
      twinBladeMasteryPurchasable: true,
      dualWieldBeforeMastery: false,
      identity,
      reloadPersisted: true,
      errors,
      warnings,
      failedRequests,
    });
    await context.close();
  }

  for (const result of results) {
    assert.deepEqual(result.errors, [], `${result.case}: browser errors`);
    assert.deepEqual(result.failedRequests, [], `${result.case}: failed requests`);
  }
  await writeFile(
    resolve(out, 'results.json'),
    JSON.stringify({ status: 'PASS', origin, results }, null, 2),
  );
  console.log(JSON.stringify({ status: 'PASS', origin, results }, null, 2));
} catch (error) {
  await writeFile(
    resolve(out, 'results.json'),
    JSON.stringify({ status: 'FAIL', origin, results, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
