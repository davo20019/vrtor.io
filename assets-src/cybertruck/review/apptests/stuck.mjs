import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal'] });
const page = await browser.newPage();
await page.goto('http://localhost:8790/cyb/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__cyb?.parts, null, { timeout: 120000 });
await page.evaluate(() => window.__cyb.setTakingApart(true));
await page.evaluate(() => window.__cyb.parts.takeAll());
await page.waitForFunction(() => !window.__cyb.parts.running, null, { timeout: 200000 });
const info = await page.evaluate(() => {
  const P = window.__cyb.parts; const defs = JSON.parse(JSON.stringify(window.__cyb.parts.layout.map(l => l.id)));
  const all = window.__cyb.scene.metadata; // unused
  return defs.filter((id) => !P.isOff(id));
});
console.log('still on:', info.join(', '));
await browser.close();
