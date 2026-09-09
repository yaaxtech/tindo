import { createReadStream } from 'node:fs';
import { opendir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';

const DIA_MS = 24 * 60 * 60 * 1000;
const MODELO_DESCONHECIDO = 'desconhecido';
const NOMES_PERGUNTA = new Set(['request_user_input', 'request_user_input_async']);
const DIRETORIOS_PADRAO = [
  join(homedir(), '.codex', 'sessions'),
  join(homedir(), '.codex', 'archived_sessions'),
];

function numero(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function timestampMs(v) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v < 1e12 ? v * 1000 : v;
  }
  if (typeof v !== 'string' || !v) return null;
  const n = Number(v);
  if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
  const parsed = Date.parse(v);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampDoRegistro(registro) {
  return timestampMs(registro?.timestamp);
}

function objeto(v) {
  if (v && typeof v === 'object') return v;
  if (typeof v !== 'string' || !v.trim()) return null;
  try {
    const parsed = JSON.parse(v);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function quantidadePerguntas(v) {
  const args = objeto(v);
  if (!args) return 1;
  return Array.isArray(args.questions) ? args.questions.length : 1;
}

function respostaComRespostas(payload) {
  const output = objeto(payload?.output);
  if (output?.cancelled === true || output?.canceled === true || output?.status === 'cancelled') {
    return false;
  }
  const answers = output?.answers;
  if (Array.isArray(answers)) return answers.length > 0;
  return Boolean(answers && typeof answers === 'object' && Object.keys(answers).length > 0);
}

function encontrarPerguntasEstruturadas(v, encontradas = []) {
  const value = objeto(v);
  if (!value) return encontradas;
  if (Array.isArray(value)) {
    for (const item of value) encontrarPerguntasEstruturadas(item, encontradas);
    return encontradas;
  }
  if (typeof value.name === 'string' && NOMES_PERGUNTA.has(value.name)) {
    encontradas.push({
      callId:
        typeof value.call_id === 'string'
          ? value.call_id
          : typeof value.id === 'string'
            ? value.id
            : null,
      perguntas: quantidadePerguntas(value.arguments ?? value.input),
    });
    return encontradas;
  }
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') encontrarPerguntasEstruturadas(child, encontradas);
  }
  return encontradas;
}

function perguntasDoRegistro(payload, tipo) {
  if (!payload || typeof payload !== 'object') return [];
  if (!['function_call', 'custom_tool_call'].includes(tipo)) return [];

  if (typeof payload.name === 'string' && NOMES_PERGUNTA.has(payload.name)) {
    return [
      {
        callId:
          typeof payload.call_id === 'string'
            ? payload.call_id
            : typeof payload.id === 'string'
              ? payload.id
              : null,
        perguntas: quantidadePerguntas(payload.arguments ?? payload.input),
      },
    ];
  }

  if (payload.name !== 'exec') return [];
  return encontrarPerguntasEstruturadas(payload.input ?? payload.arguments);
}

function usoDoRegistro(payload, registro) {
  const info = payload?.info ?? registro?.info;
  const uso = info?.total_token_usage;
  if (!uso || typeof uso !== 'object') return null;

  const input = numero(uso.input_tokens) ?? 0;
  const cacheRead =
    numero(uso.cached_input_tokens) ??
    numero(uso.cache_read_input_tokens) ??
    numero(uso.cache_read) ??
    0;
  const output = numero(uso.output_tokens) ?? numero(uso.output) ?? 0;
  const total = numero(uso.total_tokens) ?? input + output;
  return { total, input, cacheRead, output };
}

function modeloDoContexto(payload) {
  const modelo = typeof payload?.model === 'string' ? payload.model.trim() : '';
  if (
    !modelo ||
    modelo.length > 120 ||
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(modelo) ||
    !/^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/i.test(modelo)
  ) {
    return MODELO_DESCONHECIDO;
  }
  if (!/^(?:gpt|o\d|claude|codex|gemini|haiku|sonnet|opus|fable|terra|luna|sol)/i.test(modelo)) {
    return MODELO_DESCONHECIDO;
  }
  return modelo;
}

async function listarJsonl(diretorio, erros, limite) {
  const encontrados = [];
  let entrada;
  try {
    entrada = await opendir(diretorio);
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') erros.value += 1;
    return encontrados;
  }

  try {
    for await (const item of entrada) {
      const caminho = join(diretorio, item.name);
      if (item.isDirectory()) {
        encontrados.push(...(await listarJsonl(caminho, erros, limite)));
      } else if (item.isFile() && item.name.endsWith('.jsonl')) {
        try {
          if ((await stat(caminho)).mtimeMs >= limite) encontrados.push(caminho);
        } catch (error) {
          if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') erros.value += 1;
        }
      }
    }
  } catch {
    erros.value += 1;
  }
  return encontrados;
}

function usoVazio() {
  return { total: 0, input: 0, cacheRead: 0, output: 0 };
}

function usoMudou(atual, anterior) {
  if (!anterior) return true;
  return (
    atual.total !== anterior.total ||
    atual.input !== anterior.input ||
    atual.cacheRead !== anterior.cacheRead ||
    atual.output !== anterior.output
  );
}

function deltaContador(atual, anterior) {
  if (anterior === null) return atual;
  return atual >= anterior ? atual - anterior : atual;
}

function deltaUso(atual, anterior) {
  const base = anterior ?? usoVazio();
  return {
    total: deltaContador(atual.total, anterior ? base.total : null),
    input: deltaContador(atual.input, anterior ? base.input : null),
    cacheRead: deltaContador(atual.cacheRead, anterior ? base.cacheRead : null),
    output: deltaContador(atual.output, anterior ? base.output : null),
  };
}

function ordenar(a, b) {
  return a.ts - b.ts || a.ordinal - b.ordinal || a.seq - b.seq;
}

async function analisarArquivo(caminho, erros, agoraMs) {
  const resultado = {
    caminho,
    meta: null,
    contextos: [],
    tokens: [],
    perguntas: [],
    respostas: [],
    maiorTsAteAgora: null,
    linhas: 0,
    leu: false,
  };
  let seq = 0;
  const entrada = createReadStream(caminho);
  const linhas = createInterface({ input: entrada, crlfDelay: Number.POSITIVE_INFINITY });
  try {
    for await (const linha of linhas) {
      resultado.linhas += 1;
      if (!linha.trim()) continue;
      let registro;
      try {
        registro = JSON.parse(linha);
      } catch {
        erros.value += 1;
        seq += 1;
        continue;
      }
      if (!registro || typeof registro !== 'object') {
        seq += 1;
        continue;
      }

      const ts = timestampDoRegistro(registro);
      if (
        ts !== null &&
        ts <= agoraMs &&
        (resultado.maiorTsAteAgora === null || ts > resultado.maiorTsAteAgora)
      ) {
        resultado.maiorTsAteAgora = ts;
      }
      const payload =
        registro.payload && typeof registro.payload === 'object' ? registro.payload : registro;
      const tipo = typeof payload.type === 'string' ? payload.type : registro.type;
      const ordinal = numero(registro.ordinal) ?? seq;

      if (tipo === 'session_meta') {
        if (!resultado.meta) resultado.meta = payload;
      } else if (tipo === 'turn_context' && ts !== null) {
        resultado.contextos.push({
          ts,
          ordinal,
          seq,
          turnId: typeof payload.turn_id === 'string' ? payload.turn_id : null,
          modelo: modeloDoContexto(payload),
        });
      } else if (tipo === 'token_count' && ts !== null) {
        const uso = usoDoRegistro(payload, registro);
        if (uso) resultado.tokens.push({ ts, ordinal, seq, uso });
      }

      const perguntas = perguntasDoRegistro(payload, tipo);
      for (const pergunta of perguntas) {
        if (ts !== null) {
          resultado.perguntas.push({
            ts,
            ordinal,
            seq,
            callId: pergunta.callId,
            perguntas: pergunta.perguntas,
          });
        }
      }
      if (
        (tipo === 'function_call_output' || tipo === 'custom_tool_call_output') &&
        typeof payload.call_id === 'string'
      ) {
        resultado.respostas.push({
          ts,
          callId: payload.call_id,
          seq,
          respondida: respostaComRespostas(payload),
        });
      }
      seq += 1;
    }
    resultado.leu = true;
  } catch {
    erros.value += 1;
  } finally {
    linhas.close();
  }
  return resultado;
}

function identidadeDoArquivo(arquivo) {
  const meta = arquivo.meta;
  const sessao =
    typeof meta?.session_id === 'string' && meta.session_id
      ? meta.session_id
      : typeof meta?.id === 'string' && meta.id
        ? meta.id
        : null;
  const ultimoTurno = arquivo.contextos.at(-1)?.turnId;
  const logica = sessao || meta?.parent_thread_id || ultimoTurno || basename(arquivo.caminho);
  const fluxo = basename(arquivo.caminho) || meta?.id || `${logica}:${ultimoTurno || 'fluxo'}`;
  return { logica, fluxo };
}

function chaveToken(logica, token) {
  return [
    logica,
    token.ts,
    token.uso.total,
    token.uso.input,
    token.uso.cacheRead,
    token.uso.output,
  ].join('|');
}

function chavePergunta(logica, pergunta) {
  if (pergunta.callId) return `${logica}|${pergunta.callId}`;
  return [logica, pergunta.ts, pergunta.ordinal, pergunta.perguntas].join('|');
}

function grupoDeFluxo(grupos, identidade) {
  let grupo = grupos.get(identidade.fluxo);
  if (!grupo) {
    grupo = {
      logica: identidade.logica,
      contextos: [],
      tokens: [],
    };
    grupos.set(identidade.fluxo, grupo);
  }
  return grupo;
}

function modeloNoMomento(contextos, evento) {
  let modelo = MODELO_DESCONHECIDO;
  for (const contexto of contextos) {
    if (ordenar(contexto, evento) > 0) break;
    modelo = contexto.modelo;
  }
  return modelo;
}

function adicionarModelo(modelos, modelo, tokens, chamadas) {
  const atual = modelos.get(modelo) || { modelo, tokens: 0, chamadas: 0 };
  atual.tokens += tokens;
  atual.chamadas += chamadas;
  modelos.set(modelo, atual);
}

function dataUtc(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function diasValidos(v) {
  const dias = Number(v);
  return Number.isFinite(dias) && dias > 0 ? dias : 14;
}

function agoraValido(v) {
  const ts = timestampMs(v);
  return ts === null ? Date.now() : ts;
}

export async function coletarTelemetriaCodex({
  dias = 14,
  agora = Date.now(),
  dirs = DIRETORIOS_PADRAO,
} = {}) {
  const diasNumero = diasValidos(dias);
  const agoraMs = agoraValido(agora);
  const limite = agoraMs - diasNumero * DIA_MS;
  const erros = { value: 0 };
  const diretorios = Array.isArray(dirs)
    ? dirs.filter((dir) => typeof dir === 'string' && dir)
    : [];
  const caminhos = [];
  const caminhosVistos = new Set();
  for (const diretorio of diretorios) {
    for (const caminho of await listarJsonl(diretorio, erros, limite)) {
      if (!caminhosVistos.has(caminho)) {
        caminhosVistos.add(caminho);
        caminhos.push(caminho);
      }
    }
  }

  const arquivos = [];
  let sourceMax = null;
  for (const caminho of caminhos) {
    const arquivo = await analisarArquivo(caminho, erros, agoraMs);
    if (arquivo.leu) arquivos.push(arquivo);
    if (
      arquivo.maiorTsAteAgora !== null &&
      (sourceMax === null || arquivo.maiorTsAteAgora > sourceMax)
    ) {
      sourceMax = arquivo.maiorTsAteAgora;
    }
  }

  const grupos = new Map();
  const tokensGlobaisVistos = new Set();
  const perguntas = new Map();
  const respostas = new Set();
  const sessoes = new Set();

  for (const arquivo of arquivos) {
    const identidade = identidadeDoArquivo(arquivo);
    const grupo = grupoDeFluxo(grupos, identidade);
    grupo.contextos.push(...arquivo.contextos);
    for (const token of arquivo.tokens) {
      const chave = chaveToken(identidade.logica, token);
      if (tokensGlobaisVistos.has(chave)) continue;
      tokensGlobaisVistos.add(chave);
      grupo.tokens.push(token);
    }
    for (const pergunta of arquivo.perguntas) {
      const chave = chavePergunta(identidade.logica, pergunta);
      if (!perguntas.has(chave))
        perguntas.set(chave, {
          ...pergunta,
          logica: identidade.logica,
        });
    }
    for (const resposta of arquivo.respostas) {
      if (resposta.respondida && resposta.ts !== null && resposta.ts <= agoraMs) {
        respostas.add(`${identidade.logica}|${resposta.callId}`);
      }
    }
    if (
      arquivo.tokens.some((token) => token.ts >= limite && token.ts <= agoraMs) ||
      arquivo.contextos.some((contexto) => contexto.ts >= limite && contexto.ts <= agoraMs) ||
      arquivo.respostas.some(
        (resposta) => resposta.ts !== null && resposta.ts >= limite && resposta.ts <= agoraMs,
      ) ||
      arquivo.perguntas.some((pergunta) => pergunta.ts >= limite && pergunta.ts <= agoraMs)
    ) {
      sessoes.add(identidade.logica);
    }
  }

  const totais = { chamadas: 0, tokens: 0, input: 0, cacheRead: 0, output: 0 };
  const modelos = new Map();
  for (const grupo of grupos.values()) {
    const contextos = [...grupo.contextos].sort(ordenar);
    const tokens = [...grupo.tokens].filter((token) => token.ts <= agoraMs).sort(ordenar);
    let anterior = null;
    for (const token of tokens) {
      const mudou = usoMudou(token.uso, anterior);
      const delta = deltaUso(token.uso, anterior);
      if (mudou && token.ts >= limite) {
        totais.chamadas += 1;
        totais.tokens += delta.total;
        totais.input += delta.input;
        totais.cacheRead += delta.cacheRead;
        totais.output += delta.output;
        adicionarModelo(modelos, modeloNoMomento(contextos, token), delta.total, 1);
      }
      anterior = token.uso;
    }
  }

  const porDia = new Map();
  for (const pergunta of perguntas.values()) {
    if (pergunta.ts < limite || pergunta.ts > agoraMs) continue;
    const data = dataUtc(pergunta.ts);
    const atual = porDia.get(data) || { data, perguntas: 0, respondidas: 0, pendentes: 0 };
    atual.perguntas += pergunta.perguntas;
    const respondida = pergunta.callId
      ? respostas.has(`${pergunta.logica}|${pergunta.callId}`)
      : false;
    if (respondida) atual.respondidas += pergunta.perguntas;
    else atual.pendentes += pergunta.perguntas;
    porDia.set(data, atual);
  }

  const porModelo = [...modelos.values()].sort(
    (a, b) => b.tokens - a.tokens || b.chamadas - a.chamadas || a.modelo.localeCompare(b.modelo),
  );
  return {
    gerado_em: new Date(agoraMs).toISOString(),
    dias: diasNumero,
    disponivel: arquivos.length > 0,
    arquivos_lidos: arquivos.length,
    erros_leitura: erros.value,
    sessoes: sessoes.size,
    chamadas: totais.chamadas,
    tokens: totais.tokens,
    input: totais.input,
    cache_read: totais.cacheRead,
    output: totais.output,
    por_modelo: porModelo,
    perguntas_por_dia: [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data)),
    source_max_ts: sourceMax === null ? null : new Date(sourceMax).toISOString(),
    cobertura_perguntas: {
      metodo: 'estrutural',
      functions_exec: 'somente_payload_estruturado',
    },
  };
}

export default coletarTelemetriaCodex;
