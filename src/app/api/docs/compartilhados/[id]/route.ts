import { UsuarioNaoAutenticadoError, exigirContextoAuth } from '@/lib/auth/server';
import {
  carregarDocumentoCompartilhado,
  listarCompartilhadosComigo,
} from '@/services/compartilhar';
// RoadMapMind — API para abrir um documento compartilhado (só-leitura na Fatia 1).
// O papel vem da lista de "compartilhados comigo" (evita expor o guard a probing);
// 403 se o doc não está compartilhado comigo. A subárvore vem da RPC guarded.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function respostaErro(e: unknown) {
  const status = e instanceof UsuarioNaoAutenticadoError ? 401 : 500;
  const erro = e instanceof Error ? e.message : 'Erro inesperado ao abrir o documento.';
  return NextResponse.json({ erro }, { status });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = await exigirContextoAuth();
    const { id } = await params;

    const itens = await listarCompartilhadosComigo(contexto);
    const item = itens.find((i) => i.documentoId === id);
    if (!item) {
      return NextResponse.json(
        { erro: 'Este documento não está compartilhado com você.' },
        { status: 403 },
      );
    }

    const { linhas, espelhos } = await carregarDocumentoCompartilhado(contexto, id);
    return NextResponse.json({
      papel: item.papel,
      dono: item.dono,
      tituloMd: item.tituloMd,
      linhas,
      espelhos,
    });
  } catch (e) {
    return respostaErro(e);
  }
}
