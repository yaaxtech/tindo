import {
  Activity,
  AppWindow,
  ClipboardList,
  CodeXml,
  Cpu,
  CreditCard,
  FlaskConical,
  Gauge,
  GitPullRequest,
  History,
  Layers,
  type LucideIcon,
  MessageCircleQuestion,
  SearchCheck,
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
 * sem OK dele (última reorganização autorizada: 2026-09-07).
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
//
// Dois grupos, por pedido do dono (2026-09-07): "Painel" é o fluxo principal,
// sempre visível; "Diagnóstico" fica atrás do disclosure "Ver diagnóstico
// detalhado" em page.tsx. Os ids continuam âncoras válidas — a NavPainel abre
// o disclosure antes de rolar, então nenhum item vira link para o nada.
export const SECOES_PAINEL: SecaoNavGrupo[] = [
  {
    id: 'painel',
    rotulo: 'Painel',
    itens: [
      { id: 'resumo', rotulo: 'Resumo', icone: ClipboardList },
      { id: 'visao-geral', rotulo: 'Visão geral', icone: Gauge },
      { id: 'placar', rotulo: 'Placar', icone: Trophy },
      { id: 'terrenos', rotulo: 'Terrenos', icone: Layers },
      { id: 'assinaturas', rotulo: 'Assinaturas', icone: CreditCard },
      { id: 'experimentos', rotulo: 'A/B', icone: FlaskConical },
    ],
  },
  {
    id: 'diagnostico',
    rotulo: 'Diagnóstico',
    itens: [
      { id: 'saude-dados', rotulo: 'Dados', icone: Activity },
      { id: 'autonomia', rotulo: 'Autonomia', icone: MessageCircleQuestion },
      { id: 'janela', rotulo: 'Janela', icone: AppWindow },
      { id: 'revisao', rotulo: 'Revisão', icone: SearchCheck },
      { id: 'tempo-despacho', rotulo: 'Despacho', icone: Timer },
      { id: 'tempo-entrega', rotulo: 'Entrega', icone: GitPullRequest },
      { id: 'fluxo', rotulo: 'Fluxo', icone: GitPullRequest },
      { id: 'minutos-github', rotulo: 'Minutos', icone: Timer },
      { id: 'modelos', rotulo: 'Modelos', icone: Cpu },
      { id: 'volume', rotulo: 'Volume', icone: CodeXml },
      { id: 'historico-kpis', rotulo: 'KPIs', icone: History },
    ],
  },
];

/** Ids que moram dentro do disclosure "Ver diagnóstico detalhado". */
export const IDS_DIAGNOSTICO = new Set(
  SECOES_PAINEL.find((g) => g.id === 'diagnostico')?.itens.map((i) => i.id) ?? [],
);
