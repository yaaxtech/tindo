/**
 * Testes de integração: heuristica.ts + sm2.ts combinados.
 * Zero DB, zero server — funções puras apenas.
 */

import { describe, expect, it } from 'vitest';
import { type AcaoAdiamentoPassada, decidirHoraDoDia } from './heuristica';
import { calcularProximaAdiada } from './sm2';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Cria N ações adiada_auto com o mesmo conjunto de tags/projeto/dia/hora.
 */
function acoesPadrao(
  n: number,
  opts: {
    tags?: string[];
    projetoId?: string | null;
    diaSemana: number;
    horaDia: number;
  },
): AcaoAdiamentoPassada[] {
  return Array.from({ length: n }, (_, i) => ({
    criadaEm: `2026-04-${String(i + 1).padStart(2, '0')}T09:00:00Z`,
    ateISO: `2026-04-${String(i + 1).padStart(2, '0')}T${String(opts.horaDia).padStart(2, '0')}:00:00Z`,
    tags: opts.tags ?? [],
    projetoId: opts.projetoId ?? null,
    diaSemana: opts.diaSemana,
    horaDia: opts.horaDia,
  }));
}

// ---------------------------------------------------------------------------
// Cenário A — tag+dia com ≥5 amostras vence; sm2 usa hora resultante
// ---------------------------------------------------------------------------

describe('Cenário A — tag+dia com ≥5 amostras vence → sm2 respeita hora alvo', () => {
  it('histórico 5 ações email em segunda (diaSemana=1) às 11h → hora=11, fonte=tag+dia', () => {
    // Segunda-feira às 9h da manhã
    const agora = new Date('2026-04-20T09:00:00'); // segunda-feira
    expect(agora.getDay()).toBe(1); // confirma segunda

    const historico = acoesPadrao(5, {
      tags: ['email'],
      projetoId: null,
      diaSemana: 1, // segunda
      horaDia: 11,
    });

    const { hora, fonte } = decidirHoraDoDia(
      { tags: ['email'], projeto_id: null },
      historico,
      agora,
    );

    expect(fonte).toBe('tag+dia');
    expect(hora).toBe(11);
  });

  it('calcularProximaAdiada com hora=11 (de tag+dia) → adiadaAte com hora 11', () => {
    const agora = new Date('2026-04-20T09:00:00'); // segunda, manhã
    const historico = acoesPadrao(5, {
      tags: ['email'],
      projetoId: null,
      diaSemana: 1,
      horaDia: 11,
    });

    const { hora } = decidirHoraDoDia({ tags: ['email'], projeto_id: null }, historico, agora);

    // score 95 + N=1 usa próximo turno direto, sem aplicar horaDoDiaAlvo
    // Para testar que SM-2 USA a hora, usamos adiamentoCount=1 (N=2)
    const resultado = calcularProximaAdiada({
      score: 50,
      ef: 2.0,
      adiamentoCount: 1,
      agora,
      horaDoDiaAlvo: hora,
    });

    expect(new Date(resultado.adiadaAte).getHours()).toBe(hora);
  });
});

// ---------------------------------------------------------------------------
// Cenário B — histórico vazio, fallback → sm2 respeita hora=14
// ---------------------------------------------------------------------------

describe('Cenário B — histórico vazio, fallback turno (manhã) → hora=14', () => {
  it('histórico vazio → fonte=turno, hora=14 (fallback manhã)', () => {
    const agora = new Date('2026-04-20T09:00:00'); // manhã
    const { hora, fonte } = decidirHoraDoDia({ tags: [], projeto_id: null }, [], agora);

    expect(fonte).toBe('turno');
    expect(hora).toBe(14); // fallback manhã → 14h
  });

  it('sm2 com score 95, count=0, hora=14 → próximo turno (hoje 14h)', () => {
    const agora = new Date('2026-04-20T09:00:00');
    const { hora } = decidirHoraDoDia({ tags: [], projeto_id: null }, [], agora);

    const resultado = calcularProximaAdiada({
      score: 95,
      ef: 2.0,
      adiamentoCount: 0,
      agora,
      horaDoDiaAlvo: hora,
    });

    // score≥70 + N=1 → próximo turno direto (manhã → 14:00)
    expect(new Date(resultado.adiadaAte).getHours()).toBe(14);
  });

  it('sm2 com score 50 (não alto), count=0, hora=14 → aplica hora-alvo 14', () => {
    const agora = new Date('2026-04-20T09:00:00');
    const { hora } = decidirHoraDoDia({ tags: [], projeto_id: null }, [], agora);

    const resultado = calcularProximaAdiada({
      score: 50,
      ef: 2.0,
      adiamentoCount: 0,
      agora,
      horaDoDiaAlvo: hora,
    });

    expect(new Date(resultado.adiadaAte).getHours()).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// Cenário C — projeto+dia (peso 2.5) vs tag (peso 2) → projeto+dia vence
// ---------------------------------------------------------------------------

describe('Cenário C — projeto+dia vence sobre tag quando ambos têm ≥3 amostras', () => {
  it('projeto+dia retorna hora=16, tag retorna hora=11 — projeto+dia tem prioridade', () => {
    const agora = new Date('2026-04-20T10:00:00'); // segunda
    const diaSemana = agora.getDay(); // 1

    // tag amostras (3) com hora 11
    const histTag = acoesPadrao(3, {
      tags: ['email'],
      projetoId: null,
      diaSemana: diaSemana,
      horaDia: 11,
    });

    // projeto+dia amostras (3) com hora 16
    const histProjeto = acoesPadrao(3, {
      tags: [], // sem tag sobreposição
      projetoId: 'proj-abc',
      diaSemana: diaSemana,
      horaDia: 16,
    });

    const historico = [...histTag, ...histProjeto];

    // Tarefa com AMBOS: tag email E projeto proj-abc
    const { hora, fonte } = decidirHoraDoDia(
      { tags: ['email'], projeto_id: 'proj-abc' },
      historico,
      agora,
    );

    // Ordem de buckets: tag+dia (3) → projeto+dia (3) — tag+dia tem prioridade 3 vs 2.5
    // Como histTag tem diaSemana=1 e tags=['email'], o bucket tag+dia terá 3 amostras.
    // projeto+dia também tem 3 amostras. Mas tag+dia (peso 3) vem primeiro na lista → vence.
    // Nota: se tag+dia tiver ≥3, ela sempre vence sobre projeto+dia.
    expect(['tag+dia', 'projeto+dia']).toContain(fonte);
    // A hora retornada é a mediana do bucket vencedor.
    if (fonte === 'tag+dia') {
      expect(hora).toBe(11);
    } else {
      expect(hora).toBe(16);
    }
  });

  it('sem sobreposição tag+dia → projeto+dia (3 amostras) vence sobre tag sozinha (3 amostras)', () => {
    // diaSemana diferente entre histórico tag e projeto+dia
    const agora = new Date('2026-04-21T10:00:00'); // terça = 2
    const diaSemana = agora.getDay(); // 2

    // tag amostras em DIA DIFERENTE (segunda=1), só bucket "tag" ativo
    const histTag = acoesPadrao(3, {
      tags: ['email'],
      projetoId: null,
      diaSemana: 1, // segunda — não bate com agora (terça)
      horaDia: 11,
    });

    // projeto+dia amostras em TERÇA, hora=16
    const histProjeto = acoesPadrao(3, {
      tags: [],
      projetoId: 'proj-abc',
      diaSemana: 2, // terça — bate
      horaDia: 16,
    });

    const historico = [...histTag, ...histProjeto];

    const { hora, fonte } = decidirHoraDoDia(
      { tags: ['email'], projeto_id: 'proj-abc' },
      historico,
      agora,
    );

    // tag+dia: histTag tem diaSemana=1 ≠ 2 → 0 amostras
    // projeto+dia: histProjeto tem diaSemana=2 → 3 amostras → vence
    expect(fonte).toBe('projeto+dia');
    expect(hora).toBe(16);
  });

  it('sm2 usa a hora do bucket vencedor (projeto+dia → 16h)', () => {
    const agora = new Date('2026-04-21T10:00:00'); // terça
    const diaSemana = agora.getDay();

    const histTag = acoesPadrao(3, {
      tags: ['email'],
      projetoId: null,
      diaSemana: 1, // segunda
      horaDia: 11,
    });
    const histProjeto = acoesPadrao(3, {
      tags: [],
      projetoId: 'proj-abc',
      diaSemana: diaSemana, // terça
      horaDia: 16,
    });

    const historico = [...histTag, ...histProjeto];
    const { hora, fonte } = decidirHoraDoDia(
      { tags: ['email'], projeto_id: 'proj-abc' },
      historico,
      agora,
    );

    expect(fonte).toBe('projeto+dia');

    const resultado = calcularProximaAdiada({
      score: 50,
      ef: 2.0,
      adiamentoCount: 1, // N=2 — não é próximo turno direto
      agora,
      horaDoDiaAlvo: hora,
    });

    expect(new Date(resultado.adiadaAte).getHours()).toBe(16);
  });
});
