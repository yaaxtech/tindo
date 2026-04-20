export const runtime = 'edge';

import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface RespostaBody {
  acao: 'aceitar' | 'rejeitar';
  editada?: {
    titulo: string;
    descricao?: string | null;
    projeto_id?: string | null;
    importancia: number;
    urgencia: number;
    facilidade: number;
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as RespostaBody;
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    // Busca a sugestão
    const { data: sugestao, error: fetchErr } = await admin
      .from('sugestoes_ai')
      .select('id, payload, status, usuario_id')
      .eq('id', id)
      .eq('usuario_id', usuarioId)
      .eq('tipo', 'sugerir_nova')
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!sugestao) {
      return NextResponse.json({ error: 'Sugestão não encontrada.' }, { status: 404 });
    }
    if (sugestao.status !== 'pendente') {
      return NextResponse.json({ error: 'Sugestão já foi respondida.' }, { status: 409 });
    }

    if (body.acao === 'rejeitar') {
      const { error: rejErr } = await admin
        .from('sugestoes_ai')
        .update({
          status: 'rejeitada',
          resolvida_em: new Date().toISOString(),
        })
        .eq('id', id);

      if (rejErr) throw rejErr;
      return NextResponse.json({ ok: true });
    }

    // acao === 'aceitar'
    // biome-ignore lint/suspicious/noExplicitAny: payload is jsonb
    const payload = (sugestao.payload ?? {}) as any;
    const dados = body.editada ?? payload;

    const { data: tarefa, error: tarefaErr } = await admin
      .from('tarefas')
      .insert({
        usuario_id: usuarioId,
        tipo: 'tarefa',
        titulo: String(dados.titulo ?? payload.titulo ?? 'Nova tarefa').slice(0, 255),
        descricao: dados.descricao ?? payload.descricao ?? null,
        projeto_id: dados.projeto_id ?? payload.projeto_id_sugerido ?? null,
        prioridade: 3,
        status: 'pendente',
        importancia: Number(dados.importancia ?? payload.importancia ?? 50),
        urgencia: Number(dados.urgencia ?? payload.urgencia ?? 50),
        facilidade: Number(dados.facilidade ?? payload.facilidade ?? 50),
        nota: 0,
      })
      .select('id')
      .single();

    if (tarefaErr) throw tarefaErr;

    const { error: updErr } = await admin
      .from('sugestoes_ai')
      .update({
        status: 'aceita',
        resolvida_em: new Date().toISOString(),
        tarefa_id: tarefa.id as string,
      })
      .eq('id', id);

    if (updErr) throw updErr;

    return NextResponse.json({ ok: true, tarefaId: tarefa.id as string });
  } catch (err) {
    console.error('POST /api/ai/sugerir-tarefas/[id]/resposta error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao responder sugestão.' },
      { status: 500 },
    );
  }
}
