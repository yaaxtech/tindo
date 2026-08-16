import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export const POST = rotaApi('POST /api/todoist/desconectar', async () => {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();

  // Limpa token e desativa toggles
  const { error } = await admin
    .from('configuracoes')
    .update({
      todoist_token: null,
      todoist_sync_habilitado: false,
      todoist_writeback_habilitado: false,
    })
    .eq('usuario_id', usuarioId);

  if (error) {
    // Erro de banco: o kernel loga o detalhe e devolve mensagem genérica.
    throw error;
  }

  // Log em historico_acoes (migration 20260813000003: `tarefa_id` aceita NULL e existe
  // o valor 'sistema'). Não usa 'editada' porque isso contaria como reavaliação humana
  // na taxaReavaliacao (RN-07) — desconectar o Todoist não é editar tarefa nenhuma.
  const { error: erroLog } = await admin.from('historico_acoes').insert({
    usuario_id: usuarioId,
    tarefa_id: null,
    acao: 'sistema',
    dados: { origem: 'todoist_desconectado' },
  });
  // O supabase-js devolve `{ error }` em vez de lançar — o try/catch sozinho não via nada.
  if (erroLog) {
    console.error('/api/todoist/desconectar: falha ao registrar historico_acoes', erroLog);
  }

  return respostaOk({ ok: true });
});
