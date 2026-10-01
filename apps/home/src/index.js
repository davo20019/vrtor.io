// vrtor.io edge worker. It runs first for every request:
//   - www.vrtor.io and http:// -> https://vrtor.io (one canonical address)
//   - the *.workers.dev preview is kept out of search results
//   - subjects built in this repo (vrtor.io/spc/*): forwarded to their own Worker
//   - short subject links (vrtor.io/com) that are easy to type in a headset browser
//   - the waitlist API
//   - everything else: the static site in /public (Workers Static Assets)

import { SUBJECTS } from './subjects.js';

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
    // Coming soon: show it in the catalog.
    return Response.redirect(new URL(`/#subjects`, url).toString(), 302);
  }
  if (subject?.url) {
    const target = new URL(subject.url);
    // Carry through any query (e.g. ?xrdebug) and tag the visit as coming from vrtor.
    url.searchParams.forEach((v, k) => target.searchParams.set(k, v));
    if (!target.searchParams.has('ref')) target.searchParams.set('ref', 'vrtor');
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
  h.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), xr-spatial-tracking=(self)');
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
  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
