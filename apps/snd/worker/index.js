// Sound Lab is served at /snd/ through VRtor's SND service binding.
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const path = new URL(request.url).pathname;
    if (!response.ok || !path.startsWith('/snd/assets/')) return response;
    const out = new Response(response.body, response);
    out.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return out;
  },
};
