// The fruit every step works with. Each one is a real-size piece of fruit with the two things the
// machine can measure: its size (diameter, cm) and its colour (hue, degrees: 0 red, 30 orange, 100 green).
// The values are chosen by hand so the story works: red apples and oranges mostly differ in colour, a
// few overlap (a yellowish apple, a blood orange), and the green apples of step 5 sit beyond the
// oranges on the colour axis, where one straight line can't fence them off.

/** `kind` is what the fruit really is; the visitor's sorting gives each one its label. */
export const FIRST_FRUIT = [
  { kind: 'apple', size: 7.2, hue: 6 },
  { kind: 'orange', size: 8.6, hue: 32 },
  { kind: 'apple', size: 7.6, hue: 3 },
  { kind: 'orange', size: 9.2, hue: 30 },
  { kind: 'apple', size: 8.1, hue: 9 },
  { kind: 'orange', size: 7.9, hue: 35 },
  { kind: 'apple', size: 7.0, hue: 12 },
  { kind: 'orange', size: 8.8, hue: 28 },
  { kind: 'apple', size: 7.9, hue: 5 },
  { kind: 'orange', size: 9.4, hue: 33 },
  { kind: 'apple', size: 8.4, hue: 14 },
  { kind: 'orange', size: 8.2, hue: 38 },
  { kind: 'apple', size: 7.4, hue: 8 },
  { kind: 'orange', size: 9.0, hue: 26 },
  // The two that overlap: a yellow-red apple and a blood orange.
  { kind: 'apple', size: 7.8, hue: 23 },
  { kind: 'orange', size: 7.7, hue: 17 },
];

/** Step 5's newcomers: green apples. Apples are now at both ends of the colour axis. */
export const GREEN_APPLES = [
  { kind: 'green', size: 7.3, hue: 95 },
  { kind: 'green', size: 7.8, hue: 100 },
  { kind: 'green', size: 8.2, hue: 90 },
  { kind: 'green', size: 7.1, hue: 105 },
  { kind: 'green', size: 8.0, hue: 86 },
  { kind: 'green', size: 7.6, hue: 110 },
];

/** Fruit the machine never trained on, handed to it at the end to see if it learned the pattern. */
export const NEW_FRUIT = [
  { kind: 'orange', size: 8.9, hue: 31 },
  { kind: 'green', size: 7.7, hue: 98 },
  { kind: 'apple', size: 7.5, hue: 10 },
  { kind: 'orange', size: 8.3, hue: 24 },
  { kind: 'green', size: 8.3, hue: 82 },
  { kind: 'apple', size: 8.0, hue: 2 },
];

/** Green apples are apples: the machine only answers apple (0) or orange (1). */
export const isOrange = (kind) => (kind === 'orange' ? 1 : 0);

/** The board's axes. */
export const SIZE_RANGE = [6.5, 10];
export const HUE_RANGE = [0, 60];
export const HUE_RANGE_WIDE = [0, 120];

/** Colour of a fruit's skin from its hue, a little darker for apples (they're glossier and deeper). */
export function skinColor(f) {
  const s = f.kind === 'orange' ? 0.92 : 0.85;
  const l = f.kind === 'orange' ? 0.5 : f.kind === 'green' ? 0.45 : 0.4;
  return hsl(f.hue, s, l);
}

function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}
