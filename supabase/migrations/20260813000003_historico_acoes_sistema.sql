-- Migration: historico_acoes aceita ação de sistema (sem tarefa) e classificação automática da IA
--
-- Contexto: o PR #54 (Database real no lugar do `any`) revelou dois logs que eram código MORTO —
-- o insert da auto-classificação mandava a coluna `tipo` (inexistente) e o da desconexão do
-- Todoist mandava `tarefa_id: null` numa coluna NOT NULL com FK. Nenhum dos dois nunca gravou.
-- Esta migration é aditiva: nenhum dado existente muda, nenhuma leitura atual quebra.

-- 1. `tarefa_id` passa a aceitar NULL — evento de sistema não tem tarefa associada.
--    A FK para public.tarefas continua íntegra: NULL não é verificado contra a tabela.
ALTER TABLE public.historico_acoes
  ALTER COLUMN tarefa_id DROP NOT NULL;

-- 2. O CHECK de `acao` ganha dois valores novos:
--
--    'ai_auto_classificada' — a IA classificou a tarefa sozinha. NÃO pode entrar como 'editada':
--                             'editada' alimenta n_editadas na materialized view
--                             kpis_usuario_diario, que é a base da taxaReavaliacao
--                             (src/lib/recalibracao/kpis.ts) — uma classificação da máquina
--                             contaria como reavaliação HUMANA e dispararia recalibração à toa
--                             (RN-07, limiar 30%).
--
--    'sistema'              — evento de sistema sem tarefa (desconectar Todoist, ganhar freezer).
--                             `dados.origem` diz qual. Também não pode reusar valor existente:
--                             'editada' polui a taxaReavaliacao e 'concluida' (usado hoje pelo
--                             freezer com uuid sentinela, insert que sempre falhou na FK) poluiria
--                             n_concluidas, streak, anéis e o push de streak em risco.
--
-- Os contadores da kpis_usuario_diario filtram por valor exato ('mostrada', 'concluida',
-- 'pulada', 'excluida', 'adiada_auto'/'adiada_manual', 'editada'), então os dois valores novos
-- ficam fora de TODOS eles — inclusive do denominador n_mostradas. A view não precisa mudar.
ALTER TABLE public.historico_acoes
  DROP CONSTRAINT IF EXISTS historico_acoes_acao_check;

ALTER TABLE public.historico_acoes
  ADD CONSTRAINT historico_acoes_acao_check
  CHECK (acao IN (
    'mostrada','concluida','pulada','voltada','adiada_auto','adiada_manual',
    'excluida','editada','criada','recalibrada',
    'ai_auto_classificada','sistema'
  ));
