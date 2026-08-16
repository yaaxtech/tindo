// @vitest-environment node

/**
 * CHECK de arquitetura — pega a CLASSE inteira do erro, não uma ocorrência.
 *
 * O problema que originou este arquivo: cada rota montava o próprio envelope de
 * erro. Deu em 41 rotas com a chave `error`, 7 com `erro`, uma com as duas no
 * mesmo arquivo, 5 cópias da mesma função `respostaErro` e status HTTP
 * adivinhado por `mensagem.includes('Só o dono')`. Documentar "use o kernel"
 * num CLAUDE.md não impede a 51ª rota de repetir tudo; este teste impede.
 *
 * A allowlist de legado existiu enquanto a migração acontecia e hoje está
 * VAZIA: todas as rotas passam pelo kernel. Não recrie a lista — rota nova
 * nasce em `rotaApi`/`respostaOk` ou este teste falha.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ_API = join(process.cwd(), 'src/app/api');

interface Rota {
  /** Caminho relativo a src/app/api, sempre com `/` (id estável entre SOs). */
  id: string;
  codigo: string;
}

function listarRotas(diretorio = RAIZ_API, prefixo = ''): Rota[] {
  const rotas: Rota[] = [];
  for (const entrada of readdirSync(diretorio, { withFileTypes: true })) {
    const id = prefixo ? `${prefixo}/${entrada.name}` : entrada.name;
    if (entrada.isDirectory()) {
      rotas.push(...listarRotas(join(diretorio, entrada.name), id));
    } else if (entrada.name === 'route.ts') {
      rotas.push({ id, codigo: readFileSync(join(diretorio, entrada.name), 'utf8') });
    }
  }
  return rotas;
}

const rotas = listarRotas();

/** Só o que interessa na falha: quais arquivos violam a regra. */
function idsQueCasam(padrao: RegExp): string[] {
  return rotas.filter((rota) => padrao.test(rota.codigo)).map((rota) => rota.id);
}

describe('contrato das rotas de API', () => {
  it('enxerga as rotas do projeto (varredura quebrada não pode passar batido)', () => {
    // Se a varredura zerar, todos os testes abaixo passariam vazios.
    expect(rotas.length).toBeGreaterThanOrEqual(50);
  });

  it('toda rota passa pelo kernel', () => {
    expect(idsQueCasam(/^(?![\s\S]*@\/lib\/api\/resposta)[\s\S]*$/)).toEqual([]);
  });

  it('nenhuma rota monta resposta com NextResponse', () => {
    // `respostaOk`/`respostaErro` são a única porta de saída. Download de
    // arquivo usa `Response` cru (ver /api/todoist/backup), nunca NextResponse.
    expect(idsQueCasam(/\bNextResponse\b/)).toEqual([]);
  });

  it('nenhuma rota reimplementa respostaErro/mensagemErro localmente', () => {
    expect(idsQueCasam(/function\s+(respostaErro|mensagemErro)\b/)).toEqual([]);
  });

  it('nenhuma rota adivinha status HTTP pelo texto da mensagem', () => {
    // Mata o padrão `mensagem.includes('Só o dono') ? 403 : 500`.
    expect(idsQueCasam(/\.includes\([^)]*\)\s*\?\s*\d{3}/)).toEqual([]);
  });

  it('nenhuma rota devolve a chave `error` em inglês no corpo', () => {
    // Envelope canônico é `{ erro, codigo }`. Ignora `const { error: x } = ...`
    // do supabase-js, que é desestruturação e não corpo de resposta.
    expect(idsQueCasam(/(?:json|respostaOk|respostaErro)\(\s*\{\s*error:/)).toEqual([]);
  });
});
