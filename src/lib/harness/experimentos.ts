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
  candidatos: [string, string];
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
    pergunta: 'Sol/high vs Astra/high',
    candidatos: ['Sol/high', 'Astra/high'],
    resumo:
      'Piloto de 07/09/2026: 4 pares de código, 16 verificações funcionais em 4 tarefas; todas passaram nos dois braços. Funções isoladas, não tarefa de produção.',
  },
  {
    id: 'planejamento-fable-esforco',
    frente: 'Planejamento',
    pergunta: 'Fable 5.1/high vs Fable 5.1/medium',
    candidatos: ['Fable 5.1/high', 'Fable 5.1/medium'],
    resumo:
      'Piloto de 07/09/2026: 4 pares de planejamento sem ferramentas; a revisão cega encontrou lacunas nos dois braços e não confirmou vencedor.',
  },
];

export const STATUS_EXPERIMENTO = 'Piloto preliminar concluído · sem vencedor confirmado';

/**
 * Ressalva do piloto: os pedidos usaram modelos explícitos, mas os recibos
 * não identificam o modelo em todas as execuções nem confirmam o effort aplicado. Sem isso, e com
 * amostra pequena, nenhum candidato troca de lugar sozinho.
 */
export const NOTA_EXPERIMENTOS =
  'Amostra pequena: nenhuma troca automática. O effort não foi confirmado e o modelo não está identificado em todas as execuções. Precisamos de testes mais representativos.';
