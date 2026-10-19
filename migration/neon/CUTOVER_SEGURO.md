# Operação de migração e retorno (runbook — não executar ainda)

## Antes

1. Inventariar projetos que usam o Supabase, inclusive o Acervo. Não desativar outras Edge Functions.
2. Em Neon sandbox, criar estrutura e rotinas auditadas com dados sintéticos; confirmar todas as caixas de aceite.
3. Fazer backup privado, criptografado e **restaurável** do Supabase, com autoria e data, fora de repo público.
4. Confirmar autorização explícita para transferência de dados pessoais e definir hora da mudança.
5. Bloquear temporariamente escritas na versão Supabase durante a cópia final, de forma reversível; informar a janela. **Não confiar em captura instantânea se usuários continuarem escrevendo nos dois bancos.**
6. Transferir exclusivamente por canal seguro, com processo em ambiente privado. Segredos de conexão nas variáveis secretas do servidor, jamais em JS publicado ou CI que imprima ambiente.
7. Não transportar senhas/hashes antigos nem tokens do Google; ativar nova conta no Neon Auth e solicitar OAuth de novo.

## Conferência de consistência

Para cada tabela: número de registros e chaves originais. Verificar FK de pacientes e sessões, unicidade de pagamentos e eventos, sequência de auditoria e ausência de órfãos. Comparar totais por mês, pacientes ativos, saldo global, sessões manuais, créditos antecipados, Pix pendentes, estornos e histórico de correção. Resultado privado da verificação deve ser **somente contagens e totais**, nunca nomes ou documentos.

## Corte

1. Após conferência, publicar a versão de frontend aprovada apontando para Neon Data API/Auth e backend novo do Google Calendar.
2. Testar com conta autorizada: login, abrir paciente, agenda, cobrança, pagamento, histórico.
3. Observar erros, latência, cotas e disponibilidade; garantir que não há gravações duplicadas nos dois bancos.
4. Guardar snapshot/tag do último commit de produção Supabase para retorno.

## Rollback

Se qualquer falha clínica ou de segurança surgir: interromper novas gravações Neon, preservar registros Neon em backup privado e decidir como reconciliar os lançamentos novos que existirem. **Não retornar para Supabase cegamente** após novas gravações no Neon, pois isso perderia sessões/pagamentos feitos após a troca. Só após reconciliação, publicar a versão anterior e liberar escritas.

## Estado atual

Somente **preparo e testes offline**. O Neon ainda não foi conectado; não houve exportação, transação com dados reais nem mudança do site.
