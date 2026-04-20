/**
 * Sincronização Todoist → TinDo (pull-only por enquanto).
 *
 * Regras importantes:
 * - Tarefas JÁ marcadas como 'concluida' ou 'excluida' no TinDo NÃO são
 *   revertidas a 'pendente' mesmo que apareçam abertas no Todoist
 *   (evita perda do histórico do usuário enquanto push está OFF).
 * - Tarefas novas vêm filtradas por tipo (lembrete / tarefa) via label OU
 *   nome de projeto.
 * - Upsert atualiza título, descrição, projeto, prioridade, datas e nota —
 *   mas preserva adiada_ate e status das existentes.
 */

import { CONFIG_PADRAO_PESOS, calcularNota } from '@/lib/scoring/engine';
import { autoClassificarSeHabilitado } from '@/services/autoClassificar';
import type { Configuracoes, Projeto, Tag } from '@/types/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TodoistClient, type TodoistWorkspace, todoistColorHex } from './client';
import { deriveTipo, prioridadeTodoistParaTinDo } from './mapper';

export interface SyncResultado {
  espacos: number;
  projetos: number;
  tags: number;
  tarefasImportadas: number;
  tarefasAtualizadas: number;
  preservadas: number;
  ignoradas: number;
  erros: string[];
}

export async function sincronizarTodoist(
  admin: SupabaseClient,
  usuarioId: string,
  token?: string,
  projetoIds?: string[],
): Promise<SyncResultado> {
  const td = new TodoistClient(token);
  const resultado: SyncResultado = {
    espacos: 0,
    projetos: 0,
    tags: 0,
    tarefasImportadas: 0,
    tarefasAtualizadas: 0,
    preservadas: 0,
    ignoradas: 0,
    erros: [],
  };

  // 0. Workspaces
  let workspaces: TodoistWorkspace[] = [];
  try {
    workspaces = await td.listWorkspaces();
  } catch (err) {
    // API pode retornar 403/404 em contas sem workspaces (plano free) — não aborta o sync.
    resultado.erros.push(
      `workspaces: ${err instanceof Error ? err.message : String(err)} (ignorado)`,
    );
  }
  for (const w of workspaces) {
    const { error } = await admin.from('espacos_trabalho').upsert(
      {
        usuario_id: usuarioId,
        todoist_id: String(w.id),
        nome: w.name,
      },
      { onConflict: 'usuario_id,todoist_id' },
    );
    if (error) {
      resultado.erros.push(`workspace ${w.name}: ${error.message}`);
      continue;
    }
    resultado.espacos++;
  }

  // 1. Projetos
  const projetos = await td.listProjects();
  const mapaProj = new Map<string, string>();
  const projetoNomePorTodoistId = new Map<string, string>();
  for (const p of projetos) {
    const hex = todoistColorHex(p.color);
    const { data, error } = await admin
      .from('projetos')
      .upsert(
        {
          usuario_id: usuarioId,
          todoist_id: p.id,
          nome: p.name,
          cor: hex,
          ordem_prioridade: p.child_order,
        },
        { onConflict: 'usuario_id,todoist_id' },
      )
      .select('id')
      .single();
    if (error) {
      resultado.erros.push(`projeto ${p.name}: ${error.message}`);
      continue;
    }
    mapaProj.set(p.id, (data as { id: string }).id);
    projetoNomePorTodoistId.set(p.id, p.name);
    resultado.projetos++;
  }

  // 2. Labels → tags
  const labels = await td.listLabels();
  const mapaTags = new Map<string, string>();
  for (const l of labels) {
    const hex = todoistColorHex(l.color);
    const { data, error } = await admin
      .from('tags')
      .upsert(
        {
          usuario_id: usuarioId,
          todoist_id: l.id,
          nome: l.name,
          cor: hex,
        },
        { onConflict: 'usuario_id,todoist_id' },
      )
      .select('id')
      .single();
    if (error) {
      resultado.erros.push(`tag ${l.name}: ${error.message}`);
      continue;
    }
    mapaTags.set(l.name, (data as { id: string }).id);
    resultado.tags++;
  }

  // 3. Tarefas
  // Preload objetos pra scoring
  const { data: projRowsScoring } = await admin
    .from('projetos')
    .select('id, todoist_id, nome, cor, ordem_prioridade, multiplicador, ativo')
    .eq('usuario_id', usuarioId);

  const projetosPorTodoistId = new Map<string, Projeto>();
  for (const r of projRowsScoring ?? []) {
    if (!r.todoist_id) continue;
    projetosPorTodoistId.set(r.todoist_id, {
      id: r.id,
      todoistId: r.todoist_id,
      nome: r.nome,
      cor: r.cor,
      ordemPrioridade: r.ordem_prioridade,
      multiplicador: Number(r.multiplicador),
      ativo: r.ativo,
    });
  }

  const { data: tagRowsScoring } = await admin
    .from('tags')
    .select('id, nome, cor, tipo_peso, valor_peso, ativo')
    .eq('usuario_id', usuarioId);
  const tagsPorNome = new Map<string, Tag>();
  for (const r of tagRowsScoring ?? []) {
    tagsPorNome.set(r.nome, {
      id: r.id,
      nome: r.nome,
      cor: r.cor,
      tipoPeso: r.tipo_peso as Tag['tipoPeso'],
      valorPeso: Number(r.valor_peso),
      ativo: r.ativo,
    });
  }

  const { data: configRow } = await admin
    .from('configuracoes')
    .select('peso_urgencia, peso_importancia, peso_facilidade')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  const configuracoes: Configuracoes = {
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

  const tasks = await td.listTasks();

  // Conjunto de IDs de projeto selecionados (filtro opcional)
  const projetoIdSet = projetoIds && projetoIds.length > 0 ? new Set(projetoIds) : null;

  for (const t of tasks) {
    // Filtra por projeto se IDs foram passados
    if (projetoIdSet && !projetoIdSet.has(t.project_id)) {
      resultado.ignoradas++;
      continue;
    }
    if (t.checked || t.is_deleted) {
      resultado.ignoradas++;
      continue;
    }
    const projetoNome = projetoNomePorTodoistId.get(t.project_id) ?? null;
    const tipo = deriveTipo({ labels: t.labels, projetoNome });
    if (!tipo) {
      resultado.ignoradas++;
      continue;
    }

    // Verifica se tarefa já existe no TinDo
    const { data: existente } = await admin
      .from('tarefas')
      .select('id, status')
      .eq('usuario_id', usuarioId)
      .eq('todoist_id', t.id)
      .maybeSingle();

    // Se está 'concluida' ou 'excluida' localmente, preserva (não reverte).
    if (existente && (existente.status === 'concluida' || existente.status === 'excluida')) {
      resultado.preservadas++;
      continue;
    }

    const projeto = projetosPorTodoistId.get(t.project_id) ?? null;
    const tagsAplicadas = t.labels
      .map((n: string) => tagsPorNome.get(n))
      .filter((tg): tg is Tag => Boolean(tg));
    const nota = calcularNota(
      {
        tipo,
        prioridade: prioridadeTodoistParaTinDo(t.priority),
        dataVencimento: t.due?.date ?? null,
        prazoConclusao: t.deadline?.date ?? null,
        projeto,
        tags: tagsAplicadas,
      },
      configuracoes,
    );

    const dados = {
      usuario_id: usuarioId,
      todoist_id: t.id,
      tipo,
      titulo: t.content,
      descricao: t.description || null,
      projeto_id: mapaProj.get(t.project_id) ?? null,
      prioridade: prioridadeTodoistParaTinDo(t.priority),
      data_vencimento: t.due?.date ?? null,
      prazo_conclusao: t.deadline?.date ?? null,
      nota,
    };

    const { data: upserted, error } = await admin
      .from('tarefas')
      .upsert(existente ? { ...dados } : { ...dados, status: 'pendente' }, {
        onConflict: 'usuario_id,todoist_id',
      })
      .select('id')
      .single();
    if (error) {
      resultado.erros.push(`tarefa ${t.content.slice(0, 30)}: ${error.message}`);
      continue;
    }

    const ehNova = !existente;
    if (existente) resultado.tarefasAtualizadas++;
    else resultado.tarefasImportadas++;

    // fire-and-forget: loop IA (apenas tarefas novas, sem importancia/urgencia/facilidade)
    if (ehNova && upserted) {
      const tarefaId = (upserted as { id: string }).id;
      void autoClassificarSeHabilitado({ tarefaId, usuarioId });
    }

    // Reinstala tarefa_tags
    if (upserted) {
      const tarefaId = (upserted as { id: string }).id;
      await admin.from('tarefa_tags').delete().eq('tarefa_id', tarefaId);
      for (const label of t.labels) {
        const tagId = mapaTags.get(label);
        if (tagId) {
          await admin.from('tarefa_tags').insert({ tarefa_id: tarefaId, tag_id: tagId });
        }
      }
    }
  }

  await admin
    .from('configuracoes')
    .update({ todoist_ultimo_sync: new Date().toISOString() })
    .eq('usuario_id', usuarioId);

  return resultado;
}
