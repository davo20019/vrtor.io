// Drives the Big Sur ride's 5 km through the steering physics (apps/cyb/src/steering.js) at 72 Hz,
// with no scene, and checks it like a passenger would: stays in its lane, the yoke never snaps or
// runs out of lock, the sideways push stays gentle, and it arrives.
// Run: node scripts/check-cyb-steering.mjs
import { readFileSync } from 'node:fs';
import { ACCEL, DECEL, YOKE_MAX, createVehicle, laneOf, plan, ratioAt, rearFor } from '../apps/cyb/src/steering.js';

const meta = JSON.parse(readFileSync(new URL('../apps/cyb/public/bigsur/bigsur.json', import.meta.url)));
const pts = meta.road.points, n = pts.length;
const road = { n, step: meta.road.step, px: new Float64Array(n), py: new Float64Array(n), pz: new Float64Array(n), rx: new Float64Array(n), rz: new Float64Array(n) };
pts.forEach(([x, y, z], i) => { road.px[i] = x; road.py[i] = y; road.pz[i] = z; });
for (let i = 0; i < n; i++) {
  const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
  const tx = road.px[b] - road.px[a], tz = road.pz[b] - road.pz[a], l = Math.hypot(tx, tz);
  road.rx[i] = tz / l;
  road.rz[i] = -tx / l;
}
const p = plan(road);
// How often the road itself switches between bending left and right: the yoke has to at least as often.
let roadFlips = 0, lastBend = 0;
for (let i = 0; i < n; i++) {
  const k = p.curv[i];
  if (Math.abs(k) < 1 / 2000) continue;
  if (lastBend && Math.sign(k) !== Math.sign(lastBend)) roadFlips++;
  lastBend = k;
}
const lane = laneOf(road, p);
const car = createVehicle(lane, { start: p.start, end: p.end, accel: ACCEL, decel: DECEL });
const DEG = 180 / Math.PI, dt = 1 / 72;
let lastRate = 0, reversals = 0;
let t = 0, maxErr = 0, maxYoke = 0, maxRate = 0, maxAy = 0, maxRoll = 0, maxFront = 0, maxRear = 0, sumErr2 = 0, k = 0;
const at = [];
while (!car.done() && t < 900) {
  const st = car.step(dt, true);
  t += dt;
  if (st.s > p.start + 5) {
    maxErr = Math.max(maxErr, Math.abs(st.error));
    sumErr2 += st.error ** 2;
    k++;
  }
  maxYoke = Math.max(maxYoke, Math.abs(st.yoke));
  maxRate = Math.max(maxRate, Math.abs(st.yokeRate));
  // A wobble: the yoke swinging back the other way at more than 8 deg/s.
  if (Math.abs(st.yokeRate) * DEG > 8) {
    if (lastRate && Math.sign(st.yokeRate) !== Math.sign(lastRate)) reversals++;
    lastRate = st.yokeRate;
  }
  maxAy = Math.max(maxAy, Math.abs(st.ay));
  maxRoll = Math.max(maxRoll, Math.abs(st.roll));
  maxFront = Math.max(maxFront, Math.abs(st.front));
  maxRear = Math.max(maxRear, Math.abs(st.rear));
  if (Math.abs(st.yoke) * DEG > Math.abs(at[0]?.yoke ?? 0)) at[0] = { s: Math.round(st.s), mph: +(st.v * 2.237).toFixed(0), yoke: +(st.yoke * DEG).toFixed(0) };
  if (st.s > p.start + 5 && Math.abs(st.error) > Math.abs(at[1]?.error ?? 0)) at[1] = { s: Math.round(st.s), mph: +(st.v * 2.237).toFixed(0), error: +st.error.toFixed(2), curvR: Math.round(1 / lane(st.s).curv) };
}
const st = car.state;
const report = {
  arrived: car.done(),
  minutes: +(t / 60).toFixed(1),
  laneErrorMaxM: +maxErr.toFixed(2),
  laneErrorRmsM: +Math.sqrt(sumErr2 / k).toFixed(3),
  yokeMaxDeg: +(maxYoke * DEG).toFixed(0),
  yokeRateMaxDegS: +(maxRate * DEG).toFixed(0),
  yokeReversalsPerKm: +(reversals / ((st.s - p.start) / 1000)).toFixed(1),
  roadBendChangesPerKm: +(roadFlips / ((st.s - p.start) / 1000)).toFixed(1),
  frontMaxDeg: +(maxFront * DEG).toFixed(1),
  rearMaxDeg: +(maxRear * DEG).toFixed(2),
  sidewaysMaxMs2: +maxAy.toFixed(2),
  rollMaxDeg: +(maxRoll * DEG).toFixed(2),
  mostYoke: at[0],
  worstError: at[1],
  ratio: { '5 mph': +ratioAt(2.2).toFixed(1), '25 mph': +ratioAt(11.2).toFixed(1), '55 mph': +ratioAt(24.6).toFixed(1) },
  rearAt30degFront: { '5 mph': +(rearFor(0.5236, 2.2) * DEG).toFixed(2), '55 mph': +(rearFor(0.5236, 24.6) * DEG).toFixed(2) },
  stoppedAt: Math.round(st.s),
};
console.log(JSON.stringify(report, null, 2));
// Half a lane is 1.8 m; the truck is 2.03 m wide, so its wheels stay in lane within ~0.75 m.
const fails = [];
if (!report.arrived) fails.push('did not arrive');
if (report.laneErrorMaxM > 0.3) fails.push('strayed more than 0.3 m from the lane centre');
// Each bend: a turn in and perhaps one small settle; more than that is a wobble.
if (report.yokeReversalsPerKm > 2 * report.roadBendChangesPerKm) fails.push('the yoke wobbles');
if (maxYoke >= YOKE_MAX - 1e-6) fails.push('ran the yoke to its stop');
if (report.sidewaysMaxMs2 > 2.6) fails.push('sideways push over 2.6 m/s²');
console.log(fails.length ? `FAIL: ${fails.join('; ')}` : 'OK');
process.exit(fails.length ? 1 : 0);
