# Meu Consultório — Sprint 5

Aplicativo pessoal de gestão do consultório, com **login exclusivo no Supabase** e interface roxa/laranja, otimizada para iPhone e desktop.

**Entrar no aplicativo:** https://pscfredteixeira.github.io/Paciente/

## O que já funciona com persistência real

**Aba Pacientes:** cadastrar, consultar, editar, buscar, arquivar e reativar pacientes, com nome administrativo, valor por sessão em reais e frequência. Esses dados ficam no banco Supabase protegido por RLS. Acesso anônimo e de contas não aprovadas é bloqueado. Ainda não há pacientes registrados no banco.

## O que ainda é uma demonstração

**Início, Agenda, Financeiro e Relatórios:** usam eventos, saldos e pagamentos **fictícios**, inseridos no JavaScript apenas para avaliação do layout e fluxos. Não são registros reais e não devem ser usados para cobrança de pacientes. A vinculação dos cadastros reais ao Google Calendar, sessões e financeiro será feita nos próximos sprints.

## Arquivos

```text
index.html
assets/
  styles.css
  app.js
  auth.js
  config.js
  patients.js
  patients-ui.js
supabase/migrations/
  20261011_01_access.sql
  20261011191842_sprint_05_patients_private.sql
  20261011192348_sprint_05_limit_patient_columns.sql
docs/
  ARQUITETURA.md
  SPRINT_04_ACESSO.md
  SPRINT_05_PACIENTES.md
.gitignore
```

## Proteção de dados

O **GitHub Pages e os arquivos JavaScript são públicos**, mesmo com login. Por isso, nunca inserir dados de pacientes, senhas, tokens secretos, comprovantes, diagnósticos ou anotações clínicas diretamente no repositório.

O cadastro privado usa apenas uma chave **publishable** e políticas RLS no Supabase. Há uma conta autorizada; não existem pacientes cadastrados neste momento.

**Pendência de segurança:** ativar [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), revisar inscrições abertas e configurar autenticação multifator quando possível, antes de uso com dados reais em produção. Mais detalhes no [Sprint 5](./docs/SPRINT_05_PACIENTES.md).

## Próximas etapas

- Validar criação/edição/arquivamento no navegador com a conta aprovada.
- Sprint 6: integrar Google Calendar apenas para leitura, mantendo o agendamento no sistema atual.
- Depois: sessões reais, lançamentos financeiros auditáveis, pagamentos e conciliação.
