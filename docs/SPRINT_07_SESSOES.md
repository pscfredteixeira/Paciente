# Sprint 7 — Sessões realizadas e débitos reais

**Implantação:** 12/10/2026 (UTC). Status: publicado no GitHub e no Supabase; aguardando teste visual com o proprietário.

## Fluxo

1. Abra **Agenda** e selecione um compromisso do Google Calendar associado a um paciente.
2. Clique em **Registrar atendimento** (ou **Corrigir registro** se já existir).
3. Escolha: **Realizada**, **Falta cobrada**, **Falta sem cobrança**, **Cancelada** ou, durante a correção, **Desfazer registro**.
4. Confirme. O frontend chama a função PostgreSQL `public.record_consultation` pela sessão Supabase autenticada.
5. Se o status cobra honorários, cria/reativa um único débito para a sessão, com valor congelado do cadastro do paciente no momento do primeiro registro.
6. Abra **Pacientes → cadastro → Sessões e débitos reais** para visualizar as últimas sessões, valores e eventuais correções.

Uma sessão futura pode ser marcada **Cancelada**, mas não como realizada/falta antes do início, por validação no navegador e no banco. Eventos nunca são alterados no Google Calendar.

## Modelo transacional

`public.session_records`: um registro único por `(owner_id,google_event_id)`; referencia paciente, início do compromisso, situação e honorários congelados. Cobrança positiva apenas em `done` ou `missed_charge`.

`public.session_debits`: no máximo um débito por `session_id`, com índice `UNIQUE`, valor e `voided` em caso de estorno/correção. O débito não é deletado automaticamente quando uma situação passa a não cobrada. Nenhuma tabela de pagamentos foi criada neste sprint.

`public.session_audit`: registro append-only de cada transição, com situação e valores anterior/novo, motivação `initial`/`correction` e timestamp. Chamadas idênticas não acrescentam débito ou mudança de histórico.

A RPC `public.record_consultation` faz tudo em uma transação PostgreSQL, com trava por `owner_id/event_id` e `unique` no banco. É `SECURITY DEFINER` intencionalmente, com `search_path=''`, e confere explicitamente `auth.uid()` e a tabela de contas autorizadas; somente `authenticated` tem EXECUTE. Nunca conceder EXECUTE a `anon`.

Tabelas `session_records`, `session_debits` e `session_audit` permitem `SELECT` exclusivamente ao dono aprovado via RLS e não possuem permissões de escrita para `anon` ou `authenticated`. As únicas mutações são feitas pela RPC validada.

**Nota de segurança:** o Security Advisor pode apontar `authenticated_security_definer_function_executable`; nesta implantação essa execução é deliberada e limitada à conta aprovada, com autorização explícita e acesso revogado a `anon`. Isso deve continuar sendo revisado nos próximos sprints.

## Interface

- `assets/sessions.js`: estado em memória (não `localStorage`), consultas Supabase e RPC.
- `assets/agenda-real.js`: botões, confirmações, correção e estado do débito ao lado de cada evento.
- `assets/patients-ui.js`: histórico de até 100 sessões e suas alterações, privado.
- `assets/app.js`: navegação e proteção da tela.
- `assets/styles.css`: layouts responsivos.

## Testes realizados

- Transação de teste foi revertida (**ROLLBACK**): confirmação original, segunda confirmação idêntica, correção para falta sem cobrança e retorno para realizada geraram **uma sessão, um débito e três entradas de auditoria**.
- A verificação SQL final confirmou zero sessões, zero débitos e zero logs fictícios no banco real após o ROLLBACK.
- Conta não aprovada foi impedida de executar a RPC.
- Roles `anon`/`authenticated` não têm INSERT direto nas tabelas de sessão e débito.
- Mock frontend mostrou confirmação, registro de débito, repetição idempotente, correção e histórico privado.
- Códigos JS passaram na validação sintática.

## Limitações e próximos passos

O **Financeiro** e o **Início** ainda mostram exemplos fictícios; débitos reais aparecem na Agenda e no histórico privado do paciente. **Pagamentos, recebimentos Pix, baixas, saldo líquido e relatórios financeiros ainda não estão implementados.** Não confundir débito criado com pagamento recebido.

Na próxima etapa, criar pagamentos reais separadamente e conciliar de forma segura, evitando recebimentos duplicados.
