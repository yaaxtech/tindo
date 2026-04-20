export const runtime = 'edge';

import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { sugerirTarefas } from '@/services/ai';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

// ---------------------------------------------------------------------------
// GET — lista sugestoes_ai pendentes do usuário
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest) {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    const { data, error } = await admin
      .from('sugestoes_ai')
      .select('id, payload, created_at')
      .eq('usuario_id', usuarioId)
      .eq('tipo', 'sugerir_nova')
      .eq('status', 'pendente')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({
      sugestoes: (data ?? []).map((row) => ({
        id: row.id as string,
        // biome-ignore lint/suspicious/noExplicitAny: payload is jsonb
        payload: row.payload as any,
        createdAt: row.created_at as string,
      })),
    });
  } catch (err) {
    console.error('GET /api/ai/sugerir-tarefas error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar sugestões.' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — gera novas sugestões via IA
// ---------------------------------------------------------------------------

export async function POST(_request: NextRequest) {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    // Busca configurações, projetos e tags em paralelo
    const [{ data: config }, { data: projetosRaw }, { data: tagsRaw }] = await Promise.all([
      admin.from('configuracoes').select('*').eq('usuario_id', usuarioId).maybeSingle(),
      admin
        .from('projetos')
        .select('id, nome, cor, ordem_prioridade, multiplicador, ativo')
        .eq('usuario_id', usuarioId)
        .is('deleted_at', null)
        .eq('ativo', true)
        .order('ordem_prioridade', { ascending: true }),
      admin
        .from('tags')
        .select('id, nome, cor, tipo_peso, valor_peso, ativo')
        .eq('usuario_id', usuarioId)
        .is('deleted_at', null)
        .eq('ativo', true),
    ]);

    // Busca últimas 10 concluídas e count por projeto em paralelo
    const [{ data: concluidasRaw }, { data: pendentesRaw }] = await Promise.all([
      admin
        .from('tarefas')
        .select('titulo')
        .eq('usuario_id', usuarioId)
        .eq('status', 'concluida')
        .is('deleted_at', null)
        .order('concluida_em', { ascending: false })
        .limit(10),
      admin
        .from('tarefas')
        .select('projeto_id, projetos(nome)')
        .eq('usuario_id', usuarioId)
        .eq('status', 'pendente')
        .is('deleted_at', null),
    ]);

    // biome-ignore lint/suspicious/noExplicitAny: raw DB rows mapped to domain type
    const projetos = (projetosRaw ?? []).map((p: any) => ({
      id: p.id as string,
      nome: p.nome as string,
      cor: p.cor as string,
      ordemPrioridade: p.ordem_prioridade as number,
      multiplicador: p.multiplicador as number,
      ativo: p.ativo as boolean,
    }));

    // biome-ignore lint/suspicious/noExplicitAny: raw DB rows mapped to domain type
    const tags = (tagsRaw ?? []).map((t: any) => ({
      id: t.id as string,
      nome: t.nome as string,
      cor: t.cor as string,
      tipoPeso: t.tipo_peso as string,
      valorPeso: t.valor_peso as number,
      ativo: t.ativo as boolean,
    }));

    const ultimasConcluidas = (concluidasRaw ?? []).map((t) => t.titulo as string);

    // Agrupa pendentes por projeto
    const contagemMap: Record<string, { nome: string; count: number }> = {};
    for (const row of pendentesRaw ?? []) {
      // biome-ignore lint/suspicious/noExplicitAny: join result shape
      const projetoNome = (row.projetos as any)?.nome ?? 'Sem projeto';
      const key = (row.projeto_id as string | null) ?? '__sem_projeto__';
      if (!contagemMap[key]) {
        contagemMap[key] = { nome: projetoNome, count: 0 };
      }
      contagemMap[key].count += 1;
    }
    const tarefasPendentesResumo = Object.values(contagemMap).map((v) => ({
      projetoNome: v.nome,
      count: v.count,
    }));

    // biome-ignore lint/suspicious/noExplicitAny: config é jsonb
    const cfg = config as any;
    const apiKey: string | undefined =
      cfg?.ai_api_key_criptografada ?? process.env.ANTHROPIC_API_KEY ?? undefined;
    const modelo: string | undefined = cfg?.ai_modelo ?? undefined;

    const resultado = await sugerirTarefas({
      criteriosSucesso: cfg?.criterios_sucesso ?? null,
      projetos,
      // biome-ignore lint/suspicious/noExplicitAny: domain Tag type
      tags: tags as any,
      ultimasConcluidas,
      tarefasPendentesResumo,
      apiKey,
      modelo,
    });

    // Grava cada sugestão em sugestoes_ai
    const inserts = resultado.sugestoes.map((s) => ({
      usuario_id: usuarioId,
      tarefa_id: null,
      tipo: 'sugerir_nova',
      status: 'pendente',
      payload: s,
    }));

    const { data: gravadas, error: insertErr } = await admin
      .from('sugestoes_ai')
      .insert(inserts)
      .select('id, payload');

    if (insertErr) {
      console.error('/api/ai/sugerir-tarefas — erro ao gravar sugestoes_ai:', insertErr);
    }

    return NextResponse.json({
      sugestoes: (gravadas ?? []).map((row) => {
        // biome-ignore lint/suspicious/noExplicitAny: payload is jsonb
        const p = row.payload as any;
        return {
          id: row.id as string,
          titulo: p?.titulo ?? '',
          descricao: p?.descricao ?? null,
          projeto_id_sugerido: p?.projeto_id_sugerido ?? null,
          importancia: p?.importancia ?? 50,
          urgencia: p?.urgencia ?? 50,
          facilidade: p?.facilidade ?? 50,
          razao: p?.razao_caminho_critico ?? '',
        };
      }),
      usage: resultado.usage,
    });
  } catch (err) {
    console.error('POST /api/ai/sugerir-tarefas error:', err);
    const msg = err instanceof Error ? err.message : 'Erro ao gerar sugestões.';
    const isClientError = msg.includes('Configure sua chave');
    return NextResponse.json({ error: msg }, { status: isClientError ? 400 : 500 });
  }
}
