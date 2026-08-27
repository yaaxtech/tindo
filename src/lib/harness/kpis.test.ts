import type {
  Assinatura,
  AutonomiaBlob,
  AutonomiaDia,
  CadeiaTerreno,
  HarnessBlob,
  LedgerLinha,
} from '@/types/harness';
import { describe, expect, it } from 'vitest';
import {
  baldesPorDegrau,
  contarInfra,
  contarPendentes,
  contratoMetricasValido,
  custoAssinaturas,
  custoMedioTarefa,
  diasComDados,
  filtrarHistoricoCompativel,
  kpisAutonomia,
  kpisGerais,
  kpisRevisao,
  kpisTerreno,
  normModelo,
  placarPorFrente,
  porModelo,
  recorte,
  terrenoAmbiguo,
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
    papel: 'construtor',
    tarefa: 'tarefa de teste',
    nota: null,
    dur: null,
    ...parcial,
  };
}

// Um terreno só MEDE o degrau quando foi declarado NO despacho, e isso é um
// caso só: automático, DEPOIS da instrumentação (13/08/2026 17:00Z) e sem a
// marca `terreno_inferido`. Todo o resto — inclusive o log manual do cérebro —
// é rótulo, não classificação (regra de ~/.claude/orquestracao/ledger.mjs).
// Teste que exercita SINAL de modelo usa este helper: com linha ambígua o
// sinal sai suspenso e o teste mede a supressão, não o limiar que ele nomeia.
const TS_CLASSIFICADO = '2026-08-20T10:00:00Z';
const classificada = (parcial: Partial<LedgerLinha> = {}): LedgerLinha =>
  linha({ ts: TS_CLASSIFICADO, auto: true, ...parcial });

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
  sql: {
    rotulo: 'SQL',
    default: 'Fable',
    fallback: [],
    piso: false,
    revisor: 'Verificador',
    // modelo já no teto do terreno: esforço high→max é a única alavanca.
    effort: 'high',
    effort_teto: 'max',
    modelo_no_teto: true,
  },
};

const ATUAL = recorte(LEDGER, 7, 0, AGORA);

const ASSINATURAS_VALOR: Assinatura[] = [
  { nome: 'Codex', frente: 'codex', valor: 30, renova: '2026-08-27', papel: 'construtor' },
  { nome: 'Kimi', frente: 'kimi', valor: 10, renova: '2026-08-27', papel: 'ui' },
  { nome: 'Claude', frente: 'claude', valor: 20, renova: '2026-08-22', papel: 'cérebro' },
  { nome: 'Gemini', frente: 'gemini', valor: 10, renova: '2026-09-01', papel: 'teste' },
];

function blobV2Valido(): HarnessBlob {
  const asOf = '2026-08-27T15:00:00.000Z';
  const construcao = {
    total: 0,
    julgados: 0,
    ok1: 0,
    retrabalho: 0,
    aceitas: 0,
    pendente: 0,
    quota: 0,
    infra: 0,
    descartado: 0,
    qualidade: null,
    retrabalho_pct: null,
    qualidade_ic95: null,
    offload: 0,
    offload_pct: null,
    quota_pct: null,
    duracao: { n: 0, p50_min: null, p90_min: null },
    por_frente: {},
    quota_por_frente: {},
  };
  const revisao = {
    total: 0,
    julgados: 0,
    problemas_encontrados: 0,
    deteccao_pct: null,
    deteccao_ic95: null,
  };
  const metricas_periodos = Object.fromEntries(
    [1, 7, 14, 15, 30].map((dias) => [
      String(dias),
      {
        dias,
        atual: { eventos: 0, construcao: { ...construcao }, revisao: { ...revisao } },
        anterior: { eventos: 0, construcao: { ...construcao }, revisao: { ...revisao } },
        inicio_atual: new Date(Date.parse(asOf) - dias * 864e5).toISOString(),
        fim_atual: asOf,
      },
    ]),
  );
  return {
    schema_version: 2,
    metric_version: 'construction-v2-2026-08-27',
    gerado_em: asOf,
    as_of: asOf,
    ledger: [],
    metricas_periodos,
    saude_dados: {
      schema_version: 2,
      metric_version: 'construction-v2-2026-08-27',
      gerado_em: asOf,
      source_max_ts: null,
      atraso_fonte_seg: null,
      eventos_recebidos: 0,
      eventos_publicados: 0,
      eventos_rejeitados: 0,
      papel_explicito: 0,
      papel_explicito_pct: null,
      duracao_preenchida: 0,
      duracao_preenchida_pct: null,
    },
    history: [],
    volume_codigo: [],
    prs: [],
    assinaturas: [],
    cadeias: {},
  };
}

describe('contratoMetricasValido', () => {
  it('aceita apenas o contrato v2 completo e aritmeticamente coerente', () => {
    expect(contratoMetricasValido(blobV2Valido())).toBe(true);
  });

  it('suspende versão divergente, período ausente ou soma incoerente', () => {
    const versao = blobV2Valido();
    versao.metric_version = 'construction-v1';
    expect(contratoMetricasValido(versao)).toBe(false);

    const incompleto = blobV2Valido();
    incompleto.metricas_periodos = Object.fromEntries(
      Object.entries(incompleto.metricas_periodos ?? {}).filter(([chave]) => chave !== '14'),
    );
    expect(contratoMetricasValido(incompleto)).toBe(false);

    const incoerente = blobV2Valido();
    const construcao = incoerente.metricas_periodos?.['7']?.atual.construcao;
    if (construcao) construcao.total = 1;
    expect(contratoMetricasValido(incoerente)).toBe(false);
  });

  it('rejeita percentuais de offload e quota que não fecham com as contagens', () => {
    const incoerente = blobV2Valido();
    const recorte = incoerente.metricas_periodos?.['7']?.atual;
    if (!recorte) throw new Error('fixture sem período 7d');
    recorte.eventos = 20;
    Object.assign(recorte.construcao, {
      total: 20,
      julgados: 20,
      ok1: 16,
      retrabalho: 4,
      aceitas: 20,
      qualidade: 0.8,
      retrabalho_pct: 0.2,
      offload: 20,
      offload_pct: 0,
      quota_pct: 1,
    });
    expect(contratoMetricasValido(incoerente)).toBe(false);
  });

  it('mantém a série v1 em quarentena mesmo quando ela chega dentro de um blob v2', () => {
    const atual = {
      schema_version: 2,
      metric_version: 'construction-v2-2026-08-27',
      ts: '2026-08-27T15:00:00.000Z',
      janela_dias: 7,
      n: 20,
      ok1_pct: 0.8,
      offload_pct: 0.5,
      quota_hit_pct: 0,
      reciclo_pct: 0.2,
      dur_mediana_min: 10,
      por_frente: {},
    };
    expect(
      filtrarHistoricoCompativel([
        { ...atual, schema_version: undefined, metric_version: undefined },
        atual,
      ]),
    ).toEqual([atual]);
  });
});

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

  it('mantém infra em n, mas fora de qualidade e retrabalho', () => {
    const linhas = [
      ...Array.from({ length: 4 }, () => linha({ ts: tsDiasAtras(1), resultado: 'ok1' })),
      linha({ ts: tsDiasAtras(1), resultado: 'infra' }),
    ];
    const g = kpisGerais(linhas);
    expect(g).toMatchObject({ n: 5, julg: 4, ok1N: 4, recN: 0, infraN: 1 });
    expect(g.ok1).toBe(1);
    expect(g.reciclo).toBe(0);
    expect(contarInfra(linhas)).toBe(1);
  });

  it('conta quota e infra separadamente', () => {
    const g = kpisGerais([
      linha({ ts: tsDiasAtras(1), resultado: 'quota' }),
      linha({ ts: tsDiasAtras(1), resultado: 'infra' }),
    ]);
    expect(g).toMatchObject({ n: 2, julg: 0, quotaN: 1, infraN: 1 });
    expect(g.quotaHit).toBe(0.5);
  });

  it('separa revisão, papel inferido e descarte da qualidade de construção', () => {
    const linhas = [
      linha({ ts: tsDiasAtras(1), resultado: 'ok1' }),
      linha({ ts: tsDiasAtras(1), resultado: 'descartado' }),
      linha({ ts: tsDiasAtras(1), papel: 'revisor', resultado: 'retrabalho' }),
      linha({ ts: tsDiasAtras(1), papel_inferido: true, resultado: 'retrabalho' }),
      linha({ ts: tsDiasAtras(1), papel: undefined, resultado: 'retrabalho' }),
    ];
    expect(kpisGerais(linhas)).toMatchObject({ n: 2, julg: 1, ok1N: 1, descartadoN: 1 });
    expect(kpisGerais(linhas).ok1).toBe(1);
    expect(kpisRevisao(linhas)).toMatchObject({ total: 1, julg: 1, problemasN: 1, deteccao: 1 });
  });

  it('reproduz o fixture auditado sem misturar construção e revisão', () => {
    const fixture = [
      ...Array.from({ length: 34 }, () => linha({ ts: tsDiasAtras(1), resultado: 'ok1' })),
      ...Array.from({ length: 8 }, () => linha({ ts: tsDiasAtras(1), resultado: 'retrabalho' })),
      ...Array.from({ length: 23 }, () =>
        linha({ ts: tsDiasAtras(1), papel: 'revisor', resultado: 'retrabalho' }),
      ),
      ...Array.from({ length: 29 }, () =>
        linha({ ts: tsDiasAtras(1), papel: 'revisor', resultado: 'ok1' }),
      ),
    ];
    const construcao = kpisGerais(fixture);
    const revisao = kpisRevisao(fixture);
    expect(construcao.ok1).toBeCloseTo(34 / 42, 10);
    expect(construcao.reciclo).toBeCloseTo(8 / 42, 10);
    expect(revisao.deteccao).toBeCloseTo(23 / 52, 10);
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

  // Os 3 jeitos de não haver ▲/▼ precisam ser distinguíveis na tela: sem
  // registro nenhum · registro de menos · registro sem terreno declarado.
  // Iguais, o dono lê "instrumento quebrado" onde só falta tarefa medida.
  it('terreno sem nenhum despacho no período fica "vazio", não "dados"', () => {
    const t = kpisTerreno([classificada({ terreno: 'rotina', resultado: 'ok1' })], CADEIAS);
    expect(t.ui?.n).toBe(0);
    expect(t.ui?.sinal.tipo).toBe('vazio');
    expect(t.ui?.sinal.texto).toContain('sem dados');
  });

  it('amostra insuficiente diz "sem sinal" e mostra classificados/julgáveis', () => {
    const linhas = [
      ...Array.from({ length: 2 }, () => classificada({ terreno: 'ui', resultado: 'ok1' })),
      linha({ ts: tsDiasAtras(1), terreno: 'ui', resultado: 'ok1' }), // manual = ambígua
    ];
    const t = kpisTerreno(linhas, CADEIAS);
    expect(t.ui).toMatchObject({ n: 3, julgaveis: 3, ambiguos: 1, classificados: 2 });
    expect(t.ui?.sinal.tipo).toBe('dados');
    expect(t.ui?.sinal.texto).toContain('sem sinal');
    expect(t.ui?.sinal.texto).toContain('2/3');
  });

  it('sinal subir: ok1 < 70% com 20+ julgáveis', () => {
    const linhas = Array.from({ length: 20 }, (_, i) =>
      classificada({ terreno: 'dificil', resultado: i < 13 ? 'ok1' : 'retrabalho' }),
    );
    const t = kpisTerreno(linhas, CADEIAS);
    expect(t.dificil?.sinal.tipo).toBe('subir');
  });

  // Terreno com o modelo no teto (SQL/dinheiro em Opus 5): abaixo do piso NÃO
  // manda "subir modelo" — não há modelo pra cima. Manda subir o ESFORÇO.
  it('sinal esforco: ok1 < 70% com modelo no teto vira subir esforço, não subir modelo', () => {
    const linhas = Array.from({ length: 20 }, (_, i) =>
      classificada({ terreno: 'sql', resultado: i < 13 ? 'ok1' : 'retrabalho' }),
    );
    const t = kpisTerreno(linhas, CADEIAS);
    expect(t.sql?.sinal.tipo).toBe('esforco');
    expect(t.sql?.sinal.texto).toContain('high → max');
    expect(t.sql?.sinal.texto).toContain('modelo travado no topo');
  });

  // Esforço já no teto (high===max) e ainda abaixo do piso: a alavanca acabou,
  // o sinal vira "reforçar a revisão".
  it('sinal esforco: esforço esgotado no teto vira reforçar a revisão', () => {
    const cadeias: Record<string, CadeiaTerreno> = {
      ...CADEIAS,
      sql: { ...CADEIAS.sql, effort: 'max', effort_teto: 'max' } as CadeiaTerreno,
    };
    const linhas = Array.from({ length: 20 }, (_, i) =>
      classificada({ terreno: 'sql', resultado: i < 13 ? 'ok1' : 'retrabalho' }),
    );
    const t = kpisTerreno(linhas, cadeias);
    expect(t.sql?.sinal.tipo).toBe('esforco');
    expect(t.sql?.sinal.texto).toContain('reforçar a revisão');
  });

  it('sinal baratear: ok1 ≥ 90% com 20+ julgáveis e degrau não-piso', () => {
    const linhas = Array.from({ length: 20 }, () =>
      classificada({ terreno: 'dificil', resultado: 'ok1' }),
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

  it('conta infra sem transformar em reciclo', () => {
    const t = kpisTerreno(
      [
        linha({ ts: tsDiasAtras(1), terreno: 'rotina', resultado: 'ok1' }),
        linha({ ts: tsDiasAtras(1), terreno: 'rotina', resultado: 'infra' }),
      ],
      CADEIAS,
    );
    expect(t.rotina).toMatchObject({ n: 2, julgaveis: 1, ok1: 1, reciclo: 0, infra: 1 });
  });
});

describe('terrenoAmbiguo', () => {
  const auto = (parcial: Partial<LedgerLinha> = {}) =>
    linha({ ts: tsDiasAtras(1), auto: true, ...parcial });

  it('marca linha carimbada com terreno_inferido', () => {
    expect(terrenoAmbiguo(classificada({ terreno_inferido: true, terreno: 'sql' }))).toBe(true);
  });

  it('marca qualquer automático anterior à instrumentação, inclusive fora do default', () => {
    expect(terrenoAmbiguo(auto({ frente: 'codex', terreno: 'rotina' }))).toBe(true);
    expect(terrenoAmbiguo(auto({ frente: 'kimi', terreno: 'ui' }))).toBe(true);
    // antes do carimbo, terreno fora do default é indistinguível de declarado
    expect(terrenoAmbiguo(auto({ frente: 'codex', terreno: 'sql' }))).toBe(true);
  });

  // Buraco fechado no ledger.mjs em 14/08/2026: o guard antigo só olhava o
  // balde DEFAULT do run.sh, então o mesmo ruído passava pelo avesso — leitura
  // barata logada à mão como `dificil` inflava aquele balde.
  it('marca log manual do cérebro, mesmo depois da instrumentação', () => {
    expect(terrenoAmbiguo(linha({ ts: tsDiasAtras(1), terreno: 'dificil' }))).toBe(true);
    expect(terrenoAmbiguo(linha({ ts: TS_CLASSIFICADO, terreno: 'dificil' }))).toBe(true);
  });

  it('não marca o único caso classificado: automático pós-instrumentação sem a marca', () => {
    expect(terrenoAmbiguo(classificada({ frente: 'codex', terreno: 'rotina' }))).toBe(false);
    expect(terrenoAmbiguo(classificada({ frente: 'kimi', terreno: 'sql' }))).toBe(false);
  });

  // O corte tem de ser o instante REAL em que os run.sh passaram a carimbar
  // (2026-08-13T21:42:23Z). Arredondar para trás — como o 17:00Z anterior —
  // promove a "classificado" registro que ainda não tinha carimbo nenhum, e a
  // tela passa a discordar do `ledger.mjs report` sobre o mesmo dado.
  it('trata a janela entre o corte antigo e o real como AINDA não instrumentada', () => {
    const naJanela = { auto: true, terreno: 'dificil' as const };
    expect(terrenoAmbiguo(linha({ ts: '2026-08-13T17:00:01Z', ...naJanela }))).toBe(true);
    expect(terrenoAmbiguo(linha({ ts: '2026-08-13T21:42:22Z', ...naJanela }))).toBe(true);
    // a partir do instante real, automático sem a marca passa a valer
    expect(terrenoAmbiguo(linha({ ts: '2026-08-13T21:42:23Z', ...naJanela }))).toBe(false);
  });
});

describe('baldesPorDegrau', () => {
  it('agrega por degrau × terreno e só marca ambíguo com amostra e >30%', () => {
    const linhas = [
      // 20 julgáveis no degrau contaminado, 14 sem terreno declarado (70%)
      ...Array.from({ length: 14 }, () =>
        linha({
          ts: tsDiasAtras(1),
          modelo: 'gpt-5.6-sol',
          effort: 'high',
          resultado: 'ok1',
          auto: true,
        }),
      ),
      ...Array.from({ length: 6 }, () =>
        classificada({ modelo: 'gpt-5.6-sol', effort: 'high', resultado: 'ok1' }),
      ),
      // degrau limpo, mesmo terreno
      ...Array.from({ length: 20 }, () =>
        classificada({ modelo: 'gpt-5.6-luna', effort: 'max', resultado: 'ok1' }),
      ),
    ];
    const por = Object.fromEntries(baldesPorDegrau(linhas).map((b) => [b.degrau, b]));
    expect(por['codex/gpt-5.6-sol/high']).toMatchObject({
      terreno: 'rotina',
      julgaveis: 20,
      ambiguos: 14,
      ambiguo: true,
    });
    expect(por['codex/gpt-5.6-luna/max']).toMatchObject({ ambiguos: 0, ambiguo: false });
  });

  it('não marca ambíguo com amostra abaixo de 20 julgáveis', () => {
    const linhas = Array.from({ length: 19 }, () =>
      linha({ ts: tsDiasAtras(1), modelo: 'gpt-5.6-sol', effort: 'high', auto: true }),
    );
    expect(baldesPorDegrau(linhas)[0]).toMatchObject({ ambiguos: 19, ambiguo: false });
  });

  // Paridade com ledger.mjs (cmdReport): quota e infra saem do julgável E do
  // numerador de ambíguos. Contá-los só no numerador faria a razão passar de 1
  // — o ledger já viu isso (kimi × ui, 14d: 9 ambíguos sobre 7 julgáveis).
  it('deixa infra fora do julgável e do numerador de ambíguos', () => {
    const linhas = [
      ...Array.from({ length: 19 }, () =>
        classificada({ modelo: 'gpt-5.6-sol', effort: 'high', resultado: 'ok1' }),
      ),
      ...Array.from({ length: 6 }, () =>
        linha({
          ts: tsDiasAtras(1),
          modelo: 'gpt-5.6-sol',
          effort: 'high',
          resultado: 'infra',
          auto: true,
        }),
      ),
    ];
    const b = baldesPorDegrau(linhas)[0];
    // as 6 infra são `auto` (viriam do default do run.sh), mas não contaminam:
    // sem elas o balde é 19 julgáveis, 0 ambíguos → nenhum sinal suspenso.
    expect(b).toMatchObject({ n: 25, julgaveis: 19, infra: 6, ambiguos: 0, ambiguo: false });
  });
});

describe('kpisTerreno com balde ambíguo', () => {
  // 20 julgáveis: 7 ok1 → 35% de ok de 1ª, o que dispara "subir modelo".
  // 12 delas entraram sem terreno declarado (60% > 30%) → sinal suspenso.
  const contaminadas: LedgerLinha[] = [
    ...Array.from({ length: 12 }, (_, i) =>
      linha({
        ts: tsDiasAtras(1),
        modelo: 'gpt-5.6-sol',
        effort: 'high',
        resultado: i < 4 ? 'ok1' : 'retrabalho',
        auto: true,
      }),
    ),
    ...Array.from({ length: 8 }, (_, i) =>
      classificada({
        modelo: 'gpt-5.6-sol',
        effort: 'high',
        resultado: i < 3 ? 'ok1' : 'retrabalho',
      }),
    ),
  ];

  it('suprime o sinal de trocar o default e mostra a contagem', () => {
    const t = kpisTerreno(contaminadas, CADEIAS);
    expect(t.rotina?.ok1Pct).toBeCloseTo(7 / 20);
    expect(t.rotina?.sinal.tipo).toBe('ambiguo');
    expect(t.rotina?.ambiguo).toBe(true);
    expect(t.rotina?.ambiguos).toBe(12);
    expect(t.rotina?.degrausAmbiguos).toEqual([
      { degrau: 'codex/gpt-5.6-sol/high', ambiguos: 12, julgaveis: 20 },
    ]);
    // O motivo tem que vir com o tamanho da amostra classificada, no mesmo
    // padrão x/y do resto da tela — "suspenso" sem número não dá o que fazer.
    expect(t.rotina?.classificados).toBe(8);
    expect(t.rotina?.sinal.texto).toContain('8/20');
    expect(t.rotina?.sinal.texto).toContain('sem sinal');
  });

  it('degrau limpo no mesmo terreno não dilui o degrau contaminado', () => {
    // Somar o terreno inteiro daria 5/16 = 31%, à beira do limiar. A
    // contaminação se mede no degrau, como no ledger: segue suspenso.
    const t = kpisTerreno(
      [
        ...contaminadas,
        ...Array.from({ length: 8 }, () =>
          classificada({ modelo: 'gpt-5.6-luna', effort: 'max', resultado: 'ok1' }),
        ),
      ],
      CADEIAS,
    );
    expect(t.rotina?.sinal.tipo).toBe('ambiguo');
    expect(t.rotina?.degrausAmbiguos.map((d) => d.degrau)).toEqual(['codex/gpt-5.6-sol/high']);
  });

  it('terreno todo classificado segue emitindo sinal normalmente', () => {
    const t = kpisTerreno(
      contaminadas.map((l) => ({ ...l, auto: true, ts: TS_CLASSIFICADO })),
      CADEIAS,
    );
    expect(t.rotina?.ambiguo).toBe(false);
    expect(t.rotina?.sinal.tipo).toBe('subir');
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
    expect(placar[0]).toMatchObject({ n: 1, julg: 1, q: 1, custoTarefa: 30, valor: null });
    expect(placar[1]).toMatchObject({ n: 1, julg: 1, q: 0, custoTarefa: 10, valor: null });
    expect(placar[2]).toMatchObject({ n: 0, julg: 0, q: null, custoTarefa: null, valor: null });
  });

  it('retorna null no placar geral sem amostra suficiente', () => {
    expect(valorGeral([], ASSINATURAS_VALOR, 7)).toBeNull();
    expect(valorGeral(LINHAS_VALOR, ASSINATURAS_VALOR, 7)).toBeNull();
  });
});

// ── Autonomia ────────────────────────────────────────────────────────────────
const diaAtras = (dias: number) => new Date(AGORA - dias * 864e5).toISOString().slice(0, 10);

function autoDia(parcial: Partial<AutonomiaDia> & Pick<AutonomiaDia, 'data'>): AutonomiaDia {
  return {
    perguntas: 0,
    aceitou: 0,
    outra: 0,
    corrigiu: 0,
    ignorou: 0,
    esperas_longas: 0,
    espera_mediana_min: null,
    espera_p90_min: null,
    ...parcial,
  };
}

function blob(dias: AutonomiaDia[], n2: AutonomiaBlob['n2'] = null): AutonomiaBlob {
  return { dias: 90, gerado_em: new Date(AGORA).toISOString(), perguntas_por_dia: dias, n2 };
}

describe('autonomia', () => {
  it('sem coletor devolve o agregado vazio, sem NaN', () => {
    const k = kpisAutonomia(null, 7, AGORA);
    expect(k.perguntas).toBe(0);
    expect(k.perguntasPorDia).toBeNull();
    expect(k.aceitePct).toBeNull();
    expect(k.n2DesfeitasPct).toBeNull();
    expect(k.veredito.tipo).toBe('ok');
  });

  it('janela sem dia dentro do período não conta nada', () => {
    const k = kpisAutonomia(
      blob([autoDia({ data: diaAtras(30), perguntas: 40, aceitou: 40 })]),
      7,
      AGORA,
    );
    expect(k.perguntas).toBe(0);
    expect(k.aceitePct).toBeNull();
  });

  it('um dia só: soma, média por dia e percentuais', () => {
    const k = kpisAutonomia(
      blob([
        autoDia({
          data: diaAtras(1),
          perguntas: 10,
          aceitou: 5,
          outra: 2,
          corrigiu: 2,
          ignorou: 1,
          esperas_longas: 3,
          espera_mediana_min: 8,
        }),
      ]),
      7,
      AGORA,
    );
    expect(k.perguntas).toBe(10);
    expect(k.perguntasPorDia).toBe(10);
    expect(k.aceitePct).toBe(0.5);
    expect(k.correcoesPct).toBeCloseTo(0.2, 10);
    expect(k.ignorouPct).toBeCloseTo(0.1, 10);
    expect(k.esperasLongas).toBe(3);
    expect(k.esperaMedianaMin).toBe(8);
    expect(k.veredito.tipo).toBe('ok');
  });

  it('aceite de 80% ou mais acusa pergunta demais', () => {
    const k = kpisAutonomia(
      blob([autoDia({ data: diaAtras(1), perguntas: 10, aceitou: 8, corrigiu: 2 })]),
      7,
      AGORA,
    );
    expect(k.aceitePct).toBeCloseTo(0.8, 10);
    expect(k.veredito.tipo).toBe('perguntando-demais');
  });

  it('n2: recorta por janela, calcula o % desfeito e o veredito vence o aceite', () => {
    const k = kpisAutonomia(
      blob([autoDia({ data: diaAtras(1), perguntas: 10, aceitou: 9, corrigiu: 1 })], {
        carimbadas: 14,
        desfeitas: 4,
        por_dia: {
          [diaAtras(1)]: { carimbadas: 10, desfeitas: 2 },
          [diaAtras(40)]: { carimbadas: 4, desfeitas: 2 }, // fora da janela
        },
      }),
      7,
      AGORA,
    );
    expect(k.n2Carimbadas).toBe(10);
    expect(k.n2Desfeitas).toBe(2);
    expect(k.n2DesfeitasPct).toBeCloseTo(0.2, 10);
    expect(k.veredito.tipo).toBe('decidindo-demais');
  });

  it('n2 zerado não vira divisão por zero', () => {
    const k = kpisAutonomia(
      blob([autoDia({ data: diaAtras(1), perguntas: 4, aceitou: 1, corrigiu: 3 })], {
        carimbadas: 0,
        desfeitas: 0,
        por_dia: {},
      }),
      7,
      AGORA,
    );
    expect(k.n2Carimbadas).toBe(0);
    expect(k.n2DesfeitasPct).toBeNull();
    expect(k.veredito.tipo).toBe('ok');
  });
});
