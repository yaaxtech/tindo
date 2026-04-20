import { CONFIG_PADRAO_PESOS, calcularNota } from '@/lib/scoring/engine';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { propagarParaTodoist } from '@/services/todoistWriteback';
import type { Configuracoes, Projeto, Tag, Tarefa } from '@/types/domain';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface PatchPayload {
  titulo?: string;
  descricao?: string | null;
  tipo?: 'tarefa' | 'lembrete';
  projeto_id?: string | null;
  prioridade?: 1 | 2 | 3 | 4;
  data_vencimento?: string | null;
  prazo_conclusao?: string | null;
  importancia?: number | null;
  urgencia?: number | null;
  facilidade?: number | null;
  dependencia_tarefa_id?: string | null;
  tag_ids?: string[];
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const body = (await request.json()) as PatchPayload;

    // Monta patch sem tag_ids (tags são M:N separada)
    const { tag_ids, ...patch } = body;
    if (Object.keys(patch).length > 0) {
      const { error } = await admin
        .from('tarefas')
        .update(patch)
        .eq('id', id)
        .eq('usuario_id', usuarioId);
      if (error) throw error;
    }

    if (tag_ids) {
      await admin.from('tarefa_tags').delete().eq('tarefa_id', id);
      if (tag_ids.length > 0) {
        await admin
          .from('tarefa_tags')
          .insert(tag_ids.map((tid) => ({ tarefa_id: id, tag_id: tid })));
      }
    }

    // Recalcula a nota imediatamente
    await recalcularNotaUnica(admin, usuarioId, id);

    // Propaga alterações para o Todoist se write-back habilitado
    if (Object.keys(patch).length > 0) {
      void propagarParaTodoist({
        usuarioId,
        tarefaId: id,
        acao: 'atualizar',
        patch: {
          titulo: body.titulo,
          descricao: body.descricao ?? undefined,
          dataVencimento: body.data_vencimento,
          prioridade: body.prioridade,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('/api/tarefas/[id] PATCH error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}

async function recalcularNotaUnica(
  admin: ReturnType<typeof getAdminClient>,
  usuarioId: string,
  tarefaId: string,
) {
  const [{ data: configRow }, { data: tr }] = await Promise.all([
    admin
      .from('configuracoes')
      .select('peso_urgencia, peso_importancia, peso_facilidade')
      .eq('usuario_id', usuarioId)
      .maybeSingle(),
    admin
      .from('tarefas')
      .select(
        'id, tipo, prioridade, data_vencimento, prazo_conclusao, importancia, urgencia, facilidade, projeto_id',
      )
      .eq('id', tarefaId)
      .maybeSingle(),
  ]);
  if (!tr) return;

  const config: Configuracoes = {
    usuarioId,
    pesos: configRow
      ? {
          urgencia: Number(configRow.peso_urgencia),
          importancia: Number(configRow.peso_importancia),
          facilidade: Number(configRow.peso_facilidade),
        }
      : CONFIG_PADRAO_PESOS,
    limiares: { reavaliacao: 30, descarte: 50, adiamento: 40 },
    audioHabilitado: true,
    animacoesHabilitadas: true,
    aiHabilitado: false,
    todoistSyncHabilitado: true,
  };

  let projeto: Projeto | null = null;
  if (tr.projeto_id) {
    const { data: p } = await admin
      .from('projetos')
      .select('id, nome, cor, ordem_prioridade, multiplicador, ativo')
      .eq('id', tr.projeto_id)
      .maybeSingle();
    if (p) {
      projeto = {
        id: p.id,
        nome: p.nome,
        cor: p.cor,
        ordemPrioridade: p.ordem_prioridade,
        multiplicador: Number(p.multiplicador),
        ativo: p.ativo,
      };
    }
  }

  const { data: tagLinks } = await admin
    .from('tarefa_tags')
    .select('tag_id')
    .eq('tarefa_id', tarefaId);
  let tags: Tag[] = [];
  if (tagLinks && tagLinks.length > 0) {
    const { data: tagRows } = await admin
      .from('tags')
      .select('id, nome, cor, tipo_peso, valor_peso, ativo')
      .in(
        'id',
        tagLinks.map((t: { tag_id: string }) => t.tag_id),
      );
    tags = (tagRows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      nome: r.nome as string,
      cor: r.cor as string,
      tipoPeso: r.tipo_peso as Tag['tipoPeso'],
      valorPeso: Number(r.valor_peso),
      ativo: r.ativo as boolean,
    }));
  }

  const nota = calcularNota(
    {
      tipo: tr.tipo as Tarefa['tipo'],
      prioridade: tr.prioridade as Tarefa['prioridade'],
      dataVencimento: tr.data_vencimento,
      prazoConclusao: tr.prazo_conclusao,
      importancia: tr.importancia,
      urgencia: tr.urgencia,
      facilidade: tr.facilidade,
      projeto,
      tags,
    },
    config,
  );
  await admin.from('tarefas').update({ nota }).eq('id', tarefaId);
}
