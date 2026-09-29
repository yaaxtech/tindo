import { describe, expect, it } from 'vitest';
import {
  CONFIANCA_MINIMA,
  ETIQUETA_IA,
  ETIQUETA_REVISAR,
  type ItemEntrada,
  montarPlano,
  precisaTriagem,
} from './plano';
import type { RespostaTriagem } from './prompt';

const item: ItemEntrada = {
  id: 't1',
  conteudo: 'Ver preço palheta aerador',
  projetoId: 'inbox',
  etiquetas: ['urgente'],
  prioridadeApi: 1,
  vencimento: null,
};

const ctx = {
  projetosValidos: new Set(['inbox', 'maioli']),
  etiquetasExistentes: new Map([
    ['maioli', 'Maioli'],
    ['urgente', 'urgente'],
    ['ia', 'IA'],
  ]),
  frentesValidas: new Set(['f1']),
};

function resposta(extra: Partial<RespostaTriagem> = {}): RespostaTriagem {
  return {
    tipo: 'lembrete',
    projeto_id: 'maioli',
    etiquetas: ['maioli'],
    prioridade: 2,
    quando: 'hoje_tarde',
    frente_existente_id: 'f1',
    confianca: 0.9,
    explicacao: 'Compra da Maioli',
    ...extra,
  };
}

describe('montarPlano', () => {
  it('aplica projeto, etiquetas existentes (com a grafia dele), prioridade e marca IA', () => {
    const plano = montarPlano(item, resposta(), ctx);
    expect(plano.revisar).toBe(false);
    expect(plano.depois).toEqual({
      projetoId: 'maioli',
      etiquetas: ['urgente', 'Maioli', ETIQUETA_IA],
      prioridadeApi: 3,
      vencimento: null,
    });
    expect(plano.antes).toEqual({
      projetoId: 'inbox',
      etiquetas: ['urgente'],
      prioridadeApi: 1,
      vencimento: null,
    });
    expect(plano.quando).toBe('hoje_tarde');
    expect(plano.frenteExistenteId).toBe('f1');
  });

  it('com confiança baixa não mexe em nada além de marcar para revisar', () => {
    const plano = montarPlano(item, resposta({ confianca: CONFIANCA_MINIMA - 0.01 }), ctx);
    expect(plano.revisar).toBe(true);
    expect(plano.depois).toEqual({ ...plano.antes, etiquetas: ['urgente', ETIQUETA_REVISAR] });
    expect(plano.quando).toBe('sem_data');
  });

  it('descarta projeto e etiquetas inventados pela IA', () => {
    const plano = montarPlano(
      item,
      resposta({ projeto_id: 'nao-existe', etiquetas: ['Inventada', 'IA'] }),
      ctx,
    );
    expect(plano.revisar).toBe(true);
    expect(plano.avisos).toHaveLength(2);
    expect(plano.depois.projetoId).toBe('inbox');
  });

  it('mantém a data que já existia e ignora frente desconhecida', () => {
    const plano = montarPlano(
      { ...item, vencimento: '2026-10-01' },
      resposta({ frente_existente_id: 'zzz' }),
      ctx,
    );
    expect(plano.quando).toBe('manter');
    expect(plano.depois.vencimento).toBe('2026-10-01');
    expect(plano.frenteExistenteId).toBeNull();
  });
});

describe('precisaTriagem', () => {
  it('pula o que já passou pela IA', () => {
    expect(precisaTriagem(['x'])).toBe(true);
    expect(precisaTriagem(['ia'])).toBe(false);
    expect(precisaTriagem(['IA.revisar'])).toBe(false);
  });
});

describe('lerRespostaTriagem', () => {
  it('normaliza valores fora do contrato', async () => {
    const { lerRespostaTriagem } = await import('./prompt');
    expect(
      lerRespostaTriagem({
        tipo: 'x',
        projeto_id: '',
        etiquetas: 'a',
        prioridade: 9,
        quando: 'ontem',
        confianca: 3,
      }),
    ).toEqual({
      tipo: 'tarefa',
      projeto_id: null,
      etiquetas: [],
      prioridade: 4,
      quando: 'sem_data',
      frente_existente_id: null,
      confianca: 1,
      explicacao: '',
    });
  });
});
