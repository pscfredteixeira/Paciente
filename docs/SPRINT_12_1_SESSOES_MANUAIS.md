# Registro manual de sessões — expansão do Sprint 12

Implementado em 14/10/2026 no Meu Consultório.

## Necessidade

Permitir registrar atendimentos **mesmo quando não existe um compromisso no Google Calendar**, preservando as regras de cobrança, auditoria e segurança das sessões da Agenda.

## Como funciona

Pela **Agenda → Registrar sessão fora do calendário** ou **Pacientes → Registrar sessão manual**. Dentro do cadastro de cada paciente há o mesmo botão com o paciente preenchido.

Informar:
- Paciente ativo.
- Data e horário do atendimento, no fuso **America/Sao_Paulo**, de 01/01/2020 até o momento atual (não permite registrar atendimentos futuros).
- Situação: **realizada**, **falta cobrada**, **falta sem cobrança** ou **cancelada**.

Antes de salvar, uma caixa de confirmação mostra paciente, data, status e o honorário a cobrar (se houver). O valor adotado é o **honorário atual cadastrado no paciente**, com cópia congelada na sessão. Depois disso, atualizar o histórico individual, o Financeiro e os Relatórios.

No histórico privado de sessões, cada registro manual tem a identificação **Sessão manual** e o botão **Corrigir**. Correções podem alterar status, inclusive **Desfazer registro**. Não mudam paciente, data ou honorário congelado; para ajustar esses campos, desfazer e registrar novamente. Correções auditadas pela estrutura original de sessões.

Registros manuais não criam eventos nem são inseridos no Google Calendar. **Não há criação automática de pagamentos recebidos.** A confirmação de realizada/falta cobrada gera um débito, que poderá ser quitado pelos pagamentos já existentes.

## Arquitetura e segurança

Nenhuma nova tabela ou RPC foi necessária. O aplicativo utiliza a mesma função PostgreSQL transacional `public.record_consultation`, já protegida por `auth.uid()`, `app_access`, proprietário, restrições de valores e data, auditoria e idempotência por evento.

A coluna existente `session_records.google_event_id` recebe uma identificação sintética `manual:UUID` de cada novo atendimento. Esse prefixo é exclusivo dos registros manuais e não corresponde a um ID do Google Calendar. A unicidade `(owner_id,google_event_id)` evita duplicação em retries. Não é feita gravação em `calendar_event_links` nem em `calendar_event_rules`.

O histórico, saldo por paciente, Financeiro e Relatórios já leem `session_records` por proprietário/paciente, por isso passam a incluir registros manuais sem lógica contábil paralela. `session_debits` continua sendo atualizado dentro da mesma transação de `record_consultation`; sem debitar duas vezes.

As correções usam `record_consultation(...,p_correct=true)` com a mesma identificação `manual:UUID`, mantendo data/paciente e honorários existentes. O Financeiro e o extrato individual identificam claramente as sessões de origem manual.

**Nenhum nome de paciente, dado clínico, CPF, e-mail, chave Pix ou token foi incluído no repositório.** Formulários não usam `localStorage`; dados só são persistidos após confirmação na RPC autorizada.

## Limitação de versão

A data de registro manual começa em 2020 para evitar converter incorretamente o horário de verão histórico de São Paulo anterior a 2019. A hora é convertida com UTC-03:00, válido para o período aceito. O usuário pode corrigir a situação, mas não editar a data/hora do mesmo registro; nesse caso, deve desfazê-lo e criar uma nova sessão.

## Verificações

1. Banco: transação de teste revertida com `ROLLBACK` confirmou inserção de uma sessão sintética, retry idempotente, correção para falta sem cobrança e desfazer, com a auditoria e débito estornado. Sem dados de teste persistidos.
2. Frontend: simulação de registro manual realizado com honorário, confirmação do usuário, recarga do Financeiro e histórico do paciente; horário convertido corretamente. Cadastro manual inválido sem horário não registrou sessão. Formulário de correção mantém data e paciente bloqueados.
3. Scripts JS verificados sintaticamente antes da publicação.
4. Pendente: validação visual com uma sessão real pelo proprietário, sem o Google Calendar.
