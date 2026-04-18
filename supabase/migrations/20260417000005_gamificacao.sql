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
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.conquistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(60) NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text NOT NULL,
  icone varchar(50),
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.conquistas_usuario (
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conquista_id uuid NOT NULL REFERENCES public.conquistas(id) ON DELETE CASCADE,
  desbloqueada_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, conquista_id)
);
