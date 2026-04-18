#!/usr/bin/env bun
/**
 * Aplica migrations em ordem contra o Supabase de produção.
 *
 * Usa env vars:
 *   NEXT_PUBLIC_SUPABASE_URL  → deriva o host do banco
 *   SUPABASE_DB_PASSWORD      → senha do role postgres
 *
 * Uso:
 *   bun scripts/apply-migrations.ts
 */

import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_DB_PASSWORD em .env.local');
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
if (!projectRef) {
  console.error('❌ Não consegui derivar project ref de', SUPABASE_URL);
  process.exit(1);
}

const MIGRATIONS_DIR = join(import.meta.dir, '..', 'supabase', 'migrations');
const SEED_FILE = join(import.meta.dir, '..', 'supabase', 'seed.sql');

const connectionOptions = {
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  username: 'postgres',
  password: DB_PASSWORD,
  ssl: 'require' as const,
  connect_timeout: 30,
};

async function main() {
  console.log(`🔌 Conectando em db.${projectRef}.supabase.co ...`);
  const sql = postgres(connectionOptions);

  try {
    // Cria tabela de tracking de migrations se não existir
    await sql`
      CREATE SCHEMA IF NOT EXISTS tindo_meta;
      CREATE TABLE IF NOT EXISTS tindo_meta.migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `.simple();

    const arquivos = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    console.log(`📂 ${arquivos.length} migrations encontradas`);

    for (const arquivo of arquivos) {
      const [aplicada] = await sql`
        SELECT 1 FROM tindo_meta.migrations WHERE filename = ${arquivo} LIMIT 1;
      `;
      if (aplicada) {
        console.log(`   ⏭  ${arquivo} (já aplicada)`);
        continue;
      }
      const conteudo = await readFile(join(MIGRATIONS_DIR, arquivo), 'utf8');
      console.log(`   ⚙  ${arquivo} …`);
      await sql.unsafe(conteudo).simple();
      await sql`INSERT INTO tindo_meta.migrations (filename) VALUES (${arquivo})`;
      console.log(`   ✅ ${arquivo}`);
    }

    // Aplica seed (idempotente via ON CONFLICT)
    console.log('🌱 Aplicando seed.sql …');
    const seed = await readFile(SEED_FILE, 'utf8');
    await sql.unsafe(seed).simple();
    console.log('✅ Seed aplicado');

    console.log('\n🎉 Todas as migrations e seed aplicados com sucesso.');
  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

void main();
