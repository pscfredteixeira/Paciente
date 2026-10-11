/* Sprint 6: OAuth Google Calendar, somente leitura. Nenhum token Google no navegador. */
(()=>{
"use strict";
const endpoint="https://tcwbzfsmkhuekvxrbigf.supabase.co/functions/v1/google-calendar-callback";
let connected=false,loaded=false,busy=false,error="",events=[];
const subs=new Set();
const notify=()=>{for(const fn of subs){try{fn()}catch(_){}}};
const api=async(action,method="GET",params={})=>{
  const auth=window.ConsultorioAuth;
  if(auth?.state.phase!=="authorized"||!auth.dataClient)throw Error("Faça login novamente.");
  const {data}=await auth.dataClient.auth.getSession();
  const token=data.session?.access_token;
  if(!token)throw Error("Sessão expirada.");
  const url=new URL(endpoint);url.searchParams.set("action",action);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,String(value));
  const response=await fetch(url,{method,headers:{"Authorization":"Bearer "+token,"apikey":window.MEU_CONSULTORIO_CONFIG.supabasePublishableKey}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(body.error||"Falha de comunicação.");
  return body;
};
window.ConsultorioCalendar={
  get state(){return {connected,loaded,busy,error,events:[...events]};},
  subscribe(fn){subs.add(fn);return()=>subs.delete(fn)},
  clear(){connected=false;loaded=false;busy=false;error="";events=[];notify()},
  async status(){if(busy)return;busy=true;error="";notify();try{const r=await api("status");connected=!!r.connected;loaded=true;}catch(e){error=e.message||"Falha de conexão";}finally{busy=false;notify();}},
  async connect(){if(busy)return;busy=true;error="";notify();try{const r=await api("start","POST");if(!r.url||!r.url.startsWith("https://accounts.google.com/"))throw Error("Link inválido.");window.location.assign(r.url);}catch(e){error=e.message||"Não foi possível conectar.";busy=false;notify();}},
  async disconnect(){if(busy)return;busy=true;error="";notify();try{await api("disconnect","POST");connected=false;events=[];}catch(e){error=e.message||"Falha ao desconectar";}finally{busy=false;notify();}},
  async load(){if(busy||!connected)return;busy=true;error="";notify();try{
    const now=new Date(),start=new Date(now.getTime()-86400000),end=new Date(now.getTime()+14*86400000);
    const r=await api("events","GET",{timeMin:start.toISOString(),timeMax:end.toISOString()});
    events=r.events||[];
  }catch(e){error=e.message||"Não foi possível buscar eventos";}finally{busy=false;notify();}}
};
})();
