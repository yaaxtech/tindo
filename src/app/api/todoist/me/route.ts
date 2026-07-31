import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface TodoistUser {
  email: string;
  full_name: string;
  date_format: string;
  tz_info?: { timezone?: string };
}

export async function GET() {
  try {
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
      return NextResponse.json({ error: 'Token Todoist não configurado' }, { status: 401 });
    }

    const res = await fetch('https://api.todoist.com/api/v1/user', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Erro ao contatar Todoist: ${res.status} ${text}` },
        { status: 500 },
      );
    }

    const user = (await res.json()) as TodoistUser;
    return NextResponse.json({
      email: user.email,
      fullName: user.full_name,
      dateFormat: user.date_format,
      tz: user.tz_info?.timezone ?? null,
    });
  } catch (err) {
    console.error('/api/todoist/me error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
