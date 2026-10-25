'use strict';
/* Layout check in a real browser (Playwright + Chromium), Russian UI.
   Catches what unit tests cannot see: the main button cut off at the right edge,
   machine cards out of reach, wizard titles broken in the middle of a word.
   Run: see .github/workflows/ui.yml (Playwright 1.56.0 + Chromium), or locally: node tests/ui/layout.check.js */
const path = require('path');
const { chromium } = require('playwright');
const URL = process.env.SKYKERF_URL || 'file://' + path.resolve(__dirname, '../../src/index.html');
const SIZES = [[1280, 720], [1366, 768], [1600, 900], [1920, 1080]];

(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const fails = [];
  for (const [w, h] of SIZES) for (const mode of ['simple', 'pro']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'ru-RU' });
    await ctx.addInitScript(m => { try { localStorage.setItem('skykerf.welcomed', '1'); localStorage.setItem('skykerf.mode', m); localStorage.setItem('skykerf.lang', 'ru') } catch (e) { } }, mode);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    await pg.goto(URL); await pg.waitForTimeout(1200);
    await pg.evaluate(() => { document.body.classList.toggle('simple', localStorage.getItem('skykerf.mode') === 'simple') });
    for (const tab of ['cad', 'cam', 'gcode', 'machine']) {
      await pg.evaluate(t => switchTab(t), tab); await pg.waitForTimeout(700);
      const r = await pg.evaluate(() => {
        const out = [], vw = innerWidth, inView = el => { const b = el.getBoundingClientRect(); return b.left >= -1 && b.right <= vw + 1 };
        const pb = document.querySelector('#primaryBtn'); if (pb && !inView(pb)) out.push('main button cut off');
        if (document.querySelector('.top').scrollWidth > vw + 1) out.push('top bar overflows');
        for (const c of document.querySelectorAll('.dcard')) if (c.offsetParent && !inView(c)) out.push('machine card out of reach: ' + c.querySelector('h4').textContent.trim());
        for (const b of document.querySelectorAll('.wiz button b')) if (b.offsetParent && b.scrollWidth > b.clientWidth + 1) out.push('wizard title too wide: ' + b.textContent.trim());
        return out;
      });
      for (const x of r) fails.push(`${w}×${h} ${mode} ${tab}: ${x}`);
    }
    if (errs.length) fails.push(`${w}×${h} ${mode}: page errors: ${errs.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
  if (fails.length) { console.error(fails.join('\n')); process.exit(1) }
  console.log(`layout ok: ${SIZES.length} sizes × 2 modes × 4 tabs`);
})().catch(e => { console.error(e); process.exit(1) });
