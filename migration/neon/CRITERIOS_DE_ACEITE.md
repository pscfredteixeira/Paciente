# Critérios de aceite obrigatórios antes de mudar a produção

A migração só será considerada pronta quando todos os blocos estiverem **comprovadamente** aprovados numa instalação Neon de testes. Os testes offline atuais não equivalem a esta validação.

## Autenticação e isolamento

- [ ] Criar conta no Neon e autenticar a conexão do ChatGPT (ação do titular).
- [ ] Habilitar Managed Better Auth e Neon Data API na branch de testes, sem chaves secretas no frontend.
- [ ] Login, logout, sessão após recarga e expiração/reautenticação funcionam.
- [ ] Usuário não autorizado recebe recusa em todas as rotas.
- [ ] Usuário autorizado vê apenas os próprios registros.
- [ ] Usuário externo não consegue ler/escrever pacientes, datas, pagamentos nem auditoria.
- [ ] Verificar `owner_id` após correspondência servidor-side da identidade Neon com UUID legado.
- [ ] Testar RLS inclusive em funções que usam privilégios elevados; não liberar `PUBLIC EXECUTE`.

## Financeiro e sessões (fixtures sintéticas)

- [ ] Registrar uma sessão manual gerando exatamente 1 débito.
- [ ] Confirmar a mesma sessão duas vezes, sem duplicar débito.
- [ ] Corrigir para falta isenta, estornar débito e auditar.
- [ ] Registrar pagamento adiantado e refletir crédito correto.
- [ ] Registrar recebimento Pix, conferir manualmente e desfazer conferência sem mexer no saldo.
- [ ] Estornar pagamento, refletir débito novamente e manter auditoria.
- [ ] Extrato por mês tem saldo inicial e final corretos, inclusive em mudança de mês e fuso.
- [ ] Relatórios agregados dão os mesmos resultados esperados em duas contas isoladas.

## Agenda Google (prova de conceito)

- [ ] OAuth Google Calendar autenticado pela identidade Neon.
- [ ] Callback e tokens protegidos somente no backend (nenhum token no GitHub Pages).
- [ ] Consultar agenda, vincular paciente por evento e série, confirmar atendimento, ver débito.
- [ ] Renovação de token, revogação, desconexão, CORS, expiração e erros reais tratados.

## Privacidade, recuperação e publicação

- [ ] Backup de teste restaura corretamente, sem perda de integridade nem auditoria.
- [ ] Migração real só após novo aceite explícito, janela de congelamento e backup privado.
- [ ] Conferir contagens de todas as tabelas, valores, integridade FK, usuários e auditoria **sem publicar linhas**.
- [ ] Nenhum CPF, nome, token, senha, hash, chave Pix ou `DATABASE_URL` em commits, Actions/logs ou browser.
- [ ] Usar URL de testes distinta da URL clínica real.
- [ ] Trocar produção apenas após aceite e ensaio de rollback.
- [ ] Manter Supabase ativo durante período de observação e preservar outros apps dependentes.

**Critério bloqueante:** qualquer falha de acesso entre usuários, dados financeiros inconsistentes, OAuth Google inseguro ou backup sem restauração impede a troca de produção.
