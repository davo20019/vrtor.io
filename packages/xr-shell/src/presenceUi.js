// The controls for presence.js, shared by every subject: buttons for the flat-screen
// bar (with a rename form and arrival notices), and a card page for the headset (the
// subject's createCard panel). The bar pieces bring their own styles, drawn from the
// subject's --panel, --accent, --muted and --text colors.

const STYLE = `
.presence-controls { display: contents; }
.presence-mic.live { box-shadow: 0 0 0 3px var(--accent, #ffb020); }
.presence-note, .presence-rename { margin: 0; font-size: 12px; color: var(--muted, #c9c4ba); background: var(--panel, rgba(12,13,18,.9)); padding: 6px 8px 6px 12px; border-radius: 99px; display: flex; align-items: center; gap: 8px; }
.presence-note[hidden], .presence-rename[hidden] { display: none; }
.presence-link { font: inherit; font-size: 12px; color: var(--accent, #ffb020); background: none; border: 0; padding: 2px 6px; cursor: pointer; text-decoration: underline; }
.presence-rename input { font: inherit; font-size: 13px; width: 11em; max-width: 40vw; color: var(--text, #fff); background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.25); border-radius: 99px; padding: 4px 10px; }
.presence-toast { position: fixed; left: 50%; top: 72px; transform: translate(-50%, -8px); opacity: 0; pointer-events: none; z-index: 5; font-size: 14px; color: var(--text, #fff); background: var(--panel, rgba(12,13,18,.9)); border: 1px solid var(--accent, #ffb020); padding: 8px 16px; border-radius: 99px; transition: opacity .25s, transform .25s; white-space: nowrap; max-width: calc(100% - 32px); overflow: hidden; text-overflow: ellipsis; }
.presence-toast.show { opacity: 1; transform: translate(-50%, 0); }
`;
let styled = false;
function addStyle() {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.textContent = STYLE;
  document.head.append(el);
}

/**
 * These buttons can wrap the bar onto a second row on a phone. Publishes how far the
 * bar's top sits above the viewport bottom as --bar-top, so the card stays above it.
 */
function trackBarTop(bar) {
  if (!bar) return;
  const root = document.documentElement;
  const measure = () => root.style.setProperty('--bar-top', `${Math.ceil(innerHeight - bar.getBoundingClientRect().top)}px`);
  new ResizeObserver(measure).observe(bar);
  addEventListener('resize', measure);
  measure();
}

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
  addStyle();
  const note = document.createElement('p');
  note.className = 'presence-note';
  const noteText = document.createElement('span');
  noteText.setAttribute('role', 'status');
  const renameButton = document.createElement('button');
  renameButton.type = 'button';
  renameButton.className = 'presence-link';
  renameButton.textContent = 'Change name';
  note.append(noteText, renameButton);

  const form = document.createElement('form');
  form.className = 'presence-rename';
  form.hidden = true;
  const input = document.createElement('input');
  input.maxLength = 20;
  input.autocomplete = 'nickname';
  input.setAttribute('aria-label', 'Your name');
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'presence-link';
  save.textContent = 'Save';
  const shuffle = document.createElement('button');
  shuffle.type = 'button';
  shuffle.className = 'presence-link';
  shuffle.textContent = 'Random';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'presence-link';
  cancel.textContent = 'Cancel';
  form.append(input, save, shuffle, cancel);
  container.append(people, mic, note, form);

  trackBarTop(container.closest('.bar') ?? container.parentElement);

  const toast = document.createElement('div');
  toast.className = 'presence-toast';
  toast.setAttribute('role', 'status');
  document.body.append(toast);
  let lastNotice = 0;
  let toastTimer = 0;

  let editing = false;
  const edit = (on) => {
    editing = on;
    form.hidden = !on;
    note.hidden = on;
    if (on) {
      input.value = presence.state.me?.name ?? '';
      input.focus();
      input.select();
    }
  };
  people.addEventListener('click', () => (presence.state.joined ? presence.leave() : presence.join()));
  mic.addEventListener('click', () => presence.setMic(!presence.state.micOn));
  renameButton.addEventListener('click', () => edit(true));
  cancel.addEventListener('click', () => edit(false));
  shuffle.addEventListener('click', () => {
    presence.setName(null, { random: true });
    edit(false);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    presence.setName(input.value);
    edit(false);
  });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // typing a name isn't walking
    if (e.key === 'Escape') edit(false);
  });

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
    if (!state.joined && editing) edit(false);
    note.hidden = editing || (!state.joined && !state.micError);
    renameButton.hidden = !state.joined;
    noteText.textContent = state.micError || `${presenceSummary(state)} Tap someone to mute them.`;
    if (state.notice && state.notice.n !== lastNotice) {
      lastNotice = state.notice.n;
      toast.textContent = state.notice.text;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
    }
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
      // Typing is hard with a controller: the headset offers a new random name instead.
      actions.push(action('New name', () => presence.setName(null, { random: true })));
      actions.push(action('Leave', () => presence.leave()));
    } else {
      actions.push(action('Join others', () => presence.join(), true));
    }
  }
  if (!state.joined) actions.push(action('Back', back));
  return {
    kicker: `Visitors · ${state.online || 0} here`,
    title: state.joined ? `You are ${state.me?.name}` : 'Explore with others',
    body: state.micError || presenceSummary(state),
    fact: state.joined
      ? 'Your mic is off until you choose Talk. Voices fade with distance. Point at someone and pull the trigger to mute them for you.'
      : 'Joining shows you to others as a simple avatar with a random name, and lets you hear people near you. Nobody hears you unless you turn on your mic.',
    actions,
  };
}
