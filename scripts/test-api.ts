#!/usr/bin/env bun
/**
 * Testa os endpoints da API local.
 */
export {};
const paths = ['/api/fila', '/api/projetos', '/api/tags', '/api/configuracoes', '/api/gamificacao'];

for (const p of paths) {
  try {
    const res = await fetch(`http://localhost:3000${p}`);
    const txt = await res.text();
    console.log(`${p} → ${res.status} (${txt.length} bytes)`);
  } catch (e) {
    console.log(`${p} → ERRO ${e instanceof Error ? e.message : e}`);
  }
}
