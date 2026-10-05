// Regenerate PNG icons from the SVG mark: `node scripts/icons.mjs` (needs `playwright`).
import { chromium } from 'playwright';
const glyph = '<path d="M18 14h30v8H27v7h16v8H27v13h-9z" fill="#eceef1"/><rect x="31" y="44" width="17" height="6" rx="1.5" fill="#f08a3c"/>';
const any = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#171a1f"/>${glyph}</svg>`;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#171a1f"/>${glyph}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#171a1f"/><g transform="translate(32 32) scale(.72) translate(-33 -32)">${glyph}</g></svg>`;
const jobs = [['icon-192.png', any, 192], ['icon-512.png', any, 512], ['maskable-512.png', maskable, 512], ['apple-touch-icon.png', full, 180]];
const b = await chromium.launch();
const p = await b.newPage();
for (const [name, svg, size] of jobs) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: `src/assets/icons/${name}`, omitBackground: true });
}
await b.close();
console.log('icons written');
