import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:8790/cyb/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__cyb?.parts, null, { timeout: 120000 });
await page.evaluate(() => window.__cyb.setTakingApart(true));
const tap = (name) => page.evaluate((n) => { const m = window.__cyb.scene.getMeshByName(n); const r = window.__cyb.parts.tap(m); return r && `${r.verb} ${r.part.id}` + (r.by ? ' by ' + r.by.map((d) => d.id).join(',') : ''); }, name);
const settle = () => page.waitForFunction(() => !window.__cyb.parts.running, null, { timeout: 30000 });
for (const n of ['door_fl_glass', 'door_fl_int_cap', 'door_fl_glass', 'door_fl_int_trim_white', 'door_fl_glass', 'door_fl_int_cap', 'door_fl_int_trim_white', 'door_fl_glass', 'door_fl_int_trim_white', 'door_fl_int_cap', 'door_fl_steel', 'door_fl_mirrorglass', 'door_fl_steel', 'int_yoke', 'int_yoke_pad', 'int_yoke', 'int_yoke_pad', 'int_yoke']) {
  console.log(n.padEnd(24), await tap(n)); await settle();
}
await page.evaluate(() => { const c = window.__cyb.scene.activeCamera; c.target.set(10.3, 0.3, 0); c.radius = 8; c.beta = 0.8; c.alpha = -1.1; });
await page.waitForTimeout(1500); await page.screenshot({ path: '/tmp/pw/3-taps.png' });
console.log('off', await page.evaluate(() => window.__cyb.parts.offCount), 'errors', errs);
await browser.close();
