-- View: fila priorizada
CREATE OR REPLACE VIEW public.fila_cards AS
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
  );

-- Índices
CREATE INDEX idx_tarefas_usuario_status ON public.tarefas (usuario_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tarefas_nota ON public.tarefas (usuario_id, nota DESC) WHERE status = 'pendente' AND deleted_at IS NULL;
CREATE INDEX idx_tarefas_adiada ON public.tarefas (usuario_id, adiada_ate) WHERE adiada_ate IS NOT NULL;
CREATE INDEX idx_tarefa_tags_tag ON public.tarefa_tags (tag_id);
CREATE INDEX idx_historico_usuario ON public.historico_acoes (usuario_id, created_at DESC);
CREATE INDEX idx_tarefas_todoist ON public.tarefas (usuario_id, todoist_id) WHERE todoist_id IS NOT NULL;
CREATE INDEX idx_projetos_usuario_ordem ON public.projetos (usuario_id, ordem_prioridade) WHERE deleted_at IS NULL AND ativo = true;

-- KPIs diários (view materializada)
CREATE MATERIALIZED VIEW public.kpis_usuario_diario AS
SELECT
  usuario_id,
  date_trunc('day', created_at)::date AS dia,
  COUNT(*) FILTER (WHERE acao='concluida') AS concluidas,
  COUNT(*) FILTER (WHERE acao='mostrada') AS mostradas,
  COUNT(*) FILTER (WHERE acao IN ('adiada_auto','adiada_manual')) AS adiadas,
  AVG(tempo_ms) FILTER (WHERE acao='mostrada') AS tempo_medio_ms
FROM public.historico_acoes
GROUP BY usuario_id, date_trunc('day', created_at);

CREATE UNIQUE INDEX idx_kpis_usuario_diario ON public.kpis_usuario_diario (usuario_id, dia);
