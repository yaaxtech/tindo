# 00 — Visão do Produto

## O que é o TinDo

**TinDo** (Tinder + ToDo) é um app de produtividade que elimina a indecisão e a sobrecarga cognitiva na gestão de tarefas. Em vez de listas intermináveis, o usuário vê **uma tarefa por vez**, apresentada em formato de card, ordenada por uma nota 0-100 que combina importância, urgência e facilidade. A interação principal é por **swipe** (como o Tinder) — o app usa o mesmo mecanismo neural de "decisão rápida" que torna o Tinder viciante, porém redirecionado para algo que gera valor real na vida do usuário.

## Problema que resolve

- **Paralisia por escolha**: ter 200 tarefas na lista = escolher por qual começar é em si uma tarefa, e cansa.
- **Procrastinação**: listas sem hierarquia tornam fácil empurrar tudo pra depois.
- **Ansiedade crônica**: tarefas desorganizadas geram sensação de que "tudo está pendente".
- **Falta de feedback positivo**: concluir uma tarefa no Todoist dá um check silencioso; sem dopamina, sem reforço.
- **Priorização ruim ou inexistente**: o que é mais urgente ≠ o que é mais importante ≠ o que é mais fácil. Precisa de fórmula.

## Público-alvo inicial

- Usuário único inicialmente (você, o fundador).
- Futuramente: profissionais com sobrecarga cognitiva, pessoas com TDAH, empreendedores, estudantes.

## Princípios de produto (não-negociáveis)

1. **Uma tarefa por vez** — a interface nunca mostra múltiplas tarefas simultaneamente no modo foco.
2. **Juízo humano como oráculo** — a IA propõe, o humano dispõe. Toda sugestão da IA pode ser rejeitada, e rejeições alimentam recalibração.
3. **Feedback imediato e prazeroso** — concluir uma tarefa deve ser a parte mais divertida do app (som, visual, micro-celebração).
4. **Calibração contínua** — o app aprende com o uso; limiares de recalibração são configuráveis.
5. **Sem fricção** — toda ação acessível com 1 swipe ou 1 tecla.
6. **Sem fuga cognitiva** — proibido notificação sem ação direta, proibido badge infinito, proibido gamificação tóxica.

## Diferenciais

- **Swipe Tinder + keyboard nav** — mobile-first mas PC-first também.
- **Nota 0-100 transparente** — usuário vê como cada tarefa foi pontuada e pode reajustar.
- **Adiamento inteligente** — o sistema sugere um "quando adiar" baseado em padrões.
- **Dois níveis de swipe** — para adiamento manual sem abrir modal.
- **Recalibração por "juízo de valor"** — quiz friendly (5 tarefas, slider 0-100) que realinha os pesos.
- **Sync Todoist bidirecional** — integra no ecossistema existente do usuário.
- **IA opcional e incremental** — começa com regras, evolui pra sugestão, depois pra autonomia.
- **Neurociência aplicada** — som tonal (Tone.js), visual viciante, streaks, mas NUNCA manipulação tóxica.

## Métrica de sucesso do produto

- **Norte**: "o usuário sente que fez o que mais importava hoje".
- **Proxy operacional**: % de tarefas concluídas com nota alta ÷ tarefas concluídas totais (deve ser alto — se não for, priorização tá errada).
- **Uso**: streak de dias com ≥1 ação (tarefa concluída ou adiada conscientemente).
- **Satisfação**: NPS bimestral.

## Não-objetivos (o que o TinDo NÃO é)

- Não é gerenciador de projetos colaborativo (tipo Asana/ClickUp).
- Não é calendário (tipo Google Calendar).
- Não é app de notas (tipo Obsidian).
- Não é substituto do Todoist — é uma camada acima que consome o Todoist.
- Não é "fun pelo fun" — gamificação é meio, não fim.

## Inspirações

- **Tinder** — mecânica de swipe e decisão rápida.
- **Duolingo** — streak, XP, feedback imediato.
- **Superhuman** — keyboard-first, velocidade como feature.
- **Linear** — minimalismo, tipografia, escuro por padrão.
- **Apple Health** — anel de progresso satisfatório.

## Roadmap em uma frase

Fase 0-1: funciona offline com dados próprios.
Fase 2-3: sincroniza com Todoist.
Fase 4-6: gamificação, adiamento inteligente.
Fase 7-10: IA faz o trabalho pesado de priorização e caminho crítico.
Fase 11+: multi-user, comunidade, insights comparativos.
