// RoadMapMind — Fase 2 / Fatia 5: API PÚBLICA (sem login) de um documento por
// token. Liberada do gate de auth em `routes.ts`; a segurança fica no banco
// (RPCs anônimas só devolvem doc `publico_leitura`). 404 quando indisponível —
// nunca expõe o id interno do documento.

import { documentoPublicoPorToken } from '@/services/publico';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const documento = await documentoPublicoPorToken(token);
    if (!documento) {
      return NextResponse.json({ erro: 'Documento indisponível.' }, { status: 404 });
    }
    return NextResponse.json(documento);
  } catch {
    return NextResponse.json(
      { erro: 'Não foi possível abrir este documento agora.' },
      { status: 500 },
    );
  }
}
