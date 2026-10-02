// Upload a folder of 3D data (e.g. a 3D Tiles tileset) to the vrtor-geo-data R2 bucket
// through vrtor.io/geo/data/ (see apps/geo/worker/index.js).
//
//   UPLOAD_TOKEN=... node scripts/upload-geo-data.mjs <folder> <key prefix>
//
// The token must match the vrtor-geo Worker's UPLOAD_TOKEN secret; delete that secret
// afterwards (npx wrangler secret delete UPLOAD_TOKEN -c apps/geo/wrangler.jsonc).
// Resumable: uploaded keys are logged to <folder>/.uploaded and skipped on the next run.
// (No per-file existence check: each request is a Worker invocation, and the free plan
// allows 100,000 a day.)
import { readdir, stat, readFile, appendFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const [folder, prefix] = process.argv.slice(2);
const token = process.env.UPLOAD_TOKEN;
const base = process.env.GEO_DATA_URL || 'https://vrtor.io/geo/data/';
if (!folder || !prefix || !token) {
  console.error('usage: UPLOAD_TOKEN=... node scripts/upload-geo-data.mjs <folder> <key prefix>');
  process.exit(1);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile()) yield p;
  }
}

const logFile = join(folder, '.uploaded');
const already = new Set(existsSync(logFile) ? readFileSync(logFile, 'utf8').split('\n') : []);
const keyOf = (file) => `${prefix}/${relative(folder, file).split(sep).join('/')}`;
const files = [];
for await (const f of walk(folder)) if (f !== logFile && !already.has(keyOf(f))) files.push(f);
console.log(`${files.length} files to upload (${already.size ? already.size - 1 : 0} done before)`);

let done = 0, bytes = 0;
const started = Date.now();
async function upload(file) {
  const key = keyOf(file);
  const url = base + key.split('/').map(encodeURIComponent).join('/');
  const size = (await stat(file)).size;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: await readFile(file),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      bytes += size;
      await appendFile(logFile, key + '\n');
      return;
    } catch (err) {
      if (attempt >= 5) throw new Error(`${key}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

let next = 0;
async function lane() {
  while (next < files.length) {
    const f = files[next++];
    await upload(f);
    done++;
    if (done % 200 === 0 || done === files.length) {
      const mb = bytes / 1e6;
      const s = (Date.now() - started) / 1000;
      console.log(`${done}/${files.length} · ${mb.toFixed(0)} MB · ${(mb / s).toFixed(1)} MB/s`);
    }
  }
}
await Promise.all(Array.from({ length: Number(process.env.CONCURRENCY || 48) }, lane));
console.log('done');
