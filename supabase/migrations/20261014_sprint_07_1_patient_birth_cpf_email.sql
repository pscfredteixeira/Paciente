-- Sprint 7.1 - optional administrative patient contact details.
-- Existing rows stay intact with NULL birth_date, cpf and email.
create or replace function public.patient_cpf_is_valid(p_cpf text)
returns boolean language plpgsql immutable strict security invoker
set search_path = ''
as $$
declare
  i integer;
  total integer;
  digit integer;
begin
  if p_cpf !~ '^[0-9]{11}$' or p_cpf ~ '^([0-9])\1{10}$' then
    return false;
  end if;
  total := 0;
  for i in 1..9 loop
    total := total + pg_catalog.substr(p_cpf,i,1)::integer * (11-i);
  end loop;
  digit := (total * 10) % 11;
  if digit = 10 then digit := 0; end if;
  if digit <> pg_catalog.substr(p_cpf,10,1)::integer then return false; end if;
  total := 0;
  for i in 1..10 loop
    total := total + pg_catalog.substr(p_cpf,i,1)::integer * (12-i);
  end loop;
  digit := (total * 10) % 11;
  if digit = 10 then digit := 0; end if;
  return digit = pg_catalog.substr(p_cpf,11,1)::integer;
end;
$$;
revoke all on function public.patient_cpf_is_valid(text) from public,anon;
grant execute on function public.patient_cpf_is_valid(text) to authenticated;

alter table public.patients
  add column birth_date date,
  add column cpf text,
  add column email text;

alter table public.patients add constraint patients_birth_date_realistic
  check (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= current_date));
alter table public.patients add constraint patients_cpf_checkdigits
  check (cpf is null or public.patient_cpf_is_valid(cpf));
alter table public.patients add constraint patients_email_format
  check (email is null or (length(email) between 3 and 254
    and email = pg_catalog.btrim(email)
    and email !~ '[[:space:]]'
    and email ~ '^[^@]+@[^@]+[.][^@.]+$'));

create unique index patients_owner_cpf_unique
  on public.patients(owner_id,cpf) where cpf is not null;

-- Explicit column-level grants preserve previously restricted columns.
grant select (birth_date,cpf,email) on public.patients to authenticated;
grant insert (birth_date,cpf,email) on public.patients to authenticated;
grant update (birth_date,cpf,email) on public.patients to authenticated;

-- The existing private RLS policies for patients remain unchanged.
