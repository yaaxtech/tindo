import { describe, expect, it } from 'vitest';
import { type KpiDiario, agregarKpis, detectarGatilhos } from './kpis';

const hoje = new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

describe('agregarKpis', () => {
  it('retorna zeros com array vazio', () => {
    const r = agregarKpis([]);
    expect(r.totalMostradas).toBe(0);
    expect(r.taxaConclusao).toBe(0);
    expect(r.taxaAdiar).toBe(0);
    expect(r.streakMaximo).toBe(0);
  });

  it('calcula taxas corretamente com dados simples', () => {
    const diarios: KpiDiario[] = [
      {
        dia: diasAtras(1),
        nMostradas: 10,
        nConcluidas: 5,
        nPuladas: 2,
        nExcluidas: 1,
        nAdiadas: 2,
        nEditadas: 3,
      },
    ];
    const r = agregarKpis(diarios, 30);
    expect(r.totalMostradas).toBe(10);
    expect(r.taxaConclusao).toBeCloseTo(0.5);
    expect(r.taxaAvancar).toBeCloseTo(0.2);
    expect(r.taxaAdiar).toBeCloseTo(0.2);
    expect(r.taxaDescarte).toBeCloseTo(0.1);
    expect(r.taxaReavaliacao).toBeCloseTo(0.3);
  });

  it('ignora dados fora do período', () => {
    const diarios: KpiDiario[] = [
      {
        dia: diasAtras(60), // fora de 30d
        nMostradas: 100,
        nConcluidas: 50,
        nPuladas: 10,
        nExcluidas: 10,
        nAdiadas: 10,
        nEditadas: 10,
      },
    ];
    const r = agregarKpis(diarios, 30);
    expect(r.totalMostradas).toBe(0);
  });

  it('calcula streak máximo corretamente', () => {
    // Dias consecutivos: hoje, ontem, anteontem
    const diarios: KpiDiario[] = [
      {
        dia: hoje,
        nMostradas: 5,
        nConcluidas: 1,
        nPuladas: 0,
        nExcluidas: 0,
        nAdiadas: 0,
        nEditadas: 0,
      },
      {
        dia: diasAtras(1),
        nMostradas: 5,
        nConcluidas: 1,
        nPuladas: 0,
        nExcluidas: 0,
        nAdiadas: 0,
        nEditadas: 0,
      },
      {
        dia: diasAtras(2),
        nMostradas: 5,
        nConcluidas: 1,
        nPuladas: 0,
        nExcluidas: 0,
        nAdiadas: 0,
        nEditadas: 0,
      },
      {
        dia: diasAtras(5),
        nMostradas: 5,
        nConcluidas: 1,
        nPuladas: 0,
        nExcluidas: 0,
        nAdiadas: 0,
        nEditadas: 0,
      },
    ];
    const r = agregarKpis(diarios, 30);
    expect(r.streakMaximo).toBe(3);
  });
});

describe('detectarGatilhos', () => {
  const limiares = { reavaliacao: 30, descarte: 25, adiamento: 35 };

  it('sem gatilho quando abaixo dos limiares', () => {
    const kpis = agregarKpis(
      [
        {
          dia: diasAtras(1),
          nMostradas: 100,
          nConcluidas: 60,
          nPuladas: 10,
          nExcluidas: 5,
          nAdiadas: 10,
          nEditadas: 5,
        },
      ],
      30,
    );
    const { gatilhos, deveRecalibrar } = detectarGatilhos(kpis, limiares);
    expect(deveRecalibrar).toBe(false);
    expect(gatilhos).toHaveLength(0);
  });

  it('detecta gatilho de adiamento', () => {
    const kpis = agregarKpis(
      [
        {
          dia: diasAtras(1),
          nMostradas: 100,
          nConcluidas: 30,
          nPuladas: 10,
          nExcluidas: 5,
          nAdiadas: 40, // 40% > limiar 35%
          nEditadas: 5,
        },
      ],
      30,
    );
    const { gatilhos, deveRecalibrar } = detectarGatilhos(kpis, limiares);
    expect(deveRecalibrar).toBe(true);
    expect(gatilhos.some((g) => g.codigo === 'adiamento')).toBe(true);
  });

  it('detecta múltiplos gatilhos', () => {
    const kpis = agregarKpis(
      [
        {
          dia: diasAtras(1),
          nMostradas: 100,
          nConcluidas: 10,
          nPuladas: 5,
          nExcluidas: 30, // 30% > 25%
          nAdiadas: 40, // 40% > 35%
          nEditadas: 35, // 35% > 30%
        },
      ],
      30,
    );
    const { gatilhos } = detectarGatilhos(kpis, limiares);
    expect(gatilhos.length).toBeGreaterThanOrEqual(2);
  });
});
