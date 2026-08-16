import { ErroNaoAutenticado, ErroServicoExterno } from '@/lib/api/erros';
import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface TodoistUser {
  email: string;
  full_name: string;
  date_format: string;
  tz_info?: { timezone?: string };
}

export const GET = rotaApi('GET /api/todoist/me', async () => {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();

  // Lê token do banco ou cai no env (single-user MVP)
  const { data: cfg } = await admin
    .from('configuracoes')
    .select('todoist_token')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  const token = (cfg?.todoist_token as string | null) ?? process.env.TODOIST_API_TOKEN;
  if (!token) {
    throw new ErroNaoAutenticado('Token Todoist não configurado');
  }

  const res = await fetch('https://api.todoist.com/api/v1/user', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (res.status === 401 || res.status === 403) {
    throw new ErroNaoAutenticado('Token inválido ou expirado');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ErroServicoExterno('Não foi possível falar com o Todoist agora.', {
      cause: new Error(`Todoist ${res.status}: ${text}`),
    });
  }

  const user = (await res.json()) as TodoistUser;
  return respostaOk({
    email: user.email,
    fullName: user.full_name,
    dateFormat: user.date_format,
    tz: user.tz_info?.timezone ?? null,
  });
});
