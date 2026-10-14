# Sprint 10 — Conferência assistida de Pix por extrato CSV

Implementação em `main` no projeto Meu Consultório, 14/10/2026.

## Objetivo

Permitir comparar **um extrato CSV exportado pelo próprio usuário** com pagamentos Pix **já registrados manualmente** no Supabase. **Nunca lançar pagamentos do extrato automaticamente**, nunca interpretar uma correspondência só de valor como pagamento confirmado e nunca conectar à conta bancária.

## Operação

1. Abrir **Financeiro → Conferir Pix com extrato CSV → Importar CSV**.
2. Selecionar arquivo `.csv` ou `.txt` de até **2 MB**. O arquivo é lido **somente no navegador**, com suporte a UTF-8 e Windows-1252; nenhuma linha do CSV é enviada à API nem armazenada no servidor.
3. Escolher a linha que contém os cabeçalhos, caso o banco tenha acrescentado informações no início do arquivo.
4. Conferir os mapeamentos: **Data** e **Valor** obrigatórios; Descrição, Tipo e Identificador são opcionais. O programa sugere nomes de colunas frequentes e detecta separadores vírgula, ponto e vírgula, TAB ou barra vertical.
5. O comparador ignora valores negativos, saídas e linhas que indiquem Pix enviado. Por padrão, considera apenas entradas positivas que mencionam **Pix**; o usuário pode habilitar outros créditos positivos para revisão manual caso seu banco não inclua a palavra.
6. Para cada linha elegível, são exibidos apenas os pagamentos Pix **ativos e ainda não conferidos** com **valor igual** e data registrada com diferença de **até 3 dias**.
7. O usuário escolhe o paciente/pagamento correspondente. A interface impede selecionar um mesmo pagamento para duas linhas da mesma importação simultaneamente; ambiguidades precisam de escolha explícita.
8. Antes de confirmar, aparece uma pergunta com nome do paciente, valor, data do extrato e data do pagamento cadastrado. **Somente a confirmação individual** executa a RPC autorizada `set_pix_verification` já implantada no Sprint 9.
9. Se o usuário marcar a opção, o identificador de transação é normalizado e armazenado na referência Pix existente (quando válido); **não** há envio de descrições, arquivo, outras linhas, dados bancários ou extrato.
10. O arquivo pode ser descartado do navegador; também desaparece ao atualizar ou sair da conta.

## Características de segurança

- Não cria `patient_payments` nem `session_debits`; não altera valores ou saldos.
- Reutiliza a RPC privada com autorização `auth.uid()`, RLS e verificação contra referências Pix ativas duplicadas.
- Nenhum banco é consultado. Uma confirmação significa exclusivamente **“conferido manualmente pelo profissional”**.
- O arquivo é carregado em memória JS; não utiliza `localStorage`, IndexedDB, cookies nem upload.
- O app mostra os dados do extrato apenas ao usuário autenticado; valores textuais externos são HTML-escaped.
- Não logar arquivo, nomes, CPFs, códigos Pix ou detalhes do extrato no GitHub.
- Aceita até 6 mil linhas de CSV e mostra até 100 correspondências por vez; se exceder, exportar período menor.
- A associação usa valor+janela de datas como sugestão; não há identificação bancária definitiva nem comparação por pagador. O usuário deve conferir o comprovante/extrato real.
- CSV incompatível (planilha XLSX/PDF, formato sem colunas Data/Valor, arquivos excessivos) exige exportar CSV adequado. Ainda não foi implementada importação de OFX.

## Arquivos

- `assets/statement.js` — parser CSV local, mapeamento, comparação e conferência individual.
- `assets/finance.js` — seção de importação no Financeiro.
- `assets/app.js` — tratamento de arquivo, ações e limpeza ao sair.
- `assets/styles.css` — interface responsiva.
- `index.html` — carregamento e cache bust.

## Validação

- Parse CSV `;` e `,`, valores brasileiros com vírgula decimal e ponto de milhar, datas DD/MM/AAAA, cabeçalho deslocado.
- Valores negativos e Pix enviado são ignorados.
- Créditos que não mencionam Pix exigem habilitação explícita.
- Nenhum pagamento é modificado somente por importar arquivo.
- Pagamentos do mesmo valor e data exigem escolha do usuário; duplicidade no mesmo lote bloqueada.
- Teste em memória da RPC mockada mostrou exatamente uma gravação após confirmação.
- Publicação precisa ser verificada na GitHub Pages Actions.
- Fluxo com arquivo real do usuário ainda precisa de validação visual (layout/títulos de colunas variam conforme banco).

## Próximo passo recomendado

O usuário deve experimentar um CSV pequeno real e informar **quais colunas seu banco fornece** caso o mapeamento não reconheça. Não solicitar extratos contendo informações financeiras de terceiros ou documentos pessoais aqui no chat; preferir exemplos com dados fictícios para corrigir importadores.
