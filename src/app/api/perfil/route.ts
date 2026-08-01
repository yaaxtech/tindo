import { UsuarioNaoAutenticadoError, exigirContextoAuth } from '@/lib/auth/server';
import { atualizarPerfil, obterPerfil } from '@/services/perfil';
import { NextResponse } from 'next/server';

function erro(e: unknown) {
  const status = e instanceof UsuarioNaoAutenticadoError ? 401 : 400;
  return NextResponse.json(
    { erro: e instanceof Error ? e.message : 'Não foi possível acessar o perfil.' },
    { status },
  );
}

export async function GET() {
  try {
    return NextResponse.json({ perfil: await obterPerfil(await exigirContextoAuth()) });
  } catch (e) {
    return erro(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const contexto = await exigirContextoAuth();
    const body = (await request.json()) as {
      nome?: string;
      whatsapp?: string | null;
      cor?: string;
    };
    if (typeof body.nome !== 'string' || typeof body.cor !== 'string') {
      return NextResponse.json({ erro: 'Nome e cor são obrigatórios.' }, { status: 400 });
    }
    return NextResponse.json({
      perfil: await atualizarPerfil(contexto, {
        nome: body.nome,
        whatsapp: body.whatsapp,
        cor: body.cor,
      }),
    });
  } catch (e) {
    return erro(e);
  }
}
