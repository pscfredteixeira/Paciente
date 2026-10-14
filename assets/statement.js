/* Sprint 10: comparação local de extrato CSV com Pix já registrados.
   O arquivo fica exclusivamente em memória; nenhuma linha é enviada ao servidor.
   Apenas a confirmação explícita usa a RPC privada já existente. */
(()=>{
"use strict";
const listeners=new Set();
const notify=()=>{for(const f of listeners){try{f()}catch(_){}}};
const authorized=()=>window.ConsultorioAuth?.state.phase==="authorized";
const getFinance=()=>window.ConsultorioFinance;
const brl=n=>(n/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
let open=false,filename="",matrix=[],headerRow=0,mapping={date:-1,amount:-1,description:-1,type:-1,reference:-1};
let delimiter="",error="",loading=false,includeGeneric=false,saveReference=false,chosen=new Map(),completed=new Set(),revision=0;
let format="",importInfo=null;
const MAX_BYTES=2*1024*1024,MAX_ROWS=6000,MAX_VISIBLE=100;
const clear=()=>{
 revision++;open=false;filename="";matrix=[];headerRow=0;
 mapping={date:-1,amount:-1,description:-1,type:-1,reference:-1};
 delimiter="";error="";loading=false;includeGeneric=false;saveReference=false;chosen=new Map();completed=new Set();
 format="";importInfo=null;notify();
};
const folded=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const rowDate=value=>{
 const s=String(value||"").trim();
 let y,m,d,match;
 if(match=s.match(/^(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})(?:[ T].*)?$/)){d=+match[1];m=+match[2];y=+match[3];}
 else if(match=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/)){y=+match[1];m=+match[2];d=+match[3];}
 else return null;
 const dt=new Date(Date.UTC(y,m-1,d,12));
 if(y<2000||y>2100||!Number.isFinite(dt.getTime())||dt.getUTCFullYear()!==y||
   dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;
 return [y,String(m).padStart(2,"0"),String(d).padStart(2,"0")].join("-");
};
const moneyCents=value=>{
 let s=String(value??"").trim().replace(/[R$\s\u00a0]/g,"");
 if(!s||/[()]/.test(s)||s.startsWith("-"))return null;
 if(s.startsWith("+"))s=s.slice(1);
 let decimal="";
 if(s.includes(",")&&s.includes(".")){
   if(s.lastIndexOf(",")>s.lastIndexOf(".")){s=s.replace(/\./g,"");decimal=",";}
   else{s=s.replace(/,/g,"");decimal=".";}
 }else if(s.includes(",")){decimal=",";}
 else if(s.includes(".")){
   if(/^\d{1,3}(?:\.\d{3})+$/.test(s)){s=s.replace(/\./g,"");decimal="";}
   else decimal=".";
 }
 if(decimal){
   const pieces=s.split(decimal);
   if(pieces.length!==2||!pieces[0]||!pieces[1]||pieces[1].length>2||
     !/^\d{1,8}$/.test(pieces[0])||!/^\d{1,2}$/.test(pieces[1]))return null;
   const n=Number(pieces[0])*100+Number(pieces[1].padEnd(2,"0"));
   return n>0&&n<=99999999?n:null;
 }
 if(!/^\d{1,8}$/.test(s))return null;
 const n=Number(s)*100;
 return n>0&&n<=99999999?n:null;
};
const delimiterFor=text=>{
 const candidates=[";","\t",",","|"];
 const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean).slice(0,8);
 const count=(line,sep)=>{
   let quote=false,n=0;
   for(let i=0;i<line.length;i++){
     if(line[i]==='"'){if(quote&&line[i+1]==='"')i++;else quote=!quote;}
     else if(!quote&&line[i]===sep)n++;
   }
   return n;
 };
 return candidates.map(sep=>({sep,score:lines.reduce((a,line)=>a+count(line,sep),0),
   consistency:lines.filter(line=>count(line,sep)>0).length}))
   .sort((a,b)=>b.consistency-a.consistency||b.score-a.score)[0]?.sep||";";
};
const parseCSV=(text,sep)=>{
 const results=[],row=[];let field="",quoted=false;
 for(let i=0;i<text.length;i++){
   const c=text[i];
   if(c==='"'){
     if(quoted&&text[i+1]==='"'){field+='"';i++;}
     else quoted=!quoted;
   }else if(c===sep&&!quoted){row.push(field);field="";}
   else if((c==="\r"||c==="\n")&&!quoted){
     if(c==="\r"&&text[i+1]==="\n")i++;
     row.push(field);field="";
     if(row.some(x=>x.trim()))results.push(row.splice(0));
     else row.length=0;
     if(results.length>MAX_ROWS)throw Error("Arquivo muito longo. Exporte um período menor (máximo de 6 mil linhas).");
   }else field+=c;
 }
 if(quoted)throw Error("Este CSV contém aspas não fechadas.");
 row.push(field);
 if(row.some(x=>x.trim()))results.push(row);
 if(results.length<2)throw Error("Arquivo sem linhas de dados suficientes.");
 return results;
};
const columnNames=()=>matrix[headerRow]||[];
const suggestMapping=()=>{
 const header=columnNames().map(x=>folded(x).replace(/[^a-z0-9]+/g," ").trim());
 const used=new Set();
 const guess=(kind,re)=>{
   let idx=header.findIndex((h,i)=>!used.has(i)&&re.test(h));
   if(idx===-1)return -1;used.add(idx);return idx;
 };
 mapping={
   date:guess("date",/^(data|date|data lancamento|data da transacao|dt|data movimentacao|data de pagamento|data hora|data e hora|data da movimentacao|data da operacao)$/),
   amount:guess("amount",/^(valor|amount|valor r|quantia|valor da transacao|valor recebido|valor liquido|credito|entrada|valor da movimentacao|valor da operacao|valor credito)$/),
   description:guess("description",/^(descricao|historico|detalhes|detalhamento|detalhe|titulo|descricao da transacao|lancamento|descricao da movimentacao|observacao|transaction|identificacao|transacao)$/),
   type:guess("type",/^(tipo|natureza|categoria|operacao|credito debito|entrada saida|tipo de operacao)$/),
   reference:guess("reference",/^(id|identificador|endtoendid|end to end|id transacao|id da transacao|referencia|codigo transacao|transaction id)$/)
 };
};
const getValue=(row,kind)=>mapping[kind]<0?"":row[mapping[kind]]??"";
const possibleRows=()=>{
 if(mapping.date<0||mapping.amount<0)return[];
 const all=[];
 for(let i=headerRow+1;i<matrix.length;i++){
   const raw=matrix[i],day=rowDate(getValue(raw,"date")),cents=moneyCents(getValue(raw,"amount"));
   if(!day||cents===null)continue;
   const desc=String(getValue(raw,"description")||"").trim();
   const type=String(getValue(raw,"type")||"").trim();
   const detail=folded(desc+" "+type),nature=folded(type);
   if(/\b(saida|debito|enviado|transferencia enviada|pagamento efetuado|pix enviado|remessa)\b/.test(detail)||
     /^(d|s|db)$/.test(nature))continue;
   const isPix=/\bpix\b/.test(detail);
   if(!isPix&&!includeGeneric)continue;
   if(nature&&!/^(c|cr|entrada|credito|recebido|recebimento)$/.test(nature)
     &&!/\b(pix|entrada|credito|recebido|recebimento)\b/.test(nature)&&mapping.type>=0)
     continue;
   all.push({rowIndex:i,day,cents,description:desc.slice(0,140),type,
     reference:String(getValue(raw,"reference")||"").trim().slice(0,130),isPix});
 }
 return all;
};
const daysBetween=(a,b)=>{
 const n=x=>Date.parse(x+"T12:00:00Z");
 return Math.abs(n(a)-n(b))/86400000;
};
const suggestedMatches=()=>{
 const raw=possibleRows();
 const fin=getFinance()?.state;
 const live=fin?.payments?.filter(p=>p.method==="Pix"&&!p.voided_at&&!p.pix_verified_at)||[];
 const rows=raw.map(r=>{
   const candidates=live.filter(p=>p.amount_cents===r.cents&&daysBetween(r.day,p.paid_on)<=3)
     .sort((a,b)=>daysBetween(r.day,a.paid_on)-daysBetween(r.day,b.paid_on)||String(a.id).localeCompare(String(b.id)));
   return {...r,candidates};
 });
 return rows;
};
const stmt={
 get state(){return{open,filename,loading,error,hasFile:!!matrix.length,
   rowsCount:matrix.length,headerRow,mapping:{...mapping},selected:chosen.size,completed:completed.size,format,importInfo};},
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 clear,
 toggle(){if(!authorized())return;open=!open;notify();},
 async loadFile(file){
   if(!authorized())return;
   const req=++revision;
   filename="";matrix=[];chosen.clear();completed.clear();error="";format="";importInfo=null;loading=true;notify();
   try{
     if(!file||!/\.(csv|txt|ofx)$/i.test(file.name||""))
       throw Error("Selecione um arquivo .csv, .txt ou .ofx exportado pelo seu banco.");
     if(file.size<=0||file.size>MAX_BYTES)
       throw Error("Use um arquivo bancário de até 2 MB. Exporte um período menor, se necessário.");
     const buffer=await file.arrayBuffer();
     if(req!==revision||!authorized())return;
     let text;
     try{text=new TextDecoder("utf-8",{fatal:true}).decode(buffer);}
     catch(_){text=new TextDecoder("windows-1252").decode(buffer);}
     if(text.includes("\u0000"))throw Error("Arquivo inválido. Exporte um CSV ou OFX em vez de planilha XLSX.");
     const isOfx=/\.ofx$/i.test(file.name)||/<OFX(?:\s|>)/i.test(text);
     const result=isOfx?window.ConsultorioOfx?.parse(text):null;
     if(isOfx&&!result)throw Error("Leitor de OFX indisponível. Atualize a página.");
     const sep=isOfx?"":delimiterFor(text);
     const parsed=isOfx?result.matrix:parseCSV(text.replace(/^\uFEFF/,""),sep);
     if(req!==revision||!authorized())return;
     matrix=parsed;headerRow=0;delimiter=sep;filename=String(file.name).slice(0,110);
     format=isOfx?"OFX":"CSV";importInfo=isOfx?result:null;
     suggestMapping();
   }catch(e){if(req===revision){error=e?.message||"Não foi possível ler o CSV.";matrix=[];filename="";}}
   finally{if(req===revision){loading=false;notify();}}
 },
 mapColumn(kind,value){
   if(format==="OFX"||!Object.prototype.hasOwnProperty.call(mapping,kind))return;
   const n=Number(value);
   if(!Number.isSafeInteger(n)||n<-1||n>=columnNames().length)return;
   mapping[kind]=n;chosen.clear();completed.clear();notify();
 },
 setHeader(value){
   if(format==="OFX")return;
   const n=Number(value);
   if(!Number.isSafeInteger(n)||n<0||n>=Math.min(12,matrix.length-1))return;
   headerRow=n;suggestMapping();chosen.clear();completed.clear();notify();
 },
 setOption(kind,yes){
   if(kind==="generic"){includeGeneric=!!yes;chosen.clear();}
   else if(kind==="reference")saveReference=!!yes;
   else return;
   // Alternar a gravação opcional do ID não pode apagar a escolha do paciente.
   notify();
 },
 choose(index,paymentId){
   const idx=Number(index),row=suggestedMatches().find(r=>r.rowIndex===idx);
   if(!row||!row.candidates.some(p=>p.id===paymentId)){chosen.delete(idx);notify();return;}
   for(const [r,id] of chosen)if(r!==idx&&id===paymentId)chosen.delete(r);
   chosen.set(idx,paymentId);notify();
 },
 async verify(index){
   if(!authorized()||loading||!matrix.length)return{ok:false,message:"Nenhum extrato válido carregado."};
   const fin=getFinance();
   if(fin?.state.loading||fin?.state.saving||!fin?.state.initialized)
     return{ok:false,message:"Aguarde o financeiro terminar de atualizar."};
   const row=suggestedMatches().find(r=>r.rowIndex===Number(index));
   if(!row||completed.has(row.rowIndex))return{ok:false,message:"Movimentação já conferida ou indisponível."};
   const paymentId=chosen.get(row.rowIndex);
   const payment=row.candidates.find(p=>p.id===paymentId);
   if(!payment)return{ok:false,message:"Selecione o Pix correspondente antes de confirmar."};
   if([...chosen].some(([other,id])=>other!==row.rowIndex&&id===paymentId))
     return{ok:false,message:"Um Pix não pode ser associado a duas linhas do extrato."};
   const knownReference=String(row.reference||"").trim().toUpperCase();
   const ref=saveReference&&/^[A-Z0-9._:-]{3,100}$/.test(knownReference)?knownReference:null;
   const name=window.ConsultorioPatients?.state.rows.find(p=>p.id===payment.patient_id)?.full_name||"paciente";
   const confirmation="Conferir manualmente o Pix de "+brl(row.cents)+" do paciente "+name+"?\n\n"
     +"Extrato: "+row.day.split("-").reverse().join("/")+". Pagamento cadastrado: "
     +payment.paid_on.split("-").reverse().join("/")+".\n\n"
     +"Você conferiu que ambos representam o MESMO recebimento bancário? "
     +(ref?"O identificador será salvo junto ao pagamento. ":"")
     +"Esta operação não cria recebimentos nem altera saldos.";
   if(!window.confirm(confirmation))return{ok:false,cancelled:true,message:"Conferência cancelada."};
   const result=await fin.verifyPix(payment.id,true,ref);
   if(result.ok){completed.add(row.rowIndex);chosen.delete(row.rowIndex);await fin.reload();notify();}
   return result;
 },
 render({esc}){
   if(!authorized())return"";
   const fin=getFinance()?.state||{};
   let out='<section class="card hcard real-statement" id="real-statement">'
     +'<div class="card-head real-statement-heading"><div><h2>Conferir Pix com extrato CSV</h2>'
     +'<p class="real-statement-caption">Compare o extrato do banco com os Pix registrados, sem enviar o arquivo.</p></div>'
     +'<button class="btn sm" data-action="real-statement-toggle" aria-expanded="'+(open?'true':'false')+'" aria-controls="real-statement-content">'
     +(open?"Fechar":"Importar CSV")+'</button></div>';
   if(!open)return out+'</section>';
   out+='<div id="real-statement-content" class="real-statement-body">'
     +'<p class="real-statement-privacy">O arquivo é lido somente no seu aparelho e descartado ao sair da conta ou atualizar a página. Não são importados pagamentos automaticamente. Apenas as conferências que você confirmar serão salvas.</p>'
     +'<label class="field real-statement-picker">Arquivo CSV do banco (.csv ou .txt, até 2 MB)'
     +'<input id="real-statement-file" type="file" accept=".csv,.txt,text/csv,text/plain"></label>';
   if(loading)out+='<p role="status" class="real-session-muted">Lendo o extrato...</p>';
   if(error)out+='<p class="real-statement-error" role="alert">'+esc(error)+'</p>';
   if(!matrix.length)return out+'</div></section>';
   const headers=columnNames(),kinds=[["date","Data"],["amount","Valor"],["description","Descrição"],["type","Tipo de movimentação"],["reference","Identificador Pix"]];
   out+='<div class="real-statement-fileinfo"><span>'+esc(filename)+'</span><span>'+matrix.length+' linhas lidas</span></div>'
     +'<div class="real-statement-mapping"><label class="field">Linha do cabeçalho'
     +'<select data-statement-header="yes">'+matrix.slice(0,Math.min(matrix.length-1,12)).map((line,i)=>
      '<option value="'+i+'"'+(headerRow===i?' selected':'')+'>'+(i+1)+' — '+esc(line.slice(0,2).join(" · ").slice(0,75))+'</option>').join('')+'</select></label>';
   for(const [kind,label] of kinds){
     out+='<label class="field">'+label+(kind==="date"||kind==="amount"?" *":" (opcional)")
       +'<select data-statement-column="'+kind+'"><option value="-1">Não usar</option>'
       +headers.map((col,i)=>'<option value="'+i+'"'+(mapping[kind]===i?' selected':'')+'>'
         +esc(col||"Coluna "+(i+1))+'</option>').join('')+'</select></label>';
   }
   out+='</div>';
   if(mapping.date<0||mapping.amount<0){
     return out+'<p class="real-statement-error">Selecione as colunas Data e Valor para comparar o extrato.</p></div></section>';
   }
   out+='<div class="real-statement-options">'
     +'<label><input type="checkbox" data-statement-option="generic"'+(includeGeneric?' checked':'')+'> Incluir outras entradas positivas, mesmo sem a palavra Pix (revisar com cuidado)</label>'
     +'<label><input type="checkbox" data-statement-option="reference"'+(saveReference?' checked':'')+'> Salvar o identificador do Pix ao confirmar, quando disponível</label>'
     +'</div>';
   const matches=suggestedMatches(),eligible=matches.filter(r=>r.candidates.length||completed.has(r.rowIndex));
   out+='<div class="real-statement-results"><div class="real-statement-results-head"><strong>Comparação de lançamentos</strong>'
     +'<span>'+eligible.length+' possível'+(eligible.length===1?'':'is')+' correspondência'+(eligible.length===1?'':'s')+'</span></div>';
   if(fin.loading)out+='<p class="real-session-muted">Atualizando pagamentos para comparar...</p>';
   if(!eligible.length)out+='<div class="real-statement-empty">Nenhuma correspondência encontrada. Confira as colunas, o período e os valores. Só são sugeridos Pix já registrados com o mesmo valor e diferença máxima de três dias.</div>';
   const used=new Set([...chosen.values()]);
   for(const row of eligible.slice(0,MAX_VISIBLE)){
     const done=completed.has(row.rowIndex);
     const pick=chosen.get(row.rowIndex)||"";
     out+='<article class="real-statement-row">'
       +'<div class="real-statement-row-title"><strong>'+brl(row.cents)+'</strong>'
       +'<span>'+esc(row.day.split("-").reverse().join("/"))+'</span></div>'
       +'<p class="real-statement-row-description">'+esc(row.description||row.type||"Entrada positiva")+'</p>';
     if(done)out+='<span class="status done">Conferido nesta importação</span>';
     else{
       out+='<label class="field">Corresponde ao pagamento registrado'
         +'<select data-statement-match="'+row.rowIndex+'">'
         +'<option value="">Selecione o paciente e pagamento</option>'
         +row.candidates.map(p=>{
           const who=window.ConsultorioPatients?.state.rows.find(x=>x.id===p.patient_id)?.full_name||"Paciente";
           const disabled=used.has(p.id)&&pick!==p.id;
           return '<option value="'+esc(p.id)+'"'+(pick===p.id?' selected':'')+(disabled?' disabled':'')+'>'
             +esc(who)+' · '+esc(p.paid_on.split("-").reverse().join("/"))+' · '+brl(p.amount_cents)+'</option>';
         }).join('')+'</select></label>'
         +'<button class="btn primary sm" data-action="real-statement-confirm" data-statement-row="'+row.rowIndex+'"'+
         (!pick||fin.loading||fin.saving?' disabled':'')+'>Marcar este Pix como conferido</button>';
     }
     out+='</article>';
   }
   if(eligible.length>MAX_VISIBLE)out+='<p class="real-session-muted">Exibindo as primeiras '+MAX_VISIBLE+' linhas correspondentes. Exporte um período mais curto para as demais.</p>';
   return out+'</div><button class="btn sm" data-action="real-statement-clear">Descartar extrato importado</button></div></section>';
 },
 async click(target,render,toast){
   const action=target.dataset.action||"";
   if(!action.startsWith("real-statement-"))return false;
   if(action==="real-statement-toggle"){stmt.toggle();return true;}
   if(action==="real-statement-clear"){clear();open=true;notify();toast("Arquivo descartado da memória.");return true;}
   if(action==="real-statement-confirm"){
     const result=await stmt.verify(target.dataset.statementRow);
     if(!result.cancelled)toast(result.message);
     return true;
   }
   return true;
 },
 change(target){
   if(!authorized())return;
   if(target.id==="real-statement-file"){void stmt.loadFile(target.files?.[0]);return;}
   if(target.dataset.statementHeader)stmt.setHeader(target.value);
   else if(target.dataset.statementColumn)stmt.mapColumn(target.dataset.statementColumn,target.value);
   else if(target.dataset.statementOption)stmt.setOption(target.dataset.statementOption,target.checked);
   else if(target.dataset.statementMatch)stmt.choose(target.dataset.statementMatch,target.value);
 }
};
window.ConsultorioStatement=stmt;
})();