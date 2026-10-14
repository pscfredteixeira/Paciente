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
let selectedDate=localToday(),weekStart=startOfWeek(selectedDate),events=[],links=new Map(),rules=new Map();
let loadedWeek=null,loading=false,saving=false,error="",filter="all",requestNumber=0,hasMore=false,editingSession=null;
const listeners=new Set(),notify=()=>{for(const fn of listeners){try{fn();}catch(_){}}};
const safeMessage="Não foi possível carregar a agenda. Tente novamente.";
const client=()=>window.ConsultorioAuth?.dataClient||null;
const connected=()=>window.ConsultorioCalendar?.state.connected===true;
const authorized=()=>window.ConsultorioAuth?.state.phase==="authorized";
const ruleKey=(kind,value)=>kind+":"+value;
const activeRule=e=>{
  const series=e.recurringEventId;
  if(series&&rules.has(ruleKey("series",series)))return {kind:"series",value:series,patientId:rules.get(ruleKey("series",series))};
  const title=e.titleKey;
  if(title&&rules.has(ruleKey("title",title)))return {kind:"title",value:title,patientId:rules.get(ruleKey("title",title))};
  return null;
};
const effectiveLink=e=>links.has(e.id)?{patientId:links.get(e.id),source:"manual"}:(activeRule(e)?{patientId:activeRule(e).patientId,source:"automatic"}:null);
const ruleFor=e=>e.recurringEventId?{kind:"series",value:e.recurringEventId,label:"todas as semanas desta série"}:
 (e.titleKey && String(e.summary||"").trim().length>=10
    && !["consulta","sessão","terapia","sem título","reunião","bloqueado","ocupado"].includes(String(e.summary).trim().toLocaleLowerCase("pt-BR"))
    ?{kind:"title",value:e.titleKey,label:"todos os eventos com o mesmo título"}:null);

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
   const db=client();if(!db)throw Error("Sessão expirada.");
   const {data:ruleRows,error:ruleError}=await db.from("calendar_event_rules").select("match_kind,match_value,patient_id");
   if(ruleError)throw new Error("Não foi possível carregar os vínculos recorrentes.");
   const nextRules=new Map((ruleRows||[]).map(r=>[ruleKey(r.match_kind,r.match_value),r.patient_id]));
   if(seq!==requestNumber||!authorized())return;
   events=found;links=map;rules=nextRules;loadedWeek=selectedWeek;hasMore=false;
   await window.ConsultorioSessions?.loadForEvents(found);
 }catch(e){if(seq===requestNumber){error=e.message||safeMessage;events=[];links=new Map();rules=new Map();loadedWeek=null;}}
 finally{
   if(seq===requestNumber){loading=false;notify();}
   if(authorized()&&connected()&&selectedWeek!==weekStart)Promise.resolve().then(()=>loadWeek());
 }
}
const agenda={
 get state(){return{selectedDate,weekStart,events:[...events],links:new Map(links),rules:new Map(rules),loadedWeek,loading,saving,error,filter,hasMore};},
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 ensure(){if(authorized()&&connected()&&!loading&&loadedWeek!==weekStart&&!error)void loadWeek();},
 async reload(){error="";loadedWeek=null;await loadWeek(true);},
 reset(){++requestNumber;selectedDate=localToday();weekStart=startOfWeek(selectedDate);events=[];links=new Map();rules=new Map();loadedWeek=null;loading=false;saving=false;error="";filter="all";editingSession=null;notify();},
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
     return {ok:true,message:"Paciente vinculado! Para gerar o débito, marque a sessão como realizada em Atendimento e cobrança. O Google Calendar não foi alterado."};
   }catch(_){return {ok:false,message:"Não foi possível salvar o vínculo. Tente novamente."};}
   finally{saving=false;notify();}
 },
 async associateAll(eventId,patientId){
   if(!authorized()||!connected()||loading||saving||loadedWeek!==weekStart)return {ok:false,message:"Atualize a agenda antes de vincular."};
   const event=events.find(e=>e.id===eventId);
   const selector=event?ruleFor(event):null;
   if(!selector)return {ok:false,message:"Este compromisso não tem uma série ou um título específico para vincular em conjunto."};
   const patient=window.ConsultorioPatients?.state.rows.find(p=>p.id===patientId&&p.is_active);
   if(!patient)return {ok:false,message:"Selecione um paciente ativo."};
   const db=client();if(!db)return {ok:false,message:"Sua sessão expirou."};
   saving=true;notify();
   try{
     const key=ruleKey(selector.kind,selector.value),update=rules.has(key);
     const query=update?db.from("calendar_event_rules").update({patient_id:patientId})
       .eq("match_kind",selector.kind).eq("match_value",selector.value)
       :db.from("calendar_event_rules").insert({match_kind:selector.kind,match_value:selector.value,patient_id:patientId});
     const {data,error:dbError}=await query.select("match_kind,match_value").maybeSingle();
     if(dbError||!data?.match_value)throw Error("Falha ao salvar regra de vinculação.");
     rules.set(key,patientId);
     const conflict=links.has(eventId)&&links.get(eventId)!==patientId;
     const message=selector.kind==="series"?
       "Série vinculada! As semanas anteriores e futuras serão reconhecidas. Para gerar débitos, confirme cada sessão realizada na Agenda.":
       "Regra salva! Eventos anteriores e futuros com o mesmo título serão reconhecidos. Para gerar débitos, confirme cada sessão realizada na Agenda.";
     return {ok:true,message:message+(conflict?" Esta sessão tem uma associação individual diferente que continua valendo.":"")};
   }catch(_){return {ok:false,message:"Não foi possível salvar a vinculação automática. Tente novamente."};}
   finally{saving=false;notify();}
 },
 async stopRule(eventId){
   if(!authorized()||!connected()||loading||saving)return {ok:false,message:"Aguarde."};
   const event=events.find(e=>e.id===eventId),selector=event?activeRule(event):null;
   if(!selector)return {ok:false,message:"Este evento não tem vínculo automático."};
   const db=client();if(!db)return {ok:false,message:"Sua sessão expirou."};
   saving=true;notify();
   try{
     const {data,error:dbError}=await db.from("calendar_event_rules").delete()
       .eq("match_kind",selector.kind).eq("match_value",selector.value)
       .select("match_kind,match_value").maybeSingle();
     if(dbError||!data?.match_value)throw Error("Regra não removida");
     rules.delete(ruleKey(selector.kind,selector.value));
     return {ok:true,message:"Vínculo automático interrompido. Vínculos salvos individualmente foram preservados; eventos no Google não mudaram."};
   }catch(_){return {ok:false,message:"Não foi possível interromper a vinculação automática."};}
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
     return {ok:true,message:"Vínculo individual removido. Se existe uma regra automática para esta série ou título, ela continua valendo. O Google Calendar não foi alterado."};
   }catch(_){return {ok:false,message:"Não foi possível remover o vínculo."};}
   finally{saving=false;notify();}
 },
 render({head,I,esc}){
   const provider=window.ConsultorioCalendar?.state||{connected:false,loaded:false,busy:false,error:""};
   let page=head("agenda");
   page+='<div class="notice"><span class="icon">'+I("shield")+'</span><div><strong>Agenda real · Google Calendar</strong><p>1. Vincule o paciente. 2. Depois do atendimento, toque em <strong>Confirmar realizada e cobrar</strong>. Só a confirmação cria o débito, que aparece no Financeiro.</p></div></div>';
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
   const linkedCount=dayItems.filter(e=>!!effectiveLink(e)).length;
   const dayLabel=longDate(selectedDate);
   page+='<div class="real-agenda-summary"><div><h3>'+esc(dayLabel)+'</h3><p>'+dayItems.length+' compromisso'+(dayItems.length===1?'':'s')+' encontrado'+(dayItems.length===1?'':'s')
     +' · '+linkedCount+' vinculado'+(linkedCount===1?'':'s')+' a pacientes</p></div>'
     +'<button class="btn sm" data-action="real-agenda-refresh" '+(saving?'disabled':'')+'>'+I("refresh")+' Atualizar</button></div>';
   page+='<div class="chip-bar real-agenda-filters">'
     +[['all','Todos'],['linked','Vinculados'],['unlinked','Sem vínculo']].map(([value,label])=>
       '<button class="chip '+(filter===value?'active':'')+'" data-agenda-filter="'+value+'">'+label+'</button>').join('')
     +'</div>';
   const visible=dayItems.filter(e=>filter==="all"||(filter==="linked"?!!effectiveLink(e):!effectiveLink(e)));
   if(!visible.length){
     page+='<div class="empty">'+(dayItems.length?'Nenhum compromisso neste filtro.':'Nenhum evento encontrado neste dia do Google Calendar.')+'</div>';
   }
   const patients=window.ConsultorioPatients?.state||{rows:[],loading:false};
   const sessions=window.ConsultorioSessions?.state||{records:new Map(),weekLoading:true,weekError:"",saving:false};
   const available=patients.rows.filter(p=>p.is_active);
   const statusLabel={done:"Sessão realizada",missed_charge:"Falta cobrada",
     missed_nocharge:"Falta sem cobrança",cancelled:"Cancelada",voided:"Registro desfeito"};
   const currency=cents=>(Number(cents||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
   for(const e of visible){
     const matched=effectiveLink(e),associatedId=matched?.patientId,rule=activeRule(e),availableRule=ruleFor(e);
     const patient=patients.rows.find(p=>p.id===associatedId);
     const savedSession=sessions.records.get(e.id);
     const billingPatient=savedSession?patients.rows.find(p=>p.id===savedSession.patient_id):null;
     const canConfirm=!!associatedId&&!!patient&&!sessions.weekLoading&&!sessions.weekError;
     const future=(new Date(e.start?.dateTime||e.start?.date||0)).getTime()>Date.now();
     const googleTitle=esc(e.summary||"Sem título");
     const time=esc(timeLabel(e.start));
     const missingTitle=(e.summary||'').trim()==='Sem título';
     const googleNotice=missingTitle?'<span class="real-agenda-source-note">O Google não enviou um título para este evento nesta conexão.</span>':'';
     const currentLabel=patient?'Vinculado: '+esc(patient.full_name):associatedId?'Vínculo indisponível':'Não vinculado';
     const automaticNote=matched?.source==='automatic'?'<div class="real-agenda-auto-note">Vínculo automático · '+(rule?.kind==='series'?'série recorrente':'mesmo título')+'</div>':'';
     page+='<article class="real-agenda-event"><div class="real-agenda-time">'+time+'</div>'
       +'<div class="real-agenda-details"><h3>'+googleTitle+'</h3><div class="real-agenda-source">'+googleNotice+'</div>'
       +'<div class="real-agenda-linklabel">'+(associatedId?'<span class="status done">'+currentLabel+'</span>':'<span class="status unlinked">Não vinculado</span>')+automaticNote+'</div>'
       +'<div class="real-agenda-linkcontrols"><label>Associar ao paciente'
       +'<select aria-label="Paciente para '+googleTitle+'" '+(saving||patients.loading?'disabled':'')+'>'
       +'<option value="">Selecione um paciente...</option>'
       +available.map(p=>'<option value="'+esc(p.id)+'"'+(associatedId===p.id?' selected':'')+'>'+esc(p.full_name)+'</option>').join('')
       +'</select></label><button class="btn sm" data-action="real-agenda-associate" data-event-id="'+esc(e.id)+'" '+(saving||patients.loading||!available.length?'disabled':'')+'>Só esta sessão</button>'
       +(availableRule?'<button class="btn primary sm" data-action="real-agenda-associate-all" data-event-id="'+esc(e.id)+'" '+(saving||patients.loading||!available.length?'disabled':'')+'>'+(availableRule.kind==='series'?'Vincular todas as semanas':'Vincular mesmo título')+'</button>':'')
       +(links.has(e.id)?'<button class="btn sm" data-action="real-agenda-unlink" data-event-id="'+esc(e.id)+'" '+(saving?'disabled':'')+'>'+(rule?'Remover exceção':'Desvincular esta sessão')+'</button>':'')
       +(rule?'<button class="btn sm" data-action="real-agenda-stop-rule" data-event-id="'+esc(e.id)+'" '+(saving?'disabled':'')+'>Parar vínculo automático</button>':'')
       +'</div>'
       +'<div class="real-session-panel">'
       +(sessions.weekError?'<p role="alert" class="real-agenda-error">'+esc(sessions.weekError)+'</p>':
          sessions.weekLoading?'<p class="real-session-muted">Buscando registros de atendimento...</p>':
          '<div class="real-session-heading"><strong>Atendimento e cobrança</strong>'
          +(savedSession?'<span class="status '+(savedSession.charge_cents>0?'done':'unlinked')+'">'+esc(statusLabel[savedSession.status]||savedSession.status)+'</span>':
            '<span class="status unlinked">Ainda não registrado</span>')+'</div>'
          +(savedSession?'<p class="real-session-muted">Paciente registrado: '+esc(billingPatient?.full_name||"Cadastro não disponível")
            +' · '+(savedSession.charge_cents>0?'Débito: '+currency(savedSession.charge_cents):'Sem débito')
            +' · Honorário da sessão: '+currency(savedSession.fee_snapshot_cents)+'</p>':
            '<p class="real-session-muted">'+(canConfirm?
              'Honorário previsto: '+currency(patient.fee_cents)+'. Esta sessão ainda não gerou cobrança.':
              'Vincule o evento a um paciente antes de registrar o atendimento.')+'</p>')
          +(!savedSession&&canConfirm?
            '<button class="btn primary sm real-session-confirm" data-action="real-session-set" data-event-id="'+esc(e.id)+'" data-session-status="done" '+
            (sessions.saving||future?'disabled':'')+'>Confirmar realizada e cobrar '+currency(patient.fee_cents)+'</button>':'')
          +(savedSession||canConfirm?'<button class="btn sm" data-action="real-session-toggle" data-event-id="'+esc(e.id)+'" '+(sessions.saving?'disabled':'')+'>'+
            (editingSession===e.id?'Fechar opções':savedSession?'Corrigir registro':'Registrar falta / cancelar')+'</button>':'')
          +(savedSession&&savedSession.charge_cents>0?
            '<button class="btn sm" data-view="finance">Ver cobrança no Financeiro</button>':'')
          +(editingSession===e.id&&(savedSession||canConfirm)?
            '<div class="real-session-actions"><p class="real-session-muted">Selecione o que aconteceu. Um registro para cada compromisso, com histórico de correções.</p>'
            +[['done','Realizada'],['missed_charge','Falta cobrada'],['missed_nocharge','Falta sem cobrança'],['cancelled','Cancelada']].map(([key,label])=>
              '<button class="btn '+(key==='done'?'primary':'')+' sm" data-action="real-session-set" data-event-id="'+esc(e.id)+'" data-session-status="'+key+'" '+(sessions.saving||(future&&key!=='cancelled')?'disabled':'')+'>'+label+'</button>').join('')
            +(savedSession?'<button class="btn sm" data-action="real-session-set" data-event-id="'+esc(e.id)+'" data-session-status="voided" '+(sessions.saving?'disabled':'')+'>Desfazer registro</button>':'')
            +(future?'<p class="real-session-muted">Confirmações e faltas só podem ser registradas depois do horário da sessão.</p>':'')
            +'</div>':''))
       +'</div></div></article>';
   }
   if(!available.length){
      page+='<p class="real-agenda-helper">'+(patients.loading?'Carregando lista de pacientes privados...':'Para associar eventos, primeiro cadastre pelo menos um paciente ativo na aba Pacientes.')+'</p>';
   }
   page+='</section><div class="note-panel">'+I("info")+'<span>Os débitos das sessões confirmadas são reais e ficam no Supabase. Apenas vincular um paciente não lança cobrança; o Google Calendar não é alterado.</span></div>';
   return page;
 },
 async click(target,render,toast){
   const act=target.dataset.action||"";
   if(target.dataset.agendaDate){agenda.select(target.dataset.agendaDate);return true;}
   if(target.dataset.agendaFilter){agenda.setFilter(target.dataset.agendaFilter);return true;}
   if(act==="real-session-toggle"){
     editingSession=editingSession===target.dataset.eventId?null:target.dataset.eventId;
     notify();return true;
   }
   if(act==="real-session-set"){
     const event=events.find(e=>e.id===target.dataset.eventId);
     const current=window.ConsultorioSessions?.state.records.get(event?.id);
     const match=event?effectiveLink(event):null;
     const patientId=current?.patient_id||match?.patientId;
     const patient=window.ConsultorioPatients?.state.rows.find(p=>p.id===patientId);
     if(!event||!patientId||!patient){toast("Vincule a sessão a um paciente cadastrado.");return true;}
     const status=target.dataset.sessionStatus;
     const names={done:"realizada",missed_charge:"falta cobrada",missed_nocharge:"falta sem cobrança",
       cancelled:"cancelada",voided:"registro desfeito"};
     if(!names[status])return true;
     const charged=status==="done"||status==="missed_charge";
     const fee=current?.fee_snapshot_cents??patient.fee_cents;
     const amount=(Number(fee)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
     const question=(current?"CORRIGIR o registro desta sessão para ":"REGISTRAR esta sessão como ")+names[status]+
       " para "+patient.full_name+"? "+
       (charged?"Será registrado um débito de "+amount+".":"Esta situação ficará sem débito.")+
       " O Google Calendar não será alterado.";
     if(!window.confirm(question))return true;
     const result=await window.ConsultorioSessions.register(event,patientId,status,!!current);
     if(result.ok){editingSession=null;void window.ConsultorioFinance?.reload();}
     toast(result.message);notify();return true;
   }
   if(!act.startsWith("real-agenda-"))return false;
   if(act==="real-agenda-prev"){agenda.shift(-7);return true;}
   if(act==="real-agenda-next"){agenda.shift(7);return true;}
   if(act==="real-agenda-today"){agenda.today();return true;}
   if(act==="real-agenda-refresh"){await agenda.reload();return true;}
   if(act==="real-agenda-associate"||act==="real-agenda-associate-all"){
     const card=target.closest(".real-agenda-event");
     const patientId=card?.querySelector("select")?.value||"";
     if(!patientId){toast("Selecione um paciente antes de salvar.");return true;}
     if(act==="real-agenda-associate-all"){
       const event=events.find(e=>e.id===target.dataset.eventId);
       const rule=event?ruleFor(event):null;
       const patient=window.ConsultorioPatients?.state.rows.find(p=>p.id===patientId);
       if(!event||!rule||!patient){toast("Selecione um evento e paciente válidos.");return true;}
       const msg=rule.kind==="series"?
         'Vincular TODAS as ocorrências da série "'+event.summary+'" ao paciente '+patient.full_name+'? Isso inclui as anteriores e futuras e não cria cobranças. Vínculos individuais anteriores continuam valendo.':
         'Vincular TODOS os eventos com o título EXATAMENTE igual a "'+event.summary+'" ao paciente '+patient.full_name+'? Isso inclui agendamentos anteriores e futuros, mesmo se não forem uma série. Confira se o título identifica sempre a mesma pessoa. Nenhuma cobrança será criada.';
       if(!window.confirm(msg))return true;
       const result=await agenda.associateAll(event.id,patientId);toast(result.message);return true;
     }
     const outcome=await agenda.associate(target.dataset.eventId,patientId);
     toast(outcome.message);return true;
   }
   if(act==="real-agenda-stop-rule"){
     if(!window.confirm("Parar a associação automática para esta série ou título? Os vínculos individuais já salvos permanecerão."))return true;
     const outcome=await agenda.stopRule(target.dataset.eventId);toast(outcome.message);return true;
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