import { describe, expect, it } from 'vitest';
import type { Configuracoes, Projeto, Tag } from '@/types/domain';
import { CONFIG_PADRAO_PESOS, calcularNota, calcularUrgencia } from './engine';

const mkConfig = (): Configuracoes => ({
  usuarioId: 'u',
  pesos: CONFIG_PADRAO_PESOS,
  limiares: { reavaliacao: 30, descarte: 50, adiamento: 40 },
  audioHabilitado: true,
  animacoesHabilitadas: true,
  aiHabilitado: false,
  todoistSyncHabilitado: false,
});

const mkProjeto = (mult = 1): Projeto => ({
  id: 'p1',
  nome: 'Proj',
  cor: '#198B74',
  ordemPrioridade: 1,
  multiplicador: mult,
  ativo: true,
});

const mkTag = (tipoPeso: Tag['tipoPeso'], valor: number): Tag => ({
  id: `t-${tipoPeso}`,
  nome: tipoPeso,
  cor: '#2CAF93',
  tipoPeso,
  valorPeso: valor,
  ativo: true,
});

describe('calcularUrgencia', () => {
  it('atrasada = 100', () => {
    const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    expect(calcularUrgencia(ontem)).toBe(100);
  });

  it('hoje = 95', () => {
    const hoje = new Date().toISOString().slice(0, 10);
    expect(calcularUrgencia(hoje)).toBe(95);
  });

  it('sem data = 10', () => {
    expect(calcularUrgencia(null)).toBe(10);
  });
});

describe('calcularNota', () => {
  it('pagar iptu vence hoje → 100', () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const nota = calcularNota(
      {
        tipo: 'tarefa',
        prioridade: 1,
        dataVencimento: hoje,
        facilidade: 50,
        projeto: mkProjeto(1.15),
        tags: [mkTag('soma', 5)],
      },
      mkConfig(),
    );
    expect(nota).toBe(100);
  });

  it('lembrete P2 amanhã projeto top → 100 (capped)', () => {
    const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const nota = calcularNota(
      {
        tipo: 'lembrete',
        prioridade: 2,
        dataVencimento: amanha,
        projeto: mkProjeto(1.3),
        tags: [],
      },
      mkConfig(),
    );
    expect(nota).toBe(100);
  });

  it('estudar sem data P4 com tag subtracao → baixo', () => {
    const nota = calcularNota(
      {
        tipo: 'tarefa',
        prioridade: 4,
        facilidade: 25,
        projeto: mkProjeto(0.9),
        tags: [mkTag('subtracao', 10)],
      },
      mkConfig(),
    );
    expect(nota).toBeLessThan(15);
  });

  it('tags multiplicadoras empilham', () => {
    const sem = calcularNota(
      { tipo: 'tarefa', prioridade: 3, tags: [] },
      mkConfig(),
    );
    const com = calcularNota(
      {
        tipo: 'tarefa',
        prioridade: 3,
        tags: [mkTag('multiplicador', 1.2), mkTag('multiplicador', 1.1)],
      },
      mkConfig(),
    );
    expect(com).toBeGreaterThan(sem);
  });

  it('clamp em 0 quando soma massiva subtracao', () => {
    const nota = calcularNota(
      {
        tipo: 'tarefa',
        prioridade: 4,
        tags: [mkTag('subtracao', 500)],
      },
      mkConfig(),
    );
    expect(nota).toBe(0);
  });
});
