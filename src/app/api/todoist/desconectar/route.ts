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

    // Log em historico_acoes (migration 20260813000003: `tarefa_id` aceita NULL e existe
    // o valor 'sistema'). Não usa 'editada' porque isso contaria como reavaliação humana
    // na taxaReavaliacao (RN-07) — desconectar o Todoist não é editar tarefa nenhuma.
    const { error: erroLog } = await admin.from('historico_acoes').insert({
      usuario_id: usuarioId,
      tarefa_id: null,
      acao: 'sistema',
      dados: { origem: 'todoist_desconectado' },
    });
    // O supabase-js devolve `{ error }` em vez de lançar — o try/catch sozinho não via nada.
    if (erroLog) {
      console.error('/api/todoist/desconectar: falha ao registrar historico_acoes', erroLog);
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
