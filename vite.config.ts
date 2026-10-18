import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/**
 * Emit sw.js from pwa/sw.js with every built file in its precache list. The
 * version is a hash of that list and the worker source, so any change to the
 * build installs a fresh cache.
 */
function serviceWorker(): Plugin {
  return {
    name: 'taiko-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const icons = readdirSync('public/icons').map((f) => `icons/${f}`);
      const files = [...new Set(['./', 'index.html', 'manifest.webmanifest', ...icons, ...Object.keys(bundle)])].sort();
      const template = readFileSync('pwa/sw.js', 'utf8');
      const version = createHash('sha256').update(files.join('\n')).update(template).digest('hex').slice(0, 12);
      const source = template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // Inline any art so the build stays a page plus scripts.
    assetsInlineLimit: 8 * 1024 * 1024,
  },
  plugins: [serviceWorker()],
});
