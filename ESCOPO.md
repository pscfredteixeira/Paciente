# Meu Consultório — Escopo mestre e plano de sprints

**Versão:** 1.0 · 11 de outubro de 2026  
**Produto:** aplicativo web privado, responsivo e futuramente instalável (PWA).  
**Usuário final:** um único psicanalista.  
**Estado:** fase UX/UI; nenhuma conexão real com pacientes, agenda ou banco.

## 1. Visão do produto

Resolver três problemas concretos:

1. Visualizar as consultas que já são agendadas em **outro sistema** e chegam ao Google Calendar, sem alterar esse agendamento.
2. Após o atendimento, confirmar no aplicativo que a sessão ocorreu e **lançar o débito** correspondente no financeiro do paciente.
3. Identificar os **pagamentos recebidos** e abater os valores devidos, primeiro manualmente e, futuramente, de modo automático ou semiautomático.

O princípio orientador é **poucas ações, alta confiabilidade e clareza financeira**. O usuário não precisa de prontuário clínico, portal de pacientes, marketplace, equipe, secretária nem multiusuários.

### Distinções fundamentais

- **Evento do Google Calendar:** compromisso de agenda; não prova realização da sessão.
- **Sessão realizada:** atendimento confirmado pelo profissional; gera débito quando a regra de cobrança permitir.
- **Débito:** valor devido por uma sessão ou falta cobrada; não significa dinheiro recebido.
- **Pagamento:** entrada de dinheiro registrada/confirmada; pode quitar uma ou várias cobranças, parcial ou integralmente.
- **Saldo:** débitos menos pagamentos/créditos, sem duplicar lançamentos.

## 2. Experiência do usuário e direção visual

**Conceito visual:** sereno, claro, profissional, acolhedor sem visual hospitalar. Referências: agenda editorial, organização financeira simples e navegação típica de aplicativos iOS.

**Identidade da primeira versão:** “Meu Consultório” (nome provisório), roxo profundo, lavanda clara, textos em roxo-escuro e detalhes laranja para avisos e destaques. Títulos com serifa editorial, interface e valores com fonte sem serifa legível. Bordas suaves; espaçamento generoso; estados textuais + cor (não depender só de cor).

**Mobile first:** barra inferior com Início, Agenda, Pacientes, Financeiro e Mais. No desktop, menu lateral persistente. A consulta abre um painel contextual no desktop e uma folha inferior/modal no celular.

**Princípios UX obrigatórios:**

- Uma ação dominante por tela e confirmação explícita para operações financeiras.
- Saldo recebido e saldo a receber sempre separados.
- Montantes legíveis em reais, datas em pt-BR, horário `America/Sao_Paulo`.
- Acessibilidade: contraste, alvos de toque adequados, labels, teclado, zoom de fonte, layout responsivo e sem rolamento horizontal.
- Feedback imediato, confirmação de registro, opção de desfazer quando seguro, aviso para sincronização desatualizada.
- Nada de informações clínicas, hipóteses diagnósticas ou notas de sessão.
- O protótipo usa somente nomes e valores **fictícios**.

## 3. Mapa de telas

### 3.1 Acesso
- Tela de login com identidade visual do consultório; autenticação real só em sprint próprio.
- Recuperação/reenquadramento do acesso, gestão de sessão ativa, segundo fator de autenticação conforme provedor.

### 3.2 Início
- Indicadores: consultas da data selecionada, realizadas/pendentes de confirmação, recebido, a receber.
- Lista de próximos eventos e pendências de confirmação.
- Resumo de saldos e alertas administrativos úteis.

### 3.3 Agenda
- Visualização por dia e semana; filtros de eventos reconhecidos e sem vínculo.
- Identificação e associação de evento a paciente.
- Detalhe: data, horário, paciente, valor aplicável, origem, status.
- Ações: **realizada**, **falta cobrada**, **falta sem cobrança**, **cancelada**, **reabrir/corrigir**.
- Não editar nem desmarcar o compromisso original no Google Calendar por padrão.

### 3.4 Pacientes
- Lista, busca, ativação/inativação e cadastro mínimo.
- Nome administrativo, apelido/identificador para associação de agenda, valor da sessão, periodicidade opcional, forma habitual de recebimento opcional e regras financeiras.
- Histórico de sessões, lançamentos, pagamentos, saldo e correções.
- Relatório individual / extrato exportável sem notas clínicas.

### 3.5 Financeiro
- Valores **em aberto**, **recebidos**, **parcialmente pagos**, **não identificados**.
- Débitos ligados a uma sessão; créditos ligados a comprovante ou transação.
- Registro manual de pagamento; alocação a uma ou várias sessões, inclusive pagamentos parciais ou adiantamentos.
- Estornos, descontos, ajustes e justificativa obrigatória para correções.
- Conciliação: evento bancário identificado / sugestão de correspondência / revisão manual.

### 3.6 Relatórios
- Recebimentos por mês e período; faturado versus efetivamente recebido.
- Sessões realizadas, faltas, cancelamentos e pendências.
- Exportação CSV/PDF quando implementada; valores e períodos claramente identificados.

### 3.7 Ajustes
- Conta e autenticação; Google Calendar (estado da conexão, calendário escolhido, última atualização); banco/Pix (estado da integração); valores e políticas-padrão; segurança; backup/exportação; auditoria.

## 4. Regras de negócio — decisões já fixadas

1. O Google Calendar é a origem do agendamento, criado pelo sistema atual de marcação de consultas.
2. A conexão é **somente leitura** inicialmente; não fazemos alterações no calendário.
3. Uma consulta no passado **não é automaticamente considerada realizada**.
4. Confirmar atendimento gera **um único débito**, associado à sessão e ao paciente.
5. Nenhum comprovante de WhatsApp, por si só, prova que houve crédito na conta; pagamentos dependem de registro manual ou fonte financeira confiável.
6. O sistema deve reconciliar lançamentos de forma **idempotente**: repetir uma ação, sincronização ou webhook não duplica débitos ou créditos.
7. Nenhum evento sem correspondência segura com um paciente gera cobrança automaticamente; ficará em fila de vinculação.
8. Se um evento for excluído ou alterado no calendário após uma sessão financeira confirmada, o registro histórico **não é apagado**; vira pendência para revisão.
9. Valores da sessão são capturados no lançamento, pois o preço do paciente pode mudar no futuro.
10. Recebimento parcial, pagamento antecipado, pagamento de múltiplas sessões e Pix de terceiros devem ser suportados (com revisão quando a correspondência não for confiável).
11. Os casos de falta/cancelamento obedecerão à política cadastrada; não cobrar faltas automaticamente sem definir tal política.
12. Pagamentos e correções devem manter trilha de auditoria e motivos; preferir estorno/reversão em vez de apagar histórico.

## 5. Sprints — fase visual primeiro, funcional depois

### Sprint 0 — Produto e regras (planejamento)
**Objetivo:** fechar as necessidades do consultório sem pressupor fluxo clínico.

**Escopo:** inventário de telas, papéis (um único titular), fontes de eventos, regras de cobrança, diferentes formatos de recebimento, requisitos de privacidade, mapa da jornada e critérios de sucesso.

**Aceite:** backlog priorizado, lista de decisões pendentes, critérios de pronto e fronteiras de escopo documentados.

### Sprint 1 — Direção visual + protótipo-base (INICIADO E ENTREGUE)
**Objetivo:** avaliar a experiência antes de integrar qualquer sistema.

**Escopo:** identidade visual, tipografia, cores, componentes, navegação desktop e mobile, painéis de Início, Agenda, Pacientes, Financeiro, Relatórios e Ajustes, além de tela-modelo de acesso. Nomes e valores inventados.

**Interatividade demonstrativa:** navegar, escolher dia, abrir evento, vincular paciente fictício, marcar sessão e observar lançamento simulado, abrir extrato, registrar pagamento simulado.

**Aceite:** arquivo HTML independente, responsivo em smartphone e desktop, sem integração real, com indicação explícita de demonstração.

### Sprint 2 — Refinamento de UX, edge cases e design system
**Objetivo:** validar as situações difíceis no visual antes do backend.

**Escopo:** protótipos das jornadas com sucesso/erro, evento sem vínculo, consulta remarcada, falta cobrada/não cobrada, pagamento parcial, pagamento a maior, pagamento não identificado, duplicação, divergências de preço; estados vazios, carregando e sem conexão; componentes reutilizáveis; testes de usabilidade no iPhone e no desktop; acessibilidade e copy detalhados.

**Aceite:** percursos completos testáveis com dados fictícios, incluindo telas de confirmação e correção, sem controles enganosos.

### Sprint 3 — Infraestrutura e projeto real
**Objetivo:** transformar o protótipo aprovado em uma aplicação mantível.

**Escopo:** repositório privado GitHub; projeto web responsivo (sugestão: Vite + React + TypeScript, com componentes); lint, testes, configuração de ambientes; hospedagem HTTPS de frontend (Cloudflare Pages ou Vercel); backend Supabase; migrações de banco; monitoramento básico; segredos fora do GitHub.

**Aceite:** ambiente de teste publicado por HTTPS com dados falsos e pipeline de implantação funcionando. Ainda sem pacientes reais.

### Sprint 4 — Login único e proteção dos dados
**Objetivo:** acesso exclusivo do titular.

**Escopo:** autenticação real por provedor confiável, lista restrita à identidade autorizada (bloquear criação livre de contas), políticas de Row Level Security e autorização do lado servidor, expiração de sessão, gestão de credenciais, logs de acesso sem dados sensíveis, documentação de recuperação de conta.

**Aceite:** uma conta autorizada entra; outra conta, mesmo autenticada no Google, não consulta nem altera dados; testes de acesso negado e API protegida. Autenticação Google e permissão de ler Calendar são autorizações separadas.

### Sprint 5 — Cadastro e regras financeiras por paciente
**Objetivo:** fonte confiável de dados administrativos mínimos.

**Escopo:** CRUD seguro de paciente (nome, identificadores, valor, vigência de preço, frequência, status); pesquisar, editar, inativar; alertas de nomes ambíguos; migração/importação manual controlada; registros de alteração.

**Aceite:** cadastrar paciente, atualizar valor sem alterar lançamentos históricos, inativar preservando histórico, nenhum dado aparecer para usuário não autorizado.

### Sprint 6 — Google Calendar: conexão e sincronização
**Objetivo:** ler a agenda que o sistema atual já alimenta.

**Escopo:** consentimento OAuth de leitura, escolha de calendário, sincronização inicial e incremental, fuso horário, tratamento de recorrência/remarcação, atualizações, exclusões, eventos particulares, relógio de última sincronização, reconexão, associação manual estável evento↔paciente e sugestões não automáticas quando ambíguas.

**Aceite:** novo evento aparece no app, alteração se reflete, eventos sem paciente são sinalizados, exclusão não destrói lançamento financeiro; falha de sincronização é visível. OAuth em ambiente de testes requer atenção ao ciclo de vida dos tokens e consentimento.

### Sprint 7 — Confirmação de sessões + débito confiável
**Objetivo:** um toque transforma sessão realizada em cobrança registrada.

**Escopo:** máquina de estados de sessão; confirmação explícita; política de falta/cancelamento; débito por sessão com snapshot de preço; correção/reversão auditável; proteção contra duplo clique, eventos duplicados e processamento repetido; exibição no extrato e resumo do dia.

**Aceite:** confirmar sessão cria exatamente um débito; confirmar de novo não gera outro; reabrir segue regra segura, com alerta se já houver pagamento alocado; falta/cancelamento não cobram sem política explícita.

### Sprint 8 — Livro-caixa e pagamentos manuais
**Objetivo:** controle financeiro utilizável mesmo sem integração bancária.

**Escopo:** recebimento manual, alocação a débitos, parcial, múltiplas sessões, pagamento antecipado/saldo credor, descontos/estornos, filtros por período/status/paciente, histórico de alterações, saldos consistentes, extrato individual e pesquisa.

**Aceite:** soma dos débitos menos créditos iguala o saldo exibido; operação errada pode ser corrigida com trilha de auditoria; testes com casos parciais e sobrepagamentos.

**Marco MVP:** após o Sprint 8 já haverá aplicação utilizável com agenda Google, confirmação de sessão e financeiro manual protegido.

### Sprint 9 — Baixa de Pix e conciliação automatizada
**Objetivo:** reduzir o trabalho de reconhecer pagamentos sem criar falsos quitados.

**Descoberta primeiro:** confirmar o banco usado, existência/limitações de API ou Open Finance e disposição para oferecer cobrança Pix individual. Comparar custo, disponibilidade, prazos e privacidade dos provedores.

**Escopo:** adaptar ao caminho escolhido: cobrança Pix identificada com webhook **ou** leitura/conciliação de transações bancárias. Identificadores únicos, verificação de autenticidade de webhook, validação de valor/data/identidade, tolerância a Pix de terceiros, fila de "conferir", marcação de pagamento apenas mediante evidência válida, idempotência, reconciliação periódica.

**Aceite:** pagamento confirmado é lançado uma vez; duplicata de webhook não duplica; correspondência incerta não baixa automaticamente; falha de banco não provoca falsa quitação. **Não prometer compatibilidade sem verificar o banco**.

### Sprint 10 — Relatórios, alertas e exportação
**Objetivo:** fornecer visão operacional e avisos úteis.

**Escopo:** balanço mensal (faturado/recebido/pendente), pacientes com valores em aberto, sessões não confirmadas, pagamentos não identificados, exportação CSV/PDF, opção de lembretes internos/por e-mail com conteúdo minimizado. Sem mensagens automáticas ao paciente por padrão.

**Aceite:** valores de relatório reconciliados com extratos, exportações corretas, avisos não expõem dados confidenciais em notificações públicas.

### Sprint 11 — PWA, robustez, segurança e lançamento
**Objetivo:** disponibilizar com confiabilidade no iPhone e no computador.

**Escopo:** manifest/ícones, instalação pela tela inicial, responsividade final, estados de rede, controle de cache para não guardar dados de pacientes indevidamente, testes de segurança e permissão, backup e restauração testados, logs de auditoria, monitoramento, proteção a mudanças de API, revisão de LGPD/retensão, validação de custo, publicação do ambiente real.

**Aceite:** instalação como web app, testes reais em Safari/Chrome, segunda conta bloqueada, recuperações e backups ensaiados, nenhum segredo/clientes vazando em frontend/repositório.

### Sprint 12 — Melhorias opcionais (não bloqueantes)
**Possibilidades:** exportação para contador; recorrência de valores/pacotes se fizer sentido; automação de lembretes; reconciliação por múltiplos bancos; filtros mais avançados; análise de tendências; importação histórica; biometria oferecida pelo dispositivo via fluxo de autenticação suportado.

**Aceite:** cada melhoria nasce de uma necessidade real identificada após uso do MVP; evitar ampliar a complexidade desnecessariamente.

## 6. Modelo de dados conceitual

| Entidade | Campos essenciais | Observações |
|---|---|---|
| `owner` | auth_user_id, status, configurações | Somente um titular autorizado |
| `patients` | id, nome, identificador, ativo, valor atual, vigência | Dados administrativos mínimos |
| `calendar_connections` | id, calendar_id, estado, última_sync | Tokens secretos somente backend |
| `calendar_events` | calendar_id, external_event_id, occurrence_id, início/fim, hash/estado | Recorrências e atualizações |
| `event_patient_links` | evento/ocorrência, paciente, origem da vinculação | Associação auditável |
| `sessions` | event_occurrence_id, patient_id, estado, valor_snapshot, timestamps | Uma sessão por ocorrência lógica |
| `charges` | session_id, valor, motivo, status | Chave única por sessão + categoria conforme política |
| `payments` | id, origem, external_transaction_id, valor, data, status | Identificador externo único quando presente |
| `payment_allocations` | payment_id, charge_id, valor | Permite quitação parcial e múltipla |
| `adjustments` | id, referência, valor, motivo, autor, timestamp | Estornos/correções auditáveis |
| `audit_events` | ação, ator, alvo, antes/depois minimizados, data | Registrar sem expor segredos |
| `sync_jobs` | origem, cursor, status, erro sanitizado | Reprocessamento seguro |

**Requisitos técnicos transversais:** UUID, chaves/índices únicos, transações atômicas, valores monetários como inteiro em centavos (`BRL`), timestamps consistentes, idempotency keys, migrações versionadas, criptografia em trânsito/repouso, autorização verificada no servidor e backups testáveis.

## 7. Arquitetura sugerida

```
Sistema atual de agendamento ─────► Google Calendar
                                        │ OAuth de leitura
                                        ▼
GitHub privado ──► frontend web/PWA ──► backend protegido (Supabase)
                                        │       │
                                        │       ├─ Pacientes / sessões / financeiro
                                        │       ├─ Conciliação e auditoria
                                        │       └─ segredos, integrações e jobs
                                        ▼
                                Provedor bancário / Pix
```

**Separação importante:** GitHub é repositório de código; hospedagem da interface não substitui o banco protegido e o backend. Para produção, adotar hospedagem HTTPS adequada e fluxo de OAuth testado. O protótipo entregue é um único arquivo HTML deliberadamente sem infraestrutura real.

A API Google Calendar oferece leitura com escopo de permissão somente leitura, sincronização incremental via `syncToken` e notificações push quando configuradas em infraestrutura HTTPS. Webhooks do Calendar não entregam o evento completo e canais expiram, de modo que precisam de sincronização e renovação. Documentação: https://developers.google.com/workspace/calendar/api/auth ; https://developers.google.com/workspace/calendar/api/guides/sync ; https://developers.google.com/workspace/calendar/api/guides/push .

O Supabase oferece autenticação, RLS e segredos em funções de backend: https://supabase.com/docs/guides/auth ; https://supabase.com/docs/guides/database/secure-data ; https://supabase.com/docs/guides/functions/secrets .

## 8. Privacidade e segurança desde o desenho

- Embora não haja prontuário, a associação identificável entre pessoa e atendimento de saúde merece proteção reforçada. Avaliar LGPD conforme situação concreta.
- Nomes de pacientes nunca entram em testes públicos, capturas de tela, issues, exemplos, logs de deploy ou repositório.
- Repositório privado **não equivale** a aplicativo privado; autorização/isolamento devem acontecer no backend.
- Nunca colocar API keys secretas, tokens OAuth ou credenciais bancárias no frontend, localStorage ou GitHub.
- Mínimo privilégio: Calendar somente leitura; conta autorizada por identificador, não apenas por domínio/e-mail informado no navegador.
- Backup criptografado e testado, exclusão/retensão minimizada, trilha de alterações administrativas.
- Não permitir que mecanismos de cache offline gravem dados sensíveis sem projeto e testes específicos.
- Autenticação e autorização serão reais a partir do Sprint 4; tela de login do protótipo é **apenas demonstração**.

## 9. Casos de teste obrigatórios antes de produção

- Dois cliques em “Realizada” → um débito.
- Evento duplicado/sincronização repetida → uma sessão por ocorrência.
- Pacientes homônimos → o sistema pede escolha, não associa sozinho.
- Evento mudou de horário → mesma sessão lógica, sem perder histórico.
- Evento excluído depois de cobrar → lançamento permanece e há revisão.
- Pagamento parcial → saldo proporcional.
- Um Pix pagando duas sessões → duas alocações, um único pagamento.
- Pix de terceiro → valor pendente de identificação, sem atribuir automaticamente.
- Valor da sessão alterado depois → cobrança histórica inalterada.
- Falta cobrada/sem cobrança → política explícita e reversível com auditoria.
- Cancelamento com pagamento prévio → tratar crédito/estorno, não apagar rastros.
- Reprocessar webhook 5 vezes → um registro.
- Segunda conta Google tenta acessar → acesso negado em banco e API.
- Calendar API desautorizada ou sem rede → indicador claro de erro/desatualização.
- Verificação de legibilidade em iPhone pequeno, teclado virtual, zoom e VoiceOver.

## 10. Fora do escopo inicial

Prontuário, notas clínicas, transcrição/gravação de atendimentos, teleconsulta, agendamento pelo paciente, app nativo na App Store, multiusuário, gestão de equipe, cobrança judicial, emissão fiscal automática, envio automatizado de mensagens ao paciente sem autorização específica e acesso direto à conta bancária sem integração formal adequada.

## 11. Critérios para aprovar a fase de UX

- A pessoa encontra a consulta desejada rapidamente em celular e desktop.
- Entende, sem ambiguidade, a diferença entre sessão confirmada, débito, pagamento e saldo.
- Consegue simular a confirmação e verificar o extrato do paciente.
- Consegue identificar erro ou evento sem paciente e vê como tratá-lo.
- Não há ação que pareça realmente conectar conta ou movimentar dinheiro nesta fase.
- O design é legível em telas pequenas, sem rolagem lateral.
- A navegação e o vocabulário são aprovados antes de iniciar Sprint 3.

## 12. Próximas decisões a resolver antes da implementação

1. Qual é o banco/conta em que os recebimentos acontecem? Ele atende às integrações necessárias?
2. No Google Calendar, como o paciente aparece: nome, iniciais, algum código, descrição? Há múltiplos calendários?
3. Política de faltas/cancelamentos e exceções: cobra quando não comparece? Prazo mínimo?
4. Existem pacientes com valores distintos ou pagamentos por mês/pacote?
5. Há pagamentos antecipados, de terceiros, em espécie, ou em diferentes contas?
6. E-mail da conta Google que deverá ser **a única** autorizada, informado apenas na fase segura de configuração, não em protótipos públicos.

## 13. Entrega do Sprint 1

Arquivo: `meu-consultorio-prototipo.html`. Abrir em um navegador. O HTML contém CSS e JavaScript embutidos, sem dependências externas, login real, API Google, banco de dados ou movimentação financeira. Todas as mudanças simuladas são apenas temporárias na página e se perdem ao atualizar.

**Demonstração do fluxo:** Início → Agenda → 13 out → abrir Marina A. → “Marcar como realizada” → Financeiro → Pacientes → abrir Marina A. e conferir o extrato. Depois, experimentar “Registrar pagamento” (simulado). Em 14 out, experimentar vincular evento sem paciente.

**Decisão de produto:** só migrar para integração de contas reais depois de aprovar as telas, as regras de cobrança e o fluxo de correções.
**Decisão de produto:** só migrar para integração de contas reais depois de aprovar as telas, as regras de cobrança e o fluxo de correções.

## Sprint 2 — atualização de 11/10/2026

Identidade visual roxa com detalhes laranja aprovada. Sprint 2 contém filtros da agenda, fluxo de revisão antes de confirmar sessão ou pagamento, tela de atenção, histórico financeiro e prévia do extrato do paciente. Todas as operações continuam simuladas. Repositório atualmente público: **não armazenar dados reais** ou tokens, manter frontend estático com conteúdo fictício até construir o backend seguro.
