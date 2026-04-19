-- Migration: view materializada de KPIs + colunas de recalibração em configuracoes
-- Fase 10 — Recalibração

-- Colunas extras em configuracoes
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS ultima_recalibracao_em timestamptz,
  ADD COLUMN IF NOT EXISTS recalibracao_sugerida_em timestamptz,
  ADD COLUMN IF NOT EXISTS recalibracao_motivo text;

-- View materializada de KPIs diários (últimos 90 dias)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.kpis_usuario_diario AS
SELECT
  usuario_id,
  date(created_at AT TIME ZONE 'UTC') AS dia,
  COUNT(*) FILTER (WHERE acao = 'mostrada')                           AS n_mostradas,
  COUNT(*) FILTER (WHERE acao = 'concluida')                          AS n_concluidas,
  COUNT(*) FILTER (WHERE acao = 'pulada')                             AS n_puladas,
  COUNT(*) FILTER (WHERE acao = 'excluida')                           AS n_excluidas,
  COUNT(*) FILTER (WHERE acao IN ('adiada_auto','adiada_manual'))      AS n_adiadas,
  COUNT(*) FILTER (WHERE acao = 'editada')                            AS n_editadas
FROM public.historico_acoes
WHERE created_at >= now() - interval '90 days'
GROUP BY usuario_id, date(created_at AT TIME ZONE 'UTC');

CREATE UNIQUE INDEX IF NOT EXISTS kpis_usuario_diario_pk
  ON public.kpis_usuario_diario (usuario_id, dia);

-- Função para refresh manual (SECURITY DEFINER para chamada via RPC anon)
CREATE OR REPLACE FUNCTION public.refresh_kpis_usuario_diario() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.kpis_usuario_diario;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
