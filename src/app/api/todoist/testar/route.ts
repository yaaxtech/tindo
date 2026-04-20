import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface TestarBody {
  token?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TestarBody;
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json({ ok: false, erro: 'Token não informado' }, { status: 400 });
    }

    // Valida o token chamando a API do Todoist
    const res = await fetch('https://api.todoist.com/api/v1/user', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ ok: false, erro: 'Token inválido. Verifique e tente novamente.' });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { ok: false, erro: `Todoist retornou erro ${res.status}: ${text.slice(0, 100)}` },
        { status: 502 },
      );
    }

    const user = (await res.json()) as { email?: string; full_name?: string };

    // Persiste o token no banco para o usuário MVP
    try {
      const admin = getAdminClient();
      const usuarioId = await getUsuarioIdMVP();
      await admin
        .from('configuracoes')
        .update({ todoist_token: token })
        .eq('usuario_id', usuarioId);
    } catch (dbErr) {
      // Não falha o endpoint — apenas loga. Token pode ser via env.
      console.warn('[todoist/testar] Erro ao persistir token:', dbErr);
    }

    return NextResponse.json({
      ok: true,
      detalhe: user.email
        ? `Conectado como ${user.full_name ?? user.email}`
        : 'Token válido',
    });
  } catch (err) {
    console.error('/api/todoist/testar error:', err);
    return NextResponse.json(
      { ok: false, erro: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
