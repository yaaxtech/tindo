import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { calcularKpisAdiamento } from '@/services/kpis-adiamento';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Retorna os 5 KPIs de adiamento espaçado (TRA/TCA/TEX/MAC/SAE).
 * Query param: ?janela=7|30|90 (default 30).
 */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const janelaParam = Number(url.searchParams.get('janela') ?? 30);
    const janelaDias = [7, 30, 90].includes(janelaParam) ? janelaParam : 30;

    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    const kpis = await calcularKpisAdiamento(admin, usuarioId, janelaDias);
    return NextResponse.json(kpis);
  } catch (err) {
    console.error('/api/gamificacao/kpis-adiamento error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
