#!/usr/bin/env node
/**
 * Coletor do KPI de AUTONOMIA (§AUTONOMIA — 3 NÍVEIS do CLAUDE.md).
 *
 * Mede quanto o dono precisa ser interrompido e o quanto essa interrupção
 * valeu. Duas fontes:
 *   1. Transcripts (~/.claude/projects/**\/*.jsonl) — toda chamada do
 *      AskUserQuestion pareada com a resposta dele.
 *   2. Fila do SeuCamarão (backlog_itens) — decisões carimbadas no nível 2
 *      (`links.autonomia='n2'`) e quantas ele mandou desfazer
 *      (`links.desfeita=true`). Opcional: só roda se achar o .env.local.
 *
 * Classificação de cada pergunta respondida:
 *   aceitou      — clicou na 1ª opção (a recomendada)
 *   outra        — clicou em outra opção da lista
 *   corrigiu     — respondeu por fora: trouxe regra de negócio que só ele sabe
 *   ignorou      — dispensou a pergunta sem responder
 * "corrigiu" é o sinal de que a pergunta VALEU; "aceitou" alto demais é sinal
 * de pergunta que não precisava existir.
 *
 * Uso: node autonomia.mjs [--dias 90]   → imprime o JSON do card
 * Também exporta coletarAutonomia() para o publicar-painel.mjs.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJETOS = join(homedir(), '.claude', 'projects');
const ENV_SEUCAMARAO = '/Users/maiaemanuel/Apps YaaX/SeuCamarao App/.env.local';

// Tira emoji, "(Recomendado)" e espaço duplo — o label do botão e o texto que
// volta na resposta nem sempre batem caractere a caractere.
const norm = (s) =>
  (s || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\u{FE0F}/gu, '')
    .replace(/\(recomendado\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

function listarJsonl(dir, corte, out = []) {
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entradas) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listarJsonl(p, corte, out);
    else if (e.name.endsWith('.jsonl')) {
      try {
        if (statSync(p).mtimeMs >= corte) out.push(p);
      } catch {
        /* arquivo sumiu no meio da varredura */
      }
    }
  }
  return out;
}

/** Pares `"pergunta"="resposta"` que o harness devolve no tool_result. */
function parearRespostas(txt) {
  const pares = new Map();
  const re = /"([^"]{5,})"="([^"]*)"/g;
  let m = re.exec(txt);
  while (m) {
    pares.set(m[1].trim(), m[2].trim());
    m = re.exec(txt);
  }
  return pares;
}

export function coletarPerguntas(dias = 90) {
  const corte = Date.now() - dias * 864e5;
  const porDia = new Map();
  const dia = (d) => {
    if (!porDia.has(d)) {
      porDia.set(d, {
        data: d,
        perguntas: 0,
        aceitou: 0,
        outra: 0,
        corrigiu: 0,
        ignorou: 0,
        esperas_longas: 0,
        espera_min: [],
      });
    }
    return porDia.get(d);
  };

  for (const f of listarJsonl(PROJETOS, corte)) {
    let raw;
    try {
      raw = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    if (!raw.includes('"AskUserQuestion"')) continue;
    const linhas = raw.split('\n');

    const asks = new Map();
    for (const linha of linhas) {
      if (!linha.includes('AskUserQuestion')) continue;
      let o;
      try {
        o = JSON.parse(linha);
      } catch {
        continue;
      }
      const conteudo = o.message?.content;
      if (!Array.isArray(conteudo)) continue;
      for (const c of conteudo) {
        if (c.type === 'tool_use' && c.name === 'AskUserQuestion') {
          asks.set(c.id, { input: c.input, ts: o.timestamp });
        }
      }
    }
    if (!asks.size) continue;

    for (const linha of linhas) {
      if (!linha.includes('tool_result')) continue;
      let o;
      try {
        o = JSON.parse(linha);
      } catch {
        continue;
      }
      const conteudo = o.message?.content;
      if (!Array.isArray(conteudo)) continue;
      for (const c of conteudo) {
        if (c.type !== 'tool_result' || !asks.has(c.tool_use_id)) continue;
        const a = asks.get(c.tool_use_id);
        a.resp = c.content;
        a.ts2 = o.timestamp;
      }
    }

    for (const [, a] of asks) {
      if (!a.ts || new Date(a.ts).getTime() < corte) continue;
      const d = dia(a.ts.slice(0, 10));
      let txt = '';
      if (typeof a.resp === 'string') txt = a.resp;
      else if (Array.isArray(a.resp)) txt = a.resp.map((x) => x.text || '').join('\n');
      const pares = parearRespostas(txt);

      // Espera = pergunta na tela → resposta. Acima de 12h é sessão dormindo,
      // não espera real: não entra na mediana nem no contador.
      let espera = null;
      if (a.ts && a.ts2) {
        const min = (new Date(a.ts2) - new Date(a.ts)) / 60000;
        if (min >= 0 && min < 720) espera = min;
      }

      for (const q of a.input?.questions || []) {
        const labels = (q.options || []).map((o) => o.label).filter(Boolean);
        const primeira = labels[0] || '';
        let resposta = null;
        for (const [k, v] of pares) {
          if (norm(k).slice(0, 40) === norm(q.question).slice(0, 40)) {
            resposta = v;
            break;
          }
        }
        if (resposta === null) continue; // pergunta sem resposta pareável

        d.perguntas++;
        if (espera !== null) {
          d.espera_min.push(espera);
          if (espera > 60) d.esperas_longas++;
        }
        const r = norm(resposta);
        if (/user dismissed|do not proceed/.test(r)) d.ignorou++;
        else if (r === norm(primeira)) d.aceitou++;
        else if (labels.some((l) => norm(l) === r)) d.outra++;
        else d.corrigiu++;
      }
    }
  }

  return [...porDia.values()]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(({ espera_min, ...resto }) => {
      const s = [...espera_min].sort((a, b) => a - b);
      return {
        ...resto,
        espera_mediana_min: s.length ? Math.round(s[Math.floor(s.length / 2)]) : null,
        espera_p90_min: s.length ? Math.round(s[Math.floor(s.length * 0.9)]) : null,
      };
    });
}

/** Decisões carimbadas no N2, direto da fila do SeuCamarão. */
export async function coletarN2(dias = 90) {
  let env;
  try {
    env = readFileSync(ENV_SEUCAMARAO, 'utf8');
  } catch {
    return null; // sem .env.local (sessão de nuvem) — card sai sem o N2
  }
  const val = (k) =>
    (env.match(new RegExp(`^${k}\\s*=\\s*(.*)$`, 'm'))?.[1] || '')
      .trim()
      .replace(/^['"]|['"]$/g, '');
  const url = val('VITE_SUPABASE_URL');
  const key = val('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;

  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const resp = await fetch(
    `${url}/rest/v1/backlog_itens?select=id,created_at,links&links->>autonomia=eq.n2&created_at=gte.${desde}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!resp.ok) return null;
  const itens = await resp.json();
  return {
    carimbadas: itens.length,
    desfeitas: itens.filter((i) => i.links?.desfeita === true).length,
    por_dia: itens.reduce((acc, i) => {
      const d = (i.created_at || '').slice(0, 10);
      acc[d] = acc[d] || { carimbadas: 0, desfeitas: 0 };
      acc[d].carimbadas++;
      if (i.links?.desfeita === true) acc[d].desfeitas++;
      return acc;
    }, {}),
  };
}

export async function coletarAutonomia(dias = 90) {
  return {
    dias,
    gerado_em: new Date().toISOString(),
    perguntas_por_dia: coletarPerguntas(dias),
    n2: await coletarN2(dias).catch(() => null),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--dias');
  const dias = i > -1 ? Number(process.argv[i + 1]) : 90;
  const dados = await coletarAutonomia(dias);
  const t = dados.perguntas_por_dia.reduce(
    (a, d) => ({
      perguntas: a.perguntas + d.perguntas,
      aceitou: a.aceitou + d.aceitou,
      outra: a.outra + d.outra,
      corrigiu: a.corrigiu + d.corrigiu,
      ignorou: a.ignorou + d.ignorou,
      esperas_longas: a.esperas_longas + d.esperas_longas,
    }),
    { perguntas: 0, aceitou: 0, outra: 0, corrigiu: 0, ignorou: 0, esperas_longas: 0 },
  );
  const pct = (n) => (t.perguntas ? `${Math.round((n / t.perguntas) * 100)}%` : '—');
  console.log(
    JSON.stringify(
      {
        janela_dias: dias,
        dias_com_pergunta: dados.perguntas_por_dia.length,
        ...t,
        aceite: pct(t.aceitou),
        correcoes: pct(t.corrigiu),
        n2: dados.n2,
      },
      null,
      2,
    ),
  );
}
