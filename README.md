# Meu Consultório — Sprint 13

Aplicativo pessoal do consultório, com **login privado Supabase** e interface responsiva para iPhone e computador.

**Abrir aplicativo:** https://pscfredteixeira.github.io/Paciente/

## Partes que já são reais

**Pacientes:** cadastro privado, busca, edição, valor de sessão, frequência, **data de nascimento, CPF e e-mail opcionais**, arquivamento e reativação. Registros no Supabase com RLS. CPF validado e único por proprietário.

**Agenda:** compromissos reais do Google Calendar e vínculos semanais automáticos. Após vincular, você deve **confirmar que a sessão aconteceu** para criar cobrança: o botão **Confirmar realizada e cobrar** gera um único débito com honorários congelados, depois de sua confirmação. Pode registrar faltas cobradas/isentas ou cancelamentos, corrigir registros e ir para o Financeiro. **Vincular sozinho não gera cobrança**; o Google Calendar continua somente leitura.

**Pacientes — histórico real:** cadastro mostra atendimentos, débitos, correções, **saldo, crédito disponível, quantidade de sessões cobradas e extrato**. O saldo aparece também na listagem. Permite **registrar sessão manual**, mesmo sem Google Calendar, corrigir pelo histórico e registrar pagamentos separadamente.

**Sessões manuais:** via Pacientes ou botão na Agenda, escolha o paciente, data, hora e situação. Sessão realizada/falta cobrada gera débito real na mesma RPC transacional da Agenda. Não cria evento Google; débito só após confirmação e honorário é congelado. Permite corrigir situação e desfazer registro.

**Ajustes:** conectar, desconectar e consultar eventos do Google Calendar.

**Financeiro:** lançamentos reais de pagamentos, incluindo **Pix manual, dinheiro, transferência e cartão**; pagamentos antecipados viram créditos. A aba mostra recebimentos mensais, débitos pendentes, créditos antecipados e movimentações. **Central por paciente**: sessões cobradas (inclusive manuais), última sessão cobrada, saldos, filtros e botão Ver ficha, que abre diretamente o paciente. **Conferência manual de Pix**: seção compacta e expansível (inclusive no iPhone); após verificar o crédito no banco por conta própria, marque-o como conferido, com identificador opcional e histórico de alterações. Estornos são auditados.

**Início:** indicadores reais de pacientes, sessões, débitos pendentes e recebimentos, com lista de até cinco pacientes com maiores saldos pendentes e atalho para abrir a ficha.

**Relatórios reais:** gráfico e tabela dos últimos 6/12 meses com recebimentos, débitos, sessões realizadas e faltas; posição atual de pendências/créditos. **Fechamento mensal (prévia)** por mês com exportação CSV privada para Excel. Sem números fictícios quando autenticado.

## Partes que ainda não estão implementadas

**Conciliação bancária automática:** ainda não implementada. O Sprint 11 permite **comparar CSV e OFX bancários localmente** com pagamentos Pix cadastrados (sem enviar o arquivo, criar cobranças ou confirmar automaticamente). A conferência continua **exclusivamente manual**, sem acesso a banco ou identificação definitiva do pagador.

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
  statement.js
  ofx.js
  calendar.js
  sessions.js
  manual-sessions.js
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
  SPRINT_10_CSV_PIX.md
  SPRINT_11_OFX.md
  SPRINT_12_FECHAMENTO_E_CORRECAO.md
  SPRINT_12_1_SESSOES_MANUAIS.md
  SPRINT_13_COBRANCAS_POR_PACIENTE.md
```

## Segurança

O repositório e os arquivos de frontend do GitHub Pages são públicos. **Não versionar nomes de pacientes, eventos privados, informações clínicas, senhas ou tokens nesse repositório.** Os dados administrativos persistidos estão no banco com RLS. OAuth do Google funciona com tokens armazenados apenas no Supabase servidor.

Ainda existe o aviso de segurança Supabase [Leaked Password Protection Disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Recomenda-se ativar essa opção e revisar configurações de cadastro público e MFA. A autorização Google em modo Testando pode expirar, exigindo nova conexão.

[Agenda real](./docs/SPRINT_06_2_AGENDA.md) · [Vínculos recorrentes](./docs/SPRINT_06_3_SERIES.md) · [Sessões e débitos reais](./docs/SPRINT_07_SESSOES.md).

[Dados pessoais opcionais e privacidade](./docs/SPRINT_07_1_DADOS_PESSOAIS.md) · [Financeiro Real](./docs/SPRINT_08_FINANCEIRO.md) · [Relatórios e Pix manual](./docs/SPRINT_09_RELATORIOS_PIX.md) · [Conferência assistida por CSV](./docs/SPRINT_10_CSV_PIX.md) · [Leitura OFX local](./docs/SPRINT_11_OFX.md) · [Fechamento mensal e correção de cobranças](./docs/SPRINT_12_FECHAMENTO_E_CORRECAO.md) · [Sessões fora do Google Calendar](./docs/SPRINT_12_1_SESSOES_MANUAIS.md) · [Central de cobranças por paciente](./docs/SPRINT_13_COBRANCAS_POR_PACIENTE.md).

## Próxima etapa

Validar no iPhone a central Financeiro → Ver ficha do paciente e a lista de pendências no Início, conferindo saldos com as sessões manuais reais já registradas. Nenhum novo lançamento foi criado neste sprint.
