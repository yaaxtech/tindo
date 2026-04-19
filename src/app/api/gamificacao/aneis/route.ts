import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { calcularAneis, type DiaAtividade } from '@/lib/gamificacao/aneis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    // Janela dos últimos 7 dias
    const agora = new Date();
    const seteDiasAtras = new Date(agora);
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
    const inicioStr = seteDiasAtras.toISOString().slice(0, 10) + 'T00:00:00.000Z';

    // Busca conclusões dos últimos 7 dias
    const { data: historico, error: errHist } = await admin
      .from('historico_acoes')
      .select('created_at')
      .eq('usuario_id', usuarioId)
      .eq('acao', 'concluida')
      .gte('created_at', inicioStr)
      .order('created_at', { ascending: true });

    if (errHist) throw errHist;

    // Agrupa por dia
    const porDia = new Map<string, number[]>();
    for (const row of historico ?? []) {
      const dt = new Date(row.created_at as string);
      const dia = dt.toISOString().slice(0, 10);
      const hora = dt.getUTCHours();
      if (!porDia.has(dia)) porDia.set(dia, []);
      porDia.get(dia)!.push(hora);
    }

    const dias: DiaAtividade[] = [];
    for (const [dia, horas] of porDia) {
      dias.push({ dia, conclusoes: horas.length, horasConclusao: horas });
    }

    // Busca configurações do usuário
    const { data: config } = await admin
      .from('configuracoes')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    // meta_semanal_conclusoes pode não existir ainda — fallback 35
    const metaSemanal: number =
      config && typeof (config as Record<string, unknown>).meta_semanal_conclusoes === 'number'
        ? Number((config as Record<string, unknown>).meta_semanal_conclusoes)
        : 35;

    // horario_produtivo_preferido pode não existir — deixa undefined para calcular moda
    const horarioPreferido: number | undefined =
      config && typeof (config as Record<string, unknown>).horario_produtivo_preferido === 'number'
        ? Number((config as Record<string, unknown>).horario_produtivo_preferido)
        : undefined;

    const aneis = calcularAneis(dias, metaSemanal, horarioPreferido);

    return NextResponse.json({ aneis, diasProcessados: dias.length });
  } catch (err) {
    console.error('/api/gamificacao/aneis GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao calcular anéis.' },
      { status: 500 },
    );
  }
}
