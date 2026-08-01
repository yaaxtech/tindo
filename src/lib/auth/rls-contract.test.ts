// @vitest-environment node

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const TABELAS_DO_USUARIO = [
  'projetos',
  'tags',
  'tarefas',
  'tarefa_tags',
  'historico_acoes',
  'gamificacao',
  'conquistas_usuario',
  'calibracoes',
  'sugestoes_ai',
  'configuracoes',
  'espacos_trabalho',
  'push_subscriptions',
  'push_envios',
  'doc_linhas',
  'doc_espelhos',
  'perfis_usuario',
] as const;

function sqlDasMigrations(): string {
  const pasta = join(process.cwd(), 'supabase', 'migrations');
  return readdirSync(pasta)
    .filter((arquivo) => arquivo.endsWith('.sql'))
    .sort()
    .map((arquivo) => readFileSync(join(pasta, arquivo), 'utf8'))
    .join('\n')
    .toLowerCase();
}

describe('contrato RLS das tabelas do usuário', () => {
  const sql = sqlDasMigrations();

  it.each(TABELAS_DO_USUARIO)('mantém RLS habilitada em %s', (tabela) => {
    expect(sql).toMatch(
      new RegExp(`alter\\s+table\\s+public\\.${tabela}\\s+enable\\s+row\\s+level\\s+security`),
    );
  });

  it.each(TABELAS_DO_USUARIO)('mantém uma policy baseada em auth.uid() para %s', (tabela) => {
    expect(sql).toMatch(
      new RegExp(`create\\s+policy[^;]+on\\s+public\\.${tabela}[^;]+auth\\.uid\\(\\)[^;]*;`),
    );
  });
});
