import type { Assinatura, GithubRunLinha, LedgerLinha } from '@/types/harness';
import { describe, expect, it } from 'vitest';
import {
  LIMIARES,
  ROTULO_ALERTA,
  type Violacao,
  avaliarGithub,
  avaliarKpis,
  avaliarLedger,
  decidirAvaliacao,
  reconferirLedger,
} from './alertas';

const AGORA = Date.parse('2026-08-13T12:00:00Z');
const DIA = 864e5;
const MIN = 60_000;
const iso = (msAtras: number) => new Date(AGORA - msAtras).toISOString();

const ASSINATURAS: Assinatura[] = [
  { nome: 'Anthropic', frente: 'claude', valor: 200, renova: '2026-08-22', papel: 'cérebro' },
  { nome: 'OpenAI', frente: 'codex', valor: 100, renova: '2026-08-27', papel: 'construtor' },
  { nome: 'Kimi', frente: 'kimi', valor: 20, renova: '2026-08-27', papel: 'UI' },
];

function linha(parcial: Partial<LedgerLinha> = {}): LedgerLinha {
  return {
    ts: iso(2 * DIA),
    frente: 'codex',
    modelo: 'gpt-5.6-luna',
    effort: 'max',
    terreno: 'rotina',
    resultado: 'ok1',
    tarefa: 'x',
    nota: null,
    dur: null,
    ...parcial,
  };
}

/** n despachos, dos quais `ok` com ok1 e o resto retrabalho. */
const ledgerCom = (n: number, ok: number, extra: Partial<LedgerLinha> = {}): LedgerLinha[] =>
  Array.from({ length: n }, (_, i) =>
    linha({ resultado: i < ok ? 'ok1' : 'retrabalho', ...extra }),
  );

const codigos = (vs: { codigo: string }[]) => vs.map((v) => v.codigo);

describe('avaliarLedger', () => {
  it('não dispara nada com amostra menor que 5, mesmo com tudo errado', () => {
    const violacoes = avaliarLedger(ledgerCom(4, 0), ASSINATURAS, AGORA);
    expect(codigos(violacoes)).not.toContain('qualidade_baixa');
    expect(codigos(violacoes)).not.toContain('retrabalho_alto');
  });

  it('marca qualidade como alerta entre 70% e 80%', () => {
    // 10 despachos, 7 ok1 → 70% (>= crítico, < alerta)
    const violacoes = avaliarLedger(ledgerCom(10, 7), ASSINATURAS, AGORA);
    const q = violacoes.find((v) => v.codigo === 'qualidade_baixa');
    expect(q).toMatchObject({ severidade: 'alerta', valor: 0.7, limiar: LIMIARES.qualidadeAlerta });
    expect(q?.amostra).toBe(10);
  });

  it('marca qualidade como crítica abaixo de 70%', () => {
    const violacoes = avaliarLedger(ledgerCom(10, 6), ASSINATURAS, AGORA);
    expect(violacoes.find((v) => v.codigo === 'qualidade_baixa')?.severidade).toBe('critico');
  });

  it('não reclama de qualidade em 80% cravado', () => {
    const violacoes = avaliarLedger(ledgerCom(10, 8), ASSINATURAS, AGORA);
    expect(codigos(violacoes)).not.toContain('qualidade_baixa');
  });

  it('marca retrabalho crítico acima de 35% e alerta acima de 20%', () => {
    const critico = avaliarLedger(ledgerCom(10, 6), ASSINATURAS, AGORA); // 40% retrabalho
    expect(critico.find((v) => v.codigo === 'retrabalho_alto')?.severidade).toBe('critico');

    const alerta = avaliarLedger(ledgerCom(10, 7), ASSINATURAS, AGORA); // 30% retrabalho
    expect(alerta.find((v) => v.codigo === 'retrabalho_alto')?.severidade).toBe('alerta');

    const limpo = avaliarLedger(ledgerCom(10, 8), ASSINATURAS, AGORA); // 20% cravado
    expect(codigos(limpo)).not.toContain('retrabalho_alto');
  });

  it('dispara custo por tarefa acima de $5 e cita a amostra de aceitas', () => {
    // $320/mês em 14 dias ≈ $149,33; com 10 aceitas dá ~$14,93 por tarefa.
    const violacoes = avaliarLedger(ledgerCom(10, 10), ASSINATURAS, AGORA);
    const custo = violacoes.find((v) => v.codigo === 'custo_alto');
    expect(custo?.severidade).toBe('alerta');
    expect(custo?.valor).toBeGreaterThan(5);
    expect(custo?.amostra).toBe(10);
  });

  it('não dispara custo quando o volume dilui a assinatura', () => {
    const violacoes = avaliarLedger(ledgerCom(60, 60), ASSINATURAS, AGORA);
    expect(codigos(violacoes)).not.toContain('custo_alto');
  });

  it('dispara quota alta acima de 15%', () => {
    const linhas = [
      ...ledgerCom(6, 6),
      linha({ resultado: 'quota' }),
      linha({ resultado: 'quota' }),
    ];
    const violacoes = avaliarLedger(linhas, ASSINATURAS, AGORA);
    const quota = violacoes.find((v) => v.codigo === 'quota_alta');
    expect(quota?.valor).toBeCloseTo(0.25, 5);
    expect(codigos(violacoes)).not.toContain('quota_zerada');
  });

  it('dispara quota zerada quando ninguém bateu no limite na janela inteira', () => {
    const violacoes = avaliarLedger(ledgerCom(10, 10), ASSINATURAS, AGORA);
    expect(codigos(violacoes)).toContain('quota_zerada');
  });

  it('dispara placar de valor abaixo de 55', () => {
    // Qualidade 50% + custo alto → placar bem abaixo de 55.
    const violacoes = avaliarLedger(ledgerCom(10, 5), ASSINATURAS, AGORA);
    const valor = violacoes.find((v) => v.codigo === 'valor_baixo');
    expect(valor?.limiar).toBe(55);
    expect(valor?.valor).toBeLessThan(55);
  });

  it('ignora linhas fora da janela de 14 dias', () => {
    const antigas = ledgerCom(20, 0, { ts: iso(30 * DIA) });
    const violacoes = avaliarLedger(antigas, ASSINATURAS, AGORA);
    expect(violacoes).toEqual([]);
  });

  it('ignora pendentes — eles não são julgáveis', () => {
    const linhas = [...ledgerCom(5, 5), ...ledgerCom(20, 0, { resultado: 'pendente' })];
    const violacoes = avaliarLedger(linhas, ASSINATURAS, AGORA);
    expect(codigos(violacoes)).not.toContain('qualidade_baixa');
  });
});

let proximoRun = 1;

function run(parcial: Partial<GithubRunLinha> = {}): GithubRunLinha {
  return {
    run_id: proximoRun++,
    repo: 'yaaxtech/tindo',
    evento: 'pull_request',
    branch: 'feat/x',
    head_sha: `sha-${proximoRun}`,
    conclusao: 'success',
    criado_em: iso(DIA),
    iniciado_em: iso(DIA),
    atualizado_em: iso(DIA),
    pr_numero: null,
    pr_criado_em: null,
    pr_merged_em: null,
    ...parcial,
  };
}

/** Run de PR cujo CI durou `segundos`, criado `diasAtras` atrás. */
function runExec(diasAtras: number, segundos: number): GithubRunLinha {
  const criado = diasAtras * DIA;
  return run({
    criado_em: iso(criado),
    iniciado_em: iso(criado),
    atualizado_em: iso(criado - segundos * 1000),
  });
}

/** Run verde + PR mergeado `segundos` depois do CI ficar verde. */
function runMerge(diasAtras: number, segundos: number, pr: number): GithubRunLinha {
  const criado = diasAtras * DIA;
  return run({
    criado_em: iso(criado),
    iniciado_em: iso(criado),
    atualizado_em: iso(criado - 60_000),
    pr_numero: pr,
    pr_criado_em: iso(criado),
    pr_merged_em: iso(criado - 60_000 - segundos * 1000),
  });
}

describe('avaliarGithub', () => {
  it('não dispara com menos de 3 runs na semana corrente', () => {
    // Referência completa (4 semanas rápidas): o único motivo de silêncio é a
    // amostra de 2 runs na semana corrente.
    const anteriores = [8, 9, 15, 16, 22, 23, 29, 30].map((d) => runExec(d, 10));
    const corrente = [1, 2].map((d) => runExec(d, 6000));
    expect(avaliarGithub([...anteriores, ...corrente], AGORA)).toEqual([]);
  });

  it('não dispara sem pelo menos 2 semanas anteriores de referência', () => {
    const runs = [1, 2, 3].map((d) => runExec(d, 6000));
    expect(avaliarGithub(runs, AGORA)).toEqual([]);
  });

  it('dispara o segmento quando o p50 passa de 1,5× a mediana das 4 semanas', () => {
    const anteriores = [8, 9, 15, 16, 22, 23, 29, 30].map((d) => runExec(d, 100));
    const corrente = [1, 2, 3].map((d) => runExec(d, 400));
    const violacoes = avaliarGithub([...anteriores, ...corrente], AGORA);
    const exec = violacoes.find((v) => v.codigo === 'segmento_exec_ci');
    expect(exec).toMatchObject({ severidade: 'alerta', valor: 400, limiar: 150, amostra: 3 });
  });

  it('não dispara o segmento quando a piora fica abaixo de 1,5×', () => {
    const anteriores = [8, 9, 15, 16, 22, 23, 29, 30].map((d) => runExec(d, 100));
    const corrente = [1, 2, 3].map((d) => runExec(d, 140));
    expect(codigos(avaliarGithub([...anteriores, ...corrente], AGORA))).not.toContain(
      'segmento_exec_ci',
    );
  });

  it('dispara espera de merge acima de 60 minutos', () => {
    const runs = [runMerge(1, 90 * 60, 101), runMerge(2, 95 * 60, 102), runMerge(3, 100 * 60, 103)];
    const espera = avaliarGithub(runs, AGORA).find((v) => v.codigo === 'espera_merge_longa');
    expect(espera).toMatchObject({ limiar: 3600, amostra: 3 });
    expect(espera?.valor).toBeGreaterThan(3600);
  });

  it('não dispara espera de merge dentro de 60 minutos', () => {
    const runs = [runMerge(1, 10 * 60, 201), runMerge(2, 20 * 60, 202), runMerge(3, 30 * 60, 203)];
    expect(codigos(avaliarGithub(runs, AGORA))).not.toContain('espera_merge_longa');
  });

  it('não usa mediana zero como régua', () => {
    const anteriores = [8, 9, 15, 16, 22, 23, 29, 30].map((d) => runExec(d, 0));
    const corrente = [1, 2, 3].map((d) => runExec(d, 30));
    expect(codigos(avaliarGithub([...anteriores, ...corrente], AGORA))).not.toContain(
      'segmento_exec_ci',
    );
  });
});

describe('decidirAvaliacao', () => {
  const semRenovacaoProxima: Assinatura[] = [
    { nome: 'X', frente: 'codex', valor: 100, renova: '2026-09-30', papel: 'p' },
  ];

  it('avalia na primeira vez, sem histórico', () => {
    expect(
      decidirAvaliacao({ ultimaEm: null, assinaturas: semRenovacaoProxima, agora: AGORA }),
    ).toMatchObject({ deve: true, motivo: 'periodico' });
  });

  it('espera os 14 dias entre ciclos periódicos', () => {
    const recente = new Date(AGORA - 10 * DIA).toISOString();
    expect(
      decidirAvaliacao({ ultimaEm: recente, assinaturas: semRenovacaoProxima, agora: AGORA }),
    ).toMatchObject({ deve: false, motivo: null });

    const antiga = new Date(AGORA - 14 * DIA).toISOString();
    expect(
      decidirAvaliacao({ ultimaEm: antiga, assinaturas: semRenovacaoProxima, agora: AGORA }),
    ).toMatchObject({ deve: true, motivo: 'periodico' });
  });

  it('não avalia duas vezes no mesmo dia', () => {
    const hojeCedo = new Date(AGORA - 6 * 60 * MIN).toISOString();
    expect(
      decidirAvaliacao({ ultimaEm: hojeCedo, assinaturas: ASSINATURAS, agora: AGORA }),
    ).toMatchObject({ deve: false });
  });

  it('avalia 3 dias antes de uma renovação, mesmo com ciclo em dia', () => {
    // Renovação em 2026-08-22 → janela abre em 19/08.
    const agora = Date.parse('2026-08-19T06:00:00Z');
    const ontem = new Date(agora - 2 * DIA).toISOString();
    expect(decidirAvaliacao({ ultimaEm: ontem, assinaturas: ASSINATURAS, agora })).toMatchObject({
      deve: true,
      motivo: 'pre_renovacao',
    });
  });

  it('não repete a avaliação de renovação dentro da mesma janela', () => {
    const agora = Date.parse('2026-08-20T06:00:00Z');
    const jaAvaliou = '2026-08-19T06:00:00.000Z';
    expect(
      decidirAvaliacao({ ultimaEm: jaAvaliou, assinaturas: ASSINATURAS, agora }),
    ).toMatchObject({ deve: false, motivo: null });
  });

  it('reavalia em D-2 se o cron falhou em D-3', () => {
    const agora = Date.parse('2026-08-20T06:00:00Z');
    const antesDaJanela = '2026-08-17T06:00:00.000Z';
    expect(
      decidirAvaliacao({ ultimaEm: antesDaJanela, assinaturas: ASSINATURAS, agora }),
    ).toMatchObject({ deve: true, motivo: 'pre_renovacao' });
  });

  it('não avalia por renovação depois que a data passou', () => {
    const agora = Date.parse('2026-08-23T06:00:00Z');
    const ontem = new Date(agora - DIA).toISOString();
    expect(decidirAvaliacao({ ultimaEm: ontem, assinaturas: ASSINATURAS, agora })).toMatchObject({
      deve: false,
    });
  });
});

describe('avaliarKpis', () => {
  it('junta ledger e GitHub e todo código tem rótulo em português', () => {
    const anteriores = [8, 9, 15, 16, 22, 23, 29, 30].map((d) => runExec(d, 100));
    const corrente = [1, 2, 3].map((d) => runExec(d, 400));
    const violacoes = avaliarKpis({
      ledger: ledgerCom(10, 6),
      assinaturas: ASSINATURAS,
      runs: [...anteriores, ...corrente],
      agora: AGORA,
    });
    expect(codigos(violacoes)).toContain('qualidade_baixa');
    expect(codigos(violacoes)).toContain('segmento_exec_ci');
    for (const v of violacoes) expect(ROTULO_ALERTA[v.codigo]).toBeTruthy();
  });

  it('devolve lista vazia quando não há dado nenhum', () => {
    expect(avaliarKpis({ ledger: [], assinaturas: ASSINATURAS, runs: [], agora: AGORA })).toEqual(
      [],
    );
  });
});

describe('reconferirLedger', () => {
  const gravado = (parcial: Partial<Violacao> & { codigo: Violacao['codigo'] }): Violacao => ({
    severidade: 'alerta',
    valor: 0.71,
    limiar: 0.8,
    amostra: 112,
    ...parcial,
  });

  it('descarta o alerta do ledger que não viola mais', () => {
    const vigentes = [gravado({ codigo: 'qualidade_baixa' })];
    expect(reconferirLedger(vigentes, [])).toEqual([]);
  });

  it('troca valor, amostra e severidade pelos de agora', () => {
    const vigentes = [gravado({ codigo: 'qualidade_baixa', severidade: 'critico' })];
    const atuais: Violacao[] = [
      { codigo: 'qualidade_baixa', severidade: 'alerta', valor: 0.75, limiar: 0.8, amostra: 103 },
    ];
    expect(reconferirLedger(vigentes, atuais)).toEqual(atuais);
  });

  it('preserva campos extras da linha gravada (id, avaliacao_id)', () => {
    const vigentes = [{ ...gravado({ codigo: 'retrabalho_alto' }), id: 'a1' }];
    const atuais: Violacao[] = [
      { codigo: 'retrabalho_alto', severidade: 'alerta', valor: 0.25, limiar: 0.2, amostra: 103 },
    ];
    expect(reconferirLedger(vigentes, atuais)[0]).toMatchObject({ id: 'a1', valor: 0.25 });
  });

  it('não toca nos alertas do GitHub, que dependem de dado que a tela pode não ter', () => {
    const github = gravado({ codigo: 'segmento_deploy', valor: 5400, limiar: 3600, amostra: 4 });
    expect(reconferirLedger([github], [])).toEqual([github]);
  });

  it('ignora violação de agora que não estava gravada — a faixa só some, nunca inventa', () => {
    const atuais: Violacao[] = [
      { codigo: 'custo_alto', severidade: 'alerta', valor: 7.5, limiar: 5, amostra: 12 },
    ];
    expect(reconferirLedger([], atuais)).toEqual([]);
  });
});
