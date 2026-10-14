# Sprint 12 — Fechamento mensal e recuperação do fluxo de cobranças

## Prioridade: regressão relatada no uso da Agenda

O usuário relatou que vincular sessões na Agenda deixou de refletir corretamente na área de cobranças. Foi preservada a regra financeira explícita: **vincular o compromisso não gera débito**. A cobrança só nasce quando o profissional confirma que a sessão ocorreu, ou que houve uma falta cobrada.

Correções:
- **Agenda:** botão de destaque **Confirmar realizada e cobrar R$ X**, disponível para eventos passados vinculados a um paciente sem registro; executa a mesma RPC transacional `record_consultation` após confirmação explícita do usuário. Para faltas/cancelamentos, mantida a opção separada. **Ver cobrança no Financeiro** para sessões cobradas. Textos antigos que diziam erroneamente que o financeiro era demonstrativo foram retirados.
- **Financeiro:** `reload()` perdeu atualizações quando já havia leitura em andamento e o `openView('finance')` usava somente o cache inicial. Agora solicita recarga ao abrir Financeiro e **enfileira** uma recarga se a consulta anterior ainda estiver em andamento; a recarga seguinte vê as sessões novas.
- **Sessões:** ao trocar rapidamente de semanas, a leitura de eventos deixava de acontecer se uma leitura anterior estivesse em andamento. Agora as leituras competem pelo número da revisão e **somente a mais recente é aplicada**.
- **Pacientes:** mensagem do histórico vazio explica as duas etapas necessárias.

**Validação do Supabase antes da correção:** já existia 1 sessão cobrada com débito correspondente (R$ 175,00 em total), 0 sessões cobradas sem lançamento de débito, 5 vínculos por evento e 2 regras recorrentes. Nenhum lançamento foi criado/apagado na inspeção. Essas contagens não devem aparecer na interface pública nem identificar paciente.

**Teste de regressão isolado:** simulação completa na mesma UI:
1. Abrir Agenda de uma semana.
2. Associar evento a paciente; botão de cobrança explícita aparece.
3. Confirmar realizada via RPC simulada (um único registro e débito).
4. Simular uma leitura do Financeiro atrasada e `reload()` durante essa leitura.
5. Confirmar que a recarga enfileirada traz o valor cobrado ao saldo e a Agenda mostra status realizado. Teste passou.

## Fechamento mensal (nova funcionalidade sem escrita no servidor)

Na aba **Relatórios**, seção **Fechamento mensal · prévia**:
- Selecionar o mês.
- Total cobrado por sessões, recebido por pagamentos ativos, realizados, recebimentos Pix pendentes de conferência, estornos.
- Exportar **CSV para Excel**, com nomes de pacientes e dados administrativos (sem CPF, e-mail ou conteúdo clínico).
- Escape preventivo de fórmulas maliciosas no CSV, valores com vírgula decimal, cabeçalho/avisos e UTF-8 BOM.
- CSV gerado localmente com Blob e link temporário, sem upload.
- **Prévia mutável**, não é documento fiscal e não fecha/bloqueia os meses contábeis. Correções posteriores de sessões/pagamentos podem mudar os totais de um mês.

Na importação CSV/OFX em **Financeiro**, apresentar contagem das entradas sem correspondência e das sugestões ambíguas; não gravar ou criar pagamentos automaticamente. Permitir expandir até 20 entradas sem correspondência para investigar. Somente o usuário confirma cada Pix, respeitando o procedimento anterior.

## Segurança e limitações

Sem nova migração. Os débitos financeiros continuam sendo criados exclusivamente pela RPC privada `record_consultation`, com RLS, autenticação e chave única de evento. **Jamais cobrar automaticamente por mero vínculo ao calendário.**
O CSV contém nomes dos pacientes; o navegador precisa de permissão local para baixar e o arquivo deve ser guardado em local privado. Nenhum dado financeiro pessoal foi comitado no GitHub.

Status: implementação e testes sintáticos/de regressão concluídos; validação final do GitHub Pages e teste visual com o usuário pendentes.
