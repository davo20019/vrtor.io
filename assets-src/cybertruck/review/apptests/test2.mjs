import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto('http://localhost:8790/cyb/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__cyb?.parts, null, { timeout: 120000 });
console.log('parts', await page.evaluate(() => window.__cyb.parts.count));
await page.evaluate(() => window.__cyb.setTakingApart(true));
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/pw/0-mode.png' });
await page.evaluate(() => window.__cyb.parts.takeAll());
for (let i = 0; i < 90; i++) {
  await page.waitForTimeout(1000);
  const st = await page.evaluate(() => [window.__cyb.parts.offCount, window.__cyb.parts.running]);
  if (i % 10 === 0) console.log('t', i, st);
  if (!st[1]) break;
}
await page.screenshot({ path: "/tmp/pw/1-apart.png" }); await page.evaluate(() => { const c = window.__cyb.scene.activeCamera; c.target.set(10.3, 0.3, 0); c.radius = 9; c.beta = 0.75; c.alpha = -1.2; }); await page.waitForTimeout(1500); await page.screenshot({ path: "/tmp/pw/1b-plinth.png" });
console.log('off', await page.evaluate(() => window.__cyb.parts.offCount));
await page.evaluate(() => window.__cyb.parts.putAllBack());
for (let i = 0; i < 90; i++) {
  await page.waitForTimeout(1000);
  const st = await page.evaluate(() => [window.__cyb.parts.offCount, window.__cyb.parts.running]);
  if (!st[1]) break;
}
await page.screenshot({ path: '/tmp/pw/2-back.png' });
console.log('off after putting back', await page.evaluate(() => window.__cyb.parts.offCount));
console.log('errors:', errors.filter(e => !/GPU stall|WebGL|deprecated/i.test(e)).slice(0, 20));
await browser.close();
