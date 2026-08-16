// ===================================================================
// TerceirosView — tela de Terceiros extraída de LegacyApp.jsx
//
// Extraído verbatim (mesmo corpo, mesma lógica) de src/LegacyApp.jsx em
// 2026-08-15, como primeiro passo de "separar os módulos" — mesma camada
// de dados (blob company_app_data + comandos de src/domains/financeiro/
// third-party-commands.js), sem nova migration/RLS. Ver
// docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #3 da fila de extração.
// ===================================================================

import { useCallback, useMemo, useRef, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "../../../components/charts/LazyRecharts";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import {
  Badge, Btn, C, CampoCNPJ, Ic, Inp, Modal, PageHero, Sel, TabRow,
  compLabel, comprimirImagem, fmt, fmtDateFull, fullMonth, today, uid,
} from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { cancelRecord as cancelarRegistro } from "../../data/soft-delete";
import {
  digitsOnly as soDigitos,
  formatBrazilianDocument as maskDoc,
  formatCEP as maskCEP,
  validateBrazilianDocument as validarDocumento,
} from "../../data/brazilian-documents";
import { calculateWithholdings as calcRetencoes } from "../withholdings";
import {
  THIRD_PARTY_DOCUMENT_TYPES as DOCS_TERC,
  THIRD_PARTY_SPECIALTIES as SPECIALTIES,
  THIRD_PARTY_SUGGESTED_STAGES as ETAPAS_SUGERIDAS,
  thirdPartyDocumentType as docTercInfo,
  thirdPartySpecialty as specInfo,
} from "../catalog";
import {
  daysUntil as diasAte,
  THIRD_PARTY_KANBAN_COLUMNS as COLS_KANBAN,
  thirdPartyKanbanColumn as colKanban,
} from "../workflow";
import {
  paymentFriday as getFridayOfWeek,
  paymentWeekRange as getWeekRange,
} from "../payment-week";
import {
  isActiveThirdPartyContract,
  isThirdPartyRecordActive as registroTerceiroAtivo,
  isVisibleThirdPartyContract,
} from "../lifecycle";
import { enviarArquivoOneDrive } from "../../../api";

export default function Terceiros({ data, update, showToast, obraIdFixo="", currentUser=null, dispatchCommand=null }) {
  const { formGrid } = useBreakpoint();
  const perfil=currentUser?.role;
  const podeGerenciarContratos=["admin","rh","engenheiro","engenheiro_auditor","financeiro"].includes(perfil);
  const podeGerenciarMedicoes=["admin","engenheiro","engenheiro_auditor"].includes(perfil);
  const podeGerenciarPagamentos=["admin","financeiro"].includes(perfil);
  const ehRH = perfil === "rh";
  const emptyT = { id:"", prestadorId:"", name:"", specialty:"eletricista", obraId:"", contractValue:"", weeklyRate:"", phone:"", pixKey:"", notes:"", startDate:today(),
    situacao:"andamento", endDate:"", tipoPessoa:"PJ", documento:"", razaoSocial:"", inscEstadual:"", inscMunicipal:"",
    email:"", responsavel:"", cep:"", endereco:"", cidade:"", ufEnd:"", tipoContrato:"medicao",
    banco:"", agencia:"", conta:"", retISS:"", retINSS:"", retISSQuem:"fonte", retINSSQuem:"fonte" };
  const [view,        setView]        = useState("kanban");
  const [weekOffset,  setWeekOffset]  = useState(0);
  const [modal,       setModal]       = useState(false);
  const [form,        setForm]        = useState(emptyT);
  const [payModal,    setPayModal]    = useState(null);
  const [payAmount,   setPayAmount]   = useState("");
  const [payDesc,     setPayDesc]     = useState("");
  const [paySource,   setPaySource]   = useState("");     // empresa | obra, escolhido em cada pagamento
  const [medPayModal, setMedPayModal] = useState(null);   // medição aguardando confirmação de pagamento
  const [notaTercModal,setNotaTercModal]=useState(null);
  const [notaTercId,setNotaTercId]=useState("");
  const [filterObra,  setFilterObra]  = useState(obraIdFixo||"all");
  const [filterSpec,  setFilterSpec]  = useState("all");
  const [searchTerc,  setSearchTerc]  = useState("");
  const [expanded,    setExpanded]    = useState(null);
  const [cancelContract,setCancelContract]=useState(null);
  const [cancelReason,setCancelReason]=useState("");
  const [reversePayment,setReversePayment]=useState(null);
  const [reverseReason,setReverseReason]=useState("");
  const [stageToRemove,setStageToRemove]=useState(null);
  const [contractDraft,setContractDraft]=useState(null);
  const [tercSel,     setTercSel]     = useState("");     // contrato aberto em Medições
  const [arrastando,  setArrastando]  = useState(null);   // id do card em drag
  const [colunaAlvo,  setColunaAlvo]  = useState(null);   // coluna sob o card
  const [docForm,     setDocForm]     = useState({ tipo:"CND", numero:"", validade:"" });
  const [etapaForm,   setEtapaForm]   = useState({ id:"", nome:"", valor:"" });
  const [medModal,    setMedModal]    = useState(false);
  const [medForm,     setMedForm]     = useState({ data: today(), observacao:"", pcts:{}, fotos:[] });
  const [subindoFotosMed,setSubindoFotosMed]=useState(false);
  const [riscoSemFotoAceito,setRiscoSemFotoAceito]=useState(false);
  const [thirdPartyCommandPending,setThirdPartyCommandPending]=useState(false);
  const inputFotosMedRef=useRef(null);
  const podeRegistrarEvidencia=podeGerenciarMedicoes&&currentUser?.active!==false;

  const F = k => v => setForm(f => ({ ...f, [k]: v }));
  const obraName = id => data.obras.find(o => o.id === id)?.name || "-";
  const novoContratoVazio = () => ({ ...emptyT, obraId: obraIdFixo || "" });
  const closeContractModal = () => {
    if(!form.id && (form.name||form.documento||form.obraId||form.contractValue)){
      setContractDraft({...form});
      showToast("Rascunho do contrato preservado nesta sessão.");
    }
    setModal(false);
  };

  // Abre o modal para editar: numeros viram string (os inputs sao de texto) e
  // os campos novos preservam o que ja existe.
  const editarTerc = t => {
    setForm({ ...emptyT, ...t,
      weeklyRate: String(t.weeklyRate || ""), contractValue: String(t.contractValue || ""),
      retISS: t.retISS ? String(t.retISS) : "", retINSS: t.retINSS ? String(t.retINSS) : "",
      documentos: (t.documentos || []).map(d => ({ ...d })) });
    setDocForm({ tipo: "CND", numero: "", validade: "" });
    setModal(true);
  };

  const friday     = getFridayOfWeek(weekOffset);
  const { start: weekStart, end: weekEnd } = getWeekRange(friday);
  const allTerc    = data.terceirizados || [];
  const scopedTerc = obraIdFixo ? allTerc.filter(t => t.obraId === obraIdFixo) : allTerc;
  const activeTerc = scopedTerc.filter(isActiveThirdPartyContract);
  // Somente contratos recorrentes entram na fila semanal. Contratos por
  // medição/empreitada geram obrigação exclusivamente ao confirmar a medição.
  // Cadastros antigos sem tipo explícito continuam recorrentes quando possuem
  // valor semanal, evitando esconder pagamentos já operados antes da migração.
  const recurringTerc = activeTerc.filter(t =>
    (["semanal","diaria"].includes(t.tipoContrato) || !t.tipoContrato) && Number(t.weeklyRate || 0) > 0);
  const kanbanTerc = scopedTerc.filter(isVisibleThirdPartyContract);

  // Um mesmo prestador pode possuir vários contratos. O cadastro fiscal,
  // bancário e de contato é compartilhado pelo `prestadorId`; obra, escopo,
  // valores, etapas, medições e pagamentos continuam isolados pelo `id`.
  const prestadorKey = t => t?.prestadorId || t?.id || "";
  const prestadoresUnicos = useMemo(() => {
    const mapa = new Map();
    allTerc.forEach(t => {
      const chave = prestadorKey(t);
      if (chave && !mapa.has(chave)) mapa.set(chave, t);
    });
    return [...mapa.values()].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
  }, [allTerc]);

  const contratosDoPrestador = t => {
    const chave = prestadorKey(t);
    return chave ? allTerc.filter(x => prestadorKey(x) === chave) : [];
  };

  const cadastroCompartilhado = t => ({
    prestadorId: prestadorKey(t),
    name: t.name || "",
    tipoPessoa: t.tipoPessoa || "PJ",
    documento: t.documento || "",
    razaoSocial: t.razaoSocial || "",
    inscEstadual: t.inscEstadual || "",
    inscMunicipal: t.inscMunicipal || "",
    phone: t.phone || "",
    pixKey: t.pixKey || "",
    email: t.email || "",
    responsavel: t.responsavel || "",
    cep: t.cep || "",
    endereco: t.endereco || "",
    cidade: t.cidade || "",
    ufEnd: t.ufEnd || "",
    banco: t.banco || "",
    agencia: t.agencia || "",
    conta: t.conta || "",
    documentos: (t.documentos || []).map(d => ({ ...d })),
  });

  const montarNovoContrato = t => ({
    ...emptyT,
    ...cadastroCompartilhado(t),
    // A especialidade é apenas uma sugestão: pode variar por contrato.
    specialty: t.specialty || emptyT.specialty,
    obraId: obraIdFixo || "",
    contractValue: "",
    weeklyRate: "",
    notes: "",
    startDate: today(),
    endDate: "",
    situacao: "contratado",
    tipoContrato: t.tipoContrato || "medicao",
    retISS: t.retISS ? String(t.retISS) : "",
    retINSS: t.retINSS ? String(t.retINSS) : "",
    retISSQuem: t.retISSQuem || "fonte",
    retINSSQuem: t.retINSSQuem || "fonte",
    etapas: [],
  });

  const novoContratoDoPrestador = t => {
    setForm(montarNovoContrato(t));
    setDocForm({ tipo:"CND", numero:"", validade:"" });
    setModal(true);
  };

  const wasPaidThisWeek = id =>
    (data.pagsTerceiros || []).some(p =>
      registroTerceiroAtivo(p)&&p.tercId === id && p.date >= weekStart && p.date <= weekEnd);
  const thisWeekPay = id =>
    (data.pagsTerceiros || []).find(p =>
      registroTerceiroAtivo(p)&&p.tercId === id && p.date >= weekStart && p.date <= weekEnd);

  // KPIs
  const totalWeekly     = recurringTerc.reduce((s, t) => s + Number(t.weeklyRate || 0), 0);
  const totalContracts  = kanbanTerc.reduce((s, t) => s + Number(t.contractValue || 0), 0);
  const scopedTercIds   = new Set(kanbanTerc.map(t => t.id));
  const totalPaidAll    = (data.pagsTerceiros || [])
    .filter(p => registroTerceiroAtivo(p)&&scopedTercIds.has(p.tercId))
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingCount    = recurringTerc.filter(t => !wasPaidThisWeek(t.id)).length;
  const pendingTotal    = recurringTerc.filter(t => !wasPaidThisWeek(t.id)).reduce((s,t) => s+Number(t.weeklyRate||0), 0);

  const filteredTerc = kanbanTerc
    .filter(t => filterObra === "all" || t.obraId === filterObra)
    .filter(t => filterSpec === "all" || t.specialty === filterSpec)
    .filter(t => {
      const q=searchTerc.trim().toLocaleLowerCase("pt-BR");
      return !q || [t.name,t.razaoSocial,t.documento,t.specialty,obraName(t.obraId)]
        .some(value=>String(value||"").toLocaleLowerCase("pt-BR").includes(q));
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const saveTerc = async () => {
    if (!form.name.trim()) { showToast("Nome obrigatório.", "error"); return; }
    if (!form.obraId) {
      showToast("Selecione a obra deste contrato.", "error"); return;
    }
    // Documento só trava se preenchido e inválido: cadastro parcial é comum,
    // mas CNPJ/CPF digitado errado vira problema na nota fiscal.
    const docLimpo = soDigitos(form.documento);
    if (docLimpo && !validarDocumento(docLimpo, form.tipoPessoa)) {
      showToast(`${form.tipoPessoa === "PF" ? "CPF" : "CNPJ"} inválido - confira os dígitos.`, "error"); return;
    }

    // Ao informar um documento já existente, o sistema NÃO bloqueia. Ele liga
    // o novo contrato ao cadastro principal encontrado e mantém outro `id`
    // para que obra, medições e pagamentos permaneçam independentes.
    const existentePorDocumento = docLimpo ? allTerc.find(t =>
      t.id !== form.id &&
      (t.tipoPessoa || "PJ") === (form.tipoPessoa || "PJ") &&
      soDigitos(t.documento) === docLimpo
    ) : null;

    const contratoId = form.id || uid();
    const prestadorId = form.prestadorId || prestadorKey(existentePorDocumento) || uid();
    const payload = {
      ...form,
      id: contratoId,
      prestadorId,
      weeklyRate: Number(form.weeklyRate || 0),
      contractValue: Number(form.contractValue || 0),
      retISS: Number(form.retISS || 0),
      retINSS: Number(form.retINSS || 0),
      documento: docLimpo,
      cep: soDigitos(form.cep),
      // active espelha situação para o resto do app continuar funcionando.
      active: form.situacao !== "concluido" && form.situacao !== "pausado",
      documentos: (form.documentos || []).map(d => ({ ...d })),
    };

    // Estes campos pertencem ao cadastro principal do prestador. Ao atualizá-
    // los em um contrato, todos os demais contratos vinculados recebem a mesma
    // informação. Os campos contratuais não são tocados.
    const compartilhado = cadastroCompartilhado(payload);
    const pertenceAoMesmoPrestador = t =>
      prestadorKey(t) === prestadorId ||
      (!!docLimpo && (t.tipoPessoa || "PJ") === (form.tipoPessoa || "PJ") && soDigitos(t.documento) === docLimpo);

    let terceirizados = allTerc.map(t => {
      if (t.id === form.id) return payload;
      if (pertenceAoMesmoPrestador(t)) return { ...t, ...compartilhado, prestadorId };
      return t;
    });
    if (!form.id) terceirizados = [...terceirizados, payload];

    const result = await update({ ...data, terceirizados });
    if (result && result.ok === false) {
      showToast(result.reason || "O servidor não confirmou o cadastro. Tente novamente.", "error");
      return;
    }
    setModal(false);
    setContractDraft(null);
    const obra = obraName(payload.obraId);
    if (form.id) showToast("Cadastro e contrato atualizados.");
    else if (existentePorDocumento || form.prestadorId) showToast(`Novo contrato de ${payload.name} criado para ${obra}.`);
    else showToast(`Terceirizado cadastrado e contrato criado para ${obra}.`);
  };

  // Adiciona/remove documento diretamente no form aberto (antes de salvar).
  const addDocNoForm = () => {
    if (!docForm.validade) { showToast("Informe a validade do documento.", "error"); return; }
    setForm(f => ({ ...f, documentos: [...(f.documentos || []),
      { id: uid(), tipo: docForm.tipo, numero: String(docForm.numero || "").trim(), validade: docForm.validade }] }));
    setDocForm({ tipo: "CND", numero: "", validade: "" });
  };
  const delDocNoForm = id => setForm(f => ({ ...f, documentos: (f.documentos || []).filter(d => d.id !== id) }));

  const removeTerc = id => {
    const contrato=allTerc.find(t=>t.id===id);
    if(!contrato)return;
    setCancelContract(contrato);setCancelReason("");
  };
  const confirmRemoveTerc = async () => {
    const motivo=cancelReason.trim();
    if(!cancelContract||!motivo){showToast("Informe o motivo do cancelamento.","error");return;}
    const result=await update({ ...data, terceirizados: allTerc.map(t => t.id===cancelContract.id?{...cancelarRegistro(t,motivo,currentUser,"cancelado"),active:false}:t) });
    if(result&&result.ok===false){
      showToast(result.reason||"O servidor não confirmou o cancelamento. Tente novamente.","error");return;
    }
    setCancelContract(null);setCancelReason("");
    showToast("Contrato cancelado e preservado no histórico.");
  };

  const toggleActive = async id => {
    const terceirizados = allTerc.map(t => t.id === id ? { ...t, active: !t.active } : t);
    const result=await update({ ...data, terceirizados });
    if(result&&result.ok===false){
      showToast(result.reason||"O servidor não confirmou a alteração. Tente novamente.","error");return;
    }
    showToast("Status atualizado.");
  };

  const savePay = async terc => {
    if(!dispatchCommand||thirdPartyCommandPending)return;
    const amount = Number(payAmount || terc.weeklyRate || 0);
    if (!amount) { showToast("Informe o valor.", "error"); return; }
    if (paySource !== "empresa" && paySource !== "obra") {
      showToast("Informe se o pagamento foi realizado pela empresa ou pela obra.", "error"); return;
    }
    if (paySource === "obra" && !terc.obraId) {
      showToast("Este contrato não possui obra vinculada.", "error"); return;
    }
    const ret = calcRetencoes(amount, terc);
    setThirdPartyCommandPending(true);
    try {
      const paymentId = uid();
      const result=await dispatchCommand(()=>({
        type:OPERATIONAL_COMMAND.THIRD_PARTY_PAYMENT_RECORDED,
        idempotencyKey:`third-payment-create-${paymentId}-${uid()}`,
        expectedVersion:0,
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{payment:{
          id:paymentId,tercId:terc.id,date:friday,amount,
          description:payDesc || `Pagamento semanal ${fmtDateFull(friday)}`,
          pagador:paySource,issRetido:ret.issRetido,
          inssRetido:ret.inssRetido,liquido:ret.liquido,
        }},
      }));
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o pagamento.");
      setPayModal(null); setPayAmount(""); setPayDesc(""); setPaySource("");
      const origem = paySource === "empresa" ? "pela empresa" : `pela obra ${obraName(terc.obraId)}`;
      showToast(ret.retido > 0
        ? `${terc.name} - ${fmt(amount)} bruto, ${fmt(ret.liquido)} líquido, pago ${origem}.`
        : `${terc.name} - pagamento registrado ${origem}.`);
    } catch (error) {
      showToast(error.message||"Não foi possível registrar o pagamento.","error");
    } finally {
      setThirdPartyCommandPending(false);
    }
  };

  const removePay = id => {
    const payment=(data.pagsTerceiros||[]).find(item=>item.id===id);
    if(payment){setReversePayment(payment);setReverseReason("");}
  };
  const confirmRemovePay = async () => {
    const id=reversePayment?.id;
    const motivo=reverseReason.trim();
    if(!id||!motivo){showToast("Informe o motivo do estorno.","error");return;}
    if(!dispatchCommand||thirdPartyCommandPending)return;
    setThirdPartyCommandPending(true);
    try {
      const result=await dispatchCommand(atual=>{
        const vigente=(atual.pagsTerceiros||[]).find(item=>item.id===id);
        return {
          type:OPERATIONAL_COMMAND.THIRD_PARTY_PAYMENT_REVERSED,
          idempotencyKey:`third-payment-reverse-${id}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{paymentId:id,reason:motivo},
        };
      });
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o estorno.");
      setReversePayment(null);setReverseReason("");
      showToast("Pagamento estornado e preservado para auditoria.");
    } catch (error) {
      showToast(error.message||"Não foi possível estornar o pagamento.","error");
    } finally {
      setThirdPartyCommandPending(false);
    }
  };

  //  KANBAN DE CONTRATOS 

  // Cards visiveis no Kanban, ja filtrados por obra.
  // Avanco fisico de um contrato: medido / soma das etapas. Sem etapas, cai no
  // que ja existe (pago / valor do contrato) para o card nunca ficar mudo.
  const avancoContrato = useCallback(t => {
    const etapas = t.etapas || [];
    const meds = (data.medicoesTerc || [])
      .filter(m => registroTerceiroAtivo(m)&&m.tercId === t.id);
    if (etapas.length) {
      const soma = etapas.reduce((s, e) => s + Number(e.valor || 0), 0);
      const medido = meds.reduce((s, m) => s + Number(m.total || 0), 0);
      return soma > 0 ? Math.min(100, medido / soma * 100) : 0;
    }
    const pago = (data.pagsTerceiros || [])
      .filter(p => registroTerceiroAtivo(p)&&p.tercId === t.id)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const val = Number(t.contractValue || 0);
    return val > 0 ? Math.min(100, pago / val * 100) : 0;
  }, [data.medicoesTerc, data.pagsTerceiros]);

  // Kanban POR OBRA. Cada obra com pelo menos um terceirizado vira um quadro
  // próprio; obra sem terceiro não aparece. Ordem: primeiro as obras com MAIS
  // terceiros; no empate, a que está MAIS NO INÍCIO da execução (menor avanço
  // médio de contrato). A origem financeira é escolhida por pagamento e não
  // interfere na organização contratual por obra.
  const kanbansPorObra = useMemo(() => {
    const grupos = {};
    kanbanTerc.forEach(t => {
      const chave = t.obraId || "__sem_obra__";
      (grupos[chave] = grupos[chave] || []).push(t);
    });
    const avancoMedio = lista => lista.length
      ? lista.reduce((s,t)=>s+avancoContrato(t),0) / lista.length : 0;
    return Object.entries(grupos)
      .map(([obraId, lista]) => ({
        obraId,
        nome: obraId === "__sem_obra__" ? "Sem obra vinculada" : obraName(obraId),
        especial: obraId === "__sem_obra__",
        lista,
        qtd: lista.length,
        avanco: avancoMedio(lista),
      }))
      .sort((a,b) => {
        // Blocos especiais (empresa / sem obra) sempre por último.
        if (a.especial !== b.especial) return a.especial ? 1 : -1;
        // Mais terceiros primeiro.
        if (b.qtd !== a.qtd) return b.qtd - a.qtd;
        // Empate: mais no início da execução (menor avanço) primeiro.
        return a.avanco - b.avanco;
      });
  }, [kanbanTerc, avancoContrato, obraName]);

  // Distribui uma lista de terceiros nas 4 colunas de situação. Reutilizável:
  // cada quadro-por-obra chama com a sua própria lista.
  const distribuirColunas = useCallback(lista => {
    const mapa = Object.fromEntries(COLS_KANBAN.map(c => [c.v, []]));
    (lista || []).forEach(t => {
      const col = colKanban(t.situacao).v;
      (mapa[col] || mapa.andamento).push(t);
    });
    return mapa;
  }, []);

  // Dias em que cada terceirizado aparece como presente/meio nos diários de
  // obra (RDO). Fecha o ciclo: o que foi marcado no diário vira histórico de
  // presença no contrato, sem digitação dupla.
  const diasDiarioTerc = useMemo(() => {
    const mapa = {};
    (data.rdos || []).forEach(r => (r.terceirizados || []).forEach(t => {
      if (t.status === "falta") return;
      mapa[t.tercId] = mapa[t.tercId] || { dias: 0, meios: 0, datas: [] };
      if (t.status === "meio") mapa[t.tercId].meios += 1;
      else mapa[t.tercId].dias += 1;
      mapa[t.tercId].datas.push(r.data);
    }));
    return mapa;
  }, [data.rdos]);

  // Move um contrato de coluna. Concluir sem ter medido tudo e permitido (o
  // usuario manda), mas fica avisado - contrato entregue costuma estar 100%.
  const moverSituacao = (t, novaSituacao) => {
    if (t.situacao === novaSituacao) return;
    const patch = { situacao: novaSituacao, active: novaSituacao !== "concluido" && novaSituacao !== "pausado" ? true : t.active };
    if (novaSituacao === "concluido") {
      patch.active = false;
      if (!t.endDate) patch.endDate = today();
      const av = avancoContrato(t);
      if (av < 99.5) showToast(`${t.name} concluído com ${av.toFixed(0)}% medido. Confira as medições em aberto.`, "warn");
    }
    if (novaSituacao === "andamento" || novaSituacao === "contratado") patch.endDate = "";
    if (novaSituacao === "pausado") patch.active = false;
    update({ ...data, terceirizados: allTerc.map(x => x.id === t.id ? { ...x, ...patch } : x) });
  };

  const soltarNaColuna = col => {
    setColunaAlvo(null);
    const t = allTerc.find(x => x.id === arrastando);
    setArrastando(null);
    if (t && col) moverSituacao(t, col);
  };

  //  DOCUMENTOS DO TERCEIRIZADO 

  // Documentos dos contratos visíveis neste contexto, achatados para o painel.
  const documentosPendentes = useMemo(() => {
    const lista = [];
    kanbanTerc.forEach(t => (t.documentos || []).forEach(doc => {
      const dias = diasAte(doc.validade);
      if (dias === null) return;
      if (dias <= 30) lista.push({ ...doc, tercId: t.id, tercName: t.name, obraId: t.obraId, dias });
    }));
    return lista.sort((a, b) => a.dias - b.dias);
  }, [kanbanTerc]);

  //  ETAPAS DO CONTRATO E MEDICOES 
  // "1.500,00" | "1500.50" | 1500 -> number. Decide pelo separador que aparece
  // por ultimo: quem vier depois e a virgula decimal, o outro e milhar.
  const num = v => {
    if (typeof v === "number") return v;
    const t = String(v ?? "").trim().replace(/[^\d,.-]/g, "");
    if (!t) return 0;
    const vi = t.lastIndexOf(","), pi = t.lastIndexOf(".");
    let n = t;
    if (vi >= 0 && pi >= 0) n = vi > pi ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
    else if (vi >= 0) n = t.replace(",", ".");
    return Number(n) || 0;
  };
  const pct = v => Math.max(0, Math.min(100, Number(String(v ?? "").replace(",", ".")) || 0));

  const tercAtual = kanbanTerc.find(t => t.id === tercSel) || null;
  const etapasTerc = tercAtual?.etapas || [];

  // Medicoes em ordem cronologica. O acumulado de uma etapa e o da ULTIMA
  // medicao que a mediu - por isso a ordem importa mais que o numero.
  const medicoesDo = id => (data.medicoesTerc || [])
    .filter(m => registroTerceiroAtivo(m)&&m.tercId === id)
    .sort((a, b) => (a.data + a.id).localeCompare(b.data + b.id));

  const medicoesTercAtual = tercSel ? medicoesDo(tercSel) : [];

  const acumuladoPorEtapa = useMemo(() => {
    const mapa = {};
    medicoesTercAtual.forEach(m => m.itens.forEach(i => { mapa[i.etapaId] = Number(i.pctAcum || 0); }));
    return mapa;
  }, [data.medicoesTerc, tercSel]);

  const somaEtapas   = etapasTerc.reduce((s, e) => s + Number(e.valor || 0), 0);
  const totalMedido  = medicoesTercAtual.reduce((s, m) => s + Number(m.total || 0), 0);
  // Avanco fisico ponderado pelo valor de cada etapa - nao pela contagem.
  const pctFisico    = somaEtapas > 0
    ? etapasTerc.reduce((s, e) => s + Number(e.valor || 0) * (acumuladoPorEtapa[e.id] || 0) / 100, 0) / somaEtapas * 100
    : 0;

  const salvarEtapasNoServidor = async (etapas, mensagem) => {
    if(!dispatchCommand||thirdPartyCommandPending)return false;
    setThirdPartyCommandPending(true);
    try{
      const result=await dispatchCommand(atual=>{
        const vigente=(atual.terceirizados||[]).find(item=>item.id===tercSel);
        return {
          type:OPERATIONAL_COMMAND.THIRD_PARTY_CONTRACT_STAGES_SAVED,
          idempotencyKey:`third-contract-stages-${tercSel}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{contractId:tercSel,stages:etapas},
        };
      });
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou as etapas do contrato.");
      showToast(mensagem);
      return true;
    }catch(error){
      showToast(error.message||"Não foi possível salvar as etapas do contrato.","error");
      return false;
    }finally{setThirdPartyCommandPending(false);}
  };

  const salvarEtapa = async () => {
    if (!tercAtual) return;
    const nome = String(etapaForm.nome || "").trim();
    if (!nome) { showToast("Informe o nome da etapa.", "error"); return; }
    const valor = num(etapaForm.valor);
    const etapas = etapaForm.id
      ? etapasTerc.map(e => e.id === etapaForm.id ? { ...e, nome, valor } : e)
      : [...etapasTerc, { id: uid(), nome, valor, ordem: etapasTerc.length }];
    if(await salvarEtapasNoServidor(etapas,etapaForm.id ? "Etapa atualizada e salva." : "Etapa adicionada e salva."))
      setEtapaForm({ id: "", nome: "", valor: "" });
  };

  const removerEtapa = async etapa => {
    if (acumuladoPorEtapa[etapa.id] > 0) {
      showToast("Esta etapa já foi medida. Zere a medição antes de removê-la.", "error"); return;
    }
    setStageToRemove(etapa);
  };
  const confirmarRemocaoEtapa = async () => {
    const etapa=stageToRemove;
    if(!etapa)return;
    const etapas=etapasTerc.filter(e => e.id !== etapa.id).map((e, i) => ({ ...e, ordem: i }));
    if(await salvarEtapasNoServidor(etapas,"Etapa removida e alteração salva.")){
      if(etapaForm.id === etapa.id)setEtapaForm({ id: "", nome: "", valor: "" });
      setStageToRemove(null);
    }
  };

  const moverEtapa = async (etapa, dir) => {
    const lista = [...etapasTerc];
    const i = lista.findIndex(e => e.id === etapa.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    await salvarEtapasNoServidor(lista.map((e, k) => ({ ...e, ordem: k })),"Ordem das etapas salva.");
  };

  // Sugere as etapas da especialidade e reparte o contrato por igual. E so um
  // ponto de partida: os valores sao editaveis um a um logo abaixo.
  const sugerirEtapas = async () => {
    if (!tercAtual) return;
    if (etapasTerc.length && !window.confirm("Isso substitui as etapas atuais deste contrato. Continuar?")) return;
    if (medicoesTercAtual.length) { showToast("Este contrato já tem medições. Ajuste as etapas manualmente.", "error"); return; }
    const nomes = ETAPAS_SUGERIDAS[tercAtual.specialty] || ETAPAS_SUGERIDAS.outros;
    const fatia = Number(tercAtual.contractValue || 0) / nomes.length;
    const etapas=nomes.map((nome, i) => ({ id: uid(), nome, valor: Math.round(fatia * 100) / 100, ordem: i }));
    await salvarEtapasNoServidor(etapas,`${nomes.length} etapas sugeridas e salvas. Ajuste os valores de cada uma.`);
  };

  const abrirMedicao = () => {
    if(!podeRegistrarEvidencia){showToast("A medição e suas fotografias devem ser registradas por um engenheiro de campo ou engenheiro auditor.","error");return;}
    if (!etapasTerc.length) { showToast("Subdivida o contrato em etapas antes de medir.", "error"); return; }
    // O formulario ja abre com o acumulado atual: voce so mexe no que avancou.
    setMedForm({ data: today(), observacao: "",
      pcts: Object.fromEntries(etapasTerc.map(e => [e.id, String(acumuladoPorEtapa[e.id] || 0)])), fotos:[] });
    setMedModal(true);
  };

  const anexarFotosMedicao=async arquivos=>{
    const files=[...(arquivos||[])].filter(f=>String(f.type||"").startsWith("image/"));
    if(!files.length)return;
    if(!podeRegistrarEvidencia){showToast("Somente engenheiros de campo ou auditores podem anexar a evidência da medição.","error");return;}
    if(!tercAtual?.obraId){showToast("O contrato precisa estar vinculado a uma obra para salvar as fotografias.","error");return;}
    const obraMed=data.obras.find(o=>o.id===tercAtual.obraId);
    if(!obraMed){showToast("Obra da medição não encontrada.","error");return;}
    setSubindoFotosMed(true);
    try{
      let driveId=obraMed.oneDriveDriveId,folderId=obraMed.oneDriveFolderId,folders=obraMed.oneDriveFolders;
      const novas=[];
      for(const [indice,file] of files.entries()){
        const dataUrl=await comprimirImagem(file);
        const r=await enviarArquivoOneDrive({dataUrl,obraName:obraMed.name,driveId,folderId,folders,category:"fotos",subfolder:`Medições de Terceirizados/${tercAtual.name}`,fileName:`medicao-${medicoesTercAtual.length+1}-${Date.now()}-${indice+1}.jpg`});
        if(!r.ok)throw new Error(r.error||`Falha ao enviar ${file.name}.`);
        driveId=r.workspace?.driveId||driveId;folderId=r.workspace?.folderId||folderId;folders=r.workspace?.folders||folders;
        novas.push({id:r.item?.id||uid(),url:r.url,path:r.path||r.item?.id||"",nome:file.name||`Foto ${indice+1}`,legenda:"",enviadoPorId:currentUser?.id||"",enviadoPor:currentUser?.nome||"Engenheiro",enviadoPorRole:currentUser?.role||"",enviadoEm:new Date().toISOString()});
      }
      if(driveId&&folderId&&(!obraMed.oneDriveDriveId||!obraMed.oneDriveFolderId))update({...data,obras:(data.obras||[]).map(o=>o.id===obraMed.id?{...o,oneDriveDriveId:driveId,oneDriveFolderId:folderId,oneDriveFolders:folders||o.oneDriveFolders}:o)});
      setMedForm(f=>({...f,fotos:[...(f.fotos||[]),...novas]}));
      showToast(`${novas.length} fotografia(s) anexada(s) à medição.`);
    }catch(error){showToast(error.message||"Não foi possível salvar as fotografias.","error");}
    finally{setSubindoFotosMed(false);}
  };

  const itensDaMedicao = () => etapasTerc.map(e => {
    const anterior = Number(acumuladoPorEtapa[e.id] || 0);
    const acum = pct(medForm.pcts?.[e.id] ?? anterior);
    return { etapaId: e.id, pctAnterior: anterior, pctAcum: acum,
             valor: Number(e.valor || 0) * (acum - anterior) / 100 };
  });

  const salvarMedicao = async () => {
    if (!tercAtual) return;
    if(!podeRegistrarEvidencia){showToast("Somente um engenheiro de campo ou auditor pode registrar esta medição.","error");return;}
    if(!(medForm.fotos||[]).length){
      showToast("Anexe ao menos uma fotografia da execução para confirmar e lançar a medição no DRE.","error");
      inputFotosMedRef.current?.click();
      return;
    }
    const itens = itensDaMedicao().filter(i => Math.abs(i.pctAcum - i.pctAnterior) > 0.0001);
    if (!itens.length) { showToast("Nenhuma etapa avançou desde a última medição.", "warn"); return; }
    const total = itens.reduce((s, i) => s + i.valor, 0);
    const medicao = {
      tercId: tercSel, obraId: tercAtual.obraId || "",
      data: medForm.data || today(), numero: medicoesTercAtual.length + 1,
      itens, total, observacao: String(medForm.observacao || "").trim(), pagamentoId: "",
      fotos:(medForm.fotos||[]).map(f=>({...f})),responsavelEvidenciaId:currentUser?.id||"",
      responsavelEvidencia:currentUser?.nome||"",responsavelEvidenciaRole:currentUser?.role||"",
    };
    if(!dispatchCommand||thirdPartyCommandPending)return;
    setThirdPartyCommandPending(true);
    try {
      const measurementId=uid();
      const result=await dispatchCommand(()=>({
        type:OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_RECORDED,
        idempotencyKey:`third-measurement-create-${measurementId}-${uid()}`,
        expectedVersion:0,
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{measurement:{...medicao,id:measurementId}},
      }));
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou a medição.");
      setMedModal(false);
      showToast(`Medição ${medicao.numero} confirmada: ${fmt(total)} lançado nas despesas do DRE de ${fullMonth(Number(medicao.data.slice(5,7))-1)} ${medicao.data.slice(0,4)}.`);
    } catch (error) {
      showToast(error.message||"Não foi possível registrar a medição.","error");
    } finally {
      setThirdPartyCommandPending(false);
    }
  };

  // A ultima medicao pode ser desfeita sem ambiguidade. Uma do meio nao: os
  // acumulados seguintes foram calculados em cima dela.
  const removerMedicao = async m => {
    const ultima = medicoesDo(m.tercId).slice(-1)[0];
    if (!ultima || ultima.id !== m.id) {
      showToast("Só a última medição pode ser removida - as seguintes partem dela.", "error"); return;
    }
    if (m.pagamentoId) { showToast("Esta medição já virou pagamento. Remova o pagamento primeiro.", "error"); return; }
    const motivo=window.prompt(`Motivo do cancelamento da medição ${m.numero}:`);
    if(!String(motivo||"").trim())return;
    if(!dispatchCommand||thirdPartyCommandPending)return;
    setThirdPartyCommandPending(true);
    try {
      const result=await dispatchCommand(atual=>{
        const vigente=(atual.medicoesTerc||[]).find(item=>item.id===m.id);
        return {
          type:OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_CANCELLED,
          idempotencyKey:`third-measurement-cancel-${m.id}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{measurementId:m.id,reason:motivo},
        };
      });
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o cancelamento.");
      showToast("Medição cancelada e preservada para auditoria.");
    } catch (error) {
      showToast(error.message||"Não foi possível cancelar a medição.","error");
    } finally {
      setThirdPartyCommandPending(false);
    }
  };

  const abrirPagamentoMedicao = m => {
    const t = allTerc.find(x => x.id === m.tercId);
    if (!t) return;
    if (m.pagamentoId) { showToast("Esta medição já foi paga.", "warn"); return; }
    if (!(m.total > 0)) { showToast("Medição sem valor a pagar.", "warn"); return; }
    setMedPayModal(m);
    setPaySource("");
    setRiscoSemFotoAceito(false);
  };

  const confirmarPagamentoMedicao = async () => {
    const m = medPayModal;
    if (!m) return;
    const t = allTerc.find(x => x.id === m.tercId);
    if (!t) return;
    if (paySource !== "empresa" && paySource !== "obra") {
      showToast("Informe se o pagamento foi realizado pela empresa ou pela obra.", "error"); return;
    }
    if (paySource === "obra" && !m.obraId) {
      showToast("Esta medição não possui obra vinculada.", "error"); return;
    }
    if (m.pagamentoId) { showToast("Esta medição já foi paga.", "warn"); setMedPayModal(null); return; }
    const semEvidencia=!(m.fotos||[]).length;
    if(semEvidencia&&!riscoSemFotoAceito){showToast("Pagamento de risco: confirme que o financeiro está ciente da ausência de fotografia.","error");return;}
    if(!dispatchCommand||thirdPartyCommandPending)return;
    setThirdPartyCommandPending(true);
    try {
      const ret = calcRetencoes(m.total, t);
      const paymentId = uid();
      const result=await dispatchCommand(atual=>{
        const vigente=(atual.medicoesTerc||[]).find(item=>item.id===m.id);
        return {
          type:OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_PAID,
          idempotencyKey:`third-measurement-pay-${m.id}-${paymentId}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{
            measurementId:m.id,riskAccepted:semEvidencia&&riscoSemFotoAceito,
            payment:{
              id:paymentId,date:today(),
              description:`Medição ${m.numero} - ${fmtDateFull(m.data)}`,
              pagador:paySource,issRetido:ret.issRetido,
              inssRetido:ret.inssRetido,liquido:ret.liquido,
            },
          },
        };
      });
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o pagamento.");
      const origem = paySource === "empresa" ? "pela empresa" : `pela obra ${obraName(m.obraId)}`;
      setMedPayModal(null); setPaySource(""); setRiscoSemFotoAceito(false);
      showToast(ret.retido > 0
        ? `Medição paga ${origem}: ${fmt(m.total)} bruto, ${fmt(ret.liquido)} líquido ao prestador.`
        : `Pagamento de ${fmt(m.total)} registrado ${origem} para ${t.name}.`);
    } catch (error) {
      showToast(error.message||"Não foi possível registrar o pagamento da medição.","error");
    } finally {
      setThirdPartyCommandPending(false);
    }
  };
  const confirmarVinculoNotaTerceiro=async()=>{
    if(!notaTercModal?.id||!notaTercId||!dispatchCommand||thirdPartyCommandPending)return;
    setThirdPartyCommandPending(true);
    try{
      const result=await dispatchCommand(atual=>{
        const medicao=(atual.medicoesTerc||[]).find(item=>item.id===notaTercModal.id);
        const nota=(atual.notasFiscais||[]).find(item=>item.id===notaTercId);
        return {
          type:OPERATIONAL_COMMAND.THIRD_PARTY_INVOICE_LINKED,
          idempotencyKey:`third-invoice-link-${notaTercModal.id}-${notaTercId}-${uid()}`,
          actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{
            measurementId:notaTercModal.id,invoiceId:notaTercId,
            expectedMeasurementVersion:Number(medicao?.version||0),
            expectedInvoiceVersion:Number(nota?.version||0),
          },
        };
      });
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o vínculo.");
      setNotaTercModal(null);setNotaTercId("");
      showToast("Nota fiscal vinculada à medição sem duplicar o custo.");
    }catch(error){
      showToast(error.message||"Não foi possível vincular a nota.","error");
    }finally{
      setThirdPartyCommandPending(false);
    }
  };

  // Medicao registrada e ainda nao paga e divida vencida com o terceiro. Ficava
  // invisivel: os KPIs so olhavam pagamento semanal e contrato.
  const medicoesAPagar = (data.medicoesTerc || []).filter(m =>
    registroTerceiroAtivo(m)&&scopedTercIds.has(m.tercId) && !m.pagamentoId && Number(m.total || 0) > 0
  );
  const totalAPagarMed = medicoesAPagar.reduce((s, m) => s + Number(m.total || 0), 0);
  const pagamentosSemEvidencia=(data.pagsTerceiros||[]).filter(p=>
    registroTerceiroAtivo(p)&&p.medicaoTercId&&p.semEvidenciaFotografica
    &&(filterObra==="all"||p.obraId===filterObra));

  // Avanco fisico de qualquer contrato, para o card do cadastro.
  const avancoDoContrato = t => {
    const etapas = t.etapas || [];
    const base = etapas.reduce((s, e) => s + Number(e.valor || 0), 0);
    if (!base) return null;
    const acum = {};
    medicoesDo(t.id).forEach(m => m.itens.forEach(i => { acum[i.etapaId] = Number(i.pctAcum || 0); }));
    return etapas.reduce((s, e) => s + Number(e.valor || 0) * (acum[e.id] || 0) / 100, 0) / base * 100;
  };

  const abrirContrato = t => {
    if (podeGerenciarMedicoes) {
      setTercSel(t.id);
      setView("medicoes");
      return;
    }
    setExpanded(t.id);
    setView("cadastro");
  };
  const abrirMedicoesDe = id => { setTercSel(id); setView("medicoes"); };
  const tabsTerceiros = [
    ["kanban","Quadro",activeTerc.length],
    ["cadastro","Cadastro",kanbanTerc.length],
    ...(podeGerenciarMedicoes ? [["medicoes","Medições",medicoesAPagar.length]] : []),
    ...(podeGerenciarPagamentos ? [["pagamentos","Pagamentos",pendingCount]] : []),
  ];
  const resumoTerceiros = [
    ["Ativos", activeTerc.length, "Contratos em execução"],
    ["Custo semanal", fmt(totalWeekly), "Previsão recorrente"],
    ["Contratado", fmt(totalContracts), `${kanbanTerc.length} contrato(s)`],
    ehRH
      ? ["Documentos críticos", documentosPendentes.length, "Vencidos ou a vencer"]
      : ["Pago", fmt(totalPaidAll), "Histórico acumulado"],
  ];

  const paidThisWeekAmount = recurringTerc.reduce((s, t) => {
    const p = thisWeekPay(t.id);
    return s + (p ? Number(p.amount) : 0);
  }, 0);

  //  JSX 
  return (
    <div className="anim terceiros-workspace">

      <PageHero
        eyebrow="Subcontratados"
        title="Terceirizados"
        description={ehRH
          ? "Cadastros, contratos, documentos e alocação da equipe subcontratada."
          : "Contratos, medições, documentos e pagamentos da equipe subcontratada."}
        actions={podeGerenciarContratos && <Btn onClick={() => { setForm(contractDraft||novoContratoVazio()); setModal(true); }}>
          <Ic n="plus"/> {contractDraft?"Continuar cadastro":"Novo contrato"}
        </Btn>}
      />

      {/* Resumo operacional: uma faixa única evita quatro cartões concorrentes. */}
      <section className="terceiros-summary" aria-label="Resumo dos terceirizados">
        {resumoTerceiros.map(([label,value,detail]) => (
          <div className="terceiros-summary__item" key={label}>
            <p className="terceiros-summary__label">{label}</p>
            <p className="terceiros-summary__value">{value}</p>
            <p className="terceiros-summary__detail">{detail}</p>
          </div>
        ))}
      </section>

      {podeGerenciarPagamentos && medicoesAPagar.length > 0 && (
        <button className="terceiros-pending" type="button" onClick={() => setView("medicoes")}>
          <span><Ic n="alert" s={15}/></span>
          <span className="terceiros-pending__copy">
            <b>{medicoesAPagar.length} medição(ões) aguardando pagamento</b>
            <small>Revise os lançamentos medidos antes de pagar.</small>
          </span>
          <strong>{fmt(totalAPagarMed)}</strong>
          <Ic n="chevR" s={15}/>
        </button>
      )}

      {/* Sub-nav */}
      <div className="terceiros-tabs">
        <TabRow equal tabs={tabsTerceiros} active={view} onChange={setView}/>
      </div>

      {/*  VIEW: KANBAN  */}
      {view === "kanban" && (<>
        <p className="terceiros-kanban-help">
          Arraste os cartões ou use os controles “Mover para”. Selecione um contrato para abrir {podeGerenciarMedicoes ? "as medições" : "o cadastro"}.
        </p>
        {/* Painel de documentos vencendo - so aparece quando ha pendencia */}
        {documentosPendentes.length > 0 && (
          <section className="terceiros-doc-alert" aria-label="Documentos críticos">
            <div className="terceiros-doc-alert__heading">
              <span><Ic n="alert" s={14}/></span>
              <div>
                <h3>Documentos críticos</h3>
                <p>{documentosPendentes.length} vencido(s) ou a vencer nos próximos 30 dias</p>
              </div>
            </div>
            <div className="terceiros-doc-alert__list">
              {documentosPendentes.slice(0, 6).map(doc => (
                <div className="terceiros-doc-alert__item" key={doc.id}>
                  <span>
                    <b>{doc.tercName}</b> · {docTercInfo(doc.tipo).l}
                  </span>
                  <strong data-critical={doc.dias <= 7}>
                    {doc.dias < 0 ? `vencido há ${Math.abs(doc.dias)}d` : doc.dias === 0 ? "vence hoje" : `${doc.dias}d`}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Colunas. Rolagem horizontal no celular; cada card arrasta entre colunas. */}
        {kanbansPorObra.length === 0 && (
          <section className="terceiros-empty">
            <span className="terceiros-empty__icon"><Ic n="users" s={22}/></span>
            <h3>Nenhum contrato de terceiro nesta obra</h3>
            <p>Cadastre o primeiro prestador para acompanhar etapas, medições, documentos e pagamentos.</p>
            {podeGerenciarContratos && <Btn onClick={() => { setForm(novoContratoVazio()); setModal(true); }}>
              <Ic n="plus"/> Criar primeiro contrato
            </Btn>}
          </section>
        )}

        {/* Um quadro por obra. Só obras COM terceirizados aparecem. Ordem: mais
            terceiros primeiro; no empate, a obra mais no início da execução. */}
        {kanbansPorObra.map(bloco => {
          const colunas = distribuirColunas(bloco.lista);
          const valorObra = bloco.lista.reduce((s,t)=>s+Number(t.contractValue||0),0);
          return (
            <section key={bloco.obraId} className="terceiros-board">
              {/* Cabeçalho da obra */}
              <header className="terceiros-board__header">
                <div>
                  <h3>{bloco.nome}</h3>
                  <p>
                    {bloco.qtd} terceirizado(s){!bloco.especial && ` · ${bloco.avanco.toFixed(0)}% de avanço médio`}
                  </p>
                </div>
                {valorObra > 0 && (
                  <strong>{fmt(valorObra)} <span>contratados</span></strong>
                )}
              </header>

              {/* Colunas de situação desta obra */}
              <div className="terceiros-kanban">
                {COLS_KANBAN.map(col => {
                  const cards = colunas[col.v] || [];
                  const soma = cards.reduce((s, t) => s + Number(t.contractValue || 0), 0);
                  const alvoKey = `${bloco.obraId}::${col.v}`;
                  const ativa = colunaAlvo === alvoKey;
                  return (
                    <section key={col.v} className="terceiros-kanban__column" data-dragover={ativa}
                      style={{"--terceiros-status-color":col.cor}}
                      onDragOver={e => { e.preventDefault(); setColunaAlvo(alvoKey); }}
                      onDragLeave={() => setColunaAlvo(c => c === alvoKey ? null : c)}
                      onDrop={() => soltarNaColuna(col.v)}>
                      <header className="terceiros-kanban__column-header">
                        <div>
                          <h4>{col.l}</h4>
                          <p>{col.dica}</p>
                        </div>
                        <div className="terceiros-kanban__column-total">
                          <span>{cards.length}</span>
                          {soma > 0 && <strong>{fmt(soma)}</strong>}
                        </div>
                      </header>
                      <div className="terceiros-kanban__cards">

                      {cards.map(t => {
                        const info = specInfo(t.specialty);
                        const av = avancoContrato(t);
                        const expiredDocs=(t.documentos||[]).filter(d=>{const dd=diasAte(d.validade);return dd!==null&&dd<=0;});
                        const docBad = expiredDocs.length>0;
                        const docWarn = (t.documentos || []).some(d => { const dd = diasAte(d.validade); return dd !== null && dd > 0 && dd <= 30; });
                        const docInvalido = t.documento && !validarDocumento(t.documento, t.tipoPessoa);
                        return (
                          <article key={t.id} draggable role="button" tabIndex={0}
                            aria-label={`Abrir contrato de ${t.name}`}
                            onDragStart={() => setArrastando(t.id)}
                            onDragEnd={() => { setArrastando(null); setColunaAlvo(null); }}
                            onClick={() => abrirContrato(t)}
                            onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();abrirContrato(t);}}}
                            className="terceiros-kanban-card"
                            style={{opacity:arrastando === t.id ? 0.4 : 1}}>
                            <div className="terceiros-kanban-card__header">
                              <div>
                                <h5>{t.name}</h5>
                                <p>{info.l}</p>
                              </div>
                              {t.contractValue > 0 && (
                                <strong>{fmt(t.contractValue)}</strong>
                              )}
                            </div>

                            {t.documento && (
                              <p className="terceiros-kanban-card__document">
                                {maskDoc(t.documento, t.tipoPessoa)}
                              </p>
                            )}

                            {/* Barra de avanco */}
                            <div className="terceiros-kanban-card__progress">
                              <div className="terceiros-progress-track" role="progressbar" aria-label={`Avanço medido de ${t.name}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(av)}>
                                <span style={{width:`${av}%`}} data-complete={av>=100}/>
                              </div>
                              <div>
                                <span>{av.toFixed(0)}% medido</span>
                                {(t.etapas?.length > 0) && <span>{t.etapas.length} etapa(s)</span>}
                              </div>
                            </div>

                            {/* Selos de alerta */}
                            {(docBad || docWarn || docInvalido) && (
                              <div className="terceiros-kanban-card__alerts">
                                {docInvalido && <span>Documento inválido</span>}
                                {docBad && <span>{expiredDocs.length===1?`${docTercInfo(expiredDocs[0].tipo).l} vencido`:`${expiredDocs.length} documentos vencidos`}</span>}
                                {!docBad && docWarn && <span data-warning="true">Documento a vencer</span>}
                              </div>
                            )}

                            {/* Mover em telas sem drag (toque): setas discretas */}
                            <div className="terceiros-kanban-card__actions" onClick={e => e.stopPropagation()}>
                              {COLS_KANBAN.map(c => c.v).indexOf(t.situacao) > 0 && (
                                <button type="button"
                                  onClick={() => { const i = COLS_KANBAN.findIndex(c => c.v === t.situacao); moverSituacao(t, COLS_KANBAN[i-1].v); }}>
                                  ← <span>Mover para {COLS_KANBAN[COLS_KANBAN.findIndex(c=>c.v===t.situacao)-1].l}</span></button>
                              )}
                              {COLS_KANBAN.map(c => c.v).indexOf(t.situacao) < COLS_KANBAN.length - 1 && (
                                <button type="button"
                                  onClick={() => { const i = COLS_KANBAN.findIndex(c => c.v === t.situacao); moverSituacao(t, COLS_KANBAN[i+1].v); }}>
                                  <span>Mover para {COLS_KANBAN[COLS_KANBAN.findIndex(c=>c.v===t.situacao)+1].l}</span> →</button>
                              )}
                            </div>
                          </article>
                        );
                      })}

                      {!cards.length && (
                        <p className="terceiros-kanban__empty">
                          {arrastando ? "Solte aqui" : "Nenhum contrato"}
                        </p>
                      )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
          );
        })}
      </>)}

      {/*  VIEW: CADASTRO  */}
      {view === "cadastro" && (<>
        <section className="terceiros-registry-toolbar" aria-label="Filtros do cadastro">
          <div className="terceiros-registry-toolbar__heading">
            <div>
              <h3>Prestadores e contratos</h3>
              <p>{filteredTerc.length} contrato(s) encontrado(s)</p>
            </div>
          </div>
          <div className="terceiros-registry-filters">
          <Inp label="Buscar prestador ou documento" value={searchTerc} onChange={setSearchTerc} placeholder="Nome, razão social, CPF ou CNPJ"/>
          <Sel label="Especialidade" value={filterSpec} onChange={setFilterSpec} options={[{v:"all",l:"Todas as especialidades"},...SPECIALTIES.map(s=>({v:s.v,l:s.l}))]}/>
          {obraIdFixo
            ? <Inp label="Obra" value={data.obras.find(o=>o.id===obraIdFixo)?.name||"Obra atual"} onChange={()=>{}} disabled/>
            : <Sel label="Obra" value={filterObra} onChange={setFilterObra} options={[{v:"all",l:"Todas as obras"},...data.obras.map(o=>({v:o.id,l:o.name}))]}/>}
          </div>
        </section>

        {filteredTerc.length === 0 && (
          <section className="terceiros-empty">
            <span className="terceiros-empty__icon"><Ic n="users" s={22}/></span>
            <h3>Nenhum contrato neste filtro</h3>
            <p>Altere os filtros ou cadastre um prestador para vinculá-lo a uma obra.</p>
            <Btn v="ghost" onClick={()=>{setSearchTerc("");setFilterSpec("all");if(!obraIdFixo)setFilterObra("all");}}>Limpar filtros</Btn>
          </section>
        )}

        {/* Agrupado por obra */}
        {data.obras
          .filter(o => filteredTerc.some(t => t.obraId===o.id))
          .map(obra => {
            const obraTerc = filteredTerc.filter(t => t.obraId===obra.id);
            const obraPago = obraTerc.reduce((s,t) => s+(data.pagsTerceiros||[]).filter(p=>registroTerceiroAtivo(p)&&p.tercId===t.id).reduce((s2,p)=>s2+Number(p.amount||0),0), 0);
            const obraWeekly = obraTerc.filter(t=>t.active!==false).reduce((s,t)=>s+Number(t.weeklyRate||0),0);
            return (
              <section className="terceiros-registry-group" key={obra.id} aria-labelledby={`terceiros-obra-${obra.id}`}>
                <header className="terceiros-registry-group__header">
                  <div>
                    <h3 id={`terceiros-obra-${obra.id}`}>{obra.name}</h3>
                    <p>{obraTerc.length} contrato(s) · {fmt(obraWeekly)}/semana · {fmt(obraPago)} pago</p>
                  </div>
                  <span>{obraTerc.filter(t=>t.active!==false).length} ativo(s)</span>
                </header>

                {obraTerc.map(t => {
                  const sp = specInfo(t.specialty);
                  const pagamentosContrato=(data.pagsTerceiros||[]).filter(p=>registroTerceiroAtivo(p)&&p.tercId===t.id);
                  const medicoesContrato=(data.medicoesTerc||[]).filter(m=>registroTerceiroAtivo(m)&&m.tercId===t.id);
                  const pago = pagamentosContrato.reduce((s,p)=>s+Number(p.amount||0),0);
                  const medido=medicoesContrato.reduce((s,m)=>s+Number(m.total||0),0);
                  const devido=medicoesContrato.filter(m=>!m.pagamentoId).reduce((s,m)=>s+Number(m.total||0),0);
                  const saldoExecutar=Math.max(0,Number(t.contractValue||0)-medido);
                  const pct = t.contractValue>0 ? Math.min((medido/t.contractValue)*100, 100) : 0;
                  const exp = expanded === t.id;
                  return (
                    <article className="terceiros-registry-contract" data-inactive={t.active===false} key={t.id}>
                      <button type="button" className="terceiros-registry-contract__summary"
                        aria-expanded={exp} aria-controls={`terceiros-detalhes-${t.id}`}
                        onClick={() => setExpanded(exp ? null : t.id)}>
                        <div className="terceiros-registry-contract__identity">
                          <div className="terceiros-registry-contract__title">
                            <h4>{t.name}</h4>
                            {t.active === false && <span>Inativo</span>}
                          </div>
                          <p>{sp.l} · {t.tipoContrato==="medicao"?"Por medição":t.tipoContrato==="empreitada"?"Empreitada":t.tipoContrato==="semanal"?"Semanal":"Diária"}</p>
                          <div className="terceiros-registry-contract__meta">
                            {t.weeklyRate>0 && <span>{fmt(t.weeklyRate)}/semana</span>}
                            {t.contractValue>0 && <span>Contrato {fmt(t.contractValue)}</span>}
                            {(t.etapas||[]).length>0 && <span>{t.etapas.length} etapa(s) · {(avancoDoContrato(t)??0).toFixed(0)}% medido</span>}
                          </div>
                        </div>
                        <div className="terceiros-registry-contract__balance" data-negative={devido>0}>
                          <strong>{fmt(devido)}</strong>
                          <span>devido por medições</span>
                        </div>
                        <span className="terceiros-registry-contract__chevron" data-expanded={exp}>
                          <Ic n="chevron" s={14}/>
                        </span>
                        {t.contractValue>0 && (
                          <div className="terceiros-progress-track terceiros-registry-contract__progress"
                            role="progressbar" aria-label={`Percentual medido do contrato de ${t.name}`}
                            aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pct)}>
                            <span style={{width:`${pct}%`}} data-critical={pct>90}/>
                          </div>
                        )}
                      </button>

                      {exp && (
                        <div className="terceiros-registry-contract__details" id={`terceiros-detalhes-${t.id}`}>
                          <div className="terceiros-registry-contract__facts">
                            {[["Contratado",fmt(t.contractValue)],["Medido",fmt(medido)],["Devido",fmt(devido)],["Pago",fmt(pago)],["A executar",fmt(saldoExecutar)]].map(([l,v])=>(
                              <div key={l}>
                                <p>{l}</p>
                                <strong>{v}</strong>
                              </div>
                            ))}
                          </div>
                          {(t.phone || t.pixKey || contratosDoPrestador(t).length > 1) && (
                            <dl className="terceiros-registry-contract__contact">
                              {t.phone && <div><dt>Telefone</dt><dd>{t.phone}</dd></div>}
                              {t.pixKey && <div><dt>Chave PIX</dt><dd>{t.pixKey}</dd></div>}
                              {contratosDoPrestador(t).length > 1 && <div><dt>Vínculos</dt><dd>{contratosDoPrestador(t).length} contratos neste cadastro</dd></div>}
                            </dl>
                          )}
                          {t.notes && <p className="terceiros-registry-contract__notes">{t.notes}</p>}
                          {podeGerenciarPagamentos && <h5>Últimos pagamentos</h5>}
                          {podeGerenciarPagamentos && (data.pagsTerceiros||[]).filter(p=>p.tercId===t.id).slice(-5).reverse().map(p=>{
                            const instanciaPag=p.aprovacaoInstanciaId?(data.instanciasAprovacao||[]).find(i=>i.id===p.aprovacaoInstanciaId):null;
                            const statusAprovacao=instanciaPag&&instanciaPag.status!=="aprovada"?instanciaPag.status:null;
                            return <div className="terceiros-registry-payment" key={p.id}>
                              <div>
                                <p>{p.description}</p>
                                <small>
                                  {fmtDateFull(p.date)} · {p.pagador === "empresa" ? "pago pela empresa" : `pago pela obra ${obraName(p.obraId)}`}
                                </small>
                                {statusAprovacao && <Badge color={statusAprovacao==="reprovada"?C.red:C.yellow}>{statusAprovacao==="em_andamento"?"AGUARDANDO APROVAÇÃO":statusAprovacao==="reprovada"?"REPROVADO":statusAprovacao.toUpperCase()}</Badge>}
                              </div>
                              <div>
                                <strong>{fmt(p.amount)}</strong>
                                <Btn v="danger" size="sm" onClick={()=>removePay(p.id)}><Ic n="x"/> Estornar</Btn>
                              </div>
                            </div>;
                          })}
                          {podeGerenciarPagamentos && !(data.pagsTerceiros||[]).some(p=>p.tercId===t.id) && (
                            <p className="terceiros-registry-contract__empty">Nenhum pagamento registrado.</p>
                          )}
                          <div className="terceiros-registry-contract__actions">
                            {podeGerenciarMedicoes && <Btn size="sm" v="info" onClick={()=>abrirMedicoesDe(t.id)}>
                              <Ic n="medicoes"/> {(t.etapas||[]).length ? "Medições" : "Dividir em etapas"}
                            </Btn>}
                            {podeGerenciarPagamentos && (["semanal","diaria"].includes(t.tipoContrato)||(!t.tipoContrato&&Number(t.weeklyRate)>0)) && <Btn size="sm" v="warning" onClick={()=>{setPayModal(t);setPayAmount(String(t.weeklyRate||""));setPaySource("");}}>
                              <Ic n="dollar"/> Registrar pagamento
                            </Btn>}
                            {podeGerenciarContratos && <Btn size="sm" v="ghost" onClick={()=>editarTerc(t)}><Ic n="edit"/> Editar</Btn>}
                            {podeGerenciarContratos && <Btn size="sm" v="info" onClick={()=>novoContratoDoPrestador(t)}><Ic n="plus"/> Outra obra</Btn>}
                            {podeGerenciarContratos && <Btn size="sm" v={t.active===false?"success":"dark"} onClick={()=>toggleActive(t.id)}>
                              {t.active===false?"Reativar":"Inativar"}
                            </Btn>}
                            {podeGerenciarContratos && <Btn size="sm" v="danger" onClick={()=>removeTerc(t.id)}><Ic n="x"/> Cancelar contrato</Btn>}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </section>
            );
          })
        }

        {/* Sem obra definida */}
        {filteredTerc.filter(t=>!t.obraId).length > 0 && (
          <section className="terceiros-registry-group">
            <header className="terceiros-registry-group__header">
              <div><h3>Sem obra definida</h3><p>Contratos que precisam ser vinculados antes da operação.</p></div>
            </header>
            {filteredTerc.filter(t=>!t.obraId).map(t=>{
              const sp=specInfo(t.specialty);
              return(
                <div className="terceiros-registry-unassigned" key={t.id}>
                  <div>
                    <h4>{t.name}</h4>
                    <p>{sp.l} · nenhuma obra vinculada</p>
                  </div>
                  {podeGerenciarContratos && <div>
                      <Btn size="sm" v="info" onClick={()=>novoContratoDoPrestador(t)}><Ic n="plus"/></Btn>
                      <Btn size="sm" v="ghost" onClick={()=>editarTerc(t)}><Ic n="edit"/></Btn>
                  </div>}
                </div>
              );
            })}
          </section>
        )}
      </>)}

      {/*  VIEW: MEDICOES  */}
      {view === "medicoes" && (<>
        <Sel label="Contrato" value={tercSel} onChange={setTercSel}
          options={[{v:"",l:"Selecione o terceirizado..."},
            ...kanbanTerc.map(t => ({ v:t.id, l:`${t.name} · ${specInfo(t.specialty).l}${t.obraId?` · ${obraName(t.obraId)}`:""}` }))]}/>

        {!tercSel && (
          <div style={{ padding:26, textAlign:"center", background:C.card, border:`1px solid ${C.border}`, borderRadius:10 }}>
            <p style={{ fontSize:12.5, color:C.muted, lineHeight:1.6 }}>
              Escolha um contrato para subdividir em etapas e medir o avanço.<br/>
              Ex.: eletricista → rasgo de parede, eletrodutos, enfiação...
            </p>
          </div>
        )}

        {tercAtual && (<>
          {/* Ficha de identificacao do contrato */}
          {(() => {
            const info = specInfo(tercAtual.specialty);
            const col = colKanban(tercAtual.situacao);
            const docOk = tercAtual.documento ? validarDocumento(tercAtual.documento, tercAtual.tipoPessoa) : null;
            return (
              <div style={{ background:C.card, border:`1px solid ${info.color}66`, borderRadius:4, padding:"13px 15px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:16, fontWeight:900, color:C.text }}>{tercAtual.name}</p>
                    <p style={{ fontSize:11.5, color:info.color, fontWeight:700 }}>
                      {info.l} · {obraName(tercAtual.obraId)}
                    </p>
                  </div>
                  <div style={{ display:"flex", gap:6, alignItems:"flex-start" }}>
                    <span style={{ fontSize:10, fontWeight:900, color:col.cor, background:`${col.cor}18`, borderRadius:99, padding:"4px 10px", whiteSpace:"nowrap" }}>{col.l}</span>
                    <Btn size="sm" v="info" onClick={()=>novoContratoDoPrestador(tercAtual)}>Outra obra</Btn>
                    <Btn size="sm" v="ghost" onClick={()=>editarTerc(tercAtual)}>Editar</Btn>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:"6px 14px", marginTop:10 }}>
                  {tercAtual.documento && (
                    <div>
                      <p style={{ fontSize:9, fontWeight:900, color:C.muted, letterSpacing:.5 }}>{tercAtual.tipoPessoa==="PF"?"CPF":"CNPJ"}</p>
                      <p style={{ fontSize:12, color:C.text }}>{maskDoc(tercAtual.documento, tercAtual.tipoPessoa)}
                        <span style={{ marginLeft:6, fontSize:10, fontWeight:800, color: docOk?C.green:C.red }}>{docOk?"✓":"inválido"}</span>
                      </p>
                    </div>
                  )}
                  {tercAtual.razaoSocial && <div><p style={{ fontSize:9, fontWeight:900, color:C.muted, letterSpacing:.5 }}>RAZÃO SOCIAL</p><p style={{ fontSize:12, color:C.text }}>{tercAtual.razaoSocial}</p></div>}
                  {tercAtual.responsavel && <div><p style={{ fontSize:9, fontWeight:900, color:C.muted, letterSpacing:.5 }}>RESPONSÁVEL</p><p style={{ fontSize:12, color:C.text }}>{tercAtual.responsavel}</p></div>}
                  {tercAtual.phone && <div><p style={{ fontSize:9, fontWeight:900, color:C.muted, letterSpacing:.5 }}>TELEFONE</p><p style={{ fontSize:12, color:C.text }}>{tercAtual.phone}</p></div>}
                  {(tercAtual.startDate || tercAtual.endDate) && <div><p style={{ fontSize:9, fontWeight:900, color:C.muted, letterSpacing:.5 }}>PERÍODO</p><p style={{ fontSize:12, color:C.text }}>{tercAtual.startDate?fmtDateFull(tercAtual.startDate):"?"}{tercAtual.endDate?` → ${fmtDateFull(tercAtual.endDate)}`:""}</p></div>}
                  {(Number(tercAtual.retISS)>0 || Number(tercAtual.retINSS)>0) && <div><p style={{ fontSize:9, fontWeight:900, color:C.muted, letterSpacing:.5 }}>RETENÇÕES</p><p style={{ fontSize:12, color:C.text }}>{Number(tercAtual.retISS)>0?`ISS ${tercAtual.retISS}% (${tercAtual.retISSQuem==="fonte"?"fonte":"prestador"})`:""}{Number(tercAtual.retISS)>0&&Number(tercAtual.retINSS)>0?" · ":""}{Number(tercAtual.retINSS)>0?`INSS ${tercAtual.retINSS}% (${tercAtual.retINSSQuem==="fonte"?"fonte":"prestador"})`:""}</p></div>}
                  {(() => {
                    const dd = diasDiarioTerc[tercAtual.id];
                    if (!dd || (dd.dias + dd.meios) === 0) return null;
                    return <div><p style={{ fontSize:9, fontWeight:900, color:C.muted, letterSpacing:.5 }}>PRESENÇA (DIÁRIO)</p><p style={{ fontSize:12, color:C.text }}>{dd.dias} dia(s){dd.meios?` + ${dd.meios} meio`:""} em obra</p></div>;
                  })()}
                </div>
                {(tercAtual.documentos || []).length > 0 && (
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:10 }}>
                    {tercAtual.documentos.map(doc => {
                      const dias = diasAte(doc.validade);
                      const cor = dias===null?C.muted:dias<=0?C.red:dias<=30?C.orange:C.green;
                      return (
                        <span key={doc.id} style={{ fontSize:9.5, fontWeight:800, color:cor, background:`${cor}14`, borderRadius:6, padding:"3px 8px" }}>
                          {docTercInfo(doc.tipo).l.split(" ")[0]} {dias===null?"":dias<0?`vencida`:dias<=30?`${dias}d`:"ok"}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Curva de evolução: medido acumulado ao longo das medições */}
          {medicoesTercAtual.length > 1 && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px" }}>
              <p style={{ fontSize:10, fontWeight:900, color:C.muted, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Evolução do medido</p>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={(() => { let ac=0; return medicoesTercAtual.map(m => { ac+=Number(m.total||0); return { nome:`M${m.numero}`, acumulado:Math.round(ac) }; }); })()}
                  margin={{ top:4, right:8, bottom:0, left:-14 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line}/>
                  <XAxis dataKey="nome" tick={{ fontSize:10, fill:C.muted }} axisLine={{ stroke:C.border }} tickLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:C.muted }} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                  <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:6, fontSize:12 }}/>
                  <Line type="monotone" dataKey="acumulado" stroke={C.blue} strokeWidth={2.5} dot={{ r:3, fill:C.blue }}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Resumo do contrato */}
          <section className="terceiros-contract-metrics" aria-label="Resumo financeiro do contrato">
            {[
              ["Contrato", fmt(tercAtual.contractValue), "neutral"],
              ["Medido", fmt(totalMedido), "success"],
              ["A medir", fmt(somaEtapas - totalMedido), (somaEtapas - totalMedido) >= 0 ? "warning" : "danger"],
              ["Avanço físico", `${pctFisico.toFixed(1)}%`, "primary"],
            ].map(([l,v,tone]) => (
              <div className="terceiros-contract-metrics__item" data-tone={tone} key={l}>
                <p>{l}</p>
                <strong>{v}</strong>
              </div>
            ))}
          </section>

          <div className="terceiros-contract-progress" role="progressbar" aria-label="Avanço físico do contrato" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pctFisico)}>
            <span style={{width:`${Math.min(pctFisico,100)}%`}}/>
          </div>

          {/* A soma das etapas precisa fechar com o contrato, senao a medicao
              mede uma coisa e o contrato vale outra. */}
          {etapasTerc.length > 0 && Math.abs(somaEtapas - Number(tercAtual.contractValue||0)) > 0.5 && (
            <div style={{ background:`${C.orange}12`, border:`1px solid ${C.orange}55`, borderRadius:8, padding:"9px 12px" }}>
              <p style={{ fontSize:11.5, color:C.orange, lineHeight:1.55 }}>
                As etapas somam <b>{fmt(somaEtapas)}</b> e o contrato é de <b>{fmt(tercAtual.contractValue)}</b> -
                diferença de {fmt(Math.abs(somaEtapas - Number(tercAtual.contractValue||0)))}.
                Ajuste os valores das etapas ou o valor do contrato no cadastro.
              </p>
            </div>
          )}

          {/* Etapas do contrato */}
          <div className="terceiros-section-heading">
            <p>
              Etapas do contrato ({etapasTerc.length})
            </p>
            <div>
              <Btn size="sm" v="ghost" onClick={sugerirEtapas}>Sugerir etapas</Btn>
              <Btn size="sm" onClick={abrirMedicao} disabled={!podeRegistrarEvidencia}><Ic n="plus"/> Nova medição</Btn>
            </div>
          </div>
          {!podeRegistrarEvidencia&&<div style={{background:`${C.orange}0D`,border:`1px solid ${C.orange}55`,borderRadius:8,padding:"8px 11px"}}><p style={{fontSize:10.5,color:C.orange,fontWeight:800}}>A medição e suas fotografias devem ser registradas por um engenheiro de campo ou engenheiro auditor.</p></div>}

          <div className="terceiros-stage-list">
            {etapasTerc.map((e, i) => {
              const acum = acumuladoPorEtapa[e.id] || 0;
              return (
                <div className="terceiros-stage" key={e.id}>
                  <div className="terceiros-stage__order">
                    <button onClick={()=>moverEtapa(e,-1)} disabled={i===0} title="Subir"
                      aria-label={`Mover ${e.nome} para cima`}>↑</button>
                    <button onClick={()=>moverEtapa(e,+1)} disabled={i===etapasTerc.length-1} title="Descer"
                      aria-label={`Mover ${e.nome} para baixo`}>↓</button>
                  </div>
                  <div className="terceiros-stage__main">
                    <p>{i+1}. {e.nome}</p>
                    <div className="terceiros-progress-track" role="progressbar" aria-label={`${e.nome}: ${acum.toFixed(0)}% medido`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(acum)}>
                      <span style={{width:`${acum}%`}} data-complete={acum>=100}/>
                    </div>
                  </div>
                  <div className="terceiros-stage__value">
                    <strong>{fmt(e.valor)}</strong>
                    <span data-complete={acum>=100}>{acum.toFixed(1)}% medido</span>
                  </div>
                  <div className="terceiros-stage__actions">
                    <button onClick={()=>setEtapaForm({ id:e.id, nome:e.nome, valor:String(e.valor) })}
                      aria-label={`Editar etapa ${e.nome}`}><Ic n="edit" s={11}/><span>Editar</span></button>
                    <button onClick={()=>removerEtapa(e)}
                      aria-label={`Excluir etapa ${e.nome}`}><Ic n="trash" s={11}/></button>
                  </div>
                </div>
              );
            })}
            {!etapasTerc.length && (
              <p style={{ padding:20, textAlign:"center", fontSize:11.5, color:C.muted }}>
                Contrato ainda inteiro. Use "Sugerir etapas" ou cadastre uma abaixo.
              </p>
            )}
          </div>

          {/* Cadastro de etapa */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:12,
                        display:"grid", gridTemplateColumns:formGrid(2), gap:9, alignItems:"end" }}>
            <Inp label={etapaForm.id?"Editar etapa":"Nova etapa"} value={etapaForm.nome}
              onChange={v=>setEtapaForm(f=>({...f,nome:v}))} placeholder="Ex.: Rasgo de parede"/>
            <Inp label="Valor da etapa" value={etapaForm.valor}
              onChange={v=>setEtapaForm(f=>({...f,valor:v}))} placeholder="0,00"/>
            <div style={{ display:"flex", gap:7, gridColumn:"1 / -1" }}>
              {etapaForm.id && <Btn v="ghost" full onClick={()=>setEtapaForm({id:"",nome:"",valor:""})}>Cancelar</Btn>}
              <Btn full onClick={salvarEtapa}><Ic n="check"/> {etapaForm.id?"Salvar etapa":"Adicionar etapa"}</Btn>
            </div>
          </div>

          {/* Historico de medicoes */}
          <p style={{ fontSize:10, fontWeight:900, color:C.muted, textTransform:"uppercase", letterSpacing:1, marginTop:4 }}>
            Medições ({medicoesTercAtual.length})
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {[...medicoesTercAtual].reverse().map((m,indiceMedicao) => (
              <div key={m.id} style={{ background:C.card, border:`1px solid ${m.pagamentoId?C.green+"66":C.orange+"66"}`,
                                       borderRadius:4, padding:"10px 13px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:9, flexWrap:"wrap" }}>
                  <div>
                    <p style={{ fontSize:13.5, fontWeight:900, color:C.text }}>
                      Medição {m.numero||medicoesTercAtual.length-indiceMedicao} · {fmtDateFull(m.data)}
                    </p>
                    <p style={{ fontSize:10.5, color:C.muted, marginTop:2 }}>
                      {m.itens.length} etapa(s) · {m.pagamentoId ? "paga" : "aguardando pagamento"}
                    </p>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ fontSize:17, fontWeight:800, color:m.total>=0?C.green:C.red,
                                fontFamily:"'Inter Display','Inter',sans-serif" }}>{fmt(m.total)}</p>
                    <span style={{ marginTop:4, display:"inline-flex" }}>
                      <Badge color={m.pagamentoId?C.green:C.orange}>
                        <Ic n={m.pagamentoId?"check":"clock"} s={9}/> {m.pagamentoId?"PAGO":"EM ABERTO"}
                      </Badge>
                    </span>
                  </div>
                </div>
                <div style={{ marginTop:7, display:"flex", flexDirection:"column", gap:3 }}>
                  {m.itens.map(i => {
                    const et = etapasTerc.find(e => e.id === i.etapaId);
                    return (
                      <div key={i.etapaId} style={{ display:"flex", justifyContent:"space-between", gap:8, fontSize:11 }}>
                        <span style={{ color:C.subtle, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {et?.nome || "Etapa removida"}
                        </span>
                        <span style={{ color:C.muted, flexShrink:0 }}>
                          {i.pctAnterior.toFixed(0)}% → {i.pctAcum.toFixed(0)}% · <b style={{color:i.valor>=0?C.text:C.red}}>{fmt(i.valor)}</b>
                        </span>
                      </div>
                    );
                  })}
                </div>
                {m.observacao && <p style={{ fontSize:11, color:C.muted, fontStyle:"italic", marginTop:6 }}>"{m.observacao}"</p>}
                {(m.fotos||[]).length?<div style={{marginTop:8}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:6}}><p style={{fontSize:9.5,fontWeight:900,color:C.green,textTransform:"uppercase"}}>Evidência fotográfica · {(m.fotos||[]).length}</p><p style={{fontSize:9.5,color:C.muted}}>Por {m.responsavelEvidencia||m.fotos?.[0]?.enviadoPor||"engenheiro"}</p></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(76px,1fr))",gap:6}}>{(m.fotos||[]).map(f=><a key={f.id||f.url} href={f.url} target="_blank" rel="noopener noreferrer" title="Ampliar fotografia" style={{display:"block",aspectRatio:"1/1",borderRadius:7,overflow:"hidden",border:`1px solid ${C.border}`,background:C.surface}}><img src={f.url} alt={f.legenda||"Evidência da medição"} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/></a>)}</div></div>:<div style={{marginTop:8,background:`${C.red}0B`,border:`1px solid ${C.red}44`,borderRadius:7,padding:"7px 9px"}}><p style={{fontSize:10,fontWeight:850,color:C.red}}>Medição sem evidência fotográfica</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>Registro antigo: o financeiro será alertado antes do pagamento.</p></div>}
                {/* Previa de retencao antes de pagar / decomposicao apos pago */}
                {(() => {
                  // Fonte da verdade: se ja pago, os valores gravados no
                  // pagamento; se nao, a previa pela config atual do contrato.
                  const pg = m.pagamentoId ? (data.pagsTerceiros || []).find(p => p.id === m.pagamentoId) : null;
                  const ret = calcRetencoes(m.total, tercAtual);
                  const iss     = pg ? Number(pg.issRetido || 0)  : ret.issRetido;
                  const inss    = pg ? Number(pg.inssRetido || 0) : ret.inssRetido;
                  const liquido = pg ? Number(pg.liquido ?? m.total) : ret.liquido;
                  if (iss + inss <= 0 && !pg) return null;
                  return (
                    <div style={{ marginTop:7, background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 10px" }}>
                      {pg && <div style={{ display:"flex", justifyContent:"space-between", fontSize:10.5, color:C.muted, marginBottom:4 }}>
                        <span>Origem do pagamento</span>
                        <b style={{ color:pg.pagador === "empresa" ? C.blue : C.orange }}>
                          {pg.pagador === "empresa" ? "Empresa" : `Obra ${obraName(pg.obraId)}`}
                        </b>
                      </div>}
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10.5, color:C.muted }}>
                        <span>Bruto (custo da obra)</span><b style={{ color:C.text }}>{fmt(m.total)}</b>
                      </div>
                      {iss > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:10.5, color:C.muted }}>
                        <span>(-) ISS retido ({tercAtual.retISS}%)</span><span>{fmt(iss)}</span></div>}
                      {inss > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:10.5, color:C.muted }}>
                        <span>(-) INSS retido ({tercAtual.retINSS}%)</span><span>{fmt(inss)}</span></div>}
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11.5, marginTop:3, borderTop:`1px solid ${C.line}`, paddingTop:3 }}>
                        <span style={{ fontWeight:800, color:C.text }}>Líquido ao prestador</span>
                        <b style={{ color:C.green }}>{fmt(liquido)}</b>
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display:"flex", gap:7, marginTop:9, justifyContent:"flex-end" }}>
                  {m.notaFiscalId
                    ? <Badge color={C.blue}>NF VINCULADA</Badge>
                    : <Btn size="sm" v="ghost" onClick={()=>{setNotaTercModal(m);setNotaTercId("");}}>Vincular NF</Btn>}
                  {!m.pagamentoId && <Btn size="sm" v="success" onClick={()=>abrirPagamentoMedicao(m)}>Registrar pagamento</Btn>}
                  <Btn size="sm" v="ghost" onClick={()=>removerMedicao(m)}>Remover</Btn>
                </div>
              </div>
            ))}
            {!medicoesTercAtual.length && (
              <p style={{ padding:18, textAlign:"center", fontSize:11.5, color:C.muted,
                          background:C.card, border:`1px solid ${C.border}`, borderRadius:8 }}>
                Nenhuma medição neste contrato.
              </p>
            )}
          </div>
        </>)}
      </>)}

      {/*  VIEW: PAGAMENTOS  */}
      {view === "pagamentos" && (<>
        {pagamentosSemEvidencia.length>0&&<div style={{background:`${C.red}0D`,border:`1px solid ${C.red}66`,borderRadius:4,padding:"10px 12px"}}><p style={{fontSize:10.5,fontWeight:900,color:C.red,textTransform:"uppercase"}}>Auditoria financeira · {pagamentosSemEvidencia.length} pagamento(s) sem foto</p><p style={{fontSize:10,color:C.muted,lineHeight:1.45,marginTop:3}}>Foram pagos após reconhecimento explícito do risco. Revise as medições e solicite a comprovação da execução ao engenheiro responsável.</p></div>}
        {/* Impostos retidos a recolher - mês da sexta atual. So aparece se ha
            retencao no periodo; e um lembrete de obrigacao, nao um card fixo. */}
        {(() => {
          const ym = friday.slice(0, 7);
          const doMes = (data.pagsTerceiros || []).filter(p => p.date?.startsWith(ym));
          const iss  = doMes.reduce((s, p) => s + Number(p.issRetido || 0), 0);
          const inss = doMes.reduce((s, p) => s + Number(p.inssRetido || 0), 0);
          if (iss + inss <= 0) return null;
          return (
            <div style={{ background:`${C.purple}0C`, border:`1px solid ${C.purple}44`, borderRadius:10, padding:"11px 14px" }}>
              <p style={{ fontSize:10, fontWeight:900, color:C.purple, textTransform:"uppercase", letterSpacing:.8 }}>
                Impostos retidos a recolher · {compLabel(ym)}
              </p>
              <div style={{ display:"flex", gap:16, marginTop:6, flexWrap:"wrap" }}>
                {iss > 0 && <div><p style={{ fontSize:9, color:C.muted, fontWeight:800 }}>ISS</p><p style={{ fontSize:17, fontWeight:800, color:C.text }}>{fmt(iss)}</p></div>}
                {inss > 0 && <div><p style={{ fontSize:9, color:C.muted, fontWeight:800 }}>INSS</p><p style={{ fontSize:17, fontWeight:800, color:C.text }}>{fmt(inss)}</p></div>}
                <div><p style={{ fontSize:9, color:C.muted, fontWeight:800 }}>TOTAL</p><p style={{ fontSize:17, fontWeight:800, color:C.purple }}>{fmt(iss + inss)}</p></div>
              </div>
              <p style={{ fontSize:10, color:C.muted, marginTop:5, lineHeight:1.4 }}>
                Valores que a empresa reteve dos prestadores e deve recolher à prefeitura (ISS) e à Receita (INSS).
              </p>
            </div>
          );
        })()}

        {/* Navegador de semana */}
        <section className="terceiros-week">
          <div className="terceiros-week__navigator">
            <button type="button" aria-label="Semana anterior" onClick={()=>setWeekOffset(w=>w-1)}><Ic n="chevL" s={16}/></button>
            <div>
              <p>Pagamentos da semana</p>
              <strong>
                {fmtDateFull(friday)}
              </strong>
              <span>
                Semana: {fmtDateFull(weekStart)} → {fmtDateFull(weekEnd)}
              </span>
            </div>
            <button type="button" aria-label="Próxima semana" onClick={()=>setWeekOffset(w=>w+1)}><Ic n="chevR" s={16}/></button>
          </div>

          {/* Status da semana */}
          <div className="terceiros-week__summary">
            {[
              ["Pagos",      `${recurringTerc.length - pendingCount}/${recurringTerc.length}`, pendingCount===0&&recurringTerc.length>0?"success":"neutral" ],
              ["Pendentes",  fmt(pendingTotal),  pendingCount>0 ? "danger" : "success" ],
              ["Pago na semana",fmt(paidThisWeekAmount), "neutral" ],
            ].map(([l,v,tone])=>(
              <div data-tone={tone} key={l}>
                <p>{l}</p>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
        </section>

        {/* Lista de terceirizados com status de pagamento */}
        {recurringTerc.length === 0 && (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, padding:24, textAlign:"center", color:C.muted, borderRadius:10 }}>
            Nenhum contrato semanal ou diário ativo. Contratos por medição são pagos na aba Medições.
          </div>
        )}

        <div className="terceiros-payment-filter">
          {obraIdFixo
            ? <Inp value={data.obras.find(o=>o.id===obraIdFixo)?.name||"Obra atual"} onChange={()=>{}} disabled/>
            : <Sel label="Filtrar por obra" value={filterObra} onChange={setFilterObra} options={[{v:"all",l:"Todas as obras"},...data.obras.map(o=>({v:o.id,l:o.name}))]}/>}
        </div>

        <div className="terceiros-payment-list">
        {recurringTerc
          .filter(t => filterObra==="all" || t.obraId===filterObra)
          .sort((a,b) => {
            // Pendentes primeiro
            const pa = wasPaidThisWeek(a.id), pb = wasPaidThisWeek(b.id);
            if(pa !== pb) return pa ? 1 : -1;
            return a.name.localeCompare(b.name);
          })
          .map(t => {
            const sp = specInfo(t.specialty);
            const paid = wasPaidThisWeek(t.id);
            const paidEntry = thisWeekPay(t.id);
            return (
              <article className="terceiros-payment-row" data-paid={paid} key={t.id}>
                <div className="terceiros-payment-row__main">
                  <div className="terceiros-payment-row__heading">
                    <span>{sp.emoji}</span>
                    <h3>{t.name}</h3>
                    {paid && <Badge color={C.green}>ok Pago</Badge>}
                    {paidEntry?.semEvidenciaFotografica&&<Badge color={C.red}>Sem foto</Badge>}
                  </div>
                  <p>{sp.l} · {obraName(t.obraId)}</p>
                  {paid && paidEntry && (
                    <p className="terceiros-payment-row__status" data-paid="true">
                      {fmt(paidEntry.amount)} · {fmtDateFull(paidEntry.date)} · {paidEntry.pagador === "empresa" ? "empresa" : `obra ${obraName(paidEntry.obraId)}`}
                    </p>
                  )}
                  {!paid && t.weeklyRate>0 && (
                    <p className="terceiros-payment-row__status">
                      Previsto: {fmt(t.weeklyRate)}
                    </p>
                  )}
                </div>
                <div className="terceiros-payment-row__action">
                  {!paid ? (
                    <Btn v="warning" onClick={()=>{setPayModal(t);setPayAmount(String(t.weeklyRate||""));setPaySource("");}}>
                      <Ic n="dollar"/> Pagar
                    </Btn>
                  ) : (
                    <Btn v="ghost" size="sm" onClick={()=>paidEntry&&removePay(paidEntry.id)}>
                      <Ic n="x"/> Estornar
                    </Btn>
                  )}
                </div>
              </article>
            );
          })
        }
        </div>
      </>)}

      {/* Modal: cadastro */}
      {modal && (() => {
        const docLimpo = soDigitos(form.documento);
        const docOk = docLimpo.length === 0 ? null : validarDocumento(docLimpo, form.tipoPessoa);
        const prestadorSelecionado = form.prestadorId
          ? prestadoresUnicos.find(t => prestadorKey(t) === form.prestadorId)
          : null;
        const existentePorDocumento = !form.id && docLimpo
          ? allTerc.find(t => (t.tipoPessoa || "PJ") === (form.tipoPessoa || "PJ") && soDigitos(t.documento) === docLimpo)
          : null;
        const cadastroVinculado = prestadorSelecionado || existentePorDocumento;
        const contratosVinculados = cadastroVinculado ? contratosDoPrestador(cadastroVinculado) : [];
        const secTitulo = (titulo, descricao) => (
          <div className="terceiros-form-section" style={{gridColumn:"1/-1"}}>
            <h4>{titulo}</h4>
            {descricao && <p>{descricao}</p>}
          </div>
        );
        return (
        <Modal title={form.id?"Editar contrato de terceirizado":"Novo contrato de terceirizado"} onClose={closeContractModal} wide panelClass="terceiros-form-modal">
          <div className="terceiros-form-grid" style={{gridTemplateColumns:formGrid(2)}}>

            {!form.id && prestadoresUnicos.length > 0 && (
              <div className="terceiros-form-reuse" style={{gridColumn:"1/-1"}}>
                <Sel label="Reaproveitar prestador já cadastrado" value={form.prestadorId || ""}
                  onChange={id => {
                    if (!id) { setForm({ ...emptyT }); return; }
                    const base = prestadoresUnicos.find(t => prestadorKey(t) === id);
                    if (base) setForm(montarNovoContrato(base));
                  }}
                  options={[{v:"",l:"Cadastrar um novo prestador"}, ...prestadoresUnicos.map(t=>({
                    v:prestadorKey(t),
                    l:`${t.name}${t.documento?` · ${maskDoc(t.documento,t.tipoPessoa)}`:""} · ${contratosDoPrestador(t).length} contrato(s)`,
                  }))]}/>
                <p>
                  Evite digitação duplicada. Os dados fiscais, bancários e de contato serão reaproveitados; obra, valores, etapas, medições e pagamentos continuarão independentes.
                </p>
              </div>
            )}

            {cadastroVinculado && !form.id && (
              <div className="terceiros-form-linked" style={{gridColumn:"1/-1"}}>
                <p>
                  Cadastro vinculado: {cadastroVinculado.name} · {contratosVinculados.length} contrato(s) existente(s)
                </p>
                <small>
                  {contratosVinculados.map(t=>obraName(t.obraId)).filter((v,i,a)=>v&&v!=="-"&&a.indexOf(v)===i).join(" · ") || "Sem obra vinculada"}
                </small>
              </div>
            )}

            {/* IDENTIFICACAO */}
            {secTitulo("Prestador e alocação", "Identifique o prestador e defina onde e como este contrato será executado.")}
            <div style={{ gridColumn:"1/-1" }}><Inp label="Nome / Apelido *" value={form.name} onChange={F("name")} placeholder="Nome usado para identificar o prestador"/></div>
            <Sel label="Especialidade *" value={form.specialty} onChange={F("specialty")} options={SPECIALTIES.map(s=>({v:s.v,l:s.l}))}/>
            <Sel label="Obra *" value={form.obraId} onChange={F("obraId")} options={[{v:"",l:"Selecione"},...data.obras.map(o=>({v:o.id,l:o.name}))]}/>
            <Sel label="Situação" value={form.situacao} onChange={F("situacao")} options={COLS_KANBAN.map(c=>({v:c.v,l:c.l}))}/>
            <Sel label="Tipo de contrato" value={form.tipoContrato} onChange={F("tipoContrato")}
              options={[{v:"medicao",l:"Por medição"},{v:"empreitada",l:"Empreitada (global)"},{v:"semanal",l:"Semanal"},{v:"diaria",l:"Diária"}]}/>
            <div className="terceiros-form-note" style={{gridColumn:"1/-1"}}>
              <Ic n="info" s={14}/>
              <p>
                A origem do recurso não é definida no contrato. Em cada pagamento o sistema perguntará se o valor foi pago pela empresa ou pela obra.
              </p>
            </div>

            {secTitulo("Dados fiscais", "Esses dados pertencem ao prestador e serão compartilhados entre os contratos vinculados.")}
            <div className="terceiros-form-choice" style={{gridColumn:"1/-1"}}>
              {[["PJ","Pessoa Jurídica (CNPJ)"],["PF","Pessoa Física (CPF)"]].map(([v,l]) => (
                <button type="button" key={v} aria-pressed={form.tipoPessoa===v}
                  onClick={()=>F("tipoPessoa")(v)}>{l}</button>
              ))}
            </div>
            <div>
              {form.tipoPessoa === "PJ" ? (
                // PJ: busca na Receita e preenche razao social, contato e endereco.
                <CampoCNPJ label="CNPJ" value={form.documento}
                  onChange={v=>F("documento")(soDigitos(v))}
                  onEncontrado={d=>setForm(f=>({
                    ...f,
                    name:        f.name        || d.nome,
                    razaoSocial: f.razaoSocial || d.razaoSocial,
                    phone:       f.phone       || d.telefone,
                    email:       f.email       || d.email,
                    cep:         f.cep         || d.cep,
                    endereco:    f.endereco    || [d.logradouro, d.numero].filter(Boolean).join(", "),
                    cidade:      f.cidade      || d.cidade,
                    ufEnd:       f.ufEnd       || d.uf,
                  }))}/>
              ) : (
                <Inp label="CPF"
                  value={maskDoc(form.documento, form.tipoPessoa)}
                  onChange={v=>F("documento")(soDigitos(v))}
                  placeholder="000.000.000-00"/>
              )}
              {docOk === false && <p className="terceiros-form-validation" data-valid="false">Documento inválido. Confira os dígitos.</p>}
              {docOk === true && <p className="terceiros-form-validation" data-valid="true">Documento válido</p>}
            </div>
            <Inp label={form.tipoPessoa==="PF"?"Nome completo (fiscal)":"Razão social"} value={form.razaoSocial} onChange={F("razaoSocial")}/>
            {form.tipoPessoa==="PJ" && <Inp label="Inscrição estadual" value={form.inscEstadual} onChange={F("inscEstadual")} placeholder="Isento, se não houver"/>}
            {form.tipoPessoa==="PJ" && <Inp label="Inscrição municipal" value={form.inscMunicipal} onChange={F("inscMunicipal")}/>}

            {secTitulo("Valores e pagamento", "Defina o valor contratado, a recorrência e as retenções aplicáveis.")}
            <Inp label="Valor do contrato (R$)" value={form.contractValue} onChange={F("contractValue")} placeholder="0,00"/>
            <Inp label="Valor semanal (R$)" value={form.weeklyRate} onChange={F("weeklyRate")} placeholder="Ex.: 2.000"/>
            <Inp label="Início" type="date" value={form.startDate} onChange={F("startDate")}/>
            <Inp label="Término previsto" type="date" value={form.endDate} onChange={F("endDate")}/>
            <div>
              <Inp label="Retenção ISS (%)" value={form.retISS} onChange={F("retISS")} placeholder="0"/>
              <div className="terceiros-form-choice terceiros-form-choice--compact">
                {[["fonte","Retido na fonte"],["prestador","Prestador paga"]].map(([v,l]) => (
                  <button type="button" key={v} aria-pressed={form.retISSQuem===v}
                    onClick={()=>F("retISSQuem")(v)}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <Inp label="Retenção INSS (%)" value={form.retINSS} onChange={F("retINSS")} placeholder="0"/>
              <div className="terceiros-form-choice terceiros-form-choice--compact">
                {[["fonte","Retido na fonte"],["prestador","Prestador paga"]].map(([v,l]) => (
                  <button type="button" key={v} aria-pressed={form.retINSSQuem===v}
                    onClick={()=>F("retINSSQuem")(v)}>{l}</button>
                ))}
              </div>
            </div>
            <Inp label="Chave PIX" value={form.pixKey} onChange={F("pixKey")}/>
            <Inp label="Banco" value={form.banco} onChange={F("banco")} placeholder="Ex.: 341 Itaú"/>
            <Inp label="Agência" value={form.agencia} onChange={F("agencia")}/>
            <Inp label="Conta" value={form.conta} onChange={F("conta")}/>

            {secTitulo("Contato e endereço", "Dados usados para comunicação, notas fiscais e conferência do pagamento.")}
            <Inp label="Responsável" value={form.responsavel} onChange={F("responsavel")} placeholder="Quem atende pela empresa"/>
            <Inp label="Telefone" value={form.phone} onChange={F("phone")} placeholder="(81) 9XXXX-XXXX"/>
            <Inp label="E-mail" value={form.email} onChange={F("email")}/>
            <Inp label="CEP" value={maskCEP(form.cep)} onChange={v=>F("cep")(soDigitos(v))} placeholder="00000-000"/>
            <div style={{ gridColumn:"1/-1" }}><Inp label="Endereço" value={form.endereco} onChange={F("endereco")} placeholder="Rua, número, bairro"/></div>
            <Inp label="Cidade" value={form.cidade} onChange={F("cidade")}/>
            <Inp label="UF" value={form.ufEnd} onChange={v=>F("ufEnd")(v.toUpperCase().slice(0,2))} placeholder="PE"/>

            {secTitulo("Documentos e observações", "Controle certidões e documentos obrigatórios antes de liberar medições e pagamentos.")}
            <div className="terceiros-form-documents" style={{gridColumn:"1/-1"}}>
              {(form.documentos || []).map(doc => {
                const dias = diasAte(doc.validade);
                return (
                  <div className="terceiros-form-document" data-critical={dias!==null&&dias<=0} data-warning={dias!==null&&dias>0&&dias<=30} key={doc.id}>
                    <div>
                      <p>{docTercInfo(doc.tipo).l}</p>
                      <small>
                        {doc.numero ? `${doc.numero} · ` : ""}vence {fmtDateFull(doc.validade)}
                        {dias!==null && (dias<0?` (vencido há ${Math.abs(dias)}d)`:dias===0?" (hoje)":` (${dias}d)`)}
                      </small>
                    </div>
                    <button type="button" aria-label={`Remover ${docTercInfo(doc.tipo).l}`} onClick={()=>delDocNoForm(doc.id)}><Ic n="trash" s={13}/></button>
                  </div>
                );
              })}
              <div className="terceiros-form-document-add">
                <Sel label="Tipo" value={docForm.tipo} onChange={v=>setDocForm(d=>({...d,tipo:v}))} options={DOCS_TERC.map(d=>({v:d.v,l:d.l}))}/>
                <Inp label="Número" value={docForm.numero} onChange={v=>setDocForm(d=>({...d,numero:v}))} placeholder="Opcional"/>
                <Inp label="Validade" type="date" value={docForm.validade} onChange={v=>setDocForm(d=>({...d,validade:v}))}/>
                <Btn size="sm" onClick={addDocNoForm}><Ic n="plus"/> Adicionar</Btn>
              </div>
            </div>

            <div style={{ gridColumn:"1/-1" }}><Inp label="Observações" value={form.notes} onChange={F("notes")} multiline placeholder="Escopo, condições, o que combinaram..."/></div>
          </div>
          <div className="terceiros-form-footnote">
            <Ic n="info" s={14}/>
            <p>
              Cada contrato fica vinculado a uma única obra. O mesmo terceirizado pode ter vários contratos simultâneos, inclusive com valores, especialidades, etapas e medições diferentes.
            </p>
          </div>
          <div className="terceiros-form-actions">
            <Btn v="ghost" onClick={closeContractModal} full>{form.id?"Cancelar":"Salvar rascunho e sair"}</Btn>
            <Btn onClick={saveTerc} full><Ic n="check"/> {form.id?"Salvar alterações":"Criar contrato"}</Btn>
          </div>
        </Modal>
        );
      })()}

      {/* Modal: registrar pagamento */}
      {medModal && tercAtual && (
        <Modal title={`Medição ${medicoesTercAtual.length + 1} - ${tercAtual.name}`} onClose={()=>setMedModal(false)} wide>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <p style={{ fontSize:11.5, color:C.muted, lineHeight:1.55 }}>
              Informe o percentual <b>acumulado</b> de cada etapa - o total executado até hoje, não o avanço da semana.
              O app calcula a diferença para a medição anterior e valoriza só o que avançou.
            </p>
            <Inp label="Data da medição" type="date" value={medForm.data} onChange={v=>setMedForm(f=>({...f,data:v}))}/>

            <div style={{ border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
              {etapasTerc.map((e, i) => {
                const anterior = Number(acumuladoPorEtapa[e.id] || 0);
                const atual    = pct(medForm.pcts?.[e.id] ?? anterior);
                const delta    = atual - anterior;
                const valor    = Number(e.valor || 0) * delta / 100;
                return (
                  <div key={e.id} style={{ padding:"9px 11px", borderTop:i?`1px solid ${C.line}`:0,
                                           display:"grid", gridTemplateColumns:"minmax(0,1fr) 84px 96px", gap:8, alignItems:"center" }}>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:12.5, fontWeight:700, color:C.text }}>{e.nome}</p>
                      <p style={{ fontSize:10, color:C.muted, marginTop:2 }}>
                        {fmt(e.valor)} · anterior {anterior.toFixed(1)}%
                      </p>
                    </div>
                    <input type="number" step="any" inputMode="decimal" min={0} max={100}
                      value={medForm.pcts?.[e.id] ?? ""}
                      onChange={ev=>setMedForm(f=>({...f, pcts:{...f.pcts, [e.id]:ev.target.value}}))}
                      style={{ width:"100%", boxSizing:"border-box", background:C.bg,
                               border:`1.5px solid ${delta<0?C.red:delta>0?C.green:C.line}`,
                               color:C.text, padding:"7px 8px", borderRadius:7, fontSize:13, textAlign:"right",
                               outline:"none", fontFamily:"'Inter',sans-serif" }}/>
                    <div style={{ textAlign:"right" }}>
                      <p style={{ fontSize:12.5, fontWeight:800, color:delta<0?C.red:delta>0?C.green:C.muted }}>{fmt(valor)}</p>
                      <p style={{ fontSize:9.5, color:C.muted }}>{delta>0?"+":""}{delta.toFixed(1)} p.p.</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Medir para tras e legitimo (corrigir medicao a maior), mas nunca
                deve passar despercebido. */}
            {itensDaMedicao().some(i => i.pctAcum < i.pctAnterior) && (
              <div style={{ background:`${C.orange}12`, border:`1px solid ${C.orange}55`, borderRadius:8, padding:"8px 11px" }}>
                <p style={{ fontSize:11, color:C.orange, lineHeight:1.5 }}>
                  Há etapa com percentual menor que o da medição anterior. Isso gera valor negativo -
                  um estorno de medição a maior. Se não é o caso, revise os percentuais.
                </p>
              </div>
            )}

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8,
                          background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"11px 13px" }}>
              <span style={{ fontSize:11, fontWeight:900, color:C.muted, textTransform:"uppercase", letterSpacing:.8 }}>Total desta medição</span>
              <b style={{ fontSize:21, color:C.green, fontFamily:"'Inter Display','Inter',sans-serif" }}>
                {fmt(itensDaMedicao().reduce((s,i)=>s+i.valor,0))}
              </b>
            </div>

            <Inp label="Observação" value={medForm.observacao} onChange={v=>setMedForm(f=>({...f,observacao:v}))}
              placeholder="Ex.: pendente o quadro do 2º pavimento"/>

            <div style={{background:C.surface,border:`1px solid ${(medForm.fotos||[]).length?C.green:C.orange}66`,borderRadius:9,padding:"11px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:9,flexWrap:"wrap"}}><div><p style={{fontSize:10.5,fontWeight:900,color:C.text,textTransform:"uppercase"}}>Evidência fotográfica obrigatória</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>As imagens ficam na pasta de fotos da obra e identificam o engenheiro responsável.</p></div><Btn size="sm" v={(medForm.fotos||[]).length?"ghost":"warning"} onClick={()=>inputFotosMedRef.current?.click()} disabled={subindoFotosMed}><Ic n="camera"/> {subindoFotosMed?"Enviando...":"Adicionar fotos"}</Btn><input ref={inputFotosMedRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{void anexarFotosMedicao(e.target.files);e.target.value="";}}/></div>
              {(medForm.fotos||[]).length?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(86px,1fr))",gap:7,marginTop:9}}>{(medForm.fotos||[]).map((f,i)=><div key={f.id||i} style={{minWidth:0}}><a href={f.url} target="_blank" rel="noopener noreferrer" style={{display:"block",aspectRatio:"1/1",borderRadius:7,overflow:"hidden",border:`1px solid ${C.border}`}}><img src={f.url} alt={`Evidência ${i+1}`} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/></a><p style={{fontSize:8.5,color:C.muted,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Foto {i+1} · {currentUser?.nome}</p></div>)}</div>:<p style={{fontSize:10,color:C.orange,fontWeight:800,marginTop:8}}>Nenhuma fotografia anexada. Clique em “Confirmar e lançar no DRE” para selecionar a evidência.</p>}
            </div>

            <div style={{background:`${C.green}0B`,border:`1px solid ${C.green}44`,borderRadius:8,padding:"8px 11px"}}>
              <p style={{fontSize:10,color:C.green,fontWeight:850,lineHeight:1.45}}>Ao confirmar, o valor executado será reconhecido automaticamente como despesa de terceirizado no DRE da data informada. O pagamento será apenas a baixa financeira dessa obrigação.</p>
            </div>

            <div style={{ display:"flex", gap:8 }}>
              <Btn v="ghost" full onClick={()=>setMedModal(false)}>Cancelar</Btn>
              <Btn full onClick={salvarMedicao} disabled={subindoFotosMed||thirdPartyCommandPending}><Ic n="check"/> {thirdPartyCommandPending?"Confirmando...":"Confirmar e lançar no DRE"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {notaTercModal&&<Modal title={`Vincular NF à medição ${notaTercModal.numero}`} onClose={()=>{setNotaTercModal(null);setNotaTercId("");}}>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{padding:"8px 10px",background:`${C.blue}08`,border:`1px solid ${C.blue}55`,borderRadius:7}}>
            <b style={{fontSize:11,color:C.blue}}>Obrigação já reconhecida: {fmt(notaTercModal.total)}</b>
            <p style={{fontSize:9.5,color:C.muted,marginTop:2}}>A nota será evidência fiscal da medição; não criará um segundo custo.</p>
          </div>
          <Sel label="Nota fiscal" value={notaTercId} onChange={setNotaTercId} options={[{v:"",l:"Selecione"},...(data.notasFiscais||[]).filter(n=>!n.medicaoTercId&&n.obraId===notaTercModal.obraId&&!["cancelada","rejeitada"].includes(n.status)).map(n=>({v:n.id,l:`${n.numero||"NF"} · ${fmt(n.valorBruto)} · ${n.fornecedorNome||"Fornecedor"}`}))]}/>
          <div style={{display:"flex",gap:7}}><Btn v="ghost" full onClick={()=>{setNotaTercModal(null);setNotaTercId("");}}>Cancelar</Btn><Btn full onClick={confirmarVinculoNotaTerceiro} disabled={!notaTercId}>Vincular e conferir</Btn></div>
        </div>
      </Modal>}

      {medPayModal && (() => {
        const t = allTerc.find(x => x.id === medPayModal.tercId);
        if (!t) return null;
        const ret = calcRetencoes(medPayModal.total, t);
        return (
          <Modal title={`Pagar medição ${medPayModal.numero} - ${t.name}`} onClose={()=>{setMedPayModal(null);setPaySource("");setRiscoSemFotoAceito(false);}}>
            <div className="terceiros-payment-review">
              <p style={{ fontSize:12, color:C.muted }}>{specInfo(t.specialty).emoji} {specInfo(t.specialty).l} · {obraName(medPayModal.obraId)}</p>
              <div className="terceiros-payment-review__values">
                <span><small>Bruto / obrigação</small><b>{fmt(medPayModal.total)}</b></span>
                <span><small>ISS retido</small><b>{fmt(ret.issRetido)}</b></span>
                <span><small>INSS retido</small><b>{fmt(ret.inssRetido)}</b></span>
                <span><small>Líquido ao prestador</small><b>{fmt(ret.liquido)}</b></span>
              </div>
              <p className="terceiros-payment-review__date">Baixa em {fmtDateFull(today())} · custo reconhecido em {fmtDateFull(medPayModal.data)}</p>
            </div>
            {!(medPayModal.fotos||[]).length?<label style={{display:"flex",alignItems:"flex-start",gap:9,background:`${C.red}0D`,border:`1px solid ${C.red}77`,borderRadius:8,padding:"10px 11px",marginBottom:12,cursor:"pointer"}}><input type="checkbox" checked={riscoSemFotoAceito} onChange={e=>setRiscoSemFotoAceito(e.target.checked)} style={{marginTop:2,accentColor:C.red}}/><span><b style={{fontSize:11,color:C.red}}>Risco financeiro: medição sem fotografia da execução</b><p style={{fontSize:9.8,color:C.muted,lineHeight:1.45,marginTop:3}}>Sem evidência do engenheiro, o pagamento pode antecipar serviço não executado, incompleto ou fora da especificação. Marque somente se decidiu prosseguir mesmo assim; a exceção ficará registrada.</p></span></label>:<div style={{display:"flex",alignItems:"center",gap:7,background:`${C.green}0B`,border:`1px solid ${C.green}44`,borderRadius:8,padding:"8px 10px",marginBottom:12}}><Ic n="check" color={C.green}/><p style={{fontSize:10.5,color:C.green,fontWeight:800}}>{(medPayModal.fotos||[]).length} fotografia(s) validada(s) · {medPayModal.responsavelEvidencia||medPayModal.fotos?.[0]?.enviadoPor||"engenheiro"}</p></div>}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <p style={{ fontSize:11, fontWeight:800, color:C.text, textTransform:"uppercase", letterSpacing:.7, marginBottom:6 }}>Quem realizou este pagamento? *</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
                  {[["empresa","Empresa","Despesa administrativa"],["obra","Obra","Custo direto da obra"]].map(([v,l,dica])=>(
                    <button key={v} onClick={()=>setPaySource(v)} style={{ padding:"10px 9px", border:`2px solid ${paySource===v?C.green:C.border}`, background:paySource===v?`${C.green}12`:C.surface, borderRadius:8, cursor:"pointer", textAlign:"left" }}>
                      <p style={{ fontSize:13, fontWeight:900, color:paySource===v?C.text:C.muted }}>{l}</p>
                      <p style={{ fontSize:9.5, color:C.muted, marginTop:2 }}>{v==="obra"?`${dica}: ${obraName(medPayModal.obraId)}`:dica}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn v="ghost" onClick={()=>{setMedPayModal(null);setPaySource("");setRiscoSemFotoAceito(false);}} full>Cancelar</Btn>
                <Btn v="success" onClick={confirmarPagamentoMedicao} disabled={!(medPayModal.fotos||[]).length&&!riscoSemFotoAceito} full><Ic n="check"/> Confirmar pagamento</Btn>
              </div>
            </div>
          </Modal>
        );
      })()}

      {payModal && (
        <Modal title={`Pagamento - ${payModal.name}`} onClose={()=>{setPayModal(null);setPayAmount("");setPayDesc("");setPaySource("");}}>
          <div className="terceiros-payment-review">
            <p style={{ fontSize:12, color:C.muted }}>{specInfo(payModal.specialty).emoji} {specInfo(payModal.specialty).l} · {obraName(payModal.obraId)}</p>
            <p style={{ fontSize:13, color:C.orange, fontWeight:700, marginTop:2 }}>Sexta-feira: {fmtDateFull(friday)}</p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div>
              <p style={{ fontSize:11, fontWeight:800, color:C.text, textTransform:"uppercase", letterSpacing:.7, marginBottom:6 }}>Quem realizou este pagamento? *</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
                {[["empresa","Empresa","Despesa administrativa"],["obra","Obra","Custo direto da obra"]].map(([v,l,dica])=>(
                  <button key={v} onClick={()=>setPaySource(v)} style={{ padding:"10px 9px", border:`2px solid ${paySource===v?C.orange:C.border}`, background:paySource===v?`${C.orange}12`:C.surface, borderRadius:8, cursor:"pointer", textAlign:"left" }}>
                    <p style={{ fontSize:13, fontWeight:900, color:paySource===v?C.text:C.muted }}>{l}</p>
                    <p style={{ fontSize:9.5, color:C.muted, marginTop:2 }}>{v==="obra"?`${dica}: ${obraName(payModal.obraId)}`:dica}</p>
                  </button>
                ))}
              </div>
            </div>
            <Inp label="Valor (R$) *" type="number" value={payAmount} onChange={setPayAmount} placeholder={`Sugerido: ${fmt(payModal.weeklyRate)}`}/>
            <Inp label="Descrição" value={payDesc} onChange={setPayDesc} placeholder={`Pagamento semanal ${fmtDateFull(friday)}`}/>
            <div style={{ display:"flex", gap:8 }}>
              <Btn v="ghost" onClick={()=>{setPayModal(null);setPaySource("");}} full>Cancelar</Btn>
              <Btn v="warning" onClick={()=>savePay(payModal)} full><Ic n="check"/> Confirmar pagamento</Btn>
            </div>
          </div>
        </Modal>
      )}

      {cancelContract && (()=>{
        const meds=(data.medicoesTerc||[]).filter(m=>registroTerceiroAtivo(m)&&m.tercId===cancelContract.id);
        const pags=(data.pagsTerceiros||[]).filter(p=>registroTerceiroAtivo(p)&&p.tercId===cancelContract.id);
        return <Modal title="Cancelar contrato e preservar histórico" onClose={()=>setCancelContract(null)}>
          <div className="terceiros-audit-confirm">
            <p><b>{cancelContract.name}</b> · {obraName(cancelContract.obraId)}</p>
            <dl><div><dt>Contrato</dt><dd>{fmt(cancelContract.contractValue)}</dd></div><div><dt>Medições</dt><dd>{meds.length} · {fmt(meds.reduce((s,m)=>s+Number(m.total||0),0))}</dd></div><div><dt>Pagamentos</dt><dd>{pags.length} · {fmt(pags.reduce((s,p)=>s+Number(p.amount||0),0))}</dd></div></dl>
            <p className="terceiros-audit-confirm__notice">O contrato sairá do fluxo ativo. Medições, pagamentos e reflexos históricos no DRE serão preservados para auditoria.</p>
            <Inp label="Motivo do cancelamento *" value={cancelReason} onChange={setCancelReason} multiline placeholder="Explique por que o contrato está sendo encerrado"/>
            <div><Btn v="ghost" full onClick={()=>setCancelContract(null)}>Voltar</Btn><Btn v="danger" full onClick={confirmRemoveTerc}>Cancelar contrato</Btn></div>
          </div>
        </Modal>;
      })()}

      {reversePayment && <Modal title="Estornar pagamento" onClose={()=>setReversePayment(null)}>
        <div className="terceiros-audit-confirm">
          <p><b>{fmt(reversePayment.amount)}</b> · {fmtDateFull(reversePayment.date)} · {reversePayment.description}</p>
          <p className="terceiros-audit-confirm__notice">O lançamento sairá dos totais vigentes, mas continuará preservado no histórico de auditoria.</p>
          <Inp label="Motivo do estorno *" value={reverseReason} onChange={setReverseReason} multiline placeholder="Informe o motivo e a referência da correção"/>
          <div><Btn v="ghost" full onClick={()=>setReversePayment(null)}>Voltar</Btn><Btn v="danger" full onClick={confirmRemovePay} disabled={thirdPartyCommandPending}>{thirdPartyCommandPending?"Estornando...":"Confirmar estorno"}</Btn></div>
        </div>
      </Modal>}

      {stageToRemove && <Modal title="Remover etapa do contrato" onClose={()=>setStageToRemove(null)}>
        <div className="terceiros-audit-confirm">
          <p>Remover <b>{stageToRemove.nome}</b>, no valor de <b>{fmt(stageToRemove.valor)}</b>?</p>
          <p className="terceiros-audit-confirm__notice">A soma das etapas pode deixar de coincidir com o contrato. Esta ação só está disponível porque a etapa ainda não foi medida.</p>
          <div><Btn v="ghost" full onClick={()=>setStageToRemove(null)}>Manter etapa</Btn><Btn v="danger" full onClick={confirmarRemocaoEtapa} disabled={thirdPartyCommandPending}>Remover etapa</Btn></div>
        </div>
      </Modal>}
    </div>
  );
}
