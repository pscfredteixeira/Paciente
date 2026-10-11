# Meu Consultório — Sprint 6.3

Aplicativo pessoal do consultório, com **login privado Supabase** e interface responsiva para iPhone e computador.

**Abrir aplicativo:** https://pscfredteixeira.github.io/Paciente/

## Partes que já são reais

**Pacientes:** cadastro privado, busca, edição, valor de sessão, frequência, arquivamento e reativação. Registros no Supabase com RLS.

**Agenda:** compromissos da agenda principal do Google Calendar, com navegação por semanas e dias, consulta em modo somente leitura e vínculo aos pacientes privados. Agora há dois tipos de associação: **Só esta sessão** e **Vincular todas as semanas** para séries recorrentes. Para eventos separados com o mesmo título específico, há **Vincular mesmo título** com confirmação. As regras ficam salvas no Supabase e se aplicam automaticamente às semanas anteriores e futuras. O Google Calendar não é alterado.

**Ajustes:** conectar, desconectar e consultar eventos do Google Calendar.

## Partes que ainda são demonstração

**Início, Financeiro e Relatórios:** dados inventados, exibidos apenas para prototipagem. Nenhuma consulta real marcada como realizada, nenhum débito ou pagamento real é lançado. A cobrança automática após confirmar uma sessão será implementada em um sprint posterior, com controle contra duplicações.

## Código modular

```text
index.html
assets/
  app.js
  auth.js
  config.js
  patients.js
  patients-ui.js
  calendar.js
  agenda-real.js
  styles.css
supabase/migrations/
  20261011_01_access.sql
  20261011191842_sprint_05_patients_private.sql
  20261011192348_sprint_05_limit_patient_columns.sql
  20261011225800_sprint_06_2_calendar_event_links.sql
docs/
  ARQUITETURA.md
  SPRINT_04_ACESSO.md
  SPRINT_05_PACIENTES.md
  SPRINT_06_2_AGENDA.md
  SPRINT_06_3_SERIES.md
```

## Segurança

O repositório e os arquivos de frontend do GitHub Pages são públicos. **Não versionar nomes de pacientes, eventos privados, informações clínicas, senhas ou tokens nesse repositório.** Os dados administrativos persistidos estão no banco com RLS. OAuth do Google funciona com tokens armazenados apenas no Supabase servidor.

Ainda existe o aviso de segurança Supabase [Leaked Password Protection Disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Recomenda-se ativar essa opção e revisar configurações de cadastro público e MFA. A autorização Google em modo Testando pode expirar, exigindo nova conexão.

[Agenda real](./docs/SPRINT_06_2_AGENDA.md) · [Vínculos recorrentes](./docs/SPRINT_06_3_SERIES.md).

## Próxima etapa

Validar a Agenda Google no navegador; depois criar sessões reais e lançamentos financeiros persistentes, evitando débitos duplicados.
