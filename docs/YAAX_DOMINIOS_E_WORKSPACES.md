# YAAX — DOMÍNIOS, IDENTIDADE E WORKSPACES

> **Escopo:** decisão de nível YaaX (acima do TinDo). Vive aqui por falta de um
> repositório `yaaxtech/yaax`; quando ele existir, este arquivo migra para lá.
>
> **Data da decisão:** 2026-08-14
> **Decisor:** Emanuel (dono da YaaX, sócio majoritário da SeuCamarão)

---

## 1. A PERGUNTA

Ao criar Jira, Slack e mover os sites para a Vercel, sob qual identidade tudo
isso deve ser registrado: e-mail pessoal, **YaaX**, **3 Turbinas** ou
**SeuCamarão**?

## 2. A DECISÃO

**Âncora = YaaX (`yaax.com.br`).**

Uma casa só, no nome da YaaX, com cômodos separados por projeto. A SeuCamarão
ganha casa própria quando disparar um dos gatilhos da seção 7.

---

## 3. O ERRO QUE ESTA DECISÃO EVITA

Confundir três coisas que **não precisam coincidir**:

| Camada | Pergunta que ela responde | Resposta correta aqui |
|---|---|---|
| **Controle** | Quem é dono da conta? Quem recupera o acesso? | Emanuel, via `emanuel@yaax.com.br` |
| **Casa** | Onde o time trabalha no dia a dia? | 1 Slack + 1 Jira no nome YaaX |
| **Marca** | O que o cliente enxerga? | `seucamarao.com.br` e o domínio de cada produto |
| **Conta** | Quem paga? | SeuCamarão pode pagar — sem virar dona |

> **Regra:** quem paga **não** é quem é dono. Hoje as assinaturas saem pela
> SeuCamarão, e está tudo bem — basta que o e-mail cadastrado como *Owner* /
> *Billing admin* seja `@yaax.com.br` e o cartão seja o da SeuCamarão.

---

## 4. POR QUE NÃO AS OUTRAS OPÇÕES

### Por que não SeuCamarão (apesar de ser o melhor negócio)

É justamente o melhor negócio que a desqualifica como âncora:

- Tem **sócio** (Eduardo) e, portanto, cap table.
- Atende **terceiros com outros donos**: Maioli (família) e Orka (amigos).
- É a única que pode **receber investidor ou ser vendida**.

Se a SeuCamarão for vendida, o domínio vai junto — e com ele o seu e-mail, sua
recuperação de conta, seu Jira, seu Slack, e o histórico de TinDo, 3 Turbinas,
Maioli e Orka, que não têm nada a ver com o comprador. Pior: uma due diligence
entra nesse workspace e lê tudo.

### Por que não 3 Turbinas

3 Turbinas é uma **camada de vida** (Profissional / Vida / Felicidade), não uma
entidade que assina contrato, emite nota ou contrata gente. Ancorar a
infraestrutura de trabalho num projeto pessoal significa que todo contrato,
toda fatura e todo e-mail para cliente passam a carregar o seu sistema de vida.
Ela deve ficar **acima** de tudo conceitualmente e **fora** de tudo
operacionalmente.

### Por que não e-mail pessoal (Gmail)

Propriedade não é transferível nem delegável, recuperação de conta fica presa a
uma pessoa física, e não sobrevive a nenhuma formalização.

### Por que YaaX

- É **100% sua** — sem sócio, sem cap table, sem cenário de venda.
- É o guarda-chuva que já executa o trabalho de dev para todos os projetos.
- A org do GitHub já é `yaaxtech` — a decisão apenas torna coerente o que já existe.

---

## 5. DESENHO CONCRETO POR FERRAMENTA

### 5.1 Identidade — Google Workspace na YaaX

- **Domínio primário:** `yaax.com.br`. Conta-mãe: `emanuel@yaax.com.br`.
- **Domínios secundários no MESMO Workspace:** `seucamarao.com.br` e
  `3turbinas.com.br`.
- Eduardo → `eduardo@seucamarao.com.br`; Mayane → `mayane@seucamarao.com.br`.
  Contas reais, com a cara certa para o cliente, dentro da infra que é sua.
- Você ganha `emanuel@seucamarao.com.br` como alias, para falar com cliente da
  SeuCamarão com a identidade dela.
- **Saída limpa garantida:** o Google tem *Domain Transfer Divestiture*, que
  move um domínio secundário — com usuários, e-mail, Drive, Agenda e grupos —
  para outro Workspace. Os dados são **movidos, não copiados**: IDs, URLs,
  permissões e histórico permanecem idênticos. A separação futura é uma
  operação suportada, não uma gambiarra.
- Custo aproximado: US$ 7–8 por usuário/mês (Business Starter).

### 5.2 Slack — 1 workspace: YaaX

- URL sugerida: `yaax.slack.com`.
- Canais por frente: `#sc-produto`, `#sc-ops`, `#tindo`, `#maioli`, `#orka`,
  `#yaax-interno`.
- Eduardo e Mayane entram como **membros**.
- **Sócios de Maioli e Orka NÃO entram como membros.** Use *Slack Connect*
  (canal compartilhado entre workspaces) — disponível inclusive no plano
  gratuito, e eles permanecem no ambiente deles. Convidado de canal único
  dentro do seu workspace exige plano pago.
- **Sobre separar depois:** exportar canais privados e DMs exige plano
  **Business+**. Isso *não* deve assustar no tamanho atual: com 3 pessoas,
  separar significa abrir um workspace novo e começar limpo, guardando o antigo
  como arquivo. Migração de histórico é problema de empresa com 50 pessoas.
- **Não crie dois Slacks agora** — é burocracia para o tamanho do time.
- **Única disciplina exigida:** assunto societário e financeiro da SeuCamarão
  (participações, distribuição, negociação com investidor) fica **fora** do
  Slack — e-mail ou documento. É o único conteúdo que doeria estar no lugar
  errado no dia da separação.

### 5.3 Jira — 1 site: `yaax.atlassian.net`

- **Motivo duro:** a Atlassian cobra **por usuário por site** nos planos
  Standard e Premium, sem agregação de licença entre sites (só o Enterprise
  consolida). Dois sites = você paga duas vezes por si mesmo.
- Projetos dentro do site, com chaves: `SC` (SeuCamarão), `TIN` (TinDo),
  `MAI` (Maioli), `ORK` (Orka), `YAX` (interno).
- ⚠️ A chave (`SC-123`) entra em links, commits e branches **para sempre**.
  Escolha uma vez e não mude.
- Mover projeto entre sites depois é trabalhoso; mover dentro do mesmo site é
  trivial. Mais um voto em um site só.

### 5.4 Vercel — 1 Team: YaaX

- Projetos: `seucamarao`, `tindo`, `3turbinas`, `maioli`, `orka`, `yaax`.
- Cada projeto mantém seu próprio domínio — o nome do Team não aparece para o
  visitante.
- **Custo de errar aqui é baixo:** transferir projeto entre Teams é recurso
  documentado, leva domínios, aliases e variáveis de ambiente junto, e é feito
  sem downtime. Só exige re-adicionar integrações e as variáveis definidas em
  `vercel.json`. Portanto: **não trave nesta decisão.**
- Pro custa US$ 20 por desenvolvedor/mês. O plano Hobby não permite uso
  comercial.
- ⚠️ **Aviso sobre o TinDo:** hoje ele não é "só apontar para a Vercel". O
  repositório tem `wrangler.toml`, `open-next.config.ts`, um worker de cron em
  `cf-worker-cron/` e um CI que roda `cf:build` e publica em
  `tindoapp.pages.dev`. Migrar exige remover o OpenNext/wrangler, reescrever o
  workflow de CI e recriar os crons como Vercel Cron Jobs. É um PR de verdade.

### 5.5 GitHub — já está correto

- A org `yaaxtech` permanece como está.
- Transferir repositório entre orgs no GitHub é das poucas migrações realmente
  limpas: preserva histórico, issues, PRs e redirects. O dia da separação da
  SeuCamarão não é preocupante do lado do código.

---

## 6. CUSTO DE DESFAZER — decida na ordem inversa

Nem toda decisão desta lista tem o mesmo peso. Errar no Vercel custa 10
minutos; errar no e-mail custa meses.

| # | Decisão | Custo de reverter | Implicação |
|---|---|---|---|
| 1 | **E-mail / domínio de identidade** | 🔴 Altíssimo | Refazer recuperação de conta em dezenas de serviços, e sempre se esquece um |
| 2 | **Slack** | 🟠 Alto | Separar histórico exige Business+; DMs e canais privados não saem em planos menores |
| 3 | **Jira** | 🟡 Médio | Dá para mover projeto entre sites, mas links e chaves (`SC-123`) sofrem |
| 4 | **Vercel** | 🟢 Baixo | Transferência entre Teams é nativa, com domínios e sem downtime |

Decida o item 1 com calma. O item 4 pode ser resolvido depois, sem medo.

---

## 7. GATILHOS DE SEPARAÇÃO

A SeuCamarão ganha Slack, Jira e Google Workspace próprios quando **qualquer
um** destes ocorrer:

- CNPJ da SeuCamarão constituído com contrato social;
- entrada de qualquer sócio ou investidor além de Emanuel e Eduardo;
- contratação de alguém que responda à SeuCamarão e não à YaaX;
- Maioli ou Orka precisarem de acesso **diário** (não eventual);
- qualquer conversa séria de aporte ou venda.

Até lá: um teto só, com cômodos separados.

---

## 8. ORDEM DE EXECUÇÃO

1. Registrar/renovar e apontar `yaax.com.br` (confirmar também `yaax.com`).
2. Criar Google Workspace com primário `yaax.com.br`; migrar `emanuel@` para lá.
3. Adicionar `seucamarao.com.br` e `3turbinas.com.br` como domínios secundários;
   criar contas de Eduardo e Mayane.
4. Criar Slack `yaax.slack.com`; abrir os canais por frente.
5. Criar Jira `yaax.atlassian.net`; criar projetos com as chaves definidas.
6. Criar Team YaaX na Vercel; migrar os sites um a um, TinDo por último (é o
   que dá mais trabalho).

---

## 9. FONTES CONSULTADAS

- Atlassian — licenciamento por site: <https://community.atlassian.com/forums/Jira-questions/Multiple-Jira-cloud-sites-under-the-same-organization-and/qaq-p/1646417>
- Atlassian — usuários e faixas de licença: <https://support.atlassian.com/subscriptions-and-billing/docs/manage-users-and-user-tiers/>
- Slack — papéis de convidado: <https://slack.com/help/articles/202518103-Understand-guest-roles-in-Slack>
- Slack — limitações do plano gratuito: <https://slack.com/help/articles/27204752526611-Feature-limitations-on-the-free-version-of-Slack>
- Slack — exportar dados do workspace: <https://slack.com/help/articles/201658943-Export-your-workspace-data>
- Google — Domain Transfer Divestiture: <https://support.google.com/a/answer/16085518>
- Vercel — transferir um projeto: <https://vercel.com/docs/projects/transferring-projects>
- Vercel — transferência sem downtime: <https://vercel.com/blog/transfer-vercel-projects-with-zero-downtime>
