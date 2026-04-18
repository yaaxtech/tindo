#!/usr/bin/env bun
import postgres from 'postgres';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD!;
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0] as string;

const sql = postgres({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  username: 'postgres',
  password: DB_PASSWORD,
  ssl: 'require' as const,
});

try {
  const tags = await sql<{ nome: string; cor: string }[]>`
    SELECT nome::text, cor::text FROM public.tags ORDER BY nome
  `;
  console.log('TAGS (labels importadas do Todoist):');
  for (const t of tags) console.log(`  · ${t.nome}  [${t.cor}]`);
  console.log(`  total: ${tags.length}\n`);

  const projetos = await sql<{ nome: string; cor: string }[]>`
    SELECT nome::text, cor::text FROM public.projetos ORDER BY nome
  `;
  console.log('PROJETOS:');
  for (const p of projetos) console.log(`  · ${p.nome}  [${p.cor}]`);
  console.log(`  total: ${projetos.length}`);
} finally {
  await sql.end();
}
