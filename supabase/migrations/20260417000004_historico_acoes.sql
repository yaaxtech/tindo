CREATE TABLE public.historico_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  acao varchar(30) NOT NULL
    CHECK (acao IN ('mostrada','concluida','pulada','voltada','adiada_auto','adiada_manual','excluida','editada','criada','recalibrada')),
  tempo_ms int,
  dados jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
