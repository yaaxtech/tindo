import { type NextRequest, NextResponse } from 'next/server';
import { type CookieOptions, createServerClient } from '@supabase/ssr';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
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
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const rotasProtegidas = ['/cards', '/tarefas', '/projetos', '/tags', '/gamificacao', '/conquistas', '/calibracao', '/configuracoes'];
  const rotaAtual = request.nextUrl.pathname;
  const precisaAuth = rotasProtegidas.some((r) => rotaAtual.startsWith(r));

  if (precisaAuth && !user) {
    // MVP: deixa passar sem auth (mock); trocar pra redirect quando auth real estiver pronto.
    // const loginUrl = new URL('/login', request.url);
    // return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-|sounds).*)',
  ],
};
