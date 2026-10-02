// vrtor.io edge worker. It runs first for every request:
//   - www.vrtor.io and http:// -> https://vrtor.io (one canonical address)
//   - the *.workers.dev preview is kept out of search results
//   - subjects built in this repo (vrtor.io/spc/*): forwarded to their own Worker
//   - short subject links (vrtor.io/com) that are easy to type in a headset browser
//   - the waitlist API (KV, plus the Brevo list when BREVO_API_KEY is set)
//   - live presence for the subjects (vrtor.io/api/presence/<code>, a WebSocket; see presence.js)
//   - everything else: the static site in /public (Workers Static Assets)

import { SUBJECTS } from './subjects.js';
import { connectPresence } from './presence.js';
import { welcomeEmail } from './welcome-email.js';

export { PresenceRoom } from './presence.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const canonicalHost = url.hostname === 'www.vrtor.io' || url.hostname === 'vrtor.io';
    // env.DEV comes from .dev.vars, so `wrangler dev` (which poses as http://vrtor.io) isn't bounced to production.
    if (canonicalHost && !env.DEV && (url.hostname !== 'vrtor.io' || url.protocol === 'http:')) {
      url.hostname = 'vrtor.io';
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    // A WebSocket upgrade (status 101) can't be copied into a new Response, so it skips withHeaders.
    const presence = url.pathname.match(/^\/api\/presence\/([a-z]{3})$/);
    if (presence && SUBJECTS[presence[1]]?.service) return connectPresence(request, env, presence[1]);
    return withHeaders(await route(request, env, url), url);
  },
};

async function route(request, env, url) {
  const slug = url.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();

  if (slug === 'api/waitlist') return handleWaitlist(request, env);

  // Subjects with their own Worker live under vrtor.io/<code>/; other names for them redirect there.
  const top = slug.split('/')[0];
  const app = SUBJECTS[top];
  if (app?.service && env[app.service]) {
    if (top === app.code) return env[app.service].fetch(request);
    if (top === slug) return Response.redirect(new URL(`/${app.code}/${url.search}`, url).toString(), 302);
  }

  const subject = SUBJECTS[slug];
  if (subject && !subject.url) {
    // Coming soon: show it in the catalog, noting which link was typed (for analytics).
    return Response.redirect(new URL(`/?from=${encodeURIComponent(slug)}#subjects`, url).toString(), 302);
  }
  if (subject?.url) {
    const target = new URL(subject.url);
    // Carry through any query (e.g. ?xrdebug) and tag the visit as coming from vrtor,
    // with UTM tags so the other site's analytics credits the short link instead of "direct".
    url.searchParams.forEach((v, k) => target.searchParams.set(k, v));
    if (!target.searchParams.has('ref')) target.searchParams.set('ref', 'vrtor');
    if (!target.searchParams.has('utm_source')) {
      target.searchParams.set('utm_source', 'vrtor.io');
      target.searchParams.set('utm_medium', 'shortlink');
      target.searchParams.set('utm_campaign', slug);
    }
    return Response.redirect(target.toString(), 302);
  }

  const asset = await env.ASSETS.fetch(request);
  if (asset.status !== 404) return asset;
  const page = await env.ASSETS.fetch(new Request(new URL('/404', url), request));
  return new Response(page.body, { status: 404, headers: page.headers });
}

function withHeaders(res, url) {
  const out = new Response(res.body, res);
  const h = out.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  if (url.hostname === 'vrtor.io') h.set('Strict-Transport-Security', 'max-age=31536000');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self), xr-spatial-tracking=(self)');
  if (url.hostname.endsWith('.workers.dev')) h.set('X-Robots-Tag', 'noindex'); // the preview; vrtor.io is canonical
  return out;
}

async function handleWaitlist(request, env) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Send JSON with an email field.' }, 400);
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const subject = String(body.subject ?? body.room ?? 'any').slice(0, 40);
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'Enter a valid email address.' }, 400);
  }

  const key = `waitlist:${email}`;
  const existing = await env.WAITLIST.get(key, 'json');
  const subjects = new Set(existing?.subjects ?? existing?.rooms ?? []);
  subjects.add(subject);
  await env.WAITLIST.put(
    key,
    JSON.stringify({
      email,
      subjects: [...subjects],
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      country: request.cf?.country ?? null,
    }),
  );
  // KV already holds the signup, so a Brevo outage is logged rather than shown to the visitor.
  await addToBrevo(env, email, [...subjects]).catch((err) => console.error('brevo', err.message));
  // Welcome only on the first signup, not when someone adds another subject.
  if (!existing) await sendWelcome(env, email, subject).catch((err) => console.error('brevo welcome', err.message));
  return json({ ok: true });
}

// Adds (or updates) the contact on the vrtor waitlist list in Brevo, with the subjects asked about.
async function addToBrevo(env, email, subjects) {
  if (!env.BREVO_API_KEY) return;
  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      email,
      listIds: [Number(env.BREVO_LIST_ID)],
      attributes: { VRTOR_SUBJECTS: subjects.join(', ') },
      updateEnabled: true,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

async function sendWelcome(env, email, subject) {
  if (!env.BREVO_API_KEY || !env.WELCOME_FROM) return;
  const { subject: title, html, text } = welcomeEmail(subject);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'vrtor', email: env.WELCOME_FROM },
      to: [{ email }],
      subject: title,
      htmlContent: html,
      textContent: text,
      tags: ['vrtor-welcome'],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
