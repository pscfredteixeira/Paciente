/* Sprint 6.2 — Agenda real (somente leitura no Google) e vínculos privados.
   Os títulos dos eventos existem apenas em memória após login: NUNCA colocar no GitHub. */
(()=>{
"use strict";
const zone="America/Sao_Paulo";
const days=["dom.","seg.","ter.","qua.","qui.","sex.","sáb."];
const fmtISO=d=>d.toISOString().slice(0,10);
const addDays=(date,n)=>{const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return fmtISO(d);};
const dayOfWeek=date=>new Date(date+"T12:00:00Z").getUTCDay();
const startOfWeek=date=>addDays(date,-((dayOfWeek(date)+6)%7));
const localToday=()=>{
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return p.year+"-"+p.month+"-"+p.day;
};
const localDate=start=>{
  if(start?.date)return start.date;
  if(!start?.dateTime)return "";
  const t=new Date(start.dateTime);
  if(!Number.isFinite(t.getTime()))return "";
  const p=new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(t);
  const vals=Object.fromEntries(p.map(x=>[x.type,x.value]));
  return vals.year+"-"+vals.month+"-"+vals.day;
};
const timeLabel=start=>{
 if(start?.date)return "Dia inteiro";
 if(!start?.dateTime)return "Horário indisponível";
 const d=new Date(start.dateTime);
 return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:zone}).format(d):"Horário indisponível";
};
const longDate=d=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"full",timeZone:"UTC"}).format(new Date(d+"T12:00:00Z"));
let selectedDate=localToday(),weekStart=startOfWeek(selectedDate),events=[],links=new Map();
let loadedWeek=null,loading=false,saving=false,error="",filter="all",requestNumber=0,hasMore=false;
const listeners=new Set(),notify=()=>{for(const fn of listeners){try{fn();}catch(_){}}};
const safeMessage="Não foi possível carregar a agenda. Tente novamente.";
const client=()=>window.ConsultorioAuth?.dataClient||null;
const connected=()=>window.ConsultorioCalendar?.state.connected===true;
const authorized=()=>window.ConsultorioAuth?.state.phase==="authorized";
async function loadWeek(force=false){
 if(!authorized()||!connected()||loading||saving||(!force&&loadedWeek===weekStart))return;
 const selectedWeek=weekStart,seq=++requestNumber;
 loading=true;error="";notify();
 try{
   // São Paulo has UTC-03:00 year round; ISO endpoints use the practice timezone.
   const from=selectedWeek+"T00:00:00-03:00",through=addDays(selectedWeek,7)+"T00:00:00-03:00";
   const result=await window.ConsultorioCalendar.fetchRange(from,through);
   if(!authorized()||seq!==requestNumber)return;
   if(result.hasMore)throw Error("Há mais eventos do que o limite da consulta. Não podemos mostrar uma agenda incompleta.");
   const found=result.events.filter(e=>typeof e.id==="string"&&e.id.length>0&&e.id.length<=1024);
   const ids=[...new Set(found.map(e=>e.id))];
   const map=new Map();
   if(ids.length){
     const db=client();if(!db)throw Error("Sessão expirada.");
     for(let i=0;i<ids.length;i+=40){
       const {data,error:dbError}=await db.from("calendar_event_links")
         .select("google_event_id,patient_id").in("google_event_id",ids.slice(i,i+40));
       if(dbError)throw new Error("Não foi possível carregar os vínculos. Tente novamente.");
       for(const row of data||[])map.set(row.google_event_id,row.patient_id);
     }
   }
   if(seq!==requestNumber||!authorized())return;
   events=found;links=map;loadedWeek=selectedWeek;hasMore=false;
 }catch(e){if(seq===requestNumber){error=e.message||safeMessage;events=[];links=new Map();loadedWeek=null;}}
 finally{
   if(seq===requestNumber){loading=false;notify();}
   if(authorized()&&connected()&&selectedWeek!==weekStart)Promise.resolve().then(()=>loadWeek());
 }
}
const agenda={
 get state(){return{selectedDate,weekStart,events:[...events],links:new Map(links),loadedWeek,loading,saving,error,filter,hasMore};},
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 ensure(){if(authorized()&&connected()&&!loading&&loadedWeek!==weekStart&&!error)void loadWeek();},
 async reload(){error="";loadedWeek=null;await loadWeek(true);},
 reset(){++requestNumber;selectedDate=localToday();weekStart=startOfWeek(selectedDate);events=[];links=new Map();loadedWeek=null;loading=false;saving=false;error="";filter="all";notify();},
 select(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;const d=new Date(date+"T12:00:00Z");if(!Number.isFinite(d.getTime())||fmtISO(d)!==date)return;selectedDate=date;weekStart=startOfWeek(date);error="";notify();agenda.ensure();},
 shift(days){agenda.select(addDays(selectedDate,days));},
 today(){agenda.select(localToday());},
 setFilter(next){if(["all","linked","unlinked"].includes(next)){filter=next;notify();}},
 async associate(eventId,patientId){
   if(!authorized()||!connected()||loading||saving)return {ok:false,message:"Aguarde o carregamento da agenda."};
   if(!events.some(e=>e.id===eventId)||loadedWeek!==weekStart)return {ok:false,message:"Atualize a agenda antes de vincular."};
   const patient=window.ConsultorioPatients?.state.rows.find(p=>p.id===patientId&&p.is_active);
   if(!patient)return {ok:false,message:"Selecione um paciente ativo."};
   const db=client();if(!db)return {ok:false,message:"Sua sessão expirou."};
   saving=true;notify();
   try{
     const update=links.has(eventId);
     const query=update?db.from("calendar_event_links").update({patient_id:patientId}).eq("google_event_id",eventId)
       :db.from("calendar_event_links").insert({google_event_id:eventId,patient_id:patientId});
     const {data,error:dbError}=await query.select("google_event_id").maybeSingle();
     if(dbError||!data?.google_event_id)throw new Error("Não foi possível salvar o vínculo.");
     links.set(eventId,patientId);
     return {ok:true,message:"Vínculo salvo no Supabase. O Google Calendar não foi alterado."};
   }catch(_){return {ok:false,message:"Não foi possível salvar o vínculo. Tente novamente."};}
   finally{saving=false;notify();}
 },
 async unlink(eventId){
   if(!authorized()||!connected()||loading||saving)return {ok:false,message:"Aguarde."};
   if(!links.has(eventId))return {ok:false,message:"Evento não vinculado."};
   const db=client();if(!db)return {ok:false,message:"Sua sessão expirou."};
   saving=true;notify();
   try{
     const {data,error:dbError}=await db.from("calendar_event_links").delete()
       .eq("google_event_id",eventId).select("google_event_id").maybeSingle();
     if(dbError||!data?.google_event_id)throw new Error("Vínculo não removido.");
     links.delete(eventId);
     return {ok:true,message:"Vínculo removido. O evento continua no Google Calendar."};
   }catch(_){return {ok:false,message:"Não foi possível remover o vínculo."};}
   finally{saving=false;notify();}
 },
 render({head,I,esc}){
   const provider=window.ConsultorioCalendar?.state||{connected:false,loaded:false,busy:false,error:""};
   let page=head("agenda");
   page+='<div class="notice"><span class="icon">'+I("shield")+'</span><div><strong>Agenda real · Google Calendar</strong><p>Os horários são consultados diretamente do Google, em modo somente leitura. Vincular um paciente não confirma a sessão nem gera cobrança.</p></div></div>';
   if(!provider.loaded){
     return page+'<section class="card hcard"><div class="empty">Verificando sua conexão com o Google Calendar...</div></section>';
   }
   if(!provider.connected){
     return page+'<section class="card hcard"><div class="card-head"><h2>Conecte sua agenda</h2></div><p>Abra Ajustes para autorizar a leitura do Google Calendar.</p>'
       +(provider.error?'<p class="real-agenda-error">'+esc(provider.error)+'</p>':'')
       +'<button class="btn primary" data-view="settings">'+I("calendar")+' Ir para Ajustes</button></section>';
   }
   const nextWeek=addDays(weekStart,6);
   page+='<section class="card hcard real-agenda-wrap">'
     +'<div class="real-agenda-head"><div><p class="eyebrow">SEMANA SELECIONADA</p><h2>'+esc(longDate(weekStart))+' — '+esc(longDate(nextWeek))+'</h2></div>'
     +'<div class="real-agenda-actions"><button class="btn sm" data-action="real-agenda-prev" aria-label="Semana anterior">'+I("chev")+' Anterior</button>'
     +'<button class="btn sm" data-action="real-agenda-today">Hoje</button>'
     +'<button class="btn sm" data-action="real-agenda-next">Próxima '+I("arrow")+'</button></div></div>'
     +'<div class="real-agenda-week" role="group" aria-label="Escolher dia da semana">';
   for(let i=0;i<7;i++){
     const date=addDays(weekStart,i),dayNumber=Number(date.slice(-2)),dayLabel=days[dayOfWeek(date)];
     const dot=loadedWeek===weekStart&&events.some(e=>localDate(e.start)===date);
     page+='<button class="real-agenda-day'+(selectedDate===date?' is-selected':'')+(date===localToday()?' is-today':'')+'" data-agenda-date="'+date+'" aria-pressed="'+(selectedDate===date?'true':'false')+'"><span>'+esc(dayLabel)+'</span><strong>'+dayNumber+'</strong>'+(dot?'<small class="agenda-day-dot">●</small>':'<small>&nbsp;</small>')+'</button>';
   }
   page+='</div>';
   if(loading||loadedWeek!==weekStart&&!error){
     return page+'<div class="real-agenda-loading" role="status">Consultando o Google Calendar e os vínculos privados...</div></section>';
   }
   if(error){
     return page+'<div class="notice orange" role="alert">'+I("info")+'<div>'+esc(error)+'</div></div>'
       +'<button class="btn primary" data-action="real-agenda-refresh">Tentar novamente</button></section>';
   }
   const dayItems=events.filter(e=>localDate(e.start)===selectedDate);
   const linkedCount=dayItems.filter(e=>links.has(e.id)).length;
   const dayLabel=longDate(selectedDate);
   page+='<div class="real-agenda-summary"><div><h3>'+esc(dayLabel)+'</h3><p>'+dayItems.length+' compromisso'+(dayItems.length===1?'':'s')+' encontrado'+(dayItems.length===1?'':'s')
     +' · '+linkedCount+' vinculado'+(linkedCount===1?'':'s')+' a pacientes</p></div>'
     +'<button class="btn sm" data-action="real-agenda-refresh" '+(saving?'disabled':'')+'>'+I("refresh")+' Atualizar</button></div>';
   page+='<div class="chip-bar real-agenda-filters">'
     +[['all','Todos'],['linked','Vinculados'],['unlinked','Sem vínculo']].map(([value,label])=>
       '<button class="chip '+(filter===value?'active':'')+'" data-agenda-filter="'+value+'">'+label+'</button>').join('')
     +'</div>';
   const visible=dayItems.filter(e=>filter==="all"||(filter==="linked"?links.has(e.id):!links.has(e.id)));
   if(!visible.length){
     page+='<div class="empty">'+(dayItems.length?'Nenhum compromisso neste filtro.':'Nenhum evento encontrado neste dia do Google Calendar.')+'</div>';
   }
   const patients=window.ConsultorioPatients?.state||{rows:[],loading:false};
   const available=patients.rows.filter(p=>p.is_active);
   for(const e of visible){
     const associatedId=links.get(e.id);
     const patient=patients.rows.find(p=>p.id===associatedId);
     const googleTitle=esc(e.summary||"Sem título");
     const time=esc(timeLabel(e.start));
     const missingTitle=(e.summary||'').trim()==='Sem título';
     const googleNotice=missingTitle?'<span class="real-agenda-source-note">O Google não enviou um título para este evento nesta conexão.</span>':'';
     const currentLabel=patient?'Vinculado: '+esc(patient.full_name):associatedId?'Vínculo indisponível':'Não vinculado';
     page+='<article class="real-agenda-event"><div class="real-agenda-time">'+time+'</div>'
       +'<div class="real-agenda-details"><h3>'+googleTitle+'</h3><div class="real-agenda-source">'+googleNotice+'</div>'
       +'<div class="real-agenda-linklabel">'+(associatedId?'<span class="status done">'+currentLabel+'</span>':'<span class="status unlinked">Não vinculado</span>')+'</div>'
       +'<div class="real-agenda-linkcontrols"><label>Associar ao paciente'
       +'<select aria-label="Paciente para '+googleTitle+'" '+(saving||patients.loading?'disabled':'')+'>'
       +'<option value="">Selecione um paciente...</option>'
       +available.map(p=>'<option value="'+esc(p.id)+'"'+(associatedId===p.id?' selected':'')+'>'+esc(p.full_name)+'</option>').join('')
       +'</select></label><button class="btn primary sm" data-action="real-agenda-associate" data-event-id="'+esc(e.id)+'" '+(saving||patients.loading||!available.length?'disabled':'')+'>Salvar vínculo</button>'
       +(associatedId?'<button class="btn sm" data-action="real-agenda-unlink" data-event-id="'+esc(e.id)+'" '+(saving?'disabled':'')+'>Desvincular</button>':'')
       +'</div></div></article>';
   }
   if(!available.length){
      page+='<p class="real-agenda-helper">'+(patients.loading?'Carregando lista de pacientes privados...':'Para associar eventos, primeiro cadastre pelo menos um paciente ativo na aba Pacientes.')+'</p>';
   }
   page+='</section><div class="note-panel">'+I("info")+'<span>Agenda em leitura; dados financeiros desta aplicação ainda são demonstrativos. Nenhuma confirmação de sessão ou débito real é realizada aqui.</span></div>';
   return page;
 },
 async click(target,render,toast){
   const act=target.dataset.action||"";
   if(target.dataset.agendaDate){agenda.select(target.dataset.agendaDate);return true;}
   if(target.dataset.agendaFilter){agenda.setFilter(target.dataset.agendaFilter);return true;}
   if(!act.startsWith("real-agenda-"))return false;
   if(act==="real-agenda-prev"){agenda.shift(-7);return true;}
   if(act==="real-agenda-next"){agenda.shift(7);return true;}
   if(act==="real-agenda-today"){agenda.today();return true;}
   if(act==="real-agenda-refresh"){await agenda.reload();return true;}
   if(act==="real-agenda-associate"){
     const card=target.closest(".real-agenda-event");
     const patientId=card?.querySelector("select")?.value||"";
     const outcome=await agenda.associate(target.dataset.eventId,patientId);
     toast(outcome.message);return true;
   }
   if(act==="real-agenda-unlink"){
     if(!window.confirm("Desvincular o paciente deste evento? O Google Calendar não será alterado."))return true;
     const outcome=await agenda.unlink(target.dataset.eventId);
     toast(outcome.message);return true;
   }
   return true;
 }
};
window.ConsultorioRealAgenda=agenda;
})();