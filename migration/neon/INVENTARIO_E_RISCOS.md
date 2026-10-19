# Inventário técnico e riscos da migração

Auditoria do projeto Supabase **Meu Consultório** em 18/10/2026. Foi consultada apenas a **estrutura** do banco e o código-fonte; não foram exportados nomes de pacientes, CPFs, registros clínicos ou tokens.

## Estado verificado

- Supabase principal: `ACTIVE_HEALTHY` no momento da auditoria. Localização: São Paulo.
- Frontend publicado via GitHub Pages: `index.html`, HTML/CSS/JS modular, autenticação carregada pelo `assets/auth.js`.
- Identidade atual: login e sessões de **Supabase Auth**, com `app_access.user_id` UUID na lista de contas autorizadas.
- `assets/calendar.js` chama o endpoint da Edge Function `google-calendar-callback`, passando o JWT Supabase. A função cuida de OAuth Google, leitura, atualização de token e desconexão. Deve ser substituída apenas depois de testes reais no Neon.
- Outra Edge Function ativa, `acervo-link-preview`, serve a um projeto distinto; **não remover nem desativar o Supabase enquanto outras aplicações dependerem dele**.

## Tabelas a mapear

| Tabela | Função | RLS atual | Necessidade no Neon |
| --- | --- | --- | --- |
| `app_access` | Acesso autorizado | Sim | Mapear nova identidade ao proprietário legado |
| `patients` | Cadastro privado, honorários e dados pessoais | Sim | Preservar UUIDs, constraints e campos |
| `calendar_event_links` | Vínculo evento/paciente | Sim | Preservar IDs do Google |
| `calendar_event_rules` | Regras recorrentes | Sim | Preservar título/ocorrência e owner |
| `session_records` | Sessão realizada/falta/correção | Sim | Preservar `manual:UUID`, hora e valor |
| `session_debits` | Débitos ativos/estornados | Sim | Preservar idempotência por sessão |
| `session_audit` | Auditoria de correções | Sim | Preservar ordenação/identificadores |
| `patient_payments` | Recebimentos, estornos, Pix | Sim | Preservar referências e chaves únicas |
| `payment_audit` | Auditoria financeira | Sim | Preservar histórico e sequência |
| `google_calendar_tokens` | OAuth Google, dados de acesso secretos | Verificar permissão isolada | **Não migrar conteúdo; reconectar OAuth** |

O banco também usa extensões `pgcrypto`, `uuid-ossp`, `pg_stat_statements` e `supabase_vault`. **Não pressupor** que extensões Supabase ou chaves da Vault existam no Neon.

## Functions SQL de escrita

As operações sensíveis são RPCs transacionais e `SECURITY DEFINER`:
- `record_consultation` — confirma/corrige sessão, gera/estorna débito e auditoria;
- `record_patient_payment` — registra pagamento;
- `void_patient_payment` — estorna;
- `set_pix_verification` — marca/desmarca conferência Pix sem alterar saldo.

Essas rotinas usam permissões/identidade vinculadas ao Supabase. Não devem ser copiadas sem auditoria. No Neon, reforçar acesso autenticado, ownership e idempotência. Não deixar `PUBLIC EXECUTE` em rotinas privilegiadas.

## Compatibilidade e riscos

1. **IDs de identidade.** O UUID Supabase Auth é a base do `owner_id`; a identidade emitida pelo Neon Managed Better Auth pode ter formato/valor diferente. Precisa existir uma relação **verificada no servidor** entre usuário Neon e proprietário legado. Nunca assumir que email ou um ID passado do frontend concede acesso.
2. **RLS.** Supabase usa `auth.uid()`; Neon Data API com JWT/RLS utiliza recursos de identidade próprios. Só habilitar API após equivalência da política; rotinas `SECURITY DEFINER` exigem checagens explícitas.
3. **Google OAuth.** O provedor original não deve continuar responsável pela agenda quando o login migrar. Implantar função nova com segredo em ambiente privado e pedir **reautorização** do Google; não transportar refresh tokens.
4. **Histórico.** Preservar agendamentos em timezone e débitos do passado, valores em centavos, pagamentos antecipados, correções, estornos, conferência Pix e auditoria.
5. **Cópia de dados.** Exportação/importação contendo dados pessoais sensíveis deve acontecer entre sistemas privados, com autorização explícita, backup verificado, transferência criptografada e exclusão dos temporários. Não anexar exportação no chat nem GitHub.
6. **Custos e cotas.** Neon Free também tem limites. Não prometer disponibilidade ilimitada. O compute adormece e acorda sob demanda, diferente da pausa manual do Supabase, mas interrupções e limites são possíveis.
7. **Outros apps.** `acervo-link-preview` está ativa no Supabase. A migração do Meu Consultório não implica remoção do projeto Supabase.

## Estratégia escolhida

- Preservar a arquitetura de **GitHub Pages** para o frontend.
- Experimentar `Neon PostgreSQL + Managed Better Auth + Data API + Neon Functions` em projeto Neon separado, mediante autorização e conexão.
- Usar a branch `migration/neon-proof-of-concept` para experimentos. **Sem deploy de Pages nesta branch.**
- Substituir somente após testes de RLS (usuário autorizado, usuário alheio, visitante), fluxos financeiros e Google Calendar.
