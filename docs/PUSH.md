# Web Push — TinDo

## 1. Gerar VAPID keys

```bash
bun scripts/generate-vapid.ts
```

O script imprime as chaves e salva em `.env.local.vapid-tmp` (gitignored).
Copie as 4 linhas para `.env.local`:

```
VAPID_PUBLIC_KEY=<gerada>
VAPID_PRIVATE_KEY=<gerada>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<gerada>   # mesmo valor que VAPID_PUBLIC_KEY
VAPID_SUBJECT=mailto:falecomseucamarao@gmail.com
```

> Gere apenas uma vez por instancia. Regenerar invalida todas as subscriptions existentes.

## 2. Variavel de ambiente em producao (Cloudflare Pages)

No dashboard CF Pages -> Settings -> Environment Variables, adicione:

| Variavel | Valor |
|----------|-------|
| `VAPID_PUBLIC_KEY` | chave publica |
| `VAPID_PRIVATE_KEY` | chave privada (secreta) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | mesma chave publica |
| `VAPID_SUBJECT` | `mailto:falecomseucamarao@gmail.com` |

## 3. Como testar localmente

1. Rode `bun run dev` em HTTPS (ou use ngrok/CF tunnel — push nao funciona em HTTP).
2. Abra `/configuracoes`.
3. Ative "Receber notificacoes push" e clique "Ativar neste dispositivo".
4. Aceite a permissao do navegador.
5. Clique "Enviar notificacao de teste" — deve aparecer uma notificacao do sistema.

## 4. Limitacoes iOS

- Push so funciona se o app for **adicionado a tela de inicio** (PWA instalado via Safari -> Compartilhar -> Adicionar a tela de inicio).
- Versao minima: iOS 16.4+.
- Navegadores alternativos (Chrome, Firefox) no iOS nao suportam push.

## 5. Debug

- Chrome DevTools -> Application -> Service Workers -> verificar `sw-push.js` ativo.
- Application -> Push Messaging -> pode simular push manualmente.
- Console: erros de VAPID aparecem no servidor (Next.js logs).
- Tabela `push_envios` no Supabase registra todos os envios com status.

## 6. Endpoint para cron

```
POST /api/push/disparar-gatilhos
Authorization: Bearer <CRON_SECRET>
```

Chame este endpoint no final do cron diario. Ele verifica os 3 gatilhos e dispara
notificacoes apenas se necessario (push_habilitado = true no usuario).
