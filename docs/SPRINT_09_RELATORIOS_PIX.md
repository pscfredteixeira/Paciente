# Sprint 9 — Relatórios reais e conferência manual de Pix

Status: implantado no Supabase e GitHub em 14/10/2026; aguardando validação do proprietário no navegador.

## Relatórios reais

A aba **Relatórios** deixa de mostrar valores simulados quando o usuário está autenticado.
- Seleção entre últimos **6** ou **12** meses, incluindo o mês atual.
- Gráfico comparativo de **débitos de sessões** e **recebimentos registrados** por mês (barras sem valores inventados).
- Tabela mensal dos mesmos valores e das sessões marcadas como realizadas.
- Indicadores do período: total de cobranças, total de pagamentos válidos, sessões realizadas, faltas cobradas, faltas sem cobrança e contagem de Pix conferidos.
- Posição financeira **atual**, independentemente do período selecionado: total pendente por paciente, créditos individuais e total histórico recebido.

Regra de competência: sessões agrupadas pelo dia de atendimento em `America/Sao_Paulo`; recebimentos pela data informada do pagamento. Correções de sessões refletem o estado **atual** da sessão e podem atualizar retroativamente a coluna daquele mês. Pagamentos estornados não entram nas somas; continuam no histórico.

O gráfico vazio mostra zero, sem dados fictícios.

## Conferência MANUAL de Pix

Na aba **Financeiro** há seção **Conferência manual de Pix** e atalho na parte superior.

1. Após ter registrado o pagamento Pix, **consultar o próprio extrato bancário** fora do aplicativo para verificar crédito recebido, data, valor e pagador.
2. Clicar em **Conferir Pix** no lançamento correspondente.
3. Opcionalmente informar um identificador do Pix do extrato, como EndToEndId, sem compartilhar extrato ou senha.
4. Confirmar que conferiu. A marcação **Conferido manualmente** não representa consulta ou validação automatizada.
5. **Desfazer conferência** é permitido; o pagamento continua lançado e a trilha de alteração fica salva.

Pix registrados mas não conferidos integram os saldos do Sprint 8, pois são entradas manuais declaradas pelo usuário; a tela informa essa diferença explicitamente. A conferência Pix **não cria nem altera o valor** do pagamento. Não há Pix bancário automático, leitura bancária, scraping, webhook, sincronização ou transferência.

### Segurança e banco

Migração: `supabase/migrations/20261014_sprint_09_manual_pix_verification.sql`.

- `patient_payments.pix_verified_at` e `pix_reference` opcionais, com constraints de consistência.
- Índice único por proprietário para referência Pix confirmada, ativa e não estornada, para ajudar a prevenir reconciliação dupla.
- `payment_audit.action` aceita `pix_verified` e `pix_verification_removed` além das ações existentes.
- RPC transacional `public.set_pix_verification(payment_id,verified,reference)`: `auth.uid()` deve estar autorizado em `app_access`; verifica propriedade do registro, método Pix e ausência de estorno. Idempotente para mesma conferência, audita mudança real, rejeita substituição silenciosa da referência.
- Trigger limpa verificação e referência ao estornar um Pix existente, para que um estorno não apareça como conferência ativa.
- Políticas RLS originais de `patient_payments`/`payment_audit` continuam restritas à conta autorizada; navegador **somente SELECT** nessas tabelas, com escritas exclusivamente por RPC restrita à role authenticated e autorização explícita.

**Nenhum dado pessoal, referência bancária, token ou comprovante de pacientes deve ser versionado no GitHub.**

### Arquivos de frontend

- `assets/finance.js`: cálculo de relatórios, conferência Pix, desfazer e status.
- `assets/app.js`: rota real de Relatórios, ações de Pix e atualização das telas.
- `assets/styles.css`: gráfico, tabela e revisão Pix responsivos.
- `index.html`: nova versão dos arquivos para evitar cache desatualizado.

### Verificações

- JS passou no teste sintático.
- Teste em memória verificou relatório com dados reais simulados em memória, saldo pendente por paciente, status Pix, marcação/desmarcação e renderização de 6/12 meses. Esses dados de teste **não foram enviados ao Supabase**.
- Banco: migração aplicada, estrutura RLS e permissões verificadas.
- **Pendente:** teste do fluxo completo em navegador com um recebimento real pré-cadastrado.

### Próximas melhorias possíveis

- Importação assistida de extratos (CSV/OFX) somente após identificar o banco, o formato e as regras de conferência/privacidade com o usuário.
- Conciliação automática de fato exige integração consentida com uma instituição ou provedor bancário autorizado; não foi incluída neste sprint.
