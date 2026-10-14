/* Sessões fora do Google Calendar, usando a MESMA RPC transacional de sessões.
   Só dados em memória no navegador; os registros financeiros ficam no Supabase. */
(()=>{
"use strict";
const listeners=new Set();
const inform=()=>{for(const fn of listeners){try{fn();}catch(_){}}};
const auth=()=>window.ConsultorioAuth?.state.phase==="authorized";
const patients=()=>window.ConsultorioPatients?.state.rows||[];
const statusLabels={
 done:"Realizada (gera cobrança)",missed_charge:"Falta cobrada (gera cobrança)",
 missed_nocharge:"Falta sem cobrança",cancelled:"Cancelada (sem cobrança)",voided:"Desfazer registro (sem cobrança)"
};
const canCharge=status=>status==="done"||status==="missed_charge";
const currency=c=>(Number(c||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const formatDate=timestamp=>{
 const d=new Date(timestamp);
 if(!Number.isFinite(d.getTime()))return{date:"",time:""};
 const fields=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
  timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",hourCycle:"h23"
 }).formatToParts(d).map(({type,value})=>[type,value]));
 return{date:fields.year+"-"+fields.month+"-"+fields.day,time:fields.hour+":"+fields.minute};
};
const today=()=>formatDate(new Date()).date;
const isManual=eventId=>/^manual:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(eventId||""));
let form=null,busy=false;
const capture=()=>{
 if(!form)return;
 const el=document.getElementById("real-manual-form");
 if(!el||el.dataset.manualKey!==form.key)return;
 const val=id=>el.querySelector("#"+id)?.value??"";
 if(form.mode==="new"){
  form.patientId=val("real-manual-patient");
  form.date=val("real-manual-date");
  form.time=val("real-manual-time");
 }
 form.status=val("real-manual-status");
};
const store={
 get state(){return{open:!!form,busy,mode:form?.mode||null};},
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 reset(){form=null;busy=false;inform();},
 begin(patientId=null){
  if(!auth()||busy)return;
  const id=patientId&&patients().some(p=>p.id===patientId&&p.is_active)?patientId:"";
  form={key:"manual:"+crypto.randomUUID(),mode:"new",patientId:id,date:today(),time:"",
   status:"done",fee:null};
  inform();
 },
 correct(entry){
  if(!auth()||busy||!isManual(entry?.google_event_id))return;
  const stamp=formatDate(entry.scheduled_at);
  form={key:entry.google_event_id,mode:"correct",patientId:entry.patient_id,
   date:stamp.date,time:stamp.time,status:entry.status,fee:entry.fee_snapshot_cents};
  inform();
 },
 cancel(){if(busy)return;form=null;inform();},
 capture,
 render({esc}){
  if(!auth()||!form)return"";
  capture();
  const editing=form.mode==="correct";
  const patient=patients().find(p=>p.id===form.patientId);
  const fee=editing?form.fee:patient?.fee_cents;
  const charged=canCharge(form.status);
  const displayedFee=fee===undefined||fee===null?
    "Selecione um paciente para consultar o honorário.":charged?
    "Será lançado um débito de "+currency(fee)+".":"Esta situação não gera débito.";
  const list=editing?
    [[form.patientId,patient?.full_name||"Paciente cadastrado"]]:
    patients().filter(p=>p.is_active).map(p=>[p.id,p.full_name]);
  return '<section class="card hcard real-manual-section">'
   +'<div class="card-head"><div><h2>'+(editing?"Corrigir sessão manual":"Registrar sessão fora do calendário")+'</h2>'
   +'<p class="real-session-muted">'+(editing?
     "Você pode corrigir a situação desta sessão sem alterar a data, o paciente ou o honorário congelado. Cada correção é auditada.":
     "Registre atendimentos realizados ou faltas sem criar eventos no Google Calendar. O débito só será lançado após sua confirmação.")+'</p>'
   +'</div><span class="status unlinked">Manual · Supabase</span></div>'
   +'<form id="real-manual-form" data-manual-key="'+esc(form.key)+'" autocomplete="off" class="patient-form-grid">'
   +'<label class="field patient-wide">Paciente<select id="real-manual-patient" required'+(editing?' disabled':'')+'>'
   +(editing?'':'<option value="">Selecione um paciente</option>')
   +list.map(([id,name])=>'<option value="'+esc(id)+'"'+(id===form.patientId?' selected':'')+'>'+esc(name)+'</option>').join('')
   +'</select></label>'
   +'<label class="field">Data do atendimento<input type="date" id="real-manual-date" required'
   +' min="2020-01-01" max="'+today()+'" value="'+esc(form.date)+'"'+(editing?' disabled':'')+'></label>'
   +'<label class="field">Horário (São Paulo)<input type="time" id="real-manual-time" required'
   +' value="'+esc(form.time)+'"'+(editing?' disabled':'')+'></label>'
   +'<label class="field patient-wide">Situação da sessão<select id="real-manual-status" required>'
   +Object.entries(statusLabels).filter(([code])=>editing||code!=="voided").map(([code,label])=>
     '<option value="'+code+'"'+(form.status===code?' selected':'')+'>'+label+'</option>').join('')+'</select></label>'
   +'<div class="patient-wide real-manual-amount" role="status">'+esc(displayedFee)+'</div>'
   +'<p class="real-session-muted patient-wide">'+(editing?
     "Se precisar trocar paciente ou data, desfaça este registro e cadastre outra sessão com os dados corretos.":
     "O honorário utilizado é o valor atual do cadastro do paciente, congelado neste atendimento. Não gera pagamento recebido; cria débito somente quando a situação é cobrada.")+'</p>'
   +'<div class="patient-form-actions patient-wide"><button type="button" class="btn" data-action="real-manual-cancel"'+(busy?' disabled':'')+'>Cancelar</button>'
   +'<button type="submit" class="btn primary"'+(busy?' disabled':'')+'>'
   +(busy?"Salvando...":editing?"Salvar correção":"Registrar atendimento")+'</button></div>'
   +'</form></section>';
 },
 async submit(event,render,toast){
  if(event.target?.id!=="real-manual-form")return false;
  event.preventDefault();capture();
  if(!auth()||busy||!form){toast("Entre novamente no aplicativo.");return true;}
  const original=form,patient=patients().find(p=>p.id===original.patientId);
  if(!patient||(original.mode==="new"&&!patient.is_active)){
   toast("Selecione um paciente ativo.");return true;
  }
  if(!Object.hasOwn(statusLabels,original.status)){toast("Selecione a situação do atendimento.");return true;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(original.date)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(original.time)){
   toast("Informe data e horário válidos.");return true;
  }
  // No DST in São Paulo from 2020 onwards. Restricting to 2020 avoids historical DST ambiguity.
  const when=new Date(original.date+"T"+original.time+":00-03:00");
  const calendar=formatDate(when);
  if(!Number.isFinite(when.getTime())||original.date<"2020-01-01"||
   calendar.date!==original.date||calendar.time!==original.time||when.getTime()>Date.now()){
   toast("Confira a data e o horário: não é possível registrar sessões futuras.");return true;
  }
  const correct=original.mode==="correct";
  const amount=correct?original.fee:patient.fee_cents;
  if(!Number.isSafeInteger(Number(amount))||amount<0){
   toast("Honorário inválido no cadastro do paciente.");return true;
  }
  if(!window.confirm((correct?"CORRIGIR":"REGISTRAR")+" sessão manual de "+patient.full_name+" em "+
    original.date.split("-").reverse().join("/")+" às "+original.time+" como "+
    statusLabels[original.status]+"?\n\n"+
    (canCharge(original.status)?"Será cobrado "+currency(amount)+".":"Sem cobrança.")+
    "\n\nEsta ação será salva no Supabase e NÃO criará um evento no Google Calendar."))return true;
  busy=true;inform();
  try{
   const result=await window.ConsultorioSessions.register({
    id:original.key,start:{dateTime:when.toISOString()}
   },original.patientId,original.status,correct);
   if(!result.ok){toast(result.message);return true;}
   form=null;
   // Ao salvar pelo botão geral "Registrar sessão manual", nenhum paciente
   // estava selecionado. Abrir o paciente para mostrar o débito imediatamente.
   const historyRequest=window.ConsultorioPatientsUI?.select(
     original.patientId,render,{forceHistory:true}
   )||window.ConsultorioSessions?.loadPatientHistory(original.patientId,true);
   const outcomes=await Promise.allSettled([
     window.ConsultorioFinance?.reload(),historyRequest
   ]);
   const history=window.ConsultorioSessions?.state;
   const finance=window.ConsultorioFinance?.state;
   if(outcomes.some(x=>x.status==="rejected")||
       (history?.historyPatientId===original.patientId&&history?.historyError)||
       finance?.error){
     toast("Sessão salva no Supabase, mas não foi possível atualizar toda a tela. Abra o paciente novamente para conferir.");
   }else toast("Sessão salva e vinculada ao paciente. "+result.message);
   inform();return true;
  }finally{busy=false;inform();}
 }
};
window.ConsultorioManualSessions=store;
})();