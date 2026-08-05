import { UsuarioNaoAutenticadoError, exigirContextoAuth } from '@/lib/auth/server';
import { listarCompartilhadosComigo, reconciliarConvitesPendentes } from '@/services/compartilhar';
// RoadMapMind — API de "Compartilhados comigo": lista os docs de outras
// pessoas onde tenho acesso. Toda a lógica vive em src/services/compartilhar.ts.
// A cada carregamento roda a rede de segurança de reconciliação de convite
// pendente (Fatia 3) — best-effort, nunca lança, nunca bloqueia a listagem.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function respostaErro(e: unknown) {
  const status = e instanceof UsuarioNaoAutenticadoError ? 401 : 500;
  const erro = e instanceof Error ? e.message : 'Erro inesperado ao listar compartilhados.';
  return NextResponse.json({ erro }, { status });
}

export async function GET() {
  try {
    const contexto = await exigirContextoAuth();
    await reconciliarConvitesPendentes(contexto, contexto.usuarioId, contexto.email ?? '');
    const itens = await listarCompartilhadosComigo(contexto);
    return NextResponse.json({ itens });
  } catch (e) {
    return respostaErro(e);
  }
}
