// Static Taj Mahal build, served through the vrtor home Worker's TAJ binding.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const res = await env.ASSETS.fetch(request);
    if (!res.ok || !url.pathname.startsWith("/taj/assets/")) return res;
    const out = new Response(res.body, res);
    out.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return out;
  },
};
