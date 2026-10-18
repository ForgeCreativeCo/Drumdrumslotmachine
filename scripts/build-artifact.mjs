// Turn the Vite build into an artifact folder: one page (CSS inlined) plus
// its script chunks under assets/. Pixi's renderer chunks load lazily, so the
// scripts stay as separate files rather than being inlined.
// Usage: npm run artifact -- <out-dir>
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'dist-artifact';
const built = readFileSync('dist/index.html', 'utf8');
const entry = built.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"/)[1];
const cssFile = built.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"/)[1];
const css = readFileSync(join('dist', cssFile), 'utf8');
const source = readFileSync('index.html', 'utf8');

const body = source
  .slice(source.indexOf('<body>') + 6, source.indexOf('</body>'))
  .replace(/\s*<script type="module" src="\/src\/main.ts"><\/script>/, '');
const fonts = source.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]+>/)[0];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, 'assets'), { recursive: true });
const scripts = readdirSync('dist/assets').filter((f) => f.endsWith('.js'));
for (const f of scripts) copyFileSync(join('dist/assets', f), join(outDir, 'assets', f));

const page = `<title>Taiko Thunder</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>
${css}
</style>
${body.trim()}
<script type="module" src="${entry}"></script>
`;
writeFileSync(join(outDir, 'taiko-thunder.html'), page);
console.log(JSON.stringify({ page: join(outDir, 'taiko-thunder.html'), entry, files: scripts.map((f) => `assets/${f}`) }));
