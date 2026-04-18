#!/usr/bin/env bun
/**
 * Lista tabelas, views e constraints existentes no schema public.
 */

import postgres from 'postgres';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error('❌ Faltam envs.');
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

const sql = postgres({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  username: 'postgres',
  password: DB_PASSWORD,
  ssl: 'require' as const,
});

try {
  console.log('\n📊 TABELAS em public:');
  const tables = await sql<{ tablename: string; rowcount: number | null }[]>`
    SELECT tablename::text, null::int AS rowcount
    FROM pg_tables WHERE schemaname = 'public'
    ORDER BY tablename;
  `;
  for (const t of tables) console.log(`   · ${t.tablename}`);
  console.log(`   total: ${tables.length}`);

  console.log('\n👁 VIEWS em public:');
  const views = await sql<{ viewname: string }[]>`
    SELECT viewname::text FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;
  `;
  for (const v of views) console.log(`   · ${v.viewname}`);

  console.log('\n🔧 MIGRATIONS aplicadas (tindo_meta):');
  try {
    const mig = await sql<{ filename: string; applied_at: Date }[]>`
      SELECT filename::text, applied_at FROM tindo_meta.migrations ORDER BY filename;
    `;
    for (const m of mig) console.log(`   · ${m.filename} @ ${m.applied_at.toISOString()}`);
  } catch {
    console.log('   (tabela ainda não existe)');
  }

  console.log('\n');
} finally {
  await sql.end();
}
