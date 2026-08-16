import { describe, expect, it } from 'vitest';
import { carimboAtualizacao, tempoRelativo } from './atualizacao';

const AGORA = Date.parse('2026-08-16T14:20:00.000Z');
const atras = (ms: number) => new Date(AGORA - ms).toISOString();

describe('tempoRelativo', () => {
  it('diz "agora mesmo" abaixo de um minuto', () => {
    expect(tempoRelativo(atras(0), AGORA)).toBe('agora mesmo');
    expect(tempoRelativo(atras(59e3), AGORA)).toBe('agora mesmo');
  });

  it('conta minutos até a primeira hora', () => {
    expect(tempoRelativo(atras(60e3), AGORA)).toBe('há 1 min');
    expect(tempoRelativo(atras(30 * 60e3), AGORA)).toBe('há 30 min');
    expect(tempoRelativo(atras(59 * 60e3), AGORA)).toBe('há 59 min');
  });

  it('conta horas até o primeiro dia, com singular e plural', () => {
    expect(tempoRelativo(atras(3600e3), AGORA)).toBe('há 1 hora');
    expect(tempoRelativo(atras(5 * 3600e3), AGORA)).toBe('há 5 horas');
    expect(tempoRelativo(atras(23.9 * 3600e3), AGORA)).toBe('há 23 horas');
  });

  it('conta dias daí em diante, com singular e plural', () => {
    expect(tempoRelativo(atras(864e5), AGORA)).toBe('há 1 dia');
    expect(tempoRelativo(atras(3 * 864e5), AGORA)).toBe('há 3 dias');
  });

  // Relógio da máquina que empurrou adiantado: "há -3 min" seria pior que nada.
  it('trata carimbo no futuro como agora mesmo', () => {
    expect(tempoRelativo(atras(-5 * 60e3), AGORA)).toBe('agora mesmo');
  });

  it('devolve null quando a data não dá para ler', () => {
    expect(tempoRelativo('não-é-data', AGORA)).toBeNull();
  });
});

describe('carimboAtualizacao', () => {
  // Hora depende do fuso de quem roda o teste; a FORMA é o que importa.
  it('junta data, hora e tempo relativo', () => {
    expect(carimboAtualizacao(atras(30 * 60e3), AGORA)).toMatch(
      /^atualizado em \d{2}\/\d{2} às \d{2}:\d{2} · há 30 min$/,
    );
  });

  it('devolve null quando a data não dá para ler', () => {
    expect(carimboAtualizacao('', AGORA)).toBeNull();
  });
});
