# Meu Consultório — Sprint 7

Aplicativo pessoal do consultório, com **login privado Supabase** e interface responsiva para iPhone e computador.

**Abrir aplicativo:** https://pscfredteixeira.github.io/Paciente/

## Partes que já são reais

**Pacientes:** cadastro privado, busca, edição, valor de sessão, frequência, arquivamento e reativação. Registros no Supabase com RLS.

**Agenda:** compromissos reais do Google Calendar, vínculos semanais automáticos e confirmação de atendimento. Você pode registrar **sessão realizada**, **falta cobrada**, **falta sem cobrança** ou **cancelamento**. Confirmar uma sessão cobrada cria **um único débito real** com o honorário congelado daquela sessão. Alterações posteriores são auditadas. O Google Calendar continua somente leitura.

**Pacientes — histórico real:** abrir o cadastro permite ver os últimos atendimentos, débitos e correções (sem pagamentos ainda).

**Ajustes:** conectar, desconectar e consultar eventos do Google Calendar.

## Partes que ainda são demonstração

**Início, Financeiro e Relatórios:** continuam exibindo dados fictícios no protótipo. Os **débitos reais** já são criados e exibidos na Agenda e no histórico do paciente; **pagamentos, saldos após recebimentos e Pix** ainda não estão implementados. Não interprete a tela Financeiro demonstrativa como valores reais.

## Código modular

```text
index.html
assets/
  app.js
  auth.js
  config.js
  patients.js
  patients-ui.js
  calendar.js
  sessions.js
  agenda-real.js
  styles.css
supabase/migrations/
  20261011_01_access.sql
  20261011191842_sprint_05_patients_private.sql
  20261011192348_sprint_05_limit_patient_columns.sql
  20261011225800_sprint_06_2_calendar_event_links.sql
  20261011232500_sprint_06_3_calendar_series_rules.sql
  20261012001500_sprint_07_sessions_debits_and_audit.sql
docs/
  ARQUITETURA.md
  SPRINT_04_ACESSO.md
  SPRINT_05_PACIENTES.md
  SPRINT_06_2_AGENDA.md
  SPRINT_06_3_SERIES.md
  SPRINT_07_SESSOES.md
```

## Segurança

O repositório e os arquivos de frontend do GitHub Pages são públicos. **Não versionar nomes de pacientes, eventos privados, informações clínicas, senhas ou tokens nesse repositório.** Os dados administrativos persistidos estão no banco com RLS. OAuth do Google funciona com tokens armazenados apenas no Supabase servidor.

Ainda existe o aviso de segurança Supabase [Leaked Password Protection Disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Recomenda-se ativar essa opção e revisar configurações de cadastro público e MFA. A autorização Google em modo Testando pode expirar, exigindo nova conexão.

[Agenda real](./docs/SPRINT_06_2_AGENDA.md) · [Vínculos recorrentes](./docs/SPRINT_06_3_SERIES.md) · [Sessões e débitos reais](./docs/SPRINT_07_SESSOES.md).

## Próxima etapa

Validar a confirmação de sessões no navegador e então implementar o Sprint 8: pagamentos reais, saldos devedores, histórico de recebimentos e conciliação Pix.
