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

## Fase 1 — Card Swipeable com Mock (meta: 2-3 dias) — ✅ DONE

- [x] Componente `TaskCard` com layout completo (obsidian/jade)
- [x] `SwipeHandler` usando Framer Motion (4 direções)
- [x] Threshold visual: feedback de cor durante o drag
- [x] `KeyboardNav` (setas, Space/Enter, E, D, L, N, Esc, Cmd+Z)
- [x] Store Zustand `useCardStackStore` com fila + histórico
- [x] Mock data (20 tarefas fake)
- [x] `CompletionCelebration` — som + confetti + check + +XP ticker
- [x] `AdiamentoNivel2` — 2º nível de swipe funcional
- [x] Shell de navegação (mobile bottom nav, desktop sidebar)
- [x] PWA funcional (instalável)

**Critério de done**: consigo abrir em mobile e desktop, passar por 10 cards usando apenas swipe/teclado, concluir com efeito viciante, e voltar/avançar.

## Fase 2 — Persistência e Scoring (meta: 2 dias) — ✅ DONE

- [x] Serviços `tarefas`, `projetos`, `tags`, `configuracoes` com Supabase real
- [x] `src/lib/scoring/engine.ts` com a fórmula completa + testes
- [x] Triggers PG que recalculam `nota` em update (ou service cuida)
- [x] Tela `/tarefas` (lista + filtros + busca)
- [x] Tela `/projetos` (drag-and-drop ordenação)
- [x] Tela `/tags` (criar com tipo de peso)
- [x] Tela `/configuracoes/scoring` (sliders de w_urg/imp/fac)
- [x] CRUD completo (criar, editar, excluir — soft delete)

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

## Fase 4 — Gamificação v1 (meta: 2 dias) — ✅ DONE (parcial)

- [x] Tabela `gamificacao` + `conquistas` + triggers
- [x] Service `gamificacao.ts` (XP, streak, conquistas)
- [x] Store Zustand + UI reativa
- [x] Tela `/gamificacao` (streak, XP, nível, heatmap, conquistas)
- [x] StreakBadge no header
- [x] Sons variados + level up fanfare
- [ ] Congelador de streak
- [ ] Anéis semanais

**Critério de done**: ganho XP ao concluir, subo de nível, streak incrementa, conquistas desbloqueiam com celebração.

## Fase 5 — Adiamento Inteligente (meta: 2 dias) — ✅ DONE

- [x] Adiamento manual persistido via `/api/tarefas/[id]/acao` + `adiamentoCount++`
- [x] Adiamento automático com heurística em `src/lib/adiamento/heuristica.ts`:
  - Buckets: tag+dia, projeto+dia, tag, projeto, dia (≥3 amostras)
  - Fallback inteligente por hora do dia
- [x] Motivo gravado em `adiamento_motivo_auto` + `historico_acoes.dados`
- [x] Toast global com Undo 5s (`Toaster` + `useToasts`) + ação `desfazer_adiamento`
- [x] `AdiamentoNivel2` redesenhado: sugestão destacada + grid 2x3 de presets + accordion custom

**Critério de done**: adio via ↑ e ↓, sistema aprende padrões básicos e sugere horários relevantes.

## Fase 6 — Calibração Inicial de IA (meta: 2 dias) — ✅ DONE

- [x] Wizard `/calibracao` (4 perguntas) — sem LLM ainda, só captura
- [x] Persiste em `configuracoes.criterios_sucesso` via `/api/calibracao`
- [x] Ordenação de projetos (drag-and-drop com @dnd-kit + auto-save)
- [x] Input de Claude API key (aba IA em `/configuracoes`)
- [x] Migration `20260419000001_calibracao_ai.sql` aplicada

**Critério de done**: completo wizard uma vez, respostas salvam, é possível editar.

## Fase 7 — IA Classificação de Tarefas (meta: 3 dias) — ✅ DONE

- [x] SDK Anthropic integrado (`@anthropic-ai/sdk`)
- [x] System prompts em `src/lib/ai/prompts.ts` com caching ephemeral (projetos+tags+critérios)
- [x] `POST /api/ai/classificar` — aceita `tarefaId` OU `{ titulo, descricao, projetoId }`
- [x] `POST /api/ai/testar` — valida chave real via `messages.create` com max_tokens 1
- [x] Service `src/services/ai.ts` usando tool_use `classificar_tarefa`
- [x] Modal `TarefaModal` com botão "Classificar com IA" + explicação exibida
- [x] Aceitar/editar preenchendo sliders + tag_ids automaticamente
- [x] Registro em `sugestoes_ai` quando há `tarefaId`
- [ ] Auto-classificação ao criar tarefa (feature flag `ai_auto_aceita_classificacao` já existe; hook ainda pendente)

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
