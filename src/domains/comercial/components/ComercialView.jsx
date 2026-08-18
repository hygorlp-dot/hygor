// ===================================================================
// ComercialView — tela Comercial extraída de LegacyApp.jsx
//
// Extraído verbatim (mesmo corpo, mesma lógica) de src/LegacyApp.jsx em
// 2026-08-16, seguindo o mesmo padrão dos módulos anteriores. Mesma
// camada de dados, sem nova migration/RLS. Ver
// docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #7.
// ===================================================================

import { Suspense, useMemo, useState } from "react";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import {
  Btn, C, COM_ETAPAS, COM_IMOBILIARIO_SECTIONS, COM_JORNADA, COM_PERDAS,
  COM_ROUTE_SECTION, COM_TEMPERATURA, Ic, Inp, KB, LazyRealEstateCommercial,
  Modal, Sel, SelBtn, XLSX,
  arquivoComoDataUrl, carregarXLSX, cicloMedioVenda, comDateTime, comDias,
  comEtapaLabel, comFaseDaEtapa, conversaoPorFase, escapeHtml, fmt,
  fmtCompact, fmtDate, momentosIndicacao, npsResumo, rankingIndicadores,
  taxaIndicacao, today, uid,
} from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { buildFinancialLedger, selectCashFlow as selectLedgerCashFlow } from "../../financeiro/ledger";
import { archiveLeadForDeletion, isVisibleLead } from "../leads";
import { migrateCommercial } from "../migrations";
import { selectCommercialWorkspace } from "../selectors";
import {
  digitsOnly as soDigitos,
  formatBrazilianDocument as maskDoc,
  validateBrazilianDocument as validarDocumento,
} from "../../data/brazilian-documents";
import { enviarArquivoOneDrive } from "../../../api";

export default function Comercial({data,update,dispatchCommand,showToast,currentUser,view,onTab}){
  const {cols,formGrid}=useBreakpoint();const com=migrateCommercial(data.comercial||{});
  // Os 5 destinos atuais do menu (com_workspace/com_pipeline/com_relationships/
  // com_deals/com_management) são traduzidos aqui para a tela legada
  // correspondente; para qualquer outro valor de `view` (chegado via onTab()
  // de dentro da própria tela, ex. onTab("com_agenda")), o fallback `||view`
  // devolve o valor original inalterado. Por isso todo `if/else` de
  // renderização abaixo TEM que comparar contra `commercialView`, nunca contra
  // `view` diretamente - comparar com `view` faz "Propostas e contratos" e
  // "Gestão comercial" (que só existem como com_deals/com_management na barra
  // lateral) renderizarem em branco, porque nenhum desses dois valores bate
  // com nenhum `view==="com_..."` dos ramos legados (achado P0 da auditoria
  // de 18/08/2026, corrigido no mesmo dia).
  const commercialView={com_workspace:"com_dash",com_pipeline:"com_funil",com_relationships:"com_leads",com_deals:"com_propostas",com_management:"com_relatorios"}[view]||view;
  const leads=com.leads||[],atividades=com.atividades||[],reunioes=com.reunioes||[],propostas=com.propostas||[],contratos=com.contratos||[];
  const clientes=com.clientes||[],parceiros=com.parceiros||[],metas=com.metas||[],comissoes=com.comissoes||[],vendas=com.vendas||[];
  const usuarios=(data.usuarios||[]).filter(u=>u.active!==false);const [busca,setBusca]=useState("");
  const usuarioAtual=(data.usuarios||[]).find(u=>u.id===currentUser?.id)||currentUser||{};
  const limiteDesconto=currentUser?.role==="admin"?100:Number(usuarioAtual.maxDesconto??10);
  const [leadForm,setLeadForm]=useState(null);const [leadAba,setLeadAba]=useState("geral");
  const [colunaResumo,setColunaResumo]=useState(null);
  const [calMes,setCalMes]=useState(0);const [calDia,setCalDia]=useState("");
  const [npsForm,setNpsForm]=useState(null);   // pesquisa de satisfacao na entrega
const [docForm,setDocForm]=useState({nome:"",url:""});
  const [atividadeForm,setAtividadeForm]=useState(null);const [reuniaoForm,setReuniaoForm]=useState(null);const [propostaForm,setPropostaForm]=useState(null);
  const [negForm,setNegForm]=useState(null);const [contratoForm,setContratoForm]=useState(null);const [clienteForm,setClienteForm]=useState(null);const [parceiroForm,setParceiroForm]=useState(null);
  const [metaForm,setMetaForm]=useState(null);const [perdaForm,setPerdaForm]=useState(null);
  const [subindoDocumentoComercial,setSubindoDocumentoComercial]=useState(false);
  const [ativandoContratoId,setAtivandoContratoId]=useState("");
  // Trava genérica contra duplo-clique para as gravações do módulo (mesmo
  // padrão de EquipamentosView.jsx: uma string identificando a ação em
  // andamento, checada nos botões via `salvandoComercial==="tag"` /
  // `disabled={!!salvandoComercial}`).
  const [salvandoComercial,setSalvandoComercial]=useState("");
  // Modal de confirmação estilizado, substituindo window.confirm nativo
  // (mesmo padrão de EquipamentosView.jsx: {titulo,mensagem,tom,confirmLabel,onConfirmar}).
  const [confirmModal,setConfirmModal]=useState(null);
  const [realEstateSection,setRealEstateSection]=useState("overview");
  const setCom=(patch)=>update({...data,comercial:{...com,...patch}});
  const persistirComercial=async(patch,{mensagem="",aoConfirmar}={})=>{
    const result=await setCom(patch);
    if(!result?.ok){
      showToast("O servidor não confirmou o cadastro comercial. Os dados continuam abertos para uma nova tentativa.","error");
      return false;
    }
    aoConfirmar?.();
    if(mensagem)showToast(mensagem);
    return true;
  };
  const activeCommercialSection=view==="com_real_estate"?realEstateSection:(COM_ROUTE_SECTION[commercialView]||realEstateSection);
  const openCommercialSection=section=>{
    if(section.route){onTab(section.route);return;}
    setRealEstateSection(section.id);
    if(view!=="com_real_estate")onTab("com_real_estate");
  };
  // Maps id->registro, montados uma vez por render em vez de .find() por
  // chamada - nomeUsuario/leadBy sao usados dezenas de vezes por tela
  // (cards de lead, kanban, agenda, propostas, contratos...).
  const usuarioPorId=useMemo(()=>new Map(usuarios.map(u=>[u.id,u])),[usuarios]);
  const nomeUsuario=id=>usuarioPorId.get(id)?.nome||"-";
  const leadPorId=useMemo(()=>new Map(leads.map(l=>[l.id,l])),[leads]);
  const leadBy=id=>leadPorId.get(id);
  const ledgerComercial=useMemo(()=>buildFinancialLedger(data),[data]);
  const recebidoDoLead=leadId=>[...new Set(contratos
    .filter(contrato=>contrato.leadId===leadId&&contrato.obraId)
    .map(contrato=>contrato.obraId))]
    .reduce((total,obraId)=>total+selectLedgerCashFlow(ledgerComercial,{obraId}).cashIn,0);
  const leadAtivos=useMemo(()=>leads.filter(l=>!["perdido","arquivado","transferido"].includes(l.etapa)&&l.status!=="arquivado"),[leads]);
  // Map clienteId->vendas[], montado uma vez - a lista de Clientes fazia
  // vendas.filter(v=>v.clienteId===c.id) DUAS vezes por card (contagem e soma).
  const vendasPorCliente=useMemo(()=>{const m=new Map();vendas.forEach(v=>{const l=m.get(v.clienteId);if(l)l.push(v);else m.set(v.clienteId,[v]);});return m;},[vendas]);
  const agora=Date.now();const mesAtual=today().slice(0,7);
  const alertas=useMemo(()=>{
    const out=[];leadAtivos.forEach(l=>{if(!l.responsavelId||!l.proximaAtividadeEm)out.push({tipo:"lead",cor:C.red,texto:`${l.nome}: sem responsável ou próxima atividade`,leadId:l.id});if(comDias(l.etapaDesde)>=5)out.push({tipo:"parado",cor:C.orange,texto:`${l.nome}: ${comDias(l.etapaDesde)} dias em ${comEtapaLabel(l.etapa)}`,leadId:l.id});});
    atividades.filter(a=>a.status!=="concluida"&&a.dataHora&&new Date(a.dataHora).getTime()<agora).forEach(a=>out.push({tipo:"followup",cor:C.red,texto:`Follow-up vencido: ${a.titulo}`,leadId:a.leadId}));
    reunioes.filter(r=>r.status==="agendada"&&r.dataHora).forEach(r=>{const falta=new Date(r.dataHora).getTime()-agora;if(falta<0)out.push({tipo:"reuniao",cor:C.red,texto:`Reunião atrasada: ${leadBy(r.leadId)?.nome||"Lead"}`,leadId:r.leadId});else if(falta<=86400000)out.push({tipo:"reuniao",cor:C.blue,texto:`Reunião nas próximas 24h: ${leadBy(r.leadId)?.nome||"Lead"} · ${comDateTime(r.dataHora)}`,leadId:r.leadId});});
    propostas.filter(p=>["enviada","visualizada","negociacao"].includes(p.status)&&p.validade).forEach(p=>{const d=Math.ceil((new Date(`${p.validade}T23:59:00`).getTime()-agora)/86400000);if(d<=3)out.push({tipo:"proposta",cor:d<0?C.red:C.orange,texto:`Proposta ${p.numero} ${d<0?"vencida":`vence em ${d} dia(s)`}`,leadId:p.leadId});});
    contratos.filter(k=>["enviado","aguardando_assinatura"].includes(k.status)).forEach(k=>out.push({tipo:"contrato",cor:C.orange,texto:`Contrato ${k.numero} sem assinatura`,leadId:k.leadId}));
    contratos.filter(k=>k.assinadoEm&&!k.entradaPaga).forEach(k=>out.push({tipo:"entrada",cor:C.red,texto:`Entrada pendente: contrato ${k.numero}`,leadId:k.leadId}));return out;
  },[com.leads,com.atividades,com.reunioes,com.propostas,com.contratos]);
  const vendedores=useMemo(()=>usuarios.map(u=>{const ls=leads.filter(l=>isVisibleLead(l)&&l.responsavelId===u.id),vs=vendas.filter(v=>v.responsavelId===u.id);return{id:u.id,nome:u.nome,leads:ls.length,vendas:vs.length,receita:vs.reduce((s,v)=>s+v.valor,0),conversao:ls.length?vs.length/ls.length*100:0};}).filter(x=>x.leads||x.vendas),[usuarios,leads,vendas]);
  const origens=useMemo(()=>{const m={};leads.filter(isVisibleLead).forEach(l=>{const k=l.origem||"Não informada";m[k]??={origem:k,leads:0,vendas:0,receita:0};m[k].leads++;});vendas.forEach(v=>{const l=leadBy(v.leadId),k=l?.origem||"Não informada";m[k]??={origem:k,leads:0,vendas:0,receita:0};m[k].vendas++;m[k].receita+=v.valor;});return Object.values(m);},[leads,vendas]);

  const leadVazio=()=>({id:"",nome:"",tipoPessoa:"PF",telefone:"",whatsapp:"",email:"",cidade:"",origem:"",indicadoPorClienteId:"",indicadoPorObraId:"",indicadoPorNome:"",responsavelId:currentUser?.id||"",servico:"",orcamentoEstimado:"",prazoDesejado:"",probabilidade:"20",fechamentoPrevisto:"",temperatura:"morno",observacoes:"",endereco:"",condominio:"",lote:"",areaTerreno:"",areaConstrucao:"",pavimentos:"",tipoServico:"",prazoPretendido:"",padrao:"alto",orcamentoDisponivel:"",projetosExistentes:"",etapa:"novo",proximaAtividade:"Primeiro contato",proximaAtividadeEm:"",qualificacao:"",documentos:[],historico:[]});
  // Salva a pesquisa de satisfacao da entrega (NPS).
  const salvarNps=async()=>{
    const f=npsForm;
    if(!f?.obraId){showToast("Escolha a obra.","error");return;}
    if(f.nota===""||f.nota===null||isNaN(Number(f.nota))){showToast("Informe a nota de 0 a 10.","error");return;}
    const reg={
      id:f.id||uid(), clienteId:f.clienteId||"", obraId:f.obraId,
      nota:Math.max(0,Math.min(10,Number(f.nota))),
      comentario:f.comentario||"", data:f.data||today(),
      indicaria:f.indicaria!==false, pediuIndicacao:!!f.pediuIndicacao,
      createdAt:f.createdAt||new Date().toISOString(),
    };
    const lista=f.id
      ? (com.pesquisas||[]).map(p=>p.id===f.id?reg:p)
      : [...(com.pesquisas||[]),reg];
    setSalvandoComercial("nps");
    try{
      await persistirComercial({pesquisas:lista},{
        mensagem:reg.nota>=9?"Promotor registrado - vale pedir indicação.":"Pesquisa registrada.",
        aoConfirmar:()=>setNpsForm(null),
      });
    }finally{setSalvandoComercial("");}
  };

  // Marca que o cliente ja foi convidado a indicar (sai da lista de acoes).
  const marcarPedidoIndicacao=async(obraId)=>{
    const lista=(com.pesquisas||[]).map(p=>p.obraId===obraId?{...p,pediuIndicacao:true}:p);
    setSalvandoComercial(`marcar-indicacao-${obraId}`);
    try{
      await persistirComercial({pesquisas:lista},{
        mensagem:"Registrado. Acompanhe se vem indicação nas próximas semanas.",
      });
    }finally{setSalvandoComercial("");}
  };

  const executarSalvarLead=async f=>{
    const antigo=leads.find(l=>l.id===f.id),id=f.id||uid(),now=new Date().toISOString();const hist=[...(f.historico||[])];if(!antigo)hist.push({id:uid(),data:now,tipo:"criacao",texto:`Lead criado por ${currentUser?.nome||"usuário"}`});if(antigo&&antigo.etapa!==f.etapa)hist.push({id:uid(),data:now,tipo:"etapa",texto:`Etapa alterada de ${comEtapaLabel(antigo.etapa)} para ${comEtapaLabel(f.etapa)}`});
    const novo={...f,id,orcamentoEstimado:Number(f.orcamentoEstimado||0),probabilidade:Number(f.probabilidade||0),orcamentoDisponivel:Number(f.orcamentoDisponivel||0),areaTerreno:Number(f.areaTerreno||0),areaConstrucao:Number(f.areaConstrucao||0),pavimentos:Number(f.pavimentos||0),etapaDesde:antigo?.etapa===f.etapa?antigo.etapaDesde:now,createdAt:antigo?.createdAt||now,updatedAt:now,historico:hist,status:"ativo"};
    let novasAt=atividades;if(!antigo)novasAt=[...atividades,{id:uid(),leadId:id,tipo:"primeiro_contato",titulo:f.proximaAtividade||"Primeiro contato",dataHora:f.proximaAtividadeEm,responsavelId:f.responsavelId,status:"pendente",observacoes:"Criada automaticamente",createdAt:now}];
    setSalvandoComercial("lead");
    try{
      await persistirComercial({leads:antigo?leads.map(l=>l.id===id?novo:l):[...leads,novo],atividades:novasAt},{mensagem:antigo?"Lead atualizado.":"Lead criado com tarefa de primeiro contato.",aoConfirmar:()=>setLeadForm(null)});
    }finally{setSalvandoComercial("");}
  };
  const salvarLead=()=>{
    const f=leadForm;
    if(!f?.nome.trim()){showToast("Informe o nome do lead.","error");return;}
    if(!f.responsavelId||!f.proximaAtividadeEm){showToast("Todo lead ativo precisa de responsável e próxima atividade.","error");return;}
    const duplicado=leads.find(l=>l.id!==f.id&&((f.email&&l.email?.toLowerCase()===f.email.toLowerCase())||(f.whatsapp&&l.whatsapp===f.whatsapp)));
    if(duplicado){
      setConfirmModal({
        titulo:"Possível lead duplicado",
        mensagem:`Já existe um lead parecido com estes dados de contato: "${duplicado.nome}". Deseja salvar mesmo assim?`,
        confirmLabel:"Salvar mesmo assim",
        onConfirmar:()=>executarSalvarLead(f),
      });
      return;
    }
    executarSalvarLead(f);
  };
  const executarExcluirLead=async lead=>{
    const result=archiveLeadForDeletion(com,{leadId:lead.id,actor:currentUser});
    if(!result.ok){showToast(result.error||"Não foi possível excluir o lead.","error");return;}
    const next=result.commercial;
    setSalvandoComercial(`lead-excluir-${lead.id}`);
    try{
      await persistirComercial({
        leads:next.leads,atividades:next.atividades,reunioes:next.reunioes,
        opportunities:next.opportunities,stageEvents:next.stageEvents,
      },{
        mensagem:"Lead excluído. O histórico e os vínculos foram preservados.",
        aoConfirmar:()=>setLeadForm(null),
      });
    }finally{setSalvandoComercial("");}
  };
  const excluirLead=lead=>{
    if(!lead?.id)return;
    const vinculados=[
      propostas.filter(item=>item.leadId===lead.id).length,
      contratos.filter(item=>item.leadId===lead.id).length,
      reunioes.filter(item=>item.leadId===lead.id).length,
    ].reduce((sum,value)=>sum+value,0);
    const aviso=vinculados
      ?` Existem ${vinculados} proposta(s), contrato(s) ou reunião(ões) vinculados; eles serão preservados para auditoria.`
      :"";
    setConfirmModal({
      titulo:"Excluir lead?",
      mensagem:`O lead "${lead.nome}" sairá das listas e do funil.${aviso}`,
      tom:"danger",
      confirmLabel:"Excluir lead",
      onConfirmar:()=>executarExcluirLead(lead),
    });
  };
  // Achado P2 da auditoria de 18/08/2026: gravava com setCom puro, sem checar
  // o resultado - arrastar um card no funil podia falhar em silêncio.
  const moverLead=async(lead,etapa)=>{
    if(etapa==="perdido"){setPerdaForm({leadId:lead.id,motivo:"",concorrente:"",valorConcorrente:"",observacoes:"",reativacaoEm:""});return;}
    const now=new Date().toISOString();
    await persistirComercial({leads:leads.map(l=>l.id===lead.id?{...l,etapa,status:etapa==="arquivado"?"arquivado":etapa==="novo"?"ativo":l.status,etapaDesde:now,historico:[...(l.historico||[]),{id:uid(),data:now,tipo:"etapa",texto:`Movido para ${comEtapaLabel(etapa)} por ${currentUser?.nome||"usuário"}`}]}:l)});
  };
  const salvarPerda=async()=>{
    if(!perdaForm.motivo){showToast("Informe o motivo da perda.","error");return;}
    const now=new Date().toISOString();
    setSalvandoComercial("perda");
    try{
      await persistirComercial({leads:leads.map(l=>l.id===perdaForm.leadId?{...l,...perdaForm,valorConcorrente:Number(perdaForm.valorConcorrente||0),etapa:"perdido",status:"perdido",etapaDesde:now,historico:[...(l.historico||[]),{id:uid(),data:now,tipo:"perda",texto:`Lead perdido: ${perdaForm.motivo}`}]}:l)},{mensagem:"Perda registrada com histórico.",aoConfirmar:()=>setPerdaForm(null)});
    }finally{setSalvandoComercial("");}
  };
  const salvarAtividade=async f=>{
    if(!f.leadId||!f.titulo||!f.dataHora){showToast("Informe lead, título e data.","error");return;}
    const a={...f,id:f.id||uid(),responsavelId:f.responsavelId||currentUser?.id||"",status:f.status||"pendente",createdAt:f.createdAt||new Date().toISOString()};
    const ats=f.id?atividades.map(x=>x.id===f.id?a:x):[...atividades,a];
    setSalvandoComercial("atividade");
    try{
      await persistirComercial({atividades:ats,leads:leads.map(l=>l.id===a.leadId?{...l,proximaAtividade:a.titulo,proximaAtividadeEm:a.dataHora}:l)},{mensagem:f.id?"Tarefa atualizada.":"Tarefa cadastrada.",aoConfirmar:()=>setAtividadeForm(null)});
    }finally{setSalvandoComercial("");}
  };
  const salvarReuniao=async f=>{
    if(!f.leadId||!f.dataHora){showToast("Informe lead, data e horário.","error");return;}
    const anterior=f.id?reunioes.find(x=>x.id===f.id):null;
    const executada=f.status==="realizada";
    if(executada&&!String(f.resumo||"").trim()){
      showToast("Para confirmar a execução, registre o resumo da reunião.","error");return;
    }
    const now=new Date().toISOString();
    const primeiraConfirmacao=executada&&anterior?.status!=="realizada";
    const r={...f,id:f.id||uid(),orcamentoDisponivel:Number(f.orcamentoDisponivel||0),
      status:f.status||"agendada",createdAt:f.createdAt||anterior?.createdAt||now,
      updatedAt:now,realizadaEm:executada?(f.realizadaEm||now):"",
      realizadaPorId:executada?(f.realizadaPorId||currentUser?.id||""):"",
      realizadaPor:executada?(f.realizadaPor||currentUser?.nome||"Comercial"):""};
    const proximoHorario=r.proximoContato?`${r.proximoContato}T09:00`:"";
    const leadsAtualizados=leads.map(l=>{
      if(l.id!==r.leadId)return l;
      const historico=[...(l.historico||[])];
      if(primeiraConfirmacao)historico.push({id:uid(),data:r.realizadaEm,tipo:"reuniao",
        reuniaoId:r.id,texto:`Reunião executada por ${r.realizadaPor}. ${r.resumo}${r.proximosPassos?` Próximos passos: ${r.proximosPassos}`:""}${r.objecoes?` Objeções: ${r.objecoes}`:""}`});
      return {...l,
        etapa:executada?"reuniao_realizada":l.etapa==="novo"?"reuniao_agendada":l.etapa,
        etapaDesde:executada&&l.etapa!=="reuniao_realizada"?now:l.etapaDesde,
        proximaAtividade:executada?(r.proximosPassos||"Follow-up após reunião"):"Reunião",
        proximaAtividadeEm:executada?(proximoHorario||l.proximaAtividadeEm):r.dataHora,
        historico,updatedAt:now};
    });
    setSalvandoComercial("reuniao");
    try{
      await persistirComercial({
        reunioes:f.id?reunioes.map(x=>x.id===f.id?r:x):[...reunioes,r],
        leads:leadsAtualizados,
      },{
        mensagem:executada?"Reunião confirmada e registrada no histórico do lead.":anterior?"Reunião atualizada.":"Reunião agendada.",
        aoConfirmar:()=>{
          setLeadForm(aberta=>aberta?.id===r.leadId?(leadsAtualizados.find(l=>l.id===r.leadId)||aberta):aberta);
          setReuniaoForm(null);
        },
      });
    }finally{setSalvandoComercial("");}
  };

  const propostaVazia=leadId=>{const l=leadBy(leadId);return{id:"",numero:`PROP-${String(propostas.length+1).padStart(4,"0")}`,versao:1,leadId:leadId||"",objeto:l?.servico||"",escopo:"",inclusos:"",exclusos:"",entregaveis:"",prazo:l?.prazoDesejado||"",valor:l?.orcamentoEstimado||"",formaPagamento:"",validade:"",responsabilidades:"",premissas:"",status:"rascunho",desconto:"",documentos:[],historico:[],negociacoes:[]};};
  const contratoVazio=()=>({id:"",numero:`CONT-${String(contratos.length+1).padStart(4,"0")}`,leadId:"",propostaId:"",clienteId:"",contratante:"",objeto:"",escopo:"",valor:"",entrada:"",parcelas:"1",diaVencimento:"5",prazo:"",inicio:"",conclusao:"",responsabilidades:"",responsavelComercialId:currentUser?.id||"",responsavelTecnicoId:"",status:"elaboracao",assinaturaUrl:"",documentosRecebidos:false,entradaPaga:false,escopoValidado:false,documentos:[]});
  const salvarProposta=async f=>{
    if(!String(f.numero||"").trim()){showToast("Informe o número da proposta.","error");return;}
    if(f.status!=="rascunho"&&(!f.leadId||!f.objeto||!(Number(f.valor)>0))){showToast("Para avançar a proposta, informe lead, objeto e valor.","error");return;}
    if(Number(f.desconto||0)>limiteDesconto){showToast(`Seu limite de desconto é ${limiteDesconto}%. Solicite aprovação para continuar.`,"error");return;}
    const p={...f,id:f.id||uid(),status:f.status||"rascunho",versao:Number(f.versao||1),valor:Number(f.valor||0),desconto:Number(f.desconto||0),createdAt:f.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),historico:[...(f.historico||[]),{id:uid(),data:new Date().toISOString(),tipo:f.id?"revisao":"criacao",texto:f.id?`Versão ${f.versao} salva`:"Proposta salva como rascunho"}]};
    setSalvandoComercial("proposta");
    try{
      await persistirComercial({propostas:f.id?propostas.map(x=>x.id===f.id?p:x):[...propostas,p],leads:leads.map(l=>l.id===p.leadId?{...l,etapa:p.status==="enviada"?"proposta_enviada":"proposta_elaboracao",etapaDesde:new Date().toISOString()}:l)},{mensagem:"Proposta salva.",aoConfirmar:()=>setPropostaForm(null)});
    }finally{setSalvandoComercial("");}
  };
  // Achado P1 da auditoria de 18/08/2026: gravava com setCom puro, sem checar
  // o resultado - e é a mesma função que gera contrato automaticamente ao
  // aceitar a proposta. Convertida para persistirComercial (mesmo padrão
  // já usado no resto do arquivo) para avisar o vendedor se a gravação falhar.
  const statusProposta=async(p,status)=>{
    if(["enviada","aceita"].includes(status)&&(!p.leadId||!p.objeto||!(Number(p.valor)>0))){showToast("Complete lead, objeto e valor antes de avançar a proposta.","error");return;}
    const now=new Date().toISOString(),campo=status==="enviada"?"enviadoEm":status==="visualizada"?"visualizadoEm":status==="aceita"?"aceitoEm":status==="rejeitada"?"rejeitadoEm":"",l=leadBy(p.leadId),ja=contratos.find(k=>k.propostaId===p.id);
    const contratoAuto=status==="aceita"&&!ja?{id:uid(),numero:`CONT-${String(contratos.length+1).padStart(4,"0")}`,leadId:p.leadId,propostaId:p.id,clienteId:"",contratante:l?.nome||"",contratada:data.config.companyName||"ARCD OBRAS",objeto:p.objeto,escopo:p.escopo,valor:p.valor,entrada:0,parcelas:1,diaVencimento:5,prazo:p.prazo,inicio:"",conclusao:"",responsabilidades:p.responsabilidades,responsavelComercialId:l?.responsavelId||"",responsavelTecnicoId:"",status:"elaboracao",assinaturaUrl:"",documentosRecebidos:false,entradaPaga:false,escopoValidado:false,documentos:[],elaboradoEm:now}:null;
    setSalvandoComercial(`proposta-status-${p.id}`);
    try{
      await persistirComercial({
        propostas:propostas.map(x=>x.id===p.id?{...x,status,...(campo?{[campo]:now}:{}),historico:[...(x.historico||[]),{id:uid(),data:now,tipo:"status",texto:`Status: ${status}`}]}:x),
        leads:leads.map(x=>x.id===p.leadId?{...x,etapa:status==="enviada"?"proposta_enviada":status==="aceita"?"contrato_elaboracao":status==="negociacao"?"negociacao":x.etapa,etapaDesde:now}:x),
        ...(contratoAuto?{contratos:[...contratos,contratoAuto]}:{}),
      },{
        mensagem:contratoAuto?"Proposta aceita e contrato gerado automaticamente.":"",
      });
    }finally{setSalvandoComercial("");}
  };
  const pdfProposta=p=>{const l=leadBy(p.leadId),html=`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(p.numero)}</title><style>body{font-family:Arial;margin:38px;color:#151515}h1{font-size:22px}h2{font-size:14px;margin-top:22px;border-bottom:1px solid #ccc;padding-bottom:5px}.head{display:flex;justify-content:space-between}.value{font-size:22px;font-weight:bold}.box{background:#f5f5f5;padding:12px;margin:10px 0;white-space:pre-wrap}footer{margin-top:40px;font-size:10px;color:#666}@media print{button{display:none}}</style></head><body><button onclick="print()">Imprimir / salvar PDF</button><div class="head"><div><h1>${escapeHtml(data.config.companyName||"ARCD OBRAS")}</h1><p>${escapeHtml(data.config.cnpj||"")}</p></div><div><b>${escapeHtml(p.numero)} · V${p.versao}</b><p>Validade: ${escapeHtml(fmtDate(p.validade))}</p></div></div><h2>CLIENTE</h2><p>${escapeHtml(l?.nome||"")} · ${escapeHtml(l?.email||"")} · ${escapeHtml(l?.whatsapp||"")}</p><h2>OBJETO</h2><div class="box">${escapeHtml(p.objeto)}</div><h2>ESCOPO</h2><div class="box">${escapeHtml(p.escopo)}</div><h2>INCLUSOS / NÃO INCLUSOS</h2><div class="box">${escapeHtml(p.inclusos)}\n\nNão inclusos:\n${escapeHtml(p.exclusos)}</div><h2>ENTREGÁVEIS E PRAZO</h2><div class="box">${escapeHtml(p.entregaveis)}\nPrazo: ${escapeHtml(p.prazo)}</div><h2>INVESTIMENTO</h2><p class="value">${fmt(p.valor)}</p><div class="box">${escapeHtml(p.formaPagamento)}</div><h2>RESPONSABILIDADES E PREMISSAS</h2><div class="box">${escapeHtml(p.responsabilidades)}\n\n${escapeHtml(p.premissas)}</div><footer>Gerado pelo ARCD OBRAS em ${new Date().toLocaleString("pt-BR")}</footer></body></html>`;const w=window.open("","_blank");w.document.write(html);w.document.close();};
  const compartilharProposta=p=>{const l=leadBy(p.leadId),texto=`Olá ${l?.nome||""}, segue a proposta ${p.numero} (versão ${p.versao}) para ${p.objeto}, no valor de ${fmt(p.valor)}. Validade: ${fmtDate(p.validade)}.`;navigator.clipboard.writeText(texto).then(()=>showToast("Mensagem copiada para WhatsApp."));};
  const salvarNegociacao=async f=>{
    const p=propostas.find(x=>x.id===f.propostaId);if(!p)return;
    if(Number(f.desconto||0)>limiteDesconto&&!f.aprovadorId){showToast(`Desconto acima de ${limiteDesconto}% exige responsável pela aprovação.`,"error");return;}
    const n={...f,id:uid(),valorInicial:Number(f.valorInicial||p.valor),valorNegociado:Number(f.valorNegociado||0),desconto:Number(f.desconto||0),data:new Date().toISOString(),responsavelId:currentUser?.id||"",aprovado:Number(f.desconto||0)<=limiteDesconto||!!f.aprovadorId};
    setSalvandoComercial("negociacao");
    try{
      await persistirComercial({propostas:propostas.map(x=>x.id===p.id?{...x,status:"negociacao",negociacoes:[...(x.negociacoes||[]),n],valor:n.valorNegociado||x.valor}:x),leads:leads.map(l=>l.id===p.leadId?{...l,etapa:"negociacao",etapaDesde:new Date().toISOString()}:l)},{mensagem:"Negociação salva.",aoConfirmar:()=>setNegForm(null)});
    }finally{setSalvandoComercial("");}
  };
  const criarContrato=p=>{
    const existente=contratos.find(k=>k.propostaId===p.id);
    if(existente){setContratoForm({...existente});return;}
    const abrirFormularioContrato=()=>{
      const l=leadBy(p.leadId);
      setContratoForm({id:"",numero:`CONT-${String(contratos.length+1).padStart(4,"0")}`,leadId:p.leadId,propostaId:p.id,clienteId:"",contratante:l?.nome||"",objeto:p.objeto,escopo:p.escopo,valor:p.valor,entrada:"",parcelas:"1",diaVencimento:"5",prazo:p.prazo,inicio:"",conclusao:"",responsabilidades:p.responsabilidades,responsavelComercialId:l?.responsavelId||"",responsavelTecnicoId:"",status:"elaboracao",assinaturaUrl:"",documentosRecebidos:false,entradaPaga:false,escopoValidado:false,documentos:[]});
    };
    if(p.status!=="aceita"){
      setConfirmModal({
        titulo:"Proposta ainda não aceita",
        mensagem:"A proposta ainda não está aceita. Criar contrato mesmo assim?",
        confirmLabel:"Criar contrato mesmo assim",
        onConfirmar:abrirFormularioContrato,
      });
      return;
    }
    abrirFormularioContrato();
  };
  const salvarContrato=async f=>{
    if(!String(f.numero||"").trim()){showToast("Informe o número do contrato.","error");return;}
    const k={...f,id:f.id||uid(),status:f.status||"elaboracao",valor:Number(f.valor||0),entrada:Number(f.entrada||0),parcelas:Number(f.parcelas||1),diaVencimento:Number(f.diaVencimento||5),elaboradoEm:f.elaboradoEm||new Date().toISOString(),atualizadoEm:new Date().toISOString()};
    setSalvandoComercial("contrato");
    try{
      await persistirComercial({contratos:f.id?contratos.map(x=>x.id===f.id?k:x):[...contratos,k],leads:leads.map(l=>l.id===k.leadId?{...l,etapa:k.status==="enviado"?"contrato_enviado":"contrato_elaboracao",etapaDesde:new Date().toISOString()}:l)},{mensagem:"Contrato salvo como rascunho.",aoConfirmar:()=>setContratoForm(null)});
    }finally{setSalvandoComercial("");}
  };
  // Achado P1 da auditoria de 18/08/2026: os botões "ENVIAR" e "REGISTRAR
  // ASSINATURA" do card de contrato gravavam com setCom puro, sem checar o
  // resultado. Extraídas para funções nomeadas usando persistirComercial
  // (mesmo padrão do resto do arquivo) + trava contra duplo-clique.
  const enviarContrato=async k=>{
    if(!k.leadId||!k.contratante||!(Number(k.valor)>0)){showToast("Complete lead, contratante e valor antes de enviar.","error");return;}
    setSalvandoComercial(`contrato-enviar-${k.id}`);
    try{
      await persistirComercial({contratos:contratos.map(x=>x.id===k.id?{...x,status:"enviado",enviadoEm:new Date().toISOString()}:x)},{mensagem:"Contrato enviado."});
    }finally{setSalvandoComercial("");}
  };
  const registrarAssinaturaContrato=async k=>{
    setSalvandoComercial(`contrato-assinatura-${k.id}`);
    try{
      await persistirComercial({
        contratos:contratos.map(x=>x.id===k.id?{...x,status:"assinado",assinadoEm:new Date().toISOString()}:x),
        leads:leads.map(x=>x.id===k.leadId?{...x,etapa:"contrato_assinado"}:x),
      },{mensagem:"Assinatura registrada."});
    }finally{setSalvandoComercial("");}
  };
  const finalizarContrato=async k=>{
    if(!dispatchCommand){
      showToast("O comando de ativação comercial não está disponível.","error");
      return;
    }
    const installmentCount=Math.max(1,Number(k.parcelas||1));
    const obraId=k.obraId||uid();
    setAtivandoContratoId(k.id);
    try{
      const result=await dispatchCommand(()=>({
        type:OPERATIONAL_COMMAND.COMMERCIAL_CONTRACT_ACTIVATED,
        idempotencyKey:`commercial-contract-activate-${k.id}-${uid()}`,
        actorId:currentUser?.id||"",
        actorName:currentUser?.nome||"",
        payload:{
          contractId:k.id,
          obraId,
          ids:{
            clientId:uid(),
            obraId,
            saleId:uid(),
            commissionId:uid(),
            kickoffId:uid(),
            postSaleId:uid(),
            entryMeasurementId:uid(),
            entryReceiptId:uid(),
            installmentMeasurementIds:Array.from({length:installmentCount},()=>uid()),
          },
        },
      }));
      if(!result?.ok){
        showToast(result?.reason||"Não foi possível confirmar e transferir a venda.","error");
        return;
      }
      showToast("Venda confirmada: cliente, obra, contas, comissão, kickoff e pós-venda criados.");
    }finally{
      setAtivandoContratoId("");
    }
  };

  const clienteVazio=()=>({id:"",leadId:"",nome:"",tipoPessoa:"PF",documento:"",rg:"",orgaoExpedidor:"",dataNascimento:"",nacionalidade:"Brasileira",estadoCivil:"",regimeBens:"",profissao:"",conjugeNome:"",conjugeCpf:"",telefone:"",whatsapp:"",email:"",cep:"",endereco:"",numero:"",complemento:"",bairro:"",cidade:"",uf:"PE",razaoSocial:"",nomeFantasia:"",inscricaoEstadual:"",inscricaoMunicipal:"",representanteNome:"",representanteCpf:"",representanteRg:"",representanteOrgaoExpedidor:"",representanteCargo:"",representanteNacionalidade:"Brasileira",representanteEstadoCivil:"",representanteProfissao:"",observacoes:""});
  const pendenciasCliente=c=>{
    const comuns=[["documento",c.tipoPessoa==="PJ"?"CNPJ":"CPF"],["telefone","telefone"],["email","e-mail"],["cep","CEP"],["endereco","logradouro"],["numero","número"],["bairro","bairro"],["cidade","cidade"],["uf","UF"]];
    const especificos=c.tipoPessoa==="PJ"
      ? [["razaoSocial","razão social"],["representanteNome","representante legal"],["representanteCpf","CPF do representante"],["representanteRg","RG do representante"],["representanteOrgaoExpedidor","órgão expedidor do representante"],["representanteCargo","cargo do representante"],["representanteNacionalidade","nacionalidade do representante"],["representanteEstadoCivil","estado civil do representante"],["representanteProfissao","profissão do representante"]]
      : [["rg","RG"],["orgaoExpedidor","órgão expedidor"],["nacionalidade","nacionalidade"],["estadoCivil","estado civil"],["profissao","profissão"],...(["Casado(a)","União estável"].includes(c.estadoCivil)?[["regimeBens","regime de bens"],["conjugeNome","nome do cônjuge/companheiro"]]:[])];
    return [...comuns,...especificos].filter(([campo])=>!String(c[campo]||"").trim()).map(([,nome])=>nome);
  };
  const salvarCliente=async f=>{
    if(!f?.nome?.trim()){showToast("Informe o nome do cliente.","error");return;}
    const documento=soDigitos(f.documento);
    if(!documento){showToast(`Informe o ${f.tipoPessoa==="PJ"?"CNPJ":"CPF"}.`,"error");return;}
    if(!validarDocumento(documento,f.tipoPessoa)){showToast(`${f.tipoPessoa==="PJ"?"CNPJ":"CPF"} inválido. Confira os dígitos.`,"error");return;}
    const representanteCpf=soDigitos(f.representanteCpf);
    if(f.tipoPessoa==="PJ"&&representanteCpf&&!validarDocumento(representanteCpf,"PF")){showToast("CPF do representante legal inválido.","error");return;}
    const conjugeCpf=soDigitos(f.conjugeCpf);
    if(f.tipoPessoa==="PF"&&conjugeCpf&&!validarDocumento(conjugeCpf,"PF")){showToast("CPF do cônjuge inválido.","error");return;}
    const cliente={...f,id:f.id||uid(),nome:f.nome.trim(),documento,representanteCpf,conjugeCpf,createdAt:f.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    const lista=f.id?clientes.map(c=>c.id===f.id?cliente:c):[...clientes,cliente];
    setSalvandoComercial("cliente");
    try{
      await persistirComercial({
        clientes:lista,
        contratos:contratos.map(k=>k.clienteId===cliente.id?{...k,contratante:cliente.tipoPessoa==="PJ"?(cliente.razaoSocial||cliente.nome):cliente.nome}:k),
      },{
        mensagem:f.id?"Cliente atualizado.":"Cliente cadastrado.",
        aoConfirmar:()=>setClienteForm(null),
      });
    }finally{setSalvandoComercial("");}
  };
  const salvarParceiro=async f=>{
    if(!f.nome)return;
    const p={...f,id:f.id||uid(),comissaoPct:Number(f.comissaoPct||0),ativo:true};
    setSalvandoComercial("parceiro");
    try{
      await persistirComercial({parceiros:f.id?parceiros.map(x=>x.id===f.id?p:x):[...parceiros,p]},{mensagem:f.id?"Parceiro atualizado.":"Parceiro cadastrado.",aoConfirmar:()=>setParceiroForm(null)});
    }finally{setSalvandoComercial("");}
  };
  const salvarMeta=async f=>{
    if(!f.periodo)return;
    const m={...f,id:f.id||uid(),receita:Number(f.receita||0),contratos:Number(f.contratos||0),ticketMedio:Number(f.ticketMedio||0),conversao:Number(f.conversao||0)};
    setSalvandoComercial("meta");
    try{
      await persistirComercial({metas:f.id?metas.map(x=>x.id===f.id?m:x):[...metas,m]},{mensagem:f.id?"Meta atualizada.":"Meta cadastrada.",aoConfirmar:()=>setMetaForm(null)});
    }finally{setSalvandoComercial("");}
  };
  const exportarRelatorio=async()=>{await carregarXLSX();const rows=vendedores.map(v=>({Vendedor:v.nome,Leads:v.leads,Vendas:v.vendas,Receita:v.receita,"Conversão %":v.conversao}));const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Comercial");await XLSX.writeFile(wb,`ARCD_Comercial_${today()}.xlsx`);};

  const anexarDocumentoComercial=async(tipo,registro,setRegistro,file)=>{
    if(!file)return;
    if(file.size>5.5*1024*1024){showToast("O documento deve ter no máximo 5,5 MB.","error");return;}
    setSubindoDocumentoComercial(true);
    try{
      const dataUrl=await arquivoComoDataUrl(file);
      const pasta=tipo==="proposta"?"Propostas comerciais":"Contratos comerciais";
      const referencia=String(registro.numero||"Rascunhos").replace(/[\\/:*?"<>|]/g,"-");
      const resp=await enviarArquivoOneDrive({dataUrl,obraName:"Comercial",category:"comercial",
        subfolder:`${pasta}/${referencia}`,date:today(),fileName:file.name});
      if(!resp.ok&&!resp.url)throw new Error(resp.error||"Falha ao salvar o documento no OneDrive.");
      const documento={id:resp.item?.id||uid(),nome:resp.item?.name||file.name,
        legenda:String(file.name||"Documento").replace(/\.[^.]+$/,""),url:resp.item?.webUrl||resp.url,
        path:resp.path||"",tipo:file.type||"",tamanho:Number(file.size||0),
        enviadoEm:new Date().toISOString(),enviadoPorId:currentUser?.id||"",enviadoPor:currentUser?.nome||""};
      setRegistro(atual=>({...atual,documentos:[...(atual.documentos||[]),documento]}));
      showToast("Documento anexado e salvo no OneDrive.");
    }catch(err){showToast(err.message||"Não foi possível anexar o documento.","error");}
    finally{setSubindoDocumentoComercial(false);}
  };

  const anexarArquivoImobiliario=async(tipo,registro,file)=>{
    if(!file)return null;
    if(file.size>5.5*1024*1024){showToast("O arquivo deve ter no máximo 5,5 MB.","error");return null;}
    setSubindoDocumentoComercial(true);
    try{
      const dataUrl=await arquivoComoDataUrl(file);
      const referencia=String(registro.nome||registro.titulo||registro.codigo||"Sem referência").replace(/[\\/:*?"<>|]/g,"-");
      const resp=await enviarArquivoOneDrive({dataUrl,obraName:"Comercial imobiliário",category:"imoveis",
        subfolder:`${referencia}/${tipo}`,date:today(),fileName:file.name});
      if(!resp.ok&&!resp.url)throw new Error(resp.error||"Falha ao salvar o arquivo no OneDrive.");
      const documento={id:resp.item?.id||uid(),nome:resp.item?.name||file.name,
        legenda:String(file.name||"Arquivo").replace(/\.[^.]+$/,""),url:resp.item?.webUrl||resp.url,
        path:resp.path||"",tipo:file.type||"",categoria:tipo,tamanho:Number(file.size||0),
        enviadoEm:new Date().toISOString(),enviadoPorId:currentUser?.id||"",enviadoPor:currentUser?.nome||""};
      showToast("Arquivo do imóvel salvo no OneDrive.");
      return documento;
    }catch(err){showToast(err.message||"Não foi possível anexar o arquivo.","error");return null;}
    finally{setSubindoDocumentoComercial(false);}
  };

  const DocumentosComerciais = ({ tipo, registro, setRegistro }) => (
    <div
      style={{
        gridColumn: "1/-1",
        padding: "10px",
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        background: C.surface,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, color: C.text }}>
            Documentos anexados
          </p>
          <p style={{ fontSize: 8.5, color: C.muted, marginTop: 2 }}>
            PDF, Word, Excel ou imagem · máximo de 5,5 MB por arquivo
          </p>
        </div>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "7px 10px",
            border: `1px solid ${C.blue}`,
            borderRadius: 6,
            background: C.card,
            color: C.blue,
            fontSize: 9.5,
            fontWeight: 750,
            cursor: subindoDocumentoComercial ? "wait" : "pointer",
          }}
        >
          <Ic n={subindoDocumentoComercial ? "refresh" : "plus"} s={11} />
          {subindoDocumentoComercial ? "Enviando..." : "Anexar arquivo"}
          <input
            type="file"
            disabled={subindoDocumentoComercial}
            accept=".pdf,.doc,.docx,.xls,.xlsx,image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              anexarDocumentoComercial(tipo, registro, setRegistro, file);
            }}
          />
        </label>
      </div>
      {!!(registro.documentos || []).length && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 5,
            marginTop: 8,
          }}
        >
          {registro.documentos.map((doc) => (
            <div
              key={doc.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) auto auto",
                gap: 6,
                alignItems: "center",
                padding: "7px 8px",
                border: `1px solid ${C.line}`,
                borderRadius: 6,
                background: C.card,
              }}
            >
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  overflow: "hidden",
                  color: C.blue,
                  fontSize: 9.5,
                  fontWeight: 700,
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {doc.legenda || doc.nome} ↗
              </a>
              <span style={{ fontSize: 8, color: C.muted }}>
                {doc.tamanho
                  ? `${(doc.tamanho / 1024 / 1024).toFixed(1)} MB`
                  : ""}
              </span>
              <button
                type="button"
                title="Remover do cadastro"
                onClick={() =>
                  setRegistro((f) => ({
                    ...f,
                    documentos: (f.documentos || []).filter(
                      (d) => d.id !== doc.id,
                    ),
                  }))
                }
                style={{
                  width: 25,
                  height: 25,
                  border: `1px solid ${C.border}`,
                  borderRadius: 5,
                  background: C.card,
                  color: C.red,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const Titulo = ({ titulo, sub, acao }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <div>
        <p
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            color: C.green,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          Comercial
        </p>
        <h3
          style={{
            fontSize: "clamp(15px,3.5vw,19px)",
            color: C.text,
            fontWeight: 800,
            letterSpacing: -0.2,
          }}
        >
          {titulo}
        </h3>
        {sub && (
          <p style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{sub}</p>
        )}
      </div>
      {acao}
    </div>
  );
  const vazio = (t) => (
    <p
      style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: 18 }}
    >
      {t}
    </p>
  );
  const kpi = (l, v, c, sub) => (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: "10px 11px",
      }}
    >
      <p
        style={{
          fontSize: 8.5,
          color: C.muted,
          fontWeight: 800,
          textTransform: "uppercase",
        }}
      >
        {l}
      </p>
      <p style={{ fontSize: 17, fontWeight: 900, color: c, marginTop: 2 }}>
        {v}
      </p>
      {sub && (
        <p style={{ fontSize: 8.5, color: C.muted, marginTop: 1 }}>{sub}</p>
      )}
    </div>
  );
  const KpiCard = ({ label, value, sub, color, icon, tab }) => (
    <button
      onClick={() => tab && onTab(tab)}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        padding: "12px 13px",
        borderRadius: 8,
        textAlign: "left",
        color: C.text,
        cursor: tab ? "pointer" : "default",
        transition: "border-color .12s, background .12s",
        display: "flex",
        flexDirection: "column",
        gap: 7,
      }}
      onMouseEnter={(e) => {
        if (tab) e.currentTarget.style.borderColor = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.border;
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: C.muted,
            fontSize: 9.5,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          {label}
        </span>
        <Ic n={icon} s={13} color={color} />
      </div>
      <p
        style={{
          fontFamily: "'Inter Display','Inter',sans-serif",
          fontWeight: 800,
          color: C.text,
          fontSize: 22,
          letterSpacing: -0.3,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ color: C.muted, fontSize: 10, marginTop: -1 }}>{sub}</p>
      )}
      <div
        style={{
          height: 2,
          background: color,
          borderRadius: 99,
          opacity: 0.85,
          marginTop: 1,
        }}
      />
    </button>
  );

  const workspace = useMemo(() => selectCommercialWorkspace(com), [com]);
  let conteudo = null;
  if (commercialView === "com_indicacoes") {
    // Painel do motor de indicacao: quem traz negocio, se a carteira esta
    // produzindo, como esta a satisfacao e onde o funil vaza.
    const rank = rankingIndicadores(com);
    const tx = taxaIndicacao(com, data.obras);
    const nps = npsResumo(com.pesquisas);
    const acoes = momentosIndicacao(data);
    const conv = conversaoPorFase(leads);
    const ciclo = cicloMedioVenda(com);
    const maiorPerda = conv
      .slice(1)
      .reduce((m, l) => (l.perdaNaFase > (m?.perdaNaFase || 0) ? l : m), null);

    conteudo = (
      <>
        <Titulo
          titulo="Indicações"
          sub="O canal que mais traz negócio para a ARCD"
          acao={
            <Btn
              onClick={() =>
                setNpsForm({
                  id: "",
                  clienteId: "",
                  obraId: "",
                  nota: "",
                  comentario: "",
                  data: today(),
                  indicaria: true,
                  pediuIndicacao: false,
                })
              }
            >
              <Ic n="plus" /> PESQUISA
            </Btn>
          }
        />

        {/* ---- O TERMOMETRO DO MOTOR ---- */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: cols(2, 4, 4),
            gap: 8,
          }}
        >
          <KpiCard
            label="Indicações por obra entregue"
            value={tx.porObraEntregue.toFixed(1)}
            sub={`${tx.indicacoes} indicações · ${tx.obrasEntregues} obras`}
            color={
              tx.porObraEntregue >= 1.5
                ? C.green
                : tx.porObraEntregue >= 0.8
                  ? C.orange
                  : C.red
            }
            icon="users"
          />
          <KpiCard
            label="Carteira que indicou"
            value={`${tx.pctClientesAtivos.toFixed(0)}%`}
            sub={`${tx.clientesQueIndicaram} de ${tx.totalClientes} clientes`}
            color={tx.pctClientesAtivos >= 40 ? C.green : C.orange}
            icon="users"
          />
          <KpiCard
            label="NPS da entrega"
            value={nps.nps == null ? "-" : nps.nps.toFixed(0)}
            sub={
              nps.total
                ? `${nps.promotores} promotores · ${nps.detratores} detratores`
                : "sem pesquisa"
            }
            color={
              nps.nps == null
                ? C.muted
                : nps.nps >= 50
                  ? C.green
                  : nps.nps >= 0
                    ? C.orange
                    : C.red
            }
            icon="chart"
          />
          <KpiCard
            label="Ciclo médio de venda"
            value={ciclo.n ? `${ciclo.medio.toFixed(0)}d` : "-"}
            sub={
              ciclo.n
                ? `mediana ${ciclo.mediana}d · ${ciclo.n} vendas`
                : "sem venda fechada"
            }
            color={C.blue}
            icon="clock"
          />
        </div>

        {/* ---- ACOES DO MOMENTO ---- */}
        {acoes.length > 0 && (
          <div
            style={{
              background: `${C.yellow}0C`,
              border: `1.5px solid ${C.yellow}66`,
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: C.yellowD,
                marginBottom: 3,
              }}
            >
              {acoes.length} ação(ões) para gerar indicação agora
            </p>
            <p
              style={{
                fontSize: 10,
                color: C.muted,
                marginBottom: 9,
                lineHeight: 1.45,
              }}
            >
              Indicação não é sorte: existem momentos em que o cliente está mais
              propenso.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {acoes.slice(0, 8).map((a, i) => {
                const cor =
                  a.tipo === "recuperar"
                    ? C.red
                    : a.tipo === "nps"
                      ? C.blue
                      : a.tipo === "pedir"
                        ? C.green
                        : C.orange;
                return (
                  <div
                    key={i}
                    style={{
                      background: C.card,
                      border: `1px solid ${C.border}`,
                      borderLeft: `3px solid ${cor}`,
                      borderRadius: 7,
                      padding: "8px 11px",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          color: C.text,
                        }}
                      >
                        {a.titulo}
                      </p>
                      <p
                        style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}
                      >
                        {a.obraNome}
                        {a.clienteNome ? ` · ${a.clienteNome}` : ""} —{" "}
                        {a.motivo}
                      </p>
                    </div>
                    {a.tipo === "nps" && (
                      <Btn
                        size="sm"
                        v="ghost"
                        onClick={() =>
                          setNpsForm({
                            id: "",
                            clienteId: a.clienteId,
                            obraId: a.obraId,
                            nota: "",
                            comentario: "",
                            data: today(),
                            indicaria: true,
                            pediuIndicacao: false,
                          })
                        }
                      >
                        Registrar
                      </Btn>
                    )}
                    {a.tipo === "pedir" && (
                      <Btn
                        size="sm"
                        v="ghost"
                        disabled={!!salvandoComercial}
                        onClick={() => marcarPedidoIndicacao(a.obraId)}
                      >
                        {salvandoComercial===`marcar-indicacao-${a.obraId}`?"Registrando...":"Pedi"}
                      </Btn>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- RANKING DE INDICADORES ---- */}
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: C.muted,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 6,
            }}
          >
            Quem traz negócio
          </p>
          {rank.length === 0 ? (
            vazio(
              "Nenhuma indicação registrada ainda. Preencha 'Indicado por' ao cadastrar o lead.",
            )
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rank.map((r, i) => (
                <div
                  key={r.chave}
                  style={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderLeft: `4px solid ${i === 0 ? C.yellow : C.border}`,
                    borderRadius: 7,
                    padding: "10px 12px",
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{ fontSize: 12.5, fontWeight: 900, color: C.text }}
                    >
                      {r.nome}
                      {i === 0 && (
                        <span
                          style={{
                            fontSize: 9,
                            color: C.yellowD,
                            fontWeight: 800,
                            marginLeft: 6,
                            background: `${C.yellow}22`,
                            padding: "1px 6px",
                            borderRadius: 99,
                          }}
                        >
                          MAIOR INDICADOR
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                      {r.total} indicação(ões) · {r.ganhos} fechada(s) ·{" "}
                      {r.emAberto} em aberto
                      {r.perdidos > 0 ? ` · ${r.perdidos} perdida(s)` : ""}
                    </p>
                    <p
                      style={{
                        fontSize: 9.5,
                        color: r.conversao >= 50 ? C.green : C.muted,
                        marginTop: 2,
                        fontWeight: 700,
                      }}
                    >
                      {r.conversao.toFixed(0)}% de conversão
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <b style={{ fontSize: 13, color: C.yellowD }}>
                      {fmt(r.valorGerado)}
                    </b>
                    <p style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
                      gerado
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- ONDE O FUNIL VAZA ---- */}
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: C.muted,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 6,
            }}
          >
            Onde o funil vaza
          </p>
          {maiorPerda && maiorPerda.perdaNaFase > 0 && (
            <div
              style={{
                background: `${C.red}0A`,
                border: `1px solid ${C.red}44`,
                borderRadius: 8,
                padding: "9px 12px",
                marginBottom: 8,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: C.red,
                  fontWeight: 700,
                  lineHeight: 1.45,
                }}
              >
                Maior perda na fase <b>{maiorPerda.label}</b>:{" "}
                {maiorPerda.perdaNaFase} lead(s) não passaram daqui.
              </p>
            </div>
          )}
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {conv.map((l, i) => {
              const largura = conv[0].alcancaram
                ? (l.alcancaram / conv[0].alcancaram) * 100
                : 0;
              return (
                <div
                  key={l.id}
                  style={{
                    padding: "8px 12px",
                    borderTop: i ? `1px solid ${C.line}` : "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{ fontSize: 11, color: C.text, fontWeight: 600 }}
                    >
                      {l.label}
                    </span>
                    <span style={{ fontSize: 10.5, color: C.muted }}>
                      {l.alcancaram}
                      {i > 0 && (
                        <b
                          style={{
                            color:
                              l.taxaDaAnterior >= 70
                                ? C.green
                                : l.taxaDaAnterior >= 40
                                  ? C.orange
                                  : C.red,
                            marginLeft: 6,
                          }}
                        >
                          {l.taxaDaAnterior.toFixed(0)}%
                        </b>
                      )}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: C.surface,
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${largura}%`,
                        background: l.cor || C.blue,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- PESQUISAS REGISTRADAS ---- */}
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: C.muted,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 6,
            }}
          >
            Satisfação na entrega
          </p>
          {(com.pesquisas || []).length === 0 ? (
            vazio("Nenhuma pesquisa registrada.")
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(com.pesquisas || [])
                .slice()
                .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
                .map((p) => {
                  const cor =
                    p.nota >= 9 ? C.green : p.nota >= 7 ? C.orange : C.red;
                  const rot =
                    p.nota >= 9
                      ? "promotor"
                      : p.nota >= 7
                        ? "neutro"
                        : "detrator";
                  const cli = (com.clientes || []).find(
                    (c) => c.id === p.clienteId,
                  );
                  const obr = (data.obras || []).find((o) => o.id === p.obraId);
                  return (
                    <div
                      key={p.id}
                      style={{
                        background: C.card,
                        border: `1px solid ${C.border}`,
                        borderLeft: `4px solid ${cor}`,
                        borderRadius: 7,
                        padding: "9px 12px",
                        display: "grid",
                        gridTemplateColumns: "auto minmax(0,1fr)",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ textAlign: "center", minWidth: 38 }}>
                        <b style={{ fontSize: 18, color: cor }}>{p.nota}</b>
                        <p
                          style={{
                            fontSize: 8,
                            color: cor,
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          {rot}
                        </p>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: C.text,
                          }}
                        >
                          {cli?.nome || obr?.cliente || "Cliente"}
                        </p>
                        <p style={{ fontSize: 9.5, color: C.muted }}>
                          {obr?.name || "-"} · {p.data ? fmtDate(p.data) : ""}
                        </p>
                        {p.comentario && (
                          <p
                            style={{
                              fontSize: 10,
                              color: C.subtle,
                              marginTop: 3,
                              fontStyle: "italic",
                            }}
                          >
                            "{p.comentario}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </>
    );
  }

  if(commercialView==="com_dash"){
    const novos=leads.filter(l=>l.createdAt?.slice(0,7)===mesAtual).length,semAt=leadAtivos.filter(l=>!l.proximaAtividadeEm).length,reu=reunioes.filter(r=>r.status==="agendada").length,prop=propostas.filter(p=>p.status==="enviada").length,cont=contratos.filter(k=>["enviado","aguardando_assinatura"].includes(k.status)).length,vendasMes=vendas.filter(v=>v.fechadaEm?.slice(0,7)===mesAtual),funil=leadAtivos.reduce((s,l)=>s+Number(l.orcamentoEstimado||0),0),ponderada=leadAtivos.reduce((s,l)=>s+Number(l.orcamentoEstimado||0)*Number(l.probabilidade||0)/100,0),receitaMes=vendasMes.reduce((s,v)=>s+Number(v.valor||0),0),ticket=vendasMes.length?receitaMes/vendasMes.length:0,conv=leads.length?vendas.length/leads.length*100:0,meta=metas.filter(m=>m.periodo===mesAtual).reduce((s,m)=>s+Number(m.receita||0),0),progressoMeta=meta?Math.min(100,receitaMes/meta*100):0;
    const perdas={};leads.filter(l=>l.etapa==="perdido").forEach(l=>perdas[l.motivoPerda||"Não informado"]=(perdas[l.motivoPerda||"Não informado"]||0)+1);
    const fases=COM_JORNADA.map(f=>{const lista=leadAtivos.filter(l=>comFaseDaEtapa(l.etapa)===f.id);return{...f,qtd:lista.length,valor:lista.reduce((s,l)=>s+Number(l.orcamentoEstimado||0),0)};});
    const topVendedores=[...vendedores].sort((a,b)=>b.receita-a.receita||b.vendas-a.vendas);
    const topOrigens=[...origens].sort((a,b)=>b.receita-a.receita||b.leads-a.leads);
    conteudo=<div className="commercial-dashboard">
      <Titulo titulo="Comando comercial" sub={`${leadAtivos.length} oportunidade(s) ativa(s) · acompanhamento do mês atual`}
        acao={<div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn v="ghost" onClick={()=>onTab("com_agenda")}><Ic n="calendar"/> Agenda</Btn><Btn onClick={()=>{setLeadForm(leadVazio());setLeadAba("geral");}}><Ic n="plus"/> Novo lead</Btn></div>}/>

      <section className="commercial-command-card">
        <div>
          <p className="commercial-eyebrow">Resultado do mês</p>
          <h2>{receitaMes>0?`${fmtCompact(receitaMes)} em vendas`:"Hora de transformar o funil em contratos"}</h2>
          <p>{alertas.length?`${alertas.length} ponto(s) precisam de ação para manter as oportunidades avançando.`:"A operação comercial está acompanhada e sem alertas críticos."}</p>
        </div>
        <div className="commercial-goal">
          <div><span>Meta mensal</span><b>{meta?fmtCompact(meta):"Não definida"}</b></div>
          <div className="commercial-goal-track"><i style={{transform:`scaleX(${progressoMeta/100})`}}/></div>
          <small>{meta?`${progressoMeta.toFixed(0)}% realizado · ${fmtCompact(Math.max(0,meta-receitaMes))} restante`:"Cadastre uma meta para acompanhar o ritmo de vendas."}</small>
        </div>
      </section>

      <div className="commercial-kpis">
        <KpiCard label="Funil ativo" value={fmtCompact(funil)} sub={`${leadAtivos.length} oportunidade(s)`} color={C.blue} icon="trending" tab="com_funil"/>
        <KpiCard label="Receita provável" value={fmtCompact(ponderada)} sub="Valor ponderado pela probabilidade" color={C.yellowD} icon="chart" tab="com_funil"/>
        <KpiCard label="Vendas no mês" value={vendasMes.length} sub={`${fmtCompact(receitaMes)} contratado(s)`} color={C.green} icon="check" tab="com_contratos"/>
        <KpiCard label="Conversão geral" value={`${conv.toFixed(1)}%`} sub={ticket?`Ticket do mês ${fmtCompact(ticket)}`:"Sem venda no mês"} color={conv>=20?C.green:C.orange} icon="target" tab="com_relatorios"/>
      </div>

      <section className="commercial-panel">
        <div className="commercial-panel-head"><div><p className="commercial-eyebrow">Pipeline</p><h3>Distribuição das oportunidades</h3></div><Btn size="sm" v="ghost" onClick={()=>onTab("com_funil")}>Abrir funil →</Btn></div>
        <div className="commercial-pipeline">{fases.map(f=><button key={f.id} onClick={()=>onTab("com_funil")} style={{"--stage-color":f.cor}}>
          <span>{f.label}</span><strong>{f.qtd}</strong><small>{fmtCompact(f.valor)}</small><i><em style={{width:`${leadAtivos.length?Math.max(5,f.qtd/leadAtivos.length*100):0}%`}}/></i>
        </button>)}</div>
      </section>

      <div className="commercial-dashboard-columns">
        <section className="commercial-panel">
          <div className="commercial-panel-head"><div><p className="commercial-eyebrow">Prioridades</p><h3>Próximas ações</h3></div><span className="commercial-count-alert">{alertas.length}</span></div>
          {!alertas.length?vazio("Nenhuma ação crítica agora."):<div className="commercial-action-list">{alertas.slice(0,6).map((a,i)=><button key={i} onClick={()=>{const l=leadBy(a.leadId);if(l){setLeadForm({...l});setLeadAba("geral");}}}>
            <i style={{background:a.cor}}/><span><b>{a.texto}</b><small>Abrir lead e registrar andamento</small></span><Ic n="chevronRight" s={12}/>
          </button>)}</div>}
        </section>

        <section className="commercial-panel">
          <div className="commercial-panel-head"><div><p className="commercial-eyebrow">Equipe</p><h3>Desempenho por vendedor</h3></div><Btn size="sm" v="ghost" onClick={()=>onTab("com_relatorios")}>Relatório →</Btn></div>
          {!topVendedores.length?vazio("Sem dados de vendedores."):<div className="commercial-ranking">{topVendedores.slice(0,6).map((v,i)=><div key={v.id}><span className="commercial-rank">{i+1}</span><span><b>{v.nome}</b><small>{v.leads} lead(s) · {v.conversao.toFixed(0)}% de conversão</small></span><strong>{fmtCompact(v.receita)}</strong></div>)}</div>}
        </section>
      </div>

      <div className="commercial-dashboard-columns">
        <section className="commercial-panel">
          <div className="commercial-panel-head"><div><p className="commercial-eyebrow">Aquisição</p><h3>Origens que geram negócio</h3></div><Btn size="sm" v="ghost" onClick={()=>onTab("com_indicacoes")}>Indicações →</Btn></div>
          {!topOrigens.length?vazio("Nenhuma origem registrada."):<div className="commercial-ranking">{topOrigens.slice(0,5).map((o,i)=><div key={o.origem}><span className="commercial-rank">{i+1}</span><span><b>{o.origem}</b><small>{o.leads} lead(s) · {o.vendas} venda(s)</small></span><strong>{fmtCompact(o.receita)}</strong></div>)}</div>}
        </section>
        <section className="commercial-panel">
          <div className="commercial-panel-head"><div><p className="commercial-eyebrow">Saúde do processo</p><h3>Pendências da operação</h3></div></div>
          <div className="commercial-health-grid">
            <button onClick={()=>onTab("com_leads")}><b style={{color:semAt?C.red:C.green}}>{semAt}</b><span>Sem atendimento</span></button>
            <button onClick={()=>onTab("com_reunioes")}><b style={{color:C.purple}}>{reu}</b><span>Reuniões agendadas</span></button>
            <button onClick={()=>onTab("com_propostas")}><b style={{color:C.orange}}>{prop}</b><span>Propostas enviadas</span></button>
            <button onClick={()=>onTab("com_contratos")}><b style={{color:cont?C.red:C.green}}>{cont}</b><span>Sem assinatura</span></button>
          </div>
          {!!Object.keys(perdas).length&&<p className="commercial-loss-note">Principal perda: <b>{Object.entries(perdas).sort((a,b)=>b[1]-a[1])[0]?.[0]}</b></p>}
        </section>
      </div>
    </div>;
  } else if(commercialView==="com_leads"){
    const lista=leads.filter(l=>isVisibleLead(l)&&[l.nome,l.telefone,l.email,l.cidade,l.servico,l.origem].join(" ").toLowerCase().includes(busca.toLowerCase()));conteudo=<><Titulo titulo="Leads" sub={`${leads.filter(isVisibleLead).length} cadastrado(s)`} acao={<Btn onClick={()=>{setLeadForm(leadVazio());setLeadAba("geral");}}><Ic n="plus"/> NOVO LEAD</Btn>}/><Inp value={busca} onChange={setBusca} placeholder="Buscar nome, telefone, cidade, serviço ou origem..."/><div style={{display:"flex",flexDirection:"column",gap:6}}>{lista.map(l=><button key={l.id} onClick={()=>{setLeadForm({...l});setLeadAba("geral");}} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:8,background:C.card,border:`1px solid ${C.border}`,borderLeft:`4px solid ${COM_TEMPERATURA[l.temperatura]||C.muted}`,borderRadius:6,padding:"9px 11px",cursor:"pointer",textAlign:"left"}}><div style={{minWidth:0}}><p style={{fontSize:12.5,fontWeight:900,color:C.text}}>{l.nome}</p><p style={{fontSize:10,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginTop:2}}>{l.servico||"Sem serviço"} · {l.cidade||"-"} · {l.origem||"Sem origem"}</p><p style={{fontSize:9.5,color:C.blue,marginTop:3}}>{comEtapaLabel(l.etapa)} · {nomeUsuario(l.responsavelId)} · próxima: {l.proximaAtividade||"-"} {l.proximaAtividadeEm?comDateTime(l.proximaAtividadeEm):""}</p></div><div style={{textAlign:"right"}}><b style={{fontSize:12,color:C.yellowD}}>{fmt(l.orcamentoEstimado)}</b><p style={{fontSize:9,color:C.muted,marginTop:2}}>{l.probabilidade}% · {l.temperatura}</p></div></button>)}{!lista.length&&vazio("Nenhum lead encontrado.")}</div></>;
  } else if(commercialView==="com_funil"){
    conteudo=<><Titulo titulo="Funil de vendas" sub="Arraste os cards; toda mudança fica registrada no histórico" acao={<Btn onClick={()=>{setLeadForm(leadVazio());setLeadAba("geral");}}><Ic n="plus"/> LEAD</Btn>}/><div style={{...KB.scroll,flexWrap:"wrap",overflowX:"visible",scrollSnapType:"none",rowGap:28,columnGap:8}}>{COM_ETAPAS.filter(([id])=>id!=="arquivado").map(([id,label])=>{const ls=leads.filter(l=>isVisibleLead(l)&&l.etapa===id);const soma=ls.reduce((s,l)=>s+(l.orcamentoEstimado||0),0);return <div key={id} onDragOver={e=>e.preventDefault()} onDrop={e=>{const l=leadBy(e.dataTransfer.getData("leadId"));if(l)moverLead(l,id);}} style={KB.coluna(C.blue,false)}><div onClick={()=>setColunaResumo({label,leads:ls})} title="Ver resumo de quem está nesta etapa" style={{...KB.colHead(C.blue),cursor:"pointer"}}><b style={{fontSize:10,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",minWidth:0}}>{label.toUpperCase()}</b><div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}><span style={KB.contador}>{ls.length}</span>{soma>0&&<span style={{fontSize:8.5,fontWeight:700,color:C.yellowD}}>{fmt(soma)}</span>}</div></div><div style={KB.colBody}>{ls.map(l=><div key={l.id} draggable onDragStart={e=>e.dataTransfer.setData("leadId",l.id)} onClick={()=>{setLeadForm({...l});setLeadAba("geral");}} style={{...KB.card(l.proximaAtividadeEm&&new Date(l.proximaAtividadeEm).getTime()<agora?C.red:null),borderLeft:`3px solid ${COM_TEMPERATURA[l.temperatura]||C.muted}`}}><div style={{display:"flex",justifyContent:"space-between",gap:5}}><p style={{fontSize:11,fontWeight:800,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",minWidth:0}}>{l.nome}</p><span style={{fontSize:9,color:C.yellowD,fontWeight:700,flexShrink:0}}>{fmt(l.orcamentoEstimado)}</span></div><p style={{fontSize:9,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.servico||"-"}</p><div style={{display:"flex",justifyContent:"space-between",gap:5,alignItems:"center"}}><span style={{fontSize:8.5,color:C.muted}}>{nomeUsuario(l.responsavelId)} · {l.probabilidade}%</span><span style={{fontSize:8.5,fontWeight:700,color:comDias(l.etapaDesde)>=5?C.orange:C.muted}}>{comDias(l.etapaDesde)}d</span></div><p style={{fontSize:8.5,color:l.proximaAtividadeEm&&new Date(l.proximaAtividadeEm).getTime()<agora?C.red:C.blue,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.proximaAtividadeEm&&new Date(l.proximaAtividadeEm).getTime()<agora?"⚠ ":""}{l.proximaAtividade||"Sem próxima atividade"}</p></div>)}{!ls.length&&<div style={{padding:"12px 6px",textAlign:"center",fontSize:9,color:C.muted,border:`1px dashed ${C.border}`,borderRadius:6,margin:"2px 0"}}>Solte aqui</div>}</div></div>;})}</div></>;
  } else if(commercialView==="com_jornada"){
    // KANBAN DA JORNADA DO CLIENTE
    // Colunas = fases da jornada (não as 20 etapas). O lead cai na coluna certa
    // pela sua etapa atual - e como o sistema já muda a etapa sozinho quando uma
    // proposta é enviada, um contrato assinado, etc., o card ANDA sem ninguém
    // arrastar. Dentro da coluna, ordena por urgência cronológica: primeiro quem
    // tem atividade vencida, depois quem está parado há mais tempo. Assim o topo
    // de cada coluna é sempre o que precisa de ação agora.
    const ordenarCronologico = (a,b) => {
      const vencA = a.proximaAtividadeEm && new Date(a.proximaAtividadeEm).getTime() < agora;
      const vencB = b.proximaAtividadeEm && new Date(b.proximaAtividadeEm).getTime() < agora;
      if (vencA !== vencB) return vencA ? -1 : 1;         // vencidos no topo
      // Ambos vencidos ou ambos não: mais tempo parado na etapa sobe.
      const paradoA = a.etapaDesde ? new Date(a.etapaDesde).getTime() : agora;
      const paradoB = b.etapaDesde ? new Date(b.etapaDesde).getTime() : agora;
      return paradoA - paradoB;                            // mais antigo primeiro
    };
    const totalAtivos = leadAtivos.length;
    conteudo = <>
      <Titulo titulo="Jornada do cliente"
        sub="As fases se ajustam sozinhas conforme o lead avança. Cada coluna ordena por urgência: vencidos e parados há mais tempo no topo."
        acao={<Btn onClick={()=>{setLeadForm(leadVazio());setLeadAba("geral");}}><Ic n="plus"/> LEAD</Btn>}/>
      <div style={KB.scroll}>
        {COM_JORNADA.map(fase => {
          const naFase = leadAtivos
            .filter(l => comFaseDaEtapa(l.etapa) === fase.id)
            .sort(ordenarCronologico);
          const valorFase = naFase.reduce((s,l)=>s+(l.orcamentoEstimado||0),0);
          return (
            <div key={fase.id}
              onDragOver={e=>e.preventDefault()}
              onDrop={e=>{
                const l=leadBy(e.dataTransfer.getData("leadId"));
                if(l && fase.etapas[0]) moverLead(l, fase.etapas[0]);
              }}
              style={KB.coluna(fase.cor,false)}>
              {/* Cabeçalho da fase */}
              <div style={KB.colHead(fase.cor)}>
                <div style={{minWidth:0}}>
                  <b style={{fontSize:11,color:C.text,letterSpacing:.3,whiteSpace:"nowrap"}}>{fase.label.toUpperCase()}</b>
                  <p style={{fontSize:8.5,color:C.muted,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{fase.desc}</p>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                  <span style={KB.contador}>{naFase.length}</span>
                  <span style={{fontSize:8.5,fontWeight:700,color:C.yellowD,whiteSpace:"nowrap"}}>{fmt(valorFase)}</span>
                </div>
              </div>
              {/* Cards */}
              <div style={KB.colBody}>
                {naFase.map(l => {
                  const vencido = l.proximaAtividadeEm && new Date(l.proximaAtividadeEm).getTime() < agora;
                  const diasParado = comDias(l.etapaDesde);
                  return (
                    <div key={l.id} draggable
                      onDragStart={e=>e.dataTransfer.setData("leadId",l.id)}
                      onClick={()=>{setLeadForm({...l});setLeadAba("geral");}}
                      style={{...KB.card(vencido?C.red:null),borderLeft:`3px solid ${COM_TEMPERATURA[l.temperatura]||C.muted}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:5}}>
                        <p style={{fontSize:11,fontWeight:800,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",minWidth:0}}>{l.nome}</p>
                        <span style={{fontSize:9,fontWeight:700,color:C.yellowD,flexShrink:0}}>{fmt(l.orcamentoEstimado)}</span>
                      </div>
                      <p style={{fontSize:9,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {comEtapaLabel(l.etapa)}
                      </p>
                      <div style={{display:"flex",justifyContent:"space-between",gap:5,alignItems:"center"}}>
                        <span style={{fontSize:8.5,color:C.muted}}>{nomeUsuario(l.responsavelId)}</span>
                        <span style={{fontSize:8.5,fontWeight:700,color:diasParado>=5?C.orange:C.muted}}>{diasParado}d</span>
                      </div>
                      {l.proximaAtividade
                        ? <p style={{fontSize:8.5,color:vencido?C.red:C.blue,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {vencido?"⚠ ":""}{l.proximaAtividade}
                          </p>
                        : <p style={{fontSize:8.5,color:C.red}}>⚠ Sem próxima atividade</p>}
                    </div>
                  );
                })}
                {!naFase.length && <div style={{padding:"12px 6px",textAlign:"center",fontSize:9,color:C.muted,border:`1px dashed ${C.border}`,borderRadius:6,margin:"2px 0"}}>Vazio</div>}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{fontSize:9.5,color:C.muted,marginTop:2,lineHeight:1.5}}>
        Os cards se movem sozinhos quando você registra ações (proposta enviada, contrato assinado…).
        Dentro de cada fase, o topo é sempre o mais urgente. Clique para abrir; arraste só se precisar corrigir a fase manualmente.
      </p>
    </>;
  } else if(["com_agenda","com_reunioes","com_tarefas"].includes(commercialView)){
    const itens=[...reunioes.map(r=>({...r,_tipo:"reuniao",titulo:`Reunião · ${leadBy(r.leadId)?.nome||"Lead"}`})),...atividades.map(a=>({...a,_tipo:"atividade"}))].sort((a,b)=>(a.dataHora||"").localeCompare(b.dataHora||""));
    const filtrados=commercialView==="com_reunioes"?itens.filter(x=>x._tipo==="reuniao"):commercialView==="com_tarefas"?itens.filter(x=>x._tipo==="atividade"):(calDia?itens.filter(x=>(x.dataHora||"").slice(0,10)===calDia):itens);
    const calRef=new Date();calRef.setDate(1);calRef.setMonth(calRef.getMonth()+calMes);
    const calAno=calRef.getFullYear(),calMesIdx=calRef.getMonth();
    const calDiasNoMes=new Date(calAno,calMesIdx+1,0).getDate();
    const calPrimeiroDiaSemana=new Date(calAno,calMesIdx,1).getDay();
    const calItensPorDia={};itens.forEach(x=>{if(!x.dataHora)return;const dia=x.dataHora.slice(0,10);(calItensPorDia[dia]=calItensPorDia[dia]||[]).push(x);});
    const calCelulas=[...Array(calPrimeiroDiaSemana).fill(null),...Array.from({length:calDiasNoMes},(_,i)=>{
      const dia=`${calAno}-${String(calMesIdx+1).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`;
      return {dia,numero:i+1,itens:calItensPorDia[dia]||[]};
    })];
    conteudo=<><Titulo titulo={commercialView==="com_agenda"?"Agenda comercial":commercialView==="com_reunioes"?"Reuniões":"Tarefas e follow-ups"} sub="Compromissos, responsáveis, próximos passos e histórico por lead" acao={<div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn size="sm" v="ghost" onClick={()=>onTab("com_funil")}>‹ Voltar ao Funil</Btn><Btn size="sm" onClick={()=>setAtividadeForm({id:"",leadId:"",tipo:"followup",titulo:"",dataHora:"",responsavelId:currentUser?.id||"",status:"pendente",observacoes:""})}>+ TAREFA</Btn><Btn size="sm" v="ghost" onClick={()=>setReuniaoForm({id:"",leadId:"",dataHora:"",tipo:"presencial",local:"",participantes:"",responsavelComercialId:currentUser?.id||"",responsavelTecnicoId:"",pauta:"",resumo:"",necessidades:"",objecoes:"",orcamentoDisponivel:"",proximosPassos:"",proximoContato:"",status:"agendada",documentos:[]})}>+ REUNIÃO</Btn></div>}/>
    {commercialView==="com_agenda"&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <button onClick={()=>setCalMes(m=>m-1)} style={{background:"transparent",border:0,cursor:"pointer",color:C.muted,fontSize:16,padding:"2px 10px"}}>‹</button>
        <b style={{fontSize:12,color:C.text,textTransform:"capitalize"}}>{calRef.toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</b>
        <button onClick={()=>setCalMes(m=>m+1)} style={{background:"transparent",border:0,cursor:"pointer",color:C.muted,fontSize:16,padding:"2px 10px"}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
        {["D","S","T","Q","Q","S","S"].map((d,i)=><span key={i} style={{textAlign:"center",fontSize:9,fontWeight:800,color:C.muted}}>{d}</span>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {calCelulas.map((c,i)=>c?(
          <button key={c.dia} onClick={()=>setCalDia(v=>v===c.dia?"":c.dia)}
            style={{aspectRatio:"1/1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,
              border:`1px solid ${calDia===c.dia?C.blue:C.border}`,borderRadius:6,
              background:calDia===c.dia?`${C.blue}14`:c.dia===today()?`${C.yellowD}10`:"transparent",cursor:"pointer"}}>
            <span style={{fontSize:10.5,fontWeight:calDia===c.dia?800:600,color:calDia===c.dia?C.blue:C.text}}>{c.numero}</span>
            {c.itens.length>0&&<span style={{fontSize:8,fontWeight:800,color:C.yellowD,background:`${C.yellowD}18`,borderRadius:99,padding:"0 4px"}}>{c.itens.length}</span>}
          </button>
        ):<div key={`vazio-${i}`}/>)}
      </div>
    </div>}
    {commercialView==="com_agenda"&&calDia&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <p style={{fontSize:10.5,color:C.muted}}>Mostrando compromissos de {fmtDate(calDia)}</p>
      <button onClick={()=>setCalDia("")} style={{background:"transparent",border:0,color:C.blue,fontSize:10.5,fontWeight:700,cursor:"pointer"}}>Ver todos</button>
    </div>}
    <div style={{display:"flex",flexDirection:"column",gap:6}}>{filtrados.map(x=>{const venc=x.dataHora&&new Date(x.dataHora).getTime()<agora&&!["concluida","realizada","cancelada"].includes(x.status);return <div key={`${x._tipo}-${x.id}`} style={{display:"grid",gridTemplateColumns:"145px minmax(0,1fr) auto",gap:8,alignItems:"center",background:C.card,border:`1px solid ${venc?C.red:C.border}`,borderLeft:`4px solid ${x.status==="realizada"?C.green:venc?C.red:C.blue}`,borderRadius:6,padding:"8px 10px"}}><div><b style={{fontSize:10,color:x.status==="realizada"?C.green:venc?C.red:C.blue}}>{comDateTime(x.dataHora)}</b><p style={{fontSize:8.5,color:C.muted}}>{x._tipo.toUpperCase()} · {x.status}</p></div><div><p style={{fontSize:11,fontWeight:800,color:C.text}}>{x.titulo||`Reunião · ${leadBy(x.leadId)?.nome||"Lead"}`}</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>{leadBy(x.leadId)?.nome||"-"} · {x.local||x.observacoes||""}</p>{x._tipo==="reuniao"&&x.status==="realizada"&&x.resumo&&<p style={{fontSize:9.5,color:C.green,marginTop:3}}>Executada · {x.resumo}</p>}</div><div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>{x._tipo==="atividade"&&x.status!=="concluida"&&<Btn size="sm" v="success" onClick={()=>setCom({atividades:atividades.map(a=>a.id===x.id?{...a,status:"concluida"}:a)})}>OK</Btn>}{x._tipo==="reuniao"&&x.status!=="realizada"&&x.status!=="cancelada"&&<Btn size="sm" v="success" onClick={()=>setReuniaoForm({...x,status:"realizada"})}><Ic n="check"/> Confirmar execução</Btn>}<Btn size="sm" v="ghost" onClick={()=>x._tipo==="atividade"?setAtividadeForm({...x}):setReuniaoForm({...x})}>{x._tipo==="reuniao"?"Abrir":"Editar"}</Btn></div></div>;})}{!filtrados.length&&vazio("Nenhum compromisso cadastrado.")}</div></>;
  } else if(["com_propostas","com_negociacoes"].includes(commercialView)){
    const lista=commercialView==="com_negociacoes"?propostas.filter(p=>(p.negociacoes||[]).length||p.status==="negociacao"):propostas;conteudo=<><Titulo titulo={commercialView==="com_propostas"?"Propostas":"Negociações"} sub="Versões, envio, visualização, descontos, aceite e rejeição" acao={<Btn onClick={()=>setPropostaForm(propostaVazia(leadAtivos[0]?.id||""))}><Ic n="plus"/> PROPOSTA</Btn>}/><div style={{display:"flex",flexDirection:"column",gap:7}}>{lista.map(p=>{const l=leadBy(p.leadId);return <div key={p.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 11px"}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><div><p style={{fontSize:12,fontWeight:900,color:C.text}}>{p.numero} · V{p.versao} · {l?.nome}</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>{p.objeto} · validade {fmtDate(p.validade)}</p></div><div style={{textAlign:"right"}}><b style={{color:C.yellowD}}>{fmt(p.valor)}</b><p style={{fontSize:9,color:C.blue}}>{p.status}</p></div></div>{(p.negociacoes||[]).slice(-1).map(n=><p key={n.id} style={{fontSize:9.5,color:C.orange,marginTop:5}}>Negociado: {fmt(n.valorInicial)} → {fmt(n.valorNegociado)} · desconto {n.desconto}%</p>)}<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:7}}><Btn size="sm" v="ghost" onClick={()=>setPropostaForm({...p,versao:p.versao+1})}><Ic n="edit"/></Btn><Btn size="sm" v="ghost" onClick={()=>pdfProposta(p)}>PDF</Btn><Btn size="sm" v="success" onClick={()=>compartilharProposta(p)}>WHATSAPP</Btn><a href={`mailto:${encodeURIComponent(l?.email||"")}?subject=${encodeURIComponent(`Proposta ${p.numero}`)}&body=${encodeURIComponent(`Olá ${l?.nome||""}, segue nossa proposta ${p.numero}, versão ${p.versao}, no valor de ${fmt(p.valor)}.`)}`} style={{textDecoration:"none"}}><Btn size="sm" v="ghost">E-MAIL</Btn></a>{p.status==="rascunho"&&<Btn size="sm" disabled={!!salvandoComercial} onClick={()=>statusProposta(p,"enviada")}>{salvandoComercial===`proposta-status-${p.id}`?"ENVIANDO...":"ENVIAR"}</Btn>}{p.status==="enviada"&&<Btn size="sm" v="ghost" disabled={!!salvandoComercial} onClick={()=>statusProposta(p,"visualizada")}>VISUALIZADA</Btn>}<Btn size="sm" v="ghost" onClick={()=>setNegForm({propostaId:p.id,valorInicial:p.valor,valorNegociado:p.valor,desconto:"",formaPagamento:p.formaPagamento,parcelas:"",alteracaoEscopo:"",objecoes:"",respostas:"",aprovadorId:""})}>NEGOCIAR</Btn>{!["aceita","rejeitada"].includes(p.status)&&<Btn size="sm" v="success" disabled={!!salvandoComercial} onClick={()=>statusProposta(p,"aceita")}>{salvandoComercial===`proposta-status-${p.id}`?"CONFIRMANDO...":"ACEITAR"}</Btn>}{p.status==="aceita"&&<Btn size="sm" onClick={()=>criarContrato(p)}>GERAR CONTRATO</Btn>}</div></div>;})}{!lista.length&&vazio("Nenhuma proposta.")}</div></>;
  } else if(commercialView==="com_contratos"){
    conteudo=<><Titulo titulo="Contratos" sub="Elaboração, assinatura, entrada e transferência para Engenharia" acao={<Btn onClick={()=>setContratoForm(contratoVazio())}><Ic n="plus"/> Novo contrato</Btn>}/><div style={{display:"flex",flexDirection:"column",gap:7}}>{contratos.map(k=>{const l=leadBy(k.leadId),faltas=[!k.assinadoEm&&k.status!=="assinado"?"assinatura":"",!k.documentosRecebidos?"documentos":"",!k.entradaPaga?"entrada":"",!k.escopoValidado?"escopo":"",!k.responsavelTecnicoId?"responsável técnico":""].filter(Boolean);return <div key={k.id} style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`4px solid ${k.status==="contratado"?C.green:faltas.length?C.orange:C.blue}`,borderRadius:6,padding:"9px 11px"}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><div><p style={{fontSize:12,fontWeight:900,color:C.text}}>{k.numero} · {k.contratante||"Rascunho sem contratante"}</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>{k.objeto||"Objeto ainda não informado"} · proposta {propostas.find(p=>p.id===k.propostaId)?.numero||"-"}</p></div><div style={{textAlign:"right"}}><b style={{color:C.yellowD}}>{fmt(k.valor)}</b><p style={{fontSize:9,color:C.blue}}>{k.status}</p></div></div>{faltas.length>0&&k.status!=="contratado"&&<p style={{fontSize:9.5,color:C.orange,marginTop:5}}>Pendente: {faltas.join(", ")}</p>}<div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:7}}><Btn size="sm" v="ghost" onClick={()=>setContratoForm({...k})}><Ic n="edit"/> Editar</Btn>{k.status==="elaboracao"&&<Btn size="sm" disabled={!!salvandoComercial} onClick={()=>enviarContrato(k)}>{salvandoComercial===`contrato-enviar-${k.id}`?"ENVIANDO...":"ENVIAR"}</Btn>}{k.status==="enviado"&&<Btn size="sm" v="success" disabled={!!salvandoComercial} onClick={()=>registrarAssinaturaContrato(k)}>{salvandoComercial===`contrato-assinatura-${k.id}`?"REGISTRANDO...":"REGISTRAR ASSINATURA"}</Btn>}{k.status!=="contratado"&&<Btn size="sm" v="success" disabled={ativandoContratoId===k.id} onClick={()=>finalizarContrato(k)}>{ativandoContratoId===k.id?"CONFIRMANDO...":"CONFIRMAR CONTRATAÇÃO"}</Btn>}{k.obraId&&<Btn size="sm" v="ghost" onClick={()=>onTab("obras")}>ABRIR OBRA</Btn>}</div></div>;})}{!contratos.length&&vazio("Nenhum contrato salvo.")}</div></>;
  } else if(commercialView==="com_clientes"){
    conteudo=<><Titulo titulo="Clientes" sub="Qualificação completa para propostas, contratos e documentos" acao={<Btn onClick={()=>setClienteForm(clienteVazio())}><Ic n="plus"/> CLIENTE</Btn>}/><div style={{display:"grid",gridTemplateColumns:cols(1,2,3),gap:7}}>{clientes.map(c=>{const pend=pendenciasCliente(c),pronto=!pend.length;return <div key={c.id} style={{background:C.card,border:`1px solid ${pronto?C.green:C.border}`,borderLeft:`4px solid ${pronto?C.green:C.orange}`,borderRadius:6,padding:"10px 11px"}}><div style={{display:"flex",justifyContent:"space-between",gap:6,alignItems:"flex-start"}}><div><p style={{fontSize:12,fontWeight:900,color:C.text}}>{c.tipoPessoa==="PJ"?(c.razaoSocial||c.nome):c.nome}</p>{c.tipoPessoa==="PJ"&&c.nomeFantasia&&<p style={{fontSize:9.5,color:C.muted}}>{c.nomeFantasia}</p>}</div><Btn size="sm" v="ghost" onClick={()=>setClienteForm({...clienteVazio(),...c})}><Ic n="edit"/></Btn></div><p style={{fontSize:10,color:C.muted,marginTop:3}}>{c.tipoPessoa} · {c.documento?maskDoc(c.documento,c.tipoPessoa):"sem documento"} · {c.cidade||"-"}/{c.uf||"-"}</p><p style={{fontSize:10,color:C.blue,marginTop:3}}>{c.whatsapp||c.telefone||"-"} · {c.email||"-"}</p><p style={{fontSize:9.5,color:pronto?C.green:C.orange,marginTop:5,fontWeight:800}}>{pronto?"CADASTRO CONTRATUAL COMPLETO":`${pend.length} pendência(s): ${pend.slice(0,3).join(", ")}${pend.length>3?"...":""}`}</p><p style={{fontSize:9.5,color:C.green,marginTop:5}}>{(vendasPorCliente.get(c.id)||[]).length} contrato(s) · {fmt((vendasPorCliente.get(c.id)||[]).reduce((s,v)=>s+v.valor,0))}</p></div>;})}{!clientes.length&&vazio("Nenhum cliente cadastrado.")}</div></>;
  } else if(commercialView==="com_parceiros"){
    conteudo=<><Titulo titulo="Parceiros e indicações" sub="Origem, percentual de comissão e resultados" acao={<Btn onClick={()=>setParceiroForm({id:"",nome:"",tipo:"indicador",telefone:"",email:"",comissaoPct:"",observacoes:""})}><Ic n="plus"/> PARCEIRO</Btn>}/>{parceiros.map(p=><div key={p.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto auto",gap:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 11px",marginBottom:6}}><div><p style={{fontSize:11.5,fontWeight:900}}>{p.nome}</p><p style={{fontSize:9.5,color:C.muted}}>{p.tipo} · {p.telefone||p.email||"-"}</p></div><b style={{color:C.green}}>{p.comissaoPct}%</b><Btn size="sm" v="ghost" onClick={()=>setParceiroForm({...p})}><Ic n="edit"/></Btn></div>)}{!parceiros.length&&vazio("Nenhum parceiro.")}</>;
  } else if(commercialView==="com_metas"){
    conteudo=<><Titulo titulo="Metas e comissões" sub="Metas por vendedor/equipe e comissões das vendas" acao={<Btn onClick={()=>setMetaForm({id:"",responsavelId:"",equipe:"",periodo:mesAtual,receita:"",contratos:"",ticketMedio:"",conversao:""})}><Ic n="plus"/> META</Btn>}/><div style={{display:"grid",gridTemplateColumns:cols("1fr","1fr","1fr 1fr"),gap:9}}><div><p style={{fontSize:11,fontWeight:900,marginBottom:6}}>METAS</p>{metas.map(m=>{const realizado=vendas.filter(v=>v.fechadaEm?.slice(0,7)===m.periodo&&(!m.responsavelId||v.responsavelId===m.responsavelId)).reduce((s,v)=>s+v.valor,0),pct=m.receita?Math.min(100,realizado/m.receita*100):0;return <div key={m.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 10px",marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between"}}><b style={{fontSize:10.5}}>{m.periodo} · {nomeUsuario(m.responsavelId)}</b><button onClick={()=>setMetaForm({...m})} style={{border:0,background:"transparent",color:C.blue,cursor:"pointer"}}>editar</button></div><p style={{fontSize:9.5,color:C.muted,marginTop:3}}>Meta {fmt(m.receita)} · realizado {fmt(realizado)}</p><div style={{height:6,background:C.surface,borderRadius:6,marginTop:5}}><div style={{height:"100%",width:`${pct}%`,background:pct>=100?C.green:C.blue,borderRadius:6}}/></div></div>})}{!metas.length&&vazio("Nenhuma meta.")}</div><div><p style={{fontSize:11,fontWeight:900,marginBottom:6}}>COMISSÕES</p>{comissoes.map(c=><div key={c.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 10px",marginBottom:6}}><div><b style={{fontSize:10.5}}>{nomeUsuario(c.responsavelId)}</b><p style={{fontSize:9,color:C.muted}}>Base {fmt(c.base)} · {c.percentual}% · {c.status}</p></div><b style={{color:C.green}}>{fmt(c.valor)}</b></div>)}{!comissoes.length&&vazio("Nenhuma comissão calculada.")}</div></div></>;
  } else if(commercialView==="com_perdas"){
    const perdidos=leads.filter(l=>l.etapa==="perdido");conteudo=<><Titulo titulo="Motivos de perda" sub="Análise, concorrentes e reativação futura"/><div style={{display:"grid",gridTemplateColumns:cols(2,4,4),gap:7}}>{COM_PERDAS.map(m=>kpi(m,perdidos.filter(l=>l.motivoPerda===m).length,perdidos.some(l=>l.motivoPerda===m)?C.red:C.muted))}</div>{perdidos.map(l=><div key={l.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"8px 10px",marginTop:6}}><div style={{display:"flex",justifyContent:"space-between"}}><div><b style={{fontSize:11}}>{l.nome} · {l.motivoPerda}</b><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>Concorrente: {l.concorrente||"-"} · {fmt(l.valorConcorrente)} · reativação {fmtDate(l.reativacaoEm)}</p></div>{l.reativacaoEm&&l.reativacaoEm<=today()&&<Btn size="sm" v="success" onClick={()=>moverLead(l,"novo")}>REATIVAR</Btn>}</div></div>)}{!perdidos.length&&vazio("Nenhuma perda registrada.")}</>;
  } else if(commercialView==="com_relatorios"){
    conteudo=<><Titulo titulo="Relatórios comerciais" sub="Desempenho por vendedor, origem, receita, conversão e funil" acao={<Btn onClick={exportarRelatorio}>EXPORTAR EXCEL</Btn>}/><div style={{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:6}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:10.5}}><thead><tr style={{background:C.surface}}>{["VENDEDOR","LEADS","VENDAS","RECEITA","CONVERSÃO"].map(h=><th key={h} style={{padding:7,textAlign:h==="VENDEDOR"?"left":"right"}}>{h}</th>)}</tr></thead><tbody>{vendedores.map(v=><tr key={v.id} style={{borderTop:`1px solid ${C.line}`}}><td style={{padding:7}}>{v.nome}</td><td style={{padding:7,textAlign:"right"}}>{v.leads}</td><td style={{padding:7,textAlign:"right"}}>{v.vendas}</td><td style={{padding:7,textAlign:"right"}}>{fmt(v.receita)}</td><td style={{padding:7,textAlign:"right"}}>{v.conversao.toFixed(1)}%</td></tr>)}</tbody></table></div><div style={{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:6}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:10.5}}><thead><tr style={{background:C.surface}}>{["ORIGEM","LEADS","VENDAS","RECEITA"].map(h=><th key={h} style={{padding:7,textAlign:h==="ORIGEM"?"left":"right"}}>{h}</th>)}</tr></thead><tbody>{origens.map(o=><tr key={o.origem} style={{borderTop:`1px solid ${C.line}`}}><td style={{padding:7}}>{o.origem}</td><td style={{padding:7,textAlign:"right"}}>{o.leads}</td><td style={{padding:7,textAlign:"right"}}>{o.vendas}</td><td style={{padding:7,textAlign:"right"}}>{fmt(o.receita)}</td></tr>)}</tbody></table></div></>;
  }

  const showRealEstateHub=view==="com_real_estate";
  return <div className="anim" style={{display:"flex",flexDirection:"column",gap:12}}>
    {showRealEstateHub&&<div style={{display:"flex",gap:5,overflowX:"auto",padding:"6px",background:C.card,border:`1px solid ${C.border}`,borderRadius:9,position:"sticky",top:58,zIndex:18}}>
      {COM_IMOBILIARIO_SECTIONS.map(section=><button key={section.id} type="button" onClick={()=>openCommercialSection(section)} style={{display:"inline-flex",alignItems:"center",gap:5,whiteSpace:"nowrap",minHeight:34,padding:"7px 10px",borderRadius:7,border:`1px solid ${activeCommercialSection===section.id?C.yellowD:C.line}`,background:activeCommercialSection===section.id?`${C.yellow}18`:C.bg,color:C.text,fontSize:9.5,fontWeight:750,cursor:"pointer"}}><Ic n={section.icon} s={12}/>{section.label}</button>)}
    </div>}
    {showRealEstateHub?<Suspense fallback={<div style={{padding:30,textAlign:"center",color:C.muted}}>Carregando gestão imobiliária...</div>}><LazyRealEstateCommercial section={activeCommercialSection} commercial={com} appData={data} currentUser={currentUser} showToast={showToast} onSave={(next,message)=>persistirComercial(next,{mensagem:message})} onUploadFile={anexarArquivoImobiliario} onLegacyNavigate={onTab}/></Suspense>:conteudo}
    {npsForm&&<Modal title="Pesquisa de satisfação na entrega" onClose={()=>setNpsForm(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <p style={{fontSize:11,color:C.muted,lineHeight:1.5}}>
          De 0 a 10, o quanto o cliente recomendaria a ARCD. Nota 9-10 é promotor
          (candidato a indicar), 7-8 neutro, 0-6 detrator (precisa de atenção).
        </p>
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:9}}>
          <Sel label="Obra *" value={npsForm.obraId}
            onChange={v=>{
              const o=(data.obras||[]).find(x=>x.id===v);
              const cli=(com.clientes||[]).find(c=>c.obraId===v||c.nome===o?.cliente);
              setNpsForm(f=>({...f,obraId:v,clienteId:cli?.id||f.clienteId}));
            }}
            options={[{v:"",l:"Selecione"},...(data.obras||[]).map(o=>({v:o.id,l:o.name}))]}/>
          <Sel label="Cliente" value={npsForm.clienteId}
            onChange={v=>setNpsForm(f=>({...f,clienteId:v}))}
            options={[{v:"",l:"Não vinculado"},...(com.clientes||[]).map(c=>({v:c.id,l:c.nome}))]}/>
          <Inp label="Data" type="date" value={npsForm.data} onChange={v=>setNpsForm(f=>({...f,data:v}))}/>
        </div>

        {/* Nota de 0 a 10 em botoes - mais rapido no celular que digitar */}
        <div>
          <p style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:6}}>Nota *</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {Array.from({length:11},(_,n)=>{
              const sel=String(npsForm.nota)===String(n);
              const cor=n>=9?C.green:n>=7?C.orange:C.red;
              return (
                <button key={n} type="button" onClick={()=>setNpsForm(f=>({...f,nota:n}))}
                  style={{width:34,height:34,borderRadius:8,cursor:"pointer",
                    border:`1.5px solid ${sel?cor:C.border}`,
                    background:sel?`${cor}1E`:C.bg,
                    color:sel?cor:C.muted,fontSize:12,fontWeight:sel?900:600,
                    fontFamily:"'Inter',sans-serif"}}>{n}</button>
              );
            })}
          </div>
          {npsForm.nota!=="" && npsForm.nota!==null && (
            <p style={{fontSize:10.5,marginTop:6,fontWeight:700,
                 color:Number(npsForm.nota)>=9?C.green:Number(npsForm.nota)>=7?C.orange:C.red}}>
              {Number(npsForm.nota)>=9?"Promotor - peça indicação logo após a entrega."
               :Number(npsForm.nota)>=7?"Neutro - satisfeito, mas não vai indicar sozinho."
               :"Detrator - trate antes que vire indicação negativa."}
            </p>
          )}
        </div>

        <Inp label="Comentário do cliente" value={npsForm.comentario}
             onChange={v=>setNpsForm(f=>({...f,comentario:v}))} multiline
             placeholder="O que ele destacou, o que faltou..."/>

        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.text,cursor:"pointer"}}>
          <input type="checkbox" checked={!!npsForm.pediuIndicacao}
            onChange={e=>setNpsForm(f=>({...f,pediuIndicacao:e.target.checked}))}
            style={{width:15,height:15,accentColor:C.yellowD,cursor:"pointer"}}/>
          Já pedi indicação a este cliente
        </label>

        <div style={{display:"flex",gap:8}}>
          <Btn v="ghost" onClick={()=>setNpsForm(null)} full>Cancelar</Btn>
          <Btn disabled={!!salvandoComercial} onClick={salvarNps} full><Ic n="check"/> {salvandoComercial==="nps"?"Salvando...":"Salvar"}</Btn>
        </div>
      </div>
    </Modal>}

    {colunaResumo&&<Modal title={`${colunaResumo.label} · ${colunaResumo.leads.length} lead(s)`} onClose={()=>setColunaResumo(null)}>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted}}>
          <span>Valor somado</span><b style={{color:C.yellowD}}>{fmt(colunaResumo.leads.reduce((s,l)=>s+(l.orcamentoEstimado||0),0))}</b>
        </div>
        {colunaResumo.leads.map(l=><button key={l.id} onClick={()=>{setColunaResumo(null);setLeadForm({...l});setLeadAba("geral");}}
          style={{textAlign:"left",display:"flex",justifyContent:"space-between",gap:8,background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${COM_TEMPERATURA[l.temperatura]||C.muted}`,borderRadius:6,padding:"8px 10px",cursor:"pointer"}}>
          <div style={{minWidth:0}}>
            <p style={{fontSize:12,fontWeight:800,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.nome}</p>
            <p style={{fontSize:9.5,color:C.muted,marginTop:2}}>{nomeUsuario(l.responsavelId)} · {comDias(l.etapaDesde)}d nesta etapa</p>
          </div>
          <b style={{fontSize:11.5,color:C.yellowD,flexShrink:0}}>{fmt(l.orcamentoEstimado)}</b>
        </button>)}
        {!colunaResumo.leads.length&&<p style={{textAlign:"center",fontSize:11,color:C.muted,padding:12}}>Nenhum lead nesta etapa.</p>}
      </div>
    </Modal>}

    {leadForm&&<Modal title={leadForm.id?`Lead · ${leadForm.nome}`:"Novo lead"} onClose={()=>setLeadForm(null)} wide><div style={{display:"flex",flexDirection:"column",gap:10}}><div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:3}}>{[["geral","Visão geral"],["cadastro","Dados cadastrais"],["projeto","Projeto/serviço"],["qualificacao","Qualificação"],["atividades","Atividades"],["reunioes","Reuniões"],["propostas","Propostas"],["negociacoes","Negociações"],["contratos","Contratos"],["documentos","Documentos"],["financeiro","Financeiro"],["historico","Histórico"]].map(([id,l])=><button key={id} onClick={()=>setLeadAba(id)} style={{border:`1px solid ${leadAba===id?C.green:C.border}`,background:leadAba===id?`${C.green}10`:C.bg,color:leadAba===id?C.green:C.muted,borderRadius:6,padding:"5px 8px",fontSize:9.5,fontWeight:800,whiteSpace:"nowrap",cursor:"pointer"}}>{l}</button>)}</div>
      {leadAba==="geral"&&<div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}><Inp label="Nome *" value={leadForm.nome} onChange={v=>setLeadForm(f=>({...f,nome:v}))}/><SelBtn label="Etapa" value={leadForm.etapa} onChange={v=>setLeadForm(f=>({...f,etapa:v}))} options={COM_ETAPAS.map(([v,l])=>({v,l}))}/><Sel label="Responsável *" value={leadForm.responsavelId} onChange={v=>setLeadForm(f=>({...f,responsavelId:v}))} options={[{v:"",l:"Selecione"},...usuarios.map(u=>({v:u.id,l:u.nome}))]}/><Inp label="Serviço de interesse" value={leadForm.servico} onChange={v=>setLeadForm(f=>({...f,servico:v}))}/><Inp label="Orçamento estimado" type="number" value={leadForm.orcamentoEstimado} onChange={v=>setLeadForm(f=>({...f,orcamentoEstimado:v}))}/><Inp label="Fechamento previsto" type="date" value={leadForm.fechamentoPrevisto} onChange={v=>setLeadForm(f=>({...f,fechamentoPrevisto:v}))}/><Inp label="Probabilidade %" type="number" value={leadForm.probabilidade} onChange={v=>setLeadForm(f=>({...f,probabilidade:v,temperatura:Number(v)>=70?"quente":Number(v)>=35?"morno":"frio"}))}/><Sel label="Temperatura" value={leadForm.temperatura} onChange={v=>setLeadForm(f=>({...f,temperatura:v}))} options={[{v:"frio",l:"Frio"},{v:"morno",l:"Morno"},{v:"quente",l:"Quente"}]}/><Inp label="Prazo desejado" value={leadForm.prazoDesejado} onChange={v=>setLeadForm(f=>({...f,prazoDesejado:v}))}/><Inp label="Próxima atividade *" value={leadForm.proximaAtividade} onChange={v=>setLeadForm(f=>({...f,proximaAtividade:v}))}/><Inp label="Data da próxima atividade *" type="datetime-local" value={leadForm.proximaAtividadeEm} onChange={v=>setLeadForm(f=>({...f,proximaAtividadeEm:v}))}/><Sel label="Origem" value={leadForm.origem} onChange={v=>setLeadForm(f=>({...f,origem:v}))} options={[{v:"",l:"Selecione"},...['Indicação','Site','Instagram','WhatsApp','Parceiro','Tráfego pago','Prospecção','Outro'].map(v=>({v,l:v}))]}/>
      {/* QUEM INDICOU: so aparece quando a origem e indicacao. E o dado que
          alimenta o ranking de indicadores - sem ele o motor fica cego. */}
      {leadForm.origem==="Indicação" && (<>
        <Sel label="Indicado por (cliente)" value={leadForm.indicadoPorClienteId}
             onChange={v=>setLeadForm(f=>({...f,indicadoPorClienteId:v,indicadoPorNome:v?"":f.indicadoPorNome}))}
             options={[{v:"",l:"Não está na carteira"},...(com.clientes||[]).map(c=>({v:c.id,l:c.nome}))]}/>
        {!leadForm.indicadoPorClienteId && (
          <Inp label="Nome de quem indicou" value={leadForm.indicadoPorNome}
               onChange={v=>setLeadForm(f=>({...f,indicadoPorNome:v}))}
               placeholder="Arquiteto, conhecido, ex-cliente..."/>
        )}
        <Sel label="Obra que ele viu (opcional)" value={leadForm.indicadoPorObraId}
             onChange={v=>setLeadForm(f=>({...f,indicadoPorObraId:v}))}
             options={[{v:"",l:"Não informado"},...(data.obras||[]).map(o=>({v:o.id,l:o.name}))]}/>
      </>)}<div style={{gridColumn:"1/-1"}}><Inp label="Observações" value={leadForm.observacoes} onChange={v=>setLeadForm(f=>({...f,observacoes:v}))} multiline/></div></div>}
      {leadAba==="cadastro"&&<div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}><Sel label="Pessoa" value={leadForm.tipoPessoa} onChange={v=>setLeadForm(f=>({...f,tipoPessoa:v}))} options={[{v:"PF",l:"Pessoa física"},{v:"PJ",l:"Pessoa jurídica"}]}/><Inp label="Telefone" value={leadForm.telefone} onChange={v=>setLeadForm(f=>({...f,telefone:v}))}/><Inp label="WhatsApp" value={leadForm.whatsapp} onChange={v=>setLeadForm(f=>({...f,whatsapp:v}))}/><Inp label="E-mail" value={leadForm.email} onChange={v=>setLeadForm(f=>({...f,email:v}))}/><Inp label="Cidade" value={leadForm.cidade} onChange={v=>setLeadForm(f=>({...f,cidade:v}))}/><Inp label="Endereço" value={leadForm.endereco} onChange={v=>setLeadForm(f=>({...f,endereco:v}))}/><Inp label="Condomínio" value={leadForm.condominio} onChange={v=>setLeadForm(f=>({...f,condominio:v}))}/><Inp label="Lote" value={leadForm.lote} onChange={v=>setLeadForm(f=>({...f,lote:v}))}/><Sel label="Parceiro indicador" value={leadForm.parceiroId||""} onChange={v=>setLeadForm(f=>({...f,parceiroId:v}))} options={[{v:"",l:"Nenhum"},...parceiros.map(p=>({v:p.id,l:p.nome}))]}/></div>}
      {leadAba==="projeto"&&<div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}><Inp label="Área do terreno (m²)" type="number" value={leadForm.areaTerreno} onChange={v=>setLeadForm(f=>({...f,areaTerreno:v}))}/><Inp label="Área estimada da construção" type="number" value={leadForm.areaConstrucao} onChange={v=>setLeadForm(f=>({...f,areaConstrucao:v}))}/><Inp label="Pavimentos" type="number" value={leadForm.pavimentos} onChange={v=>setLeadForm(f=>({...f,pavimentos:v}))}/><Inp label="Tipo de serviço" value={leadForm.tipoServico} onChange={v=>setLeadForm(f=>({...f,tipoServico:v}))}/><Inp label="Prazo pretendido" value={leadForm.prazoPretendido} onChange={v=>setLeadForm(f=>({...f,prazoPretendido:v}))}/><Sel label="Padrão construtivo" value={leadForm.padrao} onChange={v=>setLeadForm(f=>({...f,padrao:v}))} options={[{v:"economico",l:"Econômico"},{v:"medio",l:"Médio"},{v:"alto",l:"Alto padrão"}]}/><Inp label="Orçamento disponível" type="number" value={leadForm.orcamentoDisponivel} onChange={v=>setLeadForm(f=>({...f,orcamentoDisponivel:v}))}/><div style={{gridColumn:"1/-1"}}><Inp label="Projetos/documentos existentes" value={leadForm.projetosExistentes} onChange={v=>setLeadForm(f=>({...f,projetosExistentes:v}))} multiline/></div></div>}
      {leadAba==="qualificacao"&&<Inp label="Qualificação, necessidades, restrições e objeções" value={leadForm.qualificacao} onChange={v=>setLeadForm(f=>({...f,qualificacao:v}))} multiline/>}
      {leadAba==="atividades"&&<div>{atividades.filter(a=>a.leadId===leadForm.id).map(a=><p key={a.id} style={{fontSize:10.5,padding:6,borderBottom:`1px solid ${C.line}`}}>{comDateTime(a.dataHora)} · {a.titulo} · {a.status}</p>)}<Btn size="sm" onClick={()=>setAtividadeForm({id:"",leadId:leadForm.id,tipo:"followup",titulo:"",dataHora:"",responsavelId:leadForm.responsavelId,status:"pendente",observacoes:""})}>+ ATIVIDADE</Btn></div>}
      {leadAba==="reunioes"&&<div style={{display:"flex",flexDirection:"column",gap:6}}>{reunioes.filter(r=>r.leadId===leadForm.id).sort((a,b)=>(b.dataHora||"").localeCompare(a.dataHora||"")).map(r=><div key={r.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:8,padding:"8px 9px",border:`1px solid ${C.border}`,borderLeft:`4px solid ${r.status==="realizada"?C.green:C.blue}`,borderRadius:7}}><div><b style={{fontSize:10.5,color:C.text}}>{comDateTime(r.dataHora)} · {r.tipo}</b><p style={{fontSize:9.5,color:r.status==="realizada"?C.green:C.muted,marginTop:2}}>{r.status==="realizada"?"Executada":"Agendada"}{r.resumo?` · ${r.resumo}`:""}</p>{r.proximosPassos&&<p style={{fontSize:9,color:C.muted,marginTop:2}}>Próximo passo: {r.proximosPassos}</p>}</div><div style={{display:"flex",gap:4,alignItems:"center"}}>{r.status!=="realizada"&&r.status!=="cancelada"&&<Btn size="sm" v="success" onClick={()=>setReuniaoForm({...r,status:"realizada"})}>Confirmar</Btn>}<Btn size="sm" v="ghost" onClick={()=>setReuniaoForm({...r})}>Abrir</Btn></div></div>)}{!reunioes.some(r=>r.leadId===leadForm.id)&&vazio("Nenhuma reunião para este lead.")}<Btn size="sm" onClick={()=>setReuniaoForm({id:"",leadId:leadForm.id,dataHora:"",tipo:"presencial",local:"",participantes:"",responsavelComercialId:leadForm.responsavelId||currentUser?.id||"",responsavelTecnicoId:"",pauta:"",resumo:"",necessidades:"",objecoes:"",orcamentoDisponivel:leadForm.orcamentoDisponivel||"",proximosPassos:"",proximoContato:"",status:"agendada",documentos:[]})}>+ NOVA REUNIÃO</Btn></div>}
      {leadAba==="propostas"&&<div>{propostas.filter(p=>p.leadId===leadForm.id).map(p=><p key={p.id} style={{fontSize:10.5,padding:6,borderBottom:`1px solid ${C.line}`}}>{p.numero} V{p.versao} · {fmt(p.valor)} · {p.status}</p>)}<Btn size="sm" onClick={()=>setPropostaForm(propostaVazia(leadForm.id))}>+ PROPOSTA</Btn></div>}
      {leadAba==="negociacoes"&&<div>{propostas.filter(p=>p.leadId===leadForm.id).flatMap(p=>(p.negociacoes||[]).map(n=><p key={n.id} style={{fontSize:10.5,padding:6,borderBottom:`1px solid ${C.line}`}}>{comDateTime(n.data)} · {fmt(n.valorInicial)} → {fmt(n.valorNegociado)} · {n.objecoes}</p>))}</div>}
      {leadAba==="contratos"&&<div>{contratos.filter(k=>k.leadId===leadForm.id).map(k=><p key={k.id} style={{fontSize:10.5,padding:6,borderBottom:`1px solid ${C.line}`}}>{k.numero} · {fmt(k.valor)} · {k.status}</p>)}</div>}
      {leadAba==="documentos"&&<div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:6,alignItems:"end"}}><Inp label="Nome do documento" value={docForm.nome} onChange={v=>setDocForm(f=>({...f,nome:v}))}/><Inp label="Link do arquivo" value={docForm.url} onChange={v=>setDocForm(f=>({...f,url:v}))}/><Btn size="sm" onClick={()=>{if(docForm.nome&&docForm.url){setLeadForm(f=>({...f,documentos:[...(f.documentos||[]),{id:uid(),...docForm,data:new Date().toISOString()}]}));setDocForm({nome:"",url:""});}}}>ADICIONAR</Btn></div>{(leadForm.documentos||[]).map(d=><p key={d.id} style={{fontSize:10.5,padding:6}}><a href={d.url} target="_blank" rel="noreferrer">{d.nome}</a></p>)}</div>}
      {leadAba==="financeiro"&&<div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}>{kpi("Propostas",fmt(propostas.filter(p=>p.leadId===leadForm.id).reduce((s,p)=>Math.max(s,p.valor),0)),C.blue)}{kpi("Contratos",fmt(contratos.filter(k=>k.leadId===leadForm.id).reduce((s,k)=>s+k.valor,0)),C.green)}{kpi("Recebido",fmt(recebidoDoLead(leadForm.id)),C.yellowD)}</div>}
      {leadAba==="historico"&&<div>{(leadForm.historico||[]).slice().reverse().map(h=><div key={h.id} style={{borderLeft:`3px solid ${C.blue}`,padding:"5px 8px",marginBottom:5}}><p style={{fontSize:9,color:C.muted}}>{comDateTime(h.data)} · {h.tipo}</p><p style={{fontSize:10.5,color:C.text}}>{h.texto}</p></div>)}</div>}
      <div style={{display:"flex",gap:7,justifyContent:"space-between",flexWrap:"wrap"}}>{leadForm.id?<Btn v="danger" disabled={!!salvandoComercial} onClick={()=>excluirLead(leadForm)}><Ic n="trash"/> EXCLUIR LEAD</Btn>:<span/>}<div style={{display:"flex",gap:7}}><Btn v="ghost" onClick={()=>setLeadForm(null)}>CANCELAR</Btn><Btn disabled={!!salvandoComercial} onClick={salvarLead}><Ic n="check"/> {salvandoComercial==="lead"?"Salvando...":"SALVAR LEAD"}</Btn></div></div></div></Modal>}

    {atividadeForm&&<Modal title="Tarefa / follow-up" onClose={()=>setAtividadeForm(null)}><div style={{display:"flex",flexDirection:"column",gap:9}}><Sel label="Lead *" value={atividadeForm.leadId} onChange={v=>setAtividadeForm(f=>({...f,leadId:v}))} options={[{v:"",l:"Selecione"},...leads.map(l=>({v:l.id,l:l.nome}))]}/><Inp label="Título *" value={atividadeForm.titulo} onChange={v=>setAtividadeForm(f=>({...f,titulo:v}))}/><Inp label="Data e hora *" type="datetime-local" value={atividadeForm.dataHora} onChange={v=>setAtividadeForm(f=>({...f,dataHora:v}))}/><Sel label="Responsável" value={atividadeForm.responsavelId} onChange={v=>setAtividadeForm(f=>({...f,responsavelId:v}))} options={usuarios.map(u=>({v:u.id,l:u.nome}))}/><Inp label="Observações" value={atividadeForm.observacoes} onChange={v=>setAtividadeForm(f=>({...f,observacoes:v}))} multiline/><Btn disabled={!!salvandoComercial} onClick={()=>salvarAtividade(atividadeForm)}>{salvandoComercial==="atividade"?"Salvando...":"SALVAR"}</Btn></div></Modal>}
    {reuniaoForm&&<Modal title={reuniaoForm.id?`Reunião · ${leadBy(reuniaoForm.leadId)?.nome||"Lead"}`:"Nova reunião comercial"} onClose={()=>setReuniaoForm(null)} wide><div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>{reuniaoForm.status==="realizada"&&<div style={{gridColumn:"1/-1",padding:"9px 11px",border:`1px solid ${C.green}`,borderRadius:7,background:`${C.green}0B`}}><b style={{fontSize:10.5,color:C.green}}>CONFIRMAR REUNIÃO EXECUTADA</b><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>Preencha o resumo e os próximos passos. Ao salvar, o registro entrará automaticamente no histórico do lead.</p></div>}<Sel label="Lead *" value={reuniaoForm.leadId} onChange={v=>setReuniaoForm(f=>({...f,leadId:v}))} options={[{v:"",l:"Selecione"},...leads.map(l=>({v:l.id,l:l.nome}))]}/><Inp label="Data e hora *" type="datetime-local" value={reuniaoForm.dataHora} onChange={v=>setReuniaoForm(f=>({...f,dataHora:v}))}/><Sel label="Situação" value={reuniaoForm.status||"agendada"} onChange={v=>setReuniaoForm(f=>({...f,status:v}))} options={[{v:"agendada",l:"Agendada"},{v:"realizada",l:"Executada"},{v:"cancelada",l:"Cancelada"}]}/><Sel label="Tipo" value={reuniaoForm.tipo} onChange={v=>setReuniaoForm(f=>({...f,tipo:v}))} options={[{v:"presencial",l:"Presencial"},{v:"online",l:"On-line"},{v:"visita",l:"Visita técnica"}]}/><Inp label="Local ou link" value={reuniaoForm.local} onChange={v=>setReuniaoForm(f=>({...f,local:v}))}/><Inp label="Participantes" value={reuniaoForm.participantes} onChange={v=>setReuniaoForm(f=>({...f,participantes:v}))}/><Sel label="Responsável técnico" value={reuniaoForm.responsavelTecnicoId} onChange={v=>setReuniaoForm(f=>({...f,responsavelTecnicoId:v}))} options={[{v:"",l:"Selecione"},...usuarios.map(u=>({v:u.id,l:u.nome}))]}/>{[["pauta","Pauta"],["resumo",reuniaoForm.status==="realizada"?"Resumo da reunião *":"Resumo"],["necessidades","Necessidades"],["objecoes","Objeções"],["proximosPassos","Próximos passos"]].map(([k,l])=><div key={k} style={{gridColumn:"1/-1"}}><Inp label={l} value={reuniaoForm[k]} onChange={v=>setReuniaoForm(f=>({...f,[k]:v}))} multiline/></div>)}<Inp label="Orçamento disponível" type="number" value={reuniaoForm.orcamentoDisponivel} onChange={v=>setReuniaoForm(f=>({...f,orcamentoDisponivel:v}))}/><Inp label="Próximo contato" type="date" value={reuniaoForm.proximoContato} onChange={v=>setReuniaoForm(f=>({...f,proximoContato:v}))}/><div style={{gridColumn:"1/-1",display:"flex",gap:7}}><Btn v="ghost" onClick={()=>setReuniaoForm(null)} full>Cancelar</Btn><Btn v={reuniaoForm.status==="realizada"?"success":"primary"} disabled={!!salvandoComercial} onClick={()=>salvarReuniao(reuniaoForm)} full>{salvandoComercial==="reuniao"?"Salvando...":reuniaoForm.status==="realizada"?"CONFIRMAR EXECUÇÃO E SALVAR NO LEAD":"SALVAR REUNIÃO"}</Btn></div></div></Modal>}
    {propostaForm&&<Modal title="Proposta comercial" onClose={()=>setPropostaForm(null)} wide><div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}><Inp label="Número" value={propostaForm.numero} onChange={v=>setPropostaForm(f=>({...f,numero:v}))}/><Inp label="Versão" type="number" value={propostaForm.versao} onChange={v=>setPropostaForm(f=>({...f,versao:v}))}/><Sel label="Lead" value={propostaForm.leadId} onChange={v=>setPropostaForm(f=>({...f,leadId:v}))} options={[{v:"",l:"Vincular depois"},...leads.map(l=>({v:l.id,l:l.nome}))]}/><Inp label="Objeto" value={propostaForm.objeto} onChange={v=>setPropostaForm(f=>({...f,objeto:v}))}/><Inp label="Valor" type="number" value={propostaForm.valor} onChange={v=>setPropostaForm(f=>({...f,valor:v}))}/><Inp label="Validade" type="date" value={propostaForm.validade} onChange={v=>setPropostaForm(f=>({...f,validade:v}))}/>{[["escopo","Escopo"],["inclusos","Serviços inclusos"],["exclusos","Não inclusos"],["entregaveis","Entregáveis"],["formaPagamento","Forma de pagamento"],["responsabilidades","Responsabilidades"],["premissas","Premissas"]].map(([k,l])=><div key={k} style={{gridColumn:"1/-1"}}><Inp label={l} value={propostaForm[k]} onChange={v=>setPropostaForm(f=>({...f,[k]:v}))} multiline/></div>)}<Inp label="Prazo" value={propostaForm.prazo} onChange={v=>setPropostaForm(f=>({...f,prazo:v}))}/><Inp label="Desconto %" type="number" value={propostaForm.desconto} onChange={v=>setPropostaForm(f=>({...f,desconto:v}))}/><DocumentosComerciais tipo="proposta" registro={propostaForm} setRegistro={setPropostaForm}/><div style={{gridColumn:"1/-1"}}><Btn onClick={()=>salvarProposta(propostaForm)} full disabled={subindoDocumentoComercial||!!salvandoComercial}><Ic n="check"/> {salvandoComercial==="proposta"?"Salvando...":"Salvar rascunho"}</Btn></div></div></Modal>}
    {negForm&&<Modal title="Registrar negociação" onClose={()=>setNegForm(null)} wide><div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}><Inp label="Valor inicial" type="number" value={negForm.valorInicial} onChange={v=>setNegForm(f=>({...f,valorInicial:v}))}/><Inp label="Valor negociado" type="number" value={negForm.valorNegociado} onChange={v=>setNegForm(f=>({...f,valorNegociado:v}))}/><Inp label="Desconto %" type="number" value={negForm.desconto} onChange={v=>setNegForm(f=>({...f,desconto:v}))}/><Inp label="Forma de pagamento" value={negForm.formaPagamento} onChange={v=>setNegForm(f=>({...f,formaPagamento:v}))}/><Inp label="Parcelas" type="number" value={negForm.parcelas} onChange={v=>setNegForm(f=>({...f,parcelas:v}))}/><Sel label="Aprovador" value={negForm.aprovadorId} onChange={v=>setNegForm(f=>({...f,aprovadorId:v}))} options={[{v:"",l:"Selecione"},...usuarios.map(u=>({v:u.id,l:u.nome}))]}/>{[["alteracaoEscopo","Alteração de escopo"],["objecoes","Objeções do cliente"],["respostas","Respostas dadas"]].map(([k,l])=><div key={k} style={{gridColumn:"1/-1"}}><Inp label={l} value={negForm[k]} onChange={v=>setNegForm(f=>({...f,[k]:v}))} multiline/></div>)}<div style={{gridColumn:"1/-1"}}><Btn disabled={!!salvandoComercial} onClick={()=>salvarNegociacao(negForm)} full>{salvandoComercial==="negociacao"?"Salvando...":"SALVAR NEGOCIAÇÃO"}</Btn></div></div></Modal>}
    {contratoForm&&<Modal title="Contrato comercial" onClose={()=>setContratoForm(null)} wide><div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}><Inp label="Número" value={contratoForm.numero} onChange={v=>setContratoForm(f=>({...f,numero:v}))}/><Sel label="Lead" value={contratoForm.leadId||""} onChange={v=>{const lead=leadBy(v);setContratoForm(f=>({...f,leadId:v,contratante:f.contratante||lead?.nome||""}));}} options={[{v:"",l:"Vincular depois"},...leads.map(l=>({v:l.id,l:l.nome}))]}/><Inp label="Contratante" value={contratoForm.contratante} onChange={v=>setContratoForm(f=>({...f,contratante:v}))}/><Inp label="Valor" type="number" value={contratoForm.valor} onChange={v=>setContratoForm(f=>({...f,valor:v}))}/><Inp label="Entrada" type="number" value={contratoForm.entrada} onChange={v=>setContratoForm(f=>({...f,entrada:v}))}/><Inp label="Parcelas" type="number" value={contratoForm.parcelas} onChange={v=>setContratoForm(f=>({...f,parcelas:v}))}/><Inp label="Dia de vencimento" type="number" value={contratoForm.diaVencimento} onChange={v=>setContratoForm(f=>({...f,diaVencimento:v}))}/><Inp label="Início" type="date" value={contratoForm.inicio} onChange={v=>setContratoForm(f=>({...f,inicio:v}))}/><Inp label="Conclusão" type="date" value={contratoForm.conclusao} onChange={v=>setContratoForm(f=>({...f,conclusao:v}))}/><Inp label="Prazo" value={contratoForm.prazo} onChange={v=>setContratoForm(f=>({...f,prazo:v}))}/><Sel label="Responsável comercial" value={contratoForm.responsavelComercialId} onChange={v=>setContratoForm(f=>({...f,responsavelComercialId:v}))} options={usuarios.map(u=>({v:u.id,l:u.nome}))}/><Sel label="Responsável técnico" value={contratoForm.responsavelTecnicoId} onChange={v=>setContratoForm(f=>({...f,responsavelTecnicoId:v}))} options={[{v:"",l:"Definir depois"},...usuarios.map(u=>({v:u.id,l:u.nome}))]}/><Inp label="Link para assinatura eletrônica" value={contratoForm.assinaturaUrl||""} onChange={v=>setContratoForm(f=>({...f,assinaturaUrl:v}))}/>{[["objeto","Objeto"],["escopo","Escopo"],["responsabilidades","Responsabilidades"]].map(([k,l])=><div key={k} style={{gridColumn:"1/-1"}}><Inp label={l} value={contratoForm[k]} onChange={v=>setContratoForm(f=>({...f,[k]:v}))} multiline/></div>)}<div style={{gridColumn:"1/-1",display:"flex",gap:8,flexWrap:"wrap"}}>{[["documentosRecebidos","Documentos recebidos"],["entradaPaga","Entrada confirmada"],["escopoValidado","Escopo validado"]].map(([k,l])=><label key={k} style={{fontSize:10.5,color:C.text,display:"flex",gap:5,alignItems:"center"}}><input type="checkbox" checked={!!contratoForm[k]} onChange={e=>setContratoForm(f=>({...f,[k]:e.target.checked}))}/>{l}</label>)}</div><DocumentosComerciais tipo="contrato" registro={contratoForm} setRegistro={setContratoForm}/><div style={{gridColumn:"1/-1"}}><Btn onClick={()=>salvarContrato(contratoForm)} full disabled={subindoDocumentoComercial||!!salvandoComercial}><Ic n="check"/> {salvandoComercial==="contrato"?"Salvando...":"Salvar rascunho"}</Btn></div></div></Modal>}
    {clienteForm&&<Modal title={clienteForm.id?"Editar qualificação do cliente":"Novo cliente"} onClose={()=>setClienteForm(null)} wide><div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}>
        <Sel label="Tipo de pessoa *" value={clienteForm.tipoPessoa} onChange={v=>setClienteForm(f=>({...f,tipoPessoa:v,documento:""}))} options={[{v:"PF",l:"Pessoa física"},{v:"PJ",l:"Pessoa jurídica"}]}/>
        <Inp label={clienteForm.tipoPessoa==="PJ"?"Nome para identificação *":"Nome completo *"} value={clienteForm.nome} onChange={v=>setClienteForm(f=>({...f,nome:v}))}/>
        <Inp label={`${clienteForm.tipoPessoa==="PJ"?"CNPJ":"CPF"} *`} value={maskDoc(clienteForm.documento,clienteForm.tipoPessoa)} onChange={v=>setClienteForm(f=>({...f,documento:soDigitos(v)}))}/>
      </div>

      {clienteForm.tipoPessoa==="PF"?<>
        <p style={{fontSize:10,fontWeight:900,color:C.yellowD,textTransform:"uppercase"}}>Qualificação pessoal</p>
        <div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}>
          <Inp label="RG / documento de identidade" value={clienteForm.rg} onChange={v=>setClienteForm(f=>({...f,rg:v}))}/>
          <Inp label="Órgão expedidor / UF" value={clienteForm.orgaoExpedidor} onChange={v=>setClienteForm(f=>({...f,orgaoExpedidor:v}))} placeholder="Ex.: SDS/PE"/>
          <Inp label="Data de nascimento" type="date" value={clienteForm.dataNascimento} onChange={v=>setClienteForm(f=>({...f,dataNascimento:v}))}/>
          <Inp label="Nacionalidade" value={clienteForm.nacionalidade} onChange={v=>setClienteForm(f=>({...f,nacionalidade:v}))}/>
          <Sel label="Estado civil" value={clienteForm.estadoCivil} onChange={v=>setClienteForm(f=>({...f,estadoCivil:v}))} options={[{v:"",l:"Selecione"},...['Solteiro(a)','Casado(a)','União estável','Divorciado(a)','Separado(a)','Viúvo(a)'].map(v=>({v,l:v}))]}/>
          <Inp label="Regime de bens (se aplicável)" value={clienteForm.regimeBens} onChange={v=>setClienteForm(f=>({...f,regimeBens:v}))} placeholder="Ex.: comunhão parcial"/>
          <Inp label="Profissão" value={clienteForm.profissao} onChange={v=>setClienteForm(f=>({...f,profissao:v}))}/>
        </div>
        {["Casado(a)","União estável"].includes(clienteForm.estadoCivil)&&<div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}><Inp label="Nome completo do cônjuge/companheiro" value={clienteForm.conjugeNome} onChange={v=>setClienteForm(f=>({...f,conjugeNome:v}))}/><Inp label="CPF do cônjuge/companheiro" value={maskDoc(clienteForm.conjugeCpf,"PF")} onChange={v=>setClienteForm(f=>({...f,conjugeCpf:soDigitos(v)}))}/></div>}
      </>:<>
        <p style={{fontSize:10,fontWeight:900,color:C.yellowD,textTransform:"uppercase"}}>Qualificação da empresa</p>
        <div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}>
          <Inp label="Razão social *" value={clienteForm.razaoSocial} onChange={v=>setClienteForm(f=>({...f,razaoSocial:v}))}/>
          <Inp label="Nome fantasia" value={clienteForm.nomeFantasia} onChange={v=>setClienteForm(f=>({...f,nomeFantasia:v}))}/>
          <Inp label="Inscrição estadual" value={clienteForm.inscricaoEstadual} onChange={v=>setClienteForm(f=>({...f,inscricaoEstadual:v}))} placeholder="Isento, se aplicável"/>
          <Inp label="Inscrição municipal" value={clienteForm.inscricaoMunicipal} onChange={v=>setClienteForm(f=>({...f,inscricaoMunicipal:v}))}/>
        </div>
        <p style={{fontSize:10,fontWeight:900,color:C.yellowD,textTransform:"uppercase"}}>Representante legal</p>
        <div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}>
          <Inp label="Nome completo *" value={clienteForm.representanteNome} onChange={v=>setClienteForm(f=>({...f,representanteNome:v}))}/>
          <Inp label="CPF *" value={maskDoc(clienteForm.representanteCpf,"PF")} onChange={v=>setClienteForm(f=>({...f,representanteCpf:soDigitos(v)}))}/>
          <Inp label="RG" value={clienteForm.representanteRg} onChange={v=>setClienteForm(f=>({...f,representanteRg:v}))}/>
          <Inp label="Órgão expedidor / UF" value={clienteForm.representanteOrgaoExpedidor} onChange={v=>setClienteForm(f=>({...f,representanteOrgaoExpedidor:v}))}/>
          <Inp label="Cargo / poderes de representação *" value={clienteForm.representanteCargo} onChange={v=>setClienteForm(f=>({...f,representanteCargo:v}))} placeholder="Ex.: sócio-administrador"/>
          <Inp label="Nacionalidade" value={clienteForm.representanteNacionalidade} onChange={v=>setClienteForm(f=>({...f,representanteNacionalidade:v}))}/>
          <Sel label="Estado civil" value={clienteForm.representanteEstadoCivil} onChange={v=>setClienteForm(f=>({...f,representanteEstadoCivil:v}))} options={[{v:"",l:"Selecione"},...['Solteiro(a)','Casado(a)','União estável','Divorciado(a)','Separado(a)','Viúvo(a)'].map(v=>({v,l:v}))]}/>
          <Inp label="Profissão" value={clienteForm.representanteProfissao} onChange={v=>setClienteForm(f=>({...f,representanteProfissao:v}))}/>
        </div>
      </>}

      <p style={{fontSize:10,fontWeight:900,color:C.yellowD,textTransform:"uppercase"}}>Contato</p>
      <div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}>
        <Inp label="Telefone para contato *" value={clienteForm.telefone} onChange={v=>setClienteForm(f=>({...f,telefone:v}))}/>
        <Inp label="WhatsApp" value={clienteForm.whatsapp} onChange={v=>setClienteForm(f=>({...f,whatsapp:v}))}/>
        <Inp label="E-mail *" type="email" value={clienteForm.email} onChange={v=>setClienteForm(f=>({...f,email:v}))}/>
      </div>

      <p style={{fontSize:10,fontWeight:900,color:C.yellowD,textTransform:"uppercase"}}>{clienteForm.tipoPessoa==="PJ"?"Sede / domicílio contratual":"Endereço onde reside"}</p>
      <div style={{display:"grid",gridTemplateColumns:formGrid(4),gap:8}}>
        <Inp label="CEP *" value={clienteForm.cep} onChange={v=>setClienteForm(f=>({...f,cep:v}))}/>
        <Inp label="Logradouro *" value={clienteForm.endereco} onChange={v=>setClienteForm(f=>({...f,endereco:v}))} placeholder="Rua, avenida..."/>
        <Inp label="Número *" value={clienteForm.numero} onChange={v=>setClienteForm(f=>({...f,numero:v}))}/>
        <Inp label="Complemento" value={clienteForm.complemento} onChange={v=>setClienteForm(f=>({...f,complemento:v}))}/>
        <Inp label="Bairro *" value={clienteForm.bairro} onChange={v=>setClienteForm(f=>({...f,bairro:v}))}/>
        <Inp label="Cidade *" value={clienteForm.cidade} onChange={v=>setClienteForm(f=>({...f,cidade:v}))}/>
        <Inp label="UF *" value={clienteForm.uf} onChange={v=>setClienteForm(f=>({...f,uf:v.toUpperCase().slice(0,2)}))}/>
      </div>
      <Inp label="Observações contratuais" value={clienteForm.observacoes} onChange={v=>setClienteForm(f=>({...f,observacoes:v}))} multiline placeholder="Procurador, segundo contratante, dados do cônjuge, condições especiais..."/>
      {pendenciasCliente(clienteForm).length>0&&<div style={{background:`${C.orange}0B`,border:`1px solid ${C.orange}44`,borderRadius:6,padding:"8px 10px"}}><p style={{fontSize:10,color:C.orange,fontWeight:800}}>Ainda faltam para a qualificação: {pendenciasCliente(clienteForm).join(", ")}.</p></div>}
      <div style={{display:"flex",gap:8}}><Btn v="ghost" onClick={()=>setClienteForm(null)} full>Cancelar</Btn><Btn disabled={!!salvandoComercial} onClick={()=>salvarCliente(clienteForm)} full><Ic n="check"/> {salvandoComercial==="cliente"?"Salvando...":"Salvar cliente"}</Btn></div>
    </div></Modal>}

    {parceiroForm&&<Modal title="Parceiro / indicação" onClose={()=>setParceiroForm(null)}><div style={{display:"flex",flexDirection:"column",gap:8}}><Inp label="Nome *" value={parceiroForm.nome} onChange={v=>setParceiroForm(f=>({...f,nome:v}))}/><Sel label="Tipo" value={parceiroForm.tipo} onChange={v=>setParceiroForm(f=>({...f,tipo:v}))} options={[{v:"indicador",l:"Indicador"},{v:"arquiteto",l:"Arquiteto"},{v:"corretor",l:"Corretor"},{v:"outro",l:"Outro"}]}/><Inp label="Telefone" value={parceiroForm.telefone} onChange={v=>setParceiroForm(f=>({...f,telefone:v}))}/><Inp label="E-mail" value={parceiroForm.email} onChange={v=>setParceiroForm(f=>({...f,email:v}))}/><Inp label="Comissão %" type="number" value={parceiroForm.comissaoPct} onChange={v=>setParceiroForm(f=>({...f,comissaoPct:v}))}/><Inp label="Observações" value={parceiroForm.observacoes} onChange={v=>setParceiroForm(f=>({...f,observacoes:v}))} multiline/><Btn disabled={!!salvandoComercial} onClick={()=>salvarParceiro(parceiroForm)}>{salvandoComercial==="parceiro"?"Salvando...":"SALVAR"}</Btn></div></Modal>}
    {metaForm&&<Modal title="Meta comercial" onClose={()=>setMetaForm(null)}><div style={{display:"flex",flexDirection:"column",gap:8}}><Inp label="Período" type="month" value={metaForm.periodo} onChange={v=>setMetaForm(f=>({...f,periodo:v}))}/><Sel label="Vendedor" value={metaForm.responsavelId} onChange={v=>setMetaForm(f=>({...f,responsavelId:v}))} options={[{v:"",l:"Equipe"},...usuarios.map(u=>({v:u.id,l:u.nome}))]}/><Inp label="Equipe" value={metaForm.equipe} onChange={v=>setMetaForm(f=>({...f,equipe:v}))}/><Inp label="Meta de receita" type="number" value={metaForm.receita} onChange={v=>setMetaForm(f=>({...f,receita:v}))}/><Inp label="Contratos" type="number" value={metaForm.contratos} onChange={v=>setMetaForm(f=>({...f,contratos:v}))}/><Inp label="Ticket médio" type="number" value={metaForm.ticketMedio} onChange={v=>setMetaForm(f=>({...f,ticketMedio:v}))}/><Inp label="Conversão %" type="number" value={metaForm.conversao} onChange={v=>setMetaForm(f=>({...f,conversao:v}))}/><Btn disabled={!!salvandoComercial} onClick={()=>salvarMeta(metaForm)}>{salvandoComercial==="meta"?"Salvando...":"SALVAR META"}</Btn></div></Modal>}
    {perdaForm&&<Modal title="Registrar perda obrigatória" onClose={()=>setPerdaForm(null)}><div style={{display:"flex",flexDirection:"column",gap:8}}><Sel label="Motivo *" value={perdaForm.motivo} onChange={v=>setPerdaForm(f=>({...f,motivo:v}))} options={[{v:"",l:"Selecione"},...COM_PERDAS.map(v=>({v,l:v}))]}/><Inp label="Concorrente" value={perdaForm.concorrente} onChange={v=>setPerdaForm(f=>({...f,concorrente:v}))}/><Inp label="Valor do concorrente" type="number" value={perdaForm.valorConcorrente} onChange={v=>setPerdaForm(f=>({...f,valorConcorrente:v}))}/><Inp label="Possível reativação" type="date" value={perdaForm.reativacaoEm} onChange={v=>setPerdaForm(f=>({...f,reativacaoEm:v}))}/><Inp label="Observações" value={perdaForm.observacoes} onChange={v=>setPerdaForm(f=>({...f,observacoes:v}))} multiline/><Btn v="danger" disabled={!!salvandoComercial} onClick={salvarPerda}>{salvandoComercial==="perda"?"Salvando...":"CONFIRMAR PERDA"}</Btn></div></Modal>}

    {confirmModal && (
      <Modal title={confirmModal.titulo} onClose={()=>setConfirmModal(null)}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <p style={{fontSize:12.5,color:C.muted,lineHeight:1.5,whiteSpace:"pre-line"}}>{confirmModal.mensagem}</p>
          <div style={{display:"flex",gap:8}}>
            <Btn v="ghost" onClick={()=>setConfirmModal(null)} style={{flex:1}}>Cancelar</Btn>
            <Btn v={confirmModal.tom==="danger"?"danger":undefined} style={{flex:1}}
              onClick={()=>{const acao=confirmModal.onConfirmar;setConfirmModal(null);acao();}}>
              {confirmModal.confirmLabel||"Confirmar"}
            </Btn>
          </div>
        </div>
      </Modal>
    )}
  </div>;
}
