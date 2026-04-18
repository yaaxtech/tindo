CREATE TABLE public.configuracoes (
  usuario_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  peso_urgencia numeric(3,2) NOT NULL DEFAULT 0.40 CHECK (peso_urgencia BETWEEN 0 AND 1),
  peso_importancia numeric(3,2) NOT NULL DEFAULT 0.40 CHECK (peso_importancia BETWEEN 0 AND 1),
  peso_facilidade numeric(3,2) NOT NULL DEFAULT 0.20 CHECK (peso_facilidade BETWEEN 0 AND 1),
  limiar_recalibracao_reavaliacao int NOT NULL DEFAULT 30,
  limiar_recalibracao_descarte int NOT NULL DEFAULT 50,
  limiar_recalibracao_adiamento int NOT NULL DEFAULT 40,
  audio_habilitado boolean NOT NULL DEFAULT true,
  animacoes_habilitadas boolean NOT NULL DEFAULT true,
  todoist_token text,
  todoist_ultimo_sync timestamptz,
  todoist_sync_habilitado boolean NOT NULL DEFAULT false,
  ai_habilitado boolean NOT NULL DEFAULT false,
  ai_modelo_classificacao varchar(50) NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  ai_modelo_analise varchar(50) NOT NULL DEFAULT 'claude-sonnet-4-6',
  criterios_sucesso jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pesos_somam_um CHECK (
    ABS((peso_urgencia + peso_importancia + peso_facilidade) - 1.0) < 0.01
  )
);
CREATE TRIGGER set_configuracoes_updated_at BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: cria configs e gamificacao ao criar usuário
CREATE OR REPLACE FUNCTION public.on_novo_usuario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.configuracoes (usuario_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.gamificacao (usuario_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_novo_usuario();
