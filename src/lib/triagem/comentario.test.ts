import { describe, expect, it } from 'vitest';
import {
  type CamposTriagem,
  MARCA_REVISAO,
  MARCA_SUGESTAO,
  camposAlterados,
  estadoPorTarefa,
  formatarRevisao,
  lerComentario,
} from './comentario';

const base: CamposTriagem = {
  tipo: 'lembrete',
  projetoId: 'p-maioli',
  etiquetas: ['maioli'],
  prioridade: 'P3',
  quando: 'amanhã, manhã',
  delegar: true,
};

function sugestao(extra: Record<string, unknown> = {}) {
  return `${MARCA_SUGESTAO}\nLembrete da Maioli.\n\n\`\`\`json\n${JSON.stringify({ ...base, confianca: 0.8, porque: 'Herikmar é da Maioli.', ...extra })}\n\`\`\``;
}

describe('lerComentario', () => {
  it('lê a sugestão do vigia', () => {
    const c = lerComentario(sugestao());
    expect(c?.tipo).toBe('sugestao');
    expect(c?.dados).toMatchObject({ ...base, confianca: 0.8, porque: 'Herikmar é da Maioli.' });
  });

  it('ignora comentários comuns e JSON quebrado', () => {
    expect(lerComentario('Liguei pro Lino, volta amanhã')).toBeNull();
    expect(lerComentario(`${MARCA_SUGESTAO}\n\`\`\`json\n{quebrado\n\`\`\``)).toBeNull();
  });

  it('recusa campos fora do contrato', () => {
    expect(lerComentario(sugestao({ prioridade: 'P9' }))).toBeNull();
    expect(lerComentario(sugestao({ tipo: 'nota' }))).toBeNull();
  });

  it('limita a confiança entre 0 e 1', () => {
    const c = lerComentario(sugestao({ confianca: 7 }));
    expect(c?.tipo === 'sugestao' && c.dados.confianca).toBe(1);
  });

  it('fica na Entrada quando o projeto vem vazio', () => {
    const c = lerComentario(sugestao({ projetoId: '' }));
    expect(c?.dados.projetoId).toBeNull();
  });
});

describe('camposAlterados', () => {
  it('não conta ordem nem caixa das etiquetas', () => {
    expect(camposAlterados(base, { ...base, etiquetas: ['Maioli'] })).toEqual([]);
  });

  it('aponta o que mudou', () => {
    expect(camposAlterados(base, { ...base, projetoId: 'p-seucamarao', prioridade: 'P1' })).toEqual(
      ['projetoId', 'prioridade'],
    );
  });
});

describe('formatarRevisao', () => {
  const nome = (id: string | null) => (id ? `proj ${id}` : 'Entrada');

  it('sem mudança vira aprovado e volta legível pelo leitor', () => {
    const { texto, revisao } = formatarRevisao(base, base, '', nome);
    expect(revisao.status).toBe('aprovado');
    expect(texto.startsWith(MARCA_REVISAO)).toBe(true);
    expect(lerComentario(texto)).toEqual({ tipo: 'revisao', dados: revisao });
  });

  it('com mudança vira corrigido e guarda o motivo', () => {
    const { texto, revisao } = formatarRevisao(
      { ...base, projetoId: 'p-seucamarao' },
      base,
      '  Aqualitas é do SeuCamarão ',
      nome,
    );
    expect(revisao).toMatchObject({ status: 'corrigido', nota: 'Aqualitas é do SeuCamarão' });
    expect(texto).toContain('Motivo: Aqualitas é do SeuCamarão');
    expect(texto).toContain('proj p-seucamarao');
  });
});

describe('estadoPorTarefa', () => {
  const rev = formatarRevisao(base, base, '', () => '').texto;

  it('junta sugestão e revisão da mesma tarefa, em ordem de tempo', () => {
    const m = estadoPorTarefa([
      { tarefaId: 't1', texto: rev, em: '2026-09-29T12:00:00Z' },
      { tarefaId: 't1', texto: sugestao(), em: '2026-09-29T10:00:00Z' },
      { tarefaId: 't2', texto: 'comentário qualquer', em: '2026-09-29T10:00:00Z' },
    ]);
    expect([...m.keys()]).toEqual(['t1']);
    expect(m.get('t1')?.revisao?.status).toBe('aprovado');
  });

  it('sugestão nova depois da revisão volta a ficar pendente', () => {
    const m = estadoPorTarefa([
      { tarefaId: 't1', texto: sugestao(), em: '2026-09-29T10:00:00Z' },
      { tarefaId: 't1', texto: rev, em: '2026-09-29T11:00:00Z' },
      { tarefaId: 't1', texto: sugestao({ prioridade: 'P1' }), em: '2026-09-30T10:00:00Z' },
    ]);
    expect(m.get('t1')?.revisao).toBeNull();
    expect(m.get('t1')?.sugestao.prioridade).toBe('P1');
  });

  it('revisão sem sugestão antes é ignorada', () => {
    expect(estadoPorTarefa([{ tarefaId: 't1', texto: rev, em: '2026-09-29T10:00:00Z' }]).size).toBe(
      0,
    );
  });
});
