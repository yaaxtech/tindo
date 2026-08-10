import type { Assinatura, CadeiaTerreno, LedgerLinha } from '@/types/harness';
import { describe, expect, it } from 'vitest';
import {
  contarPendentes,
  custoAssinaturas,
  custoMedioTarefa,
  diasComDados,
  kpisGerais,
  kpisTerreno,
  normModelo,
  placarPorFrente,
  porModelo,
  recorte,
  valorGeral,
  valorScore,
} from './kpis';

// Amostra SINTÉTICA fixa — bate com as fórmulas de ledger.mjs/painel.mjs.
const AGORA = Date.parse('2026-08-04T12:00:00Z');
const tsDiasAtras = (dias: number) => new Date(AGORA - dias * 864e5).toISOString();

function linha(parcial: Partial<LedgerLinha> & Pick<LedgerLinha, 'ts'>): LedgerLinha {
  return {
    frente: 'codex',
    modelo: 'gpt-5.6-luna',
    effort: null,
    terreno: 'rotina',
    resultado: 'ok1',
    tarefa: 'tarefa de teste',
    nota: null,
    dur: null,
    ...parcial,
  };
}

// Janela atual (desloc 0, 7d): 7 linhas — 1 quota, 4 ok1, 2 reciclo.
// Janela anterior (desloc 1): 3 linhas.
const LEDGER: LedgerLinha[] = [
  // atual
  linha({
    ts: tsDiasAtras(1),
    frente: 'codex',
    modelo: 'gpt-5.6-luna',
    effort: 'max',
    terreno: 'rotina',
    resultado: 'ok1',
    dur: 25,
  }),
  linha({
    ts: tsDiasAtras(2),
    frente: 'codex',
    modelo: 'gpt-5.6-sol',
    effort: 'high',
    terreno: 'dificil',
    resultado: 'ok1',
    dur: 60,
  }),
  linha({
    ts: tsDiasAtras(2),
    frente: 'kimi',
    modelo: 'kimi-code/k3-256k',
    terreno: 'ui',
    resultado: 'ok1',
    dur: 15,
  }),
  linha({
    ts: tsDiasAtras(3),
    frente: 'kimi',
    modelo: 'k3-256k',
    terreno: 'ui',
    resultado: 'retrabalho',
    dur: 40,
  }),
  linha({
    ts: tsDiasAtras(4),
    frente: 'claude',
    modelo: 'claude-opus-4-8',
    terreno: 'sql',
    resultado: 'ok1',
    dur: 30,
  }),
  linha({
    ts: tsDiasAtras(5),
    frente: 'codex',
    modelo: 'gpt-5.6-luna',
    effort: 'low',
    terreno: 'mecanico',
    resultado: 'quota',
  }),
  linha({
    ts: tsDiasAtras(6),
    frente: 'cerebro',
    modelo: 'fable',
    terreno: 'sql',
    resultado: 'escalado',
    dur: 90,
  }),
  // anterior
  linha({ ts: tsDiasAtras(8), frente: 'codex', terreno: 'rotina', resultado: 'ok1', dur: 20 }),
  linha({ ts: tsDiasAtras(10), frente: 'claude', terreno: 'sql', resultado: 'ok1', dur: 35 }),
  linha({ ts: tsDiasAtras(12), frente: 'kimi', terreno: 'ui', resultado: 'falhou', dur: 50 }),
];

const CADEIAS: Record<string, CadeiaTerreno> = {
  rotina: { rotulo: 'Rotina', default: 'Luna (max)', fallback: ['K3'], piso: true, revisor: 'K3' },
  dificil: {
    rotulo: 'Difícil',
    default: 'Sol',
    fallback: ['Cérebro'],
    piso: false,
    revisor: 'Cérebro',
  },
  ui: { rotulo: 'UI', default: 'K3', fallback: ['Sol'], piso: true, revisor: 'Sol' },
  mecanico: {
    rotulo: 'Mecânico',
    default: 'Luna (low)',
    fallback: [],
    piso: true,
    revisor: 'Prova',
  },
  sql: { rotulo: 'SQL', default: 'Fable', fallback: [], piso: false, revisor: 'Verificador' },
};

const ATUAL = recorte(LEDGER, 7, 0, AGORA);

const ASSINATURAS_VALOR: Assinatura[] = [
  { nome: 'Codex', frente: 'codex', valor: 30, renova: '2026-08-27', papel: 'construtor' },
  { nome: 'Kimi', frente: 'kimi', valor: 10, renova: '2026-08-27', papel: 'ui' },
  { nome: 'Claude', frente: 'claude', valor: 20, renova: '2026-08-22', papel: 'cérebro' },
  { nome: 'Gemini', frente: 'gemini', valor: 10, renova: '2026-09-01', papel: 'teste' },
];

const LINHAS_VALOR: LedgerLinha[] = [
  linha({ ts: tsDiasAtras(1), frente: 'codex', resultado: 'ok1' }),
  linha({ ts: tsDiasAtras(1), frente: 'kimi', resultado: 'retrabalho' }),
];

describe('diasComDados', () => {
  it('retorna 0 para ledger vazio', () => {
    expect(diasComDados([], AGORA)).toBe(0);
  });

  it('retorna no mínimo 1 para uma linha de hoje', () => {
    expect(diasComDados([linha({ ts: tsDiasAtras(0) })], AGORA)).toBe(1);
  });

  it('retorna 9 para uma linha de 9 dias atrás', () => {
    expect(diasComDados([linha({ ts: tsDiasAtras(9) })], AGORA)).toBe(9);
  });
});

describe('recorte', () => {
  it('separa janela atual da anterior', () => {
    expect(ATUAL).toHaveLength(7);
    expect(recorte(LEDGER, 7, 1, AGORA)).toHaveLength(3);
    expect(recorte(LEDGER, 15, 0, AGORA)).toHaveLength(10); // a mais antiga tem 12d
  });
});

describe('kpisGerais', () => {
  it('calcula os 5 KPIs com os valores exatos', () => {
    const g = kpisGerais(ATUAL);
    expect(g.n).toBe(7);
    expect(g.julg).toBe(6);
    expect(g.ok1N).toBe(4);
    expect(g.recN).toBe(2);
    expect(g.offN).toBe(5);
    expect(g.quotaN).toBe(1);
    expect(g.aceitas).toBe(5); // 4 ok1 + 1 retrabalho (escalado/quota fora)
    expect(g.ok1).toBeCloseTo(4 / 6, 10); // quota fora do julgamento
    expect(g.offload).toBeCloseTo(5 / 7, 10); // claude e cerebro ficam de fora
    expect(g.quotaHit).toBeCloseTo(1 / 7, 10);
    expect(g.reciclo).toBeCloseTo(2 / 6, 10);
    expect(g.durMed).toBe(40); // mediana de [15,25,30,40,60,90] → índice 3
    expect(g.durP90).toBe(90); // nearest-rank: ceil(0.9·6)−1 = índice 5
    expect(g.durN).toBe(6);
    expect(g.porFrente).toEqual({ codex: 3, kimi: 2, claude: 1, cerebro: 1 });
    expect(g.quotaPorFrente).toEqual({ codex: 1 });
  });

  it('retorna nulls com janela vazia', () => {
    const g = kpisGerais([]);
    expect(g.n).toBe(0);
    expect(g.ok1).toBeNull();
    expect(g.offload).toBeNull();
    expect(g.quotaHit).toBeNull();
    expect(g.reciclo).toBeNull();
    expect(g.durMed).toBeNull();
    expect(g.durP90).toBeNull();
  });

  it('exclui "pendente" de todos os KPIs (não é retrabalho)', () => {
    const comPendentes = [
      ...ATUAL,
      linha({ ts: tsDiasAtras(1), resultado: 'pendente', id: 'p1', auto: true }),
      linha({ ts: tsDiasAtras(2), resultado: 'pendente', id: 'p2', auto: true }),
    ];
    expect(kpisGerais(comPendentes)).toEqual(kpisGerais(ATUAL));
    expect(contarPendentes(comPendentes)).toBe(2);
    expect(contarPendentes(ATUAL)).toBe(0);
    // por terreno e por modelo também ficam intactos
    expect(kpisTerreno(comPendentes, CADEIAS)).toEqual(kpisTerreno(ATUAL, CADEIAS));
    expect(porModelo(comPendentes)).toEqual(porModelo(ATUAL));
  });
});

describe('kpisTerreno', () => {
  it('agrega o terreno sql com valores exatos e sinal "dados"', () => {
    const t = kpisTerreno(ATUAL, CADEIAS);
    expect(t.sql).toMatchObject({
      n: 2,
      julgaveis: 2,
      ok1: 1,
      reciclo: 1,
      quota: 0,
      ok1Pct: 0.5,
      recicloPct: 0.5,
    });
    expect(t.sql?.sinal.tipo).toBe('dados'); // julgaveis < 5
    expect(t.mecanico?.quota).toBe(1);
    expect(t.rotina?.ok1Pct).toBe(1);
  });

  it('sinal subir: ok1 < 70% com 5+ julgáveis', () => {
    const linhas = Array.from({ length: 5 }, (_, i) =>
      linha({ ts: tsDiasAtras(1), terreno: 'dificil', resultado: i < 3 ? 'ok1' : 'retrabalho' }),
    );
    const t = kpisTerreno(linhas, CADEIAS);
    expect(t.dificil?.sinal.tipo).toBe('subir');
  });

  it('sinal baratear: ok1 ≥ 90% com 8+ julgáveis e degrau não-piso', () => {
    const linhas = Array.from({ length: 8 }, () =>
      linha({ ts: tsDiasAtras(1), terreno: 'dificil', resultado: 'ok1' }),
    );
    const t = kpisTerreno(linhas, CADEIAS);
    expect(t.dificil?.sinal.tipo).toBe('baratear');
    // mesmo desempenho em terreno-piso não barateia
    const piso = kpisTerreno(
      linhas.map((l) => ({ ...l, terreno: 'rotina' as const })),
      CADEIAS,
    );
    expect(piso.rotina?.sinal.tipo).toBe('ok');
  });

  it('sinal quota sobrepõe os demais a partir de 3 quotas', () => {
    const linhas = [
      ...Array.from({ length: 5 }, () =>
        linha({ ts: tsDiasAtras(1), terreno: 'rotina' as const, resultado: 'ok1' as const }),
      ),
      ...Array.from({ length: 3 }, () =>
        linha({ ts: tsDiasAtras(1), terreno: 'rotina' as const, resultado: 'quota' as const }),
      ),
    ];
    const t = kpisTerreno(linhas, CADEIAS);
    expect(t.rotina?.sinal.tipo).toBe('quota');
  });
});

describe('porModelo', () => {
  it('normaliza modelo e agrupa por modelo·effort', () => {
    const rows = porModelo(ATUAL);
    const por = Object.fromEntries(rows.map((r) => [r.nome, r]));
    expect(por.k3).toBeUndefined();
    expect(por['k3-256k']).toMatchObject({ n: 2, julg: 2, ok1: 1 }); // kimi-code/ fundido
    expect(por['opus-4.8']).toMatchObject({ n: 1, julg: 1, ok1: 1 });
    expect(por['gpt-5.6-luna · max']).toMatchObject({ n: 1, julg: 1, ok1: 1 });
    expect(por['gpt-5.6-luna · low']).toMatchObject({ n: 1, julg: 0, ok1: 0 }); // quota não julga
    expect(rows[0]?.nome).toBe('k3-256k'); // ordenado por n desc
  });

  it('normModelo cobre as variantes conhecidas (espelho de modelos.mjs)', () => {
    // K3: as 3 grafias reais do ledger fundem numa só
    expect(normModelo('kimi-code/k3-256k')).toBe('k3-256k');
    expect(normModelo('kimi-code/k3')).toBe('k3-256k');
    expect(normModelo('k3')).toBe('k3-256k');
    // Opus 4.8 e apelidos; opus-5 fica separado
    expect(normModelo('claude-opus-4-8')).toBe('opus-4.8');
    expect(normModelo('opus')).toBe('opus-4.8');
    expect(normModelo('opus-5')).toBe('opus-5');
    // família Claude só tolera prefixo/versão
    expect(normModelo('claude-fable-5')).toBe('fable');
    expect(normModelo('sonnet')).toBe('sonnet');
    // desconhecidos passam intactos
    expect(normModelo('gpt-5.6-sol')).toBe('gpt-5.6-sol');
  });
});

describe('custoAssinaturas', () => {
  const ASSINATURAS: Assinatura[] = [
    { nome: 'Claude', frente: 'claude', valor: 200, renova: '2026-08-22', papel: 'cérebro' },
    { nome: 'Codex', frente: 'codex', valor: 100, renova: '2026-08-27', papel: 'construtor' },
    { nome: 'Kimi', frente: 'kimi', valor: 20, renova: '2026-08-27', papel: 'ui' },
    { nome: 'Gemini', frente: 'gemini', valor: 10, renova: '2026-09-01', papel: 'teste' },
  ];

  it('calcula gasto proporcional, custo por tarefa ACEITA e veredito', () => {
    const calc = custoAssinaturas(ATUAL, ASSINATURAS, 7);
    // custo médio do harness: 330 * 7/30 ÷ 5 ACEITAS (4 ok1 + 1 retrabalho;
    // quota e escalado não entregaram → fora do denominador) = 15.4
    expect(custoMedioTarefa(ATUAL, ASSINATURAS, 7)).toBeCloseTo(15.4, 10);

    const claude = calc[0];
    expect(claude?.uso).toBe(1);
    expect(claude?.aceitas).toBe(1);
    expect(claude?.gasto).toBeCloseTo((200 * 7) / 30, 10);
    expect(claude?.custoSub).toBeCloseTo((200 * 7) / 30, 10); // > 1.6 * 15.4 → observar
    expect(claude?.veredito).toBe('observar');

    const codex = calc[1];
    expect(codex?.uso).toBe(3);
    expect(codex?.aceitas).toBe(2); // 2 ok1; a quota não conta como aceita
    expect(codex?.custoSub).toBeCloseTo((100 * 7) / 30 / 2, 10);
    expect(codex?.quotas).toBe(1); // quota > 0 → aumentar (prioridade máxima)
    expect(codex?.veredito).toBe('aumentar');

    const kimi = calc[2];
    expect(kimi?.uso).toBe(2);
    expect(kimi?.aceitas).toBe(2); // ok1 + retrabalho — ambas entregues
    expect(kimi?.custoSub).toBeCloseTo((20 * 7) / 30 / 2, 10);
    expect(kimi?.veredito).toBe('manter');

    const gemini = calc[3];
    expect(gemini?.uso).toBe(0);
    expect(gemini?.custoSub).toBeNull();
    expect(gemini?.veredito).toBe('cancelar');
  });
});

describe('placar de valor', () => {
  it('aplica os pesos e o gate anti barato-ruim', () => {
    expect(valorScore(1, 1, 1)).toBe(100);
    expect(valorScore(0, 1, 1)).toBe(10);
    expect(valorScore(0.8, 0.5, 1)).toBe(76);
  });

  it('ordena frentes por valor e deixa sem dados por último', () => {
    const placar = placarPorFrente(LINHAS_VALOR, ASSINATURAS_VALOR, 30);
    expect(placar.map((item) => item.frente)).toEqual(['codex', 'kimi', 'claude']);
    expect(placar[0]).toMatchObject({ n: 1, q: 1, custoTarefa: 30, valor: 100 });
    expect(placar[1]).toMatchObject({ n: 1, q: 0, custoTarefa: 10, valor: 10 });
    expect(placar[2]).toMatchObject({ n: 0, q: null, custoTarefa: null, valor: null });
  });

  it('retorna null no placar geral sem julgáveis', () => {
    expect(valorGeral([], ASSINATURAS_VALOR, 7)).toBeNull();
  });
});
