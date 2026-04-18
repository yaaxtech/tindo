CREATE TABLE public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todoist_id text,
  nome text NOT NULL,
  cor varchar(7) DEFAULT '#198B74',
  ordem_prioridade int NOT NULL DEFAULT 999,
  multiplicador numeric(4,2) NOT NULL DEFAULT 1.00 CHECK (multiplicador >= 0 AND multiplicador <= 5),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (usuario_id, todoist_id)
);
CREATE TRIGGER set_projetos_updated_at BEFORE UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
