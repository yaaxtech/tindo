import { type AcaoAdiamentoPassada, sugerirAdiamento } from '@/lib/adiamento/heuristica';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const tarefaId = request.nextUrl.searchParams.get('tarefaId');
    if (!tarefaId) {
      return NextResponse.json({ error: 'tarefaId é obrigatório' }, { status: 400 });
    }

    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    const { data: tarefa, error: errTarefa } = await admin
      .from('tarefas')
      .select('id, projeto_id')
      .eq('id', tarefaId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    if (errTarefa) throw errTarefa;
    if (!tarefa) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });

    const { data: tagsLink, error: errTags } = await admin
      .from('tarefa_tags')
      .select('tag_id')
      .eq('tarefa_id', tarefaId);
    if (errTags) throw errTags;
    const tagIds = (tagsLink ?? []).map((r: { tag_id: string }) => r.tag_id);

    const { data: acoes, error: errHist } = await admin
      .from('historico_acoes')
      .select('tarefa_id, created_at, dados')
      .eq('usuario_id', usuarioId)
      .in('acao', ['adiada_auto', 'adiada_manual'])
      .order('created_at', { ascending: false })
      .limit(200);
    if (errHist) throw errHist;

    const idsAlvo = (acoes ?? []).map((a: { tarefa_id: string }) => a.tarefa_id);
    const { data: tarefasHist } = idsAlvo.length
      ? await admin.from('tarefas').select('id, projeto_id').in('id', idsAlvo)
      : { data: [] as { id: string; projeto_id: string | null }[] };
    const { data: tagsHist } = idsAlvo.length
      ? await admin.from('tarefa_tags').select('tarefa_id, tag_id').in('tarefa_id', idsAlvo)
      : { data: [] as { tarefa_id: string; tag_id: string }[] };

    const projetoPorTarefa = new Map<string, string | null>(
      (tarefasHist ?? []).map((t) => [t.id, t.projeto_id]),
    );
    const tagsPorTarefa = new Map<string, string[]>();
    for (const link of tagsHist ?? []) {
      const arr = tagsPorTarefa.get(link.tarefa_id) ?? [];
      arr.push(link.tag_id);
      tagsPorTarefa.set(link.tarefa_id, arr);
    }

    const historico: AcaoAdiamentoPassada[] = (acoes ?? [])
      .map((a: { tarefa_id: string; created_at: string; dados: { ateISO?: string } | null }) => {
        const ateISO = a.dados?.ateISO;
        if (!ateISO) return null;
        const criadaEm = a.created_at;
        const d = new Date(criadaEm);
        return {
          criadaEm,
          ateISO,
          tags: tagsPorTarefa.get(a.tarefa_id) ?? [],
          projetoId: projetoPorTarefa.get(a.tarefa_id) ?? null,
          diaSemana: d.getDay(),
          horaDia: d.getHours(),
        } satisfies AcaoAdiamentoPassada;
      })
      .filter((x): x is AcaoAdiamentoPassada => x !== null);

    const sugestao = sugerirAdiamento(historico, {
      tags: tagIds,
      projetoId: tarefa.projeto_id ?? null,
    });

    return NextResponse.json({ sugestao });
  } catch (e) {
    console.error('sugerir adiamento falhou:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'erro' }, { status: 500 });
  }
}
