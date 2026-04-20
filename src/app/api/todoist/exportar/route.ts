import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { criarTodoistProject, criarTodoistTask } from '@/lib/todoist/client';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ExportBody {
  tarefaIds: string[];
  criarProjetosFaltantes: boolean;
}

interface TarefaRow {
  id: string;
  titulo: string;
  tipo: string;
  descricao: string | null;
  prioridade: number;
  data_vencimento: string | null;
  projeto_id: string | null;
  projetos: {
    id: string;
    nome: string;
    todoist_id: string | null;
  } | null;
  tarefas_tags: Array<{
    tags: { nome: string } | null;
  }>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function tentarComRetry<T>(fn: () => Promise<T>, tentativas = 3): Promise<T> {
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes('429');
      if (isRateLimit && i < tentativas - 1) {
        await sleep(2 ** i * 1000); // 1s, 2s, 4s
        continue;
      }
      throw err;
    }
  }
  throw new Error('Máximo de tentativas atingido');
}

export async function POST(request: NextRequest) {
  const inicio = Date.now();
  try {
    const body = (await request.json()) as ExportBody;
    const { tarefaIds, criarProjetosFaltantes } = body;

    if (!Array.isArray(tarefaIds) || tarefaIds.length === 0) {
      return NextResponse.json({ error: 'tarefaIds obrigatório' }, { status: 400 });
    }

    // Limita a 500 por requisição
    const ids = tarefaIds.slice(0, 500);

    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    // Lê token
    const { data: cfg } = await admin
      .from('configuracoes')
      .select('todoist_token')
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    const token = (cfg?.todoist_token as string | null) ?? process.env.TODOIST_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Token Todoist não configurado' }, { status: 401 });
    }

    // Busca tarefas com projetos e tags
    const { data: tarefas, error: tarefasErr } = await admin
      .from('tarefas')
      .select(
        'id, titulo, tipo, descricao, prioridade, data_vencimento, projeto_id, projetos(id, nome, todoist_id), tarefas_tags(tags(nome))',
      )
      .eq('usuario_id', usuarioId)
      .in('id', ids)
      .is('todoist_id', null);

    if (tarefasErr) {
      return NextResponse.json({ error: tarefasErr.message }, { status: 500 });
    }

    const erros: Array<{ tarefaId: string; mensagem: string }> = [];
    let tarefasExportadas = 0;
    let projetosCriados = 0;

    // Cache de projetos criados nesta execução (evita criar duplicatas)
    const projetosTodoistIdCache = new Map<string, string>();

    for (const tarefa of (tarefas as unknown as TarefaRow[]) ?? []) {
      try {
        let projectId: string | undefined;

        if (tarefa.projetos) {
          if (tarefa.projetos.todoist_id) {
            projectId = tarefa.projetos.todoist_id;
          } else if (criarProjetosFaltantes) {
            // Verifica cache local primeiro
            if (projetosTodoistIdCache.has(tarefa.projetos.id)) {
              projectId = projetosTodoistIdCache.get(tarefa.projetos.id);
            } else {
              // Cria projeto no Todoist
              const proj = await tentarComRetry(() =>
                criarTodoistProject(token, { name: tarefa.projetos!.nome }),
              );
              // Atualiza no banco
              await admin
                .from('projetos')
                .update({ todoist_id: proj.id })
                .eq('id', tarefa.projetos!.id);
              projetosTodoistIdCache.set(tarefa.projetos.id, proj.id);
              projectId = proj.id;
              projetosCriados++;
            }
          }
        }

        // Monta labels (nomes das tags)
        const labels = (tarefa.tarefas_tags ?? [])
          .map((tt) => tt.tags?.nome)
          .filter((n): n is string => Boolean(n));

        // Converte prioridade: TinDo 1=urgente → Todoist 4=urgente
        const priority = Math.max(1, Math.min(4, 5 - (tarefa.prioridade ?? 2))) as 1 | 2 | 3 | 4;

        const created = await tentarComRetry(() =>
          criarTodoistTask(token, {
            content: tarefa.titulo,
            description: tarefa.descricao ?? undefined,
            project_id: projectId,
            due_date: tarefa.data_vencimento ?? undefined,
            priority,
            labels: labels.length > 0 ? labels : undefined,
          }),
        );

        // Salva todoist_id na tarefa
        await admin
          .from('tarefas')
          .update({ todoist_id: created.id })
          .eq('id', tarefa.id);

        // Registra em historico_acoes
        await admin.from('historico_acoes').insert({
          usuario_id: usuarioId,
          tarefa_id: tarefa.id,
          acao: 'editada',
          dados: { origem: 'exportacao_manual', todoist_id: created.id },
        });

        tarefasExportadas++;

        // Throttle: ~5 req/s (200ms entre requests)
        await sleep(200);
      } catch (err) {
        erros.push({
          tarefaId: tarefa.id,
          mensagem: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      tarefasExportadas,
      projetosCriados,
      erros,
      duracaoMs: Date.now() - inicio,
    });
  } catch (err) {
    console.error('/api/todoist/exportar error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
