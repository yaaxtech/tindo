import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface TarefaRow {
  id: string;
  titulo: string;
  tipo: string;
  projeto_id: string | null;
  data_vencimento: string | null;
  prioridade: number;
  todoist_id: string | null;
  projetos: {
    id: string;
    nome: string;
    todoist_id: string | null;
  } | null;
}

export async function GET() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    const { data, error } = await admin
      .from('tarefas')
      .select(
        'id, titulo, tipo, projeto_id, data_vencimento, prioridade, todoist_id, projetos(id, nome, todoist_id)',
      )
      .eq('usuario_id', usuarioId)
      .eq('status', 'pendente')
      .is('deleted_at', null)
      .is('todoist_id', null)
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tarefas = (data as unknown as TarefaRow[]).map((t) => ({
      id: t.id,
      titulo: t.titulo,
      tipo: (t.tipo ?? 'tarefa') as 'tarefa' | 'lembrete',
      projetoId: t.projeto_id,
      projetoNome: t.projetos?.nome ?? null,
      projetoTemTodoistId: Boolean(t.projetos?.todoist_id),
      dataVencimento: t.data_vencimento,
      prioridade: t.prioridade ?? 2,
    }));

    return NextResponse.json({ tarefas, total: tarefas.length });
  } catch (err) {
    console.error('/api/todoist/exportar/previa error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
