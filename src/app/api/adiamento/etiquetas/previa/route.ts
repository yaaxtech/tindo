import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { previaAdiamentoPorEtiqueta } from '@/services/adiamento-etiquetas';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Só leitura: mostra para quando cada item com @tarde/@noite/@amanha/@adiar iria. */
export const GET = rotaApi('GET /api/adiamento/etiquetas/previa', async () => {
  const itens = await previaAdiamentoPorEtiqueta();
  return respostaOk({ itens });
});
