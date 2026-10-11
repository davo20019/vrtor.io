// Rebuild the bundled synthetic examples on macOS (say + ffmpeg).
// Core lessons use Samantha (American); British centering-diphthong guides use Daniel.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GUIDES, LESSONS } from '../apps/snd/src/lessons.js';

const directory = new URL('../apps/snd/src/audio/', import.meta.url);
await mkdir(directory, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'vrtor-sound-audio-'));
const phrases = new Map();
const add = (text, accent = 'American English') => phrases.set(`${accent}:${text}`, { text, accent });
for (const g of GUIDES) add(g.example, g.accent);
for (const l of LESSONS) {
  for (const pair of l.pairs) for (const word of pair) add(word);
  for (const sentence of l.sentences) add(sentence);
}
const tasks = [...phrases.entries()];
const manifest = {};
let next = 0;
const run = (cmd, args) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let error = '';
  child.stderr.on('data', (chunk) => { error += chunk; });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${cmd}: ${error}`)));
});
try {
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < tasks.length) {
      const [key, { text, accent }] = tasks[next++];
      const filename = `${accent.startsWith('British') ? 'gb' : 'us'}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`;
      const aiff = join(temp, `${filename}.aiff`);
      await run('say', ['-v', accent.startsWith('British') ? 'Daniel' : 'Samantha', '-r', '145', '-o', aiff, text]);
      await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiff, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB', '-ar', '24000', '-ac', '1', '-b:a', '64k', new URL(`${filename}.mp3`, directory).pathname]);
      manifest[key] = `./audio/${filename}.mp3`;
    }
  }));
  await writeFile(new URL('../apps/snd/src/audio-manifest.json', import.meta.url), `${JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2)}\n`);
  console.log(`Built ${tasks.length} audio examples.`);
} finally { await rm(temp, { recursive: true, force: true }); }
