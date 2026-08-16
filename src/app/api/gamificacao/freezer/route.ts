import { ErroValidacao } from '@/lib/api/erros';
import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { comprarFreezerAdmin } from '@/services/gamificacao';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

interface Payload {
  acao: 'comprar';
}

export const POST = rotaApi('POST /api/gamificacao/freezer', async (request: NextRequest) => {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const body = (await request.json()) as Payload;

  if (body.acao !== 'comprar') {
    throw new ErroValidacao('Ação inválida.');
  }

  const resultado = await comprarFreezerAdmin(admin, usuarioId);

  if (!resultado.ok) {
    // `erro` é opcional no service; sem ele o cliente caía no texto de fallback.
    throw new ErroValidacao(resultado.erro ?? 'Não foi possível comprar o freezer.');
  }

  return respostaOk({
    ok: true,
    freezersDisponiveis: resultado.freezersDisponiveis,
    xpRestante: resultado.xpRestante,
  });
});
