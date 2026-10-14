# Sprint 7.1 — Data de nascimento, CPF e e-mail de pacientes

**Finalidade:** ampliar o cadastro administrativo privado, sem modificar ou apagar os registros existentes.

## Banco de dados
Migração já aplicada: `supabase/migrations/20261014_sprint_07_1_patient_birth_cpf_email.sql`.

Três colunas opcionais adicionadas a `public.patients`:
- `birth_date` — tipo `date`, valor entre 1900-01-01 e a data de hoje.
- `cpf` — texto com **11 dígitos, sem pontuação**, checado em PostgreSQL pela função imutável `public.patient_cpf_is_valid(text)`. Índice único por proprietário, apenas quando CPF informado.
- `email` — texto com comprimento máximo de 254 e validação básica de formato. O formulário normaliza para minúsculas.

As colunas continuam com a política RLS de `patients`: somente a conta aprovada consulta seus pacientes. Foram concedidas exclusivamente as permissões `SELECT`, `INSERT` e `UPDATE` nas três novas colunas à role `authenticated`. `anon` não recebeu acesso.

**Importante:** o CPF é dado pessoal. Os valores são armazenados no Supabase, não no GitHub; o navegador recebe esses valores apenas durante a sessão autenticada. Evite inserir informações pessoais ou CPF reais em issues, commits, prints públicos ou logs. O aplicativo não utiliza essas informações para cobrança automática nem envia mensagens de e-mail.

## Interface
- Tela **Pacientes → Novo paciente**: novos campos opcionais.
- Tela **Pacientes → abrir cadastro → Editar**: preencher, corrigir e apagar cada campo opcional.
- Tela **Pacientes → detalhe**: seção **Dados pessoais**, com data exibida como DD/MM/AAAA, CPF com máscara 000.000.000-00 e e-mail.
- Campos vazios exibidos como **Não informado**.
- Layout adaptado ao computador e celular, com foco na legibilidade de e-mails longos.

## Verificações
- Exemplo sintético de CPF válido aceito; CPF inválido e sequência repetida rejeitados.
- RLS permanece ativo, `anon` não consegue ler a coluna CPF.
- Transação reversível `ROLLBACK` comprovou inserção, leitura, atualização, limpeza de campos opcionais e recusa de CPF duplicado, CPF inválido, e-mail inválido e nascimento futuro.
- Mocks do JavaScript testaram salvar os três campos, normalização de CPF/e-mail, rejeição do CPF inválido e limpeza para `NULL`.
- Os pacientes existentes continuam com os novos campos em branco até preenchimento manual.
- **Pendente:** usuário testar a criação/edição de um cadastro real no navegador.

## Próximo sprint
Sprint 8, pagamentos e financeiro real, somente após a validação do novo cadastro.
