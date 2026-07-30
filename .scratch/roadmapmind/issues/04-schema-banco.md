# 04 — Schema do banco (árvore de nós)

Type: grilling
Status: resolved
Blocked by: 02

## Question

Como fica o schema Supabase da árvore de nós? Decidir e documentar (seguindo as convenções do `docs/04_SCHEMA.md` e do CLAUDE.md do projeto — uuid PK, soft delete, RLS, varchar+CHECK):

1. Tabela de nós: campos (texto markdown da linha, pai, tipo bullet/número/checkbox, estado da tarefa, dono, timestamps).
2. Ordenação entre irmãos: índice fracionário (fractional indexing) vs inteiro com renumeração — decidir pensando em colaboração futura.
3. Nó-raiz por usuário (o "UM grande documento").
4. Preparo para Fase 2: onde a permissão por subárvore vai se pendurar (sem implementar ainda) — e se RLS recursiva aguenta, ou se leitura passa por RPC.
5. Preparo para futuro sync TinDo/Todoist: campo/flag de ponte na linha-tarefa (só o gancho, não a ponte).
6. Função `documento_como_markdown(no_id)` que serializa qualquer subárvore em markdown (para IA e exportação).
7. Como o formato interno do editor escolhido no ticket 02 grava/lê esses nós.

Regra do dono: SQL não vai para worker externo — este ticket é do cérebro (Claude), com confirmação do dono nos pontos com trade-off real.

Contexto do repo (padrão YaaX importado 2026-07-30):
- Seguir o checklist pré-apply de `supabase/migrations/CLAUDE.md` (RLS, índices em FK, `set_updated_at`, soft delete, varchar+CHECK).
- Já existe `espacos_trabalho` no schema — mas é mapeamento de Todoist Workspaces, NADA a ver com documentos; escolher nomes que não colidam (ex.: `doc_nos` ou similar).
- O app roda hoje com ponte single-user `TINDO_MVP_USER_ID` (ver `ESTADO_ATUAL.md`) — o RoadMapMind nasce multi-user-ready (usuario_id + RLS de verdade), sem copiar essa ponte.

Bloqueado pelo 02 porque o formato de conteúdo do editor influencia o que cada nó guarda.

## Answer

**Tabela única `doc_linhas`** (cada linha do outline = 1 registro; `id` = id do bloco no BlockNote, que é estável por design):

```sql
CREATE TABLE public.doc_linhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),      -- mesmo id do bloco BlockNote
  usuario_id uuid NOT NULL REFERENCES auth.users(id), -- dono do documento-raiz
  pai_id uuid NULL REFERENCES public.doc_linhas(id),  -- NULL só no nó-raiz do usuário
  ordem text NOT NULL,                                -- fractional index (lexicográfico)
  conteudo jsonb NOT NULL DEFAULT '[]'::jsonb,        -- inline content BlockNote (fonte do editor)
  texto_md text NOT NULL DEFAULT '',                  -- derivado no write: markdown p/ IA/busca/export
  tipo varchar(20) NOT NULL DEFAULT 'texto'
    CHECK (tipo IN ('texto','tarefa','codigo')),
  tarefa_estado varchar(20) NULL
    CHECK (tarefa_estado IN ('aberta','concluida')),
  modo_lista varchar(20) NOT NULL DEFAULT 'herdado'
    CHECK (modo_lista IN ('herdado','marcadores','numeros')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),      -- trigger set_updated_at()
  deleted_at timestamptz NULL,
  CHECK ((tipo = 'tarefa') = (tarefa_estado IS NOT NULL))
);
-- 1 raiz por usuário:
CREATE UNIQUE INDEX ON doc_linhas (usuario_id) WHERE pai_id IS NULL AND deleted_at IS NULL;
-- Navegação:
CREATE INDEX ON doc_linhas (pai_id, ordem) WHERE deleted_at IS NULL;
CREATE INDEX ON doc_linhas (usuario_id);
-- RLS MVP: USING/WITH CHECK (usuario_id = auth.uid()).
```

**Decisões e porquês:**
1. **Duas colunas de conteúdo** — `conteudo` (jsonb BlockNote, sem perda: cor etc.) é a fonte do editor; `texto_md` é SEMPRE recalculado no write (mesmo princípio da RN-03) e é o que IA/busca/exportação leem direto no banco. Resolve o desejo do dono (markdown legível no banco) sem perder fidelidade do editor.
2. **Ordenação: fractional indexing** (`ordem text`, lib `fractional-indexing`) — inserir entre irmãos não renumera ninguém; é o padrão amigável à colaboração (contrato do ticket 07).
3. **RPCs (SECURITY INVOKER, RLS aplica):**
   - `documento_como_markdown(p_linha uuid)` — CTE recursiva, devolve a subárvore como markdown indentado (IA/export).
   - `concluir_tarefa(p_linha uuid, p_forcar boolean DEFAULT false)` — sem forçar: erro se houver descendente-tarefa aberto; com forçar: fecha a subárvore inteira, atômico (o aviso de confirmação é da UI).
   - `mover_linha(p_linha uuid, p_novo_pai uuid, p_ordem text)` — valida ciclo (não mover para dentro da própria subárvore).
4. **Fase 2 (só o gancho, nada criado agora):** permissões futuras penduram em tabela `doc_permissoes (linha_id, usuario_id, papel)`; leitura de compartilhados via RPC `SECURITY DEFINER` com guard explícito — RLS recursiva por ancestral foi descartada (custo/fragilidade sob volume, ver `src/services/CLAUDE.md`).
5. **Sync TinDo/Todoist futuro:** decidido NÃO criar campo especulativo — coluna nullable depois é migração trivial (lição anti-over-engineering da auditoria de 2026-07-24).
6. **Estado de visão** (colapsado/expandido por nó): por usuário, fora do schema — localStorage no MVP; tabela própria só se precisar cross-device.
7. **Headings/título:** no outline, o "título" é a própria linha-pai renderizada grande; se o protótipo (05) pedir estilo de título explícito, o CHECK de `tipo` ganha `'titulo'` (migração trivial).

Contrato Fase 3 garantido: id uuid estável por linha, escrita por linha, `updated_at` por linha.

**EMENDA PENDENTE (2026-07-30):** o dono trouxe requisito novo — uma linha pode ter várias mães (espelhos, edição refletida). O `pai_id` único deste desenho será emendado pelo ticket [09](09-multiplas-maes.md) antes da spec (08).
