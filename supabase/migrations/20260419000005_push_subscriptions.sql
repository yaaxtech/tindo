-- Push Subscriptions: armazena endpoints VAPID por dispositivo
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ultima_usada_em timestamptz
);

CREATE INDEX IF NOT EXISTS push_subs_usuario_idx ON public.push_subscriptions(usuario_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve proprias subs" ON public.push_subscriptions
  FOR ALL USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- Colunas push em configuracoes
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS push_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_gatilho_prazo_hoje boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_gatilho_streak_risco boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_gatilho_sugestoes_ia boolean NOT NULL DEFAULT true;

-- Histórico de envios push (para auditoria e debug)
CREATE TABLE IF NOT EXISTS public.push_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gatilho varchar(40) NOT NULL,
  titulo text NOT NULL,
  corpo text,
  sucesso boolean NOT NULL,
  erro text,
  enviado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_envios_usuario_idx ON public.push_envios(usuario_id);
CREATE INDEX IF NOT EXISTS push_envios_enviado_em_idx ON public.push_envios(enviado_em DESC);

ALTER TABLE public.push_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve proprios envios" ON public.push_envios
  FOR SELECT USING (usuario_id = auth.uid());
