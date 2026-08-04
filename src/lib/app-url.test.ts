import { describe, expect, it } from 'vitest';
import { ORIGEM_OFICIAL, urlNoEnderecoOficial } from './app-url';

describe('urlNoEnderecoOficial', () => {
  it('redireciona o host técnico preservando rota e parâmetros', () => {
    const destino = urlNoEnderecoOficial(
      new URL('https://tindo.falecomyaax.workers.dev/harness?periodo=30'),
    );

    expect(destino?.toString()).toBe(`${ORIGEM_OFICIAL}/harness?periodo=30`);
  });

  it('não redireciona o endereço oficial', () => {
    expect(urlNoEnderecoOficial(new URL(`${ORIGEM_OFICIAL}/harness`))).toBeNull();
  });

  it('não transforma caminho com barras duplas em redirecionamento externo', () => {
    const destino = urlNoEnderecoOficial(
      new URL('https://tindo.falecomyaax.workers.dev//evil.example/phish?x=1'),
    );

    expect(destino?.origin).toBe(ORIGEM_OFICIAL);
    expect(destino?.pathname).toBe('//evil.example/phish');
    expect(destino?.search).toBe('?x=1');
  });
});
