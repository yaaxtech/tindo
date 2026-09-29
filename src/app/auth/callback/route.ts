import { tratarRetornoDoEmail } from '@/lib/auth/retorno-email';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await createClient();
  const resultado = await tratarRetornoDoEmail(url.searchParams, supabase.auth);

  if (resultado.ok) return NextResponse.redirect(new URL(resultado.destino, url.origin));

  const login = new URL('/login', url.origin);
  login.searchParams.set('erro', resultado.erro);
  login.searchParams.set('next', resultado.destino);
  return NextResponse.redirect(login);
}
