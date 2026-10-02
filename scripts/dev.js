// Local dev for the whole site at http://localhost:8790 (`npm run dev -- --port 9000` to change).
// Rebuilds the subject apps on change and runs each Worker in its own wrangler
// process; wrangler's dev registry connects the service bindings (vrtor.io/spc)
// like in production. (One process with several -c configs returns 500 for a
// bound Worker's static assets in wrangler 4.145.)
import { spawn, spawnSync } from 'node:child_process';

const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit' });

const first = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
if (first.status !== 0) process.exit(first.status ?? 1);

const homeArgs = process.argv.slice(2);
if (!homeArgs.includes('--port')) homeArgs.push('--port', '8790');

const children = [
  run('npm', ['run', 'watch', '-w', '@vrtor/spc']),
  run('npm', ['run', 'watch', '-w', '@vrtor/taj']),
  run('npm', ['run', 'watch', '-w', '@vrtor/mpc']),
  run('npm', ['run', 'watch', '-w', '@vrtor/apo']),
  run('npm', ['run', 'watch', '-w', '@vrtor/fly']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/fly/wrangler.jsonc', '--port', '8795', '--inspector-port', '9245']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/apo/wrangler.jsonc', '--port', '8794', '--inspector-port', '9244']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/mpc/wrangler.jsonc', '--port', '8793', '--inspector-port', '9243']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/taj/wrangler.jsonc', '--port', '8792', '--inspector-port', '9242']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/spc/wrangler.jsonc', '--port', '8791', '--inspector-port', '9241']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/home/wrangler.jsonc', '--inspector-port', '9240', ...homeArgs]),
];
const stop = () => children.forEach((c) => c.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((c) => c.on('exit', (code) => { stop(); process.exitCode = code ?? 0; }));
