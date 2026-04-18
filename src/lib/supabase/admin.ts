/**
 * Cliente Supabase com SERVICE ROLE key — server-only.
 * NUNCA importar em código client. Só em:
 *   - API routes (app/api/**)
 *   - Server Components
 *   - Scripts em scripts/
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let cached: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function getAdminClient() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nas envs',
    );
  }
  cached = createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Single-user MVP: email canônico do dono da instância.
 * Todo operation server-side que precisa de usuario_id usa isto.
 */
export const EMAIL_USUARIO_MVP = 'falecomseucamarao@gmail.com';

export async function getUsuarioIdMVP(): Promise<string> {
  // 1) Env var explícito (preferido — sem round-trip)
  const fromEnv = process.env.TINDO_MVP_USER_ID;
  if (fromEnv) return fromEnv;

  // 2) Fallback: busca via Admin API.
  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email === EMAIL_USUARIO_MVP);
  if (!user) throw new Error(`Usuário ${EMAIL_USUARIO_MVP} não encontrado`);
  return user.id;
}
