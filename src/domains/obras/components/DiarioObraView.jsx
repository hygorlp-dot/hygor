// ===================================================================
// DiarioObraView — tela do Diário de Obra (RDO), extraída de
// src/LegacyApp.jsx em 2026-08-26 (Onda 7 do raio-X). Mesmo padrão já
// usado para Compras/Orçamento/Terceirizados/Equipamentos/RH: mesmo
// corpo, mesma lógica, verbatim. A lógica de escrita (comandos,
// CAS) já tinha saído do update() direto na Onda 1 - esta rodada só
// move a UI para fora do monólito, sem mudar comportamento.
// Inclui ModalServicoRDO (único consumidor era esta tela).
// ===================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import { chamarIA, enviarArquivoOneDrive } from "../../../api";
import {
  Badge, Bloco, Btn, C, Ic, Inp, Modal, PageHero, Sel,
  comprimirImagem, escapeHtml, fmt, fmtDate, obraContextoSalvo, today, uid,
} from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { fieldReportCompletion, fieldReportIsReadOnly } from "../field-report-workflow";
import { aplicarRollup, montarTarefas, orcamentoDaObra } from "../../planejamento/legacy-engine";

const CLIMA_OPC = [
  { v: "bom",          l: "Bom",          c: C.green  },
  { v: "nublado",      l: "Nublado",      c: C.muted  },
  { v: "chuva",        l: "Chuva",        c: C.blue   },
  { v: "impraticavel", l: "Impraticavel", c: C.red    },
];

export default function DiarioObra({ data, showToast, currentUser, obraIdFixo="", dispatchCommand=null }) {
  const { cols } = useBreakpoint();

  const obras = useMemo(() => (data.obras || []).filter(o => o.status !== "done"), [data.obras]);
  const [obraId, setObraId] = useState(()=>obraIdFixo||(obras.some(o=>o.id===obraContextoSalvo())?obraContextoSalvo():(obras[0]?.id||"")));
  const [dataRDO, setDataRDO] = useState(today());
  const [modoRdo, setModoRdo] = useState("lista");
  const [buscaRdo, setBuscaRdo] = useState("");
  const [filtroObraRdo, setFiltroObraRdo] = useState("all");
  const [filtroStatusRdo, setFiltroStatusRdo] = useState("all");
  const [filtroClimaRdo, setFiltroClimaRdo] = useState("all");
  const [inicioRdo, setInicioRdo] = useState("");
  const [fimRdo, setFimRdo] = useState("");
  const [fotoPreviewRdo, setFotoPreviewRdo] = useState(null);
  const [buscaEquipeRdo,setBuscaEquipeRdo]=useState("");
  const [buscaEquipRdo,setBuscaEquipRdo]=useState("");
  const [salvamentoRdo,setSalvamentoRdo]=useState({status:"idle",at:"",message:""});
  const ultimoSalvamentoFalhoRdoRef=useRef(null);
  const [camposRdoLocais,setCamposRdoLocais]=useState({});
  const camposRdoLocaisRef=useRef({});
  const timersCamposRdoRef=useRef(new Map());

  const engenheirosTodos=useMemo(()=>(data.usuarios||[]).filter(u=>u.active!==false&&u.role==="engenheiro"),[data.usuarios]);
  const engenheiroLogado=["engenheiro","engenheiro_auditor"].includes(currentUser?.role)?currentUser:null;
  const obraSelecionada=useMemo(()=>(data.obras||[]).find(o=>o.id===obraId),[data.obras,obraId]);
  const engenheiroDaObra=useMemo(()=>engenheirosTodos.find(u=>u.id===obraSelecionada?.engineerId)
    || engenheirosTodos.find(u=>u.obraId===obraId)
    || engenheirosTodos.find(u=>!u.obraId&&obraSelecionada?.engineer&&u.nome===obraSelecionada?.engineer)
    || (engenheirosTodos.length===1?engenheirosTodos[0]:null),
    [engenheirosTodos,obraSelecionada,obraId]);
  const responsavelAutomatico=engenheiroLogado||engenheiroDaObra||currentUser||null;

  const orc   = useMemo(() => orcamentoDaObra(data, obraId), [data.orcamentos, data.budgetBaselines, obraId]);
  const plano = useMemo(() =>
    (data.planos || []).find(p => p.obraId === obraId)
    || { tarefas: [], marcos: [] }, [data.planos, obraId]);
  const tarefas = useMemo(() =>
    aplicarRollup(montarTarefas(plano, orc), orc).filter(t => !t.titulo),
    [plano, orc]);

  // RDO do dia/obra selecionado (ou um novo em branco).
  const rdoExistente = useMemo(() => (data.rdos || []).find(r => r.obraId === obraId && r.data === dataRDO), [data.rdos, obraId, dataRDO]);
  const proximoCodigoRdo = useMemo(() => Math.max(0, ...(data.rdos||[]).map(x=>Number(x.codigo||0)))+1, [data.rdos]);
  const rdo = rdoExistente || {
    id: "", obraId, data: dataRDO,
    codigo: proximoCodigoRdo,
    status:"preparacao", descricao:"", pendencias:"", comentarios:"", anexos:[],
    transcricaoVoz:"",audios:[],revisaoEngenheiro:{aprovado:false,engenheiroId:"",engenheiro:"",revisadoEm:"",observacao:""},
    clima: { manha: "", tarde: "", noite: "" },
    servicos: [], efetivo: [], presencas: [], terceirizados: [], equipamentos: [],
    ocorrencias: "", fotos: [], responsavel:responsavelAutomatico?.nome||"",responsavelId:responsavelAutomatico?.id||"",
    registradoPor:currentUser?.nome||"",registradoPorId:currentUser?.id||"",
  };

  const [subindo, setSubindo] = useState(false);
  const [subindoAnexo, setSubindoAnexo] = useState(false);
  const [refletindo, setRefletindo] = useState(false);
  const [gravandoVoz,setGravandoVoz]=useState(false);
  const [enviandoAudio,setEnviandoAudio]=useState(false);
  const mediaRecorderRdoRef=useRef(null);
  const recognitionRdoRef=useRef(null);
  const audioChunksRdoRef=useRef([]);
  const [servicoModal, setServicoModal] = useState(null);
  const filaSalvamentoRdoRef=useRef(Promise.resolve({ok:true}));
  useEffect(()=>{const id=sessionStorage.getItem("arcd_rdo_obra");if(id&&(data.obras||[]).some(o=>o.id===id)){setObraId(id);setFiltroObraRdo(id);}sessionStorage.removeItem("arcd_rdo_obra");},[data.obras]);

  // ---- Persistencia do RDO ----
  const executarSalvarRDO = async (mut) => {
    if(fieldReportIsReadOnly(rdo)){
      showToast?.("Este diário está encerrado e disponível somente para consulta.","error");
      return {ok:false,reason:"read_only"};
    }
    if(!dispatchCommand){
      const message="O diário de obra exige conexão com o servidor para ser salvo com segurança.";
      setSalvamentoRdo({status:"error",at:"",message});
      showToast?.(message,"error");
      return {ok:false,reason:message};
    }
    setSalvamentoRdo({status:"saving",at:"",message:"Salvando alterações..."});
    ultimoSalvamentoFalhoRdoRef.current=mut;
    const idempotencyKey=`rdo-${uid()}-${Date.now()}`;
    const result=await dispatchCommand(atual=>{
      const existente=(atual.rdos||[]).find(item=>item.obraId===obraId&&item.data===dataRDO);
      const base=existente
        ? {...existente,responsavel:existente.responsavel||responsavelAutomatico?.nome||"",responsavelId:existente.responsavelId||responsavelAutomatico?.id||"",registradoPor:existente.registradoPor||currentUser?.nome||"",registradoPorId:existente.registradoPorId||currentUser?.id||""}
        : {...rdo,id:uid(),criadoEm:new Date().toISOString(),atualizadoEm:new Date().toISOString()};
      const report=mut(base);
      return {type:OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED,idempotencyKey,expectedVersion:Number(existente?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{report}};
    });
    if(!result?.ok){const message=result?.reason||"Não foi possível registrar o diário.";setSalvamentoRdo({status:"error",at:"",message});showToast?.(message,"error");return result;}
    ultimoSalvamentoFalhoRdoRef.current=null;
    setSalvamentoRdo({status:"saved",at:new Date().toISOString(),message:"Alterações confirmadas pelo servidor."});
    return result;
  };
  const salvarRDO=mut=>{const operacao=filaSalvamentoRdoRef.current.catch(()=>({ok:false})).then(()=>executarSalvarRDO(mut));filaSalvamentoRdoRef.current=operacao;return operacao;};

  const setClima = (periodo, valor) => salvarRDO(r => {
    r.clima = { ...r.clima, [periodo]: valor };
    return r;
  });
  const aplicarClimaTodos=valor=>salvarRDO(r=>({...r,clima:{manha:valor,tarde:valor,noite:valor},atualizadoEm:new Date().toISOString()}));

  const setOcorrencias = (txt) => salvarRDO(r => { r.ocorrencias = txt; return r; });
  const setCampoRdo = (campo, valor) => salvarRDO(r => ({...r,[campo]:valor,atualizadoEm:new Date().toISOString()}));
  const valorCampoRdo=campo=>Object.prototype.hasOwnProperty.call(camposRdoLocais,campo)?camposRdoLocais[campo]:(rdo[campo]||"");
  const salvarCampoRdoPendente=async(campo,valor)=>{timersCamposRdoRef.current.delete(campo);const result=await setCampoRdo(campo,valor);if(result?.ok&&camposRdoLocaisRef.current[campo]===valor){const next={...camposRdoLocaisRef.current};delete next[campo];camposRdoLocaisRef.current=next;setCamposRdoLocais(next);}return result;};
  const editarCampoRdo=(campo,valor)=>{const next={...camposRdoLocaisRef.current,[campo]:valor};camposRdoLocaisRef.current=next;setCamposRdoLocais(next);setSalvamentoRdo({status:"local",at:"",message:"Alterações locais aguardando sincronização."});const antigo=timersCamposRdoRef.current.get(campo);if(antigo)window.clearTimeout(antigo);timersCamposRdoRef.current.set(campo,window.setTimeout(()=>salvarCampoRdoPendente(campo,valor),650));};
  const confirmarCampoRdo=campo=>{const timer=timersCamposRdoRef.current.get(campo);if(!timer)return;window.clearTimeout(timer);salvarCampoRdoPendente(campo,camposRdoLocaisRef.current[campo]);};
  const sincronizarCamposRdo=async()=>{const entries=Object.entries(camposRdoLocaisRef.current);if(!entries.length)return {ok:true};entries.forEach(([campo])=>{const timer=timersCamposRdoRef.current.get(campo);if(timer)window.clearTimeout(timer);});const results=await Promise.all(entries.map(([campo,valor])=>salvarCampoRdoPendente(campo,valor)));return {ok:results.every(result=>result?.ok)};};
  useEffect(()=>()=>timersCamposRdoRef.current.forEach(timer=>window.clearTimeout(timer)),[]);
  useEffect(()=>{timersCamposRdoRef.current.forEach(timer=>window.clearTimeout(timer));timersCamposRdoRef.current.clear();camposRdoLocaisRef.current={};setCamposRdoLocais({});},[obraId,dataRDO]);
  const trocarContextoRdo=async(tipo,valor)=>{const result=await sincronizarCamposRdo();const pending=await filaSalvamentoRdoRef.current;if(!result.ok||!pending?.ok){showToast?.("A troca foi bloqueada porque há alterações que ainda não foram salvas.","error");return;}if(tipo==="obra")setObraId(valor);else setDataRDO(valor);};

  const abrirRdo = item => { setObraId(item.obraId); setDataRDO(item.data); setModoRdo("editor"); };
  const novoRdo = () => { setObraId(filtroObraRdo!=="all"?filtroObraRdo:(obraId||obras[0]?.id||"")); setDataRDO(today()); setModoRdo("editor"); };
  const concluirRdo = async () => {
    if(!["engenheiro","engenheiro_auditor"].includes(currentUser?.role)){showToast?.("Somente um engenheiro pode revisar e concluir o diário.","error");return;}
    const reportEfetivo={...rdo,...camposRdoLocaisRef.current};
    const completion=fieldReportCompletion(reportEfetivo);
    if(!completion.complete){const first=completion.pending[0];document.getElementById(`rdo-etapa-${first.id}`)?.scrollIntoView({behavior:"smooth",block:"start"});showToast?.(`Antes de concluir: ${completion.pending.map(item=>item.label).join(", ")}.`,"error");return;}
    const synchronized=await sincronizarCamposRdo();if(!synchronized.ok){showToast?.("Confirme as alterações pendentes antes de concluir.","error");return;}
    const result=await salvarRDO(r=>({...r,status:"concluido",concluidoEm:new Date().toISOString(),atualizadoEm:new Date().toISOString()}));
    if(result?.ok)showToast?.("RDO concluído e bloqueado para edição.");
  };
  const reabrirRdo=async()=>{
    if(currentUser?.role!=="admin"||!rdo.id||!dispatchCommand)return;
    const motivo=window.prompt("Justificativa administrativa para reabrir este RDO:");
    if(String(motivo||"").trim().length<8){if(motivo!=null)showToast?.("Informe uma justificativa com pelo menos 8 caracteres.","error");return;}
    setSalvamentoRdo({status:"saving",at:"",message:"Reabrindo diário..."});
    const result=await dispatchCommand(atual=>{const vigente=(atual.rdos||[]).find(item=>item.id===rdo.id);return {type:OPERATIONAL_COMMAND.FIELD_REPORT_REOPENED,idempotencyKey:`rdo-reabertura-${rdo.id}-${uid()}`,expectedVersion:Number(vigente?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",actorRole:currentUser?.role||"",payload:{reportId:rdo.id,reason:String(motivo).trim()}};});
    if(!result?.ok){setSalvamentoRdo({status:"error",at:"",message:result?.reason||"Não foi possível reabrir o diário."});showToast?.(result?.reason||"Não foi possível reabrir o diário.","error");return;}
    setSalvamentoRdo({status:"saved",at:new Date().toISOString(),message:"Diário reaberto para correção."});showToast?.("RDO reaberto. A revisão técnica anterior foi invalidada.");
  };
  const excluirRdo = async item => {
    if(!window.confirm(`Cancelar o RDO ${item.codigo||""} de ${fmtDate(item.data)}? O documento será bloqueado e continuará disponível no histórico.`))return false;
    const motivo=window.prompt(`Motivo do cancelamento do RDO ${item.codigo||""} de ${fmtDate(item.data)}:`);
    if(!String(motivo||"").trim())return false;
    if(!dispatchCommand){showToast?.("Cancelar o diário de obra exige conexão com o servidor.","error");return false;}
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.rdos||[]).find(x=>x.id===item.id);
      return {type:OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED,idempotencyKey:`rdo-cancelamento-${item.id}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{reportId:item.id,reason:String(motivo).trim()}};
    });
    if(!result?.ok){showToast?.(result?.reason||"Não foi possível cancelar o diário.","error");return false;}
    showToast?.("Diário cancelado e preservado no histórico."); return true;
  };
  const duplicarRdo = async item => {
    const codigo=Math.max(0,...(data.rdos||[]).map(x=>Number(x.codigo||0)))+1;
    let novaData=today(); while((data.rdos||[]).some(x=>x.obraId===item.obraId&&x.data===novaData)){const d=new Date(`${novaData}T12:00:00`);d.setDate(d.getDate()+1);novaData=d.toISOString().slice(0,10);}
    const {operationalHistory:ignoredHistory,motivoCancelamento:ignoredCancelReason,canceladoEm:ignoredCancelledAt,canceladoPor:ignoredCancelledBy,canceladoPorId:ignoredCancelledById,reabertoEm:ignoredReopenedAt,reabertoPor:ignoredReopenedBy,reabertoPorId:ignoredReopenedById,motivoReabertura:ignoredReopenReason,...conteudo}=item;
    const copia={...conteudo,id:uid(),codigo,status:"preparacao",data:novaData,fotos:[],anexos:[],revisaoEngenheiro:{aprovado:false,engenheiroId:"",engenheiro:"",revisadoEm:"",observacao:""},responsavel:responsavelAutomatico?.nome||"",responsavelId:responsavelAutomatico?.id||"",registradoPor:currentUser?.nome||"",registradoPorId:currentUser?.id||"",criadoEm:new Date().toISOString(),atualizadoEm:new Date().toISOString(),concluidoEm:""};
    const result=await dispatchCommand({type:OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED,idempotencyKey:`rdo-duplicar-${copia.id}-${uid()}`,expectedVersion:0,actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{report:copia}});
    if(!result?.ok){showToast?.(result?.reason||"Não foi possível duplicar o diário.","error");return;}
    setObraId(copia.obraId);setDataRDO(copia.data);setModoRdo("editor");showToast?.("Conteúdo copiado para um novo rascunho sem aprovação ou auditoria anterior.");
  };

  const imprimirRdo = item => {
    const obra=(data.obras||[]).find(o=>o.id===item.obraId);
    const equipe=(item.presencas||[]).map(p=>`${(data.employees||[]).find(e=>e.id===p.empId)?.name||"Funcionário não localizado"}: ${p.status||"não informado"}`);
    const fotos=(item.fotos||[]).map(f=>`<figure><img src="${escapeHtml(f.url)}"><figcaption>${escapeHtml(f.legenda||"")}</figcaption></figure>`).join("");
    const clima=Object.entries(item.clima||{}).map(([p,v])=>`${p}: ${CLIMA_OPC.find(x=>x.v===v)?.l||v}`).join(" · ");
    const status=item.status==="concluido"?"Concluído":item.status==="cancelado"?"Cancelado":"Rascunho / não concluído";
    const lista=(itens,vazio="Nenhum registro")=>itens.length?`<ul>${itens.map(valor=>`<li>${escapeHtml(valor)}</li>`).join("")}</ul>`:`<p>${vazio}</p>`;
    const servicos=(item.servicos||[]).map(s=>`${tarefas.find(t=>t.id===s.tarefaId)?.nome||s.descricao||"Serviço"}: ${Number(s.progressoAte||0)}%${s.obs?` — ${s.obs}`:""}`);
    const terceiros=(item.terceirizados||[]).map(t=>`${(data.terceirizados||[]).find(x=>x.id===t.tercId)?.name||"Terceirizado não localizado"}: ${t.status||"não informado"}`);
    const equipamentos=(item.equipamentos||[]).map(e=>`${(data.equipamentos||[]).find(x=>x.id===e.equipId)?.nome||e.nome||"Equipamento"}: ${Number(e.horas||0)} h`);
    const anexos=[...(item.anexos||[]).map(a=>a.nome||"Documento anexado"),...(item.audios||[]).map(a=>a.nome||"Áudio do diário")];
    const historico=(item.operationalHistory||[]).map(e=>`${e.type||"evento"} — ${e.at?new Date(e.at).toLocaleString("pt-BR"):"sem data"} — ${e.by||"autoria não informada"}${e.reason?` — ${e.reason}`:""}`);
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>RDO ${item.codigo}</title><style>body{font-family:"IBM Plex Sans",Arial,sans-serif;margin:32px;color:#222;line-height:1.45}.marca{padding:10px;border:2px solid #a2191f;color:#a2191f;text-align:center;font-weight:700;text-transform:uppercase}header{border-bottom:3px solid #d4a91e;padding-bottom:12px}h1{font-size:22px}h2{font-size:14px;margin-top:20px;border-bottom:1px solid #ddd;padding-bottom:5px}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:12px}.box{white-space:pre-wrap;background:#f6f6f6;padding:10px}.ia{white-space:pre-wrap;background:#f3f7ff;border:1px solid #1565c0;padding:12px}li,p{font-size:12px}figure{display:inline-block;width:30%;margin:1%;vertical-align:top}img{width:100%;height:150px;object-fit:cover}figcaption{font-size:10px}@media print{button{display:none}}</style></head><body><button onclick="print()">Imprimir / salvar PDF</button>${item.status!=="concluido"?`<div class="marca">${escapeHtml(status)}</div>`:""}<header><h1>${escapeHtml(data.config.companyName||"ARCD OBRAS")} · RDO ${item.codigo}</h1><b>${escapeHtml(obra?.name||"")}</b><p>${escapeHtml(obra?.address||"")}</p></header><div class="meta"><p><b>Data:</b> ${fmtDate(item.data)}</p><p><b>Status:</b> ${escapeHtml(status)}</p><p><b>Clima:</b> ${escapeHtml(clima||"Não informado")}</p><p><b>Responsável:</b> ${escapeHtml(item.responsavel||"-")}</p><p><b>Registrado por:</b> ${escapeHtml(item.registradoPor||"-")}</p><p><b>Versão:</b> ${Number(item.version||0)}</p></div><h2>Descrição e atividades</h2><div class="box">${escapeHtml(item.descricao||item.transcricaoVoz||"Não informado")}</div><h2>Serviços executados</h2>${lista(servicos)}<h2>Efetivo e presenças</h2>${lista(equipe)}<h2>Terceirizados</h2>${lista(terceiros)}<h2>Equipamentos</h2>${lista(equipamentos)}<h2>Ocorrências</h2><div class="box">${escapeHtml(item.ocorrencias||"Nenhuma ocorrência registrada")}</div><h2>Pendências e comentários</h2><div class="box">${escapeHtml([item.pendencias,item.comentarios].filter(Boolean).join("\n")||"Nenhum registro")}</div><h2>Revisão técnica</h2><p>${item.revisaoEngenheiro?.aprovado?`Aprovado por ${escapeHtml(item.revisaoEngenheiro.engenheiro||"engenheiro não identificado")} em ${escapeHtml(item.revisaoEngenheiro.revisadoEm?new Date(item.revisaoEngenheiro.revisadoEm).toLocaleString("pt-BR"):"data não informada")}`:"Não aprovada"}</p>${item.status==="cancelado"?`<h2>Cancelamento</h2><p>${escapeHtml(item.motivoCancelamento||"Motivo não informado")}</p>`:""}<h2>Anexos e áudios</h2>${lista(anexos)}<h2>Histórico auditável</h2>${lista(historico)}${fotos?`<h2>Registro fotográfico</h2>${fotos}`:""}${item.reflexaoIA?.texto?`<h2>Reflexão técnica por IA</h2><div class="ia">${escapeHtml(item.reflexaoIA.texto)}</div>`:""}</body></html>`;
    const w=window.open("","_blank"); if(w){w.opener=null;w.document.write(html);w.document.close();}else showToast?.("O navegador bloqueou a janela do relatório. Permita pop-ups para este site.","error");
  };

  const rdosFiltrados=useMemo(()=>[...(data.rdos||[])].filter(item=>{
    const obra=(data.obras||[]).find(o=>o.id===item.obraId); const q=buscaRdo.toLocaleLowerCase("pt-BR");
    const climas=Object.values(item.clima||{});
    return (filtroObraRdo==="all"||item.obraId===filtroObraRdo)&&(filtroStatusRdo==="all"||item.status===filtroStatusRdo)&&(filtroClimaRdo==="all"||climas.includes(filtroClimaRdo))&&(!inicioRdo||item.data>=inicioRdo)&&(!fimRdo||item.data<=fimRdo)&&(!q||String(item.codigo||"").includes(q)||String(item.descricao||item.ocorrencias||item.pendencias||"").toLocaleLowerCase("pt-BR").includes(q)||String(obra?.name||"").toLocaleLowerCase("pt-BR").includes(q));
  }).sort((a,b)=>(b.data||"").localeCompare(a.data||"")||Number(b.codigo||0)-Number(a.codigo||0)),[data.rdos,data.obras,buscaRdo,filtroObraRdo,filtroStatusRdo,filtroClimaRdo,inicioRdo,fimRdo]);


  // ---- Equipamentos na obra (do cadastro de Equipamentos) ----
  // Mostra os equipamentos disponíveis + os que já estão nesta obra. Marcar
  // inclui/remove o equipamento no diário do dia; dá pra registrar as horas.
  const equipamentosDaObra = useMemo(() => (data.equipamentos || [])
    .filter(e => e.ativo !== false && (e.obraAtualId === obraId || e.status !== "inativo")),
    [data.equipamentos, obraId]);
  // Map obraId->obra, montado uma vez, para a lista de RDOs nao fazer
  // .find() em data.obras por card renderizado.
  const obraPorIdRdo = useMemo(() => new Map((data.obras||[]).map(o => [o.id, o])), [data.obras]);
  // Idem para funcionarios/terceirizados no editor de servicos executados.
  const employeePorId = useMemo(() => new Map((data.employees||[]).map(e => [e.id, e])), [data.employees]);
  const tercPorId = useMemo(() => new Map((data.terceirizados||[]).map(t => [t.id, t])), [data.terceirizados]);
  const equipNoRdo = (equipId) => (rdo.equipamentos || []).find(x => x.equipId === equipId);
  const toggleEquip = (equipId) => salvarRDO(r => {
    const existe = (r.equipamentos || []).some(x => x.equipId === equipId);
    r.equipamentos = existe
      ? (r.equipamentos || []).filter(x => x.equipId !== equipId)
      : [...(r.equipamentos || []), { equipId, nome: "", quantidade: 1, horas: 0 }];
    return r;
  });
  const setEquipHoras = (equipId, horas) => salvarRDO(r => {
    r.equipamentos = (r.equipamentos || []).map(x => x.equipId === equipId ? { ...x, horas: Number(horas || 0) } : x);
    return r;
  });

  // Servico executado: grava no RDO. O timestamp torna esta medicao editavel
  // em qualquer tela: a ultima alteracao realizada e a que prevalece.
  const upsertServico = (s) => salvarRDO(r => {
    const atualizadoEm = new Date().toISOString();
    const servico = { ...s, atualizadoEm };
    const existe = (r.servicos || []).some(x => x.tarefaId === s.tarefaId);
    r.servicos = existe
      ? r.servicos.map(x => x.tarefaId === s.tarefaId ? { ...x, ...servico } : x)
      : [...(r.servicos || []), servico];
    r.atualizadoEm = atualizadoEm;
    return r;
  });
  const removerServico = (tarefaId) => salvarRDO(r => {
    r.servicos = (r.servicos || []).filter(x => x.tarefaId !== tarefaId);
    return r;
  });

  // ---- Presencas (ponto direto no diario) ----
  const empregadosObra = (data.employees || [])
    .filter(e => e.active !== false && (e.obra === obraId || !e.obra));
  const presencaDe = (empId) =>
    (rdo.presencas || []).find(p => p.empId === empId)?.status || "";
  const setPresencaRdo = (empId,status) => salvarRDO(r => {
    r.presencas = (r.presencas || []).filter(p => p.empId !== empId);
    if(status)r.presencas.push({empId,status});
    return r;
  });
  const marcarTodosPresentesRdo=()=>salvarRDO(r=>({...r,presencas:empregadosObra.map(emp=>({empId:emp.id,status:"presente"})),atualizadoEm:new Date().toISOString()}));

  // ---- Terceirizados na obra (contratos ativos desta obra) ----
  const terceirizadosObra = (data.terceirizados || [])
    .filter(t => t.obraId === obraId && t.situacao !== "concluido");
  const statusTerc = (tercId) =>
    (rdo.terceirizados || []).find(t => t.tercId === tercId)?.status || "";
  // Mesmo ciclo do ponto próprio: presente → meio → falta → (limpa).
  const setStatusTercRdo = (tercId,status) => salvarRDO(r => {
    const etapaAtual = (r.terceirizados || []).find(t => t.tercId === tercId)?.etapaId || "";
    r.terceirizados = (r.terceirizados || []).filter(t => t.tercId !== tercId);
    if(status)r.terceirizados.push({tercId,status,etapaId:etapaAtual});
    return r;
  });
  // Etapa em que o terceirizado trabalhou hoje (usa as etapas do contrato dele).
  const setEtapaTerc = (tercId, etapaId) => salvarRDO(r => {
    const atual = (r.terceirizados || []).find(t => t.tercId === tercId);
    r.terceirizados = (r.terceirizados || []).filter(t => t.tercId !== tercId);
    r.terceirizados.push({ tercId, status: atual?.status || "presente", etapaId });
    return r;
  });

  // ---- Voz e áudio ----
  // O reconhecimento ocorre no próprio navegador durante a gravação. O áudio
  // original é enviado ao OneDrive para manter a evidência junto ao RDO.
  const blobParaDataUrl=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
  const enviarAudioRdo=async(blob,nome)=>{
    setEnviandoAudio(true);
    try{
      const dataUrl=await blobParaDataUrl(blob);const obraAtual=(data.obras||[]).find(o=>o.id===obraId);
      const resp=await enviarArquivoOneDrive({dataUrl,obraName:obraAtual?.name||"Obra",driveId:obraAtual?.oneDriveDriveId,folderId:obraAtual?.oneDriveFolderId,folders:obraAtual?.oneDriveFolders,category:"diario",date:dataRDO,fileName:nome});
      if(!resp.ok&&!resp.url)throw new Error(resp.error||"Não foi possível enviar o áudio.");
      salvarRDO(r=>({...r,audios:[...(r.audios||[]),{id:resp.item?.id||uid(),nome:resp.item?.name||nome,url:resp.item?.webUrl||resp.url,path:resp.path||"",criadoEm:new Date().toISOString()}],atualizadoEm:new Date().toISOString()}));
      showToast?.("Áudio e transcrição adicionados ao diário.");
    }catch(err){showToast?.(err.message||"Falha ao enviar o áudio.","error");}finally{setEnviandoAudio(false);}
  };
  const iniciarVoz=async()=>{
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){showToast?.("Este navegador não permite gravar áudio.","error");return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const recorder=new MediaRecorder(stream);audioChunksRdoRef.current=[];
      recorder.ondataavailable=e=>{if(e.data?.size)audioChunksRdoRef.current.push(e.data);};
      recorder.onstop=()=>{const tipo=recorder.mimeType||"audio/webm";const blob=new Blob(audioChunksRdoRef.current,{type:tipo});stream.getTracks().forEach(t=>t.stop());if(blob.size)enviarAudioRdo(blob,`relato-${Date.now()}.${tipo.includes("mp4")?"m4a":"webm"}`);};
      const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(SpeechRecognition){const recognition=new SpeechRecognition();recognition.lang="pt-BR";recognition.continuous=true;recognition.interimResults=false;recognition.onresult=evento=>{let texto="";for(let i=evento.resultIndex;i<evento.results.length;i++)if(evento.results[i].isFinal)texto+=`${evento.results[i][0].transcript} `;if(texto.trim())salvarRDO(r=>({...r,transcricaoVoz:`${r.transcricaoVoz||""}${r.transcricaoVoz?" ":""}${texto.trim()}`,atualizadoEm:new Date().toISOString()}));};try{recognition.start();recognitionRdoRef.current=recognition;}catch{}}
      recorder.start();mediaRecorderRdoRef.current=recorder;setGravandoVoz(true);
    }catch{showToast?.("Autorize o microfone para registrar o relato.","error");}
  };
  const pararVoz=()=>{try{recognitionRdoRef.current?.stop();}catch{}try{if(mediaRecorderRdoRef.current?.state!=="inactive")mediaRecorderRdoRef.current?.stop();}catch{}recognitionRdoRef.current=null;mediaRecorderRdoRef.current=null;setGravandoVoz(false);};
  const escolherAudioRdo=async e=>{const file=e.target.files?.[0];if(!file)return;await enviarAudioRdo(file,file.name||`relato-${Date.now()}.webm`);e.target.value="";};

  // ---- Foto ----
  const escolherFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubindo(true);
    try {
      const dataUrl = await comprimirImagem(file);
      const obraAtual=(data.obras||[]).find(o=>o.id===obraId);
      const resp = await enviarArquivoOneDrive({dataUrl,obraName:obraAtual?.name||"Obra",driveId:obraAtual?.oneDriveDriveId,folderId:obraAtual?.oneDriveFolderId,folders:obraAtual?.oneDriveFolders,category:"diario",date:dataRDO,fileName:`foto-${Date.now()}.jpg`});
      if (resp.url) {
        salvarRDO(r => { r.fotos = [...(r.fotos || []), { url: resp.url, legenda: "", path: resp.path || "" }]; return r; });
        showToast?.("Foto adicionada ao diario");
      } else if (resp.error === "bucket_ausente") {
        showToast?.("Crie o bucket 'diario-obra' no Supabase Storage primeiro");
      } else {
        showToast?.(resp.error || "Nao foi possivel subir a foto");
      }
    } catch (err) {
      showToast?.("Falha ao processar a foto");
    } finally {
      setSubindo(false);
      e.target.value = "";
    }
  };
  const escolherAnexoRdo = async e => {
    const file=e.target.files?.[0]; if(!file)return; setSubindoAnexo(true);
    try{const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const obraAtual=(data.obras||[]).find(o=>o.id===obraId);const resp=await enviarArquivoOneDrive({dataUrl,obraName:obraAtual?.name||"Obra",driveId:obraAtual?.oneDriveDriveId,folderId:obraAtual?.oneDriveFolderId,folders:obraAtual?.oneDriveFolders,category:"diario",date:dataRDO,fileName:file.name});if(!resp.ok)throw new Error(resp.error||"Falha no envio.");salvarRDO(r=>({...r,anexos:[...(r.anexos||[]),{id:resp.item.id,nome:resp.item.name,url:resp.item.webUrl,tipo:file.type,tamanho:file.size}]}));showToast?.("Anexo enviado ao OneDrive.");}catch(err){showToast?.(err.message||"Falha ao enviar anexo.","error");}finally{setSubindoAnexo(false);e.target.value="";}
  };
  const removerFoto = (url) => salvarRDO(r => {
    r.fotos = (r.fotos || []).filter(f => f.url !== url);
    return r;
  });
  const setLegenda = (url, legenda) => salvarRDO(r => {
    r.fotos = (r.fotos || []).map(f => f.url === url ? { ...f, legenda } : f);
    return r;
  });

  const refletirRdo = async () => {
    if(!(rdo.fotos||[]).length){showToast?.("Adicione ao menos uma foto para a IA analisar.","error");return;}
    setRefletindo(true);
    try{
      const imagens=(await Promise.all((rdo.fotos||[]).slice(0,6).map(async foto=>{
        try{const resp=await fetch(foto.url,{credentials:"include"});if(!resp.ok)return null;const blob=await resp.blob();return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({dataUrl:reader.result,legenda:foto.legenda||""});reader.onerror=reject;reader.readAsDataURL(blob);});}catch{return null;}
      }))).filter(Boolean);
      if(!imagens.length)throw new Error("Não foi possível carregar as imagens para análise.");
      const obraAtual=(data.obras||[]).find(o=>o.id===obraId);
      const contexto={obra:{nome:obraAtual?.name,endereco:obraAtual?.address,areaM2:obraAtual?.areaM2},planejamento:tarefas.map(t=>({id:t.id,nome:t.nome,inicio:t.inicio,fim:t.fim,progresso:t.progresso})),rdo:{codigo:rdo.codigo,data:rdo.data,clima:rdo.clima,descricao:rdo.descricao,transcricaoVoz:rdo.transcricaoVoz,ocorrencias:rdo.ocorrencias,pendencias:rdo.pendencias,comentarios:rdo.comentarios,servicos:(rdo.servicos||[]).map(s=>({descricao:tarefas.find(t=>t.id===s.tarefaId)?.nome||s.descricao,progressoAte:s.progressoAte,observacao:s.obs})),presencas:{presentes,meios,faltas:(rdo.presencas||[]).filter(p=>p.status==="falta").length},terceirizados:(rdo.terceirizados||[]).length,equipamentos:(rdo.equipamentos||[]).map(e=>({nome:(data.equipamentos||[]).find(x=>x.id===e.equipId)?.nome||e.nome,horas:e.horas})),legendas:imagens.map(x=>x.legenda)}};
      const prompt=`Analise conjuntamente os dados, a transcrição de voz, o planejamento e TODAS as imagens deste Diário de Obra. Responda SOMENTE JSON válido, sem markdown, neste formato: {"resumo":"", "evidencias":[""], "equipesServicos":[""], "avancoSugerido":[{"servico":"","percentual":0,"justificativa":""}], "riscos":[{"descricao":"","impacto":"baixo|medio|alto|critico"}], "clima":{"leitura":"","impacto":""}, "pendencias":[{"descricao":"","responsavelSugerido":"","prazoSugerido":""}], "materiais":[""], "comparacaoPlanejamento":"", "atividadesNaoPrevistas":[""], "prioridades":[""]}. Não invente. Diferencie fato observado de indício; fotografia não produz laudo definitivo. Percentual de avanço é apenas sugestão para revisão do engenheiro.`;
      const json=await chamarIA({modulo:"diario",prompt,contexto,imagens});if(!json.ok)throw new Error(json.error||"A IA não respondeu.");
      const resposta=json.reply||json.answer;if(!resposta)throw new Error("A IA não retornou um diagnóstico.");
      let analise=null;try{analise=JSON.parse(String(resposta).replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""));}catch{}
      const texto=analise?.resumo||resposta;
      salvarRDO(item=>({...item,reflexaoIA:{texto,analise,geradoEm:new Date().toISOString(),geradoPor:currentUser?.nome||"",fotosAnalisadas:imagens.length},revisaoEngenheiro:{aprovado:false,engenheiroId:"",engenheiro:"",revisadoEm:"",observacao:""},atualizadoEm:new Date().toISOString()}));
      showToast?.("Reflexão técnica gerada e salva no diário.");
    }catch(err){showToast?.(err.message||"Falha ao analisar o diário.","error");}finally{setRefletindo(false);}
  };

  const aplicarSugestoesRdo=()=>{const a=rdo.reflexaoIA?.analise;if(!a)return;const blocoPend=(a.pendencias||[]).map(p=>`• ${p.descricao}${p.responsavelSugerido?` — responsável sugerido: ${p.responsavelSugerido}`:""}${p.prazoSugerido?` — prazo: ${p.prazoSugerido}`:""}`).join("\n");const blocoOc=[...(a.riscos||[]).map(x=>`Risco ${x.impacto||""}: ${x.descricao}`),...(a.atividadesNaoPrevistas||[]).map(x=>`Atividade não prevista: ${x}`)].join("\n");salvarRDO(item=>({...item,pendencias:[item.pendencias,blocoPend].filter(Boolean).join("\n"),ocorrencias:[item.ocorrencias,blocoOc].filter(Boolean).join("\n"),atualizadoEm:new Date().toISOString()}));showToast?.("Sugestões incorporadas ao rascunho para revisão.");};

  const presentes = (rdo.presencas || []).filter(p => p.status === "presente").length;
  const meios = (rdo.presencas || []).filter(p => p.status === "meio").length;
  const completionRdo=fieldReportCompletion({...rdo,...camposRdoLocais});
  const requisitosAntesRevisaoOk=completionRdo.checks.filter(item=>item.id!=="revisao").every(item=>item.complete);
  const somenteLeituraRdo=fieldReportIsReadOnly(rdo);
  const salvarNovamenteRdo=()=>ultimoSalvamentoFalhoRdoRef.current&&salvarRDO(ultimoSalvamentoFalhoRdoRef.current);
  const irParaEtapa=id=>document.getElementById(`rdo-etapa-${id}`)?.scrollIntoView({behavior:"smooth",block:"start"});
  const voltarHistoricoRdo=async()=>{const result=await sincronizarCamposRdo();if(result.ok)setModoRdo("lista");else showToast?.("Há alterações que ainda não foram confirmadas. Tente novamente antes de sair.","error");};

  if (!obras.length) {
    return <div style={{ padding: 24, textAlign: "center" }}>
      <p style={{ fontSize: 13, color: C.muted }}>Cadastre uma obra para abrir o diario.</p>
    </div>;
  }

  if (modoRdo === "lista") {
    return <div className="anim" style={{display:"flex",flexDirection:"column",gap:10}}>
      <PageHero
        eyebrow="Engenharia de campo"
        title="Diário de Obra"
        description={`${(data.rdos||[]).length} relatório(s) registrados`}
        actions={<Btn onClick={novoRdo}><Ic n="plus"/> Novo relatório</Btn>}
      />
      <div style={{display:"grid",gridTemplateColumns:cols(1,2,4),gap:7,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:10}}>
        <Inp value={inicioRdo} onChange={setInicioRdo} type="date" label="Data inicial"/>
        <Inp value={fimRdo} onChange={setFimRdo} type="date" label="Data final"/>
        <Sel value={filtroObraRdo} onChange={setFiltroObraRdo} label="Obra" options={[{v:"all",l:"Todas"},...(data.obras||[]).map(o=>({v:o.id,l:o.name}))]}/>
        <Sel value={filtroStatusRdo} onChange={setFiltroStatusRdo} label="Status" options={[{v:"all",l:"Todos"},{v:"preparacao",l:"Em preparação"},{v:"concluido",l:"Concluído"},{v:"cancelado",l:"Cancelado"}]}/>
        <Sel value={filtroClimaRdo} onChange={setFiltroClimaRdo} label="Clima" options={[{v:"all",l:"Todos"},...CLIMA_OPC.map(o=>({v:o.v,l:o.l}))]}/>
        <Inp value={buscaRdo} onChange={setBuscaRdo} label="Pesquisar" placeholder="Código, obra ou descrição"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:cols(1,2,3),gap:9}}>
        {rdosFiltrados.map(item=>{const obra=obraPorIdRdo.get(item.obraId);const statusLabel=item.status==="concluido"?"Concluído":item.status==="cancelado"?"Cancelado":"Em preparação";const statusColor=item.status==="concluido"?C.green:item.status==="cancelado"?C.red:C.orange;return <article key={item.id} className="rdo-history-card" data-status={item.status||"preparacao"}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:7}}><div><b style={{fontSize:14,color:C.text}}>RDO-{String(item.codigo||0).padStart(3,"0")} · {fmtDate(item.data)}</b><p style={{fontSize:12,color:C.muted,marginTop:2}}>{obra?.name||"Obra removida"}</p></div><Badge color={statusColor}>{statusLabel}</Badge></div>
          <p className="brk" style={{fontSize:13,color:C.subtle,marginTop:7,minHeight:28,lineHeight:1.5}}>{[item.descricao,item.ocorrencias,item.pendencias].filter(Boolean).join(" · ")||item.responsavel||"Sem descrição informada."}</p>
          {item.status==="cancelado"&&<p className="rdo-cancel-reason"><b>Motivo do cancelamento:</b> {item.motivoCancelamento||"Não informado"}</p>}
          {(item.fotos||[]).length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginTop:8}}>{item.fotos.slice(0,4).map((foto,i)=><button key={foto.url} onClick={()=>setFotoPreviewRdo({foto,item,index:i})} title="Ver foto" style={{position:"relative",padding:0,border:`1px solid ${C.border}`,borderRadius:5,overflow:"hidden",height:58,cursor:"pointer",background:C.surface}}><img src={foto.url} alt={foto.legenda||`Foto ${i+1}`} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>{i===3&&item.fotos.length>4&&<span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.55)",color:"#fff",fontWeight:900}}>+{item.fotos.length-4}</span>}</button>)}</div>}
          <p style={{fontSize:9.5,color:C.blue,fontWeight:700,marginTop:7}}>{(item.fotos||[]).length} foto(s) · {(item.anexos||[]).length} documento(s)</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginTop:9}}><Btn size="sm" v="ghost" onClick={()=>abrirRdo(item)}><Ic n={fieldReportIsReadOnly(item)?"eye":"edit"}/> {fieldReportIsReadOnly(item)?"Consultar":"Abrir e editar"}</Btn><Btn size="sm" v="ghost" onClick={()=>imprimirRdo(item)}><Ic n="fileText"/> PDF</Btn><Btn size="sm" v="ghost" onClick={()=>duplicarRdo(item)}><Ic n="copy"/> Duplicar</Btn>{item.status!=="cancelado"&&<Btn size="sm" v="danger" onClick={()=>excluirRdo(item)}><Ic n="x"/> Cancelar RDO</Btn>}</div>
        </article>})}
        {!rdosFiltrados.length&&<div className="rdo-empty"><strong>Nenhum diário encontrado</strong><p>Ajuste os filtros ou limpe a pesquisa para ver outros registros.</p><Btn v="ghost" onClick={()=>{setInicioRdo("");setFimRdo("");setFiltroObraRdo("all");setFiltroStatusRdo("all");setFiltroClimaRdo("all");setBuscaRdo("");}}>Limpar filtros</Btn></div>}
      </div>
      {fotoPreviewRdo&&<Modal title={`RDO-${String(fotoPreviewRdo.item.codigo||0).padStart(3,"0")} · Foto ${fotoPreviewRdo.index+1}`} onClose={()=>setFotoPreviewRdo(null)} wide><img src={fotoPreviewRdo.foto.url} alt={fotoPreviewRdo.foto.legenda||"Foto do diário"} style={{display:"block",width:"100%",maxHeight:"70vh",objectFit:"contain",background:"#111",borderRadius:7}}/>{fotoPreviewRdo.foto.legenda&&<p style={{fontSize:12,color:C.text,marginTop:8}}>{fotoPreviewRdo.foto.legenda}</p>}<Btn full v="ghost" onClick={()=>setFotoPreviewRdo(null)} style={{marginTop:10}}>Fechar</Btn></Modal>}
    </div>;
  }

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <button onClick={voltarHistoricoRdo} style={{border:0,background:"transparent",padding:0,color:C.blue,fontSize:13,fontWeight:800,cursor:"pointer"}}>← Histórico dos diários</button>
        <div style={{display:"flex",gap:5}}>
          {rdo.id&&!somenteLeituraRdo&&<Btn size="sm" v="danger" onClick={async()=>{if(await excluirRdo(rdo))setModoRdo("lista");}}><Ic n="x"/> Cancelar RDO</Btn>}
          {rdo.id&&<Btn size="sm" v="ghost" onClick={()=>imprimirRdo(rdo)}><Ic n="fileText"/> PDF</Btn>}
          {rdo.status==="concluido"&&currentUser?.role==="admin"&&<Btn size="sm" v="warning" onClick={reabrirRdo}><Ic n="edit"/> Reabrir como administrador</Btn>}
          {!somenteLeituraRdo&&<Btn size="sm" v="primary" onClick={concluirRdo} disabled={!completionRdo.complete} title={!completionRdo.complete?`Pendente: ${completionRdo.pending.map(item=>item.label).join(", ")}`:"Concluir e bloquear o RDO"}><Ic n="check"/> Concluir relatório</Btn>}
        </div>
      </div>
      <div className="rdo-document-status" data-status={rdo.status||"preparacao"}>
        <div><b>RDO-{String(rdo.codigo||0).padStart(3,"0")}</b><p>{somenteLeituraRdo?rdo.status==="cancelado"?"Documento cancelado e preservado no histórico.":"Documento concluído e bloqueado para edição.":`${completionRdo.pending.length} requisito(s) pendente(s) para concluir.`}</p></div><Badge color={rdo.status==="concluido"?C.green:rdo.status==="cancelado"?C.red:C.orange}>{rdo.status==="concluido"?"Concluído":rdo.status==="cancelado"?"Cancelado":"Em preparação"}</Badge>
      </div>
      <div className="rdo-save-state" data-state={salvamentoRdo.status} role={salvamentoRdo.status==="error"?"alert":"status"} aria-live="polite"><span>{salvamentoRdo.status==="local"?"Alterações locais":salvamentoRdo.status==="saving"?"Sincronizando":salvamentoRdo.status==="error"?"Falha ao salvar":salvamentoRdo.status==="saved"?`Salvo às ${new Date(salvamentoRdo.at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`:"Pronto para registrar"}</span><p>{salvamentoRdo.message||"As alterações serão confirmadas pelo servidor."}</p>{salvamentoRdo.status==="error"&&<button onClick={salvarNovamenteRdo}>Tentar novamente</button>}</div>

      <nav className="rdo-stepper" aria-label="Etapas obrigatórias do Diário de Obra">{completionRdo.checks.map((check,index)=><button type="button" key={check.id} data-complete={check.complete} aria-label={`${check.label}: ${check.complete?"concluída":"pendente"}`} onClick={()=>irParaEtapa(check.id)}><span>{check.complete?"✓":index+1}</span><b>{check.label}</b><small>{check.complete?"Concluída":"Pendente"}</small></button>)}</nav>

      <fieldset className="rdo-editor-fields" disabled={somenteLeituraRdo}>

      {/* Seletor de obra + data */}
      <div id="rdo-etapa-contexto" className="rdo-section-anchor" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 2, minWidth: 160 }}>
          {obraIdFixo
            ? <Inp label="Obra" value={(data.obras||[]).find(o=>o.id===obraIdFixo)?.name||"Obra atual"} onChange={()=>{}} disabled/>
            : <Sel label="Obra" value={obraId} onChange={valor=>trocarContextoRdo("obra",valor)}
                 options={obras.map(o => ({ v: o.id, l: o.name }))} />}
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          <Inp label="Data" type="date" value={dataRDO} onChange={valor=>trocarContextoRdo("data",valor)} />
        </div>
      </div>

      <Bloco id="rdo-etapa-relato" titulo="Descrição detalhada e atividades planejadas">
        <label className="rdo-field-label" htmlFor="rdo-descricao">Relato do dia <span>obrigatório</span></label><textarea id="rdo-descricao" value={valorCampoRdo("descricao")} onChange={e=>editarCampoRdo("descricao",e.target.value)} onBlur={()=>confirmarCampoRdo("descricao")} placeholder="Objetivo da visita, serviços planejados, verificações, decisões e evolução observada..." rows={5} className="rdo-textarea"/>
      </Bloco>

      <Bloco titulo="Relato por voz · opcional" acao={<div style={{display:"flex",gap:5}}><Btn size="sm" v={gravandoVoz?"danger":"info"} onClick={gravandoVoz?pararVoz:iniciarVoz} disabled={enviandoAudio}><Ic n={gravandoVoz?"stop":"mic"}/> {gravandoVoz?"Parar e salvar":"Gravar relato"}</Btn><label className="rdo-file-action">Enviar áudio<input type="file" accept="audio/*" onChange={escolherAudioRdo} style={{display:"none"}}/></label></div>}>
        {gravandoVoz&&<div style={{display:"flex",alignItems:"center",gap:7,color:C.red,fontSize:10.5,fontWeight:800,marginBottom:8}}><span style={{width:9,height:9,borderRadius:99,background:C.red,boxShadow:`0 0 0 5px ${C.red}18`}}/>Gravando e transcrevendo em português...</div>}
        <label className="rdo-field-label" htmlFor="rdo-transcricao">Transcrição revisável</label><textarea id="rdo-transcricao" value={valorCampoRdo("transcricaoVoz")} onChange={e=>editarCampoRdo("transcricaoVoz",e.target.value)} onBlur={()=>confirmarCampoRdo("transcricaoVoz")} placeholder="A transcrição aparece aqui. Você também pode revisar ou complementar o relato antes da análise." rows={4} className="rdo-textarea"/>
        {(rdo.audios||[]).length>0&&<div style={{display:"flex",flexDirection:"column",gap:5,marginTop:8}}>{rdo.audios.map(a=><div key={a.id||a.url} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,padding:"7px 9px",background:C.surface,borderRadius:7}}><a href={a.url} target="_blank" rel="noreferrer" style={{fontSize:10.5,color:C.blue,fontWeight:700}}>▶ {a.nome}</a><button aria-label={`Remover áudio ${a.nome}`} onClick={()=>salvarRDO(r=>({...r,audios:(r.audios||[]).filter(x=>(x.id||x.url)!==(a.id||a.url))}))} style={{border:0,background:"transparent",color:C.red,cursor:"pointer"}}>×</button></div>)}</div>}
        {enviandoAudio&&<p style={{fontSize:10,color:C.blue,marginTop:7}}>Enviando áudio para a pasta do diário no OneDrive...</p>}
      </Bloco>

      {!rdoExistente && (
        <div style={{ background: `${C.yellow}12`, border: `1px solid ${C.yellow}44`,
                      borderRadius: 6, padding: "9px 11px" }}>
          <p style={{ fontSize: 11.5, color: C.subtle }}>
            Novo diário para {fmtDate(dataRDO)}. Confirme o clima, registre o relato e ao menos um serviço. O indicador acima mostra quando cada alteração chegar ao servidor.
          </p>
        </div>
      )}

      {/* CLIMA */}
      <Bloco id="rdo-etapa-clima" titulo="Clima do dia · obrigatório" acao={<select aria-label="Aplicar o mesmo clima aos três períodos" defaultValue="" onChange={e=>{if(e.target.value){aplicarClimaTodos(e.target.value);e.target.value="";}}} className="rdo-apply-all"><option value="">Aplicar a todos...</option>{CLIMA_OPC.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>}>
        <div style={{marginBottom:9,padding:"8px 10px",borderRadius:6,background:C.surface,border:`1px solid ${C.border}`}}>
          <p style={{fontSize:9,fontWeight:900,color:C.muted,textTransform:"uppercase"}}>Responsável pelo registro · automático</p>
          <p style={{fontSize:12,fontWeight:800,color:C.text,marginTop:2}}>{rdo.responsavel||responsavelAutomatico?.nome||"Nenhum usuário identificado"}</p>
          {currentUser?.nome&&<p style={{fontSize:9.5,color:C.muted,marginTop:2}}>Lançado por {rdo.registradoPor||currentUser.nome}</p>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[["manha", "Manhã"], ["tarde", "Tarde"], ["noite", "Noite"]].map(([p, lbl]) => (
            <div key={p}>
              <label htmlFor={`rdo-clima-${p}`} className="rdo-field-label">{lbl}</label>
              <select id={`rdo-clima-${p}`} value={rdo.clima[p]||""} onChange={e => setClima(p, e.target.value)}
                      style={{ width: "100%", padding: "7px 6px", borderRadius: 7,
                               border: `1px solid ${C.border}`, background: C.card,
                               color: C.text, fontSize: 12 }}>
                <option value="">Não informado</option>
                {CLIMA_OPC.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Bloco>

      {/* SERVICOS EXECUTADOS */}
      <Bloco id="rdo-etapa-execucao" titulo="Serviços executados · obrigatório"
             acao={<Btn v="ghost" size="sm" onClick={() => setServicoModal({ novo: true })}>+ Serviço</Btn>}>
        {(rdo.servicos || []).length === 0 ? (
          <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            Indique quais servicos foram executados hoje. O progresso lancado aqui
            alimenta a medicao de evolucao da obra automaticamente.
          </p>
        ) : (
          (rdo.servicos || []).map(s => {
            const tarefa = tarefas.find(t => t.id === s.tarefaId);
            return (
              <button type="button" key={s.tarefaId} onClick={() => setServicoModal({ servico: s })} className="rdo-service-row"
                   style={{ padding: "9px 0", borderTop: `1px solid ${C.line}`, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span className="brk" style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>
                    {tarefa?.nome || s.descricao || "Servico"}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: C.blue, flexShrink: 0 }}>{s.progressoAte}%</span>
                </div>
                <div style={{ marginTop: 5, height: 5, background: C.line, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${s.progressoAte}%`, background: C.blue, borderRadius: 99 }} />
                </div>
                {s.obs && <p style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>{s.obs}</p>}
                {((s.equipe || []).length > 0 || (s.tercIds || []).length > 0) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                    {(s.equipe || []).map(id => {
                      const emp = employeePorId.get(id);
                      return emp ? <span key={id} style={{ fontSize: 9.5, fontWeight: 700, color: C.blue, background: `${C.blue}14`, borderRadius: 5, padding: "2px 6px" }}>{emp.name.split(" ")[0]}</span> : null;
                    })}
                    {(s.tercIds || []).map(id => {
                      const terc = tercPorId.get(id);
                      return terc ? <span key={id} style={{ fontSize: 9.5, fontWeight: 700, color: specInfo(terc.specialty).color, background: `${specInfo(terc.specialty).color}14`, borderRadius: 5, padding: "2px 6px" }}>{terc.name.split(" ")[0]} ⚙</span> : null;
                    })}
                  </div>
                )}
              </button>
            );
          })
        )}
      </Bloco>

      {/* EFETIVO / PONTO */}
      <Bloco titulo={`Efetivo e presenças${presentes ? ` (${presentes} presentes${meios ? ` + ${meios} meio período` : ""})` : ""}`} acao={empregadosObra.length?<Btn size="sm" v="ghost" onClick={marcarTodosPresentesRdo}>Marcar todos presentes</Btn>:null}>
        <p className="rdo-help">Escolha um estado explícito para cada pessoa. O registro alimenta o ponto sem sair do diário.</p>
        {empregadosObra.length>8&&<input className="rdo-list-search" value={buscaEquipeRdo} onChange={e=>setBuscaEquipeRdo(e.target.value)} placeholder="Pesquisar funcionário..." aria-label="Pesquisar funcionário no efetivo"/>}
        {empregadosObra.length === 0 ? (
          <p style={{ fontSize: 12, color: C.muted }}>Nenhum funcionario lotado nesta obra.</p>
        ) : (
          <div className="rdo-attendance-list">
            {empregadosObra.filter(emp=>!buscaEquipeRdo||emp.name.toLocaleLowerCase("pt-BR").includes(buscaEquipeRdo.toLocaleLowerCase("pt-BR"))).map(emp => {
              const st = presencaDe(emp.id);
              return (
                <div key={emp.id} className="rdo-attendance-row"><strong>{emp.name}</strong><div role="group" aria-label={`Presença de ${emp.name}`}>{[["presente","Presente"],["meio","Meio período"],["falta","Falta"],["","Limpar"]].map(([value,label])=><button type="button" key={label} data-state={value||"clear"} aria-pressed={st===value} onClick={()=>setPresencaRdo(emp.id,value)}>{label}</button>)}</div></div>
              );
            })}
          </div>
        )}
      </Bloco>

      {/* TERCEIRIZADOS NA OBRA */}
      <Bloco titulo={(() => {
        const pres = (rdo.terceirizados || []).filter(t => t.status === "presente").length;
        return `Terceirizados${pres ? ` (${pres} trabalhando)` : ""}`;
      })()}>
        <p style={{ fontSize: 11, color: C.muted, marginBottom: 8, lineHeight: 1.4 }}>
          Escolha o estado de cada contrato e, quando houver trabalho, selecione a etapa executada.
        </p>
        {terceirizadosObra.length === 0 ? (
          <p style={{ fontSize: 12, color: C.muted }}>
            Nenhum terceirizado ativo nesta obra. Cadastre em Terceirizados.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {terceirizadosObra.map(terc => {
              const st = statusTerc(terc.id);
              const cor = st === "presente" ? C.green : st === "meio" ? C.yellow : st === "falta" ? C.red : C.border;
              const info = specInfo(terc.specialty);
              const etapaSel = (rdo.terceirizados || []).find(t => t.tercId === terc.id)?.etapaId || "";
              return (
                <div key={terc.id} style={{ border: `1.5px solid ${st ? cor : C.border}`,
                     background: st ? `${cor}0E` : "transparent", borderRadius: 8, padding: "8px 10px" }}>
                  <div className="rdo-third-party-head"><div><strong>{terc.name}</strong><span>{info.l}</span></div><div role="group" aria-label={`Presença de ${terc.name}`}>{[["presente","Trabalhou"],["meio","Meio período"],["falta","Faltou"],["","Limpar"]].map(([value,label])=><button type="button" key={label} aria-pressed={st===value} onClick={()=>setStatusTercRdo(terc.id,value)}>{label}</button>)}</div></div>
                  {/* Etapa do contrato - só quando presente/meio e o contrato tem etapas */}
                  {(st === "presente" || st === "meio") && (terc.etapas || []).length > 0 && (
                    <select value={etapaSel} onChange={e => setEtapaTerc(terc.id, e.target.value)}
                      style={{ width: "100%", marginTop: 7, padding: "6px 8px", borderRadius: 7,
                               border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 11.5 }}>
                      <option value="">Etapa do contrato (opcional)...</option>
                      {terc.etapas.map(et => <option key={et.id} value={et.id}>{et.nome}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Bloco>

      {/* EQUIPAMENTOS NA OBRA */}
      <Bloco titulo={(() => {
        const n = (rdo.equipamentos || []).filter(x => x.equipId).length;
        return `Equipamentos${n ? ` (${n} no diário)` : ""}`;
      })()}>
        <p style={{ fontSize: 11, color: C.muted, marginBottom: 8, lineHeight: 1.4 }}>
          Toque para registrar quais equipamentos estiveram na obra hoje. Se quiser, informe as horas trabalhadas.
        </p>
        {equipamentosDaObra.length>8&&<input className="rdo-list-search" value={buscaEquipRdo} onChange={e=>setBuscaEquipRdo(e.target.value)} placeholder="Pesquisar equipamento..." aria-label="Pesquisar equipamento"/>}
        {equipamentosDaObra.length === 0 ? (
          <p style={{ fontSize: 12, color: C.muted }}>
            Nenhum equipamento cadastrado. Cadastre em Equipamentos.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {equipamentosDaObra.filter(eq=>!buscaEquipRdo||String(eq.nome||"").toLocaleLowerCase("pt-BR").includes(buscaEquipRdo.toLocaleLowerCase("pt-BR"))).map(eq => {
              const noRdo = equipNoRdo(eq.id);
              const ativo = !!noRdo;
              return (
                <div key={eq.id} style={{ border: `1.5px solid ${ativo ? C.blue : C.border}`,
                     background: ativo ? `${C.blue}0E` : "transparent", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <button onClick={() => toggleEquip(eq.id)} aria-pressed={ativo} aria-label={`${ativo?"Remover":"Adicionar"} ${eq.nome} ${ativo?"do":"ao"} diário`} style={{
                      flex: 1, textAlign: "left", background: "transparent", border: 0, cursor: "pointer", minWidth: 0 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: ativo ? C.blue : C.text }}>{eq.nome}</span>
                      {eq.categoria && <span style={{ fontSize: 10.5, color: C.muted, marginLeft: 6 }}>{eq.categoria}</span>}
                      <span className="rdo-equipment-state">{ativo?"No diário":"Não utilizado"}</span>{!eq.proprietarioId
                        ? <span style={{ fontSize: 8.5, color: C.green, marginLeft: 6, fontWeight: 700 }}>PRÓPRIO</span>
                        : <span style={{ fontSize: 8.5, color: C.purple, marginLeft: 6, fontWeight: 700 }}>TERCEIRO</span>}
                    </button>
                    <span style={{ width: 11, height: 11, borderRadius: 99, background: ativo ? C.blue : C.border, flexShrink: 0 }} />
                  </div>
                  {ativo && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                      <span style={{ fontSize: 11, color: C.muted }}>Horas trabalhadas:</span>
                      <input type="number" value={noRdo.horas || ""} onChange={e => setEquipHoras(eq.id, e.target.value)}
                        placeholder="0" style={{ width: 80, padding: "5px 8px", borderRadius: 6,
                          border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 11.5 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Bloco>

      {/* OCORRENCIAS */}
      <Bloco titulo="Ocorrências e observações · opcional">
        <label className="rdo-field-label" htmlFor="rdo-ocorrencias">Fatos relevantes, impedimentos e decisões</label><textarea id="rdo-ocorrencias" value={valorCampoRdo("ocorrencias")} onChange={e=>editarCampoRdo("ocorrencias",e.target.value)} onBlur={()=>confirmarCampoRdo("ocorrencias")}
                  placeholder="Atrasos, impedimentos, visitas, acidentes, decisoes tomadas..."
                  rows={3} style={{ width: "100%", padding: "9px 11px", borderRadius: 6,
                           border: `1px solid ${C.border}`, background: C.card, color: C.text,
                           fontSize: 12.5, fontFamily: "inherit", resize: "vertical" }} />
      </Bloco>

      <Bloco titulo="Pendências e providências · opcional">
        <label className="rdo-field-label" htmlFor="rdo-pendencias">Pendência, responsável, prazo e impacto</label><textarea id="rdo-pendencias" value={valorCampoRdo("pendencias")} onChange={e=>editarCampoRdo("pendencias",e.target.value)} onBlur={()=>confirmarCampoRdo("pendencias")} placeholder="Pendência, responsável pela solução, prazo combinado e impacto..." rows={3} className="rdo-textarea"/>
      </Bloco>

      <Bloco titulo="Comentários e notas complementares · opcional">
        <label className="rdo-field-label" htmlFor="rdo-comentarios">Comentários do cliente, fiscalização ou equipe</label><textarea id="rdo-comentarios" value={valorCampoRdo("comentarios")} onChange={e=>editarCampoRdo("comentarios",e.target.value)} onBlur={()=>confirmarCampoRdo("comentarios")} placeholder="Comentários do cliente, fiscalização, projetistas ou equipe..." rows={3} className="rdo-textarea"/>
      </Bloco>

      <Bloco titulo={`Documentos e anexos${(rdo.anexos||[]).length?` (${rdo.anexos.length})`:""}`}>
        {(rdo.anexos||[]).map(a=><div key={a.id||a.url} style={{display:"flex",justifyContent:"space-between",gap:8,padding:"7px 0",borderBottom:`1px solid ${C.line}`}}><a href={a.url} target="_blank" rel="noreferrer" style={{fontSize:11.5,color:C.blue,fontWeight:700}}>{a.nome} ↗</a><button aria-label={`Remover documento ${a.nome}`} onClick={()=>salvarRDO(r=>({...r,anexos:(r.anexos||[]).filter(x=>(x.id||x.url)!==(a.id||a.url))}))} style={{border:0,background:"transparent",color:C.red,cursor:"pointer"}}>×</button></div>)}
        <label style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:8,padding:"7px 10px",border:`1px dashed ${C.blue}`,borderRadius:6,color:C.blue,fontSize:11,fontWeight:800,cursor:subindoAnexo?"wait":"pointer"}}><Ic n="file"/>{subindoAnexo?"Enviando...":"Adicionar documento"}<input type="file" onChange={escolherAnexoRdo} disabled={subindoAnexo} style={{display:"none"}}/></label>
      </Bloco>

      {/* FOTOS */}
      <Bloco titulo={`Fotos${(rdo.fotos || []).length ? ` (${rdo.fotos.length})` : ""}`}>
        <div style={{ display: "grid", gridTemplateColumns: cols(2, 3, 4), gap: 8 }}>
          {(rdo.fotos || []).map(f => (
            <div key={f.url} style={{ position: "relative", borderRadius: 6, overflow: "hidden",
                                      border: `1px solid ${C.border}` }}>
              <img src={f.url} alt={f.legenda || "Foto"} style={{ width: "100%", height: 100,
                   objectFit: "cover", display: "block" }} />
              <button onClick={() => removerFoto(f.url)} aria-label={`Remover foto ${f.legenda||"sem legenda"}`} className="rdo-photo-remove">×</button>
              <input value={f.legenda} onChange={e => setLegenda(f.url, e.target.value)} aria-label="Legenda da foto"
                     placeholder="Legenda" style={{ width: "100%", padding: "5px 7px", border: 0,
                     borderTop: `1px solid ${C.line}`, fontSize: 10.5, color: C.text, background: C.surface }} />
            </div>
          ))}
          {/* Botao de adicionar */}
          <label style={{ height: 100, borderRadius: 6, border: `2px dashed ${C.border}`,
                          display: "flex", flexDirection: "column", alignItems: "center",
                          justifyContent: "center", cursor: subindo ? "wait" : "pointer",
                          color: C.muted, background: C.surface }}>
            <Ic n={subindo ? "clock" : "plus"} s={20} />
            <span style={{ fontSize: 10.5, fontWeight: 700, marginTop: 4 }}>
              {subindo ? "Enviando..." : "Foto"}
            </span>
            <input type="file" accept="image/*" capture="environment" onChange={escolherFoto}
                   disabled={subindo} style={{ display: "none" }} />
          </label>
        </div>
      </Bloco>

      <Bloco titulo="Reflexão técnica por IA · opcional" acao={<Btn v="info" size="sm" onClick={refletirRdo} disabled={refletindo||!(rdo.fotos||[]).length}><Ic n="brain"/> {refletindo?"Analisando imagens...":rdo.reflexaoIA?.texto?"Refletir novamente":"Refletir"}</Btn>}>
        {!rdo.reflexaoIA?.texto?<div style={{padding:"12px 13px",border:`1px dashed ${C.blue}55`,borderRadius:10,background:`${C.blue}08`}}><p style={{fontSize:11.5,color:C.subtle,lineHeight:1.6}}>A IA cruza fotos, voz, clima, serviços, efetivo, materiais e planejamento. Ela sugere avanço, identifica riscos, atividades não previstas e pendências, mas nada é concluído sem revisão do engenheiro.</p></div>:<div style={{display:"flex",flexDirection:"column",gap:9}}><div style={{background:`${C.blue}07`,border:`1px solid ${C.blue}35`,borderRadius:10,padding:"12px 13px"}}><div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:8,flexWrap:"wrap"}}><b style={{fontSize:11,color:C.blue}}>PANORAMA DO DIA</b><span style={{fontSize:9.5,color:C.muted}}>{rdo.reflexaoIA.fotosAnalisadas} foto(s) · {rdo.reflexaoIA.geradoEm?new Date(rdo.reflexaoIA.geradoEm).toLocaleString("pt-BR"):""}</span></div><div style={{whiteSpace:"pre-wrap",fontSize:11.5,lineHeight:1.65,color:C.text}}>{rdo.reflexaoIA.texto}</div></div>{rdo.reflexaoIA.analise&&<><div style={{display:"grid",gridTemplateColumns:cols(1,2,3),gap:7}}>{[["Riscos",rdo.reflexaoIA.analise.riscos,C.red],["Pendências",rdo.reflexaoIA.analise.pendencias,C.orange],["Materiais sugeridos",rdo.reflexaoIA.analise.materiais,C.purple]].map(([titulo,lista,cor])=><div key={titulo} style={{border:`1px solid ${cor}44`,borderTop:`3px solid ${cor}`,borderRadius:9,padding:"9px 10px",background:C.card}}><b style={{fontSize:9.5,color:cor,textTransform:"uppercase"}}>{titulo} · {(lista||[]).length}</b>{(lista||[]).slice(0,4).map((x,i)=><p key={i} style={{fontSize:10.5,color:C.subtle,lineHeight:1.4,marginTop:5}}>• {typeof x==="string"?x:x.descricao}</p>)}{!(lista||[]).length&&<p style={{fontSize:10,color:C.muted,marginTop:5}}>Nada indicado.</p>}</div>)}</div><div style={{padding:"10px 11px",border:`1px solid ${C.border}`,borderRadius:9,background:C.surface}}><p style={{fontSize:9.5,fontWeight:900,color:C.muted,textTransform:"uppercase"}}>Comparação com o planejamento</p><p style={{fontSize:11,color:C.text,lineHeight:1.55,marginTop:4}}>{rdo.reflexaoIA.analise.comparacaoPlanejamento||"Sem comparação conclusiva."}</p>{(rdo.reflexaoIA.analise.atividadesNaoPrevistas||[]).map((x,i)=><p key={i} style={{fontSize:10.5,color:C.orange,marginTop:4}}>⚠ Atividade não prevista: {x}</p>)}</div><Btn v="ghost" onClick={aplicarSugestoesRdo}><Ic n="check"/> Incorporar riscos e pendências ao rascunho</Btn></>}</div>}
      </Bloco>

      <Bloco id="rdo-etapa-revisao" titulo="Revisão obrigatória do engenheiro">
        <div style={{padding:"13px 14px",border:`1px solid ${rdo.revisaoEngenheiro?.aprovado?C.green:C.orange}55`,borderRadius:10,background:rdo.revisaoEngenheiro?.aprovado?`${C.green}09`:`${C.orange}09`}}><label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:["engenheiro","engenheiro_auditor"].includes(currentUser?.role)&&requisitosAntesRevisaoOk?"pointer":"not-allowed"}}><input type="checkbox" checked={!!rdo.revisaoEngenheiro?.aprovado} disabled={!['engenheiro','engenheiro_auditor'].includes(currentUser?.role)||!requisitosAntesRevisaoOk} onChange={e=>salvarRDO(r=>({...r,revisaoEngenheiro:{...r.revisaoEngenheiro,aprovado:e.target.checked,engenheiroId:e.target.checked?currentUser.id:"",engenheiro:e.target.checked?currentUser.nome:"",revisadoEm:e.target.checked?new Date().toISOString():""},atualizadoEm:new Date().toISOString()}))} style={{width:22,height:22,accentColor:C.green,marginTop:1}}/><span><b style={{fontSize:14,color:C.text}}>Revisei o relato, o clima, os serviços e todas as evidências disponíveis.</b><p style={{fontSize:13,color:C.muted,lineHeight:1.5,marginTop:4}}>Fotos, áudio e reflexão por IA são opcionais. O avanço físico e as pendências permanecem sob responsabilidade técnica do engenheiro.</p></span></label>{!requisitosAntesRevisaoOk&&<p style={{fontSize:13,color:C.orange,fontWeight:700,marginTop:9}}>Complete primeiro: {completionRdo.pending.filter(item=>item.id!=="revisao").map(item=>item.label).join(", ")}.</p>}{rdo.revisaoEngenheiro?.aprovado&&<p style={{fontSize:13,color:C.green,fontWeight:800,marginTop:9}}>Revisado por {rdo.revisaoEngenheiro.engenheiro} em {new Date(rdo.revisaoEngenheiro.revisadoEm).toLocaleString("pt-BR")}</p>}{!["engenheiro","engenheiro_auditor"].includes(currentUser?.role)&&<p style={{fontSize:13,color:C.orange,fontWeight:700,marginTop:9}}>Aguardando revisão do engenheiro responsável.</p>}</div>
      </Bloco>

      </fieldset>

      {/* MODAL SERVICO */}
      {servicoModal && (
        <ModalServicoRDO
          servico={servicoModal.servico}
          tarefas={tarefas}
          jaLancados={(rdo.servicos || []).map(s => s.tarefaId)}
          empregados={empregadosObra}
          terceirizados={terceirizadosObra}
          presencas={rdo.presencas || []}
          presencasTerc={rdo.terceirizados || []}
          onSalvar={(s) => { upsertServico(s); setServicoModal(null); }}
          onRemover={servicoModal.servico ? () => { removerServico(servicoModal.servico.tarefaId); setServicoModal(null); } : null}
          onClose={() => setServicoModal(null)}
        />
      )}
    </div>
  );
}

// Editor de servico executado: escolhe a tarefa, a etapa, lanca o progresso
// acumulado e marca quem executou (proprios + terceirizados). Maxima ligacao
// entre o diario, o planejamento e os contratos.
function ModalServicoRDO({ servico, tarefas, jaLancados, empregados = [], terceirizados = [], presencas = [], presencasTerc = [], onSalvar, onRemover, onClose }) {
  const [tarefaId, setTarefaId] = useState(servico?.tarefaId || "");
  const [prog, setProg] = useState(String(servico?.progressoAte ?? 0));
  const [obs, setObs] = useState(servico?.obs || "");
  const [equipe, setEquipe] = useState(servico?.equipe || []);
  const [tercIds, setTercIds] = useState(servico?.tercIds || []);
  const [erro,setErro]=useState("");

  const disponiveis = tarefas.filter(t =>
    t.id === tarefaId || !jaLancados.includes(t.id));
  const tarefa = tarefas.find(t => t.id === tarefaId);

  // Sugere quem já está marcado como presente no dia - o caso comum é a equipe
  // presente ser a que executou. O usuário refina se precisar.
  const presentesIds = new Set(presencas.filter(p => p.status !== "falta").map(p => p.empId));
  const tercPresentesIds = new Set(presencasTerc.filter(t => t.status !== "falta").map(t => t.tercId));

  const toggle = (lista, setLista, id) =>
    setLista(lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id]);

  const salvar = () => {
    if (!tarefaId) return;
    if(Number(prog||0)<=0&&!String(obs||"").trim()){setErro("Informe avanço maior que 0% ou descreva o serviço realizado sem avanço físico.");return;}
    setErro("");
    onSalvar({ tarefaId, etapaId: tarefa?.etapaId || "", descricao: tarefa?.nome || "",
               progressoAte: Math.max(0, Math.min(100, Number(prog) || 0)),
               equipe, tercIds, obs });
  };

  return (
    <Modal title={servico ? "Servico executado" : "Novo servico"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Sel label="Servico (do planejamento)" value={tarefaId} onChange={setTarefaId}
             options={[{ v: "", l: "Escolha..." }, ...disponiveis.map(t => ({ v: t.id, l: t.nome }))]} />
        {tarefa && (tarefa.etapaNome || tarefa.custo > 0) && (
          <div style={{ background: `${C.yellow}12`, border: `1px solid ${C.yellow}44`,
                        borderRadius: 6, padding: "8px 11px", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            {tarefa.etapaNome && <div><p style={{ fontSize: 10, color: C.muted, fontWeight: 800 }}>ETAPA</p><p style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{tarefa.etapaNome}</p></div>}
            {tarefa.custo > 0 && <div style={{ textAlign: "right" }}><p style={{ fontSize: 10, color: C.muted, fontWeight: 800 }}>CUSTO PREVISTO</p><p style={{ fontSize: 14, fontWeight: 800, color: C.yellowD }}>{fmt(tarefa.custo)}</p></div>}
          </div>
        )}
        <div>
          <Inp label="Progresso acumulado (%)" type="number" value={prog} onChange={setProg} min="0" max="100" />
          <p style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>
            O total ja executado deste servico (nao so o de hoje). E o que a medicao usa.
          </p>
        </div>

        {/* Equipe própria */}
        {empregados.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>Quem executou (equipe própria)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {empregados.map(emp => {
                const on = equipe.includes(emp.id);
                return (
                  <button key={emp.id} aria-pressed={on} onClick={() => toggle(equipe, setEquipe, emp.id)} style={{
                    padding: "6px 9px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700,
                    border: `1.5px solid ${on ? C.blue : C.border}`, background: on ? `${C.blue}16` : "transparent",
                    color: on ? C.blue : C.muted }}>
                    {presentesIds.has(emp.id) ? "• " : ""}{emp.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Terceirizados */}
        {terceirizados.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: .6, marginBottom: 6 }}>Terceirizados no serviço</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {terceirizados.map(terc => {
                const on = tercIds.includes(terc.id);
                const info = specInfo(terc.specialty);
                return (
                  <button key={terc.id} aria-pressed={on} onClick={() => toggle(tercIds, setTercIds, terc.id)} style={{
                    padding: "6px 9px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700,
                    border: `1.5px solid ${on ? info.color : C.border}`, background: on ? `${info.color}16` : "transparent",
                    color: on ? info.color : C.muted }}>
                    {tercPresentesIds.has(terc.id) ? "• " : ""}{terc.name}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>• = já marcado como presente hoje</p>
          </div>
        )}

        <Inp label="Observacao (opcional)" value={obs} onChange={setObs} multiline />
        {erro&&<p role="alert" style={{fontSize:12,color:C.red,fontWeight:700}}>{erro}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn full onClick={salvar} disabled={!tarefaId}>Salvar</Btn>
          {onRemover && <Btn v="danger" onClick={onRemover} aria-label="Remover serviço executado"><Ic n="trash" /></Btn>}
        </div>
      </div>
    </Modal>
  );
}
