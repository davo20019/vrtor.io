// Vite preview plugin: receives reports from a headset testing through dev.vrtor.io
// (xr-shell headsetLog.js) and appends them to output/headset/<code>.log (git-ignored),
// so fps, state and errors can be read on this machine without taking the headset off.
//   tail -f output/headset/jump.log
import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function headsetLog(code) {
  const dir = fileURLToPath(new URL('../output/headset/', import.meta.url));
  const file = `${dir}${code}.log`;
  return {
    name: 'vrtor-headset-log',
    configurePreviewServer(server) {
      mkdirSync(dir, { recursive: true });
      server.middlewares.use(`/${code}/__log`, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 64 * 1024) req.destroy();
        });
        req.on('end', () => {
          try {
            for (const entry of JSON.parse(body)) appendFileSync(file, `${JSON.stringify(entry)}\n`);
            res.statusCode = 204;
          } catch {
            res.statusCode = 400;
          }
          res.end();
        });
      });
    },
  };
}
