// Refresh the committed LES guide snapshot: node scripts/import-sound-guides.mjs /path/to/learnenglishsounds
// Reads data only; never changes the LES checkout. esbuild strips TypeScript annotations.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { transformSync } from 'esbuild';

const source = process.argv[2];
if (!source) throw new Error('Pass the Learn English Sounds checkout path.');
const directory = resolve(source, 'app/data/sounds');
const index = await readFile(resolve(directory, 'index.ts'), 'utf8');
const files = [...index.matchAll(/import \w+ from '\.\/(.*?)'/g)].map((m) => m[1]);
const en = (value) => typeof value === 'string' ? value : value?.en ?? '';
const guides = [];
for (const file of files) {
  if (file.startsWith('ed-ending-')) continue;
  const input = await readFile(resolve(directory, `${file}.ts`), 'utf8');
  const { code } = transformSync(input, { loader: 'ts', format: 'esm' });
  const { default: sound } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  guides.push({
    // Use the stable route key (e.g. sh), not a display-symbol ID (e.g. ʃ).
    id: file,
    ipa: sound.ipaSymbol || sound.symbol,
    name: en(sound.name),
    category: sound.category,
    example: en(sound.exampleWord),
    mouth: en(sound.mouthPosition),
    description: en(sound.description),
    words: sound.commonWords.slice(0, 5).map((word) => en(word.word)),
    // These guides describe British centering diphthongs; the core lessons use American English.
    accent: ['near', 'square', 'cure'].includes(sound.id) ? 'British English' : 'American English',
  });
}
await writeFile(new URL('../apps/snd/src/guides.json', import.meta.url), `${JSON.stringify(guides, null, 2)}\n`);
console.log(`Imported ${guides.length} sound guides.`);
