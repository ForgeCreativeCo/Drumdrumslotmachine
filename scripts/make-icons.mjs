// Render the PWA icons: a taiko drum head with gold tacks and 雷 in Noto Serif JP.
// Usage: node scripts/make-icons.mjs public/icons
// Needs the playwright package and network access for Google Fonts.
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'public/icons';
// r = drum radius out of a 512 canvas; maskable icons keep the art inside the 80% safe circle.
const svg = (r) => {
  const tacks = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const tr = r * 0.9;
    return `<circle cx="${256 + Math.cos(a) * tr}" cy="${256 + Math.sin(a) * tr}" r="${r * 0.035}" fill="url(#gold)" stroke="#5a3a08" stroke-width="1.5"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#7a1512"/><stop offset="0.6" stop-color="#2a0b0e"/><stop offset="1" stop-color="#14070a"/></radialGradient>
    <radialGradient id="head" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#fbf0d6"/><stop offset="0.75" stop-color="#ead2a0"/><stop offset="1" stop-color="#b98f52"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c2"/><stop offset="0.5" stop-color="#f3c75a"/><stop offset="1" stop-color="#8a5a10"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0.6" stop-color="#f3c75a" stop-opacity="0.35"/><stop offset="1" stop-color="#f3c75a" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="${r * 1.18}" fill="url(#glow)"/>
  <circle cx="256" cy="256" r="${r}" fill="#3a0d0c" stroke="url(#gold)" stroke-width="${r * 0.05}"/>
  ${tacks}
  <circle cx="256" cy="256" r="${r * 0.8}" fill="url(#head)"/>
  <circle cx="256" cy="256" r="${r * 0.8}" fill="none" stroke="#8a5a10" stroke-opacity="0.5" stroke-width="3"/>
  <text x="256" y="${256 + r * 0.03}" font-family="Noto Serif JP" font-weight="900" font-size="${r * 1.0}" text-anchor="middle" dominant-baseline="central" fill="#b3201b">雷</text>
</svg>`;
};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 512, height: 512 } });
const shots = [['icon-512.png', 222, 512], ['icon-192.png', 222, 192], ['maskable-512.png', 178, 512], ['apple-touch-icon.png', 200, 180]];
for (const [name, r, size] of shots) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@900&display=block" rel="stylesheet"></head>
  <body style="margin:0;background:#14070a"><div style="width:${size}px;height:${size}px">${svg(r).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</div></body></html>`);
  await p.evaluate(async () => { await document.fonts.load('900 100px "Noto Serif JP"', '雷'); await document.fonts.ready; });
  await p.waitForTimeout(300);
  console.log(name, await p.evaluate(() => document.fonts.check('900 100px "Noto Serif JP"', '雷')));
  await p.screenshot({ path: `${out}/${name}`, omitBackground: false });
}
await b.close();
