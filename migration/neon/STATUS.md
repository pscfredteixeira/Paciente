# Estado da prova de conceito (18/10/2026)

## Implementado

- Branch isolada criada: `migration/neon-proof-of-concept`.
- Inventário de dependências e tabelas do projeto atual.
- Identificação de bloqueios para migração de Auth, RLS, SQL RPC e Google Calendar.
- Critérios de aceite completos, plano de corte/rollback e regras de tratamento dos dados clínicos.
- Fixture **100% fictícia** com dois proprietários e casos de sessão manual, falta cobrada, cancelamento, débito estornado, Pix conferido e pagamento antecipado.
- Script de testes `node --test migration/neon/tests/financial-invariants.test.mjs`.

## Verificação feita

- Código e arquivo de fixtures foram recuperados da branch do GitHub.
- 10 testes executados com êxito num **ambiente JavaScript isolado de verificação**, adaptando somente imports de Node e `structuredClone` ao ambiente; todos passaram.
- O comando `node --test` está preparado, mas **não foi executado diretamente neste ambiente**, pois o container não conseguiu baixar a branch do GitHub. Execute em checkout da branch para validar também o runner Node.
- Auditoria de estrutura do banco confirmou 9 tabelas protegidas por RLS, quatro RPCs de escrita `SECURITY DEFINER`, token privado do Calendar e dependência de Supabase Auth.
- A análise foi feita sem copiar registros de pacientes, credenciais ou tokens e sem modificar o banco Supabase.

## Pendente

- Conexão/autorização da conta Neon pelo usuário.
- Criar uma sandbox Neon e testar autenticação real.
- Portar schema, RLS e rotinas financeiras na sandbox.
- Substituir Google Calendar OAuth no ambiente de teste.
- Migrar dados reais apenas após novo aceite e backup privado verificado.
- Publicar nova versão em produção somente após conformidade e testes ponta a ponta.

## Risco controlado

Nenhum arquivo de produção foi alterado na branch `main`; não houve migração de banco, redefinição de login, troca de endpoints nem publicação do experimento em GitHub Pages.
