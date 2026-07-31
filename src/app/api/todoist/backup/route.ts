import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Campos sensíveis a excluir da tabela configuracoes
const CAMPOS_SENSIVEIS = [
  'todoist_token',
  'ai_api_key_criptografada',
  'push_subscription_json',
] as const;

export async function GET() {
  try {
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    const [tarefasRes, projetosRes, tagsRes, cfgRes] = await Promise.all([
      admin
        .from('tarefas')
        .select('*, tarefas_tags(tags(id, nome, cor, tipo_peso, valor_peso))')
        .eq('usuario_id', usuarioId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      admin.from('projetos').select('*').eq('usuario_id', usuarioId),
      admin.from('tags').select('*').eq('usuario_id', usuarioId),
      admin.from('configuracoes').select('*').eq('usuario_id', usuarioId).maybeSingle(),
    ]);

    // Sanitiza configurações: remove campos sensíveis
    const cfgSanitizada: Record<string, unknown> = {};
    if (cfgRes.data) {
      for (const [k, v] of Object.entries(cfgRes.data as Record<string, unknown>)) {
        if (!(CAMPOS_SENSIVEIS as readonly string[]).includes(k)) {
          cfgSanitizada[k] = v;
        }
      }
    }

    const payload = {
      versao: 1,
      exportadoEm: new Date().toISOString(),
      usuario: { id: usuarioId },
      tarefas: tarefasRes.data ?? [],
      projetos: projetosRes.data ?? [],
      tags: tagsRes.data ?? [],
      configuracoes: cfgSanitizada,
    };

    const json = JSON.stringify(payload, null, 2);
    const hoje = new Date().toISOString().slice(0, 10);

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="tindo-backup-${hoje}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('/api/todoist/backup error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
