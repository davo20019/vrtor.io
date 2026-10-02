// vrtor-geo: the Earth experiment's static build. Not public on its own: the vrtor
// Worker forwards vrtor.io/geo/* here through a service binding.
//
// Open 3D data we host ourselves (e.g. the City of Helsinki's photo mesh, CC BY 4.0) lives
// in the vrtor-geo-data R2 bucket and is read straight from https://data.vrtor.io/<key>
// (the bucket's custom domain), so tile requests never run a Worker.
// Uploading: PUT /geo/data/<key> with "Authorization: Bearer <UPLOAD_TOKEN>"
// (scripts/upload-geo-data.mjs). With no UPLOAD_TOKEN secret set, the normal state, it's refused.

const TYPES = {
  json: 'application/json',
  b3dm: 'application/octet-stream',
  glb: 'model/gltf-binary',
  jpg: 'image/jpeg',
  png: 'image/png',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/geo/data/')) return upload(request, env, url);
    const res = await env.ASSETS.fetch(request);
    if (!res.ok) return res;
    // Vite puts a content hash in these file names: cache them for a year.
    if (url.pathname.startsWith('/geo/assets/')) return withCache(res, 'public, max-age=31536000, immutable');
    return res;
  },
};

async function upload(request, env, url) {
  if (request.method !== 'PUT') return new Response('Not found', { status: 404 });
  if (!env.UPLOAD_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.UPLOAD_TOKEN}`) {
    return new Response('Forbidden', { status: 403 });
  }
  const key = decodeURIComponent(url.pathname.slice('/geo/data/'.length));
  if (!key || key.includes('..')) return new Response('Bad key', { status: 400 });
  const type = TYPES[key.split('.').pop().toLowerCase()] || 'application/octet-stream';
  // Tiles never change once uploaded.
  await env.DATA.put(key, request.body, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=604800' } });
  return new Response('ok');
}

function withCache(res, value) {
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', value);
  return out;
}
