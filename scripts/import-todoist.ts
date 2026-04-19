#!/usr/bin/env bun
/**
 * Importa projetos, labels e tarefas do Todoist pro Supabase do TinDo.
 *
 * Pré-requisitos:
 *   - TODOIST_API_TOKEN em .env.local
 *   - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD em .env.local
 *   - Migrations já aplicadas (tindo_meta.migrations cheia)
 *
 * Estratégia:
 *   1. Cria (ou reusa) um usuário no auth.users com email conhecido.
 *   2. Importa projetos → public.projetos (upsert por todoist_id).
 *   3. Importa labels → public.tags (upsert por todoist_id).
 *   4. Importa tarefas com label "Lembretes"/"Todo" (incluindo aliases)
 *      → public.tarefas + public.tarefa_tags.
 *   5. Calcula nota 0-100 offline via scoring engine e persiste.
 *
 * Roda em lote, reportando progresso.
 */

import postgres from 'postgres';
import { CONFIG_PADRAO_PESOS, calcularNota } from '../src/lib/scoring/engine';
import { TodoistClient, type TodoistTask, todoistColorHex } from '../src/lib/todoist/client';
import { deriveTipo, prioridadeTodoistParaTinDo } from '../src/lib/todoist/mapper';
import type { Configuracoes, Projeto, Tag } from '../src/types/domain';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const TODOIST_TOKEN = process.env.TODOIST_API_TOKEN;
const EMAIL_USUARIO = 'falecomseucamarao@gmail.com';

if (!SUPABASE_URL || !DB_PASSWORD || !TODOIST_TOKEN) {
  console.error('❌ Faltam envs (SUPABASE_URL, SUPABASE_DB_PASSWORD, TODOIST_API_TOKEN).');
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0] as string;
const sql = postgres({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  username: 'postgres',
  password: DB_PASSWORD,
  ssl: 'require' as const,
});
const td = new TodoistClient(TODOIST_TOKEN);

async function garantirUsuario(email: string): Promise<string> {
  // Procura no auth.users
  const [existente] = await sql<{ id: string }[]>`
    SELECT id::text FROM auth.users WHERE email = ${email} LIMIT 1
  `;
  if (existente) {
    console.log(`👤 Usuário já existe: ${existente.id}`);
    return existente.id;
  }
  // Cria diretamente no auth.users (bypass signup pois não temos API access token)
  // Supabase sobe trigger on_auth_user_created que popula configs/gamificacao.
  const [novo] = await sql<{ id: string }[]>`
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      ${email},
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false
    )
    RETURNING id::text
  `;
  if (!novo) throw new Error('Falhou criar usuário');
  console.log(`👤 Usuário criado: ${novo.id}`);
  return novo.id;
}

async function importarProjetos(usuarioId: string): Promise<Map<string, string>> {
  const projetos = await td.listProjects();
  console.log(`📁 Importando ${projetos.length} projetos...`);
  const mapa = new Map<string, string>();
  for (const p of projetos) {
    const hex = todoistColorHex(p.color);
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO public.projetos (usuario_id, todoist_id, nome, cor, ordem_prioridade, multiplicador)
      VALUES (${usuarioId}::uuid, ${p.id}, ${p.name}, ${hex}, ${p.child_order}, 1.00)
      ON CONFLICT (usuario_id, todoist_id)
      DO UPDATE SET nome = EXCLUDED.nome, cor = EXCLUDED.cor, ordem_prioridade = EXCLUDED.ordem_prioridade
      RETURNING id::text
    `;
    if (row) mapa.set(p.id, row.id);
  }
  console.log(`   ✅ ${mapa.size} projetos sincronizados`);
  return mapa;
}

async function importarLabels(usuarioId: string): Promise<Map<string, string>> {
  const labels = await td.listLabels();
  console.log(`🏷  Importando ${labels.length} labels como tags...`);
  const mapa = new Map<string, string>();
  for (const l of labels) {
    const hex = todoistColorHex(l.color);
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO public.tags (usuario_id, todoist_id, nome, cor, tipo_peso, valor_peso)
      VALUES (${usuarioId}::uuid, ${l.id}, ${l.name}, ${hex}, 'multiplicador', 1.00)
      ON CONFLICT (usuario_id, todoist_id)
      DO UPDATE SET nome = EXCLUDED.nome, cor = EXCLUDED.cor
      RETURNING id::text
    `;
    if (row) mapa.set(l.name, row.id);
  }
  console.log(`   ✅ ${mapa.size} tags sincronizadas`);
  return mapa;
}

const configBase: Configuracoes = {
  usuarioId: '',
  pesos: CONFIG_PADRAO_PESOS,
  limiares: { reavaliacao: 30, descarte: 50, adiamento: 40 },
  audioHabilitado: true,
  animacoesHabilitadas: true,
  aiHabilitado: false,
  todoistSyncHabilitado: true,
};

function notaDe(
  task: TodoistTask,
  projetos: Map<string, Projeto>,
  tagsObj: Map<string, Tag>,
  tipo: 'tarefa' | 'lembrete',
): number {
  const proj = projetos.get(task.project_id) ?? null;
  const tagsAplicadas: Tag[] = task.labels
    .map((n) => tagsObj.get(n))
    .filter((t): t is Tag => Boolean(t));
  return calcularNota(
    {
      tipo,
      prioridade: prioridadeTodoistParaTinDo(task.priority),
      dataVencimento: task.due?.date ?? null,
      prazoConclusao: task.deadline?.date ?? null,
      projeto: proj,
      tags: tagsAplicadas,
    },
    configBase,
  );
}

async function importarTarefas(
  usuarioId: string,
  mapaProj: Map<string, string>,
  mapaTags: Map<string, string>,
) {
  const tasks = await td.listTasks();
  console.log(`\n📥 ${tasks.length} tarefas trazidas do Todoist`);

  // Preload projetos/tags como objetos em memória (pra scoring)
  const projetosRows = await sql<
    {
      id: string;
      todoist_id: string;
      nome: string;
      cor: string;
      ordem_prioridade: number;
      multiplicador: string;
    }[]
  >`
    SELECT id::text, todoist_id, nome, cor, ordem_prioridade, multiplicador::text FROM public.projetos WHERE usuario_id = ${usuarioId}::uuid
  `;
  const projetos = new Map<string, Projeto>();
  for (const r of projetosRows) {
    if (!r.todoist_id) continue;
    projetos.set(r.todoist_id, {
      id: r.id,
      nome: r.nome,
      cor: r.cor,
      ordemPrioridade: r.ordem_prioridade,
      multiplicador: Number(r.multiplicador),
      ativo: true,
      todoistId: r.todoist_id,
    });
  }
  const tagsRows = await sql<
    { id: string; nome: string; cor: string; tipo_peso: string; valor_peso: string }[]
  >`
    SELECT id::text, nome, cor, tipo_peso, valor_peso::text FROM public.tags WHERE usuario_id = ${usuarioId}::uuid
  `;
  const tagsObj = new Map<string, Tag>();
  for (const r of tagsRows) {
    tagsObj.set(r.nome, {
      id: r.id,
      nome: r.nome,
      cor: r.cor,
      tipoPeso: r.tipo_peso as Tag['tipoPeso'],
      valorPeso: Number(r.valor_peso),
      ativo: true,
    });
  }

  let importadas = 0;
  let ignoradas = 0;
  let semLabelFiltro = 0;
  let concluidasSkip = 0;
  const relacaoTags: { todoistTaskId: string; labelName: string }[] = [];

  // Map de projeto Todoist id → nome (para regra por projeto)
  const nomePorProjTodoistId = new Map<string, string>();
  for (const p of projetos.values()) {
    if (p.todoistId) nomePorProjTodoistId.set(p.todoistId, p.nome);
  }

  for (const t of tasks) {
    if (t.checked || t.is_deleted) {
      concluidasSkip++;
      continue;
    }
    const projetoNome = nomePorProjTodoistId.get(t.project_id) ?? null;
    const tipo = deriveTipo({ labels: t.labels, projetoNome });
    if (!tipo) {
      semLabelFiltro++;
      ignoradas++;
      continue;
    }

    const projetoId = mapaProj.get(t.project_id) ?? null;
    const nota = notaDe(t, projetos, tagsObj, tipo);
    const prioridade = prioridadeTodoistParaTinDo(t.priority);

    const [row] = await sql<{ id: string }[]>`
      INSERT INTO public.tarefas (
        usuario_id, todoist_id, tipo, titulo, descricao, projeto_id, prioridade,
        data_vencimento, prazo_conclusao, nota, status
      ) VALUES (
        ${usuarioId}::uuid,
        ${t.id},
        ${tipo},
        ${t.content},
        ${t.description || null},
        ${projetoId},
        ${prioridade},
        ${t.due?.date ?? null},
        ${t.deadline?.date ?? null},
        ${nota},
        'pendente'
      )
      ON CONFLICT (usuario_id, todoist_id)
      DO UPDATE SET
        titulo = EXCLUDED.titulo,
        descricao = EXCLUDED.descricao,
        projeto_id = EXCLUDED.projeto_id,
        prioridade = EXCLUDED.prioridade,
        data_vencimento = EXCLUDED.data_vencimento,
        prazo_conclusao = EXCLUDED.prazo_conclusao,
        nota = EXCLUDED.nota,
        status = EXCLUDED.status
      RETURNING id::text
    `;
    if (!row) continue;

    // Limpa e reinsere tarefa_tags
    await sql`DELETE FROM public.tarefa_tags WHERE tarefa_id = ${row.id}::uuid`;
    for (const label of t.labels) {
      const tagId = mapaTags.get(label);
      if (tagId) {
        await sql`
          INSERT INTO public.tarefa_tags (tarefa_id, tag_id) VALUES (${row.id}::uuid, ${tagId}::uuid)
          ON CONFLICT DO NOTHING
        `;
      }
    }
    importadas++;
    if (importadas % 50 === 0) console.log(`   … ${importadas} importadas`);
  }

  console.log(`\n📊 Resultado:`);
  console.log(`   · ${importadas} tarefas importadas`);
  console.log(`   · ${concluidasSkip} concluídas puladas`);
  console.log(`   · ${semLabelFiltro} sem label Lembretes/Todo puladas`);
  console.log(`   · ${ignoradas} ignoradas no total`);
}

async function atualizarUltimoSync(usuarioId: string) {
  await sql`
    UPDATE public.configuracoes SET todoist_ultimo_sync = now(), todoist_sync_habilitado = true
    WHERE usuario_id = ${usuarioId}::uuid
  `;
}

try {
  console.log('🔐 Verificando usuário no auth...');
  const usuarioId = await garantirUsuario(EMAIL_USUARIO);

  const mapaProj = await importarProjetos(usuarioId);
  const mapaTags = await importarLabels(usuarioId);
  await importarTarefas(usuarioId, mapaProj, mapaTags);
  await atualizarUltimoSync(usuarioId);

  console.log('\n✅ Import Todoist → TinDo completo.');
} catch (err) {
  console.error('\n❌ Erro no import:', err);
  process.exit(1);
} finally {
  await sql.end();
}
