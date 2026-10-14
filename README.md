# Meu Consultório — Sprint 9

Aplicativo pessoal do consultório, com **login privado Supabase** e interface responsiva para iPhone e computador.

**Abrir aplicativo:** https://pscfredteixeira.github.io/Paciente/

## Partes que já são reais

**Pacientes:** cadastro privado, busca, edição, valor de sessão, frequência, **data de nascimento, CPF e e-mail opcionais**, arquivamento e reativação. Registros no Supabase com RLS. CPF validado e único por proprietário.

**Agenda:** compromissos reais do Google Calendar, vínculos semanais automáticos e confirmação de atendimento. Você pode registrar **sessão realizada**, **falta cobrada**, **falta sem cobrança** ou **cancelamento**. Confirmar uma sessão cobrada cria **um único débito real** com o honorário congelado daquela sessão. Alterações posteriores são auditadas. O Google Calendar continua somente leitura.

**Pacientes — histórico real:** cadastro mostra atendimentos, débitos, correções, **saldo, crédito disponível e extrato**. Possibilidade de registrar pagamentos diretamente pelo perfil.

**Ajustes:** conectar, desconectar e consultar eventos do Google Calendar.

**Financeiro:** lançamentos reais de pagamentos, incluindo **Pix manual, dinheiro, transferência e cartão**; pagamentos antecipados viram créditos. A aba mostra recebimentos mensais, débitos pendentes, créditos antecipados e movimentações. **Conferência manual de Pix**: após verificar o crédito no banco por conta própria, marque-o como conferido, com identificador opcional e histórico de alterações. Estornos são auditados.

**Início:** indicadores reais de pacientes, sessões, débitos pendentes e recebimentos.

**Relatórios reais:** gráfico e tabela dos últimos 6/12 meses com recebimentos, débitos, sessões realizadas e faltas. Posição atual de pendências e créditos por paciente. Sem números fictícios quando autenticado.

## Partes que ainda não estão implementadas

**Conciliação bancária automática:** a marcação de Pix é **manual**; não há leitura de extratos, acesso a banco, identificação automática de recebimentos ou integração com instituições financeiras.

## Código modular

```text
index.html
assets/
  app.js
  auth.js
  config.js
  patients.js
  patients-ui.js
  finance.js
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
  20261014_sprint_07_1_patient_birth_cpf_email.sql
  20261014_sprint_08_payments_private_ledger.sql
  20261014_sprint_09_manual_pix_verification.sql
docs/
  ARQUITETURA.md
  SPRINT_04_ACESSO.md
  SPRINT_05_PACIENTES.md
  SPRINT_06_2_AGENDA.md
  SPRINT_06_3_SERIES.md
  SPRINT_07_SESSOES.md
  SPRINT_07_1_DADOS_PESSOAIS.md
  SPRINT_08_FINANCEIRO.md
  SPRINT_09_RELATORIOS_PIX.md
```

## Segurança

O repositório e os arquivos de frontend do GitHub Pages são públicos. **Não versionar nomes de pacientes, eventos privados, informações clínicas, senhas ou tokens nesse repositório.** Os dados administrativos persistidos estão no banco com RLS. OAuth do Google funciona com tokens armazenados apenas no Supabase servidor.

Ainda existe o aviso de segurança Supabase [Leaked Password Protection Disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Recomenda-se ativar essa opção e revisar configurações de cadastro público e MFA. A autorização Google em modo Testando pode expirar, exigindo nova conexão.

[Agenda real](./docs/SPRINT_06_2_AGENDA.md) · [Vínculos recorrentes](./docs/SPRINT_06_3_SERIES.md) · [Sessões e débitos reais](./docs/SPRINT_07_SESSOES.md).

[Dados pessoais opcionais e privacidade](./docs/SPRINT_07_1_DADOS_PESSOAIS.md) · [Financeiro Real](./docs/SPRINT_08_FINANCEIRO.md) · [Relatórios e Pix manual](./docs/SPRINT_09_RELATORIOS_PIX.md).

## Próxima etapa

Validar os relatórios reais e a conferência manual Pix em um lançamento existente. Depois avaliar, com o usuário, o banco e o formato de extrato para uma eventual conciliação bancária assistida.
