#!/usr/bin/env node
/**
 * Ledger de despachos do harness multi-LLM (Codex/Claude) + KPIs.
 *
 * O cérebro registra CADA despacho revisado; o report agrega e avalia os
 * limiares pré-definidos de subir/descer degrau (espelhados na seção de
 * governança do ~/.claude/CLAUDE.md — mudar lá = mudar aqui).
 *
 * Uso:
 *   node ledger.mjs log --frente codex --modelo gpt-5.6-terra --effort medium \
 *        --terreno rotina --papel construtor --resultado ok1 \
 *        --tarefa "fix filtro despesca" [--nota ...]
 *   node ledger.mjs log --frente claude --modelo claude-opus-5 --effort high \
 *        --terreno ui --papel revisor --modelo-autor gpt-5.6-sol \
 *        --resultado ok1 --tarefa "revisão da tela"
 *   node ledger.mjs log-rapido --modelo gpt-5.6-luna --effort max \
 *        --terreno rotina --papel construtor --resultado ok1
 *        (atalho: frente inferida pelo modelo, tarefa opcional)
 *   node ledger.mjs fechar --resultado ok1 [--id pXXX] [--nota ...] [--dur 25]
 *        (fecha um registro provisório "pendente" gravado pelos run.sh dos
 *         workers; sem --id fecha o pendente mais antigo)
 *   node ledger.mjs pendentes                # lista provisórios em aberto
 *   node ledger.mjs report [--dias 7] [--file <path>]
 *   node ledger.mjs snapshot [--dias 7]   # grava KPIs da janela no histórico
 *   node ledger.mjs history [--n 12]      # evolução dos KPIs no tempo
 *   node ledger.mjs subagentes [--dias 7] # fan-out observado pelos hooks Codex
 *
 * Campos:
 *   frente:    codex | claude | cerebro
 *   terreno:   ui | rotina | dificil | mecanico | sql
 *   resultado: ok1        (aceito na 1ª revisão)
 *              retrabalho (aceito após correções no MESMO degrau)
 *              escalado   (falhou → subiu de degrau; loga-se o degrau que falhou)
 *              falhou     (abandonado/refeito pelo cérebro — o worker RODOU e
 *                          entregou coisa ruim; é sinal de qualidade do degrau)
 *              infra      (o worker NUNCA rodou: crash de invocação, flag
 *                          errada, processo travado antes de começar. Não diz
 *                          nada sobre o modelo — é bug do lançador. Fica FORA
 *                          dos denominadores de ok1% e reciclo%, mas aparece
 *                          como contagem própria: pico de `infra` = consertar
 *                          o run.sh/despacho, nunca trocar de modelo.)
 *              descartado (o worker RODOU e pode ter entregue BEM, mas o
 *                          resultado foi jogado fora por motivo alheio ao
 *                          degrau: item já estava pronto, duas trilhas
 *                          construíram o mesmo, escopo consolidado em outro
 *                          item. NÃO é qualidade do modelo — é orquestração.
 *                          Fica FORA dos denominadores; pico de `descartado` =
 *                          consertar lease/reivindicação, nunca trocar modelo.)
 *              quota      (despacho barrado por limite → foi pra frente vizinha)
 *              pendente   (provisório: gravado AUTOMATICAMENTE pelos run.sh dos
 *                          workers ao fim da execução, antes da revisão do
 *                          cérebro; fica FORA de todos os KPIs até ser fechado
 *                          com `ledger.mjs fechar`. Carrega `id` e `auto:true`.)
 *   preparo_min: minutos gastos escrevendo o enunciado ANTES do despacho.
 *              Preenchido sozinho pelos run.sh a partir do carimbo automático
 *              de ~/.claude/hooks/marco-preparo.sh — não há comando a lembrar.
 *              null = não deu para medir (nunca estimado).
 */
import { appendFileSync, existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { normModelo, inferirFrente } from './modelos.mjs';
import {
  HARNESS_METRIC_VERSION,
  MIN_AMOSTRA_DECISAO,
  filtrarHistoricoCompativel,
} from './metricas-snapshot.mjs';

const DEFAULT_FILE = process.env.HARNESS_LEDGER_FILE || join(homedir(), '.claude', 'orquestracao', 'ledger.jsonl');
const HISTORY_FILE = join(homedir(), '.claude', 'orquestracao', 'kpi-history.jsonl');
const DEFAULT_SUBAGENT_FILE = join(homedir(), '.claude', 'orquestracao', 'subagentes.jsonl');
const ESPERA_LOCK = new Int32Array(new SharedArrayBuffer(4));

// Limiares (espelho da governança no CLAUDE.md global)
const MIN_N = MIN_AMOSTRA_DECISAO; // uma única amostra mínima p/ qualquer decisão de qualidade
const OK1_PISO = 0.70;      // abaixo → degrau subdimensionado
const OK1_TETO = 0.90;      // acima (n>=20, degrau não-mínimo) → candidato a descer
const QUOTA_ALERTA = 3;     // eventos de quota na janela → frente saturada
const MUDO_DIAS = 3;        // sem registro há N dias → instrumento mudo
const AMBIGUO_MAX = 0.30;   // acima disso o balde não mede terreno — sem sinal

// Os run.sh gravam um terreno DEFAULT quando LEDGER_TERRENO não vem (`rotina`
// no codex). Um balde assim mistura o terreno real com tudo que
// o cérebro esqueceu de classificar, e o ok1 dele deixa de medir o degrau.
//
// CORTE (corrigido 14/08/2026): o carimbo `--terreno-inferido` entrou nos dois
// run.sh às 2026-08-13T21:42Z — momento provado pelo transcript da sessão que
// aplicou o Edit, não pelo mtime do arquivo (o mtime de 14/08 11:10 é a
// reescrita do preparo_min, mudança sem relação). O valor anterior
// (2026-08-13T17:00Z) tratava como "classificadas" ~4h45 de linhas que ainda
// nasciam sem marca nenhuma.
const INSTRUMENTACAO_TERRENO = Date.parse('2026-08-13T21:42:23Z');
// Referência (não mais usada na decisão): o terreno que cada run.sh grava
// quando LEDGER_TERRENO não vem. O guard deixou de olhar SÓ estes baldes em
// 14/08/2026 — a assimetria era o buraco. Fica documentado porque é o valor
// que o cérebro precisa saber para conferir um registro à mão.
const DEFAULT_DO_RUNSH = { codex: 'rotina' }; // eslint-disable-line no-unused-vars
void DEFAULT_DO_RUNSH;

// Um registro é CLASSIFICADO só quando há prova de que o terreno foi declarado
// NO DESPACHO, via LEDGER_TERRENO. Isso acontece em um caso e só nele: despacho
// automático DEPOIS do corte e SEM a marca `terreno_inferido` — o run.sh já
// carimbava, então a ausência da marca prova que a variável veio preenchida.
// Todo o resto é ambíguo, inclusive o log manual do cérebro.
//
// POR QUE O LOG MANUAL TAMBÉM NÃO VALE (o buraco corrigido em 14/08/2026): o
// guard antigo só olhava o balde DEFAULT do run.sh (`rotina`/`ui`), então o
// mesmo ruído passava pelo avesso — o terreno digitado à mão DEPOIS do trabalho
// é rótulo, não classificação, e foi por aí que leitura barata ("estado da aba
// Despescas para prompt", "inventário e reconciliação", "evolução do runbook")
// entrou no balde `dificil`. Os 5 registros baratos que inflaram esse balde são
// TODOS log manual; nenhum é automático.
//
// A prova de que o sinal era lixo: em 14 d o report mandava SUBIR em
// Sol/xhigh × dificil (67%) e DESCER em Sol/high × dificil (94%) — effort MAIOR
// performando pior no MESMO terreno é impossível por effort e natural por
// seleção de amostra.
//
// Efeito prático: enquanto o ledger não acumular amostra carimbada, NENHUM
// 🔺/🔻 sai. É o estado honesto — a instrumentação nasceu em 13/08/2026.
// Efforts que EXISTEM. Sem esta lista, `--effort` aceitava qualquer coisa: em
// 23-24/08 três linhas do fallback do cérebro entraram com o MANUAL inteiro
// (4.720 caracteres) no campo, e cada uma virou um "degrau" fantasma que
// despejava ~110 linhas de markdown no meio da tabela do report — e entrava
// como amostra no motor de tier.
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

// Resultados que NÃO medem o degrau: o worker não rodou (`infra`), foi barrado
// (`quota`), ainda não foi julgado (`pendente`) ou rodou e teve o resultado
// jogado fora por decisão de orquestração (`descartado`). Todos ficam fora dos
// denominadores de ok1%/reciclo% — misturá-los culpa o modelo por bug de fila.
export const FORA_DO_DENOMINADOR = new Set(['quota', 'infra', 'descartado', 'pendente']);
export const julgavel = (r) => !FORA_DO_DENOMINADOR.has(r.resultado);

export function validarMetadadosExperimento({
  experimentId, arm, experimentVersion, configVersion,
} = {}) {
  const valores = { experimentId, arm, experimentVersion, configVersion };
  for (const [nome, valor] of Object.entries(valores)) {
    if (valor != null && (String(valor).trim() === '' || String(valor).length > 256)) {
      return { ok: false, motivo: `${nome} vazio ou longo demais` };
    }
  }
  const algumExperimento = experimentId != null || arm != null || experimentVersion != null;
  if (algumExperimento && (!experimentId || !arm || !experimentVersion || !configVersion)) {
    return {
      ok: false,
      motivo: 'experiment_id, arm, experiment_version e config_version devem vir juntos',
    };
  }
  return { ok: true };
}

export function validarEffort(bruto, ondeErro) {
  if (bruto == null || bruto === '') return null;
  const v = String(bruto).trim();
  if (EFFORTS.includes(v)) return v;
  const amostra = v.replace(/\s+/g, ' ').slice(0, 40);
  console.error(`effort inválido em ${ondeErro}: "${amostra}${v.length > 40 ? '…' : ''}" (${v.length} chars). Use ${EFFORTS.join('|')} — ou omita.`);
  process.exit(2);
}

// Família sem versão para a invariante "quem escreve não aprova". Duas
// sessões do mesmo modelo continuam carregando os mesmos vieses; contexto
// fresco é útil, mas não satisfaz a revisão cruzada pedida pelo dono.
export function familiaModelo(modelo) {
  const m = normModelo(modelo).toLowerCase();
  for (const familia of ['luna', 'terra', 'sol', 'opus', 'sonnet', 'haiku', 'fable']) {
    if (m.includes(familia)) return familia;
  }
  return m;
}

export function validarRevisaoCruzada({
  papel, modelo, modeloAutor, fallbackProprio = false,
}) {
  if (papel !== 'revisor') return { ok: true, cruzada: null };
  if (!modeloAutor) {
    return { ok: false, motivo: 'revisão sem --modelo-autor; não há prova de que outro LLM revisou' };
  }
  const autor = familiaModelo(modeloAutor);
  const revisor = familiaModelo(modelo);
  if (!autor || !revisor) {
    return { ok: false, motivo: `revisor '${revisor || 'ausente'}' não pode aprovar autor '${autor || 'ausente'}'` };
  }
  if (autor === revisor && !fallbackProprio) {
    return { ok: false, motivo: `revisor '${revisor}' não pode aprovar autor '${autor}' sem fallback próprio comprovado` };
  }
  if (autor === revisor) {
    return { ok: true, cruzada: false, fallback_proprio: true, autor, revisor };
  }
  return { ok: true, cruzada: true, autor, revisor };
}

export function terrenoAmbiguo(r) {
  if (r.terreno_inferido) return true;   // o próprio run.sh admitiu o default
  if (r.classificacao === 'declarada' && r.terreno && r.papel && !r.papel_inferido) return false;
  if (!r.auto) return true;              // rótulo digitado à mão ≠ classificação
  // Sem PAPEL não dá para saber se `retrabalho` foi construtor errando ou
  // revisor reprovando (26/08): o balde continua VISÍVEL, mas não decide tier.
  if (!r.papel) return true;
  // Papel ADIVINHADO por heurística de texto vale o mesmo que papel ausente —
  // em 26/08 um backfill carimbou 308 linhas antigas por casamento de palavra
  // ("revisar", "auditar") e, sem esta linha, o motor de tier voltaria a
  // decidir sobre rótulo sem prova. Mesma doutrina do `terreno_inferido`.
  if (r.papel_inferido) return true;
  return Date.parse(r.ts) < INSTRUMENTACAO_TERRENO; // antes do carimbo: indistinguível
}

// Lê o jsonl inteiro, já com o nome de modelo normalizado (o arquivo bruto
// nunca é reescrito — apelidos antigos viram canônicos só na leitura)
function lerTudo(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean)
    .map((r) => ({ ...r, modelo: normModelo(r.modelo) }));
}

// Banner de instrumento mudo: retorna a string do aviso (ou null se saudável)
export function avisoMudo(file = DEFAULT_FILE) {
  const tudo = lerTudo(file);
  if (!tudo.length) return '⚠️ LEDGER VAZIO — nenhum despacho registrado.';
  const ultimo = tudo.reduce((max, r) => (r.ts > max ? r.ts : max), tudo[0].ts);
  const diasParado = (Date.now() - Date.parse(ultimo)) / 864e5;
  if (diasParado >= MUDO_DIAS) {
    return `⚠️ LEDGER MUDO desde ${ultimo.slice(0, 10)} — números abaixo estão cegos (${Math.floor(diasParado)} dias sem registro).`;
  }
  return null;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[key] = val;
    }
  }
  return args;
}

// Normaliza o --preparo: só número finito e não-negativo vira minuto medido;
// qualquer outra coisa (flag sem valor, lixo, relógio torto) vira null.
function preparoMin(bruto) {
  if (bruto == null) return null;
  const n = parseFloat(bruto);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function numeroNaoNegativo(bruto) {
  if (bruto == null || bruto === '') return null;
  const n = Number(bruto);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function inteiroNaoNegativo(bruto) {
  if (bruto == null) return null;
  const n = Number(bruto);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function lerSubagentes(file = DEFAULT_SUBAGENT_FILE) {
  if (!existsSync(file)) return [];
  const linhas = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
  const vistos = new Set();
  return linhas.filter((e) => {
    const chave = e.event_id || `${e.evento}\0${e.session_id}\0${e.turn_id}\0${e.agent_id}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

function resumoSubagentes(runId, file = DEFAULT_SUBAGENT_FILE) {
  if (!runId) return null;
  const eventos = lerSubagentes(file).filter((e) => e.run_id === runId);
  const inicios = eventos.filter((e) => e.evento === 'SubagentStart');
  const fins = eventos.filter((e) => e.evento === 'SubagentStop');
  const ids = [...new Set(inicios.map((e) => e.agent_id).filter(Boolean))];
  const contagem = (campo) => {
    const out = {};
    for (const e of inicios) {
      const valor = e[campo] || 'desconhecido';
      out[valor] = (out[valor] || 0) + 1;
    }
    return out;
  };
  return {
    iniciados: ids.length || inicios.length,
    concluidos: new Set(fins.map((e) => e.agent_id).filter(Boolean)).size || fins.length,
    perfis: contagem('agent_type'),
    modelos: contagem('model'),
  };
}

// Id do registro provisório. O tempo sozinho NÃO basta: em 13/08/2026 dois
// despachos gravados no mesmo milissegundo receberam o id `pmss3u7gh` — e
// `fechar --id` casa o PRIMEIRO pendente com aquele id, então o segundo só
// fecharia por acaso, e uma correção poderia cair no registro errado. O
// sufixo aleatório (4 hex) separa até despachos simultâneos do mesmo ms.
// Ids ANTIGOS ficam como estão; só os novos ganham o sufixo.
function novoId() {
  return 'p' + Date.now().toString(36) + '-' + randomBytes(2).toString('hex');
}

// `fechar` reescreve o JSONL; sem exclusão mútua, um `log` concorrente pode
// anexar entre o read e o rename e ter sua linha apagada. mkdir é atômico no
// filesystem local. Lock órfão expira em 2 min para uma queda não paralisar o
// instrumento; todo temporário é único e fica no mesmo diretório do destino.
function comLock(file, fn) {
  const lock = `${file}.lock`;
  const limite = Date.now() + 5000;
  while (true) {
    try { mkdirSync(lock, { mode: 0o700 }); break; }
    catch (e) {
      if (e?.code !== 'EEXIST') throw e;
      try {
        if (Date.now() - statSync(lock).mtimeMs > 120000) {
          rmdirSync(lock);
          continue;
        }
      } catch (statError) {
        if (statError?.code !== 'ENOENT') throw statError;
        continue;
      }
      if (Date.now() >= limite) throw new Error(`timeout aguardando lock do ledger: ${lock}`);
      Atomics.wait(ESPERA_LOCK, 0, 0, 25);
    }
  }
  try { return fn(); }
  finally { try { rmdirSync(lock); } catch { /* lock já removido */ } }
}

function cmdLog(args) {
  const obrig = ['frente', 'modelo', 'effort', 'terreno', 'resultado', 'tarefa'];
  const faltam = obrig.filter((k) => !args[k]);
  if (faltam.length) {
    console.error(`faltam campos: ${faltam.join(', ')}`);
    process.exit(2);
  }
  const FRENTES = ['codex', 'claude', 'cerebro'];
  const TERRENOS = ['ui', 'rotina', 'dificil', 'analise', 'mecanico', 'sql'];
  const RESULTADOS = ['ok1', 'retrabalho', 'escalado', 'falhou', 'infra', 'quota', 'descartado', 'pendente'];
  const PAPEIS = ['construtor', 'revisor'];
  if (args.papel && !PAPEIS.includes(args.papel)) { console.error(`papel inválido: ${args.papel} (use construtor|revisor)`); process.exit(2); }
  const revisao = validarRevisaoCruzada({
    papel: args.papel,
    modelo: args.modelo,
    modeloAutor: args['modelo-autor'],
    fallbackProprio: args['fallback-proprio'] === 'true',
  });
  if (!revisao.ok) { console.error(`revisão cruzada inválida: ${revisao.motivo}`); process.exit(2); }
  if (!FRENTES.includes(args.frente)) { console.error(`frente inválida: ${args.frente}`); process.exit(2); }
  if (!TERRENOS.includes(args.terreno)) { console.error(`terreno inválido: ${args.terreno}`); process.exit(2); }
  if (!RESULTADOS.includes(args.resultado)) { console.error(`resultado inválido: ${args.resultado}`); process.exit(2); }
  const experimento = validarMetadadosExperimento({
    experimentId: args['experiment-id'],
    arm: args.arm,
    experimentVersion: args['experiment-version'],
    configVersion: args['config-version'],
  });
  if (!experimento.ok) { console.error(`metadados de experimento inválidos: ${experimento.motivo}`); process.exit(2); }
  const rotaOrigem = args['rota-origem'] || null;
  if (rotaOrigem && !['codex', 'claude'].includes(rotaOrigem)) {
    console.error(`rota-origem inválida: ${rotaOrigem} (use codex|claude)`); process.exit(2);
  }

  const file = args.file || DEFAULT_FILE;
  mkdirSync(dirname(file), { recursive: true });
  const modeloRegistro = args['modelo-log'] || args.modelo;
  const classificacao = args['terreno-inferido'] !== 'true' && args.papel
    ? 'declarada' : null;
  const rec = {
    ts: new Date().toISOString(),
    frente: args.frente,
    rota_origem: rotaOrigem,
    modelo: normModelo(modeloRegistro),
    effort: validarEffort(args.effort, 'log'),
    terreno: args.terreno,
    // PAPEL do degrau nesta linha (2026-08-26). Um REVISOR que reprova é
    // registrado com `retrabalho` — o mesmo rótulo de um CONSTRUTOR que errou.
    // Sem separar, o revisor que faz o trabalho dele aparece como degrau ruim:
    // em 7d, 68 de 114 linhas eram revisão e 24 delas viraram `retrabalho`,
    // derrubando o ok1 de `sol × sql` para 15% e de `sol × ui` para 0%.
    // null = não classificado: fica FORA das duas tabelas e do motor de tier.
    papel: args.papel || null,
    modelo_autor: args.papel === 'revisor' ? normModelo(args['modelo-autor']) : null,
    revisao_cruzada: args.papel === 'revisor' ? revisao.cruzada : null,
    revisao_fallback_proprio: args.papel === 'revisor'
      ? revisao.fallback_proprio === true : null,
    resultado: args.resultado,
    tarefa: args.tarefa,
    nota: args.nota || null,
    fallback_motivo: args['fallback-motivo'] || null,
    roteamento_ok: args['roteamento-ok'] || null,
    // duração em minutos do despacho→aceite (opcional, --dur 25); alimenta
    // o KPI de velocidade (dur mediana) — logue sempre que souber
    dur: numeroNaoNegativo(args.dur),
    // minutos que o cérebro passou ESCREVENDO o enunciado antes de chamar o
    // run.sh (--preparo 3.4). Vem do carimbo automático de
    // ~/.claude/hooks/marco-preparo.sh; os run.sh preenchem sozinhos. Fica
    // null sempre que não deu para medir — nunca é estimado.
    preparo_min: preparoMin(args.preparo),
    tokens: numeroNaoNegativo(args.tokens),
    run_id: args['run-id'] || null,
    session_id: args['session-id'] || null,
    modelo_confirmado: args['modelo-confirmado'] === 'true' && Boolean(args['session-id']),
    experiment_id: args['experiment-id'] || null,
    arm: args.arm || null,
    experiment_version: args['experiment-version'] || null,
    config_version: args['config-version'] || null,
    classificacao,
  };
  if (args.orquestracao) {
    const modos = ['solo', 'fanout'];
    if (!modos.includes(args.orquestracao)) {
      console.error(`orquestracao inválida: ${args.orquestracao} (use solo|fanout)`); process.exit(2);
    }
    rec.orquestracao_planejada = args.orquestracao;
  }
  const planejados = inteiroNaoNegativo(args['subagentes-planejados']);
  if (args['subagentes-planejados'] != null && planejados == null) {
    console.error('subagentes-planejados deve ser inteiro não-negativo'); process.exit(2);
  }
  if (planejados != null) rec.subagentes_planejados = planejados;
  const filhos = resumoSubagentes(rec.run_id, args['subagent-file'] || process.env.HARNESS_SUBAGENT_LOG || DEFAULT_SUBAGENT_FILE);
  if (filhos?.iniciados) {
    rec.orquestracao_real = 'fanout';
    rec.subagentes = filhos;
  } else if (rec.orquestracao_planejada === 'solo') {
    rec.orquestracao_real = 'solo';
    rec.subagentes = filhos;
  } else if (rec.orquestracao_planejada === 'fanout') {
    rec.orquestracao_real = 'fanout_nao_observado';
    rec.subagentes = filhos;
  } else {
    rec.orquestracao_real = 'desconhecido';
  }
  // registro provisório (auto dos run.sh): ganha id p/ o `fechar` achar depois
  if (rec.resultado === 'pendente') rec.id = args.id || novoId();
  if (args.auto === 'true') rec.auto = true;
  // terreno veio do default do run.sh, não de uma escolha do cérebro
  if (args['terreno-inferido'] === 'true') rec.terreno_inferido = true;
  // Turno do CÉREBRO de um loop não é DESPACHO: ninguém revisa, ninguém fecha.
  // Quando o cérebro cai para o Codex (auth do Claude indisponível), o run.sh
  // loga uma linha por turno — foram 961 em 6 dias, e elas escondiam os 3
  // pendentes de verdade atrás de um alarme falso. Vão para arquivo próprio:
  // continuam auditáveis, ficam fora do `pendentes` e dos KPIs de despacho.
  const ruidoCerebro = rec.auto === true && rec.resultado === 'pendente'
    && /^cerebro-[a-z]+\b/.test(rec.tarefa || '');
  const alvo = ruidoCerebro
    ? file.replace(/ledger\.jsonl$/, 'ledger-cerebro-fallback.jsonl')
    : file;
  comLock(alvo, () => appendFileSync(alvo, JSON.stringify(rec) + '\n'));
  if (ruidoCerebro) {
    console.log(`registrado (turno de cérebro, fora do ledger de despachos): ${rec.tarefa}`);
    return;
  }
  if (!rec.papel) {
    console.error('⚠ --papel não setado — linha FORA das tabelas de qualidade e do motor de tier. Use --papel construtor (quem escreve) ou --papel revisor (quem julga).');
  }
  console.log(`registrado: [${rec.frente}/${rec.modelo}${rec.effort ? '/' + rec.effort : ''}] ${rec.terreno} → ${rec.resultado}${rec.id ? ` (id ${rec.id} — feche após a revisão: ledger.mjs fechar --resultado ok1 --id ${rec.id})` : ''}`);
}

function cmdValidarRevisao(args) {
  if (args.papel !== 'revisor') {
    console.error('validar-revisao exige --papel revisor');
    process.exit(2);
  }
  const revisao = validarRevisaoCruzada({
    papel: args.papel,
    modelo: args.modelo,
    modeloAutor: args['modelo-autor'],
    fallbackProprio: args['fallback-proprio'] === 'true',
  });
  if (!revisao.ok) {
    console.error(`revisão cruzada inválida: ${revisao.motivo}`);
    process.exit(2);
  }
  console.log(revisao.fallback_proprio
    ? `fallback próprio válido: ${revisao.autor} → ${revisao.revisor}`
    : `revisão cruzada válida: ${revisao.autor} → ${revisao.revisor}`);
}

// Fecha um registro provisório: reescreve SÓ a linha do pendente alvo com o
// resultado da revisão (demais linhas preservadas byte a byte; escrita
// atômica via arquivo temporário + rename).
function cmdFechar(args) {
  const RESULTADOS = ['ok1', 'retrabalho', 'escalado', 'falhou', 'infra', 'quota', 'descartado'];
  if (!args.resultado || !RESULTADOS.includes(args.resultado)) {
    console.error(`--resultado obrigatório (${RESULTADOS.join('|')})`); process.exit(2);
  }
  const file = args.file || DEFAULT_FILE;
  if (!existsSync(file)) { console.error(`sem ledger em ${file}`); process.exit(2); }
  const TERRENOS = ['ui', 'rotina', 'dificil', 'analise', 'mecanico', 'sql'];
  if (args.terreno && !TERRENOS.includes(args.terreno)) {
    console.error(`terreno inválido: ${args.terreno}`); process.exit(2);
  }
  const PAPEIS = ['construtor', 'revisor'];
  if (args.papel && !PAPEIS.includes(args.papel)) {
    console.error(`papel inválido: ${args.papel} (use construtor|revisor)`); process.exit(2);
  }
  let rec;
  try {
    rec = comLock(file, () => {
      const brutas = readFileSync(file, 'utf8').split('\n');
      let idx = -1; let alvo = null;
      for (let i = 0; i < brutas.length; i++) {
        let r; try { r = JSON.parse(brutas[i]); } catch { continue; }
        if (!r || r.resultado !== 'pendente') continue;
        if (args.id ? r.id === args.id : idx === -1) { idx = i; alvo = r; if (args.id) break; }
      }
      if (idx === -1) throw new Error(args.id ? `pendente com id ${args.id} não encontrado` : 'nenhum pendente em aberto');
      alvo.resultado = args.resultado;
      alvo.ts_fechado = new Date().toISOString();
      if (args.nota) alvo.nota = alvo.nota ? `${alvo.nota} · ${args.nota}` : args.nota;
      if (args.dur) alvo.dur = parseFloat(args.dur);
      // O run.sh grava o pendente ANTES de saber o papel em alguns fluxos;
      // quem fecha (o cérebro, após a revisão) é quem sabe. Fechar sem papel
      // deixa a linha fora das tabelas — de propósito.
      if (args.papel) {
        alvo.papel = args.papel;
        // carimbar no fechamento é ESCOLHA do cérebro: deixa de ser chute do
        // backfill heurístico (mesma regra do `terreno_inferido` acima).
        delete alvo.papel_inferido;
        delete alvo.papel_metodo;
      }
      if (args.terreno) { // corrige o terreno chutado pelo run.sh, se preciso
        alvo.terreno = args.terreno;
        // classificar no fechamento é uma escolha do cérebro: deixa de ser default
        delete alvo.terreno_inferido;
      }
      brutas[idx] = JSON.stringify(alvo);
      const tmp = `${file}.tmp.${process.pid}.${randomBytes(4).toString('hex')}`;
      writeFileSync(tmp, brutas.join('\n'));
      renameSync(tmp, file);
      return alvo;
    });
  } catch (e) {
    console.error(e.message); process.exit(2);
  }
  if (!rec.papel) {
    console.error('⚠ linha fechada SEM papel — fica fora das tabelas de qualidade e do motor de tier. Refaça com --papel construtor|revisor.');
  }
  console.log(`fechado ${rec.id || '(sem id)'}: [${rec.frente}/${rec.modelo}] ${rec.terreno}${rec.papel ? '/' + rec.papel : ''} → ${rec.resultado} — "${rec.tarefa}"`);
}

function cmdPendentes(args) {
  const file = args.file || DEFAULT_FILE;
  const abertos = lerTudo(file).filter((r) => r.resultado === 'pendente');
  if (!abertos.length) { console.log('nenhum pendente em aberto.'); return; }
  console.log(`${abertos.length} pendente(s) de revisão:`);
  const agora = Date.now();
  let velhos = 0;
  for (const r of abertos) {
    const horas = (agora - Date.parse(r.ts)) / 36e5;
    // Pendente nunca fechado some dos KPIs para sempre: em 26/08 o mais velho
    // estava aberto havia 7 dias e ninguém tinha visto. 48h = 2 rodadas de
    // revisão; acima disso o despacho ou morreu ou foi esquecido.
    const marca = horas > 48 ? ` ⏰ ${Math.floor(horas / 24)}d SEM FECHAR` : '';
    if (horas > 48) velhos++;
    console.log(`  ${r.id || '(sem id)'}  ${r.ts.slice(0, 16)}  [${r.frente}/${r.modelo}] ${r.terreno} — ${r.tarefa}${marca}`);
  }
  if (velhos) console.log(`\n⏰ ${velhos} pendente(s) há MAIS DE 48h — decida (ok1/retrabalho/falhou) ou marque \`infra\` se o worker nunca rodou. Enquanto abertos, não entram em nenhum KPI.`);
  console.log('\nfeche com: ledger.mjs fechar --resultado ok1|retrabalho|escalado|falhou --papel construtor|revisor --id <id>');
}

function cmdSubagentes(args) {
  const dias = parseInt(args.dias || '7', 10);
  const corte = Date.now() - dias * 864e5;
  const eventos = lerSubagentes(args.file || process.env.HARNESS_SUBAGENT_LOG || DEFAULT_SUBAGENT_FILE)
    .filter((e) => Date.parse(e.ts) >= corte);
  const inicios = eventos.filter((e) => e.evento === 'SubagentStart');
  const fins = eventos.filter((e) => e.evento === 'SubagentStop');
  const sessoes = new Set(inicios.map((e) => e.session_id).filter(Boolean));
  const runs = new Set(inicios.map((e) => e.run_id).filter(Boolean));
  const perfis = {};
  const modelos = {};
  for (const e of inicios) {
    const perfil = e.agent_type || 'desconhecido';
    const modelo = e.model || 'desconhecido';
    perfis[perfil] = (perfis[perfil] || 0) + 1;
    modelos[modelo] = (modelos[modelo] || 0) + 1;
  }
  console.log(`# Subagentes Codex — últimos ${dias}d`);
  console.log(`iniciados ${inicios.length} · concluídos ${fins.length} · sessões-pai ${sessoes.size} · runs do wrapper ${runs.size}`);
  console.log(`perfis: ${Object.entries(perfis).map(([k, v]) => `${k}:${v}`).join(' ') || '—'}`);
  console.log(`modelos: ${Object.entries(modelos).map(([k, v]) => `${k}:${v}`).join(' ') || '—'}`);
  const semRun = inicios.filter((e) => !e.run_id).length;
  if (semRun) console.log(`nativos da app/fora do wrapper: ${semRun}`);
}

function pct(x) { return x == null ? '—' : (100 * x).toFixed(0) + '%'; }

function cmdReport(args) {
  const file = args.file || DEFAULT_FILE;
  const dias = parseInt(args.dias || '7', 10);
  if (!existsSync(file)) { console.log(`sem ledger em ${file} — nada a reportar.`); return; }
  const mudo = avisoMudo(file);
  if (mudo) console.log(`${mudo}\n`);
  const corte = Date.now() - dias * 864e5;
  const janela = lerTudo(file).filter((r) => Date.parse(r.ts) >= corte);
  // provisórios (auto dos run.sh, ainda sem revisão) ficam FORA dos números
  const pendentes = janela.filter((r) => r.resultado === 'pendente');
  const fechadas = janela.filter((r) => r.resultado !== 'pendente');
  if (pendentes.length) {
    const velhos = pendentes.filter((r) => (Date.now() - Date.parse(r.ts)) / 36e5 > 48).length;
    console.log(`⏳ ${pendentes.length} despacho(s) pendente(s) de revisão (fora dos números abaixo)${velhos ? ` — ⏰ ${velhos} há MAIS DE 48h` : ''} — veja \`ledger.mjs pendentes\` e feche com \`ledger.mjs fechar\`.\n`);
  }
  if (!fechadas.length) { console.log(`0 despachos revisados nos últimos ${dias}d.`); return; }

  // Separação por PAPEL (2026-08-26). `retrabalho` num REVISOR significa "o
  // revisor reprovou o artefato" — o revisor fez o trabalho dele. Misturado
  // com o construtor que errou, o degrau bom vira degrau ruim: `sol × sql`
  // aparecia com ok1 15% sendo que as 13 linhas eram revisão somente-leitura.
  // Linha sem papel não vai para NENHUMA tabela de qualidade: rótulo sem prova
  // não mede degrau (mesma doutrina do terreno inferido).
  const revisoes = fechadas.filter((r) =>
    r.papel === 'revisor' && r.papel_inferido !== true);
  const semPapel = fechadas.filter((r) =>
    !r.papel || r.papel_inferido === true);
  // Qualidade só usa papel explicitamente carimbado. Papel ausente/inferido
  // continua contado na saúde do instrumento, mas não entra em denominador.
  const construcao = fechadas.filter((r) =>
    r.papel === 'construtor' && r.papel_inferido !== true);
  const linhas = construcao;

  console.log(`# KPIs de orquestração — últimos ${dias}d (${fechadas.length} despachos: ${construcao.length} construção · ${revisoes.length} revisão · ${semPapel.length} sem papel)\n`);

  if (revisoes.length) {
    const reprovou = revisoes.filter((r) => r.resultado === 'retrabalho' || r.resultado === 'escalado').length;
    const julgRev = revisoes.filter(julgavel).length;
    console.log(`## Revisão (${revisoes.length}) — NÃO entra no ok1 de construção`);
    console.log(`reprovou/mandou refazer: ${reprovou}/${julgRev} (${pct(julgRev ? reprovou / julgRev : null)}) — taxa ALTA aqui é revisor funcionando, não degrau ruim.\n`);
  }
  if (semPapel.length) {
    console.log(`⚠️ ${semPapel.length} linha(s) com papel AUSENTE ou INFERIDO — fora das tabelas e do motor de tier. Carimbe \`--papel construtor|revisor\` em todo log/fechamento.\n`);
  }
  if (!linhas.length) {
    console.log(`Só houve REVISÃO nos últimos ${dias}d — nada a medir sobre degrau de construção.`);
    return;
  }
  console.log(`## Construção explicitamente carimbada (${linhas.length})\n`);

  // Agregação por degrau (frente/modelo/effort) × terreno
  const porDegrau = new Map();
  for (const r of linhas) {
    const degrau = `${r.frente}/${r.modelo}${r.effort ? '/' + r.effort : ''}`;
    const k = `${degrau} × ${r.terreno}`;
    if (!porDegrau.has(k)) porDegrau.set(k, { degrau, terreno: r.terreno, n: 0, ok1: 0, retrabalho: 0, escalado: 0, falhou: 0, infra: 0, quota: 0, descartado: 0, ambiguos: 0 });
    const a = porDegrau.get(k);
    a.n++; a[r.resultado]++;
    // só conta ambiguidade no que ENTRA no denominador de qualidade: quota e
    // infra já saem de lá, e contá-los aqui fazia o "classificados" ficar
    // negativo (uma rota externa de UI acumulou mais ambíguos que julgáveis).
    if (julgavel(r) && terrenoAmbiguo(r)) a.ambiguos++;
  }

  console.log('degrau × terreno                                    n   ok1  retrab esc  falh infra quota desc');
  for (const a of [...porDegrau.values()].sort((x, y) => y.n - x.n)) {
    const nome = `${a.degrau} × ${a.terreno}`.padEnd(50);
    // ok1 sobre os JULGÁVEIS (fora quota e infra) — o mesmo denominador que os
    // SINAIS abaixo usam. Antes a coluna dividia por `n` cru e discordava do
    // sinal na mesma linha.
    const julg = a.n - a.quota - a.infra - a.descartado;
    console.log(`${nome} ${String(a.n).padStart(3)}  ${pct(julg ? a.ok1 / julg : null).padStart(4)} ${String(a.retrabalho).padStart(5)} ${String(a.escalado).padStart(4)} ${String(a.falhou).padStart(4)} ${String(a.infra).padStart(5)} ${String(a.quota).padStart(4)} ${String(a.descartado).padStart(4)}`);
  }
  console.log('(ok1 = aceito na 1ª revisão ÷ julgáveis; `infra` = worker nunca rodou, `quota` = barrado, `desc` = rodou mas o resultado foi jogado fora por orquestração — os três ficam fora do denominador, como `pendente`.)');
  const ork = calcKpis(linhas).orquestracao;
  console.log(`orquestração dos pais: fan-out ${ork.fanout} · solo ${ork.solo} · sem telemetria antiga ${ork.desconhecido} · filhos observados ${ork.subagentes_total}`);
  if (ork.fanout_nao_observado) console.log(`⚠️ ${ork.fanout_nao_observado} pai(s) declararam fan-out, mas nenhum SubagentStart foi observado.`);

  // Sinais contra os limiares
  console.log('\n## SINAIS (limiares pré-definidos)');
  let sinais = 0;
  for (const a of porDegrau.values()) {
    // quota (barrado por limite) e infra (o worker nunca rodou) não julgam a
    // qualidade do degrau — ficam fora do denominador, como `pendente`.
    const julgaveis = a.n - a.quota - a.infra - a.descartado;
    if (julgaveis >= MIN_N) {
      const taxaOk1 = a.ok1 / julgaveis;
      // Balde sem amostra CLASSIFICADA não mede terreno: o ok1 dele diz mais
      // sobre o que o cérebro deixou de classificar do que sobre o degrau.
      // Vale para QUALQUER balde (ver comentário de terrenoAmbiguo).
      if (a.ambiguos / julgaveis > AMBIGUO_MAX) {
        sinais++;
        console.log(`⚠️ BALDE AMBÍGUO: ${a.degrau} em ${a.terreno} — ok1 ${pct(taxaOk1)} (n=${julgaveis}), mas só ${julgaveis - a.ambiguos} têm terreno CLASSIFICADO (carimbo de LEDGER_TERRENO no despacho); ${a.ambiguos} são rótulo sem prova. Sinal 🔺/🔻 SUPRIMIDO até ${Math.ceil(julgaveis * (1 - AMBIGUO_MAX))}+ classificados — passe LEDGER_TERRENO em TODO despacho.`);
        continue;
      }
      if (taxaOk1 < OK1_PISO) {
        sinais++;
        console.log(`🔺 SUBIR: ${a.degrau} em ${a.terreno} com ok1 ${pct(taxaOk1)} (<${pct(OK1_PISO)}, n=${julgaveis}) — propor subir o DEFAULT do terreno.`);
      } else if (taxaOk1 >= OK1_TETO && julgaveis >= MIN_N && !/luna|haiku|mecanico/.test(a.degrau + a.terreno)) {
        sinais++;
        console.log(`🔻 DESCER?: ${a.degrau} em ${a.terreno} com ok1 ${pct(taxaOk1)} (n=${julgaveis}) — candidato a A/B no degrau abaixo (5 tarefas).`);
      }
    }
  }
  // Desperdício: Sol em mecânico puro (desde 30/07 Sol é o default de rotina;
  // só mecânico — grep/rename/inventário — é terreno de Luna/explorador)
  const desperdicio = linhas.filter((r) => /sol/i.test(r.modelo) && r.terreno === 'mecanico' && r.orquestracao_real !== 'fanout');
  if (desperdicio.length) {
    sinais++;
    console.log(`⚠️ DESPERDÍCIO: ${desperdicio.length} despacho(s) de Sol em mecânico — terreno de Luna/explorador:`);
    for (const r of desperdicio.slice(0, 5)) console.log(`   - ${r.ts.slice(0, 10)} ${r.tarefa}`);
  }
  // Crashes de invocação: NÃO entram em ok1/reciclo (o worker nunca rodou),
  // mas precisam ficar visíveis — pico de `infra` é bug do lançador, e ler
  // isso como qualidade do modelo foi exatamente o erro que criou o falso
  // sinal "Sol/high em rotina 31%" (8 dos 9 `falhou` de 14 d eram crash).
  // `infra` tem CAUSAS diferentes e conselhos OPOSTOS (26/08/2026). Antes,
  // todas saíam sob "LANÇADOR QUEBRANDO: conserte o run.sh" — inclusive as 4 de
  // 23-24/08, que eram SIGKILL do sistema com a máquina em load 84 (8 cores) e
  // swap 78%. O script estava intacto; o alarme mandava mexer no lugar errado.
  const infra = linhas.filter((r) => r.resultado === 'infra');
  if (infra.length) {
    const causaDe = (r) => {
      const n = r.nota || '';
      if (/CAUSA=invocacao-quebrada/.test(n)) return 'lancador';
      if (/CAUSA=(morto-de-fora|maquina-vermelha)/.test(n)) return 'maquina';
      // Linhas anteriores ao carimbo de CAUSA: o rc ainda denuncia o sinal.
      // 128+N é morte por sinal (137=KILL, 143=TERM, 130=INT), nunca crash de
      // invocação — o CLI recusando argumento sai com 1 ou 2.
      if (/rc=(130|137|143)\b/.test(n) && !/TIMEOUT/.test(n)) return 'maquina';
      return 'sem-causa';
    };
    const porCausa = { lancador: [], maquina: [], 'sem-causa': [] };
    for (const r of infra) porCausa[causaDe(r)].push(r);
    const listar = (arr) => {
      for (const r of arr.slice(0, 5)) {
        console.log(`   - ${r.ts.slice(0, 10)} [${r.frente}] ${r.tarefa} — ${r.nota || 's/ nota'}`);
      }
      if (arr.length > 5) console.log(`   … e mais ${arr.length - 5}`);
    };
    if (porCausa.lancador.length) {
      sinais++;
      const grave = porCausa.lancador.length >= 3;
      console.log(`${grave ? '🛠️ LANÇADOR QUEBRANDO' : '🛠️ INFRA (lançador)'}: ${porCausa.lancador.length} despacho(s) nunca rodaram — o CLI recusou a invocação${grave ? '. Conserte o run.sh/despacho ANTES de olhar qualquer ok1 desta janela' : ''}:`);
      listar(porCausa.lancador);
    }
    if (porCausa.maquina.length) {
      sinais++;
      console.log(`🖥️ MÁQUINA DERRUBANDO DESPACHO: ${porCausa.maquina.length} despacho(s) morreram por SINAL externo, ou foram barrados com o Mac em vermelho — NÃO é bug do lançador. Reduza a concorrência (menos frentes ao mesmo tempo, fan-out menor) ou espere aliviar; o gate de recursos já recusa despacho automático nesse estado:`);
      listar(porCausa.maquina);
    }
    if (porCausa['sem-causa'].length) {
      sinais++;
      console.log(`🛠️ INFRA (causa não registrada): ${porCausa['sem-causa'].length} despacho(s) — linhas anteriores ao carimbo de CAUSA (26/08/2026) ou log manual sem nota:`);
      listar(porCausa['sem-causa']);
    }
  }
  // Saturação de quota por frente
  const quotaPorFrente = {};
  for (const r of linhas) if (r.resultado === 'quota') quotaPorFrente[r.frente] = (quotaPorFrente[r.frente] || 0) + 1;
  for (const [f, n] of Object.entries(quotaPorFrente)) {
    if (n >= QUOTA_ALERTA) {
      sinais++;
      console.log(`🚱 SATURADA: frente ${f} bateu quota ${n}× na janela — antecipar desvio pra vizinha (não esperar o erro).`);
    }
  }
  if (!sinais) {
    const julgaveisGerais = linhas.filter(julgavel).length;
    if (julgaveisGerais < 20)
      console.log(`⏳ nenhum alerta decisório — só ${julgaveisGerais}/20 construções julgáveis na janela.`);
    else console.log('✅ nenhum limiar violado — estrutura atual sustentada pelos dados.');
  }
  console.log('\n(Este report só sinaliza; aplicar mudança segue `auto_aplicar`/`AUTO_SUBIR_ON` do motor por terreno.)');
}

// ── KPIs do harness (snapshot grava, history mostra a evolução) ──
// QUALIDADE  ok1%      — aceito na 1ª revisão (excl. quota): meta ≥80%
// ECONOMIA   offload%  — % de despachos FORA da conta Anthropic
//            quotaHit% — % barrados por quota: 0% constante = assinatura
//                        sobrando; alto = frente saturada → realocar antes
// VELOCIDADE reciclo%  — % que precisou de rodada extra (retrabalho/
//                        escalado/falhou): cada re-ciclo é um ciclo inteiro
//                        de despacho+revisão perdido; meta ≤20%
//            durMed    — mediana de minutos despacho→aceite (dos registros
//                        com --dur); é a medida DIRETA de velocidade

export function loadJanela(file, dias) {
  const corte = Date.now() - dias * 864e5;
  // pendente = provisório sem revisão → nunca entra em KPI/snapshot
  return lerTudo(file).filter((r) => Date.parse(r.ts) >= corte && r.resultado !== 'pendente');
}

// Constantes e path reusados por auto-subir.mjs (motor de tier por terreno).
// Exportadas para que a regra de ambiguidade e o corte de instrumentação
// tenham FONTE ÚNICA — duplicar num segundo arquivo viraria drift silencioso.
export const LEDGER_FILE = DEFAULT_FILE;
export const LIMIARES = {
  MIN_N, OK1_PISO, OK1_TETO, QUOTA_ALERTA, MUDO_DIAS, AMBIGUO_MAX,
  INSTRUMENTACAO_TERRENO,
};

export function calcKpis(linhas) {
  // KPI decisório = somente construção carimbada no despacho. Revisão mede a
  // capacidade de detectar problemas; papel ausente/inferido mede cobertura,
  // não qualidade. Sem esta porta, um revisor que encontra erro piora o
  // construtor e registros antigos sem papel dominam a amostra.
  linhas = linhas.filter(
    (r) => r.papel === 'construtor' && r.papel_inferido !== true && r.resultado !== 'pendente',
  );
  const n = linhas.length;
  // `quota` (barrado por limite) e `infra` (o worker nunca rodou) saem do
  // denominador de qualidade — nenhum dos dois é entrega julgada.
  const julgaveis = linhas.filter(julgavel);
  const ok1 = julgaveis.filter((r) => r.resultado === 'ok1').length;
  const offload = linhas.filter((r) => r.frente !== 'claude' && r.frente !== 'cerebro').length;
  const quotaHits = linhas.filter((r) => r.resultado === 'quota').length;
  const infraN = linhas.filter((r) => r.resultado === 'infra').length;
  const porFrente = {};
  for (const r of linhas) porFrente[r.frente] = (porFrente[r.frente] || 0) + 1;
  const quotaPorFrente = {};
  for (const r of linhas) if (r.resultado === 'quota') quotaPorFrente[r.frente] = (quotaPorFrente[r.frente] || 0) + 1;
  const reciclos = julgaveis.filter((r) => r.resultado !== 'ok1').length;
  const durs = julgaveis.map((r) => r.dur).filter((d) => typeof d === 'number' && d > 0).sort((a, b) => a - b);
  const durMed = durs.length ? durs[Math.floor(durs.length / 2)] : null;
  const orquestracao = { solo: 0, fanout: 0, fanout_nao_observado: 0, desconhecido: 0, subagentes_total: 0 };
  const modosOrquestracao = new Set(['solo', 'fanout', 'fanout_nao_observado']);
  for (const r of linhas) {
    const modo = modosOrquestracao.has(r.orquestracao_real) ? r.orquestracao_real : 'desconhecido';
    orquestracao[modo]++;
    orquestracao.subagentes_total += r.subagentes?.iniciados || 0;
  }
  // KPIs por terreno (mesmos eixos, recortados): alimenta o sinal de
  // subir/baratear o modelo DEFAULT de cada terreno no histórico
  const porTerreno = {};
  for (const r of linhas) {
    const t = (porTerreno[r.terreno] ||= { n: 0, julgaveis: 0, ok1: 0, reciclo: 0, quota: 0, infra: 0 });
    t.n++;
    if (r.resultado === 'quota') t.quota++;
    else if (r.resultado === 'infra') t.infra++;
    else if (julgavel(r)) {
      t.julgaveis++;
      if (r.resultado === 'ok1') t.ok1++;
      else t.reciclo++;
    }
  }
  for (const t of Object.values(porTerreno)) {
    t.ok1_pct = t.julgaveis ? +(t.ok1 / t.julgaveis).toFixed(3) : null;
    t.reciclo_pct = t.julgaveis ? +(t.reciclo / t.julgaveis).toFixed(3) : null;
  }
  return {
    n,
    ok1_pct: julgaveis.length ? +(ok1 / julgaveis.length).toFixed(3) : null,
    offload_pct: n ? +(offload / n).toFixed(3) : null,
    quota_hit_pct: n ? +(quotaHits / n).toFixed(3) : null,
    // contagem própria: crash de invocação NÃO é qualidade do modelo, mas
    // precisa ficar visível no histórico (pico = lançador quebrado)
    infra_n: infraN,
    reciclo_pct: julgaveis.length ? +(reciclos / julgaveis.length).toFixed(3) : null,
    dur_mediana_min: durMed,
    dur_n: durs.length,
    por_frente: porFrente,
    quota_por_frente: quotaPorFrente,
    por_terreno: porTerreno,
    orquestracao,
  };
}

function cmdSnapshot(args) {
  const dias = parseInt(args.dias || '7', 10);
  const linhas = loadJanela(args.file || DEFAULT_FILE, dias);
  if (!linhas.length) { console.log(`0 despachos nos últimos ${dias}d — snapshot não gravado.`); return; }
  const k = calcKpis(linhas);
  if (!k.n) {
    console.log(`0 construções explicitamente carimbadas nos últimos ${dias}d — snapshot não gravado.`);
    return;
  }
  const rec = {
    ts: new Date().toISOString(),
    janela_dias: dias,
    schema_version: 2,
    metric_version: HARNESS_METRIC_VERSION,
    ...k,
    nota: args.nota || null,
  };
  mkdirSync(dirname(HISTORY_FILE), { recursive: true });
  appendFileSync(HISTORY_FILE, JSON.stringify(rec) + '\n');
  console.log(`snapshot gravado (${dias}d, n=${k.n}): ok1 ${pct(k.ok1_pct)} · offload ${pct(k.offload_pct)} · quotaHit ${pct(k.quota_hit_pct)} · reciclo ${pct(k.reciclo_pct)} · infra ${k.infra_n} · fan-out ${k.orquestracao.fanout}/${k.n} (${k.orquestracao.subagentes_total} filhos) · durMed ${k.dur_mediana_min != null ? k.dur_mediana_min + 'min (n=' + k.dur_n + ')' : 's/dados'}`);
}

function cmdHistory(args) {
  const nMax = parseInt(args.n || '12', 10);
  if (!existsSync(HISTORY_FILE)) { console.log('sem histórico ainda — rode `ledger.mjs snapshot` ao fechar a semana.'); return; }
  const todos = readFileSync(HISTORY_FILE, 'utf8').trim().split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
  const compativeis = filtrarHistoricoCompativel(todos);
  const recs = compativeis.slice(-nMax);
  console.log('# Evolução dos KPIs do harness');
  if (todos.length !== compativeis.length)
    console.log(`# ${todos.length - compativeis.length} snapshot(s) legado(s) em quarentena (fórmula anterior)`);
  console.log('# qualidade: ok1≥80% · economia: offload subindo, quotaHit>0 sem saturar · velocidade: reciclo≤20%, durMed caindo\n');
  console.log('data        janela   n   ok1  offload quotaHit reciclo durMed  frentes');
  for (const r of recs) {
    const frentes = Object.entries(r.por_frente || {}).map(([f, x]) => `${f}:${x}`).join(' ');
    const dur = r.dur_mediana_min != null ? `${r.dur_mediana_min}m` : '—';
    console.log(`${r.ts.slice(0, 10)}  ${String(r.janela_dias + 'd').padStart(4)} ${String(r.n).padStart(4)}  ${pct(r.ok1_pct).padStart(4)}  ${pct(r.offload_pct).padStart(6)} ${pct(r.quota_hit_pct).padStart(7)} ${pct(r.reciclo_pct).padStart(7)} ${String(dur).padStart(6)}  ${frentes}${r.nota ? '  — ' + r.nota : ''}`);
  }
}

// Atalho de 1 linha: infere a frente pelo modelo e dispensa --tarefa.
//   node ledger.mjs log-rapido --modelo gpt-5.6-luna --effort max --terreno rotina --papel construtor --resultado ok1 [--tarefa ...]
function cmdLogRapido(args) {
  const obrig = ['modelo', 'effort', 'terreno', 'resultado'];
  const faltam = obrig.filter((k) => !args[k]);
  if (faltam.length) { console.error(`faltam campos: ${faltam.join(', ')}`); process.exit(2); }
  const frente = args.frente || inferirFrente(args.modelo);
  if (!frente) { console.error(`não sei inferir a frente de "${args.modelo}" — passe --frente`); process.exit(2); }
  cmdLog({ ...args, frente, tarefa: args.tarefa || '(log-rapido, sem descrição)' });
}

// ─────────────────────────────────────────────────────────────────────────
// COBERTURA — o ledger enxerga que fatia do trabalho real?
//
// Por que este comando existe (medido em 2026-08-11): `offload_pct` divide
// por DESPACHOS REGISTRADOS, não por trabalho feito. Como só entra no
// ledger o que passa pelos run.sh dos workers (ou log manual), e o trabalho
// que o cérebro faz inline quase nunca é logado, o denominador exclui
// sistematicamente a frente Claude — e o offload sai inflado.
//
// A medição que expôs isso: ledger dizia offload 85% na mesma janela em que
// o repositório tinha 373 PRs mergeados contra 85 despachos registrados
// (cobertura de 23%), com apenas 11% das branches em `codex/` e ZERO
// commits co-assinados por modelo não-Anthropic.
//
// Este comando não corrige o KPI — ele mostra os dois denominadores lado a
// lado, para que a decisão de assinatura use o número certo. Corrigir o
// offload de verdade exige logar TODO despacho, inclusive o inline.
function cmdCobertura(args) {
  const dias = parseInt(args.dias || '15', 10);
  const repo = args.repo || join(homedir(), 'Apps YaaX', 'SeuCamarao App');
  const linhas = loadJanela(args.file || DEFAULT_FILE, dias);

  const sh = (cmd, argv) => {
    try {
      return execFileSync(cmd, argv, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch { return null; }
  };

  console.log(`\n# Cobertura do ledger — últimos ${dias}d\n`);

  // 1) Denominador: despachos registrados vs PRs realmente mergeados
  const prJson = sh('gh', ['pr', 'list', '--state', 'merged', '--limit', '800', '--json', 'headRefName,mergedAt']);
  let prs = [];
  if (prJson) {
    const corte = Date.now() - dias * 864e5;
    try {
      prs = JSON.parse(prJson).filter((p) => Date.parse(p.mergedAt) >= corte);
    } catch { prs = []; }
  }

  console.log('DENOMINADOR');
  console.log(`  despachos registrados no ledger:  ${String(linhas.length).padStart(5)}`);
  if (prs.length) {
    console.log(`  PRs mergeados no repositório:     ${String(prs.length).padStart(5)}`);
    const cob = linhas.length / prs.length;
    console.log(`  cobertura:                        ${pct(cob).padStart(5)}   ← o ledger só enxerga isso`);
    if (cob < 0.5) console.log('  ⚠️  menos da metade do trabalho é registrada: todo KPI abaixo é de uma amostra de conveniência, não de uma amostra representativa.');
  } else {
    console.log('  PRs mergeados no repositório:      (não medido — `gh` indisponível ou fora de um repo)');
  }

  // 2) Offload pelas duas réguas
  const k = calcKpis(linhas);
  console.log('\nOFFLOAD — as duas réguas');
  console.log(`  ledger  (despachos externos ÷ registrados):   ${pct(k.offload_pct).padStart(5)}`);

  if (prs.length) {
    const EXTERNOS = ['codex', 'gpt'];
    const ext = prs.filter((p) => EXTERNOS.includes(String(p.headRefName).split('/')[0])).length;
    console.log(`  repo    (branches de worker externo ÷ PRs):   ${pct(ext / prs.length).padStart(5)}`);

    const bodies = sh('git', ['log', 'origin/main', `--since=${dias} days ago`, '--pretty=format:%b']);
    if (bodies) {
      const coas = [...bodies.matchAll(/Co-authored-by:\s*([^\n<]+)/gi)].map((m) => m[1].trim());
      const anth = coas.filter((c) => /claude|opus|sonnet|haiku|fable/i.test(c)).length;
      const outros = coas.filter((c) => /gpt|codex|sol|luna|terra/i.test(c)).length;
      console.log(`  commits co-assinados por modelo Anthropic:    ${String(anth).padStart(5)}`);
      console.log(`  commits co-assinados por modelo externo:      ${String(outros).padStart(5)}`);
      if (anth > 0 && outros === 0) {
        console.log('  ⚠️  nenhum commit co-assinado por worker externo. Ressalva honesta: nem todo worker assina commit — ausência de assinatura NÃO prova ausência de trabalho. Mas junto com a régua de branch, o offload do ledger fica sem sustentação.');
      }
    }

    const dif = Math.abs((k.offload_pct ?? 0) - ext / prs.length);
    if (dif > 0.2) {
      console.log(`\n  🚨 as duas réguas divergem em ${(dif * 100).toFixed(0)} pontos.`);
      console.log('     Antes de decidir assinatura, resolva qual está certa —');
      console.log('     nenhuma decisão de dinheiro deve sair de um número que se contradiz.');
    }
  }

  // 3) Velocidade: quantos registros têm duração
  const comDur = linhas.filter((r) => typeof r.dur === 'number' && r.dur > 0).length;
  console.log('\nVELOCIDADE');
  console.log(`  registros com duração preenchida:  ${comDur} de ${linhas.length}  (${pct(linhas.length ? comDur / linhas.length : null)})`);
  if (linhas.length && comDur / linhas.length < 0.5) console.log('  ⚠️  durMed vem de menos da metade dos registros — trate como indício, não como medida.');
  console.log('');
}

// Guarda de CLI: este arquivo também é importado como módulo (avisoMudo é
// usado pela auditoria) — só roda comandos quando executado diretamente.
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (cmd === 'log') cmdLog(args);
  else if (cmd === 'log-rapido') cmdLogRapido(args);
  else if (cmd === 'validar-revisao') cmdValidarRevisao(args);
  else if (cmd === 'fechar') cmdFechar(args);
  else if (cmd === 'pendentes') cmdPendentes(args);
  else if (cmd === 'subagentes') cmdSubagentes(args);
  else if (cmd === 'report') cmdReport(args);
  else if (cmd === 'snapshot') cmdSnapshot(args);
  else if (cmd === 'history') cmdHistory(args);
  else if (cmd === 'cobertura') cmdCobertura(args);
  else { console.error('uso: ledger.mjs log|log-rapido|validar-revisao|fechar|pendentes|subagentes|report|snapshot|history|cobertura [--flags]'); process.exit(2); }
}
