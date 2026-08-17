// ===================================================================
// ConciliacaoView — tela de Conciliação extraída de LegacyApp.jsx
//
// Extraído verbatim (mesmo corpo, mesma lógica) de src/LegacyApp.jsx em
// 2026-08-16, seguindo o mesmo padrão de Terceiros e Orçamento. Mesma
// camada de dados, sem nova migration/RLS. Ver
// docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #2 da fila de extração.
//
// Vive em src/features/ (não em src/domains/conciliacao/components/) de
// propósito: vite.config.mjs agrupa tudo sob /src/domains/conciliacao/ no
// chunk manual "financial-domain", que já é carregado eager porque
// Financeiro/DRE ainda não foram extraídos de LegacyApp.jsx. Colocar um
// componente lazy ali dentro criava um ciclo (financial-domain eager
// precisando deste arquivo, que por sua vez importa de volta do
// LegacyApp.jsx) e o Rollup respondia fundindo o monólito inteiro nesse
// chunk. Mesmo precedente de src/features/suprimentos/MarcosCurvaASuprimentos.
// ===================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import {
  Badge, Btn, C, Ic, Inp, Modal, PageHero, Sel, TabRow,
  XLSX, carregarXLSX, fmt, fmtDate, today, uid,
  CATS_DESP, CATS_OBRA_CONC,
  semAcentoConc, parseBRConc, parseOFX, chaveTransacao, somaRateios,
  sugerirRateio, diasEntre, sugerirMedicoes, sugerirPagamentoMaoObra,
  periodoPontoDaTransacao,
} from "../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../domains/sync/operational-commands";
import {
  calcConciliacao,
  totalRecebidoMedicao,
  paraCentavos, deCentavos, igualCentavos,
  criarIndicesFinanceiros,
  recebidoEntradaContrato,
  gerarCandidatosConciliacao, FAIXA_CONFIANCA,
  criarRegistroIdentidades, analisarMovimentoConciliacao, resumoQuinzenaConciliacao,
  podeOperarConciliacao, podeOperarConciliacaoTrabalhista, podeDesfazerConciliacao,
  podeReabrirFechamento, podeArquivarExtrato, podeFecharPeriodo, podeCriarRegra,
  hashArquivo,
} from "../../domains/conciliacao/index.js";
import { createExactPixLaborCandidate, findRegisteredEmployeePix, hasEmployeePixNameEvidence, isExactPixLaborMatch } from "../../domains/conciliacao/pix-card";
import { executarComandoConciliacao } from "../../api";

export default function Conciliacao({ data, update, showToast, currentUser, dispatchCommand=null }) {
  const { formGrid } = useBreakpoint();
  const [aba,        setAba]        = useState("pendentes");  // pendentes|conciliadas|ignoradas|extratos|historico
  const [importando, setImportando] = useState(false);
  const [apropModal, setApropModal] = useState(null);   // transação em apropriação
  const [rateios,    setRateios]    = useState([]);
  const [criarRegra, setCriarRegra] = useState(false);
  const [padraoRegra,setPadraoRegra]= useState("");
  const [medAlvo,    setMedAlvo]    = useState(null);   // medição que a entrada vai quitar
  const [buscaConc,setBuscaConc]=useState("");
  const [tipoMovimento,setTipoMovimento]=useState("todos");
  const [selecionadas,setSelecionadas]=useState([]);
  const [limiteVisivel,setLimiteVisivel]=useState(30);
  const [acoesTransacaoAberta,setAcoesTransacaoAberta]=useState("");
  const [ignorarModal,setIgnorarModal]=useState(null);
  // Motor de candidatos (Fila inteligente)
  const [candidatoModal,setCandidatoModal]=useState(null);   // { trId, idx }
  const [pagamentoForm,setPagamentoForm]=useState({valor:"",data:""});
  const [recebedorMaoObraId,setRecebedorMaoObraId]=useState("");
  const [detalhesPix,setDetalhesPix]=useState(false);
  const [pixAutoPreparadoId,setPixAutoPreparadoId]=useState("");
  const [entradaModal,setEntradaModal]=useState(null);        // { trId }
  const [entradaForm,setEntradaForm]=useState({tipo:"medicao",contratoId:"",medicaoId:"",obraId:"",categoria:"aporte_cliente",descricao:"",novaParcela:false,novaParcelaDescricao:"",novaParcelaCompetencia:"",novaParcelaValor:""});
  const [transferModal,setTransferModal]=useState(null);     // { trId }
  const [estornoModal,setEstornoModal]=useState(null);       // { trId }
  const [mostrarArquivados,setMostrarArquivados]=useState(false);
  // Cadastro de contas bancárias
  const [contaBancariaModal,setContaBancariaModal]=useState(null); // {} novo | conta existente
  const [contaBancariaImport,setContaBancariaImport]=useState("");
  // Regras de auto-classificação
  const [regraModal,setRegraModal]=useState(null);
  // Fechamento bancário
  const [fecharModal,setFecharModal]=useState(null);
  const [conciliando,setConciliando]=useState(false);
  const [transacaoCommandPending,setTransacaoCommandPending]=useState(false);
  const transacaoCommandPendingRef=useRef(false);

  const podeOperarConc=podeOperarConciliacao(currentUser?.role);
  const podeOperarConcTrabalhista=podeOperarConciliacaoTrabalhista(currentUser?.role);
  const modoConciliacaoRh=currentUser?.role==="rh";
  const podeElevado=podeDesfazerConciliacao(currentUser?.role);

  const calc = useMemo(() => calcConciliacao(data), [data.transacoes]);

  // Índices do motor de candidatos - montados uma vez por mudança relevante
  // dos dados, nunca recalculados a cada linha da tabela.
  const indicesFinanceiros = useMemo(() => criarIndicesFinanceiros(data), [
    data.notasFiscais, data.pedidos, data.medicoes, data.medicoesTerc,
    data.terceirizados, data.employees, data.caixaObra, data.transacoes,
  ]);
  const registroIdentidades=useMemo(()=>criarRegistroIdentidades(data),[
    data.contasBancarias,data.employees,data.terceirizados,data.fornecedores,
    data.proprietariosEquip,data.clientes,data.comercial,
  ]);
  // Este mapa é a fonte da classificação operacional da fila. O cartão PIX
  // continua sendo apenas uma visualização especializada da mesma decisão.
  const analisesPorTransacao=useMemo(()=>new Map((data.transacoes||[]).map(tr=>[
    tr.id,analisarMovimentoConciliacao(tr,data,{indices:indicesFinanceiros,registry:registroIdentidades}),
  ])),[data,indicesFinanceiros,registroIdentidades]);
  const periodoQuinzenaConc=useMemo(()=>periodoPontoDaTransacao(today()),[]);
  const resumoQuinzena=useMemo(()=>resumoQuinzenaConciliacao(data,{
    inicio:periodoQuinzenaConc.days[0]||"",fim:periodoQuinzenaConc.days.at(-1)||"",
  }),[data,periodoQuinzenaConc]);
  const rejeitadasSet = useMemo(() => new Set(
    (data.rejeicoesConc||[]).map(r=>`${r.transacaoId}:${r.candidatoTipo}:${r.candidatoId}`)
  ), [data.rejeicoesConc]);

  const transacoes = useMemo(() => {
    const extratosArquivados = new Set((data.extratos || []).filter(e => e.status === "arquivado").map(e => String(e.id)));
    const t = (data.transacoes || []).filter(item => !extratosArquivados.has(String(item.extratoId || "")));
    const ordem={pronta:0,revisar:1,investigar:2,sem_correspondencia:3,bloqueada:4};
    t.sort((a,b) => {
      if(aba==="pendentes"&&a.status==="pendente"&&b.status==="pendente"){
        const aAnalise=analisesPorTransacao.get(a.id),bAnalise=analisesPorTransacao.get(b.id);
        const diff=(ordem[aAnalise?.classificacaoOperacional]??9)-(ordem[bAnalise?.classificacaoOperacional]??9);
        if(diff)return diff;
        if(aAnalise?.classificacaoOperacional==="investigar")return Math.abs(Number(b.valor||0))-Math.abs(Number(a.valor||0));
      }
      return (b.data||"").localeCompare(a.data||"");
    });
    const porStatus=aba === "pendentes"?t.filter(x=>x.status==="pendente"):aba === "conciliadas"?t.filter(x=>x.status==="conciliado"):aba === "ignoradas"?t.filter(x=>x.status==="ignorado"):t;
    const termo=semAcentoConc(buscaConc.trim());
    return porStatus.filter(x=>(tipoMovimento==="todos"||(tipoMovimento==="entradas"?Number(x.valor)>0:Number(x.valor)<0))&&(!termo||semAcentoConc(`${x.descricao} ${x.data} ${x.ignoradoMotivo||""}`).includes(termo)));
  }, [data.transacoes, data.extratos, aba, buscaConc, tipoMovimento, analisesPorTransacao]);
  const transacoesVisiveis=transacoes.slice(0,limiteVisivel);
  const todosSelecionados=transacoes.length>0&&transacoes.every(t=>selecionadas.includes(t.id));

  // Candidatas pré-computadas só para a fatia visível da fila pendente -
  // nunca roda o motor inteiro dentro do map() de cada linha.
  const candidatosPorTransacao = useMemo(() => {
    const mapa = new Map();
    if (aba !== "pendentes") return mapa;
    transacoes.slice(0, limiteVisivel).forEach(tr => {
      const periodo=periodoPontoDaTransacao(tr.data);
      const candidataMaoObra=sugerirPagamentoMaoObra(tr,data,periodo.days)
        .map(item=>createExactPixLaborCandidate(tr,{...item,periodoPonto:periodo.periodoPonto,periodoConfirmavel:Boolean(tr.data&&periodo.days.length)}))
        .find(Boolean);
      const brutas=[
        ...(candidataMaoObra?[candidataMaoObra]:[]),
        ...gerarCandidatosConciliacao(tr, data, indicesFinanceiros),
      ].sort((a,b)=>Number(b.score||0)-Number(a.score||0));
      mapa.set(tr.id, brutas.filter(c => !rejeitadasSet.has(`${tr.id}:${c.tipo}:${c.entidadeId}`)));
    });
    return mapa;
  }, [aba, transacoes, limiteVisivel, data, indicesFinanceiros, rejeitadasSet]);
  const historicoConc=useMemo(()=>{
    const registrados=[...(data.historicoConc||[])];
    const comRegistro=new Set(registrados.map(item=>item.transacaoId).filter(Boolean));
    const legados=(data.transacoes||[]).filter(t=>t.status!=="pendente"&&!comRegistro.has(t.id)).map(t=>({id:`legado-${t.id}`,transacaoId:t.id,extratoId:t.extratoId||"",acao:t.status==="conciliado"?"conciliacao_legada":"ignorado_legado",statusAnterior:"",statusNovo:t.status,descricao:t.descricao,valor:t.valor,detalhes:"Registro anterior à implantação do histórico auditável.",operador:"Não registrado",criadoEm:t.statusAtualizadoEm||`${t.data||today()}T12:00:00`,legado:true}));
    const termo=semAcentoConc(buscaConc.trim());
    return [...registrados,...legados].filter(item=>!termo||semAcentoConc(`${item.descricao} ${item.acao} ${item.operador} ${item.detalhes}`).includes(termo)).sort((a,b)=>String(b.criadoEm||"").localeCompare(String(a.criadoEm||"")));
  },[data.historicoConc,data.transacoes,buscaConc]);
  useEffect(()=>{setSelecionadas([]);setLimiteVisivel(30);},[aba,buscaConc,tipoMovimento]);
  const eventoHistorico=(acao,tr,statusAnterior,statusNovo,detalhes="",extra={})=>({id:uid(),transacaoId:tr?.id||"",extratoId:tr?.extratoId||extra.extratoId||"",acao,statusAnterior,statusNovo,descricao:tr?.descricao||extra.descricao||"",valor:Number(tr?.valor||extra.valor||0),detalhes,operadorId:currentUser?.id||"",operador:currentUser?.nome||currentUser?.email||"Operador",criadoEm:new Date().toISOString(),loteId:extra.loteId||""});
  const executarComandoBancario=async commandOrFactory=>{
    if(!dispatchCommand||transacaoCommandPendingRef.current||transacaoCommandPending)return {ok:false};
    transacaoCommandPendingRef.current=true;
    setTransacaoCommandPending(true);
    try{
      const result=await dispatchCommand(commandOrFactory);
      if(!result?.ok)showToast(result?.reason||"O servidor não confirmou a alteração bancária.","error");
      return result||{ok:false};
    }catch(error){
      console.error("Falha no comando de transação bancária:",error);
      showToast(error?.message||"O servidor não confirmou a alteração bancária.","error");
      return {ok:false};
    }finally{
      transacaoCommandPendingRef.current=false;
      setTransacaoCommandPending(false);
    }
  };

  //  Motor de candidatos - Fila inteligente
  const rotuloFaixa={[FAIXA_CONFIANCA.FORTE]:"Candidata forte",[FAIXA_CONFIANCA.CONFIRMAR]:"Confirmar",[FAIXA_CONFIANCA.LISTA]:"Possível",[FAIXA_CONFIANCA.FRACA]:"Fraca"};
  const corFaixa=f=>f===FAIXA_CONFIANCA.FORTE?C.green:f===FAIXA_CONFIANCA.CONFIRMAR?C.blue:f===FAIXA_CONFIANCA.LISTA?C.orange:C.muted;

  const abrirCandidato = (tr) => {
    const analise=analisesPorTransacao.get(tr.id);
    if(analise?.classificacaoOperacional==="bloqueada"){
      showToast("A confirmação está bloqueada: corrija o cadastro duplicado antes de conciliar.","error");
      return;
    }
    const cs = candidatosPorTransacao.get(tr.id) || [];
    const c = cs[0];
    setPagamentoForm({ valor: c ? String(Math.min(Math.abs(tr.valor), deCentavos(c.saldoCentavos||0)||Math.abs(tr.valor)).toFixed(2)) : String(Math.abs(tr.valor).toFixed(2)), data: tr.data });
    setCandidatoModal({ trId: tr.id, idx: 0 });
  };
  const fecharCandidato = () => { setCandidatoModal(null); setPagamentoForm({valor:"",data:""}); };
  const trocarCandidato = (delta) => setCandidatoModal(m => {
    if (!m) return m;
    const cs = candidatosPorTransacao.get(m.trId) || [];
    if (!cs.length) return m;
    const idx = (m.idx + delta + cs.length) % cs.length;
    const c = cs[idx], tr = (data.transacoes||[]).find(t=>t.id===m.trId);
    setPagamentoForm({ valor: tr ? String(Math.min(Math.abs(tr.valor), deCentavos(c.saldoCentavos||0)||Math.abs(tr.valor)).toFixed(2)) : "", data: tr?.data||"" });
    return { ...m, idx };
  });

  const executarConciliacaoNoServidor = async (command, erroPadrao) => {
    if(conciliando)return false;
    setConciliando(true);
    try {
      const sincronizado=await update({__aguardarFila:true});
      if(!sincronizado?.ok){showToast("Conclua o salvamento pendente antes de conciliar.","error");return false;}
      // A mesma chave acompanha todas as retentativas. Se a primeira chamada
      // tiver sido efetivada e apenas a resposta se perder, o servidor devolve
      // o resultado já salvo em vez de criar uma segunda liquidação.
      const commandWithKey={...command,idempotencyKey:`rec_${Date.now()}_${Math.random().toString(36).slice(2,12)}`};
      let resposta=null;
      for(let attempt=0;attempt<3;attempt+=1){
        resposta=await executarComandoConciliacao(commandWithKey);
        if(resposta?.ok||![429,503].includes(Number(resposta?.status||0)))break;
        await new Promise(resolve=>window.setTimeout(resolve,500*(attempt+1)));
      }
      if(!resposta?.ok){showToast(resposta?.error||erroPadrao,"error");return false;}
      if(resposta.sections){
        await update({__adotarServidorPatch:true,sections:resposta.sections,updatedAt:resposta.updatedAt});
      }else{
        await update({__adotarServidor:true,data:resposta.data,updatedAt:resposta.updatedAt});
      }
      return true;
    } catch(error) {
      console.error("Falha ao confirmar conciliação:",error);
      showToast(error?.message||erroPadrao||"Não foi possível confirmar a conciliação.","error");
      return false;
    } finally { setConciliando(false); }
  };

  const executarVincular = async (tr, c) => {
    const ok=await executarConciliacaoNoServidor({type:"LINK_EXISTING_PAYMENT",payload:{transactionId:tr.id,targetType:c.tipo,targetId:c.entidadeId,paymentId:c.pagamentoId||""}},"O servidor não confirmou o vínculo.");
    if(!ok)return;
    fecharCandidato();
    showToast("Vínculo confirmado e transação conciliada.");
  };
  const executarRegistrarPagamento = async (tr, c) => {
    const valor = Number(String(pagamentoForm.valor||"").replace(",", "."));
    if (!(valor > 0)) { showToast("Informe o valor pago.", "error"); return; }
    if(Math.abs(valor-Math.abs(Number(tr.valor||0)))>0.01){showToast("Para baixa parcial, use o rateio N:N. A confirmação simples usa todo o valor do extrato.","warn");return;}
    const ok=await executarConciliacaoNoServidor({type:"CONFIRM_PAYMENT",payload:{transactionId:tr.id,targetType:c.tipo,targetId:c.entidadeId,observacao:`Sugestão ${c.confianca||""}`}},"O servidor não confirmou o pagamento.");
    if(!ok)return;
    fecharCandidato();
    showToast("Pagamento registrado e conciliado.");
  };
  const abrirValidarEntrada = (tr) => {
    setEntradaForm({
      // Nenhuma parcela é escolhida por ordem de criação. O operador aponta
      // a obra e, só então, enxerga as parcelas daquela obra.
      tipo:"medicao", contratoId:"", medicaoId:"", obraId:"", categoria:"aporte_cliente", descricao:tr.descricao||"",
      novaParcela:false,novaParcelaDescricao:"",novaParcelaCompetencia:(tr.data||today()).slice(0,7),novaParcelaValor:String(Math.abs(Number(tr.valor||0))),
    });
    setEntradaModal({trId:tr.id});
  };
  const cadastrarParcelaDaEntrada = async() => {
    if(!dispatchCommand||conciliando)return;
    const tr=(data.transacoes||[]).find(t=>t.id===entradaModal?.trId);
    if(!entradaForm.obraId){showToast("Selecione primeiro a obra que recebeu o valor.","error");return;}
    const descricao=String(entradaForm.novaParcelaDescricao||"").trim();
    const valor=Number(String(entradaForm.novaParcelaValor||"").replace(",","."));
    if(!descricao||!(valor>0)){showToast("Informe identificação e valor previsto da parcela.","error");return;}
    const medicao={id:uid(),obraId:entradaForm.obraId,descricao,competencia:entradaForm.novaParcelaCompetencia||String(tr?.data||today()).slice(0,7),valorPrevisto:valor,valorRecebido:0,recebido:false,origem:"conciliacao_bancaria",criadoEm:new Date().toISOString(),criadoPorId:currentUser?.id||"",criadoPor:currentUser?.nome||currentUser?.email||"Operador"};
    setConciliando(true);
    try{
      const result=await dispatchCommand(()=>({
        type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_SAVED,
        idempotencyKey:`reconciliation-measurement-create-${medicao.id}-${uid()}`,
        expectedVersion:0,actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{measurement:medicao},
      }));
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou a parcela.");
      setEntradaForm(f=>({...f,medicaoId:medicao.id,novaParcela:false,novaParcelaDescricao:""}));
      showToast("Parcela cadastrada. Confira-a e confirme a entrada bancária.");
    }catch(error){
      showToast(error.message||"Não foi possível cadastrar a parcela.","error");
    }finally{
      setConciliando(false);
    }
  };
  const confirmarEntrada = async () => {
    const tr = (data.transacoes||[]).find(t=>t.id===entradaModal?.trId);
    if (!tr || Number(tr.valor) <= 0) { showToast("Selecione uma entrada bancária válida.", "error"); return; }
    const tipo = entradaForm.tipo;
    let command;
    if (tipo === "entradaContrato" || tipo === "medicao") {
      const entidadeId = tipo === "entradaContrato" ? entradaForm.contratoId : entradaForm.medicaoId;
      if (!entidadeId) { showToast(tipo === "entradaContrato" ? "Selecione o contrato." : "Selecione a parcela ou medição.", "error"); return; }
      command={type:"CONFIRM_RECEIPT",payload:{transactionId:tr.id,targetType:tipo,targetId:entidadeId,observacao:entradaForm.descricao}};
    } else {
      command={type:"CONFIRM_MANUAL_ENTRY",payload:{transactionId:tr.id,entryType:tipo,obraId:entradaForm.obraId,categoria:entradaForm.categoria,descricao:entradaForm.descricao}};
    }
    const ok=await executarConciliacaoNoServidor(command,"O servidor não confirmou a entrada. Nenhuma alteração foi salva.");
    if(!ok)return;
    setEntradaModal(null);
    showToast(tipo === "entradaContrato" ? "Entrada do contrato validada e vinculada ao extrato." : tipo === "medicao" ? "Recebimento da parcela validado e conciliado." : tipo === "recebimento_administracao" ? "Recebimento manual da obra por administração conciliado." : "Entrada registrada no caixa, sem criar receita no DRE.");
  };
  const rejeitarCandidato = (tr, c) => {
    update({...data, rejeicoesConc:[...(data.rejeicoesConc||[]), {
      id: uid(), transacaoId: tr.id, candidatoTipo: c.tipo, candidatoId: c.entidadeId,
      motivo: "Não corresponde", operadorId: currentUser?.id||"", operador: currentUser?.nome||currentUser?.email||"Operador",
      criadoEm: new Date().toISOString(),
    }]});
    showToast("Candidata descartada para esta transação.");
  };

  // Transferência interna: escolhe a outra ponta entre as transações pendentes
  // de sinal oposto - não decide sozinho, só reduz a lista a candidatas plausíveis.
  const candidatasTransferencia = (tr) => (data.transacoes||[])
    .filter(t => t.id!==tr.id && t.status==="pendente" && Math.sign(Number(t.valor))!==Math.sign(Number(tr.valor)) && igualCentavos(Math.abs(t.valor),Math.abs(tr.valor),50))
    .sort((a,b)=>diasEntre(a.data,tr.data)-diasEntre(b.data,tr.data));
  const confirmarTransferencia = async (tr, destino) => {
    const origemId=Number(tr.valor)<0?tr.id:destino.id, destinoId=Number(tr.valor)<0?destino.id:tr.id;
    const ok=await executarConciliacaoNoServidor({type:"CONFIRM_TRANSFER",payload:{transactionId:origemId,counterpartyTransactionId:destinoId}},"O servidor não confirmou a transferência.");
    if(!ok)return;
    setTransferModal(null);
    showToast("Transferência interna registrada - sem efeito no DRE.");
  };

  // Estorno: procura o movimento original de sinal oposto entre os já conciliados
  const candidatasEstorno = (tr) => (data.transacoes||[])
    .filter(t => t.id!==tr.id && Math.sign(Number(t.valor))!==Math.sign(Number(tr.valor)) && igualCentavos(Math.abs(t.valor),Math.abs(tr.valor),50))
    .sort((a,b)=>diasEntre(a.data,tr.data)-diasEntre(b.data,tr.data));
  const confirmarEstorno = async (tr, origem) => {
    const ok=await executarConciliacaoNoServidor({type:"CONFIRM_REVERSAL",payload:{transactionId:tr.id,originalTransactionId:origem?.id||""}},"O servidor não confirmou o estorno.");
    if(!ok)return;
    setEstornoModal(null);
    showToast("Estorno vinculado ao movimento original.");
  };

  //  Cadastro de contas bancárias
  const salvarContaBancaria = (form) => {
    if (!String(form.nome||"").trim()) { showToast("Informe um nome para a conta.", "error"); return; }
    const existe = form.id && (data.contasBancarias||[]).some(c=>c.id===form.id);
    const contasBancarias = existe
      ? (data.contasBancarias||[]).map(c=>c.id===form.id?{...c,...form,atualizadoEm:new Date().toISOString()}:c)
      : [...(data.contasBancarias||[]), {...form, id:uid(), criadoEm:new Date().toISOString()}];
    update({...data, contasBancarias});
    setContaBancariaModal(null);
    showToast(existe ? "Conta bancária atualizada." : "Conta bancária cadastrada.");
  };
  const alternarAtivaContaBancaria = (c) => update({...data, contasBancarias:(data.contasBancarias||[]).map(x=>x.id===c.id?{...x,ativa:!x.ativa,atualizadoEm:new Date().toISOString()}:x)});

  //  Regras de auto-classificação
  const salvarRegra = (form) => {
    if (!String(form.padrao||"").trim()) { showToast("Informe o trecho da descrição.", "error"); return; }
    const existe = form.id && (data.regrasConc||[]).some(r=>r.id===form.id);
    const regrasConc = existe
      ? (data.regrasConc||[]).map(r=>r.id===form.id?{...r,...form,atualizadoEm:new Date().toISOString()}:r)
      : [...(data.regrasConc||[]), {...form, id:uid(), criadoPorId:currentUser?.id||"", criadoPor:currentUser?.nome||currentUser?.email||"", criadoEm:new Date().toISOString()}];
    update({...data, regrasConc});
    setRegraModal(null);
    showToast(existe ? "Regra atualizada." : "Regra criada - continua pedindo confirmação a cada transação.");
  };
  const alternarAtivaRegra = (r) => update({...data, regrasConc:(data.regrasConc||[]).map(x=>x.id===r.id?{...x,ativa:!x.ativa,atualizadoEm:new Date().toISOString()}:x)});
  const excluirRegra = (r) => { if(!window.confirm(`Excluir a regra "${r.nome||r.padrao}"?`))return; update({...data, regrasConc:(data.regrasConc||[]).filter(x=>x.id!==r.id)}); showToast("Regra excluída."); };

  //  Fechamento bancário
  const abrirFechamento = (contaId) => {
    const hoje = today();
    const ultimo = (data.fechamentosBancarios||[]).filter(f=>f.contaBancariaId===contaId && f.status==="fechado").sort((a,b)=>String(b.dataFim||"").localeCompare(String(a.dataFim||"")))[0];
    const conta = (data.contasBancarias||[]).find(c=>c.id===contaId);
    const dataInicio = ultimo ? ultimo.dataFim : (conta?.criadoEm||"").slice(0,10)||hoje;
    setFecharModal({ contaBancariaId: contaId, dataInicio, dataFim: hoje, saldoBanco: "" });
  };
  const resumoFechamento = (f) => {
    if (!f) return null;
    const trans = (data.transacoes||[]).filter(t => t.contaBancariaId===f.contaBancariaId && t.data>=f.dataInicio && t.data<=f.dataFim);
    const ultimo = (data.fechamentosBancarios||[]).filter(x=>x.contaBancariaId===f.contaBancariaId && x.status==="fechado").sort((a,b)=>String(b.dataFim||"").localeCompare(String(a.dataFim||"")))[0];
    const conta = (data.contasBancarias||[]).find(c=>c.id===f.contaBancariaId);
    const saldoInicialCentavos = paraCentavos(ultimo ? deCentavos(ultimo.saldoCalculadoCentavos) : (conta?.saldoInicial||0));
    const creditosCentavos = trans.filter(t=>t.valor>0).reduce((s,t)=>s+paraCentavos(t.valor),0);
    const debitosCentavos = trans.filter(t=>t.valor<0).reduce((s,t)=>s+paraCentavos(Math.abs(t.valor)),0);
    const saldoCalculadoCentavos = saldoInicialCentavos + creditosCentavos - debitosCentavos;
    const saldoBancoCentavos = f.saldoBanco ? paraCentavos(Number(String(f.saldoBanco).replace(",","."))) : null;
    const pendentes = trans.filter(t=>t.status==="pendente");
    return { trans, saldoInicialCentavos, creditosCentavos, debitosCentavos, saldoCalculadoCentavos, saldoBancoCentavos, pendentes };
  };
  const confirmarFechamento = () => {
    if (!fecharModal) return;
    if (!podeFecharPeriodo(currentUser?.role)) { showToast("Sem permissão para fechar o período.", "error"); return; }
    const r = resumoFechamento(fecharModal);
    const diferencaCentavos = r.saldoBancoCentavos!=null ? r.saldoBancoCentavos - r.saldoCalculadoCentavos : 0;
    if (r.pendentes.length && !window.confirm(`Ainda há ${r.pendentes.length} transação(ões) pendente(s) no período. Fechar mesmo assim?`)) return;
    const fechamento = {
      id: uid(), contaBancariaId: fecharModal.contaBancariaId, dataInicio: fecharModal.dataInicio, dataFim: fecharModal.dataFim,
      saldoInicialCentavos: r.saldoInicialCentavos, creditosCentavos: r.creditosCentavos, debitosCentavos: r.debitosCentavos,
      saldoCalculadoCentavos: r.saldoCalculadoCentavos, saldoBancoCentavos: r.saldoBancoCentavos, diferencaCentavos,
      pendencias: r.pendentes.map(t=>t.id), status: "fechado",
      fechadoPorId: currentUser?.id||"", fechadoPor: currentUser?.nome||currentUser?.email||"", fechadoEm: new Date().toISOString(),
    };
    update({...data, fechamentosBancarios:[...(data.fechamentosBancarios||[]), fechamento]});
    setFecharModal(null);
    showToast("Período fechado.");
  };
  const reabrirFechamento = (f) => {
    if (!podeReabrirFechamento(currentUser?.role)) { showToast("Somente administrador pode reabrir um fechamento.", "error"); return; }
    const motivo = window.prompt("Motivo da reabertura:");
    if (!motivo) return;
    update({...data, fechamentosBancarios:(data.fechamentosBancarios||[]).map(x=>x.id===f.id?{...x,status:"reaberto",reabertoPorId:currentUser?.id||"",reabertoPor:currentUser?.nome||currentUser?.email||"",reabertoEm:new Date().toISOString(),motivoReabertura:motivo}:x)});
    showToast("Fechamento reaberto.");
  };

  //  Importar extrato
  const importar = async (file) => {
    if (!file) return;
    setImportando(true);
    try {
      const nome = file.name.toLowerCase();
      let banco = "", conta = "", brutas = [], hash = "";

      if (nome.endsWith(".ofx") || nome.endsWith(".qfx")) {
        const txt = await file.text();
        const r = parseOFX(txt);
        banco = r.banco; conta = r.conta; brutas = r.trans;
        hash = hashArquivo(txt);
      } else {
        // CSV / XLSX: detecta as colunas de data, descrição e valor
        await carregarXLSX();
        const buf = await file.arrayBuffer();
        const wb  = await XLSX.read(buf, { type:"array", cellDates:false });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:"", raw:false });

        let hIdx = -1, cData = -1, cDesc = -1, cVal = -1, cCred = -1, cDeb = -1;
        for (let r = 0; r < Math.min(15, rows.length); r++) {
          const linha = (rows[r]||[]).map(c => String(c??"").toUpperCase());
          const iData = linha.findIndex(h => h.includes("DATA") || h.includes("DT"));
          const iDesc = linha.findIndex(h => h.includes("HISTÓRICO") || h.includes("HISTORICO") ||
                                             h.includes("DESCRI") || h.includes("LANÇAMENTO") || h.includes("MEMO"));
          const iVal  = linha.findIndex(h => h.includes("VALOR") || h.includes("MONTANTE"));
          const iCred = linha.findIndex(h => h.includes("CRÉDITO") || h.includes("CREDITO") || h.includes("ENTRADA"));
          const iDeb  = linha.findIndex(h => h.includes("DÉBITO") || h.includes("DEBITO") || h.includes("SAÍDA") || h.includes("SAIDA"));
          if (iData >= 0 && iDesc >= 0 && (iVal >= 0 || iCred >= 0 || iDeb >= 0)) {
            hIdx = r; cData = iData; cDesc = iDesc; cVal = iVal; cCred = iCred; cDeb = iDeb;
            break;
          }
        }
        if (hIdx < 0) { showToast("Não reconheci as colunas. Use o OFX do seu banco.", "error"); setImportando(false); return; }

        const pData = (v) => {
          const s = String(v??"").trim();
          let m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);        // dd/mm/aaaa
          if (m) return `${m[3]}-${m[2]}-${m[1]}`;
          m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);                       // aaaa-mm-dd
          if (m) return `${m[1]}-${m[2]}-${m[3]}`;
          return "";
        };

        brutas = rows.slice(hIdx+1).map(r => {
          const dt = pData(r[cData]);
          const ds = String(r[cDesc] ?? "").trim();
          let v = 0;
          if (cVal >= 0)       v = parseBRConc(r[cVal]);
          else {
            const cr = cCred >= 0 ? parseBRConc(r[cCred]) : 0;
            const db = cDeb  >= 0 ? parseBRConc(r[cDeb])  : 0;
            v = cr - Math.abs(db);
          }
          return { data: dt, descricao: ds, valor: v, fitid: "" };
        }).filter(t => t.data && t.descricao && t.valor !== 0 && !isNaN(t.valor));
        banco = file.name;
        hash = hashArquivo(`${file.name}|${file.size}|${file.lastModified}`);
      }

      if (!brutas.length) { showToast("Nenhuma transação encontrada no arquivo.", "error"); return; }
      if(brutas.length>5000){showToast("O arquivo excede 5.000 movimentos. Divida o período bancário e importe novamente.","error");return;}

      // O navegador apenas interpreta o arquivo. A deduplicação definitiva
      // acontece no servidor contra a versão autoritativa e também dentro do
      // próprio lote, evitando decisões baseadas em uma tela desatualizada.
      const movimentos = brutas.map(t => {
        const chave = chaveTransacao(t);
        return {
          id: uid(), extratoId: "", contaBancariaId: contaBancariaImport, data: t.data, descricao: t.descricao,
          descricaoOriginal:t.descricaoOriginal||t.descricao, valor: t.valor, chave, fitid:t.fitid||"",
          endToEndId:t.endToEndId||"", txid:t.txid||"", tipoOperacao:t.tipoOperacao||"",
          direcao:t.valor>0?"entrada":"saida", contraparteNome:t.contraparteNome||"", contraparteDocumento:t.contraparteDocumento||"",
          chavePix:t.chavePix||"", metadadosImportacao:t.metadadosImportacao||{arquivo:file.name},
          status: "pendente", rateios: [], gerados: [], obs: "",
        };
      });
      const datas = movimentos.map(t=>t.data).sort();
      const extrato = {
        id: uid(), contaBancariaId: contaBancariaImport, banco, conta, arquivo: file.name, hashArquivo: hash,
        dataInicio: datas[0], dataFim: datas[datas.length-1],
        importadoEm: new Date().toISOString(), importadoPorId: currentUser?.id||"", importadoPor: currentUser?.nome||currentUser?.email||"",
        qtd: movimentos.length, qtdDuplicadas: 0, status: "ativo",
      };
      movimentos.forEach(t => { t.extratoId = extrato.id; });

      const result=await executarComandoBancario(()=>({
        type:OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IMPORTED,
        idempotencyKey:`bank-import-${extrato.id}-${uid()}`,
        payload:{
          statement:extrato,transactions:movimentos,
        },
      }));
      if(!result?.ok)return;
      const imported=Number(result.summary?.imported??movimentos.length);
      const duplicates=Number(result.summary?.duplicates??0);
      showToast(
        duplicates
          ? `${imported} novas importadas · ${duplicates} já existiam (ignoradas).`
          : `${imported} transações importadas.`
      );
    } catch (e) {
      showToast("Erro ao ler o extrato. Confirme o formato (.ofx, .csv ou .xlsx).", "error");
    } finally {
      setImportando(false);
    }
  };

  //  Apropriar 
  const abrirApropriacao = (tr) => {
    const analise=analisesPorTransacao.get(tr.id);
    if(analise?.classificacaoOperacional==="bloqueada"){
      showToast("A confirmação está bloqueada enquanto houver conflito de identidade.","error");
      return;
    }
    const sug = sugerirRateio(tr, data.regrasConc, data.aprendizadoConc);
    setRateios(
      (tr.rateios && tr.rateios.length)
        ? tr.rateios.map(r => ({...r, valor: String(r.valor)}))
        : [{
            destino:   sug?.destino   || (tr.valor > 0 ? "obra" : "empresa"),
            obraId:    sug?.obraId    || "",
            categoria: sug?.categoria || (tr.valor > 0 ? "receita" : "outros"),
            valor:     String(Math.abs(tr.valor).toFixed(2)),
          }]
    );
    setPadraoRegra("");
    setCriarRegra(false);
    setMedAlvo(null);          // nada pré-selecionado: quem casa é o usuário
    const operarioRegistrado=(data.employees||[]).find(emp=>emp.id===tr.recebedorMaoObra?.employeeId);
    // Uma seleção pendente herdada só é reaproveitada se a descrição também
    // trouxer nome/titular PIX; chave numérica isolada não pré-seleciona.
    setRecebedorMaoObraId(operarioRegistrado&&hasEmployeePixNameEvidence(tr,operarioRegistrado)?operarioRegistrado.id:"");
    setDetalhesPix(false);
    setPixAutoPreparadoId("");
    setApropModal(tr);
  };

  // Candidatas a serem quitadas por esta entrada
  const candidatas = useMemo(
    () => apropModal ? sugerirMedicoes(apropModal, data) : [],
    [apropModal, data.medicoes, data.obras]
  );

  // Sugestao de mao de obra: para DEBITOS, de qual operario e este pagamento.
  // O periodo de referencia e a quinzena da data da transacao.
  const sugMaoObra = useMemo(() => {
    if (!apropModal || Number(apropModal.valor || 0) >= 0) return [];
    const {days,periodoPonto}=periodoPontoDaTransacao(apropModal.data);
    return sugerirPagamentoMaoObra(apropModal, data, days).map(item=>({
      ...item,
      periodoPonto,
      periodoConfirmavel:Boolean(apropModal.data&&days.length),
    }));
  }, [apropModal, data.employees, data.attendance]);
  const recebedoresMaoObra = useMemo(() => {
    if (!apropModal || Number(apropModal.valor || 0) >= 0) return [];
    const porId=new Map(sugMaoObra.map(item=>[item.emp.id,item]));
    (data.employees||[]).filter(emp=>emp.active!==false).forEach(emp=>{
      if(!porId.has(emp.id)){
        const pago=Math.abs(Number(apropModal.valor||0));
        porId.set(emp.id,{emp,esperado:0,pago,diasTrabalhados:0,divergencia:pago,motivos:["sem cruzamento de nome/titular no ponto"],pagoATerceiro:false});
      }
    });
    return [...porId.values()].sort((a,b)=>a.emp.name.localeCompare(b.emp.name));
  },[apropModal,sugMaoObra,data.employees]);
  const recebedorSelecionado=recebedoresMaoObra.find(item=>item.emp.id===recebedorMaoObraId)||null;
  const correspondenciaPixExata=useMemo(()=>{
    if(!apropModal||Number(apropModal.valor||0)>=0)return null;
    return sugMaoObra.find(item=>isExactPixLaborMatch(apropModal,item))||null;
  },[apropModal,sugMaoObra]);
  useEffect(()=>{
    if(!apropModal||apropModal.recebedorMaoObra?.employeeId||!correspondenciaPixExata||pixAutoPreparadoId===apropModal.id)return;
    const sugestao=correspondenciaPixExata;
    setRecebedorMaoObraId(sugestao.emp.id);
    setRateios([{destino:"obra",obraId:sugestao.emp.obra,categoria:"mao_obra",valor:String(Math.abs(Number(apropModal.valor||0)).toFixed(2))}]);
    setPixAutoPreparadoId(apropModal.id);
  },[apropModal,correspondenciaPixExata,pixAutoPreparadoId]);

  // Ao escolher uma medição, o rateio já vai pronto para a obra dela
  const escolherMedicao = (c) => {
    if (medAlvo?.m.id === c.m.id) { setMedAlvo(null); return; }   // desmarca
    setMedAlvo(c);
    setRateios([{
      destino: "obra",
      obraId: c.m.obraId,
      categoria: "receita",
      valor: String(Math.abs(Number(apropModal.valor)).toFixed(2)),
    }]);
  };

  const addRateio = () => setRateios(rs => [...rs, {
    destino:"obra", obraId:"", categoria:"material", valor:"",
  }]);
  const updRateio = (i, campo, v) =>
    setRateios(rs => rs.map((r,k) => k===i ? {...r, [campo]: v} : r));
  const delRateio = (i) => setRateios(rs => rs.filter((_,k) => k!==i));

  const totalRateado = somaRateios(rateios.map(r => ({...r, valor: Number(r.valor||0)})));
  const alvo = apropModal ? Math.abs(Number(apropModal.valor)) : 0;
  const diferenca = alvo - totalRateado;
  const temDivergenciaRecebedor=Math.abs(Number(recebedorSelecionado?.divergencia||0))>=.01;
  const rateioMaoObraPreparado=!!(recebedorSelecionado?.emp?.obra&&rateios.length===1&&rateios[0]?.destino==="obra"&&rateios[0]?.obraId===recebedorSelecionado.emp.obra&&rateios[0]?.categoria==="mao_obra"&&Math.abs(Number(rateios[0]?.valor||0)-alvo)<.01);
  const rateioPixAutomatico=!!(rateioMaoObraPreparado&&correspondenciaPixExata?.emp.id===recebedorSelecionado?.emp.id);

  const prepararRateioMaoObra = (s) => {
    if(!s?.emp?.obra)return false;
    setRecebedorMaoObraId(s.emp.id);
    setRateios([{destino:"obra",obraId:s.emp.obra,categoria:"mao_obra",valor:String(alvo.toFixed(2))}]);
    return true;
  };
  const selecionarOperarioPix = (s) => {
    if(!prepararRateioMaoObra(s)){
      setRecebedorMaoObraId(s?.emp?.id||"");
      setDetalhesPix(true);
      showToast("Este operário não tem obra definida. Informe o destino antes de conciliar.","warn");
      return;
    }
    setDetalhesPix(false);
  };
  const selecionarOperarioNosDetalhes = (employeeId) => {
    setRecebedorMaoObraId(employeeId);
    const s=recebedoresMaoObra.find(item=>item.emp.id===employeeId);
    if(s?.emp?.obra)prepararRateioMaoObra(s);
  };

  const confirmarApropriacao = async () => {
    if(!apropModal)return;
    const rs=rateios.map(item=>({destination:item.destino,obraId:item.obraId,category:item.categoria,value:Number(item.valor||0)}));
    if(!rs.length||rs.some(item=>!(item.value>0))||Math.abs(diferenca)>=0.01){showToast("Confira os destinos: o rateio precisa fechar exatamente o valor do extrato.","error");return false;}
    const worker=recebedorSelecionado?{employeeId:recebedorSelecionado.emp.id,employeeName:recebedorSelecionado.emp.name,pixHolder:recebedorSelecionado.emp.pixHolder||""}:null;
    if(modoConciliacaoRh&&(!podeOperarConcTrabalhista||!worker||rs.some(item=>item.destination!=="obra"||item.category!=="mao_obra"))){
      showToast("O RH deve selecionar o funcionário e a obra para conciliar como Mão de obra.","error");
      return false;
    }
    const autoRule=criarRegra&&padraoRegra.trim()?{pattern:padraoRegra.trim()}:null;
    const ok=await executarConciliacaoNoServidor({type:"CONFIRM_ALLOCATION",payload:{transactionId:apropModal.id,allocations:rs,measurementId:medAlvo?.m?.id||"",worker,autoRule}},"O servidor não confirmou o rateio.");
    if(!ok)return false;
    const compraMaterial=Number(apropModal.valor)<0&&rs.some(item=>item.destination==="obra"&&item.category==="material");
    setApropModal(null);setRateios([]);setMedAlvo(null);setRecebedorMaoObraId("");
    showToast(compraMaterial?"Conciliação confirmada. Lembre de registrar a entrada física no estoque.":"Conciliação confirmada e refletida no DRE.");
    return true;
  };

  // Estornos também passam pelo servidor. O motivo é obrigatório para que
  // a reversão tenha evidência auditável e a projeção canônica seja refeita
  // na mesma transação do blob legado.
  const desfazer = async (tr) => {
    const motivo=window.prompt("Motivo do estorno da conciliação:","");
    if(motivo===null)return;
    if(!String(motivo).trim()){showToast("Informe o motivo do estorno.","error");return;}
    const ok=await executarConciliacaoNoServidor({type:"REVERSE_RECONCILIATION",payload:{transactionId:tr.id,reason:motivo}},"O servidor não confirmou o estorno.");
    if(ok)showToast("Conciliação desfeita e lançamentos estornados.");
  };

  const abrirIgnorar = (alvos,titulo) => {
    const ids=[...new Set((alvos||[]).map(item=>typeof item==="string"?item:item.id))];
    const itens=(data.transacoes||[]).filter(t=>ids.includes(t.id)&&t.status==="pendente");
    if(!itens.length){showToast("Nenhuma transação pendente selecionada.","warn");return;}
    setIgnorarModal({ids:itens.map(t=>t.id),titulo:titulo||"Ignorar transações",motivo:"",valor:itens.reduce((s,t)=>s+Math.abs(Number(t.valor||0)),0)});
  };
  const confirmarIgnorar = async () => {
    const motivo=String(ignorarModal?.motivo||"").trim();
    if(!motivo){showToast("Informe o motivo para manter o histórico auditável.","error");return;}
    const ids=new Set(ignorarModal.ids||[]);
    const alvos=(data.transacoes||[]).filter(t=>ids.has(t.id)&&t.status==="pendente");
    const result=await executarComandoBancario(atual=>({
      type:OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IGNORED,
      idempotencyKey:`bank-ignore-${Date.now()}-${uid()}`,
      payload:{
        reason:motivo,
        targets:(atual.transacoes||[])
          .filter(t=>ids.has(t.id))
          .map(t=>({id:t.id,expectedVersion:Number(t.version||0)})),
      },
    }));
    if(!result?.ok)return;
    setIgnorarModal(null);setSelecionadas([]);showToast(`${alvos.length} transação(ões) ignorada(s). Você pode reabri-las na aba Ignoradas.`);
  };
  const reabrir = async (alvos) => {
    const ids=new Set((alvos||[]).map(item=>typeof item==="string"?item:item.id));
    const itens=(data.transacoes||[]).filter(t=>ids.has(t.id)&&t.status==="ignorado");
    if(!itens.length)return;
    if(itens.length>1&&!window.confirm(`Reabrir ${itens.length} transações para nova classificação?`))return;
    const result=await executarComandoBancario(atual=>({
      type:OPERATIONAL_COMMAND.BANK_TRANSACTIONS_REOPENED,
      idempotencyKey:`bank-reopen-${Date.now()}-${uid()}`,
      payload:{
        targets:(atual.transacoes||[])
          .filter(t=>ids.has(t.id))
          .map(t=>({id:t.id,expectedVersion:Number(t.version||0)})),
      },
    }));
    if(!result?.ok)return;
    setSelecionadas([]);setAba("pendentes");showToast(`${itens.length} transação(ões) reaberta(s).`);
  };

  // Extrato é evidência bancária, inclusive sem conciliação. Arquivá-lo só
  // o remove da fila ativa: as transações e seus vínculos nunca são apagados.
  const arquivarExtrato = (ext) => {
    const n = (data.transacoes||[]).filter(t => t.extratoId===ext.id);
    const conc = n.filter(t => t.status==="conciliado").length;
    if (!podeArquivarExtrato(currentUser?.role)) { showToast("Somente administrador pode arquivar extratos.", "error"); return; }
    const motivo=window.prompt(`Motivo para arquivar "${ext.arquivo}".\n\n${n.length} transação(ões), incluindo ${conc} conciliada(s), serão preservadas fora da fila ativa.`, "");
    if(motivo===null)return;
    if(!String(motivo).trim()){showToast("Informe o motivo do arquivamento para manter a trilha auditável.","error");return;}
    const agora=new Date().toISOString();
    update({
      ...data,
      extratos:(data.extratos||[]).map(e=>e.id===ext.id?{...e,status:"arquivado",arquivadoEm:agora,arquivadoPorId:currentUser?.id||"",arquivadoPor:currentUser?.nome||currentUser?.email||"Operador",motivoArquivamento:String(motivo).trim()}:e),
      historicoConc:[...(data.historicoConc||[]),eventoHistorico("extrato_arquivado",null,"","arquivado",`Extrato arquivado com ${n.length} transação(ões) preservada(s): ${String(motivo).trim()}`,{extratoId:ext.id,descricao:ext.arquivo,valor:n.reduce((s,t)=>s+Math.abs(Number(t.valor||0)),0),motivo:String(motivo).trim()})],
    });
    showToast("Extrato arquivado; transações preservadas fora da fila ativa.");
  };

  const nomeObra = (id) => (data.obras.find(o=>o.id===id)?.name) || "-";
  const alternarSelecao=id=>setSelecionadas(lista=>lista.includes(id)?lista.filter(item=>item!==id):[...lista,id]);
  const alternarTodas=()=>setSelecionadas(todosSelecionados?[]:transacoes.map(t=>t.id));
  const rotuloAcao={extrato_importado:"Extrato importado",extrato_arquivado:"Extrato arquivado",conciliada:"Conciliação confirmada",conciliacao_desfeita:"Conciliação desfeita",ignorada:"Transação ignorada",ignorada_em_lote:"Ignorada em lote",reaberta:"Transação reaberta",reaberta_em_lote:"Reaberta em lote",conciliacao_legada:"Conciliação anterior",ignorado_legado:"Ignorada anteriormente"};
  const corAcao=acao=>acao==="conciliada"||acao==="extrato_importado"?C.green:acao.includes("desfeita")||acao.includes("reaberta")?C.blue:acao.includes("ignorada")?C.orange:acao.includes("excluido")?C.red:C.muted;

  return (
    <div className="anim reconciliation-workspace">
      <PageHero
        eyebrow={modoConciliacaoRh?"RH · pagamentos da equipe":"Financeiro · controle bancário"}
        title={modoConciliacaoRh?"Conciliação da folha":"Conciliação Bancária"}
        description={modoConciliacaoRh?"Confirme os PIX dos funcionários usando cadastro, ponto, obra e valor como evidências.":"Classifique, audite e reverta movimentos sem perder o histórico."}
        actions={modoConciliacaoRh?null:(importando?<span style={{fontSize:9,fontWeight:800,color:C.yellowD}}>Lendo extrato...</span>:<label className="arcd-btn" data-variant="primary" data-size="sm" style={{border:`1px solid ${C.yellowD}`,background:C.yellow,color:C.ink,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,fontWeight:700}}><input type="file" accept=".ofx,.qfx,.csv,.xlsx,.xls" onChange={e=>{const file=e.target.files?.[0];e.target.value="";importar(file);}} style={{display:"none"}}/><Ic n="download" s={12}/> Importar extrato</label>)}
      />

      <section className="reconciliation-summary" aria-label="Resumo da conciliação">
        {[
          ["Pendentes",calc.pendentes,"warning"],
          ["Conciliadas",calc.conciliadas,"success"],
          ["Ignoradas",calc.ignoradas,"neutral"],
          ["A classificar",fmt(calc.valorPendente),"primary"],
          ["Progresso",`${calc.pct.toFixed(0)}%`,"success"],
        ].map(([label,value,tone])=><div key={label} className="reconciliation-summary__item" data-tone={tone}>
          <span className="reconciliation-summary__marker" aria-hidden="true"/>
          <p>{label}</p>
          <strong>{value}</strong>
        </div>)}
      </section>

      <TabRow tabs={modoConciliacaoRh
        ?[["pendentes",`PIX a confirmar · ${calc.pendentes}`],["quinzena","Quinzena"],["conciliadas",`Confirmados · ${calc.conciliadas}`],["historico","Histórico"]]
        :[["pendentes",`Fila inteligente · ${calc.pendentes}`],["quinzena","Quinzena"],["conciliadas",`Conciliadas · ${calc.conciliadas}`],["ignoradas",`Ignoradas · ${calc.ignoradas}`],["extratos",`Extratos · ${(data.extratos||[]).length}`],["regras",`Regras · ${(data.regrasConc||[]).length}`],["fechamentos",`Fechamentos · ${(data.fechamentosBancarios||[]).length}`],["historico","Histórico"]]} active={aba} onChange={setAba}/>

      {!["extratos","regras","fechamentos"].includes(aba)&&<div className="reconciliation-toolbar">
        <label className="reconciliation-search">
          <span className="sr-only">Buscar na conciliação</span>
          <Ic n="search" s={13} color={C.muted}/>
          <input value={buscaConc} onChange={e=>setBuscaConc(e.target.value)} placeholder={aba==="historico"?"Buscar ação, operador ou transação...":"Buscar funcionário, data ou PIX..."}/>
        </label>
        {aba!=="historico"&&!modoConciliacaoRh&&<select aria-label="Tipo de movimento" value={tipoMovimento} onChange={e=>setTipoMovimento(e.target.value)}><option value="todos">Entradas e saídas</option><option value="entradas">Somente entradas</option><option value="saidas">Somente saídas</option></select>}
        {!modoConciliacaoRh&&["pendentes","ignoradas"].includes(aba)&&<button type="button" className="reconciliation-toolbar__select-all" onClick={alternarTodas}>{todosSelecionados?"Desmarcar todas":"Selecionar todas"}</button>}
        {!modoConciliacaoRh&&aba==="pendentes"&&selecionadas.length>0&&<Btn size="sm" v="ghost" onClick={()=>abrirIgnorar(selecionadas,"Ignorar selecionadas")}>Ignorar selecionadas · {selecionadas.length}</Btn>}
        {!modoConciliacaoRh&&aba==="pendentes"&&calc.pendentes>0&&<Btn size="sm" v="danger" onClick={()=>abrirIgnorar((data.transacoes||[]).filter(t=>t.status==="pendente"),"Ignorar todas as pendentes")}>Ignorar todas · {calc.pendentes}</Btn>}
        {!modoConciliacaoRh&&aba==="ignoradas"&&selecionadas.length>0&&<Btn size="sm" v="info" onClick={()=>reabrir(selecionadas)}>Reabrir selecionadas · {selecionadas.length}</Btn>}
      </div>}

      {aba==="quinzena"&&<div style={{display:"flex",flexDirection:"column",gap:9}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 12px"}}>
          <p style={{fontSize:11,fontWeight:850,color:C.text}}>Resumo auditável da quinzena · {periodoQuinzenaConc.periodoPonto}</p>
          <p style={{fontSize:9.5,color:C.muted,marginTop:3}}>Folha, liquidações e PIX conciliados; o pagamento não reconhece custo novamente.</p>
          <div style={{display:"grid",gridTemplateColumns:formGrid(4),gap:7,marginTop:10}}>{[["Previsto",fmt(resumoQuinzena.totalPrevisto),C.text],["Pago",fmt(resumoQuinzena.totalPago),C.green],["Saldo pendente",fmt(resumoQuinzena.saldoPendente),resumoQuinzena.saldoPendente?C.orange:C.green],["Operários",resumoQuinzena.totalOperarios,C.blue]].map(([label,value,color])=><div key={label} style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:7,padding:"8px 9px"}}><p style={{fontSize:8,color:C.muted,textTransform:"uppercase",fontWeight:800}}>{label}</p><p style={{fontSize:14,fontWeight:900,color,marginTop:3}}>{value}</p></div>)}</div>
        </div>
        <div className="scroll-x" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,overflow:"hidden"}}>
          <table style={{width:"100%",minWidth:580,borderCollapse:"collapse"}}><thead><tr>{["Pessoa","Obra","Previsto","Pago","Saldo"].map(label=><th key={label} style={{padding:"7px 9px",textAlign:label==="Pessoa"||label==="Obra"?"left":"right",fontSize:8,color:C.muted,textTransform:"uppercase"}}>{label}</th>)}</tr></thead><tbody>{resumoQuinzena.porPessoa.length?resumoQuinzena.porPessoa.map(row=><tr key={row.pessoaId}><td style={{padding:"7px 9px",fontSize:9.5,fontWeight:800,borderTop:`1px solid ${C.line}`}}>{row.nome}{row.pixTitular&&<small style={{display:"block",fontSize:8,color:C.muted}}>Titular PIX: {row.pixTitular}</small>}</td><td style={{padding:"7px 9px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.line}`}}>{(data.obras||[]).find(item=>item.id===row.obraId)?.name||"Não definida"}</td><td style={{padding:"7px 9px",fontSize:9.5,textAlign:"right",borderTop:`1px solid ${C.line}`}}>{fmt(row.previsto)}</td><td style={{padding:"7px 9px",fontSize:9.5,textAlign:"right",color:C.green,borderTop:`1px solid ${C.line}`}}>{fmt(row.pago)}</td><td style={{padding:"7px 9px",fontSize:9.5,fontWeight:850,textAlign:"right",color:row.saldo?C.orange:C.green,borderTop:`1px solid ${C.line}`}}>{fmt(row.saldo)}</td></tr>):<tr><td colSpan="5" style={{padding:18,textAlign:"center",fontSize:10,color:C.muted}}>Nenhum título de folha nesta quinzena.</td></tr>}</tbody></table>
        </div>
        {(resumoQuinzena.pagamentosParciais.length||resumoQuinzena.foraCompetencia.length||resumoQuinzena.pixTitularDivergente.length)>0&&<p style={{fontSize:9.5,color:C.orange,fontWeight:800}}>Atenção: {resumoQuinzena.pagamentosParciais.length} pagamento(s) parcial(is), {resumoQuinzena.foraCompetencia.length} fora da competência e {resumoQuinzena.pixTitularDivergente.length} PIX com titular divergente.</p>}
      </div>}

      {aba==="extratos"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {/* Cadastro compacto de contas bancárias */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
              <p style={{fontSize:10.5,fontWeight:800,color:C.text}}>Contas bancárias cadastradas</p>
              {podeOperarConc&&<Btn size="sm" onClick={()=>setContaBancariaModal({nome:"",banco:"",agencia:"",conta:"",tipo:"corrente",titular:"",documentoTitular:"",pixKey:"",ativa:true,saldoInicial:0})}><Ic n="plus"/> Nova conta</Btn>}
            </div>
            {(data.contasBancarias||[]).length===0
              ? <p style={{fontSize:9.5,color:C.muted}}>Nenhuma conta cadastrada ainda. Cadastre para poder identificar transferências entre contas e fechar o período.</p>
              : <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {(data.contasBancarias||[]).map(c=>(
                    <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 9px"}}>
                      <div>
                        <p style={{fontSize:10,fontWeight:750,color:C.text}}>{c.nome} {!c.ativa&&<Badge color={C.muted}>Inativa</Badge>}</p>
                        <p style={{fontSize:8.8,color:C.muted,marginTop:1}}>{c.banco||"-"} · Ag {c.agencia||"-"} · Conta {c.conta||"-"} · {c.titular||"sem titular"}</p>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <Btn size="sm" v="ghost" onClick={()=>setContaBancariaModal(c)}>Editar</Btn>
                        <Btn size="sm" v="ghost" onClick={()=>alternarAtivaContaBancaria(c)}>{c.ativa?"Desativar":"Ativar"}</Btn>
                      </div>
                    </div>
                  ))}
                </div>}
          </div>

          {/* Importar novo extrato para uma conta específica */}
          {(data.contasBancarias||[]).length>0&&(
            <div style={{display:"flex",alignItems:"center",gap:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px"}}>
              <span style={{fontSize:9.5,color:C.muted,fontWeight:700}}>Importar para a conta:</span>
              <select value={contaBancariaImport} onChange={e=>setContaBancariaImport(e.target.value)} style={{height:29,border:`1px solid ${C.border}`,borderRadius:6,background:C.bg,color:C.text,padding:"0 8px",fontSize:9}}>
                <option value="">Sem conta definida</option>
                {(data.contasBancarias||[]).filter(c=>c.ativa).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}

          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:9,color:C.muted,cursor:"pointer"}}>
            <input type="checkbox" checked={mostrarArquivados} onChange={e=>setMostrarArquivados(e.target.checked)}/> Mostrar extratos arquivados
          </label>

          {(data.extratos||[]).filter(e=>mostrarArquivados||e.status!=="arquivado").length===0
            ? <div style={{padding:24,textAlign:"center",border:`1px dashed ${C.border}`,borderRadius:8,color:C.muted,fontSize:10}}>Nenhum extrato importado.</div>
            : <div className="scroll-x" style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                <table style={{width:"100%",minWidth:760,borderCollapse:"collapse",background:C.card}}>
                  <thead><tr>{["Arquivo / banco","Conta","Período","Transações","Importado em","Status",""].map(h=><th key={h} style={{padding:"6px 8px",textAlign:h==="Transações"?"right":"left",fontSize:7.8,color:C.muted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(data.extratos||[]).filter(e=>mostrarArquivados||e.status!=="arquivado").slice().sort((a,b)=>String(b.importadoEm||"").localeCompare(String(a.importadoEm||""))).map(e=>{
                      const conc=(data.transacoes||[]).filter(t=>t.extratoId===e.id&&t.status==="conciliado").length;
                      return <tr key={e.id}>
                        <td style={{padding:"7px 8px",fontSize:9.5,fontWeight:800,borderBottom:`1px solid ${C.line}`}}>{e.banco||e.arquivo}<small style={{display:"block",fontSize:7.8,color:C.muted,marginTop:1}}>{e.arquivo}</small></td>
                        <td style={{padding:"7px 8px",fontSize:9,color:C.muted,borderBottom:`1px solid ${C.line}`}}>{(data.contasBancarias||[]).find(c=>c.id===e.contaBancariaId)?.nome||e.conta||"-"}</td>
                        <td style={{padding:"7px 8px",fontSize:9,color:C.muted,borderBottom:`1px solid ${C.line}`}}>{e.dataInicio?`${fmtDate(e.dataInicio)} a ${fmtDate(e.dataFim)}`:"-"}</td>
                        <td style={{padding:"7px 8px",fontSize:10,fontWeight:800,textAlign:"right",borderBottom:`1px solid ${C.line}`}}>{e.qtd}{conc>0&&<small style={{display:"block",fontSize:7.8,color:C.green,fontWeight:700}}>{conc} conciliada(s)</small>}</td>
                        <td style={{padding:"7px 8px",fontSize:8.5,color:C.muted,borderBottom:`1px solid ${C.line}`}}>{e.importadoEm?new Date(e.importadoEm).toLocaleString("pt-BR"):"-"}</td>
                        <td style={{padding:"7px 8px",borderBottom:`1px solid ${C.line}`}}><Badge color={e.status==="arquivado"?C.muted:C.green}>{e.status==="arquivado"?"Arquivado":"Ativo"}</Badge></td>
                        <td style={{padding:"5px 7px",textAlign:"right",borderBottom:`1px solid ${C.line}`}}>{e.status!=="arquivado"&&<Btn size="sm" v="ghost" onClick={()=>arquivarExtrato(e)}>Arquivar</Btn>}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>}
        </div>
      )}

      {aba==="historico"&&(historicoConc.length===0?<div style={{padding:24,textAlign:"center",border:`1px dashed ${C.border}`,borderRadius:8,color:C.muted,fontSize:10}}>O histórico começará a registrar as próximas operações.</div>:<div className="scroll-x" style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><table style={{width:"100%",minWidth:920,borderCollapse:"collapse",background:C.card}}><thead><tr>{["Data e hora","Ação","Transação / extrato","Valor","Mudança","Operador","Detalhes"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:h==="Valor"?"right":"left",fontSize:7.8,color:C.muted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead><tbody>{historicoConc.slice(0,limiteVisivel).map(item=><tr key={item.id}><td style={{padding:"7px 8px",fontSize:8.5,color:C.muted,whiteSpace:"nowrap",borderBottom:`1px solid ${C.line}`}}>{new Date(item.criadoEm).toLocaleString("pt-BR")}</td><td style={{padding:"7px 8px",borderBottom:`1px solid ${C.line}`}}><Badge color={corAcao(item.acao)}>{rotuloAcao[item.acao]||item.acao}</Badge></td><td title={item.descricao} style={{padding:"7px 8px",fontSize:9.2,fontWeight:750,maxWidth:270,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",borderBottom:`1px solid ${C.line}`}}>{item.descricao||"-"}</td><td style={{padding:"7px 8px",fontSize:9.2,fontWeight:800,textAlign:"right",borderBottom:`1px solid ${C.line}`}}>{item.valor?fmt(Math.abs(item.valor)):"-"}</td><td style={{padding:"7px 8px",fontSize:8.5,color:C.muted,borderBottom:`1px solid ${C.line}`}}>{item.statusAnterior||"-"} → {item.statusNovo||"-"}</td><td style={{padding:"7px 8px",fontSize:8.8,fontWeight:750,borderBottom:`1px solid ${C.line}`}}>{item.operador||"Sistema"}</td><td title={item.detalhes} style={{padding:"7px 8px",fontSize:8.5,color:C.muted,maxWidth:290,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",borderBottom:`1px solid ${C.line}`}}>{item.detalhes||"-"}</td></tr>)}</tbody></table>{historicoConc.length>limiteVisivel&&<button onClick={()=>setLimiteVisivel(v=>v+50)} style={{width:"100%",border:0,borderTop:`1px solid ${C.line}`,padding:7,background:C.surface,color:C.blue,fontSize:9,fontWeight:800,cursor:"pointer"}}>Carregar mais registros</button>}</div>)}

      {aba==="regras"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <p style={{fontSize:10,color:C.muted,lineHeight:1.5,maxWidth:560}}>
              Regras viram só uma <strong>sugestão</strong> na fila - nunca conciliam sozinhas.
              Cada regra guarda quantas vezes foi aplicada, confirmada e rejeitada.
            </p>
            {podeCriarRegra(currentUser?.role)&&<Btn size="sm" onClick={()=>setRegraModal({nome:"",ativa:true,prioridade:0,padrao:"",destino:"obra",obraId:"",categoria:"outros",exigirConfirmacao:true})}><Ic n="plus"/> Nova regra</Btn>}
          </div>
          {(data.regrasConc||[]).length===0
            ? <div style={{padding:24,textAlign:"center",border:`1px dashed ${C.border}`,borderRadius:8,color:C.muted,fontSize:10}}>Nenhuma regra criada ainda.</div>
            : <div className="scroll-x" style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                <table style={{width:"100%",minWidth:760,borderCollapse:"collapse",background:C.card}}>
                  <thead><tr>{["Regra","Destino","Ativa","Aplicações","Confirmações","Rejeições",""].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontSize:7.8,color:C.muted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(data.regrasConc||[]).map(r=>
                      <tr key={r.id}>
                        <td style={{padding:"7px 8px",fontSize:9.5,fontWeight:750,borderBottom:`1px solid ${C.line}`}}>{r.nome||"Sem nome"}<small style={{display:"block",fontSize:8,color:C.muted,marginTop:1}}>contém "{r.padrao}"</small></td>
                        <td style={{padding:"7px 8px",fontSize:9,color:C.muted,borderBottom:`1px solid ${C.line}`}}>{r.destino==="obra"?nomeObra(r.obraId):"Empresa"} · {r.categoria}</td>
                        <td style={{padding:"7px 8px",borderBottom:`1px solid ${C.line}`}}><Badge color={r.ativa?C.green:C.muted}>{r.ativa?"Ativa":"Inativa"}</Badge></td>
                        <td style={{padding:"7px 8px",fontSize:9,color:C.muted,borderBottom:`1px solid ${C.line}`}}>{r.aplicacoes||0}</td>
                        <td style={{padding:"7px 8px",fontSize:9,color:C.green,borderBottom:`1px solid ${C.line}`}}>{r.confirmacoes||0}</td>
                        <td style={{padding:"7px 8px",fontSize:9,color:C.orange,borderBottom:`1px solid ${C.line}`}}>{r.rejeicoes||0}</td>
                        <td style={{padding:"5px 7px",textAlign:"right",whiteSpace:"nowrap",borderBottom:`1px solid ${C.line}`}}>
                          <Btn size="sm" v="ghost" onClick={()=>setRegraModal(r)}>Editar</Btn>{" "}
                          <Btn size="sm" v="ghost" onClick={()=>alternarAtivaRegra(r)}>{r.ativa?"Desativar":"Ativar"}</Btn>{" "}
                          {podeElevado&&<Btn size="sm" v="danger" onClick={()=>excluirRegra(r)}><Ic n="trash"/></Btn>}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>}
        </div>
      )}

      {aba==="fechamentos"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {(data.contasBancarias||[]).length===0
            ? <div style={{padding:24,textAlign:"center",border:`1px dashed ${C.border}`,borderRadius:8,color:C.muted,fontSize:10}}>Cadastre uma conta bancária na aba Extratos para poder fechar um período.</div>
            : <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {(data.contasBancarias||[]).map(c=>
                  <Btn key={c.id} size="sm" v="ghost" onClick={()=>abrirFechamento(c.id)}>Fechar período · {c.nome}</Btn>
                )}
              </div>}
          {(data.fechamentosBancarios||[]).length===0
            ? <div style={{padding:24,textAlign:"center",border:`1px dashed ${C.border}`,borderRadius:8,color:C.muted,fontSize:10}}>Nenhum fechamento registrado ainda.</div>
            : <div className="scroll-x" style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                <table style={{width:"100%",minWidth:820,borderCollapse:"collapse",background:C.card}}>
                  <thead><tr>{["Conta","Período","Saldo calculado","Saldo do banco","Diferença","Status",""].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontSize:7.8,color:C.muted,textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(data.fechamentosBancarios||[]).slice().sort((a,b)=>String(b.dataFim||"").localeCompare(String(a.dataFim||""))).map(f=>
                      <tr key={f.id}>
                        <td style={{padding:"7px 8px",fontSize:9.5,fontWeight:750,borderBottom:`1px solid ${C.line}`}}>{(data.contasBancarias||[]).find(c=>c.id===f.contaBancariaId)?.nome||"-"}</td>
                        <td style={{padding:"7px 8px",fontSize:9,color:C.muted,borderBottom:`1px solid ${C.line}`}}>{fmtDate(f.dataInicio)} a {fmtDate(f.dataFim)}</td>
                        <td style={{padding:"7px 8px",fontSize:9.5,fontWeight:700,borderBottom:`1px solid ${C.line}`}}>{fmt(deCentavos(f.saldoCalculadoCentavos))}</td>
                        <td style={{padding:"7px 8px",fontSize:9.5,borderBottom:`1px solid ${C.line}`}}>{f.saldoBancoCentavos!=null?fmt(deCentavos(f.saldoBancoCentavos)):"-"}</td>
                        <td style={{padding:"7px 8px",fontSize:9.5,fontWeight:700,color:Math.abs(f.diferencaCentavos||0)<=1?C.green:C.red,borderBottom:`1px solid ${C.line}`}}>{fmt(deCentavos(f.diferencaCentavos||0))}</td>
                        <td style={{padding:"7px 8px",borderBottom:`1px solid ${C.line}`}}><Badge color={f.status==="fechado"?C.green:C.orange}>{f.status==="fechado"?"Fechado":"Reaberto"}</Badge></td>
                        <td style={{padding:"5px 7px",textAlign:"right",borderBottom:`1px solid ${C.line}`}}>{f.status==="fechado"&&podeElevado&&<Btn size="sm" v="ghost" onClick={()=>reabrirFechamento(f)}>Reabrir</Btn>}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>}
        </div>
      )}

      {["pendentes","conciliadas","ignoradas"].includes(aba)&&(transacoes.length===0
        ? <div className="reconciliation-empty"><Ic n={aba==="pendentes"?"check":"receipt"} s={20} color={aba==="pendentes"?C.green:C.muted}/><p>{aba==="pendentes"?"Fila totalmente classificada":"Nenhuma transação neste filtro"}</p><span>{aba==="pendentes"?"Todos os movimentos importados receberam uma decisão.":"Ajuste a busca ou selecione outro período."}</span></div>
        : <div className="scroll-x reconciliation-queue">
            <table className="reconciliation-table">
              <thead><tr>
                <th className="reconciliation-table__select">{!modoConciliacaoRh&&["pendentes","ignoradas"].includes(aba)&&<input aria-label="Selecionar todas as transações" type="checkbox" checked={todosSelecionados} onChange={alternarTodas}/>}</th>
                {["Data","Movimento",...(aba==="pendentes"?["Melhor candidato"]:["Classificação"]),"Valor","Ações"].map(h=><th key={h} className={h==="Valor"||h==="Ações"?"is-right":""}>{h}</th>)}
              </tr></thead>
              <tbody>{transacoesVisiveis.map(tr=>{
                const entrada=Number(tr.valor)>0,sug=tr.status==="pendente"?sugerirRateio(tr,data.regrasConc,data.aprendizadoConc):null;
                const candidatas=aba==="pendentes"?(candidatosPorTransacao.get(tr.id)||[]):[];
                const melhor=candidatas[0];
                const analise=analisesPorTransacao.get(tr.id);
                const melhorEhPixMaoDeObra=melhor?.tipo==="maoObraPonto";
                const pixFuncionario=findRegisteredEmployeePix(tr,data.employees);
                const corMovimento=entrada?C.green:pixFuncionario?C.yellow:C.red;
                const acoesAbertas=acoesTransacaoAberta===tr.id;
                const abrirAcaoPrincipal=()=>{
                  if(modoConciliacaoRh){melhor&&melhor.tipo==="tituloFolha"?abrirCandidato(tr):abrirApropriacao(tr);return;}
                  if(pixFuncionario&&!entrada){abrirApropriacao(tr);return;}
                  if(melhor){melhorEhPixMaoDeObra?abrirApropriacao(tr):abrirCandidato(tr);return;}
                  entrada?abrirValidarEntrada(tr):abrirApropriacao(tr);
                };
                const rotuloPrincipal=modoConciliacaoRh?"Confirmar funcionário":pixFuncionario&&!entrada?"Confirmar PIX":melhorEhPixMaoDeObra?"Confirmar PIX":melhor?"Revisar sugestão":entrada?"Validar entrada":"Classificar saída";
                return <tr key={tr.id} className="reconciliation-row" data-selected={selecionadas.includes(tr.id)} data-pix={Boolean(pixFuncionario)} data-direction={entrada?"in":"out"}>
                  <td className="reconciliation-cell reconciliation-cell--select">{!modoConciliacaoRh&&["pendentes","ignoradas"].includes(aba)&&<input aria-label={`Selecionar ${tr.descricao}`} type="checkbox" checked={selecionadas.includes(tr.id)} onChange={()=>alternarSelecao(tr.id)}/>}</td>
                  <td className="reconciliation-cell reconciliation-cell--date">{fmtDate(tr.data)}</td>
                  <td className="reconciliation-cell reconciliation-cell--movement" title={tr.descricao}>
                    <div className="reconciliation-movement__title"><span className="reconciliation-movement__marker" style={{background:corMovimento}} aria-hidden="true"/><p>{tr.descricao}</p></div>
                    <p className="reconciliation-movement__source">{entrada?"Entrada":"Saída"}{tr.extratoId?` · ${data.extratos?.find(e=>e.id===tr.extratoId)?.arquivo||"Extrato"}`:""}</p>
                    {pixFuncionario&&<p className="reconciliation-pix-evidence"><Ic n="check" s={10}/> PIX cadastrado · possível pagamento para {pixFuncionario.employee.name||pixFuncionario.employee.nome}</p>}
                  </td>
                  {aba==="pendentes"
                    ? <td className="reconciliation-cell reconciliation-cell--candidate">
                        {melhor
                          ? <div className="reconciliation-candidate">
                              <p className="reconciliation-candidate__title">{melhor.titulo}</p>
                              <div className="reconciliation-candidate__meta">
                                <Badge color={corFaixa(melhor.confianca)}>{melhor.score} pts</Badge>
                                {analise&&<Badge color={analise.classificacaoOperacional==="bloqueada"?C.red:analise.classificacaoOperacional==="pronta"?C.green:analise.classificacaoOperacional==="revisar"?C.blue:C.orange}>{analise.classificacaoOperacional.replace("_"," ")}</Badge>}
                                {melhor.alertas.length>0&&<span title={melhor.alertas.join("; ")} className="reconciliation-candidate__alert">! {melhor.alertas.length}</span>}
                                {candidatas.length>1&&<span className="reconciliation-candidate__more">+{candidatas.length-1}</span>}
                              </div>
                              {analise?.melhorCandidata?.bloqueios?.length>0&&<p title={analise.melhorCandidata.bloqueios.join("; ")} className="reconciliation-candidate__blocked">Bloqueada · corrigir cadastro</p>}
                            </div>
                          : sug
                            ? <span className="reconciliation-candidate__rule">{sug.origem==="aprendizado"?`Sugestão aprendida (${sug.confirmacoes} confirmações)`:"Sugestão de regra"}: {sug.destino==="obra"?nomeObra(sug.obraId):"Empresa"} · {sug.categoria}</span>
                            : pixFuncionario
                              ? <span className="reconciliation-candidate__pix">Nome ou chave PIX reconhecida · confirme o recebedor</span>
                              : <span className="reconciliation-candidate__empty">Sem candidata · confirme a classificação</span>}
                      </td>
                    : <td className="reconciliation-cell reconciliation-cell--classification">
                        {tr.status==="conciliado"
                          ? ((tr.rateios||[]).length
                              ? <details><summary style={{cursor:"pointer",fontWeight:800,color:C.green}}>{tr.rateios.length} rateio(s)</summary>{tr.rateios.map((r,i)=><p key={i} style={{marginTop:3}}>{r.destino==="obra"?nomeObra(r.obraId):"Empresa"} · {r.categoria} · {fmt(r.valor)}</p>)}</details>
                              : (tr.vinculo?`Vinculada · ${tr.vinculo.tipo}`:"Conciliada"))
                          : <span title={tr.ignoradoMotivo} style={{color:C.orange}}>{tr.ignoradoMotivo||"Sem motivo registrado"}</span>}
                      </td>}
                  <td className="reconciliation-cell reconciliation-cell--value">{entrada?"+ ":""}{fmt(Math.abs(tr.valor))}</td>
                  <td className="reconciliation-cell reconciliation-cell--actions">
                    {tr.status==="pendente"&&<>
                      <div className="reconciliation-actions__primary">
                        <Btn size="sm" v={entrada&&!melhor?"success":"primary"} onClick={abrirAcaoPrincipal}><Ic n="check"/> {rotuloPrincipal}</Btn>
                        {!modoConciliacaoRh&&<button type="button" className="reconciliation-actions__toggle" aria-expanded={acoesAbertas} aria-label={`${acoesAbertas?"Ocultar":"Mostrar"} outras ações de ${tr.descricao}`} onClick={()=>setAcoesTransacaoAberta(atual=>atual===tr.id?"":tr.id)}>•••</button>}
                      </div>
                      {acoesAbertas&&!modoConciliacaoRh&&<div className="reconciliation-actions__secondary">
                        {entrada&&melhor&&<Btn size="sm" v="ghost" onClick={()=>abrirValidarEntrada(tr)}>Validar como outra entrada</Btn>}
                        <Btn size="sm" v="ghost" onClick={()=>abrirApropriacao(tr)}>Rateio manual</Btn>
                        <Btn size="sm" v="ghost" onClick={()=>setTransferModal({trId:tr.id})}>Transferência</Btn>
                        <Btn size="sm" v="ghost" onClick={()=>setEstornoModal({trId:tr.id})}>Estorno</Btn>
                        <Btn size="sm" v="ghost" onClick={()=>abrirIgnorar([tr],"Ignorar transação")}>Ignorar</Btn>
                      </div>}
                    </>}
                    {tr.status==="conciliado"&&!modoConciliacaoRh&&<Btn size="sm" v="ghost" onClick={()=>desfazer(tr)}>Desfazer</Btn>}
                    {tr.status==="ignorado"&&!modoConciliacaoRh&&<><Btn size="sm" onClick={()=>abrirApropriacao(tr)}>Reclassificar</Btn> <Btn size="sm" v="ghost" onClick={()=>reabrir([tr])}>Reabrir</Btn></>}
                  </td>
                </tr>;
              })}</tbody>
            </table>
            {transacoes.length>limiteVisivel&&<button className="reconciliation-load-more" onClick={()=>setLimiteVisivel(v=>v+50)}>Mostrar mais · {transacoes.length-limiteVisivel} restante(s)</button>}
          </div>)}

      {ignorarModal&&<Modal title={ignorarModal.titulo} onClose={()=>setIgnorarModal(null)}><div style={{display:"flex",flexDirection:"column",gap:10}}><div style={{padding:"9px 10px",border:`1px solid ${C.orange}55`,background:`${C.orange}0B`,borderRadius:8}}><b style={{fontSize:11,color:C.orange}}>{ignorarModal.ids.length} transação(ões) · {fmt(ignorarModal.valor)}</b><p style={{fontSize:9,color:C.muted,marginTop:3}}>Elas sairão da fila pendente, permanecerão auditáveis e poderão ser reabertas.</p></div><Inp label="Motivo obrigatório *" value={ignorarModal.motivo} onChange={v=>setIgnorarModal(f=>({...f,motivo:v}))} multiline placeholder="Ex.: transferência entre contas, estorno, movimento sem efeito no DRE..."/><div style={{display:"flex",gap:7}}><Btn v="ghost" onClick={()=>setIgnorarModal(null)} full>Cancelar</Btn><Btn v="danger" onClick={confirmarIgnorar} full>Confirmar e ignorar</Btn></div></div></Modal>}

      {entradaModal && (() => {
        const tr=(data.transacoes||[]).find(t=>t.id===entradaModal.trId);
        if (!tr) return null;
        const contratosAbertos=(data.comercial?.contratos||[]).filter(k=>Number(k.entrada||0)>recebidoEntradaContrato(k)+.01);
        const medicoesAbertas=(data.medicoes||[]).filter(m=>Number(m.valorPrevisto||0)>totalRecebidoMedicao(m)+.01);
        const obrasParaEntrada=(data.obras||[]).filter(o=>o.status!=="done");
        const medicoesDaObra=medicoesAbertas.filter(m=>m.obraId===entradaForm.obraId);
        const obraSelecionada=obrasParaEntrada.find(o=>o.id===entradaForm.obraId);
        const tipoSemDre=!["entradaContrato","medicao","recebimento_administracao"].includes(entradaForm.tipo);
        return <Modal title="Validar entrada bancária" onClose={()=>setEntradaModal(null)} wide><div style={{display:"flex",flexDirection:"column",gap:11}}>
          <div style={{background:`${C.green}0B`,border:`1px solid ${C.green}44`,borderRadius:7,padding:"10px 12px"}}><p style={{fontSize:11.5,fontWeight:800,color:C.text}}>{tr.descricao}</p><p style={{fontSize:10,color:C.muted,marginTop:3}}>{fmtDate(tr.data)} · crédito no banco</p><p style={{fontSize:17,fontWeight:900,color:C.green,marginTop:4}}>{fmt(Math.abs(Number(tr.valor)))}</p></div>
          <p style={{fontSize:10,color:C.muted,lineHeight:1.45}}>Escolha a origem real do dinheiro. A confirmação cria vínculo auditável; aporte e empréstimo não viram receita no DRE.</p>
          <Sel label="Origem da entrada" value={entradaForm.tipo} onChange={v=>setEntradaForm(f=>({...f,tipo:v}))} options={[{v:"entradaContrato",l:"Entrada de contrato comercial"},{v:"medicao",l:"Parcela / medição da obra"},{v:"recebimento_administracao",l:"Recebimento manual · obra por administração"},{v:"entrada_caixa_obra",l:"Aporte do cliente no caixa da obra"},{v:"aporte_socio",l:"Aporte de sócio"},{v:"emprestimo",l:"Empréstimo ou financiamento"},{v:"outra_entrada",l:"Outra entrada sem efeito no DRE"}]}/>
          {entradaForm.tipo==="entradaContrato"&&<Sel label="Contrato" value={entradaForm.contratoId} onChange={v=>setEntradaForm(f=>({...f,contratoId:v}))} options={[{v:"",l:"Selecione o contrato..."},...contratosAbertos.map(k=>{const recebido=recebidoEntradaContrato(k);return {v:k.id,l:`${k.numero||"Contrato"} · ${k.contratante||"Cliente"} · saldo ${fmt(Number(k.entrada||0)-recebido)}`};})]}/>}
          {entradaForm.tipo==="medicao"&&<div style={{display:"flex",flexDirection:"column",gap:9,padding:"10px 11px",border:`1px solid ${C.border}`,borderRadius:8,background:C.surface}}>
            <div><p style={{fontSize:10,fontWeight:900,color:C.text}}>1. OBRA QUE RECEBEU</p><p style={{fontSize:9,color:C.muted,marginTop:2}}>Escolha a obra antes da parcela para não misturar lançamentos.</p></div>
            <Sel label="Obra" value={entradaForm.obraId} onChange={v=>setEntradaForm(f=>({...f,obraId:v,medicaoId:"",novaParcela:false}))} options={[{v:"",l:"Selecione a obra..."},...obrasParaEntrada.map(o=>({v:o.id,l:o.name}))]}/>
            {obraSelecionada&&<Badge color={C.blue}>Obra selecionada · {obraSelecionada.name}</Badge>}
            {entradaForm.obraId&&<><div style={{height:1,background:C.line}}/><div><p style={{fontSize:10,fontWeight:900,color:C.text}}>2. PARCELA DESTA OBRA</p><p style={{fontSize:9,color:C.muted,marginTop:2}}>{medicoesDaObra.length?"Somente parcelas em aberto desta obra aparecem abaixo.":"Não há parcela em aberto para esta obra."}</p></div>
              <Sel label="Parcela ou medição" value={entradaForm.medicaoId} onChange={v=>setEntradaForm(f=>({...f,medicaoId:v}))} options={[{v:"",l:"Selecione a parcela..."},...medicoesDaObra.map(m=>({v:m.id,l:`${m.descricao||m.numeroParcela||"Medição"} · saldo ${fmt(Number(m.valorPrevisto||0)-totalRecebidoMedicao(m))}`}))]}/>
              {!entradaForm.novaParcela?<Btn size="sm" v="ghost" onClick={()=>setEntradaForm(f=>({...f,novaParcela:true,novaParcelaDescricao:"",novaParcelaValor:String(Math.abs(Number(tr.valor||0)))}))}><Ic n="plus"/> Cadastrar parcela desta obra</Btn>:<div style={{display:"flex",flexDirection:"column",gap:8,padding:"9px 10px",background:C.bg,border:`1px solid ${C.blue}44`,borderRadius:7}}><p style={{fontSize:10,fontWeight:850,color:C.blue}}>Nova parcela · {obraSelecionada?.name}</p><Inp label="Identificação da parcela *" value={entradaForm.novaParcelaDescricao} onChange={v=>setEntradaForm(f=>({...f,novaParcelaDescricao:v}))} placeholder="Ex.: H-02 · 1ª quinzena de julho"/><div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}><Inp label="Competência" type="month" value={entradaForm.novaParcelaCompetencia} onChange={v=>setEntradaForm(f=>({...f,novaParcelaCompetencia:v}))}/><Inp label="Valor previsto *" type="number" value={entradaForm.novaParcelaValor} onChange={v=>setEntradaForm(f=>({...f,novaParcelaValor:v}))}/></div><div style={{display:"flex",gap:7}}><Btn size="sm" v="ghost" full onClick={()=>setEntradaForm(f=>({...f,novaParcela:false}))}>Cancelar</Btn><Btn size="sm" full onClick={cadastrarParcelaDaEntrada}><Ic n="check"/> Cadastrar e selecionar</Btn></div></div>}
            </>}
          </div>}
          {entradaForm.tipo==="recebimento_administracao"&&<Sel label="Obra por administração" value={entradaForm.obraId} onChange={v=>setEntradaForm(f=>({...f,obraId:v}))} options={[{v:"",l:"Selecione a obra..."},...data.obras.filter(o=>["administracao","admin","management"].includes(String(o.contractType||"").toLowerCase())||String(o.billingType||"").toLowerCase().includes("administr")).map(o=>({v:o.id,l:o.name})),...data.obras.filter(o=>!["administracao","admin","management"].includes(String(o.contractType||"").toLowerCase())&&!String(o.billingType||"").toLowerCase().includes("administr")).map(o=>({v:o.id,l:`${o.name} · outra modalidade`}))]}/>}
          {entradaForm.tipo==="entrada_caixa_obra"&&<Sel label="Obra do caixa" value={entradaForm.obraId} onChange={v=>setEntradaForm(f=>({...f,obraId:v}))} options={[{v:"",l:"Selecione a obra..."},...data.obras.map(o=>({v:o.id,l:o.name}))]}/>}
          {tipoSemDre&&<Sel label="Classificação" value={entradaForm.categoria} onChange={v=>setEntradaForm(f=>({...f,categoria:v}))} options={[{v:"aporte_cliente",l:"Recurso do cliente"},{v:"capital_socio",l:"Capital de sócio"},{v:"credito",l:"Crédito / empréstimo"},{v:"outros",l:"Outros recursos"}]}/>}
          <Inp label="Observação" value={entradaForm.descricao} onChange={v=>setEntradaForm(f=>({...f,descricao:v}))} placeholder="Identificação no extrato, contrato ou comprovante"/>
          <div style={{display:"flex",gap:8}}><Btn v="ghost" onClick={()=>setEntradaModal(null)} full disabled={conciliando}>Cancelar</Btn><Btn onClick={confirmarEntrada} full disabled={conciliando}>{conciliando?"Confirmando no servidor…":<><Ic n="check"/> Confirmar entrada</>}</Btn></div>
        </div></Modal>;
      })()}

      {/*  Modal: apropriar  */}
      {apropModal && (
        <Modal title="Apropriar transação" onClose={()=>{setApropModal(null);setRateios([]);setMedAlvo(null);setRecebedorMaoObraId("");}} wide>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            <div style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
              <p style={{fontSize:12.5,color:C.text,fontWeight:600}}>{apropModal.descricao}</p>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                <p style={{fontSize:11,color:C.muted}}>{fmtDate(apropModal.data)}</p>
                <p style={{fontSize:15,fontWeight:800,
                           color: Number(apropModal.valor)>0 ? C.green : C.red}}>
                  {Number(apropModal.valor)>0 ? "+" : ""} {fmt(alvo)}
                </p>
              </div>
            </div>

            {/*  Casamento com medição em aberto 
                Aparece só em ENTRADAS que têm candidata. Nada vem pré-marcado:
                o app sugere, você decide. */}
            {candidatas.length > 0 && (
              <div style={{background:`${C.blue}08`,border:`1.5px solid ${C.blue}55`,
                           borderRadius:6,padding:"11px 12px"}}>
                <p style={{fontSize:11.5,fontWeight:800,color:C.blue,marginBottom:2}}>
                   Esta entrada parece quitar uma medição
                </p>
                <p style={{fontSize:10.5,color:C.muted,marginBottom:9,lineHeight:1.5}}>
                  Se você confirmar, a parcela é marcada como <strong>recebida</strong> e a
                  receita passa a ser reconhecida por ela - sem lançamento avulso em duplicidade.
                </p>

                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {candidatas.map(c => {
                    const sel = medAlvo?.m.id === c.m.id;
                    const obra = c.obra;
                    return (
                      <button key={c.m.id} onClick={()=>escolherMedicao(c)} style={{
                        textAlign:"left", cursor:"pointer",
                        background: sel ? `${C.blue}14` : C.bg,
                        border:`1.5px solid ${sel ? C.blue : C.border}`,
                        borderRadius:6, padding:"9px 11px",
                      }}>
                        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
                          <div style={{minWidth:0,flex:1}}>
                            <p style={{fontSize:12,fontWeight:700,color:C.text}}>
                              {sel ? "" : ""} {obra?.name || "-"}
                            </p>
                            <p style={{fontSize:10.5,color:C.muted,marginTop:2}}>
                              {c.m.descricao || `Parcela ${c.m.numeroParcela}`}
                              {c.m.dataVencimento && `  vence ${fmtDate(c.m.dataVencimento)}`}
                            </p>
                            <p style={{fontSize:9.5,color:C.blue,marginTop:3}}>
                              {c.motivos.join("  ")}
                            </p>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <p style={{fontSize:12.5,fontWeight:800,color:C.text}}>{fmt(c.prev)}</p>
                            {c.parcial && (
                              <p style={{fontSize:9,color:C.orange,fontWeight:700,marginTop:2}}>
                                ! PARCIAL
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {medAlvo?.parcial && (
                  <div style={{marginTop:8,background:`${C.orange}10`,border:`1px solid ${C.orange}44`,
                               borderRadius:6,padding:"7px 10px"}}>
                    <p style={{fontSize:10.5,color:C.orange,fontWeight:700}}>Pagamento parcial</p>
                    <p style={{fontSize:10,color:C.muted,marginTop:2,lineHeight:1.45}}>
                      Recebido {fmt(alvo)} de {fmt(medAlvo.prev)} previstos.
                      A parcela será dada por quitada com o valor recebido - se o resto ainda vem,
                      talvez seja melhor não vincular agora.
                    </p>
                  </div>
                )}

                {!medAlvo && (
                  <p style={{fontSize:10,color:C.muted,marginTop:8,fontStyle:"italic"}}>
                    Nenhuma selecionada - a entrada será lançada como recebimento avulso da obra.
                  </p>
                )}
              </div>
            )}

            {/* Cartão PIX: o operador confirma uma decisão já explicada, em vez
                de remontar um rateio que o ponto e o extrato já determinaram. */}
            {apropModal && Number(apropModal.valor||0)<0 && (
              <div style={{background:C.surface,border:`1px solid ${rateioMaoObraPreparado?(temDivergenciaRecebedor?`${C.orange}88`:`${C.green}66`):recebedorSelecionado?`${C.orange}66`:C.border}`,borderRadius:10,padding:"12px 13px"}}>
                <p style={{fontSize:9,fontWeight:850,letterSpacing:1,textTransform:"uppercase",color:C.yellowD}}>Cartão PIX · saída bancária</p>
                <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:10,marginTop:8}}>
                  <div><p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:800}}>Quem recebeu</p><p style={{fontSize:13,fontWeight:850,color:C.text,marginTop:2}}>{recebedorSelecionado?.emp.name||"Aguardando identificação"}</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>{recebedorSelecionado?.emp.pixHolder?`Titular PIX: ${recebedorSelecionado.emp.pixHolder}`:"Selecione apenas se o cruzamento não for inequívoco"}</p></div>
                  <div><p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:800}}>Obra sugerida</p><p style={{fontSize:13,fontWeight:850,color:C.text,marginTop:2}}>{(data.obras||[]).find(o=>o.id===recebedorSelecionado?.emp.obra)?.name||"Definir nos detalhes"}</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>{recebedorSelecionado?.periodoPonto?`Ponto: ${recebedorSelecionado.periodoPonto}`:`Quinzena a conferir`} · {recebedorSelecionado?.diasTrabalhados||0} dia(s)</p></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:10,marginTop:9,paddingTop:9,borderTop:`1px solid ${C.line}`}}>
                  <div><p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:800}}>Valor do ponto</p><p style={{fontSize:14,fontWeight:850,color:rateioMaoObraPreparado&&!temDivergenciaRecebedor?C.green:C.text,marginTop:2}}>{recebedorSelecionado?fmt(recebedorSelecionado.esperado||0):"—"}</p><p style={{fontSize:9.5,color:temDivergenciaRecebedor?C.orange:C.muted,marginTop:2}}>{temDivergenciaRecebedor?`${fmt(Math.abs(recebedorSelecionado.divergencia))} de divergência · PIX ${fmt(alvo)}`:`Pagamento PIX ${fmt(alvo)}`}</p></div>
                  <div><p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:800}}>Evidência PIX</p><p style={{fontSize:10.5,fontWeight:750,color:C.text,marginTop:3,lineHeight:1.35,wordBreak:"break-word"}}>{apropModal.descricao||"Descrição não informada"}</p></div>
                </div>
                {rateioPixAutomatico&&<p style={{fontSize:10,color:C.green,fontWeight:800,marginTop:10}}>Correspondência confirmável: titular/chave PIX, valor e quinzena de referência foram identificados. O rateio para mão de obra desta obra já foi preparado.</p>}
                {rateioMaoObraPreparado&&!rateioPixAutomatico&&!temDivergenciaRecebedor&&<p style={{fontSize:10,color:C.green,fontWeight:800,marginTop:10}}>Operário selecionado. A obra e o rateio de mão de obra foram preparados; basta confirmar.</p>}
                {rateioMaoObraPreparado&&temDivergenciaRecebedor&&<p style={{fontSize:10,color:C.orange,fontWeight:800,marginTop:10}}>Atenção: nome/titular foi encontrado, mas o PIX diverge do valor do ponto. Confirme somente se este pagamento estiver correto.</p>}
                {!rateioMaoObraPreparado&&<p style={{fontSize:10,color:C.orange,fontWeight:800,marginTop:10}}>Escolha abaixo quem recebeu este PIX. A conciliação só será efetivada após sua confirmação.</p>}
                {sugMaoObra.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10,paddingTop:10,borderTop:`1px solid ${C.line}`}}>
                  <p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:800}}>Quem recebeu este PIX?</p>
                  {sugMaoObra.map(s=>{
                    const selecionado=recebedorSelecionado?.emp.id===s.emp.id;
                    const temDivergencia=Math.abs(Number(s.divergencia||0))>=.01;
                    const cor=temDivergencia?C.orange:C.green;
                    return <button type="button" key={s.emp.id} onClick={()=>selecionarOperarioPix(s)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,width:"100%",textAlign:"left",padding:"9px 10px",background:selecionado?`${cor}0E`:C.card,border:`1px solid ${selecionado?`${cor}88`:C.line}`,borderRadius:7,cursor:"pointer"}}>
                      <span style={{minWidth:0}}><b style={{fontSize:10.5,color:C.text}}>{s.emp.name}</b><span style={{fontSize:9.5,color:C.muted}}> · {s.motivos.join(" · ")}</span></span>
                      <span style={{fontSize:10.5,fontWeight:850,color:cor,whiteSpace:"nowrap"}}>{temDivergencia?`Dif. ${fmt(Math.abs(s.divergencia))}`:fmt(s.esperado)}</span>
                    </button>;
                  })}
                </div>}
                <button onClick={()=>setDetalhesPix(v=>!v)} style={{marginTop:10,border:0,background:"transparent",padding:0,color:C.yellowD,fontSize:10.5,fontWeight:850,cursor:"pointer"}}>{detalhesPix?"Ocultar ajustes e evidências":"Trocar operário ou obra / ver evidências"}</button>
                {detalhesPix&&<div style={{display:"flex",flexDirection:"column",gap:7,marginTop:10,paddingTop:10,borderTop:`1px solid ${C.line}`}}>
                  <Sel label="Outro operário" value={recebedorMaoObraId} onChange={selecionarOperarioNosDetalhes} options={[{v:"",l:"Não vincular a um colaborador agora"},...recebedoresMaoObra.map(s=>({v:s.emp.id,l:[s.emp.name,s.emp.pixHolder?`PIX: ${s.emp.pixHolder}`:""].filter(Boolean).join(" · ")}))]}/>
                </div>}
              </div>
            )}

            {!rateioMaoObraPreparado&&<p style={{fontSize:11,color:C.muted,lineHeight:1.5}}>Divida o valor entre obras e a empresa somente quando esta saída não puder ser associada de forma inequívoca.</p>}

            {/* Linhas de rateio */}
            {!rateioMaoObraPreparado&&rateios.map((r,i)=>(
              <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 11px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                  <p style={{fontSize:10,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.5}}>
                    Destino {i+1}
                  </p>
                  {rateios.length > 1 && (
                    <button onClick={()=>delRateio(i)} style={{background:"transparent",border:0,color:C.muted,
                                                               cursor:"pointer",fontSize:15,lineHeight:1}}>x</button>
                  )}
                </div>

                <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:9}}>
                  <Sel label="Vai para" value={r.destino}
                    onChange={v=>{ updRateio(i,"destino",v); updRateio(i,"obraId",""); }}
                    options={[{v:"obra",l:" Uma obra"},{v:"empresa",l:" A empresa"}]}/>

                  {r.destino === "obra" ? (
                    <Sel label="Obra" value={r.obraId} onChange={v=>updRateio(i,"obraId",v)}
                      options={[{v:"",l:"Selecione..."}, ...data.obras.map(o=>({v:o.id,l:o.name}))]}/>
                  ) : (
                    <Sel label="Categoria" value={r.categoria} onChange={v=>updRateio(i,"categoria",v)}
                      options={CATS_DESP.map(c=>({v:c.v,l:c.l}))}/>
                  )}

                  {r.destino === "obra" && (
                    <Sel label="Categoria" value={r.categoria} onChange={v=>updRateio(i,"categoria",v)}
                      options={CATS_OBRA_CONC.map(c=>({v:c.v,l:c.l}))}/>
                  )}

                  <Inp label="Valor (R$)" type="number" value={r.valor}
                    onChange={v=>updRateio(i,"valor",v)} placeholder="0,00"/>
                </div>
              </div>
            ))}

            {!rateioMaoObraPreparado&&<Btn v="ghost" onClick={addRateio} full><Ic n="plus"/> Adicionar outro destino</Btn>}

            {/* Fechamento do rateio */}
            {!rateioMaoObraPreparado&&<div style={{
              background: Math.abs(diferenca) < 0.01 ? `${C.green}0E` : `${C.orange}0E`,
              border:`1.5px solid ${Math.abs(diferenca) < 0.01 ? C.green : C.orange}`,
              borderRadius:6, padding:"10px 12px",
            }}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted}}>
                <span>Valor da transação</span><span>{fmt(alvo)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginTop:2}}>
                <span>Rateado</span><span>{fmt(totalRateado)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                           marginTop:6,paddingTop:6,borderTop:`1px solid ${C.line}`}}>
                <span style={{fontSize:12,fontWeight:700,
                              color: Math.abs(diferenca) < 0.01 ? C.green : C.orange}}>
                  {Math.abs(diferenca) < 0.01 ? "Rateio fecha" : "Falta distribuir"}
                </span>
                <span style={{fontSize:15,fontWeight:800,
                              color: Math.abs(diferenca) < 0.01 ? C.green : C.orange}}>
                  {fmt(Math.abs(diferenca))}
                </span>
              </div>
            </div>}

            {/* Criar regra */}
            {!rateioMaoObraPreparado&&rateios.length === 1 && (
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
                <label style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer"}}>
                  <div onClick={()=>setCriarRegra(!criarRegra)} style={{
                    width:19,height:19,borderRadius:5,flexShrink:0,
                    border:`2px solid ${criarRegra?C.yellow:C.border}`,
                    background:criarRegra?C.yellow:"transparent",
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}>
                    {criarRegra && <span style={{color:"#fff",fontSize:12,fontWeight:900}}>ok</span>}
                  </div>
                  <p style={{fontSize:12,fontWeight:700,color:C.text}}>
                    Classificar assim automaticamente das próximas vezes
                  </p>
                </label>
                {criarRegra && (
                  <div style={{marginTop:9}}>
                    <Inp label="Quando a descrição contiver" value={padraoRegra} onChange={setPadraoRegra}
                      placeholder="Ex.: CELPE, ALUGUEL, PIX JOSE DAVID"/>
                    <p style={{fontSize:10,color:C.muted,marginTop:4,lineHeight:1.45}}>
                      Vira só uma <strong>sugestão</strong> - você continua confirmando cada transação.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>{setApropModal(null);setRateios([]);setMedAlvo(null);}} full>Cancelar</Btn>
              <Btn onClick={confirmarApropriacao} full loading={conciliando} disabled={Math.abs(diferenca) >= 0.01}>
                <Ic n="check"/> {conciliando?"Conciliando no servidor...":"Confirmar conciliação"}
              </Btn>
            </div>
            {conciliando&&<p role="status" aria-live="polite" style={{fontSize:10,color:C.yellowD,fontWeight:750,textAlign:"right"}}>Validando transação, funcionário, obra e valor. Aguarde a confirmação.</p>}
          </div>
        </Modal>
      )}

      {/*  Modal: revisar sugestão do motor de candidatos  */}
      {candidatoModal && (() => {
        const tr = (data.transacoes||[]).find(t=>t.id===candidatoModal.trId);
        if (!tr) return null;
        const cs = candidatosPorTransacao.get(tr.id) || [];
        const c = cs[candidatoModal.idx];
        return (
          <Modal title="Revisar sugestão de conciliação" onClose={fecharCandidato} wide>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:10}}>
                <div style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
                  <p style={{fontSize:9,fontWeight:800,color:C.muted,textTransform:"uppercase"}}>Movimento bancário</p>
                  <p style={{fontSize:12,fontWeight:700,color:C.text,marginTop:4}}>{tr.descricao}</p>
                  <p style={{fontSize:10,color:C.muted,marginTop:2}}>{fmtDate(tr.data)}</p>
                  <p style={{fontSize:15,fontWeight:800,marginTop:4,color:Number(tr.valor)>0?C.green:C.red}}>{Number(tr.valor)>0?"+":""}{fmt(Math.abs(tr.valor))}</p>
                </div>
                <div style={{background:c?`${corFaixa(c.confianca)}0C`:C.surface,border:`1.5px solid ${c?corFaixa(c.confianca):C.border}`,borderRadius:6,padding:"10px 12px"}}>
                  <p style={{fontSize:9,fontWeight:800,color:C.muted,textTransform:"uppercase"}}>Candidata sugerida</p>
                  {c ? <>
                    <p style={{fontSize:12,fontWeight:700,color:C.text,marginTop:4}}>{c.titulo}</p>
                    {c.contraparte && <p style={{fontSize:10,color:C.muted,marginTop:2}}>{c.contraparte}</p>}
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
                      <Badge color={corFaixa(c.confianca)}>{c.score} pts · {rotuloFaixa[c.confianca]}</Badge>
                      {cs.length>1 && <span style={{fontSize:9,color:C.muted}}>{candidatoModal.idx+1} de {cs.length}</span>}
                    </div>
                  </> : <p style={{fontSize:10.5,color:C.muted,marginTop:6}}>Nenhuma candidata encontrada para esta transação.</p>}
                </div>
              </div>

              {c && c.motivos.length>0 && (
                <div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}44`,borderRadius:6,padding:"9px 11px"}}>
                  <p style={{fontSize:9.5,fontWeight:800,color:C.blue,marginBottom:3}}>Por que esta candidata</p>
                  {c.motivos.map((m,i)=><p key={i} style={{fontSize:10,color:C.muted,marginTop:2}}>· {m}</p>)}
                </div>
              )}
              {c?.tipo==="tituloFolha" && c.metadados?.payroll && (()=>{
                const folha=c.metadados.payroll;
                return <div style={{background:`${C.green}08`,border:`1px solid ${C.green}44`,borderRadius:6,padding:"10px 11px"}}>
                  <p style={{fontSize:9.5,fontWeight:800,color:C.green}}>Título de folha · confira antes de liquidar</p>
                  <p style={{fontSize:10,color:C.muted,marginTop:4}}>{folha.funcionario} · CPF {folha.cpfMascarado} · PIX {folha.chavePixMascarada}</p>
                  <p style={{fontSize:10,color:C.muted,marginTop:2}}>Titular: {folha.titularPix||"não informado"} · Período: {folha.periodo||"não informado"}</p>
                  <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:5,marginTop:7,fontSize:9.5,color:C.text}}>
                    <span>Bruto: <b>{fmt(folha.bruto)}</b></span><span>Benefícios: <b>{fmt(folha.beneficios)}</b></span>
                    <span>Adiantamentos/descontos: <b>{fmt(folha.adiantamentos+folha.descontos)}</b></span><span>Líquido: <b>{fmt(folha.liquido)}</b></span>
                    <span style={{gridColumn:"1 / -1"}}>Saldo em aberto: <b>{fmt(folha.saldo)}</b> · Rateio: {(folha.rateiosPorObra||[]).map(r=>`${nomeObra(r.obraId)} ${fmt(r.valor)}`).join(" · ")||"não informado"}</span>
                  </div>
                  <p style={{fontSize:9,color:C.muted,marginTop:7}}>Esta ação liquida somente o título e registra o vínculo bancário. Não cria outra despesa de mão de obra no DRE.</p>
                </div>;
              })()}
              {c && c.alertas.length>0 && (
                <div style={{background:`${C.orange}0C`,border:`1px solid ${C.orange}55`,borderRadius:6,padding:"9px 11px"}}>
                  <p style={{fontSize:9.5,fontWeight:800,color:C.orange,marginBottom:3}}>Alertas</p>
                  {c.alertas.map((m,i)=><p key={i} style={{fontSize:10,color:C.orange,marginTop:2}}>! {m}</p>)}
                </div>
              )}
              {c && c.bloqueios.length>0 && (
                <div style={{background:`${C.red}0C`,border:`1px solid ${C.red}55`,borderRadius:6,padding:"9px 11px"}}>
                  <p style={{fontSize:9.5,fontWeight:800,color:C.red,marginBottom:3}}>Bloqueado</p>
                  {c.bloqueios.map((m,i)=><p key={i} style={{fontSize:10,color:C.red,marginTop:2}}>· {m}</p>)}
                </div>
              )}

              {c && c.podeRegistrarPagamento && (
                <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:9}}>
                  <Inp label="Valor a registrar (R$)" type="number" value={pagamentoForm.valor} onChange={v=>setPagamentoForm(f=>({...f,valor:v}))}/>
                  <Inp label="Data do pagamento" type="date" value={pagamentoForm.data} onChange={v=>setPagamentoForm(f=>({...f,data:v}))}/>
                </div>
              )}

              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {c?.tipo==="maoObraPonto" && <Btn onClick={()=>{fecharCandidato();abrirApropriacao(tr);}}><Ic n="check"/> Abrir cartão PIX</Btn>}
                {c && c.podeVincular && c.bloqueios.length===0 && <Btn onClick={()=>executarVincular(tr,c)}><Ic n="check"/> Confirmar vínculo</Btn>}
                {c && c.podeRegistrarPagamento && c.bloqueios.length===0 && <Btn onClick={()=>executarRegistrarPagamento(tr,c)}><Ic n="check"/> Registrar pagamento e conciliar</Btn>}
                {cs.length>1 && <Btn v="ghost" onClick={()=>trocarCandidato(1)}>Outro candidato</Btn>}
                {c && !modoConciliacaoRh&&<Btn v="ghost" onClick={()=>rejeitarCandidato(tr,c)}>Não corresponde</Btn>}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",paddingTop:8,borderTop:`1px solid ${C.line}`}}>
                {!modoConciliacaoRh&&c?.tipo!=="maoObraPonto" && <Btn v="ghost" onClick={()=>{fecharCandidato();abrirApropriacao(tr);}}>Rateio manual / criar lançamento</Btn>}
                {!modoConciliacaoRh&&<Btn v="ghost" onClick={()=>{fecharCandidato();setTransferModal({trId:tr.id});}}>Transferência interna</Btn>}
                {!modoConciliacaoRh&&<Btn v="ghost" onClick={()=>{fecharCandidato();setEstornoModal({trId:tr.id});}}>Estorno</Btn>}
                <Btn v="ghost" onClick={fecharCandidato}>Manter pendente</Btn>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/*  Modal: transferência interna  */}
      {transferModal && (() => {
        const tr = (data.transacoes||[]).find(t=>t.id===transferModal.trId);
        if (!tr) return null;
        const opcoes = candidatasTransferencia(tr);
        return (
          <Modal title="Marcar como transferência interna" onClose={()=>setTransferModal(null)}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <p style={{fontSize:10.5,color:C.muted,lineHeight:1.5}}>
                Escolha a outra ponta do movimento (mesma conta ou outra conta cadastrada, sinal oposto, valor e data próximos).
                Nenhuma receita ou despesa é gerada - o DRE não é afetado.
              </p>
              {opcoes.length===0
                ? <p style={{fontSize:10,color:C.orange}}>Nenhuma transação pendente com sinal oposto e valor parecido foi encontrada.</p>
                : <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {opcoes.map(o=>
                      <button key={o.id} onClick={()=>confirmarTransferencia(tr,o)} style={{textAlign:"left",cursor:"pointer",background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:6,padding:"9px 11px"}}>
                        <p style={{fontSize:11,fontWeight:700,color:C.text}}>{o.descricao}</p>
                        <p style={{fontSize:9.5,color:C.muted,marginTop:2}}>{fmtDate(o.data)} · {fmt(Math.abs(o.valor))}</p>
                      </button>
                    )}
                  </div>}
              <Btn v="ghost" onClick={()=>setTransferModal(null)} full>Cancelar</Btn>
            </div>
          </Modal>
        );
      })()}

      {/*  Modal: estorno  */}
      {estornoModal && (() => {
        const tr = (data.transacoes||[]).find(t=>t.id===estornoModal.trId);
        if (!tr) return null;
        const opcoes = candidatasEstorno(tr);
        return (
          <Modal title="Vincular a um estorno" onClose={()=>setEstornoModal(null)}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <p style={{fontSize:10.5,color:C.muted,lineHeight:1.5}}>
                Escolha o movimento original que está sendo estornado. O movimento original nunca é apagado.
              </p>
              {opcoes.length===0
                ? <p style={{fontSize:10,color:C.orange}}>Nenhum movimento de sinal oposto e valor parecido foi encontrado - você pode marcar sem origem localizada.</p>
                : <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {opcoes.map(o=>
                      <button key={o.id} onClick={()=>confirmarEstorno(tr,o)} style={{textAlign:"left",cursor:"pointer",background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:6,padding:"9px 11px"}}>
                        <p style={{fontSize:11,fontWeight:700,color:C.text}}>{o.descricao}</p>
                        <p style={{fontSize:9.5,color:C.muted,marginTop:2}}>{fmtDate(o.data)} · {fmt(Math.abs(o.valor))}</p>
                      </button>
                    )}
                  </div>}
              <div style={{display:"flex",gap:8}}>
                <Btn v="ghost" onClick={()=>setEstornoModal(null)} full>Cancelar</Btn>
                <Btn v="ghost" onClick={()=>confirmarEstorno(tr,null)} full>Sem origem localizada</Btn>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/*  Modal: conta bancária  */}
      {contaBancariaModal && (
        <Modal title={contaBancariaModal.id?"Editar conta bancária":"Nova conta bancária"} onClose={()=>setContaBancariaModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Inp label="Nome / apelido *" value={contaBancariaModal.nome} onChange={v=>setContaBancariaModal(f=>({...f,nome:v}))}/>
            <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:9}}>
              <Inp label="Banco" value={contaBancariaModal.banco} onChange={v=>setContaBancariaModal(f=>({...f,banco:v}))}/>
              <Sel label="Tipo" value={contaBancariaModal.tipo} onChange={v=>setContaBancariaModal(f=>({...f,tipo:v}))} options={[{v:"corrente",l:"Conta corrente"},{v:"poupanca",l:"Poupança"},{v:"caixa",l:"Caixa interno"}]}/>
              <Inp label="Agência" value={contaBancariaModal.agencia} onChange={v=>setContaBancariaModal(f=>({...f,agencia:v}))}/>
              <Inp label="Conta" value={contaBancariaModal.conta} onChange={v=>setContaBancariaModal(f=>({...f,conta:v}))}/>
              <Inp label="Titular" value={contaBancariaModal.titular} onChange={v=>setContaBancariaModal(f=>({...f,titular:v}))}/>
              <Inp label="Documento do titular" value={contaBancariaModal.documentoTitular} onChange={v=>setContaBancariaModal(f=>({...f,documentoTitular:v}))}/>
              <Inp label="Chave PIX desta conta" value={contaBancariaModal.pixKey} onChange={v=>setContaBancariaModal(f=>({...f,pixKey:v}))}/>
              <Inp label="Saldo inicial (R$)" type="number" value={contaBancariaModal.saldoInicial} onChange={v=>setContaBancariaModal(f=>({...f,saldoInicial:v}))}/>
            </div>
            <p style={{fontSize:9.5,color:C.muted,lineHeight:1.4}}>
              Cadastrar a chave PIX permite que a Conciliação reconheça automaticamente uma
              transferência entre contas da própria empresa, em vez de sugerir como receita/despesa nova.
            </p>
            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>setContaBancariaModal(null)} full>Cancelar</Btn>
              <Btn onClick={()=>salvarContaBancaria(contaBancariaModal)} full>Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/*  Modal: regra de auto-classificação  */}
      {regraModal && (
        <Modal title={regraModal.id?"Editar regra":"Nova regra"} onClose={()=>setRegraModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Inp label="Nome da regra" value={regraModal.nome} onChange={v=>setRegraModal(f=>({...f,nome:v}))}/>
            <Inp label="Quando a descrição contiver *" value={regraModal.padrao} onChange={v=>setRegraModal(f=>({...f,padrao:v}))} placeholder="Ex.: CELPE, ALUGUEL, PIX JOSE DAVID"/>
            <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:9}}>
              <Sel label="Vai para" value={regraModal.destino} onChange={v=>setRegraModal(f=>({...f,destino:v,obraId:""}))} options={[{v:"obra",l:"Uma obra"},{v:"empresa",l:"A empresa"}]}/>
              {regraModal.destino==="obra"
                ? <Sel label="Obra" value={regraModal.obraId} onChange={v=>setRegraModal(f=>({...f,obraId:v}))} options={[{v:"",l:"Selecione..."},...data.obras.map(o=>({v:o.id,l:o.name}))]}/>
                : <Sel label="Categoria" value={regraModal.categoria} onChange={v=>setRegraModal(f=>({...f,categoria:v}))} options={CATS_DESP.map(c=>({v:c.v,l:c.l}))}/>}
            </div>
            <p style={{fontSize:10,color:C.muted,lineHeight:1.45}}>
              Vira só uma sugestão na Fila inteligente - nunca conciliada sozinha. Uma regra nunca deve fixar a obra
              a partir só do fornecedor quando ele atende mais de uma obra.
            </p>
            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>setRegraModal(null)} full>Cancelar</Btn>
              <Btn onClick={()=>salvarRegra(regraModal)} full>Salvar regra</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/*  Modal: fechamento bancário  */}
      {fecharModal && (() => {
        const r = resumoFechamento(fecharModal);
        const diferencaCentavos = r.saldoBancoCentavos!=null ? r.saldoBancoCentavos - r.saldoCalculadoCentavos : 0;
        return (
          <Modal title="Fechar período bancário" onClose={()=>setFecharModal(null)}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:9}}>
                <Inp label="Início do período" type="date" value={fecharModal.dataInicio} onChange={v=>setFecharModal(f=>({...f,dataInicio:v}))}/>
                <Inp label="Fim do período" type="date" value={fecharModal.dataFim} onChange={v=>setFecharModal(f=>({...f,dataFim:v}))}/>
                <Inp label="Saldo final no extrato (R$, opcional)" type="number" value={fecharModal.saldoBanco} onChange={v=>setFecharModal(f=>({...f,saldoBanco:v}))}/>
              </div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10.5,color:C.muted}}><span>Saldo inicial</span><span>{fmt(deCentavos(r.saldoInicialCentavos))}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10.5,color:C.green,marginTop:2}}><span>+ Créditos</span><span>{fmt(deCentavos(r.creditosCentavos))}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10.5,color:C.red,marginTop:2}}><span>- Débitos</span><span>{fmt(deCentavos(r.debitosCentavos))}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:800,marginTop:6,paddingTop:6,borderTop:`1px solid ${C.line}`}}><span>Saldo calculado</span><span>{fmt(deCentavos(r.saldoCalculadoCentavos))}</span></div>
                {r.saldoBancoCentavos!=null && <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700,marginTop:4,color:Math.abs(diferencaCentavos)<=1?C.green:C.red}}><span>Diferença vs. banco</span><span>{fmt(deCentavos(diferencaCentavos))}</span></div>}
              </div>
              {r.pendentes.length>0 && <p style={{fontSize:10,color:C.orange,fontWeight:700}}>! {r.pendentes.length} transação(ões) ainda pendente(s) neste período.</p>}
              <div style={{display:"flex",gap:8}}>
                <Btn v="ghost" onClick={()=>setFecharModal(null)} full>Cancelar</Btn>
                <Btn onClick={confirmarFechamento} full>Fechar período</Btn>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
