-- Minutos do GitHub Actions para o Painel do Harness.
--
-- POR QUE UM SNAPSHOT AGREGADO, E NÃO JOBS CRUS
-- O minuto que o GitHub FATURA é o tempo de JOB, não o da run: em 12/08 medir
-- (updated_at - created_at) da run deu 8.334 min contra 2.001 reais, porque
-- fila e cancelamento entravam na conta. Job só se obtém em /runs/{id}/jobs —
-- uma requisição POR RUN. Com ~50 runs/dia isso é caro demais para o cron do
-- app e ainda encosta no rate limit.
--
-- Por isso a coleta roda FORA daqui: ~/.claude/orquestracao/coletar-actions.mjs,
-- na máquina do dono, de hora em hora pelo mesmo launchd que já publica o
-- painel. Lá o `gh` já está autenticado — inclusive no repo PRIVADO
-- seucamarao/seucamaraov1, que é justamente quem queima a cota. Nenhum segredo
-- novo precisa existir no Cloudflare.
--
-- O blob chega AGREGADO POR DIA (não job a job) por dois motivos: o PostgREST
-- trunca em 1000 linhas e 90 dias de jobs passam de 9.000; e o valor aqui é
-- comparar mês com mês, não fazer forense de job. O agregado diário é também o
-- histórico que o GitHub descarta depois de ~90 dias — é o único lugar onde
-- ele sobrevive.
--
-- Convenções que NÃO se aplicam (dado de orquestração, não de usuário):
--   * sem usuario_id — mesmo caso de harness_snapshot (20260804000001);
--   * PK é o id fixo 'singleton' — o coletor faz upsert, nunca acumula linha;
--   * sem deleted_at — não há exclusão nesta tabela.
--
-- PRIVACIDADE: /harness é PÚBLICA (leitura anon, ver 20260804000003). O blob
-- guarda nome de branch, de workflow e de step — todos config de repositório.
-- NUNCA título de PR, mensagem de commit ou qualquer texto escrito por pessoa.
create table if not exists public.harness_actions_snapshot (
  id         text primary key default 'singleton'
             constraint harness_actions_snapshot_singleton
             check (id = 'singleton'),
  -- Contrato do blob: src/types/harness.ts (ActionsBlob). jsonb livre de
  -- propósito — o formato é do coletor, e a tela deriva os KPIs numa lib pura.
  dados      jsonb not null,
  gerado_em  timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.harness_actions_snapshot enable row level security;

-- Leitura pública (o painel é público). Escrita: só service_role, que ignora
-- RLS — nenhuma policy de INSERT/UPDATE/DELETE é criada de propósito.
drop policy if exists harness_actions_snapshot_read on public.harness_actions_snapshot;
create policy harness_actions_snapshot_read on public.harness_actions_snapshot
  for select to anon, authenticated using (true);
