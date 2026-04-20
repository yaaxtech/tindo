import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { sincronizarTodoist } from '@/lib/todoist/sync';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface SyncBody {
  projetoIds?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    // Lê body opcional — se vazio ou sem projetoIds, importa tudo
    let projetoIds: string[] | undefined;
    try {
      const text = await request.text();
      if (text) {
        const body = JSON.parse(text) as SyncBody;
        if (Array.isArray(body.projetoIds) && body.projetoIds.length > 0) {
          projetoIds = body.projetoIds;
        }
      }
    } catch {
      // body inválido — ignora e importa tudo
    }

    const inicio = Date.now();
    const resultado = await sincronizarTodoist(admin, usuarioId, undefined, projetoIds);
    const duracaoMs = Date.now() - inicio;

    return NextResponse.json({
      ok: true,
      resultado,
      importadas: resultado.tarefasImportadas,
      atualizadas: resultado.tarefasAtualizadas,
      erros: resultado.erros.length,
      duracaoMs,
    });
  } catch (err) {
    console.error('/api/todoist/sync error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
