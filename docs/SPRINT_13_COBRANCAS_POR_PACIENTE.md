# Sprint 13 — Central de cobranças por paciente

Implementação em 14/10/2026, no app privado Meu Consultório.

## Necessidade e experiência

Após corrigir o registro das sessões fora do Google Calendar, o usuário precisa enxergar com clareza se a sessão foi efetivamente contabilizada **no paciente**, sem procurar pela Agenda ou cruzar telas.

### Entregas

- Aba **Financeiro → Saldo por paciente**: cada linha exibe quantidade de sessões cobradas, débitos reais totais, pagamentos recebidos e último atendimento cobrado.
- Ação **Ver ficha**: navega diretamente ao cadastro daquele paciente e força a leitura atualizada do histórico de sessões. A ação **Receber** continua registrando recebimentos separadamente.
- Filtros: **Todos**, **Pendentes**, **Com crédito**, **Em dia** e **Sem movimentação**. O rótulo **Em dia** exige algum lançamento financeiro; um paciente novo, sem qualquer sessão cobrada ou pagamento, é **Sem movimentação**, não é tratado como se tivesse quitado um débito.
- Filtros Pendentes/Com crédito são ordenados por maior valor para facilitar a priorização da conferência administrativa.
- Aba **Início**: resumo dos cinco pacientes com maiores saldos pendentes, com atalho **Ver ficha** e botão para abrir todos os saldos. Apenas dados reais, sem dados fictícios.
- Aba **Pacientes**: contador de sessões cobradas e saldo real no perfil e também na listagem; contempla sessões manuais e sessões confirmadas na Agenda.
- Aba **Relatórios → Fechamento mensal**: corrigida a contagem de sessões realizadas com origem manual. Os débitos financeiros já eram somados; apenas o contador não considerava o sufixo “Manual”.

### Regras de cálculo

Dados vêm das mesmas tabelas privadas existentes: `session_records`, `patient_payments` e `patients`, sob RLS no Supabase.

Por paciente:

- Débitos = soma de `session_records.charge_cents` somente quando > 0.
- Recebimentos = soma de `patient_payments.amount_cents` com `voided_at IS NULL`.
- Saldo a receber = `max(0, débitos − recebimentos)`.
- Crédito = `max(0, recebimentos − débitos)`.
- Sessões cobradas = quantidade de registros com `charge_cents > 0`, independentemente da origem manual/Google Calendar.
- Última sessão = maior data local em `America/Sao_Paulo` entre sessões cobradas.
- Saldo zero com lançamentos = Em dia. Saldo zero sem cobranças nem pagamentos = Sem movimentação.

**Não há alocação de pagamentos por sessão específica**, não se pode afirmar que *uma determinada sessão* foi quitada. Os indicadores mostram o **saldo agregado por paciente**, para evitar atribuição enganosa de pagamento a uma sessão.

### Segurança e privacidade

- Nenhuma migração, novo login ou conexão bancária.
- Não altera pagamentos, sessões, honorários, status ou vínculos com Google Calendar.
- Nomes e valores continuam na aplicação autenticada e no Supabase protegido, não são escritos no código-fonte, GitHub, URLs ou cache local.
- A navegação para a ficha usa o identificador do paciente em memória, não o adiciona à URL.

### Validação técnica

Teste de integração com dados sintéticos em memória:

1. Paciente A: uma sessão **manual** de R$ 175,00 e pagamento de R$ 100,00 → **R$ 75,00 pendentes**, 1 sessão cobrada.
2. Paciente B: sessão R$ 90,00 e recebimento R$ 90,00 → **Em dia**.
3. Paciente C: nenhum lançamento → **Sem movimentação**.
4. Relatório do mês: as sessões manuais entram no contador de realizadas.
5. Financeiro e Início exibem os dados; clicar **Ver ficha** abre o paciente correto e solicita o histórico atualizado.
6. Scripts JavaScript compilam e não introduzem nova operação de escrita.

Pendente: conferência visual no iPhone pelo usuário, após publicação GitHub Pages.
