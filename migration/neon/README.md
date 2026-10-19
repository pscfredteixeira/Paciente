# Prova de conceito: migração Supabase → Neon

**Status: FASE 0 — planejamento e testes sintéticos. Não há um Neon conectado ou banco alternativo provisionado.**
**Produção: GitHub Pages + Supabase permanecem sem alterações.**

Esta pasta está na branch isolada `migration/neon-proof-of-concept`. Não publicar o site da branch e não apontar o frontend principal para bancos de testes.

## Por que mudar?

No plano gratuito, o Supabase pode pausar projetos por baixa atividade. O Neon adormece o **compute** após um período de inatividade e inicia automaticamente quando recebe uma nova consulta. Isso evita a restauração manual por baixa atividade, mas permanece sujeito às cotas, disponibilidade e políticas do plano contratado.

## O que será migrado?

- **Banco PostgreSQL:** 9 tabelas privadas, chaves, validações e auditorias. A tabela de tokens do Google Calendar é secreta, não deve ser importada com valores.
- **Autenticação e autorização:** Supabase Auth → **Neon Managed Better Auth**, com identificação/ACL de proprietário reavaliadas e RLS reescrito e testado.
- **Dados e operações:** leituras privadas, vínculos de calendário, funções transacionais de sessões, pagamentos, Pix manual, estornos e históricos.
- **Google Calendar:** a função `google-calendar-callback` no Supabase usa tokens privados e precisa de uma nova implementação segura no backend do Neon, com novo OAuth. Não copiar os refresh tokens.
- **Frontend:** adaptar interfaces de Auth, consultas PostgREST/Neon Data API, RPCs e endpoint de calendário em versão de teste. Preservar aparência e fluxos aprovados.

## Fases e critérios para avançar

1. **Fase 0 — inventário e segurança (esta branch).** Documentos, mapa de dependências, fixtures totalmente fictícias e testes de invariantes financeiros. Nenhuma alteração em produção.
2. **Fase 1 — Neon sandbox.** Conectar Neon no ChatGPT e, após autorização do usuário para criar os recursos, provisionar projeto de testes sem pacientes reais. Habilitar Neon Auth e Data API; criar schema isolado com RLS restritiva por padrão. Testar login, logout, sessão persistente e acesso negado entre contas.
3. **Fase 2 — compatibilidade financeira.** Portar e auditar funções transacionais de sessões, cobranças, Pix e estornos. Testar idempotência e auditoria com fixtures fictícias. Portar a interface da aplicação numa URL separada, sem tocar em `main`.
4. **Fase 3 — Google Calendar.** Reimplementar OAuth e a API `status/start/events/disconnect` em serviço HTTPS privado, com credenciais somente em secrets do provedor. Testar renovação, reconexão, CORS, revogação e acesso indevido. Nenhum token real de produção deve ser exportado.
5. **Fase 4 — migração privada de dados.** Após aprovação e backup verificável, executar exportação privada entre bancos, com validação de contagens, soma de saldos, chaves, integridade e auditoria. Jamais carregar registros de pacientes para GitHub, logs, fixtures ou chat. Congelar escritas brevemente na janela de transferência, com confirmação explícita.
6. **Fase 5 — troca de produção e possibilidade de retorno.** Trocar frontend somente depois de testes ponta a ponta e aprovação. Manter Supabase por período de observação sem escritas simultâneas. Ter procedimento de rollback e reconciliar alterações antes de voltar.

**Bloqueadores para avançar além da fase 0:** Neon ainda não conectado, provisionamento pendente de autorização, identidade dos usuários precisa ser mapeada, token Google precisa ser reautorizado, backups e restauração não foram testados.

## Regras absolutas

- Não publicar credenciais de conexão (`DATABASE_URL`), API keys secretas, CPF, nomes de pacientes, hashes de senha, chaves Pix ou tokens OAuth.
- Acesso com RLS **deny by default** até testes de isolamento aprovados. Nunca abrir tabelas com `USING (true)` para testar mais rápido.
- Não se conectar ao Neon com credenciais de banco diretamente do GitHub Pages. Usar Neon Auth + Data API com JWT e RLS ou uma função autenticada protegida.
- Consultas e funções privilegiadas devem revalidar a autorização/identidade do proprietário no servidor, não confiar em `patient_id`/UUID enviados pelo navegador.
- Nunca copiar tabelas `auth.users`, `google_calendar_tokens` ou `supabase_vault` para a branch, nem fazer dump real em CI público.
- Nunca remover o Supabase antes de existir um backup restaurável e uma validação lado a lado.

## Validação local sem credenciais

Com Node.js 20+:

```bash
node --test migration/neon/tests/financial-invariants.test.mjs
```

Os testes usam apenas fixtures inventadas em `fixtures/synthetic-ledger.json`, não acessam rede nem consultam dados reais.

Documentos relacionados: [auditoria](./INVENTARIO_E_RISCOS.md), [plano de corte](./CUTOVER_SEGURO.md), [critérios de aceite](./CRITERIOS_DE_ACEITE.md).

Referências técnicas oficiais:
- https://neon.com/docs/auth/overview
- https://neon.com/docs/data-api/overview
- https://neon.com/docs/functions/overview
- https://neon.com/docs/manage/scale-to-zero
