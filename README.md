# Meu Consultório — Sprint 4 (login privado)

Aplicativo web pessoal para acompanhar sessões e pagamentos. **O login está ativado, mas os dados exibidos ainda são inteiramente fictícios.** O aplicativo não contém prontuários ou contas de pacientes reais.

**Acessar:** https://pscfredteixeira.github.io/Paciente/

## Situação atual

- Uma conta cadastrada e confirmada no Supabase Auth, autorizada exclusivamente na tabela `app_access`.
- Login com e-mail e senha conectado ao Supabase (cliente JavaScript com versão fixada).
- RLS testado: identidade autorizada pode consultar a própria permissão; outra identidade não pode; usuário anônimo sem leitura.
- O site está em `mode: "private"`. Os arquivos estáticos do GitHub Pages continuam públicos.
- Agenda, pacientes, sessões, débitos, recebimentos e relatórios **apenas simulados**. Recarregar a página reinicia os dados.
- **Pendente:** testar login real no navegador com as credenciais do proprietário e ativar proteção contra senhas vazadas no painel Supabase.

## Estrutura

```text
index.html
assets/
  styles.css
  app.js
  auth.js
  config.js             # contém apenas URL e chave publishable
supabase/
  migrations/
    20261011_01_access.sql
docs/
  ARQUITETURA.md
  SPRINT_04_ACESSO.md
.gitignore
```

Os títulos são grossos e sem serifa, a interface é roxa com destaques em laranja, responsiva para celular e desktop.

## Segurança

**Não coloque dados reais de pacientes em `assets/app.js`, no código público nem em arquivos estáticos do GitHub Pages.** Mesmo com tela de login, qualquer pessoa pode obter os arquivos públicos. Somente o backend e as políticas de acesso ao banco poderão proteger informações reais em sprints posteriores.

A URL do Supabase e a chave `sb_publishable_` são públicas por definição; senhas, service_role, secret key e tokens administrativos **não devem estar no repositório**.

O Supabase apontou um aviso: **Leaked Password Protection Disabled**. Consulte [o guia do Sprint 4](./docs/SPRINT_04_ACESSO.md) para ativar essa proteção, revisar inscrições abertas e configurar MFA.

Nenhum pagamento real é processado; Google Calendar, Pix, conciliação bancária, backup e armazenamento definitivo de pacientes ainda não estão conectados.

## Próxima etapa

Validar o login pessoal e as configurações de segurança. O Sprint 5 criará cadastro persistente de pacientes com RLS antes da importação de qualquer informação real.
