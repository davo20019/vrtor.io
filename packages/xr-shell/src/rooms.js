// Changing rooms from the headset. Each room is its own page, and a page can't take its VR
// session along to the next one, so picking a room in the headset leaves VR and opens that
// room with `?vr=1`. There, the Enter VR button reads "Continue in VR": one press and the
// visitor is back in the headset. A browser that hands the session over on navigation
// (WebXR's `sessiongranted`, behind a flag on Quest) goes straight back in.

/** The rooms served on vrtor.io (apps/home/src/subjects.js lists every subject). */
export const ROOMS = [
  { code: 'snd', name: 'Sound Lab' },
  { code: 'taj', name: 'Taj Mahal' },
  { code: 'giza', name: 'Great Pyramid' },
  { code: 'mpc', name: 'Machu Picchu' },
  { code: 'apo', name: 'Apollo 11' },
  { code: 'fly', name: 'Wright Flyer' },
  { code: 'orca', name: 'Orca' },
  { code: 'bdy', name: 'Human body' },
  { code: 'cel', name: 'The cell' },
  { code: 'aif', name: 'AI foundations' },
  { code: 'spc', name: 'Space' },
];

let granted = false;
let onGranted = null;
navigator.xr?.addEventListener?.('sessiongranted', () => {
  granted = true;
  onGranted?.();
});

async function leave(rig, href) {
  try {
    await rig?.exit();
  } catch {
    // Leaving anyway: the page change ends the session.
  }
  location.assign(href);
}

/**
 * The headset card's page of the other rooms. `here` is this room's code, `button(label,
 * onClick, primary)` makes one of the subject's card actions, and `onBack` returns to the card.
 */
export function roomsCard(here, rig, button, onBack) {
  const choices = ROOMS.filter((r) => r.code !== here).map((r) => button(r.name, () => leave(rig, `/${r.code}/?vr=1`)));
  return {
    kicker: 'Change room',
    title: 'Where to next?',
    body: 'VR pauses briefly while the next room loads.',
    fact: '',
    choices,
    // Keep the room grid to three rows as the catalog grows; home fits beside Back.
    actions: [button('VRtor home', () => leave(rig, '/')), button('Back', onBack, true)],
  };
}

/**
 * Call once, when the room is ready (`rig` null if VR isn't available). Arriving from another
 * room's headset, `ctaButton` reads "Continue in VR"; the `?vr=1` comes off the address so a
 * reload or a shared link doesn't carry it.
 */
export function continueInVr(rig, ctaButton) {
  const params = new URLSearchParams(location.search);
  const arrived = params.has('vr');
  if (arrived) {
    params.delete('vr');
    const query = params.toString();
    history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  }
  if (!rig) return;
  if (arrived && ctaButton) {
    const strong = ctaButton.querySelector('strong');
    const small = ctaButton.querySelector('small');
    if (strong) strong.textContent = 'Continue in VR';
    if (small) small.textContent = 'Step back into the headset';
  }
  const enter = () => rig.enter().catch((err) => console.warn('[xr] could not continue in VR', err));
  if (granted) enter();
  else onGranted = enter;
}
