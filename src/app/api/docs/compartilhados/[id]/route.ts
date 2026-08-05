import { UsuarioNaoAutenticadoError, exigirContextoAuth } from '@/lib/auth/server';
import {
  carregarDocumentoCompartilhado,
  listarCompartilhadosComigo,
  salvarDocumentoCompartilhado,
} from '@/services/compartilhar';
// RoadMapMind — API de um documento compartilhado. GET abre (leitura guarded; o
// papel vem da lista "compartilhados comigo", evitando probing); PUT salva como
// convidado EDITOR (Fatia 4) pela RPC guarded, que confina a escrita à subárvore.
// 403 se o doc não está compartilhado comigo / sem permissão de edição.
import type { DocLinha } from '@/types/doc';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function respostaErro(e: unknown) {
  const erro = e instanceof Error ? e.message : 'Erro inesperado ao abrir o documento.';
  const status =
    e instanceof UsuarioNaoAutenticadoError ? 401 : erro.includes('permissão') ? 403 : 500;
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

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = await exigirContextoAuth();
    const { id } = await params;
    const body = (await req.json()) as { linhas?: DocLinha[] };
    // A RPC guarded valida papel de editor e confina a escrita à subárvore.
    await salvarDocumentoCompartilhado(contexto, id, body.linhas ?? []);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e);
  }
}
