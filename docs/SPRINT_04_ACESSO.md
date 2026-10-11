# Sprint 4 — Controle de acesso exclusivo (pré-ativação)

## Estado publicado

O código de login e a base SQL foram adicionados, mas **a instância Supabase não está conectada**. Em `assets/config.js`, `mode: "demo"` mantém a demonstração pública com dados de exemplo. **Não existe proteção efetiva para informações reais enquanto esse modo estiver ativo.**

O site do GitHub Pages continuará público como conjunto de arquivos HTML/CSS/JavaScript. Uma vez ativado o login, a UI só exibirá o aplicativo para a conta autorizada, mas a proteção de dados reais deve ser feita no servidor com políticas RLS — o código no navegador nunca é uma barreira de segurança por si só.

## Passos para ativar — somente quando houver projeto Supabase

1. Criar um projeto em https://supabase.com/dashboard. Não publicar senha, chaves secretas, token de serviço ou arquivos de dados.
2. Em **Authentication**, habilitar email/senha, impedir inscrições abertas e configurar recuperação de senha, redirecionamentos e proteção adicional (MFA, se disponível).
3. Criar manualmente **um** usuário autorizado via Authentication > Users. Não colocar sua senha nem seu UUID no GitHub.
4. No SQL Editor, executar `supabase/migrations/20261011_01_access.sql`. Essa migration cria `public.app_access`, habilita RLS e permite apenas consultar a própria autorização.
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

- **Não conectado:** nada neste Sprint cria projeto Supabase, executa SQL ou configura usuários.
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
