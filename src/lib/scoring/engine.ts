import type { Configuracoes, PesosScoring, Projeto, Tag, Tarefa } from '@/types/domain';
import { clamp } from '@/lib/utils';

export interface ScoringInput {
  importancia?: number | null;
  urgencia?: number | null;
  facilidade?: number | null;
  tipo: Tarefa['tipo'];
  prioridade: Tarefa['prioridade'];
  dataVencimento?: string | null;
  prazoConclusao?: string | null;
  projeto?: Projeto | null;
  tags: Tag[];
}

/**
 * Urgência baseada em data_vencimento / prazo_conclusao.
 */
export function calcularUrgencia(
  dataVencimento?: string | null,
  prazoConclusao?: string | null,
): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const base = (data: string): number => {
    const d = new Date(data);
    d.setHours(0, 0, 0, 0);
    const dias = Math.floor((d.getTime() - hoje.getTime()) / 86_400_000);
    if (dias < 0) return 100;
    if (dias === 0) return 95;
    if (dias === 1) return 85;
    if (dias <= 3) return 70;
    if (dias <= 7) return 55;
    if (dias <= 14) return 35;
    if (dias <= 28) return 20;
    return 10;
  };

  let score = 10;
  if (dataVencimento) score = Math.max(score, base(dataVencimento));
  if (prazoConclusao) {
    const urgPrazo = base(prazoConclusao);
    score = Math.max(score, Math.min(100, urgPrazo * 1.2 + 5));
  }
  return clamp(score, 0, 100);
}

export function prioridadeParaImportancia(p: Tarefa['prioridade']): number {
  switch (p) {
    case 1: return 90;
    case 2: return 65;
    case 3: return 40;
    case 4: return 20;
  }
}

export function tipoParaFacilidadeDefault(tipo: Tarefa['tipo']): number {
  return tipo === 'lembrete' ? 95 : 50;
}

export function calcularNota(input: ScoringInput, config: Configuracoes): number {
  const pesos: PesosScoring = config.pesos;
  const U = input.urgencia ?? calcularUrgencia(input.dataVencimento, input.prazoConclusao);
  const I = input.importancia ?? prioridadeParaImportancia(input.prioridade);
  const F = input.facilidade ?? tipoParaFacilidadeDefault(input.tipo);

  const notaBase = pesos.urgencia * U + pesos.importancia * I + pesos.facilidade * F;

  let multProjeto = 1;
  if (input.projeto?.multiplicador) {
    multProjeto = input.projeto.multiplicador;
  }

  let multTags = 1;
  let somaTags = 0;
  let percentTags = 0;
  for (const tag of input.tags) {
    switch (tag.tipoPeso) {
      case 'multiplicador':
        multTags *= tag.valorPeso;
        break;
      case 'soma':
        somaTags += tag.valorPeso;
        break;
      case 'subtracao':
        somaTags -= tag.valorPeso;
        break;
      case 'percentual':
        percentTags += tag.valorPeso;
        break;
      case 'peso_custom':
        break;
    }
  }
  const fatorPercent = 1 + percentTags / 100;

  const bruto = notaBase * multProjeto * multTags * fatorPercent + somaTags;
  return Math.round(clamp(bruto, 0, 100));
}

export const CONFIG_PADRAO_PESOS: PesosScoring = {
  urgencia: 0.4,
  importancia: 0.4,
  facilidade: 0.2,
};
