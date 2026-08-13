-- Revisor de KPIs do Painel do Harness: guarda CADA avaliação e as violações
-- de limiar que ela encontrou.
--
-- Duas tabelas de propósito (cabeçalho + itens):
--   harness_avaliacoes  uma linha por avaliação, mesmo quando NADA violou —
--                       é dela que sai o "quando foi a última vez", que
--                       governa a cadência de 14 dias. Se só gravássemos
--                       violações, uma avaliação limpa não deixaria rastro e
--                       o cron reavaliaria todo dia.
--   harness_alertas     uma linha por limiar violado naquela avaliação. É a
--                       contagem por `codigo` que separa sinal de ruído: um
--                       limiar que dispara em toda avaliação é barulho, não
--                       alerta.
--
-- Convenções que NÃO se aplicam aqui (dado de orquestração, não de usuário):
--   * sem usuario_id — mesmo caso de harness_snapshot (20260804000001) e de
--     harness_github_runs (20260813000001);
--   * sem deleted_at — histórico de medição não se edita nem se exclui.
--
-- PRIVACIDADE: /harness é PÚBLICA (leitura anon, ver 20260804000003). Por isso
-- não existe NENHUMA coluna de texto livre aqui: o que disparou é um `codigo`
-- de lista fechada, e a frase em português vive no código da tela.
create table if not exists public.harness_avaliacoes (
  id           uuid primary key default gen_random_uuid(),
  avaliado_em  timestamptz not null default now(),
  -- periodico     = ciclo de 14 dias
  -- pre_renovacao = 3 dias antes da data de renovação de uma assinatura
  motivo       varchar(20) not null
               constraint harness_avaliacoes_motivo_check
               check (motivo in ('periodico', 'pre_renovacao')),
  janela_dias  integer not null,
  violacoes_n  integer not null default 0
);

-- A pergunta quente é sempre "qual foi a última avaliação".
create index if not exists harness_avaliacoes_avaliado_idx
  on public.harness_avaliacoes (avaliado_em desc);

create table if not exists public.harness_alertas (
  id           uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null
               references public.harness_avaliacoes(id) on delete cascade,
  -- Repetido do cabeçalho de propósito: a tela conta disparos por código ao
  -- longo do tempo, e desnormalizar evita um join em toda leitura do painel.
  avaliado_em  timestamptz not null,
  codigo       varchar(30) not null
               constraint harness_alertas_codigo_check
               check (codigo in (
                 'qualidade_baixa',
                 'retrabalho_alto',
                 'custo_alto',
                 'quota_alta',
                 'quota_zerada',
                 'valor_baixo',
                 'espera_merge_longa',
                 'segmento_fila_ci',
                 'segmento_exec_ci',
                 'segmento_espera_merge',
                 'segmento_deploy'
               )),
  severidade   varchar(10) not null
               constraint harness_alertas_severidade_check
               check (severidade in ('alerta', 'critico')),
  -- Unidade por código (documentada em src/lib/harness/alertas.ts):
  -- fração 0..1 para percentuais, dólares para custo, pontos para o placar,
  -- segundos para os tempos do GitHub. numeric, nunca float.
  valor        numeric(14,4),
  limiar       numeric(14,4) not null,
  -- Tamanho da amostra que gerou o número — alerta com amostra pequena é
  -- palpite, e a tela precisa poder dizer isso.
  amostra      integer not null default 0,
  criado_em    timestamptz not null default now()
);

-- Contar disparos por limiar no tempo é a leitura principal desta tabela.
create index if not exists harness_alertas_codigo_avaliado_idx
  on public.harness_alertas (codigo, avaliado_em desc);

create index if not exists harness_alertas_avaliacao_idx
  on public.harness_alertas (avaliacao_id);

alter table public.harness_avaliacoes enable row level security;
alter table public.harness_alertas enable row level security;

-- Leitura pública (o painel é público). Escrita: só service_role, que ignora
-- RLS — nenhuma policy de INSERT/UPDATE/DELETE é criada de propósito.
drop policy if exists harness_avaliacoes_read on public.harness_avaliacoes;
create policy harness_avaliacoes_read on public.harness_avaliacoes
  for select to anon, authenticated using (true);

drop policy if exists harness_alertas_read on public.harness_alertas;
create policy harness_alertas_read on public.harness_alertas
  for select to anon, authenticated using (true);
