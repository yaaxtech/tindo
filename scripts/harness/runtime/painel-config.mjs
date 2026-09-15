// Presentation derived from the operational registry; no routing mutations.
const NOMES = {
  sol: 'Sol', luna: 'Luna', terra: 'Terra', fable: 'Fable 5',
  'fable-5.1': 'Fable 5.1', 'claude-fable-5-1': 'Fable 5.1',
  astra: 'Astra', 'gpt-6-astra': 'Astra', opus5: 'Opus 5', sonnet: 'Sonnet', haiku: 'Haiku',
};
const CAUSAS = {
  qualidade: 'qualidade', quota_openai: 'limite OpenAI', quota_anthropic: 'limite Claude',
  qualidade_ou_quota_openai: 'qualidade ou limite OpenAI',
  qualidade_ou_quota_anthropic: 'qualidade ou limite Claude',
  opus_indisponivel: 'Opus indisponível',
};
// Legacy KPI eligibility, not a model rank. Preserve these values until
// the KPI contract itself is migrated; model/effort labels remain derived.
const PISO_SINAL = { rotina: true, dificil: false, analise: false, ui: true, mecanico: true, sql: false };
function par(passo) {
  return `${NOMES[passo.modelo] || passo.modelo} (${passo.effort || 'esforço não informado'})`;
}
export function construirCadeias(defaults, frente = 'claude') {
  if (!defaults.terrenos || !Object.keys(defaults.terrenos).length) {
    throw new Error('Registro de terrenos ausente ou vazio');
  }
  const rotas = frente === 'codex' ? defaults.codex?.terrenos : defaults.terrenos;
  return Object.fromEntries(Object.entries(rotas || {}).map(([chave, rota]) => {
    const d = frente === 'codex' ? {
      ...rota, rotulo: defaults.terrenos[chave]?.rotulo || chave,
      effort_teto: rota.escalada_effort?.at(-1) || rota.effort,
    } : rota;
    if (!d.modelo || !d.effort) throw new Error(`Rota ${chave} sem titular/effort`);
    const revisores = d.revisao_por_modelo?.[d.modelo] || (d.revisao
      ? [d.revisao, ...(d.revisao.fallback_proprio ? [{...d.revisao.fallback_proprio, fallback_proprio:true}] : [])] : []);
    const primeiro = revisores[0];
    for (const [causa, passos] of Object.entries(d.fallback_por_motivo || {})) {
      if (!Array.isArray(passos) || passos.some(p => !p?.modelo || !p?.effort)) {
        throw new Error(`Fallback inválido em ${chave}/${causa}`);
      }
    }
    const fallback = Object.entries(d.fallback_por_motivo || {}).map(([causa, passos]) =>
      `${CAUSAS[causa] || causa}: ${passos.length ? passos.map(par).join(' → ') : 'parar; sem substituto autorizado'}`,
    );
    return [chave, {
      rotulo: d.rotulo || chave,
      default: par(d),
      fallback,
      piso: PISO_SINAL[chave] ?? false,
      nunca_externo: !!d.nunca_externo,
      effort: d.effort || null,
      effort_teto: d.effort_teto || null,
      // Legacy snapshot contract: true means the allowed model range is locked
      // (piso===teto), not merely that the current author reached its ceiling.
      // Preserve this meaning; kpisTerreno and paridade-terrenos use it.
      modelo_no_teto: !!(d.piso_modelo && d.piso_modelo === d.teto_modelo),
      revisor: primeiro
        ? `${par(primeiro)} revisa ${par(d)}${revisores.some(r => r.fallback_proprio) ? '; revisão pelo próprio provedor só na exceção registrada' : ''}`
        : 'Revisor não definido para este titular; conferir a configuração',
    }];
  }));
}
// Plans and purchase dates supplied by owner on 2026-09-07. Prices are public
// monthly USD list references, not invoice amounts. Renewal is unknown.
// https://learn.chatgpt.com/docs/pricing (Pro 20x: $200)
// https://support.claude.com/en/articles/11049741-what-is-the-max-plan
export const ASSINATURAS = [
  { nome: 'Codex Pro 20×', frente: 'codex', valor: 200, renova: 'não informada',
    papel: 'Execução e revisão do Claude. Contratado em 04/09/2026. Valor mensal de referência, não fatura.' },
  { nome: 'Claude Max 5×', frente: 'claude', valor: 100, renova: 'não informada',
    papel: 'Orquestração, planejamento, frontend e revisão do Codex. Contratado em 07/09/2026. Valor mensal de referência, não fatura.' },
];
