import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
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

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const APP_VERSION = `${pkg.version}+${new Date().toISOString().slice(0, 10)}`;

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  // Relative base so the built app works on GitHub Pages subpaths.
  base: './',
  // Pages serves /docs as the site root, which keeps the public URL clean.
  build: {
    outDir: 'docs',
    rollupOptions: {
      // A page per entry rather than routes inside the app. The minigames are
      // meant to be FOUND — "f1 reaction time test" is a real search — and that
      // needs a crawlable URL with its own title, which a hash route does not
      // give. It also keeps the career bundle off a page that does not need it.
      input: {
        main: resolve(__dirname, 'index.html'),
        lightsOut: resolve(__dirname, 'minigames/lights-out/index.html'),
        trackRecall: resolve(__dirname, 'minigames/track-recall/index.html')
        // brake-point is PAUSED, not abandoned. The car does not visibly turn
        // into the corner, so the corner reads as an abstraction rather than
        // somewhere you are going, and no amount of retuning the numbers fixes
        // that. Its source is untouched under minigames/brake-point/ and
        // src/minigames/BrakePoint/; adding the entry back here is the only
        // step needed to put it live again.
      }
    }
  },
  plugins: [react(), writeAsset()],
  server: { port: 5174, host: true }
});
