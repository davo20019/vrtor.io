// Type the room slug into the hero address bar, cycling through rooms.
(() => {
  const path = document.querySelector('.path[data-type]');
  if (!path) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const words = ['accent', 'interview', 'cafe', 'scale'];
  if (reduce) { path.textContent = words[0]; return; }

  let w = 0, i = 0, deleting = false;
  const tick = () => {
    const word = words[w];
    i += deleting ? -1 : 1;
    path.textContent = word.slice(0, i);
    let delay = deleting ? 55 : 110;
    if (!deleting && i === word.length) { deleting = true; delay = w === 0 ? 3200 : 1600; }
    else if (deleting && i === 0) { deleting = false; w = (w + 1) % words.length; delay = 400; }
    setTimeout(tick, delay);
  };
  setTimeout(tick, 500);
})();

// Copy link button
document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const label = btn.textContent;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = btn.dataset.copy;
    }
    setTimeout(() => { btn.textContent = label; }, 1800);
  });
});

// Waitlist
(() => {
  const form = document.querySelector('.wl-form');
  if (!form) return;
  const msg = document.querySelector('.wl-msg');
  const roomInput = form.querySelector('input[name="room"]');
  const email = form.querySelector('input[name="email"]');

  // "Get notified" on a planned room jumps to the form, tagged with that room.
  document.querySelectorAll('[data-room]').forEach((btn) => {
    btn.addEventListener('click', () => {
      roomInput.value = btn.dataset.room;
      msg.textContent = `You'll hear when ${btn.closest('.room').querySelector('h3').textContent} opens.`;
      msg.classList.remove('error');
      document.getElementById('waitlist').scrollIntoView({ behavior: 'smooth' });
      email.focus({ preventScroll: true });
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    msg.classList.remove('error');
    msg.textContent = 'Joining…';
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.value, room: roomInput.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not join the waitlist. Try again.');
      msg.textContent = "You're on the waitlist.";
      form.reset();
      roomInput.value = 'any';
    } catch (err) {
      msg.classList.add('error');
      msg.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
})();
