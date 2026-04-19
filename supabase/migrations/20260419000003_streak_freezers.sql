-- Migration: streak freezers
-- Protege streak quando usuário passa 1 dia sem concluir nada

ALTER TABLE public.gamificacao
  ADD COLUMN IF NOT EXISTS freezers_disponiveis int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freezer_usado_em date,
  ADD COLUMN IF NOT EXISTS total_freezers_ganhos int NOT NULL DEFAULT 0;
