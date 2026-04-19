export const runtime = 'edge';

import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import type { Tarefa } from '@/types/domain';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    // Tarefas pendentes, não adiadas, sem dependências abertas, ordenadas pela nota.
    const { data: tarefasRows, error: errTarefas } = await admin
      .from('tarefas')
      .select(
        `
        id, todoist_id, tipo, titulo, descricao, projeto_id, prioridade,
        data_vencimento, prazo_conclusao, importancia, urgencia, facilidade,
        nota, status, dependencia_tarefa_id, adiada_ate, adiamento_count,
        adiamento_motivo_auto, concluida_em, created_at, updated_at
      `,
      )
      .eq('usuario_id', usuarioId)
      .eq('status', 'pendente')
      .is('deleted_at', null)
      .or(`adiada_ate.is.null,adiada_ate.lte.${new Date().toISOString()}`)
      .order('nota', { ascending: false });
    if (errTarefas) throw errTarefas;

    // Projetos do usuário
    const { data: projetosRows, error: errProj } = await admin
      .from('projetos')
      .select('id, todoist_id, nome, cor, ordem_prioridade, multiplicador, ativo')
      .eq('usuario_id', usuarioId);
    if (errProj) throw errProj;

    const projetosMap = new Map<string, (typeof projetosRows)[number]>();
    for (const p of projetosRows ?? []) projetosMap.set(p.id, p);

    // Tags do usuário
    const { data: tagsRows, error: errTags } = await admin
      .from('tags')
      .select('id, todoist_id, nome, cor, tipo_peso, valor_peso, ativo')
      .eq('usuario_id', usuarioId);
    if (errTags) throw errTags;
    const tagsMap = new Map<string, (typeof tagsRows)[number]>();
    for (const t of tagsRows ?? []) tagsMap.set(t.id, t);

    // tarefa_tags
    const tarefaIds = (tarefasRows ?? []).map((t: { id: string }) => t.id);
    let tarefaTags: Array<{ tarefa_id: string; tag_id: string }> = [];
    if (tarefaIds.length > 0) {
      const { data: ttRows, error: errTt } = await admin
        .from('tarefa_tags')
        .select('tarefa_id, tag_id')
        .in('tarefa_id', tarefaIds);
      if (errTt) throw errTt;
      tarefaTags = ttRows ?? [];
    }

    const tags: Record<string, string[]> = {};
    for (const tt of tarefaTags) {
      (tags[tt.tarefa_id] ??= []).push(tt.tag_id);
    }

    const fila: Tarefa[] = (tarefasRows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      todoistId: (r.todoist_id as string | null) ?? null,
      tipo: r.tipo as Tarefa['tipo'],
      titulo: r.titulo as string,
      descricao: (r.descricao as string | null) ?? null,
      projetoId: (r.projeto_id as string | null) ?? null,
      projeto:
        r.projeto_id && projetosMap.has(r.projeto_id as string)
          ? (() => {
              const p = projetosMap.get(r.projeto_id as string);
              if (!p) return null;
              return {
                id: p.id,
                todoistId: p.todoist_id,
                nome: p.nome,
                cor: p.cor,
                ordemPrioridade: p.ordem_prioridade,
                multiplicador: Number(p.multiplicador),
                ativo: p.ativo,
              };
            })()
          : null,
      prioridade: r.prioridade as Tarefa['prioridade'],
      dataVencimento: (r.data_vencimento as string | null) ?? null,
      prazoConclusao: (r.prazo_conclusao as string | null) ?? null,
      importancia: (r.importancia as number | null) ?? null,
      urgencia: (r.urgencia as number | null) ?? null,
      facilidade: (r.facilidade as number | null) ?? null,
      nota: r.nota as number,
      status: r.status as Tarefa['status'],
      dependenciaTarefaId: (r.dependencia_tarefa_id as string | null) ?? null,
      adiadaAte: (r.adiada_ate as string | null) ?? null,
      adiamentoCount: r.adiamento_count as number,
      adiamentoMotivoAuto: (r.adiamento_motivo_auto as string | null) ?? null,
      concluidaEm: (r.concluida_em as string | null) ?? null,
      tags: (tags[r.id as string] ?? [])
        .map((tid) => {
          const tg = tagsMap.get(tid);
          if (!tg) return null;
          return {
            id: tg.id,
            todoistId: tg.todoist_id,
            nome: tg.nome,
            cor: tg.cor,
            tipoPeso: tg.tipo_peso as Tarefa['tags'][number]['tipoPeso'],
            valorPeso: Number(tg.valor_peso),
            ativo: tg.ativo,
          };
        })
        .filter((t): t is NonNullable<typeof t> => Boolean(t)),
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));

    return NextResponse.json({ fila, usuarioId, total: fila.length });
  } catch (err) {
    console.error('/api/fila error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
