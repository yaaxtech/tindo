#!/usr/bin/env node
// Narrow repair: never applies unrelated migrations or touches user tables.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
const mode = process.argv[2];
if (!['--check', '--dry-run', '--apply'].includes(mode))
  throw new Error('Use --check, --dry-run ou --apply');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = process.env.HARNESS_ENV_FILE || resolve(root, '.env.local');
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]),
);
const project = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
if (project !== 'jtpfauouvbtmhgrszybk')
  throw new Error('Projeto diferente do TinDo; reparação cancelada');
const sql = postgres({
  host: `db.${project}.supabase.co`,
  port: 5432,
  database: 'postgres',
  username: 'postgres',
  password: env.SUPABASE_DB_PASSWORD,
  ssl: 'require',
  connect_timeout: 10,
});
const filename = '20260813000005_harness_actions_snapshot.sql';
const migration = readFileSync(resolve(root, 'supabase/migrations', filename), 'utf8');
const rollback = new Error('dry-run rollback');
try {
  const [before] = await sql`select to_regclass('public.harness_actions_snapshot') as tabela`;
  console.log(JSON.stringify({ mode, antes: before }));
  if (mode !== '--check') {
    if (before.tabela)
      throw new Error('Tabela já existe; não reaplicar reparação sem inspecionar estado');
    try {
      await sql.begin(async (tx) => {
        await tx`set local lock_timeout = '5s'`;
        await tx`set local statement_timeout = '30s'`;
        await tx.unsafe(migration).simple();
        const [table] =
          await tx`select relrowsecurity as rls from pg_class where oid = 'public.harness_actions_snapshot'::regclass`;
        const policies =
          await tx`select cmd,roles,qual from pg_policies where schemaname='public' and tablename='harness_actions_snapshot'`;
        if (!table.rls || policies.length !== 1 || policies[0].cmd !== 'SELECT')
          throw new Error('Contrato RLS inválido');
        const [acl] =
          await tx`select has_table_privilege('anon','public.harness_actions_snapshot','SELECT') as anon_read, has_table_privilege('anon','public.harness_actions_snapshot','INSERT') as anon_write, has_table_privilege('authenticated','public.harness_actions_snapshot','INSERT') as auth_write,has_table_privilege('service_role','public.harness_actions_snapshot','INSERT') as service_write`;
        if (!acl.anon_read || acl.anon_write || acl.auth_write || !acl.service_write)
          throw new Error('Privilégios inesperados');
        await tx`insert into public.harness_actions_snapshot (id,dados) values ('singleton','{}'::jsonb)`;
        await tx`set local role anon`;
        const rows = await tx`select id from public.harness_actions_snapshot`;
        if (rows.length !== 1) throw new Error('Leitura pública falhou');
        await tx`reset role`;
        await tx`delete from public.harness_actions_snapshot where id='singleton'`;
        if (mode === '--dry-run') {
          console.log(
            JSON.stringify({
              validado: { rls: table.rls, policies, acl, leitura_publica: true },
              rollback: true,
            }),
          );
          throw rollback;
        }
        await tx`insert into tindo_meta.migrations (filename) values (${filename}) on conflict (filename) do nothing`;
        await tx`notify pgrst, 'reload schema'`;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    console.log(
      JSON.stringify({
        depois: await sql`select to_regclass('public.harness_actions_snapshot') as tabela`,
      }),
    );
  }
} finally {
  await sql.end({ timeout: 2 });
}
