# Sprint 6.2 — Agenda real com Google Calendar

**Publicado em 11/10/2026.** A aba **Agenda** deixa de usar os eventos fictícios e passa a consultar o Google Calendar autorizado pelo proprietário. Não altera horários no Google e não cria cobranças.

## Funcionalidades entregues

- Seleção de semanas (anterior/próxima) e dias, com referência ao fuso `America/Sao_Paulo`.
- Lista de eventos da semana selecionada, consultada no servidor; os títulos dos compromissos **não são gravados no GitHub nem no banco de vínculos**.
- Identificação de eventos vinculados, não vinculados e filtro para cada grupo.
- Associação manual entre um evento do Google Calendar e um cadastro de paciente *ativo* no Supabase.
- Desvinculação, mantendo o compromisso intacto no Google Calendar.
- Associação persistente na tabela `public.calendar_event_links`; somente IDs do evento e do paciente.
- A Agenda informa claramente que confirmações de sessões e financeiro real ainda não fazem parte deste sprint.
- A aba Ajustes continua com controle para conectar/desconectar e para consultar eventos.

## Arquivos

- `assets/agenda-real.js`: interface, datas, filtros, vínculo/desvínculo e carregamento privado da semana.
- `assets/calendar.js`: acesso autenticado à Edge Function e consultas pelo intervalo requisitado.
- `assets/app.js`: substitui a rota de Agenda somente no modo com login.
- `assets/styles.css`: estilo responsivo em celulares (incluindo 320px) e desktop.
- `supabase/migrations/20261011225800_sprint_06_2_calendar_event_links.sql`: esquema PostgreSQL, permissões e RLS.

A Edge Function Google `google-calendar-callback` (v3) suporta consulta de eventos com intervalo de até 31 dias e até 2.500 eventos por página. Se o Google informar páginas adicionais, a interface interrompe a exibição com aviso de que não foi possível obter uma lista completa.

## Banco e privacidade

`calendar_event_links` tem RLS para a conta autenticada aprovada, validando `owner_id=auth.uid()` e o paciente pertencente ao mesmo proprietário. Não permite associar pacientes arquivados como novo vínculo. Permite leitura, inserção, correção e desvinculação apenas ao proprietário aprovado.

Os tokens do Google permanecem nas tabelas exclusivas de serviço `google_calendar_tokens` e `google_calendar_oauth_attempts`; a interface do navegador não recebe tokens do Google, somente a listagem permitida e o ID de evento.

A consulta Google utiliza apenas o escopo `https://www.googleapis.com/auth/calendar.events.readonly`. Não envia solicitações para criar/editar/excluir eventos.

## Verificações concluídas

- Migração aplicada, RLS ativo, SELECT anônimo negado.
- Transação SQL de teste fez INSERT/UPDATE/DELETE para conta aprovada e **ROLLBACK**; nenhum vínculo falso permaneceu.
- Conta não aprovada lê zero vínculos.
- Módulo JavaScript passou na verificação de sintaxe, renderização simulada de Agenda e navegação de semanas.
- Simulação de associação, exibição do nome vinculado e desvinculação passou.
- **Ainda pendente:** validação visual em navegador real com a conta do proprietário; integração com os eventos reais precisa ser conferida por ele.

## Próximos passos

1. Verificar na Agenda que os eventos do Google coincidem com os horários do calendário real.
2. Associar manualmente um evento ao paciente correto, atualizar a página e verificar a persistência.
3. Depois, criar tabelas financeiras auditáveis (sessão concluída → débito idempotente, pagamento separado).
4. Rever no Supabase os alertas de senha vazada e no Google o prazo das credenciais OAuth em modo Testando.

**Nunca usar o financeiro demonstrativo para cobrar uma pessoa real.**
