/**
 * `npm run build`
 *  1. Regenerates the service worker's precache list + content-hash version, so every
 *     deploy busts the offline cache exactly when files change.
 *  2. Copies the deployable app into `dist/` (what GitHub Pages serves).
 * No bundler needed — FORGE ships native ES modules.
 */
import { readdir, readFile, writeFile, mkdir, cp, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const SHIP = ['index.html', 'manifest.json', 'service-worker.js', 'src'];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const files = (await walk(join(root, 'src'))).map((f) => relative(root, f).split(sep).join('/')).sort();
const shell = ['./', 'index.html', 'manifest.json', ...files];

const hash = createHash('sha256');
for (const f of ['index.html', 'manifest.json', ...files]) hash.update(f).update(await readFile(join(root, f)));
const version = hash.digest('hex').slice(0, 10);

const swPath = join(root, 'service-worker.js');
let sw = await readFile(swPath, 'utf8');
sw = sw.replace(/\/\/ <precache>[\s\S]*?\/\/ <\/precache>/, `// <precache>\nconst VERSION = '${version}';\nconst APP_SHELL = ${JSON.stringify(shell, null, 2)};\n// </precache>`);
await writeFile(swPath, sw);

const dist = join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const f of SHIP) await cp(join(root, f), join(dist, f), { recursive: true });
await writeFile(join(dist, '.nojekyll'), '');
const size = (await Promise.all(shell.filter((f) => f !== './').map((f) => stat(join(root, f)).then((s) => s.size)))).reduce((a, b) => a + b, 0);
console.log(`FORGE build ${version}: ${shell.length} precached files, ${(size / 1024).toFixed(0)} KB → dist/`);
