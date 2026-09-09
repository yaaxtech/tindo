#!/usr/bin/env node
/**
 * Empurrador do Painel do Harness → Supabase do TinDo.
 *
 * Lê o ledger local (90d), calcula métricas versionadas e publica somente
 * telemetria estruturada sem tarefa/nota/IDs. A página recebe uma fonte segura
 * para filtros antigos e métricas canônicas prontas para a migração do renderer.
 *
 * Reaproveita as funções e constantes de painel.mjs (fonte única, espelha o
 * ~/.claude/CLAUDE.md) — nada duplicado aqui.
 *
 * Uso: node publicar-painel.mjs   (roda de hora em hora via launchd)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { coletarAutonomia } from './autonomia.mjs';
import { coletar } from './janela.mjs';
import {
  HARNESS_METRIC_VERSION,
  HARNESS_SCHEMA_VERSION,
  construirPeriodos,
  extrairExecMin,
  filtrarHistoricoCompativel,
  resumoMarkdown,
  sanitizarLedger,
  saudeDosDados,
} from './metricas-snapshot.mjs';
import { normModelo } from './modelos.mjs';
import { ASSINATURAS, CADEIAS, janela, lerJsonl, prVelocidade, volumeCodigo } from './painel.mjs';
import { verificarParidade } from './paridade-terrenos.mjs';
import { coletarTelemetriaCodex } from './telemetria-codex.mjs';

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// GUARDA DE CLI — este arquivo é um SCRIPT, não um módulo: o corpo roda no
// topo e faz upsert do snapshot no Supabase de produção.
// Sem esta guarda, um simples `import` dispara tudo (incidente 2026-08-14,
// em que importar auditoria-harness.mjs enviou o e-mail semanal fora de hora).
{
  const alvo = process.argv[1] ? realpathSync(process.argv[1]) : '';
  if (alvo !== realpathSync(fileURLToPath(import.meta.url))) {
    throw new Error(
      'publicar-painel.mjs NÃO pode ser importado: o corpo faz upsert do snapshot no Supabase de produção. ' +
        'Rode como CLI.',
    );
  }
}

const DIR = join(homedir(), '.claude', 'orquestracao');
const LEDGER = join(DIR, 'ledger.jsonl');
const HISTORY = join(DIR, 'kpi-history.jsonl');
const RESUMO_MD = join(DIR, 'harness-resumo.md');
const ENV_FILE = '/Users/maiaemanuel/Apps YaaX/tindo/.env.local';

// Parse simples de .env (KEY=VALUE por linha, ignora comentários e aspas).
function lerEnv(file) {
  const out = {};
  for (const linha of readFileSync(file, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

async function main() {
  // Rede de paridade: o blob `cadeias` empurrado aqui é o MESMO CADEIAS que a
  // tela mostra. Se ele divergiu do defaults-terreno.json (fonte que o motor
  // escreve), a tela passa a mentir o titular/effort do terreno. Aviso ALTO,
  // mas NÃO bloqueia: um rótulo de cadeia defasado não vale escurecer o painel
  // inteiro (ledger/janela/autonomia perderiam a atualização horária). O
  // bloqueio duro fica no `node paridade-terrenos.mjs` (exit 1) e no e-mail
  // semanal da auditoria.
  const par = verificarParidade();
  if (!par.ok) {
    console.error(
      `⚠ paridade de terrenos QUEBRADA (${par.problemas.length}) — publicando mesmo assim:`,
    );
    for (const p of par.problemas) console.error(`   - ${p}`);
  }

  // Fonte local, 90d (folga sobre mês×mês). O ledger local permanece intacto.
  // Antes do upsert, a allowlist remove tarefa, nota, id e todo texto livre.
  const ledgerLocal = janela(lerJsonl(LEDGER), 90).map((r) => ({
    ...r,
    modelo: normModelo(r.modelo),
    exec_min: extrairExecMin(r.nota),
  }));
  const { publicados: ledger, rejeitados, rejeicoes_por_motivo } = sanitizarLedger(ledgerLocal);
  // Snapshots v1 misturavam construção, revisão e papéis ausentes. Ficam no
  // arquivo local para auditoria, mas não viajam como tendência confiável.
  const historyLocal = lerJsonl(HISTORY);
  const history = filtrarHistoricoCompativel(historyLocal).map(
    ({ nota: _nota, ...linha }) => linha,
  );
  const geradoEm = new Date().toISOString();
  const saude = {
    ...saudeDosDados(ledger, geradoEm, {
      recebidos: ledgerLocal.length,
      rejeitados,
      rejeicoes_por_motivo,
    }),
    historico_legado: historyLocal.length - history.length,
  };
  // Codex stays separate: token accounting and question classifications differ
  // from Claude; totals must not silently mix incompatible instruments.
  const lerCodex = async (dias) =>
    coletarTelemetriaCodex({ dias, agora: Date.parse(geradoEm) }).catch(() => ({
      disponivel: false,
      dias,
      gerado_em: geradoEm,
      arquivos_lidos: 0,
      erros_leitura: 1,
      sessoes: 0,
      chamadas: 0,
      tokens: 0,
      input: 0,
      cache_read: 0,
      output: 0,
      por_modelo: [],
      perguntas_por_dia: [],
      source_max_ts: null,
    }));
  const codex90 = await lerCodex(90);
  const codex14 = await lerCodex(14);
  const blob = {
    schema_version: HARNESS_SCHEMA_VERSION,
    metric_version: HARNESS_METRIC_VERSION,
    gerado_em: geradoEm,
    as_of: geradoEm,
    ledger,
    metricas_periodos: construirPeriodos(ledger, geradoEm),
    saude_dados: saude,
    history,
    volume_codigo: volumeCodigo(),
    prs: prVelocidade() || [],
    assinaturas: ASSINATURAS,
    cadeias: CADEIAS,
    // KPI de autonomia (§AUTONOMIA — 3 NÍVEIS): quanto o dono foi
    // interrompido e o quanto a interrupção valeu. Falha aqui não derruba a
    // publicação do resto do painel.
    autonomia: await coletarAutonomia(90)
      .then((d) => ({ ...d, codex: codex90 }))
      .catch((e) => {
        console.error('autonomia falhou (segue sem o card):', e.message);
        return null;
      }),
    janela: await coletar({ dias: 14, agora: Date.parse(geradoEm) })
      .then((d) => ({ ...d, codex: codex14 }))
      .catch((e) => ({
        erro: e.message,
        gerado_em: new Date().toISOString(),
      })),
  };

  const indiceDump = process.argv.indexOf('--dump');
  if (indiceDump >= 0) {
    if (!process.argv.includes('--dry-run') || !process.argv[indiceDump + 1]) {
      throw new Error('--dump exige --dry-run e caminho de arquivo');
    }
    writeFileSync(process.argv[indiceDump + 1], JSON.stringify(blob), { mode: 0o600 });
  }
  if (process.argv.includes('--dry-run')) {
    console.log(
      JSON.stringify(
        {
          schema_version: blob.schema_version,
          metric_version: blob.metric_version,
          gerado_em: blob.gerado_em,
          ledger_publicado: blob.ledger.length,
          texto_livre_publicado: blob.ledger.some((r) => 'tarefa' in r || 'nota' in r || 'id' in r),
          saude_dados: blob.saude_dados,
          periodos: Object.keys(blob.metricas_periodos),
          contexto_claude: blob.janela?.totais ?? null,
          contexto_codex: codex14,
          perguntas_codex: codex90.perguntas_por_dia,
          tokens_por_tarefa: blob.janela?.kpis?.tokens_por_tarefa ?? null,
        },
        null,
        2,
      ),
    );
    return;
  }

  const env = lerEnv(ENV_FILE);
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local');
    process.exit(1);
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/harness_snapshot`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: 'singleton',
      dados: blob,
      gerado_em: blob.gerado_em,
      updated_at: blob.gerado_em,
    }),
  });

  if (!resp.ok) {
    console.error('falha no upsert', resp.status, await resp.text());
    process.exit(1);
  }
  writeFileSync(RESUMO_MD, resumoMarkdown(blob), { mode: 0o600 });
  console.log(
    `painel publicado: ${ledger.length} eventos seguros (90d), ${history.length} snapshots, ` +
      `schema ${blob.schema_version}, métricas ${blob.metric_version}, gerado_em ${blob.gerado_em}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
