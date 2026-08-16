# Rotas de API — kernel único de resposta

> Carrega quando o cwd inclui `src/app/api/`. Complementa `src/CLAUDE.md`.

## A rota não monta resposta de erro

Tudo passa por `src/lib/api/`:

```ts
import { ErroValidacao } from '@/lib/api/erros';
import { corpoJson, respostaOk, rotaApi } from '@/lib/api/resposta';

export const PUT = rotaApi('PUT /api/docs', async (req: Request) => {
  const contexto = await exigirContextoAuth();       // 401 sai daqui, tipado
  const body = await corpoJson(req);                 // JSON quebrado = 400
  if (!body.raizId) throw new ErroValidacao('raizId é obrigatório.');
  await salvarDocumento(contexto, body.linhas ?? [], body.raizId as string);
  return respostaOk({ ok: true });                   // sem try/catch na rota
});
```

- **Envelope de erro:** `{ erro: 'texto PT-BR', codigo: 'DISCRIMINADOR' }`.
  Nunca a chave `error` em inglês. O cliente decide pelo `codigo`, não pelo texto.
- **Status vem do TIPO do erro**, nunca de `mensagem.includes(...)`.
- **5xx não vaza texto técnico:** erro desconhecido (Postgres, rede) vira
  mensagem genérica; o detalhe — com `cause` — só existe no log do servidor.
  Para dar um texto melhor ao usuário, lance `ErroInterno('...', { cause })`.

## O check que segura isso

`src/lib/api/contrato-rotas.test.ts` varre todo `src/app/api/**/route.ts` e
falha se alguma rota montar resposta com `NextResponse`, reimplementar
`respostaErro`/`mensagemErro`, devolver a chave `error` ou derivar status do
texto da mensagem. Vale para **todas** as rotas — não existe allowlist.

Duas saídas legítimas fora do envelope JSON, ambas sem `NextResponse`:

- **download de arquivo** — `Response` cru com `Content-Disposition`
  (ver `/api/todoist/backup`); só o caminho de erro usa o kernel;
- **resultado de teste de conexão** — `/api/ai/testar` responde
  `{ ok, detalhe }` com status 200 mesmo quando a chave é inválida, porque o
  corpo é o resultado do teste, não um erro da aplicação. Se criar outra rota
  assim, documente o motivo no arquivo, como lá.
