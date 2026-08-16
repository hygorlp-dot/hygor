// ===================================================================
// PlanejamentoView — tela de Planejamento extraída de LegacyApp.jsx
//
// Extraído verbatim (mesmo corpo, mesma lógica) de src/LegacyApp.jsx em
// 2026-08-16, seguindo o mesmo padrão de Terceiros/Orçamento/Conciliação/
// Compras. Inclui os helpers exclusivos que viviam ao redor da função
// (QuestionarioPlanejamento, CurvaSGrafico, MiniFF, ModalTarefa,
// ModalCalendario, ModalMarco) — MiniKpi ficou de fora e continua
// exportado de LegacyApp.jsx por ser usado em vários outros módulos.
// Mesma camada de dados, sem nova migration/RLS. Ver
// docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #5.
// ===================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import {
  Badge, Btn, C, Divider, Ic, Inp, MiniKpi, Modal, Sel, TabRow,
  ajustarParaDiaUtil, aplicarRollup, caminhoCritico, compararBaseline,
  curvaS, custoEtapa, desvioAutomatico, diasCorridos, diasUteis,
  distribuicaoMensal, ehDiaUtil, fisicoFinanceiro, fisicoFinanceiroMensal,
  fmt, fmtCompact, fmtDate, fmtDateFull, fmtMesAno, fundirEvolucao,
  idsSucessoras, janelaPlano, maiusculoOrcamento, montarCronogramaIA,
  montarTarefas, monthName, obraContextoSalvo, ordemEtapasOrcamento,
  progressoPlano, proximoDiaUtil, resumoPlano, somaDias, somaDiasUteis,
  sugerirDependenciasPlanejamento, today, uid,
} from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { getPlanningHolidays } from "../../ponto/attendance-engine";
import { applyProgressToCommitment } from "../../producao";
import { getPlanningBudget } from "../../orcamentos/calculations";
import {
  calculateCPM as calculateCanonicalCPM,
  calculateLineOfBalance,
  calculatePPC,
} from "../index.js";
import { chamarIA } from "../../../api";

export default function Planejamento({ data, update, showToast, obraIdFixo="", currentUser=null, dispatchCommand=null }) {
  const { isDesktop, isMobile, cols } = useBreakpoint();

  // O cronograma pode nascer de uma revisão em rascunho. Isso não promove a
  // revisão a baseline nem a libera para DRE, medição ou qualidade.
  const obrasComOrc = (data.obras || []).filter(o =>
    !!getPlanningBudget(data, o.id, (data.planos||[]).find(p=>p.obraId===o.id)).budget
    ||(data.planos||[]).some(p=>p.obraId===o.id));
  const [obraId, setObraId] = useState(()=>obraIdFixo||(obrasComOrc.some(o=>o.id===obraContextoSalvo())?obraContextoSalvo():(obrasComOrc[0]?.id||"")));

  // Plano da obra (cria um vazio na memoria se ainda nao existe).
  const plano = useMemo(() =>
    (data.planos || []).find(p => p.obraId === obraId)
    || { id: "", obraId, inicio: "", tarefas: [], marcos: [],
         diasSemana: [1,2,3,4,5,6], pularFeriados: true,
         usarFeriadosCadastrados: false, feriados: [] },
    [data.planos, obraId]);
  const planejamentoOrcamento = useMemo(
    () => getPlanningBudget(data, obraId, plano),
    [data, obraId, plano]);
  const orc = planejamentoOrcamento.budget;

  // Calendario de trabalho do plano (dias da semana + feriados).
  const cal = useMemo(() => ({
    diasSemana:   plano.diasSemana   || [1,2,3,4,5,6],
    pularFeriados: plano.pularFeriados !== false,
    feriados:     plano.feriados     || [],
  }), [plano.diasSemana, plano.pularFeriados, plano.feriados]);

  // Tarefas montadas + roll-up dos titulos (mae abrange filhas). A evolucao
  // efetiva e a mesma em todas as telas: vale a alteracao mais recente entre
  // Planejamento, Medicao e Diario de Obra.
  const tarefas = useMemo(() => {
    const base = aplicarRollup(montarTarefas(plano, orc), orc);
    return aplicarRollup(fundirEvolucao(base, data.rdos, obraId), orc);
  }, [plano, orc, data.rdos, obraId]);
  const resumo  = useMemo(() => resumoPlano(tarefas.filter(t=>!t.titulo), orc), [tarefas, orc]);
  const janela  = useMemo(() => janelaPlano(tarefas, plano.marcos), [tarefas, plano.marcos]);
  const progresso = useMemo(() => progressoPlano(tarefas.filter(t=>!t.titulo)), [tarefas]);

  // Motores novos (todos testados isoladamente).
  const distMensal = useMemo(() => distribuicaoMensal(tarefas, cal), [tarefas, cal]);
  const dadosS     = useMemo(() => curvaS(tarefas, cal), [tarefas, cal]);
  const ff         = useMemo(() => fisicoFinanceiro(tarefas), [tarefas]);
  const ffMensalPrev = useMemo(() => fisicoFinanceiroMensal(tarefas, cal, { realizado:false }), [tarefas, cal]);
  const ffMensalReal = useMemo(() => fisicoFinanceiroMensal(tarefas, cal, { realizado:true }), [tarefas, cal]);
  const critico    = useMemo(() => caminhoCritico(tarefas, cal), [tarefas, cal]);
  // A tela histórica continua desenhando o Gantt, mas os indicadores abaixo
  // passam pelo motor puro: a mesma precedência que será usada pela API não
  // pode ser recalculada por uma regra visual paralela.
  const cpmCanonico = useMemo(() => {
    const atividades=tarefas.filter(t=>!t.titulo).map(t=>({
      id:t.id,durationDays:Math.max(1,diasUteis(t.inicio,t.fim,cal)),
    }));
    const dependencias=tarefas.filter(t=>!t.titulo).flatMap(t=>(t.depende||[]).map(fromId=>({fromId,toId:t.id,type:"FS"})));
    try{return calculateCanonicalCPM(atividades,dependencias);}
    catch{return {projectDuration:0,criticalPath:[],activities:[]};}
  }, [tarefas, cal]);
  const ppcSemanal = useMemo(() => calculatePPC((data.weeklyCommitments||[]).filter(item=>String(item.obraId)===String(obraId))), [data.weeklyCommitments, obraId]);
  const linhaBalanco = useMemo(() => calculateLineOfBalance(tarefas.filter(item=>!item.titulo)), [tarefas]);
  const compromissosDaObra = useMemo(() => (data.weeklyCommitments||[])
    .filter(item=>String(item.obraId)===String(obraId)&&item.status!=="cancelado")
    .map(item=>applyProgressToCommitment(item,data.progressRecords||[])), [data.weeklyCommitments, data.progressRecords, obraId]);
  const trabalhadoresDaObra = useMemo(() => {
    const ativos=(data.employees||[]).filter(item=>item.active!==false);
    const vinculados=ativos.filter(item=>String(item.obraId||item.obra||"")===String(obraId));
    return vinculados.length?vinculados:ativos;
  }, [data.employees, obraId]);
  const avancosPorCompromisso = useMemo(() => (data.progressRecords||[]).filter(item=>String(item.obraId)===String(obraId)&&item.commitmentId).reduce((map,item)=>{
    const key=String(item.commitmentId);map.set(key,[...(map.get(key)||[]),item]);return map;
  },new Map()), [data.progressRecords, obraId]);
  const podeConcluirCompromisso=["admin","engenheiro","engenheiro_auditor","planejamento","mestre"].includes(currentUser?.role);
  const compBase   = useMemo(() => compararBaseline(tarefas, plano), [tarefas, plano]);
  // Planejado x realizado automatico: progresso medido vs reta do cronograma.
  const autoCmp    = useMemo(() => desvioAutomatico(tarefas, today()), [tarefas]);

  // Salva a linha de base: fotografa o cronograma atual. Feito uma vez, quando
  // o plano é aprovado; refazer sobrescreve (com confirmação) e o histórico de
  // desvio passa a contar a partir daí.
  const salvarBaseline = () => {
    const jaTem = (plano.baseline || []).length > 0;
    if (jaTem && !window.confirm("Já existe uma linha de base. Substituir apaga a comparação atual e recomeça a contagem de desvios a partir de agora. Continuar?")) return;
    const baseline = tarefas.filter(t => !t.titulo).map(t => ({
      tarefaId: t.id, nome: t.nome, inicio: t.inicio, fim: t.fim,
      custo: t.custoReal > 0 ? t.custoReal : (t.custo || 0),
    }));
    const planos = (data.planos || []).map(p =>
      p.obraId === plano.obraId ? { ...p, baseline, baselineData: today() } : p);
    update({ ...data, planos });
    showToast?.(`Linha de base salva com ${baseline.length} tarefa(s). Agora dá para comparar o planejado com o realizado.`);
  };

  const limparBaseline = () => {
    if (!window.confirm("Remover a linha de base? A comparação planejado × realizado deixa de existir.")) return;
    const planos = (data.planos || []).map(p =>
      p.obraId === plano.obraId ? { ...p, baseline: [], baselineData: "" } : p);
    update({ ...data, planos });
    showToast?.("Linha de base removida.");
  };

  const [tarefaModal, setTarefaModal] = useState(null);   // {modo, tarefa}
  const [marcoModal,  setMarcoModal]  = useState(null);
  const [calModal,    setCalModal]    = useState(false);  // config do calendario
  const [iaModal,     setIaModal]     = useState(null);   // orientacao de IA
  const [questModal,  setQuestModal]  = useState(false);  // questionario de planejamento
  const [questPreview, setQuestPreview] = useState(null); // cronograma proposto pela IA
  const [questIA,     setQuestIA]     = useState(null);   // parecer opcional da IA
  const [vincPreview, setVincPreview] = useState(null);   // antecessoras/sucessoras propostas
  const [novoCompromisso, setNovoCompromisso] = useState(null);
  const [novoAvanco, setNovoAvanco] = useState(null);
  const [novaRestricao, setNovaRestricao] = useState(null);
  const [zoom, setZoom] = useState("semana");             // dia | semana | mes
  const [aba,  setAba]  = useState("gantt");              // gantt | mensal | curvaS | ff
  const [ffModo, setFfModo] = useState("previsto");       // previsto | realizado (tabela FF mensal)
  const [ffMesesOcultos, setFfMesesOcultos] = useState([]); // meses escondidos na tabela FF
  const [planColsOcultas, setPlanColsOcultas] = useState([]); // colunas ocultas no Gantt/tabela de tarefas
  const [planMostrarReal, setPlanMostrarReal] = useState(true); // mostrar linha "realizado" sob cada tarefa
  // Colunas visiveis da tabela de tarefas do Gantt. "atividade" e fixa. As
  // demais o usuario liga/desliga - util no celular, onde a largura e curta.
  // O cronograma inicia em modo compacto: somente Atividade / custo fica
  // visivel. As demais colunas podem ser habilitadas pelo menu "Colunas".
  const [colsCrono, setColsCrono] = useState({
    inicio:true, fim:true, dias:false, custo:false, progresso:false,
    antecessora:false, sucessora:false,
  });
  const [colsCronoAberto, setColsCronoAberto] = useState(false);
  const [exportA2Modal, setExportA2Modal] = useState(false);
  const [exportA2Folhas, setExportA2Folhas] = useState(1);
  const [exportA2Cols, setExportA2Cols] = useState({
    atividade:true, inicio:true, fim:true, dias:true, custo:true,
    progresso:true, antecessora:false, sucessora:false,
  });
  const ganttScrollRef = useRef(null);
  const ganttTopScrollRef = useRef(null);
  const sincronizandoScrollRef = useRef(false);

  // ---- Persistencia: garante um plano na base e aplica mudancas ----
  const salvarPlano = (mut) => {
    const existe = (data.planos || []).some(p => p.obraId === obraId);
    let planos;
    if (existe) {
      planos = (data.planos || []).map(p => p.obraId === obraId ? {
        ...mut({ ...p }),
        budgetId: orc?.id || p.budgetId || "",
        budgetVersionId: orc?.versionId || orc?.id || p.budgetVersionId || "",
      } : p);
    } else {
      const novo = mut({ id: uid(), obraId, inicio: today(), tarefas: [], marcos: [] });
      planos = [...(data.planos || []), {
        ...novo,
        budgetId: orc?.id || "",
        budgetVersionId: orc?.versionId || orc?.id || "",
      }];
    }
    update({ ...data, planos });
  };
  const concluirCompromissoSemanal = async compromisso => {
    if(!dispatchCommand){showToast?.("A conclusão segura de compromissos exige conexão com o servidor.","error");return;}
    const atingiuMeta=compromisso.eligibleForCompletion;
    const motivo=atingiuMeta?"":window.prompt(`A produção de “${compromisso.descricao||"compromisso"}” não atingiu a meta. Informe o motivo:`);
    if(!atingiuMeta&&!String(motivo||"").trim())return;
    if(!window.confirm(atingiuMeta?`Confirmar ${compromisso.quantidadeRealizada||0} de ${compromisso.quantidadePrometida||0} como concluído?`:`Confirmar como não concluído: ${motivo}?`))return;
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.weeklyCommitments||[]).find(item=>item.id===compromisso.id);
      return {type:OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_COMPLETED,idempotencyKey:`compromisso-semanal-${compromisso.id}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{commitmentId:compromisso.id,reason:String(motivo||"").trim()}};
    });
    if(!result?.ok)showToast?.(result?.reason||"Não foi possível concluir o compromisso.","error");
    else showToast?.(atingiuMeta?"Compromisso concluído com a produção registrada.":"Não cumprimento registrado com motivo.");
  };
  const liberarCompromissoSemanal = async compromisso => {
    if(!dispatchCommand){showToast?.("A liberação segura de restrições exige conexão com o servidor.","error");return;}
    const motivo=window.prompt(`Como foi resolvida a restrição “${compromisso.blockingReason||"não informada"}”?`);
    if(!String(motivo||"").trim())return;
    if(!window.confirm("Liberar este compromisso para execução?"))return;
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.weeklyCommitments||[]).find(item=>item.id===compromisso.id);
      return {type:OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_RELEASED,idempotencyKey:`compromisso-semanal-liberado-${compromisso.id}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{commitmentId:compromisso.id,reason:String(motivo).trim()}};
    });
    if(!result?.ok)showToast?.(result?.reason||"Não foi possível liberar o compromisso.","error");
    else showToast?.("Restrição resolvida e compromisso liberado.");
  };
  const abrirNovoCompromisso = () => {
    const primeiraAtividade=tarefas.find(item=>!item.titulo);
    if(!primeiraAtividade){showToast?.("Inclua ao menos uma atividade no cronograma antes de criar um compromisso.","error");return;}
    setNovoCompromisso({descricao:"",activityId:primeiraAtividade.id,quantidadePrometida:"",data:today(),criticalActivity:false,blockingReason:""});
  };
  const criarCompromissoSemanal = async () => {
    const form=novoCompromisso||{};
    if(!String(form.descricao||"").trim()||!String(form.activityId||"").trim()||Number(form.quantidadePrometida)<=0){showToast?.("Informe atividade, descrição e meta maior que zero.","error");return;}
    if(!dispatchCommand){showToast?.("A criação segura de compromissos exige conexão com o servidor.","error");return;}
    const result=await dispatchCommand(()=>({type:OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_CREATED,idempotencyKey:`compromisso-semanal-novo-${uid()}`,
      actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{commitment:{id:uid(),obraId,activityId:form.activityId,descricao:String(form.descricao).trim(),quantidadePrometida:Number(form.quantidadePrometida),data:form.data,criticalActivity:Boolean(form.criticalActivity),blockingReason:String(form.blockingReason||"").trim()}}}));
    if(!result?.ok){showToast?.(result?.reason||"Não foi possível criar o compromisso.","error");return;}
    setNovoCompromisso(null);showToast?.("Compromisso semanal criado.");
  };
  const abrirNovoAvanco = compromisso => setNovoAvanco({commitmentId:compromisso.id,activityId:compromisso.activityId,descricao:compromisso.descricao||"",quantity:"",data:today(),workerIds:[],criticalActivity:Boolean(compromisso.criticalActivity||compromisso.atividadeCritica)});
  const alternarTrabalhadorAvanco = employeeId => setNovoAvanco(form=>({...form,workerIds:(form.workerIds||[]).includes(employeeId)?form.workerIds.filter(id=>id!==employeeId):[...(form.workerIds||[]),employeeId]}));
  const registrarAvanco = async () => {
    const form=novoAvanco||{};
    if(!String(form.activityId||"").trim()||Number(form.quantity)<=0||!/^\d{4}-\d{2}-\d{2}$/.test(String(form.data||""))){showToast?.("Informe quantidade executada e data válida.","error");return;}
    const atividade=(data.scheduleActivities||[]).find(item=>String(item.id)===String(form.activityId));
    if((atividade?.criticalActivity||atividade?.atividadeCritica||form.criticalActivity)&&!(form.workerIds||[]).length){showToast?.("Atividade crítica exige a equipe identificada.","error");return;}
    if(!dispatchCommand){showToast?.("O registro de avanço exige conexão com o servidor.","error");return;}
    const result=await dispatchCommand(()=>({type:OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED,idempotencyKey:`avanco-fisico-${uid()}`,
      actorId:currentUser?.id||"",actorName:currentUser?.nome||"",expectedVersion:0,payload:{record:{id:uid(),obraId,activityId:form.activityId,commitmentId:form.commitmentId,quantity:Number(form.quantity),data:form.data,workerIds:form.workerIds||[],criticalActivity:Boolean(form.criticalActivity)}}}));
    if(!result?.ok){showToast?.(result?.reason||"Não foi possível registrar o avanço.","error");return;}
    setNovoAvanco(null);showToast?.("Avanço físico registrado.");
  };
  const estornarAvanco = async avanco => {
    if(!dispatchCommand){showToast?.("O estorno de avanço exige conexão com o servidor.","error");return;}
    const motivo=window.prompt(`Motivo do estorno de ${Number(avanco.quantity||0)} registrado em ${fmtDate(avanco.data)}:`);
    if(!String(motivo||"").trim())return;
    if(!window.confirm("Confirmar estorno? O lançamento será preservado no histórico."))return;
    const result=await dispatchCommand(atual=>{
      const vigente=(atual.progressRecords||[]).find(item=>item.id===avanco.id);
      return {type:OPERATIONAL_COMMAND.PROGRESS_RECORD_CANCELLED,idempotencyKey:`avanco-fisico-estorno-${avanco.id}-${uid()}`,
        expectedVersion:Number(vigente?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{recordId:avanco.id,reason:String(motivo).trim()}};
    });
    if(!result?.ok)showToast?.(result?.reason||"Não foi possível estornar o avanço.","error");
    else showToast?.("Avanço estornado e preservado no histórico.");
  };
  const lookaheadsDaObra=(data.lookaheadWindows||[]).filter(item=>String(item.obraId)===String(obraId));
  const criarLookahead=async()=>{
    if(!dispatchCommand){showToast?.("O Lookahead exige conexão com o servidor.","error");return;}
    const pacotes=tarefas.filter(item=>!item.titulo).slice(0,80).map(item=>({id:item.id,descricao:item.nome||"Atividade"}));
    if(!pacotes.length){showToast?.("Inclua atividades no cronograma antes de criar o Lookahead.","error");return;}
    const result=await dispatchCommand(()=>({type:OPERATIONAL_COMMAND.LOOKAHEAD_CREATED,idempotencyKey:`lookahead-${uid()}`,expectedVersion:0,actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{lookahead:{id:uid(),obraId,semanaInicio:today(),semanaFim:today(),horizonteSemanas:4,pacotes}}}));
    if(!result?.ok)showToast?.(result?.reason||"Não foi possível criar o Lookahead.","error");else showToast?.("Lookahead criado a partir das atividades do cronograma.");
  };
  const adicionarRestricao=async()=>{
    const form=novaRestricao||{};if(!form.lookaheadId||!form.pacoteId||!String(form.descricao||"").trim()){showToast?.("Selecione pacote e descreva a restrição.","error");return;}
    const result=await dispatchCommand(atual=>{const vigente=(atual.lookaheadWindows||[]).find(item=>item.id===form.lookaheadId);return {type:OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_ADDED,idempotencyKey:`restricao-lookahead-${uid()}`,expectedVersion:Number(vigente?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{lookaheadId:form.lookaheadId,constraint:{id:uid(),obraId,pacoteId:form.pacoteId,categoria:form.categoria||"outro",descricao:String(form.descricao).trim(),bloqueante:true,dataIdentificacao:today(),dataNecessidade:form.dataNecessidade||today()}}};});
    if(!result?.ok)showToast?.(result?.reason||"Não foi possível registrar a restrição.","error");else{setNovaRestricao(null);showToast?.("Restrição registrada no Lookahead.");}
  };
  const liberarRestricao=async(lookahead,restricao)=>{
    const evidencia=window.prompt("Informe a referência da evidência de liberação (documento, foto ou protocolo):");if(!String(evidencia||"").trim())return;
    const result=await dispatchCommand(atual=>{const vigente=(atual.lookaheadWindows||[]).find(item=>item.id===lookahead.id);return {type:OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_RELEASED,idempotencyKey:`liberar-restricao-${restricao.id}-${uid()}`,expectedVersion:Number(vigente?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{lookaheadId:lookahead.id,constraintId:restricao.id,evidenceIds:[String(evidencia).trim()]}};});
    if(!result?.ok)showToast?.(result?.reason||"Não foi possível liberar a restrição.","error");else showToast?.("Restrição liberada com evidência.");
  };

  const upsertTarefa = (t) => salvarPlano(p => {
    const existe = (p.tarefas || []).some(x => x.id === t.id);
    p.tarefas = existe
      ? p.tarefas.map(x => x.id === t.id ? { ...x, ...t } : x)
      : [...(p.tarefas || []), { ...t, id: t.id || uid() }];
    return p;
  });
  const removerTarefa = (id) => salvarPlano(p => {
    p.tarefas = (p.tarefas || []).filter(x => x.id !== id)
      .map(x => ({...x, depende:(x.depende || []).filter(d => d !== id)}));
    return p;
  });

  // Salva a tarefa e os dois lados do vinculo. Sucessora nao e um campo
  // duplicado: ela e materializada como antecessora nas outras tarefas.
  const salvarTarefaEVinculos = (t) => {
    const sucessoras = Array.isArray(t.sucessoras) ? t.sucessoras : [];
    const { sucessoras:_, progresso:progressoIgnorado, ...dados } = t;
    const planos = (data.planos || []).map(p => {
      if (p.obraId !== obraId) return p;
      return { ...p, tarefas: (p.tarefas || []).map(x => {
        if (x.id === dados.id) return {...x,...dados,depende:[...new Set(dados.depende || [])]};
        const deps = (x.depende || []).filter(d => d !== dados.id);
        if (sucessoras.includes(x.id)) deps.push(dados.id);
        return {...x,depende:[...new Set(deps)]};
      }) };
    });
    const base = { ...data, planos };
    update(base);
  };

  // Edicao direta das colunas do Gantt. Alterar o inicio preserva a duracao;
  // alterar os dias recalcula o fim no calendario de trabalho.
  const atualizarTarefaNaLinha = (t, campo, valor) => {
    if (t.titulo) return;
    const duracaoAtual = Math.max(1, diasUteis(t.inicio, t.fim, cal));
    if (campo === "inicio") {
      const inicio = ajustarParaDiaUtil(valor, cal, 1);
      if (!inicio) return;
      upsertTarefa({id:t.id,inicio,fim:somaDiasUteis(inicio,duracaoAtual,cal)});
    } else if (campo === "fim") {
      const fim = ajustarParaDiaUtil(valor, cal, -1);
      if (!fim || fim < t.inicio) { showToast?.("A data final nao pode ser anterior ao inicio.","error"); return; }
      upsertTarefa({id:t.id,fim});
    } else if (campo === "dias") {
      const n = Math.max(1, Math.min(3660, Math.round(Number(valor)||1)));
      upsertTarefa({id:t.id,fim:somaDiasUteis(t.inicio,n,cal)});
    } else if (campo === "progresso") {
      showToast?.("O avanço físico é confirmado somente no boletim de medição.", "warn");
    }
  };
  const upsertMarco = (m) => salvarPlano(p => {
    const existe = (p.marcos || []).some(x => x.id === m.id);
    p.marcos = existe
      ? p.marcos.map(x => x.id === m.id ? { ...x, ...m } : x)
      : [...(p.marcos || []), { ...m, id: m.id || uid() }];
    return p;
  });
  const removerMarco = (id) => salvarPlano(p => {
    p.marcos = (p.marcos || []).filter(x => x.id !== id);
    return p;
  });
  const salvarCalendario = (novoCal) => salvarPlano(p => {
    p.diasSemana = novoCal.diasSemana;
    p.pularFeriados = novoCal.pularFeriados;
    p.feriados = novoCal.feriados;
    if (novoCal.usarFeriadosCadastrados !== undefined) {
      p.usarFeriadosCadastrados = !!novoCal.usarFeriadosCadastrados;
    }
    return p;
  });

  // Exportacao automatica do orcamento para o planejamento. Inclui etapas
  // novas e grava as tarefas vinculadas na mesma ordem hierarquica do orcamento,
  // preservando datas/progresso ja ajustados pelo operador ou pela IA.
  useEffect(() => {
    if (!orc || !obraId) return;
    const ordem = ordemEtapasOrcamento(orc);
    if (!ordem.length) return;
    const atuais = plano.tarefas || [];
    const vinculadas = atuais.filter(t => t.etapaId && ordem.includes(t.etapaId));
    const avulsas = atuais.filter(t => !t.etapaId);
    const orfas = atuais.filter(t => t.etapaId && !ordem.includes(t.etapaId));
    const assinaturaAtual = vinculadas.map(t => t.etapaId).join("|");
    const assinaturaOrc = ordem.join("|");
    const mesmoOrcamento = plano.budgetId === orc.id
      && plano.budgetVersionId === (orc.versionId||orc.id);
    if (assinaturaAtual === assinaturaOrc && vinculadas.length === ordem.length && mesmoOrcamento) return;

    const porEtapa = new Map(vinculadas.map(t => [t.etapaId, t]));
    let cursor = plano.inicio || today();
    const sincronizadas = ordem.map(etapaId => {
      const existente = porEtapa.get(etapaId);
      if (existente) { cursor = existente.fim ? proximoDiaUtil(existente.fim, cal) : cursor; return existente; }
      const etapa = (orc.etapas||[]).find(e => e.id === etapaId);
      const inicio = cursor;
      const fim = somaDiasUteis(inicio, 5, cal);
      cursor = proximoDiaUtil(fim, cal);
      return { id:uid(), etapaId, nome:etapa?.nome||"Etapa", inicio, fim, progresso:0 };
    });
    const planoNovo = {
      ...plano,
      id:plano.id||uid(),
      obraId,
      budgetId:orc.id,
      budgetVersionId:orc.versionId||orc.id,
      inicio:plano.inicio||today(),
      // Uma etapa removida ou renumerada no orçamento não apaga o trabalho
      // já planejado. Ela permanece visível como órfã até o operador ajustar.
      tarefas:[...sincronizadas,...orfas,...avulsas],
    };
    const existe = (data.planos||[]).some(p=>p.obraId===obraId);
    const planos = existe ? (data.planos||[]).map(p=>p.obraId===obraId?planoNovo:p) : [...(data.planos||[]),planoNovo];
    update({...data,planos});
  }, [orc, obraId, plano, cal, data, update]);
  // Pede a IA orientacao sobre datas e paralelismos, sem autorizar mudanca na ordem.
  const [iaCarregando, setIaCarregando] = useState(false);
  const pedirOrientacaoIA = async () => {
    setIaCarregando(true);
    try {
      const lista = tarefas.filter(t => !t.titulo).map(t => {
        const ant = (t.depende || []).map(id=>tarefas.find(x=>x.id===id)?.nome).filter(Boolean);
        return `${t.nome}: ${t.inicio} a ${t.fim} (${diasUteis(t.inicio,t.fim,cal)} dias de trabalho); `+
          `antecessora(s): ${ant.join(", ") || "nenhuma"}`;
      });
      const diasTrabalho = (cal.diasSemana || []).map(d => ["dom","seg","ter","qua","qui","sex","sab"][d]).join(", ");
      const feriadosJanela = (cal.feriados || []).filter(f => !janela.ini || (f.data >= janela.ini && f.data <= janela.fim));
      const prompt = `Voce e engenheiro civil planejador. A ordem abaixo veio do orcamento e e IMUTAVEL. `
        + `Nao reordene, renomeie, inclua ou exclua servicos. Analise apenas duracoes, datas, folgas, `
        + `antecessoras, sucessoras, paralelismos possiveis e riscos segundo boas praticas de engenharia. `
        + `Calendario obrigatorio: dias trabalhados ${diasTrabalho}; `
        + `${cal.pularFeriados ? `${feriadosJanela.length} feriado(s) nao trabalhado(s)` : "feriados considerados dias normais"}. `
        + `Nao sugira datas em dias nao trabalhados. Servicos na ordem oficial:\n`
        + `${lista.map((n,i)=>`${i+1}. ${n}`).join("\n")}\n\n`
        + `Responda em portugues e mantenha exatamente a numeracao recebida.`;
      const j = await chamarIA({ modulo:"planejamento", prompt, contexto:{obra:(data.obras||[]).find(o=>o.id===obraId)?.name||"",orcamento:orc?.nome||"",progresso,desvio:autoCmp} });
      if (!j.ok) throw new Error(j.error || `IA respondeu ${j.status}`);
      setIaModal({ texto: j.reply || j.text || j.message || "Sem resposta da IA." });
    } catch (e) {
      setIaModal({ texto: "Nao foi possivel falar com a IA agora. Tente novamente." });
    } finally {
      setIaCarregando(false);
    }
  };

  // Gera o cronograma proposto a partir das respostas do questionario.
  // Analise LOCAL: monta as datas na hora, sem depender de rede.
  const gerarCronogramaDoQuestionario = (respostas) => {
    const inicio = respostas.inicio || today();
    const fim = somaDias(inicio, Math.max(1, Math.round(Number(respostas.prazoMeses || 1) * 30)) - 1);
    const anoIni = Number(inicio.slice(0,4)), anoFim = Number(fim.slice(0,4));
    const anos = Array.from({length: Math.max(1, anoFim - anoIni + 1)}, (_,i) => anoIni + i);
    const usarFeriados = respostas.usarFeriados === "sim";
    const calendarioPerguntado = {
      ...cal,
      pularFeriados: usarFeriados,
      feriados: usarFeriados ? getPlanningHolidays(data, anos) : [],
    };
    const proposta = montarCronogramaIA(orc, respostas, calendarioPerguntado);
    setQuestPreview({ respostas, ...proposta });
    setQuestModal(false);
  };

  // Aplica datas/duracoes e os vinculos tecnicos. IDs, ordem, nomes, custos e
  // progresso continuam sendo os do orcamento/plano.
  const aplicarCronogramaProposto = () => {
    if (!questPreview) return;
    salvarPlano(p => {
      const atuais = new Map((p.tarefas||[]).filter(t=>t.etapaId).map(t=>[t.etapaId,t]));
      const avulsas = (p.tarefas||[]).filter(t=>!t.etapaId);
      p.inicio = questPreview.resumo.inicio;
      p.diasSemana = questPreview.diasSemana;
      p.pularFeriados = questPreview.calendario?.pularFeriados !== false;
      p.feriados = questPreview.calendario?.feriados || [];
      p.usarFeriadosCadastrados = questPreview.respostas?.usarFeriados === "sim";
      const tarefasBase = [
        ...questPreview.tarefas.map(t => {
          const existente = atuais.get(t.etapaId);
          return existente ? {...existente,inicio:t.inicio,fim:t.fim}
            : {id:uid(),etapaId:t.etapaId,nome:t.nome,inicio:t.inicio,fim:t.fim,progresso:0};
        }),
        ...avulsas,
      ];
      const deps = sugerirDependenciasPlanejamento(
        tarefasBase, orc, questPreview.respostas?.paralelo === "sim");
      p.tarefas = tarefasBase.map(t => ({...t,depende:deps[t.id] || []}));
      return p;
    });
    setQuestPreview(null);
    showToast?.("Cronograma preenchido pela IA. Ajuste o que precisar no Gantt.");
  };

  // Analisa apenas os vinculos do cronograma atual e abre uma previa. Nenhuma
  // dependencia e gravada sem confirmacao do operador.
  const analisarVinculosIA = () => {
    const dependencias = sugerirDependenciasPlanejamento(tarefas, orc, true);
    const datas = {};
    tarefas.forEach(t => {
      if (t.titulo) { datas[t.id]={inicio:t.inicio,fim:t.fim,alterada:false}; return; }
      const inicioAtual = t.inicio || plano.inicio || today();
      const duracao = Math.max(1,diasUteis(inicioAtual,t.fim||inicioAtual,cal));
      const finsAntecessoras = (dependencias[t.id] || [])
        .map(id => datas[id]?.fim || tarefas.find(x=>x.id===id)?.fim).filter(Boolean);
      const inicioMinimo = finsAntecessoras.length
        ? proximoDiaUtil(finsAntecessoras.sort().slice(-1)[0],cal) : inicioAtual;
      const inicio = inicioAtual >= inicioMinimo ? inicioAtual : inicioMinimo;
      const fim = inicio === t.inicio && t.fim ? t.fim : somaDiasUteis(inicio,duracao,cal);
      datas[t.id]={inicio,fim,alterada:inicio!==t.inicio||fim!==t.fim};
    });
    const linhas = tarefas.filter(t => !t.titulo).map(t => ({
      id:t.id, nome:t.nome,
      antecessoras:(dependencias[t.id] || []).map(id => tarefas.find(x=>x.id===id)?.nome).filter(Boolean),
      sucessoras:tarefas.filter(x => (dependencias[x.id] || []).includes(t.id)).map(x=>x.nome),
      ...datas[t.id],
    }));
    setVincPreview({dependencias,datas,linhas});
  };

  const aplicarVinculosIA = () => {
    if (!vincPreview) return;
    salvarPlano(p => {
      p.tarefas = (p.tarefas || []).map(t => {
        const d = vincPreview.datas?.[t.id];
        return {...t,inicio:d?.inicio||t.inicio,fim:d?.fim||t.fim,
          depende:[...new Set(vincPreview.dependencias[t.id] || [])]};
      });
      return p;
    });
    setVincPreview(null);
    showToast?.("Antecessoras e sucessoras cadastradas. Os vinculos continuam editaveis.");
  };

  // Pede um parecer da IA sobre a proposta (opcional). Local sempre; IA extra.
  const comentarCronogramaIA = async () => {
    if (!questPreview) return;
    try {
      const lista = questPreview.tarefas.map((t,i) => `${i+1}. ${t.nome} (${fmtDate(t.inicio)} a ${fmtDate(t.fim)})`).join("\n");
      const prompt = `Voce e engenheiro civil planejador. A ordem dos servicos veio do orcamento e e IMUTAVEL. `
        + `Analise criticamente este cronograma de obra `
        + `gerado automaticamente e aponte riscos de sequenciamento, folgas insuficientes ou servicos `
        + `que deveriam ser paralelos/sequenciais segundo boa pratica. Seja objetivo e em portugues.\n\n`
        + `Inicio: ${fmtDate(questPreview.resumo.inicio)} | Fim previsto: ${fmtDate(questPreview.resumo.fim)} `
        + `(${questPreview.resumo.diasCorridos + 1} dias corridos). `
        + `Prazo limite: ${fmtDate(questPreview.resumo.fimAlvo)}. `
        + `Calendario: ${questPreview.diasSemana.length} dias por semana e `
        + `${questPreview.calendario?.pularFeriados ? "feriados retirados" : "feriados trabalhados"}.\nCronograma:\n${lista}\n\n`
        + `Nao reordene, renomeie nem invente servicos. Nao proponha inicio ou fim em dia nao trabalhado. `
        + `Sugira somente ajustes de datas, duracoes, folgas e paralelismos dentro do prazo limite.`;
      const j = await chamarIA({ modulo:"planejamento", prompt, contexto:{obra:(data.obras||[]).find(o=>o.id===obraId)?.name||"",orcamento:orc?.nome||"",progresso,prazo:questPreview?.resumo} });
      if (!j.ok) throw new Error(j.error || `IA respondeu ${j.status}`);
      setQuestIA(j.reply || j.text || j.message || "Sem resposta da IA.");
    } catch (e) {
      setQuestIA("Nao foi possivel falar com a IA agora - a proposta local acima ja e valida.");
    }
  };

  // Cria uma tarefa a partir de uma etapa do orcamento ainda nao planejada.
  const etapasLivres = (orc?.etapas || []).filter(e =>
    !(plano.tarefas || []).some(t => t.etapaId === e.id));

  const adicionarEtapa = (etapaId) => {
    const etapa = (orc?.etapas || []).find(e => e.id === etapaId);
    if (!etapa) return;
    // Encaixa logo apos a ultima tarefa, com 7 dias de duracao default.
    const ult = tarefas[tarefas.length - 1];
    const ini = ult?.fim ? proximoDiaUtil(ult.fim, cal) : (plano.inicio || today());
    // 5 dias uteis = uma semana de trabalho, ja respeitando o calendario.
    upsertTarefa({ etapaId, nome: etapa.nome, inicio: ini, fim: somaDiasUteis(ini, 5, cal), progresso: 0 });
    showToast?.(`"${etapa.nome}" adicionada ao cronograma`);
  };

  // ============================================================
  //  GANTT: grade de tempo + barras arrastaveis
  // ============================================================
  const GANTT_INI = janela.ini || plano.inicio || today();
  const totalDias = Math.max(30, janela.dias + 10);   // folga de 10 dias
  const pxPorDia  = zoom === "dia" ? 34 : zoom === "semana" ? 12 : 4;
  const larguraGrade = totalDias * pxPorDia;
  // A linha reserva respiro próprio para os campos de data. No celular,
  // mantém o alvo de toque de 44 px sem invadir a atividade vizinha.
  const ALTURA_LINHA = isDesktop ? 40 : 48;
  const ALTURA_REGUA = zoom === "dia" ? 50 : zoom === "semana" ? 40 : 30;
  // Definicao das colunas da tabela de tarefas. "atividade" sempre presente;
  // as demais respeitam colsCrono. Larguras diferentes no desktop e no celular.
  const COLS_CRONO_DEF = [
    { id:"atividade",   label:"Atividade / custo", w:isDesktop?220:150, fixa:true },
    { id:"inicio",      label:"Data inicio",       w:isDesktop?120:132 },
    { id:"fim",         label:"Data fim",          w:isDesktop?120:132 },
    { id:"dias",        label:"Dias trab.",        w:isDesktop?76:70 },
    { id:"custo",       label:"Custo",             w:isDesktop?100:92 },
    { id:"progresso",   label:"Progresso",         w:isDesktop?92:84 },
    { id:"antecessora", label:"Antecessora",       w:isDesktop?140:130 },
    { id:"sucessora",   label:"Sucessora",         w:isDesktop?140:130 },
  ];
  const colunasVisiveis = COLS_CRONO_DEF.filter(c => c.fixa || colsCrono[c.id]);
  const COLUNAS_TAREFA = colunasVisiveis.map(c => `${c.w}px`).join(" ");
  const LARGURA_TAREFAS = colunasVisiveis.reduce((s,c)=>s+c.w, 0);
  const LARGURA_TOTAL_GANTT = LARGURA_TAREFAS + larguraGrade;

  const sincronizarRolagemGantt = (origem) => {
    if (sincronizandoScrollRef.current) return;
    const topo = ganttTopScrollRef.current;
    const corpo = ganttScrollRef.current;
    if (!topo || !corpo) return;
    sincronizandoScrollRef.current = true;
    if (origem === "topo") corpo.scrollLeft = topo.scrollLeft;
    else topo.scrollLeft = corpo.scrollLeft;
    requestAnimationFrame(() => { sincronizandoScrollRef.current = false; });
  };

  const exportarCronogramaA2 = () => {
    const colsEscolhidas = COLS_CRONO_DEF.filter(c => c.id === "atividade" || exportA2Cols[c.id]);
    if (!colsEscolhidas.length) { showToast?.("Selecione ao menos a coluna Atividade.", "warn"); return; }
    const folhas = exportA2Folhas === 2 ? 2 : 1;
    const esc = v => String(v ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    const nomeObra = obrasComOrc.find(o => o.id === obraId)?.name || "Obra";
    const larguraTabelaMm = Math.min(175, Math.max(62, colsEscolhidas.reduce((a,c)=>a + ({atividade:54,inicio:24,fim:24,dias:15,custo:27,progresso:18,antecessora:38,sucessora:38}[c.id]||22),0)));
    const larguraGraficoMm = 574 - larguraTabelaMm;
    const total = Math.max(1, totalDias);
    const porFolha = Math.ceil(total / folhas);
    const fmtDin = n => Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
    const nomesPorId = Object.fromEntries(tarefas.map(t=>[t.id,t.nome]));
    const valorCelula = (t,id) => ({
      atividade:t.nome,
      inicio:fmtDate(t.inicio),
      fim:fmtDate(t.fim),
      dias:Math.max(1,diasUteis(t.inicio,t.fim,cal)),
      custo:t.custo>0?fmtDin(t.custo):"-",
      progresso:`${Number(t.progresso||0).toFixed(0)}%`,
      antecessora:(t.depende||[]).map(x=>nomesPorId[x]).filter(Boolean).join(", ")||"-",
      sucessora:idsSucessoras(tarefas,t.id).map(x=>nomesPorId[x]).filter(Boolean).join(", ")||"-",
    }[id] ?? "");
    const paginas = Array.from({length:folhas},(_,pag)=>{
      const di = pag*porFolha;
      const df = Math.min(total-1,(pag+1)*porFolha-1);
      const iniPag = somaDias(GANTT_INI,di), fimPag=somaDias(GANTT_INI,df);
      const span = Math.max(1,df-di+1);
      const cab = colsEscolhidas.map(c=>`<th>${esc(c.label)}</th>`).join("");
      const linhas = tarefas.map((t,idx)=>{
        const cells=colsEscolhidas.map(c=>`<td class="c-${c.id}">${esc(valorCelula(t,c.id))}</td>`).join("");
        const ti=Math.max(di,diasCorridos(GANTT_INI,t.inicio));
        const tf=Math.min(df,diasCorridos(GANTT_INI,t.fim));
        let barra="";
        if(tf>=ti){
          const left=((ti-di)/span*100), width=Math.max(.6,((tf-ti+1)/span*100));
          const cor=t.titulo?"#514b45":critico.criticas.includes(t.id)?"#b41f24":t.progresso>=100?"#18713a":t.progresso>0?"#1455b8":"#d8ac2d";
          barra=`<div class="bar" style="left:${left}%;width:${width}%;background:${cor}"><i style="width:${Math.max(0,Math.min(100,Number(t.progresso||0)))}%"></i></div>`;
        }
        return `<tr class="${t.titulo?'titulo':''}">${cells}<td class="g"><div class="gline">${barra}</div></td></tr>`;
      }).join("");
      const ticks=Array.from({length:9},(_,i)=>{
        const off=Math.round((span-1)*i/8), d=somaDias(iniPag,off);
        return `<span style="left:${i*12.5}%">${esc(fmtDate(d))}</span>`;
      }).join("");
      return `<section class="page"><header><div><b>CRONOGRAMA DA OBRA</b><small>${esc(nomeObra)}</small></div><div class="meta">A2 · Paisagem · Folha ${pag+1}/${folhas}<br>${esc(fmtDate(iniPag))} a ${esc(fmtDate(fimPag))}</div></header><table><colgroup>${colsEscolhidas.map(c=>`<col style="width:${({atividade:54,inicio:24,fim:24,dias:15,custo:27,progresso:18,antecessora:38,sucessora:38}[c.id]||22)}mm">`).join("")}<col style="width:${larguraGraficoMm}mm"></colgroup><thead><tr>${cab}<th class="timeline"><div>${ticks}</div></th></tr></thead><tbody>${linhas}</tbody></table><footer>Gerado em ${esc(new Date().toLocaleString("pt-BR"))} · ${tarefas.length} atividade(s)</footer></section>`;
    }).join("");
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Cronograma A2 - ${esc(nomeObra)}</title><style>
      @page{size:A2 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111;background:#fff}.page{width:100%;page-break-after:always}.page:last-child{page-break-after:auto}header{height:15mm;display:flex;align-items:center;justify-content:space-between;border-bottom:1.5px solid #111;margin-bottom:2mm}header b{font-size:15pt;display:block}header small{font-size:9pt}.meta{text-align:right;font-size:8pt;line-height:1.35}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:6.5pt}th,td{border:.25mm solid #cfcac2;padding:1.1mm;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;height:6.8mm}th{background:#eeeae3;text-transform:uppercase;font-size:5.8pt;text-align:left}.c-dias,.c-progresso{text-align:center}.c-custo{text-align:right}.titulo td{font-weight:bold;background:#f1efeb}.timeline{padding:0;position:relative}.timeline>div{height:100%;position:relative}.timeline span{position:absolute;top:1mm;transform:translateX(-50%);font-size:5.3pt;white-space:nowrap}.g{padding:0;background:repeating-linear-gradient(90deg,transparent 0,transparent 12.45%,#eee 12.5%)}.gline{height:100%;position:relative}.bar{position:absolute;top:1.4mm;height:3.7mm;border-radius:1mm;overflow:hidden}.bar i{display:block;height:100%;background:rgba(255,255,255,.28)}footer{font-size:6pt;color:#666;text-align:right;margin-top:1.5mm}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>${paginas}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`;
    const w=window.open("","_blank","noopener,noreferrer");
    if(!w){showToast?.("O navegador bloqueou a janela de exportacao. Permita pop-ups e tente novamente.","warn");return;}
    w.document.open();w.document.write(html);w.document.close();
    setExportA2Modal(false);
  };

  // Converte data -> posicao X (px) e duracao -> largura.
  const xDeData = (iso) => diasCorridos(GANTT_INI, iso) * pxPorDia;

  // ---- Arrastar barra (mover ou redimensionar) ----
  // Guardamos o gesto em curso: qual tarefa, que modo, onde comecou.
  const dragRef = useRef(null);

  const iniciarDrag = (e, tarefa, modo) => {
    e.preventDefault();
    e.stopPropagation();
    const ponto = e.touches ? e.touches[0] : e;
    dragRef.current = {
      id: tarefa.id, modo,
      x0: ponto.clientX,
      ini0: tarefa.inicio, fim0: tarefa.fim,
      preview: { inicio: tarefa.inicio, fim: tarefa.fim },
    };
    document.addEventListener("mousemove", moverDrag);
    document.addEventListener("mouseup", soltarDrag);
    document.addEventListener("touchmove", moverDrag, { passive: false });
    document.addEventListener("touchend", soltarDrag);
    setDragTick(x => x + 1);
  };

  // Forca re-render durante o arraste (o preview vive no ref).
  const [, setDragTick] = useState(0);

  const moverDrag = (e) => {
    const d = dragRef.current;
    if (!d) return;
    if (e.cancelable) e.preventDefault();
    const ponto = e.touches ? e.touches[0] : e;
    const deltaDias = Math.round((ponto.clientX - d.x0) / pxPorDia);
    if (d.modo === "mover") {
      d.preview = { inicio: somaDias(d.ini0, deltaDias), fim: somaDias(d.fim0, deltaDias) };
    } else if (d.modo === "inicio") {
      const novoIni = somaDias(d.ini0, deltaDias);
      // nao deixa o inicio passar do fim
      if (diasCorridos(novoIni, d.fim0) >= 1) d.preview = { inicio: novoIni, fim: d.fim0 };
    } else if (d.modo === "fim") {
      const novoFim = somaDias(d.fim0, deltaDias);
      if (diasCorridos(d.ini0, novoFim) >= 1) d.preview = { inicio: d.ini0, fim: novoFim };
    }
    setDragTick(x => x + 1);
  };

  const soltarDrag = () => {
    const d = dragRef.current;
    document.removeEventListener("mousemove", moverDrag);
    document.removeEventListener("mouseup", soltarDrag);
    document.removeEventListener("touchmove", moverDrag);
    document.removeEventListener("touchend", soltarDrag);
    if (d && d.preview) {
      // So salva se mudou de fato.
      if (d.preview.inicio !== d.ini0 || d.preview.fim !== d.fim0) {
        const duracao = Math.max(1, diasUteis(d.ini0, d.fim0, cal));
        let inicioAjustado = ajustarParaDiaUtil(d.preview.inicio, cal, 1);
        let fimAjustado = ajustarParaDiaUtil(d.preview.fim, cal, -1);
        if (d.modo === "mover") fimAjustado = somaDiasUteis(inicioAjustado, duracao, cal);
        if (fimAjustado < inicioAjustado) fimAjustado = inicioAjustado;
        upsertTarefa({ id: d.id, inicio: inicioAjustado, fim: fimAjustado });
      }
    }
    dragRef.current = null;
    setDragTick(x => x + 1);
  };

  // Marcadores de mes na regua do tempo.
  const reguaMeses = useMemo(() => {
    const marcas = [];
    for (let i = 0; i <= totalDias; i++) {
      const d = somaDias(GANTT_INI, i);
      if (d.slice(8, 10) === "01" || i === 0) {
        marcas.push({ x: i * pxPorDia, label: fmtMesAno(d) });
      }
    }
    return marcas;
  }, [GANTT_INI, totalDias, pxPorDia]);

  const feriadoPorData = useMemo(() =>
    new Map((cal.feriados || []).map(f => [f.data, f])), [cal.feriados]);
  const diasGrade = useMemo(() => Array.from({ length: totalDias }, (_, i) => {
    const dataDia = somaDias(GANTT_INI, i);
    const dow = new Date(dataDia + "T00:00:00").getDay();
    const feriado = cal.pularFeriados ? feriadoPorData.get(dataDia) : null;
    const fimSemana = dow === 0 || dow === 6;
    const naoTrabalhado = !(cal.diasSemana || []).includes(dow) || !!feriado;
    return { data: dataDia, x: i * pxPorDia, dow, feriado, fimSemana, naoTrabalhado };
  }), [GANTT_INI, totalDias, pxPorDia, cal.diasSemana, cal.pularFeriados, feriadoPorData]);

  const corTarefa = (t) => {
    if (t.orfa) return C.red;
    if (t.progresso >= 100) return C.green;
    if (t.progresso > 0) return C.blue;
    return C.yellow;
  };

  const TIPO_MARCO = {
    compra:    { l: "Compra",    c: C.purple },
    entrega:   { l: "Entrega",   c: C.blue   },
    vistoria:  { l: "Vistoria",  c: C.orange },
    pagamento: { l: "Pagamento", c: C.green  },
    geral:     { l: "Marco",     c: C.muted  },
  };

  // Sem obra planejável: orienta o usuário.
  if (!obrasComOrc.length) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Nenhuma obra com orçamento ou planejamento ainda</p>
        <p style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
          O planejamento nasce do orçamento: cada etapa, mesmo em rascunho,
          pode virar uma tarefa no cronograma.
        </p>
      </div>
    );
  }

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Cabecalho: seletor de obra + progresso geral */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          {obraIdFixo
            ? <Inp label="Obra" value={(data.obras||[]).find(o=>o.id===obraIdFixo)?.name||"Obra atual"} onChange={()=>{}} disabled/>
            : <Sel label="Obra" value={obraId} onChange={setObraId}
                 options={obrasComOrc.map(o => ({ v: o.id, l: o.name }))} />}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {["dia", "semana", "mes"].map(z => (
            <button key={z} onClick={() => setZoom(z)} style={{
              padding: "8px 12px", borderRadius: 6, cursor: "pointer",
              border: `1.5px solid ${zoom === z ? C.yellow : C.border}`,
              background: zoom === z ? `${C.yellow}18` : "transparent",
              color: zoom === z ? C.yellowD : C.muted,
              fontSize: 12, fontWeight: 700, textTransform: "capitalize",
            }}>{z}</button>
          ))}
          <button onClick={() => setCalModal(true)} title="Calendario de trabalho" style={{
            padding: "8px 10px", borderRadius: 6, cursor: "pointer",
            border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted,
            display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700,
          }}><Ic n="calendar" s={14}/> Dias</button>
          <div style={{ position:"relative" }}>
            <button onClick={() => setColsCronoAberto(a=>!a)} title="Colunas da tabela" style={{
              padding: "8px 10px", borderRadius: 6, cursor: "pointer",
              border: `1.5px solid ${C.border}`, background: "transparent", color: C.muted,
              display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700,
            }}>Colunas</button>
            {colsCronoAberto && (
              <div style={{position:"absolute",top:"100%",right:0,marginTop:4,zIndex:30,
                           background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:6,
                           boxShadow:`0 8px 24px ${C.shadow}`,padding:"10px 12px",minWidth:180}}>
                <p style={{fontSize:10,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:8}}>Colunas do cronograma</p>
                {[["inicio","Data inicio"],["fim","Data fim"],["dias","Dias trabalhados"],["custo","Custo"],["progresso","Progresso"],["antecessora","Antecessora"],["sucessora","Sucessora"]].map(([k,l])=>(
                  <label key={k} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",cursor:"pointer",fontSize:12,color:C.text}}>
                    <input type="checkbox" checked={!!colsCrono[k]}
                      onChange={()=>setColsCrono(c=>({...c,[k]:!c[k]}))}
                      style={{width:15,height:15,accentColor:C.yellowD,cursor:"pointer"}}/>
                    {l}
                  </label>
                ))}
                <p style={{fontSize:9.5,color:C.muted,marginTop:7,lineHeight:1.45,borderTop:`1px solid ${C.line}`,paddingTop:7}}>
                  A coluna Atividade fica sempre visivel.
                </p>
                <label style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0 0",cursor:"pointer",fontSize:12,color:C.text,borderTop:`1px solid ${C.line}`,marginTop:7}}>
                  <input type="checkbox" checked={planMostrarReal}
                    onChange={()=>setPlanMostrarReal(v=>!v)}
                    style={{width:15,height:15,accentColor:C.blue,cursor:"pointer"}}/>
                  Mostrar linha "Realizado"
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
      {orc&&planejamentoOrcamento.source!=="baseline"&&<div style={{
        padding:"9px 11px",borderRadius:8,border:`1px solid ${C.orange}55`,
        background:`${C.orange}0D`,color:C.text,fontSize:10.5,lineHeight:1.5,
      }}>
        <b style={{color:C.orange}}>Planejamento sobre orçamento em rascunho.</b>{" "}
        Etapas, custos e datas são preliminares. A aprovação financeira continua exigindo uma baseline explícita.
      </div>}

      {/* Resumo financeiro: o elo com o orcamento */}
      <div style={{ display: "grid", gridTemplateColumns: cols(2, 4, 4), gap: 8 }}>
        <MiniKpi label="Progresso" value={`${progresso.toFixed(0)}%`} cor={C.blue} />
        <MiniKpi label="Planejado" value={fmt(resumo.planejado)} cor={C.yellow} />
        <MiniKpi label="Executado" value={fmt(resumo.executado)} cor={C.green} />
        <MiniKpi label="Cobertura do orcamento" value={`${resumo.coberto.toFixed(0)}%`}
                 cor={resumo.coberto >= 99 ? C.green : C.orange}
                 sub={resumo.coberto < 99 ? "faltam etapas" : "completo"} />
      </div>

      <div style={{display:"grid",gridTemplateColumns:cols(2,2,2),gap:8}}>
        <MiniKpi label="Caminho crítico" value={cpmCanonico.criticalPath.length?`${cpmCanonico.criticalPath.length} atividade(s)`:"—"} cor={cpmCanonico.criticalPath.length?C.orange:C.muted} sub={cpmCanonico.projectDuration?`${cpmCanonico.projectDuration} dia(s) de duração lógica`:"Sem atividades encadeadas"}/>
        <MiniKpi label="PPC semanal" value={ppcSemanal.total?`${Math.round(ppcSemanal.ppc*100)}%`:"—"} cor={ppcSemanal.total&&ppcSemanal.ppc<.8?C.orange:C.green} sub={ppcSemanal.total?`${ppcSemanal.completed} de ${ppcSemanal.total} compromissos concluídos${ppcSemanal.blocked?` · ${ppcSemanal.blocked} bloqueado(s)`:""}`:"Sem compromisso registrado"}/>
      </div>

      {(compromissosDaObra.length>0||podeConcluirCompromisso)&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{padding:"10px 12px",borderBottom:`1px solid ${C.line}`,display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
          <div><p style={{fontSize:10,fontWeight:900,letterSpacing:.7,color:C.muted,textTransform:"uppercase"}}>Plano de curto prazo</p><b style={{display:"block",fontSize:12,color:C.text,marginTop:2}}>Compromissos da obra</b></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:10,color:C.muted}}>{ppcSemanal.completed} concluído(s) de {ppcSemanal.total}{ppcSemanal.blocked?` · ${ppcSemanal.blocked} bloqueado(s)`:""}</span>{podeConcluirCompromisso&&<Btn size="sm" v="ghost" onClick={abrirNovoCompromisso}>Adicionar</Btn>}</div>
        </div>
        {novoCompromisso&&<div style={{padding:"10px 12px",background:C.surface,borderBottom:`1px solid ${C.line}`}}><div style={{display:"grid",gridTemplateColumns:cols(1,2,4),gap:8}}><Sel label="Atividade" value={novoCompromisso.activityId} onChange={v=>setNovoCompromisso(form=>({...form,activityId:v}))} options={tarefas.filter(item=>!item.titulo).map(item=>({v:item.id,l:item.nome||"Atividade"}))}/><Inp label="Compromisso" value={novoCompromisso.descricao} onChange={v=>setNovoCompromisso(form=>({...form,descricao:v}))} placeholder="Ex.: Assentar alvenaria do pavimento"/><Inp label="Meta" type="number" value={novoCompromisso.quantidadePrometida} onChange={v=>setNovoCompromisso(form=>({...form,quantidadePrometida:v}))}/><Inp label="Data" type="date" value={novoCompromisso.data} onChange={v=>setNovoCompromisso(form=>({...form,data:v}))}/></div><div style={{marginTop:8}}><Inp label="Restrição de início (opcional)" value={novoCompromisso.blockingReason||""} onChange={v=>setNovoCompromisso(form=>({...form,blockingReason:v}))} placeholder="Ex.: aguardando entrega de material — cria como bloqueado"/></div><label style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:9,fontSize:10,color:C.text,cursor:"pointer"}}><input type="checkbox" checked={Boolean(novoCompromisso.criticalActivity)} onChange={event=>setNovoCompromisso(form=>({...form,criticalActivity:event.target.checked}))} style={{accentColor:C.orange}}/>Atividade crítica <span style={{color:C.muted}}>· exige APR, permissão e equipe no avanço</span></label><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:9}}><Btn size="sm" v="ghost" onClick={()=>setNovoCompromisso(null)}>Cancelar</Btn><Btn size="sm" onClick={criarCompromissoSemanal}>Criar compromisso</Btn></div></div>}
        {novoAvanco&&<div style={{padding:"10px 12px",background:C.surface,borderBottom:`1px solid ${C.line}`}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline",marginBottom:8}}><div><p style={{fontSize:9.5,fontWeight:900,textTransform:"uppercase",letterSpacing:.6,color:C.blue}}>Registro de produção</p><b style={{fontSize:11,color:C.text}}>{novoAvanco.descricao}</b></div><span style={{fontSize:9.5,color:C.muted}}>O avanço entra na evidência do compromisso.</span></div><div style={{display:"grid",gridTemplateColumns:cols(1,2,2),gap:8}}><Inp label="Quantidade executada" type="number" value={novoAvanco.quantity} onChange={v=>setNovoAvanco(form=>({...form,quantity:v}))}/><Inp label="Data" type="date" value={novoAvanco.data} onChange={v=>setNovoAvanco(form=>({...form,data:v}))}/></div><div style={{marginTop:9}}><p style={{fontSize:9.5,fontWeight:800,color:C.text}}>Equipe vinculada <span style={{fontWeight:500,color:C.muted}}>· obrigatória em atividade crítica</span></p><div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>{trabalhadoresDaObra.map(worker=>{const checked=(novoAvanco.workerIds||[]).includes(worker.id);return <label key={worker.id} style={{display:"inline-flex",gap:6,alignItems:"center",padding:"6px 8px",border:`1px solid ${checked?C.blue:C.border}`,borderRadius:6,background:checked?`${C.blue}08`:C.card,cursor:"pointer",fontSize:10,color:C.text}}><input type="checkbox" checked={checked} onChange={()=>alternarTrabalhadorAvanco(worker.id)} style={{accentColor:C.blue}}/>{worker.name||worker.nome||"Colaborador"}</label>;})}{!trabalhadoresDaObra.length&&<span style={{fontSize:10,color:C.orange}}>Nenhum colaborador ativo disponível para vincular.</span>}</div></div><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:9}}><Btn size="sm" v="ghost" onClick={()=>setNovoAvanco(null)}>Cancelar</Btn><Btn size="sm" onClick={registrarAvanco}>Registrar avanço</Btn></div></div>}
        <div>{compromissosDaObra.slice(0,8).map(compromisso=>{
          const concluido=compromisso.status==="concluido",naoConcluido=compromisso.status==="nao_concluido",bloqueado=compromisso.status==="bloqueado",cor=concluido?C.green:(naoConcluido||bloqueado)?C.orange:C.blue;
          const meta=Math.max(0,Number(compromisso.quantidadePrometida||0)),feito=Math.max(0,Number(compromisso.quantidadeRealizada||0)),pct=meta?Math.min(100,feito/meta*100):0;
          const avancos=(avancosPorCompromisso.get(String(compromisso.id))||[]).slice().sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")));
          return <div key={compromisso.id} style={{padding:"10px 12px",borderTop:`1px solid ${C.line}`}}><div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:12,alignItems:"center"}}>
            <div style={{minWidth:0}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline"}}><b style={{fontSize:11,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{compromisso.descricao||"Compromisso sem descrição"}</b><span style={{fontSize:9,fontWeight:900,color:cor,textTransform:"uppercase",whiteSpace:"nowrap"}}>{concluido?"concluído":naoConcluido?"não concluído":bloqueado?"bloqueado":"em aberto"}</span></div><p style={{fontSize:9.5,color:bloqueado?C.orange:C.muted,marginTop:3}}>{bloqueado?`Restrição: ${compromisso.blockingReason||"não informada"}`:`${feito} entregue de ${meta||"—"} prometido${compromisso.motivoNaoCumprimento?` · ${compromisso.motivoNaoCumprimento}`:""}`}</p><div style={{height:3,background:C.surface,borderRadius:99,overflow:"hidden",marginTop:6}}><i style={{display:"block",height:"100%",width:`${pct}%`,background:cor}}/></div></div>
            {!concluido&&!naoConcluido&&podeConcluirCompromisso&&<div style={{display:"flex",gap:6,alignItems:"center"}}>{bloqueado?<Btn size="sm" v="ghost" onClick={()=>liberarCompromissoSemanal(compromisso)}>Liberar</Btn>:<><Btn size="sm" v="ghost" onClick={()=>abrirNovoAvanco(compromisso)}>Registrar avanço</Btn><Btn size="sm" v="ghost" onClick={()=>concluirCompromissoSemanal(compromisso)}>Concluir</Btn></>}</div>}
          </div>{avancos.length>0&&<details style={{marginTop:7}}><summary style={{cursor:"pointer",fontSize:9.5,color:C.muted}}>Evidências de produção · {avancos.length}</summary><div style={{marginTop:6,display:"flex",flexDirection:"column",gap:4}}>{avancos.map(avanco=>{const cancelado=avanco.status==="cancelado";return <div key={avanco.id} style={{display:"grid",gridTemplateColumns:"1fr auto",alignItems:"center",gap:8,padding:"6px 8px",border:`1px solid ${C.line}`,borderRadius:6,background:cancelado?C.surface:C.card}}><span style={{fontSize:9.5,color:cancelado?C.muted:C.text}}>{fmtDate(avanco.data)} · <b>{Number(avanco.quantity||0)}</b>{cancelado?` · estornado: ${avanco.motivoCancelamento||"sem motivo"}`:""}</span>{!cancelado&&podeConcluirCompromisso&&<Btn size="sm" v="ghost" onClick={()=>estornarAvanco(avanco)}>Estornar</Btn>}</div>;})}</div></details>}</div>;
        })}{!compromissosDaObra.length&&!novoCompromisso&&<p style={{padding:"13px 12px",fontSize:10.5,color:C.muted}}>Nenhum compromisso ativo. Adicione o que será entregue nesta semana para acompanhar o PPC.</p>}</div>
      </div>}

      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><div style={{padding:"10px 12px",borderBottom:`1px solid ${C.line}`,display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><div><p style={{fontSize:10,fontWeight:900,letterSpacing:.7,color:C.muted,textTransform:"uppercase"}}>Lookahead</p><b style={{fontSize:12,color:C.text}}>Restrições antes da execução</b></div><Btn size="sm" v="ghost" onClick={criarLookahead} disabled={!!lookaheadsDaObra.length}>Criar 4 semanas</Btn></div>{lookaheadsDaObra.map(lookahead=><div key={lookahead.id} style={{padding:"10px 12px",borderTop:`1px solid ${C.line}`}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><p style={{fontSize:10,color:C.text,fontWeight:800}}>Janela de {lookahead.horizonteSemanas} semanas · {lookahead.pacotes?.length||0} pacotes</p><Btn size="sm" v="ghost" onClick={()=>setNovaRestricao({lookaheadId:lookahead.id,pacoteId:lookahead.pacotes?.[0]?.id||"",categoria:"outro",descricao:"",dataNecessidade:today()})}>Adicionar restrição</Btn></div>{novaRestricao?.lookaheadId===lookahead.id&&<div style={{marginTop:8,display:"grid",gridTemplateColumns:cols(1,2,4),gap:7}}><Sel label="Pacote" value={novaRestricao.pacoteId} onChange={value=>setNovaRestricao(form=>({...form,pacoteId:value}))} options={(lookahead.pacotes||[]).map(item=>({v:item.id,l:item.descricao||item.id}))}/><Sel label="Categoria" value={novaRestricao.categoria} onChange={value=>setNovaRestricao(form=>({...form,categoria:value}))} options={["material","mao_de_obra","equipamento","seguranca","qualidade","projeto","outro"].map(value=>({v:value,l:value.replaceAll("_"," ")}))}/><Inp label="Necessária em" type="date" value={novaRestricao.dataNecessidade} onChange={value=>setNovaRestricao(form=>({...form,dataNecessidade:value}))}/><Inp label="Restrição" value={novaRestricao.descricao} onChange={value=>setNovaRestricao(form=>({...form,descricao:value}))}/><div style={{display:"flex",gap:6,alignItems:"end"}}><Btn size="sm" v="ghost" onClick={()=>setNovaRestricao(null)}>Cancelar</Btn><Btn size="sm" onClick={adicionarRestricao}>Registrar</Btn></div></div>}<div style={{marginTop:8}}>{(lookahead.restricoes||[]).map(restricao=>{const liberada=restricao.status==="liberada";return <div key={restricao.id} style={{display:"flex",justifyContent:"space-between",gap:8,padding:"7px 0",borderTop:`1px solid ${C.line}`}}><span style={{fontSize:10,color:liberada?C.muted:C.text}}>{restricao.descricao} · {restricao.categoria}</span>{liberada?<Badge color={C.green}>LIBERADA</Badge>:<Btn size="sm" v="ghost" onClick={()=>liberarRestricao(lookahead,restricao)}>Liberar</Btn>}</div>;})}{!(lookahead.restricoes||[]).length&&<p style={{fontSize:10,color:C.muted}}>Nenhuma restrição registrada.</p>}</div></div>)}{!lookaheadsDaObra.length&&<p style={{padding:"13px 12px",fontSize:10.5,color:C.muted}}>Crie uma janela de 4 semanas para antecipar material, projetos, equipe, segurança e demais bloqueios.</p>}</div>

      {/* Fisico-financeiro em destaque: previsao de custo final e eficiencia */}
      {ff.linhas.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: cols(2, 4, 4), gap: 8 }}>
          <MiniKpi label="Avanco fisico" value={`${ff.total.pctFisico.toFixed(0)}%`} cor={C.blue}
                   sub="valor agregado / previsto" />
          <MiniKpi label="Custo realizado" value={fmt(ff.total.realizado)} cor={C.purple} />
          <MiniKpi label="Previsao de custo final"
                   value={fmt(ff.total.previsaoFinal)}
                   cor={ff.total.previsaoFinal > ff.total.previsto ? C.red : C.green}
                   sub={ff.total.previsaoFinal > ff.total.previsto ? "acima do orcado" : "dentro do orcado"} />
          <MiniKpi label="Eficiencia (CPI)"
                   value={ff.total.cpi ? ff.total.cpi.toFixed(2) : "-"}
                   cor={ff.total.cpi >= 1 ? C.green : C.red}
                   sub={ff.total.cpi >= 1 ? "no custo ou abaixo" : "gastando mais que o avanco"} />
        </div>
      )}

      {/* ==== GANTT ==== */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "11px 14px", borderBottom: `1px solid ${C.line}` }}>
          <p style={{ fontSize: 12, fontWeight: 900, color: C.text, textTransform: "uppercase", letterSpacing: .5 }}>
            Cronograma
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap:"wrap", justifyContent:"flex-end" }}>
            <Btn v="ghost" size="sm" onClick={() => { setQuestIA(null); setQuestModal(true); }}>
              <Ic n="brain" s={13}/> Planejar IA
            </Btn>
            <Btn v="ghost" size="sm" onClick={pedirOrientacaoIA} disabled={iaCarregando}>
              {iaCarregando ? "..." : <><Ic n="brain" s={13}/> Revisar datas IA</>}
            </Btn>
            <Btn v="ghost" size="sm" onClick={analisarVinculosIA}>
              <Ic n="brain" s={13}/> Vinculos IA
            </Btn>
            <Btn v="ghost" size="sm" onClick={() => setExportA2Modal(true)}>
              <Ic n="download" s={13}/> Exportar A2
            </Btn>
            <Btn v="ghost" size="sm" onClick={() => setColsCrono(atual => ({...atual,inicio:!(atual.inicio&&atual.fim),fim:!(atual.inicio&&atual.fim)}))}>
              {colsCrono.inicio&&colsCrono.fim ? "Ocultar datas" : "Editar datas"}
            </Btn>
            <Btn v="ghost" size="sm" onClick={() => setMarcoModal({ modo: "novo", marco: { tipo: "compra", data: today() } })}>
              + Marco
            </Btn>
            {etapasLivres.length > 0 && (
              <Btn v="ghost" size="sm" onClick={() => setTarefaModal({ modo: "addEtapa" })}>
                + Etapa
              </Btn>
            )}
          </div>
        </div>

        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",padding:"6px 14px",
                     borderBottom:`1px solid ${C.line}`,background:C.surface}}>
          <span style={{fontSize:9,fontWeight:800,color:C.muted,textTransform:"uppercase"}}>Legenda tecnica</span>
          <span style={{fontSize:9.5,color:C.text}}><i style={{display:"inline-block",width:9,height:9,background:`${C.red}22`,border:`1px solid ${C.red}55`,marginRight:4}}/>Nao trabalhado</span>
          <span style={{fontSize:9.5,color:C.text}}><i style={{display:"inline-block",width:9,height:9,background:`${C.blue}18`,border:`1px solid ${C.blue}55`,marginRight:4}}/>Fim de semana trabalhado</span>
          <span style={{fontSize:9.5,color:C.text}}><i style={{display:"inline-block",width:9,height:9,background:`${C.orange}45`,border:`1px solid ${C.orange}`,marginRight:4}}/>Feriado</span>
          <span style={{fontSize:9.5,color:C.text}}><i style={{display:"inline-block",height:10,borderLeft:`2px solid ${C.red}`,marginRight:5}}/>Hoje</span>
          <span style={{fontSize:9.5,color:C.text}}><i style={{display:"inline-block",width:9,height:9,background:`${C.orange}25`,border:`1px solid ${C.orange}`,marginRight:4}}/>Conflito de vinculo</span>
          <span style={{fontSize:9.5,color:C.text}}><i style={{display:"inline-block",width:12,height:8,background:C.red,marginRight:4,verticalAlign:"middle"}}/>Caminho crítico (folga zero)</span>
          <span style={{fontSize:9.5,color:C.muted}}>Arraste a barra para mover · alças nas bordas ajustam início e fim</span>
          <span style={{fontSize:9.5,color:C.muted}} title="Total de dias de atraso que o projeto tolera fora do caminho crítico">Fim: dia útil {critico.fimProjeto ?? "-"}</span>
          <span style={{fontSize:9.5,color:C.muted,marginLeft:"auto"}}>{(cal.diasSemana||[]).length} dias/semana - {(cal.feriados||[]).length} feriado(s) no calendario</span>
        </div>

        {tarefas.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
              Nenhuma tarefa ainda. Toque em <b>+ Etapa</b> para trazer as etapas
              do orcamento para o cronograma.
            </p>
          </div>
        ) : (
          <>
            {/* Barra horizontal superior: fica sempre acessivel mesmo em cronogramas longos.
                Sincronizada com a rolagem principal. */}
            <div ref={ganttTopScrollRef} onScroll={()=>sincronizarRolagemGantt("topo")}
                 style={{overflowX:"auto",overflowY:"hidden",height:20,borderBottom:`1px solid ${C.line}`,
                         scrollbarGutter:"stable",background:`linear-gradient(180deg, ${C.surface}, ${C.card})`,
                         boxShadow:`inset 0 -1px 0 ${C.line}88`}}>
              <div style={{width:LARGURA_TOTAL_GANTT,height:1}} />
            </div>
            <div ref={ganttScrollRef} onScroll={()=>sincronizarRolagemGantt("corpo")}
                 style={{ display: "flex", overflow: "auto", WebkitOverflowScrolling: "touch",
                          maxHeight:"68vh", minHeight:Math.min(ALTURA_REGUA+tarefas.length*ALTURA_LINHA,260),
                          scrollbarGutter:"stable both-edges", overscrollBehavior:"contain" }}>

            {/* Colunas tecnicas fixas: edicao direta sem abrir popup */}
            <div style={{ flexShrink: 0, borderRight: `1px solid ${C.line}`,
                          position: isDesktop ? "sticky" : "relative", left: 0, background: C.card, zIndex: 5,
                          width:LARGURA_TAREFAS }}>
              <div style={{ height: ALTURA_REGUA, borderBottom: `1px solid ${C.line}`,
                            display:"grid", gridTemplateColumns:COLUNAS_TAREFA, alignItems:"center" }}>
                {colunasVisiveis.map((col,i)=>(
                  <span key={col.id}
                    className={`planning-gantt-header-cell${col.id==="inicio"||col.id==="fim"?" planning-gantt-header-cell--date":""}`}
                    style={{fontSize:8.5,fontWeight:800,color:C.muted,textTransform:"uppercase",
                    padding:"0 7px",borderLeft:i?`1px solid ${C.line}`:"none",height:"100%",
                    display:"flex",alignItems:"center"}}>{col.label}</span>
                ))}
              </div>
              {tarefas.map(t => {
                const ant = (t.depende || []).map(id=>tarefas.find(x=>x.id===id)?.nome).filter(Boolean);
                const suc = idsSucessoras(tarefas,t.id).map(id=>tarefas.find(x=>x.id===id)?.nome).filter(Boolean);
                const conflitoVinculo = (t.depende || []).some(id => {
                  const a = tarefas.find(x=>x.id===id);
                  return a?.fim && t.inicio && t.inicio <= a.fim;
                });
                const estiloInput = {width:"100%",height:26,border:0,background:"transparent",color:C.text,
                  fontSize:10,padding:"0 5px",outline:"none",fontFamily:"inherit"};
                // Cada celula por id; renderiza so as colunas visiveis, na ordem.
                const bordaEsq = i => i>0 ? `1px solid ${C.line}` : "none";
                const celulas = {
                  atividade: (
                    <div key="atividade" onClick={() => setTarefaModal({ modo:"editar", tarefa:t })}
                         title={`Antecessora(s): ${ant.join(", ")||"nenhuma"}\nSucessora(s): ${suc.join(", ")||"nenhuma"}`}
                         style={{padding:"0 7px",display:"flex",flexDirection:"column",justifyContent:"center",cursor:"pointer",minWidth:0}}>
                      <p style={{fontSize:10.5,fontWeight:700,color:t.orfa?C.red:conflitoVinculo?C.orange:C.text,overflow:"hidden",
                                 textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.nome}</p>
                      <p style={{fontSize:8.5,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {planMostrarReal && (t.inicioReal || t.fimReal || t.custoReal>0) ? (
                          <>
                            <span style={{color:C.blue,fontWeight:700}}>Real: </span>
                            {t.inicioReal||t.fimReal ? `${t.inicioReal?fmtDate(t.inicioReal):"?"}→${t.fimReal?fmtDate(t.fimReal):"?"}` : "sem datas"}
                            {t.custoReal>0 ? ` · ${fmt(t.custoReal)}` : ""}
                            {t.fim && t.fimReal && t.fimReal>t.fim ? " · atrasou" : ""}
                          </>
                        ) : (
                          <>{t.custo>0?fmt(t.custo):"avulsa"} · A:{ant.length} S:{suc.length}{conflitoVinculo?" · conflito de data":""}</>
                        )}
                      </p>
                    </div>
                  ),
                  inicio: (
                    <div key="inicio" className="planning-gantt-date-cell planning-gantt-date-cell--start">
                      <input className="planning-inline-date" aria-label={`Início planejado de ${t.nome||"atividade"}`} key={`${t.id}-ini-${t.inicio}`} type="date" value={t.inicio||""} disabled={t.titulo}
                        onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}
                        onChange={e=>e.target.value&&e.target.value!==t.inicio&&atualizarTarefaNaLinha(t,"inicio",e.target.value)} style={estiloInput}/>
                    </div>
                  ),
                  fim: (
                    <div key="fim" className="planning-gantt-date-cell planning-gantt-date-cell--end">
                      <input className="planning-inline-date" aria-label={`Fim planejado de ${t.nome||"atividade"}`} key={`${t.id}-fim-${t.fim}`} type="date" value={t.fim||""} disabled={t.titulo}
                        onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}
                        onChange={e=>e.target.value&&e.target.value!==t.fim&&atualizarTarefaNaLinha(t,"fim",e.target.value)} style={estiloInput}/>
                    </div>
                  ),
                  dias: (
                    <div key="dias" style={{display:"flex",alignItems:"center"}}>
                      <input key={`${t.id}-dias-${t.inicio}-${t.fim}`} type="number" min="1"
                        defaultValue={Math.max(1,diasUteis(t.inicio,t.fim,cal))} disabled={t.titulo}
                        onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}
                        onBlur={e=>Number(e.target.value)!==diasUteis(t.inicio,t.fim,cal)&&atualizarTarefaNaLinha(t,"dias",e.target.value)}
                        style={{...estiloInput,textAlign:"center"}}/>
                    </div>
                  ),
                  custo: (
                    <div key="custo" onClick={() => setTarefaModal({modo:"editar",tarefa:t})}
                         style={{padding:"0 6px",display:"flex",alignItems:"center",justifyContent:"flex-end",cursor:"pointer",minWidth:0}}>
                      <span style={{fontSize:9.5,color:t.custo>0?C.text:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {t.custo>0?fmt(t.custo):"-"}
                      </span>
                    </div>
                  ),
                  progresso: (
                    <div key="progresso" title="Confirmado no boletim de medição" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"0 6px"}}>
                      <span style={{fontSize:10,fontWeight:800,color:t.progressoOrigem==="medicao_tecnica_aprovada"?C.green:C.text}}>{Number(t.progresso||0).toFixed(0)}%</span>
                    </div>
                  ),
                  antecessora: (
                    <div key="antecessora" onClick={() => setTarefaModal({modo:"editar",tarefa:t})} title={ant.join("\n")||"Sem antecessora"}
                         style={{padding:"0 6px",display:"flex",alignItems:"center",cursor:"pointer",minWidth:0}}>
                      <span style={{fontSize:9.5,color:ant.length?C.blue:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {ant.join(", ")||"-"}
                      </span>
                    </div>
                  ),
                  sucessora: (
                    <div key="sucessora" onClick={() => setTarefaModal({modo:"editar",tarefa:t})} title={suc.join("\n")||"Sem sucessora"}
                         style={{padding:"0 6px",display:"flex",alignItems:"center",cursor:"pointer",minWidth:0}}>
                      <span style={{fontSize:9.5,color:suc.length?C.green:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {suc.join(", ")||"-"}
                      </span>
                    </div>
                  ),
                };
                return (
                  <div key={t.id} style={{height:ALTURA_LINHA,display:"grid",gridTemplateColumns:COLUNAS_TAREFA,
                                          borderBottom:`1px solid ${C.line}`,background:conflitoVinculo?`${C.orange}0B`:"transparent"}}>
                    {colunasVisiveis.map((col,i)=>(
                      <div key={col.id}
                        className={`planning-gantt-grid-cell${col.id==="inicio"||col.id==="fim"?" planning-gantt-grid-cell--date":""}`}
                        style={{borderLeft:bordaEsq(i),minWidth:0,display:"flex"}}>
                        {celulas[col.id]}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Area do grafico. O overflow fica recortado neste painel para
                impedir que barras ou linhas de dependencia com coordenadas
                negativas atravessem a tabela lateral. */}
            <div style={{ position: "relative", minWidth: larguraGrade,
                          height:ALTURA_REGUA+tarefas.length*ALTURA_LINHA,
                          flexShrink:0, overflow: "hidden", isolation: "isolate" }}>
              {/* Regua tecnica: mes, numero do dia, dia da semana e excecoes */}
              <div style={{ height: ALTURA_REGUA, position: "relative", borderBottom: `1px solid ${C.line}` }}>
                {reguaMeses.map((m, i) => (
                  <div key={i} style={{ position: "absolute", left: m.x, top: 0, height: "100%",
                                        borderLeft: `1px solid ${C.line}`, paddingLeft: 4,
                                        display: "flex", alignItems: "flex-start", paddingTop:2 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, whiteSpace: "nowrap" }}>{m.label}</span>
                  </div>
                ))}
                {diasGrade.map(d => {
                  const nomes = ["DOM","SEG","TER","QUA","QUI","SEX","SAB"];
                  const bg = d.feriado ? `${C.orange}30` : d.naoTrabalhado ? `${C.red}12` : d.fimSemana ? `${C.blue}12` : "transparent";
                  const mostrar = zoom === "dia" || (zoom === "semana" && (d.dow === 1 || d.feriado));
                  return <div key={d.data}
                    title={`${fmtDateFull(d.data)}${d.feriado ? ` - ${d.feriado.nome}` : d.naoTrabalhado ? " - nao trabalhado" : " - dia de trabalho"}`}
                    style={{position:"absolute",left:d.x,top:18,width:pxPorDia,height:ALTURA_REGUA-18,
                      background:bg,borderRight:`1px solid ${C.line}`,overflow:"hidden",textAlign:"center"}}>
                    {mostrar && <><span style={{display:"block",fontSize:zoom==="dia"?10:8,fontWeight:900,
                      color:d.feriado?C.orange:d.naoTrabalhado?C.red:C.text,lineHeight:1.2}}>{d.data.slice(8,10)}</span>
                    {zoom === "dia" && <span style={{display:"block",fontSize:7.5,fontWeight:700,color:C.muted}}>{nomes[d.dow]}</span>}</>}
                  </div>;
                })}
                {/* Linha do hoje */}
                {today() >= GANTT_INI && today() <= somaDias(GANTT_INI,totalDias-1) &&
                  <div style={{ position: "absolute", left: xDeData(today()), top: 0, height: "100%",
                                borderLeft: `2px solid ${C.red}`, opacity: .6 }} />}
              </div>

              {/* Fins de semana e feriados continuam visiveis em todas as linhas */}
              <div style={{position:"absolute",left:0,top:ALTURA_REGUA,width:larguraGrade,
                           height:tarefas.length*ALTURA_LINHA,pointerEvents:"none",zIndex:0}}>
                {diasGrade.map(d => <div key={d.data} style={{
                  position:"absolute",left:d.x,top:0,width:pxPorDia,height:"100%",
                  background:d.feriado?`${C.orange}20`:d.naoTrabalhado?`${C.red}0B`:d.fimSemana?`${C.blue}09`:"transparent",
                  borderRight:`1px solid ${C.line}88`
                }}/>) }
                {today() >= GANTT_INI && today() <= somaDias(GANTT_INI,totalDias-1) &&
                  <div style={{position:"absolute",left:xDeData(today()),top:0,height:"100%",
                               borderLeft:`2px solid ${C.red}`,opacity:.55,zIndex:1}}/>}
              </div>

              {/* Linhas de fundo + barras */}
              {tarefas.map((t, idx) => {
                const drag = dragRef.current;
                const emDrag = drag && drag.id === t.id ? drag.preview : null;
                const ini = emDrag ? emDrag.inicio : t.inicio;
                const fim = emDrag ? emDrag.fim : t.fim;
                const x = xDeData(ini);
                // Inicio e fim sao inclusivos; a barra precisa ocupar tambem a
                // celula do ultimo dia para coincidir com a regua tecnica.
                const w = Math.max(pxPorDia, (diasCorridos(ini, fim) + 1) * pxPorDia);
                // Alça maior no toque (o dedo é bem menos preciso que o mouse) e
                // sempre limitada a metade da barra, senão as duas alças se
                // sobrepõem numa tarefa curta e a barra vira só "mover".
                const larguraAlca = Math.max(6, Math.min(isMobile ? 18 : 12, Math.floor(w / 2) - 1));
                return (
                  <div key={t.id} style={{ height: ALTURA_LINHA, position: "relative",
                                           borderBottom: `1px solid ${C.line}`,
                                           background: idx % 2 ? `${C.surface}55` : "transparent" }}>
                    {/* Barra */}
                    <div
                      onMouseDown={(e) => t.titulo ? null : iniciarDrag(e, t, "mover")}
                      onTouchStart={(e) => t.titulo ? null : iniciarDrag(e, t, "mover")}
                      title={t.titulo ? t.nome : `${t.nome} — arraste para mover; use as alças para ajustar as datas`}
                      style={{
                        position: "absolute", left: x,
                        top: t.titulo ? 14 : 7,
                        width: w, height: t.titulo ? ALTURA_LINHA - 28 : ALTURA_LINHA - 14,
                        background: t.titulo ? C.subtle : (critico.criticas.includes(t.id) && !t.titulo ? C.red : corTarefa(t)),
                        borderRadius: t.titulo ? 3 : 6,
                        cursor: t.titulo ? "default" : "grab",
                        // Caminho crítico: barra vermelha (a cor de progresso é
                        // trocada pela criticidade; o preenchimento branco por
                        // cima continua mostrando o avanço).
                        outline: critico.criticas.includes(t.id) ? `1.5px solid #7f0000` : "none",
                        outlineOffset: 1,
                        boxShadow: emDrag ? `0 4px 14px ${corTarefa(t)}66` : "none",
                        display: "flex", alignItems: "center", overflow: "hidden",
                        touchAction: "none", userSelect: "none",
                        transition: emDrag ? "none" : "box-shadow .1s", zIndex: 1,
                      }}>
                      {/* Preenchimento do progresso */}
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0,
                                    width: `${t.progresso}%`, background: "rgba(255,255,255,.28)" }} />
                      <span style={{ position: "relative", fontSize: 9.5, fontWeight: 800,
                                     color: "#fff", padding: "0 7px", whiteSpace: "nowrap",
                                     overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.titulo ? t.nome : (t.progresso > 0 ? `${t.progresso}%` : "")}
                      </span>
                      {/* Alça de redimensionar - início. Fundo sutil sempre visível
                          (não só no hover) para o dedo achar a borda no toque, e
                          um risco central marcando a pegada. */}
                      {!t.titulo && <div onMouseDown={(e) => iniciarDrag(e, t, "inicio")}
                           onTouchStart={(e) => iniciarDrag(e, t, "inicio")}
                           title="Arraste para ajustar o início"
                           style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: larguraAlca,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: "rgba(0,0,0,.14)", cursor: "ew-resize", touchAction: "none", zIndex: 2 }}>
                        <span style={{ width: 2, height: "40%", borderRadius: 2, background: "rgba(255,255,255,.85)" }}/>
                      </div>}
                      {/* Alça de redimensionar - fim */}
                      {!t.titulo && <div onMouseDown={(e) => iniciarDrag(e, t, "fim")}
                           onTouchStart={(e) => iniciarDrag(e, t, "fim")}
                           title="Arraste para ajustar o fim"
                           style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: larguraAlca,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: "rgba(0,0,0,.14)", cursor: "ew-resize", touchAction: "none", zIndex: 2 }}>
                        <span style={{ width: 2, height: "40%", borderRadius: 2, background: "rgba(255,255,255,.85)" }}/>
                      </div>}
                    </div>
                    {/* Barra fina do REALIZADO (datas reais), sob a planejada.
                        Azul = dentro/antes do fim planejado; vermelha = passou. */}
                    {planMostrarReal && !t.titulo && t.inicioReal && t.fimReal && (() => {
                      const xr = xDeData(t.inicioReal);
                      const wr = Math.max(pxPorDia, (diasCorridos(t.inicioReal, t.fimReal) + 1) * pxPorDia);
                      const atrasou = t.fim && t.fimReal > t.fim;
                      return (
                        <div title={`Realizado: ${fmtDate(t.inicioReal)} → ${fmtDate(t.fimReal)}${atrasou?" (após o previsto)":""}`}
                             style={{ position:"absolute", left:xr, width:wr, bottom:3, height:5,
                                      background: atrasou ? C.red : C.blue, borderRadius:99, zIndex:2 }} />
                      );
                    })()}
                  </div>
                );
              })}

              {/* Linhas de dependência (antecessora → sucessora).
                  Fim da antecessora até o início da sucessora, no padrão
                  término-início. Padrão técnico: linha reta com cotovelo suave
                  apenas quando muda de altura. Vermelho se crítica (caminho crítico: folga zero),
                  cinza no resto. Clique na linha para editar os vínculos. */}
              {(() => {
                const idxDe = {};
                tarefas.forEach((t, i) => { idxDe[t.id] = i; });
                const yBarra = i => ALTURA_REGUA + i * ALTURA_LINHA + ALTURA_LINHA / 2;
                const linhas = [];
                tarefas.forEach(suc => {
                  if (suc.titulo) return;
                  (suc.depende || []).forEach(depId => {
                    const ant = tarefas.find(x => x.id === depId);
                    if (!ant || ant.titulo || idxDe[depId] == null) return;
                    // Fim visual da barra = início do último dia + 1 célula.
                    const x1 = xDeData(ant.fim) + pxPorDia;
                    const y1 = yBarra(idxDe[depId]);
                    const x2 = xDeData(suc.inicio);
                    const y2 = yBarra(idxDe[suc.id]);
                    const critica = critico.criticas.includes(depId) && critico.criticas.includes(suc.id);
                    linhas.push({ x1, y1, x2, y2, critica, antId: depId, sucId: suc.id, key: `${depId}-${suc.id}` });
                  });
                });
                if (!linhas.length) return null;
                const cInc = "#8a8a8a";
                return (
                <svg style={{ position: "absolute", left: 0, top: 0, width: larguraGrade,
                                height: ALTURA_REGUA + tarefas.length * ALTURA_LINHA,
                                pointerEvents: "auto", zIndex: 0, overflow: "hidden" }}>
                    <defs>
                      <marker id="setaDep" markerWidth="7" markerHeight="7" refX="5.5" refY="3"
                              orient="auto" markerUnits="userSpaceOnUse">
                        <path d="M0,0 L6,3 L0,6 Z" fill={cInc} />
                      </marker>
                      <marker id="setaDepC" markerWidth="8" markerHeight="8" refX="6" refY="3.2"
                              orient="auto" markerUnits="userSpaceOnUse">
                        <path d="M0,0 L6.5,3.2 L0,6.4 Z" fill={C.red} />
                      </marker>
                    </defs>
                    {linhas.map(l => {
                      // Padrão técnico: linha reta até o meio, depois cotovelo suave
                      // só se houver mudança de altura (y1 != y2).
                      const meio = l.x2 > l.x1 + 12 ? (l.x1 + l.x2) / 2 : l.x1 + 8;
                      let d;
                      if (l.y1 === l.y2) {
                        // Mesma altura: linha reta horizontal
                        d = `M ${l.x1} ${l.y1} H ${l.x2 - 2}`;
                      } else {
                        // Alturas diferentes: cotovelo com curva suave no canto
                        // (quadratic Bézier para transição mais suave que ângulo reto)
                        d = `M ${l.x1} ${l.y1} H ${meio} Q ${meio} ${(l.y1 + l.y2) / 2} ${meio} ${l.y2} H ${l.x2 - 2}`;
                      }
                      return (
                        <g key={l.key} opacity={l.critica ? 0.95 : 0.6} style={{ cursor: "pointer" }}>
                          {/* Camada invisível grossa para facilitar click */}
                          <path d={d} fill="none" stroke="transparent" strokeWidth="16" style={{ pointerEvents: "stroke" }}
                                onClick={() => {
                                  const suc = tarefas.find(x => x.id === l.sucId);
                                  if (suc) setTarefaModal({ modo: "editar", tarefa: suc });
                                }} />
                          {/* Linha visível */}
                          <path d={d} fill="none"
                                stroke={l.critica ? C.red : cInc}
                                strokeWidth={l.critica ? 2 : 1.3}
                                strokeDasharray={l.critica ? "none" : "3 2"}
                                markerEnd={l.critica ? "url(#setaDepC)" : "url(#setaDep)"}
                                style={{ pointerEvents: "none" }} />
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}

              {/* Marcos: losangos na regua */}
              {(plano.marcos || []).map(m => {
                if (!m.data) return null;
                const x = xDeData(m.data);
                const tp = TIPO_MARCO[m.tipo] || TIPO_MARCO.geral;
                return (
                  <div key={m.id} onClick={() => setMarcoModal({ modo: "editar", marco: m })}
                       title={m.nome}
                       style={{ position: "absolute", left: x - 7,
                                top: ALTURA_REGUA, height: tarefas.length * ALTURA_LINHA,
                                cursor: "pointer", zIndex: 1 }}>
                    <div style={{ width: 14, height: 14, background: tp.c, transform: "rotate(45deg)",
                                  marginTop: 2, border: "2px solid #fff",
                                  boxShadow: `0 1px 4px ${tp.c}88`,
                                  opacity: m.feito ? .5 : 1 }} />
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: 6,
                                  borderLeft: `2px dashed ${tp.c}55` }} />
                  </div>
                );
              })}
            </div>
          </div>
          </>
        )}
      </div>

      {/* ==== FERRAMENTAS AUXILIARES ==== */}
      {tarefas.filter(t=>!t.titulo).length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          {/* Abas */}
          <div style={{ padding: "8px 8px 0" }}>
            <TabRow tabs={[["mensal","Financeiro mensal"],["curvaS","Curva S"],["ff","Fisico-financeiro"],["lob","Linha de balanço"],["base","Planejado × Realizado"]]} active={aba} onChange={setAba}/>
          </div>

          <div style={{ padding: "14px" }}>
            {/* --- FINANCEIRO MENSAL --- */}
            {aba === "mensal" && (
              distMensal.length === 0
                ? <p style={{ fontSize: 12, color: C.muted }}>Defina datas nas tarefas para ver o financeiro por mes.</p>
                : (
                  <div>
                    <p style={{ fontSize: 11, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
                      Custo planejado distribuido pelos dias uteis de cada tarefa. Barra cheia = maior mes.
                    </p>
                    {(() => {
                      const maxMes = Math.max(...distMensal.map(d => d.valor));
                      return distMensal.map(d => (
                        <div key={d.mes} style={{ marginBottom: 11 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{fmtMesAno(d.mes + "-01")}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.yellowD }}>{fmt(d.valor)}</span>
                          </div>
                          <div style={{ height: 8, background: C.line, borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(d.valor / maxMes) * 100}%`,
                                          background: C.yellow, borderRadius: 99 }} />
                          </div>
                          <p style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>acumulado {fmt(d.acumulado)}</p>
                        </div>
                      ));
                    })()}
                  </div>
                )
            )}

            {/* --- CURVA S --- */}
            {aba === "curvaS" && (
              dadosS.length === 0
                ? <p style={{ fontSize: 12, color: C.muted }}>Sem dados para a curva S ainda.</p>
                : (
                  <div>
                    <p style={{ fontSize: 11, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
                      Avanco fisico acumulado esperado ao longo do tempo (% do custo total).
                    </p>
                    <CurvaSGrafico dados={dadosS} real={ffMensalReal} />
                    <p style={{ fontSize:10.5, color:C.muted, marginTop:10, lineHeight:1.5 }}>
                      A linha amarela é o avanço financeiro <b>planejado</b> acumulado; a azul, o <b>realizado</b> (quando há custo lançado ou avanço físico). Quando a azul fica abaixo da amarela, a obra está mais lenta que o previsto. As barras claras mostram o peso de cada mês.
                    </p>
                  </div>
                )
            )}

            {aba === "lob" && (
              linhaBalanco.lines.length===0
                ? <div style={{padding:"8px 0"}}><p style={{fontSize:12,fontWeight:800,color:C.text}}>Ainda não há frentes repetitivas configuradas.</p><p style={{fontSize:10.5,color:C.muted,marginTop:5,lineHeight:1.5}}>Abra uma tarefa, informe o mesmo grupo repetitivo e a frente ou pavimento. A Linha de Balanço mostrará a cadência e avisará se a sequência for invertida.</p></div>
                : <div><p style={{fontSize:11,color:C.muted,marginBottom:12,lineHeight:1.5}}>Cada faixa representa a passagem de uma equipe pelas frentes. A cadência compara a distância entre inícios; âmbar só indica sequência invertida ou irregular.</p><div style={{display:"flex",flexDirection:"column",gap:10}}>{linhaBalanco.lines.map(line=>{const warning=line.reversed.length>0||!line.stable;const color=warning?C.orange:C.blue;return <div key={line.group} style={{border:`1px solid ${C.border}`,borderLeft:`3px solid ${color}`,borderRadius:7,padding:"10px 11px",background:C.card}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"baseline",flexWrap:"wrap"}}><b style={{fontSize:11,color:C.text}}>{line.group}</b><span style={{fontSize:9.5,fontWeight:800,color:warning?C.orange:C.muted}}>{line.cadenceDays==null?"cadência indisponível":`${line.cadenceDays.toFixed(1).replace(".",",")} dia(s) por frente`}</span></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(105px,1fr))",gap:6,marginTop:8}}>{line.entries.map(entry=><div key={entry.activityId} style={{padding:"7px 8px",border:`1px solid ${C.line}`,borderRadius:6,background:C.surface}}><p style={{fontSize:8.5,fontWeight:850,color:C.muted,textTransform:"uppercase"}}>Frente {entry.front}</p><b style={{display:"block",fontSize:10,color:C.text,marginTop:2}}>{fmtDate(entry.start)} → {fmtDate(entry.finish)}</b><p style={{fontSize:9,color:entry.progress>=100?C.green:C.muted,marginTop:3}}>{Number(entry.progress||0).toFixed(0)}% físico</p></div>)}</div>{warning&&<p style={{fontSize:9.5,color:C.orange,marginTop:8}}>{line.reversed.length?"Sequência invertida entre frentes: revise as datas antes de mobilizar a equipe.":"Cadência irregular entre frentes: confira a continuidade da equipe."}</p>}</div>;})}</div></div>
            )}

            {/* --- FISICO-FINANCEIRO --- */}
            {aba === "ff" && (() => {
              const ffM = ffModo === "realizado" ? ffMensalReal : ffMensalPrev;
              const mesesVisiveis = ffM.meses.filter(m => !ffMesesOcultos.includes(m));
              const fmtMesCol = m => { const [y,mm] = m.split("-"); return `${monthName(Number(mm)-1)} ${y}`; };
              return (
                <div>
                  {/* Cabecalho: modo previsto/realizado + seletor de colunas */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:12 }}>
                    <div style={{ display:"flex", gap:4, background:C.surface, borderRadius:8, padding:3 }}>
                      {[["previsto","Previsto"],["realizado","Realizado"]].map(([v,l]) => (
                        <button key={v} onClick={()=>setFfModo(v)} style={{
                          border:0, borderRadius:6, padding:"6px 14px", cursor:"pointer", fontSize:11.5, fontWeight:700,
                          background: ffModo===v ? C.card : "transparent", color: ffModo===v ? C.text : C.muted,
                          boxShadow: ffModo===v ? `0 1px 3px ${C.shadow}` : "none" }}>{l}</button>
                      ))}
                    </div>
                    {ffM.meses.length > 0 && (
                      <details style={{ position:"relative" }}>
                        <summary style={{ listStyle:"none", cursor:"pointer", fontSize:11, fontWeight:700, color:C.blue,
                          border:`1px solid ${C.border}`, borderRadius:6, padding:"6px 11px", userSelect:"none" }}>
                          Colunas ({mesesVisiveis.length}/{ffM.meses.length})
                        </summary>
                        <div style={{ position:"absolute", right:0, top:"110%", zIndex:20, background:C.card,
                          border:`1px solid ${C.border}`, borderRadius:8, boxShadow:`0 8px 24px ${C.shadow}`,
                          padding:8, minWidth:170, maxHeight:260, overflowY:"auto" }}>
                          {ffM.meses.map(m => {
                            const oculta = ffMesesOcultos.includes(m);
                            return (
                              <label key={m} style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 6px",
                                cursor:"pointer", fontSize:11.5, color:C.text }}>
                                <input type="checkbox" checked={!oculta}
                                  onChange={()=>setFfMesesOcultos(prev => oculta ? prev.filter(x=>x!==m) : [...prev, m])} />
                                {fmtMesCol(m)}
                              </label>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </div>

                  <p style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                    {ffModo === "previsto"
                      ? "Custo previsto de cada etapa distribuido pelos meses (rateio por dias uteis do planejamento). Cada celula: valor e % da etapa naquele mes."
                      : "Custo realizado por etapa (lancado; na ausencia, estimado pelo avanco fisico), distribuido pelos meses."}
                  </p>

                  {ffM.linhas.length === 0 ? (
                    <p style={{ fontSize: 12, color: C.muted }}>Defina datas e custos nas tarefas para ver o fisico-financeiro mensal.</p>
                  ) : (
                    <div style={{ overflowX: "auto", border:`1px solid ${C.border}`, borderRadius:8 }}>
                      <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: 520, width:"100%" }}>
                        <thead>
                          <tr style={{ background:C.surface }}>
                            <th style={{ textAlign:"left", padding:"8px 10px", position:"sticky", left:0, background:C.surface, zIndex:2, minWidth:170, color:C.muted, fontSize:9.5, fontWeight:800, textTransform:"uppercase", borderBottom:`1px solid ${C.border}` }}>Item</th>
                            <th style={{ textAlign:"right", padding:"8px 10px", color:C.muted, fontSize:9.5, fontWeight:800, textTransform:"uppercase", borderBottom:`1px solid ${C.border}`, borderLeft:`1px solid ${C.line}`, minWidth:90 }}>Total</th>
                            {mesesVisiveis.map(m => (
                              <th key={m} style={{ textAlign:"right", padding:"8px 10px", color:C.muted, fontSize:9.5, fontWeight:800, textTransform:"uppercase", borderBottom:`1px solid ${C.border}`, borderLeft:`1px solid ${C.line}`, minWidth:92, whiteSpace:"nowrap" }}>{fmtMesCol(m)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ffM.linhas.map((l, i) => (
                            <tr key={l.id} style={{ borderBottom:`1px solid ${C.line}`, background: i%2 ? "transparent" : `${C.surface}55` }}>
                              <td className="brk" style={{ padding:"7px 10px", position:"sticky", left:0, zIndex:1, background: i%2 ? C.card : C.surface, fontWeight:700, color:C.text, minWidth:170 }}>{l.nome}</td>
                              <td style={{ padding:"7px 10px", textAlign:"right", borderLeft:`1px solid ${C.line}` }}>
                                <div style={{ fontWeight:800, color:C.text }}>{fmtCompact(l.total)}</div>
                                <div style={{ fontSize:9, color:C.muted }}>100%</div>
                              </td>
                              {mesesVisiveis.map(m => {
                                const v = l.porMes[m] || 0;
                                const pct = l.total ? (v/l.total*100) : 0;
                                return (
                                  <td key={m} style={{ padding:"7px 10px", textAlign:"right", borderLeft:`1px solid ${C.line}` }}>
                                    {v > 0 ? (
                                      <>
                                        <div style={{ fontWeight:700, color:C.text }}>{fmtCompact(v)}</div>
                                        <div style={{ fontSize:9, color: pct>=50?C.yellowD:C.muted }}>{pct.toFixed(1).replace(".",",")}%</div>
                                      </>
                                    ) : <span style={{ color:C.line }}>—</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background:C.surface, borderTop:`2px solid ${C.border}` }}>
                            <td style={{ padding:"9px 10px", position:"sticky", left:0, background:C.surface, zIndex:1, fontWeight:800, color:C.text }}>Total do periodo</td>
                            <td style={{ padding:"9px 10px", textAlign:"right", borderLeft:`1px solid ${C.line}` }}>
                              <div style={{ fontWeight:800, color:C.blue }}>{fmtCompact(ffM.totalGeral)}</div>
                              <div style={{ fontSize:9, color:C.muted }}>100%</div>
                            </td>
                            {mesesVisiveis.map(m => {
                              const v = ffM.totalPorMes[m] || 0;
                              const pct = ffM.totalGeral ? (v/ffM.totalGeral*100) : 0;
                              return (
                                <td key={m} style={{ padding:"9px 10px", textAlign:"right", borderLeft:`1px solid ${C.line}` }}>
                                  <div style={{ fontWeight:800, color:C.blue }}>{fmtCompact(v)}</div>
                                  <div style={{ fontSize:9, color:C.muted }}>{pct.toFixed(2).replace(".",",")}%</div>
                                </td>
                              );
                            })}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {/* Resumo de indicadores de desempenho (mantido do FF anterior) */}
                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <MiniFF label="Previsto total" v={fmt(ff.total.previsto)} c={C.text} />
                    <MiniFF label="Valor agregado" v={fmt(ff.total.valorAgregado)} c={C.blue} />
                    <MiniFF label="Realizado" v={fmt(ff.total.realizado)} c={C.purple} />
                    <MiniFF label="Previsao final" v={fmt(ff.total.previsaoFinal)}
                            c={ff.total.previsaoFinal > ff.total.previsto ? C.red : C.green} />
                  </div>
                </div>
              );
            })()}

            {/* --- PLANEJADO x REALIZADO (linha de base) --- */}
            {aba === "base" && (
              <div>
                {/* ── AUTOMÁTICO: medição x reta do cronograma ─────────────
                    Não depende de digitar datas reais nem de linha de base:
                    o desvio nasce do progresso medido (medição/diário). */}
                <div style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: 12, fontWeight: 900, color: C.text, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>
                    Desvio automático · medição x cronograma
                  </p>
                  <p style={{ fontSize: 10.5, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                    Para cada etapa, o sistema calcula em que dia o cronograma previa chegar ao avanço que a medição registrou.
                    A distância desse dia até hoje é o desvio: <b style={{ color: C.red }}>+</b> dias atrasada, <b style={{ color: C.blue }}>−</b> dias adiantada.
                  </p>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    <MiniFF label="Desvio da obra" v={`${autoCmp.resumo.desvioObra > 0 ? "+" : ""}${autoCmp.resumo.desvioObra}d`}
                            c={autoCmp.resumo.desvioObra > 0 ? C.red : autoCmp.resumo.desvioObra < 0 ? C.blue : C.green} />
                    <MiniFF label="Atrasadas" v={String(autoCmp.resumo.atrasadas)} c={autoCmp.resumo.atrasadas ? C.red : C.muted} />
                    <MiniFF label="Adiantadas" v={String(autoCmp.resumo.adiantadas)} c={autoCmp.resumo.adiantadas ? C.blue : C.muted} />
                    <MiniFF label="No prazo" v={String(autoCmp.resumo.noPrazo)} c={C.green} />
                    <MiniFF label="Concluídas" v={String(autoCmp.resumo.concluidas)} c={C.green} />
                    <MiniFF label="Futuras" v={String(autoCmp.resumo.futuras)} c={C.muted} />
                    <MiniFF label="Pior atraso" v={`${autoCmp.resumo.piorAtraso}d`} c={autoCmp.resumo.piorAtraso > 0 ? C.red : C.green} />
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          <th style={{ textAlign: "left", padding: "6px 8px", color: C.muted, fontSize: 10 }}>Etapa / tarefa</th>
                          <th style={{ textAlign: "center", padding: "6px 8px", color: C.muted, fontSize: 10 }}>Período planejado</th>
                          <th style={{ textAlign: "center", padding: "6px 8px", color: C.muted, fontSize: 10 }}>Medido x previsto hoje</th>
                          <th style={{ textAlign: "right", padding: "6px 8px", color: C.muted, fontSize: 10 }}>Desvio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {autoCmp.linhas.map(l => {
                          const corDesv = l.situacao === "atrasada" ? C.red
                            : l.situacao === "adiantada" ? C.blue
                            : l.situacao === "futura" || l.situacao === "sem-datas" ? C.muted : C.green;
                          const rotulo = l.situacao === "sem-datas" ? "sem datas"
                            : l.situacao === "futura" ? "futura"
                            : l.concluida && !l.desvio ? "concluída"
                            : l.desvio > 0 ? `+${l.desvio}d`
                            : l.desvio < 0 ? `${l.desvio}d`
                            : "no prazo";
                          return (
                            <tr key={l.id} style={{ borderBottom: `1px solid ${C.line}`, background: l.titulo ? C.surface : "transparent" }}>
                              <td className="brk" style={{ padding: "7px 8px", color: C.text, maxWidth: 160, fontWeight: l.titulo ? 900 : 500 }}>
                                {l.nome}
                                {l.concluida && <span style={{ fontSize: 8.5, fontWeight: 900, color: C.green, marginLeft: 5 }}>100%</span>}
                                {critico.criticas.includes(l.id) && <span style={{ fontSize: 8.5, fontWeight: 900, color: C.red, marginLeft: 5 }}>CRÍTICA</span>}
                              </td>
                              <td style={{ padding: "7px 8px", textAlign: "center", color: C.muted, fontSize: 10.5 }}>
                                {l.inicio ? `${fmtDate(l.inicio)} → ${fmtDate(l.fim)}` : "—"}
                              </td>
                              <td style={{ padding: "7px 8px", textAlign: "center", fontSize: 10.5 }}>
                                {l.pctPrevisto == null ? <span style={{ color: C.muted }}>—</span> : (
                                  <>
                                    <b style={{ color: l.pctMedido + 0.5 < l.pctPrevisto ? C.red : C.text }}>{Math.round(l.pctMedido)}%</b>
                                    <span style={{ color: C.muted }}> de {Math.round(l.pctPrevisto)}%</span>
                                    {l.origemProgresso === "diario" && <small style={{ display: "block", fontSize: 8, color: C.muted }}>medição de {fmtDate(l.ultimaMedicao)}</small>}
                                  </>
                                )}
                              </td>
                              <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 800, color: corDesv }}>{rotulo}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: 10, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>
                    Desvios em dias corridos. O desvio da obra é a média ponderada pelo custo de cada etapa — uma etapa cara atrasada pesa mais que várias baratas adiantadas.
                    Etapa sem medição depois do início conta cada dia como atraso.
                  </p>
                </div>

                <Divider />
                <p style={{ fontSize: 12, fontWeight: 900, color: C.text, textTransform: "uppercase", letterSpacing: .5, margin: "12px 0 8px" }}>
                  Contra a linha de base (replanejamento)
                </p>
                {!compBase.temBaseline ? (
                  <div style={{ textAlign: "center", padding: "18px 12px" }}>
                    <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>
                      Ainda não há linha de base. A linha de base congela o cronograma
                      aprovado; depois, conforme as datas e custos mudam, você vê o
                      desvio contra o plano original — atrasos, adiantamentos e estouro
                      de custo.
                    </p>
                    <Btn onClick={salvarBaseline}>Salvar linha de base agora</Btn>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      <p style={{ fontSize: 11, color: C.muted }}>
                        Linha de base de <b>{fmtDate(plano.baselineData)}</b> · {compBase.linhas.length} tarefa(s)
                      </p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Btn size="sm" v="ghost" onClick={salvarBaseline}>Refazer</Btn>
                        <Btn size="sm" v="ghost" onClick={limparBaseline}>Remover</Btn>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      <MiniFF label="No prazo" v={String(compBase.resumo.noPrazo)} c={C.green} />
                      <MiniFF label="Atrasadas" v={String(compBase.resumo.atrasadas)} c={compBase.resumo.atrasadas ? C.red : C.muted} />
                      <MiniFF label="Adiantadas" v={String(compBase.resumo.adiantadas)} c={C.blue} />
                      <MiniFF label="Sem realizado" v={String(compBase.resumo.semRealizado)} c={C.muted} />
                      <MiniFF label="Pior atraso" v={`${compBase.resumo.piorAtraso}d`} c={compBase.resumo.piorAtraso > 0 ? C.red : C.green} />
                      <MiniFF label="Desvio de custo"
                              v={`${compBase.resumo.desvioCustoTotal >= 0 ? "+" : ""}${fmt(compBase.resumo.desvioCustoTotal)}`}
                              c={compBase.resumo.desvioCustoTotal > 0 ? C.red : C.green} />
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                            <th style={{ textAlign: "left", padding: "6px 8px", color: C.muted, fontSize: 10 }}>Tarefa</th>
                            <th style={{ textAlign: "center", padding: "6px 8px", color: C.muted, fontSize: 10 }}>Início base → realizado/atual</th>
                            <th style={{ textAlign: "center", padding: "6px 8px", color: C.muted, fontSize: 10 }}>Fim base → realizado/atual</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", color: C.muted, fontSize: 10 }}>Desvio</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", color: C.muted, fontSize: 10 }}>Custo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compBase.linhas.map(l => {
                            const corDesv = l.situacao === "atrasada" ? C.red
                              : l.situacao === "adiantada" ? C.blue
                              : l.situacao === "sem-realizado" ? C.muted : C.green;
                            return (
                              <tr key={l.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                                <td className="brk" style={{ padding: "7px 8px", color: C.text, maxWidth: 150 }}>
                                  {l.nome}
                                  {critico.criticas.includes(l.id) && <span style={{ fontSize: 8.5, fontWeight: 900, color: C.red, marginLeft: 5 }}>CRÍTICA</span>}
                                </td>
                                <td style={{ padding: "7px 8px", textAlign: "center", color: C.muted, fontSize: 10.5 }}>
                                  {fmtDate(l.baseIni)} → {l.comparadoIni ? fmtDate(l.comparadoIni) : "—"}
                                  {l.fonteIni && <small style={{display:"block",fontSize:8,color:C.muted}}>{l.fonteIni}</small>}
                                </td>
                                <td style={{ padding: "7px 8px", textAlign: "center", color: C.muted, fontSize: 10.5 }}>
                                  {fmtDate(l.baseFim)} → {l.comparadoFim ? fmtDate(l.comparadoFim) : "—"}
                                  {l.fonteFim && <small style={{display:"block",fontSize:8,color:C.muted}}>{l.fonteFim}</small>}
                                </td>
                                <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 800, color: corDesv }}>
                                  {l.situacao === "sem-realizado" ? "sem realizado"
                                    : l.desvFim > 0 ? `+${l.desvFim}d`
                                    : l.desvFim < 0 ? `${l.desvFim}d` : "no prazo"}
                                </td>
                                <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700,
                                             color: l.desvCusto > 0 ? C.red : l.desvCusto < 0 ? C.green : C.muted }}>
                                  {l.desvCusto === 0 ? "—" : `${l.desvCusto > 0 ? "+" : ""}${fmt(l.desvCusto)}`}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: 10, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>
                      Datas reais prevalecem. Na ausência delas, a comparação usa a programação atual como previsão.
                      O término define o desvio; quando o término não mudou, compara-se o início. <b style={{ color: C.red }}>+</b> atrasou, <b style={{ color: C.blue }}>−</b> adiantou.
                      O custo compara o custo real lançado (ou o previsto, se não houver real) com o custo da linha de base.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {(plano.marcos || []).length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ fontSize: 12, fontWeight: 900, color: C.text, textTransform: "uppercase",
                      letterSpacing: .5, marginBottom: 9 }}>Marcos da obra</p>
          {[...(plano.marcos || [])].sort((a, b) => (a.data || "").localeCompare(b.data || "")).map(m => {
            const tp = TIPO_MARCO[m.tipo] || TIPO_MARCO.geral;
            return (
              <div key={m.id} onClick={() => setMarcoModal({ modo: "editar", marco: m })}
                   style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                            borderTop: `1px solid ${C.line}`, cursor: "pointer" }}>
                <div style={{ width: 11, height: 11, background: tp.c, transform: "rotate(45deg)",
                              flexShrink: 0, opacity: m.feito ? .4 : 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="brk" style={{ fontSize: 12.5, fontWeight: 700,
                             color: m.feito ? C.muted : C.text,
                             textDecoration: m.feito ? "line-through" : "none" }}>{m.nome}</p>
                  <p style={{ fontSize: 10, color: C.muted }}>{tp.l} - {fmtDate(m.data)}</p>
                </div>
                {m.feito && <Badge color={C.green}>Feito</Badge>}
              </div>
            );
          })}
        </div>
      )}

      {/* ==== MODAIS ==== */}
      {tarefaModal?.modo === "addEtapa" && (
        <Modal title="Adicionar etapa ao cronograma" onClose={() => setTarefaModal(null)}>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
            Estas etapas do orcamento ainda nao estao no cronograma. Ao adicionar,
            a tarefa ja vem com o custo da etapa.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {etapasLivres.map(e => (
              <button key={e.id} onClick={() => { adicionarEtapa(e.id); setTarefaModal(null); }}
                      className="lift-card" style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "11px 12px", border: `1px solid ${C.border}`, borderRadius: 6,
                        background: C.surface, cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{e.nome}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: C.yellowD }}>{fmt(custoEtapa(orc, e.id))}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {(tarefaModal?.modo === "editar") && (
        <ModalTarefa
          tarefa={tarefaModal.tarefa}
          cal={cal}
          tarefas={tarefas}
          onSalvar={(t) => { salvarTarefaEVinculos(t); setTarefaModal(null); }}
          onRemover={() => { removerTarefa(tarefaModal.tarefa.id); setTarefaModal(null); }}
          onClose={() => setTarefaModal(null)}
        />
      )}

      {marcoModal && (
        <ModalMarco
          marco={marcoModal.marco}
          onSalvar={(m) => { upsertMarco(m); setMarcoModal(null); }}
          onRemover={marcoModal.modo === "editar" ? () => { removerMarco(marcoModal.marco.id); setMarcoModal(null); } : null}
          onClose={() => setMarcoModal(null)}
        />
      )}

      {exportA2Modal && (
        <Modal title="Exportar cronograma em A2" onClose={()=>setExportA2Modal(false)} wide>
          <p style={{fontSize:12,color:C.muted,lineHeight:1.55,marginBottom:12}}>
            Escolha quais colunas devem aparecer. A exportacao abre a impressao do navegador em <b>A2 paisagem</b>, ajustada para uma ou duas folhas. Selecione “Salvar como PDF” no destino da impressora.
          </p>
          <div style={{display:"grid",gridTemplateColumns:cols(1,2,2),gap:12}}>
            <div style={{border:`1px solid ${C.border}`,borderRadius:7,padding:11}}>
              <p style={{fontSize:10,fontWeight:900,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Colunas da exportacao</p>
              {COLS_CRONO_DEF.map(c=><label key={c.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",fontSize:12,color:C.text,cursor:c.fixa?"default":"pointer"}}>
                <input type="checkbox" checked={c.fixa?true:!!exportA2Cols[c.id]} disabled={c.fixa}
                  onChange={()=>!c.fixa&&setExportA2Cols(v=>({...v,[c.id]:!v[c.id]}))}
                  style={{width:15,height:15,accentColor:C.yellowD}}/>{c.label}{c.fixa&&<span style={{fontSize:9,color:C.muted}}>(obrigatoria)</span>}
              </label>)}
            </div>
            <div style={{border:`1px solid ${C.border}`,borderRadius:7,padding:11}}>
              <p style={{fontSize:10,fontWeight:900,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Quantidade de folhas</p>
              {[1,2].map(n=><label key={n} style={{display:"flex",gap:9,alignItems:"flex-start",padding:"7px 0",cursor:"pointer",fontSize:12,color:C.text}}>
                <input type="radio" name="folhasA2" checked={exportA2Folhas===n} onChange={()=>setExportA2Folhas(n)} style={{marginTop:2,accentColor:C.yellowD}}/>
                <span><b>{n} folha{n>1?"s":""} A2 em paisagem</b><small style={{display:"block",color:C.muted,marginTop:2,lineHeight:1.4}}>{n===1?"Todo o periodo comprimido em uma folha.":"O periodo e dividido ao meio, com melhor legibilidade."}</small></span>
              </label>)}
              <div style={{marginTop:12,padding:9,background:C.surface,borderRadius:6,fontSize:10.5,color:C.muted,lineHeight:1.45}}>
                Periodo: <b style={{color:C.text}}>{fmtDate(GANTT_INI)} a {fmtDate(somaDias(GANTT_INI,totalDias-1))}</b><br/>Atividades: <b style={{color:C.text}}>{tarefas.length}</b>
              </div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:7,marginTop:14}}>
            <Btn v="ghost" onClick={()=>setExportA2Modal(false)}>Cancelar</Btn>
            <Btn onClick={exportarCronogramaA2}><Ic n="download"/> Gerar A2</Btn>
          </div>
        </Modal>
      )}

      {calModal && (
        <ModalCalendario
          cal={cal}
          onSalvar={(c) => { salvarCalendario(c); setCalModal(false); }}
          onClose={() => setCalModal(false)}
        />
      )}

      {vincPreview && (
        <Modal title="Vinculos propostos pela IA" onClose={()=>setVincPreview(null)} wide>
          <p style={{fontSize:11.5,color:C.muted,lineHeight:1.5,marginBottom:10}}>
            A ordem do orcamento nao sera alterada. A sucessora e calculada a partir das antecessoras para manter um unico vinculo consistente.
          </p>
          <div style={{border:`1px solid ${C.border}`,borderRadius:6,overflow:"hidden",maxHeight:420,overflowY:"auto"}}>
            {vincPreview.linhas.map((l,i)=><div key={l.id} style={{padding:"8px 10px",borderBottom:i<vincPreview.linhas.length-1?`1px solid ${C.line}`:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                <p style={{fontSize:11.5,fontWeight:800,color:C.text}}>{i+1}. {l.nome}</p>
                <span style={{fontSize:9.5,color:l.alterada?C.orange:C.muted,whiteSpace:"nowrap"}}>
                  {fmtDate(l.inicio)} - {fmtDate(l.fim)}{l.alterada?" · data ajustada":""}
                </span>
              </div>
              <p style={{fontSize:10,color:C.muted,marginTop:2}}>
                Antecessora(s): <b style={{color:C.blue}}>{l.antecessoras.join(", ")||"nenhuma"}</b>
              </p>
              <p style={{fontSize:10,color:C.muted}}>
                Sucessora(s): <b style={{color:C.green}}>{l.sucessoras.join(", ")||"nenhuma"}</b>
              </p>
            </div>)}
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <Btn v="ghost" onClick={()=>setVincPreview(null)} full>Cancelar</Btn>
            <Btn onClick={aplicarVinculosIA} full><Ic n="check"/> Aplicar vinculos</Btn>
          </div>
        </Modal>
      )}

      {iaModal && (
        <Modal title="Orientacao tecnica (IA)" onClose={() => setIaModal(null)} wide>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 12.5, lineHeight: 1.6, color: C.text }}>
            {iaModal.texto}
          </div>
        </Modal>
      )}

      {/* QUESTIONARIO DE PLANEJAMENTO: a IA pergunta e preenche o cronograma */}
      {questModal && (
        <QuestionarioPlanejamento
          orc={orc}
          plano={plano}
          onGerar={gerarCronogramaDoQuestionario}
          onClose={() => setQuestModal(false)}
        />
      )}

      {/* PREVIA do cronograma proposto: operador aprova ou descarta */}
      {questPreview && (
        <Modal title="Cronograma proposto pela IA" onClose={() => setQuestPreview(null)} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: cols(2,3,3), gap: 8 }}>
              <MiniKpi label="Inicio" value={fmtDate(questPreview.resumo.inicio)} cor={C.blue} />
              <MiniKpi label="Fim previsto" value={fmtDate(questPreview.resumo.fim)} cor={C.yellow} />
              <MiniKpi label="Duracao"
                       value={`${questPreview.resumo.diasCorridos + 1} corridos / ${questPreview.resumo.diasUteisProjeto} trabalho`}
                       cor={questPreview.resumo.dentroDoPrazo ? C.green : C.red}
                       sub={questPreview.resumo.dentroDoPrazo ? "dentro do prazo" : "acima do prazo desejado"} />
            </div>
            <p style={{fontSize:10.5,color:C.muted}}>
              Prazo limite: <b>{fmtDate(questPreview.resumo.fimAlvo)}</b> - calendario: {questPreview.diasSemana.length} dia(s)/semana,
              {questPreview.calendario?.pularFeriados
                ? ` com ${questPreview.resumo.feriadosConsiderados} feriado(s) dentro do prazo`
                : " sem retirar feriados"}.
            </p>

            {questPreview.avisos.length > 0 && (
              <div style={{ background: `${C.orange}0E`, border: `1px solid ${C.orange}55`,
                            borderRadius: 6, padding: "10px 12px" }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: C.orange, marginBottom: 5 }}>
                  Observacoes de boa pratica
                </p>
                {questPreview.avisos.map((a, i) => (
                  <p key={i} style={{ fontSize: 10.5, color: C.subtle, lineHeight: 1.5, marginBottom: 3 }}>- {a}</p>
                ))}
              </div>
            )}

            {/* Lista das tarefas propostas, na ordem imutavel do orcamento */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
              {questPreview.tarefas.map((t, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8,
                     padding: "8px 11px", borderBottom: i < questPreview.tarefas.length-1 ? `1px solid ${C.line}` : "none" }}>
                  <span style={{ fontSize: 11.5, color: C.text, minWidth: 0 }}>
                    <b style={{ color: C.muted }}>{i+1}.</b> {t.nome}
                  </span>
                  <span style={{ fontSize: 10.5, color: C.muted, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {fmtDate(t.inicio)} - {fmtDate(t.fim)}
                  </span>
                </div>
              ))}
            </div>

            {questIA && (
              <div style={{ background: `${C.blue}08`, border: `1px solid ${C.blue}44`, borderRadius: 6, padding: "10px 12px" }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: C.blue, marginBottom: 5 }}>Parecer da IA</p>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 11.5, lineHeight: 1.55, color: C.text }}>{questIA}</div>
              </div>
            )}

            <p style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>
              A ordem e os dados permanecem iguais aos do orcamento. Ao aplicar, entram no Gantt as datas,
              duracoes e dependencias tecnicas; tudo continua ajustavel pelo operador.
            </p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn v="ghost" onClick={() => setQuestPreview(null)}>Descartar</Btn>
              {!questIA && <Btn v="ghost" onClick={comentarCronogramaIA}><Ic n="brain" s={13}/> Pedir parecer</Btn>}
              <Btn onClick={aplicarCronogramaProposto} style={{ marginLeft: "auto" }}>
                <Ic n="check"/> Aplicar ao cronograma
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Questionario de planejamento: perguntas com boas praticas embutidas. Coleta
// inicio, prazo, dias/semana, ritmo e paralelismo, e devolve as respostas.
function QuestionarioPlanejamento({ orc, plano, onGerar, onClose }) {
  const nEtapas = (orc?.etapas || []).length;
  const [resp, setResp] = useState({
    inicio: plano?.inicio || today(), prazoMeses: "",
    diasSemana: String((plano?.diasSemana||[]).length === 5 ? 5 : 6),
    ritmo: "normal", paralelo: "sim",
    usarFeriados: "",
  });
  const set = (k) => (v) => setResp(r => ({ ...r, [k]: v }));

  const podeGerar = nEtapas > 0 && Number(resp.prazoMeses) > 0 && !!resp.usarFeriados;

  return (
    <Modal title="Planejar obra com IA" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <p style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.55 }}>
          Responda algumas perguntas. O planejamento preserva exatamente a ordem do orcamento
          e distribui apenas datas e duracoes conforme o calendario de trabalho, as boas praticas
          e o prazo limite informado.
        </p>

        {nEtapas === 0 ? (
          <div style={{ background: `${C.orange}0E`, border: `1px solid ${C.orange}55`, borderRadius: 6, padding: "11px 13px" }}>
            <p style={{ fontSize: 12, color: C.orange, fontWeight: 700, lineHeight: 1.5 }}>
              Esta obra ainda nao tem etapas no orcamento. Crie o orcamento com etapas antes de planejar.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 11, color: C.subtle }}>
              {nEtapas} etapa(s) do orcamento serao organizadas no cronograma.
            </p>

            <Inp label="Quando a obra comeca?" type="date" value={resp.inicio} onChange={set("inicio")} />

            <Inp label="Prazo desejado (meses) *" type="number" value={resp.prazoMeses}
                 onChange={set("prazoMeses")} placeholder="Ex.: 8" />

            <Sel label="Dias trabalhados na semana" value={resp.diasSemana} onChange={set("diasSemana")}
                 options={[{ v:"6", l:"Segunda a sabado" }, { v:"5", l:"Segunda a sexta" }]} />

            <Sel label="Utilizar os feriados ja cadastrados no aplicativo? *"
                 value={resp.usarFeriados} onChange={set("usarFeriados")}
                 options={[{v:"",l:"Selecione..."},{v:"sim",l:"Sim, retirar dos dias de trabalho"},{v:"nao",l:"Nao, considerar dias normais"}]} />

            <Sel label="Ritmo da equipe" value={resp.ritmo} onChange={set("ritmo")}
                 options={[
                   { v:"folgado",  l:"Folgado (margem de seguranca)" },
                   { v:"normal",   l:"Normal" },
                   { v:"apertado", l:"Apertado (equipe reforcada)" },
                 ]} />

            <Sel label="Sobrepor servicos compativeis para ganhar tempo?" value={resp.paralelo} onChange={set("paralelo")}
                 options={[{ v:"sim", l:"Sim, quando fizer sentido" }, { v:"nao", l:"Nao, um de cada vez" }]} />

            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="ghost" onClick={onClose} full>Cancelar</Btn>
              <Btn onClick={() => onGerar(resp)} disabled={!podeGerar} full>
                <Ic n="brain" s={13}/> Gerar cronograma
              </Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// Mini card de KPI para o topo do planejamento.
// Grafico da curva S: planejado x realizado acumulado, barras mensais discretas
// ao fundo e ponto interativo. Mais informacao, menos poluicao visual.
function CurvaSGrafico({ dados, real }) {
  const [hover, setHover] = useState(null);
  const W = 760, H = 196, padL = 40, padR = 16, padT = 14, padB = 36;
  const n = dados.length;
  if (!n) return null;
  const iw = W - padL - padR, ih = H - padT - padB;
  const px = (i) => padL + (n === 1 ? iw/2 : (i/(n-1))*iw);
  const py = (pct) => padT + ih - (pct/100)*ih;

  // Realizado acumulado: os fatos existentes ainda são mensais. Em uma curva
  // semanal eles entram somente no último ponto da competência, sem repetir o
  // mesmo valor em todas as semanas e sem inventar distribuição diária.
  const realPorMes = {};
  if (real) real.meses.forEach(m => { realPorMes[m] = real.totalPorMes[m] || 0; });
  const realTotal = real ? real.totalGeral : 0;
  let accR = 0;
  const serieReal = dados.map((d, i) => {
    const mes = d.mes.slice(0,7);
    const proximoMes = dados[i+1]?.mes?.slice(0,7);
    if (mes !== proximoMes) accR += (realPorMes[mes] || 0);
    return realTotal ? (accR/realTotal)*100 : 0;
  });
  const temReal = realTotal > 0;

  const linhaPrev = dados.map((d,i)=>`${px(i)},${py(d.pctAcum)}`).join(" ");
  const linhaReal = serieReal.map((v,i)=>`${px(i)},${py(v)}`).join(" ");
  const maxMes = Math.max(...dados.map(d=>d.pctMes), 1);
  const bw = Math.max(3, Math.min(22, iw/n*0.5));

  return (
    <div style={{ overflowX:"auto", position:"relative" }}>
      {/* legenda */}
      <div style={{ display:"flex", gap:16, marginBottom:8, fontSize:11, flexWrap:"wrap" }}>
        <span style={{ display:"flex", alignItems:"center", gap:5, color:C.muted }}>
          <span style={{ width:14, height:3, background:C.yellow, borderRadius:2 }}/>Planejado
        </span>
        {temReal && <span style={{ display:"flex", alignItems:"center", gap:5, color:C.muted }}>
          <span style={{ width:14, height:3, background:C.blue, borderRadius:2 }}/>Realizado
        </span>}
        <span style={{color:C.muted}}>Pontos semanais · valores por dia útil</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", minWidth:420, height:"auto" }}
           onMouseLeave={()=>setHover(null)}>
        {/* grade + eixo Y */}
        {[0,25,50,75,100].map(g => (
          <g key={g}>
            <line x1={padL} y1={py(g)} x2={W-padR} y2={py(g)} stroke={C.line} strokeWidth="1" strokeDasharray={g===0?"":"3 3"}/>
            <text x={padL-6} y={py(g)+3} textAnchor="end" fontSize="9" fill={C.muted}>{g}%</text>
          </g>
        ))}
        {/* Peso semanal discreto: referência de distribuição, sem competir com a curva. */}
        {dados.map((d,i) => {
          const bh = (d.pctMes/maxMes) * (ih*0.22);
          return <rect key={i} x={px(i)-bw/2} y={padT+ih-bh} width={bw} height={bh}
                       fill={C.muted} opacity="0.16" rx="2"/>;
        })}
        {/* linha planejado */}
        <polyline points={linhaPrev} fill="none" stroke={C.yellowD} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"/>
        {/* linha realizado */}
        {temReal && <polyline points={linhaReal} fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 0"/>}
        {/* pontos + interacao */}
        {dados.map((d,i) => (
          <g key={i}>
            {temReal && <circle cx={px(i)} cy={py(serieReal[i])} r="3" fill={C.blue}/>}
            <circle cx={px(i)} cy={py(d.pctAcum)} r="3.5" fill={C.yellowD}/>
            <rect x={px(i)-(iw/n)/2} y={padT} width={iw/n} height={ih} fill="transparent"
                  onMouseEnter={()=>setHover(i)} style={{ cursor:"pointer" }}/>
            {i % Math.ceil(n/7 || 1) === 0 && (
              <text x={px(i)} y={H-padB+16} textAnchor="middle" fontSize="8.5" fill={C.muted}>{d.periodo==="semana"?fmtDate(d.mes):fmtMesAno(d.mes+"-01")}</text>
            )}
          </g>
        ))}
        {/* linha-guia do hover */}
        {hover!==null && (
          <line x1={px(hover)} y1={padT} x2={px(hover)} y2={padT+ih} stroke={C.muted} strokeWidth="1" strokeDasharray="3 3"/>
        )}
      </svg>
      {/* tooltip */}
      {hover!==null && (
        <div style={{ marginTop:8, padding:"8px 12px", background:C.surface, borderRadius:8,
                      border:`1px solid ${C.border}`, fontSize:11.5, display:"flex", gap:16, flexWrap:"wrap" }}>
          <b style={{ color:C.text }}>{dados[hover].periodo==="semana"?`Semana de ${fmtDate(dados[hover].mes)}`:fmtMesAno(dados[hover].mes+"-01")}</b>
          <span style={{ color:C.muted }}>Planejado acum.: <b style={{ color:C.yellowD }}>{dados[hover].pctAcum.toFixed(1)}%</b></span>
          {temReal && <span style={{ color:C.muted }}>Realizado acum.: <b style={{ color:C.blue }}>{serieReal[hover].toFixed(1)}%</b></span>}
          <span style={{ color:C.muted }}>No período: <b style={{ color:C.text }}>{fmt(dados[hover].valor)}</b></span>
        </div>
      )}
    </div>
  );
}

// Mini-cartao para os totais do fisico-financeiro.
function MiniFF({ label, v, c }) {
  return (
    <div style={{ flex: 1, minWidth: 100, background: C.surface, borderRadius: 6, padding: "8px 10px" }}>
      <p style={{ fontSize: 9, fontWeight: 900, color: C.muted, textTransform: "uppercase", letterSpacing: .5 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 800, color: c, marginTop: 2 }}>{v}</p>
    </div>
  );
}
// Editor de tarefa: datas, progresso, ou apagar.
function ModalTarefa({ tarefa, cal, tarefas, onSalvar, onRemover, onClose }) {
  const [ini, setIni] = useState(tarefa.inicio || "");
  const [fim, setFim] = useState(tarefa.fim || "");
  const [iniReal, setIniReal] = useState(tarefa.inicioReal || "");
  const [fimReal, setFimReal] = useState(tarefa.fimReal || "");
  const [custoReal, setCustoReal] = useState(String(tarefa.custoReal || ""));
  const [linhaBalancoGrupo, setLinhaBalancoGrupo] = useState(tarefa.linhaBalancoGrupo || "");
  const [linhaBalancoFrente, setLinhaBalancoFrente] = useState(String(tarefa.linhaBalancoFrente ?? ""));
  const [preds, setPreds] = useState([...(tarefa.depende || [])]);
  const [sucs, setSucs] = useState(idsSucessoras(tarefas, tarefa.id));
  const indice = (tarefas || []).findIndex(t => t.id === tarefa.id);
  const candidatasPred = (tarefas || []).filter((t,i) => i < indice && !t.titulo);
  const candidatasSuc = (tarefas || []).filter((t,i) => i > indice && !t.titulo);
  const alternar = (setter, id) => setter(lista =>
    lista.includes(id) ? lista.filter(x=>x!==id) : [...lista,id]);

  const salvar = () => {
    // Nao salva datas invertidas.
    if (ini && fim && fim < ini) return;
    const inicioFinal = ini ? ajustarParaDiaUtil(ini, cal, 1) : ini;
    const fimFinal = fim ? ajustarParaDiaUtil(fim, cal, -1) : fim;
    if (inicioFinal && fimFinal && fimFinal < inicioFinal) return;
    onSalvar({ id: tarefa.id, inicio: inicioFinal, fim: fimFinal,
               inicioReal: iniReal || "", fimReal: fimReal || "",
               custoReal: Number(custoReal) || 0,
               linhaBalancoGrupo: linhaBalancoGrupo.trim(),
               linhaBalancoFrente: linhaBalancoFrente===""?null:Number(linhaBalancoFrente),
               depende:preds.filter(id=>candidatasPred.some(t=>t.id===id)),
               sucessoras:sucs.filter(id=>candidatasSuc.some(t=>t.id===id)) });
  };

  return (
    <Modal title={tarefa.nome} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tarefa.custo > 0 && (
          <div style={{ background: `${C.yellow}12`, border: `1px solid ${C.yellow}44`,
                        borderRadius: 6, padding: "9px 11px" }}>
            <p style={{ fontSize: 11, color: C.muted }}>Custo da etapa (do orcamento)</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: C.yellowD }}>{fmt(tarefa.custo)}</p>
          </div>
        )}
        {tarefa.orfa && (
          <div style={{ background: `${C.red}0E`, border: `1px solid ${C.red}55`,
                        borderRadius: 6, padding: "9px 11px" }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: C.red }}>
              A etapa do orcamento ligada a esta tarefa foi removida. Reassocie ou apague a tarefa.
            </p>
          </div>
        )}
        <Inp label="Inicio" type="date" value={ini} onChange={setIni} />
        <Inp label="Fim" type="date" value={fim} onChange={setFim} />
        {ini && fim && fim < ini && (
          <p style={{ fontSize: 11, color: C.red }}>O fim nao pode ser anterior ao inicio.</p>
        )}
        {((ini && !ehDiaUtil(ini,cal)) || (fim && !ehDiaUtil(fim,cal))) && (
          <p style={{ fontSize: 11, color: C.orange }}>Ao salvar, as datas serao ajustadas para os dias trabalhados mais proximos.</p>
        )}
        <div style={{background:`${C.blue}0A`,border:`1px solid ${C.blue}33`,borderRadius:7,padding:"9px 11px"}}>
          <p style={{fontSize:9.5,fontWeight:850,color:C.muted,textTransform:"uppercase",letterSpacing:.45}}>Avanço físico confirmado</p>
          <b style={{display:"block",fontSize:15,color:C.text,marginTop:2}}>{Number(tarefa.progresso||0).toFixed(0)}%</b>
          <p style={{fontSize:9.5,color:C.muted,marginTop:3}}>Altere pelo boletim de medição para manter a trilha auditável.</p>
        </div>
        {!tarefa.titulo&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 11px"}}><p style={{fontSize:9.5,fontWeight:850,color:C.muted,textTransform:"uppercase",letterSpacing:.45,marginBottom:7}}>Linha de balanço</p><div style={{display:"grid",gridTemplateColumns:"1fr 110px",gap:8}}><Inp label="Grupo repetitivo" value={linhaBalancoGrupo} onChange={setLinhaBalancoGrupo} placeholder="Ex.: Alvenaria"/><Inp label="Frente / pavimento" type="number" value={linhaBalancoFrente} onChange={setLinhaBalancoFrente} placeholder="Ex.: 3"/></div><p style={{fontSize:9.5,color:C.muted,marginTop:5}}>Preencha em tarefas repetidas para acompanhar a cadência entre frentes.</p></div>}
        {!tarefa.titulo && (
          <div style={{ background:`${C.blue}0A`, border:`1px solid ${C.blue}33`, borderRadius:8, padding:"10px 11px", display:"flex", flexDirection:"column", gap:8 }}>
            <p style={{ fontSize:10.5, fontWeight:800, color:C.blue, textTransform:"uppercase", letterSpacing:.5 }}>Realizado (execução)</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <Inp label="Início real" type="date" value={iniReal} onChange={setIniReal} />
              <Inp label="Fim real" type="date" value={fimReal} onChange={setFimReal} />
            </div>
            <Inp label="Custo real lançado (R$)" type="number" value={custoReal} onChange={setCustoReal} placeholder={tarefa.custo>0?`previsto ${fmt(tarefa.custo)}`:"0"} />
            {iniReal && fimReal && fim && fimReal>fim && (
              <p style={{ fontSize:10.5, color:C.red }}>O fim real está após o planejado — esta tarefa atrasou.</p>
            )}
            <p style={{ fontSize:9.5, color:C.muted, lineHeight:1.4 }}>
              Estes campos alimentam a linha "Realizado" no cronograma, a curva S e o físico-financeiro realizado. Deixe em branco se ainda não executou.
            </p>
          </div>
        )}
        {!tarefa.titulo && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[["Antecessoras",candidatasPred,preds,setPreds],["Sucessoras",candidatasSuc,sucs,setSucs]].map(([titulo,lista,selecionadas,setter])=>(
              <div key={titulo} style={{border:`1px solid ${C.border}`,borderRadius:6,padding:8,minWidth:0}}>
                <p style={{fontSize:10,fontWeight:900,color:C.muted,textTransform:"uppercase",marginBottom:6}}>{titulo}</p>
                <div style={{maxHeight:135,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                  {lista.length===0 && <span style={{fontSize:10,color:C.muted}}>Nenhuma atividade disponível</span>}
                  {lista.map(t=><label key={t.id} style={{display:"flex",gap:6,alignItems:"flex-start",fontSize:10.5,color:C.text,cursor:"pointer"}}>
                    <input type="checkbox" checked={selecionadas.includes(t.id)} onChange={()=>alternar(setter,t.id)}
                           style={{accentColor:C.yellow,marginTop:1}}/>
                    <span style={{lineHeight:1.25}}>{t.nome}</span>
                  </label>)}
                </div>
              </div>
            ))}
          </div>
        )}
        <p style={{fontSize:9.5,color:C.muted,lineHeight:1.45}}>
          Os vinculos manuais respeitam a ordem do orcamento: antecessoras anteriores e sucessoras posteriores, evitando ciclos.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <Btn full onClick={salvar}>Salvar</Btn>
          <Btn v="danger" onClick={onRemover}><Ic n="trash" /></Btn>
        </div>
      </div>
    </Modal>
  );
}

// Editor de marco: nome, tipo, data, feito.
// Configura o calendario de trabalho: dias da semana + feriados.
function ModalCalendario({ cal, onSalvar, onClose }) {
  const [dias, setDias]   = useState(cal.diasSemana || [1,2,3,4,5,6]);
  const [pular, setPular] = useState(cal.pularFeriados !== false);
  const [fers, setFers]   = useState(cal.feriados || []);
  const [novoFer, setNovoFer] = useState({ data: "", nome: "" });

  const DIAS = [["Dom",0],["Seg",1],["Ter",2],["Qua",3],["Qui",4],["Sex",5],["Sab",6]];
  const toggleDia = (d) => setDias(prev =>
    prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());

  const addFeriado = () => {
    if (!novoFer.data) return;
    setFers(prev => [...prev.filter(f => f.data !== novoFer.data),
                     { data: novoFer.data, nome: novoFer.nome || "Feriado" }]
                    .sort((a,b) => a.data.localeCompare(b.data)));
    setNovoFer({ data: "", nome: "" });
  };

  return (
    <Modal title="Calendario de trabalho" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase",
                      letterSpacing: .6, marginBottom: 8 }}>Dias trabalhados</p>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {DIAS.map(([lbl, d]) => (
              <button key={d} onClick={() => toggleDia(d)} style={{
                flex: 1, minWidth: 42, padding: "9px 4px", borderRadius: 6, cursor: "pointer",
                border: `1.5px solid ${dias.includes(d) ? C.yellow : C.border}`,
                background: dias.includes(d) ? `${C.yellow}18` : "transparent",
                color: dias.includes(d) ? C.yellowD : C.muted,
                fontSize: 11.5, fontWeight: 700,
              }}>{lbl}</button>
            ))}
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={pular} onChange={e => setPular(e.target.checked)}
                 style={{ width: 18, height: 18, accentColor: C.yellow }} />
          <span style={{ fontSize: 12.5, color: C.text }}>Retirar feriados do cronograma</span>
        </label>

        {pular && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase",
                        letterSpacing: .6, marginBottom: 8 }}>Feriados</p>
            {fers.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {fers.map(f => (
                  <div key={f.data} style={{ display: "flex", justifyContent: "space-between",
                       alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.line}` }}>
                    <span style={{ fontSize: 12, color: C.text }}>{fmtDate(f.data)} - {f.nome}</span>
                    <button onClick={() => setFers(prev => prev.filter(x => x.data !== f.data))}
                            style={{ background: "transparent", border: 0, color: C.red, cursor: "pointer",
                                     fontSize: 11, fontWeight: 700 }}>remover</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <Inp label="Data" type="date" value={novoFer.data}
                     onChange={v => setNovoFer(p => ({ ...p, data: v }))} />
              </div>
              <div style={{ flex: 1 }}>
                <Inp label="Nome" value={novoFer.nome}
                     onChange={v => setNovoFer(p => ({ ...p, nome: v }))} placeholder="Ex.: Independencia" />
              </div>
              <Btn v="ghost" size="sm" onClick={addFeriado}>+</Btn>
            </div>
          </div>
        )}

        <Btn full onClick={() => onSalvar({ diasSemana: dias, pularFeriados: pular, feriados: fers })}>
          Salvar calendario
        </Btn>
      </div>
    </Modal>
  );
}

function ModalMarco({ marco, onSalvar, onRemover, onClose }) {
  const [nome, setNome] = useState(marco.nome || "");
  const [tipo, setTipo] = useState(marco.tipo || "compra");
  const [dataM, setDataM] = useState(marco.data || today());
  const [feito, setFeito] = useState(!!marco.feito);
  const [nota, setNota] = useState(marco.nota || "");

  return (
    <Modal title={marco.id ? "Marco" : "Novo marco"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Inp label="Nome" value={nome} onChange={setNome} placeholder="Ex.: Comprar porcelanato" />
        <Sel label="Tipo" value={tipo} onChange={setTipo} options={[
          { v: "compra", l: "Compra" }, { v: "entrega", l: "Entrega" },
          { v: "vistoria", l: "Vistoria" }, { v: "pagamento", l: "Pagamento" },
          { v: "geral", l: "Geral" },
        ]} />
        <Inp label="Data" type="date" value={dataM} onChange={setDataM} />
        <Inp label="Nota (opcional)" value={nota} onChange={setNota} multiline />
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={feito} onChange={e => setFeito(e.target.checked)}
                 style={{ width: 18, height: 18, accentColor: C.green }} />
          <span style={{ fontSize: 12.5, color: C.text }}>Ja concluido</span>
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <Btn full onClick={() => onSalvar({ id: marco.id, nome, tipo, data: dataM, feito, nota })}>Salvar</Btn>
          {onRemover && <Btn v="danger" onClick={onRemover}><Ic n="trash" /></Btn>}
        </div>
      </div>
    </Modal>
  );
}
