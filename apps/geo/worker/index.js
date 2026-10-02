// vrtor-geo: the Earth spike's static build. Not public on its own: the vrtor
// Worker forwards vrtor.io/geo/* here through a service binding.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // The Map Tiles key goes to the browser anyway (Google checks the referrer), but
    // keeping it a secret keeps it out of the repo.
    if (url.pathname === '/geo/config.json') {
      return Response.json(
        { tilesKey: env.GOOGLE_TILES_KEY || null },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const res = await env.ASSETS.fetch(request);
    if (!res.ok) return res;
    // Vite puts a content hash in these file names: cache them for a year.
    if (url.pathname.startsWith('/geo/assets/')) return withCache(res, 'public, max-age=31536000, immutable');
    if (url.pathname.startsWith('/geo/draco/')) return withCache(res, 'public, max-age=86400');
    return res;
  },
};

function withCache(res, value) {
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', value);
  return out;
}
