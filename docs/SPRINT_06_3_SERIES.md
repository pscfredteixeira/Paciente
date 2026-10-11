# Sprint 6.3 — Vincular sessões recorrentes de uma vez

## Motivação
Consultas semanais chegam ao Google como instâncias diferentes, cada uma com `id` próprio. A versão 6.2 vinculava só o ID da instância: um paciente com agenda semanal precisava ser associado novamente toda semana.

## Implementado

Na aba **Agenda**, em cada compromisso, escolher paciente e:
- **Só esta sessão**: salva o vínculo individual na tabela `calendar_event_links`, como antes.
- **Vincular todas as semanas**: se a API Google fornecer `recurringEventId`, cria regra permanente associando a série ao paciente, incluindo ocorrências anteriores e futuras, mesmo quando o agendamento mudar de horário.
- **Vincular mesmo título**: caso sejam eventos separados, sem uma série do Google, cria regra para o **título exato normalizado**. Só aparece em títulos minimamente específicos; o usuário confirma que o título sempre corresponde à mesma pessoa.
- **Parar vínculo automático**: remove a regra, preservando vínculos individuais já salvos.
- **Remover exceção** ou **Desvincular esta sessão**: remove apenas vínculo individual, se houver.

A interface exibe **Vínculo automático** quando uma série ou título foi aplicado automaticamente. A regra é consultada a cada semana; não precisa gerar cópias de vínculos para os infinitos eventos futuros. A aplicação não cria débitos e não altera eventos no Google.

### Precedência para evitar erros

1. Vínculo individual anterior do evento prevalece.
2. Regra da série Google (`recurringEventId`).
3. Regra de título normalizado.
4. Sem vínculo.

Isso preserva correções individuais. A regra por título deve ser usada apenas quando o título identificar exclusivamente aquele paciente. Alterações de título impedem a correspondência, enquanto uma série continua associada pelo identificador estável.

### Privacidade e segurança

- Tabela `public.calendar_event_rules` protege os registros com RLS e `owner_id = auth.uid()`, exigindo conta autorizada e paciente ativo do mesmo proprietário.
- A tabela registra o ID da série ou o SHA-256 de título normalizado, **não o nome em texto simples**. O hash é gerado na função servidor, não armazenado no GitHub.
- A função `google-calendar-callback` (v6) consulta `recurringEventId` e gera `titleKey`. Escopo permanece `calendar.events.readonly`.
- Remover uma regra não modifica o Google Calendar.
- Todos os dados financeiros continuam simulados.

### Verificações

- Migração criada e aplicada no Supabase; inserção/atualização/exclusão sob usuário autenticado verificada em transação reversível (ROLLBACK).
- Testes simulados no frontend: associação de uma série numa semana, reconhecimento automático na semana seguinte, exclusão de regra e fallback por título.
- **Pendente:** conferir com o usuário a associação de uma série real no navegador após publicação no GitHub Pages.

### Arquivos

- `supabase/migrations/20261011232500_sprint_06_3_calendar_series_rules.sql`
- `assets/agenda-real.js`
- `assets/styles.css`
- `index.html`
- Edge Function implantada diretamente no Supabase: `google-calendar-callback`.
