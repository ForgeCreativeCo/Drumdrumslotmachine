// Turn the Vite build into an artifact folder: one page (CSS inlined) plus
// its script chunks under assets/. Pixi's renderer chunks load lazily, so the
// scripts stay as separate files rather than being inlined.
// Usage: npm run artifact -- <out-dir>
//
// Chunk names change whenever the bundle graph changes, so the script keeps a
// manifest of the previous build and prints a complete publish map: every
// current file, plus null for each old file that should be removed.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

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

const manifestPath = join(outDir, 'manifest.json');
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
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
const current = scripts.map((f) => `assets/${f}`);
writeFileSync(manifestPath, JSON.stringify(current));
const files = Object.fromEntries([
  ...current.map((f) => [f, resolve(outDir, f)]),
  ...previous.filter((f) => !current.includes(f)).map((f) => [f, null]),
]);
console.log(JSON.stringify({ page: resolve(outDir, 'taiko-thunder.html'), entry, files }));
