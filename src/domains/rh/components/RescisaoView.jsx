// ===================================================================
// RescisaoView — tela "Cálculo de Rescisão", extraída de
// src/LegacyApp.jsx em 2026-08-20, mesma técnica já usada para os
// módulos anteriores (verbatim, mesma camada de dados, sem nova
// migration/RLS). Ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md.
// ===================================================================

import { useState } from "react";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import {
  Btn, C, Ic, Inp, Modal, PageHero, Sel,
  escapeHtml, fmt, fmtDateFull, today, uid,
} from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { isAdvanceActive } from "../advance-commands";
import {
  calculateRescission, RESCISSION_TYPE_LABEL, RESCISSION_TYPES,
} from "../rescission-calculations";
import { isRescissionActive } from "../rescission-commands";

const fmtCPF = value => {
  const v = String(value || "").replace(/\D/g, "").slice(0, 11);
  return v
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

function Rescisao({ data, showToast, currentUser, dispatchCommand }) {
  const { formGrid } = useBreakpoint();
  const emptyForm = {
    empId: "", empName: "", empCPF: "", empFuncao: "", obraId: "", obraName: "",
    admissao: "", demissao: today(), valorMensal: "", diasNoMes: "",
    tipo: "sem_justa_causa",
    // Preenchido por selectEmp() quando o funcionário já tem terminationType
    // registrado em Equipe, só para controlar a nota "herdado" abaixo do
    // campo - nunca trava o campo, o usuário pode sobrescrever livremente.
    tipoHerdado: "",
    valorFixoAcordo: "",
    incluirSaldo: true, incluir13: true, incluirFerias: true,
    incluirAviso: false,
    descAdiantamento: "", descOutros: "", obsDesc: "",
    obs: "",
  };

  const [form, setForm]       = useState(emptyForm);
  const [history, setHistory] = useState(false); // toggle
  const [salvando, setSalvando] = useState(false);
  const [rescCancelModal, setRescCancelModal] = useState(null);
  const [rescCancelReason, setRescCancelReason] = useState("");
  const F = k => v => setForm(f => ({ ...f, [k]: v }));

  // Ao selecionar funcionário da lista
  const selectEmp = empId => {
    if (!empId) { setForm(f => ({ ...f, empId:"", empName:"", empCPF:"", empFuncao:"", obraId:"", obraName:"", admissao:"", valorMensal:"", diasNoMes:"", tipoHerdado:"" })); return; }
    const emp = data.employees.find(e => e.id === empId);
    if (!emp) return;
    const obra = data.obras.find(o => o.id === emp.obra);
    const vm   = Number(emp.dailyRate || 0) * 26; // 26 dias úteis/mês
    // Achado de auditoria de 20/08/2026: somava TODO adiantamento do
    // funcionário, inclusive os já cancelados/estornados, sugerindo um
    // desconto maior do que a dívida real na rescisão.
    const pendAdv = (data.advances||[]).filter(a => a.empId === empId && isAdvanceActive(a)).reduce((s,a)=>s+Number(a.amount||0),0);
    // O motivo de desligamento registrado em Equipe já é salvo no vocabulário
    // de RESCISSION_TYPES (ver DISMISSAL_TO_RESCISSION_TYPE), então pode ser
    // herdado diretamente aqui. Só funcionários desligados depois desta
    // mudança têm o campo - registros antigos ficam sem herança, sem
    // migração retroativa.
    const tipoHerdado = RESCISSION_TYPES.some(item => item.v === emp.terminationType) ? emp.terminationType : "";
    setForm(f => ({
      ...f,
      empId, empName: emp.name, empCPF: emp.cpf||"",
      empFuncao: emp.role||"", obraId: obra?.id||"", obraName: obra?.name||"",
      admissao: emp.startDate||"",
      valorMensal: String(Math.round(vm)),
      descAdiantamento: pendAdv > 0 ? String(pendAdv) : "",
      tipo: tipoHerdado || f.tipo,
      tipoHerdado,
    }));
  };

  const calc = calculateRescission(form);

  // Salvar rescisão
  const salvar = async () => {
    if (!form.empName.trim() || !calc) { showToast("Preencha os dados obrigatórios.", "error"); return; }
    if (!dispatchCommand) { showToast("A rescisão exige conexão com o servidor.", "error"); return; }
    setSalvando(true);
    let result;
    try{
      result=await dispatchCommand(() => ({
        type:OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CREATED,
        idempotencyKey:`rescisao-criar-${uid()}`,
        expectedVersion:0,
        actorId:currentUser?.id||"",
        actorName:currentUser?.nome||"",
        payload:{ rescission:{ ...form, id:uid() } },
      }));
    }catch{
      result={ok:false,reason:"O servidor não respondeu ao registro da rescisão."};
    }finally{
      setSalvando(false);
    }
    if (!result.ok) { showToast(result.reason||"Não foi possível salvar a rescisão.", "error"); return; }
    setForm(emptyForm);
    showToast("Rescisão salva no histórico.");
  };

  const cancelarRescisao = registro => { setRescCancelModal(registro); setRescCancelReason(""); };

  const confirmCancelarRescisao = async () => {
    const registro = rescCancelModal;
    if (!registro) return;
    if(!rescCancelReason.trim()){showToast("Informe o motivo do cancelamento.","error");return;}
    if(!dispatchCommand){showToast("O cancelamento exige conexão com o servidor.","error");return;}
    setSalvando(true);
    let result;
    try{
      result=await dispatchCommand(atual=>{
        const vigente=(atual.rescisoes||[]).find(item=>item.id===registro.id);
        return {
          type:OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CANCELLED,
          idempotencyKey:`rescisao-cancelar-${registro.id}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),
          actorId:currentUser?.id||"",
          actorName:currentUser?.nome||"",
          payload:{rescissionId:registro.id,reason:rescCancelReason.trim()},
        };
      });
    }catch{
      result={ok:false,reason:"O servidor não respondeu ao cancelamento da rescisão."};
    }finally{
      setSalvando(false);
    }
    if(!result.ok){showToast(result.reason||"Não foi possível cancelar a rescisão.","error");return;}
    setRescCancelModal(null); setRescCancelReason("");
    showToast("Rescisão cancelada e preservada.");
  };

  // Gerar PDF
  // Aceita um registro do histórico. O registro salvo é {...form, ...calc},
  // logo carrega tanto os dados cadastrais quanto o cálculo - é o que permite
  // reemitir o PDF direto do histórico, sem reabrir o formulário.
  const gerarPDF = (registro = null) => {
    const fonte = registro || form;
    const c     = registro || calc;
    if (!c) { showToast("Complete o cálculo primeiro.", "error"); return; }
    const tempoStr = `${c.anos > 0 ? c.anos+"a " : ""}${c.totalMeses % 12}m ${c.diasResto}d`;
    const rows = c.isAcordoInterno
      ? [["Acordo interno - valor fixo x tempo ativo",
          `${fmt(c.valorFixoAcordo)} x ${c.mesesAtivos.toFixed(2)} meses`,
          c.totalBruto]]
      : [
          fonte.incluirSaldo  && ["Saldo de salário",   `${fonte.diasNoMes} dias em ${fmtDateFull(fonte.demissao)}`, c.saldoSalario],
          fonte.incluir13     && [`13º salário proporcional`, `${c.avos13}/12 avos`, c.dec13],
          fonte.incluirFerias && [`Férias proporcionais + 1/3`, `${c.avosFerias}/12 avos x 4/3`, c.feriasTotal],
          fonte.incluirAviso  && c.avisoPrevio > 0 && ["Aviso prévio", "30 dias", c.avisoPrevio],
        ].filter(Boolean);
    const descs = [
      Number(fonte.descAdiantamento||0) > 0 && ["Adiantamentos", Number(fonte.descAdiantamento)],
      Number(fonte.descOutros||0) > 0       && [fonte.obsDesc||"Outros descontos", Number(fonte.descOutros)],
    ].filter(Boolean);

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Rescisão - ${escapeHtml(fonte.empName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Arial',sans-serif;color:#111;background:#fff;padding:32px;font-size:12px}
  .header{display:flex;align-items:center;gap:16px;padding-bottom:16px;border-bottom:3px solid #111;margin-bottom:20px}
  .logo-box{background:#080808;color:#D4AF37;padding:10px 16px;font-family:Georgia,serif;font-size:26px;font-weight:900;letter-spacing:2px;flex-shrink:0}
  .company-info h1{font-size:18px;font-weight:900;letter-spacing:1px}
  .company-info p{font-size:11px;color:#555;margin-top:3px}
  h2{font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin:18px 0 10px;border-bottom:1px solid #ccc;padding-bottom:5px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-bottom:16px}
  .info-item p.lbl{font-size:10px;color:#777;text-transform:uppercase;font-weight:700;letter-spacing:.5px}
  .info-item p.val{font-size:13px;font-weight:600;margin-top:1px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th{background:#111;color:#fff;padding:8px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  td{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px}
  td.right{text-align:right;font-weight:700}
  tr.desc td{color:#c00}
  tr.subtotal td{background:#f5f5f5;font-weight:900;font-size:13px}
  tr.total td{background:#111;color:#fff;font-size:15px;font-weight:900;padding:12px 10px}
  .ext-valor{font-size:12px;color:#555;margin:10px 0 20px;font-style:italic}
  .declaracao{background:#f9f9f9;border:1px solid #ddd;padding:14px;margin:20px 0;font-size:11px;line-height:1.6}
  .signs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}
  .sign-box{border-top:1px solid #111;padding-top:8px;text-align:center}
  .sign-box p{font-size:11px;color:#333;margin-top:4px}
  .sign-box .name{font-weight:900;font-size:13px;margin-top:2px}
  .footer{margin-top:30px;text-align:center;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:10px}
  @media print{button{display:none!important}}
</style>
</head>
<body>
<button onclick="window.print()" style="position:fixed;top:10px;right:10px;background:#111;color:#D4AF37;border:none;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;z-index:99"> Imprimir / PDF</button>

<div class="header">
  <div class="logo-box">ArcD</div>
  <div class="company-info">
    <h1>${escapeHtml(data.config.companyName||"ArcD Construtora")}</h1>
    ${data.config.cnpj?`<p>CNPJ: ${escapeHtml(data.config.cnpj)}</p>`:""}
    <p>Recibo de Rescisão de Contrato de Trabalho</p>
  </div>
</div>

<h2>Dados do Trabalhador</h2>
<div class="info-grid">
  <div class="info-item"><p class="lbl">Nome</p><p class="val">${escapeHtml(fonte.empName)}</p></div>
  <div class="info-item"><p class="lbl">CPF</p><p class="val">${escapeHtml(fonte.empCPF||"-")}</p></div>
  <div class="info-item"><p class="lbl">Função</p><p class="val">${escapeHtml(fonte.empFuncao||"-")}</p></div>
  <div class="info-item"><p class="lbl">Obra</p><p class="val">${escapeHtml(fonte.obraName||"-")}</p></div>
  <div class="info-item"><p class="lbl">Data de Admissão</p><p class="val">${fmtDateFull(fonte.admissao)||"-"}</p></div>
  <div class="info-item"><p class="lbl">Data de Rescisão</p><p class="val">${fmtDateFull(fonte.demissao)||"-"}</p></div>
  <div class="info-item"><p class="lbl">Tempo de Serviço</p><p class="val">${tempoStr}</p></div>
  <div class="info-item"><p class="lbl">Motivo</p><p class="val">${escapeHtml(RESCISSION_TYPE_LABEL[fonte.tipo]||fonte.tipo)}</p></div>
  <div class="info-item"><p class="lbl">Valor Mensal</p><p class="val">R$ ${Number(fonte.valorMensal||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</p></div>
</div>

<h2>Demonstrativo de Valores</h2>
<table>
  <thead><tr><th>Verba</th><th>Base de Cálculo</th><th style="text-align:right">Valor (R$)</th></tr></thead>
  <tbody>
    ${rows.map(([v,b,val])=>`<tr><td>${escapeHtml(v)}</td><td style="color:#555">${escapeHtml(b)}</td><td class="right">R$ ${Number(val).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>`).join("")}
    <tr class="subtotal"><td colspan="2">Subtotal de Vencimentos</td><td class="right">R$ ${c.totalBruto.toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>
    ${descs.map(([v,val])=>`<tr class="desc"><td>(-) ${escapeHtml(v)}</td><td></td><td class="right">R$ ${Number(val).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>`).join("")}
    <tr class="total"><td colspan="2">TOTAL LÍQUIDO A RECEBER</td><td class="right">R$ ${c.totalLiquido.toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>
  </tbody>
</table>

<p class="ext-valor">Valor por extenso: <strong>${valorPorExtenso(c.totalLiquido)}</strong></p>

${fonte.obs?`<div class="declaracao"><strong>Observações:</strong> ${escapeHtml(fonte.obs)}</div>`:""}

<div class="declaracao">
  Declaro ter recebido da empresa <strong>${escapeHtml(data.config.companyName||"ArcD Construtora")}</strong> a importância acima discriminada,
  referente à rescisão do meu contrato de trabalho, dando plena, geral e irrevogável quitação de todos
  os valores acima mencionados, nada mais tendo a reclamar a qualquer título.
  <br><br>
  <strong>Caruaru - PE, ${new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"})}</strong>
</div>

<div class="signs">
  <div class="sign-box">
    <p class="name">${escapeHtml(fonte.empName)}</p>
    <p>Trabalhador(a)</p>
    <p>CPF: ${escapeHtml(fonte.empCPF||"________________")}</p>
  </div>
  <div class="sign-box">
    <p class="name">${escapeHtml(data.config.hrName||"Responsável")}</p>
    <p>${escapeHtml(data.config.companyName||"ArcD Construtora")}</p>
    ${data.config.cnpj?`<p>CNPJ: ${escapeHtml(data.config.cnpj)}</p>`:""}
  </div>
</div>

<div class="footer">Documento gerado pelo ArcD Ponto PRO  ${new Date().toLocaleString("pt-BR")}  Via do empregador / Via do trabalhador</div>
</body></html>`;
    const w = window.open("","_blank");
    w.document.write(html);
    w.document.close();
  };

  // Valor por extenso (simplificado até 999.999,99)
  function valorPorExtenso(n) {
    if(!n||isNaN(n)) return "zero reais";
    const inteiro = Math.floor(n);
    const centavos = Math.round((n - inteiro)*100);
    const u = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
    const d = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
    const c = ["","cem","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];
    function grupo(n) {
      if(n===0) return "";
      if(n===100) return "cem";
      const cent = Math.floor(n/100), dez = Math.floor((n%100)/10), un = n%10;
      const parts = [];
      if(cent) parts.push(c[cent]);
      if(dez>=2){ parts.push(d[dez]); if(un) parts.push(u[un]); }
      else if(dez===1||un) parts.push(u[Math.floor(n%100)>19?un:n%100]);
      return parts.join(" e ");
    }
    const mil = Math.floor(inteiro/1000), resto = inteiro%1000;
    const partes = [];
    if(mil>0) partes.push((mil===1?"mil":grupo(mil)+" mil"));
    if(resto>0) partes.push(grupo(resto)+(resto===1?" real":" reais"));
    if(partes.length===0) partes.push("zero reais");
    if(centavos>0) partes.push(grupo(centavos)+(centavos===1?" centavo":" centavos"));
    return partes.join(" e ");
  }

  // Bug real de fluxo encontrado na auditoria de 20/08/2026 (persona "Riley",
  // crítica de design do módulo RH): o seletor só listava funcionários
  // ativos, mas confirmar o desligamento em Equipe já marca active:false
  // imediatamente - o funcionário desaparecia do seletor exatamente no
  // momento em que o RH precisa dele para calcular a rescisão, forçando
  // preenchimento manual (CPF/obra/admissão à mão, sem autocomplete).
  // Corrigido: continua listando todo ativo, e também todo inativo que
  // ainda não tem rescisão em aberto registrada.
  // isRescissionActive (achado de revisão da PR: reusar o mesmo helper de
  // rescission-commands.js, mesmo padrão já usado para isAdvanceActive) em
  // vez de checar só a string "cancelada" à mão.
  const rescindedEmpIds = new Set((data.rescisoes||[]).filter(isRescissionActive).map(r=>r.empId));
  const activeEmps = data.employees.filter(e => e.active !== false || !rescindedEmpIds.has(e.id));
  const rescisoes  = (data.rescisoes||[]).slice().reverse();

  return (
    <div className="anim" style={{display:"flex",flexDirection:"column",gap:14}}>

      <PageHero
        eyebrow="Documentos"
        title="Cálculo de Rescisão"
        description="Gere o cálculo e o PDF para assinatura do trabalhador."
      />

      {/* Selecionar funcionário */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`3px solid ${C.yellow}`,padding:14,borderRadius:10,display:"flex",flexDirection:"column",gap:10}}>
        <p style={{fontSize:11,fontWeight:900,color:C.yellow,textTransform:"uppercase",letterSpacing:.8}}> Trabalhador</p>
        <Sel label="Selecionar da lista (ou preencha manualmente abaixo)"
          value={form.empId}
          onChange={selectEmp}
          options={[{v:"",l:"- Preenchimento manual -"},...activeEmps.map(e=>({v:e.id,l:`${e.name}${e.role?"  "+e.role:""}`}))]}
        />
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:10}}>
          <Inp label="Nome completo *" value={form.empName} onChange={F("empName")} placeholder="Nome do trabalhador"/>
          <Inp label="CPF" value={form.empCPF} onChange={v=>F("empCPF")(fmtCPF(v))} placeholder="000.000.000-00"/>
          <Inp label="Função" value={form.empFuncao} onChange={F("empFuncao")} placeholder="Pedreiro, servente..."/>
          <Inp label="Obra" value={form.obraName} onChange={F("obraName")} placeholder="Nome da obra"/>
        </div>
      </div>

      {/* Datas e valores */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`3px solid ${C.orange}`,padding:14,borderRadius:10,display:"flex",flexDirection:"column",gap:10}}>
        <p style={{fontSize:11,fontWeight:900,color:C.orange,textTransform:"uppercase",letterSpacing:.8}}> Período e Valores</p>
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:10}}>
          <Inp label="Data de admissão *"  type="date" value={form.admissao}    onChange={F("admissao")}/>
          <Inp label="Data de rescisão *"  type="date" value={form.demissao}    onChange={F("demissao")}/>
          <Inp label="Valor mensal (R$) *" type="number" value={form.valorMensal} onChange={F("valorMensal")} placeholder="Diária x 26 dias"/>
          <Inp label="Dias trabalhados no mês" type="number" value={form.diasNoMes} onChange={F("diasNoMes")} placeholder="Ex: 12"/>
        </div>
        <Sel label="Motivo da rescisão *" value={form.tipo} onChange={F("tipo")} options={RESCISSION_TYPES}/>
        {form.tipoHerdado && form.tipoHerdado === form.tipo && (
          <p style={{fontSize:10.5,color:C.muted,marginTop:-4}}>Herdado do desligamento registrado em Equipe - revise se necessário.</p>
        )}

        {/* Acordo interno - campo especial */}
        {form.tipo === "acordo_interno" && (
          <div style={{background:`${C.yellow}12`,border:`1px solid ${C.yellow}44`,borderLeft:`4px solid ${C.yellow}`,padding:"12px 14px",borderRadius:8,display:"flex",flexDirection:"column",gap:10}}>
            <p style={{fontSize:12,fontWeight:700,color:C.yellow}}> Acordo Interno - cálculo simplificado</p>
            <p style={{fontSize:12,color:C.subtle}}>
              Total = Valor fixo mensal x meses ativos (+ fração proporcional de dias).
            </p>
            <Inp
              label="Valor fixo mensal do acordo (R$) *"
              type="number"
              value={form.valorFixoAcordo}
              onChange={F("valorFixoAcordo")}
              placeholder={form.valorMensal ? `Sugerido: R$ ${Number(form.valorMensal).toLocaleString("pt-BR")}` : "Ex.: 3.000,00"}
            />
            {calc && calc.isAcordoInterno && (
              <div style={{background:`${C.yellow}20`,borderRadius:8,padding:"10px 14px"}}>
                <p style={{fontSize:13,color:C.yellow,fontWeight:900}}>
                  {fmt(Number(form.valorFixoAcordo||form.valorMensal||0))} x {calc.mesesAtivos.toFixed(2)} meses = {fmt(calc.totalBruto)}
                </p>
                <p style={{fontSize:11,color:C.subtle,marginTop:3}}>
                  ({calc.totalMeses} meses completos + {calc.diasResto} dias = {calc.mesesAtivos.toFixed(4)} meses)
                </p>
              </div>
            )}
          </div>
        )}

        {form.admissao && form.demissao && calc && (
          <div style={{background:`${C.yellow}12`,border:`1px solid ${C.yellow}33`,padding:"10px 14px",borderRadius:8}}>
            <p style={{fontSize:12,color:C.yellow,fontWeight:700}}>
               {calc.anos > 0 ? `${calc.anos} ano(s), ` : ""}{calc.totalMeses % 12} mês(es) e {calc.diasResto} dia(s) de serviço
               <span style={{color:C.subtle}}>{calc.avos13} avo(s) para 13º e férias</span>
            </p>
          </div>
        )}
      </div>

      {/* Verbas rescisórias - ocultar no acordo interno */}
      {form.tipo !== "acordo_interno" && (
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`3px solid ${C.green}`,padding:14,borderRadius:10,display:"flex",flexDirection:"column",gap:10}}>
        <p style={{fontSize:11,fontWeight:900,color:C.green,textTransform:"uppercase",letterSpacing:.8}}> Verbas rescisórias</p>
        {[
          ["incluirSaldo",  "Saldo de salário",              true],
          ["incluir13",     "13º salário proporcional",      true],
          ["incluirFerias", "Férias proporcionais + 1/3",    true],
          ["incluirAviso",  "Aviso prévio (30 dias)",        false],
        ].map(([key, label, def]) => (
          <label key={key} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"8px 10px",background:form[key]?`${C.green}0d`:"transparent",borderRadius:8,border:`1px solid ${form[key]?C.green+"33":C.line}`}}>
            <div onClick={()=>F(key)(!form[key])} style={{width:20,height:20,border:`2px solid ${form[key]?C.green:C.muted}`,background:form[key]?C.green:"transparent",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"}}>
              {form[key] && <span style={{color:C.ink,fontSize:13,fontWeight:900,lineHeight:1}}>ok</span>}
            </div>
            <div style={{flex:1}}>
              <p style={{fontSize:13,fontWeight:700,color:form[key]?C.text:C.muted}}>{label}</p>
              {calc && form[key] && (
                <p style={{fontSize:11,color:C.green,marginTop:1}}>
                  {key==="incluirSaldo"  && `${form.diasNoMes||0} dias x R$ ${Number((Number(form.valorMensal||0)/30)).toFixed(2)} = ${fmt(calc.saldoSalario)}`}
                  {key==="incluir13"     && `${calc.avos13}/12 x ${fmt(Number(form.valorMensal||0))} = ${fmt(calc.dec13)}`}
                  {key==="incluirFerias" && `${calc.avosFerias}/12 x ${fmt(Number(form.valorMensal||0))} x 4/3 = ${fmt(calc.feriasTotal)}`}
                  {key==="incluirAviso"  && (form.tipo==="sem_justa_causa"||form.tipo==="acordo_mutuo") && `${fmt(calc.avisoPrevio)}`}
                  {key==="incluirAviso"  && form.tipo!=="sem_justa_causa" && form.tipo!=="acordo_mutuo" && <span style={{color:C.red}}>não aplicável neste tipo de rescisão</span>}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>
      )} {/* fim {form.tipo !== "acordo_interno"} */}

      {/* Descontos */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderTop:`3px solid ${C.red}`,padding:14,borderRadius:10,display:"flex",flexDirection:"column",gap:10}}>
        <p style={{fontSize:11,fontWeight:900,color:C.red,textTransform:"uppercase",letterSpacing:.8}}> Descontos</p>
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:10}}>
          <Inp label="Adiantamentos (R$)" type="number" value={form.descAdiantamento} onChange={F("descAdiantamento")} placeholder="0,00"/>
          <Inp label="Outros descontos (R$)" type="number" value={form.descOutros} onChange={F("descOutros")} placeholder="0,00"/>
        </div>
        {Number(form.descOutros||0)>0 && <Inp label="Descrição dos outros descontos" value={form.obsDesc} onChange={F("obsDesc")} placeholder="Ex.: materiais, equipamentos..."/>}
      </div>

      {/* Resultado */}
      {calc ? (
        <div style={{background:`${C.yellow}12`,color:C.text,padding:"18px 20px",borderRadius:12,border:`1px solid ${C.yellow}44`}}>
          <p style={{fontSize:11,fontWeight:900,letterSpacing:1.2,textTransform:"uppercase",color:C.yellowD}}>Total líquido a receber</p>
          <p style={{fontFamily:"'Inter Display','Inter',sans-serif",fontWeight:800,fontSize:"clamp(26px,11vw,48px)",letterSpacing:1,lineHeight:.95,color:C.text}}>{fmt(calc.totalLiquido)}</p>
          <p style={{fontSize:12,fontWeight:700,marginTop:6,color:C.muted}}>{valorPorExtenso(calc.totalLiquido)}</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:14}}>
            {[
              ["Vencimentos",fmt(calc.totalBruto)],
              ["Descontos",  fmt(calc.totalDesc)],
              ["Líquido",    fmt(calc.totalLiquido)],
            ].map(([l,v])=>(
              <div key={l} style={{background:C.surface,border:`1px solid ${C.border}`,padding:"8px 10px",borderRadius:8}}>
                <p style={{fontSize:9,fontWeight:900,textTransform:"uppercase",color:C.muted}}>{l}</p>
                <p style={{fontWeight:900,fontSize:15,color:C.text}}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{background:C.card,border:`1px solid ${C.border}`,padding:20,textAlign:"center",color:C.muted,borderRadius:10}}>
          Preencha nome, datas e valor mensal para calcular.
        </div>
      )}

      {/* Observações e ações */}
      <Inp label="Observações (aparece no documento)" value={form.obs} onChange={F("obs")} multiline placeholder="Informações adicionais, acordos, pendências..."/>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Btn v="ghost" onClick={()=>setForm(emptyForm)} full><Ic n="x"/> Limpar</Btn>
        <Btn v="ghost" onClick={gerarPDF} full disabled={!calc}><Ic n="file"/> Gerar PDF</Btn>
      </div>
      <Btn onClick={salvar} full disabled={!calc||salvando}><Ic n="check"/> {salvando?"Salvando e auditando...":"Salvar no histórico"}</Btn>

      {/* Histórico */}
      <button onClick={()=>setHistory(h=>!h)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"10px 14px",cursor:"pointer",borderRadius:8,fontFamily:"'Inter Display','Inter',sans-serif",fontWeight:900,fontSize:14,textTransform:"uppercase",letterSpacing:.5,textAlign:"left"}}>
        {history?" Ocultar":" Ver"} histórico de rescisões ({rescisoes.length})
      </button>

      {history && rescisoes.length === 0 && (
        <div style={{background:C.card,border:`1px solid ${C.border}`,padding:16,textAlign:"center",color:C.muted,borderRadius:10}}>
          Nenhuma rescisão salva ainda.
        </div>
      )}

      {history && rescisoes.map(r => (
        <div key={r.id} style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`4px solid ${C.red}`,padding:"12px 16px",borderRadius:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
            <div>
              <p style={{fontFamily:"'Inter Display','Inter',sans-serif",fontWeight:900,fontSize:17}}>{r.empName}</p>
              <p style={{fontSize:11,color:C.muted,marginTop:2}}>
                {r.empFuncao&&`${r.empFuncao}  `}{r.obraName&&`${r.obraName}  `}
                {fmtDateFull(r.admissao)} → {fmtDateFull(r.demissao)}
              </p>
              <p style={{fontSize:11,color:C.subtle,marginTop:2}}>{RESCISSION_TYPE_LABEL[r.tipo]||r.tipo}</p>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <p style={{fontFamily:"'Inter Display','Inter',sans-serif",fontWeight:800,fontSize:22,color:C.yellow,letterSpacing:.5}}>{fmt(r.totalLiquido)}</p>
              <p style={{fontSize:10,color:C.muted}}>{new Date(r.createdAt).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
          <div style={{display:"flex",gap:6,marginTop:10}}>
            {/* "Reabrir" só existe para registro cancelado - salvar() sempre
                cria uma rescisão NOVA (id:uid(), único comando é
                PAYROLL_RESCISSION_CREATED, não existe comando de edição).
                Reabrir uma rescisão ATIVA e salvar duplicava o registro
                financeiro da mesma demissão, sem cancelar o original - risco
                real de contar a rescisão em dobro no razão/DRE (achado de
                auditoria de 20/08/2026). Para corrigir uma rescisão ativa, o
                caminho correto é cancelar (com motivo e trilha de auditoria)
                e então reabrir o cancelado. */}
            {String(r.status||"").toLowerCase()==="cancelada"&&<Btn size="sm" v="ghost" onClick={()=>{setForm({...r,id:uid()});setHistory(false);}}>
              <Ic n="edit"/> Reabrir
            </Btn>}
            <Btn size="sm" v="ghost" onClick={()=>gerarPDF(r)}>
              <Ic n="file"/> PDF
            </Btn>
            {String(r.status||"").toLowerCase()!=="cancelada"&&<Btn size="sm" v="danger" disabled={salvando} onClick={()=>cancelarRescisao(r)}><Ic n="trash"/></Btn>}
          </div>
        </div>
      ))}

      {rescCancelModal&&<Modal title="Cancelar rescisão" onClose={()=>setRescCancelModal(null)}><div className="team-confirm"><p>Cancele a rescisão de <strong>{rescCancelModal.empName}</strong>. O registro é preservado no histórico para auditoria.</p><Inp label="Motivo do cancelamento *" value={rescCancelReason} onChange={setRescCancelReason} multiline placeholder="Explique por que esta rescisão está sendo cancelada"/><div><Btn v="ghost" full onClick={()=>setRescCancelModal(null)}>Cancelar</Btn><Btn v="danger" full loading={salvando} onClick={confirmCancelarRescisao}>Confirmar cancelamento</Btn></div></div></Modal>}
    </div>
  );
}

export default Rescisao;
