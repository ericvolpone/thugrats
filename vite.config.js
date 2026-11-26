import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let build = 'dev';
try { build = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* not a git checkout */ }

/** Dev only: the game POSTs each finished run here; it lands in playtests/runs/ (see src/game/runlog.js). */
const runLog = () => ({
  name: 'thugrats-runlog',
  configureServer(server) {
    server.middlewares.use('/__runlog', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try {
          const log = JSON.parse(body);
          const dir = path.resolve('playtests/runs');
          fs.mkdirSync(dir, { recursive: true });
          const stamp = (log.endedAt ?? new Date().toISOString()).replace(/[:T]/g, '-').slice(0, 19);
          const safe = (s) => String(s ?? 'x').replace(/[^a-z0-9_-]/gi, '');
          const file = `${stamp}_${safe(log.hero)}_${safe(log.map)}_${safe(log.outcome)}.json`;
          fs.writeFileSync(path.join(dir, file), JSON.stringify(log, null, 1));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ file: `playtests/runs/${file}` }));
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    });
  },
});

export default defineConfig({
  base: './',
  plugins: [runLog()],
  define: { __BUILD__: JSON.stringify(build) },
  build: { target: 'esnext' },
  esbuild: { target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  server: { host: true, watch: { ignored: ['**/playtests/**'] } },
});
