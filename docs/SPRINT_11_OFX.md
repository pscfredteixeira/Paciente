# Sprint 11 — Importador OFX para conferência bancária

Data: 14/10/2026. Aplicação: **Meu Consultório**, somente frontend do GitHub Pages.

## Objetivo

Ampliar a conferência assistida do Sprint 10 para aceitar **OFX 1.x (SGML)** e **OFX 2.x (XML)**, além dos CSVs. O arquivo é lido e convertido somente em memória no aparelho. Sem banco conectado, sem upload de extratos e sem criação automática de recebimentos.

## Como usar

Em **Financeiro → Conferir Pix com extrato CSV ou OFX → Importar extrato**, selecionar um `.ofx` exportado pelo banco. O programa identifica automaticamente os campos:

- `DTPOSTED`: data do lançamento bancário (início `AAAAMMDD`, mesmo quando inclui hora/fuso).
- `TRNAMT`: valor, com sinal; valores negativos são saídas, não recebimentos.
- `TRNTYPE`: tipo; transações explicitamente `DEBIT`, `PAYMENT`, `POS`, `ATM` ou `CHECK` são ignoradas.
- `NAME` e `MEMO`: descrição exibida para conferência.
- `FITID`: identificador do lançamento **do banco**, que **não é necessariamente o EndToEndId Pix**.

O importador reconhece exclusivamente entradas positivas válidas, ignora débitos, omite transações idênticas com FITID repetido e **recusa** FITID idêntico com data/valor diferentes. Rejeita arquivos de cartão de crédito e extratos contendo mais de uma conta bancária. Se houver moeda declarada diferente de BRL, a importação é bloqueada. Na ausência de moeda declarada, a interface avisa para confirmar BRL.

Normalmente o programa sugere apenas transações que contenham a palavra **Pix** em NAME/MEMO. Se o banco não escrever Pix no histórico, o usuário pode marcar a opção **Incluir outras entradas positivas** (revisar cuidadosamente cada sugestão).

As sugestões seguem as mesmas regras rigorosas do CSV: **valor idêntico, até três dias de diferença**, somente Pix cadastrados, ativos e não conferidos. O usuário deve **escolher o paciente/pagamento e confirmar individualmente**. O programa não usa nome encontrado no arquivo como identificação automática.

A caixa de seleção **Salvar o identificador bancário ao confirmar** é opcional. Se o valor de FITID atender aos critérios da RPC de Pix, é persistido como referência de conferência manual do pagamento. Nenhuma outra linha ou dado do extrato é enviado ao Supabase.

## Arquivos do código

- `assets/ofx.js`: parser local OFX SGML/XML, validações e conversão para matriz com Data, Valor, Descrição, Tipo e Identificador.
- `assets/statement.js`: aceita CSV/TXT/OFX, lê com TextDecoder UTF-8 ou Windows-1252, reconhece OFX e mostra resumo específico.
- `assets/styles.css`: layout da identificação OFX em telas pequenas.
- `index.html`: carregamento de `ofx.js` antes de `statement.js` e atualização de versão para evitar cache.
- **Sem migrações, sem tabelas novas e sem mudança de cobranças/saldos.**

## Segurança

1. Sem envio de arquivo a Supabase, Google ou GitHub.
2. Arquivo e transações ficam em memória e são descartados quando a sessão fecha, recarrega ou quando o usuário seleciona **Descartar extrato**.
3. Campos não confiáveis do OFX são escapados ao renderizar HTML. Não são avaliados ou executados como código.
4. Parser aceita tamanho máximo de **2 MB** e até **6 mil transações**.
5. Evita tratamento enganoso de moedas e faturas de cartão como recebimentos.
6. Confirmar corresponde a marcação **manual** na mesma RPC `set_pix_verification`, com autorização e auditoria previamente implantadas no Sprint 9.
7. Arquivos de múltiplas contas requerem exportar uma única conta.
8. Não armazenar exemplos reais de extrato no repositório, nas issues ou em logs.

## Validações técnicas

- Teste simulado do OFX 1.x SGML com transação `CREDIT` (data com hora) e `DEBIT` negativo: dois créditos encontrados e saída ignorada.
- Teste OFX 2.x XML com tags fechadas, caracteres XML escapados, lançamento explícito `DEBIT` com valor positivo: saída ignorada.
- Confirmado bloqueio de moeda diferente de BRL, vários blocos de conta e cartão de crédito.
- Confirmada seleção individual, reconhecimento de colunas sem configuração, simulação de um único registro de conferência e ausência de escrita na simples leitura.
- Arquivos reais variam por banco; o primeiro OFX real utilizado pelo proprietário ainda precisa de validação visual.

## Limite de escopo

Este sprint não é integração bancária e não identifica efetivamente se um valor entrou na conta. Continua exigindo conferência humana cuidadosa. O próximo aperfeiçoamento deve ser definido a partir da experiência real do usuário com seu arquivo bancário.
