-- Extensões e helpers reutilizáveis
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
