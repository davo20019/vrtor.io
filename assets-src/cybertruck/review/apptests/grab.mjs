import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:8790/cyb/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__cyb?.parts, null, { timeout: 120000 });
const out = await page.evaluate(async () => {
  const { parts, scene } = window.__cyb;
  const V = scene.meshes[0].position.constructor;
  const Q = [...scene.transformNodes, ...scene.meshes].find((n) => n.rotationQuaternion).rotationQuaternion.constructor;
  const mesh = (n) => scene.meshes.find((x) => x.name.startsWith(n) && x.getTotalVertices() > 0);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  const centre = (m) => m.getBoundingInfo().boundingBox.centerWorld.clone();
  // 1: the glass, with the trim and beltline on
  log.push('glass: ' + JSON.stringify(parts.grab(mesh('door_fl_glass'), { position: centre(mesh('door_fl_glass')), rotation: Q.Identity() })?.verb));
  // 2: beltline pulled 5 cm along its way off, then let go: back in
  const b = mesh('door_fl_int_cap'); const h0 = centre(b);
  const g = parts.grab(b, { position: h0, rotation: Q.Identity() }); log.push('beltline grab: ' + g.verb);
  // its way off (the catalogue's dir, in the world): try moving the hand inboard and up a bit, along x
  const dirs = [new V(-1, 0.4, 0), new V(1, 0.4, 0), new V(0, 0.4, -1), new V(0, 0.4, 1)];
  let state;
  for (const d of dirs) { state = parts.hold(g.id, { position: h0.add(d.normalize().scale(0.05)), rotation: Q.Identity() }); }
  log.push('small pull: ' + state + ' release: ' + parts.release(g.id)?.verb);
  await wait(800);
  log.push('off after small pull: ' + parts.isOff('beltline_fl'));
  // 3: pulled well out: free; let go: off to the plinth
  const g2 = parts.grab(b, { position: h0, rotation: Q.Identity() });
  let freed = null;
  for (const d of dirs) {
    for (let s = 0.05; s <= 0.6; s += 0.05) { const st = parts.hold(g2.id, { position: h0.add(d.normalize().scale(s)), rotation: Q.Identity() }); if (st === 'free') { freed = d; break; } }
    if (freed) break;
    parts.hold(g2.id, { position: h0, rotation: Q.Identity() });
  }
  log.push('freed along ' + (freed && [freed.x, freed.y, freed.z].map((v) => v.toFixed(1))));
  log.push('release: ' + parts.release(g2.id)?.verb);
  await wait(2000);
  log.push('off: ' + parts.isOff('beltline_fl'));
  // 4: from the plinth, held to its seat and let go: back on
  const onPlinth = centre(b);
  const g3 = parts.grab(b, { position: onPlinth, rotation: Q.Identity() });
  log.push('grab on plinth: ' + g3.verb);
  parts.hold(g3.id, { position: onPlinth.add(h0.subtract(onPlinth)), rotation: Q.Identity() });
  log.push('release at seat: ' + parts.release(g3.id)?.verb);
  await wait(2500);
  log.push('off after release at seat: ' + parts.isOff('beltline_fl'));
  return log;
});
console.log(out.join('\n'));
await browser.close();
