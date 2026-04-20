-- Migration: adiciona flag de write-back opcional para o Todoist
-- Por padrão desligado (false) — usuário precisa habilitar explicitamente em /configuracoes

ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS todoist_writeback_habilitado boolean NOT NULL DEFAULT false;
