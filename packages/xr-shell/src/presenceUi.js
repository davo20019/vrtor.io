// The controls for presence.js, shared by every subject: buttons for the flat-screen
// bar, and a card page for the headset (the subject's createCard panel).

/** What the people button and card say about the room right now. */
export function presenceSummary(state) {
  const others = Math.max(0, state.online - 1);
  if (state.status === 'off') return 'Shared visits are paused right now.';
  if (state.status !== 'online') return 'Connecting to other visitors…';
  if (!state.joined) {
    return others ? `${others} other ${others === 1 ? 'person is' : 'people are'} exploring here now.` : 'Nobody else is here right now.';
  }
  const visible = state.here - 1;
  const seen = visible ? `${visible} other ${visible === 1 ? 'person' : 'people'} visible` : 'Nobody else is visible yet';
  return `You appear as ${state.me?.name}. ${seen}.`;
}

/**
 * Adds the people and mic buttons (and a status line) to `container`, styled with
 * the subject's `.btn`. Returns `update(state)`, to call from presence's onChange.
 */
export function mountPresenceControls(presence, container) {
  const people = document.createElement('button');
  people.type = 'button';
  people.className = 'btn presence-people';
  const mic = document.createElement('button');
  mic.type = 'button';
  mic.className = 'btn presence-mic';
  const note = document.createElement('p');
  note.className = 'presence-note';
  note.setAttribute('role', 'status');
  container.append(people, mic, note);

  people.addEventListener('click', () => (presence.state.joined ? presence.leave() : presence.join()));
  mic.addEventListener('click', () => presence.setMic(!presence.state.micOn));

  return function update(state) {
    const online = state.status === 'online';
    people.hidden = state.status === 'off';
    people.disabled = !online;
    people.textContent = !online ? 'Connecting…' : state.joined ? 'Leave others' : `Join others · ${state.online} here`;
    people.classList.toggle('btn-primary', online && !state.joined && state.online > 1);
    mic.hidden = !(state.joined && state.voice);
    mic.textContent = state.micOn ? 'Mute mic' : 'Talk';
    mic.classList.toggle('live', state.micLive);
    mic.setAttribute('aria-pressed', String(state.micOn));
    note.hidden = !state.joined && !state.micError;
    note.textContent = state.micError || `${presenceSummary(state)} Tap someone to mute them.`;
  };
}

/**
 * The headset card page: { kicker, title, body, fact, actions } for createCard's
 * setContent. `action(label, onClick, primary)` is the subject's own action
 * builder; `back` returns to the subject's card.
 */
export function presenceCard(presence, action, back) {
  const state = presence.state;
  const actions = [];
  if (state.status === 'online') {
    if (state.joined) {
      if (state.voice) actions.push(action(state.micOn ? 'Mute mic' : 'Talk', () => presence.setMic(!state.micOn), !state.micOn));
      actions.push(action('Leave', () => presence.leave()));
    } else {
      actions.push(action('Join others', () => presence.join(), true));
    }
  }
  actions.push(action('Back', back));
  return {
    kicker: `Visitors · ${state.online || 0} here`,
    title: state.joined ? 'You are visible' : 'Explore with others',
    body: state.micError || presenceSummary(state),
    fact: state.joined
      ? 'Your mic is off until you choose Talk. Voices fade with distance. Point at someone and pull the trigger to mute them for you.'
      : 'Joining shows you to others as a simple avatar with a random name, and lets you hear people near you. Nobody hears you unless you turn on your mic.',
    actions,
  };
}
