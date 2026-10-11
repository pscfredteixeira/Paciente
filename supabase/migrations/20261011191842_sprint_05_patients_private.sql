-- Migração executada no Supabase como sprint_05_patients_private
-- Somente dados administrativos mínimos; não adicionar notas clínicas.
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.app_access(user_id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  fee_cents integer not null check (fee_cents between 0 and 99999999),
  cadence text not null default 'Semanal'
    check (cadence in ('Semanal','Quinzenal','Mensal','Avulsa')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists patients_owner_name_idx
  on public.patients(owner_id, lower(full_name));
alter table public.patients enable row level security;
revoke all on table public.patients from public, anon, authenticated;
grant select, insert, update on table public.patients to authenticated;

drop policy if exists "approved owner can view patients" on public.patients;
create policy "approved owner can view patients"
  on public.patients for select to authenticated
  using (owner_id = (select auth.uid())
    and exists (select 1 from public.app_access where user_id = (select auth.uid())));

drop policy if exists "approved owner can add patients" on public.patients;
create policy "approved owner can add patients"
  on public.patients for insert to authenticated
  with check (owner_id = (select auth.uid())
    and exists (select 1 from public.app_access where user_id = (select auth.uid())));

drop policy if exists "approved owner can update patients" on public.patients;
create policy "approved owner can update patients"
  on public.patients for update to authenticated
  using (owner_id = (select auth.uid())
    and exists (select 1 from public.app_access where user_id = (select auth.uid())))
  with check (owner_id = (select auth.uid())
    and exists (select 1 from public.app_access where user_id = (select auth.uid())));
-- Nenhuma política DELETE: histórico preservado, uso de is_active=false.
