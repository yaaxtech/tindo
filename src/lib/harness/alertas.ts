import {
  SEGMENTOS,
  medidasDosRuns,
  percentil,
  resumoPorSemana,
} from '@/lib/harness/github-timings';
import {
  MIN_AMOSTRA_GERAL,
  custoMedioTarefa,
  kpisGerais,
  recorte,
  valorGeral,
} from '@/lib/harness/kpis';
import type {
  Assinatura,
  CodigoAlerta,
  GithubRunLinha,
  LedgerLinha,
  MotivoAvaliacao,
  SegmentoGithub,
  SeveridadeAlerta,
} from '@/types/harness';

// Revisor de KPIs do Painel do Harness — lib PURA: zero I/O, `agora` sempre
// injetável. Ela só JULGA; quem lê, grava e avisa é src/lib/harness/revisor.ts.
//
// Regra de desenho: NADA de cálculo novo aqui. Qualidade, retrabalho, custo,
// quota e placar saem de kpis.ts; os tempos do GitHub saem de
// github-timings.ts. Duplicar fórmula faria a faixa de alerta discordar dos
// números que a própria tela mostra logo abaixo dela.
//
// Unidade de `valor`/`limiar` por código (o banco guarda numeric cru):
//   qualidade_baixa, retrabalho_alto, quota_alta, quota_zerada → fração 0..1
//   custo_alto                                                  → dólares
//   valor_baixo                                                 → pontos 0..100
//   espera_merge_longa, segmento_*                               → segundos

const DIA_MS = 864e5;

/** Janela de KPIs que a avaliação enxerga — a mesma da cadência. */
export const JANELA_AVALIACAO_DIAS = 14;

/** Cadência do ciclo periódico. */
export const INTERVALO_AVALIACAO_MS = JANELA_AVALIACAO_DIAS * DIA_MS;

/** Antecedência da avaliação extra antes de uma data de renovação. */
export const DIAS_ANTES_RENOVACAO = 3;

// Limiares da tabela de governança (CLAUDE.md global). Frações, não %.
export const LIMIARES = {
  qualidadeAlerta: 0.8,
  qualidadeCritico: 0.7,
  retrabalhoAlerta: 0.2,
  retrabalhoCritico: 0.35,
  custoAlerta: 5,
  quotaAlerta: 0.15,
  valorAlerta: 55,
  esperaMergeSegundos: 60 * 60,
  /** Segmento do GitHub: p50 acima deste múltiplo da mediana das 4 semanas. */
  fatorSegmento: 1.5,
} as const;

// Amostra mínima. Sem piso, "qualidade 0%" com um único despacho vira alerta
// — e um limiar que grita por ruído ensina o dono a ignorar a faixa inteira.
// O painel geral só decide com 20 construções julgáveis; abaixo disso mostra a
// porcentagem como provisória, mas não dispara alerta nem muda rota.
const MIN_AMOSTRA_LEDGER = MIN_AMOSTRA_GERAL;
const MIN_AMOSTRA_RUNS = 3;
/** Semanas anteriores com p50 necessárias para a mediana de comparação valer. */
const MIN_SEMANAS_BASE = 2;

/**
 * Nome curto de cada limiar, em português leigo. Usado no aviso por push e
 * como título do alerta na tela — as frases longas (o que significa, o que
 * fazer) moram no componente do painel.
 */
export const ROTULO_ALERTA: Record<CodigoAlerta, string> = {
  qualidade_baixa: 'Qualidade abaixo da meta',
  retrabalho_alto: 'Retrabalho acima da meta',
  custo_alto: 'Custo por tarefa alto',
  quota_alta: 'Assinatura batendo no limite',
  quota_zerada: 'Assinatura sobrando',
  valor_baixo: 'Placar de valor baixo',
  espera_merge_longa: 'Demora para aprovar o merge',
  segmento_fila_ci: 'Fila do CI mais lenta que o normal',
  segmento_exec_ci: 'Execução do CI mais lenta que o normal',
  segmento_espera_merge: 'Espera pelo merge maior que o normal',
  segmento_deploy: 'Publicação mais lenta que o normal',
};

export interface Violacao {
  codigo: CodigoAlerta;
  severidade: SeveridadeAlerta;
  /** Valor observado, na unidade documentada acima. */
  valor: number | null;
  limiar: number;
  amostra: number;
}

export interface EntradaAvaliacao {
  ledger: LedgerLinha[];
  assinaturas: Assinatura[];
  runs: GithubRunLinha[];
  agora?: number;
}

/** Violações vindas do ledger de despachos (janela de 14 dias). */
export function avaliarLedger(
  ledger: LedgerLinha[],
  assinaturas: Assinatura[],
  agora: number = Date.now(),
): Violacao[] {
  const linhas = recorte(ledger, JANELA_AVALIACAO_DIAS, 0, agora);
  const g = kpisGerais(linhas);
  const achados: Violacao[] = [];

  // Qualidade e retrabalho dividem o mesmo denominador (julgáveis).
  if (g.julg >= MIN_AMOSTRA_LEDGER) {
    if (g.ok1 != null && g.ok1 < LIMIARES.qualidadeCritico) {
      achados.push({
        codigo: 'qualidade_baixa',
        severidade: 'critico',
        valor: g.ok1,
        limiar: LIMIARES.qualidadeCritico,
        amostra: g.julg,
      });
    } else if (g.ok1 != null && g.ok1 < LIMIARES.qualidadeAlerta) {
      achados.push({
        codigo: 'qualidade_baixa',
        severidade: 'alerta',
        valor: g.ok1,
        limiar: LIMIARES.qualidadeAlerta,
        amostra: g.julg,
      });
    }

    if (g.reciclo != null && g.reciclo > LIMIARES.retrabalhoCritico) {
      achados.push({
        codigo: 'retrabalho_alto',
        severidade: 'critico',
        valor: g.reciclo,
        limiar: LIMIARES.retrabalhoCritico,
        amostra: g.julg,
      });
    } else if (g.reciclo != null && g.reciclo > LIMIARES.retrabalhoAlerta) {
      achados.push({
        codigo: 'retrabalho_alto',
        severidade: 'alerta',
        valor: g.reciclo,
        limiar: LIMIARES.retrabalhoAlerta,
        amostra: g.julg,
      });
    }

    const valor = valorGeral(linhas, assinaturas, JANELA_AVALIACAO_DIAS);
    if (valor != null && valor < LIMIARES.valorAlerta) {
      achados.push({
        codigo: 'valor_baixo',
        severidade: 'alerta',
        valor,
        limiar: LIMIARES.valorAlerta,
        amostra: g.julg,
      });
    }
  }

  const custo = custoMedioTarefa(linhas, assinaturas, JANELA_AVALIACAO_DIAS);
  if (custo != null && custo > LIMIARES.custoAlerta) {
    achados.push({
      codigo: 'custo_alto',
      severidade: 'alerta',
      valor: custo,
      limiar: LIMIARES.custoAlerta,
      amostra: g.aceitas,
    });
  }

  // Quota alta = frente saturada. Quota exatamente zero na janela inteira =
  // assinatura sobrando — a janela É de 14 dias, então "0% por 14 dias
  // seguidos" e "0% nesta janela" são a mesma frase.
  if (g.n >= MIN_AMOSTRA_LEDGER && g.quotaHit != null) {
    if (g.quotaHit > LIMIARES.quotaAlerta) {
      achados.push({
        codigo: 'quota_alta',
        severidade: 'alerta',
        valor: g.quotaHit,
        limiar: LIMIARES.quotaAlerta,
        amostra: g.n,
      });
    } else if (g.quotaHit === 0) {
      achados.push({
        codigo: 'quota_zerada',
        severidade: 'alerta',
        valor: 0,
        limiar: 0,
        amostra: g.n,
      });
    }
  }

  return achados;
}

const CODIGO_SEGMENTO: Record<SegmentoGithub, CodigoAlerta> = {
  fila_ci: 'segmento_fila_ci',
  exec_ci: 'segmento_exec_ci',
  espera_merge: 'segmento_espera_merge',
  deploy: 'segmento_deploy',
};

/** Violações vindas dos tempos do GitHub (semana corrente vs. 4 anteriores). */
export function avaliarGithub(runs: GithubRunLinha[], agora: number = Date.now()): Violacao[] {
  const medidas = medidasDosRuns(runs);
  // 5 semanas: s=0 é a corrente, s=1..4 são as 4 anteriores que viram régua.
  const semanas = resumoPorSemana(medidas, 5, agora);
  const corrente = semanas[0];
  if (!corrente) return [];

  const achados: Violacao[] = [];

  for (const segmento of SEGMENTOS) {
    const atual = corrente.segmentos[segmento];
    if (atual.n < MIN_AMOSTRA_RUNS || atual.p50 == null) continue;

    const base = semanas
      .slice(1)
      .map((s) => s.segmentos[segmento].p50)
      .filter((p): p is number => typeof p === 'number')
      .sort((a, b) => a - b);
    if (base.length < MIN_SEMANAS_BASE) continue;

    const mediana = percentil(base, 0.5);
    // Mediana 0 (tudo instantâneo antes) não vira régua: qualquer segundo a
    // mais seria "infinitas vezes pior".
    if (mediana == null || mediana <= 0) continue;

    const limiar = LIMIARES.fatorSegmento * mediana;
    if (atual.p50 > limiar) {
      achados.push({
        codigo: CODIGO_SEGMENTO[segmento],
        severidade: 'alerta',
        valor: atual.p50,
        limiar,
        amostra: atual.n,
      });
    }
  }

  const espera = corrente.segmentos.espera_merge;
  if (
    espera.n >= MIN_AMOSTRA_RUNS &&
    espera.p50 != null &&
    espera.p50 > LIMIARES.esperaMergeSegundos
  ) {
    achados.push({
      codigo: 'espera_merge_longa',
      severidade: 'alerta',
      valor: espera.p50,
      limiar: LIMIARES.esperaMergeSegundos,
      amostra: espera.n,
    });
  }

  return achados;
}

/** Avaliação completa: ledger + GitHub, na ordem em que a tela mostra. */
export function avaliarKpis({
  ledger,
  assinaturas,
  runs,
  agora = Date.now(),
}: EntradaAvaliacao): Violacao[] {
  return [...avaliarLedger(ledger, assinaturas, agora), ...avaliarGithub(runs, agora)];
}

/**
 * Códigos que saem do ledger — os únicos que a tela consegue reconferir com o
 * snapshot que ela já tem em mãos. Os do GitHub dependem de `harness_github_runs`,
 * que pode nem ter carregado, então ficam intocados.
 */
export const CODIGOS_DO_LEDGER: ReadonlySet<CodigoAlerta> = new Set<CodigoAlerta>([
  'qualidade_baixa',
  'retrabalho_alto',
  'custo_alto',
  'quota_alta',
  'quota_zerada',
  'valor_baixo',
]);

/**
 * Confere alertas JÁ gravados contra os KPIs de agora, e devolve só os que
 * ainda valem — com valor, limiar, severidade e amostra atualizados.
 *
 * Existe porque a avaliação é quinzenal e o veredicto fica congelado no banco:
 * quando o cálculo dos KPIs muda (foi o caso de `infra` sair do denominador em
 * 14/08/2026), a faixa continuaria gritando um número que a própria tela, logo
 * abaixo, já mostra corrigido. Aqui não há fórmula nova — `atuais` vem de
 * `avaliarLedger`, o mesmo caminho que gravou o alerta.
 */
export function reconferirLedger<T extends Violacao>(vigentes: T[], atuais: Violacao[]): T[] {
  const porCodigo = new Map(atuais.map((v) => [v.codigo, v] as const));
  const sobrevivem: T[] = [];

  for (const alerta of vigentes) {
    if (!CODIGOS_DO_LEDGER.has(alerta.codigo)) {
      sobrevivem.push(alerta);
      continue;
    }
    const agora = porCodigo.get(alerta.codigo);
    // Não viola mais: some da faixa sem esperar a próxima checagem.
    if (!agora) continue;
    sobrevivem.push({
      ...alerta,
      severidade: agora.severidade,
      valor: agora.valor,
      limiar: agora.limiar,
      amostra: agora.amostra,
    });
  }

  return sobrevivem;
}

export interface DecisaoAvaliacao {
  deve: boolean;
  motivo: MotivoAvaliacao | null;
  /** Quando o próximo ciclo periódico vence (ISO), para o log do cron. */
  proximaEm: string;
}

const mesmoDiaUtc = (a: number, b: number): boolean =>
  new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);

/**
 * Decide se HOJE é dia de avaliar. Roda todo dia dentro do cron; o disparo
 * mora aqui e em nenhum agendador externo.
 *
 * Duas razões, nessa ordem de prioridade:
 *   pre_renovacao  faltam ≤3 dias para a renovação de alguma assinatura e
 *                  nenhuma avaliação aconteceu dentro dessa janela ainda.
 *                  É janela, não data exata: um cron que falhe no dia D-3
 *                  ainda avalia em D-2, em vez de perder a decisão de
 *                  assinatura por um dia de rede ruim.
 *   periodico      passaram-se 14 dias (ou nunca houve avaliação).
 */
export function decidirAvaliacao({
  ultimaEm,
  assinaturas,
  agora = Date.now(),
}: {
  ultimaEm: string | null;
  assinaturas: Assinatura[];
  agora?: number;
}): DecisaoAvaliacao {
  const ultima = ultimaEm ? Date.parse(ultimaEm) : Number.NaN;
  const temUltima = !Number.isNaN(ultima);
  const proximaEm = new Date((temUltima ? ultima : agora) + INTERVALO_AVALIACAO_MS).toISOString();

  // Guard anti-duplicata: duas execuções do cron no mesmo dia avaliam uma vez.
  if (temUltima && mesmoDiaUtc(ultima, agora)) return { deve: false, motivo: null, proximaEm };

  const preRenovacao = assinaturas.some((a) => {
    const renova = Date.parse(a.renova);
    if (Number.isNaN(renova)) return false;
    const abre = renova - DIAS_ANTES_RENOVACAO * DIA_MS;
    if (agora < abre || agora >= renova) return false;
    return !temUltima || ultima < abre;
  });
  if (preRenovacao) return { deve: true, motivo: 'pre_renovacao', proximaEm };

  if (!temUltima || agora - ultima >= INTERVALO_AVALIACAO_MS) {
    return { deve: true, motivo: 'periodico', proximaEm };
  }
  return { deve: false, motivo: null, proximaEm };
}
