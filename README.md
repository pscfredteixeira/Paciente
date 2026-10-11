# Meu Consultório — Sprint 4

Aplicativo web pessoal para acompanhar sessões e pagamentos. **Versão atual: protótipo navegável com dados inteiramente fictícios.**

**Abrir demonstração:** https://pscfredteixeira.github.io/Paciente/

## O que dá para testar agora

- Início: resumo das sessões e das pendências.
- Agenda: abrir eventos, vincular paciente de exemplo, confirmar sessão e registrar faltas/cancelamentos.
- Pacientes: extrato, valores de sessão e histórico ilustrativo.
- Financeiro: demonstrar débitos, recebimentos parciais e revisão antes de confirmar.
- Relatórios e Ajustes: visualização administrativa e prévia da tela de acesso.
- Navegação responsiva para celular e desktop; identidade visual roxa/laranja, títulos sem serifa em negrito.

## Estrutura do código

```text
index.html
assets/styles.css
assets/app.js
docs/ARQUITETURA.md
.gitignore
```

Para rodar localmente, use um servidor estático na pasta do repositório, como `python -m http.server 8000`, e abra `http://localhost:8000`.

## Segurança — leia antes de usar

**O repositório e a interface de demonstração são públicos.** Não há login real ou banco de dados. Nenhuma ação realizada no protótipo movimenta dinheiro ou acessa Google Calendar; todas as mudanças temporárias desaparecem ao recarregar.

**Nunca digite ou versiona informações reais de pacientes, credenciais, chaves ou tokens neste protótipo.** A versão funcional só aceitará informações reais depois de autenticação exclusiva, autorização no backend e banco com regras de acesso verificadas. O **código de login do Sprint 4 já existe**, mas ele permanece desativado até um projeto Supabase ser configurado. O arquivo `.gitignore` é uma camada auxiliar, não substitui esses controles.

Leia [arquitetura, fluxo financeiro e requisitos de segurança](./docs/ARQUITETURA.md).

## Sprint 4 — implementação preparada, ainda desativada

- `assets/config.js`: modo `demo` por padrão; ativa autenticação somente quando configurado conscientemente.
- `assets/auth.js`: login email/senha no Supabase com verificação de permissão `app_access` no banco.
- `supabase/migrations/20261011_01_access.sql`: tabela de permissões com RLS e sem políticas de gravação pelo navegador.
- `docs/SPRINT_04_ACESSO.md`: procedimento de ativação e testes.

**Não há conexão com Supabase nem usuários reais configurados.** O aplicativo ainda usa dados fictícios e o site permanece público enquanto o modo de demonstração estiver ativo.

## Próximas etapas

Conectar uma instância Supabase sob sua conta, validar a autorização real e preparar o cadastro administrativo persistente no Sprint 5. Google Calendar e integrações financeiras vêm depois.
