import type { Database } from '@/types/database';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * `@supabase/ssr` 0.5.2 ainda declara o retorno como
 * `SupabaseClient<Database, SchemaName, Schema>` (3 genéricos), enquanto o
 * `@supabase/supabase-js` 2.111 instalado já usa 4 (`Database`, `SchemaName`,
 * `Schema`, `ClientOptions`). É descompasso só de DECLARAÇÃO: o objeto criado
 * em runtime é exatamente o mesmo. Sem o cast abaixo, o schema resolve para
 * `never` e todo `.insert()/.update()` do lado client perde a checagem de tipo.
 */
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  ) as unknown as SupabaseClient<Database>;
}
