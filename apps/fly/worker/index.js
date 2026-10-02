// vrtor-fly: the Wright Flyer subject's static build. Not public on its own: the vrtor
// Worker forwards vrtor.io/fly/* here through a service binding.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const res = await env.ASSETS.fetch(request);
    if (!res.ok) return res;
    // Vite puts a content hash in these file names: cache them for a year.
    if (url.pathname.startsWith('/fly/assets/')) return withCache(res, 'public, max-age=31536000, immutable');
    // The Flyer, the sand and the Draco decoder are large and rarely change: a day.
    if (/^\/fly\/(models|textures|draco)\//.test(url.pathname)) return withCache(res, 'public, max-age=86400');
    return res;
  },
};

function withCache(res, value) {
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', value);
  return out;
}
