import {
  CodeXml,
  Cpu,
  CreditCard,
  Gauge,
  GitPullRequest,
  History,
  Layers,
  type LucideIcon,
  Timer,
  Trophy,
} from 'lucide-react';

/**
 * Seções e grupos da navegação do /harness — no espírito do
 * `config-tab-groups.ts` da SeuCamarão: a lista vive aqui, separada da casca
 * (`NavPainel.tsx`), e os rótulos de grupo são linguagem leiga, não jargão.
 *
 * CRÍTICO: `id` é a âncora (`#id`) e precisa bater EXATAMENTE com a prop
 * `id` da `Secao` correspondente em `page.tsx` — mudou aqui, mude lá.
 * A ORDEM e o AGRUPAMENTO dos blocos foram decididos pelo dono: não mexer
 * sem OK dele.
 */
export interface SecaoNavItem {
  id: string;
  rotulo: string;
  icone: LucideIcon;
}

export interface SecaoNavGrupo {
  id: string;
  rotulo: string;
  itens: SecaoNavItem[];
}

// Os rótulos dos ITENS são curtos de propósito: com os nomes por extenso a
// faixa media 1541px num espaço de 768px e rolava na horizontal até no
// desktop — menu que exige arrastar de lado numa tela grande não é menu.
// O nome completo de cada bloco continua no título da seção logo abaixo.
export const SECOES_PAINEL: SecaoNavGrupo[] = [
  {
    id: 'como-estamos',
    rotulo: 'Como estamos',
    itens: [
      { id: 'visao-geral', rotulo: 'Visão geral', icone: Gauge },
      { id: 'placar', rotulo: 'Placar', icone: Trophy },
    ],
  },
  {
    id: 'onde-agir',
    rotulo: 'Onde agir',
    itens: [
      { id: 'terrenos', rotulo: 'Terrenos', icone: Layers },
      { id: 'tempo-perdido', rotulo: 'Tempo', icone: Timer },
      { id: 'fluxo', rotulo: 'Fluxo', icone: GitPullRequest },
    ],
  },
  {
    id: 'dinheiro',
    rotulo: 'Dinheiro',
    itens: [
      { id: 'minutos-github', rotulo: 'Minutos', icone: Timer },
      { id: 'assinaturas', rotulo: 'Assinaturas', icone: CreditCard },
    ],
  },
  {
    id: 'historico',
    rotulo: 'Histórico',
    itens: [
      { id: 'modelos', rotulo: 'Modelos', icone: Cpu },
      { id: 'volume', rotulo: 'Volume', icone: CodeXml },
      { id: 'historico-kpis', rotulo: 'KPIs', icone: History },
    ],
  },
];
