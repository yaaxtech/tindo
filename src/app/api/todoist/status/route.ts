import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    // Configurações do usuário
    const { data: cfg } = await admin
      .from('configuracoes')
      .select(
        'todoist_token, todoist_ultimo_sync, todoist_sync_habilitado, todoist_writeback_habilitado',
      )
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    const token = (cfg?.todoist_token as string | null) ?? process.env.TODOIST_API_TOKEN ?? null;
    const conectado = Boolean(token);

    // Contadores de itens sincronizados
    const [tarefasRes, projetosRes, tagsRes] = await Promise.all([
      admin
        .from('tarefas')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', usuarioId)
        .not('todoist_id', 'is', null)
        .is('deleted_at', null),
      admin
        .from('projetos')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', usuarioId)
        .not('todoist_id', 'is', null),
      admin
        .from('tags')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', usuarioId)
        .not('todoist_id', 'is', null),
    ]);

    // Últimas 20 ações de sync Todoist
    const { data: acoes } = await admin
      .from('historico_acoes')
      .select('id, acao, dados, created_at, tarefa_id')
      .eq('usuario_id', usuarioId)
      .in('acao', ['sincronizado', 'todoist_sync', 'todoist_writeback'])
      .order('created_at', { ascending: false })
      .limit(20);

    // Tenta buscar títulos das tarefas para exibir nas ações
    const tarefaIds = [...new Set((acoes ?? []).map((a) => a.tarefa_id).filter(Boolean))];
    const titulosPorId: Record<string, string> = {};
    if (tarefaIds.length > 0) {
      const { data: tarefas } = await admin
        .from('tarefas')
        .select('id, titulo')
        .in('id', tarefaIds);
      for (const t of tarefas ?? []) {
        titulosPorId[t.id as string] = t.titulo as string;
      }
    }

    const ultimasAcoes = (acoes ?? []).map((a) => ({
      id: a.id as string,
      acao: a.acao as string,
      dados: a.dados as Record<string, unknown> | null,
      criadoEm: a.created_at as string,
      tarefaId: a.tarefa_id as string | null,
      tarefaTitulo: a.tarefa_id ? (titulosPorId[a.tarefa_id as string] ?? null) : null,
    }));

    return NextResponse.json({
      conectado,
      ultimoSync: cfg?.todoist_ultimo_sync ?? null,
      syncHabilitado: Boolean(cfg?.todoist_sync_habilitado),
      writebackHabilitado: Boolean(cfg?.todoist_writeback_habilitado),
      contadores: {
        tarefas: tarefasRes.count ?? 0,
        projetos: projetosRes.count ?? 0,
        tags: tagsRes.count ?? 0,
      },
      ultimasAcoes,
    });
  } catch (err) {
    console.error('/api/todoist/status error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
