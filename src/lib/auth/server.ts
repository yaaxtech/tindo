import { createClient } from '@/lib/supabase/server';

export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ContextoAuth {
  supabase: ServerSupabaseClient;
  usuarioId: string;
  email: string | null;
}

export class UsuarioNaoAutenticadoError extends Error {
  readonly code = 'NAO_AUTENTICADO';
  readonly status = 401;

  constructor() {
    super('Entre na sua conta para continuar.');
    this.name = 'UsuarioNaoAutenticadoError';
  }
}

/**
 * Resolve a identidade a partir de claims assinadas da sessão.
 * Retorna `null` em qualquer sessão ausente ou inválida (fail closed).
 */
export async function obterContextoAuth(
  client?: ServerSupabaseClient,
): Promise<ContextoAuth | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub || claims.role !== 'authenticated' || claims.is_anonymous === true) {
    return null;
  }

  return {
    supabase,
    usuarioId: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
  };
}

/** Exige uma sessão válida. Route Handlers convertem este erro em HTTP 401. */
export async function exigirContextoAuth(client?: ServerSupabaseClient): Promise<ContextoAuth> {
  const contexto = await obterContextoAuth(client);
  if (!contexto) throw new UsuarioNaoAutenticadoError();
  return contexto;
}
