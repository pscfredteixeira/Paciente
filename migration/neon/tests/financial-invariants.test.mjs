import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const fixture=JSON.parse(readFileSync(new URL("../fixtures/synthetic-ledger.json",import.meta.url),"utf8"));
const deepCopy=()=>structuredClone(fixture);

function validateOwnership(model){
 const owners=new Set(model.owners.map(o=>o.legacy_owner_id));
 const authIds=new Set(model.owners.map(o=>o.neon_user_id));
 if(owners.size!==model.owners.length||authIds.size!==model.owners.length)
   throw Error("Identidade mapeada mais de uma vez");
 const patients=new Map(model.patients.map(p=>[p.id,p]));
 if(patients.size!==model.patients.length)throw Error("Paciente duplicado");
 for(const p of model.patients){
   if(!owners.has(p.owner_id))throw Error("Paciente sem owner conhecido");
 }
 const sessions=new Map(model.session_records.map(s=>[s.id,s]));
 if(sessions.size!==model.session_records.length)throw Error("Sessão duplicada");
 const events=new Set();
 for(const s of model.session_records){
   if(patients.get(s.patient_id)?.owner_id!==s.owner_id)
     throw Error("Sessão entre proprietários diferentes");
   const key=s.owner_id+"/"+s.google_event_id;
   if(events.has(key))throw Error("ID de evento repetido; risco de cobrança dupla");
   events.add(key);
 }
 for(const debit of model.session_debits){
   const session=sessions.get(debit.session_id);
   if(!session||session.owner_id!==debit.owner_id)
     throw Error("Débito com owner inválido");
 }
 const payments=new Set();
 for(const payment of model.patient_payments){
   if(payments.has(payment.id))throw Error("Pagamento repetido");
   payments.add(payment.id);
   if(patients.get(payment.patient_id)?.owner_id!==payment.owner_id)
     throw Error("Pagamento entre proprietários diferentes");
 }
 for(const s of model.session_records){
   const active=model.session_debits.filter(d=>d.session_id===s.id&&!d.voided);
   if(s.charge_cents>0){
     assert.equal(active.length,1,"Sessão cobrada precisa de exatamente um débito");
     assert.equal(active[0].amount_cents,s.charge_cents,"Valor do débito não corresponde à sessão");
   }else assert.equal(active.length,0,"Sessão isenta/cancelada não pode ter débito ativo");
 }
 return true;
}

function summarize(model,id){
 const debit=model.session_records.filter(s=>s.patient_id===id)
   .reduce((sum,s)=>sum+s.charge_cents,0);
 const received=model.patient_payments.filter(p=>p.patient_id===id&&!p.voided_at)
   .reduce((sum,p)=>sum+p.amount_cents,0);
 return {charged_cents:debit,received_cents:received,
  pending_cents:Math.max(0,debit-received),
  credit_cents:Math.max(0,received-debit)};
}

function registerOnce(sessions,s){
 const uniqueKey=s.owner_id+"|"+s.google_event_id;
 const found=sessions.find(p=>p.owner_id+"|"+p.google_event_id===uniqueKey);
 if(found)return{row:found,created:false};
 sessions.push({...s});
 return{row:s,created:true};
}

test("a fixture é 100% fictícia e não contém tokens nem campos privados",()=>{
 assert.match(fixture._notice,/FICTÍCIOS/);
 const text=JSON.stringify(fixture);
 assert.doesNotMatch(text,/"cpf"|"email"|"refresh_token"|"access_token"|"DATABASE_URL"|"encrypted_password"/i);
 assert.equal(fixture.patients.length,2);
});

test("consistência de proprietário, FK, idempotência e débitos ativos",()=>{
 assert.equal(validateOwnership(fixture),true);
});

test("o saldo preserva pagamentos antecipados e ignora estornos",()=>{
 for(const expected of fixture.expected){
   const actual=summarize(fixture,expected.patient_id);
   for(const [field,value] of Object.entries(actual))assert.equal(value,expected[field],field);
 }
});

test("um Pix marcado como conferido não altera o saldo financeiro",()=>{
 const copy=deepCopy();
 const before=summarize(copy,copy.patients[0].id);
 for(const pay of copy.patient_payments)if(pay.method==="Pix")pay.pix_verified_at="2026-10-19T12:00:00Z";
 assert.deepEqual(summarize(copy,copy.patients[0].id),before);
});

test("a conferência bloqueia referências a pacientes de outros proprietários",()=>{
 const copy=deepCopy();
 copy.patient_payments[0].patient_id=copy.patients[1].id;
 assert.throws(()=>validateOwnership(copy),/Pagamento entre proprietários/);
});

test("a conferência bloqueia sessões atribuídas a outros proprietários",()=>{
 const copy=deepCopy();
 copy.session_records[0].patient_id=copy.patients[1].id;
 assert.throws(()=>validateOwnership(copy),/Sessão entre proprietários/);
});

test("a conferência bloqueia sessões cobradas sem débito",()=>{
 const copy=deepCopy();
 copy.session_debits=copy.session_debits.filter(d=>d.session_id!==copy.session_records[0].id);
 assert.throws(()=>validateOwnership(copy),/exatamente um débito/);
});

test("a conferência bloqueia dois débitos ativos para a mesma sessão",()=>{
 const copy=deepCopy();
 copy.session_debits.push({...copy.session_debits[0],id:"outro-debito"});
 assert.throws(()=>validateOwnership(copy),/exatamente um débito/);
});

test("repetir o mesmo evento não cria uma segunda sessão",()=>{
 const copy=deepCopy();
 const same={...copy.session_records[0]};
 const one=registerOnce(copy.session_records,same);
 const two=registerOnce(copy.session_records,same);
 assert.equal(one.created,false);
 assert.equal(two.created,false);
 assert.equal(copy.session_records.length,fixture.session_records.length);
});

test("novo evento manual em outro proprietário não acessa dados da primeira conta",()=>{
 const copy=deepCopy();
 const before=copy.session_records.length;
 const one=registerOnce(copy.session_records,{
   id:"novo-evento-ficticio",owner_id:copy.owners[1].legacy_owner_id,
   patient_id:copy.patients[1].id,
   google_event_id:"manual:ficticio-distinto",charge_cents:0,status:"cancelled"});
 assert.equal(one.created,true);
 assert.equal(copy.session_records.length,before+1);
 assert.equal(summarize(copy,copy.patients[0].id).credit_cents,5000);
});

// Estes testes são APENAS matemáticos e de integridade da fixture.
// Eles não substituem testes de RLS, RPC ou Auth numa instância Neon real.
