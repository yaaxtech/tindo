import { type NextRequest, NextResponse } from 'next/server';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type Acao =
  | { tipo: 'concluir' }
  | { tipo: 'adiar'; ate: string; motivoAuto?: string }
  | { tipo: 'excluir' };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
        return NextResponse.json({ ok: true });
      }
      case 'adiar': {
        const { error } = await admin
          .from('tarefas')
          .update({
            adiada_ate: body.ate,
            adiamento_motivo_auto: body.motivoAuto ?? null,
          })
          .eq('id', id)
          .eq('usuario_id', usuarioId);
        if (error) throw error;
        await admin.from('historico_acoes').insert({
          usuario_id: usuarioId,
          tarefa_id: id,
          acao: body.motivoAuto ? 'adiada_auto' : 'adiada_manual',
          dados: { ate: body.ate },
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
