// Static Machu Picchu build, served through the VRtor home Worker's MPC binding.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const res = await env.ASSETS.fetch(request);
    if (!res.ok || !url.pathname.startsWith("/mpc/assets/")) return res;
    const out = new Response(res.body, res);
    out.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return out;
  },
};
