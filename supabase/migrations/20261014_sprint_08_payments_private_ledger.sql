-- Sprint 8: private payment ledger; credits are unallocated excess payments.
-- No interaction with Google Calendar and no automatic bank transfer.
create table public.patient_payments (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.app_access(user_id) on delete cascade,
 patient_id uuid not null references public.patients(id) on delete restrict,
 request_id uuid not null,
 amount_cents integer not null check(amount_cents between 1 and 99999999),
 paid_on date not null check(paid_on >= date '2000-01-01' and paid_on <= current_date),
 method text not null check(method in ('Pix','Dinheiro','Transferência','Cartão','Outro')),
 note text check(note is null or (length(note) <= 300 and note = btrim(note))),
 voided_at timestamptz,
 created_at timestamptz not null default now(),
 unique(owner_id,request_id),
 unique(id,owner_id)
);
create index patient_payments_patient_date on public.patient_payments(owner_id,patient_id,paid_on desc);
create index patient_payments_owner_month on public.patient_payments(owner_id,paid_on desc);
create table public.payment_audit (
 id bigint generated always as identity primary key,
 owner_id uuid not null,
 payment_id uuid not null,
 action text not null check(action in ('created','voided')),
 amount_cents integer not null,
 occurred_at timestamptz not null default now(),
 foreign key(payment_id,owner_id) references public.patient_payments(id,owner_id) on delete restrict
);
create index payment_audit_payment_idx on public.payment_audit(owner_id,payment_id,occurred_at desc);
alter table public.patient_payments enable row level security;
alter table public.payment_audit enable row level security;
revoke all on public.patient_payments,public.payment_audit from public,anon,authenticated;
grant select on public.patient_payments,public.payment_audit to authenticated;
create policy "approved owner reads own payments" on public.patient_payments
 for select to authenticated using(owner_id=(select auth.uid()) and exists(
   select 1 from public.app_access where user_id=(select auth.uid())));
create policy "approved owner reads own payment audit" on public.payment_audit
 for select to authenticated using(owner_id=(select auth.uid()) and exists(
   select 1 from public.app_access where user_id=(select auth.uid())));

-- SECURITY DEFINER because no client may write the ledger/audit directly;
-- all RPC calls check app_access, auth.uid and patient ownership explicitly.
create function public.record_patient_payment(
 p_patient_id uuid,p_amount_cents integer,p_paid_on date,p_method text,p_note text,p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $f$
declare
 v_owner uuid := (select auth.uid());
 v_existing public.patient_payments%rowtype;
 v_new public.patient_payments%rowtype;
 v_note text := nullif(pg_catalog.btrim(coalesce(p_note,'')),'');
begin
 if v_owner is null or not exists(select 1 from public.app_access where user_id=v_owner) then
  raise exception 'Acesso não autorizado' using errcode='42501';
 end if;
 if p_request_id is null or p_patient_id is null
   or p_amount_cents is null or p_amount_cents not between 1 and 99999999
   or p_paid_on is null or p_paid_on < date '2000-01-01' or p_paid_on > current_date
   or p_method is null or p_method not in ('Pix','Dinheiro','Transferência','Cartão','Outro')
   or (v_note is not null and length(v_note)>300) then
   raise exception 'Dados de pagamento inválidos' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||'/payment/'||p_request_id::text,0));
 select * into v_existing from public.patient_payments where owner_id=v_owner and request_id=p_request_id for update;
 if found then
  if v_existing.patient_id<>p_patient_id or v_existing.amount_cents<>p_amount_cents
    or v_existing.paid_on<>p_paid_on or v_existing.method<>p_method
    or v_existing.note is distinct from v_note then
    raise exception 'Esta solicitação já foi utilizada para outro pagamento' using errcode='23505';
  end if;
  return pg_catalog.jsonb_build_object('payment_id',v_existing.id,'unchanged',true,
    'voided',v_existing.voided_at is not null);
 end if;
 if not exists(select 1 from public.patients
  where id=p_patient_id and owner_id=v_owner) then
  raise exception 'Paciente não encontrado' using errcode='22023';
 end if;
 insert into public.patient_payments(owner_id,patient_id,request_id,amount_cents,paid_on,method,note)
 values(v_owner,p_patient_id,p_request_id,p_amount_cents,p_paid_on,p_method,v_note)
 returning * into v_new;
 insert into public.payment_audit(owner_id,payment_id,action,amount_cents)
 values(v_owner,v_new.id,'created',v_new.amount_cents);
 return pg_catalog.jsonb_build_object('payment_id',v_new.id,'unchanged',false,'voided',false);
end
$f$;
revoke all on function public.record_patient_payment(uuid,integer,date,text,text,uuid) from public,anon;
grant execute on function public.record_patient_payment(uuid,integer,date,text,text,uuid) to authenticated;

create function public.void_patient_payment(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $f$
declare
 v_owner uuid := (select auth.uid());
 v_payment public.patient_payments%rowtype;
begin
 if v_owner is null or not exists(select 1 from public.app_access where user_id=v_owner) then
  raise exception 'Acesso não autorizado' using errcode='42501';
 end if;
 if p_payment_id is null then raise exception 'Identificador inválido' using errcode='22023'; end if;
 select * into v_payment from public.patient_payments
 where owner_id=v_owner and id=p_payment_id for update;
 if not found then raise exception 'Pagamento não encontrado' using errcode='22023'; end if;
 if v_payment.voided_at is not null then
  return pg_catalog.jsonb_build_object('payment_id',v_payment.id,'unchanged',true);
 end if;
 update public.patient_payments set voided_at=now() where id=v_payment.id;
 insert into public.payment_audit(owner_id,payment_id,action,amount_cents)
 values(v_owner,v_payment.id,'voided',v_payment.amount_cents);
 return pg_catalog.jsonb_build_object('payment_id',v_payment.id,'unchanged',false);
end
$f$;
revoke all on function public.void_patient_payment(uuid) from public,anon;
grant execute on function public.void_patient_payment(uuid) to authenticated;
