-- Already applied to Supabase (migration sprint_06_2_calendar_event_links).
-- Only explicit event ID <-> patient association. Never save Google titles or tokens here.
create table if not exists public.calendar_event_links (
  owner_id uuid not null default auth.uid() references public.app_access(user_id) on delete cascade,
  google_event_id text not null check (length(google_event_id) between 1 and 1024),
  patient_id uuid not null references public.patients(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, google_event_id)
);
create index if not exists calendar_event_links_patient_idx on public.calendar_event_links(patient_id);
alter table public.calendar_event_links enable row level security;
revoke all on public.calendar_event_links from public, anon, authenticated;
grant select on public.calendar_event_links to authenticated;
grant insert (google_event_id, patient_id) on public.calendar_event_links to authenticated;
grant update (patient_id) on public.calendar_event_links to authenticated;
grant delete on public.calendar_event_links to authenticated;
drop policy if exists "approved owner reads own event links" on public.calendar_event_links;
create policy "approved owner reads own event links" on public.calendar_event_links
for select to authenticated
using (owner_id = (select auth.uid()) and exists (select 1 from public.app_access where user_id = (select auth.uid())));
drop policy if exists "approved owner adds own event links" on public.calendar_event_links;
create policy "approved owner adds own event links" on public.calendar_event_links
for insert to authenticated
with check (owner_id = (select auth.uid())
  and exists (select 1 from public.app_access where user_id = (select auth.uid()))
  and exists (select 1 from public.patients p where p.id=patient_id and p.owner_id=(select auth.uid()) and p.is_active));
drop policy if exists "approved owner edits own event links" on public.calendar_event_links;
create policy "approved owner edits own event links" on public.calendar_event_links
for update to authenticated
using (owner_id = (select auth.uid()) and exists (select 1 from public.app_access where user_id = (select auth.uid())))
with check (owner_id = (select auth.uid())
  and exists (select 1 from public.app_access where user_id = (select auth.uid()))
  and exists (select 1 from public.patients p where p.id=patient_id and p.owner_id=(select auth.uid()) and p.is_active));
drop policy if exists "approved owner unlinks own events" on public.calendar_event_links;
create policy "approved owner unlinks own events" on public.calendar_event_links
for delete to authenticated using (owner_id = (select auth.uid())
  and exists (select 1 from public.app_access where user_id = (select auth.uid())));
