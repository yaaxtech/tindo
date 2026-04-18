import { NextResponse } from 'next/server';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { CONFIG_PADRAO_PESOS, calcularNota } from '@/lib/scoring/engine';
import type { Configuracoes, Projeto, Tag, Tarefa } from '@/types/domain';

export const dynamic = 'force-dynamic';

/**
 * Recalcula a nota de todas as tarefas pendentes do usuário MVP.
 * Útil depois de alterar multiplicadores de projeto, pesos ou tags.
 */
export async function POST() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    const [{ data: configRow }, { data: projRows }, { data: tagRows }, { data: tarRows }] = await Promise.all([
      admin
        .from('configuracoes')
        .select('peso_urgencia, peso_importancia, peso_facilidade')
        .eq('usuario_id', usuarioId)
        .maybeSingle(),
      admin
        .from('projetos')
        .select('id, nome, cor, ordem_prioridade, multiplicador, ativo')
        .eq('usuario_id', usuarioId)
        .is('deleted_at', null),
      admin
        .from('tags')
        .select('id, nome, cor, tipo_peso, valor_peso, ativo')
        .eq('usuario_id', usuarioId)
        .is('deleted_at', null),
      admin
        .from('tarefas')
        .select('id, tipo, prioridade, data_vencimento, prazo_conclusao, importancia, urgencia, facilidade, projeto_id')
        .eq('usuario_id', usuarioId)
        .eq('status', 'pendente')
        .is('deleted_at', null),
    ]);

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

    const projetos = new Map<string, Projeto>();
    for (const p of projRows ?? []) {
      projetos.set(p.id, {
        id: p.id,
        nome: p.nome,
        cor: p.cor,
        ordemPrioridade: p.ordem_prioridade,
        multiplicador: Number(p.multiplicador),
        ativo: p.ativo,
      });
    }

    const tagsMap = new Map<string, Tag>();
    for (const t of tagRows ?? []) {
      tagsMap.set(t.id, {
        id: t.id,
        nome: t.nome,
        cor: t.cor,
        tipoPeso: t.tipo_peso as Tag['tipoPeso'],
        valorPeso: Number(t.valor_peso),
        ativo: t.ativo,
      });
    }

    // Preload tarefa_tags
    const tarefaIds = (tarRows ?? []).map((r: { id: string }) => r.id);
    const tagsPorTarefa = new Map<string, Tag[]>();
    if (tarefaIds.length > 0) {
      const { data: ttRows } = await admin
        .from('tarefa_tags')
        .select('tarefa_id, tag_id')
        .in('tarefa_id', tarefaIds);
      for (const tt of ttRows ?? []) {
        const tg = tagsMap.get(tt.tag_id);
        if (!tg) continue;
        const arr = tagsPorTarefa.get(tt.tarefa_id) ?? [];
        arr.push(tg);
        tagsPorTarefa.set(tt.tarefa_id, arr);
      }
    }

    let atualizadas = 0;
    for (const tr of tarRows ?? []) {
      const novaNota = calcularNota(
        {
          tipo: tr.tipo as Tarefa['tipo'],
          prioridade: tr.prioridade as Tarefa['prioridade'],
          dataVencimento: tr.data_vencimento,
          prazoConclusao: tr.prazo_conclusao,
          importancia: tr.importancia,
          urgencia: tr.urgencia,
          facilidade: tr.facilidade,
          projeto: tr.projeto_id ? (projetos.get(tr.projeto_id) ?? null) : null,
          tags: tagsPorTarefa.get(tr.id) ?? [],
        },
        config,
      );
      const { error } = await admin
        .from('tarefas')
        .update({ nota: novaNota })
        .eq('id', tr.id)
        .eq('usuario_id', usuarioId);
      if (!error) atualizadas++;
    }

    return NextResponse.json({ ok: true, atualizadas });
  } catch (err) {
    console.error('/api/recalcular-notas error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
