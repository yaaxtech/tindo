import { cp, readFile, writeFile } from 'node:fs/promises';

const output = '.open-next';
const workerPath = `${output}/worker.js`;
const assetWorkerPath = `${output}/assets/_worker.js`;

let worker = await readFile(workerPath, 'utf8');
const marker = 'if (url.pathname.startsWith("/_next/"))';

if (!worker.includes(marker)) {
  worker = worker.replace(
    'const url = new URL(request.url);',
    `const url = new URL(request.url);
            // Pages sends every request through _worker.js. Let its asset
            // binding serve Next's compiled CSS and JavaScript directly.
            if (url.pathname.startsWith("/_next/")) {
                return env.ASSETS.fetch(request);
            }`,
  );
}

await writeFile(assetWorkerPath, worker);

for (const directory of ['cloudflare', 'middleware', 'server-functions', '.build']) {
  await cp(`${output}/${directory}`, `${output}/assets/${directory}`, {
    recursive: true,
    force: true,
  });
}
