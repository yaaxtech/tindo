# 05 — Sincronização Todoist

## Objetivo

Sincronização **bidirecional** entre TinDo ↔ Todoist para que:
- Tarefas criadas/editadas no Todoist aparecem no TinDo.
- Concluir/adiar/editar no TinDo reflete no Todoist.
- Conflitos resolvidos por `updated_at` mais recente (last-write-wins).

## Filtro inicial de tarefas

**Por etiquetas Todoist:**
- Label `Lembretes` (aliases: `fazer 2min`, `criar /`, `criar todo`) → `tipo='lembrete'` no TinDo.
- Label `Todo` → `tipo='tarefa'` no TinDo.
- Tarefas sem nenhuma das duas labels: **ignoradas** inicialmente (configurável depois).

## API escolhida

**Todoist REST API v2** (https://developer.todoist.com/rest/v2/)
- Mais simples que a Sync API, suficiente para MVP.
- Autenticação: Bearer token pessoal (gerado em Todoist → Settings → Integrations).
- Endpoints principais:
  - `GET /tasks` — listar tarefas ativas
  - `GET /projects` — listar projetos
  - `GET /labels` — listar labels
  - `POST /tasks` — criar
  - `POST /tasks/{id}` — atualizar
  - `POST /tasks/{id}/close` — concluir
  - `POST /tasks/{id}/reopen` — reabrir
  - `DELETE /tasks/{id}` — deletar

Rate limit: 450 requests/15min por usuário.

## Estratégia de sync

### MVP (Fase 3)
**Polling** a cada 2 minutos.
- Cron via **Supabase pg_cron** extension OU Cloudflare Workers Cron Trigger.
- Função: `sync_todoist(usuario_id)`:
  1. `GET /tasks` com `updated_at > last_sync`.
  2. Upsert no TinDo.
  3. Enviar deltas locais (pending_sync_queue) ao Todoist.
  4. Atualizar `configuracoes.todoist_ultimo_sync`.

### v1+ (Fase 6+)
**Webhooks Todoist** (https://developer.todoist.com/sync/v9/#webhooks).
- Endpoint: `POST /api/todoist/webhook`.
- Eventos: `item:added`, `item:updated`, `item:completed`, `item:deleted`.
- Validar assinatura com `TODOIST_WEBHOOK_SECRET` (HMAC-SHA256 do body).
- Processar idempotente (usar `event_uuid`).

## Mapping Todoist ↔ TinDo

### Tarefa
| Todoist | TinDo | Notas |
|---|---|---|
| `id` | `todoist_id` | string, mantido |
| `content` | `titulo` | |
| `description` | `descricao` | |
| `project_id` | `projeto_id` (lookup) | |
| `labels[]` | tags (via `tarefa_tags`) | mapear cada label → tag local |
| `priority` (1=normal, 4=urgent) | `prioridade` | Todoist usa 1-4 com 4=urgent; TinDo usa 1-4 com 1=urgent. **Converter: priority_tindo = 5 - priority_todoist** |
| `due.date` | `data_vencimento` | ISO date |
| `deadline.date` | `prazo_conclusao` | novo campo Todoist |
| `is_completed` | `status='concluida'` | |
| `created_at` | `created_at` | preservar |
| — | `tipo` | derivado da label (Lembretes→lembrete, Todo→tarefa) |

### Projeto
| Todoist | TinDo |
|---|---|
| `id` | `todoist_id` |
| `name` | `nome` |
| `color` | `cor` (mapear paleta Todoist → hex) |
| `order` | `ordem_prioridade` |

### Label
| Todoist | TinDo |
|---|---|
| `id` | `todoist_id` |
| `name` | `nome` |
| `color` | `cor` |

Default ao importar label nova: `tipo_peso='multiplicador'`, `valor_peso=1.00`. Usuário ajusta em `/tags`.

## Fluxo de sync

### Pull (Todoist → TinDo)
```
1. Fetch tarefas Todoist com updated_at > last_sync
2. Para cada tarefa:
   a. Se todoist_id existe no TinDo:
      - Se tarefa.updated_at Todoist > TinDo: atualizar TinDo
      - Se TinDo foi atualizado localmente mais recente: skip (deixa push cuidar)
   b. Se não existe: criar no TinDo (se tem label Lembretes/Todo)
3. Para cada tarefa TinDo com todoist_id mas não retornada na lista:
   - Se Todoist retornou com is_completed=true ou 404: marcar concluida/excluida no TinDo
```

### Push (TinDo → Todoist)
```
Todas as mutations no TinDo enfileiram em `sync_queue` (tabela ou fila local).
Worker consome:
1. INSERT tarefa no TinDo → POST /tasks no Todoist → salvar todoist_id de volta
2. UPDATE (título, desc, data) → POST /tasks/{id}
3. CONCLUIDA → POST /tasks/{id}/close
4. REABERTA → POST /tasks/{id}/reopen
5. EXCLUIDA (soft delete) → DELETE /tasks/{id}
```

### Conflitos
- Comparar `updated_at` em ambos os lados.
- Vencedor: o mais recente.
- Logar conflitos em `logs_sync` para auditoria.

## Adiar no TinDo → Todoist?

Adiar no TinDo atualiza `adiada_ate`. No Todoist, isso pode ser refletido como:
- Opção A: `due.date` = `adiada_ate::date` (mexe no due date).
- Opção B: não refletir (deixa Todoist como está).

**Padrão proposto: Opção A** — adiamentos mudam o due date no Todoist. Mas isso pode ser frustrante se o usuário usa Todoist em outros lugares. **Configurável em `/configuracoes/todoist`.**

## Segurança do token

- MVP (single-user): token em `configuracoes.todoist_token` plain.
- v1+: migrar pra Supabase Vault (quando disponível) ou criptografia server-side com `SUPABASE_SERVICE_ROLE_KEY` + `pgcrypto`.
- Nunca expor token ao client (endpoints de sync são server-only).

## Tratamento de erros

- Rate limit 429: backoff exponencial (2s, 4s, 8s, 16s, máx 64s), no máx 5 tentativas.
- 5xx: enfileirar retry, notificar usuário se >3 falhas consecutivas.
- 401/403: desabilitar sync, pedir ao usuário renovar token.

## Primeira importação

Ao habilitar Todoist pela primeira vez:
1. Wizard pede o token.
2. `GET /projects` + `GET /labels` + `GET /tasks` (todas).
3. Pré-visualização: "Encontrei 120 tarefas, 5 projetos, 18 labels. Importar?"
4. Usuário confirma → batch insert.
5. Background job popula `notas` calculadas.
6. Redirecionar pra `/calibracao` (ordenar projetos e classificar labels).

## Testes

- Mock do client Todoist em `src/lib/todoist/__mocks__/client.ts`.
- Fixtures JSON em `src/lib/todoist/__fixtures__/`.
- Testes de mapping: cada campo Todoist → TinDo e vice-versa.
- Testes de conflict resolution.
