/**
 * Experimentos A/B do plano do dono — candidatos FIXOS, escritos aqui, nunca
 * derivados do ledger. O painel NÃO conta registros por braço: o ledger
 * histórico não é resultado pareado (tarefas diferentes, épocas diferentes),
 * e o nome logado nem sempre separa versões de modelo. O piloto real roda
 * fora do painel, em recibos separados; o resumo de cada rodada é escrito
 * aqui à mão, pelo cérebro, como string — nunca calculado pela tela.
 * Promoção de candidato depende dos critérios do teste, nunca de leitura
 * visual de taxas. O titular de cada terreno continua sendo o de `cadeias`.
 */
export interface Experimento {
  id: string;
  /** Onde o experimento acontece, em linguagem leiga. */
  frente: string;
  /** O que está sendo comparado, na frase do plano. */
  pergunta: string;
  /** Nomes como o dono fala: "Sol/high", "Fable 5.1/medium". */
  candidatos: [string, string] | [string, string, string];
  status: string;
  criterio?: string;
  /**
   * Resultado real da última rodada, redigido pelo cérebro. Só descreve o
   * que foi observado; não traz vitória nem percentual geral.
   */
  resumo: string;
}

export const EXPERIMENTOS_AB: Experimento[] = [
  {
    id: 'execucao-sol-astra',
    frente: 'Execução',
    status: 'Piloto preliminar concluído · sem vencedor confirmado',
    pergunta: 'Sol/high vs Astra/high',
    candidatos: ['Sol/high', 'Astra/high'],
    resumo:
      'Piloto de 07/09/2026: 4 pares de código, 16 verificações funcionais em 4 tarefas; todas passaram nos dois braços. Funções isoladas, não tarefa de produção.',
  },
  {
    id: 'planejamento-fable-esforco',
    frente: 'Planejamento',
    status: 'Piloto preliminar concluído · sem vencedor confirmado',
    pergunta: 'Fable 5.1/high vs Fable 5.1/medium',
    candidatos: ['Fable 5.1/high', 'Fable 5.1/medium'],
    resumo:
      'Piloto de 07/09/2026: 4 pares de planejamento sem ferramentas; a revisão cega encontrou lacunas nos dois braços e não confirmou vencedor.',
  },
  {
    id: 'coordenacao-astra-luna-sol',
    frente: 'Bugs, refatorações e backend sem SQL',
    pergunta: 'A/B/C · quem coordena a implementação?',
    candidatos: [
      'A · Astra/high coordena → Astra/high implementa',
      'B · Luna/xhigh coordena → Astra/high implementa',
      'C · Sol/high coordena → Astra/high implementa',
    ],
    status: 'Planejado · nenhuma execução',
    resumo:
      'Plano fechado e resultado verificável. O executor permanece igual nos três braços para comparar só a coordenação. O fluxo habitual de cada terreno continua como referência operacional separada.',
    criterio:
      'Começar com 8 tarefas por terreno nos três braços (24 execuções), mesma base isolada, testes congelados e avaliação cega. Alternar as seis ordens possíveis, balanceando as restantes. No máximo uma implementação e um retrabalho. Medir acerto de primeira e final, regressões, tempo total e consumo de todos os agentes. Recibos precisam confirmar modelo e esforço efetivos. Quota é medida separadamente; atividade concorrente torna a comparação de quota indisponível. O piloto só avança sem falha crítica adicional, sem perda de qualidade por tarefa, com economia mediana de pelo menos 20% e tempo mediano não pior. Oito tarefas são triagem; pelo menos 20 por terreno e análise da incerteza antes de propor qualquer troca.',
  },
  {
    id: 'continuidade-executor',
    frente: 'Contexto do executor',
    pergunta: 'A/B · continuar ou abrir contexto novo no retrabalho?',
    candidatos: ['A · Mesmo executor contínuo', 'B · Executor novo com resumo e evidências'],
    status: 'Planejado · depois do teste de coordenação',
    resumo:
      'Comparar nas mesmas tarefas que exigem continuidade, mantendo coordenador, modelo e esforço fixos. Medir redescoberta, perda de decisões, qualidade, tempo e consumo. Nenhuma execução realizada.',
  },
  {
    id: 'astra-high-low',
    frente: 'Esforço do executor',
    pergunta: 'A/B · quanto raciocínio a execução precisa?',
    candidatos: ['A · Astra/high', 'B · Astra/low'],
    status: 'Planejado · depois de coordenação e contexto',
    resumo:
      'Fixar coordenador e contexto antes de comparar o esforço em tarefas equivalentes. Confirmar o nível efetivo no recibo; o rótulo light do post não prova a configuração usada. Nenhuma execução realizada.',
  },
  {
    id: 'astra-base-xhigh',
    frente: 'Esforço adicional já configurado',
    pergunta: 'A/B · esforço-base versus xhigh',
    candidatos: ['A · Astra/base do terreno (low em rotina; high nos demais)', 'B · Astra/xhigh'],
    status: 'Amostragem configurada · execução não verificada',
    resumo:
      'Configuração de 10/09/2026 prevê 20% para xhigh. Configuração não é resultado. Este teste permanece separado dos testes de coordenação e de high versus low; não altera a decisão de manter interface e design com Claude.',
  },
  {
    id: 'analise-offline-coordenacao',
    frente: 'Análise offline com resposta verificável',
    pergunta: 'A/B/C · repetir a comparação de coordenação',
    candidatos: ['A · Astra/high coordena', 'B · Luna/xhigh coordena', 'C · Sol/high coordena'],
    status: 'Condicionado · depois do piloto de código',
    resumo:
      'Astra/high executa em todos os braços. Apenas plano fechado, dados sintéticos e resposta verificável; pesquisa aberta e decisões de dinheiro ficam fora. Nenhuma execução realizada.',
  },
];

/**
 * Ressalva do piloto: os pedidos usaram modelos explícitos, mas os recibos
 * não identificam o modelo em todas as execuções nem confirmam o effort aplicado. Sem isso, e com
 * amostra pequena, nenhum candidato troca de lugar sozinho.
 */
export const NOTA_EXPERIMENTOS =
  'Pilotos de 07/09: amostra pequena e nenhuma troca automática. O effort não foi confirmado e o modelo não está identificado em todas as execuções. Precisamos de testes mais representativos.';
