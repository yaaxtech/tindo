# Configuração da autenticação

Este documento acompanha a implementação incremental do login real. O código aceita senha, link
mágico e recuperação de senha para contas existentes. Cadastro aberto e proteção global de rotas
entram em PRs posteriores.

## Antes de ativar em produção

1. No Supabase Auth, configure a **Site URL** com a URL pública do TinDo.
2. Adicione `https://SEU_DOMINIO/auth/callback` às URLs de redirecionamento permitidas.
3. Configure SMTP próprio. Sem ele, o Supabase não entrega mensagens a endereços que não fazem
   parte da equipe do projeto e limita o remetente padrão a 2 mensagens por hora. Cadastro, link
   mágico e recuperação de senha não estão prontos para produção enquanto este item faltar.
4. No Cloudflare Turnstile, crie um widget para o domínio do TinDo e publique a chave pública como
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
5. Só depois de a variável chegar à aplicação, habilite a proteção CAPTCHA do Supabase Auth e
   cadastre a chave secreta do Turnstile no painel. Essa ordem evita bloquear o login no intervalo.
6. Mantenha confirmação de e-mail habilitada e teste os modelos de link mágico e recuperação.

## Diagnóstico de produção

- Um cadastro com e-mail já existente pode receber uma resposta neutra do Supabase. A interface
  não deve afirmar que criou outra conta nem que um e-mail necessariamente saiu.
- Antes de culpar a senha, confira no painel se a conta existe, está confirmada e não está banida.
- Depois de configurar SMTP, valide um cadastro novo, um link mágico e uma recuperação reais em
  um endereço que não pertença à equipe do projeto.

## Desenvolvimento local

O callback permitido é `http://localhost:3000/auth/callback`. Sem
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, o widget não aparece e o token não é enviado; isso permite testar
localmente enquanto o CAPTCHA do projeto Supabase estiver desabilitado.

## Teste de fumaça

- entrar com a senha de uma conta existente e chegar a `/docs`;
- pedir link mágico para uma conta existente e abrir o callback no mesmo navegador;
- pedir link para e-mail desconhecido e confirmar que nenhuma conta foi criada;
- recuperar a senha, definir uma senha com ao menos 8 caracteres e chegar a `/docs`;
- confirmar que um `next` externo é descartado e redireciona para `/docs`.
