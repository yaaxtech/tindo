#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { appendFile, opendir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

const CLAUDE_DIR = join(homedir(), '.claude');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
const ORQUESTRACAO_DIR = join(CLAUDE_DIR, 'orquestracao');
const GESTOS_FILE = join(ORQUESTRACAO_DIR, 'gestos.jsonl');
const TIPOS_GESTO = new Set(['chip', 'compact', 'subagente', 'janela-nova']);

function numero(valor) {
  return Number.isFinite(valor) ? valor : 0;
}

function percentual(parte, total) {
  if (!total) return null;
  return Math.round((parte / total) * 1000) / 1000;
}

async function lerJsonl(caminho, visitar) {
  const linhas = createInterface({
    input: createReadStream(caminho),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  for await (const linha of linhas) {
    if (!linha) continue;
    try {
      visitar(JSON.parse(linha));
    } catch {
      // Uma linha truncada não invalida o restante do transcript.
    }
  }
}

async function contarChips(sessao) {
  let chips = 0;
  try {
    await lerJsonl(GESTOS_FILE, (registro) => {
      if (registro.tipo === 'chip' && registro.sessao === sessao) chips += 1;
    });
  } catch {
    return 0;
  }
  return chips;
}

export async function status({ transcript }) {
  if (!transcript) return null;
  try {
    await stat(transcript);
  } catch {
    return null;
  }

  let chamadas = 0;
  let chamadasDesdeCompact = 0;
  let prefixo = 0;
  let subagentes = 0;
  const processarLinha = (linha) => {
    if (linha.includes('"subtype":"compact_boundary"')) {
      chamadasDesdeCompact = 0;
    }
    if (
      !linha.includes(',"type":"assistant","uuid":"') ||
      !linha.includes('"message":{') ||
      !linha.includes('"usage":{')
    ) {
      return;
    }
    chamadas += 1;
    chamadasDesdeCompact += 1;
    const uso = linha.match(/"usage":\{[^}]*"cache_read_input_tokens":(\d+)/);
    if (uso) prefixo = Number(uso[1]);
    const usosSubagente = linha.match(/"type":"tool_use"[^{}]*"name":"(?:Agent|Task)"/g);
    if (usosSubagente) subagentes += usosSubagente.length;
  };
  try {
    const stream = createReadStream(transcript, {
      encoding: 'utf8',
      highWaterMark: 1024 * 1024,
    });
    let restante = '';
    for await (const trecho of stream) {
      restante += trecho;
      let inicio = 0;
      let fim = restante.indexOf('\n');
      while (fim !== -1) {
        processarLinha(restante.slice(inicio, fim));
        inicio = fim + 1;
        fim = restante.indexOf('\n', inicio);
      }
      restante = restante.slice(inicio);
    }
    if (restante) processarLinha(restante);
  } catch {
    return null;
  }

  const sessao = basename(transcript, '.jsonl');
  const chips = await contarChips(sessao);
  return (
    `[janela] ${chamadas} chamadas · prefixo ${Math.round(prefixo / 1000)}k` +
    ` · desde o compact: ${chamadasDesdeCompact} · gestos: ` +
    `${subagentes} sub/${chips} chip`
  );
}

export async function gesto({ tipo, sessao, titulo = '' }) {
  if (!TIPOS_GESTO.has(tipo)) {
    throw new Error('tipo de gesto inválido');
  }
  if (!sessao) throw new Error('sessão obrigatória');
  const registro = {
    ts: new Date().toISOString(),
    tipo,
    sessao,
    titulo,
  };
  await appendFile(GESTOS_FILE, `${JSON.stringify(registro)}\n`, 'utf8');
  return registro;
}

async function listarTranscripts(dir, limite, saida = []) {
  let entradas;
  try {
    entradas = await opendir(dir);
  } catch {
    return saida;
  }
  for await (const entrada of entradas) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      await listarTranscripts(caminho, limite, saida);
    } else if (entrada.isFile() && entrada.name.endsWith('.jsonl')) {
      try {
        const info = await stat(caminho);
        if (info.mtimeMs >= limite) saida.push(caminho);
      } catch {
        // Arquivos removidos durante a varredura são ignorados.
      }
    }
  }
  return saida;
}

export async function analisarTranscript(caminho, { limite = 0, agora = Date.now() } = {}) {
  const modelos = new Map();
  const sessao = {
    id: basename(caminho, '.jsonl'),
    chamadas: 0,
    tokens: 0,
    tokensPos200: 0,
    cacheRead: 0,
    output: 0,
    compacts: 0,
    subagentes: 0,
    mensagens: 0,
    modelo: '',
    pico_contexto: 0,
  };
  const mensagens = new Map();
  await lerJsonl(caminho, (registro) => {
    const ts = Date.parse(registro.timestamp);
    if (!Number.isFinite(ts) || ts < limite || ts >= agora) return;
    if (registro.subtype === 'compact_boundary') sessao.compacts += 1;
    if (registro.type !== 'assistant' || !registro.message?.usage) return;
    const uso = registro.message.usage;
    const id = registro.message.id || registro.uuid;
    if (!id) return; // Sem identidade não é possível deduplicar blocos de streaming.
    const anterior = mensagens.get(id);
    const entrada = numero(uso.input_tokens);
    const cache = numero(uso.cache_read_input_tokens);
    const criacao = numero(uso.cache_creation_input_tokens);
    const output = numero(uso.output_tokens);
    const atual = anterior || {
      input: 0,
      cache: 0,
      criacao: 0,
      output: 0,
      modelo: registro.message.model || 'desconhecido',
      ferramentas: new Map(),
    };
    // Um assistant message pode ser emitido em vários blocos com o mesmo usage.
    atual.input = Math.max(atual.input, entrada);
    atual.cache = Math.max(atual.cache, cache);
    atual.criacao = Math.max(atual.criacao, criacao);
    atual.output = Math.max(atual.output, output);
    for (const bloco of registro.message.content || []) {
      if (bloco.type === 'tool_use' && bloco.id) atual.ferramentas.set(bloco.id, bloco.name);
    }
    mensagens.set(id, atual);
  });
  for (const uso of mensagens.values()) {
    const tokens = uso.input + uso.cache + uso.criacao + uso.output;
    if (!tokens) continue;
    sessao.chamadas += 1;
    sessao.tokens += tokens;
    sessao.cacheRead += uso.cache;
    sessao.output += uso.output;
    sessao.pico_contexto = Math.max(sessao.pico_contexto, uso.input + uso.cache + uso.criacao);
    if (sessao.chamadas > 200) sessao.tokensPos200 += tokens;
    const atual = modelos.get(uso.modelo) || { chamadas: 0, tokens: 0 };
    atual.chamadas += 1;
    atual.tokens += tokens;
    modelos.set(uso.modelo, atual);
    for (const nome of uso.ferramentas.values()) {
      if (nome === 'Agent' || nome === 'Task') sessao.subagentes += 1;
      if (nome === 'SendMessage' || nome === 'mcp__ccd_session_mgmt__send_message') {
        sessao.mensagens += 1;
      }
    }
  }
  sessao.modelos = modelos;
  sessao.modelo =
    [...modelos.entries()].sort((a, b) => b[1].tokens - a[1].tokens)[0]?.[0] || 'desconhecido';
  return sessao;
}

async function contarChipsNaJanela(limite) {
  let chips = 0;
  try {
    await lerJsonl(GESTOS_FILE, (registro) => {
      const ts = Date.parse(registro.ts);
      if (registro.tipo === 'chip' && Number.isFinite(ts) && ts >= limite) {
        chips += 1;
      }
    });
  } catch {
    return 0;
  }
  return chips;
}

function faixaDe(chamadas) {
  if (chamadas <= 50) return '0-50';
  if (chamadas <= 150) return '50-150';
  if (chamadas <= 300) return '150-300';
  if (chamadas <= 600) return '300-600';
  return '600+';
}

function vazio(dias) {
  return {
    gerado_em: new Date().toISOString(),
    dias,
    totais: {
      sessoes: 0,
      chamadas: 0,
      tokens: 0,
      cache_read: 0,
      output: 0,
    },
    kpis: {
      pct_prefixo: null,
      pct_pos_200: null,
      sessoes_acima_teto: null,
      tokens_por_tarefa: null,
      gestos: null,
    },
    por_modelo: [],
    faixas: [],
    top_sessoes: [],
  };
}

export async function coletar({ dias = 14, agora = Date.now() } = {}) {
  const diasValidos = Number.isFinite(Number(dias)) && Number(dias) > 0 ? Number(dias) : 14;
  const limite = agora - diasValidos * 24 * 60 * 60 * 1000;
  let teto = null;
  try {
    const settings = JSON.parse(await readFile(join(CLAUDE_DIR, 'settings.json'), 'utf8'));
    if (Number.isFinite(settings.autoCompactWindow) && settings.autoCompactWindow > 0)
      teto = settings.autoCompactWindow;
  } catch {
    /* teto desconhecido não vira um valor inventado */
  }
  const caminhos = await listarTranscripts(PROJECTS_DIR, limite);
  if (!caminhos.length) return vazio(diasValidos);

  const sessoes = [];
  for (const caminho of caminhos) {
    try {
      const sessao = await analisarTranscript(caminho, { limite, agora });
      if (sessao.chamadas > 0) sessoes.push(sessao);
    } catch {
      // Um transcript ilegível não impede a coleta dos demais.
    }
  }
  if (!sessoes.length) return vazio(diasValidos);

  const totais = {
    sessoes: sessoes.length,
    chamadas: 0,
    tokens: 0,
    cache_read: 0,
    output: 0,
  };
  const modelos = new Map();
  const nomesFaixas = ['0-50', '50-150', '150-300', '300-600', '600+'];
  const faixas = new Map(
    nomesFaixas.map((faixa) => [faixa, { faixa, sessoes: 0, tokens: 0, pct: 0 }]),
  );
  let tokensPos200 = 0;
  let acimaTeto = 0;
  let subagentes = 0;
  let compacts = 0;
  let mensagens = 0;
  let sessoesComMensagem = 0;
  for (const sessao of sessoes) {
    totais.chamadas += sessao.chamadas;
    totais.tokens += sessao.tokens;
    totais.cache_read += sessao.cacheRead;
    totais.output += sessao.output;
    tokensPos200 += sessao.tokensPos200;
    subagentes += sessao.subagentes;
    compacts += sessao.compacts;
    mensagens += sessao.mensagens;
    if (sessao.mensagens) sessoesComMensagem += 1;
    if (teto !== null && sessao.pico_contexto > teto) acimaTeto += 1;

    const faixa = faixas.get(faixaDe(sessao.chamadas));
    faixa.sessoes += 1;
    faixa.tokens += sessao.tokens;
    for (const [modelo, dados] of sessao.modelos) {
      const atual = modelos.get(modelo) || { chamadas: 0, tokens: 0 };
      atual.chamadas += dados.chamadas;
      atual.tokens += dados.tokens;
      modelos.set(modelo, atual);
    }
  }

  const chips = await contarChipsNaJanela(limite);
  return {
    gerado_em: new Date().toISOString(),
    dias: diasValidos,
    totais,
    kpis: {
      pct_prefixo: percentual(totais.cache_read, totais.tokens),
      pct_pos_200: percentual(tokensPos200, totais.tokens),
      sessoes_acima_teto:
        teto === null
          ? null
          : {
              n: acimaTeto,
              pct: percentual(acimaTeto, totais.sessoes),
              teto,
              unidade_teto: 'tokens',
              escopo: 'claude',
            },
      tokens_por_tarefa: null,
      motivo_tokens_por_tarefa:
        'Sem vínculo verificável entre consumo das sessões e entregas aceitas.',
      gestos: {
        subagentes,
        chips,
        compacts,
        mensagens,
        pct_sessoes_com_mensagem: percentual(sessoesComMensagem, totais.sessoes),
        por_sessao:
          Math.round(((subagentes + chips + compacts + mensagens) / totais.sessoes) * 10) / 10,
      },
    },
    por_modelo: [...modelos.entries()]
      .map(([modelo, dados]) => ({
        modelo,
        chamadas: dados.chamadas,
        tokens: dados.tokens,
        pct: percentual(dados.tokens, totais.tokens),
      }))
      .sort((a, b) => b.tokens - a.tokens),
    faixas: [...faixas.values()].map((faixa) => ({
      ...faixa,
      pct: percentual(faixa.tokens, totais.tokens),
    })),
    top_sessoes: sessoes
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 12)
      .map((sessao) => ({
        id: sessao.id.slice(0, 8),
        chamadas: sessao.chamadas,
        tokens: sessao.tokens,
        modelo: sessao.modelo,
      })),
  };
}

function argumentos(argv) {
  const [comando, ...resto] = argv;
  const opcoes = {};
  for (let i = 0; i < resto.length; i += 1) {
    if (!resto[i].startsWith('--')) continue;
    opcoes[resto[i].slice(2)] = resto[i + 1];
    i += 1;
  }
  return { comando, opcoes };
}

async function cli() {
  const { comando, opcoes } = argumentos(process.argv.slice(2));
  if (comando === 'status') {
    const linha = await status({ transcript: opcoes.transcript });
    if (linha) process.stdout.write(linha);
    return;
  }
  if (comando === 'gesto') {
    await gesto({
      tipo: opcoes.tipo,
      sessao: opcoes.sessao,
      titulo: opcoes.titulo || '',
    });
    return;
  }
  if (comando === 'coletar') {
    const resultado = await coletar({ dias: Number(opcoes.dias || 14) });
    process.stdout.write(`${JSON.stringify(resultado, null, 2)}\n`);
  }
}

const executadoDiretamente =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (executadoDiretamente) {
  cli().catch((erro) => {
    if (process.argv[2] !== 'status') {
      process.stderr.write(`${erro.message}\n`);
      process.exitCode = 1;
    }
  });
}
