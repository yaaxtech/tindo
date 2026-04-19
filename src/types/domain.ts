export type TipoTarefa = 'tarefa' | 'lembrete';
export type StatusTarefa = 'pendente' | 'concluida' | 'adiada' | 'excluida';
export type TipoPesoTag = 'multiplicador' | 'soma' | 'subtracao' | 'percentual' | 'peso_custom';

export interface Projeto {
  id: string;
  todoistId?: string | null;
  nome: string;
  cor: string;
  ordemPrioridade: number;
  multiplicador: number;
  ativo: boolean;
}

export interface Tag {
  id: string;
  todoistId?: string | null;
  nome: string;
  cor: string;
  tipoPeso: TipoPesoTag;
  valorPeso: number;
  ativo: boolean;
}

export interface Tarefa {
  id: string;
  todoistId?: string | null;
  tipo: TipoTarefa;
  titulo: string;
  descricao?: string | null;
  projetoId?: string | null;
  projeto?: Projeto | null;
  prioridade: 1 | 2 | 3 | 4;
  dataVencimento?: string | null;
  prazoConclusao?: string | null;
  importancia?: number | null;
  urgencia?: number | null;
  facilidade?: number | null;
  nota: number;
  status: StatusTarefa;
  dependenciaTarefaId?: string | null;
  adiadaAte?: string | null;
  adiamentoCount: number;
  adiamentoMotivoAuto?: string | null;
  concluidaEm?: string | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface PesosScoring {
  urgencia: number;
  importancia: number;
  facilidade: number;
}

export interface Configuracoes {
  usuarioId: string;
  pesos: PesosScoring;
  limiares: {
    reavaliacao: number;
    descarte: number;
    adiamento: number;
  };
  audioHabilitado: boolean;
  animacoesHabilitadas: boolean;
  aiHabilitado: boolean;
  todoistSyncHabilitado: boolean;
  criteriosSucesso?: Record<string, unknown>;
}

export interface Gamificacao {
  usuarioId: string;
  xpTotal: number;
  nivel: number;
  streakAtual: number;
  streakRecorde: number;
  ultimoDiaAtivo?: string | null;
  tarefasConcluidasTotal: number;
  lembretesConcluidosTotal: number;
}

export type AcaoCard =
  | 'concluir'
  | 'pular'
  | 'voltar'
  | 'adiar_auto'
  | 'adiar_manual'
  | 'excluir'
  | 'editar';
