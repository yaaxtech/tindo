#!/usr/bin/env node
/**
 * Motor de tier por terreno — sobe MODELO e/ou EFFORT guiado por dados.
 *
 * Decisão do dono (2026-08-15): quando um terreno está atrás do alvo de ok1, o
 * harness deve escolher sozinho o degrau de melhor VALOR (ganho de qualidade ÷
 * custo marginal) e mudar — sem pedir OK caso a caso. Custo NÃO é freio que
 * pergunta; é o divisor do score ("não passar demais").
 *
 * ESTA FATIA (F3) SÓ PROPÕE. Não escreve o defaults-terreno.json nem aplica
 * nada — `avaliar()` devolve sinais + propostas para o painel e o e-mail de
 * segunda. A aplicação real vive na F4, atrás do toggle AUTO_SUBIR_ON (default
 * OFF — G-13). Validar o algoritmo com dado real antes de soltar a mão.
 *
 * Puro por construção: só lê o ledger e o defaults-terreno.json. Nenhum efeito
 * externo — por isso é seguro importar (igual ao termometro-janela.mjs, ao
 * contrário do auditoria-harness.mjs que envia e-mail).
 *
 * Referência externa vigente: Artificial Analysis
 * (https://artificialanalysis.ai/). O motor não congela scores externos no
 * código: subir MODELO usa o ledger local; sem amostra, recomenda A/B e exige
 * consulta datada à referência antes de alterar a cadeia de candidatos.
 *   - subir EFFORT decide pelo histórico do ledger (ok1 por effort no terreno);
 *     sem amostra suficiente → recomenda A/B (F5). NUNCA sobe no escuro.
 *
 * Spec: docs/superpowers/specs/2026-08-15-auto-subir-modelo-effort-por-dados.md
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { autorregular } from './autorregular-experimentos.mjs';
import { coletarTokensPorSessaoCodex } from './telemetria-codex.mjs';
import { construirExperimentos, decidirExperimento } from './experimentos-harness.mjs';
import {
  LEDGER_FILE, LIMIARES, loadJanela, terrenoAmbiguo, avisoMudo, julgavel,
} from './ledger.mjs';

const DEFAULTS_FILE = join(homedir(), '.claude', 'orquestracao', 'defaults-terreno.json');

// --- parâmetros do motor (revisáveis; a razão de cada um está ao lado) -------

const N_MIN = LIMIARES.MIN_N; // mesma porta de amostra de toda decisão de qualidade
const AMBIGUO_MAX = LIMIARES.AMBIGUO_MAX; // acima disso o balde não mede terreno

// Escala de effort (ledger e defaults falam a mesma língua)
const EFFORT = ['low', 'medium', 'high', 'xhigh', 'max'];
const idxEffort = (e) => EFFORT.indexOf(e);

// Metadados por modelo — vocabulário curto do defaults-terreno.json é a fonte.
// provider: 'anthropic' = metered (custa $ de verdade no margem) · 'openai' =
//   assinatura flat-rate (usar mais ≈ custo marginal pequeno).
// custo_rel: custo RELATIVO por tarefa (não é $; F4 troca pelo $/tarefa real do
//   painel). O que importa é o DELTA ao trocar de degrau.
// A referência externa para manutenção humana das cadeias é Artificial
// Analysis. O motor não usa score externo congelado para decidir sozinho.
export const MODELO = {
  astra:  { provider: 'openai',    custo_rel: 0.5 },
  luna:   { provider: 'openai',    custo_rel: 0.4 },
  sol:    { provider: 'openai',    custo_rel: 0.5 },
  terra:  { provider: 'openai',    custo_rel: 0.4 },
  haiku:  { provider: 'anthropic', custo_rel: 1.5 },
  sonnet: { provider: 'anthropic', custo_rel: 4.0 },
  fable:  { provider: 'anthropic', custo_rel: 6.0 },
  opus5:  { provider: 'anthropic', custo_rel: 10.0 },
};
export const BENCHMARK_MODELOS_URL = 'https://arena.ai/leaderboard/agent/pareto?projection=output-tokens';

// Força-tarefa de economia Claude até 27/08: subir para modelo Anthropic paga
// pedágio no custo (não é veto — é preço; o dono pediu automático).
const ECONOMIA_ATE = Date.parse('2026-08-27T00:00:00Z');
const PEDAGIO = 1.6;

// Trava de dinheiro/controle. Vale onde o erro custa $ (terreno com
// modelos_permitidos): o motor "ajusta sozinho" o modelo (dono, 2026-08-16), mas
// NUNCA aceita um candidato que:
//   - saia do Claude quando nunca_externo=true (worker externo nunca toca
//     dinheiro — risco de CONTROLE, independe de benchmark); ou
//   - não esteja na allowlist explícita do terreno de dinheiro.
// Assim, 6 despachos de sorte no ledger nunca rebaixam o modelo do SQL; só um
// uma mudança explícita e revisada da allowlist pode movê-lo.
export function modeloPermitido(cfg, cod) {
  const m = MODELO[cod];
  if (!m) return false;
  if (cfg.nunca_externo && m.provider !== 'anthropic') return false;
  if (cfg.modelos_permitidos?.length && !cfg.modelos_permitidos.includes(cod)) return false;
  return true;
}

// --- F4: parâmetros da APLICAÇÃO real (só valem quando o toggle está ON) ------

// Uma subida só é MANTIDA se o ok1 melhorou de fato; ≤ isto = custo subiu sem
// ok1 seguir → o motor DESCE sozinho (a exceção MEDIDA à regra "descida nunca é
// automática"; aqui é medida, não no escuro).
const GANHO_MIN_CONFIRMA = 0;
// Janela p/ juntar amostra PÓS-subida ao julgar reversão — o aplicado_em pode
// ser mais velho que a janela de proposta (7d), então lê mais fundo.
const DIAS_REVISAO = 21;
// Depois de reverter um degrau, trava re-subir o MESMO degrau por este prazo
// (anti-vaivém: sem isto, gap positivo re-propõe a subida que acabou de falhar).
const ANTITHRASH_DIAS = 14;
// Trilha de auditoria das mudanças de tier — arquivo PRÓPRIO, NUNCA o
// ledger.jsonl (misturar contaminaria o calcKpis dos despachos).
const AUDIT_FILE = join(homedir(), '.claude', 'orquestracao', 'tier-mudancas.jsonl');

const hojeData = () => new Date().toISOString().slice(0, 10);
const agoraIso = () => new Date().toISOString();
const autoSubirOn = () => /^(1|true|on|yes)$/i.test(process.env.AUTO_SUBIR_ON || '');

const pct = (x) => (x == null ? '—' : `${Math.round(100 * x)}%`);
const num = (x) => (x == null ? '—' : x.toFixed(2));

// --- custo marginal de um degrau --------------------------------------------

function pedagioAtivo() {
  return Date.now() < ECONOMIA_ATE;
}

// Custo marginal de TROCAR de modelo (delta de custo_rel, nunca negativo para
// efeito de score — descer de modelo é outro caminho, tratado à parte).
function custoTrocaModelo(atual, alvo) {
  const a = MODELO[atual]?.custo_rel ?? 0;
  const b = MODELO[alvo]?.custo_rel ?? 0;
  let delta = Math.max(0, b - a);
  if (MODELO[alvo]?.provider === 'anthropic' && pedagioAtivo()) delta *= PEDAGIO;
  // piso pequeno pra não dividir por ~0 quando o delta é sub→sub
  return Math.max(0.15, delta);
}

// Custo marginal de subir 1 degrau de effort DENTRO do mesmo modelo. Em worker
// de assinatura, effort é latência, não $. Em Anthropic, effort levanta
// tokens → custa proporcional ao modelo.
function custoDegrauEffort(modelo) {
  const m = MODELO[modelo];
  if (!m) return 0.2;
  if (m.provider !== 'anthropic') return 0.1;   // flat-rate: quase de graça
  let c = 0.4 * (m.custo_rel / 10);
  if (pedagioAtivo()) c *= PEDAGIO;
  return Math.max(0.1, c);
}

// --- ganho esperado ----------------------------------------------------------

// Ganho de trocar de modelo, em PONTOS de ok1 esperados, limitado pelo gap.
// O ledger local é a única entrada automática. Sem amostra, recomenda A/B;
// manutenção da cadeia consulta Artificial Analysis e registra data/página.
function ganhoModelo(atual, alvo, gap, ledgerDelta) {
  if (ledgerDelta != null) return { pts: Math.min(gap, Math.max(0, ledgerDelta)), fonte: 'ledger' };
  return { pts: null, fonte: 'sem prior' };
}

// --- agregação por terreno a partir do ledger --------------------------------

// Recorta o terreno em CARIMBADOS (não-ambíguos) — só eles medem tier. Devolve
// ok1 e n dos carimbados, a razão de ambiguidade (gate), e ok1 por effort (para
// o ganho de effort).
function recorteTerreno(linhas, terreno) {
  // REVISÃO nunca mede degrau de CONSTRUÇÃO (26/08): num revisor, `retrabalho`
  // quer dizer "reprovei o artefato" — é o revisor acertando. Deixá-la na
  // amostra rebaixava o titular do terreno exatamente onde ele funcionava.
  const doTerreno = linhas.filter((r) =>
    r.terreno === terreno &&
    r.papel === 'construtor' &&
    r.papel_inferido !== true);
  const julgaveis = doTerreno.filter(julgavel);
  const carimbados = julgaveis.filter((r) => !terrenoAmbiguo(r));
  const ambiguos = julgaveis.length - carimbados.length;
  const ok1 = carimbados.filter((r) => r.resultado === 'ok1').length;
  const n = carimbados.length;

  const porEffort = {};
  for (const r of carimbados) {
    const e = r.effort || 'desconhecido';
    const b = (porEffort[e] ||= { n: 0, ok1: 0 });
    b.n++;
    if (r.resultado === 'ok1') b.ok1++;
  }
  for (const b of Object.values(porEffort)) b.ok1_pct = b.n ? b.ok1 / b.n : null;

  return {
    n,
    ok1_pct: n ? ok1 / n : null,
    ambiguo_ratio: julgaveis.length ? ambiguos / julgaveis.length : 0,
    julgaveis: julgaveis.length,
    por_effort: porEffort,
  };
}

// Delta de ok1 (pontos %) entre o effort ALVO e o ATUAL, se ambos os baldes têm
// amostra mínima. Senão null → sem sinal de effort (recomenda A/B).
function ledgerDeltaEffort(porEffort, effortAtual, effortAlvo) {
  const a = porEffort[effortAtual];
  const b = porEffort[effortAlvo];
  if (!a || !b || a.n < N_MIN || b.n < N_MIN) return null;
  return (b.ok1_pct - a.ok1_pct) * 100;
}

// --- avaliação de um terreno -------------------------------------------------

function avaliarTerreno(nome, cfg, linhas) {
  const r = recorteTerreno(linhas, nome);
  const alvo = cfg.alvo_ok1;
  const base = {
    terreno: nome,
    rotulo: cfg.rotulo,
    modelo: cfg.modelo,
    effort: cfg.effort,
    alvo,
    n: r.n,
    ok1_pct: r.ok1_pct,
    ambiguo_ratio: r.ambiguo_ratio,
  };

  // Gate de ambiguidade — balde sujo não mede tier
  if (r.julgaveis && r.ambiguo_ratio > AMBIGUO_MAX) {
    return { ...base, estado: 'ambiguo', proposta: null,
      motivo: `balde ambíguo (${pct(r.ambiguo_ratio)} sem carimbo de terreno) — sinal suprimido` };
  }
  // Gate de amostra — abaixo de N_MIN é ruído
  if (r.n < N_MIN) {
    return { ...base, estado: 'amostra', proposta: null,
      motivo: `amostra insuficiente (${r.n}/${N_MIN} carimbados) — nada a mexer` };
  }

  const ok1pts = r.ok1_pct * 100;
  const gap = alvo - ok1pts;
  base.gap = +gap.toFixed(1);

  if (gap <= 0) {
    return { ...base, estado: 'no_alvo', proposta: null,
      motivo: `no alvo (ok1 ${pct(r.ok1_pct)} ≥ ${alvo}%)` };
  }

  // Enumera degraus possíveis, pontua por VALOR = ganho_pts / custo_marginal
  const candidatos = [];

  // (a) subir effort dentro do modelo atual
  const iAtual = idxEffort(cfg.effort);
  const iTeto = idxEffort(cfg.effort_teto);
  if (iAtual >= 0 && iAtual < iTeto) {
    const alvoEffort = EFFORT[iAtual + 1];
    const delta = ledgerDeltaEffort(r.por_effort, cfg.effort, alvoEffort);
    const custo = custoDegrauEffort(cfg.modelo);
    if (delta != null && delta > 0) {
      candidatos.push({ tipo: 'effort', de: cfg.effort, para: alvoEffort,
        ganho_pts: Math.min(gap, delta), custo, fonte: 'ledger',
        valor: Math.min(gap, delta) / custo });
    } else {
      // sem prior de effort → não sobe no escuro, marca para A/B (F5)
      candidatos.push({ tipo: 'effort', de: cfg.effort, para: alvoEffort,
        ganho_pts: null, custo, fonte: 'sem prior', valor: null, ab: true });
    }
  }

  // (b) trocar para o próximo modelo da cadeia (respeitando piso/teto)
  const cadeia = cfg.cadeia_modelo || [];
  const posAtual = cadeia.indexOf(cfg.modelo);
  const noTetoModelo = cfg.modelo === cfg.teto_modelo || posAtual === cadeia.length - 1;
  // Trava de dinheiro: candidato barrado pela regra de risco/benchmark nem vira
  // proposta (SQL/dinheiro — dono, 2026-08-16).
  const proximoOk = posAtual >= 0 && !noTetoModelo &&
    modeloPermitido(cfg, cadeia[posAtual + 1]);
  if (proximoOk) {
    const alvoModelo = cadeia[posAtual + 1];
    const ganho = ganhoModelo(cfg.modelo, alvoModelo, gap, null);
    const custo = custoTrocaModelo(cfg.modelo, alvoModelo);
    if (ganho.pts != null && ganho.pts > 0) {
      candidatos.push({ tipo: 'modelo', de: cfg.modelo, para: alvoModelo,
        ganho_pts: ganho.pts, custo, fonte: ganho.fonte, valor: ganho.pts / custo });
    } else {
      candidatos.push({ tipo: 'modelo', de: cfg.modelo, para: alvoModelo,
        ganho_pts: null, custo, fonte: ganho.fonte, valor: null, ab: true });
    }
  }

  // (c) reforço quando já no teto de modelo e a cadeia prevê verificador
  if (noTetoModelo && cfg.reforco) {
    base.reforco_disponivel = cfg.reforco;
  }

  // Escolhe o degrau de maior valor POSITIVO conhecido
  const comValor = candidatos.filter((c) => c.valor != null && c.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const paraAb = candidatos.filter((c) => c.ab);

  if (comValor.length) {
    const melhor = comValor[0];
    return {
      ...base, estado: 'sobe', proposta: melhor, candidatos, para_ab: paraAb,
      motivo: `${melhor.tipo} ${melhor.de}→${melhor.para} · ganho ~${num(melhor.ganho_pts)}pt ` +
        `÷ custo ${num(melhor.custo)} = valor ${num(melhor.valor)} (${melhor.fonte})`,
    };
  }
  if (paraAb.length) {
    const primeiro = paraAb[0];
    return {
      ...base, estado: 'medir', proposta: null, candidatos, para_ab: paraAb,
      motivo: `gap ${base.gap}pt mas sem prior de ganho — medir ${primeiro.tipo} ` +
        `${primeiro.de}→${primeiro.para} via A/B antes de fixar`,
    };
  }
  // gap positivo mas sem degrau nenhum (já no teto de tudo)
  return {
    ...base, estado: 'teto', proposta: null, candidatos,
    motivo: `atrás do alvo (gap ${base.gap}pt) mas já no teto de modelo e effort` +
      (cfg.reforco ? ` — resta reforço: ${cfg.reforco}` : ''),
  };
}

// --- API ---------------------------------------------------------------------

function lerDefaults(path = DEFAULTS_FILE) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function escreverDefaults(obj, path = DEFAULTS_FILE) {
  writeFileSync(path, `${JSON.stringify(obj, null, 2)}\n`);
}

export async function avaliar({ dias = 7, file = LEDGER_FILE, defaultsFile = DEFAULTS_FILE } = {}) {
  const defaults = lerDefaults(defaultsFile);
  if (defaults._meta?.governanca === 'experimentos-v1') {
    const report = construirExperimentos(defaults,loadJanela(file,90),await coletarTokensPorSessaoCodex({dias:90}));
    const sinais=report.experimentos.map(exp=>{
      const cfg=defaults.terrenos[exp.terreno].experimento;
      return `${exp.terreno}: ${exp.bracos.map(b=>`${b.modelo}/${b.effort} ${b.ok1}/${b.julgados}`).join(' · ')} — ${decidirExperimento(exp,cfg).motivo}`;
    });
    return {dias:90,auto_aplicar:defaults._meta.auto_aplicar,terrenos:[],propostas:[],experimentos:report,sinais};
  }
  const linhas = loadJanela(file, dias);
  const mudo = avisoMudo(file);

  const terrenos = Object.entries(defaults.terrenos)
    .map(([nome, cfg]) => avaliarTerreno(nome, cfg, linhas));

  const sinais = [];
  if (mudo) sinais.push(mudo);
  if (defaults._meta?.auto_aplicar === false) {
    sinais.push('ℹ Motor em modo PROPÕE (auto_aplicar=false) — nada é aplicado; ' +
      'só sinal para painel e e-mail.');
  }

  const emoji = {
    sobe: '🔺', medir: '🧪', teto: '⛔', no_alvo: '🟢', ambiguo: '⚠', amostra: '·',
  };
  for (const t of terrenos) {
    sinais.push(`${emoji[t.estado] || '·'} ${t.rotulo} [${t.modelo}/${t.effort}] ` +
      `ok1 ${pct(t.ok1_pct)} (n=${t.n}, alvo ${t.alvo}%): ${t.motivo}`);
  }

  const propostas = terrenos.filter((t) => t.estado === 'sobe');

  return { dias, atualizado_ledger_mudo: !!mudo, auto_aplicar: defaults._meta?.auto_aplicar,
    terrenos, propostas, sinais };
}

/** Linhas prontas para o corpo do e-mail semanal da auditoria. */
export function linhasParaEmail(resultado) {
  const cab = `Tier por terreno (${resultado.dias}d): ` +
    `${resultado.propostas.length} subida(s) proposta(s)` +
    (resultado.auto_aplicar === false ? ' · modo PROPÕE (nada aplicado)' : '');
  return [cab, ...resultado.sinais];
}

// ============================ F4 — APLICAÇÃO REAL ============================
// Só ESCREVE quando AMBOS os interruptores estão ON:
//   - env AUTO_SUBIR_ON  (default OFF — G-13: feature nasce desligada no código)
//   - defaults._meta.auto_aplicar === true  (o seed nasce false)
// Fora isso, aplicar() é NO-OP que só relata o que FARIA (não toca o JSON).
//
// Passada:
//   1. revisarReversao — desfaz subida que NÃO segurou (custo subiu, ok1 não).
//      É a exceção MEDIDA à regra "descida nunca é automática": a descida é
//      provada pela amostra PÓS-subida, nunca no escuro.
//   2. subir — para cada terreno em 'sobe', aplica o degrau de maior valor,
//      respeitando a trava anti-vaivém e a trava de dinheiro (modeloPermitido).
// Tudo gravado em tier-mudancas.jsonl (arquivo PRÓPRIO, nunca o ledger) e
// reversível: cada linha carrega de→para e o número que a justificou.

function lerAudit(auditFile) {
  if (!existsSync(auditFile)) return [];
  return readFileSync(auditFile, 'utf8').trim().split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function registrarAudit(auditFile, registro) {
  appendFileSync(auditFile, `${JSON.stringify(registro)}\n`);
}

function registrarAvaliacao(auditFile, aval, ligado) {
  const compacto = (terrenos) => terrenos.map((t) => ({
    terreno: t.terreno,
    estado: t.estado,
    n: t.n,
    ok1_pct: t.ok1_pct,
    proposta: t.proposta,
    motivo: t.motivo,
  }));
  registrarAudit(auditFile, {
    ts: agoraIso(),
    acao: 'avaliou',
    ligado,
    dias: aval.dias,
    terrenos: compacto(aval.terrenos),
  });
}

// Amostra carimbada de um terreno DESDE um instante (p/ julgar subida aplicada).
// Lê fundo (DIAS_REVISAO) e corta por ts >= desde; só carimbados julgáveis.
function amostraDesde(file, terreno, desdeIso) {
  const desde = Date.parse(desdeIso);
  const linhas = loadJanela(file, DIAS_REVISAO).filter((r) =>
    r.terreno === terreno &&
    r.papel === 'construtor' &&
    r.papel_inferido !== true &&
    Date.parse(r.ts) >= desde &&
    julgavel(r) &&
    !terrenoAmbiguo(r));
  const n = linhas.length;
  const ok1 = linhas.filter((r) => r.resultado === 'ok1').length;
  return { n, ok1_pct: n ? ok1 / n : null };
}

// Desfaz a subida mais recente NÃO-revertida de cada terreno se a amostra
// pós-subida não confirmou ganho. Muta `defaults` in-place; grava a reversão no
// audit e devolve a lista feita.
function revisarReversao(defaults, file, auditFile) {
  const audit = lerAudit(auditFile);
  const revertidos = [];
  for (const [terreno, cfg] of Object.entries(defaults.terrenos)) {
    const subidas = audit.filter((a) => a.terreno === terreno && a.acao === 'subiu' &&
      ['canonica', 'claude'].includes(a.rota || 'claude'));
    if (!subidas.length) continue;
    const ultima = subidas[subidas.length - 1];
    const jaEncerrada = audit.some((a) => a.terreno === terreno &&
      (a.acao === 'reverteu' || a.acao === 'reversao_ignorada') &&
      ['canonica', 'claude'].includes(a.rota || 'claude') &&
      Date.parse(a.ts) > Date.parse(ultima.ts));
    if (jaEncerrada) continue;

    const amostra = amostraDesde(file, terreno, ultima.ts);
    if (amostra.n < N_MIN) continue;           // sem amostra pós-subida: aguarda
    const ganho = amostra.ok1_pct * 100 - ultima.ok1_antes_pts;
    if (ganho > GANHO_MIN_CONFIRMA) continue;  // segurou: mantém

    const campo = ultima.tipo === 'modelo' ? 'modelo' : 'effort';
    if (cfg[campo] !== ultima.para) {
      registrarAudit(auditFile, {
        ts: agoraIso(), rota: 'canonica', terreno, acao: 'reversao_ignorada', tipo: ultima.tipo,
        esperado: ultima.para, atual: cfg[campo], ref_subida_ts: ultima.ts,
        motivo: 'configuração mudou depois da subida; preservada para não sobrescrever ajuste manual',
      });
      continue;
    }
    cfg[campo] = ultima.de;                      // volta pro degrau de origem
    if (ultima.tipo === 'modelo' && cfg.effort_por_modelo?.[ultima.de]) {
      cfg.effort = cfg.effort_por_modelo[ultima.de];
    } else if (ultima.tipo === 'effort' && cfg.effort_por_modelo) {
      cfg.effort_por_modelo[cfg.modelo] = ultima.de;
    }
    cfg.atualizado_em = hojeData();
    cfg.motivo = `revertido: ${ultima.tipo} ${ultima.para}→${ultima.de} — subida não ` +
      `confirmou (ok1 pós ${pct(amostra.ok1_pct)} vs ${ultima.ok1_antes_pts}% antes, n=${amostra.n})`;
    const reg = { ts: agoraIso(), rota: 'canonica', terreno, acao: 'reverteu', tipo: ultima.tipo,
      de: ultima.para, para: ultima.de,
      ok1_pos_pts: +(amostra.ok1_pct * 100).toFixed(1), n_pos: amostra.n,
      motivo: cfg.motivo, ref_subida_ts: ultima.ts };
    registrarAudit(auditFile, reg);
    revertidos.push(reg);
  }
  return revertidos;
}

// Trava anti-vaivém: um degrau recém-revertido não re-sobe por ANTITHRASH_DIAS.
function travadoAntiVaivem(audit, terreno, prop) {
  const limite = Date.now() - ANTITHRASH_DIAS * 864e5;
  return audit.some((a) => a.terreno === terreno && a.acao === 'reverteu' &&
    ['canonica', 'claude'].includes(a.rota || 'claude') &&
    a.tipo === prop.tipo && a.de === prop.para && a.para === prop.de &&
    Date.parse(a.ts) >= limite);
}

// Muta cfg para o degrau proposto; devolve o registro (SEM gravar — o chamador
// enriquece com ok1_antes e grava). null = barrado pela trava de dinheiro.
function aplicarSubida(cfg, terreno, prop) {
  const campo = prop.tipo === 'modelo' ? 'modelo' : 'effort';
  if (prop.tipo === 'modelo' && !modeloPermitido(cfg, prop.para)) return null;
  const de = cfg[campo];
  cfg[campo] = prop.para;
  // Modelo e effort são um par. Trocar o modelo sem carregar o effort que foi
  // calibrado para ele recria a rota implícita que o harness passou a barrar.
  // Se a subida é de effort, a tabela canônica acompanha a nova calibração.
  let effortAssociado = null;
  if (prop.tipo === 'modelo' && cfg.effort_por_modelo?.[prop.para]) {
    cfg.effort = cfg.effort_por_modelo[prop.para];
    effortAssociado = cfg.effort;
  } else if (prop.tipo === 'effort' && cfg.effort_por_modelo) {
    cfg.effort_por_modelo[cfg.modelo] = prop.para;
  }
  cfg.atualizado_em = hojeData();
  cfg.motivo = `auto-subiu: ${prop.tipo} ${de}→${prop.para} · ${prop.fonte} · valor ${num(prop.valor)}`;
  return { ts: agoraIso(), rota: 'canonica', terreno, acao: 'subiu', tipo: prop.tipo, de, para: prop.para,
    effort_associado: effortAssociado,
    valor: prop.valor, ganho_pts: prop.ganho_pts, custo: prop.custo, fonte: prop.fonte,
    motivo: cfg.motivo };
}

export async function aplicar({ dias = 7, file = LEDGER_FILE,
  defaultsFile = DEFAULTS_FILE, auditFile = AUDIT_FILE } = {}) {
  const defaults = lerDefaults(defaultsFile);
  if (defaults._meta?.governanca === 'experimentos-v1') {
    const result = autorregular({defaultsFile,auditFile,linhas:loadJanela(file,90),
      sessoes:await coletarTokensPorSessaoCodex({dias:90}),aplicar:true});
    return {ligado:result.habilitada,aplicado:result.mudancas || [],revertido:[],
      sinais:[result.motivo],motivo:result.motivo};
  }
  const ligado = autoSubirOn() && defaults._meta?.auto_aplicar === true;
  const aval = await avaliar({ dias, file, defaultsFile });
  registrarAvaliacao(auditFile, aval, ligado);

  if (!ligado) {
    return { ligado: false, aplicado: [], revertido: [],
      motivo: `toggle OFF (AUTO_SUBIR_ON=${autoSubirOn()}, auto_aplicar=${defaults._meta?.auto_aplicar}) — nada escrito`,
      propostas_seriam: [
        ...aval.propostas.map((p) => ({ terreno: p.terreno, ...p.proposta })),
      ],
      sinais: aval.sinais };
  }

  // 1) reversões primeiro (desfaz o que não segurou antes de subir de novo)
  const revertido = revisarReversao(defaults, file, auditFile);
  const auditPos = lerAudit(auditFile); // já com as reversões desta passada

  // 2) subidas
  const aplicado = [];
  for (const p of aval.propostas) {
    if (revertido.some((r) => r.terreno === p.terreno)) continue;      // acabou de reverter
    if (travadoAntiVaivem(auditPos, p.terreno, p.proposta)) continue;  // anti-vaivém
    const cfg = defaults.terrenos[p.terreno];
    const reg = aplicarSubida(cfg, p.terreno, p.proposta);
    if (!reg) continue;                                                // barrado (dinheiro)
    reg.ok1_antes_pts = +((p.ok1_pct ?? 0) * 100).toFixed(1);
    reg.n_antes = p.n;
    reg.gap_antes = p.gap;
    registrarAudit(auditFile, reg);
    aplicado.push(reg);
  }

  if (revertido.length || aplicado.length) {
    defaults._meta.atualizado_em = hojeData();
    escreverDefaults(defaults, defaultsFile);
  }
  return { ligado: true, aplicado, revertido, sinais: aval.sinais };
}

const executadoDiretamente = process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (executadoDiretamente) {
  const i = process.argv.indexOf('--dias');
  const dias = i === -1 ? 7 : Number(process.argv[i + 1]) || 7;
  const jf = (k) => { const p = process.argv.indexOf(k); return p === -1 ? undefined : process.argv[p + 1]; };
  const opts = { dias, file: jf('--ledger'), defaultsFile: jf('--defaults'), auditFile: jf('--audit') };
  for (const k of Object.keys(opts)) if (opts[k] === undefined) delete opts[k];

  if (process.argv.includes('aplicar')) {
    aplicar(opts)
      .then((r) => {
        if (!r.ligado) {
          process.stdout.write(`⏸  ${r.motivo}\n`);
          if (r.propostas_seriam?.length) {
            process.stdout.write('   FARIA:\n');
            for (const p of r.propostas_seriam) {
                process.stdout.write(`     ${p.terreno}: ${p.tipo} ${p.de}→${p.para} (valor ${num(p.valor)})\n`);
            }
          } else {
            process.stdout.write('   (nenhuma subida proposta na janela)\n');
          }
          return;
        }
        process.stdout.write(`✅ motor LIGADO — ${r.aplicado.length} subida(s)/` +
          `${r.revertido.length} reversão(ões)\n`);
        for (const a of r.revertido) {
          process.stdout.write(`   🔻 ${a.terreno}: ${a.tipo} ${a.de}→${a.para} — ${a.motivo}\n`);
        }
        for (const a of r.aplicado) {
          process.stdout.write(`   🔺 ${a.terreno}: ${a.tipo} ${a.de}→${a.para} (valor ${num(a.valor)}, ${a.fonte})\n`);
        }
      })
      .catch((erro) => { process.stderr.write(`${erro.message}\n`); process.exitCode = 1; });
  } else avaliar(opts)
    .then((r) => {
      if (process.argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
        return;
      }
      process.stdout.write(`${linhasParaEmail(r).join('\n')}\n`);
      if (r.propostas.length) {
        process.stdout.write('\nPROPOSTAS:\n');
        for (const p of r.propostas) {
          const d = p.proposta;
          process.stdout.write(
            `  ${p.terreno}: ${d.tipo} ${d.de}→${d.para} ` +
            `(ganho ~${num(d.ganho_pts)}pt, custo ${num(d.custo)}, valor ${num(d.valor)})\n`,
          );
        }
      }
    })
    .catch((erro) => {
      process.stderr.write(`${erro.message}\n`);
      process.exitCode = 1;
    });
}
