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

    // Log em historico_acoes: PENDENTE DE MIGRATION.
    // O insert que existia aqui mandava `tarefa_id: null`, mas a coluna é NOT NULL
    // com FK para tarefas — sempre violava a constraint. O `try/catch` não pegava
    // nada (o supabase-js devolve `{ error }`, não lança), então o log nunca foi
    // gravado. Registrar ação de sistema sem tarefa exige tornar `tarefa_id`
    // NULL-able, o que é migration — fora do escopo deste PR.

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('/api/todoist/desconectar error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
