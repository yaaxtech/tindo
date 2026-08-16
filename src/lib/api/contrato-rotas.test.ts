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
 * `ROTAS_LEGADAS` é uma dívida explícita: só ENCOLHE. Rota nova nunca entra na
 * lista — ela nasce no kernel, ou este teste falha. Quando a lista esvaziar,
 * apague a constante e o `it` que a acompanha.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ_API = join(process.cwd(), 'src/app/api');

/**
 * Rotas ainda no padrão antigo, migradas fatia a fatia. NUNCA adicione uma
 * linha aqui — a lista existe só para ser apagada.
 */
const ROTAS_LEGADAS = new Set([
  'adiamento/sugerir/route.ts',
  'ai/batch/route.ts',
  'ai/classificar/route.ts',
  'ai/quebrar/route.ts',
  'ai/sugerir-tarefas/[id]/resposta/route.ts',
  'ai/sugerir-tarefas/route.ts',
  'ai/testar/route.ts',
  'calibracao/route.ts',
  'configuracoes/route.ts',
  'cron/diario/route.ts',
  'espacos-trabalho/route.ts',
  'fila/route.ts',
  'gamificacao/aneis/route.ts',
  'gamificacao/conclusao/route.ts',
  'gamificacao/freezer/route.ts',
  'gamificacao/historico/route.ts',
  'gamificacao/kpis-adiamento/route.ts',
  'gamificacao/route.ts',
  'projetos/route.ts',
  'push/disparar-gatilhos/route.ts',
  'push/subscribe/route.ts',
  'push/testar/route.ts',
  'push/unsubscribe/route.ts',
  'recalcular-notas/route.ts',
  'recalibrar/aplicar/route.ts',
  'recalibrar/gatilhos/route.ts',
  'recalibrar/sugerir/route.ts',
  'recalibrar/tarefas/route.ts',
  'sugestoes-ai/[id]/route.ts',
  'sugestoes-ai/route.ts',
  'tags/route.ts',
  'tarefas/[id]/acao/route.ts',
  'tarefas/[id]/route.ts',
  'tarefas/route.ts',
  'todoist/backup/route.ts',
  'todoist/desconectar/route.ts',
  'todoist/exportar/previa/route.ts',
  'todoist/exportar/route.ts',
  'todoist/me/route.ts',
  'todoist/previa/route.ts',
  'todoist/status/route.ts',
  'todoist/sync/route.ts',
  'todoist/testar/route.ts',
]);

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
const migradas = rotas.filter((rota) => !ROTAS_LEGADAS.has(rota.id));

/** Só o que interessa na falha: quais arquivos violam a regra. */
function idsQueCasam(candidatas: Rota[], padrao: RegExp): string[] {
  return candidatas.filter((rota) => padrao.test(rota.codigo)).map((rota) => rota.id);
}

describe('contrato das rotas de API', () => {
  it('enxerga as rotas do projeto (glob quebrado não pode passar batido)', () => {
    // Se a varredura zerar, todos os testes abaixo passariam vazios.
    expect(rotas.length).toBeGreaterThanOrEqual(50);
    expect(migradas.length).toBeGreaterThan(0);
  });

  it('a allowlist de legado não cita rota inexistente', () => {
    const existentes = new Set(rotas.map((rota) => rota.id));
    // Rota renomeada/apagada tem de sair da lista, senão o débito vira ficção.
    expect([...ROTAS_LEGADAS].filter((id) => !existentes.has(id))).toEqual([]);
  });

  it('rota migrada usa o kernel', () => {
    expect(
      migradas.filter((r) => !r.codigo.includes('@/lib/api/resposta')).map((r) => r.id),
    ).toEqual([]);
  });

  it('rota migrada não monta envelope de erro à mão', () => {
    expect(idsQueCasam(migradas, /NextResponse\.json\(\s*\{\s*erro:/)).toEqual([]);
  });

  it('rota migrada não devolve a chave `error` em inglês', () => {
    // Envelope canônico: `{ erro, codigo }` em PT-BR, montado só pelo kernel.
    expect(idsQueCasam(migradas, /\{\s*error:/)).toEqual([]);
  });

  it('rota migrada não reimplementa respostaErro/mensagemErro localmente', () => {
    expect(idsQueCasam(migradas, /function\s+(respostaErro|mensagemErro)\b/)).toEqual([]);
  });

  it('rota migrada não adivinha status HTTP pelo texto da mensagem', () => {
    // Mata o padrão `mensagem.includes('Só o dono') ? 403 : 500`.
    expect(idsQueCasam(migradas, /\.includes\([^)]*\)\s*\?\s*\d{3}/)).toEqual([]);
  });
});
