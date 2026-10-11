/* Sprint 5 — cadastro privado de pacientes.
 * Somente registros do banco protegido. Nunca cachear dados administrativos
 * em localStorage, no repositório, em URLs ou em telemetria pública. */
(() => {
  "use strict";
  const listeners = new Set();
  let rows = [];
  let loading = false;
  let busy = false;
  let initialized = false;
  let error = "";
  let revision = 0;
  const signal = () => { for (const callback of listeners) { try { callback(); } catch (_) {} } };
  const authClient = () => window.ConsultorioAuth?.dataClient || null;
  const safeError = () => "Não foi possível concluir a operação. Confira sua conexão e tente novamente.";
  const fields = "id,full_name,fee_cents,cadence,is_active,created_at,updated_at";
  const store = {
    get state() { return { rows: rows.slice(), loading, busy, initialized, error }; },
    subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    clear() {
      revision++;
      rows = []; loading = false; busy = false; initialized = false; error = "";
      signal();
    },
    async load(force = false) {
      const client = authClient();
      if (!client || loading || busy || (initialized && !force)) return;
      const request = ++revision;
      loading = true; error = ""; signal();
      try {
        const { data, error: dbError } = await client.from("patients")
          .select(fields).order("full_name", { ascending: true });
        if (request !== revision || !authClient()) return;
        if (dbError) throw dbError;
        rows = Array.isArray(data) ? data : [];
        initialized = true;
      } catch (_) {
        if (request === revision) error = safeError();
      } finally {
        if (request === revision) { loading = false; signal(); }
      }
    },
    async save(record, id = null) {
      const client = authClient();
      if (!client || busy || loading) return { ok: false, message: "Aguarde a verificação da sua sessão." };
      const full_name = String(record.full_name || "").trim().replace(/\s+/g, " ");
      const fee_cents = Number(record.fee_cents);
      const cadence = String(record.cadence || "");
      if (full_name.length < 2 || full_name.length > 120 || !Number.isSafeInteger(fee_cents)
        || fee_cents < 0 || fee_cents > 99999999 || !["Semanal", "Quinzenal", "Mensal", "Avulsa"].includes(cadence)) {
        return { ok: false, message: "Confira nome, frequência e valor antes de salvar." };
      }
      const payload = { full_name, fee_cents, cadence };
      busy = true; error = ""; signal();
      try {
        let query = id
          ? client.from("patients").update(payload).eq("id", id)
          : client.from("patients").insert(payload);
        const { data, error: dbError } = await query.select("id").maybeSingle();
        if (dbError || !data?.id) throw dbError || new Error("Registro não disponível.");
        return { ok: true, id: data.id };
      } catch (_) { return { ok: false, message: safeError() }; }
      finally {
        busy = false;
        initialized = false;
        signal();
        await store.load();
      }
    },
    async setActive(id, active) {
      const client = authClient();
      if (!client || busy || loading) return { ok: false, message: "Aguarde a verificação da sua sessão." };
      if (!rows.some(p => p.id === id)) return { ok: false, message: "Cadastro não encontrado." };
      busy = true; signal();
      try {
        const { data, error: dbError } = await client.from("patients")
          .update({ is_active: !!active }).eq("id", id).select("id").maybeSingle();
        if (dbError || !data?.id) throw dbError || new Error("Registro não disponível.");
        return { ok: true };
      } catch (_) { return { ok: false, message: safeError() }; }
      finally {
        busy = false; initialized = false; signal();
        await store.load();
      }
    }
  };
  window.ConsultorioPatients = store;
})();
