-- Migration: colunas de calibração IA em configuracoes
-- Adiciona campos para wizard /calibracao e configurações de modelo IA

ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS criterios_sucesso jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_api_key_criptografada text,
  ADD COLUMN IF NOT EXISTS ai_modelo varchar(40) NOT NULL DEFAULT 'claude-sonnet-4-6',
  ADD COLUMN IF NOT EXISTS ai_auto_aceita_classificacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calibracao_inicial_concluida_em timestamptz;
