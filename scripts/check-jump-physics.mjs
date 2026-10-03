// Simulates jumps through apps/jump/src/physics.js on flat ground and prints the numbers to
// compare with real ones: terminal speed, time to the pull, opening load, canopy speeds, a
// 360 turn, deep brakes, and how the flare's timing changes the landing.
//   node scripts/check-jump-physics.mjs
import { createJumper, createWind, coefficients, rateLanding } from '../apps/jump/src/physics.js';

const DT = 1 / 120;
const calm = createWind({ ground: 0 });
const make = (wind = calm) => createJumper({ groundAt: () => 0, reference: 568, wind });
const f1 = (n) => n.toFixed(1);

// Freefall to the pull.
let j = make();
j.reset({ x: 0, y: 3430, z: 0 }, 0);
j.exit();
let t = 0, vmax = 0, at450 = null;
while (j.state.pos.y > 1500) {
  j.step(DT, { turn: 0, track: 0 });
  t += DT;
  vmax = Math.max(vmax, -j.state.vel.y);
  if (at450 === null && j.state.pos.y < 3430 - 450) at450 = t;
}
console.log(`freefall: ${f1(t)} s to 1500 m, top ${f1(vmax)} m/s, ${f1(-j.state.vel.y)} m/s at the pull, 450 m in ${f1(at450)} s`);
// Opening.
j.pull();
let peak = 0, height = j.state.pos.y; t = 0;
while (j.state.phase !== 'canopy') {
  j.step(DT, { left: 0, right: 0 });
  t += DT;
  peak = Math.max(peak, j.state.load);
}
console.log(`opening: ${f1(t)} s, peak ${f1(peak / 9.81)} g, ${f1(height - j.state.pos.y)} m lost, then ${f1(-j.state.vel.y)} m/s down`);
const settle = (sec, input) => { for (let i = 0; i < sec / DT; i++) j.step(DT, input); };
const speeds = () => `${f1(Math.hypot(j.state.vel.x, j.state.vel.z))} fwd / ${f1(-j.state.vel.y)} down`;
settle(8, { left: 0.3, right: 0.3 });
console.log(`stowed brakes: ${speeds()}`);
j.takeToggles();
for (const b of [0, 0.25, 0.5, 0.75, 1]) {
  settle(10, { left: b, right: b });
  const { cl, cd } = coefficients(b);
  console.log(`brakes ${b}: ${speeds()}  (L/D ${f1(cl / cd)}${j.state.stall > 0 ? `, stall ${f1(j.state.stall)}` : ''})`);
}
settle(10, { left: 0, right: 0 });
// A full right-toggle 360.
let h0 = j.state.pos.y, start = j.state.heading; t = 0;
while (j.state.heading - start < 2 * Math.PI && t < 30) { j.step(DT, { left: 0, right: 1 }); t += DT; }
console.log(`360 on one toggle: ${f1(t)} s, ${f1(h0 - j.state.pos.y)} m lost, bank ${f1(j.state.bank * 57.3)} deg`);
settle(6, { left: 0, right: 0 });
let h1 = j.state.pos.y; start = j.state.heading; t = 0;
while (j.state.heading - start < Math.PI / 2 && t < 30) { j.step(DT, { left: 0, right: 0.5 }); t += DT; }
console.log(`90 on half a toggle: ${f1(t)} s, ${f1(h1 - j.state.pos.y)} m lost`);

// Landings: full flight on final, flare (0 to 1 over `ramp` s) starting at `at` metres.
console.log('landings (flare start height, ramp):');
for (const [at, ramp] of [[0, 0], [12, 0.6], [6, 0.6], [4, 1.0], [3, 0.6], [2.5, 1.2], [1.5, 0.5]]) {
  j = make();
  j.reset({ x: 0, y: 1500, z: 0 }, 0);
  j.exit(); j.pull(); j.takeToggles();
  while (j.state.phase !== 'landed') {
    const y = j.state.pos.y;
    const flare = at > 0 && y <= at;
    if (flare && j.flareT === undefined) j.flareT = 0;
    if (flare) j.flareT += DT;
    const b = flare ? Math.min(1, ramp ? j.flareT / ramp : 1) : 0;
    j.step(DT, { left: b, right: b });
  }
  const l = j.state.landing;
  console.log(`  ${at ? `${at} m, ${ramp} s` : 'no flare   '}: sink ${f1(l.sink)}, speed ${f1(l.speed)} -> ${rateLanding(l).title}`);
}

// Drift in a breeze, no input from exit to ground.
j = make(createWind({ ground: 4, from: 250 }));
j.reset({ x: 0, y: 3430, z: 0 }, 0);
j.exit();
while (j.state.pos.y > 1500) j.step(DT, { turn: 0, track: 0 });
const ff = { ...j.state.pos };
j.pull();
console.log(`4 m/s wind from 250: freefall drift ${f1(Math.hypot(ff.x, ff.z))} m`);
