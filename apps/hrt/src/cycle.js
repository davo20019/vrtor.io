// One heartbeat at 75 beats a minute (800 ms), as the weights of the model's morph targets: vsys (the ventricles
// squeezed to end-systole), afill (the atria full) and open_<valve>, plus the ECG and the name of the phase.
//
// t = 0 is the start of the ventricles' contraction, when the mitral and tricuspid valves close (just after the
// ECG's R wave). Phase durations at 75 bpm (assets-src/heart/refs/literature.md): isovolumic contraction 38 ms,
// ejection 275 ms (Alhakak 2025's heart-rate slopes); isovolumic relaxation 67 ms (Nagueh 2009, Doppler, age
// 21-40); atrial systole about 130 ms; PR interval 160 ms, QRS 90 ms (Rijnbeek 2014). The right heart's valves
// open a little before and close a little after the left's (the pulmonary valve opens before the aortic and
// closes after it; the tricuspid opens before the mitral).
export const RR = 800;
const IVC = 38;
const EJECT_END = IVC + 275;          // 313: aortic valve closes
const IVR_END = EJECT_END + 67;       // 380: mitral valve opens
const RAPID_END = IVR_END + 150;      // 530: end of rapid filling
const ATRIAL = RR - 130;              // 670: atria contract

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const ramp = (t, a, b) => smooth((t - a) / (b - a));
/** Piecewise curve through [time, value] knots, eased between them. */
function curve(knots, t) {
  for (let i = 1; i < knots.length; i++) {
    const [t0, v0] = knots[i - 1];
    const [t1, v1] = knots[i];
    if (t <= t1) return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
  }
  return knots[knots.length - 1][1];
}

// How far the ventricles are squeezed (0 at end-diastole, 1 at end-systole). Ejection is fastest early: most of
// the stroke volume leaves in its first third. The atria's kick is the last 20-25% of filling.
const VENT = [[0, 0], [IVC, 0.03], [IVC + 90, 0.62], [EJECT_END, 1], [IVR_END, 1], [RAPID_END, 0.27], [ATRIAL, 0.22], [RR, 0]];
// How full the atria are (0 right after their contraction, 1 at their largest, just before the AV valves open).
const ATRIA = [[0, 0], [EJECT_END, 0.92], [IVR_END, 1], [RAPID_END, 0.55], [ATRIAL, 0.5], [RR, 0]];

/** Valve openings, 0 shut to 1 fully open. */
function valves(t) {
  const aortic = ramp(t, IVC, IVC + 25) * (1 - ramp(t, EJECT_END - 20, EJECT_END));
  const pulmonary = ramp(t, IVC - 10, IVC + 15) * (1 - ramp(t, EJECT_END - 5, EJECT_END + 15));
  // Mitral: opens at the end of relaxation, drifts half shut in diastasis, opens again with the atria's kick
  const mitral = t < IVR_END ? 0 : curve([[IVR_END, 0], [IVR_END + 40, 1], [RAPID_END, 0.85], [ATRIAL - 10, 0.5], [ATRIAL + 50, 0.9], [RR - 25, 0.4], [RR, 0]], t);
  const tricuspid = t < IVR_END - 10 ? 0 : curve([[IVR_END - 10, 0], [IVR_END + 30, 1], [RAPID_END, 0.85], [ATRIAL - 10, 0.5], [ATRIAL + 50, 0.9], [RR - 15, 0.45], [RR, 0.05]], t);
  return { open_av: aortic, open_pv: pulmonary, open_mv: mitral, open_tv: tricuspid };
}

// The ECG (lead II), in mV: P wave as the atria are activated, QRS as the ventricles are, T as they recover.
// QRS onset 30 ms before contraction (t = RR - 30), P onset 160 ms before QRS.
const g = (t, at, w, h) => h * Math.exp(-(((t - at) / w) ** 2));
function ecg(t) {
  const u = t > RR - 200 ? t - RR : t;   // around the wrap, P and QRS sit at negative times
  return g(u, -150, 25, 0.15)            // P
    - g(u, -28, 6, 0.1) + g(u, -12, 8, 1.1) - g(u, 4, 7, 0.25)   // Q, R, S
    + g(u, 260, 45, 0.3);                // T
}

export const PHASES = [
  { until: IVC, name: 'Isovolumic contraction', text: 'The ventricles start to squeeze. Their pressure shuts the mitral and tricuspid valves (the first heart sound, "lub"), but is not yet high enough to open the aortic and pulmonary valves: every valve is shut for about 40 ms.' },
  { until: EJECT_END, name: 'Ejection', text: 'Pressure in the ventricles passes that in the arteries: the aortic and pulmonary valves open and blood leaves, most of it in the first third. The base of the heart is pulled towards the apex, and the left ventricle wrings like a towel (the apex turns one way, the base the other).' },
  { until: IVR_END, name: 'Isovolumic relaxation', text: 'The ventricles relax. Blood falling back shuts the aortic and pulmonary valves (the second heart sound, "dub"). All four valves are shut again while the pressure falls.' },
  { until: RAPID_END, name: 'Rapid filling', text: 'Pressure in the ventricles falls below that in the atria: the mitral and tricuspid valves open and blood that gathered in the atria pours in. The ventricles spring back and suck it in.' },
  { until: ATRIAL, name: 'Diastasis', text: 'The ventricles are nearly full. Blood flows slowly from the veins, through the atria, into them. The valve leaflets drift half shut.' },
  { until: RR, name: 'Atrial contraction', text: 'The atria squeeze (just after the ECG\'s P wave) and top up the ventricles with the last fifth of their blood. Then the ventricles start to contract and the cycle begins again.' },
];

// Contraction follows the electrical activation: the model's ventricles and atria are split into four bands each
// by when their muscle is activated (assets-src/heart/cycle_bands.py: bands 24 and 30 ms apart in activation,
// contraction spreading over 60% of that), each band playing the same curve with its own delay.
const VENT_DELAYS = [0, 14.4, 28.8, 43.2];
const ATR_DELAYS = [0, 18, 36, 54];
const wrap = (t) => ((t % RR) + RR) % RR;

/** Everything for time t (ms, any value: it wraps). */
export function at(time) {
  const t = wrap(time);
  const phase = PHASES.find((p) => t < p.until) ?? PHASES[PHASES.length - 1];
  const weights = { vsys: curve(VENT, t), afill: curve(ATRIA, t), ...valves(t) };
  VENT_DELAYS.forEach((d, k) => { weights[`vsys_${k}`] = curve(VENT, wrap(t - d)); });
  ATR_DELAYS.forEach((d, k) => { weights[`afill_${k}`] = curve(ATRIA, wrap(t - d)); });
  return { t, phase, weights, ecg: ecg(t) };
}

export { ecg };
