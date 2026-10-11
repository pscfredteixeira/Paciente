# Arquitetura — Meu Consultório (Sprint 3)

**Situação em 11/10/2026:** aplicativo demonstrativo, hospedado no GitHub Pages com código público e **dados fictícios**. Não há backend, login real, acesso à agenda nem integração financeira.

## Arquivos publicados

```text
Paciente/
├── index.html             # entrada HTML e referências relativas
├── assets/
│   ├── styles.css         # paleta roxa/laranja, tipografia sans, UX responsiva
│   └── app.js             # navegação e simulações locais em memória
├── docs/
│   └── ARQUITETURA.md     # este documento
└── README.md              # instruções de uso do protótipo
```

O desmembramento do antigo HTML único conserva o código de estilo e interação; **nenhum servidor/conta real foi conectado**. É possível servir a pasta com um servidor estático. Em GitHub Pages, os links de CSS/JS são relativos (`./assets/...`), evitando dependência de domínio customizado.

## Decisões de produto

- Uso individual, sem cadastro público de profissionais, portal de pacientes ou prontuário clínico.
- Consultas continuam sendo agendadas no sistema atual, que as envia ao Google Calendar.
- Integração do aplicativo ao Google Calendar será inicialmente **apenas para leitura**.
- Confirmar "Sessão realizada" cria **débito**, não pagamento.
- Pagamentos serão registrados separadamente. A baixa bancária automática é etapa posterior.
- Títulos sem serifa e grossos, interface roxa com detalhes em laranja: identidade aprovada.
- O protótipo não persiste operações: tudo reinicia ao recarregar.

## Arquitetura prevista para a fase funcional

```text
Navegador (PWA futuro, sessão autenticada)
       |
       +-- GitHub Pages: interface pública (arquivos estáticos)
       |
       +-- Backend com autorização por identidade e regras de acesso
             |
             +-- Supabase Auth + banco PostgreSQL com RLS
             +-- Serviços seguros para OAuth do Google Calendar
             +-- Conciliação de Pix/banco e recepção de webhooks
             +-- Logs de auditoria e políticas de backup
```

**Ainda não implementado.** Não colocar segredos, credenciais bancárias, tokens OAuth, dados de pacientes nem chaves de serviço no código público. A autorização de acesso precisa ser aplicada no servidor/banco (não somente escondendo botões). A chave pública de cliente, quando aplicável, só é aceitável com RLS corretamente configurado e testado. Tokens de refresh e chaves administrativas ficam exclusivamente no backend. Toda sincronização/baixa financeira deve ser idempotente e auditável.

## Entidades planejadas (não criadas)

- `pacientes`: identificador, nome administrativo mínimo, valor por sessão em centavos, estado ativo.
- `eventos_agenda`: ID externo e calendário, data/hora, estado de sincronização e possível paciente vinculado.
- `sessoes`: evento de origem, paciente, situação, valor da época e confirmação/correção.
- `lancamentos`: débito, pagamento, crédito ou estorno, valor em centavos, referência, data e motivo.
- `conciliacoes`: referência do banco/PSP, evidência e estado de correspondência.
- `auditoria`: operação, identidade autorizada, data, identificador do registro e justificativa, sem dados clínicos.

### Invariantes financeiras

1. Uma sessão cobrada gera um único débito (unicidade por ID de sessão/ação).
2. Pagamentos identificados geram crédito apenas uma vez (chave idempotente externa).
3. Reabrir ou corrigir uma sessão não apaga históricos financeiros: gera reversão rastreável.
4. Saldo = débitos − pagamentos/créditos + ajustes; permitir pagamento parcial e saldo credor.
5. Eventos sem paciente associado não geram débito automaticamente.
6. Comprovante por WhatsApp não é confirmação de crédito no banco.

## Próximas entregas técnicas

1. Definir hospedagem segura do frontend e ambiente de homologação; manter GitHub Pages apenas para demonstração até haver backend protegido.
2. Criar login exclusivo e bloquear qualquer acesso não autorizado aos dados, inclusive via API.
3. Criar banco de dados e migrações, com RLS testada com contas não autorizadas.
4. Só então registrar pacientes de verdade, conectar Google Calendar e lançar cobranças reais.

## Checklist mínimo de regressão

- Página renderiza com `index.html`, `assets/styles.css` e `assets/app.js`.
- Em 320, 390 e 1440 px, não há rolagem horizontal.
- Títulos permanecem sem serifa com peso 800.
- Agenda abre sessão; confirmação gera um único débito demonstrativo.
- Financeiro recebe pagamento parcial fictício e altera o saldo.
- Tela de login é identificada como **apenas demonstração**.
- Nenhum dado real ou segredo aparece no repositório.
