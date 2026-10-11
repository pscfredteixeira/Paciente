# Sprint 5 — Pacientes privados

O módulo de pacientes foi conectado ao Supabase no projeto Meu Consultório (região São Paulo). **Apenas a área Pacientes é persistente.** Agenda, financeiro, extratos e relatórios ainda apresentam dados fictícios e não devem ser usados para gestão real.

## Entrega

- Cadastro privado por meio da conta única aprovada em `app_access`.
- Nome administrativo, valor individual em centavos, frequência (Semanal, Quinzenal, Mensal ou Avulsa) e status ativo/arquivado.
- Edição, busca, filtro de ativos/arquivados e reativação.
- Sem exclusão física pelo aplicativo; arquivar mantém o histórico do cadastro.
- Não armazenar anamneses, diagnósticos, anotações clínicas, informações de saúde, documentos ou comprovantes nessa tabela.
- Os cadastros são carregados do banco após autenticação; não são armazenados em `localStorage` pelo módulo, nem em JSON público.

## Estrutura de código

- `assets/patients.js`: consultas e gravações Supabase; o cliente só fica disponível depois de autenticação e autorização.
- `assets/patients-ui.js`: tela responsiva de cadastro, edição, arquivo e busca; sanitização de texto ao renderizar.
- `assets/app.js`: roteia a aba Pacientes ao novo módulo, apenas para a sessão autorizada. As demais telas continuam com demonstrações.
- `assets/styles.css`: estilos responsivos novos.
- `supabase/migrations/20261011191842_sprint_05_patients_private.sql`: tabela, índice e RLS.
- `supabase/migrations/20261011192348_sprint_05_limit_patient_columns.sql`: evita alteração de `owner_id`, `created_at` ou `updated_at` pelo navegador.

## Segurança aplicada e validada

Acesso permitido somente para `authenticated` com `owner_id = auth.uid()` **e** conta presente em `app_access`. A política vale para leitura, inserção e edição, com `WITH CHECK` para evitar transferência de propriedade. Anônimos não recebem permissão SELECT; contas não aprovadas enxergam zero linhas.

A role `authenticated` tem escrita somente nas colunas administrativas `full_name`, `fee_cents`, `cadence` e `is_active`. Não recebe DELETE nem edição da propriedade do registro.

Foi feita transação de teste autorizada de INSERT e UPDATE/arquivamento com **ROLLBACK**; nenhum paciente fictício de teste permaneceu na tabela. Também houve teste de leitura como identidade não aprovada, que retornou zero linhas. O teste de integração de interface com as credenciais pessoais ainda depende da verificação pelo proprietário.

**Aviso pendente no Supabase:** `Leaked Password Protection Disabled`. Ativar no painel e revisar proibição de cadastro público e MFA antes de inserir dados reais em larga escala. Veja https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Próximos sprints

1. Concluir proteção adicional do login, consentimentos e política administrativa LGPD conforme necessidade.
2. Conectar leitura autorizada do Google Calendar e vincular eventos aos cadastros privados.
3. Criar tabelas e ações auditáveis para sessões e débitos reais.
4. Somente depois disso, criar financeiro real com pagamentos, ajustes, saldos e conciliação.

**Nunca criar cobranças a partir de exemplos fictícios.**
