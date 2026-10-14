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
  const fields = "id,full_name,fee_cents,cadence,birth_date,cpf,email,is_active,created_at,updated_at";
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
      const birth_date = String(record.birth_date || "").trim() || null;
      const cpf = String(record.cpf || "").replace(/\D/g, "") || null;
      const email = String(record.email || "").trim().toLocaleLowerCase("pt-BR") || null;
      if (full_name.length < 2 || full_name.length > 120 || !Number.isSafeInteger(fee_cents)
        || fee_cents < 0 || fee_cents > 99999999 || !["Semanal", "Quinzenal", "Mensal", "Avulsa"].includes(cadence)) {
        return { ok: false, message: "Confira nome, frequência e valor antes de salvar." };
      }
      // Sensitive optional contact fields are sent only to authenticated Supabase.
      if (birth_date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
          return { ok: false, message: "Confira a data de nascimento." };
        }
        const day = new Date(birth_date + "T12:00:00Z");
        const now = new Date();
        const format = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
        const parts = Object.fromEntries(format.formatToParts(now).map(({type,value})=>[type,value]));
        const today = parts.year + "-" + parts.month + "-" + parts.day;
        if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== birth_date
          || birth_date < "1900-01-01" || birth_date > today) {
          return { ok: false, message: "A data de nascimento deve ser válida e não pode estar no futuro." };
        }
      }
      if (cpf) {
        if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
          return { ok: false, message: "CPF inválido. Confira os 11 dígitos." };
        }
        const digit = (base) => {
          let sum = 0;
          for (let i = 0; i < base; i++) sum += Number(cpf[i]) * (base + 1 - i);
          const check = (sum * 10) % 11;
          return check === 10 ? 0 : check;
        };
        if (digit(9) !== Number(cpf[9]) || digit(10) !== Number(cpf[10])) {
          return { ok: false, message: "CPF inválido. Confira os dígitos verificadores." };
        }
      }
      if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@.]+$/.test(email))) {
        return { ok: false, message: "Informe um e-mail válido ou deixe o campo vazio." };
      }
      const payload = { full_name, fee_cents, cadence, birth_date, cpf, email };
      busy = true; error = ""; signal();
      try {
        let query = id
          ? client.from("patients").update(payload).eq("id", id)
          : client.from("patients").insert(payload);
        const { data, error: dbError } = await query.select("id").maybeSingle();
        if (dbError || !data?.id) throw dbError || new Error("Registro não disponível.");
        return { ok: true, id: data.id };
      } catch (failure) {
        if (failure?.code === "23505" && cpf) return { ok: false, message: "Este CPF já está cadastrado em outro paciente." };
        if (failure?.code === "23514") return { ok: false, message: "Confira a data de nascimento, o CPF e o e-mail." };
        return { ok: false, message: safeError() };
      }
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
