import { destinoInternoSeguro } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const destino = destinoInternoSeguro(url.searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destino, url.origin));
  }

  const login = new URL('/login', url.origin);
  login.searchParams.set('erro', 'link-invalido');
  login.searchParams.set('next', destino);
  return NextResponse.redirect(login);
}
