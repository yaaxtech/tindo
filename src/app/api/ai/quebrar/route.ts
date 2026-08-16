import { ErroNaoEncontrado, ErroValidacao } from '@/lib/api/erros';
import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { paraJson } from '@/lib/supabase/json';
import { quebrarTarefa } from '@/services/ai';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface PostBody {
  tarefaId: string;
}

export const POST = rotaApi('POST /api/ai/quebrar', async (request: NextRequest) => {
  const body = (await request.json()) as PostBody;

  if (!body.tarefaId) {
    throw new ErroValidacao('tarefaId é obrigatório.');
  }

  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();

  // Busca tarefa verificando usuário e soft-delete
  const { data: tarefa, error: tarefaErr } = await admin
    .from('tarefas')
    .select('id, titulo, descricao, projeto_id')
    .eq('id', body.tarefaId)
    .eq('usuario_id', usuarioId)
    .is('deleted_at', null)
    .single();

  if (tarefaErr || !tarefa) {
    throw new ErroNaoEncontrado('Tarefa não encontrada.');
  }

  // Busca nome do projeto se existir
  let projetoNome: string | null = null;
  if (tarefa.projeto_id) {
    const { data: proj } = await admin
      .from('projetos')
      .select('nome')
      .eq('id', tarefa.projeto_id)
      .single();
    projetoNome = (proj?.nome as string | null) ?? null;
  }

  // Busca configurações de IA
  const { data: cfg } = await admin
    .from('configuracoes')
    .select('ai_api_key_criptografada, ai_modelo')
    .eq('usuario_id', usuarioId)
    .single();

  const apiKey =
    (cfg?.ai_api_key_criptografada as string | null) ?? process.env.ANTHROPIC_API_KEY ?? undefined;
  const modelo = (cfg?.ai_modelo as string | null) ?? 'claude-sonnet-4-6';

  const resultado = await quebrarTarefa({
    titulo: tarefa.titulo as string,
    descricao: tarefa.descricao as string | null,
    projeto: projetoNome,
    apiKey,
    modelo,
  });

  // Grava em sugestoes_ai
  const { data: sugestao, error: sugestaoErr } = await admin
    .from('sugestoes_ai')
    .insert({
      usuario_id: usuarioId,
      tarefa_id: body.tarefaId,
      tipo: 'quebrar',
      status: 'pendente',
      payload: paraJson(resultado),
    })
    .select('id')
    .single();

  if (sugestaoErr) {
    console.error('/api/ai/quebrar — erro ao gravar sugestao_ai:', sugestaoErr);
  }

  return respostaOk({
    sugestaoId: sugestao?.id ?? null,
    resultado,
  });
});
