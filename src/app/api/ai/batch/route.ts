export const runtime = 'edge';

import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { classificarBatch } from '@/services/ai';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface PostBody {
  filtros?: {
    semClassificacao?: boolean;
    projetoId?: string;
  };
  limite?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PostBody;
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    const semClassificacao = body.filtros?.semClassificacao ?? true;
    const projetoId = body.filtros?.projetoId;
    const limite = Math.min(body.limite ?? 10, 20);

    // Busca configurações para obter apiKey e modelo
    const { data: cfg } = await admin
      .from('configuracoes')
      .select('ai_api_key_criptografada, ai_modelo')
      .eq('usuario_id', usuarioId)
      .single();

    const apiKey =
      (cfg?.ai_api_key_criptografada as string | null) ??
      process.env.ANTHROPIC_API_KEY ??
      undefined;
    const modelo = (cfg?.ai_modelo as string | null) ?? 'claude-sonnet-4-6';

    // Busca tarefas sem classificação
    let query = admin
      .from('tarefas')
      .select('id, titulo, descricao')
      .eq('usuario_id', usuarioId)
      .eq('status', 'pendente')
      .is('deleted_at', null)
      .limit(limite);

    if (semClassificacao) {
      query = query.or('importancia.is.null,urgencia.is.null,facilidade.is.null');
    }
    if (projetoId) {
      query = query.eq('projeto_id', projetoId);
    }

    const { data: tarefas, error: tarefasErr } = await query;
    if (tarefasErr) {
      return NextResponse.json({ error: 'Erro ao buscar tarefas.' }, { status: 500 });
    }
    if (!tarefas || tarefas.length === 0) {
      return NextResponse.json({ processadas: 0, resultados: [] });
    }

    const { resultados } = await classificarBatch(
      tarefas.map((t) => ({
        id: t.id as string,
        titulo: t.titulo as string,
        descricao: t.descricao as string | null,
      })),
      { apiKey, modelo },
    );

    // Grava sugestoes_ai para cada resultado com sucesso
    const sugestoesParaInserir = resultados
      .filter((r) => r.classificacao)
      .map((r) => ({
        usuario_id: usuarioId,
        tarefa_id: r.id,
        tipo: 'classificar' as const,
        status: 'pendente',
        payload: r.classificacao,
      }));

    if (sugestoesParaInserir.length > 0) {
      const { error: insertErr } = await admin.from('sugestoes_ai').insert(sugestoesParaInserir);
      if (insertErr) {
        console.error('/api/ai/batch — erro ao inserir sugestoes_ai:', insertErr);
      }
    }

    return NextResponse.json({ processadas: resultados.length, resultados });
  } catch (err) {
    console.error('/api/ai/batch POST error:', err);
    const msg = err instanceof Error ? err.message : 'Erro ao processar batch.';
    const isClientError = msg.includes('Configure sua chave');
    return NextResponse.json({ error: msg }, { status: isClientError ? 400 : 500 });
  }
}
