import { ErroValidacao } from '@/lib/api/erros';
import { corpoJson, respostaOk, rotaApi } from '@/lib/api/resposta';
import {
  type AcaoTarefa,
  type OpcaoAdiarAcao,
  adiarTarefa,
  executarAcao,
  mesclarTarefas,
} from '@/services/triagem-revisao';

export const dynamic = 'force-dynamic';

const ACOES: readonly AcaoTarefa[] = ['concluir', 'reabrir', 'excluir'];
const ADIAR: readonly OpcaoAdiarAcao[] = ['tarde', 'noite', 'amanha', 'data', 'sugestao'];

/** Concluir, reabrir, excluir, adiar ou mesclar tarefas do Todoist a partir da /triagem. */
export const POST = rotaApi('POST /api/triagem/acao', async (request: Request) => {
  const corpo = await corpoJson(request);
  const tarefaId = typeof corpo.tarefaId === 'string' ? corpo.tarefaId : '';
  if (corpo.acao === 'adiar') {
    if (!ADIAR.includes(corpo.opcao as OpcaoAdiarAcao)) throw new ErroValidacao('Opção inválida.');
    const resultado = await adiarTarefa(
      tarefaId,
      corpo.opcao as OpcaoAdiarAcao,
      typeof corpo.data === 'string' ? corpo.data : undefined,
    );
    return respostaOk(resultado);
  }
  if (corpo.acao === 'mesclar') {
    await mesclarTarefas(tarefaId, typeof corpo.saiId === 'string' ? corpo.saiId : '');
  } else if (ACOES.includes(corpo.acao as AcaoTarefa)) {
    await executarAcao(corpo.acao as AcaoTarefa, tarefaId);
  } else {
    throw new ErroValidacao('Ação desconhecida.');
  }
  return respostaOk({ ok: true });
});
