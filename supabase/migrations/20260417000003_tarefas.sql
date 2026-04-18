CREATE TABLE public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todoist_id text,
  tipo varchar(10) NOT NULL DEFAULT 'tarefa'
    CHECK (tipo IN ('tarefa','lembrete')),
  titulo text NOT NULL,
  descricao text,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  prioridade int NOT NULL DEFAULT 4 CHECK (prioridade BETWEEN 1 AND 4),
  data_vencimento date,
  prazo_conclusao date,
  importancia int CHECK (importancia BETWEEN 0 AND 100),
  urgencia int CHECK (urgencia BETWEEN 0 AND 100),
  facilidade int CHECK (facilidade BETWEEN 0 AND 100),
  nota int NOT NULL DEFAULT 0 CHECK (nota BETWEEN 0 AND 100),
  status varchar(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','concluida','adiada','excluida')),
  dependencia_tarefa_id uuid REFERENCES public.tarefas(id) ON DELETE SET NULL,
  adiada_ate timestamptz,
  adiamento_count int NOT NULL DEFAULT 0,
  adiamento_motivo_auto text,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT dependencia_nao_mesma CHECK (id <> dependencia_tarefa_id),
  UNIQUE (usuario_id, todoist_id)
);
CREATE TRIGGER set_tarefas_updated_at BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tarefa_tags (
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tarefa_id, tag_id)
);
