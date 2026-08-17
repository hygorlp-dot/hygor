// ===================================================================
// MedicoesView — tela de Medições extraída de LegacyApp.jsx
//
// Extraído verbatim (mesmo corpo, mesma lógica) de src/LegacyApp.jsx em
// 2026-08-16, seguindo o mesmo padrão dos módulos anteriores. Mesma
// camada de dados, sem nova migration/RLS. Ver
// docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #8.
// ===================================================================

import { useMemo, useState } from "react";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import {
  Btn, C, CONTRACT_LABELS, DIA_VENC_1_PADRAO, DIA_VENC_2_PADRAO,
  Ic, Inp, Modal, Sel,
  calcProjecaoContratoObra, clampDiaNoMes, compLabel,
  fmt, fmtDate, fmtDateFull, today, uid,
} from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { totalRecebidoMedicao, statusRecebimentoMedicao } from "../../conciliacao/index.js";
import { toLocalISODate } from "../../ponto/attendance-engine";

const BILLING_LABELS = {
  mensal_fixo: "Parcela mensal fixa",
  percentual:  "Por % de avanço",
  livre:       "Livre",
};

function MedicoesView({ data, showToast, currentUser=null, dispatchCommand=null }) {
  const { cols } = useBreakpoint();
  const now   = new Date();
  const [selObra,  setSelObra]  = useState(data.obras[0]?.id || "");
  const [modal,    setModal]    = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [gerarModal, setGerarModal] = useState(false);
  const [gerarOpts,  setGerarOpts]  = useState({ sobreescrever: false });
  // Ao confirmar uma medicao vencida, perguntamos a DATA DE PAGAMENTO em vez
  // de assumir hoje - o pagamento quinzenal costuma cair em data especifica.
  const [pagarModal, setPagarModal] = useState(null);   // {m, data}
  // Fila de conciliacao das parcelas vencidas geradas agora. As respostas
  // ficam locais ate a ultima parcela e sao salvas juntas; assim um update da
  // primeira resposta nao desmonta o assistente antes de perguntar as demais.
  const [conciliar,  setConciliar]  = useState(null);
  const [measurementCommandPending,setMeasurementCommandPending]=useState(false);

  const emptyM = {
    competencia: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`,
    tipo: "mensal_fixo", percentualAcumulado: "", valorPrevisto: "",
    valorRecebido: "", dataPagamento: today(), descricao: "", recebido: false,
  };
  const [form, setForm] = useState(emptyM);
  const F = k => v => setForm(f => ({ ...f, [k]: v }));

  const obra = useMemo(() => data.obras.find(o => o.id === selObra), [data.obras, selObra]);
  const medicoes = useMemo(() => (data.medicoes||[])
    .filter(m => m.obraId === selObra)
    .sort((a,b) => a.competencia.localeCompare(b.competencia)),
    [data.medicoes, selObra]);

  // % acumulado anterior (para calcular período)
  const prevAcumulado = (competencia, excludeId) => {
    const sorted = medicoes.filter(m => m.tipo==="percentual" && m.competencia < competencia && m.id !== excludeId);
    return sorted.length ? sorted[sorted.length-1].percentualAcumulado : 0;
  };

  const calcPrevisto = (f, o) => {
    if (!o) return 0;
    if (f.tipo === "mensal_fixo") return Number(o.parcelaMensal || f.valorPrevisto || 0);
    if (f.tipo === "percentual") {
      const prev = prevAcumulado(f.competencia, editId || undefined);
      const periodo = Math.max(0, Number(f.percentualAcumulado||0) - prev);
      return (periodo / 100) * Number(o.contractValue || 0);
    }
    return Number(f.valorPrevisto || 0);
  };

  //  Totais
  const { totalPrevisto, totalRecebido, totalPendente } = useMemo(() => ({
    totalPrevisto: medicoes.reduce((s,m) => s+Number(m.valorPrevisto||0), 0),
    totalRecebido: medicoes.reduce((s,m) => s+totalRecebidoMedicao(m), 0),
    totalPendente: medicoes.reduce((s,m) => s+Math.max(0,Number(m.valorPrevisto||0)-totalRecebidoMedicao(m)), 0),
  }), [medicoes]);
  const saldo         = Number(obra?.contractValue||0) - totalRecebido;
  const pctRecebido   = obra?.contractValue>0 ? (totalRecebido/obra.contractValue)*100 : 0;
  const pctFaturado   = obra?.contractValue>0 ? (totalPrevisto/obra.contractValue)*100 : 0;

  //  Abrir nova medição com defaults inteligentes 
  const openNew = () => {
    const defaultTipo = obra?.billingType || "mensal_fixo";
    const pctAtual = defaultTipo === "percentual"
      ? Math.min(100, (prevAcumulado("9999-99")||0) + 10) : 0;
    // Próxima competência após a última medição
    const ultimaComp = medicoes.length ? medicoes[medicoes.length-1].competencia : null;
    let proximaComp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    if (ultimaComp) {
      const [y,m] = ultimaComp.split("-").map(Number);
      const d = new Date(y, m, 1); // próximo mês
      proximaComp = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    }
    setForm({
      ...emptyM,
      competencia: proximaComp,
      tipo: defaultTipo,
      percentualAcumulado: defaultTipo === "percentual" ? String(pctAtual) : "",
      valorPrevisto: obra?.parcelaMensal>0 ? String(obra.parcelaMensal) : "",
    });
    setEditId(null);
    setModal(true);
  };

  const openEdit = m => {
    setForm({
      competencia: m.competencia, tipo: m.tipo,
      percentualAcumulado: String(m.percentualAcumulado||""),
      valorPrevisto: String(m.valorPrevisto||""), valorRecebido: String(m.valorRecebido||""),
      dataPagamento: m.dataPagamento||today(), descricao: m.descricao||"", recebido: m.recebido,
    });
    setEditId(m.id);
    setModal(true);
  };

  const saveMedicao = async() => {
    if(!dispatchCommand||measurementCommandPending)return;
    setMeasurementCommandPending(true);
    try {
      const previsto = calcPrevisto(form, obra);
      const periodo  = form.tipo==="percentual"
        ? Math.max(0, Number(form.percentualAcumulado||0) - prevAcumulado(form.competencia, editId||undefined)) : 0;
      const id=editId||uid();
      const receiptId=form.recebido&&!editId?uid():"";
      const result=await dispatchCommand(atual=>{
        const vigente=(atual.medicoes||[]).find(item=>item.id===id);
        return {
          type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_SAVED,
          idempotencyKey:`client-measurement-save-${id}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{
            measurement:{...form,id,obraId:selObra,valorPrevisto:previsto,percentualPeriodo:periodo},
            receiptId,
          },
        };
      });
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou a medição.");
      setModal(false);
      showToast(editId ? "Medição atualizada." : "Medição registrada.");
    } catch (error) {
      showToast(error.message||"Não foi possível salvar a medição.","error");
    } finally {
      setMeasurementCommandPending(false);
    }
  };

  //  Geração automática de parcelas fixas 
  // Calcula a data de vencimento de uma parcela
  // Os dias vem da obra (diaVenc1/diaVenc2), nao mais fixos em 1 e 15.
  const calcDataVencimento = (contractStart, parcelaIdx, freq, dia1, dia2) => {
    const [y, m] = contractStart.split("-").map(Number);
    const d1 = Number(dia1 || DIA_VENC_1_PADRAO);
    const d2 = Number(dia2 || DIA_VENC_2_PADRAO);
    if (freq === "quinzenal") {
      const mesOffset = Math.floor(parcelaIdx / 2);
      const isSecond  = parcelaIdx % 2 === 1;
      const mesIdx    = m - 1 + mesOffset;
      // Ano/mes reais depois do offset, para o clamp usar o mes certo.
      const ref  = new Date(y, mesIdx, 1);
      const dia  = clampDiaNoMes(ref.getFullYear(), ref.getMonth(), isSecond ? d2 : d1);
      return toLocalISODate(new Date(ref.getFullYear(), ref.getMonth(), dia));
    } else {
      const ref = new Date(y, m - 1 + parcelaIdx, 1);
      const dia = clampDiaNoMes(ref.getFullYear(), ref.getMonth(), d1);
      return toLocalISODate(new Date(ref.getFullYear(), ref.getMonth(), dia));
    }
  };

  // Calcula competência (mês) de uma parcela
  const calcCompetencia = (contractStart, parcelaIdx, freq) => {
    const [y, m] = contractStart.split("-").map(Number);
    const mesOffset = freq==="quinzenal" ? Math.floor(parcelaIdx/2) : parcelaIdx;
    const d = new Date(y, m-1+mesOffset, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  };

  const gerarParcelasFixas = async() => {
    if(!dispatchCommand||measurementCommandPending)return;
    if (!obra?.contractStart) {
      showToast("Configure a data de início do contrato na obra.","error"); return;
    }
    const tipo = obra.contractType || "fixed_labor";
    const freq = obra.billingFrequency || "mensal";
    const total = obra.totalParcelas || 12;
    const novas = [];

    //  Entrada (somente para MO fixo e Misto) 
    if (tipo !== "admin_only" && Number(obra.entrada||0) > 0 && obra.entradaDate) {
      const existeEntrada = (data.medicoes||[]).some(x=>x.obraId===selObra && x.numeroParcela==="E");
      if (!existeEntrada || gerarOpts.sobreescrever) {
        novas.push({
          id: uid(), obraId: selObra,
          competencia: obra.contractStart.slice(0,7),
          dataVencimento: obra.entradaDate,
          numeroParcela: "E",
          tipo: "mensal_fixo",
          percentualAcumulado: 0, percentualPeriodo: 0,
          valorMOFixo: Number(obra.entrada), valorAdminPct: 0,
          valorPrevisto: Number(obra.entrada),
          valorRecebido: 0, dataPagamento: "",
          descricao: "Entrada do contrato",
          recebido: false,
        });
      }
    }

    //  Parcelas regulares 
    for (let i=0; i<total; i++) {
      const dataVenc = calcDataVencimento(obra.contractStart, i, freq, obra.diaVenc1, obra.diaVenc2);
      const comp     = calcCompetencia(obra.contractStart, i, freq);
      const numParcela = i+1;
      const isQuinzenaSegunda = freq==="quinzenal" && i%2===1;
      const descPrefix = freq==="quinzenal"
        ? `${isQuinzenaSegunda?"2ª":"1ª"} quinzena`
        : `Parcela ${numParcela}/${total}`;

      // Componentes por tipo
      // O componente de MO é fixo e conhecido já na geração. O de Administração
      // depende do custo real de mão de obra do período, que só existe depois do
      // ponto lançado - por isso nasce zerado e é calculado mês a mês pelo botão
      // "Calcular Admin %" na própria medição.
      const valorMOFixo   = (tipo==="fixed_labor"||tipo==="fixed_labor_admin") ? Number(obra.parcelaMensal||0) : 0;
      const valorAdminPct = 0;

      // Verifica duplicata por dataVencimento
      const existe = (data.medicoes||[]).some(x=>x.obraId===selObra && x.dataVencimento===dataVenc);
      if (existe && !gerarOpts.sobreescrever) continue;

      novas.push({
        id: uid(), obraId: selObra, competencia: comp,
        dataVencimento: dataVenc,
        numeroParcela: numParcela,
        tipo: tipo==="admin_only" ? "admin_pct" : "mensal_fixo",
        percentualAcumulado: 0, percentualPeriodo: 0,
        valorMOFixo, valorAdminPct,
        valorPrevisto: valorMOFixo,
        valorRecebido: 0, dataPagamento: "",
        descricao: `${descPrefix}  ${compLabel(comp)}`,
        recebido: false,
      });
    }

    if (novas.length === 0) { showToast("Todas as parcelas já estão lançadas.","warn"); return; }

    setMeasurementCommandPending(true);
    try {
      const result=await dispatchCommand(()=>({
        type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENTS_GENERATED,
        idempotencyKey:`client-measurements-generate-${selObra}-${uid()}`,
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{obraId:selObra,measurements:novas,overwrite:gerarOpts.sobreescrever},
      }));
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou as parcelas.");
      setGerarModal(false);
      showToast(`${novas.length} parcelas geradas!${tipo==="admin_only"||tipo==="fixed_labor_admin"?" Calcule o valor Admin % mês a mês conforme executado.":""}`);
    } catch (error) {
      showToast(error.message||"Não foi possível gerar as parcelas.","error");
      return;
    } finally {
      setMeasurementCommandPending(false);
    }

    // Parcelas que ja nasceram vencidas (contrato retroativo): em vez de
    // deixa-las todas em aberto, perguntamos uma a uma se o pagamento saiu
    // na data do contrato. Quem gera parcela de um contrato que comecou em
    // marco normalmente ja recebeu as primeiras.
    const hoje = today();
    const vencidas = novas
      .filter(n => n.dataVencimento && n.dataVencimento <= hoje && Number(n.valorPrevisto||0) > 0)
      .sort((a,b) => a.dataVencimento.localeCompare(b.dataVencimento));
    if (vencidas.length) {
      setConciliar({
        fila: vencidas.map(v => v.id),
        idx: 0,
        decisoes: {},
        // decisao pendente da parcela atual: "" (nao escolhido) | "vencimento" | "outra" | "aberto"
        modo: "vencimento",
        dataOutra: today(),
      });
    }
  };

  //  Conciliacao das parcelas vencidas recem-geradas 
  const aplicarDecisoesParcelas = async decisoes => {
    if(!dispatchCommand||measurementCommandPending)return {ok:false};
    if(!Object.values(decisoes||{}).some(decisao=>decisao&&decisao.modo!=="aberto")){
      return {ok:true};
    }
    setMeasurementCommandPending(true);
    try{
      const result=await dispatchCommand(atual=>{
        const changes=Object.entries(decisoes||{}).flatMap(([id,decisao])=>{
          if(!decisao||decisao.modo==="aberto")return [];
          const measurement=(atual.medicoes||[]).find(item=>item.id===id);
          if(!measurement)return [];
          const balance=Number(measurement.valorPrevisto||0)-totalRecebidoMedicao(measurement);
          if(balance<=0.01)return [];
          return [{
            measurementId:id,expectedVersion:Number(measurement.version||0),action:"receive",
            receipt:{
              id:uid(),valor:balance,
              data:decisao.modo==="vencimento"
                ?measurement.dataVencimento
                :(decisao.dataOutra||measurement.dataVencimento),
              origem:"revisao_vencidas",
            },
          }];
        });
        return {
          type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED,
          idempotencyKey:`client-measurement-overdue-${uid()}`,
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{changes},
        };
      });
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou os recebimentos.");
      return result;
    }catch(error){
      showToast(error.message||"Não foi possível revisar as parcelas vencidas.","error");
      return {ok:false};
    }finally{
      setMeasurementCommandPending(false);
    }
  };

  // Guarda a resposta atual e avanca. O banco de dados recebe uma unica
  // atualizacao ao final, depois que TODAS as vencidas foram perguntadas.
  const conciliarAplicar = async() => {
    if (!conciliar) return;
    const id  = conciliar.fila[conciliar.idx];
    const decisoes={...(conciliar.decisoes||{}),[id]:{modo:conciliar.modo,dataOutra:conciliar.dataOutra}};
    const prox = conciliar.idx + 1;
    if (prox >= conciliar.fila.length) {
      const result=await aplicarDecisoesParcelas(decisoes);
      if(!result.ok)return;
      setConciliar(null);
      showToast(`${conciliar.fila.length} parcela(s) vencida(s) revisada(s).`);
    } else {
      setConciliar(c => ({ ...c, decisoes, idx: prox, modo:"vencimento", dataOutra: today() }));
    }
  };

  // Marca TODAS as parcelas restantes da fila como pagas no proprio vencimento.
  const conciliarTodasNoVencimento = async() => {
    if (!conciliar) return;
    const restantes = conciliar.fila.slice(conciliar.idx);
    const decisoes={...(conciliar.decisoes||{})};
    restantes.forEach(id=>{decisoes[id]={modo:"vencimento",dataOutra:""};});
    const result=await aplicarDecisoesParcelas(decisoes);
    if(!result.ok)return;
    setConciliar(null);
    showToast(`${restantes.length} parcela(s) marcadas como pagas no vencimento.`);
  };

  const conciliarDecidirDepois = async() => {
    if (!conciliar) return;
    if (Object.keys(conciliar.decisoes||{}).length) {
      const result=await aplicarDecisoesParcelas(conciliar.decisoes);
      if(!result.ok)return;
    }
    setConciliar(null);
  };

  const toggleRecebido = async(m) => {
    // A ação mantém cada fato de recebimento. Ao desfazer, cria estornos
    // auditáveis em vez de apagar a evidência financeira da medição.
    const recebidaPorInteiro = statusRecebimentoMedicao(m)==="recebida";
    if(!dispatchCommand||measurementCommandPending)return;
    setMeasurementCommandPending(true);
    try {
      const motivo=recebidaPorInteiro ? window.prompt("Motivo do estorno do recebimento:") : "";
      if (recebidaPorInteiro&&!String(motivo||"").trim())return;
      const result=await dispatchCommand(atual=>{
        const vigente=(atual.medicoes||[]).find(item=>item.id===m.id);
        const balance=Number(vigente?.valorPrevisto||0)-totalRecebidoMedicao(vigente||{});
        return {
          type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED,
          idempotencyKey:`client-measurement-receipt-${m.id}-${uid()}`,
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{changes:[recebidaPorInteiro
            ?{measurementId:m.id,expectedVersion:Number(vigente?.version||0),action:"reverse_all",reason:motivo}
            :{measurementId:m.id,expectedVersion:Number(vigente?.version||0),action:"receive",receipt:{id:uid(),valor:balance,data:today(),origem:"manual"}}
          ]},
        };
      });
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o recebimento.");
      showToast(!recebidaPorInteiro ? "ok Marcado como recebido." : "Recebimento estornado e preservado para auditoria.");
    } catch (error) {
      showToast(error.message||"Não foi possível alterar o recebimento.","error");
    } finally {
      setMeasurementCommandPending(false);
    }
  };

  const deleteMedicao = async id => {
    const motivo=window.prompt("Motivo do cancelamento da medição:");
    if(!String(motivo||"").trim())return;
    if(!dispatchCommand||measurementCommandPending)return;
    setMeasurementCommandPending(true);
    try {
      const result=await dispatchCommand(atual=>{
        const vigente=(atual.medicoes||[]).find(item=>item.id===id);
        return {
          type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_CANCELLED,
          idempotencyKey:`client-measurement-cancel-${id}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{measurementId:id,reason:motivo},
        };
      });
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o cancelamento.");
      showToast("Medição cancelada e preservada para auditoria.");
    } catch (error) {
      showToast(error.message||"Não foi possível cancelar a medição.","error");
    } finally {
      setMeasurementCommandPending(false);
    }
  };

  const fecharAdministracao=async(m,adminAmount)=>{
    if(!dispatchCommand||measurementCommandPending)return;
    setMeasurementCommandPending(true);
    try{
      const result=await dispatchCommand(atual=>{
        const vigente=(atual.medicoes||[]).find(item=>item.id===m.id);
        return {
          type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_ADMIN_CLOSED,
          idempotencyKey:`client-measurement-admin-${m.id}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{measurementId:m.id,adminAmount},
        };
      });
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o fechamento.");
      showToast(`Fechado: administração de ${fmt(adminAmount)} aplicada à medição.`);
    }catch(error){
      showToast(error.message||"Não foi possível fechar a administração.","error");
    }finally{
      setMeasurementCommandPending(false);
    }
  };

  const confirmarRecebimento=async(m,dataPagamento)=>{
    if(!dispatchCommand||measurementCommandPending)return false;
    setMeasurementCommandPending(true);
    try{
      const result=await dispatchCommand(atual=>{
        const vigente=(atual.medicoes||[]).find(item=>item.id===m.id);
        const balance=Number(vigente?.valorPrevisto||0)-totalRecebidoMedicao(vigente||{});
        return {
          type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED,
          idempotencyKey:`client-measurement-receipt-${m.id}-${uid()}`,
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{changes:[{
            measurementId:m.id,expectedVersion:Number(vigente?.version||0),action:"receive",
            receipt:{id:uid(),valor:balance,data:dataPagamento,origem:"manual"},
          }]},
        };
      });
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o recebimento.");
      return true;
    }catch(error){
      showToast(error.message||"Não foi possível confirmar o recebimento.","error");
      return false;
    }finally{
      setMeasurementCommandPending(false);
    }
  };

  const formPrevisto = calcPrevisto(form, obra);

  //  Info do período do contrato 
  const contratoInfo = (() => {
    if (!obra?.contractStart) return null;
    const start = new Date(obra.contractStart+"T12:00:00");
    const end   = obra.contractEnd ? new Date(obra.contractEnd+"T12:00:00") : null;
    const hoje  = new Date();
    const mesesDecorridos = Math.max(0, (hoje.getFullYear()-start.getFullYear())*12 + (hoje.getMonth()-start.getMonth()));
    const total = obra.totalParcelas || (end ? Math.round((end-start)/(1000*60*60*24*30.4)) : 0);
    const pctTempo = total>0 ? Math.min((mesesDecorridos/total)*100,100) : 0;
    return { start, end, mesesDecorridos, total, pctTempo };
  })();

  return (
    <div className="anim" style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* Header */}
      <div style={{background:C.surface,border:`1.5px solid ${C.border}`,borderLeft:`4px solid ${C.blue}`,padding:"16px 18px",borderRadius:8}}>
        <p style={{fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:1.2,marginBottom:4}}>Faturamento estruturado</p>
        <p style={{fontFamily:"'Inter Display','Inter',sans-serif",fontSize:22,fontWeight:800,color:C.text,lineHeight:1}}>Medições por Obra</p>
        <p style={{color:C.muted,fontSize:13,marginTop:4}}>Parcela fixa automática  Avanço %  Lançamento livre</p>
      </div>

      {/* Painel de vencimentos - todas as obras */}
      {(() => {
        const todayDate = new Date();
        const proximasAll = (data.medicoes||[]).filter(m => {
          if (m.recebido || !m.dataVencimento) return false;
          const venc = new Date(m.dataVencimento+"T12:00:00");
          const diff = Math.round((venc-todayDate)/(1000*60*60*24));
          return diff <= 7;
        }).map(m => {
          const o = data.obras.find(x=>x.id===m.obraId);
          const venc = new Date(m.dataVencimento+"T12:00:00");
          const diff = Math.round((venc-todayDate)/(1000*60*60*24));
          return {...m, obraName:o?.name||"-", diff};
        }).sort((a,b)=>a.dataVencimento.localeCompare(b.dataVencimento));

        if (proximasAll.length===0) return null;
        const totalPendente = proximasAll.reduce((s,m)=>s+m.valorPrevisto,0);
        const vencidas = proximasAll.filter(m=>m.diff<0);

        return (
          <div style={{background:vencidas.length>0?`${C.red}06`:`${C.orange}06`,border:`1.5px solid ${vencidas.length>0?C.red:C.orange}`,borderRadius:8,overflow:"hidden"}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${vencidas.length>0?C.red+"33":C.orange+"33"}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <p style={{fontWeight:800,fontSize:14,color:vencidas.length>0?C.red:C.orange}}>
                {vencidas.length>0?` ${vencidas.length} vencida(s) + `:""}{proximasAll.length-vencidas.length} vencendo em até 7 dias
              </p>
              <p style={{fontSize:13,fontWeight:800,color:C.text}}>{fmt(totalPendente)}</p>
            </div>
            {proximasAll.map(m=>(
              <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 14px",borderBottom:`1px solid ${C.line}33`}}>
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:C.text}}>{m.obraName}</p>
                  <p style={{fontSize:11,color:m.diff<0?C.red:m.diff<=3?C.orange:C.muted}}>
                    {m.diff<0?`Venceu há ${Math.abs(m.diff)}d`:m.diff===0?"Vence HOJE":`Vence em ${m.diff}d`}
                    {" - "}{fmtDateFull(m.dataVencimento)}
                    {m.descricao?`  ${m.descricao}`:""}
                  </p>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                  <p style={{fontSize:14,fontWeight:800,color:m.diff<0?C.red:C.text}}>{fmt(m.valorPrevisto)}</p>
                  <Btn size="sm" v="success" onClick={()=>setPagarModal({ m, data: today() })}>ok</Btn>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Seletor de obra */}
      <Sel value={selObra} onChange={v=>{setSelObra(v);}} options={data.obras.map(o=>({v:o.id,l:o.name+"  "+BILLING_LABELS[o.billingType]}))}/>

      {obra && (<>
        {/* Card da obra com período do contrato */}
        <div style={{background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:8,overflow:"hidden",boxShadow:`0 1px 4px ${C.shadow}`}}>
          <div style={{background:C.surface,borderBottom:`1.5px solid ${C.border}`,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
            <div style={{flex:1}}>
              <p style={{fontWeight:800,fontSize:16,color:C.text}}>{obra.name}</p>
              <p style={{fontSize:12,color:C.muted,marginTop:2}}>
                {CONTRACT_LABELS[obra.contractType]}  {BILLING_LABELS[obra.billingType]}
                {obra.billingType==="mensal_fixo" && obra.parcelaMensal>0 && `  ${fmt(obra.parcelaMensal)}/mês`}
              </p>
              {/* Período do contrato */}
              {obra.contractStart && (
                <p style={{fontSize:11,color:C.muted,marginTop:4}}>
                   {fmtDateFull(obra.contractStart)}{obra.contractEnd && ` → ${fmtDateFull(obra.contractEnd)}`}
                  {obra.totalParcelas>0 && `  ${obra.totalParcelas} parcelas`}
                </p>
              )}
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              {/* Botão gerar parcelas - só para mensal fixo */}
              {obra.billingType==="mensal_fixo" && obra.parcelaMensal>0 && obra.contractStart && (
                <Btn size="sm" v="primary" onClick={()=>setGerarModal(true)}> Gerar parcelas</Btn>
              )}
              <Btn size="sm" onClick={openNew}><Ic n="plus"/> Nova</Btn>
            </div>
          </div>

          {/* Timeline do contrato */}
          {contratoInfo && (
            <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.line}`}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
                {[
                  ["Decorrido",    `${contratoInfo.mesesDecorridos} meses`, C.blue],
                  ["Total prev.",  `${contratoInfo.total||"-"} meses`,     C.muted],
                  ["Prazo",        `${contratoInfo.pctTempo.toFixed(0)}%`,  contratoInfo.pctTempo>90?C.red:C.green],
                ].map(([l,v,c])=>(
                  <div key={l} style={{background:C.surface,borderRadius:6,padding:"6px 10px"}}>
                    <p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:700}}>{l}</p>
                    <p style={{fontSize:13,fontWeight:800,color:c,marginTop:2}}>{v}</p>
                  </div>
                ))}
              </div>
              {/* Barra dupla: tempo x financeiro */}
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}>
                  <p style={{fontSize:9,color:C.muted,fontWeight:600}}>PRAZO {contratoInfo.pctTempo.toFixed(0)}%</p>
                  <p style={{fontSize:9,color:C.muted,fontWeight:600}}>FINANCEIRO {pctFaturado.toFixed(0)}%</p>
                </div>
                <div style={{height:5,background:C.surface,borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(contratoInfo.pctTempo,100)}%`,background:contratoInfo.pctTempo>100?C.red:C.blue,borderRadius:99}}/>
                </div>
                <div style={{height:4,background:C.surface,borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(pctFaturado,100)}%`,background:C.yellow,borderRadius:99}}/>
                </div>
                <div style={{height:3,background:C.surface,borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(pctRecebido,100)}%`,background:C.green,borderRadius:99}}/>
                </div>
                <p style={{fontSize:9,color:C.muted}}>
                  <span style={{color:C.blue}}></span> Prazo  
                  <span style={{color:C.yellow}}></span> Faturado {pctFaturado.toFixed(0)}%  
                  <span style={{color:C.green}}></span> Recebido {pctRecebido.toFixed(0)}%
                </p>
              </div>
            </div>
          )}

          {/* KPIs */}
          <div style={{display:"grid",gridTemplateColumns:cols(2,4,4),padding:"10px 16px",gap:8}}>
            {[
              ["Faturado",   fmt(totalPrevisto), C.yellow],
              ["Recebido",   fmt(totalRecebido), C.green],
              ["Pendente",   fmt(totalPendente), totalPendente>0?C.orange:C.muted],
              ["Saldo cto.", fmt(saldo),         saldo>=0?C.blue:C.red],
            ].map(([l,v,c])=>(
              <div key={l} style={{background:C.surface,padding:"7px 10px",borderRadius:6}}>
                <p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:700}}>{l}</p>
                <p style={{fontSize:13,fontWeight:800,color:c,marginTop:2}}>{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Lista de medições */}
        {medicoes.length===0 && (
          <div style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:6,padding:20,textAlign:"center"}}>
            <p style={{color:C.muted,fontSize:13,marginBottom:8}}>Nenhuma medição registrada.</p>
            {obra.billingType==="mensal_fixo" && obra.parcelaMensal>0 && obra.contractStart && (
              <Btn onClick={()=>setGerarModal(true)} v="primary"> Gerar todas as parcelas automaticamente</Btn>
            )}
          </div>
        )}

        {medicoes.map((m,idx) => {
          const prevMeds = medicoes.slice(0,idx).filter(x=>x.tipo==="percentual");
          const prevPct  = prevMeds.length ? prevMeds[prevMeds.length-1].percentualAcumulado : 0;
          // Status de vencimento
          const venc = m.dataVencimento ? new Date(m.dataVencimento+"T12:00:00") : null;
          const diffDias = venc ? Math.round((venc - new Date())/(1000*60*60*24)) : null;
          const statusVenc = m.recebido ? "pago"
            : diffDias === null ? "sem_data"
            : diffDias < 0 ? "vencido"
            : diffDias <= 3 ? "alerta"
            : "normal";
          const statusColor = {pago:C.green,vencido:C.red,alerta:C.orange,normal:C.border,sem_data:C.border}[statusVenc];
          const statusLabel = {pago:"ok RECEBIDO",vencido:`VENCIDO (${Math.abs(diffDias)}d)`,alerta:`VENCE ${diffDias===0?"HOJE":`EM ${diffDias}d`}`,normal:`Vence ${fmtDateFull(m.dataVencimento)}`,sem_data:"Pendente"}[statusVenc];

          // Previsão do percentual de administração para a competência da
          // medição. Regra: obra "admin_only" cobra o percentual sobre TODOS
          // os custos gastos no período; obra "mista" (MO fixa + admin) cobra
          // só sobre materiais e terceirizados - a MO já está no valor fixo.
          const ehAdminOnly = obra?.contractType==="admin_only";
          const contemAdmin = ehAdminOnly||obra?.contractType==="fixed_labor_admin";
          const previsaoAdmin = (() => {
            if (!contemAdmin || !m.competencia) return null;
            const [y,mo] = m.competencia.split("-").map(Number);
            const projection = calcProjecaoContratoObra(data, selObra, y, mo-1);
            return {
              valor:projection.valorAdmin, base:projection.adminBase,
              materialCost:projection.materialCost, tercCost:projection.tercCost,
              totalCustos:projection.dre.totalCustos,
            };
          })();

          return (
            <div key={m.id} style={{
              background:m.recebido?`${C.green}06`:C.bg,
              border:`1.5px solid ${statusColor}`,
              borderLeft:`4px solid ${statusColor}`,
              borderRadius:6, padding:"12px 14px",
              boxShadow:`0 1px 3px ${C.shadow}`,
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                    {m.numeroParcela && <span style={{fontSize:11,fontWeight:800,color:C.muted}}>#{m.numeroParcela}</span>}
                    <p style={{fontWeight:800,fontSize:15,color:C.text}}>{compLabel(m.competencia)}</p>
                    <span style={{
                      fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,
                      background:`${statusColor}18`,color:statusColor,
                    }}>{statusLabel}</span>
                    {m.tipo==="percentual"&&<span style={{fontSize:10,color:C.blue,fontWeight:600,background:`${C.blue}10`,padding:"2px 8px",borderRadius:4}}>{prevPct}%→{m.percentualAcumulado}% (+{m.percentualPeriodo.toFixed(1)}%)</span>}
                  </div>
                  {m.descricao&&<p style={{fontSize:11,color:C.muted,marginBottom:4}}>{m.descricao}</p>}

                  <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                    {/* Componente MO fixo */}
                    {m.valorMOFixo>0&&(
                      <div><p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:600}}>MO Fixo</p><p style={{fontSize:14,fontWeight:800,color:C.yellow}}>{fmt(m.valorMOFixo)}</p></div>
                    )}
                    {/* Componente Admin % */}
                    {m.valorAdminPct>0&&(
                      <div><p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:600}}>Admin {obra?.adminPercentage||0}%</p><p style={{fontSize:14,fontWeight:800,color:C.purple}}>{fmt(m.valorAdminPct)}</p></div>
                    )}
                    {/* Total previsto */}
                    {m.valorPrevisto>0&&(
                      <div><p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:600}}>Total previsto</p><p style={{fontSize:14,fontWeight:800,color:C.text}}>{fmt(m.valorPrevisto)}</p></div>
                    )}
                    {/* Recebido */}
                    {totalRecebidoMedicao(m)>0&&<><div><p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:600}}>Recebido</p><p style={{fontSize:14,fontWeight:800,color:C.green}}>{fmt(totalRecebidoMedicao(m))}</p></div>
                    <div><p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:600}}>Data pgto</p><p style={{fontSize:12,color:C.muted}}>{fmtDateFull(m.dataPagamento)}</p></div></>}
                  </div>

                  {/* Previsão + fechamento do valor de administração (se ainda não calculado) */}
                  {contemAdmin && m.valorAdminPct===0 && m.competencia && statusRecebimentoMedicao(m)!=="recebida" && previsaoAdmin && (
                    <div style={{marginTop:8,padding:"8px 10px",border:`1px solid ${C.purple}44`,borderRadius:6,background:`${C.purple}08`}}>
                      <p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:700,marginBottom:4}}>
                        Previsão de fechamento · {ehAdminOnly?"admin. sobre todos os custos":"admin. sobre materiais e terceirizados"}
                      </p>
                      <p style={{fontSize:10.5,color:C.subtle,lineHeight:1.5}}>
                        {ehAdminOnly
                          ? `Custos do período: ${fmt(previsaoAdmin.totalCustos)} (MO, benefícios, materiais, terceirizados, equipamentos e rescisões).`
                          : `Materiais gastos: ${fmt(previsaoAdmin.materialCost)} · Terceirizados: ${fmt(previsaoAdmin.tercCost)}.`}
                      </p>
                      <p style={{fontSize:13,fontWeight:800,color:C.purple,marginTop:4}}>
                        {obra?.adminPercentage||0}% de {fmt(previsaoAdmin.base)} = {fmt(previsaoAdmin.valor)}
                      </p>
                      <Btn size="sm" v="ghost" style={{marginTop:6}} onClick={()=>{
                        if (previsaoAdmin.valor<=0) { showToast("Ainda não há custos lançados neste período para calcular.","error"); return; }
                        void fecharAdministracao(m,previsaoAdmin.valor);
                      }}>
                        Fechar valor desta competência
                      </Btn>
                    </div>
                  )}
                </div>

                <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
                  <Btn size="sm" v={statusRecebimentoMedicao(m)==="recebida"?"ghost":"success"} onClick={()=>toggleRecebido(m)}>
                    {statusRecebimentoMedicao(m)==="recebida"?"Desfazer":"ok Receber"}
                  </Btn>
                  <Btn size="sm" v="ghost" onClick={()=>openEdit(m)}><Ic n="edit"/></Btn>
                  <Btn size="sm" v="danger" onClick={()=>deleteMedicao(m.id)}><Ic n="trash"/></Btn>
                </div>
              </div>
            </div>
          );
        })}

        {obra.contractValue>0&&(
          <div style={{background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:6,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:`0 1px 3px ${C.shadow}`}}>
            <p style={{fontSize:12,color:C.muted}}>Saldo do contrato: <strong style={{color:C.text}}>{fmt(saldo)}</strong></p>
            <p style={{fontSize:12,color:C.muted}}>Recebido: <strong style={{color:C.green}}>{pctRecebido.toFixed(1)}%</strong></p>
          </div>
        )}
      </>)}

      {/* Modal: nova/editar medição */}
      {modal && obra && (
        <Modal title={editId?"Editar medição":"Nova medição"} onClose={()=>setModal(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {/* Tipo */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              {[["mensal_fixo"," Fixo"],["percentual"," % Avanço"],["livre"," Livre"]].map(([v,l])=>(
                <button key={v} onClick={()=>F("tipo")(v)} style={{
                  padding:"8px 4px",border:`2px solid ${form.tipo===v?C.yellow:C.border}`,
                  background:form.tipo===v?`${C.yellow}15`:"transparent",
                  color:form.tipo===v?C.text:C.muted,
                  fontFamily:"'Inter Display','Inter',sans-serif",fontWeight:700,fontSize:12,
                  cursor:"pointer",borderRadius:6,textAlign:"center",
                }}>{l}</button>
              ))}
            </div>

            {/* Competência */}
            <div>
              <p style={{fontSize:11,fontWeight:700,color:C.text,textTransform:"uppercase",marginBottom:5,letterSpacing:.7}}>Mês de competência *</p>
              <input type="month" value={form.competencia} onChange={e=>F("competencia")(e.target.value)} style={{width:"100%",background:C.bg,border:`1.5px solid ${C.border}`,color:C.text,padding:"10px 12px",borderRadius:6,fontSize:14,outline:"none",fontFamily:"'Inter','Inter Display',sans-serif"}}/>
            </div>

            {/* Fixo */}
            {form.tipo==="mensal_fixo"&&(
              <div style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:6,padding:"10px 14px"}}>
                <p style={{fontSize:12,color:C.text,fontWeight:700,marginBottom:6}}>
                  Parcela mensal fixa
                  {obra.parcelaMensal>0&&<span style={{color:C.yellow,marginLeft:8}}>→ {fmt(obra.parcelaMensal)}</span>}
                </p>
                <Inp label="Valor da parcela (R$)" type="number" value={form.valorPrevisto} onChange={F("valorPrevisto")} placeholder={obra.parcelaMensal>0?String(obra.parcelaMensal):"0,00"}/>
                {!form.valorPrevisto && obra.parcelaMensal>0 && (
                  <button onClick={()=>F("valorPrevisto")(String(obra.parcelaMensal))} style={{marginTop:6,background:"transparent",border:`1px solid ${C.yellow}`,color:C.yellow,padding:"4px 10px",borderRadius:4,fontSize:11,cursor:"pointer",fontWeight:700}}>
                    Usar parcela configurada ({fmt(obra.parcelaMensal)})
                  </button>
                )}
              </div>
            )}

            {/* % Avanço */}
            {form.tipo==="percentual"&&(
              <div style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:6,padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
                <p style={{fontSize:12,fontWeight:700,color:C.text}}>
                  % acumulado da obra até este mês
                  {obra.contractValue>0&&<span style={{color:C.muted,marginLeft:4,fontWeight:400}}> (Contrato: {fmt(obra.contractValue)})</span>}
                </p>
                <Inp label="% acumulado *" type="number" value={form.percentualAcumulado} onChange={F("percentualAcumulado")} placeholder="Ex.: 35"/>
                {Number(form.percentualAcumulado)>0 && obra.contractValue>0 && (() => {
                  const prev = prevAcumulado(form.competencia, editId||undefined);
                  const periodo = Math.max(0, Number(form.percentualAcumulado||0) - prev);
                  const val = (periodo/100)*Number(obra.contractValue||0);
                  return (
                    <div style={{background:`${C.yellow}15`,borderRadius:6,padding:"8px 12px"}}>
                      <p style={{fontSize:11,color:C.muted}}>Anterior: <strong>{prev}%</strong> → Este período: <strong>+{periodo.toFixed(1)}%</strong></p>
                      <p style={{fontSize:16,fontWeight:800,color:C.yellow,marginTop:2}}>{fmt(val)}</p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Livre */}
            {form.tipo==="livre"&&(
              <Inp label="Valor previsto (R$)" type="number" value={form.valorPrevisto} onChange={F("valorPrevisto")} placeholder="0,00"/>
            )}

            {/* Recebido? */}
            <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"8px 12px",background:form.recebido?`${C.green}10`:"transparent",borderRadius:6,border:`1.5px solid ${form.recebido?C.green+"55":C.border}`}}>
              <div onClick={()=>F("recebido")(!form.recebido)} style={{width:20,height:20,border:`2px solid ${form.recebido?C.green:C.muted}`,background:form.recebido?C.green:"transparent",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"}}>
                {form.recebido&&<span style={{color:"#fff",fontSize:13,fontWeight:900}}>ok</span>}
              </div>
              <p style={{fontSize:13,fontWeight:700,color:form.recebido?C.green:C.muted}}>Valor já recebido</p>
            </label>

            {form.recebido&&(<>
              <Inp label="Valor efetivamente recebido (R$)" type="number" value={form.valorRecebido} onChange={F("valorRecebido")} placeholder={String(formPrevisto||"")}/>
              <Inp label="Data de recebimento" type="date" value={form.dataPagamento} onChange={F("dataPagamento")}/>
            </>)}

            <Inp label="Descrição / observação" value={form.descricao} onChange={F("descricao")} placeholder="Ex.: Medição #3, Parcela março..."/>

            {formPrevisto>0&&(
              <div style={{background:`${C.yellow}15`,border:`1px solid ${C.yellow}44`,borderRadius:6,padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <p style={{fontSize:11,color:C.muted}}>Valor que será registrado</p>
                <p style={{fontSize:18,fontWeight:800,color:C.yellow}}>{fmt(formPrevisto)}</p>
              </div>
            )}

            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>setModal(false)} full>Cancelar</Btn>
              <Btn onClick={saveMedicao} full><Ic n="check"/> Salvar medição</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: conciliar parcelas que nasceram vencidas */}
      {conciliar && (() => {
        const m = (conciliar.medicoesBase||data.medicoes||[]).find(x => x.id === conciliar.fila[conciliar.idx]);
        if (!m) return null;
        const diasAtraso = Math.max(0, Math.round(
          (new Date(today()) - new Date(m.dataVencimento)) / 86400000));
        const Opcao = ({ v, titulo, sub, cor }) => (
          <label onClick={()=>setConciliar(c=>({...c,modo:v}))}
                 style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",padding:"10px 12px",
                         background: conciliar.modo===v ? `${cor}12` : C.surface,
                         border:`1.5px solid ${conciliar.modo===v ? cor : C.border}`,borderRadius:6}}>
            <div style={{width:18,height:18,borderRadius:"50%",flexShrink:0,marginTop:1,
                         border:`2px solid ${conciliar.modo===v?cor:C.muted}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {conciliar.modo===v && <div style={{width:9,height:9,borderRadius:"50%",background:cor}}/>}
            </div>
            <div>
              <p style={{fontSize:13,fontWeight:700,color:conciliar.modo===v?cor:C.text}}>{titulo}</p>
              <p style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.5}}>{sub}</p>
            </div>
          </label>
        );
        return (
          <Modal title={`Parcela vencida ${conciliar.idx+1} de ${conciliar.fila.length}`} onClose={conciliarDecidirDepois}>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.red||"#C62828"}`,borderRadius:6,padding:"11px 13px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
                  <p style={{fontSize:13,fontWeight:800,color:C.text}}>{obra?.name}</p>
                  <p style={{fontSize:15,fontWeight:800,color:C.yellow}}>{fmt(m.valorPrevisto)}</p>
                </div>
                <p style={{fontSize:11.5,color:C.muted,marginTop:3,lineHeight:1.5}}>
                  {m.descricao || "Parcela"}<br/>
                  Venceu em <b>{fmtDate(m.dataVencimento)}</b>{diasAtraso>0 && ` - há ${diasAtraso} dia(s)`}
                </p>
              </div>

              <p style={{fontSize:12.5,fontWeight:700,color:C.text}}>
                Esta parcela já foi paga?
              </p>

              <Opcao v="vencimento" cor={C.green}
                     titulo={`Sim - pago em ${fmtDate(m.dataVencimento)}`}
                     sub="Registra o recebimento na própria data de vencimento do contrato."/>
              <Opcao v="outra" cor={C.yellow}
                     titulo="Pago, mas em outra data"
                     sub="Use quando o dinheiro entrou fora do dia combinado."/>
              {conciliar.modo === "outra" && (
                <Inp label="Data real do pagamento *" type="date" value={conciliar.dataOutra}
                     onChange={v=>setConciliar(c=>({...c,dataOutra:v}))}/>
              )}
              <Opcao v="aberto" cor={C.muted}
                     titulo="Ainda não foi paga"
                     sub="A parcela continua em aberto e aparece como vencida no painel."/>

              <div style={{display:"flex",gap:8}}>
                <Btn v="ghost" onClick={conciliarDecidirDepois} full>Decidir depois</Btn>
                <Btn onClick={()=>conciliarAplicar()} full><Ic n="check"/> Confirmar</Btn>
              </div>
              {conciliar.fila.length - conciliar.idx > 1 && (
                <button onClick={conciliarTodasNoVencimento}
                        style={{background:"transparent",border:0,color:C.muted,fontSize:11,fontWeight:600,cursor:"pointer",textDecoration:"underline",padding:0}}>
                  Todas as {conciliar.fila.length - conciliar.idx} restantes foram pagas no vencimento
                </button>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* Modal: gerar parcelas automáticas */}
      {/* Confirmar recebimento perguntando a DATA DE PAGAMENTO */}
      {pagarModal && (
        <Modal title="Confirmar recebimento" onClose={()=>setPagarModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"11px 13px"}}>
              <p style={{fontSize:13,fontWeight:700,color:C.text}}>{pagarModal.m.obraName}</p>
              <p style={{fontSize:12,color:C.muted,marginTop:2}}>
                {fmt(pagarModal.m.valorPrevisto)}
                {pagarModal.m.descricao ? ` - ${pagarModal.m.descricao}` : ""}
              </p>
            </div>
            <Inp label="Data do pagamento *" type="date" value={pagarModal.data}
                 onChange={v=>setPagarModal(p=>({...p,data:v}))}/>
            {/* Atalho: o caso mais comum e o pagamento ter saido no dia combinado. */}
            {pagarModal.m.dataVencimento && pagarModal.data !== pagarModal.m.dataVencimento && (
              <button onClick={()=>setPagarModal(p=>({...p,data:p.m.dataVencimento}))}
                      style={{alignSelf:"flex-start",background:"transparent",border:`1px solid ${C.yellow}`,color:C.yellow,
                              padding:"4px 10px",borderRadius:4,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                Pagou no dia do contrato ({fmtDate(pagarModal.m.dataVencimento)})
              </button>
            )}
            <p style={{fontSize:10.5,color:C.muted,lineHeight:1.5}}>
              Informe quando o valor efetivamente entrou. Costuma ser diferente do dia
              em que voce confirma aqui.
            </p>
            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>setPagarModal(null)} full>Cancelar</Btn>
              <Btn v="success" disabled={measurementCommandPending} onClick={async()=>{
                const m = pagarModal.m;
                const dataPg = pagarModal.data || today();
                const ok=await confirmarRecebimento(m,dataPg);
                if(ok){
                  showToast(`${m.obraName} - ${fmt(m.valorPrevisto)} recebido em ${fmtDate(dataPg)}.`);
                  setPagarModal(null);
                }
              }} full><Ic n="check"/> {measurementCommandPending?"Confirmando...":"Confirmar"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {gerarModal && obra && (
        <Modal title="Gerar parcelas automaticamente" onClose={()=>setGerarModal(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:6,padding:"12px 14px"}}>
              <p style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:6}}>{obra.name}</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {[
                  ["Parcela mensal",  fmt(obra.parcelaMensal)],
                  ["Total parcelas",  `${obra.totalParcelas||"-"}`],
                  ["Início",          fmtDateFull(obra.contractStart)],
                  ["Fim previsto",    obra.contractEnd?fmtDateFull(obra.contractEnd):"-"],
                ].map(([l,v])=>(
                  <div key={l}>
                    <p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:700}}>{l}</p>
                    <p style={{fontSize:13,fontWeight:700,color:C.text,marginTop:1}}>{v}</p>
                  </div>
                ))}
              </div>
              <div style={{marginTop:10,padding:"8px 0",borderTop:`1px solid ${C.line}`}}>
                <p style={{fontSize:13,color:C.text,fontWeight:700}}>
                  Total gerado: {fmt(Number(obra.parcelaMensal)*(obra.totalParcelas||12))}
                </p>
                <p style={{fontSize:11,color:C.muted,marginTop:2}}>
                  {obra.totalParcelas||12} parcelas de {fmt(obra.parcelaMensal)}
                </p>
              </div>
            </div>

            <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"10px 12px",background:C.surface,borderRadius:6,border:`1.5px solid ${C.border}`}}>
              <div onClick={()=>setGerarOpts(o=>({...o,sobreescrever:!o.sobreescrever}))} style={{width:18,height:18,border:`2px solid ${gerarOpts.sobreescrever?C.red:C.muted}`,background:gerarOpts.sobreescrever?C.red:"transparent",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                {gerarOpts.sobreescrever&&<span style={{color:"#fff",fontSize:11,fontWeight:900}}>ok</span>}
              </div>
              <div>
                <p style={{fontSize:13,fontWeight:700,color:gerarOpts.sobreescrever?C.red:C.muted}}>Substituir medições existentes</p>
                <p style={{fontSize:11,color:C.muted}}>Se desmarcado, pula meses que já têm medição</p>
              </div>
            </label>

            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>setGerarModal(false)} full>Cancelar</Btn>
              <Btn v="primary" onClick={gerarParcelasFixas} full> Gerar {obra.totalParcelas||12} parcelas</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default MedicoesView;
