// vrtor.io edge worker.
// Static pages live in /public and are served by Workers Static Assets.
// This worker only runs for paths that aren't a static file:
//   - short room links (vrtor.io/ac) that are easy to type in a headset browser
//   - the waitlist API

import { ROOMS } from './rooms.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const slug = url.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();

    if (slug === 'api/waitlist') return handleWaitlist(request, env);

    const room = ROOMS[slug];
    if (room?.url) {
      const target = new URL(room.url);
      // Carry through any query (e.g. ?xrdebug) and tag the visit as coming from vrtor.
      url.searchParams.forEach((v, k) => target.searchParams.set(k, v));
      if (!target.searchParams.has('ref')) target.searchParams.set('ref', 'vrtor');
      return Response.redirect(target.toString(), 302);
    }

    return env.ASSETS.fetch(new Request(new URL('/404.html', url), request)).then(
      (res) => new Response(res.body, { status: 404, headers: res.headers }),
    );
  },
};

async function handleWaitlist(request, env) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Send JSON with an email field.' }, 400);
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const room = String(body.room ?? 'any').slice(0, 40);
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'Enter a valid email address.' }, 400);
  }

  const key = `waitlist:${email}`;
  const existing = await env.WAITLIST.get(key, 'json');
  const rooms = new Set(existing?.rooms ?? []);
  rooms.add(room);
  await env.WAITLIST.put(
    key,
    JSON.stringify({
      email,
      rooms: [...rooms],
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      country: request.cf?.country ?? null,
    }),
  );
  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
