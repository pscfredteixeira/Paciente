-- Sprint 7: real, idempotent consultation confirmations and debits.
-- Only approved authenticated account can execute the transactional RPC.
create table public.session_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.app_access(user_id) on delete cascade,
  google_event_id text not null check (length(google_event_id) between 1 and 1024),
  patient_id uuid not null references public.patients(id) on delete restrict,
  scheduled_at timestamptz not null,
  status text not null check(status in ('done','missed_charge','missed_nocharge','cancelled','voided')),
  fee_snapshot_cents integer not null check(fee_snapshot_cents between 0 and 99999999),
  charge_cents integer not null check(charge_cents>=0 and charge_cents<=fee_snapshot_cents),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,google_event_id),
  unique(id,owner_id),
  check (charge_cents = case when status in ('done','missed_charge') then fee_snapshot_cents else 0 end)
);
create index session_records_patient_time_idx on public.session_records(owner_id,patient_id,scheduled_at desc);
create table public.session_debits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  session_id uuid not null unique,
  amount_cents integer not null check(amount_cents>=0 and amount_cents<=99999999),
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(session_id,owner_id) references public.session_records(id,owner_id) on delete restrict
);
create index session_debits_owner_idx on public.session_debits(owner_id,voided);
create table public.session_audit (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  session_id uuid not null,
  previous_status text,
  new_status text not null,
  previous_charge_cents integer not null,
  new_charge_cents integer not null,
  reason text not null check (reason in ('initial','correction')),
  occurred_at timestamptz not null default now(),
  foreign key(session_id,owner_id) references public.session_records(id,owner_id) on delete restrict
);
create index session_audit_session_idx on public.session_audit(owner_id,session_id,occurred_at desc);
alter table public.session_records enable row level security;
alter table public.session_debits enable row level security;
alter table public.session_audit enable row level security;
revoke all on public.session_records,public.session_debits,public.session_audit from public,anon,authenticated;
grant select on public.session_records,public.session_debits,public.session_audit to authenticated;
create policy "approved owner reads sessions" on public.session_records
  for select to authenticated using(
    owner_id=(select auth.uid()) and exists(select 1 from public.app_access where user_id=(select auth.uid()))
  );
create policy "approved owner reads debits" on public.session_debits
  for select to authenticated using(
    owner_id=(select auth.uid()) and exists(select 1 from public.app_access where user_id=(select auth.uid()))
  );
create policy "approved owner reads session audit" on public.session_audit
  for select to authenticated using(
    owner_id=(select auth.uid()) and exists(select 1 from public.app_access where user_id=(select auth.uid()))
  );
create or replace function public.record_consultation(
  p_event_id text,p_patient_id uuid,p_event_start timestamptz,p_status text,p_correct boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $f$
declare
  v_owner uuid := (select auth.uid());
  v_patient public.patients%rowtype;
  v_record public.session_records%rowtype;
  v_charge integer;
  v_previous integer;
  v_previous_status text;
  v_new boolean := false;
begin
  if v_owner is null or not exists(select 1 from public.app_access where user_id=v_owner) then
    raise exception 'Acesso não autorizado' using errcode='42501';
  end if;
  if p_event_id is null or length(p_event_id) not between 1 and 1024
     or p_patient_id is null or p_event_start is null then
    raise exception 'Dados da sessão inválidos' using errcode='22023';
  end if;
  if p_status is null or p_status not in ('done','missed_charge','missed_nocharge','cancelled','voided') then
    raise exception 'Situação da sessão inválida' using errcode='22023';
  end if;
  if p_event_start < '2015-01-01'::timestamptz
    or (p_status in ('done','missed_charge','missed_nocharge') and p_event_start>now()) then
    raise exception 'A sessão não pode ser confirmada antes de começar' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||'/'||p_event_id,0));
  select * into v_record from public.session_records
    where owner_id=v_owner and google_event_id=p_event_id for update;
  if found then
    if v_record.patient_id<>p_patient_id then
      raise exception 'A sessão já está registrada para outro paciente' using errcode='22023';
    end if;
    if v_record.status=p_status then
      return pg_catalog.jsonb_build_object('session_id',v_record.id,'status',v_record.status,
           'charge_cents',v_record.charge_cents,'fee_cents',v_record.fee_snapshot_cents,'unchanged',true);
    end if;
    if not p_correct then
      raise exception 'Sessão já registrada; use a opção de corrigir' using errcode='23505';
    end if;
    v_previous_status:=v_record.status;
    v_previous:=v_record.charge_cents;
    v_charge:=case when p_status in ('done','missed_charge') then v_record.fee_snapshot_cents else 0 end;
    update public.session_records set status=p_status,charge_cents=v_charge,updated_at=now()
      where id=v_record.id;
  else
    if p_correct or p_status='voided' then
      raise exception 'Sessão ainda não registrada' using errcode='22023';
    end if;
    select * into v_patient from public.patients where id=p_patient_id and owner_id=v_owner and is_active=true for share;
    if not found then raise exception 'Paciente ativo não encontrado' using errcode='22023'; end if;
    v_charge:=case when p_status in ('done','missed_charge') then v_patient.fee_cents else 0 end;
    insert into public.session_records(owner_id,google_event_id,patient_id,scheduled_at,status,fee_snapshot_cents,charge_cents)
      values(v_owner,p_event_id,p_patient_id,p_event_start,p_status,v_patient.fee_cents,v_charge)
      returning * into v_record;
    v_previous:=0;
    v_previous_status:=null;
    v_new:=true;
  end if;
  if v_charge>0 then
    insert into public.session_debits(owner_id,session_id,amount_cents,voided)
    values(v_owner,v_record.id,v_charge,false)
    on conflict(session_id) do update
       set amount_cents=excluded.amount_cents, voided=false,updated_at=now();
  else
    update public.session_debits set voided=true, updated_at=now()
      where owner_id=v_owner and session_id=v_record.id and voided=false;
  end if;
  insert into public.session_audit(owner_id,session_id,previous_status,new_status,previous_charge_cents,new_charge_cents,reason)
    values(v_owner,v_record.id,v_previous_status,p_status,v_previous,v_charge,case when v_new then 'initial' else 'correction' end);
  return pg_catalog.jsonb_build_object('session_id',v_record.id,'status',p_status,'charge_cents',v_charge,
    'fee_cents',v_record.fee_snapshot_cents,'unchanged',false);
end
$f$;
revoke all on function public.record_consultation(text,uuid,timestamptz,text,boolean) from public,anon;
grant execute on function public.record_consultation(text,uuid,timestamptz,text,boolean) to authenticated;
