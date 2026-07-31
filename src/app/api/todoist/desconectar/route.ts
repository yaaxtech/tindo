import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    // Limpa token e desativa toggles
    const { error } = await admin
      .from('configuracoes')
      .update({
        todoist_token: null,
        todoist_sync_habilitado: false,
        todoist_writeback_habilitado: false,
      })
      .eq('usuario_id', usuarioId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Registra em historico_acoes
    try {
      await admin.from('historico_acoes').insert({
        usuario_id: usuarioId,
        tarefa_id: null,
        acao: 'editada',
        dados: { origem: 'desconectar_todoist' },
      });
    } catch {
      // Não falha o endpoint se o log falhar
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('/api/todoist/desconectar error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
