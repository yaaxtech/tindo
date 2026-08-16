import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getUsuarioIdMVP } from '@/lib/supabase/admin';
import { enviarPush } from '@/services/push';

export const dynamic = 'force-dynamic';

export const POST = rotaApi('POST /api/push/testar', async () => {
  const usuarioId = await getUsuarioIdMVP();
  const resultado = await enviarPush(usuarioId, 'teste', {
    titulo: 'TinDo — teste',
    corpo: 'Se você viu isso, push esta funcionando.',
    url: '/cards',
    tag: 'teste-push',
  });
  return respostaOk({ ok: true, ...resultado });
});
