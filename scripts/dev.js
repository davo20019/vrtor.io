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
  run('npm', ['run', 'watch', '-w', '@vrtor/snd']),
  run('npm', ['run', 'watch', '-w', '@vrtor/spc']),
  run('npm', ['run', 'watch', '-w', '@vrtor/taj']),
  run('npm', ['run', 'watch', '-w', '@vrtor/mpc']),
  run('npm', ['run', 'watch', '-w', '@vrtor/apo']),
  run('npm', ['run', 'watch', '-w', '@vrtor/fly']),
  run('npm', ['run', 'watch', '-w', '@vrtor/orca']),
  run('npm', ['run', 'watch', '-w', '@vrtor/geo']),
  run('npm', ['run', 'watch', '-w', '@vrtor/jump']),
  run('npm', ['run', 'watch', '-w', '@vrtor/cyb']),
  run('npm', ['run', 'watch', '-w', '@vrtor/rds']),
  run('npm', ['run', 'watch', '-w', '@vrtor/bdy']),
  run('npm', ['run', 'watch', '-w', '@vrtor/aif']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/aif/wrangler.jsonc', '--port', '8803', '--inspector-port', '9253']),
  run('npm', ['run', 'watch', '-w', '@vrtor/cel']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/cel/wrangler.jsonc', '--port', '8804', '--inspector-port', '9254']),
  run('npm', ['run', 'watch', '-w', '@vrtor/hrt']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/hrt/wrangler.jsonc', '--port', '8805', '--inspector-port', '9255']),
  run('npm', ['run', 'watch', '-w', '@vrtor/mona']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/mona/wrangler.jsonc', '--port', '8806', '--inspector-port', '9256']),
  run('npm', ['run', 'watch', '-w', '@vrtor/sacre']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/sacre/wrangler.jsonc', '--port', '8807', '--inspector-port', '9257']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/bdy/wrangler.jsonc', '--port', '8802', '--inspector-port', '9252']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/rds/wrangler.jsonc', '--port', '8801', '--inspector-port', '9251']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/snd/wrangler.jsonc', '--port', '8800', '--inspector-port', '9250']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/cyb/wrangler.jsonc', '--port', '8799', '--inspector-port', '9249']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/jump/wrangler.jsonc', '--port', '8798', '--inspector-port', '9248']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/geo/wrangler.jsonc', '--port', '8797', '--inspector-port', '9247']),
  run('npx', ['wrangler', 'dev', '-c', 'apps/orca/wrangler.jsonc', '--port', '8796', '--inspector-port', '9246']),
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
