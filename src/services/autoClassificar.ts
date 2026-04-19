/**
 * autoClassificar — helper reutilizável para auto-classificação de tarefas por IA.
 * Disparado em fire-and-forget após criação de tarefa (POST /api/tarefas ou sync Todoist).
 */

import { CONFIG_PADRAO_PESOS, calcularNota } from '@/lib/scoring/engine';
import { getAdminClient } from '@/lib/supabase/admin';
import type { Configuracoes, Projeto, Tag } from '@/types/domain';
import type { ClassificacaoMeta } from './ai';
import { classificarTarefa } from './ai';

export interface AutoClassificarResult {
  pulada: boolean;
  motivo?: string;
  // biome-ignore lint/suspicious/noExplicitAny: payload dinâmico da classificação
  classificacao?: ClassificacaoMeta;
}

export async function autoClassificarSeHabilitado(params: {
  tarefaId: string;
  usuarioId: string;
}): Promise<AutoClassificarResult> {
  const { tarefaId, usuarioId } = params;

  try {
    const admin = getAdminClient();

    // 1. Busca configurações do usuário
    const { data: configRow } = await admin
      .from('configuracoes')
      .select(
        'ai_habilitado, ai_auto_aceita_classificacao, ai_api_key_criptografada, ai_modelo, criterios_sucesso, peso_urgencia, peso_importancia, peso_facilidade',
      )
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    // biome-ignore lint/suspicious/noExplicitAny: colunas dinâmicas do jsonb
    const cfg = configRow as any;

    // 2. Feature flags — tratar null como false
    const aiHabilitado = Boolean(cfg?.ai_habilitado);
    const autoAceita = Boolean(cfg?.ai_auto_aceita_classificacao);
    const temApiKey = Boolean(cfg?.ai_api_key_criptografada ?? process.env.ANTHROPIC_API_KEY);

    if (!aiHabilitado) {
      return { pulada: true, motivo: 'ai_habilitado=false' };
    }
    if (!autoAceita) {
      return { pulada: true, motivo: 'ai_auto_aceita_classificacao=false' };
    }
    if (!temApiKey) {
      return { pulada: true, motivo: 'sem api key configurada' };
    }

    // 3. Busca a tarefa
    const { data: tarefa, error: tarefaErr } = await admin
      .from('tarefas')
      .select(
        'id, usuario_id, titulo, descricao, importancia, urgencia, facilidade, tipo, prioridade, data_vencimento, prazo_conclusao, projeto_id',
      )
      .eq('id', tarefaId)
      .eq('usuario_id', usuarioId)
      .is('deleted_at', null)
      .maybeSingle();

    if (tarefaErr || !tarefa) {
      return { pulada: true, motivo: 'tarefa não encontrada' };
    }

    // 4. Pula se já tem os 3 campos preenchidos
    if (tarefa.importancia != null && tarefa.urgencia != null && tarefa.facilidade != null) {
      return { pulada: true, motivo: 'importancia/urgencia/facilidade já preenchidos' };
    }

    // 5. Busca projetos e tags ativos
    const [{ data: projetosRaw }, { data: tagsRaw }] = await Promise.all([
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

    // biome-ignore lint/suspicious/noExplicitAny: raw DB rows
    const projetos: Projeto[] = (projetosRaw ?? []).map((p: any) => ({
      id: p.id as string,
      nome: p.nome as string,
      cor: p.cor as string,
      ordemPrioridade: p.ordem_prioridade as number,
      multiplicador: Number(p.multiplicador),
      ativo: p.ativo as boolean,
    }));

    // biome-ignore lint/suspicious/noExplicitAny: raw DB rows
    const tags: Tag[] = (tagsRaw ?? []).map((t: any) => ({
      id: t.id as string,
      nome: t.nome as string,
      cor: t.cor as string,
      tipoPeso: t.tipo_peso as Tag['tipoPeso'],
      valorPeso: Number(t.valor_peso),
      ativo: t.ativo as boolean,
    }));

    // Nome do projeto para contexto
    let projetoNome: string | null = null;
    if (tarefa.projeto_id) {
      const proj = projetos.find((p) => p.id === tarefa.projeto_id);
      projetoNome = proj?.nome ?? null;
    }

    const apiKey: string | undefined =
      cfg?.ai_api_key_criptografada ?? process.env.ANTHROPIC_API_KEY ?? undefined;
    const modelo: string | undefined = cfg?.ai_modelo ?? undefined;

    // 6. Chama classificarTarefa
    const classificacao = await classificarTarefa({
      titulo: tarefa.titulo as string,
      descricao: (tarefa.descricao as string | null) ?? null,
      projeto: projetoNome,
      dataVencimento: (tarefa.data_vencimento as string | null) ?? null,
      criteriosSucesso: (cfg?.criterios_sucesso as Record<string, unknown> | null) ?? null,
      projetos,
      tags,
      apiKey,
      modelo,
    });

    // 7. Monta config para recalcular nota
    const configuracoes: Configuracoes = {
      usuarioId,
      pesos: configRow
        ? {
            urgencia: Number(cfg.peso_urgencia),
            importancia: Number(cfg.peso_importancia),
            facilidade: Number(cfg.peso_facilidade),
          }
        : CONFIG_PADRAO_PESOS,
      limiares: { reavaliacao: 30, descarte: 50, adiamento: 40 },
      audioHabilitado: true,
      animacoesHabilitadas: true,
      aiHabilitado: true,
      todoistSyncHabilitado: true,
    };

    // Busca tags atuais da tarefa para scoring
    const { data: tarefaTagsRaw } = await admin
      .from('tarefa_tags')
      .select('tag_id')
      .eq('tarefa_id', tarefaId);
    const tagIdsAtuais = (tarefaTagsRaw ?? []).map((r: { tag_id: string }) => r.tag_id);
    const tagsAtuais = tags.filter((t) => tagIdsAtuais.includes(t.id));

    // Projeto atual
    const projetoAtual = projetos.find((p) => p.id === tarefa.projeto_id) ?? null;

    const novaNota = calcularNota(
      {
        tipo: tarefa.tipo as 'tarefa' | 'lembrete',
        prioridade: (tarefa.prioridade as 1 | 2 | 3 | 4) ?? 4,
        dataVencimento: (tarefa.data_vencimento as string | null) ?? null,
        prazoConclusao: (tarefa.prazo_conclusao as string | null) ?? null,
        importancia: classificacao.importancia,
        urgencia: classificacao.urgencia,
        facilidade: classificacao.facilidade,
        projeto: projetoAtual,
        tags: tagsAtuais,
      },
      configuracoes,
    );

    // 8. UPDATE tarefa com os 3 valores + nota
    await admin
      .from('tarefas')
      .update({
        importancia: classificacao.importancia,
        urgencia: classificacao.urgencia,
        facilidade: classificacao.facilidade,
        nota: novaNota,
      })
      .eq('id', tarefaId)
      .eq('usuario_id', usuarioId);

    // 9. INSERT tarefa_tags para cada tag sugerida (ON CONFLICT DO NOTHING via upsert)
    if (classificacao.tags_sugeridas.length > 0) {
      const tagsSugeridosIds = classificacao.tags_sugeridas
        .map((nome) => tags.find((t) => t.nome === nome || t.id === nome)?.id)
        .filter((id): id is string => Boolean(id));

      if (tagsSugeridosIds.length > 0) {
        await admin.from('tarefa_tags').upsert(
          tagsSugeridosIds.map((tag_id) => ({ tarefa_id: tarefaId, tag_id })),
          { onConflict: 'tarefa_id,tag_id', ignoreDuplicates: true },
        );
      }
    }

    // 10. INSERT em sugestoes_ai
    await admin.from('sugestoes_ai').insert({
      usuario_id: usuarioId,
      tarefa_id: tarefaId,
      tipo: 'classificar',
      status: 'aceita',
      payload: classificacao,
      resposta_usuario: { auto_aceita: true },
    });

    // 11. INSERT em historico_acoes
    await admin.from('historico_acoes').insert({
      usuario_id: usuarioId,
      tarefa_id: tarefaId,
      tipo: 'editada',
      dados: { origem: 'ai_auto_classificacao' },
    });

    return { pulada: false, classificacao };
  } catch (err) {
    console.error('[autoClassificar] erro ao classificar tarefa', tarefaId, err);
    return { pulada: true, motivo: 'erro interno' };
  }
}
