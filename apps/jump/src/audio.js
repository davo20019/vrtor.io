// Every sound is made here from noise and oscillators (Web Audio), so there are no recordings
// to license: the wind, which rises with airspeed into a roar in freefall; the canopy's fabric
// fluttering; the opening; the helicopter's rotor and turbine; and the audible altimeter's beeps.
// Browsers start audio only after a click or a button press: call start() from one.

export function createAudio() {
  let ctx = null;
  let nodes = null;

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Pink-ish noise: softer than white, closer to rushing air.
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    }
    return buffer;
  }
  function loop(buffer) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = 0;
    src.start(0, Math.random() * buffer.duration);
    return src;
  }
  function filter(type, frequency, q = 0.7) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    return f;
  }
  function gain(value = 0) {
    const g = ctx.createGain();
    g.gain.value = value;
    return g;
  }
  const chain = (...list) => list.reduce((a, b) => (a.connect(b), b));

  function build() {
    const master = gain(0.9);
    master.connect(ctx.destination);
    const noise = noiseBuffer(4);
    // Wind: a body (low roar) and a hiss whose brightness follows the speed.
    const roarGain = gain();
    chain(loop(noise), filter('lowpass', 180), roarGain, master);
    const hissFilter = filter('bandpass', 800, 0.5);
    const hissGain = gain();
    chain(loop(noise), hissFilter, hissGain, master);
    // Fabric: band-limited noise beaten by a slow, uneven flutter.
    const flutterGain = gain();
    const flutterDepth = gain(0.5);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9;
    lfo.connect(flutterDepth);
    flutterDepth.connect(flutterGain.gain);
    lfo.start();
    const fabric = gain();
    chain(loop(noise), filter('bandpass', 1400, 1.2), flutterGain, fabric, master);
    // Helicopter: blade slap (noise chopped at the blade-pass rate) and the turbine's whine.
    const slap = gain();
    const chop = ctx.createOscillator();
    chop.type = 'square';
    chop.frequency.value = 12.8;
    const chopDepth = gain(0.5);
    chop.connect(chopDepth);
    chopDepth.connect(slap.gain);
    chop.start();
    const heli = gain();
    chain(loop(noise), filter('lowpass', 520, 1.4), slap, heli, master);
    const whine = ctx.createOscillator();
    whine.type = 'sawtooth';
    whine.frequency.value = 1780;
    const whineGain = gain(0.035);
    chain(whine, filter('bandpass', 1780, 8), whineGain, heli);
    whine.start();
    const thump = ctx.createOscillator();
    thump.frequency.value = 25.6;
    const thumpGain = gain(0.25);
    chain(thump, thumpGain, heli);
    thump.start();
    return { master, roarGain, hissGain, hissFilter, flutterGain, flutterDepth, fabric, lfo, heli, noise };
  }

  const smooth = (param, value, time = 0.12) => param.setTargetAtTime(value, ctx.currentTime, time);

  return {
    start() {
      if (!ctx) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        ctx = new Context();
        nodes = build();
      }
      if (ctx.state === 'suspended') ctx.resume();
    },
    get running() {
      return !!ctx && ctx.state === 'running';
    },
    /**
     * airspeed m/s; canopy 0..1 (how open it is); flutter 0..1 (brakes, turns, the opening);
     * heliDistance m (Infinity for none).
     */
    update({ airspeed, canopy, flutter, heliDistance }) {
      if (!nodes) return;
      const k = Math.min(1, airspeed / 60);
      // Under a canopy the ears are out of the freefall blast: the same airspeed sounds calmer.
      const exposure = 1 - 0.55 * canopy;
      smooth(nodes.roarGain.gain, 0.9 * k * k * exposure);
      smooth(nodes.hissGain.gain, 0.5 * Math.pow(k, 1.5) * exposure);
      smooth(nodes.hissFilter.frequency, 500 + 2600 * k);
      smooth(nodes.fabric.gain, canopy * (0.05 + 0.25 * flutter));
      smooth(nodes.lfo.frequency, 6 + 14 * flutter);
      const heli = Number.isFinite(heliDistance) ? Math.min(1, 12 / Math.max(6, heliDistance)) : 0;
      smooth(nodes.heli.gain, 0.55 * heli, 0.3);
    },
    /** The canopy opening: two seconds of violent flapping, then the snap of the slider coming down. */
    opening() {
      if (!nodes) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = nodes.noise;
      const f = filter('bandpass', 900, 0.8);
      const g = gain();
      const flap = ctx.createOscillator();
      flap.frequency.setValueAtTime(22, t);
      flap.frequency.linearRampToValueAtTime(8, t + 2.4);
      const depth = gain(0.6);
      flap.connect(depth);
      depth.connect(g.gain);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.7, t + 1.4);
      g.gain.linearRampToValueAtTime(0.9, t + 2.2);
      g.gain.exponentialRampToValueAtTime(0.01, t + 3.4);
      chain(src, f, g, nodes.master);
      src.start(t, Math.random());
      flap.start(t);
      src.stop(t + 3.5);
      flap.stop(t + 3.5);
    },
    /** The audible altimeter: `count` beeps, or one long tone. */
    beep(count = 1, long = false) {
      if (!nodes) return;
      const t = ctx.currentTime;
      for (let i = 0; i < count; i++) {
        const o = ctx.createOscillator();
        o.frequency.value = 2900;
        const g = gain();
        const at = t + i * 0.22;
        const length = long ? 1.6 : 0.13;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.25, at + 0.01);
        g.gain.setValueAtTime(0.25, at + length - 0.02);
        g.gain.linearRampToValueAtTime(0, at + length);
        chain(o, g, nodes.master);
        o.start(at);
        o.stop(at + length + 0.05);
      }
    },
    /** Landing: a thud whose weight follows the sink rate. */
    thud(sink) {
      if (!nodes) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = nodes.noise;
      const g = gain();
      g.gain.setValueAtTime(Math.min(1, 0.2 + sink * 0.15), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      chain(src, filter('lowpass', 160 + sink * 40), g, nodes.master);
      src.start(t);
      src.stop(t + 0.6);
    },
    /** A short instruction, spoken where the browser can (the radio instructor on the ground). */
    say(text) {
      try {
        if (!('speechSynthesis' in window)) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05;
        u.volume = 1;
        speechSynthesis.speak(u);
      } catch {
        // Speech is a nicety; the wrist shows the same words.
      }
    },
  };
}
