export const runtime = 'edge';

import { carregarDocumento, carregarEspelhos, garantirRaiz, salvarDocumento } from '@/services/doc';
import type { DocLinha } from '@/types/doc';
// RoadMapMind — API do documento. GET carrega (garante a raiz); PUT sincroniza.
// Toda lógica de dados vive em src/services/doc.ts.
import { NextResponse } from 'next/server';

function mensagemErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Erro inesperado ao acessar o documento.';
}

export async function GET() {
  try {
    const raiz = await garantirRaiz();
    const linhas = await carregarDocumento();
    const espelhos = await carregarEspelhos();
    return NextResponse.json({ raiz, linhas, espelhos });
  } catch (e) {
    return NextResponse.json({ erro: mensagemErro(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { raizId?: string; linhas?: DocLinha[] };
    if (!body.raizId) {
      return NextResponse.json({ erro: 'raizId é obrigatório.' }, { status: 400 });
    }
    await salvarDocumento(body.linhas ?? [], body.raizId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erro: mensagemErro(e) }, { status: 500 });
  }
}
