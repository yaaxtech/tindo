import type { JanelaBlob, JanelaCampo } from '@/types/harness';
import { describe, expect, it } from 'vitest';
import {
  JANELA_LIMIAR_MS,
  estadoJanela,
  formatarAcimaTeto,
  formatarHoraColeta,
  formatarMedia,
  formatarNumero,
  formatarPct,
  formatarTokens,
} from './janela';

// Amostra SINTÉTICA no formato do contrato do blob (docs do painel).
const AGORA = Date.parse('2026-08-13T21:30:00.000Z');

function blob(over: Partial<JanelaBlob> = {}): JanelaBlob {
  return {
    gerado_em: '2026-08-13T21:00:00.000Z',
    dias: 14,
    totais: {
      sessoes: 1074,
      chamadas: 89000,
      tokens: 18700000000,
      cache_read: 17800000000,
      output: 93000000,
    },
    kpis: {
      pct_prefixo: 0.96,
      pct_pos_200: 0.466,
      sessoes_acima_teto: { n: 74, pct: 0.069, teto: 200 },
      tokens_por_tarefa: 161000000,
      gestos: { subagentes: 210, chips: 12, compacts: 5, por_sessao: 0.21 },
    },
    por_modelo: [{ modelo: 'claude-opus-5', chamadas: 20695, tokens: 3627900000, pct: 0.194 }],
    faixas: [{ faixa: '0-50', sessoes: 657, tokens: 700000000, pct: 0.037 }],
    top_sessoes: [{ id: '4a4bb799', chamadas: 972, tokens: 316200000, modelo: 'claude-opus-5' }],
    ...over,
  };
}

describe('estadoJanela', () => {
  it('dado normal → ok, sem aviso de velhice', () => {
    const estado = estadoJanela(blob(), AGORA);
    expect(estado.tipo).toBe('ok');
    if (estado.tipo !== 'ok') throw new Error('esperava ok');
    expect(estado.velho).toBe(false);
    expect(estado.blob.totais.sessoes).toBe(1074);
  });

  it('campo ausente (undefined) ou null → ausente, nunca zeros', () => {
    expect(estadoJanela(undefined, AGORA).tipo).toBe('ausente');
    expect(estadoJanela(null, AGORA).tipo).toBe('ausente');
  });

  it('campo com "erro" → estado de erro com a mensagem, sem números', () => {
    const campo: JanelaCampo = {
      erro: 'falha ao ler o log local',
      gerado_em: '2026-08-13T21:00:00.000Z',
    };
    const estado = estadoJanela(campo, AGORA);
    expect(estado.tipo).toBe('erro');
    if (estado.tipo !== 'erro') throw new Error('esperava erro');
    expect(estado.mensagem).toContain('falha ao ler o log local');
  });

  it('gerado_em com mais de 6h → ok mas velho (aviso, números continuam)', () => {
    const velhoPorPouco = blob({ gerado_em: new Date(AGORA - JANELA_LIMIAR_MS - 1).toISOString() });
    const estado = estadoJanela(velhoPorPouco, AGORA);
    expect(estado.tipo).toBe('ok');
    if (estado.tipo !== 'ok') throw new Error('esperava ok');
    expect(estado.velho).toBe(true);
  });

  it('gerado_em dentro de 6h não é velho', () => {
    const fresco = blob({ gerado_em: new Date(AGORA - JANELA_LIMIAR_MS + 1000).toISOString() });
    const estado = estadoJanela(fresco, AGORA);
    expect(estado.tipo).toBe('ok');
    if (estado.tipo !== 'ok') throw new Error('esperava ok');
    expect(estado.velho).toBe(false);
  });

  it('gerado_em inválido conta como velho — nunca finge frescor', () => {
    const estado = estadoJanela(blob({ gerado_em: 'não-é-data' }), AGORA);
    expect(estado.tipo).toBe('ok');
    if (estado.tipo !== 'ok') throw new Error('esperava ok');
    expect(estado.velho).toBe(true);
  });

  it('kpis com null: formatações devolvem "—" em vez de quebrar', () => {
    const nulo = blob({
      kpis: {
        pct_prefixo: null,
        pct_pos_200: null,
        sessoes_acima_teto: null,
        tokens_por_tarefa: null,
        gestos: null,
      },
    });
    const estado = estadoJanela(nulo, AGORA);
    expect(estado.tipo).toBe('ok');
    expect(formatarPct(nulo.kpis.pct_prefixo)).toBe('—');
    expect(formatarPct(nulo.kpis.pct_pos_200)).toBe('—');
    expect(formatarTokens(nulo.kpis.tokens_por_tarefa)).toBe('—');
    expect(formatarAcimaTeto(nulo.kpis.sessoes_acima_teto, nulo.totais.sessoes)).toBe('—');
    expect(formatarMedia(nulo.kpis.gestos?.por_sessao ?? null)).toBe('—');
  });
});

describe('formatação pt-BR', () => {
  it('percentual com vírgula e no máximo 1 casa', () => {
    expect(formatarPct(0.069)).toBe('6,9%');
    expect(formatarPct(0.96)).toBe('96%');
    expect(formatarPct(0.466)).toBe('46,6%');
  });

  it('número com ponto de milhar', () => {
    expect(formatarNumero(1074)).toBe('1.074');
  });

  it('tokens em forma curta', () => {
    expect(formatarTokens(161000000)).toBe('161 M');
    expect(formatarTokens(18700000000)).toBe('18,7 bi');
    expect(formatarTokens(12345)).toBe('12 mil');
    expect(formatarTokens(950)).toBe('950');
    expect(formatarTokens(null)).toBe('—');
  });

  it('sessões acima do teto sempre com amostra n/N junto do %', () => {
    expect(formatarAcimaTeto({ n: 74, pct: 0.069, teto: 200 }, 1074)).toBe('74 de 1.074 (6,9%)');
  });

  it('média por sessão com vírgula', () => {
    expect(formatarMedia(0.21)).toBe('0,21');
  });

  it('hora da coleta em pt-BR', () => {
    expect(formatarHoraColeta('2026-08-13T21:00:00.000Z')).toMatch(/\d{2}:\d{2}/);
    expect(formatarHoraColeta('não-é-data')).toBe('—');
  });
});
