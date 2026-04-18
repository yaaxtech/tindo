CREATE TABLE public.calibracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo varchar(30) NOT NULL
    CHECK (tipo IN ('inicial','despreocupacao','caminho_critico','adiamento','pesos')),
  dados jsonb NOT NULL,
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
  payload jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aceita','rejeitada','parcial')),
  resposta_usuario jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolvida_em timestamptz
);
