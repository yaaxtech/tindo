# YAAX × SEUCAMARÃO — DOMÍNIOS, IDENTIDADE E WORKSPACES

> **Escopo:** decisão de nível YaaX (acima do TinDo). Vive aqui por falta de um
> repositório `yaaxtech/yaax`; quando ele existir, este arquivo migra para lá.
>
> **Data:** 2026-08-14 · **Decisor:** Emanuel
> **Revisão 3.** Histórico das correções:
> - **v1** → recomendava ferramentas com o nome YaaX. Errado: subestimava o
>   atrito diário com o sócio. Corrigido na seção 3.
> - **v2** → recomendava `@yaax.com.br` como *dono* de todas as contas,
>   inclusive as da SeuCamarão. Errado pelo mesmo motivo, uma camada mais
>   fundo. Corrigido na seção 5 — o endereço YaaX é **recuperação**, não dono.

---

## 1. A PERGUNTA

Ao criar Jira, Slack e mover os sites para a Vercel, sob qual identidade tudo
isso deve ser registrado: e-mail pessoal, **YaaX**, **3 Turbinas** ou
**SeuCamarão**?

## 2. A DECISÃO

Duas respostas, porque são duas perguntas diferentes:

- **Identidade e controle → YaaX.** Toda conta de ferramenta tem
  `emanuel@yaax.com.br` como dono e endereço de recuperação.
- **Nome nas ferramentas do time → SeuCamarão.** Slack, Jira e Vercel usam o
  nome e o domínio da SeuCamarão.

E o corolário que simplifica tudo: **projetos solo não precisam de Slack nem de
Jira.** TinDo e 3 Turbinas têm uma pessoa só; GitHub Issues resolve. Logo existe
**um Slack só e um Jira só, ambos SeuCamarão** — e o problema de pagar licença
dupla por si mesmo desaparece.

---

## 3. A DISTINÇÃO QUE RESOLVE — nome na porta ≠ controle

A versão 1 deste documento recomendava ferramentas com o nome YaaX, tratando o
desconforto do sócio como "leve estranheza de branding". **Isso estava errado, e
o erro era de peso:** atrito de sócio compõe ao longo de anos, migração de
ferramenta é um fim de semana. A versão 1 cobrava um custo certo e diário para
proteger contra um cenário hipotético.

A correção vem de separar duas coisas que a v1 tratava como uma:

| | Onde vive | Quem percebe |
|---|---|---|
| **Controle** — quem é dono da conta, quem recupera o acesso | Conta `emanuel@yaax.com.br` como *owner* / *billing admin* | Ninguém. É uma linha em tela de administração que o time nunca abre. |
| **Nome na porta** — o que aparece no topo do Slack | Nome e domínio da ferramenta | O Eduardo. Todo dia. |

Toda a proteção que motivava a recomendação original (não perder o e-mail se a
SeuCamarão for vendida, manter recuperação de conta, poder sair limpo) mora na
**conta dona** — e não exige que a ferramenta **se chame** YaaX.

### O ponto societário

A participação do Emanuel na SeuCamarão fica **em nome dele, pessoa física** —
não via YaaX. Portanto a YaaX **não está acima** da SeuCamarão: são pares. A
estrutura das ferramentas tem de espelhar o contrato social, nunca o contrário.

**Narrativa correta:** *"YaaX é o meu laboratório pessoal, onde construo minhas
ferramentas em paralelo"* — fica ao lado da SeuCamarão e não ameaça ninguém.
**Narrativa a evitar:** *"YaaX é o guarda-chuva de todos os meus projetos, e a
SeuCamarão é um deles"* — coloca o sócio debaixo do Emanuel, sem respaldo no
contrato social.

---

## 4. POR QUE A IDENTIDADE AINDA É YAAX

### Por que não ancorar identidade na SeuCamarão

- Tem **sócio** (Eduardo) e cap table.
- Atende **terceiros com outros donos**: Maioli (família) e Orka (amigos).
- É a única que pode **receber investidor ou ser vendida**.

Se a SeuCamarão mudar de mãos, o domínio vai junto. Isso é normal e esperado —
você entrega a empresa. O que não pode ir junto é a **sua identidade**: seu
e-mail de recuperação, seu login das outras contas, seus projetos pessoais.

### Por que não 3 Turbinas

É uma **camada de vida** (Profissional / Vida / Felicidade), não uma entidade
que assina contrato, emite nota ou contrata gente. Fica *acima* de tudo
conceitualmente e *fora* de tudo operacionalmente.

### Por que não e-mail pessoal (Gmail)

Não é transferível nem delegável, e a recuperação fica presa a uma pessoa
física. Ver seção 6 — este ponto é urgente, não teórico.

---

## 5. DESENHO CONCRETO

| Ferramenta | Nome na porta | Conta dona |
|---|---|---|
| Slack | **SeuCamarão** | `emanuel@yaax.com.br` |
| Jira (`seucamarao.atlassian.net`) | **SeuCamarão** | `emanuel@yaax.com.br` |
| Vercel — sites da SC | **Team SeuCamarão** | `emanuel@yaax.com.br` |
| Google Workspace do time | **`seucamarao.com.br`** | super-admin: Emanuel |
| GitHub — código da SC | **org `seucamarao`** (criar) | Emanuel como owner |
| GitHub — TinDo, 3 Turbinas, laboratório | **org `yaaxtech`** (já existe) | Emanuel |
| Vercel — TinDo, 3 Turbinas | conta pessoal / Hobby por enquanto | Emanuel |

**Regra de titularidade (corrigida na revisão 3):** a conta pertence a quem é
dono do **ativo**, e o e-mail que cria a conta é quem declara isso. O
`@yaax.com.br` **não** entra como dono das contas da SeuCamarão — entra como
**e-mail de recuperação**. Colocar o endereço de outra empresa como proprietário
dos ativos da SC repete, uma camada mais fundo, o erro da versão 1: no dia da
formalização, contador e sócio veem o e-mail da YaaX como dono de tudo que é da
SeuCamarão.

O que protege o Emanuel numa venda não é possuir as contas da SC com um endereço
YaaX — é **a identidade dele nunca ter estado lá dentro**.

### 5.0 Os quatro endereços e o papel de cada um

| Endereço | Papel | Nunca usar para |
|---|---|---|
| `emanuel@yaax.com.br` | **Cofre.** Cria e possui o que é dele; é recuperação de tudo, inclusive do que é da SC. | falar com cliente |
| `emanuel@seucamarao.com.br` | **Trabalho.** Ele dentro da empresa. | criar conta que a empresa precisará compartilhar |
| `contato@` · `financeiro@` · `social@seucamarao.com.br` | **Papéis da empresa.** Criam e possuem o que é da empresa. | qualquer coisa pessoal |
| `falecomseucamarao@gmail.com` | **Legado.** Congelar e migrar aos poucos. | criar qualquer coisa nova |

No Google Workspace, **grupo não consome licença paga** — os endereços de papel
saem de graça.

**Por que endereços de papel importam para a sociedade:** se o Instagram da
SeuCamarão está no Gmail pessoal do Emanuel, a Mayane não posta sem a senha
dele, ninguém entra se ele sumir, e o ativo é tecnicamente *dele*, não da
sociedade. É o tipo de coisa que vira conflito sem ninguém ter agido de má-fé.

### 5.0.1 Tabela de alocação — com qual e-mail criar cada coisa

**Ativos da SeuCamarão:**

| Sistema | Criar com | Observação |
|---|---|---|
| Google Workspace | `emanuel@seucamarao.com.br` (super admin) | base de todo o resto |
| Slack | `emanuel@seucamarao.com.br` | ⚠️ o Slack não transfere *Primary Owner* para e-mail pessoal — precisa ser do domínio da empresa. Criar com o endereço YaaX impediria passar o comando ao Eduardo depois. |
| Jira | `emanuel@seucamarao.com.br` | ao verificar o domínio, as contas viram gerenciadas |
| Vercel | `emanuel@seucamarao.com.br` | adicionar `emanuel@yaax.com.br` como 2º e-mail (aceita até 3) |
| GitHub org `seucamarao` | conta pessoal do Emanuel cria; cobrança em `financeiro@` | |
| Instagram / Facebook | **Business Portfolio da SC** + `social@seucamarao.com.br` | ⚠️ um Instagram só pode pertencer a um Business Manager por vez |
| Banco, pagamentos, nota fiscal | `financeiro@seucamarao.com.br` | |
| Supabase / Cloudflare de projeto da SC | `emanuel@seucamarao.com.br` | |
| Domínio `seucamarao.com.br` | titularidade no CPF hoje → **CNPJ da SC na formalização** | ver 5.0.2 |

**Ativos do Emanuel / YaaX:**

| Sistema | Criar com |
|---|---|
| TinDo, 3 Turbinas, ferramentas paralelas | `emanuel@yaax.com.br` |
| GitHub `yaaxtech` | conta pessoal (já está correto) |
| Cloudflare / Supabase do TinDo | `emanuel@yaax.com.br` |
| Domínio `yaax.com.br` | **CPF do Emanuel, para sempre** |

### 5.0.2 O detalhe brasileiro — titularidade `.br` é CPF/CNPJ, não e-mail

No `.br` o dono do domínio é um **CPF ou CNPJ**, não um endereço de e-mail. E
trocar a titularidade não é um botão: exige carta impressa, **firma reconhecida
em cartório** e envio pelos **Correios** ao Registro.br.

- `yaax.com.br` no CPF do Emanuel — correto, e fica assim para sempre.
- `seucamarao.com.br` no CPF hoje — correto por ora, mas **entra na lista de
  formalização** junto com o CNPJ.
- Corolário: não registrar mais domínios da SC no CPF do que o necessário.

### 5.1 Slack — um workspace: SeuCamarão

- Canais por frente: `#produto`, `#ops`, `#maioli`, `#orka`, `#geral`.
- Eduardo e Mayane entram como membros normais.
- **Sócios de Maioli e Orka não entram como membros.** Use canal compartilhado
  (*Slack Connect*), disponível inclusive no plano gratuito — eles ficam no
  ambiente deles. Convidado de canal único dentro do seu workspace exige plano
  pago.
- **Disciplina:** assunto societário e financeiro (participações, distribuição,
  negociação com investidor) fica fora do Slack. Exportar canais privados e DMs
  exige plano Business+.

### 5.2 Jira — um site: `seucamarao.atlassian.net`

- A Atlassian cobra **por pessoa por ambiente** nos planos Standard e Premium,
  sem agregar licenças entre ambientes. Um site só evita pagar duas vezes.
- Projetos com chaves `SC`, `MAI`, `ORK`.
- ⚠️ A chave (`SC-123`) entra em links, commits e branches **para sempre**.
  Escolha uma vez e não mude.
- TinDo e 3 Turbinas **não entram aqui** — usam GitHub Issues.

### 5.3 Vercel — Team SeuCamarão

- Projetos: `seucamarao`, `maioli`, `orka` — cada um com seu domínio. O nome do
  Team não aparece para o visitante.
- Pro custa US$ 20 por desenvolvedor/mês; o plano gratuito não permite uso
  comercial. TinDo e 3 Turbinas, sendo ferramentas próprias sem receita, podem
  ficar na conta pessoal por enquanto.
- **Custo de errar aqui é baixo:** transferir projeto entre Teams é recurso
  documentado, leva domínios, aliases e variáveis de ambiente junto e roda sem
  downtime. Só exige re-adicionar integrações e as variáveis definidas em
  `vercel.json`.
- ⚠️ **TinDo não é "só apontar para a Vercel":** o repositório tem
  `wrangler.toml`, `open-next.config.ts`, um worker de cron em `cf-worker-cron/`
  e um CI que roda `cf:build` e publica em `tindoapp.pages.dev`. Migrar exige
  remover o OpenNext/wrangler, reescrever o workflow e recriar os crons como
  Vercel Cron Jobs.

### 5.4 GitHub

- `yaaxtech` continua sendo o laboratório do Emanuel (TinDo, 3 Turbinas).
- Criar a org `seucamarao` para o código da SC, pelo mesmo motivo de coerência
  com o sócio.
- Transferir repositório entre orgs é das poucas migrações realmente limpas:
  preserva histórico, issues, pull requests e redirecionamentos.

---

## 6. E-MAIL — o ponto urgente

**Situação atual:** `falecomseucamarao@gmail.com` usado para tudo.

### Por que trocar não é estética

1. **Não é transferível nem delegável.** Para a Mayane responder cliente, é
   preciso entregar a senha. Conta Gmail pessoal não tem delegação real.
2. **Não sobrevive à formalização.** No dia do CNPJ, a caixa da empresa não pode
   ser conta pessoal de uma pessoa física.
3. **A dívida cresce todo dia.** Cada cliente, integração e cadastro novo
   apontado para esse endereço aumenta o custo de trocar. É o degrau nº 1 da
   escada da seção 7 — o mais caro de reverter.

Com 3 pessoas, migrar agora é uma tarde. Daqui a seis meses é uma semana.

### O desenho barato — não são dois Workspaces pagos

| Item | O quê | Custo |
|---|---|---|
| 1 | **Google Workspace em `seucamarao.com.br`** — contas `emanuel@`, `eduardo@`, `mayane@`. Caixa de trabalho do dia a dia. | Business Starter ≈ R$ 33–42 por pessoa/mês (varia com câmbio e IOF de 6,38%). **Total ≈ R$ 100–125/mês** |
| 2 | **`yaax.com.br` no Cloudflare Email Routing** — `emanuel@yaax.com.br` apenas encaminha para a caixa da SC. Até 200 endereços, sem limite de mensagens. | **R$ 0** |
| 3 | **Cada conta criada com o endereço da tabela 5.0.1**, e `emanuel@yaax.com.br` cadastrado como **recuperação** em todas elas. Sempre e-mail + senha, nunca "Entrar com Google". | — |
| 4 | `falecomseucamarao@gmail.com` → `contato@seucamarao.com.br`. O Google importa o histórico do Gmail gratuitamente; manter o Gmail encaminhando por 12 meses. | — |

**O truque:** `emanuel@yaax.com.br` é só um endereço apontável, porque o DNS do
`yaax.com.br` é seu. Se um dia a SeuCamarão sair das suas mãos, basta
redirecionar o encaminhamento para outro destino e nenhuma conta é perdida.
Custa zero, e o nome YaaX não aparece em nenhum lugar que o sócio veja.

> Cloudflare Email Routing só **recebe**. Enviar como `@yaax.com.br` exige
> configurar "Enviar e-mail como" no Gmail com um SMTP. Para o uso pretendido
> (recuperação de conta e cadastro de ferramentas) receber já basta.

### 6.1 Dá para trocar o e-mail depois, plataforma por plataforma?

| Plataforma | Troca depois? | Detalhe |
|---|---|---|
| **GitHub** | ✅ Fácil | *Settings → Emails*: adiciona o novo, marca como primário, remove o antigo. |
| **Vercel** | ✅ Fácil | *Settings → Emails* → "Add Another" → verificar → "Set as Primary". Até 3 e-mails por conta, no máximo 2 do mesmo domínio. Conexões de login ficam em *Authentication*. |
| **ChatGPT / OpenAI** | ✅ Sim | *Settings → Account*. Se a conta foi criada com "Entrar com Google", é preciso **definir uma senha antes**. Vale para ChatGPT e API juntos. |
| **Slack** | ✅ Sim, com ressalva | Perfil → alterar e-mail. ⚠️ Transferir o *Primary Owner* exige que o novo dono já seja membro **com e-mail do domínio da empresa** — o Slack não transfere para e-mail pessoal. |
| **Jira / Atlassian** | ⚠️ Depende | Livre enquanto a conta não for "gerenciada". Ao **verificar o domínio** (o que se vai querer fazer), as contas viram gerenciadas e só o admin da organização troca — e apenas entre domínios verificados na mesma organização. |
| **Claude (Anthropic)** | ❌ **Não existe** | A documentação oficial diz para criar a conta com um e-mail ao qual se terá acesso a longo prazo. A única saída é conta nova, perdendo histórico, Projects e assinatura. |

**Resumo:**

| ✅ Muda fácil | ⚠️ Muda com dor | ❌ Não muda |
|---|---|---|
| GitHub · Vercel · ChatGPT · Cloudflare · e-mail do Instagram | Jira (conta gerenciada, só o admin troca) · Slack (*Primary Owner* exige domínio da empresa) · titularidade `.br` (cartório + Correios) | **Claude** (a Anthropic não permite) · **"Entrar com Google"** (é vínculo de identidade, não campo de texto) |

### 6.2 O que realmente custa caro (não é a tela de configurações)

1. **"Entrar com Google" é a trava real.** Criar conta clicando em "Login com
   Google" vincula à *identidade Google*, não a um campo de texto — e desfazer
   isso é bem pior que trocar um e-mail. **Regra: cadastrar com e-mail + senha,
   usando `emanuel@yaax.com.br`.**
2. **As contas esquecidas.** Não são seis plataformas, são umas quarenta:
   registrador de domínio, Cloudflare, Supabase, meio de pagamento, Todoist,
   apps do celular, webhooks, emissor de nota. A esquecida é sempre a
   necessária às 2h da manhã.
3. **O efeito Claude.** Qualquer plataforma pode simplesmente não permitir a
   troca — e só se descobre na hora.

### 6.3 A consequência prática — e ela é barata

Não é preciso pagar nada hoje para parar de piorar o problema:

1. Ativar **Cloudflare Email Routing** em `yaax.com.br` — grátis, ~10 minutos.
2. A partir de agora, **cadastrar toda conta nova com `emanuel@yaax.com.br`**,
   com e-mail e senha, nunca com "Entrar com Google".

Isso congela a dívida onde ela está. O Google Workspace pago pode vir depois; o
que não pode é continuar criando conta em Gmail pessoal.

> **Nota sobre o Claude:** a conta atual está em `falecomyaax@gmail.com` e,
> pela política da Anthropic, não pode ser migrada para `@yaax.com.br`. O dano
> é contido: já é um endereço do lado YaaX da fronteira, não da SeuCamarão.
> Recomendação: deixar como está e não repetir o padrão nas contas novas.

---

## 7. CUSTO DE DESFAZER — decida na ordem inversa

| # | Decisão | Custo de reverter | Implicação |
|---|---|---|---|
| 1 | **E-mail / domínio de identidade** | 🔴 Altíssimo | Refazer recuperação de conta em dezenas de serviços, e sempre se esquece um |
| 2 | **Slack** | 🟠 Alto | Exportar canais privados e DMs exige Business+ |
| 3 | **Jira** | 🟡 Médio | Dá para mover projeto entre ambientes, mas chaves (`SC-123`) já vazaram para links e commits |
| 4 | **Vercel** | 🟢 Baixo | Transferência entre Teams é nativa, com domínios e sem downtime |

---

## 8. GATILHOS DE REVISÃO

### A YaaX ganha Workspace e ferramentas próprias quando:

- TinDo ou outra ferramenta do laboratório passar a ter usuários pagantes;
- a YaaX atender cliente externo, cobrando por isso;
- houver alguém trabalhando para a YaaX e não para a SeuCamarão.

### Revisar tudo na formalização da SeuCamarão (CNPJ):

- transferir a titularidade das assinaturas para o CNPJ;
- revisar quem é super-admin do Workspace e owner de cada ferramenta —
  mantendo `@yaax.com.br` como recuperação;
- mover o código da SC para a org `seucamarao` no GitHub, se ainda não estiver;
- formalizar por escrito a relação YaaX → SeuCamarão (prestação de serviço de
  desenvolvimento), para o contador e para o sócio.

---

## 9. ORDEM DE EXECUÇÃO

1. Confirmar `yaax.com.br`, `seucamarao.com.br` e `3turbinas.com.br` registrados
   e sob seu controle.
2. Ativar **Cloudflare Email Routing** em `yaax.com.br` — grátis, 10 minutos.
3. Criar o **Google Workspace em `seucamarao.com.br`** com as três contas;
   importar o histórico do Gmail; deixar o Gmail encaminhando.
4. Criar os grupos de papel: `contato@`, `financeiro@`, `social@seucamarao.com.br`
   (grátis, não consomem licença).
5. Migrar as **redes sociais** do Gmail para um Business Portfolio da SeuCamarão
   — é o ativo mais exposto hoje.
6. Criar o **Slack SeuCamarão** com `emanuel@seucamarao.com.br`.
7. Criar o **Jira `seucamarao.atlassian.net`**, mesmo endereço.
8. Criar a org **`seucamarao`** no GitHub.
9. Criar o **Team SeuCamarão na Vercel** e migrar os sites — TinDo por último,
   já que é o de maior trabalho.
10. Em todas as contas acima, cadastrar `emanuel@yaax.com.br` como e-mail de
    recuperação.

---

## 10. FONTES CONSULTADAS

- Atlassian — licenciamento por site: <https://community.atlassian.com/forums/Jira-questions/Multiple-Jira-cloud-sites-under-the-same-organization-and/qaq-p/1646417>
- Atlassian — usuários e faixas de licença: <https://support.atlassian.com/subscriptions-and-billing/docs/manage-users-and-user-tiers/>
- Slack — papéis de convidado: <https://slack.com/help/articles/202518103-Understand-guest-roles-in-Slack>
- Slack — limitações do plano gratuito: <https://slack.com/help/articles/27204752526611-Feature-limitations-on-the-free-version-of-Slack>
- Slack — exportar dados do workspace: <https://slack.com/help/articles/201658943-Export-your-workspace-data>
- Google Workspace — planos e preços: <https://workspace.google.com/pricing>
- Google — Domain Transfer Divestiture: <https://support.google.com/a/answer/16085518>
- Vercel — transferir um projeto: <https://vercel.com/docs/projects/transferring-projects>
- Vercel — transferência sem downtime: <https://vercel.com/blog/transfer-vercel-projects-with-zero-downtime>
- Cloudflare Email Routing: <https://developers.cloudflare.com/email-routing/>

### Troca de e-mail por plataforma

- Claude — não é possível trocar o e-mail: <https://support.claude.com/en/articles/8452276-how-do-i-change-the-email-address-associated-with-my-account>
- OpenAI — como trocar o e-mail: <https://help.openai.com/en/articles/4936827-how-to-change-your-email-address>
- GitHub — trocar o e-mail principal: <https://docs.github.com/en/account-and-profile/how-tos/email-preferences/changing-your-primary-email-address>
- Vercel — gerenciamento de conta: <https://vercel.com/docs/accounts>
- Slack — trocar e-mail: <https://slack.com/help/articles/207262907-Change-your-email-address>
- Slack — transferir a propriedade do workspace: <https://slack.com/help/articles/204401633-Transfer-ownership-of-a-workspace-or-org>
- Atlassian — trocar e-mail da conta: <https://support.atlassian.com/atlassian-cloud/kb/change-atlassian-account-email-addresses/>
- Atlassian — verificar domínio e contas gerenciadas: <https://support.atlassian.com/user-management/docs/verify-a-domain-to-manage-accounts/>
- Registro.br — transferência de titularidade: <https://registro.br/ajuda/procedimentos-administrativos/transferencia-de-titularidade/>
