import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { propagarParaTodoist } from '@/services/todoistWriteback';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Acao =
  | { tipo: 'concluir' }
  | { tipo: 'adiar'; ate: string; motivoAuto?: string; automatico?: boolean }
  | { tipo: 'desfazer_adiamento' }
  | { tipo: 'excluir' };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Acao;
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    switch (body.tipo) {
      case 'concluir': {
        const { error } = await admin
          .from('tarefas')
          .update({
            status: 'concluida',
            concluida_em: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('usuario_id', usuarioId);
        if (error) throw error;
        await admin.from('historico_acoes').insert({
          usuario_id: usuarioId,
          tarefa_id: id,
          acao: 'concluida',
        });
        void propagarParaTodoist({ usuarioId, tarefaId: id, acao: 'concluir' });
        return NextResponse.json({ ok: true });
      }
      case 'adiar': {
        const { data: prev } = await admin
          .from('tarefas')
          .select('adiamento_count')
          .eq('id', id)
          .eq('usuario_id', usuarioId)
          .maybeSingle();
        const novoCount = (prev?.adiamento_count ?? 0) + 1;
        const { error } = await admin
          .from('tarefas')
          .update({
            adiada_ate: body.ate,
            adiamento_motivo_auto: body.motivoAuto ?? null,
            adiamento_count: novoCount,
          })
          .eq('id', id)
          .eq('usuario_id', usuarioId);
        if (error) throw error;
        await admin.from('historico_acoes').insert({
          usuario_id: usuarioId,
          tarefa_id: id,
          acao: body.automatico ? 'adiada_auto' : 'adiada_manual',
          dados: { ateISO: body.ate, motivo: body.motivoAuto ?? null },
        });
        // Propaga data de vencimento para o Todoist (YYYY-MM-DD)
        void propagarParaTodoist({
          usuarioId,
          tarefaId: id,
          acao: 'atualizar',
          patch: { dataVencimento: body.ate.slice(0, 10) },
        });
        return NextResponse.json({ ok: true });
      }
      case 'desfazer_adiamento': {
        const { data: prev } = await admin
          .from('tarefas')
          .select('adiamento_count')
          .eq('id', id)
          .eq('usuario_id', usuarioId)
          .maybeSingle();
        const novoCount = Math.max(0, (prev?.adiamento_count ?? 1) - 1);
        const { error } = await admin
          .from('tarefas')
          .update({
            adiada_ate: null,
            adiamento_motivo_auto: null,
            adiamento_count: novoCount,
          })
          .eq('id', id)
          .eq('usuario_id', usuarioId);
        if (error) throw error;
        await admin.from('historico_acoes').insert({
          usuario_id: usuarioId,
          tarefa_id: id,
          acao: 'voltada',
          dados: { origem: 'desfazer_adiamento' },
        });
        void propagarParaTodoist({
          usuarioId,
          tarefaId: id,
          acao: 'atualizar',
          patch: { dataVencimento: null },
        });
        return NextResponse.json({ ok: true });
      }
      case 'excluir': {
        const { error } = await admin
          .from('tarefas')
          .update({
            deleted_at: new Date().toISOString(),
            status: 'excluida',
          })
          .eq('id', id)
          .eq('usuario_id', usuarioId);
        if (error) throw error;
        await admin.from('historico_acoes').insert({
          usuario_id: usuarioId,
          tarefa_id: id,
          acao: 'excluida',
        });
        void propagarParaTodoist({ usuarioId, tarefaId: id, acao: 'excluir' });
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    console.error('/api/tarefas/[id]/acao error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
