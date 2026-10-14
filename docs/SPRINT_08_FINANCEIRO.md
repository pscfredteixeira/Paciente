# Sprint 8 — Financeiro Real

Implantação planejada para 14/10/2026. Recursos financeiros no Supabase e interface do GitHub Pages.

## Entregas

- Registrar recebimentos reais por paciente (valor em centavos, data, método **Pix**, **Dinheiro**, **Transferência**, **Cartão** ou **Outro**, e observação opcional).
- Pagamentos podem ocorrer antes ou depois das sessões.
- Saldo líquido **por paciente**: débitos de sessões confirmadas menos pagamentos válidos. Valor positivo = **a receber**; valor negativo = **crédito disponível**. Os créditos são utilizados automaticamente no saldo agregado quando futuras sessões são confirmadas.
- **Sem alocação manual de pagamentos a sessões específicas.** Neste sprint, o saldo é uma conta-corrente por paciente; não há correspondência um-a-um com cada sessão, nem cobrança Pix automatizada.
- Painel **Financeiro** real: recebido no mês, total pendente, créditos antecipados, recebido no histórico; lista por paciente e últimos lançamentos.
- Tela **Início** passa a apresentar um resumo real de pacientes, sessões realizadas, pendências e recebimentos.
- Perfil **Pacientes**: saldo individual, extrato por data com saldo acumulado, botão Registrar pagamento.
- **Estornar pagamento** com confirmação. Para corrigir valor/método/data, estorne o pagamento e registre um novo.
- Relatórios gerais ainda são **demonstrativos**, mantendo essa indicação na tela.
- Nenhuma interação de escrita com Google Calendar. Pix é apenas forma de pagamento selecionada manualmente.

## Estrutura de dados

`public.patient_payments`: id UUID, owner_id, patient_id, request_id (chave de idempotência), amount_cents, paid_on, method, note, voided_at, created_at. O índice UNIQUE(owner_id,request_id) e a trava por requisição impedem recebimentos duplicados após retries. O registro fica guardado mesmo depois do estorno, com voided_at.

`public.payment_audit`: trilha append-only `created`/`voided` para cada lançamento.

Ambas as tabelas têm RLS e **somente SELECT para o usuário autenticado autorizado**. Não existem grants diretos de INSERT/UPDATE/DELETE ao navegador.

`public.record_patient_payment` e `public.void_patient_payment`: RPCs transacionais SECURITY DEFINER com verificação de `auth.uid()` e tabela de autorização, RLS explícito de seleção e `search_path=''`; grant EXECUTE apenas para authenticated, nunca anon. Funções não permitem mudar paciente/valor de um recebimento já registrado. Uma repetição da mesma `request_id` devolve o mesmo pagamento sem duplicar auditoria.

## Arquivos
- `supabase/migrations/20261014_sprint_08_payments_private_ledger.sql`
- `assets/finance.js`: acesso privado, painel Financeiro, saldo, extrato, registro e estorno.
- `assets/app.js`: rotas Início e Financeiro reais e ações de tela.
- `assets/patients-ui.js`: resumo/extrato no paciente.
- `assets/agenda-real.js`: atualização do saldo após sessão confirmada/corrigida.
- `assets/styles.css`: layout responsivo.

## Testes
- Migração aplicada com sucesso no Supabase.
- RPC sob usuário autorizado: inserção, retry idêntico, estorno e segundo estorno — **todos numa transação revertida por ROLLBACK**. Exatamente 1 pagamento e 2 auditorias no teste.
- Usuário não autorizado impedido de lançar pagamentos e sem visibilidade de registros; role authenticated não pode escrever direto nas tabelas; `anon` não tem EXECUTE na RPC de registro.
- Teste de lógica front-end: débito R$ 150, pagamento R$ 300 → crédito de R$ 150; estorno → volta a dever R$ 150.
- Navegação do aplicativo para Home e Financeiro agora chama os módulos de dados reais.
- **Pendente:** validação visual em navegador e primeiro recebimento real registrado pelo proprietário.

## Limitações e segurança
- Não é integração bancária nem emite cobranças ou notas fiscais.
- Pagamentos estornados não entram no saldo, mas permanecem no histórico.
- A linha de extrato refletirá o **estado atual** de cada débito. Correções das sessões estão na `session_audit` e não aparecem como lançamentos adicionais no extrato financeiro.
- Valores são calculados dos dados completos; implementada paginação, com falha segura se o volume ultrapassar o teto configurado.
- Não armazenar tokens, nomes de pacientes, CPFs, dados bancários, chaves Pix ou informações clínicas no GitHub.
- O Supabase Security Advisor pode alertar sobre função SECURITY DEFINER executável por usuários autenticados. A permissão é proposital e a função faz autenticação e autorização; revisar essa arquitetura em auditorias futuras.
