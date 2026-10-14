// Real browser input only. Caller supplies the open Character panel.
export async function checkCharacterLegibility(page, result, dir) {
  const check = (name, ok, detail) => result.checks.push({ name, ok: !!ok, detail });
  const input = async (action, fn) => { result.input.push({ origin: 'USER_BROWSER', action, utc: new Date().toISOString() }); await fn(); };
  const probe = () => page.evaluate(() => {
    const row = document.querySelector('[data-character-stat="blockRate"]');
    const panel = document.querySelector('.character-dialog');
    const b = row.getBoundingClientRect(), hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    const style = getComputedStyle(panel), trigger = row.closest('.cs-tip-target');
    return { value: row.querySelector('b')?.textContent, box: b.toJSON(), hit: hit?.outerHTML.slice(0, 400), reachable: hit === row || row.contains(hit), insideViewport: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth, panel: { position: style.position, zIndex: style.zIndex, box: panel.getBoundingClientRect().toJSON() }, focused: document.activeElement === trigger, scrollY };
  });
  await page.locator('[data-character-stat="blockRate"]').waitFor();
  result.legibilityBefore = await probe();
  const combat = await page.locator('.cs-combat').boundingBox();
  await input('Native wheel in Combat stats', async () => { await page.mouse.move(combat.x + combat.width / 2, Math.min(combat.y + combat.height / 2, result.viewport.height - 120)); await page.mouse.wheel(0, 650); await page.waitForTimeout(300); });
  result.legibilityAfterWheel = await probe();
  check('Block Rate inside viewport and first pointer hit reaches row', result.legibilityAfterWheel.insideViewport && result.legibilityAfterWheel.reachable, result.legibilityAfterWheel);
  await page.screenshot({ path: dir + '/block-rate-wheel.png' });
  // Tab through normal focus order, never focus() or scrollIntoView().
  for (let i = 0; i < 80; i++) {
    await input('Tab', () => page.keyboard.press('Tab'));
    if ((await probe()).focused) break;
  }
  result.legibilityKeyboard = await probe();
  check('Tab reaches Block Rate and exposes visible value', result.legibilityKeyboard.focused && result.legibilityKeyboard.insideViewport && result.legibilityKeyboard.reachable, result.legibilityKeyboard);
  // Wait for the accessible relation, including focus-triggered scroll and tooltip scheduling.
  await page.waitForFunction(() => { const id = document.activeElement?.getAttribute('aria-describedby'); return !!id && id.split(' ').some(k => document.getElementById(k)?.textContent?.includes('Block Rate')); }, null, { timeout: 3000 }).catch(() => {});
  result.blockTooltip = await page.evaluate(() => ({ focused: document.activeElement?.outerHTML, tooltips: [...document.querySelectorAll('[role="tooltip"]')].map(e => ({ html: e.outerHTML, box: e.getBoundingClientRect().toJSON() })) }));
  check('Focused Block Rate has accessible tooltip', await page.evaluate(() => { const id = document.activeElement?.getAttribute('aria-describedby'); return !!id && id.split(' ').some(k => document.getElementById(k)?.textContent?.includes('Block Rate')); }));
  await page.screenshot({ path: dir + '/block-rate-keyboard.png' });
  const b = result.legibilityKeyboard.box;
  await input('Raw pointer on Block Rate center', () => page.mouse.click(b.x + b.width / 2, b.y + b.height / 2));
  check('Pointer interaction retains Character panel', await page.locator('.character-dialog').isVisible());
}
