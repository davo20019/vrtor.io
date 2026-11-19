// Runs an npm script in every subject app, one after another, then in home where it has one:
//   node scripts/each.js build          (npm run build)
//   node scripts/each.js deploy         (subjects first: home's service bindings need them)
//   node scripts/each.js build mpc taj  (only those subjects)
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { HOME, SUBJECTS } from './apps.js';

const [task, ...only] = process.argv.slice(2);
if (!task) {
  console.error('usage: node scripts/each.js <npm script> [code ...]');
  process.exit(2);
}
const unknown = only.filter((code) => !SUBJECTS.some((s) => s.code === code));
if (unknown.length) {
  console.error(`unknown subject: ${unknown.join(', ')} (see scripts/apps.js)`);
  process.exit(2);
}

const apps = only.length ? SUBJECTS.filter((s) => only.includes(s.code)) : [...SUBJECTS, HOME];
for (const { code } of apps) {
  const pkg = JSON.parse(readFileSync(new URL(`../apps/${code}/package.json`, import.meta.url)));
  if (!pkg.scripts?.[task]) continue;
  console.log(`\n▸ ${task} ${code}`);
  const run = spawnSync('npm', ['run', task, '-w', `@vrtor/${code}`], { stdio: 'inherit' });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
