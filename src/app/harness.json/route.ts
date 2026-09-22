import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Snapshot cru (v2) para IAs e scripts. Leitura pública, igual à página /harness.
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('harness_snapshot')
    .select('dados')
    .eq('id', 'singleton')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ erro: 'falha ao ler o snapshot' }, { status: 502 });
  }
  if (!data) return NextResponse.json({ erro: 'sem snapshot publicado' }, { status: 404 });
  return NextResponse.json(data.dados, { headers: { 'cache-control': 'public, max-age=300' } });
}
