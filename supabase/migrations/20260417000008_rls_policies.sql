-- Ativar RLS
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

-- Policies padrão (cada usuário vê só os próprios)
CREATE POLICY "own rows projetos" ON public.projetos
  FOR ALL USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "own rows tags" ON public.tags
  FOR ALL USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "own rows tarefas" ON public.tarefas
  FOR ALL USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "own rows tarefa_tags" ON public.tarefa_tags
  FOR ALL USING (
    tarefa_id IN (SELECT id FROM public.tarefas WHERE usuario_id = auth.uid())
  ) WITH CHECK (
    tarefa_id IN (SELECT id FROM public.tarefas WHERE usuario_id = auth.uid())
  );

CREATE POLICY "own rows historico" ON public.historico_acoes
  FOR ALL USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "own rows gamificacao" ON public.gamificacao
  FOR ALL USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "own rows conquistas_usuario" ON public.conquistas_usuario
  FOR ALL USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "own rows calibracoes" ON public.calibracoes
  FOR ALL USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "own rows sugestoes_ai" ON public.sugestoes_ai
  FOR ALL USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "own rows configuracoes" ON public.configuracoes
  FOR ALL USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- conquistas é catálogo global (leitura livre; escrita só via service_role)
-- Não habilitamos RLS ou criamos policy restritiva conforme preferência.
ALTER TABLE public.conquistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalogo publico" ON public.conquistas
  FOR SELECT USING (true);
