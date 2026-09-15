export const ARENA_URL = 'https://arena.ai/leaderboard/agent/pareto?projection=output-tokens';

export function extrairArena(html, consultadoEm = new Date().toISOString()) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map(m => JSON.parse(m[1])).join('');
  let snapshot, costs;
  function walk(v) {
    if (!v || typeof v !== 'object') return;
    if (v.snapshot?.rows && v.costStats?.entries) { snapshot = v.snapshot; costs = v.costStats.entries; }
    for (const value of Object.values(v)) walk(value);
  }
  for (const line of chunks.split('\n')) {
    const json = line.slice(line.indexOf(':') + 1);
    try { walk(JSON.parse(json)); } catch { /* Flight module references are not data. */ }
  }
  if (!snapshot || !costs) throw new Error('Arena mudou o formato; amostra anterior preservada');
  const costMap = new Map(costs.map(c => [c.contenderName, c]));
  const modelos = snapshot.rows.map(r => {
    const c = costMap.get(r.contenderName)?.outputMtokPerTask;
    return { id: r.contenderName, nome: r.model, organizacao: r.modelOrganization,
      score: r.avgScore?.value, score_margem: r.avgScore?.ci ?? null, sessoes: r.sessions,
      output_tokens_mediana: Number.isFinite(c?.medianMtok) ? Math.round(c.medianMtok * 1e6) : null,
      amostra_tokens: c?.tokenedSampleCount ?? 0 };
  });
  if (!modelos.length || modelos.some(m => typeof m.nome !== 'string' || !Number.isFinite(m.score))) {
    throw new Error('Arena sem modelos ou pontuação válida');
  }
  return { fonte: 'Arena Agent Pareto', url: ARENA_URL, consultado_em: consultadoEm,
    projecao: 'output-tokens', nota: 'Referência externa de capacidade e tokens de saída; não mede nossa cota nem calibra esforço local.', modelos };
}

export async function consultarArena() {
  const resposta = await fetch(ARENA_URL, { signal: AbortSignal.timeout(20000) });
  if (!resposta.ok) throw new Error(`Arena HTTP ${resposta.status}`);
  return extrairArena(await resposta.text());
}
