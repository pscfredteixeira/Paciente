/* Sprint 7. Registros de sessões reais: Supabase, nunca localStorage.
   O lançamento de sessão e do débito é transacional via RPC PostgreSQL. */
(()=>{
"use strict";
const listeners=new Set();
let records=new Map(),weekLoading=false,weekError="",historyPatientId=null;
let history=[],audit=[],historyLoading=false,historyError="",saving=false,weekRevision=0,historyRevision=0;
const notify=()=>{for(const fn of listeners){try{fn()}catch(_){}}};
const client=()=>window.ConsultorioAuth?.state.phase==="authorized"?window.ConsultorioAuth.dataClient:null;
const fields="id,google_event_id,patient_id,scheduled_at,status,fee_snapshot_cents,charge_cents,created_at,updated_at";
const readError="Não foi possível ler os registros de sessões. Tente novamente.";
const safeMsg=e=>{
 if(e?.code==="23505")return "Esta sessão já tem um registro. Use Corrigir registro para alterar.";
 if(e?.code==="42501")return "Sua sessão não tem permissão para fazer este lançamento.";
 if(e?.code==="22023")return "Revise a data, o paciente e o tipo de atendimento. Sessões futuras não podem ser confirmadas.";
 return "Não foi possível salvar o atendimento. Verifique sua conexão e tente novamente.";
};
const store={
 get state(){return{records:new Map(records),weekLoading,weekError,
   historyPatientId,history:history.slice(),audit:audit.slice(),historyLoading,historyError,saving};},
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 clear(){weekRevision++;historyRevision++;records=new Map();weekLoading=false;weekError="";
   historyPatientId=null;history=[];audit=[];historyLoading=false;historyError="";saving=false;notify();},
 async loadForEvents(events){
   const db=client();if(!db||weekLoading)return;
   const req=++weekRevision;weekLoading=true;weekError="";notify();
   try{
     const ids=[...new Set((events||[]).map(e=>e?.id).filter(x=>typeof x==="string"&&x.length))];
     const next=new Map();
     for(let i=0;i<ids.length;i+=40){
       const {data,error}=await db.from("session_records").select(fields).in("google_event_id",ids.slice(i,i+40));
       if(error)throw error;
       for(const row of data||[])next.set(row.google_event_id,row);
     }
     if(req!==weekRevision||!client())return;
     records=next;
   }catch(_){if(req===weekRevision){records=new Map();weekError=readError;}}
   finally{if(req===weekRevision){weekLoading=false;notify();}}
 },
 async loadPatientHistory(patientId){
   const db=client();if(!db||!patientId)return;
   if(historyLoading&&historyPatientId===patientId)return;
   const req=++historyRevision;historyPatientId=patientId;historyLoading=true;historyError="";notify();
   try{
     const {data,error}=await db.from("session_records").select(fields).eq("patient_id",patientId)
       .order("scheduled_at",{ascending:false}).limit(100);
     if(error)throw error;
     const rows=data||[],ids=rows.map(r=>r.id),audits=[];
     for(let i=0;i<ids.length;i+=40){
       const {data:log,error:logError}=await db.from("session_audit")
         .select("session_id,previous_status,new_status,previous_charge_cents,new_charge_cents,reason,occurred_at")
         .in("session_id",ids.slice(i,i+40)).order("occurred_at",{ascending:false}).limit(300);
       if(logError)throw logError;
       audits.push(...(log||[]));
     }
     if(req!==historyRevision||!client())return;
     history=rows;audit=audits;
   }catch(_){if(req===historyRevision){history=[];audit=[];historyError=readError;}}
   finally{if(req===historyRevision){historyLoading=false;notify();}}
 },
 async register(event,patientId,status,correct=false){
   const db=client();
   if(!db||saving||weekLoading)return {ok:false,message:"Aguarde o carregamento ou faça login novamente."};
   const start=event?.start?.dateTime||event?.start?.date;
   const scheduled=new Date(start||"");
   if(!event?.id||!patientId||!Number.isFinite(scheduled.getTime()))
     return {ok:false,message:"Escolha um compromisso e um paciente válido."};
   if(!["done","missed_charge","missed_nocharge","cancelled","voided"].includes(status))
     return {ok:false,message:"Tipo de registro inválido."};
   if(!correct && status==="voided")return {ok:false,message:"Use Corrigir registro."};
   if(["done","missed_charge","missed_nocharge"].includes(status)&&scheduled.getTime()>Date.now())
     return {ok:false,message:"Não é possível confirmar uma sessão que ainda não começou."};
   saving=true;notify();
   try{
     const {data,error}=await db.rpc("record_consultation",{
       p_event_id:event.id,p_patient_id:patientId,p_event_start:scheduled.toISOString(),
       p_status:status,p_correct:!!correct
     });
     if(error)throw error;
     if(!data?.session_id)throw Error("Resposta sem registro");
     const {data:rows,error:readIssue}=await db.from("session_records").select(fields).eq("id",data.session_id).limit(1);
     if(readIssue||!rows?.[0])throw readIssue||Error("Registro salvo, mas não foi possível reler.");
     records.set(event.id,rows[0]);
     if(historyPatientId===patientId){
       // Recarrega após soltar o indicador de salvamento.
       historyPatientId=null;
     }
     return {ok:true,unchanged:!!data.unchanged,message:data.unchanged?
       "Esta sessão já estava registrada. Não foi criado outro débito.":
       correct?"Registro corrigido. O histórico e o débito foram atualizados.":"Sessão salva e débito registrado conforme a regra escolhida."};
   }catch(e){return {ok:false,message:safeMsg(e)};}
   finally{saving=false;notify();}
 }
};
window.ConsultorioSessions=store;
})();