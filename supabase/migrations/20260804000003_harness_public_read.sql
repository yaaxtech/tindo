-- O Painel do Harness e seus dados operacionais são públicos.
-- A escrita continua exclusiva da service_role; visitantes só podem ler.
drop policy if exists harness_snapshot_read on public.harness_snapshot;
create policy harness_snapshot_read on public.harness_snapshot
  for select to anon, authenticated using (true);
