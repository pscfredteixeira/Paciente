-- Sprint 9: manual Pix verification, distinct from recording a payment.
-- The application never accesses bank accounts and never verifies Pix automatically.
alter table public.patient_payments
  add column pix_verified_at timestamptz,
  add column pix_reference text;
alter table public.patient_payments
  add constraint patient_payments_pix_verification_consistent
  check (
    (pix_verified_at is null and pix_reference is null)
    or (method='Pix' and pix_verified_at is not null
       and (pix_reference is null or
         (length(pix_reference) between 3 and 100
           and pix_reference = pg_catalog.upper(pg_catalog.btrim(pix_reference))
           and pix_reference ~ '^[A-Z0-9._:-]+$')))
  );
create unique index patient_payments_unique_verified_pix_reference
  on public.patient_payments(owner_id,pix_reference)
  where method='Pix' and pix_verified_at is not null
    and voided_at is null and pix_reference is not null;

alter table public.payment_audit
  drop constraint payment_audit_action_check;
alter table public.payment_audit
  add constraint payment_audit_action_check
  check (action in ('created','voided','pix_verified','pix_verification_removed'));

-- Existing owner-only SELECT RLS policies remain in force; no write permissions for clients.
create function public.set_pix_verification(
  p_payment_id uuid,
  p_verified boolean,
  p_reference text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $rpc$
declare
  v_owner uuid := (select auth.uid());
  v_payment public.patient_payments%rowtype;
  v_reference text := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_reference,''))),'');
begin
  if v_owner is null or not exists(select 1 from public.app_access where user_id=v_owner) then
    raise exception 'Acesso não autorizado' using errcode='42501';
  end if;
  if p_payment_id is null or p_verified is null then
    raise exception 'Solicitação inválida' using errcode='22023';
  end if;
  select * into v_payment from public.patient_payments
    where id=p_payment_id and owner_id=v_owner for update;
  if not found then
    raise exception 'Pagamento não encontrado' using errcode='22023';
  end if;
  if v_payment.method<>'Pix' or v_payment.voided_at is not null then
    raise exception 'Somente Pix ativos podem ser conferidos' using errcode='22023';
  end if;
  if p_verified then
    if v_reference is not null and (
      length(v_reference) not between 3 and 100 or
      v_reference !~ '^[A-Z0-9._:-]+$'
    ) then
      raise exception 'Identificador Pix inválido' using errcode='22023';
    end if;
    if v_payment.pix_verified_at is not null then
      if v_payment.pix_reference is not distinct from v_reference then
        return pg_catalog.jsonb_build_object('payment_id',v_payment.id,'unchanged',true,'verified',true);
      end if;
      raise exception 'Desfaça a conferência atual antes de informar novo identificador' using errcode='22023';
    end if;
    update public.patient_payments
      set pix_verified_at=now(),pix_reference=v_reference
      where id=v_payment.id;
    insert into public.payment_audit(owner_id,payment_id,action,amount_cents)
      values(v_owner,v_payment.id,'pix_verified',v_payment.amount_cents);
  else
    if v_reference is not null then
      raise exception 'Não informe identificador ao desfazer a conferência' using errcode='22023';
    end if;
    if v_payment.pix_verified_at is null then
      return pg_catalog.jsonb_build_object('payment_id',v_payment.id,'unchanged',true,'verified',false);
    end if;
    update public.patient_payments
      set pix_verified_at=null,pix_reference=null
      where id=v_payment.id;
    insert into public.payment_audit(owner_id,payment_id,action,amount_cents)
      values(v_owner,v_payment.id,'pix_verification_removed',v_payment.amount_cents);
  end if;
  return pg_catalog.jsonb_build_object('payment_id',v_payment.id,'unchanged',false,'verified',p_verified);
end
$rpc$;
revoke all on function public.set_pix_verification(uuid,boolean,text) from public,anon;
grant execute on function public.set_pix_verification(uuid,boolean,text) to authenticated;

-- A voided payment must not retain an active Pix verification / reference.
create function public.clear_pix_verification_on_void()
returns trigger language plpgsql security invoker set search_path=''
as $trigger$
begin
  if new.voided_at is not null and old.voided_at is null then
    new.pix_verified_at := null;
    new.pix_reference := null;
  end if;
  return new;
end
$trigger$;
create trigger clear_pix_verification_on_void
before update of voided_at on public.patient_payments
for each row execute function public.clear_pix_verification_on_void();
revoke all on function public.clear_pix_verification_on_void() from public,anon,authenticated;
