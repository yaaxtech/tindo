import { UsuarioNaoAutenticadoError, exigirContextoAuth } from '@/lib/auth/server';
import { carregarDocumento, carregarEspelhos, garantirRaiz, salvarDocumento } from '@/services/doc';
import type { DocLinha } from '@/types/doc';
// RoadMapMind — API do documento. GET carrega (garante a raiz); PUT sincroniza.
// Toda lógica de dados vive em src/services/doc.ts.
import { NextResponse } from 'next/server';

function mensagemErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Erro inesperado ao acessar o documento.';
}

function respostaErro(e: unknown) {
  const status = e instanceof UsuarioNaoAutenticadoError ? 401 : 500;
  return NextResponse.json({ erro: mensagemErro(e) }, { status });
}

export async function GET() {
  try {
    const contexto = await exigirContextoAuth();
    const raiz = await garantirRaiz(contexto);
    const linhas = await carregarDocumento(contexto);
    const espelhos = await carregarEspelhos(contexto);
    return NextResponse.json({ raiz, linhas, espelhos });
  } catch (e) {
    return respostaErro(e);
  }
}

export async function PUT(req: Request) {
  try {
    const contexto = await exigirContextoAuth();
    const body = (await req.json()) as { raizId?: string; linhas?: DocLinha[] };
    if (!body.raizId) {
      return NextResponse.json({ erro: 'raizId é obrigatório.' }, { status: 400 });
    }
    await salvarDocumento(contexto, body.linhas ?? [], body.raizId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e);
  }
}
