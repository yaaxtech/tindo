import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Histórico diário de ações dos últimos 90 dias.
 */
export async function GET() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    const ha90 = new Date();
    ha90.setDate(ha90.getDate() - 90);

    const { data, error } = await admin
      .from('historico_acoes')
      .select('acao, created_at')
      .eq('usuario_id', usuarioId)
      .gte('created_at', ha90.toISOString())
      .order('created_at', { ascending: true });
    if (error) throw error;

    // Agrupa por dia
    const porDia = new Map<string, { concluidas: number; adiadas: number; total: number }>();
    for (const row of data ?? []) {
      const dia = (row.created_at as string).slice(0, 10);
      const atual = porDia.get(dia) ?? { concluidas: 0, adiadas: 0, total: 0 };
      atual.total++;
      if (row.acao === 'concluida') atual.concluidas++;
      if (row.acao === 'adiada_auto' || row.acao === 'adiada_manual') atual.adiadas++;
      porDia.set(dia, atual);
    }

    const serie = Array.from(porDia.entries()).map(([dia, v]) => ({ dia, ...v }));
    return NextResponse.json({ serie });
  } catch (err) {
    console.error('/api/gamificacao/historico error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
