import type { ActionsBlob } from '@/types/harness';
import { describe, expect, it } from 'vitest';
import { calcularActionsKpis, classificarRunner, minutosDoJob } from './actions';

const AGORA = new Date('2026-08-10T12:00:00Z');

function blob(parcial: Partial<ActionsBlob> = {}): ActionsBlob {
  return {
    gerado_em: AGORA.toISOString(),
    ciclo_inicio: '2026-08-01',
    cota_min: 2_000,
    custo_min_usd: 0.008,
    repos: ['yaaxtech/tindo'],
    dias: [
      {
        dia: '2026-08-10',
        repo: 'yaaxtech/tindo',
        min_faturado: 100,
        min_mac: 900,
        runs: 10,
        jobs: 20,
        jobs_falha: 2,
        jobs_cancelado: 0,
        min_perdido: 100,
        fila_seg: [30, 60, 180],
      },
    ],
    branches: [
      { branch: 'feat/a', runs: 4, min_total: 600, virou_pr: true, mergeado: true },
      { branch: 'spike', runs: 2, min_total: 400, virou_pr: false, mergeado: false },
    ],
    steps: [
      { nome: 'Vitest', seg_total: 750, n: 10 },
      { nome: 'Build', seg_total: 250, n: 10 },
    ],
    fila_por_hora: [
      { hora: 9, p50: 30, p90: 60, n: 2 },
      { hora: 15, p50: 180, p90: 300, n: 3 },
    ],
    prs_mergeados_ciclo: 5,
    destino: { RUNNER_CI: 'self-hosted', RUNNER_LEVE: 'ubuntu-latest' },
    parcial: null,
    ...parcial,
  };
}

function dia(parcial: Partial<ActionsBlob['dias'][number]> = {}): ActionsBlob['dias'][number] {
  return { ...blob().dias[0], ...parcial } as ActionsBlob['dias'][number];
}

describe('minutosDoJob e classificação do runner', () => {
  it('arredonda cada job para cima e cobra no mínimo 1 minuto', () => {
    expect(
      minutosDoJob({
        conclusion: 'success',
        runner_name: 'ubuntu-latest',
        started_at: '2026-08-10T10:00:00Z',
        completed_at: '2026-08-10T10:00:01Z',
      }),
    ).toBe(1);
    expect(
      minutosDoJob({
        conclusion: 'success',
        runner_name: 'ubuntu-latest',
        started_at: '2026-08-10T10:00:00Z',
        completed_at: '2026-08-10T10:01:01Z',
      }),
    ).toBe(2);
  });

  it('exclui skipped de qualquer soma', () => {
    expect(
      minutosDoJob({
        conclusion: 'skipped',
        runner_name: 'ubuntu-latest',
        started_at: '2026-08-10T10:00:00Z',
        completed_at: '2026-08-10T11:00:00Z',
      }),
    ).toBeNull();
  });

  it('classifica mac- como self-hosted e todo o resto como nuvem', () => {
    expect(classificarRunner('mac-tindo-01')).toBe('mac');
    expect(classificarRunner('runner-MAC-reserva')).toBe('mac');
    expect(classificarRunner('GitHub Actions 7')).toBe('nuvem');
    expect(classificarRunner(null)).toBe('nuvem');
  });
});

describe('calcularActionsKpis', () => {
  it('projeta o mês pelos dias decorridos e calcula o custo do estouro', () => {
    const kpis = calcularActionsKpis(blob(), AGORA);
    expect(kpis.projecaoMes).toBe(310);
    expect(kpis.projecaoEquivalente).toBe(3_100);
    expect(kpis.custoEstouroUsd).toBe(0);

    const comEstouro = calcularActionsKpis(
      blob({ dias: [dia({ min_faturado: 1_000, min_mac: 0 })] }),
      AGORA,
    );
    expect(comEstouro.projecaoMes).toBe(3_100);
    expect(comEstouro.custoEstouroUsd).toBeCloseTo(8.8);
  });

  it('deriva os KPIs de gestão e preserva suas amostras x/y', () => {
    const kpis = calcularActionsKpis(blob(), AGORA);
    expect(kpis.pctCota).toEqual({ valor: 0.05, x: 100, y: 2_000 });
    expect(kpis.minPorPrMergeado).toBe(200);
    expect(kpis.concentracaoBranch.pctMaior).toEqual({ valor: 0.6, x: 600, y: 1_000 });
    expect(kpis.desperdicioPct).toEqual({ valor: 0.1, x: 100, y: 1_000 });
    expect(kpis.branchSemPrPct).toEqual({ valor: 0.4, x: 400, y: 1_000 });
    expect(kpis.stepDominante).toEqual({
      nome: 'Vitest',
      pct: { valor: 0.75, x: 750, y: 1_000 },
    });
    expect(kpis.horaPico?.hora).toBe(15);
  });

  it('recomenda ligar a nuvem quando o equivalente cabe na cota', () => {
    const leve = blob({ dias: [dia({ min_faturado: 100, min_mac: 400 })] });
    expect(calcularActionsKpis(leve, AGORA).veredito).toContain('vale ligar');
  });

  it('recomenda ficar no Mac quando a projeção estoura e a fila típica é menor que 2 min', () => {
    expect(calcularActionsKpis(blob(), AGORA).veredito).toContain('Melhor ficar');
  });

  it('expõe o preço da hora economizada quando a projeção estoura e a fila é alta', () => {
    const caro = blob({
      dias: [dia({ min_faturado: 1_000, min_mac: 0, fila_seg: [180, 300] })],
    });
    const kpis = calcularActionsKpis(caro, AGORA);
    expect(kpis.usdPorHoraEconomizada).not.toBeNull();
    expect(kpis.veredito).toContain('cada hora de fila eliminada custaria');
  });

  it('não acusa a main de trabalho abandonado', () => {
    // A main roda por push depois do merge e nunca tem PR próprio. Medida em
    // 13/08 ela sozinha respondia por 26% dos minutos — contá-la como branch
    // sem PR transformaria o trabalho ENTREGUE no maior desperdício do painel.
    const comMain = blob({
      branches: [
        { branch: 'main', runs: 108, min_total: 600, virou_pr: false, mergeado: false },
        { branch: 'fix/abandonada', runs: 2, min_total: 400, virou_pr: false, mergeado: false },
      ],
    });
    const kpis = calcularActionsKpis(comMain, AGORA);
    expect(kpis.minutosBranchSemPr).toBe(400);
    expect(kpis.branchSemPrPct).toEqual({ valor: 0.4, x: 400, y: 1_000 });
  });

  it('precifica a hora de fila mesmo com o disjuntor armado no Mac', () => {
    // O caso REAL de 13/08: nada roda na nuvem, então o faturado é zero. Se o
    // preço da hora saísse do faturado, o painel diria "US$ 0,00" exatamente
    // quando a pergunta é se vale ligar a nuvem.
    const tudoNoMac = blob({
      dias: [dia({ min_faturado: 0, min_mac: 1_000, fila_seg: [600, 900] })],
    });
    const kpis = calcularActionsKpis(tudoNoMac, AGORA);
    expect(kpis.custoEstouroUsd).toBe(0);
    expect(kpis.custoSeLigarUsd).toBeCloseTo(8.8);
    expect(kpis.usdPorHoraEconomizada).toBeGreaterThan(0);
    expect(kpis.veredito).toContain('cada hora de fila eliminada custaria');
  });

  it('transforma amostra insuficiente em null, nunca em zero inventado', () => {
    const kpis = calcularActionsKpis(
      blob({ dias: [], branches: [], steps: [], fila_por_hora: [], prs_mergeados_ciclo: 0 }),
      AGORA,
    );
    expect(kpis.minutosCiclo).toBeNull();
    expect(kpis.projecaoMes).toBeNull();
    expect(kpis.pctCota.valor).toBeNull();
    expect(kpis.filaP50).toBeNull();
    expect(kpis.minPorPrMergeado).toBeNull();
    expect(kpis.desperdicioPct.valor).toBeNull();
    expect(kpis.stepDominante).toBeNull();
    expect(kpis.horaPico).toBeNull();
  });
});
