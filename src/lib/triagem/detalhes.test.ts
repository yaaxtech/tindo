import { describe, expect, it } from 'vitest';
import { descricaoMesclada, nomeDaPessoa } from './detalhes';

describe('nomeDaPessoa', () => {
  const eu = { id: '1', full_name: 'Emanuel' };
  const outros = [
    { id: '2', full_name: 'Lara' },
    { id: '3', email: 'herik@x.com' },
  ];

  it('o próprio dono vira "você"', () => {
    expect(nomeDaPessoa('1', eu, outros)).toBe('você');
  });

  it('usa o nome do colaborador, ou o e-mail quando não tem nome', () => {
    expect(nomeDaPessoa('2', eu, outros)).toBe('Lara');
    expect(nomeDaPessoa('3', eu, outros)).toBe('herik@x.com');
  });

  it('sem uid ou desconhecido fica null', () => {
    expect(nomeDaPessoa(undefined, eu, outros)).toBeNull();
    expect(nomeDaPessoa('9', eu, outros)).toBeNull();
  });
});

describe('descricaoMesclada', () => {
  it('junta o texto da que sai no fim da descrição da que fica', () => {
    expect(
      descricaoMesclada(
        { conteudo: 'testarLarvifort', descricao: 'planejar viveiros' },
        { conteudo: 'Teste larvifort', descricao: ' ver com Maisa ' },
      ),
    ).toBe('planejar viveiros\n\n---\nMesclado de: Teste larvifort\nver com Maisa');
  });

  it('sem descrição, fica só o trecho mesclado', () => {
    expect(
      descricaoMesclada({ conteudo: 'A', descricao: '' }, { conteudo: 'B', descricao: '' }),
    ).toBe('Mesclado de: B');
  });
});
