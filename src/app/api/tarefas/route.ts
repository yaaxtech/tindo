import { CONFIG_PADRAO_PESOS, calcularNota } from '@/lib/scoring/engine';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import type { Configuracoes, Projeto, Tag } from '@/types/domain';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface CreatePayload {
  titulo: string;
  descricao?: string | null;
  tipo: 'tarefa' | 'lembrete';
  projeto_id?: string | null;
  prioridade?: 1 | 2 | 3 | 4;
  data_vencimento?: string | null;
  prazo_conclusao?: string | null;
  importancia?: number | null;
  urgencia?: number | null;
  facilidade?: number | null;
  tag_ids?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();
    const body = (await request.json()) as CreatePayload;
    if (!body.titulo?.trim()) {
      return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 });
    }

    // Calcula nota antes do insert
    const nota = await calcularNotaComContexto(admin, usuarioId, body);

    const { data: tarefa, error } = await admin
      .from('tarefas')
      .insert({
        usuario_id: usuarioId,
        tipo: body.tipo,
        titulo: body.titulo.trim(),
        descricao: body.descricao?.trim() ?? null,
        projeto_id: body.projeto_id ?? null,
        prioridade: body.prioridade ?? 4,
        data_vencimento: body.data_vencimento ?? null,
        prazo_conclusao: body.prazo_conclusao ?? null,
        importancia: body.importancia ?? null,
        urgencia: body.urgencia ?? null,
        facilidade: body.facilidade ?? null,
        nota,
        status: 'pendente',
      })
      .select('id')
      .single();
    if (error) throw error;

    if (body.tag_ids && body.tag_ids.length > 0 && tarefa) {
      await admin
        .from('tarefa_tags')
        .insert(body.tag_ids.map((tid) => ({ tarefa_id: tarefa.id, tag_id: tid })));
    }

    return NextResponse.json({ ok: true, id: tarefa?.id, nota });
  } catch (err) {
    console.error('/api/tarefas POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}

async function calcularNotaComContexto(
  admin: ReturnType<typeof getAdminClient>,
  usuarioId: string,
  body: CreatePayload,
): Promise<number> {
  const { data: configRow } = await admin
    .from('configuracoes')
    .select('peso_urgencia, peso_importancia, peso_facilidade')
    .eq('usuario_id', usuarioId)
    .maybeSingle();
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
  if (body.projeto_id) {
    const { data: p } = await admin
      .from('projetos')
      .select('id, nome, cor, ordem_prioridade, multiplicador, ativo')
      .eq('id', body.projeto_id)
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
  let tags: Tag[] = [];
  if (body.tag_ids && body.tag_ids.length > 0) {
    const { data: tagRows } = await admin
      .from('tags')
      .select('id, nome, cor, tipo_peso, valor_peso, ativo')
      .in('id', body.tag_ids);
    tags = (tagRows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      nome: r.nome as string,
      cor: r.cor as string,
      tipoPeso: r.tipo_peso as Tag['tipoPeso'],
      valorPeso: Number(r.valor_peso),
      ativo: r.ativo as boolean,
    }));
  }

  return calcularNota(
    {
      tipo: body.tipo,
      prioridade: body.prioridade ?? 4,
      dataVencimento: body.data_vencimento ?? null,
      prazoConclusao: body.prazo_conclusao ?? null,
      importancia: body.importancia ?? null,
      urgencia: body.urgencia ?? null,
      facilidade: body.facilidade ?? null,
      projeto,
      tags,
    },
    config,
  );
}
