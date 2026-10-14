// Native-input regression for the production SSR Advanced Stats popup.
// The caller supplies a fresh synthetic profile and an open Character panel.
export async function checkAdvancedStatsOcclusion(page, result, evidenceDir) {
  const check = (name, ok) => result.checks.push({ name, ok });
  const input = async (action, fn) => {
    result.input.push({ origin: 'USER_BROWSER', time: new Date().toISOString(), action });
    await fn();
  };
  const open = async () => {
    await input('Open Advanced Stats', () => page.getByRole('button', { name: 'Advanced Stats', exact: true }).click());
    await page.getByRole('button', { name: 'Close advanced stats', exact: true }).waitFor();
  };
  const focusCooldown = async () => {
    // Keep tab order real: do not call focus() or dispatch synthetic DOM events.
    for (let i = 0; i < 18; i++) {
      await input('Tab', () => page.keyboard.press('Tab'));
      if (await page.evaluate(() => document.activeElement?.textContent?.includes('Cooldown Reduction'))) break;
    }
    const focused = await page.evaluate(() => document.activeElement?.textContent?.includes('Cooldown Reduction'));
    check('Tab reaches Cooldown Reduction', !!focused);
    if (!focused) throw Error('Cooldown trigger unreachable through Tab');
    await page.locator('.cs-tooltip').filter({ hasText: 'Cooldown Reduction' }).waitFor({ state: 'visible' });
    await page.waitForTimeout(350);
  };
  await open();
  const popup = page.locator('.cs-advanced-popup');
  result.popupLayout = await popup.evaluate(el => {
    const b = el.getBoundingClientRect(), child = el.querySelector('.cs-popup-scroll'), c = child.getBoundingClientRect();
    return { box: b.toJSON(), viewport: { w: innerWidth, h: innerHeight }, scroll: { box: c.toJSON(), height: child.scrollHeight, client: child.clientHeight, before: child.scrollTop } };
  });
  const box = result.popupLayout.box, viewport = result.popupLayout.viewport;
  check('Advanced popup stays inside viewport', box.left >= 0 && box.top >= 0 && box.right <= viewport.w && box.bottom <= viewport.h);
  const scrollBox = result.popupLayout.scroll.box;
  await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2);
  await input('Wheel600 in Advanced Stats scroll child', () => page.mouse.wheel(0, 600));
  await page.waitForTimeout(350);
  result.scrollAfter = await page.locator('.cs-popup-scroll').evaluate(el => el.scrollTop);
  result.scrollOutcome = result.popupLayout.scroll.height <= result.popupLayout.scroll.client
    ? 'NOT_APPLICABLE_NO_OVERFLOW'
    : result.scrollAfter > result.popupLayout.scroll.before ? 'PASS' : 'FAIL';
  if (result.scrollOutcome !== 'NOT_APPLICABLE_NO_OVERFLOW') check('Overflow responds to native wheel', result.scrollOutcome === 'PASS');
  await focusCooldown();
  result.occlusion = await page.getByRole('button', { name: 'Close advanced stats', exact: true }).evaluate(el => {
    const b = el.getBoundingClientRect(), tip = document.querySelector('.cs-tooltip'), layer = tip?.parentElement;
    const t = tip?.getBoundingClientRect(), l = layer?.getBoundingClientRect(), hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    const overlaps = a => !!a && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const active = document.activeElement, describedBy = active?.getAttribute('aria-describedby');
    return { close: b.toJSON(), tooltip: t?.toJSON(), positioner: l?.toJSON(), tooltipText: tip?.textContent,
      visualOverlap: overlaps(t) || overlaps(l), hitWithin: el.contains(hit), hit: hit?.outerHTML,
      focusedText: active?.textContent, describedBy, accessibleDescription: describedBy?.split(' ').map(id => document.getElementById(id)?.textContent).join(' ') };
  });
  check('Keyboard tooltip remains visible with Cooldown text', !!result.occlusion.tooltipText?.includes('Cooldown Reduction'));
  check('Focused trigger retains accessible tooltip description', !!result.occlusion.accessibleDescription?.includes('Cooldown Reduction'));
  check('Tooltip and positioner do not geometrically cover close button', !result.occlusion.visualOverlap);
  check('elementFromPoint reaches close button before first pointer click', result.occlusion.hitWithin);
  await page.screenshot({ path: evidenceDir + '/focused-tooltip.png' });
  const b = result.occlusion.close;
  // Deliberately no locator.click(), trial click, retry or implicit hit-test waiting.
  await input('First raw pointer click on close center', () => page.mouse.click(b.x + b.width / 2, b.y + b.height / 2));
  await page.waitForTimeout(200);
  check('First raw pointer click closes Advanced Stats at original200ms check', !(await page.getByRole('button', { name: 'Close advanced stats', exact: true }).isVisible()));
  await page.screenshot({ path: evidenceDir + '/first-click.png' });
  if (await page.getByRole('button', { name: 'Close advanced stats', exact: true }).isVisible()) throw Error('First click did not close popup; no retry to conceal failure');

  await open();await focusCooldown();
  await input('Shift+Tab to popup close button', () => page.keyboard.press('Shift+Tab'));
  check('Close button remains keyboard focusable', await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Close advanced stats'));
  await input('Enter on close button', () => page.keyboard.press('Enter'));await page.waitForTimeout(200);
  check('Enter closes Advanced Stats', !(await page.getByRole('button', { name: 'Close advanced stats', exact: true }).isVisible()));
  await open();await input('Escape closes popup', () => page.keyboard.press('Escape'));await page.waitForTimeout(400);
  check('Escape closes Advanced Stats', !(await page.getByRole('button', { name: 'Close advanced stats', exact: true }).isVisible()));
}
