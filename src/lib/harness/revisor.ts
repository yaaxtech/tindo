import type { Assinatura, GithubRunLinha, LedgerLinha, MotivoAvaliacao } from '@/types/harness';
import { JANELA_AVALIACAO_DIAS, type Violacao, avaliarKpis, decidirAvaliacao } from './alertas';

// Passo do /api/cron/diario que roda o revisor de KPIs.
//
// O disparo vive AQUI, dentro do app — nunca num agendador preso a uma conta
// de assistente. O cron do Cloudflare já bate neste endpoint todo dia às 06h
// UTC; `decidirAvaliacao` é quem decide se hoje é dia de avaliar.
//
// I/O entra por portas injetadas (mesmo desenho de coletor-github.ts): a
// orquestração fica testável sem Supabase e sem rede.

export interface AvaliacaoGravada {
  motivo: MotivoAvaliacao;
  janelaDias: number;
  violacoes: Violacao[];
}

export interface PortasRevisor {
  /** Ledger + assinaturas do snapshot do painel. null = nada publicado ainda. */
  lerLedger(): Promise<{ ledger: LedgerLinha[]; assinaturas: Assinatura[] } | null>;
  /** Tempos crus do GitHub. Lista vazia é resposta válida (antes da 1ª coleta). */
  lerRuns(): Promise<GithubRunLinha[]>;
  /** `avaliado_em` da avaliação mais recente, ou null se nunca houve. */
  ultimaAvaliacaoEm(): Promise<string | null>;
  gravar(avaliacao: AvaliacaoGravada): Promise<{ erro: string | null }>;
  /** Aviso ao dono (push). Só chamada quando há violação; nunca deve lançar. */
  avisar(violacoes: Violacao[]): Promise<void>;
}

export interface ResultadoRevisao {
  avaliou: boolean;
  motivo: MotivoAvaliacao | null;
  violacoes: number;
  criticos: number;
  /** Por que não avaliou / o que impediu de concluir. null quando correu bem. */
  nota: string | null;
  proximaEm: string | null;
}

/**
 * Avalia os KPIs contra os limiares e grava o resultado — se hoje for dia.
 * Nunca lança: qualquer falha vira `nota` no resultado, como no coletor.
 */
export async function revisarKpis(
  portas: PortasRevisor,
  { agora = Date.now() }: { agora?: number } = {},
): Promise<ResultadoRevisao> {
  const vazio: ResultadoRevisao = {
    avaliou: false,
    motivo: null,
    violacoes: 0,
    criticos: 0,
    nota: null,
    proximaEm: null,
  };

  try {
    const snapshot = await portas.lerLedger();
    if (!snapshot) return { ...vazio, nota: 'sem snapshot do harness ainda' };

    const ultimaEm = await portas.ultimaAvaliacaoEm();
    const decisao = decidirAvaliacao({ ultimaEm, assinaturas: snapshot.assinaturas, agora });
    if (!decisao.deve || !decisao.motivo) {
      return { ...vazio, nota: 'fora do calendário', proximaEm: decisao.proximaEm };
    }

    // Falha ao ler os runs não cancela a avaliação: os KPIs do ledger valem
    // por si, e a próxima rodada pega os tempos do GitHub de novo.
    let runs: GithubRunLinha[] = [];
    let notaRuns: string | null = null;
    try {
      runs = await portas.lerRuns();
    } catch (e) {
      notaRuns = `tempos do GitHub fora: ${e instanceof Error ? e.message : String(e)}`;
    }

    const violacoes = avaliarKpis({
      ledger: snapshot.ledger,
      assinaturas: snapshot.assinaturas,
      runs,
      agora,
    });

    const { erro } = await portas.gravar({
      motivo: decisao.motivo,
      janelaDias: JANELA_AVALIACAO_DIAS,
      violacoes,
    });
    if (erro) {
      return {
        ...vazio,
        motivo: decisao.motivo,
        violacoes: violacoes.length,
        nota: `falha ao gravar: ${erro}`,
        proximaEm: decisao.proximaEm,
      };
    }

    if (violacoes.length > 0) await portas.avisar(violacoes);

    return {
      avaliou: true,
      motivo: decisao.motivo,
      violacoes: violacoes.length,
      criticos: violacoes.filter((v) => v.severidade === 'critico').length,
      nota: notaRuns,
      proximaEm: decisao.proximaEm,
    };
  } catch (e) {
    return { ...vazio, nota: `erro: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Resumo de uma linha para o campo `resultados` do cron. */
export function resumoRevisao(r: ResultadoRevisao): string {
  if (!r.avaliou) return `não avaliou (${r.nota ?? 'sem motivo'})`;
  const base =
    r.violacoes === 0
      ? `ok: avaliação ${r.motivo}, nenhum limiar violado`
      : `avaliação ${r.motivo}: ${r.violacoes} limiar(es) violado(s), ${r.criticos} crítico(s)`;
  return r.nota ? `${base} — ${r.nota}` : base;
}
