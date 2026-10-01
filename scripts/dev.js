// Local dev for the whole site at http://localhost:8790 (`npm run dev -- --port 9000` to change).
// Rebuilds the subject apps on change and runs each Worker in its own wrangler
// process; wrangler's dev registry connects the service bindings (vrtor.io/spc)
// like in production. (One process with several -c configs returns 500 for a
// bound Worker's static assets in wrangler 4.145.)
import { spawn, spawnSync } from 'node:child_process';

const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit' });

const first = spawnSync('npm', ['run', 'build', '-w', '@vrtor/spc'], { stdio: 'inherit' });
if (first.status !== 0) process.exit(first.status ?? 1);

const homeArgs = process.argv.slice(2);
if (!homeArgs.includes('--port')) homeArgs.push('--port', '8790');

const children = [
  run('npm', ['run', 'watch', '-w', '@vrtor/spc']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/spc/wrangler.jsonc', '--port', '8791', '--inspector-port', '9241']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/home/wrangler.jsonc', '--inspector-port', '9240', ...homeArgs]),
];
const stop = () => children.forEach((c) => c.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((c) => c.on('exit', (code) => { stop(); process.exitCode = code ?? 0; }));
