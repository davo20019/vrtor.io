// Test in a headset without deploying, through the Cloudflare tunnel "vrtor-dev" (WebXR needs HTTPS).
// Reload the headset page after a save. Pages report fps, state, pointer presses and errors back here
// (xr-shell headsetLog.js): read them with `tail -f output/headset/<code>.log`.
//
//   node scripts/headset.js          the whole site, every subject: https://dev.vrtor.io/<code>/
//                                    (scripts/dev.js: the home Worker and each subject's Worker,
//                                    rebuilt on change, service bindings and presence as in production)
//   node scripts/headset.js jump     one subject, from its Vite build: https://dev.vrtor.io/jump/
//
// The tunnel config lives in ~/.cloudflared/vrtor-dev.yml (dev.vrtor.io -> localhost:4179).
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { request as httpRequest, createServer } from 'node:http';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const PORT = 4179;            // what the tunnel points at
const SITE = 8790;            // scripts/dev.js's home Worker
const code = process.argv[2];
const NO_STORE = { 'cache-control': 'no-store' };
const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit' });
const tunnel = () => run('cloudflared', ['tunnel', '--no-autoupdate', '--config', `${homedir()}/.cloudflared/vrtor-dev.yml`, 'run']);

let children;
let server;
if (code) {
  const { preview } = await import('vite');
  const { headsetLog } = await import('./headset-log-plugin.js');
  children = [run('npm', ['run', 'watch', '-w', `@vrtor/${code}`]), tunnel()];
  server = await preview({
    root: `apps/${code}`,
    configFile: `apps/${code}/vite.config.js`,
    plugins: [headsetLog(code)],
    preview: { port: PORT, strictPort: true, allowedHosts: ['dev.vrtor.io', '.trycloudflare.com'], headers: NO_STORE },
  });
  console.log(`\nHeadset: https://dev.vrtor.io/${code}/   (local: http://localhost:${PORT}/${code}/)\n`);
} else {
  children = [run('node', ['scripts/dev.js', '--port', String(SITE)]), tunnel()];
  server = siteProxy();
  console.log(`\nHeadset: https://dev.vrtor.io/<code>/ for every subject   (local: http://localhost:${PORT}/)\n`);
}

/** Forwards everything (WebSockets too) to the local site, and keeps POST /<code>/__log for the log files. */
function siteProxy() {
  const dir = fileURLToPath(new URL('../output/headset/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  const s = createServer((req, res) => {
    const log = req.method === 'POST' && req.url.match(/^\/([a-z0-9-]+)\/__log$/);
    if (log) {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 64 * 1024) req.destroy();
      });
      req.on('end', () => {
        try {
          for (const entry of JSON.parse(body)) appendFileSync(`${dir}${log[1]}.log`, `${JSON.stringify(entry)}\n`);
          res.statusCode = 204;
        } catch {
          res.statusCode = 400;
        }
        res.end();
      });
      return;
    }
    // Dev never serves from a cache (only production does): drop the browser's validators and the Workers'
    // cache headers, so every reload gets the latest build.
    const { 'if-none-match': _, 'if-modified-since': __, ...headers } = req.headers;
    const up = httpRequest({ host: '127.0.0.1', port: SITE, method: req.method, path: req.url, headers }, (r) => {
      const { etag, 'last-modified': ___, 'cache-control': ____, ...out } = r.headers;
      res.writeHead(r.statusCode, { ...out, ...NO_STORE });
      r.pipe(res);
    });
    up.on('error', () => {
      res.statusCode = 502;
      res.end('The local site is still starting (scripts/dev.js). Reload in a moment.');
    });
    req.pipe(up);
  });
  // WebSocket upgrades (presence and voice): pass the raw bytes both ways.
  s.on('upgrade', (req, socket, head) => {
    const up = connect(SITE, '127.0.0.1', () => {
      up.write(`${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
      up.write(head);
      up.pipe(socket);
      socket.pipe(up);
    });
    up.on('error', () => socket.destroy());
    socket.on('error', () => up.destroy());
  });
  s.listen(PORT);
  return s;
}

const stop = () => {
  children.forEach((c) => c.kill());
  server.close();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((c) => c.on('exit', (status) => { stop(); process.exitCode = status ?? 0; }));
