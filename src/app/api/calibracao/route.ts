import { ErroValidacao } from '@/lib/api/erros';
import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { paraJson } from '@/lib/supabase/json';
import type { TablesUpdate } from '@/types/database';

export const dynamic = 'force-dynamic';

export const GET = rotaApi('GET /api/calibracao', async () => {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();

  const { data, error } = await admin
    .from('configuracoes')
    .select('criterios_sucesso, calibracao_inicial_concluida_em')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (error) throw error;

  return respostaOk({
    criteriosSucesso: (data?.criterios_sucesso as Record<string, unknown>) ?? {},
    concluidaEm: data?.calibracao_inicial_concluida_em ?? null,
  });
});

interface PostBody {
  criteriosSucesso: Record<string, unknown>;
}

export const POST = rotaApi('POST /api/calibracao', async (request: Request) => {
  const body = (await request.json()) as PostBody;

  if (!body.criteriosSucesso || typeof body.criteriosSucesso !== 'object') {
    throw new ErroValidacao('Campo criteriosSucesso é obrigatório e deve ser um objeto');
  }

  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();

  // Verifica se já tem data de conclusão para preservá-la (refazer reseta)
  const { data: atual } = await admin
    .from('configuracoes')
    .select('calibracao_inicial_concluida_em')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  const jaConcluidaEm = atual?.calibracao_inicial_concluida_em;

  const patch: TablesUpdate<'configuracoes'> = {
    criterios_sucesso: paraJson(body.criteriosSucesso),
  };

  // Carimba a data apenas se ainda não foi preenchida
  if (!jaConcluidaEm) {
    patch.calibracao_inicial_concluida_em = new Date().toISOString();
  }

  const { error } = await admin.from('configuracoes').update(patch).eq('usuario_id', usuarioId);

  if (error) throw error;

  return respostaOk({ ok: true });
});
