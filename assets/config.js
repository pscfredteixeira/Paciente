/* Meu Consultório — configuração pública do frontend.
   A URL e a publishable key são públicas por definição.
   Nunca adicionar senha, service_role, secret key ou dados de pacientes.
   A autorização real dos dados depende das políticas RLS no banco. */
window.MEU_CONSULTORIO_CONFIG = Object.freeze({
  mode: "private",
  supabaseUrl: "https://tcwbzfsmkhuekvxrbigf.supabase.co",
  supabasePublishableKey: "sb_publishable_oiMRhiFJk9gulUGDP1IIow_mod9TALs"
});
