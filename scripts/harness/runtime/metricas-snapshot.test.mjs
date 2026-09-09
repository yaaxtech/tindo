import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HARNESS_METRIC_VERSION,
  construirPeriodos,
  extrairExecMin,
  filtrarHistoricoCompativel,
  metricasDaJanela,
  sanitizarLedger,
  saudeDosDados,
} from './metricas-snapshot.mjs';

const AS_OF = '2026-08-27T15:00:00.000Z';
let sequencia = 0;

function linha(overrides = {}) {
  sequencia++;
  return {
    ts: `2026-08-27T14:${String(sequencia % 60).padStart(2, '0')}:00.000Z`,
    frente: 'codex',
    modelo: 'luna',
    effort: 'max',
    terreno: 'rotina',
    resultado: 'ok1',
    papel: 'construtor',
    dur: 10,
    tarefa: `texto privado ${sequencia}`,
    nota: `nota privada ${sequencia}`,
    id: `p${sequencia}`,
    ...overrides,
  };
}

function repetir(n, overrides) {
  return Array.from({ length: n }, () => linha(overrides));
}

test('separa construção de revisão e reproduz o fixture auditado', () => {
  const fixture = [
    ...repetir(34, { papel: 'construtor', resultado: 'ok1' }),
    ...repetir(8, { papel: 'construtor', resultado: 'retrabalho' }),
    ...repetir(6, { papel: 'construtor', resultado: 'quota' }),
    ...repetir(4, { papel: 'construtor', resultado: 'infra' }),
    ...repetir(3, { papel: 'construtor', resultado: 'descartado' }),
    ...repetir(23, { papel: 'revisor', resultado: 'retrabalho' }),
    ...repetir(29, { papel: 'revisor', resultado: 'ok1' }),
    ...repetir(9, { papel: 'construtor', papel_inferido: true, resultado: 'retrabalho' }),
  ];
  const metricas = metricasDaJanela(fixture);

  assert.equal(metricas.construcao.julgados, 42);
  assert.equal(metricas.construcao.ok1, 34);
  assert.equal(metricas.construcao.retrabalho, 8);
  assert.equal(metricas.construcao.qualidade, 34 / 42);
  assert.equal(metricas.construcao.retrabalho_pct, 8 / 42);
  assert.equal(metricas.revisao.julgados, 52);
  assert.equal(metricas.revisao.problemas_encontrados, 23);
  assert.equal(metricas.revisao.deteccao_pct, 23 / 52);
});

test('papel ausente ou inferido nunca entra em denominador decisório', () => {
  const metricas = metricasDaJanela([
    linha({ papel: undefined, resultado: 'retrabalho' }),
    linha({ papel: 'construtor', papel_inferido: true, resultado: 'retrabalho' }),
    linha({ papel: 'revisor', papel_inferido: true, resultado: 'retrabalho' }),
  ]);
  assert.equal(metricas.construcao.julgados, 0);
  assert.equal(metricas.revisao.julgados, 0);
  assert.equal(metricas.construcao.qualidade, null);
});

test('recortes usam o as_of fixo, não o relógio da máquina', () => {
  const ledger = [
    linha({ ts: '2026-08-27T14:00:00.000Z' }),
    linha({ ts: '2026-08-19T14:00:00.000Z', resultado: 'retrabalho' }),
  ];
  const periodos = construirPeriodos(ledger, AS_OF, [7]);
  assert.equal(periodos['7'].atual.construcao.julgados, 1);
  assert.equal(periodos['7'].anterior.construcao.julgados, 1);
  assert.equal(periodos['7'].fim_atual, AS_OF);
});

test('contrato público remove todo texto livre e identificadores', () => {
  const original = [linha({ nota: 'texto privado exec=12.5min', exec_min: 12.5 })];
  const { publicados, rejeitados } = sanitizarLedger([
    ...original,
    { ts: 'inválido', tarefa: 'não publicar' },
  ]);
  assert.equal(rejeitados, 1);
  assert.equal(publicados.length, 1);
  assert.equal('tarefa' in publicados[0], false);
  assert.equal('nota' in publicados[0], false);
  assert.equal('id' in publicados[0], false);
  assert.equal(publicados[0].exec_min, 12.5);
  assert.equal(JSON.stringify(publicados).includes('texto privado'), false);
});

test('contrato rejeita enums e tipos desconhecidos antes do cálculo', () => {
  const { publicados, rejeitados, rejeicoes_por_motivo } = sanitizarLedger([
    linha(),
    linha({ resultado: 'surpresa' }),
    linha({ papel: 'juiz' }),
    linha({ dur: -3 }),
  ]);
  assert.equal(publicados.length, 1);
  assert.equal(rejeitados, 3);
  assert.deepEqual(rejeicoes_por_motivo, {
    resultado_invalido: 1,
    papel_invalido: 1,
    duracao_invalida: 1,
  });
  assert.equal(metricasDaJanela(publicados).construcao.julgados, 1);
});

test('histórico público mantém somente snapshots da fórmula atual', () => {
  const atual = { schema_version: 2, metric_version: HARNESS_METRIC_VERSION, ts: AS_OF };
  assert.deepEqual(
    filtrarHistoricoCompativel([
      { schema_version: 1, ts: AS_OF },
      { schema_version: 2, metric_version: 'construction-v1', ts: AS_OF },
      atual,
    ]),
    [atual],
  );
});

test('extrai execução estruturada da nota antes de removê-la', () => {
  assert.equal(extrairExecMin('auto run.sh rc=0 exec=19min'), 19);
  assert.equal(extrairExecMin('auto run.sh rc=0 exec=1.5min'), 1.5);
  assert.equal(extrairExecMin('sem duração'), null);
  assert.equal(extrairExecMin(null), null);
});

test('saúde do snapshot explicita cobertura e versão', () => {
  const ledger = [
    linha({ ts: '2026-08-27T14:30:00.000Z', dur: 12 }),
    linha({ ts: '2026-08-27T14:45:00.000Z', papel: undefined, dur: null }),
  ];
  const saude = saudeDosDados(ledger, AS_OF, { recebidos: 4, rejeitados: 2 });
  assert.equal(saude.metric_version, HARNESS_METRIC_VERSION);
  assert.equal(saude.source_max_ts, '2026-08-27T14:45:00.000Z');
  assert.equal(saude.atraso_fonte_seg, 900);
  assert.equal(saude.papel_explicito, 1);
  assert.equal(saude.papel_explicito_pct, 0.5);
  assert.equal(saude.duracao_preenchida, 1);
  assert.equal(saude.eventos_rejeitados, 2);
  assert.equal(saude.eventos_recebidos, 4);
});

test('preserva Kimi como frente histórica sem publicar texto livre', () => {
  const r = sanitizarLedger([linha({ frente: 'kimi', modelo: 'k3-256k' })]);
  assert.equal(r.rejeitados, 0);
  assert.equal(r.publicados[0].frente, 'kimi');
  assert.equal('tarefa' in r.publicados[0], false);
});
