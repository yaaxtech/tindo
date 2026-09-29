import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { gerarPreviaTriagem } from '@/services/triagem';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Só leitura: mostra o que a triagem faria na Entrada, sem gravar nada no Todoist. */
export const GET = rotaApi('GET /api/triagem/previa', async (request: Request) => {
  const limite = Number(new URL(request.url).searchParams.get('limite') ?? 10);
  const previa = await gerarPreviaTriagem(Math.min(Math.max(1, limite || 10), 20));
  return respostaOk(previa);
});
