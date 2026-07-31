import { describe, expect, it } from 'vitest';
import { destinoInternoSeguro } from './redirect';

describe('destinoInternoSeguro', () => {
  it.each([
    [null, '/docs'],
    ['', '/docs'],
    ['https://evil.example/roubar', '/docs'],
    ['//evil.example/roubar', '/docs'],
    ['/\\evil.example/roubar', '/docs'],
    ['/%5c%5cevil.example/roubar', '/docs'],
    ['/%252f%252fevil.example/roubar', '/docs'],
    ['/docs%ZZ', '/docs'],
    ['/docs\nSet-Cookie: ataque=1', '/docs'],
  ])('rejeita destino externo ou malformado %s', (entrada, esperado) => {
    expect(destinoInternoSeguro(entrada)).toBe(esperado);
  });

  it.each([
    ['/docs', '/docs'],
    ['/docs?doc=abc', '/docs?doc=abc'],
    ['/cards#tarefa', '/cards#tarefa'],
    ['/tarefas?busca=a%20b', '/tarefas?busca=a%20b'],
  ])('preserva destino interno %s', (entrada, esperado) => {
    expect(destinoInternoSeguro(entrada)).toBe(esperado);
  });

  it('aceita fallback interno explícito', () => {
    expect(destinoInternoSeguro(null, '/cards')).toBe('/cards');
  });
});
