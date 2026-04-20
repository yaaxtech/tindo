-- Adiciona tabela espacos_trabalho (mapeia Todoist Workspaces)
-- e vincula projetos existentes a ela via espaco_trabalho_id.

CREATE TABLE public.espacos_trabalho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todoist_id text,
  nome text NOT NULL,
  ordem_prioridade int NOT NULL DEFAULT 999,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (usuario_id, todoist_id)
);

CREATE TRIGGER set_espacos_trabalho_updated_at
  BEFORE UPDATE ON public.espacos_trabalho
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.espacos_trabalho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rows" ON public.espacos_trabalho
  FOR ALL
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Vincula projetos a espaços de trabalho
ALTER TABLE public.projetos
  ADD COLUMN espaco_trabalho_id uuid REFERENCES public.espacos_trabalho(id) ON DELETE SET NULL;

CREATE INDEX idx_projetos_espaco ON public.projetos (usuario_id, espaco_trabalho_id)
  WHERE deleted_at IS NULL;

-- Espaço padrão "Pessoal" criado automaticamente no sign up
-- (usuários sem Workspace no Todoist são agrupados aqui)
CREATE OR REPLACE FUNCTION public.on_novo_usuario_espaco_pessoal()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.espacos_trabalho (usuario_id, nome, ordem_prioridade)
  VALUES (NEW.id, 'Pessoal', 1)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Encadeia ao trigger existente via função separada para não sobrescrever on_novo_usuario()
CREATE TRIGGER on_auth_user_created_espaco
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION on_novo_usuario_espaco_pessoal();
