import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { TodoistClient, todoistColorHex } from '@/lib/todoist/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    const { data: cfg } = await admin
      .from('configuracoes')
      .select('todoist_token')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    const token = (cfg?.todoist_token as string | null) ?? process.env.TODOIST_API_TOKEN;
    const td = new TodoistClient(token ?? undefined);

    const [projetos, labels, tasks] = await Promise.all([
      td.listProjects(),
      td.listLabels(),
      td.listTasks(),
    ]);

    // Conta tasks pendentes por projeto
    const tasksPorProjeto = new Map<string, number>();
    for (const t of tasks) {
      if (t.checked || t.is_deleted) continue;
      const count = tasksPorProjeto.get(t.project_id) ?? 0;
      tasksPorProjeto.set(t.project_id, count + 1);
    }

    const projetosDetalhes = projetos
      .filter((p) => !p.is_archived && !p.is_deleted)
      .map((p) => ({
        id: p.id,
        nome: p.name,
        count: tasksPorProjeto.get(p.id) ?? 0,
        cor: todoistColorHex(p.color),
      }));

    const pendentes = tasks.filter((t) => !t.checked && !t.is_deleted);

    return NextResponse.json(
      {
        projetosCount: projetosDetalhes.length,
        tasksCount: pendentes.length,
        tagsCount: labels.length,
        projetos: projetosDetalhes,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60',
        },
      },
    );
  } catch (err) {
    console.error('/api/todoist/previa error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
