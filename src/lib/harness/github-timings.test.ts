import type { GithubRunLinha } from '@/types/harness';
import { describe, expect, it } from 'vitest';
import {
  deltaSegundos,
  medidasDosRuns,
  percentil,
  resumirSegmento,
  resumoJanela,
  resumoPorSemana,
  segmentosGithub,
} from './github-timings';

const AGORA = Date.parse('2026-08-13T12:00:00Z');
const iso = (msAtras: number) => new Date(AGORA - msAtras).toISOString();
const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

let proximoId = 1;

function run(parcial: Partial<GithubRunLinha> = {}): GithubRunLinha {
  return {
    run_id: proximoId++,
    repo: 'yaaxtech/tindo',
    evento: 'pull_request',
    branch: 'feat/x',
    head_sha: 'sha-a',
    conclusao: 'success',
    criado_em: iso(2 * DIA),
    iniciado_em: iso(2 * DIA - 30_000),
    atualizado_em: iso(2 * DIA - 5 * MIN),
    pr_numero: null,
    pr_criado_em: null,
    pr_merged_em: null,
    ...parcial,
  };
}

describe('deltaSegundos', () => {
  it('mede a diferença em segundos', () => {
    expect(deltaSegundos('2026-08-13T10:00:00Z', '2026-08-13T10:02:30Z')).toBe(150);
  });

  it('devolve null quando falta uma das pontas', () => {
    expect(deltaSegundos(null, '2026-08-13T10:00:00Z')).toBeNull();
    expect(deltaSegundos('2026-08-13T10:00:00Z', null)).toBeNull();
  });

  it('devolve null (nunca negativo) quando o relógio está torto', () => {
    expect(deltaSegundos('2026-08-13T10:05:00Z', '2026-08-13T10:00:00Z')).toBeNull();
  });

  it('devolve null para data inválida', () => {
    expect(deltaSegundos('nem-data', '2026-08-13T10:00:00Z')).toBeNull();
  });
});

describe('medidasDosRuns — os 4 segmentos', () => {
  it('fila_ci e exec_ci saem de um run de PR comum', () => {
    const r = run({
      criado_em: '2026-08-13T10:00:00Z',
      iniciado_em: '2026-08-13T10:00:45Z',
      atualizado_em: '2026-08-13T10:04:45Z',
    });
    const [m] = medidasDosRuns([r]);
    expect(m?.fila_ci).toBe(45);
    expect(m?.exec_ci).toBe(240);
    expect(m?.deploy).toBeNull();
    expect(m?.espera_merge).toBeNull();
  });

  it('espera_merge = merge menos o fim do último run verde do PR', () => {
    const r = run({
      head_sha: 'sha-pr',
      pr_numero: 51,
      pr_criado_em: '2026-08-13T09:00:00Z',
      pr_merged_em: '2026-08-13T10:30:00Z',
      criado_em: '2026-08-13T10:00:00Z',
      iniciado_em: '2026-08-13T10:00:30Z',
      atualizado_em: '2026-08-13T10:05:00Z',
    });
    const [m] = medidasDosRuns([r]);
    expect(m?.espera_merge).toBe(25 * 60);
  });

  it('deploy = execução do run de push no branch padrão', () => {
    const r = run({
      evento: 'push',
      branch: 'main',
      criado_em: '2026-08-13T10:30:00Z',
      iniciado_em: '2026-08-13T10:30:20Z',
      atualizado_em: '2026-08-13T10:36:20Z',
    });
    const [m] = medidasDosRuns([r]);
    expect(m?.deploy).toBe(360);
    // Segmentos disjuntos: o run de deploy não entra também em exec_ci.
    expect(m?.exec_ci).toBeNull();
    expect(m?.fila_ci).toBe(20);
  });

  it('push fora do branch padrão não conta como deploy', () => {
    const [m] = medidasDosRuns([run({ evento: 'push', branch: 'outra' })]);
    expect(m?.deploy).toBeNull();
  });
});

describe('medidasDosRuns — casos degenerados', () => {
  it('run que nunca começou: fila_ci e exec_ci nulos', () => {
    const [m] = medidasDosRuns([run({ iniciado_em: null })]);
    expect(m?.fila_ci).toBeNull();
    expect(m?.exec_ci).toBeNull();
  });

  it('PR nunca mergeado: espera_merge null', () => {
    const [m] = medidasDosRuns([run({ pr_numero: 42, pr_merged_em: null })]);
    expect(m?.espera_merge).toBeNull();
  });

  it('run cancelado não fecha o segmento de espera de merge', () => {
    const medidas = medidasDosRuns([
      run({
        conclusao: 'cancelled',
        pr_numero: 7,
        pr_merged_em: '2026-08-13T11:00:00Z',
        atualizado_em: '2026-08-13T10:00:00Z',
      }),
    ]);
    expect(medidas[0]?.espera_merge).toBeNull();
  });

  it('vários runs verdes no mesmo PR: usa o ÚLTIMO que terminou antes do merge', () => {
    const cedo = run({
      pr_numero: 9,
      pr_merged_em: '2026-08-13T12:00:00Z',
      atualizado_em: '2026-08-13T10:00:00Z',
    });
    const tarde = run({
      pr_numero: 9,
      pr_merged_em: '2026-08-13T12:00:00Z',
      atualizado_em: '2026-08-13T11:30:00Z',
    });
    const depoisDoMerge = run({
      pr_numero: 9,
      pr_merged_em: '2026-08-13T12:00:00Z',
      atualizado_em: '2026-08-13T13:00:00Z',
    });
    const medidas = medidasDosRuns([cedo, tarde, depoisDoMerge]);
    const porId = new Map(medidas.map((m) => [m.runId, m.espera_merge]));
    expect(porId.get(tarde.run_id)).toBe(30 * 60);
    expect(porId.get(cedo.run_id)).toBeNull();
    expect(porId.get(depoisDoMerge.run_id)).toBeNull();
    // Um PR contribui com exatamente UMA medida de espera de merge.
    expect(medidas.filter((m) => m.espera_merge != null)).toHaveLength(1);
  });

  it('relógio torto vira null, nunca segundo negativo', () => {
    const [m] = medidasDosRuns([
      run({
        criado_em: '2026-08-13T10:05:00Z',
        iniciado_em: '2026-08-13T10:00:00Z',
        atualizado_em: '2026-08-13T09:50:00Z',
      }),
    ]);
    expect(m?.fila_ci).toBeNull();
    expect(m?.exec_ci).toBeNull();
  });
});

describe('percentil e resumirSegmento', () => {
  it('amostra vazia devolve p50/p90 nulos e n=0', () => {
    expect(resumirSegmento([])).toEqual({ p50: null, p90: null, n: 0 });
    expect(resumirSegmento([null, null])).toEqual({ p50: null, p90: null, n: 0 });
  });

  it('n=1 não explode e reporta a amostra honestamente', () => {
    expect(resumirSegmento([42])).toEqual({ p50: 42, p90: 42, n: 1 });
  });

  it('n=2 usa nearest-rank igual ao kpis.ts', () => {
    expect(resumirSegmento([10, 20])).toEqual({ p50: 20, p90: 20, n: 2 });
  });

  it('p50/p90 de uma amostra de 10', () => {
    const dez = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    expect(percentil(dez, 0.5)).toBe(6);
    expect(percentil(dez, 0.9)).toBe(9);
    expect(resumirSegmento(dez).n).toBe(10);
  });

  it('descarta nulos sem contá-los na amostra', () => {
    expect(resumirSegmento([null, 5, null, 15])).toEqual({ p50: 15, p90: 15, n: 2 });
  });
});

describe('resumoJanela e resumoPorSemana', () => {
  const runs = [
    // dentro da janela de 7d
    run({ criado_em: iso(DIA), iniciado_em: iso(DIA - 60_000), atualizado_em: iso(DIA - 3 * MIN) }),
    run({
      criado_em: iso(3 * DIA),
      iniciado_em: iso(3 * DIA - 20_000),
      atualizado_em: iso(3 * DIA - 2 * MIN),
    }),
    // fora: 20 dias atrás
    run({
      criado_em: iso(20 * DIA),
      iniciado_em: iso(20 * DIA - 10_000),
      atualizado_em: iso(20 * DIA - MIN),
    }),
  ];

  it('a janela atual ignora o que caiu fora dela', () => {
    const medidas = medidasDosRuns(runs);
    expect(resumoJanela(medidas, 7, 0, AGORA).fila_ci.n).toBe(2);
    expect(resumoJanela(medidas, 7, 1, AGORA).fila_ci.n).toBe(0);
  });

  it('devolve as 4 semanas mesmo quando alguma está vazia', () => {
    const semanas = resumoPorSemana(medidasDosRuns(runs), 4, AGORA);
    expect(semanas.map((w) => w.s)).toEqual([0, 1, 2, 3]);
    expect(semanas[0]?.segmentos.fila_ci.n).toBe(2);
    // s=1 (7-14d) está vazia; s=2 (14-21d) pega o run de 20 dias atrás.
    expect(semanas[1]?.segmentos.fila_ci).toEqual({ p50: null, p90: null, n: 0 });
    expect(semanas[2]?.segmentos.fila_ci.n).toBe(1);
    expect(semanas[3]?.segmentos.fila_ci).toEqual({ p50: null, p90: null, n: 0 });
  });

  it('segmentosGithub encadeia medidas + janela + semanas', () => {
    const { janela, semanas } = segmentosGithub(runs, { agora: AGORA, janelaDias: 7 });
    expect(janela.fila_ci.n).toBe(2);
    expect(janela.espera_merge).toEqual({ p50: null, p90: null, n: 0 });
    expect(semanas).toHaveLength(4);
  });

  it('lista vazia não quebra nada', () => {
    const { janela, semanas } = segmentosGithub([], { agora: AGORA });
    expect(janela.deploy).toEqual({ p50: null, p90: null, n: 0 });
    expect(semanas).toHaveLength(4);
  });
});
