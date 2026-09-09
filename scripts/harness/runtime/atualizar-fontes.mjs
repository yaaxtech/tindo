#!/usr/bin/env node
// Called hourly by launchd. Each source publishes independently; a failure
// never prevents healthy sources from refreshing and leaves a nonzero exit.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
function executar(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(dir, script)], {
      stdio: 'inherit',
      timeout: 1800000,
    });
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code === 0 ? 0 : 1));
  });
}
const resultados = await Promise.all(['publicar-painel.mjs', 'coletar-actions.mjs'].map(executar));
process.exitCode = resultados.some(Boolean) ? 1 : 0;
