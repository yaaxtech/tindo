/**
 * Contrato público e motor canônico de métricas do Harness.
 *
 * A fonte local continua sendo o ledger estruturado. Este módulo transforma
 * eventos em métricas versionadas e remove texto livre antes da publicação.
 * A página pode renderizar o resultado, mas não deve redefinir qualidade.
 */

export const HARNESS_SCHEMA_VERSION = 2;
export const HARNESS_METRIC_VERSION = 'construction-v2-2026-08-27';
export const JANELAS_PUBLICADAS = [1, 7, 14, 15, 30];
export const MIN_AMOSTRA_DECISAO = 20;

const DIA_MS = 86_400_000;
const RESULTADOS_EXCLUIDOS = new Set(['pendente', 'quota', 'infra', 'descartado']);
const FRENTES = new Set(['codex', 'claude', 'cerebro', 'kimi']);
const TERRENOS = new Set(['ui', 'rotina', 'dificil', 'mecanico', 'sql', 'analise']);
const RESULTADOS = new Set([
  'ok1',
  'retrabalho',
  'escalado',
  'falhou',
  'infra',
  'quota',
  'descartado',
  'pendente',
]);
const PAPEIS = new Set(['construtor', 'revisor']);
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'ultra']);

const numeroFinito = (valor) => typeof valor === 'number' && Number.isFinite(valor);

/** Extrai a telemetria estruturada antes de apagar a nota livre do snapshot. */
export function extrairExecMin(nota) {
  if (typeof nota !== 'string') return null;
  const trecho = nota.match(/\bexec=([0-9]+(?:\.[0-9]+)?)min\b/)?.[1];
  if (!trecho) return null;
  const minutos = Number(trecho);
  return Number.isFinite(minutos) ? minutos : null;
}

export function papelExplicito(linha, papel) {
  return linha?.papel === papel && linha?.papel_inferido !== true;
}

export function julgavel(linha) {
  return !RESULTADOS_EXCLUIDOS.has(linha?.resultado);
}

function quantilOrdenado(valores, q) {
  if (!valores.length) return null;
  return valores[Math.min(valores.length - 1, Math.ceil(q * valores.length) - 1)] ?? null;
}

/** Wilson score interval para proporção binomial, 95% por padrão. */
export function intervaloWilson(sucessos, total, z = 1.959963984540054) {
  if (!total) return null;
  const p = sucessos / total;
  const z2 = z * z;
  const centro = (p + z2 / (2 * total)) / (1 + z2 / total);
  const margem = (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / (1 + z2 / total);
  return {
    min: Math.max(0, centro - margem),
    max: Math.min(1, centro + margem),
  };
}

export function recorteFixo(ledger, dias, deslocamento = 0, asOf = new Date().toISOString()) {
  const fim = Date.parse(asOf) - deslocamento * dias * DIA_MS;
  const inicio = fim - dias * DIA_MS;
  return ledger.filter((linha) => {
    const ts = Date.parse(linha?.ts);
    return Number.isFinite(ts) && ts >= inicio && ts < fim;
  });
}

export function metricasDaJanela(entrada) {
  const linhas = entrada.filter((linha) => linha && typeof linha === 'object');
  const construcao = linhas.filter((linha) => papelExplicito(linha, 'construtor'));
  const revisao = linhas.filter((linha) => papelExplicito(linha, 'revisor'));
  const construcaoAtiva = construcao.filter((linha) => linha.resultado !== 'pendente');
  const construcaoJulgada = construcao.filter(julgavel);
  const revisaoJulgada = revisao.filter(julgavel);
  const ok1 = construcaoJulgada.filter((linha) => linha.resultado === 'ok1').length;
  const retrabalho = construcaoJulgada.length - ok1;
  const problemasEncontrados = revisaoJulgada.filter(
    (linha) => linha.resultado === 'retrabalho',
  ).length;
  const duracoes = construcaoJulgada
    .map((linha) => linha.dur)
    .filter((dur) => numeroFinito(dur) && dur > 0)
    .sort((a, b) => a - b);
  const porFrente = {};
  const quotaPorFrente = {};
  for (const linha of construcaoAtiva) {
    porFrente[linha.frente] = (porFrente[linha.frente] || 0) + 1;
    if (linha.resultado === 'quota') {
      quotaPorFrente[linha.frente] = (quotaPorFrente[linha.frente] || 0) + 1;
    }
  }
  const quota = construcao.filter((linha) => linha.resultado === 'quota').length;
  const infra = construcao.filter((linha) => linha.resultado === 'infra').length;
  const descartado = construcao.filter((linha) => linha.resultado === 'descartado').length;
  const pendente = construcao.filter((linha) => linha.resultado === 'pendente').length;
  const aceitas = construcao.filter(
    (linha) => linha.resultado === 'ok1' || linha.resultado === 'retrabalho',
  ).length;
  const offload = construcaoAtiva.filter(
    (linha) => linha.frente !== 'claude' && linha.frente !== 'cerebro',
  ).length;
  const qualidade = construcaoJulgada.length ? ok1 / construcaoJulgada.length : null;
  const revisaoDeteccao = revisaoJulgada.length
    ? problemasEncontrados / revisaoJulgada.length
    : null;

  return {
    eventos: linhas.length,
    construcao: {
      total: construcao.length,
      julgados: construcaoJulgada.length,
      ok1,
      retrabalho,
      aceitas,
      pendente,
      quota,
      infra,
      descartado,
      qualidade,
      retrabalho_pct: construcaoJulgada.length ? retrabalho / construcaoJulgada.length : null,
      qualidade_ic95: intervaloWilson(ok1, construcaoJulgada.length),
      offload,
      offload_pct: construcaoAtiva.length ? offload / construcaoAtiva.length : null,
      quota_pct: construcaoAtiva.length ? quota / construcaoAtiva.length : null,
      duracao: {
        n: duracoes.length,
        p50_min: quantilOrdenado(duracoes, 0.5),
        p90_min: quantilOrdenado(duracoes, 0.9),
      },
      por_frente: porFrente,
      quota_por_frente: quotaPorFrente,
    },
    revisao: {
      total: revisao.length,
      julgados: revisaoJulgada.length,
      problemas_encontrados: problemasEncontrados,
      deteccao_pct: revisaoDeteccao,
      deteccao_ic95: intervaloWilson(problemasEncontrados, revisaoJulgada.length),
    },
  };
}

export function construirPeriodos(ledger, asOf, janelas = JANELAS_PUBLICADAS) {
  return Object.fromEntries(
    janelas.map((dias) => [
      String(dias),
      {
        dias,
        atual: metricasDaJanela(recorteFixo(ledger, dias, 0, asOf)),
        anterior: metricasDaJanela(recorteFixo(ledger, dias, 1, asOf)),
        inicio_atual: new Date(Date.parse(asOf) - dias * DIA_MS).toISOString(),
        fim_atual: asOf,
      },
    ]),
  );
}

const CAMPOS_PUBLICOS = [
  'ts',
  'ts_fechado',
  'frente',
  'modelo',
  'effort',
  'terreno',
  'resultado',
  'dur',
  'exec_min',
  'auto',
  'terreno_inferido',
  'papel',
  'papel_inferido',
];

/** Mantém telemetria estruturada; remove tarefa, nota, IDs e qualquer campo livre. */
export function sanitizarLedger(ledger) {
  const publicados = [];
  let rejeitados = 0;
  const rejeicoes_por_motivo = {};
  const rejeitar = (motivo) => {
    rejeitados++;
    rejeicoes_por_motivo[motivo] = (rejeicoes_por_motivo[motivo] || 0) + 1;
  };
  for (const linha of ledger) {
    if (!linha || typeof linha !== 'object') {
      rejeitar('formato_invalido');
      continue;
    }
    if (!Number.isFinite(Date.parse(linha.ts))) {
      rejeitar('timestamp_invalido');
      continue;
    }
    if (!FRENTES.has(linha.frente)) {
      rejeitar('frente_invalida');
      continue;
    }
    if (typeof linha.modelo !== 'string' || !linha.modelo.trim()) {
      rejeitar('modelo_invalido');
      continue;
    }
    if (!TERRENOS.has(linha.terreno)) {
      rejeitar('terreno_invalido');
      continue;
    }
    if (!RESULTADOS.has(linha.resultado)) {
      rejeitar('resultado_invalido');
      continue;
    }
    if (linha.effort != null && !EFFORTS.has(linha.effort)) {
      rejeitar('effort_invalido');
      continue;
    }
    if (linha.papel != null && !PAPEIS.has(linha.papel)) {
      rejeitar('papel_invalido');
      continue;
    }
    if (
      (linha.dur != null && (!numeroFinito(linha.dur) || linha.dur < 0)) ||
      (linha.exec_min != null && (!numeroFinito(linha.exec_min) || linha.exec_min < 0))
    ) {
      rejeitar('duracao_invalida');
      continue;
    }
    if (
      ['auto', 'terreno_inferido', 'papel_inferido'].some(
        (campo) => linha[campo] != null && typeof linha[campo] !== 'boolean',
      )
    ) {
      rejeitar('booleano_invalido');
      continue;
    }
    const publico = {};
    for (const campo of CAMPOS_PUBLICOS) {
      if (linha[campo] !== undefined) publico[campo] = linha[campo];
    }
    publicados.push(publico);
  }
  return { publicados, rejeitados, rejeicoes_por_motivo };
}

export function saudeDosDados(ledger, asOf, opcoes = {}) {
  const recebidos = opcoes.recebidos ?? ledger.length;
  const rejeitados = opcoes.rejeitados ?? 0;
  const validos = ledger.filter((linha) => Number.isFinite(Date.parse(linha?.ts)));
  const fonteMax = validos.reduce((max, linha) => {
    const ts = Date.parse(linha.ts);
    return ts > max ? ts : max;
  }, Number.NEGATIVE_INFINITY);
  const explicitos = validos.filter(
    (linha) =>
      (linha.papel === 'construtor' || linha.papel === 'revisor') && linha.papel_inferido !== true,
  ).length;
  const duracoes = validos.filter((linha) => numeroFinito(linha.dur) && linha.dur > 0).length;
  const sourceMaxTs = Number.isFinite(fonteMax) ? new Date(fonteMax).toISOString() : null;
  return {
    schema_version: HARNESS_SCHEMA_VERSION,
    metric_version: HARNESS_METRIC_VERSION,
    gerado_em: asOf,
    source_max_ts: sourceMaxTs,
    atraso_fonte_seg:
      sourceMaxTs === null ? null : Math.max(0, Math.round((Date.parse(asOf) - fonteMax) / 1000)),
    eventos_recebidos: recebidos,
    eventos_publicados: validos.length,
    eventos_rejeitados: rejeitados,
    rejeicoes_por_motivo: opcoes.rejeicoes_por_motivo ?? {},
    papel_explicito: explicitos,
    papel_explicito_pct: validos.length ? explicitos / validos.length : null,
    duracao_preenchida: duracoes,
    duracao_preenchida_pct: validos.length ? duracoes / validos.length : null,
  };
}

/** Quarentena snapshots calculados por fórmulas anteriores. */
export function filtrarHistoricoCompativel(history) {
  return history.filter(
    (linha) =>
      linha &&
      typeof linha === 'object' &&
      linha.schema_version === HARNESS_SCHEMA_VERSION &&
      linha.metric_version === HARNESS_METRIC_VERSION,
  );
}

const pct = (valor) => (valor == null ? 'indisponível' : `${Math.round(valor * 100)}%`);

export function resumoMarkdown(blob) {
  const semana = blob.metricas_periodos?.['7']?.atual;
  const c = semana?.construcao;
  const r = semana?.revisao;
  const s = blob.saude_dados;
  return `# Harness — recibo automático\n\nGerado em: ${blob.gerado_em}\n\nContrato: schema ${blob.schema_version} · métricas ${blob.metric_version}\n\n## Últimos 7 dias\n\n- Qualidade de construção: ${pct(c?.qualidade)} (${c?.ok1 ?? 0}/${c?.julgados ?? 0})\n- Retrabalho de construção: ${pct(c?.retrabalho_pct)} (${c?.retrabalho ?? 0}/${c?.julgados ?? 0})\n- Detecção da revisão: ${pct(r?.deteccao_pct)} (${r?.problemas_encontrados ?? 0}/${r?.julgados ?? 0})\n- Duração preenchida: ${c?.duracao?.n ?? 0} construção(ões) julgada(s)\n\n## Saúde dos dados\n\n- Evento mais novo da fonte: ${s?.source_max_ts ?? 'indisponível'}\n- Papéis explícitos: ${s?.papel_explicito ?? 0}/${s?.eventos_publicados ?? 0} (${pct(s?.papel_explicito_pct)})\n- Durações preenchidas: ${s?.duracao_preenchida ?? 0}/${s?.eventos_publicados ?? 0} (${pct(s?.duracao_preenchida_pct)})\n- Eventos rejeitados: ${s?.eventos_rejeitados ?? 0}\n\n> Este Markdown é uma saída humana. A fonte canônica continua sendo o ledger estruturado.\n`;
}
