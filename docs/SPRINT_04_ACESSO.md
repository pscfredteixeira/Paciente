# Sprint 4 — Controle de acesso exclusivo (pré-ativação)

## Situação de ativação — 11/10/2026

- **Supabase ativo**: projeto Meu Consultório (região São Paulo).
- **Conta aprovada**: uma conta de e-mail confirmada no Supabase Auth foi incluída em `public.app_access`. Nenhum e-mail, UUID ou senha foi publicado.
- **Testes RLS**: a conta autorizada consulta sua linha; identidade não autorizada obtém zero linhas; usuário anônimo sem privilégio SELECT.
- **Frontend**: `assets/config.js` em `mode: "private"`, com URL e chave *publishable* públicas. Os dados no JavaScript continuam fictícios e o código permanece público no GitHub Pages.
- **Biblioteca Supabase**: cliente de navegador fixado em `@supabase/supabase-js@2.117.3`.
- **Teste pendente**: o proprietário deve entrar no site usando seu e-mail e senha criados no Supabase. A senha não deve ser compartilhada.
- **Alerta de segurança atual**: o advisor indicou `Leaked Password Protection Disabled`. Ativar no painel Supabase, em Authentication → Security and Protection (nomes podem variar). Documentação: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- **Revisão necessária**: desabilitar inscrições públicas não desejadas em Authentication → Providers → Email; verificar opções de MFA.
- **Limite crucial**: login no protótipo não protege nomes/valores fictícios embutidos em `assets/app.js`. Dados reais só serão adicionados depois de tabelas com RLS testadas, armazenamento privado e decisões LGPD.

## Estado publicado

**Projeto criado e ativo:** [Meu Consultório no Supabase](https://supabase.com/dashboard/project/tcwbzfsmkhuekvxrbigf), organização `pscfredteixeira`, região `sa-east-1` (São Paulo).

**Migration aplicada:** `sprint_04_access_control` em 11/10/2026. O banco possui `public.app_access` com RLS ativo e política que permite a cada usuário aprovado consultar apenas seu próprio registro. Acesso anônimo bloqueado. `authenticated` não tem INSERT/UPDATE/DELETE. Consultas de validação passaram e os avisos de segurança retornaram vazios.

**Concluído depois desta etapa:** um usuário com e-mail confirmado foi autorizado e o cliente foi configurado em modo privado. **Pendente:** testar login com a senha pessoal, desabilitar inscrições abertas e ativar proteções adicionais da conta. O backend de pacientes ainda não foi implementado.
 Em `assets/config.js`, `mode: "demo"` mantém a demonstração pública com dados de exemplo. **Não existe proteção efetiva para informações reais enquanto esse modo estiver ativo.**

O site do GitHub Pages continuará público como conjunto de arquivos HTML/CSS/JavaScript. Uma vez ativado o login, a UI só exibirá o aplicativo para a conta autorizada, mas a proteção de dados reais deve ser feita no servidor com políticas RLS — o código no navegador nunca é uma barreira de segurança por si só.

## Passos para ativar — somente quando houver projeto Supabase

1. **Concluído:** projeto Supabase criado. Não publicar senha, chaves secretas, token de serviço ou arquivos de dados.
2. Em **Authentication**, habilitar email/senha, impedir inscrições abertas e configurar recuperação de senha, redirecionamentos e proteção adicional (MFA, se disponível).
3. Criar manualmente **um** usuário autorizado via Authentication > Users. Não colocar sua senha nem seu UUID no GitHub.
4. **Concluído:** `supabase/migrations/20261011_01_access.sql` já foi aplicada no projeto, criando `public.app_access` com RLS.
5. No SQL Editor, autorizar sua conta com seu UUID obtido do painel Auth (inserir sem compartilhar o valor):

```sql
insert into public.app_access (user_id)
values ('UUID_DO_USUARIO_CRIADO');
```

6. Em **Project Settings > API**, obter apenas a URL do projeto e a chave **publishable** do cliente (ou a chave pública anon legada). Nunca usar secret key ou service_role no browser.
7. Inserir URL e chave publishable em `assets/config.js` e mudar `mode` de `demo` para `private`. A URL e essa chave são destinadas ao cliente, mas só são seguras com RLS. Os arquivos da aplicação continuarão públicos.
8. Conferir o redirecionamento no domínio final do GitHub Pages: `https://pscfredteixeira.github.io/Paciente/`. Este Sprint usa email/senha e não exige OAuth para entrar.
9. Verificar o funcionamento sem dados reais: deslogado -> bloqueado; conta não autorizada -> bloqueado; conta autorizada -> visualiza **apenas dados fictícios**; sair -> bloqueado novamente.
10. Somente em sprints posteriores, com tabelas próprias e políticas RLS adicionais testadas, usar dados reais. Não copiar exemplos de pacientes para tabelas de produção.

## Testes de acesso obrigatórios

- Inspecionar as chamadas a `app_access`: usuário deslogado não lê registros.
- Usuário sem autorização não obtém acesso à aplicação nem a tabelas protegidas.
- Usuário aprovado consegue consultar somente seu próprio registro em `app_access`.
- Tentar `INSERT`, `UPDATE` e `DELETE` de `app_access` no navegador deve falhar.
- Uma conexão com URL/chave inválidas falha **fechada**: não libera o aplicativo.
- A sessão expirada ou encerrada impede a visualização da interface.
- Abrir o HTML estático ou ler o JavaScript não revela nomes, valores ou documentos verdadeiros.

## Limitações deliberadas

- **Conectado parcialmente:** projeto Supabase e tabela de autorização foram criados e testados; ainda não existe conta de usuário ou sessão conectada no aplicativo.
- Login pronto para integração, mas não foi validado contra um Supabase real.
- O aplicativo ainda usa dados simulados em memória. Login autorizado não significa que o financeiro tenha persistência.
- Google Calendar, Pix, dados administrativos reais e backups são etapas futuras.
- A proteção do GitHub Pages não é controle de acesso; arquivos estáticos são públicos.
- Não há integração de MFA dentro do aplicativo nesta versão; configure controles disponíveis no provedor antes de dados reais.
- Sem registro público: a criação do usuário deve ser feita por administrador no painel.
- Qualquer credencial ou dado de paciente exposto em commit deve ser tratado como incidente, mesmo após remoção do arquivo.

## Referências oficiais

- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase JavaScript: https://supabase.com/docs/reference/javascript/installing
