import { ehRotaRoadMapMind } from '@/lib/auth/routes';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem credenciais: modo mock, pula o middleware.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();

  if (ehRotaRoadMapMind(request.nextUrl.pathname)) {
    const claims = data?.claims;
    const autenticado =
      !error &&
      Boolean(claims?.sub) &&
      claims?.role === 'authenticated' &&
      claims?.is_anonymous !== true;

    if (!autenticado) {
      if (request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ erro: 'Entre na sua conta para continuar.' }, { status: 401 });
      }

      const login = new URL('/login', request.url);
      login.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-|sounds).*)',
  ],
};
