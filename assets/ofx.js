/* Sprint 11 — leitor OFX 1.x (SGML) e 2.x (XML) totalmente local.
   Dados bancários não são armazenados nem enviados pela rede. */
(()=>{
"use strict";
const MAX_TRANSACTIONS=6000;
const entities=s=>String(s||"").replace(/&(?:amp|lt|gt|quot|apos|#x[0-9a-f]{1,6}|#[0-9]{1,7});/gi,match=>{
 const name=match.slice(1,-1).toLowerCase();
 const simple={amp:"&",lt:"<",gt:">",quot:'"',apos:"'"};
 if(Object.prototype.hasOwnProperty.call(simple,name))return simple[name];
 const code=name.startsWith("#x")?parseInt(name.slice(2),16):parseInt(name.slice(1),10);
 if(!Number.isSafeInteger(code)||code<=0||code>0x10FFFF||
    (code>=0xD800&&code<=0xDFFF))return "";
 return String.fromCodePoint(code);
});
const getField=(block,name)=>{
 // Leaf-value forms from both OFX SGML and XML; never treat the input as HTML.
 const re=new RegExp("<"+name+"(?:\\s[^>]*)?>\\s*([^<\\r\\n]*)","i");
 const m=re.exec(block);
 return m?entities(m[1].trim()).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").trim():"";
};
const validDate=s=>{
 const m=String(s||"").match(/^(\d{4})(\d{2})(\d{2})/);
 if(!m)return null;
 const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
 const dt=new Date(Date.UTC(y,mo-1,d,12));
 if(y<2000||y>2100||dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d)return null;
 return m[1]+"-"+m[2]+"-"+m[3];
};
const normalizedAmount=s=>{
 const raw=String(s||"").trim().replace(",",".");
 if(!/^[+-]?\d{1,10}(?:\.\d{1,6})?$/.test(raw))return null;
 const n=Number(raw);
 if(!Number.isFinite(n)||n===0||Math.abs(n)>999999.99)return null;
 const cents=Math.round(n*100);
 if(Math.abs(n*100-cents)>0.0001)return null;
 return {cents,decimal:(cents/100).toFixed(2)};
};
const parse=(raw)=>{
 const text=String(raw||"").replace(/^\uFEFF/,"");
 if(!/<OFX(?:\s|>)/i.test(text)||!/<STMTTRN(?:\s|>)/i.test(text))
   throw Error("Este arquivo não contém movimentações OFX reconhecíveis.");
 const accounts=(text.match(/<BANKACCTFROM(?:\s|>)/gi)||[]).length;
 if(accounts>1)throw Error("O OFX parece conter várias contas. Exporte somente a conta que deseja conferir.");
 if(/<CCSTMTTRNRS(?:\s|>)/i.test(text))
   throw Error("Este OFX inclui lançamentos de cartão de crédito. Exporte o extrato da conta bancária.");
 const currency=getField(text,"CURDEF").toUpperCase();
 if(currency&&currency!=="BRL")throw Error("O extrato indica moeda "+currency+". A conferência aceita apenas valores em reais (BRL).");
 const sections=text.match(/<STMTTRN(?:\s[^>]*)?>[\s\S]*?<\/STMTTRN\s*>/gi)||[];
 if(!sections.length)throw Error("Nenhuma transação OFX completa foi encontrada.");
 if(sections.length>MAX_TRANSACTIONS)
   throw Error("O OFX tem mais de 6 mil transações. Exporte um período menor.");
 const matrix=[["Data","Valor","Descrição","Tipo","Identificador"]];
 let outgoing=0,invalid=0,valid=0,duplicates=0;
 const seenIds=new Map();
 for(const section of sections){
   const date=validDate(getField(section,"DTPOSTED"));
   const amount=normalizedAmount(getField(section,"TRNAMT"));
   const type=getField(section,"TRNTYPE").toUpperCase();
   if(amount&&amount.cents<0){outgoing++;continue;}
   if(type==="DEBIT"||type==="PAYMENT"||type==="POS"||type==="ATM"||type==="CHECK"){
     outgoing++;continue;
   }
   if(!date||!amount||!amount.cents){invalid++;continue;}
   const title=getField(section,"NAME")||getField(section,"PAYEE");
   const memo=getField(section,"MEMO");
   const description=[title,memo].filter(Boolean).filter((v,i,a)=>i===0||v!==a[0])
     .join(" · ").slice(0,400);
   const reference=getField(section,"FITID").slice(0,130);
   if(reference){
     const signature=date+"/"+amount.cents;
     if(seenIds.has(reference)){
       if(seenIds.get(reference)!==signature){
         throw Error("O OFX contém movimentos diferentes com o mesmo identificador. Exporte um período menor e confira no banco.");
       }
       duplicates++;continue;
     }
     seenIds.set(reference,signature);
   }
   // CREDIT describes direction, not proof that this was Pix.
   matrix.push([date,amount.decimal,description,"Crédito",reference]);
   valid++;
 }
 if(!valid)throw Error("Este OFX não contém entradas positivas válidas para comparar. Saídas e débitos são ignorados.");
 return {matrix,format:"OFX",total:sections.length,eligible:valid,outgoing,invalid,duplicates,
   warning:!currency?"Confirme que o extrato é de uma conta em reais (BRL).":""};
};
window.ConsultorioOfx={parse};
})();