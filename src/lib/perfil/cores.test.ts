import { describe, expect, it } from 'vitest';
import { CORES_PERFIL, ehCorPerfil } from './cores';

describe('cores do perfil', () => {
  it('mantém uma paleta predefinida sem duplicatas', () => {
    expect(CORES_PERFIL).toHaveLength(8);
    expect(new Set(CORES_PERFIL).size).toBe(CORES_PERFIL.length);
  });

  it('aceita somente uma cor da paleta', () => {
    expect(ehCorPerfil('#2caf93')).toBe(true);
    expect(ehCorPerfil('#FFFFFF')).toBe(false);
    expect(ehCorPerfil('red')).toBe(false);
  });
});
