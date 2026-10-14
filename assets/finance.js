/* Sprint 8: financeiro privado; pagamentos/débitos reais persistidos no Supabase.
   Sem localStorage, sem informações dos pacientes no GitHub. */
(()=>{
"use strict";
const listeners=new Set();
let sessions=[],payments=[],audit=[],loading=false,initialized=false,error="",saving=false,revision=0;
let filter="all",editing=false,formDraft=null,pendingRequestId=null;
const signal=()=>{for(const fn of listeners){try{fn()}catch(_){}}};
const auth=()=>window.ConsultorioAuth?.state.phase==="authorized"?window.ConsultorioAuth?.dataClient:null;
const patients=()=>window.ConsultorioPatients?.state.rows||[];
const getPatient=id=>patients().find(p=>p.id===id);
const realToday=()=>{
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",
   year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(e=>[e.type,e.value]));
 return p.year+"-"+p.month+"-"+p.day;
};
const brl=n=>(Number(n||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const statuses={done:"Realizada",missed_charge:"Falta cobrada",missed_nocharge:"Falta sem cobrança",
 cancelled:"Cancelada",voided:"Registro desfeito"};
const fallback="Não foi possível consultar o financeiro. Tente novamente.";
const parseAmount=value=>{
 const text=String(value||"").trim();
 if(!/^\d{1,6}([.,]\d{1,2})?$/.test(text))return null;
 const [reais,centavos=""]=text.replace(",",".").split(".");
 const cents=Number(reais)*100+Number(centavos.padEnd(2,"0"));
 return Number.isSafeInteger(cents)&&cents>=1&&cents<=99999999?cents:null;
};
const pagination=async(db,table,columns,order)=>{
 const all=[];
 for(let start=0;start<50000;start+=500){
   const {data,error:issue}=await db.from(table).select(columns).order(order,{ascending:false}).range(start,start+499);
   if(issue)throw issue;
   if(!Array.isArray(data))throw Error("Dados inválidos");
   all.push(...data);
   if(data.length<500)return all;
 }
 throw Error("Volume superior ao limite de leitura seguro.");
};
const ledgerFor=id=>{
 const entries=[];
 for(const s of sessions.filter(x=>x.patient_id===id&&x.charge_cents>0)){
   entries.push({type:"debit",id:s.id,day:String(s.scheduled_at||"").slice(0,10),
     at:s.scheduled_at,amount_cents:s.charge_cents,label:"Sessão · "+(statuses[s.status]||"Atendimento"),voided:false});
 }
 for(const p of payments.filter(x=>x.patient_id===id)){
   entries.push({type:"payment",id:p.id,day:p.paid_on,at:p.paid_on+"T12:00:00",
     amount_cents:p.amount_cents,label:"Pagamento · "+p.method,
     note:p.note||"",voided:!!p.voided_at,voided_at:p.voided_at});
 }
 entries.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
 let running=0;
 for(const item of entries){
   if(!item.voided)running+=item.type==="debit"?item.amount_cents:-item.amount_cents;
   item.running_cents=running;
 }
 return entries;
};
const summary=id=>{
 const totalCharges=sessions.filter(s=>s.patient_id===id).reduce((a,s)=>a+Number(s.charge_cents||0),0);
 const received=payments.filter(p=>p.patient_id===id&&!p.voided_at)
   .reduce((a,p)=>a+Number(p.amount_cents||0),0);
 const net=totalCharges-received;
 return {charges:totalCharges,received,net,pending:Math.max(0,net),credit:Math.max(0,-net)};
};
const allSummary=()=>{
 const active=payments.filter(p=>!p.voided_at);
 const month=realToday().slice(0,7);
 const all=patients().map(p=>summary(p.id));
 return {charges:all.reduce((a,b)=>a+b.charges,0),
   received:active.reduce((a,p)=>a+p.amount_cents,0),
   receivedMonth:active.filter(p=>p.paid_on.slice(0,7)===month).reduce((a,p)=>a+p.amount_cents,0),
   pending:all.reduce((a,b)=>a+b.pending,0),
   credit:all.reduce((a,b)=>a+b.credit,0),
   overduePatients:all.filter(x=>x.pending>0).length,
   numPayments:active.length};
};
const fields=["real-finance-patient","real-finance-amount","real-finance-date","real-finance-method","real-finance-note"];
const captureDraft=()=>{
 if(!editing||typeof document==="undefined")return;
 const form=document.getElementById("real-finance-form");
 if(!form)return;
 const read=id=>form.querySelector("#"+id)?.value??"";
 formDraft={patient_id:read(fields[0]),amount:read(fields[1]),paid_on:read(fields[2]),
   method:read(fields[3]),note:read(fields[4])};
};
const resetForm=()=>{editing=false;formDraft=null;pendingRequestId=null;};
const finance={
 get state(){return{sessions:sessions.slice(),payments:payments.slice(),audit:audit.slice(),
  loading,initialized,error,saving,filter,editing,summary:allSummary()};},
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 clear(){++revision;sessions=[];payments=[];audit=[];loading=false;initialized=false;error="";saving=false;filter="all";resetForm();signal();},
 ensure(){if(auth()&&!initialized&&!loading&&!error)void finance.load();},
 async load(force=false){
   const db=auth();if(!db||loading||saving||(initialized&&!force))return;
   const seq=++revision;loading=true;error="";signal();
   try{
     const [nextSessions,nextPayments,nextAudit]=await Promise.all([
       pagination(db,"session_records","id,patient_id,scheduled_at,status,charge_cents","scheduled_at"),
       pagination(db,"patient_payments","id,patient_id,request_id,amount_cents,paid_on,method,note,voided_at,created_at","paid_on"),
       pagination(db,"payment_audit","id,payment_id,action,amount_cents,occurred_at","occurred_at")
     ]);
     if(seq!==revision||!auth())return;
     sessions=nextSessions;payments=nextPayments;audit=nextAudit;initialized=true;
   }catch(_){if(seq===revision){error=fallback;initialized=false;}}
   finally{if(seq===revision){loading=false;signal();}}
 },
 async reload(){error="";initialized=false;await finance.load(true);},
 begin(patientId=null){
   editing=true;
   formDraft={patient_id:patientId||"",amount:"",paid_on:realToday(),method:"Pix",note:""};
   pendingRequestId=crypto.randomUUID();signal();
 },
 cancel(){resetForm();signal();},
 async register(payload){
   const db=auth();if(!db||saving||loading)return{ok:false,message:"Aguarde a conclusão do carregamento."};
   const patient=getPatient(payload.patient_id);
   if(!patient)return{ok:false,message:"Selecione um paciente cadastrado."};
   const cents=parseAmount(payload.amount);
   if(cents===null)return{ok:false,message:"Informe um valor entre R$ 0,01 e R$ 999.999,99."};
   if(!/^\d{4}-\d{2}-\d{2}$/.test(payload.paid_on||"")||
      (new Date(payload.paid_on+"T12:00:00Z")).toISOString().slice(0,10)!==payload.paid_on||
      payload.paid_on<"2000-01-01"||payload.paid_on>realToday())
     return{ok:false,message:"Confira a data do pagamento (não pode ser futura)."};
   if(!["Pix","Dinheiro","Transferência","Cartão","Outro"].includes(payload.method))
     return{ok:false,message:"Escolha uma forma de pagamento válida."};
   const note=String(payload.note||"").trim();
   if(note.length>300)return{ok:false,message:"Observação muito longa (máximo de 300 caracteres)."};
   if(!pendingRequestId)pendingRequestId=crypto.randomUUID();
   const request=pendingRequestId;
   saving=true;signal();
   try{
     const {data,error:rpcError}=await db.rpc("record_patient_payment",{
       p_patient_id:payload.patient_id,p_amount_cents:cents,p_paid_on:payload.paid_on,
       p_method:payload.method,p_note:note||null,p_request_id:request
     });
     if(rpcError)throw rpcError;
     if(!data?.payment_id)throw Error("Resposta inválida");
     resetForm();
     return{ok:true,message:data.unchanged?
       "Esse pagamento já estava registrado. Não foi duplicado.":"Pagamento salvo. Saldo e crédito atualizados."};
   }catch(e){
     return{ok:false,message:e?.code==="23505"?
       "Esta tentativa já está associada a outro lançamento. Feche e reabra o formulário.":
       e?.code==="22023"?"Confira valor, data e paciente.":"Não foi possível confirmar o recebimento. Tente novamente; o sistema evita lançamentos duplicados."};
   }finally{saving=false;signal();}
 },
 async voidPayment(id){
   const db=auth();
   if(!db||loading||saving)return{ok:false,message:"Aguarde."};
   const item=payments.find(p=>p.id===id);
   if(!item)return{ok:false,message:"Pagamento não encontrado."};
   if(item.voided_at)return{ok:true,message:"Este lançamento já estava estornado."};
   saving=true;signal();
   try{
     const {data,error:rpcError}=await db.rpc("void_patient_payment",{p_payment_id:id});
     if(rpcError||!data?.payment_id)throw rpcError||Error("Resposta inválida");
     return{ok:true,message:"Pagamento estornado no histórico. Se necessário, registre o valor correto como novo recebimento."};
   }catch(_){return{ok:false,message:"Não foi possível estornar o pagamento. Tente novamente."};}
   finally{saving=false;signal();}
 },
 summary,ledgerFor,
 render({head,I,esc}){
   captureDraft();
   let out=head("finance",'<button class="btn primary" data-action="real-finance-new">'+I("plus")+' Registrar pagamento</button>');
   out+='<div class="notice"><span class="icon">'+I("shield")+'</span><div><strong>Financeiro real · Supabase</strong><p>Os débitos vêm das sessões confirmadas e os recebimentos são lançados manualmente. Pagamentos antecipados viram crédito disponível; não há integração bancária automática.</p></div></div>';
   if(loading&&!initialized)return out+'<section class="card hcard"><div class="empty">Carregando seus lançamentos protegidos...</div></section>';
   if(error)return out+'<section class="card hcard"><p role="alert">'+esc(error)+'</p><button class="btn" data-action="real-finance-refresh">Tentar novamente</button></section>';
   const tot=allSummary();
   out+='<div class="real-finance-metrics">'
     +[['Recebido neste mês',tot.receivedMonth],['Total pendente',tot.pending],['Créditos antecipados',tot.credit],['Recebido no histórico',tot.received]].map(([label,value])=>
      '<div class="card real-finance-metric"><small>'+esc(label)+'</small><strong>'+brl(value)+'</strong></div>').join('')
     +'</div>';
   if(editing){
      const draft=formDraft||{patient_id:"",amount:"",paid_on:realToday(),method:"Pix",note:""};
      const opts=patients().map(p=>'<option value="'+esc(p.id)+'"'+(draft.patient_id===p.id?' selected':'')+'>'+esc(p.full_name)+(p.is_active?'':' (arquivado)')+'</option>').join('');
      out+='<section class="card hcard real-finance-form-wrap"><div class="card-head"><h2>Novo recebimento</h2><span class="status done">Registro privado</span></div>'
       +'<p class="subhead">O pagamento pode quitar sessões anteriores ou ficar como crédito para atendimentos futuros.</p>'
       +'<form id="real-finance-form" class="patient-form-grid" autocomplete="off">'
       +'<label class="field patient-wide">Paciente<select id="real-finance-patient" required><option value="">Escolha um paciente</option>'+opts+'</select></label>'
       +'<label class="field">Valor recebido (R$)<input id="real-finance-amount" required inputmode="decimal" maxlength="12" placeholder="Ex.: 300,00" value="'+esc(draft.amount)+'"></label>'
       +'<label class="field">Data do recebimento<input id="real-finance-date" type="date" required min="2000-01-01" max="'+realToday()+'" value="'+esc(draft.paid_on)+'"></label>'
       +'<label class="field">Forma de pagamento<select id="real-finance-method">'
       +["Pix","Dinheiro","Transferência","Cartão","Outro"].map(x=>'<option value="'+esc(x)+'"'+(draft.method===x?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>'
       +'<label class="field patient-wide">Observação (opcional)<input id="real-finance-note" maxlength="300" placeholder="Ex.: pagamento referente a outubro" value="'+esc(draft.note)+'"></label>'
       +'<div class="patient-form-actions patient-wide"><button type="button" class="btn" data-action="real-finance-cancel">Cancelar</button>'
       +'<button class="btn primary" type="submit"'+(saving?' disabled':'')+'>Confirmar recebimento</button></div>'
       +'</form></section>';
   }
   const filtered=patients().filter(p=>filter==="all"||
      (filter==="open"?summary(p.id).pending>0:filter==="credit"?summary(p.id).credit>0:summary(p.id).net===0));
   out+='<section class="card hcard real-finance-list"><div class="card-head"><h2>Saldo por paciente</h2><button class="btn sm" data-action="real-finance-refresh">Atualizar</button></div>'
     +'<div class="chip-bar real-finance-chips">'
     +[['all','Todos'],['open','Pendentes'],['credit','Com crédito'],['clear','Em dia']].map(([key,label])=>
      '<button class="chip '+(filter===key?'active':'')+'" data-action="real-finance-filter" data-finance-filter="'+key+'">'+label+'</button>').join('')
     +'</div>';
   if(!filtered.length)out+='<div class="empty">Nenhum paciente neste filtro.</div>';
   for(const p of filtered){
      const b=summary(p.id),mark=b.pending?"A receber":b.credit?"Crédito disponível":"Em dia";
      const amount=b.pending?b.pending:b.credit;
      out+='<div class="real-finance-patient"><div class="real-finance-patient-info"><strong>'+esc(p.full_name)+'</strong>'
       +'<small>Débitos '+brl(b.charges)+' · Recebidos '+brl(b.received)+'</small></div>'
       +'<div class="real-finance-patient-balance"><small>'+mark+'</small><strong>'+brl(amount)+'</strong></div>'
       +'<button class="btn sm" data-action="real-finance-new-for" data-patient-id="'+esc(p.id)+'">Receber</button></div>';
   }
   out+='</section>';
   const movements=[];
   for(const s of sessions.filter(s=>s.charge_cents>0))movements.push({id:s.id,date:s.scheduled_at,type:"debit",amount:s.charge_cents,patient_id:s.patient_id,description:"Sessão cobrada"});
   for(const p of payments)movements.push({id:p.id,date:p.paid_on+"T12:00:00",type:"payment",amount:p.amount_cents,patient_id:p.patient_id,description:p.method,voided:!!p.voided_at});
   movements.sort((a,b)=>b.date.localeCompare(a.date));
   out+='<section class="card hcard real-finance-movements"><div class="card-head"><h2>Movimentações recentes</h2><span class="muted">Débitos e recebimentos</span></div>';
   if(!movements.length)out+='<div class="empty">Nenhum lançamento real ainda.</div>';
   for(const row of movements.slice(0,50)){
     const who=getPatient(row.patient_id);
     out+='<div class="real-finance-movement"><div><strong>'+esc(who?.full_name||"Paciente indisponível")+'</strong>'
        +'<small>'+esc(row.description)+' · '+esc(row.date.slice(0,10).split("-").reverse().join("/"))
        +(row.voided?' · Estornado':'')+'</small></div>'
        +'<strong class="'+(row.type==="payment"?"is-incoming":"is-debit")+(row.voided?" is-voided":"")+'">'+(row.type==="payment"?"−":"+")+brl(row.amount)+'</strong>'
        +(row.type==="payment"&&!row.voided?'<button class="btn sm" data-action="real-finance-void" data-payment-id="'+esc(row.id)+'">Estornar</button>':'')
        +'</div>';
   }
   return out+'</section><p class="foot-note">Os valores são calculados a partir dos registros reais. Créditos são considerados automaticamente no saldo, sem alterar as sessões. Não importamos extratos bancários.</p>';
 },
 renderPatientSummary(id,{esc,I}){
   const p=getPatient(id);if(!p)return"";
   if(loading&&!initialized)return'<section class="card hcard"><div class="empty">Carregando saldo financeiro...</div></section>';
   if(error)return'<section class="card hcard"><p>Financeiro indisponível. Abra a aba Financeiro para tentar novamente.</p></section>';
   const b=summary(id),entries=ledgerFor(id).slice().reverse().slice(0,30);
   let out='<section class="card hcard real-patient-finance"><div class="card-head"><h2>Financeiro real do paciente</h2>'
     +'<button class="btn primary sm" data-action="real-finance-patient-open" data-patient-id="'+esc(id)+'">Registrar pagamento</button></div>'
     +'<div class="real-finance-metrics real-finance-metrics-sm">'
     +[['Débitos',b.charges],['Recebidos',b.received],[b.credit?'Crédito disponível':'Saldo pendente',b.credit||b.pending]].map(([label,amount])=>
       '<div class="real-finance-metric"><small>'+esc(label)+'</small><strong>'+brl(amount)+'</strong></div>').join('')+'</div>'
     +'<p class="real-session-muted">Créditos pagos antecipadamente são descontados automaticamente dos débitos. Os pagamentos são lançados separadamente das sessões.</p>'
     +'<h3 class="real-finance-extract-title">Extrato por data</h3>';
   if(!entries.length)out+='<div class="empty">Ainda não há sessões cobradas ou pagamentos registrados.</div>';
   for(const e of entries){
      out+='<div class="real-finance-movement"><div><strong>'+esc(e.label)+'</strong>'
        +'<small>'+esc(e.day.split("-").reverse().join("/"))+(e.voided?' · Estornado':'')
        +' · Saldo após: '+brl(e.running_cents)+'</small></div>'
        +'<strong class="'+(e.type==="payment"?"is-incoming":"is-debit")+(e.voided?" is-voided":"")+'">'+(e.type==="payment"?"−":"+")+brl(e.amount_cents)+'</strong></div>';
   }
   return out+'</section>';
 },
 async click(button,render,toast,navigate){
   const act=button.dataset.action||"";
   if(!act.startsWith("real-finance-"))return false;
   if(act==="real-finance-new"){finance.begin();render();}
   else if(act==="real-finance-patient-open"){
      finance.begin(button.dataset.patientId);navigate("finance");
   }else if(act==="real-finance-new-for"){finance.begin(button.dataset.patientId);render();}
   else if(act==="real-finance-cancel"){finance.cancel();render();}
   else if(act==="real-finance-refresh"){await finance.reload();}
   else if(act==="real-finance-filter"){
     filter=button.dataset.financeFilter||"all";render();
   }else if(act==="real-finance-void"){
     const item=payments.find(p=>p.id===button.dataset.paymentId);
     if(!item){toast("Pagamento não encontrado.");return true;}
     const who=getPatient(item.patient_id);
     if(!window.confirm("ESTORNAR o pagamento de "+brl(item.amount_cents)+" de "+(who?.full_name||"paciente")+"? O recebimento continuará no histórico como estornado. Para corrigir o valor, registre outro pagamento."))return true;
     const outcome=await finance.voidPayment(item.id);toast(outcome.message);
     if(outcome.ok)await finance.reload();
   }
   return true;
 },
 async submit(e,render,toast){
   if(e.target?.id!=="real-finance-form")return false;
   e.preventDefault();captureDraft();
   const info=formDraft||{};
   const patient=getPatient(info.patient_id);
   const value=parseAmount(info.amount);
   if(!patient||value===null){toast("Escolha um paciente e informe um valor válido.");return true;}
   if(!window.confirm("Confirmar o RECEBIMENTO de "+brl(value)+" de "+patient.full_name+" em "+info.paid_on.split("-").reverse().join("/")+"? Este registro atualizará o saldo real."))return true;
   const outcome=await finance.register(info);toast(outcome.message);
   if(outcome.ok)await finance.reload();
   return true;
 }
};
window.ConsultorioFinance=finance;
})();