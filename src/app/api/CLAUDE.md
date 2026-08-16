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

`src/lib/api/contrato-rotas.test.ts` varre todo `src/app/api/**/route.ts`.
`ROTAS_LEGADAS` lista o que ainda não migrou e **só encolhe** — rota nova nunca
entra na lista. Ao migrar uma rota, apague a linha dela lá.
