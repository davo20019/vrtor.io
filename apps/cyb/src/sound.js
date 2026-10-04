// What you hear in the Cybertruck's cabin on the ride. It's electric, so there's no engine: the sound
// is the tyres on the road, the wind round the glass and mirrors, the motors' whine (louder pulling
// away and when it slows itself down), the rear steering's actuators at low speed, the suspension over
// cracks, and the climate fan. Each comes from where it is in the truck (four tyres, two mirrors, two
// motors...), placed in 3D around your head, so turning your head changes what each ear hears.
//
// Calibrated to what's been measured and reported:
// - Overall: about 67 dB at 55 mph and 70 dB at 75 mph in the cabin (evhelphub.com's review).
// - Consumer Reports: louder inside than most EVs; the aggressive all-terrain tread is noisy on most
//   surfaces; wind noticeable from about 40 mph, intrusive above 70; the motors whir and whine
//   speeding up and slowing down; the rear steering and other actuators groan at low speeds.
//   A strange motor noise between 30 and 40 mph; expansion joints and potholes come through hard.
// - The tyres (Goodyear Wrangler Territory RT, made for it) carry SoundComfort foam inside, which takes
//   up to 11 dB off the air cavity's boom. What's left is a low road drone, worst on rough surfaces,
//   with the tread's roar on top; owners say it's quiet below 50 mph and like mud tyres above.
// - The air suspension (Tesla's manual; owners): parked, it drops to Entry; driving off, it goes back to
//   the ride height above 10 mph, the compressor pumping, which owners hear below about 15 mph. A drop
//   of two levels or more to Entry bleeds air with a loud hiss; one level, they hear nothing.
// - Rock and banks beside the road throw the tyres' airborne roar back: louder on the hill's side.
//   (No bridge joints or turn signals here: the ride starts past Bixby Bridge, stops short of the Little
//   Sur's, and keeps to its lane.)
// Estimated (not published): the gear reduction (about 12:1; Tesla says only that it's the lowest
// of any Tesla), the motors' tone orders, the tyres' tread pitch and cavity resonance, the crack
// spacing of Highway 1's chip-seal surface, the 30-40 mph motor noise's shape, the suspension's
// sounds (where the compressor is, how loud and long it and the hiss are), the airborne share of
// the tyres' noise that a wall can reflect, and each source's share of the total.

import { crackStrength, isCrack } from './surface.js';

const REF_DB = 67;                    // 55 mph cruise, the level the mix is set against
const REF_GAIN = 0.32;                // output gain at REF_DB
const V55 = 24.59;                    // m/s
const ROLLING_RADIUS = 0.424;         // m
const GEAR = 12;                      // motor turns per wheel turn (estimate)
const ORDERS = [24, 48];              // the motors' strongest whine orders (estimate)
const TREAD_PITCH = 0.04;             // m between the all-terrain tread's blocks (estimate)
const CAVITY_HZ = 152;                // the 35-inch tyre's air cavity, c / (pi x 0.72 m)
const AIRBORNE = -5;                  // dB: the tyres' roar and hiss, of all their noise (estimate)
const RAISE_AT = 4.47;                // m/s: back up from Entry above 10 mph (Tesla's manual)
const PUMP_S = 6, PUMP_DB = 48;       // the compressor's run raising it, and its level (estimates)
const HISS_S = 2.5, HISS_DB = 52;     // the bleed down to Entry (estimates)

const gainOf = (db) => REF_GAIN * 10 ** ((db - REF_DB) / 20);
const log = (x) => Math.log10(Math.max(x, 1e-4));

/** Each source's level (dB) for the truck's state: speed v, push ax (m/s²), rear steer rate (rad/s),
 *  and the climate's fan speed (0 off to 10; 4 is the level the fan's set for). */
export function levels({ v, ax = 0, rearRate = 0, fan = 4 }) {
  const s = Math.max(v, 0.01) / V55;
  return {
    // Tyres: gently up with speed through the ride's range; fading faster at walking pace.
    tyres: v < 0.3 ? -Infinity : 66.3 + 18 * log(s) + (v < 6.7 ? 17 * log(v / 6.7) : 0),
    wind: v < 2 ? -Infinity : 57 + 60 * log(s),
    // Whine: faint at a steady speed, up with the push (pulling away or regenerating), and with speed.
    // Plus the hump Consumer Reports heard between 30 and 40 mph (13.4 to 17.9 m/s).
    motors: v < 0.3 ? -Infinity
      : 36 + 9 * Math.min(2, Math.abs(ax)) + 8 * log(Math.max(v, 3) / 10) + 7 * Math.exp(-(((v - 15.6) / 2.2) ** 2)),
    // Actuators: heard when the rears are moving, mostly at low speed when they move most.
    actuators: Math.abs(rearRate) < 0.002 ? -Infinity : Math.min(46, 30 + 20 * log(Math.abs(rearRate) / 0.01)),
    fan: fan > 0 ? 39 + 25 * log(fan / 4) : -Infinity,
  };
}

/** Total of the levels, in dB. */
export function total(l) {
  return 10 * log(Object.values(l).reduce((a, db) => a + (Number.isFinite(db) ? 10 ** (db / 10) : 0), 0));
}

// Where each source is, in the truck's frame (m): x right, y up, z ahead; the axles are 3.635 m apart.
const AT = {
  fl: [-0.886, 0.42, 1.82], fr: [0.886, 0.42, 1.82], rl: [-0.886, 0.42, -1.82], rr: [0.886, 0.42, -1.82],
  mirrorL: [-1.0, 1.35, 0.95], mirrorR: [1.0, 1.35, 0.95],
  motorF: [0, 0.45, 1.82], motorR: [0, 0.45, -1.82],
  dash: [0, 1.0, 0.85],
  compressor: [0, 0.45, 1.4],         // under the front, by the front motor (estimate)
};

export function createCabinSound() {
  let ac = null, out = null, src = null, meter = null;
  const thumps = { next: 0, axleGap: 3.635 };
  // The ride begins parked, so at Entry.
  const suspension = { height: 'entry', parkedFor: 0 };

  function noiseBuffer(kind, seconds = 4) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'brown') d[i] = (last = (last + 0.02 * w) / 1.02) * 3.5;
      else {
        // Pink, by Paul Kellet's economy filter.
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      }
    }
    return buf;
  }
  function panner(at) {
    const p = ac.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 1.2;
    p.rolloffFactor = 0.35;
    if (p.positionX) {
      p.positionX.value = at[0];
      p.positionY.value = at[1];
      p.positionZ.value = -at[2];          // Web Audio's frame is right-handed: ahead is -z
    } else p.setPosition(at[0], at[1], -at[2]);
    p.connect(out);
    return p;
  }
  const filter = (type, f, q = 0.7, gain = 0) => {
    const b = ac.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    b.gain.value = gain;
    return b;
  };
  const gainNode = (g = 0) => {
    const n = ac.createGain();
    n.gain.value = g;
    return n;
  };

  // The noise chains, built the same way live and in an offline render that measures how loud each
  // one comes out at unit gain (filters keep only part of the noise), so the levels above hold.
  function tyreChain(ctx, bufs, dest, i) {
    const mk = (type, fr, q = 0.7) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = fr;
      b.Q.value = q;
      return b;
    };
    const g = (v) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    const play = (buf, off) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start(0, off);
      return s;
    };
    // Structure-borne rumble (the drone), the cavity's boom, the tread blocks' roar, and the chip seal's
    // hiss. The boom is 11 dB down for the foam inside the tyre. The tread's blocks come in several
    // pitch lengths so they don't sing one note: a broad roar round the block rate, not a tone.
    play(bufs.brown, i * 0.9).connect(mk('lowpass', 260, 0.6)).connect(dest);
    play(bufs.pink, i * 1.1 + 0.3).connect(mk('bandpass', CAVITY_HZ, 7)).connect(g(1.6 * 0.28)).connect(dest);
    const tread = mk('bandpass', 400, 1.1);
    play(bufs.pink, i * 0.7 + 1.9).connect(tread).connect(g(0.5)).connect(dest);
    play(bufs.white, i * 1.3 + 0.5).connect(mk('bandpass', 1300, 0.8)).connect(g(0.22)).connect(dest);
    return { tread };
  }
  function windChain(ctx, bufs, dest, i) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1100;
    band.Q.value = 0.45;
    const top = ctx.createBiquadFilter();
    top.type = 'lowpass';
    top.frequency.value = 4200;
    top.Q.value = 0.6;
    const s = ctx.createBufferSource();
    s.buffer = bufs.white;
    s.loop = true;
    s.start(0, i * 2.1);
    s.connect(band).connect(top).connect(dest);
    return { band };
  }
  function fanChain(ctx, bufs, dest) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    lp.Q.value = 0.5;
    const s = ctx.createBufferSource();
    s.buffer = bufs.pink;
    s.loop = true;
    s.start(0, 2.7);
    s.connect(lp).connect(dest);
  }
  /** The tyres' airborne roar, as a wall sends it back: the tread's and the road's band, no rumble. */
  function reflectChain(ctx, bufs, dest, i) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 0.5;
    const s = ctx.createBufferSource();
    s.buffer = bufs.pink;
    s.loop = true;
    s.start(0, i * 1.7 + 0.9);
    s.connect(band).connect(dest);
  }
  /** The suspension's compressor: a piston pump's buzz at its stroke rate, and its valves' rattle on each stroke. */
  function pumpChain(ctx, bufs, dest) {
    const STROKE = 52;                                   // Hz (estimate)
    const piston = ctx.createOscillator();
    piston.type = 'sawtooth';
    piston.frequency.value = STROKE;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.Q.value = 0.8;
    piston.connect(lp).connect(dest);
    piston.start();
    const rattle = ctx.createBufferSource();
    rattle.buffer = bufs.pink;
    rattle.loop = true;
    rattle.start(0, 3.3);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1500;
    const beat = ctx.createGain();
    beat.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = STROKE;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(beat.gain);
    lfo.start();
    rattle.connect(band).connect(beat).connect(dest);
  }
  /** Air bleeding out of the springs through the valve block. */
  function hissChain(ctx, bufs, dest) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    hp.Q.value = 0.6;
    const s = ctx.createBufferSource();
    s.buffer = bufs.white;
    s.loop = true;
    s.start(0, 1.7);
    s.connect(hp).connect(dest);
  }
  /** RMS of a chain at unit gain, from a second rendered offline. */
  async function measure(bufs, chain) {
    const off = new OfflineAudioContext(1, ac.sampleRate, ac.sampleRate);
    chain(off, bufs, off.destination, 0);
    const data = (await off.startRendering()).getChannelData(0);
    let sum = 0;
    for (let i = ac.sampleRate * 0.2; i < data.length; i++) sum += data[i] * data[i];
    return Math.sqrt(sum / (data.length - ac.sampleRate * 0.2)) || 1;
  }
  /** Unit-gain loudness of each chain; a sine of amplitude 1 is 0.707. Until measured, 0.3. */
  const rms = { tyre: 0.3, wind: 0.3, fan: 0.3, reflect: 0.3, pump: 0.3, hiss: 0.3, tone: Math.SQRT1_2 };

  function build() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ac = new Ctx();
    out = gainNode(1);
    meter = ac.createAnalyser();
    meter.fftSize = 8192;
    out.connect(meter);
    // The cabin: double-layer acoustic glass and the steel body take the edge off the highs.
    const cabin = filter('lowpass', 6500, 0.5);
    out.connect(cabin).connect(ac.destination);
    const bufs = { pink: noiseBuffer('pink'), brown: noiseBuffer('brown'), white: noiseBuffer('white') };
    const chains = { tyre: tyreChain, wind: windChain, fan: fanChain, reflect: reflectChain, pump: pumpChain, hiss: hissChain };
    Promise.all(Object.values(chains).map((chain) => measure(bufs, chain)))
      .then((measured) => Object.keys(chains).forEach((key, i) => (rms[key] = measured[i])))
      .catch((err) => console.warn('[cyb] sound levels not measured', err));

    const tyres = ['fl', 'fr', 'rl', 'rr'].map((key, i) => {
      const level = gainNode();
      const { tread } = tyreChain(ac, bufs, level, i);
      level.connect(panner(AT[key]));
      return { level, tread };
    });

    // Wind round the mirrors and the A-pillars, breathing with small gusts.
    const wind = ['mirrorL', 'mirrorR'].map((key, i) => {
      const level = gainNode();
      const { band } = windChain(ac, bufs, level, i);
      level.connect(panner(AT[key]));
      return { level, band, gust: 1, gustTo: 1 };
    });

    // The motors: two tones each at the shaft's whine orders, front and rear.
    const motors = ['motorF', 'motorR'].map((key, i) => {
      const level = gainNode();
      level.connect(panner(AT[key]));
      const tones = ORDERS.map((order, j) => {
        const o = ac.createOscillator();
        o.type = 'sine';
        const g = gainNode(j === 0 ? 0.9 : 0.43);          // the two orders' powers sum to one sine's
        o.connect(g).connect(level);
        o.start();
        return { o, order: order * (1 + i * 0.004) };     // the two units never quite in tune
      });
      return { level, tones };
    });

    // The rear steering's actuators: an electric groan at the rear axle while the rears move.
    const act = gainNode();
    const groan = ac.createOscillator();
    groan.type = 'sawtooth';
    groan.frequency.value = 118;
    groan.connect(filter('lowpass', 520, 1.2)).connect(act);
    groan.start();
    act.connect(panner([0, 0.5, -1.82]));

    // The climate fan behind the dash vents.
    const fan = gainNode();
    fanChain(ac, bufs, fan);
    fan.connect(panner(AT.dash));

    // The road's roar coming back off rock and banks, from each side.
    const walls = [-1, 1].map((side, i) => {
      const level = gainNode();
      reflectChain(ac, bufs, level, i);
      level.connect(panner([side * 2.4, 0.9, 0]));
      return level;
    });

    // The air suspension: its compressor (a piston pump's buzz) and the hiss of bleeding air.
    const pump = gainNode();
    pumpChain(ac, bufs, pump);
    pump.connect(panner(AT.compressor));
    const hiss = gainNode();
    hissChain(ac, bufs, hiss);
    hiss.connect(panner(AT.compressor));

    // Bumps: a short low thud, first under the front axle then the rear.
    const thudFront = panner([0, 0.4, 1.82]), thudRear = panner([0, 0.4, -1.82]);

    // The chime it plays when it starts driving itself (our own two notes).
    const chimeAt = panner(AT.dash);

    src = { tyres, wind, motors, act, groan, fan, walls, pump, hiss, brown: bufs.brown, thudFront, thudRear, chimeAt };
  }

  function thud(at, strength) {
    const s = ac.createBufferSource();
    s.buffer = src.brown;
    const lp = filter('lowpass', 95, 0.9);
    const g = gainNode(0);
    const t = ac.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gainOf(57) * 2.2 * strength, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    s.connect(lp).connect(g).connect(at);
    s.start(t, Math.random() * 3);
    s.stop(t + 0.2);
  }

  // Cracks and seams in Highway 1's chip seal: the same ones each ride, and the same ones the body
  // rides over (surface.js).
  const crackAfter = (s) => {
    let x = Math.floor(s) + 1;
    while (!isCrack(x)) x++;
    return x;
  };

  return {
    start() {
      if (!ac) build();
      ac?.resume();
    },
    chime() {
      if (!ac) return;
      const t = ac.currentTime + 0.05;
      [[880, 0], [1320, 0.16]].forEach(([f, dt]) => {
        const o = ac.createOscillator(), g = gainNode(0);
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t + dt);
        g.gain.linearRampToValueAtTime(0.1, t + dt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.5);
        o.connect(g).connect(src.chimeAt);
        o.start(t + dt);
        o.stop(t + dt + 0.6);
      });
    },
    /**
     * Each frame: the truck's state (v m/s, ax m/s², rearRate rad/s, s m along the road, dt s, the
     * climate's fan speed, whether it's parked, and how much of each side is rock or bank, 0 to 1),
     * and the listener (your head) in the truck's frame: position and its forward and up directions.
     */
    update({ v, ax, rearRate, s, dt, fan, parked = false, walls = { left: 0, right: 0 } }, head) {
      if (!ac || !src) return;
      const t = ac.currentTime, tc = 0.12;
      const l = levels({ v, ax, rearRate, fan });
      const set = (param, value, k = tc) => param.setTargetAtTime(value, t, k);
      // Spread a level over n sources (each a share of the power).
      const share = (db, n) => (Number.isFinite(db) ? gainOf(db - 10 * Math.log10(n)) : 0);

      for (const tyre of src.tyres) {
        set(tyre.level.gain, share(l.tyres, 4) / rms.tyre);
        set(tyre.tread.frequency, Math.max(40, v / TREAD_PITCH));
      }
      for (const w of src.wind) {
        // Gusts: a new gentle target every so often, about +-2 dB.
        if (Math.random() < dt * 0.8) w.gustTo = 10 ** ((Math.random() * 4 - 2) / 20);
        w.gust += (w.gustTo - w.gust) * Math.min(1, dt * 1.5);
        set(w.level.gain, (share(l.wind, 2) / rms.wind) * w.gust, 0.25);
        set(w.band.frequency, 800 + 20 * v);
      }
      const shaftHz = (v / (2 * Math.PI * ROLLING_RADIUS)) * GEAR;
      for (const m of src.motors) {
        set(m.level.gain, share(l.motors, 2) / rms.tone, 0.08);
        for (const { o, order } of m.tones) set(o.frequency, Math.max(20, shaftHz * order), 0.05);
      }
      set(src.act.gain, Number.isFinite(l.actuators) ? gainOf(l.actuators) * 2.5 : 0, 0.06);
      set(src.groan.frequency, 105 + Math.min(60, Math.abs(rearRate) * 2000), 0.06);
      set(src.fan.gain, gainOf(l.fan) / rms.fan);

      // The road's roar back off the rock: as much as the bank fills that side.
      [walls.left, walls.right].forEach((fill, i) => {
        const db = l.tyres + AIRBORNE + 10 * Math.log10(fill);
        set(src.walls[i].gain, Number.isFinite(db) ? gainOf(db) / rms.reflect : 0, 0.3);
      });

      // The suspension: back up from Entry above 10 mph, the compressor running a while; once parked,
      // down to Entry with a hiss (two levels down: from the ride height, past Low).
      suspension.parkedFor = parked ? suspension.parkedFor + dt : 0;
      if (suspension.height === 'entry' && v > RAISE_AT) {
        suspension.height = 'ride';
        const g = src.pump.gain;
        g.cancelScheduledValues(t);
        g.setTargetAtTime(gainOf(PUMP_DB) / rms.pump, t, 0.1);
        g.setTargetAtTime(0, t + PUMP_S, 0.15);
      } else if (suspension.height === 'ride' && suspension.parkedFor > 1) {
        suspension.height = 'entry';
        const g = src.hiss.gain;
        g.cancelScheduledValues(t);
        g.setTargetAtTime(gainOf(HISS_DB) / rms.hiss, t, 0.04);
        g.setTargetAtTime(0, t + 0.3, HISS_S / 3);
      }

      // Bumps under each axle as it rolls over a crack.
      if (v > 1) {
        // The front axle, half the wheelbase ahead of s, reaches it first.
        const front = s + thumps.axleGap / 2;
        if (!thumps.next || thumps.next < front - 20) thumps.next = crackAfter(front);
        if (front >= thumps.next) {
          const strength = Math.min(1, v / 18) * crackStrength(thumps.next);
          thud(src.thudFront, strength);
          setTimeout(() => ac && thud(src.thudRear, strength * 0.9), (thumps.axleGap / v) * 1000);
          thumps.next = crackAfter(thumps.next);
        }
      }

      if (head) {
        const L = ac.listener;
        // Web Audio's frame is right-handed (ahead is -z): flip z.
        const [px, py, pz] = head.position, [fx, fy, fz] = head.forward, [ux, uy, uz] = head.up;
        if (L.positionX) {
          L.positionX.value = px;
          L.positionY.value = py;
          L.positionZ.value = -pz;
          L.forwardX.value = fx;
          L.forwardY.value = fy;
          L.forwardZ.value = -fz;
          L.upX.value = ux;
          L.upY.value = uy;
          L.upZ.value = -uz;
        } else {
          L.setPosition(px, py, -pz);
          L.setOrientation(fx, fy, -fz, ux, uy, -uz);
        }
      }
    },
    /** For checks: the output's level now, in dB below full scale. */
    level() {
      if (!meter) return -Infinity;
      const d = new Float32Array(meter.fftSize);
      meter.getFloatTimeDomainData(d);
      return 10 * Math.log10(d.reduce((a, x) => a + x * x, 0) / d.length);
    },
    stop() {
      if (!ac || !src) return;
      const t = ac.currentTime;
      for (const g of [...src.tyres.map((x) => x.level), ...src.wind.map((x) => x.level), ...src.motors.map((x) => x.level), src.act, src.fan, ...src.walls, src.pump, src.hiss]) {
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, 0.25);
      }
      Object.assign(suspension, { height: 'entry', parkedFor: 0 });
    },
  };
}
