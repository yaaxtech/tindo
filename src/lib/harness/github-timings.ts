import type {
  GithubRunLinha,
  ResumoGithub,
  ResumoSegmento,
  SegmentoGithub,
  SemanaGithub,
} from '@/types/harness';

// Fatia os tempos que o GitHub Actions já grava nos 4 trechos que dá para
// encurtar separadamente. Lib PURA: zero I/O, `agora` sempre injetável.
//
// Os 4 segmentos são DISJUNTOS de propósito — somar dois nunca conta o mesmo
// relógio duas vezes:
//   fila_ci      todo run (PR e push): esperou runner livre
//   exec_ci      só runs de pull_request: o CI rodando
//   espera_merge uma vez por PR mergeado: ficou verde e parado
//   deploy       só runs de push no branch padrão: cf:build + publish
//
// Toda diferença negativa (relógio torto do runner) vira null, nunca número
// negativo — um segmento negativo envenenaria a mediana em silêncio.

const DIA_MS = 864e5;
const SEMANA_MS = 7 * DIA_MS;

export const SEGMENTOS: readonly SegmentoGithub[] = [
  'fila_ci',
  'exec_ci',
  'espera_merge',
  'deploy',
] as const;

/** Rótulos em PT-BR leigo — a tela do painel consome estes. */
export const ROTULO_SEGMENTO: Record<SegmentoGithub, string> = {
  fila_ci: 'Fila do CI',
  exec_ci: 'Execução do CI',
  espera_merge: 'Espera pelo merge',
  deploy: 'Publicação',
};

const VAZIO: ResumoSegmento = { p50: null, p90: null, n: 0 };

/** Segundos entre dois instantes ISO. null se falta ponta, é inválido ou negativo. */
export function deltaSegundos(inicio: string | null, fim: string | null): number | null {
  if (!inicio || !fim) return null;
  const a = Date.parse(inicio);
  const b = Date.parse(fim);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const s = (b - a) / 1000;
  return s < 0 ? null : s;
}

/** Medidas de um run: cada segmento é null quando não se aplica àquele run. */
export interface MedidasRun {
  runId: number;
  repo: string;
  /** created_at do run em ms — é por ele que a janela e a semana recortam. */
  ts: number;
  fila_ci: number | null;
  exec_ci: number | null;
  espera_merge: number | null;
  deploy: number | null;
}

const ehVerde = (run: GithubRunLinha): boolean => run.conclusao === 'success';

/**
 * Escolhe, para cada PR mergeado, o run que fecha o segmento `espera_merge`:
 * o ÚLTIMO run VERDE que terminou até o merge. Devolve run_id → segundos.
 * Um PR contribui com no máximo uma medida, mesmo com dezenas de runs.
 */
function esperaMergePorRun(runs: GithubRunLinha[]): Map<number, number> {
  // Agrupa por PR — reunindo o que veio casado por head_sha e por pr_numero.
  const porPr = new Map<number, GithubRunLinha[]>();
  for (const run of runs) {
    if (run.pr_numero == null || !run.pr_merged_em) continue;
    const lista = porPr.get(run.pr_numero);
    if (lista) lista.push(run);
    else porPr.set(run.pr_numero, [run]);
  }

  const saida = new Map<number, number>();
  for (const lista of porPr.values()) {
    const mergedEm = Date.parse(lista[0]?.pr_merged_em ?? '');
    if (Number.isNaN(mergedEm)) continue;

    let melhor: GithubRunLinha | null = null;
    let melhorFim = Number.NEGATIVE_INFINITY;
    for (const run of lista) {
      if (!ehVerde(run) || !run.atualizado_em) continue;
      const fim = Date.parse(run.atualizado_em);
      // Run verde que terminou DEPOIS do merge não é o que destravou o merge.
      if (Number.isNaN(fim) || fim > mergedEm) continue;
      if (fim > melhorFim) {
        melhorFim = fim;
        melhor = run;
      }
    }
    if (!melhor) continue;
    const s = deltaSegundos(melhor.atualizado_em, melhor.pr_merged_em);
    if (s != null) saida.set(melhor.run_id, s);
  }
  return saida;
}

export interface OpcoesMedidas {
  /** Branch de produção — só runs de push nele contam como deploy. */
  branchPadrao?: string;
}

/** Converte as linhas cruas nas medidas por run. Ordem de entrada é irrelevante. */
export function medidasDosRuns(
  runs: GithubRunLinha[],
  { branchPadrao = 'main' }: OpcoesMedidas = {},
): MedidasRun[] {
  const espera = esperaMergePorRun(runs);

  return runs.map((run) => {
    const ehPush = run.evento === 'push' && run.branch === branchPadrao;
    const execucao = deltaSegundos(run.iniciado_em, run.atualizado_em);
    return {
      runId: run.run_id,
      repo: run.repo,
      ts: Date.parse(run.criado_em),
      fila_ci: deltaSegundos(run.criado_em, run.iniciado_em),
      exec_ci: run.evento === 'pull_request' ? execucao : null,
      espera_merge: espera.get(run.run_id) ?? null,
      deploy: ehPush ? execucao : null,
    };
  });
}

/**
 * Percentil nearest-rank — MESMA fórmula de `kpisGerais` em kpis.ts, para os
 * números das duas seções do painel serem comparáveis entre si.
 * Com n pequeno o p90 vira o maior valor: por isso o `n` aparece sempre na tela.
 */
export function percentil(ordenados: number[], p: number): number | null {
  if (ordenados.length === 0) return null;
  if (p === 0.5) return ordenados[Math.floor(ordenados.length / 2)] ?? null;
  const i = Math.min(ordenados.length - 1, Math.ceil(p * ordenados.length) - 1);
  return ordenados[i] ?? null;
}

/** Resume uma amostra em p50/p90/n, descartando nulos. Amostra vazia → n=0. */
export function resumirSegmento(valores: (number | null)[]): ResumoSegmento {
  const validos = valores.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
  if (validos.length === 0) return { ...VAZIO };
  return {
    p50: percentil(validos, 0.5),
    p90: percentil(validos, 0.9),
    n: validos.length,
  };
}

/** Resume os 4 segmentos de um conjunto qualquer de medidas. */
export function resumirMedidas(medidas: MedidasRun[]): ResumoGithub {
  return {
    fila_ci: resumirSegmento(medidas.map((m) => m.fila_ci)),
    exec_ci: resumirSegmento(medidas.map((m) => m.exec_ci)),
    espera_merge: resumirSegmento(medidas.map((m) => m.espera_merge)),
    deploy: resumirSegmento(medidas.map((m) => m.deploy)),
  };
}

/**
 * Recorte por janela rolante — mesma convenção de `recorte` em kpis.ts:
 * desloc=0 é o período atual, desloc=1 o período anterior de mesmo tamanho.
 */
export function resumoJanela(
  medidas: MedidasRun[],
  janelaDias: number,
  desloc = 0,
  agora: number = Date.now(),
): ResumoGithub {
  const ini = agora - (desloc + 1) * janelaDias * DIA_MS;
  const fim = agora - desloc * janelaDias * DIA_MS;
  return resumirMedidas(medidas.filter((m) => m.ts >= ini && m.ts < fim));
}

/**
 * Uma entrada por semana rolante de 7 dias: s=0 é a semana corrente.
 * Semana sem nenhum run aparece mesmo assim, com n=0 — sumiço silencioso de
 * semana esconde exatamente a queda que o painel existe para mostrar.
 */
export function resumoPorSemana(
  medidas: MedidasRun[],
  semanas = 4,
  agora: number = Date.now(),
): SemanaGithub[] {
  const saida: SemanaGithub[] = [];
  for (let s = 0; s < semanas; s++) {
    const ini = agora - (s + 1) * SEMANA_MS;
    const fim = agora - s * SEMANA_MS;
    saida.push({ s, segmentos: resumirMedidas(medidas.filter((m) => m.ts >= ini && m.ts < fim)) });
  }
  return saida;
}

/** Atalho para a tela: das linhas cruas direto ao resumo da janela + semanas. */
export function segmentosGithub(
  runs: GithubRunLinha[],
  opcoes: OpcoesMedidas & { janelaDias?: number; semanas?: number; agora?: number } = {},
): { janela: ResumoGithub; semanas: SemanaGithub[] } {
  const { janelaDias = 7, semanas = 4, agora = Date.now(), ...restante } = opcoes;
  const medidas = medidasDosRuns(runs, restante);
  return {
    janela: resumoJanela(medidas, janelaDias, 0, agora),
    semanas: resumoPorSemana(medidas, semanas, agora),
  };
}
