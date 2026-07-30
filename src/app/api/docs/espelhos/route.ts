export const runtime = 'edge';

import { criarEspelho, removerEspelho } from '@/services/doc';
// RoadMapMind — espelhos (Fatia 7). POST cria; DELETE remove (soft).
// Toda lógica de dados vive em src/services/doc.ts.
import { NextResponse } from 'next/server';

function mensagemErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Erro inesperado ao acessar os espelhos.';
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { linhaId?: string; maeId?: string; ordem?: string };
    if (!body.linhaId || !body.maeId || !body.ordem) {
      return NextResponse.json(
        { erro: 'linhaId, maeId e ordem são obrigatórios.' },
        { status: 400 },
      );
    }
    const espelho = await criarEspelho(body.linhaId, body.maeId, body.ordem);
    return NextResponse.json({ espelho });
  } catch (e) {
    return NextResponse.json({ erro: mensagemErro(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ erro: 'id é obrigatório.' }, { status: 400 });
    }
    await removerEspelho(body.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erro: mensagemErro(e) }, { status: 500 });
  }
}
