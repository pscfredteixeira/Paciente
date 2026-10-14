/* Sprint 14 — extrato individual privado com filtros e CSV gerado no aparelho. */
(()=>{
"use strict";
const selection=new Map(),visible=new Map();
const isAuthorized=()=>window.ConsultorioAuth?.state.phase==="authorized";
const patients=()=>window.ConsultorioPatients?.state.rows||[];
const finance=()=>window.ConsultorioFinance;
const brl=n=>(Number(n||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const prettyDate=d=>String(d||"").split("-").reverse().join("/");
const validMonth=s=>/^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const movement=e=>e.voided?0:e.type==="debit"?Number(e.amount_cents||0):-Number(e.amount_cents||0);
const chosenMonth=id=>selection.get(id)||"all";
const history=id=>{
 if(!isAuthorized()||!patients().some(p=>p.id===id)||!finance()?.state?.initialized||finance()?.state?.error)
  return null;
 const all=finance().ledgerFor(id);
 const months=[...new Set(all.map(e=>String(e.day||"").slice(0,7)).filter(validMonth))].sort().reverse();
 const requested=chosenMonth(id);
 const current=requested==="all"||months.includes(requested)?requested:"all";
 const rows=current==="all"?all:all.filter(e=>e.day.slice(0,7)===current);
 const earlier=current==="all"?[]:all.filter(e=>e.day.slice(0,7)<current);
 const opening=earlier.reduce((a,e)=>a+movement(e),0);
 const charged=rows.filter(e=>e.type==="debit").reduce((a,e)=>a+Number(e.amount_cents||0),0);
 const received=rows.filter(e=>e.type==="payment"&&!e.voided).reduce((a,e)=>a+Number(e.amount_cents||0),0);
 const closing=opening+charged-received;
 return {id,months,current,rows,opening,charged,received,closing,voided:rows.filter(e=>e.voided).length};
};
const currencyCSV=n=>(Number(n||0)/100).toFixed(2).replace(".",",");
const cell=value=>{
 const raw=String(value??"").replace(/[\r\n\t]/g," ").trim();
 const prefix=/^[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/.test(raw)?"'":"";
 return '"'+(prefix+raw).replace(/"/g,'""')+'"';
};
const csv=(id)=>{
 const p=patients().find(x=>x.id===id),report=history(id);
 if(!p||!report)throw Error("Extrato não disponível");
 const rows=[
  ["Extrato financeiro privado","Meu Consultório"],
  ["Paciente",p.full_name],
  ["Período",report.current==="all"?"Todo o histórico":report.current],
  ["Aviso","Informações particulares: guarde este arquivo em local protegido."],
  ["Critério","Saldo agregado do paciente: cobranças menos pagamentos. Não há quitação por sessão individual."],
  ["Saldo inicial (R$)",currencyCSV(report.opening)],
  ["Cobrado no período (R$)",currencyCSV(report.charged)],
  ["Recebido no período (R$)",currencyCSV(report.received)],
  ["Saldo final (R$)",currencyCSV(report.closing)],
  [],
  ["Data","Lançamento","Situação","Valor registrado (R$)","Impacto no saldo (R$)","Saldo acumulado (R$)"],
  ...report.rows.map(e=>{
   const nominal=e.type==="debit"?e.amount_cents:-e.amount_cents;
   return [prettyDate(e.day),e.label,e.voided?"Estornado":"Ativo",
    currencyCSV(nominal),currencyCSV(movement(e)),currencyCSV(e.running_cents)];
  })
 ];
 return "\uFEFF"+rows.map(row=>row.map(cell).join(";")).join("\r\n")+"\r\n";
};
const balanceLabel=n=>n>0?"A receber "+brl(n):n<0?"Crédito disponível "+brl(-n):"Saldo zerado";
const fmtMonth=m=>new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"})
 .format(new Date(m+"-15T12:00:00Z"));
const app={
 getReport:history,makeCsv:csv,
 clear(){selection.clear();visible.clear();},
 setMonth(id,month){
  const report=history(id);
  if(!report||!(month==="all"||report.months.includes(month)))return false;
  selection.set(id,month);visible.set(id,30);return true;
 },
 showMore(id){
  const report=history(id);if(!report)return false;
  visible.set(id,Math.min(report.rows.length,(visible.get(id)||30)+30));return true;
 },
 render(id,{esc}){
  if(!isAuthorized()||!patients().some(p=>p.id===id))return"";
  const state=finance()?.state;
  if(!state?.initialized||state?.loading&&!state?.sessions?.length||state.error)
   return'<section class="card hcard"><div class="empty">O extrato será exibido quando o Financeiro terminar de carregar.</div></section>';
  const report=history(id);
  if(!report)return'<section class="card hcard"><div class="empty">Extrato indisponível no momento.</div></section>';
  const view=report.rows.slice().reverse().slice(0,visible.get(id)||30);
  let out='<section class="card hcard real-patient-extract"><div class="card-head"><div>'
   +'<h2>Extrato financeiro do paciente</h2><p class="real-session-muted">Sessões cobradas e pagamentos registrados, com saldo acumulado.</p></div>'
   +'</div><div class="real-patient-extract-actions">'
   +'<label class="field">Período<select data-patient-extract-month="'+esc(id)+'" aria-label="Filtrar extrato financeiro">'
   +'<option value="all"'+(report.current==="all"?" selected":"")+'>Todo o histórico</option>'
   +report.months.map(m=>'<option value="'+m+'"'+(report.current===m?" selected":"")+'>'+esc(fmtMonth(m))+'</option>').join('')
   +'</select></label>'
   +'<button class="btn sm" data-action="patient-extract-export" data-patient-id="'+esc(id)+'">Exportar CSV para Excel</button></div>'
   +'<div class="real-patient-extract-metrics">'
   +[['Saldo inicial',report.opening],['Cobrado no período',report.charged],
      ['Recebido no período',report.received]]
     .map(([title,cents])=>'<div><small>'+esc(title)+'</small><strong>'+brl(cents)+'</strong></div>').join('')
   +'</div><div class="real-patient-extract-closing"><small>Saldo ao fim do período</small>'
   +'<strong>'+esc(balanceLabel(report.closing))+'</strong></div>'
   +'<p class="real-session-muted">O saldo é global por paciente: não indica que determinada sessão foi paga. '
   +'Lançamentos estornados aparecem apenas para consulta e não afetam o saldo.</p>';
  if(!report.rows.length)out+='<div class="empty">Nenhuma sessão cobrada ou pagamento neste período.</div>';
  for(const e of view){
   out+='<div class="real-patient-extract-row"><div><strong>'+esc(e.label)+'</strong>'
     +'<small>'+esc(prettyDate(e.day))+(e.voided?' · Estornado':'')+'</small>'
     +'<small>Após o lançamento: '+esc(balanceLabel(e.running_cents))+'</small></div>'
     +'<strong class="'+(e.type==="payment"?"is-incoming":"is-debit")+
       (e.voided?" is-voided":"")+'">'+(e.type==="payment"?"−":"+")+brl(e.amount_cents)+'</strong>'
     +'</div>';
  }
  if(view.length<report.rows.length)
    out+='<button class="btn real-patient-extract-more" data-action="patient-extract-more" data-patient-id="'+esc(id)+'">'
    +'Mostrar mais '+Math.min(30,report.rows.length-view.length)+' movimentações</button>';
  out+='<p class="real-patient-extract-footnote">'+report.rows.length+' movimentação'+
     (report.rows.length===1?"":"ões")+' no período. O CSV inclui todas as linhas do filtro, mesmo as não exibidas na tela.</p>';
  return out+'</section>';
 },
 async click(target,render,toast){
  if(!isAuthorized())return false;
  const action=target.dataset.action||"";
  if(!action.startsWith("patient-extract-"))return false;
  const id=target.dataset.patientId;
  if(!history(id)){toast("Extrato indisponível. Atualize o Financeiro.");return true;}
  if(action==="patient-extract-more"){app.showMore(id);render();return true;}
  if(action!=="patient-extract-export")return true;
  const report=history(id);
  const p=patients().find(x=>x.id===id);
  if(!window.confirm("Exportar "+report.rows.length+" movimentação"+(report.rows.length===1?"":"ões")+
    " do extrato de "+p.full_name+"?\n\nO CSV contém nome e valores particulares do paciente. Guarde-o em local privado."))return true;
  try{
   const content=csv(id),blob=new Blob([content],{type:"text/csv;charset=utf-8"});
   const url=URL.createObjectURL(blob),link=document.createElement("a");
   link.href=url;link.download="meu-consultorio-extrato-"+(report.current==="all"?"completo":report.current)+".csv";
   link.style.display="none";document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
   toast("Extrato CSV gerado somente neste aparelho. Guarde-o em local privado.");
  }catch(_){toast("Não foi possível gerar o extrato. Tente novamente.");}
  return true;
 }
};
window.ConsultorioPatientExtract=app;
})();