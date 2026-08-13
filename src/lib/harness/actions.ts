import type { ActionsBlob, ActionsBranch } from '@/types/harness';

const SEGUNDOS_POR_HORA = 3600;

// Branches que rodam por `push` depois do merge e nunca têm PR próprio. Sem
// esta exceção o KPI de desperdício acusa a `main` — 26% dos minutos na medição
// de 13/08 — como se fosse trabalho abandonado, que é o oposto do que é.
const BRANCHES_BASE = new Set(['main', 'master']);

export interface JobActions {
  conclusion: string | null;
  runner_name: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface PercentualComAmostra {
  valor: number | null;
  x: number;
  y: number;
}

export interface ActionsKpis {
  minutosCiclo: number | null;
  pctCota: PercentualComAmostra;
  projecaoMes: number | null;
  custoEstouroUsd: number | null;
  equivalenteNuvem: number | null;
  projecaoEquivalente: number | null;
  custoSeLigarUsd: number | null;
  filaP50: number | null;
  filaP90: number | null;
  filaN: number;
  usdPorHoraEconomizada: number | null;
  minPorPrMergeado: number | null;
  concentracaoBranch: {
    top5: ActionsBranch[];
    pctMaior: PercentualComAmostra;
  };
  desperdicioPct: PercentualComAmostra;
  branchSemPrPct: PercentualComAmostra;
  minutosBranchSemPr: number | null;
  stepDominante: {
    nome: string;
    pct: PercentualComAmostra;
  } | null;
  horaPico: {
    hora: number;
    p50: number | null;
    p90: number | null;
    n: number;
  } | null;
  veredito: string;
}

/** Runner cujo nome contém `mac-` é o Mac self-hosted; os demais são nuvem. */
export function classificarRunner(runnerName: string | null): 'mac' | 'nuvem' {
  return runnerName?.toLowerCase().includes('mac-') ? 'mac' : 'nuvem';
}

/** Minuto faturável do GitHub: ceil por job, mínimo 1; skipped não entra. */
export function minutosDoJob(job: JobActions): number | null {
  if (job.conclusion === 'skipped' || !job.started_at || !job.completed_at) return null;
  const inicio = Date.parse(job.started_at);
  const fim = Date.parse(job.completed_at);
  if (Number.isNaN(inicio) || Number.isNaN(fim) || fim < inicio) return null;
  return Math.max(1, Math.ceil((fim - inicio) / 60_000));
}

function percentil(ordenados: number[], p: number): number | null {
  if (ordenados.length === 0) return null;
  if (p === 0.5) return ordenados[Math.floor(ordenados.length / 2)] ?? null;
  return ordenados[Math.min(ordenados.length - 1, Math.ceil(p * ordenados.length) - 1)] ?? null;
}

function percentual(x: number, y: number): PercentualComAmostra {
  return { valor: y > 0 ? x / y : null, x, y };
}

function diasNoMes(iso: string): number {
  const inicio = new Date(`${iso}T00:00:00Z`);
  return new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0)).getUTCDate();
}

function projetar(valor: number, blob: ActionsBlob, agora: Date): number {
  const inicio = new Date(`${blob.ciclo_inicio}T00:00:00Z`);
  const mesmoMes =
    inicio.getUTCFullYear() === agora.getUTCFullYear() &&
    inicio.getUTCMonth() === agora.getUTCMonth();
  const diasDecorridos = mesmoMes ? Math.max(1, agora.getUTCDate()) : diasNoMes(blob.ciclo_inicio);
  return (valor / diasDecorridos) * diasNoMes(blob.ciclo_inicio);
}

function veredito(
  projecaoEquivalente: number | null,
  cota: number,
  filaP50: number | null,
  usdPorHora: number | null,
): string {
  if (projecaoEquivalente == null) {
    return 'Ainda não há amostra suficiente para decidir sobre os minutos do GitHub.';
  }
  if (projecaoEquivalente <= cota) {
    return 'A nuvem caberia na cota grátis e eliminaria a fila: vale ligar.';
  }
  if (filaP50 != null && filaP50 < 120) {
    return 'O Mac já responde na hora; pagar pelos minutos compraria quase nada. Melhor ficar como está.';
  }
  if (filaP50 == null || usdPorHora == null) {
    return 'O uso passaria da cota, mas ainda falta medir a fila para saber se pagar compensa.';
  }
  return `A nuvem passaria da cota; cada hora de fila eliminada custaria cerca de US$ ${usdPorHora.toFixed(2)}.`;
}

/** Deriva os 9 KPIs do snapshot sem I/O; `agora` é injetável para testes. */
export function calcularActionsKpis(blob: ActionsBlob, agora = new Date()): ActionsKpis {
  const diasCiclo = blob.dias.filter((dia) => dia.dia >= blob.ciclo_inicio);
  const runsCiclo = diasCiclo.reduce((soma, dia) => soma + dia.runs, 0);
  const temAmostra = runsCiclo > 0;
  const minutosFaturados = diasCiclo.reduce((soma, dia) => soma + dia.min_faturado, 0);
  const minutosMac = diasCiclo.reduce((soma, dia) => soma + dia.min_mac, 0);
  const totalMinutos = minutosFaturados + minutosMac;
  const minutosPerdidos = diasCiclo.reduce((soma, dia) => soma + dia.min_perdido, 0);
  const fila = diasCiclo.flatMap((dia) => dia.fila_seg).sort((a, b) => a - b);

  const projecaoMes = temAmostra ? projetar(minutosFaturados, blob, agora) : null;
  const projecaoEquivalente = temAmostra ? projetar(totalMinutos, blob, agora) : null;
  const custoEstouroUsd =
    projecaoMes == null ? null : Math.max(0, projecaoMes - blob.cota_min) * blob.custo_min_usd;
  // Dois custos DIFERENTES, e confundi-los mata a decisão: `custoEstouroUsd` é
  // o que já se paga hoje (só o que rodou na nuvem), enquanto `custoSeLigarUsd`
  // é o que se passaria a pagar ao mandar TODO o trabalho para a nuvem. Com o
  // disjuntor armado no Mac o primeiro é ~zero — usá-lo aqui faria o painel
  // anunciar "US$ 0,00 por hora de fila" justamente quando a pergunta é se
  // vale a pena ligar.
  const custoSeLigarUsd =
    projecaoEquivalente == null
      ? null
      : Math.max(0, projecaoEquivalente - blob.cota_min) * blob.custo_min_usd;
  const filaProjetadaHoras = temAmostra
    ? projetar(fila.reduce((soma, segundos) => soma + segundos, 0) / SEGUNDOS_POR_HORA, blob, agora)
    : 0;
  const usdPorHoraEconomizada =
    custoSeLigarUsd != null && filaProjetadaHoras > 0 ? custoSeLigarUsd / filaProjetadaHoras : null;

  const branches = [...blob.branches].sort((a, b) => b.min_total - a.min_total);
  const totalBranches = branches.reduce((soma, branch) => soma + branch.min_total, 0);
  const minutosBranchSemPr = branches.reduce(
    (soma, branch) =>
      soma + (branch.virou_pr || BRANCHES_BASE.has(branch.branch) ? 0 : branch.min_total),
    0,
  );
  const steps = [...blob.steps].sort((a, b) => b.seg_total - a.seg_total);
  const totalSteps = steps.reduce((soma, step) => soma + step.seg_total, 0);
  const dominante = steps[0];
  const horaPico =
    [...blob.fila_por_hora]
      .filter((hora) => hora.n > 0 && hora.p90 != null)
      .sort((a, b) => (b.p90 ?? 0) - (a.p90 ?? 0))[0] ?? null;
  const filaP50 = percentil(fila, 0.5);
  const filaP90 = percentil(fila, 0.9);

  return {
    minutosCiclo: temAmostra ? minutosFaturados : null,
    pctCota: percentual(temAmostra ? minutosFaturados : 0, temAmostra ? blob.cota_min : 0),
    projecaoMes,
    custoEstouroUsd,
    equivalenteNuvem: temAmostra ? totalMinutos : null,
    projecaoEquivalente,
    custoSeLigarUsd,
    filaP50,
    filaP90,
    filaN: fila.length,
    usdPorHoraEconomizada,
    minPorPrMergeado:
      temAmostra && blob.prs_mergeados_ciclo > 0 ? totalMinutos / blob.prs_mergeados_ciclo : null,
    concentracaoBranch: {
      top5: branches.slice(0, 5),
      pctMaior: percentual(branches[0]?.min_total ?? 0, totalBranches),
    },
    desperdicioPct: percentual(minutosPerdidos, totalMinutos),
    branchSemPrPct: percentual(minutosBranchSemPr, totalBranches),
    minutosBranchSemPr: totalBranches > 0 ? minutosBranchSemPr : null,
    stepDominante: dominante
      ? { nome: dominante.nome, pct: percentual(dominante.seg_total, totalSteps) }
      : null,
    horaPico,
    veredito: veredito(projecaoEquivalente, blob.cota_min, filaP50, usdPorHoraEconomizada),
  };
}
