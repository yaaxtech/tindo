-- Migration: historico_acoes ganha o valor 'todoist_sync' — sincronização com o Todoist
--
-- Contexto: a rota /api/todoist/status filtrava por
-- `acao IN ('sincronizado','todoist_sync','todoist_writeback')` — TRÊS valores que nunca
-- existiram no CHECK. A query era válida, não dava erro, e voltava sempre vazia: o bloco de
-- últimas ações em /configuracoes/todoist/status nunca mostrou nada.
--
-- Quem grava histórico de Todoist hoje (src/services/todoistWriteback.ts e
-- src/app/api/todoist/exportar/route.ts) usava `acao = 'editada'`, que é pior do que só não
-- aparecer na tela: 'editada' alimenta n_editadas na materialized view kpis_usuario_diario,
-- base da taxaReavaliacao (src/lib/recalibracao/kpis.ts) — sync automático da máquina contava
-- como reavaliação HUMANA e podia disparar recalibração à toa (RN-07, limiar 30%).
--
-- Mesmo raciocínio da migration 20260813000003 ('ai_auto_classificada' e 'sistema'): ação de
-- máquina ganha valor próprio em vez de reusar um valor que já tem significado em KPI.
-- `dados.origem` continua distinguindo a subespécie ('todoist_writeback' vs 'exportacao_manual').
--
-- Os contadores da kpis_usuario_diario filtram por valor EXATO ('mostrada', 'concluida',
-- 'pulada', 'excluida', 'adiada_auto'/'adiada_manual', 'editada'), então 'todoist_sync' fica
-- fora de TODOS eles — inclusive do denominador n_mostradas. A view não precisa mudar.
--
-- Aditiva: nenhum dado existente muda, nenhuma leitura atual quebra. Verificado contra a
-- produção em 2026-08-13 — ZERO linhas com acao='editada' e dados->>'origem' em
-- ('todoist_writeback','exportacao_manual'), então não há backfill a fazer.

ALTER TABLE public.historico_acoes
  DROP CONSTRAINT IF EXISTS historico_acoes_acao_check;

ALTER TABLE public.historico_acoes
  ADD CONSTRAINT historico_acoes_acao_check
  CHECK (acao IN (
    'mostrada','concluida','pulada','voltada','adiada_auto','adiada_manual',
    'excluida','editada','criada','recalibrada',
    'ai_auto_classificada','sistema','todoist_sync'
  ));
