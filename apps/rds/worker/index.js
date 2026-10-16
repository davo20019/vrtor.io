// vrtor-rds: the Roadster test subject's static build. Not public on its own: the vrtor
// Worker forwards vrtor.io/rds/* here through a service binding.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const res = await env.ASSETS.fetch(request);
    if (!res.ok) return res;
    // Vite puts a content hash in these file names: cache them for a year.
    if (url.pathname.startsWith('/rds/assets/')) return withCache(res, 'public, max-age=31536000, immutable');
    // The car is rebuilt often while it is being tested: an hour.
    if (url.pathname.startsWith('/rds/models/')) return withCache(res, 'public, max-age=3600');
    return res;
  },
};

function withCache(res, value) {
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', value);
  return out;
}
