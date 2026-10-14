/* Sprint 5 — interface de cadastro privado de pacientes.
 * Não confundir com dados fictícios de agenda e financeiro.
 */
(() => {
  "use strict";
  let chosen = null;
  let editor = null;
  let filter = "active";
  const initials = value => String(value || "").trim().split(/\s+/).slice(0, 2).map(x => x.slice(0,1).toUpperCase()).join("");
  // Draft stays only in JS memory while the form is open (never localStorage).
  // Necessary because app.render() replaces #app.innerHTML on auth/session updates.
  let draft = null;
  const captureDraft = () => {
    if (!editor || typeof document === "undefined") return;
    const form = document.getElementById("real-patient-form");
    if (!form || form.dataset.patientEditor !== String(editor)) return;
    const read = id => form.querySelector("#" + id)?.value ?? "";
    draft = {
      editor,
      full_name: read("real-patient-name"),
      fee: read("real-patient-fee"),
      cadence: read("real-patient-cadence"),
      birth_date: read("real-patient-birth-date"),
      cpf: read("real-patient-cpf"),
      email: read("real-patient-email")
    };
  };
  const clearDraft = () => { draft = null; };

  const store = () => window.ConsultorioPatients;
  const formatCpf = raw => {
    const value = String(raw || "").replace(/\D/g, "");
    return value.length === 11 ? value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : "";
  };
  const formatBirthDate = iso => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
    const [year,month,day] = iso.split("-");
    return day + "/" + month + "/" + year;
  };
  const todayISO = () => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const result = Object.fromEntries(parts.map(({type,value}) => [type,value]));
    return result.year + "-" + result.month + "-" + result.day;
  };
  const ui = {
    reset() { chosen = null; editor = null; filter = "active"; clearDraft(); },
    captureDraft,
    render(helpers) {
      // app.js builds HTML before replacing it; snapshot the live form first.
      captureDraft();
      const { head, I, esc, money, query } = helpers;
      const state = store()?.state || { rows: [], loading: false, busy: false, initialized: false, error: "Indisponível" };
      const row = state.rows.find(x => x.id === chosen);
      const editing = state.rows.find(x => x.id === editor);
      const selected = state.rows.filter(x => (filter === "all" || (filter === "active" ? x.is_active : !x.is_active))
        && x.full_name.toLocaleLowerCase("pt-BR").includes(String(query || "").toLocaleLowerCase("pt-BR")));
      const nActive = state.rows.filter(x => x.is_active).length;
      let output = head("patients", "<button class='btn primary' data-action='real-patient-new'>" + I("plus") + " Novo paciente</button>");
      output += "<div class='notice'>" + I("shield") + "<div><strong>Cadastros privados</strong><p>Dados administrativos protegidos no Supabase. A Agenda usa compromissos reais; o Financeiro e os Relatórios gerais ainda são demonstrações.</p></div></div>";
      if (state.loading && !state.initialized) return output + "<section class='card hcard'><div class='empty'>Carregando seus pacientes...</div></section>";
      if (state.error) return output + "<section class='card hcard'><div class='notice orange' role='alert'>" + I("info") + "<div>" + esc(state.error) + "</div></div><button class='btn' data-action='real-patient-reload'>Tentar novamente</button></section>";
      if (editor === "new" || editing) {
        const activeDraft = draft?.editor === editor ? draft : null;
        const name = activeDraft ? activeDraft.full_name : (editing?.full_name || "");
        const fee = activeDraft ? activeDraft.fee : (editing ? (editing.fee_cents / 100).toFixed(2).replace(".", ",") : "");
        const cadence = activeDraft ? activeDraft.cadence : (editing?.cadence || "Semanal");
        const birthDate = activeDraft ? activeDraft.birth_date : (editing?.birth_date || "");
        const cpf = activeDraft ? activeDraft.cpf : formatCpf(editing?.cpf);
        const email = activeDraft ? activeDraft.email : (editing?.email || "");
        const options = ["Semanal","Quinzenal","Mensal","Avulsa"].map(x => "<option value='" + x + "'" + (x === cadence ? " selected" : "") + ">" + x + "</option>").join("");
        output += "<section class='card hcard real-patient-form'><div class='card-head'><h2>" + (editing ? "Editar paciente" : "Novo paciente") + "</h2><span class='status unlinked'>Privado</span></div>"
          + "<p class='subhead'>Informações administrativas do paciente. Data de nascimento, CPF e e-mail são opcionais e privados. Não inclua informações clínicas.</p>"
          + "<form id='real-patient-form' data-patient-editor='" + esc(editor) + "' class='patient-form-grid' autocomplete='off'>"
          + "<label class='field patient-wide'>Nome do paciente<input id='real-patient-name' type='text' minlength='2' maxlength='120' required placeholder='Nome para identificação' value='" + esc(name) + "'></label>"
          + "<label class='field'>Valor por sessão (R$)<input id='real-patient-fee' type='text' inputmode='decimal' required placeholder='Ex.: 240,00' value='" + esc(fee) + "'></label>"
          + "<label class='field'>Frequência prevista<select id='real-patient-cadence'>" + options + "</select></label>"
          + "<div class='patient-wide patient-form-section-title'>Dados pessoais <small>(opcionais)</small></div>"
          + "<label class='field'>Data de nascimento<input id='real-patient-birth-date' type='date' min='1900-01-01' max='" + todayISO() + "' value='" + esc(birthDate) + "'></label>"
          + "<label class='field'>CPF<input id='real-patient-cpf' type='text' inputmode='numeric' maxlength='14' placeholder='000.000.000-00' autocomplete='off' value='" + esc(cpf) + "'></label>"
          + "<label class='field patient-wide'>E-mail<input id='real-patient-email' type='email' maxlength='254' inputmode='email' autocomplete='off' autocapitalize='off' spellcheck='false' placeholder='paciente@exemplo.com' value='" + esc(email) + "'></label>"
          + "<div class='patient-form-actions patient-wide'><button class='btn' type='button' data-action='real-patient-cancel'>Cancelar</button>"
          + "<button class='btn primary' type='submit'" + (state.busy ? " disabled" : "") + ">" + I("checkcircle") + (editing ? " Salvar alterações" : " Cadastrar paciente") + "</button></div></form></section>";
      }
      if (row) {
        output += "<section class='card hcard real-patient-detail'><div class='card-head'><h2>" + esc(row.full_name) + "</h2>"
          + "<span class='status " + (row.is_active ? "done" : "unlinked") + "'>" + (row.is_active ? "Ativo" : "Arquivado") + "</span></div>"
          + "<div class='profile-grid'><div class='profile-stat'><small>Valor por sessão</small><strong>" + money(row.fee_cents / 100) + "</strong></div>"
          + "<div class='profile-stat'><small>Frequência</small><strong>" + esc(row.cadence) + "</strong></div>"
          + "<div class='profile-stat'><small>Situação</small><strong>" + (row.is_active ? "Ativo" : "Arquivado") + "</strong></div></div>"
          + "<div class='real-patient-personal'><div class='card-head'><h3>Dados pessoais</h3><span class='muted'>Privado</span></div>"
          + "<div class='profile-grid'>"
          + "<div class='profile-stat'><small>Data de nascimento</small><strong>" + esc(formatBirthDate(row.birth_date) || "Não informado") + "</strong></div>"
          + "<div class='profile-stat'><small>CPF</small><strong class='patient-sensitive-value'>" + esc(formatCpf(row.cpf) || "Não informado") + "</strong></div>"
          + "<div class='profile-stat patient-email-stat'><small>E-mail</small><strong>" + esc(row.email || "Não informado") + "</strong></div>"
          + "</div></div>"
          + "<div class='patient-form-actions'><button class='btn' data-action='real-patient-back'>Voltar</button>"
          + "<button class='btn' data-action='real-patient-edit' data-id='" + esc(row.id) + "'>Editar</button>"
          + "<button class='btn " + (row.is_active ? "soft" : "primary") + "' data-action='real-patient-toggle' data-id='" + esc(row.id) + "'" + (state.busy ? " disabled" : "") + ">" + (row.is_active ? "Arquivar" : "Reativar") + "</button></div>"
          + "<div class='note-panel'>" + I("info") + "<span>As sessões confirmadas na Agenda geram débitos reais. Pagamentos recebidos ainda não estão implementados.</span></div></section>";
        const sessionState=window.ConsultorioSessions?.state||{historyPatientId:null,history:[],audit:[],historyLoading:false,historyError:""};
        const statuses={done:"Realizada",missed_charge:"Falta cobrada",missed_nocharge:"Falta sem cobrança",cancelled:"Cancelada",voided:"Registro desfeito"};
        const amount=cents=>money(Number(cents||0)/100);
        const fmtDateTime=raw=>{const d=new Date(raw);return Number.isFinite(d.getTime())?
          d.toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}):"Data indisponível";};
        output += "<section class='card hcard real-patient-sessions'><div class='card-head'><h2>Sessões e débitos reais</h2><span class='status done'>Supabase</span></div>"
          +"<p class='subhead'>Registros dos atendimentos confirmados. Os valores representam débitos, não pagamentos recebidos.</p>";
        if(sessionState.historyLoading||sessionState.historyPatientId!==row.id){
          output+="<div class='real-agenda-loading' role='status'>Carregando histórico privado de sessões...</div>";
        }else if(sessionState.historyError){
          output+="<div class='notice orange' role='alert'>"+I("info")+"<div>"+esc(sessionState.historyError)+"</div></div>"
            +"<button class='btn sm' data-action='real-patient-history-reload' data-id='"+esc(row.id)+"'>Tentar novamente</button>";
        }else if(!sessionState.history.length){
          output+="<div class='empty'>Nenhum atendimento registrado para este paciente. Confirme uma sessão na Agenda para iniciar o histórico.</div>";
        }else{
          output+="<p class='real-patient-history-count'>Últimos "+sessionState.history.length+" atendimento"+(sessionState.history.length===1?"":"s")+
           " registrado"+(sessionState.history.length===1?"":"s")+".</p>";
          for(const entry of sessionState.history){
            const changes=sessionState.audit.filter(a=>a.session_id===entry.id);
            output+="<article class='real-patient-history-item'><div class='real-patient-history-head'>"
              +"<strong>"+esc(fmtDateTime(entry.scheduled_at))+"</strong>"
              +"<span class='status "+(entry.charge_cents>0?"done":"unlinked")+"'>"+esc(statuses[entry.status]||entry.status)+"</span></div>"
              +"<p>Honorário da sessão: "+amount(entry.fee_snapshot_cents)
              +" · <strong>"+(entry.charge_cents>0?"Débito: "+amount(entry.charge_cents):"Sem débito")+"</strong></p>";
            if(changes.length>1){
              output+="<details class='real-patient-history-audit'><summary>Histórico de alterações ("+(changes.length-1)+")</summary><ol>"
                +changes.map(a=>"<li>"+esc(fmtDateTime(a.occurred_at))+" · "
                  +esc(a.reason==="initial"?"Registro inicial":"Correção")+": "
                  +esc(statuses[a.new_status]||a.new_status)+" · "
                  +(a.new_charge_cents>0?"Débito de "+amount(a.new_charge_cents):"Sem débito")+"</li>").join("")
                +"</ol></details>";
            }
            output+="</article>";
          }
        }
        output+="</section>";
      }
      const n = selected.length;
      output += "<section class='card table-card'><div class='real-list-header'><strong>Seus cadastros</strong><span class='muted'>" + nActive + " ativo" + (nActive === 1 ? "" : "s") + "</span></div>"
        + "<div class='toolbar real-patient-toolbar'><label class='search'>" + I("search") + "<input id='patient-search' placeholder='Buscar por nome' aria-label='Buscar pacientes' value='" + esc(query || "") + "' autocomplete='off'></label>"
        + "<div class='chip-bar'>" + [["active","Ativos"],["archived","Arquivados"],["all","Todos"]].map(([k,v]) =>
            "<button class='chip " + (filter === k ? "active" : "") + "' data-action='real-patient-filter' data-filter-value='" + k + "'>" + v + "</button>").join("") + "</div></div>"
        + (n ? selected.map((p,i) => "<div class='table-row'><div class='initials i" + (i%4) + "'>" + esc(initials(p.full_name)) + "</div>"
            + "<div class='tflex'><div class='person-name'>" + esc(p.full_name) + "</div><div class='person-sub'>" + esc(p.cadence) + " · " + money(p.fee_cents / 100) + " por sessão" + (p.is_active ? "" : " · Arquivado") + "</div></div>"
            + "<button class='btn sm' data-real-patient='" + esc(p.id) + "' aria-label='Abrir cadastro de " + esc(p.full_name) + "'>" + I("chev") + "</button></div>").join("")
            : "<div class='empty'>" + (state.rows.length ? "Nenhum resultado para este filtro." : "Nenhum paciente cadastrado. Selecione “Novo paciente”.") + "</div>")
        + "</section><p class='foot-note'>Os registros ficam no banco protegido, não no GitHub. Cadastros arquivados continuam preservados.</p>";
      return output;
    },
    select(id, render) { chosen = id; editor = null; clearDraft(); render();void window.ConsultorioSessions?.loadPatientHistory(id); },
    async handleClick(button, render, notify) {
      const act = button.dataset.action || "";
      if (!act.startsWith("real-patient-")) return false;
      if (act === "real-patient-new") { chosen = null; editor = "new"; clearDraft(); render(); }
      else if (act === "real-patient-cancel") { editor = null; clearDraft(); render(); }
      else if (act === "real-patient-back") { chosen = null; editor = null; clearDraft(); render(); }
      else if (act === "real-patient-edit") { chosen = button.dataset.id; editor = chosen; clearDraft(); render(); }
      else if (act === "real-patient-filter") { filter = button.dataset.filterValue || "active"; render(); }
      else if (act === "real-patient-reload") { await store()?.load(true); }
      else if (act === "real-patient-history-reload") { if(chosen)await window.ConsultorioSessions?.loadPatientHistory(chosen); }
      else if (act === "real-patient-toggle") {
        const id = button.dataset.id;
        const row = store()?.state.rows.find(x => x.id === id);
        if (!row) return true;
        const expected = row.is_active ? "arquivar" : "reativar";
        if (!window.confirm("Deseja " + expected + " este cadastro? Os registros não serão apagados.")) return true;
        const result = await store().setActive(id, !row.is_active);
        notify(result.ok ? "Cadastro atualizado." : result.message);
      }
      return true;
    },
    async handleSubmit(event, render, notify) {
      if (event.target?.id !== "real-patient-form") return false;
      event.preventDefault();
      const name = document.getElementById("real-patient-name")?.value || "";
      const raw = (document.getElementById("real-patient-fee")?.value || "").trim();
      const cadence = document.getElementById("real-patient-cadence")?.value || "Semanal";
      const birth_date = document.getElementById("real-patient-birth-date")?.value || null;
      const cpf = document.getElementById("real-patient-cpf")?.value || null;
      const email = document.getElementById("real-patient-email")?.value || null;
      if (!/^\d{1,6}([.,]\d{1,2})?$/.test(raw)) {
        notify("Informe um valor em reais, como 240,00."); return true;
      }
      const parts = raw.replace(",", ".").split(".");
      const cents = Number(parts[0]) * 100 + Number((parts[1] || "").padEnd(2,"0"));
      const id = editor === "new" ? null : editor;
      const result = await store().save({ full_name: name, fee_cents: cents, cadence, birth_date, cpf, email }, id);
      if (result.ok) { editor = null; chosen = result.id; clearDraft(); render(); void window.ConsultorioSessions?.loadPatientHistory(result.id); notify(id ? "Cadastro atualizado." : "Paciente cadastrado."); }
      else notify(result.message);
      return true;
    }
  };
  window.ConsultorioPatientsUI = ui;
})();
