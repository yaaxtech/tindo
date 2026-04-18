# 09 — Roadmap por Fases

> Fases são **entregáveis funcionais**, não arbitrárias. Cada fase termina em um estado testável pelo usuário.

## Fase 0 — Fundação (meta: 1-2 dias)

- [x] Estrutura de docs criada
- [x] CLAUDE.md criado
- [x] Permissões autorizadas
- [ ] Inicializar Next.js 15 + Bun + TypeScript strict
- [ ] Instalar e configurar: Tailwind, shadcn/ui, Biome, Vitest
- [ ] Configurar `next-pwa` (service worker, manifest)
- [ ] Configurar design tokens (obsidian + jade) em `globals.css`
- [ ] Criar Supabase client (browser + server)
- [ ] Escrever migrations (01-09) em `supabase/migrations/`
- [ ] Gerar types do schema (`database.ts`)
- [ ] Setup .env.example + .env.local
- [ ] .gitignore adequado
- [ ] README.md com "como rodar"
- [ ] Commit inicial

**Critério de done**: `bun run dev` abre uma tela de login funcional (mock ou Magic Link), e `bun run typecheck` passa.

## Fase 1 — Card Swipeable com Mock (meta: 2-3 dias)

- [ ] Componente `TaskCard` com layout completo (obsidian/jade)
- [ ] `SwipeHandler` usando Framer Motion (4 direções)
- [ ] Threshold visual: feedback de cor durante o drag
- [ ] `KeyboardNav` (setas, Space/Enter, E, D, L, N, Esc, Cmd+Z)
- [ ] Store Zustand `useCardStackStore` com fila + histórico
- [ ] Mock data (20 tarefas fake)
- [ ] `CompletionCelebration` — som + confetti + check + +XP ticker
- [ ] `AdiamentoNivel2` — 2º nível de swipe funcional
- [ ] Shell de navegação (mobile bottom nav, desktop sidebar)
- [ ] PWA funcional (instalável)

**Critério de done**: consigo abrir em mobile e desktop, passar por 10 cards usando apenas swipe/teclado, concluir com efeito viciante, e voltar/avançar.

## Fase 2 — Persistência e Scoring (meta: 2 dias)

- [ ] Serviços `tarefas`, `projetos`, `tags`, `configuracoes` com Supabase real
- [ ] `src/lib/scoring/engine.ts` com a fórmula completa + testes
- [ ] Triggers PG que recalculam `nota` em update (ou service cuida)
- [ ] Tela `/tarefas` (lista + filtros + busca)
- [ ] Tela `/projetos` (drag-and-drop ordenação)
- [ ] Tela `/tags` (criar com tipo de peso)
- [ ] Tela `/configuracoes/scoring` (sliders de w_urg/imp/fac)
- [ ] CRUD completo (criar, editar, excluir — soft delete)

**Critério de done**: crio tarefas reais, vejo na fila ordenada pela nota, altero pesos e a fila re-ordena.

## Fase 3 — Sincronização Todoist (meta: 3-4 dias)

- [ ] Input de token em `/configuracoes/todoist`
- [ ] Endpoint `POST /api/todoist/testar` (valida token)
- [ ] Importação inicial (wizard)
- [ ] Mapper `todoist.mapper.ts` + testes com fixtures
- [ ] `POST /api/todoist/sync` — sync bidirecional
- [ ] Cron: pg_cron ou CF Cron a cada 2 min
- [ ] Tratamento de conflitos (last-write-wins + log)
- [ ] Tela de status de sync (última vez, erros)

**Critério de done**: crio tarefa no Todoist mobile, aparece no TinDo em ≤2min. Concluo no TinDo, marca como concluída no Todoist.

## Fase 4 — Gamificação v1 (meta: 2 dias)

- [ ] Tabela `gamificacao` + `conquistas` + triggers
- [ ] Service `gamificacao.ts` (XP, streak, conquistas)
- [ ] Store Zustand + UI reativa
- [ ] Tela `/gamificacao` (streak, XP, nível, heatmap, conquistas)
- [ ] StreakBadge no header
- [ ] Sons variados + level up fanfare
- [ ] Congelador de streak
- [ ] Anéis semanais

**Critério de done**: ganho XP ao concluir, subo de nível, streak incrementa, conquistas desbloqueiam com celebração.

## Fase 5 — Adiamento Inteligente (meta: 2 dias)

- [ ] Adiamento manual (nível 2 já existe em Fase 1; agora persiste de verdade)
- [ ] Adiamento automático com heurística:
  - Se usuário costuma adiar tarefas com tag X → adia pra horário Y
  - Dia da semana + hora do dia → sugere
- [ ] Motivo do adiamento em `adiamento_motivo_auto`
- [ ] Undo em toast 5s

**Critério de done**: adio via ↑ e ↓, sistema aprende padrões básicos e sugere horários relevantes.

## Fase 6 — Calibração Inicial de IA (meta: 2 dias)

- [ ] Wizard `/calibracao` (4 perguntas) — sem LLM ainda, só captura
- [ ] Persiste em `configuracoes.criterios_sucesso`
- [ ] Ordenação de projetos (drag-and-drop)
- [ ] Input de Claude API key

**Critério de done**: completo wizard uma vez, respostas salvam, é possível editar.

## Fase 7 — IA Classificação de Tarefas (meta: 3 dias)

- [ ] SDK Anthropic integrado
- [ ] System prompts em `prompts.ts` com caching
- [ ] `POST /api/ai/classificar` — 1 tarefa
- [ ] Auto-classificação ao criar tarefa (se feature flag ativa)
- [ ] Modal "Sugerido pela IA: ..." em tarefas não-classificadas
- [ ] Aceitar / editar / rejeitar
- [ ] Registro em `sugestoes_ai`

**Critério de done**: nova tarefa é classificada automaticamente em ≤3s, posso aceitar/editar.

## Fase 8 — IA Batch e Quebra (meta: 3 dias)

- [ ] `/configuracoes/ia/analisar` — rodar em batch
- [ ] Tela "inbox" de sugestões (aceitar em lote)
- [ ] Quebra de tarefa grande em sub-tarefas
- [ ] Sugestão de merge/delete

**Critério de done**: seleciono 20 tarefas, IA analisa em 30s, aceito parcial.

## Fase 9 — IA Caminho Crítico (meta: 3 dias)

- [ ] `/sugestoes` tela Tinder de sugestões
- [ ] Sugestão de novas tarefas (swipe right = criar)
- [ ] Histórico de sugestões e razão

**Critério de done**: IA sugere 5 novas tarefas relevantes ao meu caminho, eu aceito 2 e elas viram cards.

## Fase 10 — Recalibração (meta: 3 dias)

- [ ] View materializada `kpis_usuario_diario`
- [ ] Cron diário que calcula KPIs S01-S07
- [ ] Detecção de gatilhos
- [ ] Notificação in-app "hora de recalibrar"
- [ ] Tela slide das 5 com slider 0-100
- [ ] Cálculo de correlação + proposta de novos pesos
- [ ] Aplicação + recálculo batch das notas

**Critério de done**: quando KPI passa limiar, app sugere recalibração, eu faço em 60s, pesos e notas atualizam.

## Fase 11 — Polimento + Deploy Produção (meta: 2-3 dias)

- [ ] Deploy Cloudflare Pages com Preview por PR
- [ ] PWA ícones e splash completos
- [ ] Notificações push (fase posterior)
- [ ] Auditoria de acessibilidade
- [ ] Testes e2e com Playwright (fluxos críticos)
- [ ] Performance audit (Lighthouse ≥ 95)

**Critério de done**: app em `tindo.yaax.tech` (ou domínio escolhido), LCP < 1.5s, instalável em iOS/Android/desktop.

## Fase 12+ — Futuro

- Multi-usuário com convites
- Integrações adicionais (Google Tasks, Apple Reminders, Notion)
- Comunidade (comparar KPIs anônimos)
- Modelos fine-tuned por usuário (long term)
- Assistente de voz

## Timebox e replanejamento

- Cada fase deve caber em 1 semana calendário (mesmo que a estimativa em dias seja menor).
- Ao fim de cada fase: retrospectiva rápida, atualizar este doc com reais vs estimado.
- Se uma fase estourar em >50% do estimado, dividir ao invés de alongar.
