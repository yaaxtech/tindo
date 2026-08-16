import { ErroConflito, ErroNaoEncontrado, ErroValidacao } from '@/lib/api/erros';
import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { paraJson } from '@/lib/supabase/json';
import type { TablesUpdate } from '@/types/database';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

interface PatchBody {
  acao: 'aceitar' | 'rejeitar';
  editada?: Record<string, unknown>;
}

export const PATCH = rotaApi(
  'PATCH /api/sugestoes-ai/[id]',
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = (await request.json()) as PatchBody;

    if (!body.acao || !['aceitar', 'rejeitar'].includes(body.acao)) {
      throw new ErroValidacao('acao deve ser aceitar ou rejeitar.');
    }

    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    // Busca a sugestão
    const { data: sugestao, error: sugestaoErr } = await admin
      .from('sugestoes_ai')
      .select('id, tipo, tarefa_id, payload, status')
      .eq('id', id)
      .eq('usuario_id', usuarioId)
      .single();

    if (sugestaoErr || !sugestao) {
      throw new ErroNaoEncontrado('Sugestão não encontrada.');
    }

    if (sugestao.status !== 'pendente') {
      throw new ErroConflito('Sugestão já foi resolvida.');
    }

    if (body.acao === 'rejeitar') {
      await admin
        .from('sugestoes_ai')
        .update({ status: 'rejeitada', resolvida_em: new Date().toISOString() })
        .eq('id', id);
      return respostaOk({ ok: true });
    }

    // acao === 'aceitar'
    const agora = new Date().toISOString();
    const respostaFinal = body.editada ?? (sugestao.payload as Record<string, unknown>);

    if (sugestao.tipo === 'classificar') {
      // biome-ignore lint/suspicious/noExplicitAny: payload is dynamic JSON
      const p = respostaFinal as any;
      const importancia = p.importancia != null ? Number(p.importancia) : undefined;
      const urgencia = p.urgencia != null ? Number(p.urgencia) : undefined;
      const facilidade = p.facilidade != null ? Number(p.facilidade) : undefined;
      const tagsSugeridas: string[] = Array.isArray(p.tags_sugeridas) ? p.tags_sugeridas : [];

      // Atualiza tarefa
      const updatePayload: TablesUpdate<'tarefas'> = {};
      if (importancia !== undefined && !Number.isNaN(importancia))
        updatePayload.importancia = importancia;
      if (urgencia !== undefined && !Number.isNaN(urgencia)) updatePayload.urgencia = urgencia;
      if (facilidade !== undefined && !Number.isNaN(facilidade))
        updatePayload.facilidade = facilidade;

      // `tarefa_id` é NULL-able em sugestoes_ai; sem id não há o que atualizar.
      if (Object.keys(updatePayload).length > 0 && sugestao.tarefa_id) {
        await admin.from('tarefas').update(updatePayload).eq('id', sugestao.tarefa_id);
      }

      // Insere tags via tarefa_tags (upsert para não duplicar)
      if (tagsSugeridas.length > 0 && sugestao.tarefa_id) {
        const registros = tagsSugeridas.map((tagId) => ({
          tarefa_id: sugestao.tarefa_id as string,
          tag_id: tagId,
        }));
        await admin.from('tarefa_tags').upsert(registros, { onConflict: 'tarefa_id,tag_id' });
      }
    } else if (sugestao.tipo === 'quebrar') {
      // biome-ignore lint/suspicious/noExplicitAny: payload is dynamic JSON
      const p = respostaFinal as any;
      // biome-ignore lint/suspicious/noExplicitAny: iterating dynamic sub_tarefas array
      const subTarefas: any[] = Array.isArray(p.subTarefas) ? p.subTarefas : [];

      if (subTarefas.length > 0 && sugestao.tarefa_id) {
        // Busca prioridade da tarefa original
        const { data: tarefaOriginal } = await admin
          .from('tarefas')
          .select('prioridade, projeto_id, usuario_id')
          .eq('id', sugestao.tarefa_id)
          .single();

        const novasTarefas = subTarefas.map((st) => ({
          usuario_id: usuarioId,
          titulo: String(st.titulo ?? '').slice(0, 200),
          descricao: st.descricao ? String(st.descricao).slice(0, 500) : null,
          tipo: 'tarefa' as const,
          status: 'pendente' as const,
          prioridade: tarefaOriginal?.prioridade ?? 4,
          projeto_id: tarefaOriginal?.projeto_id ?? null,
          facilidade: st.facilidadeEstimada != null ? Number(st.facilidadeEstimada) : null,
          dependencia_tarefa_id: sugestao.tarefa_id as string,
        }));

        await admin.from('tarefas').insert(novasTarefas);
      }
    }

    // Marca sugestão como aceita
    await admin
      .from('sugestoes_ai')
      .update({
        status: 'aceita',
        resolvida_em: agora,
        resposta_usuario: paraJson(respostaFinal),
      })
      .eq('id', id);

    return respostaOk({ ok: true });
  },
);

export const DELETE = rotaApi(
  'DELETE /api/sugestoes-ai/[id]',
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    await admin
      .from('sugestoes_ai')
      .update({ status: 'rejeitada', resolvida_em: new Date().toISOString() })
      .eq('id', id)
      .eq('usuario_id', usuarioId);

    return respostaOk({ ok: true });
  },
);
