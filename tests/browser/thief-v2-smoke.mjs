import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = 'output/phase4c-browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  warnings = [],
  httpFailures = [];
page.on('response', (r) => {
  if (r.status() >= 400)
    httpFailures.push({ status: r.status(), url: r.url() });
});
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`${m.text()} @ ${m.location().url}`);
  if (m.type() === 'warning') warnings.push(m.text());
});
try {
  await page.goto(
    'http://127.0.0.1:3003/warrior-world.html?core=thief&level=59&build=all&sp=200',
    { waitUntil: 'networkidle', timeout: 60000 },
  );
  await page.screenshot({ path: `${out}/01-menu.png` });
  console.log('ENTRY', await page.locator('body').innerText());
  if (await page.locator('vite-error-overlay').count())
    throw Error('Vite overlay');
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForFunction(() => window.__warriorQA?.game?.started, {
    timeout: 60000,
  });
  await page.waitForFunction(() => document.querySelector('canvas')?.width > 0);
  await page.screenshot({ path: `${out}/02-world.png` });
  console.log('WORLD', await page.evaluate(() => window.__warriorQA.state()));
  await page.keyboard.press('k');
  await page
    .getByText('RESET SKILL', { exact: false })
    .first()
    .waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${out}/03-k-panel.png` });
  console.log('K', await page.locator('body').innerText());
  await page.keyboard.press('k');
  const setup = await page.evaluate(() => {
    const g = window.__warriorQA.game,
      e = g.enemies.find((e) => e.hp > 0);
    if (!e) throw Error('No actual map enemy');
    g.clearSkillRuntime();
    g.hero.x = e.group.position.x;
    g.hero.z = e.group.position.z + 2;
    g.placeActor();
    g.cameraFocus.copy(g.actor.position);
    // Controlled endurance fixture; production enemy catalog is unchanged.
    e.definition = {
      ...e.definition,
      name: 'DEV Thief endurance target',
      maxHP: 30000,
    };
    e.hp = e.max = 30000;
    g.setCurrentTarget(e);
    g.hero.hp = 100000;
    g.hero.mana = 100;
    g.skillCooldowns = {};
    const accepted = g.castSkill('v2-thief-smoke-veil');
    g.paused = true;
    g.emit();
    return {
      accepted,
      hero: g.hero.coreJob,
      view: g.currentTargetView(),
      feedback: g.combatFeedbackSnapshot(),
    };
  });
  if (!setup.accepted) throw Error('Smoke Veil rejected');
  await page.screenshot({ path: `${out}/04-stealth.png` });
  const marked = await page.evaluate(() => {
    const g = window.__warriorQA.game;
    g.paused = false;
    g.stepSkillRuntime(0.4);
    const ok = g.castSkill('v2-thief-mark-prey');
    g.paused = true;
    g.emit();
    return {
      ok,
      view: g.currentTargetView(),
      feedback: g.combatFeedbackSnapshot(),
    };
  });
  if (
    !marked.ok ||
    !marked.view?.marked ||
    !marked.feedback.indicators.some((i) => i.id === 'stealth')
  )
    throw Error('Personal Mark/stealth HUD contract');
  await page.screenshot({ path: `${out}/05-marked-stealth.png` });
  const instinct = await page.evaluate(() => {
    const g = window.__warriorQA.game;
    g.paused = false;
    g.stepSkillRuntime(0.4);
    const ok = g.castSkill('v2-thief-instinct');
    g.paused = true;
    g.emit();
    return { ok, feedback: g.combatFeedbackSnapshot() };
  });
  if (
    !instinct.ok ||
    !instinct.feedback.indicators.some((i) => i.id === 'v2-thief-instinct')
  )
    throw Error('Instinct HUD missing');
  await page.screenshot({ path: `${out}/06-instinct.png` });
  const flurry = await page.evaluate(() => {
    const q = window.__warriorQA,
      g = q.game;
    g.paused = false;
    g.stepSkillRuntime(0.5);
    const before = q.events.filter((e) => e.kind === 'hit').length,
      mp = g.hero.mana,
      ok = g.castSkill('v2-thief-blade-flurry');
    g.stepSkillRuntime(0.16);
    g.stepSkillRuntime(0.22);
    g.paused = true;
    g.emit();
    return {
      ok,
      hits: q.events.filter((e) => e.kind === 'hit').length - before,
      cost: mp - g.hero.mana,
      feedback: g.combatFeedbackSnapshot(),
    };
  });
  if (
    !flurry.ok ||
    flurry.hits !== 3 ||
    flurry.feedback.indicators.some((i) => i.id === 'stealth')
  )
    throw Error('Actual Flurry/stealth commit failed');
  await page.screenshot({ path: `${out}/07-flurry.png` });
  await page.keyboard.press('k');
  await page.getByRole('button', { name: /RESET SKILL/ }).click();
  await page.getByRole('alertdialog').waitFor();
  const confirmation = await page.getByRole('alertdialog').innerText();
  if (
    !confirmation.includes('Quick Stab Rank 1') ||
    confirmation.includes('Warrior Strike')
  )
    throw Error('Wrong root grant reset copy');
  await page.screenshot({ path: `${out}/08-reset-confirmation.png` });
  await page.getByRole('button', { name: 'Batal', exact: true }).click();
  if ((await page.evaluate(() => window.__warriorQA.game.hero.gold)) !== 1000)
    throw Error('Cancel changed gold');
  await page.getByRole('button', { name: /RESET SKILL/ }).click();
  await page
    .getByRole('button', { name: 'Reset · 500 Gold', exact: true })
    .click();
  const reset = await page.evaluate(() => {
    const g = window.__warriorQA.game;
    return {
      gold: g.hero.gold,
      sp: g.hero.skillPoints,
      root: g.hero.skillLevels['v2-thief-quick-stab'],
      instinct: g.hero.skillLevels['v2-thief-instinct'],
      feedback: g.combatFeedbackSnapshot(),
      target: g.currentTargetView(),
    };
  });
  if (
    reset.gold !== 500 ||
    reset.sp !== 200 ||
    reset.root !== 1 ||
    reset.instinct ||
    reset.feedback.indicators.length ||
    reset.target
  )
    throw Error('Real K reset failed');
  await page.screenshot({ path: `${out}/09-reset-complete.png` });
  console.log(
    'COMBAT',
    JSON.stringify({ setup, marked, instinct, flurry, httpFailures }),
  );
  await writeFile(
    `${out}/result.json`,
    JSON.stringify(
      {
        errors,
        warnings,
        httpFailures,
        setup,
        marked,
        instinct,
        flurry,
        confirmation,
        reset,
        state: await page.evaluate(() => window.__warriorQA.state()),
      },
      null,
      2,
    ),
  );
  if (errors.some((e) => !(e.includes('404') && e.includes('/favicon.ico'))))
    throw Error(errors.join('\n'));
} finally {
  await browser.close();
}
