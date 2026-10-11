-- Sprint 6.3: rules to map weekly or repeated Google events to a patient.
create table if not exists public.calendar_event_rules (
  owner_id uuid not null default auth.uid() references public.app_access(user_id) on delete cascade,
  match_kind text not null check (match_kind in ('series','title')),
  match_value text not null check (length(match_value) between 1 and 1024),
  patient_id uuid not null references public.patients(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id,match_kind,match_value),
  constraint title_fingerprint_is_sha256 check(match_kind<>'title' or match_value ~ '^[0-9a-f]{64}$')
);
create index if not exists calendar_event_rules_patient_idx on public.calendar_event_rules(patient_id);
alter table public.calendar_event_rules enable row level security;
revoke all on public.calendar_event_rules from public,anon,authenticated;
grant select on public.calendar_event_rules to authenticated;
grant insert (match_kind,match_value,patient_id) on public.calendar_event_rules to authenticated;
grant update (patient_id) on public.calendar_event_rules to authenticated;
grant delete on public.calendar_event_rules to authenticated;
create policy "Owner reads calendar association rules" on public.calendar_event_rules for select to authenticated
using(owner_id=(select auth.uid()) and exists(select 1 from public.app_access a where a.user_id=(select auth.uid())));
create policy "Owner inserts calendar association rules" on public.calendar_event_rules for insert to authenticated
with check(owner_id=(select auth.uid()) and exists(select 1 from public.app_access a where a.user_id=(select auth.uid()))
and exists(select 1 from public.patients p where p.id=patient_id and p.owner_id=(select auth.uid()) and p.is_active));
create policy "Owner updates calendar association rules" on public.calendar_event_rules for update to authenticated
using(owner_id=(select auth.uid()) and exists(select 1 from public.app_access a where a.user_id=(select auth.uid())))
with check(owner_id=(select auth.uid()) and exists(select 1 from public.app_access a where a.user_id=(select auth.uid()))
and exists(select 1 from public.patients p where p.id=patient_id and p.owner_id=(select auth.uid()) and p.is_active));
create policy "Owner deletes calendar association rules" on public.calendar_event_rules for delete to authenticated
using(owner_id=(select auth.uid()) and exists(select 1 from public.app_access a where a.user_id=(select auth.uid())));
