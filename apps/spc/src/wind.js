// Thin Martian wind: filtered noise with slow gusts, made in the browser (no audio file).
// Browsers only allow sound after a tap or click, so it starts on the first one.

export function createWind() {
  let ctx = null;
  let out = null;
  let on = true;

  function build() {
    ctx = new AudioContext();
    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Brown noise: a random walk, softer and lower than white noise.
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.7;

    // Gusts: a slow wobble on the volume and the filter.
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.07;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 0.025;
    const sweep = ctx.createGain();
    sweep.gain.value = 160;
    gust.connect(gustDepth);
    gust.connect(sweep);
    sweep.connect(filter.frequency);

    const level = ctx.createGain();
    level.gain.value = 0.045;
    gustDepth.connect(level.gain);

    out = ctx.createGain();
    out.gain.value = 0;
    noise.connect(filter).connect(level).connect(out).connect(ctx.destination);
    noise.start();
    gust.start();
  }

  const fadeTo = (value) => out?.gain.setTargetAtTime(value, ctx.currentTime, 0.6);

  return {
    start() {
      if (!on) return;
      if (!ctx) build();
      ctx.resume();
      fadeTo(1);
    },
    /** Flips sound on or off; returns whether it is now on. */
    toggle() {
      on = !on;
      if (on) this.start();
      else fadeTo(0);
      return on;
    },
  };
}
