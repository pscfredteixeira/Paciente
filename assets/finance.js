/* Sprint 8: financeiro privado; pagamentos/débitos reais persistidos no Supabase.
   Sem localStorage, sem informações dos pacientes no GitHub. */
(()=>{
"use strict";
const listeners=new Set();
let sessions=[],payments=[],audit=[],loading=false,initialized=false,error="",saving=false,revision=0;
let filter="all",editing=false,formDraft=null,pendingRequestId=null,editingPixId=null,pixRefDraft="",pixExpanded=false,reportMonths=6,closingMonth=null;
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
const brazilDate=raw=>{
 const date=new Date(raw);
 if(!Number.isFinite(date.getTime()))return"";
 const pt=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
   timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(date).map(e=>[e.type,e.value]));
 return pt.year+"-"+pt.month+"-"+pt.day;
};
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
   entries.push({type:"debit",id:s.id,day:brazilDate(s.scheduled_at),
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
/* Fechamento é uma prévia atualizada: não bloqueia nem altera registros. */
const monthRows=month=>{
 const records=[];
 for(const s of sessions){
   const day=brazilDate(s.scheduled_at);
   if(day.slice(0,7)!==month)continue;
   records.push({day,type:"Sessão",name:getPatient(s.patient_id)?.full_name||"Paciente indisponível",
     status:statuses[s.status]||s.status,
     amount:Number(s.charge_cents||0),method:"",pix:""});
 }
 for(const p of payments){
   if(p.paid_on.slice(0,7)!==month)continue;
   records.push({day:p.paid_on,type:"Pagamento",name:getPatient(p.patient_id)?.full_name||"Paciente indisponível",
     status:p.voided_at?"Estornado":"Recebido",
     amount:Number(p.amount_cents||0),method:p.method,
     pix:p.method==="Pix"?(p.voided_at?"Estornado":p.pix_verified_at?"Conferido manualmente":"Não conferido"):""});
 }
 records.sort((a,b)=>a.day.localeCompare(b.day)||a.type.localeCompare(b.type)||a.name.localeCompare(b.name));
 return records;
};
const monthClosing=month=>{
 const rows=monthRows(month),validCharges=rows.filter(r=>r.type==="Sessão"),
   validPayments=rows.filter(r=>r.type==="Pagamento"&&r.status==="Recebido");
 return {month,rows,charged:validCharges.reduce((t,r)=>t+r.amount,0),
   received:validPayments.reduce((t,r)=>t+r.amount,0),
   sessions:validCharges.filter(r=>r.status==="Realizada").length,
   pixPending:validPayments.filter(r=>r.method==="Pix"&&r.pix==="Não conferido").length,
   pixVerified:validPayments.filter(r=>r.method==="Pix"&&r.pix==="Conferido manualmente").length,
   voided:rows.filter(r=>r.type==="Pagamento"&&r.status==="Estornado").length};
};
const moneyCsv=cents=>(Number(cents||0)/100).toFixed(2).replace(".",",");
const csvCell=value=>{
 const raw=String(value??"").replace(/[\r\n\t]+/g," ").trim();
 // Spreadsheet formula injection defense: even a patient name must be treated as text.
 const safe=/^[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/.test(raw)?"'"+raw:raw;
 return '"'+safe.replace(/"/g,'""')+'"';
};
const closingCsv=month=>{
 const closing=monthClosing(month);
 const list=[
   ["Relatório","Meu Consultório · Prévia mensal · "+month],
   ["Aviso","Gerado no aparelho. Valores podem mudar após correções. Não é documento fiscal."],
   ["Aviso de privacidade","Contém nomes de pacientes. Guarde em local privado."],
   ["Cobrado",moneyCsv(closing.charged)],
   ["Recebido",moneyCsv(closing.received)],
   ["Pix pendentes de conferência",closing.pixPending],
   [],["Data","Tipo","Paciente","Situação","Valor (R$)","Forma de pagamento","Conferência Pix"],
   ...closing.rows.map(r=>[r.day.split("-").reverse().join("/"),r.type,r.name,r.status,
     moneyCsv(r.amount),r.method,r.pix])
 ];
 return "\uFEFF"+list.map(row=>row.map(csvCell).join(";")).join("\r\n")+"\r\n";
};
const recentClosingMonths=()=>{
 const now=realToday().slice(0,7);
 const [year,month]=now.split("-").map(Number);
 const result=new Set([closingMonth||now]);
 for(let i=0;i<24;i++){
   const d=new Date(Date.UTC(year,month-1-i,15,12));
   result.add(d.toISOString().slice(0,7));
 }
 for(const s of sessions){const key=brazilDate(s.scheduled_at).slice(0,7);if(key&&key<="9999-12")result.add(key);}
 for(const p of payments){const key=p.paid_on?.slice(0,7);if(key&&key<="9999-12")result.add(key);}
 return [...result].filter(x=>/^\d{4}-\d{2}$/.test(x)&&x<=now).sort().reverse();
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
const capturePixDraft=()=>{
 if(!editingPixId||typeof document==="undefined")return;
 const input=document.getElementById("real-pix-reference");
 if(input?.dataset.paymentId===editingPixId)pixRefDraft=input.value;
};
const pixStatus=payment=>{
 if(payment.voided_at)return "Estornado";
 return payment.pix_verified_at?"Conferido manualmente":"Pendente de conferência";
};
const finance={
 get state(){return{sessions:sessions.slice(),payments:payments.slice(),audit:audit.slice(),
  loading,initialized,error,saving,filter,editing,editingPixId,reportMonths,closingMonth,summary:allSummary()};},
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 clear(){++revision;sessions=[];payments=[];audit=[];loading=false;initialized=false;error="";saving=false;filter="all";editingPixId=null;pixRefDraft="";pixExpanded=false;reportMonths=6;closingMonth=null;resetForm();signal();},
 ensure(){if(auth()&&!initialized&&!loading&&!error)void finance.load();},
 async load(force=false){
   const db=auth();if(!db||loading||saving||(initialized&&!force))return;
   const seq=++revision;loading=true;error="";signal();
   try{
     const [nextSessions,nextPayments,nextAudit]=await Promise.all([
       pagination(db,"session_records","id,patient_id,scheduled_at,status,charge_cents","scheduled_at"),
       pagination(db,"patient_payments","id,patient_id,request_id,amount_cents,paid_on,method,note,voided_at,created_at,pix_verified_at,pix_reference","paid_on"),
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
   const parsedDay=/^\d{4}-\d{2}-\d{2}$/.test(payload.paid_on||"")?
      new Date(payload.paid_on+"T12:00:00Z"):null;
   if(!parsedDay||!Number.isFinite(parsedDay.getTime())||
      parsedDay.toISOString().slice(0,10)!==payload.paid_on||
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
 async verifyPix(id,confirm,reference=null){
   const db=auth();
   if(!db||loading||saving)return{ok:false,message:"Aguarde o carregamento ou faça login novamente."};
   const payment=payments.find(p=>p.id===id);
   if(!payment||payment.method!=="Pix"||payment.voided_at)
     return{ok:false,message:"Selecione um pagamento Pix válido e não estornado."};
   const ref=String(reference||"").trim().toUpperCase();
   if(confirm&&ref&&(ref.length<3||ref.length>100||!/^[A-Z0-9._:-]+$/.test(ref)))
     return{ok:false,message:"O identificador do Pix deve ter entre 3 e 100 caracteres: letras, números, ponto, hífen ou dois-pontos."};
   saving=true;signal();
   try{
     const {data,error:failure}=await db.rpc("set_pix_verification",{
       p_payment_id:id,p_verified:!!confirm,p_reference:confirm?(ref||null):null
     });
     if(failure)throw failure;
     if(!data?.payment_id)throw Error("Resposta inválida");
     if(editingPixId===id){editingPixId=null;pixRefDraft="";}
     return {ok:true,message:data.unchanged?
       "Esta conferência já estava registrada; nada foi duplicado.":
       confirm?"Pix marcado como conferido manualmente. O banco não foi consultado pelo aplicativo.":
       "Conferência manual desfeita. O registro do pagamento foi preservado."};
   }catch(e){return{ok:false,message:e?.code==="23505"?
     "Este identificador Pix já foi usado para conferir outro recebimento ativo.":
     e?.code==="22023"?"Não foi possível conferir. Revise o identificador ou desfaça a conferência anterior.":
     "Não foi possível atualizar a conferência do Pix. Tente novamente."};}
   finally{saving=false;signal();}
 },
 summary,ledgerFor,monthClosing,closingCsv,
 setClosingMonth(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month>realToday().slice(0,7))return;closingMonth=month;signal();},
 render({head,I,esc}){
   captureDraft();capturePixDraft();
   let out=head("finance",'<button class="btn primary" data-action="real-finance-new">'+I("plus")+' Registrar pagamento</button> <button class="btn soft" data-action="real-pix-jump">Conferir Pix</button>');
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
   for(const s of sessions.filter(s=>s.charge_cents>0))movements.push({id:s.id,date:s.scheduled_at,day:brazilDate(s.scheduled_at),type:"debit",amount:s.charge_cents,patient_id:s.patient_id,description:"Sessão cobrada"});
   for(const p of payments)movements.push({id:p.id,date:p.paid_on+"T12:00:00",type:"payment",amount:p.amount_cents,patient_id:p.patient_id,description:p.method,voided:!!p.voided_at});
   movements.sort((a,b)=>b.date.localeCompare(a.date));
   out+='<section class="card hcard real-finance-movements"><div class="card-head"><h2>Movimentações recentes</h2><span class="muted">Débitos e recebimentos</span></div>';
   if(!movements.length)out+='<div class="empty">Nenhum lançamento real ainda.</div>';
   for(const row of movements.slice(0,50)){
     const who=getPatient(row.patient_id);
     out+='<div class="real-finance-movement"><div><strong>'+esc(who?.full_name||"Paciente indisponível")+'</strong>'
        +'<small>'+esc(row.description)+' · '+esc((row.day||row.date.slice(0,10)).split("-").reverse().join("/"))
        +(row.voided?' · Estornado':'')+'</small></div>'
        +'<strong class="'+(row.type==="payment"?"is-incoming":"is-debit")+(row.voided?" is-voided":"")+'">'+(row.type==="payment"?"−":"+")+brl(row.amount)+'</strong>'
        +(row.type==="payment"&&!row.voided?'<button class="btn sm" data-action="real-finance-void" data-payment-id="'+esc(row.id)+'">Estornar</button>':'')
        +'</div>';
   }
   out+='</section>';
   const allPix=payments.filter(p=>p.method==="Pix"&&!p.voided_at)
     .sort((a,b)=>(!!a.pix_verified_at)-(!!b.pix_verified_at)
       ||b.paid_on.localeCompare(a.paid_on)
       ||b.created_at.localeCompare(a.created_at));
   const unchecked=allPix.filter(p=>!p.pix_verified_at).length;
   const hasPix=allPix.length>0;
   const pixBadge=!hasPix?"Nenhum Pix":unchecked?
     unchecked+" pendente"+(unchecked===1?"":"s"):"Todos conferidos";
   out+='<section id="real-pix-review" class="card hcard real-pix-review'+(pixExpanded&&hasPix?' is-expanded':' is-compact')+'">'
     +'<div class="card-head real-pix-head"><h2>Conferência de Pix</h2>'
     +'<span class="status '+(unchecked?'pending':hasPix?'done':'unlinked')+'">'+pixBadge+'</span></div>';
   if(!hasPix){
     out+='<p class="real-pix-intro">Nenhum pagamento Pix registrado ainda. Quando você lançar um recebimento por Pix, ele aparecerá aqui.</p>'
       +'<button class="btn sm" data-action="real-finance-new">Registrar pagamento Pix</button>';
   }else{
     out+='<p class="real-pix-intro">'+allPix.length+' recebimento'+(allPix.length===1?'':'s')
       +' Pix registrado'+(allPix.length===1?'':'s')
       +'. A conferência é manual e não consulta sua conta bancária.</p>'
       +'<button class="btn sm real-pix-toggle" data-action="real-pix-toggle" aria-controls="real-pix-list" aria-expanded="'+(pixExpanded?'true':'false')+'">'
       +(pixExpanded?'Ocultar lançamentos':'Ver lançamentos')+' <span aria-hidden="true">'+(pixExpanded?'▴':'▾')+'</span></button>';
     if(!pixExpanded)out+='<div id="real-pix-list" hidden></div>';
     if(pixExpanded){
       out+='<div id="real-pix-list" class="real-pix-expanded">'
         +'<p class="real-pix-guidance">Antes de conferir, verifique a entrada, o valor e a data no extrato do banco. Isso não altera o saldo do paciente.</p>';
       for(const p of allPix.slice(0,200)){
         const who=getPatient(p.patient_id),verified=!!p.pix_verified_at;
         out+='<div class="real-pix-item"><div class="real-pix-information"><strong>'+esc(who?.full_name||"Paciente indisponível")+' · '+brl(p.amount_cents)+'</strong>'
           +'<small>'+esc(p.paid_on.split("-").reverse().join("/"))+' · '+esc(pixStatus(p))+'</small>'
           +(verified?'<small>Conferido: '+esc(new Date(p.pix_verified_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}))
             +(p.pix_reference?' · Referência: '+esc(p.pix_reference):'')+'</small>':'')
           +'</div><div class="real-pix-buttons">'
           +(verified?'<button class="btn sm" data-action="real-pix-undo" data-payment-id="'+esc(p.id)+'"'+(saving?' disabled':'')+'>Desfazer conferência</button>':
             '<button class="btn primary sm" data-action="real-pix-open" data-payment-id="'+esc(p.id)+'"'+(saving?' disabled':'')+'>Conferir Pix</button>')
           +'</div></div>';
         if(editingPixId===p.id&&!verified){
           out+='<div class="real-pix-editor">'
             +'<label class="field">Identificador da transação (opcional)'
             +'<input id="real-pix-reference" data-payment-id="'+esc(p.id)+'" type="text" inputmode="text" maxlength="100" autocomplete="off" spellcheck="false" placeholder="EndToEndId ou identificação no banco" value="'+esc(pixRefDraft)+'"></label>'
             +'<p class="real-session-muted">A conferência é uma marcação manual, não uma confirmação bancária feita pelo aplicativo.</p>'
             +'<div class="patient-form-actions"><button class="btn primary sm" data-action="real-pix-verify" data-payment-id="'+esc(p.id)+'"'+(saving?' disabled':'')+'>Confirmar que conferi no banco</button>'
             +'<button class="btn sm" data-action="real-pix-cancel">Cancelar</button></div></div>';
         }
       }
       if(allPix.length>200)out+='<p class="real-session-muted">Exibindo os 200 Pix mais recentes; os anteriores continuam preservados no banco.</p>';
       out+='</div>';
     }
   }
   out+='</section>';
   out+=window.ConsultorioStatement?.render({esc})||"";
   return out+'<p class="foot-note">Os valores são calculados a partir dos registros reais. Créditos são considerados automaticamente no saldo, sem alterar as sessões. Conferência Pix é exclusivamente manual.</p>';
 },
 renderReports({head,I,esc}){
   let out=head("reports",'<button class="btn soft" data-action="real-finance-refresh">'+I("clock")+' Atualizar dados</button>');
   out+='<div class="notice"><span class="icon">'+I("shield")+'</span><div><strong>Relatórios reais</strong>'
      +'<p>Dados registrados no Supabase. Recebimentos são agrupados pela data do pagamento; sessões, pela data do atendimento. Um Pix registrado não significa conferido no banco.</p></div></div>';
   if(loading&&!initialized)return out+'<section class="card hcard"><div class="empty">Carregando histórico real...</div></section>';
   if(error)return out+'<section class="card hcard"><p role="alert">'+esc(error)+'</p><button class="btn" data-action="real-finance-refresh">Tentar novamente</button></section>';
   const current=realToday().slice(0,7);
   const [year,month]=current.split("-").map(Number);
   const months=[];
   for(let step=reportMonths-1;step>=0;step--){
     const dt=new Date(Date.UTC(year,month-1-step,15,12));
     const key=dt.toISOString().slice(0,7);
     months.push({key,label:new Intl.DateTimeFormat("pt-BR",{month:"short",year:"2-digit",timeZone:"UTC"}).format(dt),
       charged:0,received:0,done:0,missedCharge:0,missedNocharge:0,verifiedPix:0,pixCount:0});
   }
   const keys=new Map(months.map(m=>[m.key,m]));
   for(const row of sessions){
     const m=keys.get(brazilDate(row.scheduled_at).slice(0,7));
     if(!m)continue;
     m.charged+=Number(row.charge_cents||0);
     if(row.status==="done")m.done++;
     if(row.status==="missed_charge")m.missedCharge++;
     if(row.status==="missed_nocharge")m.missedNocharge++;
   }
   for(const payment of payments){
     if(payment.voided_at)continue;
     const m=keys.get(payment.paid_on.slice(0,7));
     if(!m)continue;
     m.received+=Number(payment.amount_cents||0);
     if(payment.method==="Pix"){
       m.pixCount++;
       if(payment.pix_verified_at)m.verifiedPix++;
     }
   }
   const sums=months.reduce((a,m)=>({
     charged:a.charged+m.charged,received:a.received+m.received,done:a.done+m.done,
     missedCharge:a.missedCharge+m.missedCharge,missedNocharge:a.missedNocharge+m.missedNocharge,
     pixCount:a.pixCount+m.pixCount,verifiedPix:a.verifiedPix+m.verifiedPix
   }),{charged:0,received:0,done:0,missedCharge:0,missedNocharge:0,pixCount:0,verifiedPix:0});
   out+='<section class="card hcard real-report-panel"><div class="card-head"><h2>Evolução financeira</h2></div>'
     +'<div class="chip-bar real-finance-chips" role="group" aria-label="Período do relatório">'
     +[['6','Últimos 6 meses'],['12','Últimos 12 meses']].map(([n,label])=>
       '<button class="chip '+(reportMonths===Number(n)?'active':'')+'" data-action="real-report-period" data-report-months="'+n+'">'+label+'</button>').join('')
     +'</div><div class="real-finance-metrics">'
     +[['Recebimentos no período',brl(sums.received)],
       ['Débitos no período',brl(sums.charged)],
       ['Sessões realizadas',sums.done],
       ['Faltas cobradas',sums.missedCharge]]
       .map(([label,value])=>'<div class="real-finance-metric"><small>'+esc(label)+'</small><strong>'+value+'</strong></div>').join('')
     +'</div><p class="real-session-muted">Faltas sem cobrança: '+sums.missedNocharge
       +' · Pix conferidos manualmente: '+sums.verifiedPix+' de '+sums.pixCount
       +' (no período selecionado).</p>';
   const max=Math.max(1,...months.map(m=>Math.max(m.charged,m.received)));
   if(months.every(m=>m.charged===0&&m.received===0)){
     out+='<div class="empty">Nenhum débito ou recebimento registrado neste período. Os gráficos não apresentam valores fictícios.</div>';
   }else{
     out+='<div class="real-report-legend"><span class="real-report-key is-received">Recebido</span><span class="real-report-key is-charged">Cobrado</span></div>'
       +'<div class="real-report-chart" role="img" aria-label="Gráfico mensal de recebimentos e cobranças reais">'
       +months.map(m=>'<div class="real-report-month"><div class="real-report-bars">'
         +'<div class="real-report-bar is-received" style="height:'+(m.received?Math.max(2,100*m.received/max):0)+'%" title="'+esc(m.label)+' · Recebido: '+esc(brl(m.received))+'"></div>'
         +'<div class="real-report-bar is-charged" style="height:'+(m.charged?Math.max(2,100*m.charged/max):0)+'%" title="'+esc(m.label)+' · Cobrado: '+esc(brl(m.charged))+'"></div>'
         +'</div><span>'+esc(m.label)+'</span></div>').join('')
       +'</div>';
   }
   out+='<div class="real-report-table-wrap"><table class="real-report-table"><thead><tr>'
     +'<th scope="col">Mês</th><th scope="col">Recebido</th><th scope="col">Cobrado</th><th scope="col">Realizadas</th>'
     +'</tr></thead><tbody>'+months.slice().reverse().map(m=>
       '<tr><th scope="row">'+esc(m.label)+'</th><td>'+brl(m.received)+'</td><td>'+brl(m.charged)+'</td><td>'+m.done+'</td></tr>'
     ).join('')+'</tbody></table></div></section>';
   const selectedMonth=closingMonth||current;
   const closing=monthClosing(selectedMonth);
   out+='<section class="card hcard real-month-close">'
     +'<div class="card-head"><div><h2>Fechamento mensal · prévia</h2>'
     +'<p class="real-month-close-hint">Conferência administrativa. Não bloqueia o mês, não emite documento fiscal e pode mudar após correções.</p></div></div>'
     +'<div class="real-month-close-toolbar">'
     +'<label class="field">Mês de referência<select data-finance-month aria-label="Selecionar mês para conferência">'
     +recentClosingMonths().map(m=>'<option value="'+m+'"'+(m===selectedMonth?' selected':'')+'>'+new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(m+"-15T12:00:00Z"))+'</option>').join('')
     +'</select></label>'
     +'<button class="btn primary sm" data-action="real-report-export-month">Exportar CSV para Excel</button></div>'
     +'<div class="real-finance-metrics real-finance-metrics-sm">'
     +[['Cobrado no mês',brl(closing.charged)],['Recebido no mês',brl(closing.received)],
       ['Pix ainda não conferidos',closing.pixPending]].map(([label,value])=>
       '<div class="real-finance-metric"><small>'+esc(label)+'</small><strong>'+value+'</strong></div>').join('')+'</div>'
     +'<p class="real-month-close-detail">'+closing.sessions+' sessão'+(closing.sessions===1?'':'ões')+' realizada'+(closing.sessions===1?'':'s')
     +' · '+closing.pixVerified+' Pix conferido'+(closing.pixVerified===1?'':'s')
     +' · '+closing.voided+' pagamento'+(closing.voided===1?'':'s')+' estornado'+(closing.voided===1?'':'s')+'</p>'
     +(closing.pixPending?'<div class="real-month-close-alert"><strong>Atenção:</strong> há '+closing.pixPending+' Pix registrado'+(closing.pixPending===1?'':'s')
       +' nesse mês que ainda não '+(closing.pixPending===1?'foi':'foram')+' conferido'+(closing.pixPending===1?'':'s')
       +' manualmente. <button class="btn sm" data-view="finance">Abrir Financeiro</button></div>':
       '<p class="real-month-close-detail">Nenhum Pix desse mês aguarda conferência manual.</p>')
     +'<p class="real-month-close-privacy">O CSV contém nomes de pacientes, não inclui CPF ou e-mail e é gerado somente neste aparelho. Salve-o em local privado. Pagamentos estornados aparecem identificados e não entram no total recebido.</p>'
     +'</section>';
   const debts=patients().map(p=>({patient:p,...summary(p.id)}))
      .filter(x=>x.pending>0).sort((a,b)=>b.pending-a.pending);
   const credits=patients().map(p=>({patient:p,...summary(p.id)}))
      .filter(x=>x.credit>0).sort((a,b)=>b.credit-a.credit);
   out+='<section class="card hcard real-report-balances"><div class="card-head"><h2>Posição financeira atual</h2></div>'
     +'<p class="real-session-muted">Esta posição considera todos os registros até agora, não somente o período do gráfico. Pagamentos adiantados são créditos, não valores pendentes.</p>'
     +'<div class="real-finance-metrics real-finance-metrics-sm">'
     +[['Total a receber',debts.reduce((a,x)=>a+x.pending,0)],
       ['Créditos disponíveis',credits.reduce((a,x)=>a+x.credit,0)],
       ['Recebido desde o início',payments.filter(p=>!p.voided_at).reduce((a,p)=>a+p.amount_cents,0)]]
       .map(([label,n])=>'<div class="real-finance-metric"><small>'+esc(label)+'</small><strong>'+brl(n)+'</strong></div>').join('')
     +'</div><div class="real-report-columns">'
     +'<div><h3>Pacientes com valores pendentes</h3>'
     +(debts.length?debts.map(x=>'<div class="real-report-balance-row"><span>'+esc(x.patient.full_name)+'</span><strong>'+brl(x.pending)+'</strong></div>').join(''):'<p class="real-session-muted">Nenhuma pendência registrada.</p>')
     +'</div><div><h3>Pacientes com crédito</h3>'
     +(credits.length?credits.map(x=>'<div class="real-report-balance-row"><span>'+esc(x.patient.full_name)+'</span><strong>'+brl(x.credit)+'</strong></div>').join(''):'<p class="real-session-muted">Nenhum crédito disponível.</p>')
     +'</div></div></section>';
   return out+'<p class="foot-note">Lançamentos estornados não integram os totais. Correções de sessões alteram retroativamente os débitos do mês da sessão. A conferência de Pix é manual; não há conexão bancária.</p>';
 },
 renderHome({head,I,esc}){
   const sum=allSummary();
   let out=head("home",'<button class="btn soft" data-view="finance">'+I("wallet")+' Abrir financeiro</button>');
   out+='<div class="notice"><span class="icon">'+I("shield")+'</span><div><strong>Visão geral real</strong>'
    +'<p>Pacientes, sessões confirmadas e pagamentos registrados no Supabase. Compromissos futuros ficam na Agenda.</p></div></div>';
   if(loading&&!initialized)return out+'<section class="card hcard"><div class="empty">Carregando os indicadores reais...</div></section>';
   if(error)return out+'<section class="card hcard"><p>'+esc(error)+'</p>'
     +'<button class="btn" data-action="real-finance-refresh">Tentar novamente</button></section>';
   const active=patients().filter(x=>x.is_active).length;
   const completed=sessions.filter(x=>x.status==="done").length;
   out+='<div class="real-finance-metrics">'
     +[['Pacientes ativos',active,false],['Sessões realizadas',completed,false],
       ['Saldo a receber',sum.pending,true],['Recebido neste mês',sum.receivedMonth,true]]
       .map(([label,value,currency])=>'<div class="card real-finance-metric"><small>'+esc(label)
       +'</small><strong>'+(currency?brl(value):value)+'</strong></div>').join('')+'</div>';
   out+='<div class="grid grid-2 real-finance-home-grid"><section class="card hcard"><div class="card-head"><h2>Resumo financeiro</h2></div>'
     +'<p class="real-session-muted">Total de recebimentos registrados: <strong>'+brl(sum.received)+'</strong></p>'
     +'<p class="real-session-muted">Crédito antecipado disponível: <strong>'+brl(sum.credit)+'</strong></p>'
     +'<p class="real-session-muted">Pacientes com pendências: <strong>'+sum.overduePatients+'</strong></p>'
     +'<button class="btn primary" data-view="finance">Ver financeiro '+I("arrow")+'</button></section>'
     +'<section class="card hcard"><div class="card-head"><h2>Atendimentos</h2></div>'
     +'<p class="real-session-muted">Confirmar sessões, registrar faltas e corrigir lançamentos continua sendo feito na Agenda.</p>'
     +'<button class="btn" data-view="agenda">Abrir agenda '+I("arrow")+'</button></section></div>';
   return out;
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
   if(!act.startsWith("real-finance-")&&!act.startsWith("real-pix-")&&!act.startsWith("real-report-"))return false;
   if(act==="real-report-export-month"){
     if(!auth()||loading||error||!initialized){
       toast("Atualize o financeiro antes de exportar.");return true;
     }
     const month=closingMonth||realToday().slice(0,7);
     const count=monthClosing(month).rows.length;
     if(!window.confirm("Exportar "+count+" movimentação"+(count===1?"":"ões")+
       " de "+month+" em CSV para Excel?\n\nO arquivo contém nomes de pacientes e deve ser guardado em local privado. Ele não é um fechamento fiscal ou contábil."))return true;
     try{
       const content=closingCsv(month);
       const blob=new Blob([content],{type:"text/csv;charset=utf-8"});
       const url=URL.createObjectURL(blob);
       const link=document.createElement("a");
       link.href=url;link.download="meu-consultorio-financeiro-"+month+".csv";
       link.style.display="none";
       document.body.appendChild(link);
       link.click();link.remove();
       setTimeout(()=>URL.revokeObjectURL(url),60000);
       toast("Arquivo CSV gerado no aparelho. Guarde em local privado.");
     }catch(_){toast("Não foi possível gerar o CSV neste navegador. Tente novamente.");}
     return true;
   }
   if(act==="real-report-period"){reportMonths=button.dataset.reportMonths==="12"?12:6;render();return true;}
   if(act==="real-pix-jump"){
     pixExpanded=true;
     render();
     document.getElementById("real-pix-review")?.scrollIntoView({behavior:"smooth",block:"start"});
     return true;
   }
   if(act==="real-pix-toggle"){
     pixExpanded=!pixExpanded;
     if(!pixExpanded){editingPixId=null;pixRefDraft="";}
     render();return true;
   }
   if(act==="real-pix-open"){
     const item=payments.find(p=>p.id===button.dataset.paymentId&&!p.voided_at&&p.method==="Pix");
     if(!item){toast("Pagamento Pix indisponível.");return true;}
     editingPixId=editingPixId===item.id?null:item.id;pixRefDraft="";render();return true;
   }
   if(act==="real-pix-cancel"){editingPixId=null;pixRefDraft="";render();return true;}
   if(act==="real-pix-verify"){
     const item=payments.find(p=>p.id===button.dataset.paymentId&&p.method==="Pix");
     if(!item){toast("Pagamento Pix indisponível.");return true;}
     const ref=document.getElementById("real-pix-reference")?.value??pixRefDraft;
     if(!window.confirm("Você conferiu no EXTRATO DO BANCO o Pix de "+brl(item.amount_cents)+" de "+(getPatient(item.patient_id)?.full_name||"paciente")+"?\n\nConfirme somente se identificou o crédito real. Este botão não consulta o banco."))return true;
     const outcome=await finance.verifyPix(item.id,true,ref);toast(outcome.message);
     if(outcome.ok)await finance.reload();return true;
   }
   if(act==="real-pix-undo"){
     const item=payments.find(p=>p.id===button.dataset.paymentId);
     if(!item){toast("Pagamento não encontrado.");return true;}
     if(!window.confirm("Desfazer a conferência manual deste Pix? O recebimento e o saldo continuarão registrados; apenas a marcação de conferido será removida."))return true;
     const outcome=await finance.verifyPix(item.id,false,null);toast(outcome.message);
     if(outcome.ok)await finance.reload();return true;
   }
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