# 04 — Schema do Banco (Supabase / PostgreSQL 15)

## Princípios

- Single-user agora (campo `usuario_id` presente, mas pertence ao próprio auth user).
- Soft delete em todas as tabelas operacionais (`deleted_at`).
- Nota 0-100 é materializada para ordenação mas recalculada sempre que insumos mudam (via trigger ou service).
- RLS habilitada em todas as tabelas de dados do usuário (`usuario_id = auth.uid()`).
- UUIDs via `gen_random_uuid()`.
- Timestamps `timestamptz` com default `now()`.
- Sem enum PostgreSQL — usar `varchar` + `CHECK IN (...)`.

## Migrações

Arquivos em `supabase/migrations/`. Nomenclatura: `YYYYMMDDHHMMSS_descricao.sql`.

Ordem inicial:
1. `20260417000001_extensions_and_helpers.sql` — extensões e triggers reutilizáveis.
2. `20260417000002_espacos_trabalho.sql` — espaços de trabalho (Todoist Workspaces).
3. `20260417000003_projetos_tags.sql` — projetos (dentro de espaços) e tags.
4. `20260417000004_tarefas.sql` — tabela principal.
5. `20260417000005_historico_acoes.sql` — log de ações.
6. `20260417000006_gamificacao.sql` — streaks, xp, conquistas.
7. `20260417000007_calibracao.sql` — respostas de calibração e recalibrações.
8. `20260417000008_configuracoes.sql` — configs do usuário.
9. `20260417000009_rls_policies.sql` — ativação e políticas RLS.
10. `20260417000010_views_indices.sql` — views de conveniência e índices.

## DDL

### 01 — Extensões e helpers

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 02 — Espaços de Trabalho, Projetos e Tags

```sql
-- Mapeia Todoist Workspaces (feature de times).
-- Usuários sem workspace no Todoist têm uma linha default criada automaticamente.
CREATE TABLE public.espacos_trabalho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todoist_id text,                          -- id do workspace no Todoist
  nome text NOT NULL,
  ordem_prioridade int NOT NULL DEFAULT 999,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (usuario_id, todoist_id)
);
CREATE TRIGGER set_espacos_trabalho_updated_at BEFORE UPDATE ON public.espacos_trabalho
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  espaco_trabalho_id uuid REFERENCES public.espacos_trabalho(id) ON DELETE SET NULL,
  todoist_id text,                          -- id do projeto no Todoist (se sincronizado)
  nome text NOT NULL,
  cor varchar(7) DEFAULT '#198B74',
  ordem_prioridade int NOT NULL DEFAULT 999, -- menor = mais prioritário
  multiplicador numeric(4,2) NOT NULL DEFAULT 1.00 CHECK (multiplicador >= 0 AND multiplicador <= 5),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (usuario_id, todoist_id)
);
CREATE TRIGGER set_projetos_updated_at BEFORE UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todoist_id text,
  nome text NOT NULL,
  cor varchar(7) DEFAULT '#2CAF93',
  tipo_peso varchar(20) NOT NULL DEFAULT 'multiplicador'
    CHECK (tipo_peso IN ('multiplicador','soma','subtracao','percentual','peso_custom')),
  valor_peso numeric(6,2) NOT NULL DEFAULT 1.00,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (usuario_id, todoist_id),
  UNIQUE (usuario_id, nome)
);
CREATE TRIGGER set_tags_updated_at BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 03 — Tarefas

```sql
CREATE TABLE public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todoist_id text,                                   -- null se criada no TinDo
  tipo varchar(10) NOT NULL DEFAULT 'tarefa'
    CHECK (tipo IN ('tarefa','lembrete')),
  titulo text NOT NULL,
  descricao text,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  prioridade int NOT NULL DEFAULT 4 CHECK (prioridade BETWEEN 1 AND 4),
  data_vencimento date,
  prazo_conclusao date,                              -- deadline hard
  importancia int CHECK (importancia BETWEEN 0 AND 100),
  urgencia int CHECK (urgencia BETWEEN 0 AND 100),
  facilidade int CHECK (facilidade BETWEEN 0 AND 100),
  nota int NOT NULL DEFAULT 0 CHECK (nota BETWEEN 0 AND 100), -- materializada
  status varchar(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','concluida','adiada','excluida')),
  dependencia_tarefa_id uuid REFERENCES public.tarefas(id) ON DELETE SET NULL,
  adiada_ate timestamptz,
  adiamento_count int NOT NULL DEFAULT 0,
  adiamento_motivo_auto text,                        -- preenchido quando adiado pelo sistema
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT dependencia_nao_mesma CHECK (id <> dependencia_tarefa_id),
  UNIQUE (usuario_id, todoist_id)
);
CREATE TRIGGER set_tarefas_updated_at BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE public.tarefa_tags (
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tarefa_id, tag_id)
);
```

### 04 — Histórico de ações

```sql
CREATE TABLE public.historico_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  acao varchar(30) NOT NULL
    CHECK (acao IN ('mostrada','concluida','pulada','voltada','adiada_auto','adiada_manual','excluida','editada','criada','recalibrada')),
  tempo_ms int,                               -- tempo na tela
  dados jsonb,                                -- snapshot relevante (nota, adiada_ate, etc)
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 05 — Gamificação

```sql
CREATE TABLE public.gamificacao (
  usuario_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp_total int NOT NULL DEFAULT 0,
  nivel int NOT NULL DEFAULT 1,
  streak_atual int NOT NULL DEFAULT 0,
  streak_recorde int NOT NULL DEFAULT 0,
  ultimo_dia_ativo date,
  tarefas_concluidas_total int NOT NULL DEFAULT 0,
  lembretes_concluidos_total int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_gamificacao_updated_at BEFORE UPDATE ON public.gamificacao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE public.conquistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(60) NOT NULL UNIQUE,         -- 'primeira_tarefa', 'streak_7', etc
  nome text NOT NULL,
  descricao text NOT NULL,
  icone varchar(50),
  meta jsonb,                                 -- { tipo: 'tarefas_concluidas', valor: 100 }
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.conquistas_usuario (
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conquista_id uuid NOT NULL REFERENCES public.conquistas(id) ON DELETE CASCADE,
  desbloqueada_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, conquista_id)
);
```

### 06 — Calibração

```sql
CREATE TABLE public.calibracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo varchar(30) NOT NULL
    CHECK (tipo IN ('inicial','despreocupacao','caminho_critico','adiamento','pesos')),
  dados jsonb NOT NULL,                       -- estrutura varia por tipo
  aplicada boolean NOT NULL DEFAULT false,
  aplicada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sugestoes_ai (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tarefa_id uuid REFERENCES public.tarefas(id) ON DELETE CASCADE,
  tipo varchar(30) NOT NULL
    CHECK (tipo IN ('classificar','quebrar','sugerir_nova','mesclar','excluir','recalibrar')),
  payload jsonb NOT NULL,                     -- proposta da IA
  status varchar(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aceita','rejeitada','parcial')),
  resposta_usuario jsonb,                     -- o que o usuário decidiu
  created_at timestamptz NOT NULL DEFAULT now(),
  resolvida_em timestamptz
);
```

### 07 — Configurações

```sql
CREATE TABLE public.configuracoes (
  usuario_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Pesos do scoring (somam 1.0)
  peso_urgencia numeric(3,2) NOT NULL DEFAULT 0.40 CHECK (peso_urgencia BETWEEN 0 AND 1),
  peso_importancia numeric(3,2) NOT NULL DEFAULT 0.40 CHECK (peso_importancia BETWEEN 0 AND 1),
  peso_facilidade numeric(3,2) NOT NULL DEFAULT 0.20 CHECK (peso_facilidade BETWEEN 0 AND 1),
  -- Limiares de recalibração (%)
  limiar_recalibracao_reavaliacao int NOT NULL DEFAULT 30,
  limiar_recalibracao_descarte int NOT NULL DEFAULT 50,
  limiar_recalibracao_adiamento int NOT NULL DEFAULT 40,
  -- UX
  audio_habilitado boolean NOT NULL DEFAULT true,
  animacoes_habilitadas boolean NOT NULL DEFAULT true,
  -- Todoist (token criptografado — nunca em plain text no client)
  todoist_token_enc text,                     -- AES via Supabase Vault, futuro
  todoist_token text,                         -- MVP: plain (single-user), marcar pra trocar
  todoist_ultimo_sync timestamptz,
  todoist_sync_habilitado boolean NOT NULL DEFAULT false,
  -- IA
  ai_habilitado boolean NOT NULL DEFAULT false,
  ai_modelo_classificacao varchar(50) NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  ai_modelo_analise varchar(50) NOT NULL DEFAULT 'claude-sonnet-4-6',
  -- Critérios de sucesso (respostas da calibração inicial)
  criterios_sucesso jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pesos_somam_um CHECK (
    ABS((peso_urgencia + peso_importancia + peso_facilidade) - 1.0) < 0.01
  )
);
CREATE TRIGGER set_configuracoes_updated_at BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 08 — RLS

```sql
-- Ativar RLS
ALTER TABLE public.espacos_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefa_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conquistas_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calibracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sugestoes_ai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
-- `conquistas` é global (catálogo), sem RLS mas só-leitura

-- Policies: cada usuário vê e altera só os próprios registros
CREATE POLICY "own rows" ON public.espacos_trabalho
  FOR ALL USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "own rows" ON public.projetos
  FOR ALL USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
-- repetir para cada tabela com usuario_id
-- tarefa_tags: via join com tarefas
CREATE POLICY "own tarefa_tags" ON public.tarefa_tags
  FOR ALL USING (
    tarefa_id IN (SELECT id FROM public.tarefas WHERE usuario_id = auth.uid())
  ) WITH CHECK (
    tarefa_id IN (SELECT id FROM public.tarefas WHERE usuario_id = auth.uid())
  );
```

### 09 — Views e índices

```sql
-- Fila priorizada (já filtra pendentes, não adiadas, sem dependência aberta)
CREATE VIEW public.fila_cards AS
SELECT
  t.*,
  p.nome AS projeto_nome,
  p.cor AS projeto_cor
FROM public.tarefas t
LEFT JOIN public.projetos p ON p.id = t.projeto_id
WHERE t.status = 'pendente'
  AND t.deleted_at IS NULL
  AND (t.adiada_ate IS NULL OR t.adiada_ate <= now())
  AND (
    t.dependencia_tarefa_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.tarefas d
      WHERE d.id = t.dependencia_tarefa_id AND d.status = 'concluida'
    )
  )
ORDER BY t.nota DESC, t.urgencia DESC NULLS LAST, t.updated_at DESC;

-- Índices críticos
CREATE INDEX idx_tarefas_usuario_status ON public.tarefas (usuario_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tarefas_nota ON public.tarefas (usuario_id, nota DESC) WHERE status = 'pendente' AND deleted_at IS NULL;
CREATE INDEX idx_tarefas_adiada ON public.tarefas (usuario_id, adiada_ate) WHERE adiada_ate IS NOT NULL;
CREATE INDEX idx_tarefa_tags_tag ON public.tarefa_tags (tag_id);
CREATE INDEX idx_historico_usuario ON public.historico_acoes (usuario_id, created_at DESC);
CREATE INDEX idx_tarefas_todoist ON public.tarefas (usuario_id, todoist_id) WHERE todoist_id IS NOT NULL;
```

## Auto-criação de configs ao sign up

Trigger em `auth.users` cria linha default em `configuracoes` e `gamificacao`:

```sql
CREATE OR REPLACE FUNCTION public.on_novo_usuario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.configuracoes (usuario_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.gamificacao (usuario_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION on_novo_usuario();
```

## Seeds

`supabase/seed.sql`:
- Catálogo inicial de conquistas (primeira_tarefa, streak_7, streak_30, 100_concluidas, etc).

## Convenções ao mexer no schema

- Toda mudança = nova migration (nunca editar migration passada aplicada em produção).
- Regenerar `src/types/database.ts` após toda migration:
  ```bash
  bunx supabase gen types typescript --project-id jtpfauouvbtmhgrszybk > src/types/database.ts
  ```
- Testar RLS localmente: Supabase CLI com `supabase start` + seed.
