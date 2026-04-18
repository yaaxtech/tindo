# ESTADO ATUAL — 2026-04-18

> Atualizado quando um marco de trabalho concluir. Substitui o CHANGELOG no MVP.

## ✅ O que está funcionando de ponta a ponta

### Telas (HTTP 200)
- `/` — landing com CTA.
- `/login` — Magic Link placeholder (fluxo real pendente).
- `/cards` — card swipeable com cor de urgência por nota, swipe `← pular / → voltar / ↑ adiar manual / ↓ adiar auto`, botões, hints, celebração com som+confetti. Header mostra nível + streak reais.
- `/tarefas` — lista completa com busca, filtro (todas/tarefa/lembrete), 6 ordenações.
- `/projetos` — drag-and-drop (dnd-kit) + multiplicador editável + recalcular.
- `/tags` — tipo de peso + valor + ativo, com hint por seletor.
- `/configuracoes` — sliders de pesos com normalização automática, limiares, toggles.
- `/gamificacao` — big cards, barra de XP, heatmap 90d.

### API routes
- `GET /api/fila` — 196 tarefas reais ordenadas por nota.
- `POST /api/tarefas/[id]/acao` — concluir/adiar/excluir com log em `historico_acoes`.
- `GET/PATCH /api/projetos` — listar/atualizar ordem e multiplicador.
- `GET/PATCH /api/tags` — listar/atualizar tipo de peso.
- `GET/PATCH /api/configuracoes` — pesos (valida soma=1) + limiares + toggles.
- `POST /api/recalcular-notas` — reaplica scoring engine em batch.
- `POST /api/todoist/sync` — sync preservante (não reverte concluidas/excluidas).
- `GET /api/gamificacao` + `POST /api/gamificacao/conclusao` + `GET /api/gamificacao/historico`.

### Infra
- Supabase: projeto `jtpfauouvbtmhgrszybk`, 9 migrations aplicadas, schema em PT-BR, RLS ativa, triggers auth, seed de 19 conquistas.
- Todoist: 22 projetos + 19 labels + 196 tarefas filtradas (filtro por label "ToDo/Lembrete" E por nome de projeto contendo "Lembretes"/"ToDo"/"Falar ou Ativ"). 412 ignoradas (projetos de Compras, Notas, etc).
- Scoring engine: 8/8 testes vitest passando. Cor de urgência HSL contínua 220°→0° pra notas ≥30.
- Push Todoist DESABILITADO por segurança (WRITE_DISABLED=true).
- Single-user MVP: `TINDO_MVP_USER_ID=ba546ef1-2014-41c7-90d3-5f28f9c06903`.

## 🏗 Decisões e padrões

- **Swipe**: ESQUERDA=pular, DIREITA=voltar (invertido vs proposta inicial).
- **Sync**: pull-only via `src/lib/todoist/sync.ts`. Preserva status local.
- **Notas são derivadas**: qualquer mudança em config/projeto/tag sugere rodar "Recalcular notas" (botão disponível em todas as telas relevantes).
- **XP**: base 10 por tarefa + nota/10, 5 por lembrete, +10 bonus no primeiro do dia, +5 se streak ativo. Nível `50 × n^1.5`.
- **Cor**: jade reservado pra conclusão/OK. Urgência usa escala âmbar→vermelho (evita verde).

## 🟡 O que falta

### Alto valor (próxima sessão)
- ✅ Modal editar tarefa (feito) — botão "Editar" abre sheet com todos os campos, recalcula nota ao salvar.
- ✅ Modal adicionar tarefa (feito) — botão "+" abre o mesmo modal em modo criar.
- Modal de dependência (seleciona qual tarefa bloqueia) — botão ainda no-op.
- Wizard de calibração inicial (`/calibracao`) — perguntas de critério de sucesso pra alimentar IA.
- Auth real com Magic Link (atualmente `/login` só finge que envia).
- Deploy Cloudflare Pages.

### Médio valor
- IA Claude: classificação automática, batch analisar, sugestão de novas tarefas, quebra de tarefas grandes.
- Tela de dependência inline com seletor.
- Recalibração automática quando KPIs disparam.
- PWA ícones finais (512×512, 192×192).
- Push notifications (opcional, usuário disse que não por enquanto).

### Baixo valor (enquanto MVP)
- Multi-user + convites.
- Integrações adicionais (Google Tasks, Apple Reminders).
- Sentry / observabilidade.
- CI/CD.

## 📊 Métricas instantâneas

- 11 arquivos de doc em `docs/`.
- 34 arquivos em `src/`.
- 8 testes vitest passando.
- 0 erros TypeScript.
- 5 páginas completas, 10 endpoints API.
- 196 tarefas reais fluindo.
