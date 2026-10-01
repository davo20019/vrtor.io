// vrtor-spc: the Space subject's static build. Not public on its own: the vrtor
// Worker forwards vrtor.io/spc/* here through a service binding.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const res = await env.ASSETS.fetch(request);
    if (!url.pathname.startsWith('/spc/assets/') || !res.ok) return res;
    // Vite puts a content hash in these file names: cache them for a year.
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return out;
  },
};
