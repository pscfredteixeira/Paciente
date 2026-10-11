-- Sprint 4: somente uma conta autorizada, sem inscrições públicas no aplicativo.
-- Executar no SQL Editor do projeto Supabase (ainda não executado).
create table if not exists public.app_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_access enable row level security;
revoke all on table public.app_access from public, anon, authenticated;
grant select on table public.app_access to authenticated;
drop policy if exists "only approved user reads own access" on public.app_access;
create policy "only approved user reads own access"
on public.app_access for select to authenticated
using ((select auth.uid()) = user_id);
-- Não há policies INSERT/UPDATE/DELETE: clientes não podem conceder acesso a si mesmos.
-- Adicione o usuário pelo SQL Editor DEPOIS de criá-lo no painel Auth > Users:
-- insert into public.app_access (user_id) values ('SEU_UUID_REAL_AQUI');
-- Nunca versione o UUID real, senhas, tokens ou dados de pacientes.
