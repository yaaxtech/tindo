-- Catálogo de conquistas
INSERT INTO public.conquistas (codigo, nome, descricao, icone, meta) VALUES
  ('primeira_tarefa', 'Primeira gota', 'Concluir sua primeira tarefa', '💧', '{"tipo":"tarefas_concluidas","valor":1}'),
  ('primeiro_lembrete', 'Eu lembro', 'Concluir seu primeiro lembrete', '📝', '{"tipo":"lembretes_concluidos","valor":1}'),
  ('streak_3', 'Trilogia', 'Streak de 3 dias', '🔥', '{"tipo":"streak","valor":3}'),
  ('streak_7', 'Uma semana firme', 'Streak de 7 dias', '🔥', '{"tipo":"streak","valor":7}'),
  ('streak_30', 'Mês consistente', 'Streak de 30 dias', '🔥', '{"tipo":"streak","valor":30}'),
  ('streak_100', 'Centurião', 'Streak de 100 dias', '💎', '{"tipo":"streak","valor":100}'),
  ('concluir_10', 'Uma mão', '10 tarefas concluídas', '✋', '{"tipo":"tarefas_concluidas","valor":10}'),
  ('concluir_50', 'Metade do caminho', '50 tarefas concluídas', '🎯', '{"tipo":"tarefas_concluidas","valor":50}'),
  ('concluir_100', 'Triplo dígito', '100 tarefas concluídas', '💯', '{"tipo":"tarefas_concluidas","valor":100}'),
  ('concluir_500', 'Meio milhar', '500 tarefas concluídas', '🏆', '{"tipo":"tarefas_concluidas","valor":500}'),
  ('concluir_1000', 'Quatro dígitos', '1000 tarefas concluídas', '👑', '{"tipo":"tarefas_concluidas","valor":1000}'),
  ('manha_cedo', 'Madrugador', 'Concluir antes das 8h (3 vezes)', '🌅', '{"tipo":"manha","valor":3}'),
  ('noite_cerrada', 'Coruja', 'Concluir após 22h (3 vezes)', '🦉', '{"tipo":"noite","valor":3}'),
  ('nota_alta', 'Focado no que importa', '10 tarefas concluídas com nota ≥80', '🎯', '{"tipo":"nota_alta","valor":10}'),
  ('sem_adiar', 'Direto ao ponto', '20 conclusões sem adiamento', '⚡', '{"tipo":"sem_adiar","valor":20}'),
  ('calibracao', 'Autoconhecimento', 'Completar primeira recalibração', '🧭', '{"tipo":"calibracao","valor":1}'),
  ('primeiro_sync', 'Conectado', 'Sincronizar com Todoist', '🔗', '{"tipo":"sync","valor":1}'),
  ('comeback', 'De volta', 'Voltar após 7+ dias inativo', '🔄', '{"tipo":"comeback","valor":1}'),
  ('juizo', 'Juiz', 'Completar 5 recalibrações', '⚖️', '{"tipo":"calibracao","valor":5}')
ON CONFLICT (codigo) DO NOTHING;
