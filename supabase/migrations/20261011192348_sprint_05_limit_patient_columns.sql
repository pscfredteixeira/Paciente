-- Migração executada no Supabase como sprint_05_limit_patient_columns
-- Retirar edição de owner_id, created_at e updated_at pelo navegador.
revoke insert, update on table public.patients from authenticated;
grant insert (full_name, fee_cents, cadence) on table public.patients to authenticated;
grant update (full_name, fee_cents, cadence, is_active) on table public.patients to authenticated;
