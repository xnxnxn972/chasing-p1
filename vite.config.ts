import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev-only helper: POST a dataURL to /__write?name=foo.png and it lands in
 * public/. Used to rasterise public/favicon.svg into the apple-touch-icon
 * without pulling an image toolchain into the project.
 */
function writeAsset(): Plugin {
  return {
    name: 'write-asset',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__write', (req, res) => {
        const name = new URL(req.url ?? '', 'http://x').searchParams.get('name');
        if (!name || !/^[\w.-]+$/.test(name)) {
          res.statusCode = 400;
          res.end('bad name');
          return;
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const b64 = body.replace(/^data:[^,]+,/, '');
          writeFileSync(join(server.config.root, 'public', name), Buffer.from(b64, 'base64'));
          res.end('ok');
        });
      });
    }
  };
}

export default defineConfig({
  // Relative base so the built app works on GitHub Pages subpaths.
  base: './',
  plugins: [react(), writeAsset()],
  server: { port: 5174, host: true }
});
