# YAAX × SEUCAMARÃO — DOMÍNIOS, IDENTIDADE E WORKSPACES

> **Escopo:** decisão de nível YaaX (acima do TinDo). Vive aqui por falta de um
> repositório `yaaxtech/yaax`; quando ele existir, este arquivo migra para lá.
>
> **Data:** 2026-08-14 · **Decisor:** Emanuel
> **Revisão 4.** Histórico das correções:
> - **v1** → recomendava ferramentas com o nome YaaX. Errado: subestimava o
>   atrito diário com o sócio. Corrigido na seção 3.
> - **v2** → recomendava `@yaax.com.br` como *dono* de todas as contas,
>   inclusive as da SeuCamarão. Errado pelo mesmo motivo, uma camada mais
>   fundo. Corrigido na seção 5 — o endereço YaaX é **recuperação**, não dono.
> - **v3** → recomendava um Slack e um Jira só. Errado: o Emanuel vai usar as
>   duas ferramentas também nos projetos da YaaX, e ambos os lados cabem no
>   plano gratuito. Corrigido nas seções 5.1 e 5.2 — dois de cada, a custo zero.
> - **v4** → acrescenta o risco ativo do e-mail compartilhado (seção 2.1), o
>   passo a passo de criação dos e-mails (6.4) e a tabela de custos (6.5).

---

## 1. A PERGUNTA

Ao criar Jira, Slack e mover os sites para a Vercel, sob qual identidade tudo
isso deve ser registrado: e-mail pessoal, **YaaX**, **3 Turbinas** ou
**SeuCamarão**?

## 2. A DECISÃO

Duas respostas, porque são duas perguntas diferentes:

- **Identidade e recuperação → YaaX.** `emanuel@yaax.com.br` é o endereço-cofre
  e a recuperação de toda conta, inclusive as da SeuCamarão.
- **Titularidade de cada conta → a entidade dona do ativo.** Ferramentas da
  SeuCamarão são criadas com `@seucamarao.com.br`; as do laboratório, com
  `@yaax.com.br`.
- **Slack e Jira → um de cada, para cada lado.** Dois workspaces Slack e dois
  sites Jira, YaaX e SeuCamarão, ambos no plano gratuito.

**Correção da v3:** a v3 dizia "um Slack só e um Jira só, ambos SeuCamarão",
partindo de que projetos solo não precisam dessas ferramentas e de que a
Atlassian cobra por ambiente. Ambas as premissas caíram: o Emanuel **vai** usar
Jira e Slack nos projetos da YaaX, e no tamanho atual os dois lados cabem no
plano gratuito — **Jira Free até 10 pessoas, sem prazo; Slack Free sem
expiração** (90 dias de histórico). Dois de cada custam **R$ 0**, dão fronteira
limpa desde o dia 1 e evitam a separação dolorosa lá na frente. Quando doer,
paga-se só o lado que precisa.

---

## 2.1 🔴 RISCO ATIVO — o e-mail compartilhado

**Situação:** Supabase, GitHub e as assinaturas de Claude e ChatGPT foram
criados com `falecomseucamarao@gmail.com`, **uma caixa compartilhada com outra
pessoa**.

**Um e-mail compartilhado não é um e-mail — é uma chave-mestra compartilhada.**
Quem tem acesso a ela consegue redefinir a senha de tudo que foi criado com ela:
o código no GitHub, o banco com dados reais no Supabase, as assinaturas pagas.
Não é questão de confiança: o arranjo torna impossível saber quem fez o quê e
torna os ativos não-atribuíveis — em qualquer desacordo, tudo fica contestado.

**A correção mais rápida não é migrar, é 2FA.** Segundo fator com o autenticador
no celular do Emanuel bloqueia a tomada de conta por redefinição de senha, e
funciona hoje, antes de qualquer migração.

| Conta | Ação imediata | Migra depois? |
|---|---|---|
| **Supabase** (dados reais) | 🔴 2FA + salvar códigos de backup | ✅ |
| **GitHub** (código) | 🔴 2FA + salvar códigos | ✅ troca fácil |
| **ChatGPT** | 2FA + definir senha própria | ✅ (se entrou com Google, criar senha antes) |
| **Claude / Claude Code** | 2FA + salvar códigos | ❌ **não migrável** — decisão à parte |

O Claude é o caso doloroso: a Anthropic não permite trocar o e-mail. Opções:
conviver, com 2FA no celular do Emanuel, ou abrir conta nova no endereço correto
e perder o histórico.

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

### 5.0.1b Endereço pessoal ou endereço de papel? Uma pergunta resolve

> **A plataforma aceita mais de um administrador?**
> **Sim** → endereço pessoal (`emanuel@`), com o Eduardo adicionado como segundo
> admin. A continuidade vem da plataforma, não do e-mail.
> **Não** (um login = uma conta) → endereço de papel (`financeiro@`, `contas@`),
> com a senha num cofre compartilhado.

| Sistema | Aceita 2º admin? | Criar com |
|---|---|---|
| Slack, Jira, Vercel, GitHub, Google Workspace, Meta Business | ✅ | `emanuel@seucamarao.com.br` + Eduardo como admin |
| Registro.br, banco, emissor de nota, contador | ❌ login único | `financeiro@seucamarao.com.br` + cofre de senhas |

**Por que não usar endereço de papel para tudo:** login compartilhado é senha
compartilhada — ninguém é responsável por nada e o 2FA vira bagunça (quem fica
com o autenticador?). Onde a plataforma tem papéis, ela resolve continuidade
melhor que senha passada de mão em mão — e, com sócio, o registro de quem fez o
quê tem valor.

**Por que não usar endereço pessoal para tudo:** os sistemas de login único
morreriam junto com o acesso do Emanuel.

### 5.0.1c Risco de travamento por domínio vencido

**O medo:** as empresas param, o domínio não é renovado, e o acesso a tudo se
perde porque o e-mail de login deixou de existir. O medo é legítimo. A proteção
tem três camadas.

**A) E-mail nunca pode ser a única forma de recuperar uma conta.**
Toda conta importante recebe 2FA por aplicativo e, principalmente, **códigos de
backup salvos** — 8 a 10 códigos que funcionam offline, sem e-mail, sem telefone
e sem domínio. Com os códigos guardados, domínio vencido não tranca ninguém para
fora de nada. Esta é a proteção real, e custa zero.

**B) O Gmail vira rede de segurança, não problema.**
Um Gmail gratuito é, num aspecto específico, mais durável que domínio próprio:
não depende de pagar ninguém. Portanto `falecomyaax@gmail.com` **não é erro a
migrar** — é promovido a **e-mail de recuperação de última instância**. Nunca
cria nada; fica cadastrado como recuperação secundária em tudo.

**C) Perder um `.br` é mais difícil do que parece.**

| Momento | O que acontece |
|---|---|
| Vencimento | ~14 dias ainda no ar, marcado como expirado |
| Em seguida | até **90 dias congelado** — fora do ar, mas ainda do titular e renovável |
| Só depois | liberação/leilão (~30 dias) |

São cerca de 3 meses e meio de folga. Blindagens: **pagamento automático** no
Registro.br, ciclo **bianual ou trianual** e o custo baixo (`.com.br` na casa de
R$ 40/ano — três anos de `yaax.com.br` por volta de R$ 120).

O essencial: a titularidade é do **CPF do Emanuel**. Mesmo que SeuCamarão,
Maioli e Orka parem todas, `yaax.com.br` continua dele enquanto ele renovar —
não depende de nenhuma empresa estar viva.

**Hierarquia de recuperação (nesta ordem):**

1. **Códigos de backup**, no cofre de senhas — funcionam sem nada.
2. `emanuel@yaax.com.br` — recuperação primária; depende só de R$ 40/ano.
3. `falecomyaax@gmail.com` — última instância; não depende de pagar nada.
4. Telefone.

### 5.0.2 O detalhe brasileiro — titularidade `.br` é CPF/CNPJ, não e-mail

No `.br` o dono do domínio é um **CPF ou CNPJ**, não um endereço de e-mail. E
trocar a titularidade não é um botão: exige carta impressa, **firma reconhecida
em cartório** e envio pelos **Correios** ao Registro.br.

- `yaax.com.br` no CPF do Emanuel — correto, e fica assim para sempre.
- `seucamarao.com.br` no CPF hoje — correto por ora, mas **entra na lista de
  formalização** junto com o CNPJ.
- Corolário: não registrar mais domínios da SC no CPF do que o necessário.

### 5.1 Slack — dois workspaces, ambos gratuitos

| Workspace | Criado com | Quem entra | Plano |
|---|---|---|---|
| **SeuCamarão** | `emanuel@seucamarao.com.br` | Emanuel, Eduardo, Mayane | Free |
| **YaaX** | `emanuel@yaax.com.br` | Emanuel (e freelas eventuais) | Free |

- Canais da SC: `#produto`, `#ops`, `#maioli`, `#orka`, `#geral`.
- Canais da YaaX: `#tindo`, `#3turbinas`, `#lab`.
- **Sócios de Maioli e Orka não entram como membros.** Use canal compartilhado
  (*Slack Connect*), disponível inclusive no plano gratuito — eles ficam no
  ambiente deles. Convidado de canal único exige plano pago.
- O Free não expira; a limitação é **90 dias de histórico** e 10 apps. Quando
  isso doer, paga-se **só o lado que precisa** (Pro ≈ US$ 7,25/pessoa/mês no
  anual).
- **Disciplina:** assunto societário e financeiro fica fora do Slack. Exportar
  canais privados e DMs exige Business+.

### 5.2 Jira — dois sites, ambos gratuitos

| Site | Criado com | Projetos | Plano |
|---|---|---|---|
| `seucamarao.atlassian.net` | `emanuel@seucamarao.com.br` | `SC`, `MAI`, `ORK` | Free |
| `yaax.atlassian.net` | `emanuel@yaax.com.br` | `TIN`, `TRB`, `YAX` | Free |

- **Jira Free vai até 10 pessoas, sem prazo de validade** — os dois sites cabem
  no gratuito. O argumento antigo de "um site só, senão paga duas vezes" só vale
  acima de 10 pessoas por lado.
- Limites do Free: 2 GB de armazenamento, 100 automações/mês, 100 e-mails/dia.
- ⚠️ A chave (`SC-123`) entra em links, commits e branches **para sempre**.
  Escolha uma vez e não mude.
- Acima de 10 pessoas num dos lados, só aquele lado migra para o Standard
  (≈ US$ 6,52–7,91/pessoa/mês).

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

## 6.4 ONDE CRIAR CADA E-MAIL

| Domínio | Onde | O que faz | Custo |
|---|---|---|---|
| `@yaax.com.br` | **Cloudflare Email Routing** | só **recebe** e encaminha — suficiente para endereço-cofre | **R$ 0** |
| `@seucamarao.com.br` | **Google Workspace** | caixa real: envia, recebe, Drive, Agenda, compartilhamento | ~R$ 33–42/pessoa/mês |

**Cloudflare — `@yaax.com.br`:**

1. Criar conta grátis em `dash.cloudflare.com` e adicionar `yaax.com.br`.
2. ⚠️ No **Registro.br**, apontar os servidores DNS para os do Cloudflare — o
   Email Routing **só funciona com a zona no DNS do Cloudflare**.
3. No Cloudflare: *Email → Email Routing → Enable*.
4. Criar `emanuel@yaax.com.br` com destino no Gmail.
5. Confirmar o e-mail de verificação enviado ao destino.

**Google Workspace — `@seucamarao.com.br`:**

1. `workspace.google.com` → começar → informar `seucamarao.com.br`.
2. Verificar o domínio (registro TXT) e adicionar os registros MX.
3. Criar `emanuel@`, `eduardo@`, `mayane@`.
4. Criar os **grupos** `contato@`, `financeiro@`, `social@` — não consomem
   licença.
5. Importar o histórico do Gmail com a ferramenta de migração do Google.

**Como tudo chega ao Gmail:**

| Endereço | Acesso | Por quê |
|---|---|---|
| `emanuel@seucamarao.com.br` | **é um Gmail** — mesmo app, seletor de conta | caixa de trabalho, merece inbox própria; não encaminhar |
| `emanuel@yaax.com.br` | **encaminha** para a caixa preferida | endereço-cofre, volume baixo |
| responder como outro endereço | Gmail → Configurações → Contas → *Enviar e-mail como* | só se quiser responder com outra identidade |

---

## 6.5 CUSTOS — a conta fechada

**Recorrente mensal:**

| Item | Plano | Custo |
|---|---|---|
| Google Workspace `@seucamarao.com.br` | Business Starter × 3 | **~R$ 100–125/mês** |
| Vercel — sites da SeuCamarão | Pro (uso comercial exige Pro) | **US$ 20/dev/mês** |
| Cloudflare Email Routing | Free | R$ 0 |
| Slack YaaX + SeuCamarão | Free × 2 | R$ 0 |
| Jira YaaX + SeuCamarão | Free × 2 (até 10 pessoas) | R$ 0 |
| GitHub `yaaxtech` + `seucamarao` | Free × 2 | R$ 0 |
| Vercel — TinDo, 3 Turbinas | Hobby | R$ 0 |
| Supabase | Free | R$ 0 |
| Grupos de papel | Google Workspace | R$ 0 |
| Cofre de senhas | Bitwarden (tem plano gratuito) | R$ 0 |

**Anual:** `yaax.com.br`, `seucamarao.com.br` e `3turbinas.com.br` a R$ 40/ano
cada no Registro.br — R$ 120/ano no total.

> **Total realista hoje: ~R$ 100–125/mês + ~US$ 20/mês + R$ 120/ano.**

**Quando cada gratuito deixa de servir:**

| Ferramenta | Free aguenta até | Depois |
|---|---|---|
| Jira | 10 pessoas, 2 GB | ≈ US$ 6,52–7,91/pessoa/mês |
| Slack | 90 dias de histórico | Pro ≈ US$ 7,25/pessoa/mês (anual) |
| Vercel Hobby | uso **não** comercial | Pro US$ 20/dev/mês |

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

O plano é faseado para minimizar custo **sem** gerar retrabalho. A chave é que o
Cloudflare Email Routing entrega os endereços corporativos **de graça hoje**, e
o endereço é permanente: quando o Google Workspace entrar, muda só o destino de
entrega (registros MX), não o endereço. Contas criadas na fase 1 continuam
válidas para sempre.

### FASE 0 — HOJE · R$ 0 · parar o perigo

| # | Ação | Onde | Custo |
|---|---|---|---|
| 1 | **2FA com autenticador no celular do Emanuel** + salvar códigos de backup | Supabase, GitHub, Claude, ChatGPT | R$ 0 |
| 2 | Instalar cofre de senhas e guardar os códigos | Bitwarden (plano gratuito) | R$ 0 |
| 3 | Baixar cópia dos arquivos críticos do Drive compartilhado | Google Takeout | R$ 0 |

### FASE 1 — ESTA SEMANA · R$ 120/ano · e-mails corporativos de graça

| # | Ação | Custo |
|---|---|---|
| 1 | Confirmar os 3 domínios no Registro.br, ativar **pagamento automático**, ciclo de 3 anos | ~R$ 40/ano cada = **R$ 120/ano** |
| 2 | Criar conta grátis no Cloudflare e adicionar os 3 domínios | R$ 0 |
| 3 | No Registro.br, apontar os servidores DNS para o Cloudflare | R$ 0 |
| 4 | Ligar **Email Routing** e criar os endereços | R$ 0 |
| 5 | No Gmail: Configurações → Contas → *Enviar e-mail como* | R$ 0 |

**Endereços a criar — todos entregues no Gmail:**

| Endereço | Entrega em | Para quê |
|---|---|---|
| `emanuel@yaax.com.br` | Gmail do Emanuel | 🔑 **cofre** — cria e recupera o que é dele |
| `emanuel@seucamarao.com.br` | Gmail do Emanuel | endereço de trabalho |
| `contato@seucamarao.com.br` | Gmail do Emanuel | clientes |
| `financeiro@seucamarao.com.br` | Gmail do Emanuel | banco, nota, Registro.br |
| `social@seucamarao.com.br` | Gmail do Emanuel | redes sociais |
| `eduardo@seucamarao.com.br` | Gmail do Eduardo | ele |
| `mayane@seucamarao.com.br` | Gmail da Mayane | ela |

> ⚠️ **Regra que zera o retrabalho:** daqui em diante, toda conta nova usa esses
> endereços, com **e-mail e senha — nunca "Entrar com Google"**.

### FASE 2 — PRÓXIMAS SEMANAS · R$ 0 · migrar o que já existe

| # | Migrar | Para | Dificuldade |
|---|---|---|---|
| 1 | **Redes sociais** | Business Portfolio da SC + `social@` | média — ativo mais exposto |
| 2 | **Supabase** (dados reais) | `emanuel@seucamarao.com.br` | fácil |
| 3 | **GitHub** | `emanuel@yaax.com.br` | fácil |
| 4 | **Registro.br** | `financeiro@seucamarao.com.br` | fácil |
| 5 | **ChatGPT** | endereço correto (criar senha antes, se entrou com Google) | fácil |
| 6 | **Claude** | ❌ não migra — decidir entre conviver ou recomeçar | decisão |

### FASE 3 — QUANDO DOER · ~R$ 110/mês · Google Workspace

**Gatilhos, qualquer um:** o Drive compartilhado virar problema; Eduardo ou
Mayane precisarem de caixa própria; ser necessário revogar o acesso de alguém
sem trocar a senha de todos; a SeuCamarão formalizar o CNPJ.

| # | Ação | Custo |
|---|---|---|
| 1 | Criar Workspace em `seucamarao.com.br` | ~R$ 33–42/pessoa/mês × 3 |
| 2 | Trocar os registros MX do Cloudflare pelos do Google | R$ 0 · ~10 min |
| 3 | Migrar e-mail, **Drive**, contatos e agenda do Gmail compartilhado | R$ 0 |
| 4 | Manter `contato@`, `financeiro@`, `social@` como **grupos** | R$ 0 |

> ⚠️ Conta pessoal do Google **não se converte** em conta de empresa — cria-se
> nova e migra-se. E a migração **não leva** Fotos, senhas salvas, compras nem
> os logins de "Entrar com Google" em serviços de terceiros. Daí a regra da
> fase 1.

### FASE 4 — QUANDO PRECISAR · US$ 20/mês · as ferramentas

| # | Criar | Com qual e-mail | Custo |
|---|---|---|---|
| 1 | Slack **SeuCamarão** | `emanuel@seucamarao.com.br` | Free |
| 2 | Slack **YaaX** | `emanuel@yaax.com.br` | Free |
| 3 | Jira `seucamarao.atlassian.net` | `emanuel@seucamarao.com.br` | Free até 10 |
| 4 | Jira `yaax.atlassian.net` | `emanuel@yaax.com.br` | Free até 10 |
| 5 | GitHub org `seucamarao` | conta pessoal do Emanuel | Free |
| 6 | Vercel Team SeuCamarão | `emanuel@seucamarao.com.br` | US$ 20/mês |
| 7 | Migrar o TinDo para a Vercel | — | R$ 0 (trabalho de dev) |

### FASE 5 — NA FORMALIZAÇÃO DO CNPJ

| # | Ação | Custo |
|---|---|---|
| 1 | Transferir `seucamarao.com.br` do CPF para o CNPJ | cartório + Correios |
| 2 | Passar as assinaturas para o CNPJ | — |
| 3 | Revisar admins e endereços de recuperação | R$ 0 |
| 4 | Formalizar por escrito a relação YaaX → SeuCamarão | contador |

### Resumo do gasto

| Quando | Gasto |
|---|---|
| Fase 0 — hoje | **R$ 0** |
| Fase 1 — esta semana | **R$ 120/ano** |
| Fase 2 — próximas semanas | **R$ 0** |
| Fase 3 — quando doer | ~R$ 110/mês |
| Fase 4 — quando precisar | US$ 20/mês |

Até o fim da fase 2 o gasto total é **R$ 120 no ano inteiro** — com endereços
corporativos permanentes, contas protegidas e nenhum retrabalho pela frente.

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

### Preços e planos gratuitos

- Jira — plano gratuito até 10 pessoas: <https://www.atlassian.com/software/jira/pricing>
- Slack — planos e preços: <https://slack.com/pricing>
- Cloudflare Email Routing — exige DNS no Cloudflare: <https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/>
- Registro.br — preço do `.com.br`: <https://registro.br/dominio/precos/>
