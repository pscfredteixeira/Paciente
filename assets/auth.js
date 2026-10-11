/* Sprint 4 — login opcional: autenticação Supabase com checagem de autorização no banco.
   A UI é pública; somente RLS no backend protege os dados reais. */
(() => {
  "use strict";
  const config = window.MEU_CONSULTORIO_CONFIG || {};
  const enabled = config.mode === "private";
  const listeners = new Set();
  let phase = enabled ? "loading" : "demo";
  let message = "";
  let client = null;
  let refreshNumber = 0;
  function notify() { for (const fn of listeners) { try { fn(); } catch (_) {} } }
  function setPhase(next, detail = "") { phase = next; message = detail; notify(); }
  function validConfig() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.supabaseUrl || "")
      && typeof config.supabasePublishableKey === "string"
      && config.supabasePublishableKey.length > 15;
  }
  const auth = {
    enabled,
    get state() { return { phase, message }; },
    get dataClient() { return enabled && phase === 'authorized' ? client : null; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async initialize() {
      if (!enabled) return;
      if (!validConfig()) {
        setPhase("error", "O login ainda não foi configurado. Consulte o Sprint 4 no repositório.");
        return;
      }
      try {
        const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm");
        client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        client.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_OUT") {
            refreshNumber++;
            setPhase("signed-out");
          } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
            Promise.resolve().then(() => auth.refresh());
          }
        });
        await this.refresh();
      } catch (_) {
        setPhase("error", "Não foi possível iniciar o serviço de autenticação. Verifique a conexão.");
      }
    },
    async refresh() {
      if (!client) return;
      const iteration = ++refreshNumber;
      try {
        const { data: result, error: whoError } = await client.auth.getUser();
        if (iteration !== refreshNumber) return;
        if (whoError || !result?.user) { setPhase("signed-out"); return; }
        const user = result.user;
        const { data, error } = await client.from("app_access")
          .select("user_id").eq("user_id", user.id).maybeSingle();
        if (iteration !== refreshNumber) return;
        if (error) { setPhase("error", "Não foi possível conferir a autorização no banco. O acesso permanece bloqueado."); return; }
        if (data?.user_id === user.id) setPhase("authorized");
        else {
          setPhase("unauthorized", "Esta conta não está autorizada a acessar o consultório.");
          // Uma conta autenticada no provedor não ganha acesso sem registro no app_access.
        }
      } catch (_) {
        if (iteration === refreshNumber) setPhase("error", "Falha ao verificar a autorização. Acesso bloqueado.");
      }
    },
    async login(email, password) {
      if (!client || !enabled) return;
      setPhase("loading");
      try {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) { setPhase("signed-out", "Não foi possível entrar. Confira os dados da conta."); return; }
        await auth.refresh();
      } catch (_) { setPhase("signed-out", "Não foi possível conectar. Tente novamente."); }
    },
    async signOut() {
      refreshNumber++;
      try { if (client) await client.auth.signOut(); } catch (_) {}
      setPhase("signed-out");
    }
  };
  window.ConsultorioAuth = auth;
})();
