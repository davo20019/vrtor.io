// Checks the cabin sound's levels (apps/cyb/src/sound.js) against what's been measured and reported:
// about 67 dB at 55 mph and 70 dB at 75 mph overall; wind noticeable from about 40 mph and
// intrusive above 70; the tyres the main sound at the ride's own speeds.
// Run: node scripts/check-cyb-sound.mjs
import { levels, total } from '../apps/cyb/src/sound.js';

const MPH = 0.44704;
const rows = [5, 15, 25, 40, 55, 70, 75].map((mph) => {
  const l = levels({ v: mph * MPH, ax: 0 });
  return { mph, total: +total(l).toFixed(1), tyres: +l.tyres.toFixed(1), wind: +l.wind.toFixed(1), motors: +l.motors.toFixed(1) };
});
console.table(rows);
const pull = levels({ v: 15 * MPH, ax: 1.1 }), regen = levels({ v: 15 * MPH, ax: -1.6 }), cruise = levels({ v: 15 * MPH, ax: 0 });
console.log('motor whine at 15 mph: cruise', cruise.motors.toFixed(1), 'pulling away', pull.motors.toFixed(1), 'regenerating', regen.motors.toFixed(1), 'dB');
const at = (mph) => rows.find((r) => r.mph === mph);
const fails = [];
if (Math.abs(at(55).total - 67) > 1) fails.push(`55 mph is ${at(55).total} dB, measured 67`);
if (Math.abs(at(75).total - 70) > 1) fails.push(`75 mph is ${at(75).total} dB, measured ~70`);
// dB(A) totals hide how much more the ear notices wind's hiss over the tyres' low roar, so 'noticeable'
// means within ~17 dB, and 'intrusive' within ~6.
if (at(40).wind < at(40).total - 17) fails.push('wind inaudible at 40 mph');
if (at(75).wind < at(75).tyres - 6) fails.push('wind not intrusive above 70 mph');
if (at(25).tyres < at(25).wind) fails.push('tyres not the main sound at 25 mph');
if (!(pull.motors > cruise.motors + 6 && regen.motors > cruise.motors + 6)) fails.push('whine does not rise pulling away and regenerating');
console.log(fails.length ? `FAIL: ${fails.join('; ')}` : 'OK');
process.exit(fails.length ? 1 : 0);
