export const runtime = 'edge';

import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { classificarTarefa } from '@/services/ai';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface PostBody {
  tarefaId?: string;
  titulo?: string;
  descricao?: string;
  projetoId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PostBody;
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    let titulo: string;
    let descricao: string | null = null;
    let projetoNome: string | null = null;
    let dataVencimento: string | null = null;

    if (body.tarefaId) {
      const { data: tarefa, error: tarefaErr } = await admin
        .from('tarefas')
        .select('id, titulo, descricao, data_vencimento, usuario_id, projeto:projetos(nome)')
        .eq('id', body.tarefaId)
        .eq('usuario_id', usuarioId)
        .is('deleted_at', null)
        .maybeSingle();

      if (tarefaErr) throw tarefaErr;
      if (!tarefa) {
        return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 });
      }

      titulo = tarefa.titulo as string;
      descricao = (tarefa.descricao as string | null) ?? null;
      dataVencimento = (tarefa.data_vencimento as string | null) ?? null;
      // biome-ignore lint/suspicious/noExplicitAny: join result shape
      projetoNome = (tarefa.projeto as any)?.nome ?? null;
    } else {
      if (!body.titulo) {
        return NextResponse.json(
          { error: 'Informe tarefaId ou titulo para classificar.' },
          { status: 400 },
        );
      }
      titulo = body.titulo;
      descricao = body.descricao ?? null;

      if (body.projetoId) {
        const { data: proj } = await admin
          .from('projetos')
          .select('nome')
          .eq('id', body.projetoId)
          .eq('usuario_id', usuarioId)
          .maybeSingle();
        projetoNome = (proj?.nome as string | null) ?? null;
      }
    }

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

    // biome-ignore lint/suspicious/noExplicitAny: config é jsonb com colunas dinâmicas
    const cfg = config as any;
    const apiKey: string | undefined =
      cfg?.ai_api_key_criptografada ?? process.env.ANTHROPIC_API_KEY ?? undefined;
    const modelo: string | undefined = cfg?.ai_modelo ?? undefined;

    const classificacao = await classificarTarefa({
      titulo,
      descricao,
      projeto: projetoNome,
      dataVencimento,
      criteriosSucesso: cfg?.criterios_sucesso ?? null,
      projetos,
      // biome-ignore lint/suspicious/noExplicitAny: domain Tag type
      tags: tags as any,
      apiKey,
      modelo,
    });

    let sugestaoId: string | undefined;
    if (body.tarefaId) {
      const { data: sugestao, error: sugestaoErr } = await admin
        .from('sugestoes_ai')
        .insert({
          usuario_id: usuarioId,
          tarefa_id: body.tarefaId,
          tipo: 'classificar',
          status: 'pendente',
          payload: classificacao,
        })
        .select('id')
        .single();

      if (sugestaoErr) {
        console.error('/api/ai/classificar — erro ao gravar sugestao_ai:', sugestaoErr);
      } else {
        sugestaoId = sugestao?.id as string | undefined;
      }
    }

    return NextResponse.json({
      classificacao,
      sugestaoId,
      usage: classificacao.usage,
    });
  } catch (err) {
    console.error('/api/ai/classificar POST error:', err);
    const msg = err instanceof Error ? err.message : 'Erro ao classificar tarefa.';
    const isClientError = msg.includes('Configure sua chave') || msg.includes('não encontrada');
    return NextResponse.json({ error: msg }, { status: isClientError ? 400 : 500 });
  }
}
