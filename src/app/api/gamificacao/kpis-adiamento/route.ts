import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { calcularKpisAdiamento } from '@/services/kpis-adiamento';

export const dynamic = 'force-dynamic';

/**
 * Retorna os 5 KPIs de adiamento espaçado (TRA/TCA/TEX/MAC/SAE).
 * Query param: ?janela=7|30|90 (default 30).
 */
export const GET = rotaApi('GET /api/gamificacao/kpis-adiamento', async (req: Request) => {
  const url = new URL(req.url);
  const janelaParam = Number(url.searchParams.get('janela') ?? 30);
  const janelaDias = [7, 30, 90].includes(janelaParam) ? janelaParam : 30;

  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();

  const kpis = await calcularKpisAdiamento(admin, usuarioId, janelaDias);
  return respostaOk(kpis);
});
