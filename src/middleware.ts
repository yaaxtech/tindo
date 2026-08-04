import { urlNoEnderecoOficial } from '@/lib/app-url';
import { classificarAcessoRota, podeAcessarRotaAutenticada } from '@/lib/auth/routes';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const enderecoOficial = urlNoEnderecoOficial(request.nextUrl);

  if (enderecoOficial) return NextResponse.redirect(enderecoOficial, 308);

  const acesso = classificarAcessoRota(pathname);

  if (acesso === 'publica' || acesso === 'tecnica') return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ erro: 'Autenticação indisponível.' }, { status: 503 });
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const autenticado =
    !error &&
    Boolean(claims?.sub) &&
    claims?.role === 'authenticated' &&
    claims?.is_anonymous !== true;

  if (!autenticado) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ erro: 'Entre na sua conta para continuar.' }, { status: 401 });
    }

    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  // Os módulos antigos ainda usam service_role + usuário fixo. Até a migração
  // deles, só a conta original pode acessá-los; contas novas ficam em áreas RLS.
  const autorizado = podeAcessarRotaAutenticada(
    pathname,
    {
      usuarioId: claims.sub as string,
      email: typeof claims.email === 'string' ? claims.email : null,
    },
    process.env.TINDO_MVP_USER_ID,
  );

  if (!autorizado) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { erro: 'Este módulo ainda não está disponível para sua conta.' },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL('/docs', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-|sounds).*)',
  ],
};
