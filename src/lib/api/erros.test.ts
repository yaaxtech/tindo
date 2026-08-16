// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  ErroConflito,
  type ErroDeAplicacao,
  ErroInterno,
  ErroNaoAutenticado,
  ErroNaoEncontrado,
  ErroSemPermissao,
  ErroServicoExterno,
  ErroValidacao,
  MENSAGEM_CORPO_INVALIDO,
  MENSAGEM_ERRO_GENERICA,
  codigoDoErro,
  mensagemSegura,
  statusDoErro,
} from './erros';

describe('erros de aplicação', () => {
  it('cada tipo carrega o próprio status e código', () => {
    const casos: [ErroDeAplicacao, number, string][] = [
      [new ErroValidacao('x'), 400, 'VALIDACAO'],
      [new ErroNaoAutenticado(), 401, 'NAO_AUTENTICADO'],
      [new ErroSemPermissao('x'), 403, 'SEM_PERMISSAO'],
      [new ErroNaoEncontrado('x'), 404, 'NAO_ENCONTRADO'],
      [new ErroConflito('x'), 409, 'CONFLITO'],
      [new ErroInterno('x'), 500, 'INTERNO'],
      [new ErroServicoExterno('x'), 502, 'SERVICO_EXTERNO'],
    ];
    for (const [erro, status, codigo] of casos) {
      expect(statusDoErro(erro)).toBe(status);
      expect(codigoDoErro(erro)).toBe(codigo);
    }
  });

  it('continua sendo um Error de verdade (catch e toThrow seguem funcionando)', () => {
    const erro = new ErroSemPermissao('Só o dono pode compartilhar este documento.');
    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe('Só o dono pode compartilhar este documento.');
    expect(() => {
      throw erro;
    }).toThrow('Só o dono pode compartilhar este documento.');
  });

  it('mensagem de erro tipado vai inteira para o usuário', () => {
    expect(mensagemSegura(new ErroValidacao('Informe um nome com até 80 caracteres.'))).toBe(
      'Informe um nome com até 80 caracteres.',
    );
  });

  it('erro desconhecido nunca vaza o texto técnico', () => {
    const postgrest = new Error(
      'duplicate key value violates unique constraint "perfis_usuario_pkey"',
    );
    expect(statusDoErro(postgrest)).toBe(500);
    expect(mensagemSegura(postgrest)).toBe(MENSAGEM_ERRO_GENERICA);
    expect(codigoDoErro(postgrest)).toBe('INTERNO');
  });

  it('erro que não é Error também não quebra', () => {
    expect(statusDoErro('boom')).toBe(500);
    expect(statusDoErro(undefined)).toBe(500);
    expect(mensagemSegura({ detalhe: 'interno' })).toBe(MENSAGEM_ERRO_GENERICA);
  });

  it('JSON malformado é 400, não 500', () => {
    const erro = new SyntaxError('Unexpected token < in JSON at position 0');
    expect(statusDoErro(erro)).toBe(400);
    expect(mensagemSegura(erro)).toBe(MENSAGEM_CORPO_INVALIDO);
    expect(codigoDoErro(erro)).toBe('CORPO_INVALIDO');
  });

  it('ErroNaoAutenticado tem mensagem padrão pronta para a tela', () => {
    expect(new ErroNaoAutenticado().message).toBe('Entre na sua conta para continuar.');
    expect(new ErroNaoAutenticado('Sessão expirada.').message).toBe('Sessão expirada.');
  });

  it('subclasse de um erro tipado preserva status e código', () => {
    // O middleware/serviços podem especializar sem perder o mapeamento HTTP.
    class ErroSessaoExpirada extends ErroNaoAutenticado {}
    expect(statusDoErro(new ErroSessaoExpirada())).toBe(401);
    expect(codigoDoErro(new ErroSessaoExpirada())).toBe('NAO_AUTENTICADO');
  });
});
