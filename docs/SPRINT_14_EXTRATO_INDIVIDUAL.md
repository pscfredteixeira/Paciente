# Sprint 14 — Extrato financeiro individual completo

Projeto: Meu Consultório. Implementação em 14/10/2026.

## Objetivo

Deixar cada cadastro de paciente com um **extrato financeiro navegável**, com filtros por mês e exportação privada para Excel. Os dados vêm dos registros reais no Supabase, sem criar pagamentos novos nem alterar cobranças.

## Recursos

- No cadastro do paciente, seção **Posição financeira do paciente**: quantidade total de sessões cobradas, débito histórico, recebido histórico e saldo atual (`A receber`, `Crédito disponível`, `Em dia` ou `Sem movimentação`).
- Nova seção **Extrato financeiro do paciente** com opção **Todo o histórico** e meses que contenham movimentações, em ordem decrescente.
- Resumo do período: saldo inicial, valor cobrado, recebido e saldo ao fim. O saldo inicial inclui todos os lançamentos anteriores, de modo que mudar o mês **não zera** o saldo acumulado.
- Mostra todos os lançamentos do período, em páginas de 30, com **Mostrar mais**. A exportação inclui todas as linhas do período selecionado, não apenas as 30 visíveis.
- Sessões confirmadas via Google Calendar ou cadastradas manualmente aparecem como débitos, com data local em `America/Sao_Paulo`; pagamentos aparecem com data declarada pelo usuário. Os Pix ainda não conferidos integram os pagamentos registrados, sem afirmação de confirmação bancária.
- Recebimentos estornados são exibidos tachados, porém seu impacto é zero. As cobranças excluem sessões atualmente desfeitas/canceladas, conforme a RPC de sessões existente.
- Ao selecionar um mês, o resultado é calculado com base em todo o histórico e o filtro muda apenas a exibição. O saldo agregado distingue **valor pendente** e **crédito antecipado**.

## Exportação CSV para Excel

- Botão **Exportar CSV para Excel**, com confirmação de privacidade antes de baixar.
- Exportado no próprio navegador (Blob + URL temporária), com BOM UTF-8 e `;` como separador, vírgula decimal e texto devidamente escapado.
- Inclui nome do paciente, período, saldos e lançamentos com data, situação, valor nominal, impacto efetivo e saldo acumulado.
- **Proteção contra injeção de fórmulas** se algum campo começar com caracteres interpretados como fórmula em planilha.
- Não inclui CPF, e-mail, data de nascimento, informações clínicas, senhas, token, histórico de sessões sem cobrança, nem comprovantes bancários.
- Não transmite o CSV ao Supabase, Google ou GitHub. Não usa localStorage.
- O arquivo contém nome e valores financeiros reais: o profissional é avisado para armazenar em lugar privado.

## Regras contábeis explícitas

Os pagamentos são contabilizados no **saldo agregado do paciente**, não alocados automaticamente a sessões específicas. Não há declaração "sessão X está paga" sem alocação individual. No mesmo dia, débitos aparecem antes de pagamentos para tornar a ordem do extrato previsível.

`Saldo = soma das sessões atualmente cobradas − soma dos pagamentos válidos`.

Para um mês com movimentos: `Saldo inicial = movimentos anteriores`; `Saldo final = saldo inicial + débitos do mês − recebimentos do mês`. Valor positivo = saldo a receber, negativo = crédito.

O histórico financeiro reflete **o estado atual** dos lançamentos; correções de sessão podem alterar retrospectivamente o total do mês correspondente. O registro de auditoria das correções permanece na seção de sessões do paciente.

## Arquivos

- `assets/patient-extract.js` — filtro, paginação na interface, totais e exportação privada.
- `assets/finance.js` — ordenação por data local e resumo financeiro no cadastro, delegando o extrato ao módulo.
- `assets/app.js` — captura de mudanças de mês, ações e limpeza do estado ao sair.
- `assets/styles.css` — interface mobile-first.
- `index.html` — importação do script novo e nova versão de cache.

## Validação

Testes sintéticos, sem modificar o Supabase:
1. Setembro: débito 100, recebimento 80 → saldo 20.
2. Outubro: débito 175 + 175, recebimento 200, mais pagamento de 50 estornado → abertura 20 e fechamento 170, estorno com impacto zero.
3. Filtro de outubro não inclui itens de setembro, mas mantém abertura do saldo anterior.
4. CSV de outubro inclui todas as linhas, BOM, valor decimal com vírgula, e protege contra fórmulas no nome do paciente.
5. Alternar filtro e limpar o módulo volta a Todo o histórico sem armazenar dados no dispositivo.
6. Nenhuma nova migration SQL foi necessária, e nenhum paciente real foi alterado.

Próximo passo: validar o filtro e a exportação no navegador do usuário em uma ficha com sessão manual e pagamento já registrados.
