import type { Database } from '@/types/database';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Mesmo descompasso de genéricos de `src/lib/supabase/client.ts`:
 * `@supabase/ssr` 0.5.2 declara 3 genéricos, `@supabase/supabase-js` 2.111 usa 4.
 * O cast é só de tipo — o cliente criado em runtime é idêntico.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from Server Component — can ignore if middleware refreshes session.
          }
        },
      },
    },
  ) as unknown as SupabaseClient<Database>;
}
