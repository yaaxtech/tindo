import { intervaloWilson } from './metricas-snapshot.mjs';
import { normModelo } from './modelos.mjs';
import { versaoExperimento } from './rota-harness.mjs';

const JULGADOS = new Set(['ok1', 'retrabalho', 'escalado', 'falhou']);
const mediana = (xs) => {
  const s = xs.filter(x => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2 : null;
};

// Only assigned, actually executed trials are samples. Ordinary historical
// traffic and planned candidates never become experimental evidence.
export function construirExperimentos(defaults, linhas, sessoes = [], agora = new Date().toISOString()) {
  const tokens = new Map(sessoes.map(s => [s.session_id, s.tokens]));
  const usos = new Map();
  for (const r of linhas) if (r.session_id) usos.set(r.session_id, (usos.get(r.session_id) || 0) + 1);
  const experimentos = [];
  for (const [frente, rotas] of Object.entries({ claude: defaults.terrenos, codex: defaults.codex?.terrenos })) {
    for (const [terreno, rota] of Object.entries(rotas || {})) {
      const exp = rota.experimento;
      if (!exp) continue;
      const elegiveis = linhas.filter(r => r.frente === frente && r.terreno === terreno &&
        r.papel === 'construtor' && !r.papel_inferido && !r.terreno_inferido &&
        (r.auto === true || r.classificacao === 'declarada') && r.experiment_id === exp.id &&
        r.experiment_version === versaoExperimento(exp));
      const bracos = exp.bracos.map(b => {
        const rows = elegiveis.filter(r => r.arm === b.id && normModelo(r.modelo) === normModelo(b.modelo) && r.effort === b.effort);
        const julgados = rows.filter(r => JULGADOS.has(r.resultado));
        const medidos = julgados.map(r => {
          // One session referenced by multiple records cannot be attributed
          // to an individual trial. Missing/ambiguous usage stays null.
          const total = r.session_id && usos.get(r.session_id) === 1 ? (r.tokens ?? tokens.get(r.session_id)) : null;
          return { r, tokens: typeof total === 'number' && Number.isFinite(total) ? total : null };
        });
        return { id: b.id, modelo: b.modelo, effort: b.effort,
          execucoes: rows.filter(r => !['quota', 'infra'].includes(r.resultado)).length,
          julgados: julgados.length, ok1: julgados.filter(r => r.resultado === 'ok1').length,
          retrabalho: julgados.filter(r => r.resultado === 'retrabalho').length,
          falhas: julgados.filter(r => ['falhou', 'escalado'].includes(r.resultado)).length,
          quota: rows.filter(r => r.resultado === 'quota').length,
          infra: rows.filter(r => r.resultado === 'infra').length,
          pendentes: rows.filter(r => r.resultado === 'pendente').length,
          modelos_confirmados: julgados.filter(r=>r.modelo_confirmado===true).length,
          tokens_medidos: medidos.filter(r => r.tokens !== null).length,
          tokens_mediana: mediana(medidos.filter(r => r.tokens !== null).map(r => r.tokens)),
          duracoes_medidas: julgados.filter(r => typeof r.dur === 'number' && r.dur > 0).length,
          duracao_mediana_min: mediana(julgados.filter(r => typeof r.dur === 'number' && r.dur > 0).map(r => r.dur)),
        };
      });
      const total = bracos.reduce((s, b) => s + b.julgados, 0);
      experimentos.push({ id: exp.id, terreno, frente,
        status: exp.ativo ? (total ? 'Em medição' : 'Ativo · aguardando execuções') : 'Encerrado',
        motivo: exp.motivo || 'Comparação aleatória em tarefas reais; sem promoção com amostra ou consumo incompletos.',
        bracos });
    }
  }
  return { gerado_em: agora, experimentos };
}

// Non-inferiority is checked conservatively via independent Wilson bounds.
// Small samples can be displayed but cannot silently authorize promotion.
export function decidirExperimento(exp, cfg) {
  const base = exp.bracos.find(b => b.id === cfg.base);
  if (!base) return { promover: null, motivo: 'Braço de referência ausente' };
  const minimo = Math.max(20, cfg.min_amostras || 20);
  const completo = b => b.julgados >= minimo && b.tokens_medidos === b.julgados &&
    b.modelos_confirmados === b.julgados &&
    b.duracoes_medidas === b.julgados && b.pendentes === 0 && b.tokens_mediana > 0;
  if (!completo(base)) return { promover: null, motivo: 'Referência sem amostra completa de qualidade, tempo e consumo' };
  const a = intervaloWilson(base.ok1, base.julgados);
  const aprovados = exp.bracos.filter(b => b.id !== base.id && completo(b)).filter(b => {
    const ci = intervaloWilson(b.ok1, b.julgados);
    return b.falhas === 0 && b.ok1 / b.julgados >= base.ok1 / base.julgados &&
      a.max - ci.min <= Math.min(0.05, cfg.margem_qualidade || 0.05) &&
      b.tokens_mediana <= base.tokens_mediana * 0.8 &&
      b.duracao_mediana_min <= base.duracao_mediana_min;
  }).sort((a, b) => a.tokens_mediana - b.tokens_mediana);
  return aprovados.length ? { promover: aprovados[0].id, motivo: 'Qualidade preservada com incerteza ≤5 pontos, consumo ≥20% menor e tempo não pior' }
    : { promover: null, motivo: 'Nenhum braço demonstrou qualidade preservada e economia com evidência suficiente' };
}
