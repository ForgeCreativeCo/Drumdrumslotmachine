import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/**
 * Emit sw.js from pwa/sw.js with every built file in its precache list. The
 * version is a hash of every file's contents and the worker source, so any
 * change to the build, even to a file whose name doesn't change (index.html,
 * the manifest, an icon), installs a fresh cache.
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
      const hash = createHash('sha256').update(template);
      for (const name of files) {
        const out = bundle[name];
        if (out) hash.update(name).update(out.type === 'chunk' ? out.code : out.source);
        else if (name !== './') hash.update(name).update(readFileSync(`public/${name}`));
      }
      const version = hash.digest('hex').slice(0, 12);
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
