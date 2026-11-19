// Local dev for the whole site at http://localhost:8790:
//   npm run dev                  every subject (heavy: one Vite watcher and one wrangler per app)
//   npm run dev -- mpc taj       only those subjects; the others' links fail locally
//   npm run dev -- --port 9000   home on another port (any other flags go to home's wrangler)
// Rebuilds the subject apps on change and runs each Worker in its own wrangler process;
// wrangler's dev registry connects the service bindings (vrtor.io/spc) like in production.
// (One process with several -c configs returns 500 for a bound Worker's static assets in
// wrangler 4.145.)
import { spawn, spawnSync } from 'node:child_process';
import { HOME, SUBJECTS, inspectorPort } from './apps.js';

const args = process.argv.slice(2);
const only = args.filter((a) => SUBJECTS.some((s) => s.code === a));
const homeArgs = args.filter((a) => !only.includes(a));
if (!homeArgs.includes('--port')) homeArgs.push('--port', String(HOME.port));
const subjects = only.length ? SUBJECTS.filter((s) => only.includes(s.code)) : SUBJECTS;

const first = spawnSync('node', ['scripts/each.js', 'build', ...subjects.map((s) => s.code)], { stdio: 'inherit' });
if (first.status !== 0) process.exit(first.status ?? 1);

const run = (cmd, cmdArgs) => spawn(cmd, cmdArgs, { stdio: 'inherit' });
const wrangler = (app, extra = []) =>
  run('npx', ['wrangler', 'dev', '-c', `apps/${app.code}/wrangler.jsonc`, '--inspector-port', String(inspectorPort(app)), ...extra]);

const children = [
  ...subjects.flatMap((app) => [
    run('npm', ['run', 'watch', '-w', `@vrtor/${app.code}`]),
    wrangler(app, ['--port', String(app.port)]),
  ]),
  // DEV stops home's canonical-host redirect: wrangler dev presents requests as http://vrtor.io.
  wrangler(HOME, ['--var', 'DEV:1', ...homeArgs]),
];
const stop = () => children.forEach((c) => c.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((c) => c.on('exit', (code) => { stop(); process.exitCode = code ?? 0; }));
