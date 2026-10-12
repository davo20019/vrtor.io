import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal'] });
const URL = 'https://vrtor.io/cyb/';
async function open(name) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(name, 'pageerror', e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__cyb?.parts && window.__cyb.presence?.state.status === 'online', null, { timeout: 120000 });
  await page.evaluate(() => window.__cyb.presence.join());
  await page.waitForFunction(() => window.__cyb.presence.state.joined, null, { timeout: 30000 });
  return page;
}
const off = (p) => p.evaluate(() => window.__cyb.parts.offIds().sort().join(','));
const tap = (p, n) => p.evaluate((n) => { const m = window.__cyb.scene.meshes.find((x) => x.name.startsWith(n) && x.getTotalVertices() > 0); const r = window.__cyb.parts.tap(m); return r && r.verb; }, n);
// Only in an empty room: nobody's truck gets taken apart by a test.
{
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__cyb?.presence?.state.status === 'online', null, { timeout: 120000 });
  await p.waitForTimeout(2000);
  const st = await p.evaluate(() => ({ here: window.__cyb.presence.state.here, online: window.__cyb.presence.state.online }));
  console.log('room before the test:', st);
  await ctx.close();
  if (st.here > 0) { console.log('someone is in the room: not testing'); await browser.close(); process.exit(0); }
}
const A = await open('A');
const B = await open('B');
console.log('both joined; here', await A.evaluate(() => window.__cyb.presence.state.here));
await A.evaluate(() => window.__cyb.setTakingApart(true));
console.log('A tap beltline:', await tap(A, 'door_fl_int_cap'), ' trim:', (await A.waitForTimeout(2000), await tap(A, 'door_fl_int_trim_white')));
await A.waitForTimeout(3000);
console.log('A off:', await off(A)); console.log('B off:', await off(B));
await A.evaluate(() => window.__cyb.parts.takeAll());
await A.waitForFunction(() => !window.__cyb.parts.running, null, { timeout: 120000 });
await B.waitForTimeout(4000);
console.log('after A took everything off: A', await A.evaluate(() => window.__cyb.parts.offCount), ' B', await B.evaluate(() => window.__cyb.parts.offCount));
const C = await open('C');
await C.waitForTimeout(3000);
console.log('C joined late: C', await C.evaluate(() => window.__cyb.parts.offCount));
await B.evaluate(() => window.__cyb.parts.putAllBack());
await B.waitForFunction(() => !window.__cyb.parts.running, null, { timeout: 120000 });
await A.waitForTimeout(5000);
console.log('B put everything back: A', await A.evaluate(() => window.__cyb.parts.offCount), ' B', await B.evaluate(() => window.__cyb.parts.offCount), ' C', await C.evaluate(() => window.__cyb.parts.offCount));
await browser.close();
