// Inline the Vite build into one self-contained HTML page for publishing.
// Usage: npm run build && node scripts/build-artifact.mjs <out.html>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const out = process.argv[2] ?? 'dist/taiko-thunder.html';
const assets = readdirSync('dist/assets');
const css = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.css'))}`, 'utf8');
const js = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.js'))}`, 'utf8');
const html = readFileSync('index.html', 'utf8');

const body = html
  .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/\s*<script type="module" src="\/src\/main.ts"><\/script>/, '');
const fonts = html.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]+>/)[0];

const page = `<title>Taiko Thunder</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>
${css}
</style>
${body.trim()}
<script type="module">
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`;
writeFileSync(out, page);
console.log(`${out}: ${(page.length / 1024).toFixed(1)} KB`);
