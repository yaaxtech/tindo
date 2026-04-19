#!/usr/bin/env bun
/**
 * Reseta o schema public (dropa TUDO) e reaplica migrations.
 *
 * ⚠️ DESTRUTIVO — roda apenas se APLICADO_EM vazio ou projeto sandbox.
 * ⚠️ NUNCA rodar em produção com dados reais.
 *
 * Uso:
 *   CONFIRM=yes bun scripts/reset-and-apply.ts
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import postgres from 'postgres';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const CONFIRM = process.env.CONFIRM;

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error('❌ Faltam envs.');
  process.exit(1);
}
if (CONFIRM !== 'yes') {
  console.error('❌ Este script é destrutivo. Rode com CONFIRM=yes.');
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0] as string;
const MIGRATIONS_DIR = join(import.meta.dir, '..', 'supabase', 'migrations');
const SEED_FILE = join(import.meta.dir, '..', 'supabase', 'seed.sql');

const sql = postgres({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  username: 'postgres',
  password: DB_PASSWORD,
  ssl: 'require' as const,
});

try {
  console.log('🗑  Dropando tabelas e views do schema public...');

  // Dropa views primeiro, depois tabelas
  const views = await sql<{ viewname: string }[]>`
    SELECT viewname::text FROM pg_views WHERE schemaname = 'public'
  `;
  for (const v of views) {
    await sql.unsafe(`DROP VIEW IF EXISTS public."${v.viewname}" CASCADE`);
    console.log(`   - view ${v.viewname}`);
  }

  const matviews = await sql<{ matviewname: string }[]>`
    SELECT matviewname::text FROM pg_matviews WHERE schemaname = 'public'
  `;
  for (const mv of matviews) {
    await sql.unsafe(`DROP MATERIALIZED VIEW IF EXISTS public."${mv.matviewname}" CASCADE`);
    console.log(`   - matview ${mv.matviewname}`);
  }

  const tables = await sql<{ tablename: string }[]>`
    SELECT tablename::text FROM pg_tables WHERE schemaname = 'public'
  `;
  for (const t of tables) {
    await sql.unsafe(`DROP TABLE IF EXISTS public."${t.tablename}" CASCADE`);
    console.log(`   - table ${t.tablename}`);
  }

  // Dropa triggers de auth.users que podem ter sido criados em runs anteriores
  await sql.unsafe(`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users`);
  // Dropa nosso schema de meta também, para começar limpo
  await sql.unsafe(`DROP SCHEMA IF EXISTS tindo_meta CASCADE`);

  console.log('✅ Schema limpo.');

  // Recria tindo_meta.migrations
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS tindo_meta;
    CREATE TABLE IF NOT EXISTS tindo_meta.migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Aplica todas as migrations
  const arquivos = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  console.log(`\n📂 ${arquivos.length} migrations a aplicar`);
  for (const arquivo of arquivos) {
    const conteudo = await readFile(join(MIGRATIONS_DIR, arquivo), 'utf8');
    console.log(`   ⚙  ${arquivo} …`);
    await sql.unsafe(conteudo);
    await sql`INSERT INTO tindo_meta.migrations (filename) VALUES (${arquivo})`;
    console.log(`   ✅ ${arquivo}`);
  }

  console.log('\n🌱 Aplicando seed.sql …');
  const seed = await readFile(SEED_FILE, 'utf8');
  await sql.unsafe(seed);
  console.log('✅ Seed aplicado');

  console.log('\n🎉 Schema TinDo está em produção.');
} catch (err) {
  console.error('\n❌ Erro:', err);
  process.exit(1);
} finally {
  await sql.end();
}
