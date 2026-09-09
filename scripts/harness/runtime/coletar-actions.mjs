#!/usr/bin/env node
import assert from 'node:assert/strict';
/**
 * Coletor de minutos do GitHub Actions → Supabase do TinDo (bloco "Minutos"
 * do /harness).
 *
 * POR QUE RODA AQUI, E NÃO NO APP
 * O repo que queima a cota (seucamarao/seucamaraov1) é PRIVADO, e o minuto que
 * o GitHub fatura é tempo de JOB, não de run — o que exige uma requisição por
 * run. Nesta máquina o `gh` já está autenticado, então a coleta não precisa de
 * segredo novo no Cloudflare nem gasta rate limit do app.
 *
 * INCREMENTAL POR DESENHO
 * A primeira passada precisaria de ~4.500 requisições para cobrir 90 dias. Por
 * isso o estado fica em actions-coletados.json — já AGREGADO POR RUN, não só a
 * lista de ids: assim a agregação diária é recomputada sem tocar a API de novo.
 * Cada execução busca no máximo TETO_RUNS runs novas, das mais recentes para as
 * mais antigas; rodando de hora em hora, semeia os 90 dias em ~12h e depois
 * custa quase nada. Run sem `conclusion` nunca entra no estado — ainda vai
 * mudar.
 *
 * Uso: node coletar-actions.mjs   (roda de hora em hora via launchd)
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// GUARDA DE CLI — este arquivo é um SCRIPT, não um módulo: o corpo roda no
// topo e consome cota da API do GitHub e reescreve o estado coletado.
// Sem esta guarda, um simples `import` dispara tudo (incidente 2026-08-14,
// em que importar auditoria-harness.mjs enviou o e-mail semanal fora de hora).
{
  const alvo = process.argv[1] ? realpathSync(process.argv[1]) : '';
  if (alvo !== realpathSync(fileURLToPath(import.meta.url))) {
    throw new Error(
      'coletar-actions.mjs NÃO pode ser importado: o corpo consome cota da API do GitHub e reescreve o estado coletado. ' +
        'Rode como CLI.',
    );
  }
}

const execFileAsync = promisify(execFile);

const DIR = join(homedir(), '.claude', 'orquestracao');
const ESTADO = join(DIR, 'actions-coletados.json');
const ENV_FILE = '/Users/maiaemanuel/Apps YaaX/tindo/.env.local';

const REPOS = ['seucamarao/seucamaraov1', 'yaaxtech/tindo'];
const REPO_DESTINO = 'seucamarao/seucamaraov1'; // de quem lemos o disjuntor
const DIAS = 90;
// Teto de runs novas por passada. Sobrescrevível por env só para depuração —
// em produção o valor fixo é que mantém a passada previsível.
const TETO_RUNS = Number(process.env.ACTIONS_TETO ?? 400);
const CONCORRENCIA = 6;
const COTA_MIN = 2000;
const CUSTO_MIN_USD = 0.008;
const TOP_BRANCHES = 20;
const TOP_STEPS = 15;
const LIMITE_RESULTADOS_GITHUB = 1000;
const ESTADO_VERSAO = 2;

// ── utilidades ─────────────────────────────────────────────────────────────

/** Parse simples de .env (mesmo de publicar-painel.mjs). */
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

async function gh(args) {
  const { stdout } = await execFileAsync('gh', args, {
    maxBuffer: 64 * 1024 * 1024,
    timeout: 60000,
  });
  return stdout;
}

async function ghJson(args) {
  return JSON.parse(await gh(args));
}

/** Roda `tarefa` sobre `itens` com no máximo `limite` em voo. */
async function emLotes(itens, limite, tarefa) {
  const saida = [];
  let cursor = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (cursor < itens.length) {
      const meu = cursor++;
      saida[meu] = await tarefa(itens[meu]);
    }
  });
  await Promise.all(trabalhadores);
  return saida;
}

const diaDe = (iso) => iso.slice(0, 10);

/** Minuto faturável do GitHub: ceil por job, mínimo 1. Espelha actions.ts. */
function minutosDoJob(job) {
  if (job.conclusion === 'skipped' || !job.started_at || !job.completed_at) return null;
  const inicio = Date.parse(job.started_at);
  const fim = Date.parse(job.completed_at);
  if (Number.isNaN(inicio) || Number.isNaN(fim) || fim < inicio) return null;
  return Math.max(1, Math.ceil((fim - inicio) / 60_000));
}

/** Runner cujo nome contém `mac-` é self-hosted (grátis). Espelha actions.ts. */
const ehMac = (nome) => Boolean(nome?.toLowerCase().includes('mac-'));

function percentil(ordenados, p) {
  if (ordenados.length === 0) return null;
  if (p === 0.5) return ordenados[Math.floor(ordenados.length / 2)] ?? null;
  return ordenados[Math.min(ordenados.length - 1, Math.ceil(p * ordenados.length) - 1)] ?? null;
}

// ── estado local ───────────────────────────────────────────────────────────

function normalizarEstado(bruto) {
  if (!bruto || typeof bruto.runs !== 'object') return { versao: ESTADO_VERSAO, runs: {} };
  if (bruto.versao === ESTADO_VERSAO) return bruto;

  // v1 contava cancelamentos ainda na fila como minutos de nuvem. Como o
  // agregado não guarda runner_id, invalida só runs com cancelamento e as
  // recoleta; preserva o restante do histórico durante o upgrade.
  const runs = Object.fromEntries(
    Object.entries(bruto.runs).filter(([, run]) => Number(run.jobs_cancelado ?? 0) === 0),
  );
  return { versao: ESTADO_VERSAO, runs };
}

function lerEstado() {
  if (!existsSync(ESTADO)) return normalizarEstado(null);
  try {
    return normalizarEstado(JSON.parse(readFileSync(ESTADO, 'utf8')));
  } catch {
    // Estado corrompido não pode travar a coleta: recomeça do zero.
    return normalizarEstado(null);
  }
}

function gravarEstado(estado, corte) {
  const podado = {};
  for (const [id, run] of Object.entries(estado.runs)) {
    if (Date.parse(`${run.dia}T23:59:59Z`) >= corte) podado[id] = run;
  }
  writeFileSync(ESTADO, JSON.stringify({ versao: ESTADO_VERSAO, runs: podado }), 'utf8');
  return podado;
}

// ── coleta ─────────────────────────────────────────────────────────────────

async function buscarPaginaRuns(repo, inicioIso, fimIso, pagina) {
  const faixa = encodeURIComponent(`${inicioIso}..${fimIso}`);
  return ghJson([
    'api',
    `/repos/${repo}/actions/runs?per_page=100&page=${pagina}&created=${faixa}`,
    '--jq',
    '{total_count, runs: [.workflow_runs[] | {id, name, event, head_branch, head_sha, conclusion, created_at, run_started_at, updated_at, pull_requests: [.pull_requests[]? | {number}]}]}',
  ]);
}

/**
 * O endpoint de workflow runs limita consultas filtradas a 1.000 resultados.
 * Divide a janela de 90 dias até cada intervalo caber no limite e só então
 * pagina. Assim um mês movimentado não apaga silenciosamente runs antigas.
 */
async function listarRuns(repo, corteIso, buscarPagina = buscarPaginaRuns) {
  const inicioSeg = Math.ceil(Date.parse(corteIso) / 1000);
  const fimSeg = Math.floor(Date.now() / 1000);
  const intervalos = [{ inicioSeg, fimSeg }];
  const porId = new Map();

  while (intervalos.length > 0) {
    const intervalo = intervalos.pop();
    if (!intervalo || intervalo.inicioSeg > intervalo.fimSeg) continue;
    const inicioIso = new Date(intervalo.inicioSeg * 1000).toISOString();
    const fimIso = new Date(intervalo.fimSeg * 1000).toISOString();
    const primeira = await buscarPagina(repo, inicioIso, fimIso, 1);
    const total = Number(primeira.total_count ?? primeira.runs?.length ?? 0);

    if (total > LIMITE_RESULTADOS_GITHUB) {
      if (intervalo.inicioSeg === intervalo.fimSeg) {
        throw new Error(
          `mais de ${LIMITE_RESULTADOS_GITHUB} workflow runs no mesmo segundo; não é possível paginar sem perda`,
        );
      }
      const meio = Math.floor((intervalo.inicioSeg + intervalo.fimSeg) / 2);
      intervalos.push({ inicioSeg: intervalo.inicioSeg, fimSeg: meio });
      intervalos.push({ inicioSeg: meio + 1, fimSeg: intervalo.fimSeg });
      continue;
    }

    const paginas = Math.max(1, Math.ceil(total / 100));
    for (const run of primeira.runs ?? []) porId.set(run.id, run);
    for (let pagina = 2; pagina <= paginas; pagina++) {
      const json = await buscarPagina(repo, inicioIso, fimIso, pagina);
      for (const run of json.runs ?? []) porId.set(run.id, run);
    }
  }

  return [...porId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Um run vira uma linha agregada; null quando ainda não há job utilizável. */
async function buscarJobsRun(repo, run) {
  // gh does not allow --slurp together with --jq. Flatten pages in Node.
  const paginas = await ghJson([
    'api',
    `/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`,
    '--paginate',
    '--slurp',
  ]);
  return { jobs: paginas.flatMap((pagina) => pagina.jobs ?? []) };
}

async function agregarRun(repo, run, buscarJobs = buscarJobsRun) {
  const jobs = await buscarJobs(repo, run);
  const listaJobs = jobs.jobs ?? [];

  const linha = {
    repo,
    dia: diaDe(run.created_at),
    // Hora UTC em que a run foi enfileirada. Guardada explicitamente porque
    // `dia` sozinho não a carrega — derivar a hora de `dia` daria 0 sempre, e
    // o KPI de hora de pico apontaria meia-noite todo dia.
    hora: new Date(run.created_at).getUTCHours(),
    branch: run.head_branch ?? '(sem branch)',
    workflow: run.name ?? '(sem nome)',
    min_nuvem: 0,
    min_mac: 0,
    min_perdido: 0,
    jobs: 0,
    jobs_falha: 0,
    jobs_cancelado: 0,
    fila: [],
    steps: {},
  };

  let todosIgnoraveisTerminais =
    listaJobs.length > 0 || ['cancelled', 'skipped'].includes(run.conclusion);
  for (const job of listaJobs) {
    // Cancelado ainda na fila não recebeu runner e não gerou minuto faturável.
    // Sem este gate, timestamps de fila eram classificados como nuvem.
    if (!job.runner_id || !job.runner_name) {
      if (job.conclusion !== 'cancelled' && job.conclusion !== 'skipped') {
        todosIgnoraveisTerminais = false;
      }
      continue;
    }
    const min = minutosDoJob(job);
    if (min == null) {
      if (job.conclusion !== 'skipped') todosIgnoraveisTerminais = false;
      continue;
    }
    todosIgnoraveisTerminais = false;
    linha.jobs += 1;
    if (ehMac(job.runner_name)) linha.min_mac += min;
    else linha.min_nuvem += min;
    if (job.conclusion === 'failure') linha.jobs_falha += 1;
    if (job.conclusion === 'cancelled') linha.jobs_cancelado += 1;
    if (job.conclusion === 'failure' || job.conclusion === 'cancelled') linha.min_perdido += min;

    // Fila = quanto o job esperou por um slot antes de começar.
    if (job.created_at && job.started_at) {
      const espera = (Date.parse(job.started_at) - Date.parse(job.created_at)) / 1000;
      if (Number.isFinite(espera) && espera >= 0) linha.fila.push(Math.round(espera));
    }

    for (const step of job.steps ?? []) {
      if (!step.started_at || !step.completed_at) continue;
      const seg = (Date.parse(step.completed_at) - Date.parse(step.started_at)) / 1000;
      if (!Number.isFinite(seg) || seg < 0) continue;
      linha.steps[step.name] = (linha.steps[step.name] ?? 0) + Math.round(seg);
    }
  }

  // Uma run concluída só com jobs cancelados/skipped antes de receber runner
  // vale zero, mas precisa ser persistida para não consumir o teto eternamente.
  return linha.jobs > 0 || todosIgnoraveisTerminais ? linha : null;
}

/** branch → {virou_pr, mergeado} + total de PRs mergeados no ciclo. */
async function mapearPrs(repo, corteIso, cicloInicio) {
  const porBranch = new Map();
  const porNumero = new Map();
  const porSha = new Map();
  let mergeadosNoCiclo = 0;
  for (let pagina = 1; ; pagina++) {
    const json = await ghJson([
      'api',
      `/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100&page=${pagina}`,
      '--jq',
      '{prs: [.[] | {number, ref: .head.ref, sha: .head.sha, created_at, merged_at, updated_at}]}',
    ]);
    const pag = json.prs ?? [];
    if (pag.length === 0) break;
    let passou = false;
    for (const pr of pag) {
      if (pr.updated_at < corteIso) {
        passou = true;
        continue;
      }
      porNumero.set(pr.number, pr);
      if (pr.sha) porSha.set(pr.sha, pr);
      const atual = porBranch.get(pr.ref) ?? { virou_pr: true, mergeado: false };
      atual.mergeado = atual.mergeado || Boolean(pr.merged_at);
      porBranch.set(pr.ref, atual);
      if (pr.merged_at && pr.merged_at >= cicloInicio) mergeadosNoCiclo += 1;
    }
    if (passou || pag.length < 100) break;
  }
  return { porBranch, porNumero, porSha, mergeadosNoCiclo };
}

async function lerDestino() {
  try {
    const saida = await gh(['variable', 'list', '--repo', REPO_DESTINO, '--json', 'name,value']);
    const vars = JSON.parse(saida);
    const achar = (nome) => vars.find((v) => v.name === nome)?.value ?? null;
    return { RUNNER_CI: achar('RUNNER_CI'), RUNNER_LEVE: achar('RUNNER_LEVE') };
  } catch {
    return { RUNNER_CI: null, RUNNER_LEVE: null };
  }
}

// ── montagem do blob ───────────────────────────────────────────────────────

function montarBlob(runs, prsPorRepo, mergeadosCiclo, cicloInicio, destino, parcial) {
  const porDia = new Map();
  const porBranch = new Map();
  const porStep = new Map();
  const porHora = new Map();

  for (const run of Object.values(runs)) {
    const chave = `${run.repo}|${run.dia}`;
    const dia = porDia.get(chave) ?? {
      dia: run.dia,
      repo: run.repo,
      min_faturado: 0,
      min_mac: 0,
      runs: 0,
      jobs: 0,
      jobs_falha: 0,
      jobs_cancelado: 0,
      min_perdido: 0,
      fila_seg: [],
    };
    dia.min_faturado += run.min_nuvem;
    dia.min_mac += run.min_mac;
    dia.runs += 1;
    dia.jobs += run.jobs;
    dia.jobs_falha += run.jobs_falha;
    dia.jobs_cancelado += run.jobs_cancelado;
    dia.min_perdido += run.min_perdido;
    dia.fila_seg.push(...run.fila);
    porDia.set(chave, dia);

    // Branches, steps e fila por hora contam só o CICLO (mês corrente).
    if (run.dia < cicloInicio.slice(0, 10)) continue;

    const chaveBranch = `${run.repo}|${run.branch}`;
    const b = porBranch.get(chaveBranch) ?? {
      repo: run.repo,
      branch: run.branch,
      runs: 0,
      min_total: 0,
      virou_pr: false,
      mergeado: false,
    };
    const pr = prsPorRepo.get(run.repo)?.get(run.branch);
    b.runs += 1;
    b.min_total += run.min_nuvem + run.min_mac;
    b.virou_pr = b.virou_pr || Boolean(pr?.virou_pr);
    b.mergeado = b.mergeado || Boolean(pr?.mergeado);
    porBranch.set(chaveBranch, b);

    for (const [nome, seg] of Object.entries(run.steps)) {
      const s = porStep.get(nome) ?? { nome, seg_total: 0, n: 0 };
      s.seg_total += seg;
      s.n += 1;
      porStep.set(nome, s);
    }

    const hora = run.hora ?? 0;
    for (const seg of run.fila) {
      const h = porHora.get(hora) ?? [];
      h.push(seg);
      porHora.set(hora, h);
    }
  }

  return {
    gerado_em: new Date().toISOString(),
    ciclo_inicio: cicloInicio.slice(0, 10),
    cota_min: COTA_MIN,
    custo_min_usd: CUSTO_MIN_USD,
    repos: REPOS,
    dias: [...porDia.values()].sort((a, b) => (a.dia < b.dia ? 1 : -1)),
    branches: [...porBranch.values()]
      .sort((a, b) => b.min_total - a.min_total)
      .slice(0, TOP_BRANCHES),
    steps: [...porStep.values()].sort((a, b) => b.seg_total - a.seg_total).slice(0, TOP_STEPS),
    fila_por_hora: [...porHora.entries()]
      .map(([hora, amostras]) => {
        const ord = [...amostras].sort((a, b) => a - b);
        return { hora, p50: percentil(ord, 0.5), p90: percentil(ord, 0.9), n: ord.length };
      })
      .sort((a, b) => a.hora - b.hora),
    prs_mergeados_ciclo: mergeadosCiclo,
    destino,
    parcial,
  };
}

// Only the existing public run contract; never PR titles or commit messages.
function normalizarRuns(repo, runs, porNumero, porSha, coletadoEm, todos = false) {
  return runs
    .filter((r) => todos || r.event === 'push' || r.event === 'pull_request')
    .map((run) => {
      const numero = run.pull_requests?.[0]?.number;
      const pr = porSha.get(run.head_sha) || porNumero.get(numero);
      return {
        run_id: run.id,
        repo,
        evento: run.event,
        branch: run.head_branch ?? null,
        head_sha: run.head_sha ?? null,
        conclusao: run.conclusion ?? null,
        criado_em: run.created_at,
        iniciado_em: run.run_started_at ?? null,
        atualizado_em: run.updated_at ?? null,
        pr_numero: pr?.number ?? numero ?? null,
        pr_criado_em: pr?.created_at ?? null,
        pr_merged_em: pr?.merged_at ?? null,
        coletado_em: coletadoEm,
      };
    });
}

// ── principal ──────────────────────────────────────────────────────────────

async function main() {
  const agora = Date.now();
  const corte = agora - DIAS * 864e5;
  const corteIso = new Date(corte).toISOString();
  const cicloInicio = new Date(
    Date.UTC(new Date(agora).getUTCFullYear(), new Date(agora).getUTCMonth(), 1),
  ).toISOString();

  const estado = lerEstado();
  const indiceInventario = process.argv.indexOf('--inventario');
  const inventario =
    indiceInventario >= 0
      ? JSON.parse(readFileSync(process.argv[indiceInventario + 1], 'utf8'))
      : null;
  if (inventario !== null && !Array.isArray(inventario))
    throw new Error('Inventário de runs inválido');
  const prsPorRepo = new Map();
  let mergeadosCiclo = 0;
  const avisos = [];
  const runsBrutas = [];
  const inventarioCompleto = [];
  let novas = 0;
  let quotaEsgotada = false;
  let consultasFalharam = false;
  let restante = TETO_RUNS;

  for (const repo of REPOS) {
    try {
      const { porBranch, porNumero, porSha, mergeadosNoCiclo } = await mapearPrs(
        repo,
        corteIso,
        cicloInicio,
      );
      prsPorRepo.set(repo, porBranch);
      mergeadosCiclo += mergeadosNoCiclo;

      const runs =
        inventario === null
          ? await listarRuns(repo, corteIso)
          : inventario
              .filter((r) => r.repo === repo && r.criado_em >= corteIso)
              .map((r) => ({
                id: r.run_id,
                event: r.evento,
                head_branch: r.branch,
                head_sha: r.head_sha,
                conclusion: r.conclusao,
                created_at: r.criado_em,
                run_started_at: r.iniciado_em,
                updated_at: r.atualizado_em,
                pull_requests: r.pr_numero ? [{ number: r.pr_numero }] : [],
              }));
      const coletadoEm = new Date().toISOString();
      runsBrutas.push(...normalizarRuns(repo, runs, porNumero, porSha, coletadoEm));
      inventarioCompleto.push(...normalizarRuns(repo, runs, porNumero, porSha, coletadoEm, true));
      const todosPendentes = runs.filter((r) => r.conclusion && !estado.runs[r.id]);
      // Reserve a share for each repository; a busy repo must not starve TinDo.
      const reserva = Math.ceil(restante / (REPOS.length - REPOS.indexOf(repo)));
      const pendentes = todosPendentes.slice(0, Math.max(0, reserva));
      if (todosPendentes.length > pendentes.length) {
        avisos.push(
          `${repo}: ${todosPendentes.length - pendentes.length} runs aguardam próxima coleta de jobs`,
        );
      }
      restante -= pendentes.length;

      const linhas = await emLotes(pendentes, CONCORRENCIA, async (run) => {
        if (quotaEsgotada) return [run.id, null];
        try {
          return [run.id, await agregarRun(repo, run)];
        } catch (e) {
          const motivo = e instanceof Error ? e.message : String(e);
          if (/API rate limit exceeded|secondary rate limit/i.test(motivo)) quotaEsgotada = true;
          console.error(`falha ao coletar run ${run.id}: ${motivo}`);
          return [
            run.id,
            null,
            quotaEsgotada
              ? 'limite da API do GitHub; coleta será retomada'
              : 'falha na leitura dos jobs; coleta será retomada',
          ];
        }
      });
      for (const [id, linha, erro] of linhas) {
        if (erro) {
          avisos.push(`run ${id}: ${erro}`);
          continue;
        }
        if (linha) {
          estado.runs[id] = linha;
          novas += 1;
        }
      }
    } catch (e) {
      consultasFalharam = true;
      console.error(`coleta de ${repo} falhou:`, e instanceof Error ? e.message : String(e));
      avisos.push(`${repo}: consulta indisponível; histórico incompleto`);
    }
  }

  const runsPodadas = gravarEstado(estado, corte);
  const destino = await lerDestino();
  const blob = montarBlob(
    runsPodadas,
    prsPorRepo,
    mergeadosCiclo,
    cicloInicio,
    destino,
    avisos.length > 0 ? avisos.slice(0, 3).join(' · ') : null,
  );

  // `--dump <arquivo>` grava o blob e NÃO publica: serve para conferir os
  // números a olho antes de mexer no que a tela mostra.
  const alvoDump = process.argv[process.argv.indexOf('--dump') + 1];
  if (process.argv.includes('--dump') && alvoDump) {
    writeFileSync(alvoDump, JSON.stringify(blob, null, 2), 'utf8');
    writeFileSync(`${alvoDump}.runs.json`, JSON.stringify(runsBrutas), { mode: 0o600 });
    writeFileSync(`${alvoDump}.inventario.json`, JSON.stringify(inventarioCompleto), {
      mode: 0o600,
    });
    console.log(`blob gravado em ${alvoDump} (sem publicar)`);
    return;
  }

  // Keep the last successful public snapshot when repository metadata could
  // not be refreshed. Missing PR input must not become zero with a fresh date.
  if (consultasFalharam) {
    console.error('Consulta de repositórios incompleta; snapshot anterior preservado.');
    process.exitCode = 1;
    return;
  }
  const env = lerEnv(ENV_FILE);
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
  if (inventario !== null)
    throw new Error('Inventário só pode ser usado com --dump; publicação requer coleta atual');
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local');
    process.exit(1);
  }

  // Timestamp is refreshed on every actual collection, including already known runs.
  for (let i = 0; i < runsBrutas.length; i += 400) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/harness_github_runs?on_conflict=run_id`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(runsBrutas.slice(i, i + 400)),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(`publicação de execuções GitHub falhou: HTTP ${response.status}`);
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/harness_actions_snapshot`, {
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

  console.log(
    `actions publicado: ${runsBrutas.length} execuções atualizadas; +${novas} runs novas, ${Object.keys(runsPodadas).length} no estado, ${blob.dias.length} dias, destino CI=${destino.RUNNER_CI ?? '?'}${blob.parcial ? ` — parcial: ${blob.parcial}` : ''}`,
  );
}

async function selfTest() {
  const agora = Date.now();
  let paginasDois = 0;
  const runs = await listarRuns(
    'org/repo',
    new Date(agora - 3000).toISOString(),
    async (_repo, inicioIso, fimIso, pagina) => {
      const inicio = Math.ceil(Date.parse(inicioIso) / 1000);
      const fim = Math.floor(Date.parse(fimIso) / 1000);
      if (fim - inicio >= 1) return { total_count: 1001, runs: [] };
      if (pagina === 2) paginasDois += 1;
      const quantidade = pagina === 1 ? 100 : 50;
      return {
        total_count: 150,
        runs: Array.from({ length: quantidade }, (_, i) => ({
          id: `${inicio}-${pagina}-${i}`,
          created_at: new Date(inicio * 1000).toISOString(),
        })),
      };
    },
  );
  assert.ok(paginasDois >= 3, 'deve dividir a janela que excede 1.000 resultados');
  assert.equal(runs.length, paginasDois * 150, 'deve paginar cada subintervalo sem truncar');

  const agregado = await agregarRun(
    'org/repo',
    { id: 1, created_at: '2026-08-16T00:00:00Z' },
    async () => ({
      jobs: [
        {
          conclusion: 'cancelled',
          runner_id: null,
          runner_name: '',
          started_at: '2026-08-16T00:00:00Z',
          completed_at: '2026-08-16T00:01:00Z',
        },
        {
          conclusion: 'success',
          runner_id: 9,
          runner_name: 'GitHub Actions 9',
          started_at: '2026-08-16T00:00:00Z',
          completed_at: '2026-08-16T00:00:30Z',
          steps: [],
        },
      ],
    }),
  );
  assert.equal(agregado.jobs, 1, 'job sem runner não entra na contagem');
  assert.equal(agregado.min_nuvem, 1, 'job de nuvem com runner continua faturável');
  assert.equal(agregado.jobs_cancelado, 0, 'cancelamento sem runner não vira desperdício');

  const canceladaSemJobs = await agregarRun(
    'org/repo',
    { id: 9, conclusion: 'cancelled', created_at: '2026-09-01T00:00:00Z' },
    async () => ({ jobs: [] }),
  );
  assert.equal(canceladaSemJobs.jobs, 0, 'cancelamento sem jobs termina a coleta como zero medido');

  const somenteCancelada = await agregarRun(
    'org/repo',
    { id: 2, created_at: '2026-08-16T00:00:00Z' },
    async () => ({
      jobs: [
        {
          conclusion: 'cancelled',
          runner_id: 0,
          runner_name: '',
          started_at: '2026-08-16T00:00:00Z',
          completed_at: '2026-08-16T00:05:00Z',
        },
      ],
    }),
  );
  assert.ok(somenteCancelada, 'run terminal de zero minuto deve ser persistível');
  assert.equal(somenteCancelada.jobs, 0);
  assert.equal(somenteCancelada.min_nuvem, 0);

  const migrado = normalizarEstado({
    runs: {
      contaminado: { jobs_cancelado: 1, min_nuvem: 50 },
      preservado: { jobs_cancelado: 0, min_nuvem: 2 },
    },
  });
  assert.equal(migrado.versao, ESTADO_VERSAO);
  assert.equal(migrado.runs.contaminado, undefined, 'v1 cancelada deve ser recoletada');
  assert.equal(migrado.runs.preservado.min_nuvem, 2, 'v1 sem cancelamento deve ser preservada');
  const cru = normalizarRuns(
    'org/repo',
    [
      {
        id: 4,
        event: 'push',
        head_sha: 'sha',
        created_at: '2026-09-01T10:00:00Z',
        title: 'private',
      },
      { id: 5, event: 'workflow_dispatch', created_at: '2026-09-01T10:00:00Z' },
    ],
    new Map(),
    new Map([['sha', { number: 3, created_at: '2026-09-01T09:00:00Z', merged_at: null }]]),
    '2026-09-09T00:00:00Z',
  );
  assert.equal(cru.length, 1);
  assert.equal(cru[0].pr_numero, 3);
  assert.equal(cru[0].coletado_em, '2026-09-09T00:00:00Z');
  assert.equal('title' in cru[0], false);
  console.log('self-test coletar-actions: ok');
}

const executar = process.argv.includes('--self-test') ? selfTest : main;
executar().catch((e) => {
  console.error(e);
  process.exit(1);
});
