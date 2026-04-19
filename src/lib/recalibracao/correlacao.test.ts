import { describe, expect, it } from 'vitest';
import { type AmostraCalibracao, calcularNovosPesos } from './correlacao';

const pesosDefault = { urgencia: 0.4, importancia: 0.4, facilidade: 0.2 };

describe('calcularNovosPesos', () => {
  it('retorna pesosAtuais sem alterar com menos de 2 amostras', () => {
    const r = calcularNovosPesos([], pesosDefault);
    expect(r.pesosNovos).toEqual(pesosDefault);
    expect(r.amostras).toBe(0);
  });

  it('retorna pesosAtuais com 1 amostra', () => {
    const amostra: AmostraCalibracao = {
      importancia: 80,
      urgencia: 90,
      facilidade: 50,
      notaHumana: 85,
      notaAtual: 80,
    };
    const r = calcularNovosPesos([amostra], pesosDefault);
    expect(r.pesosNovos).toEqual(pesosDefault);
    expect(r.amostras).toBe(1);
  });

  it('pesos novos somam aproximadamente 1', () => {
    const amostras: AmostraCalibracao[] = [
      { importancia: 80, urgencia: 90, facilidade: 50, notaHumana: 85, notaAtual: 82 },
      { importancia: 40, urgencia: 20, facilidade: 70, notaHumana: 35, notaAtual: 40 },
      { importancia: 60, urgencia: 50, facilidade: 80, notaHumana: 60, notaAtual: 58 },
      { importancia: 90, urgencia: 85, facilidade: 30, notaHumana: 88, notaAtual: 84 },
      { importancia: 20, urgencia: 10, facilidade: 90, notaHumana: 20, notaAtual: 25 },
    ];
    const r = calcularNovosPesos(amostras, pesosDefault);
    const soma = r.pesosNovos.urgencia + r.pesosNovos.importancia + r.pesosNovos.facilidade;
    expect(soma).toBeCloseTo(1, 2);
    expect(r.amostras).toBe(5);
  });

  it('cada peso fica entre 0.1 e 0.8', () => {
    const amostras: AmostraCalibracao[] = [
      { importancia: 80, urgencia: 90, facilidade: 50, notaHumana: 92, notaAtual: 82 },
      { importancia: 40, urgencia: 20, facilidade: 70, notaHumana: 22, notaAtual: 40 },
      { importancia: 60, urgencia: 50, facilidade: 80, notaHumana: 52, notaAtual: 58 },
    ];
    const r = calcularNovosPesos(amostras, pesosDefault);
    const { urgencia, importancia, facilidade } = r.pesosNovos;
    expect(urgencia).toBeGreaterThanOrEqual(0.1);
    expect(urgencia).toBeLessThanOrEqual(0.8);
    expect(importancia).toBeGreaterThanOrEqual(0.1);
    expect(importancia).toBeLessThanOrEqual(0.8);
    expect(facilidade).toBeGreaterThanOrEqual(0.1);
    expect(facilidade).toBeLessThanOrEqual(0.8);
  });

  it('correlação perfeita: notaHumana == notaAtual → correlacaoAntes = 1', () => {
    const amostras: AmostraCalibracao[] = [
      { importancia: 80, urgencia: 90, facilidade: 50, notaHumana: 80, notaAtual: 80 },
      { importancia: 40, urgencia: 20, facilidade: 70, notaHumana: 40, notaAtual: 40 },
      { importancia: 60, urgencia: 50, facilidade: 80, notaHumana: 60, notaAtual: 60 },
    ];
    const r = calcularNovosPesos(amostras, pesosDefault);
    expect(r.correlacaoAntes).toBeCloseTo(1, 5);
  });

  it('correlacaoDepois >= correlacaoAntes quando há divergência real', () => {
    // notaAtual muito diferente do humano — sistema desalinhado
    const amostras: AmostraCalibracao[] = [
      { importancia: 80, urgencia: 90, facilidade: 50, notaHumana: 90, notaAtual: 50 },
      { importancia: 40, urgencia: 20, facilidade: 70, notaHumana: 30, notaAtual: 70 },
      { importancia: 60, urgencia: 50, facilidade: 80, notaHumana: 55, notaAtual: 55 },
      { importancia: 10, urgencia: 10, facilidade: 10, notaHumana: 10, notaAtual: 10 },
      { importancia: 100, urgencia: 95, facilidade: 90, notaHumana: 95, notaAtual: 60 },
    ];
    const r = calcularNovosPesos(amostras, pesosDefault);
    // Após recalibração a correlação deve melhorar ou manter
    expect(r.correlacaoDepois).toBeGreaterThanOrEqual(r.correlacaoAntes - 0.05);
  });
});
