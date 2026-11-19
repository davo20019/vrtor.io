import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { GUIDES, GUIDE_BY_ID, LESSONS, guideUrl, makeRound, initialSelection } from '../src/lessons.js';
import { readProgress, saveProgress, completeRound, addRecording, reviewLesson, PROGRESS_KEY } from '../src/progress.js';
import worker from '../worker/index.js';
import { SUBJECTS } from '../../home/src/subjects.js';

test('each randomized lesson tests both sounds in all three contrasts', () => {
  for (const lesson of LESSONS) {
    for (const random of [() => 0, () => 0.5, () => 0.999]) {
      const round = makeRound(lesson, random);
      assert.equal(round.length, 6);
      assert.equal(round.filter((q) => q.answer === 0).length, 3);
      assert.equal(round.filter((q) => q.answer === 1).length, 3);
      assert.equal(new Set(round.map((q) => `${q.pairIndex}:${q.answer}`)).size, 6);
      for (const q of round) assert.equal(q.word, lesson.pairs[q.pairIndex][q.answer]);
    }
    for (const id of lesson.sounds) assert.ok(GUIDE_BY_ID[id]);
  }
});

test('library has 44 unique LES guides with valid links and labeled regional entries', () => {
  assert.equal(GUIDES.length, 44);
  assert.equal(new Set(GUIDES.map((g) => g.id)).size, 44);
  for (const g of GUIDES) {
    assert.ok(g.ipa && g.mouth && g.example);
    assert.equal(new URL(guideUrl(g.id)).pathname, `/en/sounds/${g.id}`);
  }
  for (const id of ['near', 'square', 'cure']) assert.equal(GUIDE_BY_ID[id].accent, 'British English');
  assert.equal(new URL(guideUrl('unknown')).hostname, 'www.learnenglishsounds.com');
});

// The clips themselves are not in the public repository (macOS voice licence; see ASSETS.md), so
// they are checked only where they have been built (node scripts/build-sound-audio.mjs).
const haveAudio = existsSync(new URL('../src/audio/', import.meta.url));

test('every exercise and guide has an audio clip in the manifest, playable where the clips are built', () => {
  const manifest = JSON.parse(readFileSync(new URL('../src/audio-manifest.json', import.meta.url)));
  const check = (text, accent = 'American English') => {
    const path = manifest[`${accent}:${text}`];
    assert.ok(path, text);
    if (!haveAudio) return;
    assert.ok(existsSync(new URL(`../src/${path}`, import.meta.url)), text);
    assert.ok(readFileSync(new URL(`../src/${path}`, import.meta.url)).length > 1000, text);
  };
  for (const g of GUIDES) check(g.example, g.accent);
  for (const l of LESSONS) {
    for (const pair of l.pairs) for (const word of pair) check(word);
    for (const sentence of l.sentences) check(sentence);
  }
});

test('incoming sound and lesson links select only known curriculum items', () => {
  assert.deepEqual(initialSelection('?sound=short-i'), { sound: 'short-i', lesson: null });
  assert.deepEqual(initialSelection('?lesson=cat-cut&sound=short-i'), { sound: null, lesson: 'cat-cut' });
  assert.deepEqual(initialSelection('?sound=bad&lesson=bad'), { sound: null, lesson: null });
  for (const alias of ['snd', 'sounds', 'sound-lab', 'english']) assert.equal(SUBJECTS[alias].service, 'SND');
});

test('listening scores and recording counts are independent and survive reload', () => {
  let progress = addRecording({}, 'ship-sheep');
  progress = completeRound(progress, 'ship-sheep', 5);
  progress = completeRound(progress, 'ship-sheep', 2);
  assert.deepEqual(progress['ship-sheep'], { sessions: 2, best: 5, latest: 2, recordings: 1 });
  let saved;
  const storage = { setItem(key, value) { assert.equal(key, PROGRESS_KEY); saved = value; }, getItem() { return saved; } };
  assert.equal(saveProgress(storage, progress), true);
  assert.deepEqual(readProgress(storage), progress);
  const allPracticed = Object.fromEntries(LESSONS.map((l) => [l.id, { sessions: 1, latest: 6 }]));
  allPracticed['cat-cut'].latest = 2;
  assert.equal(reviewLesson(allPracticed, LESSONS).id, 'cat-cut');
  assert.equal(reviewLesson(progress, LESSONS).id, 'cat-cut');
});

test('corrupt, unavailable and unexpected browser storage cannot break a lesson', () => {
  assert.deepEqual(readProgress({ getItem() { throw new Error('blocked'); } }), {});
  assert.deepEqual(readProgress({ getItem() { return '{'; } }), {});
  assert.deepEqual(readProgress({ getItem() { return '[]'; } }), {});
  assert.deepEqual(readProgress({ getItem() { return '{"ship-sheep":{"best":999,"sessions":-1,"recordings":"bad"}}'; } }), {
    'ship-sheep': { sessions: 0, best: 6, latest: 0, recordings: 0 },
  });
  assert.equal(saveProgress({ setItem() { throw new Error('full'); } }, {}), false);
});

test('only hashed built assets receive immutable cache headers', async () => {
  const env = { ASSETS: { async fetch() { return new Response('asset', { headers: { 'content-type': 'text/plain' } }); } } };
  const asset = await worker.fetch(new Request('https://vrtor.io/snd/assets/example.mp3'), env);
  assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const page = await worker.fetch(new Request('https://vrtor.io/snd/'), env);
  assert.equal(page.headers.get('cache-control'), null);
  const missing = await worker.fetch(new Request('https://vrtor.io/snd/assets/missing.js'), { ASSETS: { async fetch() { return new Response('missing', { status: 404 }); } } });
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('cache-control'), null);
});
