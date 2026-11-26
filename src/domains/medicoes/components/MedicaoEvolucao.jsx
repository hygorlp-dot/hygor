// @ts-check
import { lazy, Suspense, useMemo, useState } from 'react';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { thirdPartyMeasurementsForProject, linkStageToTask, thirdPartyProgressByTask } from '../../terceirizados/obra-measurements';
import { thirdPartySpecialty as specInfo } from '../../terceirizados/catalog';
import { OPERATIONAL_COMMAND } from '../../sync/operational-commands';
import { uid, fmt, pct1, obraContextoSalvo, today, fmtDateFull } from '../../../legacy/format.js';
import { C } from '../../../legacy/palette.js';
import { contar } from '../../../design-system/copy.js';
import { SelectControl } from '../../../design-system/primitives/Select.jsx';
import { Btn, Ic, LoadingState, Sel, MiniKpi, Inp, Badge, Modal } from '../../../legacy/ui.jsx';
import { useSyncedWorkObra } from '../../../features/workflow/work-context.js';
import { orcamentoDaObra, aplicarRollup, montarTarefas, fundirEvolucao } from '../../planejamento/legacy-engine.js';
import { resumoMedicao } from '../evolution-summary.js';
import { useWorkspaceState } from '../../../features/workflow/workspace-session.jsx';
import { useRecordPage } from '../../../design-system/data/useRecordPage.js';
import { rebuildTechnicalMeasurementProjection } from '../projections.js';
import { createBillingFromTechnicalMeasurement } from '../../financeiro/workflows.js';
import { PageHeader } from '../../../design-system/patterns/PageHeader.jsx';
import { ScopeNote } from '../../../design-system/patterns/ScopeNote.jsx';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { RecordListPagination } from '../../../design-system/data/RecordListPagination.jsx';
import { Input as StandardInput } from '../../../components/ui/input.jsx';
import { Button as StandardButton } from '../../../components/ui/button.jsx';
import { ProgressPercentageField } from './ProgressPercentageField.jsx';

const Terceiros = lazy(() => import('../../terceirizados/components/TerceirosView'));

// Contratos de terceirizados por medição desta obra, dentro da aba Medição.
// Mostra o avanço aprovado pelo financeiro e permite vincular cada etapa do
// contrato a um serviço do planejamento; o vínculo vira proposta de avanço no
// boletim técnico (o avanço oficial continua sendo só o boletim aprovado).
/** @param {import("../evolution-contract").ThirdPartyMeasurementProps} props */
export function TerceirosNaMedicao({ data, obraId, tarefas, currentUser, dispatchCommand, showToast, onAbrirTerceiro }) {
  const { isMobile } = useBreakpoint();
  /** @type {import("../evolution-contract").ContractOverview[]} */
  const contratos = useMemo(() => thirdPartyMeasurementsForProject(data, obraId), [data.terceirizados, data.medicoesTerc, obraId]);
  const [salvando, setSalvando] = useState("");
  const podeVincular = ["admin","engenheiro","engenheiro_auditor"].includes(currentUser?.role ?? "") && !!dispatchCommand;
  const tarefasPorId = new Map(tarefas.map(t => [t.id, t]));

  /** @param {string} contratoId @param {string} etapaId @param {string} tarefaId */
  const vincular = async (contratoId, etapaId, tarefaId) => {
    if (!podeVincular || !dispatchCommand || salvando) return;
    setSalvando(`${contratoId}:${etapaId}`);
    try {
      const result = await dispatchCommand(atual => {
        const contrato = (atual.terceirizados || []).find(item => item.id === contratoId);
        return {
          type: OPERATIONAL_COMMAND.THIRD_PARTY_CONTRACT_STAGES_SAVED,
          idempotencyKey: `third-contract-stage-link-${contratoId}-${etapaId}-${uid()}`,
          expectedVersion: Number(contrato?.version || 0),
          actorId: currentUser?.id || "", actorName: currentUser?.nome || "",
          payload: { contractId: contratoId, stages: linkStageToTask(contrato, etapaId, tarefaId) },
        };
      });
      if (!result?.ok) throw new Error(result?.reason || "O servidor não confirmou o vínculo.");
      showToast?.(tarefaId ? "Etapa vinculada ao serviço do planejamento." : "Vínculo da etapa removido.");
    } catch (error) {
      showToast?.(/** @type {Error} */ (error).message || "Não foi possível salvar o vínculo.", "error");
    } finally { setSalvando(""); }
  };

  /** @param {import("react").ReactNode} texto @param {string} cor */
  const chip = (texto, cor) => <span style={{ fontSize:"var(--arcd-type-label)", fontWeight:"var(--arcd-font-weight-semibold)", color: cor, background: `${cor}14`,
    border: `var(--arcd-border-width) solid ${cor}44`, borderRadius: "var(--arcd-radius-pill)", padding: "var(--arcd-space-half) var(--arcd-space-2)", whiteSpace: "nowrap" }}>{texto}</span>;

  return (
    <div style={{ background: "var(--arcd-surface-card)", border: "var(--arcd-border-width) solid var(--arcd-border-default)", borderRadius: "var(--arcd-box-radius)", overflow: "hidden" }}>
      <div style={{ padding: "var(--arcd-space-3)", borderBottom: "var(--arcd-border-width) solid var(--arcd-border-default)" }}>
        <p style={{ fontSize: "var(--arcd-type-body)", fontWeight:"var(--arcd-font-weight-semibold)", color: "var(--arcd-text-primary)", textTransform: "uppercase", letterSpacing: "var(--arcd-letter-spacing-body)" }}>
          Terceirizados desta obra
        </p>
        <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)", marginTop: "var(--arcd-space-half)" }}>
          Avanço das etapas contratadas, medido pelo engenheiro e aprovado pelo financeiro
        </p>
      </div>
      {contratos.length === 0 ? (
        <p style={{ padding: "var(--arcd-space-4)", fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)", textAlign: "center" }}>
          Nenhum contrato de terceirizado por medição nesta obra.
        </p>
      ) : contratos.map(c => {
        const esp = specInfo(c.especialidade);
        return (
          <div key={c.id} style={{ padding: "var(--arcd-space-3)", borderTop: "var(--arcd-border-width) solid var(--arcd-border-default)", display: "flex", flexDirection: "column", gap: "var(--arcd-space-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--arcd-space-2)", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "var(--arcd-type-body)", fontWeight:"var(--arcd-font-weight-semibold)", color: "var(--arcd-text-primary)" }}>{c.nome}</p>
                <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)", marginTop: "var(--arcd-space-0)" }}>
                  {esp?.l || c.especialidade} · contrato {fmt(c.valorContrato)} · aprovado {fmt(c.valorAprovado)} · a medir {fmt(c.aMedir)}
                  {c.valorAguardando > 0 && <> · <span style={{ color: "var(--arcd-warning-text)", fontWeight:"var(--arcd-font-weight-semibold)" }}>{fmt(c.valorAguardando)} aguardando aprovação</span></>}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "var(--arcd-type-card-title)", fontWeight:"var(--arcd-font-weight-semibold)", color: "var(--arcd-action-primary)" }}>{pct1(c.avancoAprovado)}</p>
                <p style={{ fontSize:"var(--arcd-type-caption)", color: "var(--arcd-text-secondary)" }}>
                  físico aprovado{c.avancoEnviado > c.avancoAprovado + 0.001 ? ` · ${pct1(c.avancoEnviado)} com os pendentes` : ""}
                </p>
              </div>
            </div>
            {(c.contagem.aguardando + c.contagem.rejeitadas + c.contagem.aPagar + c.contagem.pagas) > 0 && (
              <div style={{ display: "flex", gap: "var(--arcd-space-1)", flexWrap: "wrap" }}>
                {c.contagem.aguardando > 0 && chip(`${c.contagem.aguardando} aguardando aprovação`, C.orange)}
                {c.contagem.rejeitadas > 0 && chip(`${contar(c.contagem.rejeitadas,"rejeitada","rejeitadas")}`, C.red)}
                {c.contagem.aPagar > 0 && chip(`${contar(c.contagem.aPagar,"aprovada","aprovadas")} a pagar`, C.blue)}
                {c.contagem.pagas > 0 && chip(`${contar(c.contagem.pagas,"paga","pagas")}`, C.green)}
              </div>
            )}
            {c.etapas.length === 0 ? (
              <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)" }}>Contrato ainda sem etapas. Subdivida-o em Terceiros para poder medir.</p>
            ) : (
              <div style={{ border: "var(--arcd-border-width) solid var(--arcd-border-default)", borderRadius: "var(--arcd-radius-control)", overflow: "hidden" }}>
                {c.etapas.map((e, i) => {
                  const vinculada = e.tarefaId ? tarefasPorId.get(e.tarefaId) : null;
                  const orfa = e.tarefaId && !vinculada;
                  return (
                    <div key={e.id} style={{ padding: "var(--arcd-space-2)", borderTop: i ? "var(--arcd-border-width) solid var(--arcd-border-default)" : 0,
                         display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr) 70px" : "minmax(0,1.3fr) minmax(170px,1fr) 70px", gap: "var(--arcd-space-2)", alignItems: "center" }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize:"var(--arcd-type-label)", fontWeight:"var(--arcd-font-weight-semibold)", color: "var(--arcd-text-primary)" }}>{e.nome} <span style={{ fontWeight: "var(--arcd-font-weight-regular)", color: "var(--arcd-text-secondary)" }}>· {fmt(e.valor)}</span></p>
                        <div style={{ marginTop: "var(--arcd-space-1)", height: 5, background: "var(--arcd-border-default)", borderRadius: "var(--arcd-radius-pill)", overflow: "hidden", position: "relative" }}>
                          <div style={{ position: "absolute", inset: 0, width: `${e.pctEnviado}%`, background: "color-mix(in srgb, var(--arcd-warning-text) 40%, transparent)" }} />
                          <div style={{ position: "absolute", inset: 0, width: `${e.pctAprovado}%`, background: e.pctAprovado >= 100 ? "var(--arcd-success-text)" : "var(--arcd-action-primary)" }} />
                        </div>
                      </div>
                      {tarefas.length > 0 ? (
                        <SelectControl aria-label={`Serviço do planejamento para a etapa ${e.nome}`} value={orfa ? "" : e.tarefaId}
                          disabled={!podeVincular || salvando === `${c.id}:${e.id}`}
                          onChange={ev => vincular(c.id, e.id, ev.target.value)}
                          aria-invalid={orfa || undefined}
                          style={{ gridColumn: isMobile ? "1 / -1" : undefined, gridRow: isMobile ? 2 : undefined }}>
                          <option value="">{orfa ? "Serviço removido — vincular de novo" : "Sem vínculo com o planejamento"}</option>
                          {tarefas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                        </SelectControl>
                      ) : <span style={{ gridColumn: isMobile ? "1 / -1" : undefined, gridRow: isMobile ? 2 : undefined, fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)" }}>Sem serviços no planejamento</span>}
                      <span style={{ gridColumn: isMobile ? 2 : undefined, gridRow: isMobile ? 1 : undefined, fontSize: "var(--arcd-type-body)", fontWeight:"var(--arcd-font-weight-semibold)", textAlign: "right", color: e.pctAprovado >= 100 ? "var(--arcd-success-text)" : "var(--arcd-text-primary)" }}>
                        {e.pctAprovado.toFixed(0)}%
                        {e.pctEnviado > e.pctAprovado && <span style={{ display: "block", fontSize:"var(--arcd-type-caption)", fontWeight: "var(--arcd-font-weight-semibold)", color: "var(--arcd-warning-text)" }}>{e.pctEnviado.toFixed(0)}% enviado</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {tarefas.length === 0 && c.etapas.length > 0 && (
              <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)" }}>
                Cadastre os serviços no Planejamento para que estas etapas alimentem o avanço físico e a curva S da obra.
              </p>
            )}
            {onAbrirTerceiro && (
              <div style={{ display: "flex", gap: "var(--arcd-space-1)", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <Btn size="sm" v="ghost" onClick={() => onAbrirTerceiro(c.id, false)}>Ver medições</Btn>
                <Btn size="sm" onClick={() => onAbrirTerceiro(c.id, true)} disabled={!c.etapas.length}><Ic n="plus" /> Nova medição</Btn>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==============================================================
//  MEDICAO DE EVOLUCAO (aba separada)
//  Mostra o avanco de cada tarefa: o que veio do diario (RDO) e o
//  que e manual. Permite ajustar o progresso manualmente aqui.
// ==============================================================
/** @param {import("../evolution-contract").MeasurementEvolutionProps} props */
export function MedicaoEvolucao({ data, update, showToast, obraIdFixo="", currentUser=null, dispatchCommand=null, onAbrirTerceiro=null, onAbrirPlanejamento=null }) {
  const { cols } = useBreakpoint();
  const obras = (data.obras || []).filter(o => o.status !== "done");
  const [obraId, setObraId] = useState(()=>obraIdFixo||(obras.some(o=>o.id===obraContextoSalvo())?obraContextoSalvo():(obras[0]?.id||"")));
  useSyncedWorkObra(obraId,setObraId,{allowedIds:obras.map(o=>o.id),fixed:obraIdFixo});

  const orc   = orcamentoDaObra(data, obraId);
  const plano = useMemo(() =>
    (data.planos || []).find(p => p.obraId === obraId)
    || { tarefas: [] }, [data.planos, obraId]);

  const tarefas = useMemo(() => {
    const base = aplicarRollup(montarTarefas(plano, orc), orc);
    const services = /** @type {import("../evolution-contract").MeasurementTask[]} */ (fundirEvolucao(base, data.rdos, obraId));
    return services.filter(t => !t.titulo);
  }, [plano, orc, data.rdos, obraId]);

  const resumo = useMemo(() => resumoMedicao(tarefas), [tarefas]);
  // Avanço aprovado dos terceirizados, por serviço vinculado. Só propõe no
  // boletim; o avanço oficial continua saindo do boletim confirmado.
  const avancoTerceiros = useMemo(
    () => thirdPartyProgressByTask(thirdPartyMeasurementsForProject(data, obraId), new Set(tarefas.map(t => t.id))),
    [data.terceirizados, data.medicoesTerc, obraId, tarefas]);
  /** @param {import("../evolution-contract").MeasurementTask} t */
  const propostaBoletim = t => avancoTerceiros.get(t.id)?.pct ?? (t.progresso || 0);

  const [editando, setEditando] = useState(/** @type {string | null} */ (null));
  const [serviceSearch,setServiceSearch]=useWorkspaceState("med","search","",obraIdFixo);
  const visibleServices=tarefas.filter(item=>item.nome.toLocaleLowerCase("pt-BR").includes(serviceSearch.trim().toLocaleLowerCase("pt-BR")));
  const servicesPage=useRecordPage('med',visibleServices,JSON.stringify([obraId,serviceSearch]),obraIdFixo);
  const [confModal, setConfModal] = useState(false);   // modal de confirmar medição
  const [confPct, setConfPct] = useState(/** @type {Record<string, string>} */ ({}));          // pct confirmado por tarefa
  const [confResp, setConfResp] = useState("");
  const [confObs, setConfObs] = useState("");
  const [confData, setConfData] = useState(today());
  const [fatModal,setFatModal]=useState(/** @type {import("../evolution-contract").TechnicalMeasurement | null} */ (null));
  const [fatForm,setFatForm]=useState({competencia:today().slice(0,7),dataVencimento:""});
  const [billingPending,setBillingPending]=useState(false);
  const [escolherTerceiro, setEscolherTerceiro] = useState(false);
  const [terceiroLocal, setTerceiroLocal] = useState(/** @type {{contratoId: string, novaMedicao: boolean} | null} */ (null));
  /** @type {import("../evolution-contract").ContractOverview[]} */
  const contratosMedicao = thirdPartyMeasurementsForProject(data, obraId);
  /** @param {string} contratoId @param {boolean} novaMedicao */
  const abrirTerceiro = (contratoId, novaMedicao) => {
    setEscolherTerceiro(false);
    if (onAbrirTerceiro) onAbrirTerceiro(contratoId, novaMedicao);
    else setTerceiroLocal({contratoId, novaMedicao});
  };
  const iniciarMedicaoTerceiro = () => {
    if (contratosMedicao.length === 1) {
      const contrato = contratosMedicao[0];
      abrirTerceiro(contrato.id, contrato.etapas.length > 0);
    } else setEscolherTerceiro(true);
  };

  // Medições de obra já confirmadas desta obra, em ordem.
  const medicoesObra = useMemo(() =>
    (data.medicoesObra || []).filter(m => m.obraId === obraId)
      .sort((a, b) => (a.data + a.id).localeCompare(b.data + b.id)),
  [data.medicoesObra, obraId]);

  // Abre o boletim já preenchido com o que o diário indica — o fiscal só
  // confirma ou corrige. É a "confirmação com o diário" pedida: o número do
  // diário entra como proposta, e a divergência aceita fica registrada.
  const abrirConfirmacao = () => {
    if (!tarefas.length) { iniciarMedicaoTerceiro(); return; }
    setConfPct(Object.fromEntries(tarefas.map(t => [t.id, String(propostaBoletim(t))])));
    setConfResp(""); setConfObs(""); setConfData(today());
    setConfModal(true);
  };

  const salvarConfirmacao = async () => {
    const itens = tarefas.map(t => {
      const terceiro = avancoTerceiros.get(t.id);
      return {
        tarefaId: t.id, nome: t.nome,
        pctDiario: t.progresso || 0,
        pctConfirmado: Math.max(0, Math.min(100, Number(confPct[t.id]) || 0)),
        custo: t.custo || 0,
        ...(terceiro ? {
          pctTerceiros: terceiro.pct,
          fontesTerceiros: terceiro.fontes.map(f => ({ contratoId: f.contratoId, etapaId: f.etapaId, pct: f.pct })),
        } : {}),
      };
    });
    const custoTotal = itens.reduce((s, i) => s + i.custo, 0);
    const avancoFisico = custoTotal
      ? itens.reduce((s, i) => s + i.custo * i.pctConfirmado, 0) / custoTotal : 0;
    const medicao = {
      id: uid(), obraId, data: confData, dataMedicao: confData,
      numero: medicoesObra.length + 1,
      responsavel: confResp.trim(), observacao: confObs.trim(),
      itens, avancoFisico,
    };
    // A medição é o fato oficial: ela é confirmada primeiro pelo comando
    // versionado. O reflexo no planejamento é uma projeção operacional, sem
    // alterar diários já concluídos.
    if(dispatchCommand){
      const result=await dispatchCommand({type:OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED,
        idempotencyKey:`medicao-criacao-${medicao.id}-${uid()}`,expectedVersion:0,
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{measurement:medicao}});
      if(!result?.ok){showToast?.(result?.reason||"Não foi possível confirmar a medição.","error");return;}
    }else{
      const base = { ...data, medicoesObra: [...(data.medicoesObra || []), medicao] };
      update(rebuildTechnicalMeasurementProjection(base, obraId, new Date().toISOString()));
    }
    setConfModal(false);
    showToast?.(`Medição ${medicao.numero} confirmada: ${avancoFisico.toFixed(0)}% físico.`);
  };

  /** @param {import("../evolution-contract").TechnicalMeasurement} m */
  const removerMedicaoObra = async (m) => {
    if((data.medicoes||[]).some(item=>item.medicaoTecnicaId===m.id&&!["cancelada","cancelado"].includes(item.status))){
      showToast?.("A medição já possui faturamento. Cancele o documento financeiro antes.","error");return;
    }
    const ultima = medicoesObra[medicoesObra.length - 1];
    if (!ultima || ultima.id !== m.id) {
      showToast?.("Só a última medição pode ser removida.", "error"); return;
    }
    const motivo=window.prompt(`Motivo do cancelamento da medição ${m.numero}:`);
    if(!String(motivo||"").trim())return;
    const agora=new Date().toISOString();
    if(dispatchCommand){
      const result=await dispatchCommand(atual=>{
        const vigente=(atual.medicoesObra||[]).find(item=>item.id===m.id);
        return {type:OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED,idempotencyKey:`medicao-cancelamento-${m.id}-${uid()}`,
          expectedVersion:Number(vigente?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{measurementId:m.id,reason:String(motivo).trim()}};
      });
      if(!result?.ok){showToast?.(result?.reason||"Não foi possível cancelar a medição.","error");return;}
    }else {
      const base={ ...data, medicoesObra: (data.medicoesObra || []).map(x => x.id!==m.id?x:{
      ...x,status:"cancelada",motivoCancelamento:String(motivo).trim(),canceladaEm:agora,
      canceladaPorId:currentUser?.id||"",canceladaPor:currentUser?.nome||"",
      }) };
      update(rebuildTechnicalMeasurementProjection(base, obraId, agora));
    }
    showToast?.("Medição cancelada e preservada no histórico.");
  };

  /** @param {import("../evolution-contract").TechnicalMeasurement} m */
  const abrirFaturamento=m=>{
    if((data.medicoes||[]).some(item=>item.medicaoTecnicaId===m.id&&item.status!=="cancelada")){
      showToast?.("Esta medição técnica já foi faturada.","warn");return;
    }
    const preview=createBillingFromTechnicalMeasurement(data,{medicaoTecnicaId:m.id,competencia:String(m.data||today()).slice(0,7)});
    if(!preview.ok){showToast?.(/** @type {string} */ (preview.error),"error");return;}
    setFatForm({competencia:String(m.data||today()).slice(0,7),dataVencimento:""});
    setFatModal(m);
  };
  const faturamentoPreview=useMemo(
    ()=>fatModal?createBillingFromTechnicalMeasurement(data,{medicaoTecnicaId:fatModal.id,competencia:fatForm.competencia}):null,
    [data,fatModal,fatForm.competencia],
  );
  const confirmarFaturamento=async()=>{
    if(!dispatchCommand||billingPending)return;
    setBillingPending(true);
    try{
      const technicalId=fatModal?.id;
      const result=await dispatchCommand(()=>({
        type:OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_BILLED,
        idempotencyKey:`client-measurement-billing-${technicalId}-${uid()}`,
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{
          id:`fat-${technicalId}`,medicaoTecnicaId:technicalId,
          competencia:fatForm.competencia,dataVencimento:fatForm.dataVencimento,
        },
      }));
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou o faturamento.");
      const billing=(result.data?.medicoes||[]).find(item=>item.medicaoTecnicaId===technicalId&&item.status!=="cancelada");
      setFatModal(null);
      showToast?.(`Faturamento de ${fmt(billing?.valorPrevisto||0)} gerado a partir da medição técnica.`);
    }catch(error){
      showToast?.(/** @type {Error} */ (error).message||"Não foi possível gerar o faturamento.","error");
    }finally{
      setBillingPending(false);
    }
  };

  // O plano é uma projeção do boletim aprovado. Não há sobrescrita manual do
  // fato técnico: uma correção cria novo boletim e mantém a trilha auditável.
  const ajustarManual = () => {
    showToast?.("O avanço oficial só pode ser alterado em um novo boletim de medição aprovado.", "warn");
  };

  if (terceiroLocal) return <div className="measurement-surface">
    <Btn v="ghost" onClick={()=>setTerceiroLocal(null)}>Voltar à medição da obra</Btn>
    <Suspense fallback={<LoadingState label="medição do terceirizado"/>}>
      <Terceiros data={data} update={update} showToast={showToast} obraIdFixo={obraId} currentUser={currentUser}
        dispatchCommand={dispatchCommand} contratoInicial={terceiroLocal} />
    </Suspense>
  </div>;

  if (!obras.length) {
    return <div style={{ padding: "var(--arcd-space-6)", textAlign: "center" }}>
      <p style={{ fontSize: "var(--arcd-type-body)", color: "var(--arcd-text-secondary)" }}>Cadastre uma obra para medir a evolução.</p>
    </div>;
  }

  return (
    <div className="measurement-surface" style={{ display: "flex", flexDirection: "column", gap: "var(--arcd-box-gap)" }}>
      <PageHeader headingLevel={obraIdFixo?2:1} className="workspace-header" title={obraIdFixo?"Medição física":"Avanço físico"} />
      {!obraIdFixo&&<Sel label="Obra" value={obraId} onChange={setObraId}
             options={obras.map(o => ({ v: o.id, l: o.name }))} />}
      <ScopeNote title="Orçamento de controle da medição">
        {orc ? `V${orc.versionNumber||1} · ${orc.nome||orc.codigo||"Orçamento sem nome"}. ` : "Sem orçamento de controle ativo. "}
        O avanço oficial da obra vem do boletim aprovado.
      </ScopeNote>

      {/* Resumo */}
      <div style={{ display: "grid", gridTemplateColumns: cols(2, 4, 4), gap: "var(--arcd-space-2)" }}>
        <MiniKpi label="Evolução por valor" value={resumo.temBaseValor?`${resumo.avancoFisico.toFixed(0)}%`:"Sem base de valor"} cor={C.blue} />
        <MiniKpi label="Serviços" value={`${resumo.total}`} cor={C.text} />
        <MiniKpi label="Medidos pelo diário" value={`${resumo.peloDiario}`} cor={C.green}
                 sub={`${resumo.total - resumo.peloDiario} manuais`} />
        <MiniKpi label="Dias trabalhados" value={`${resumo.diasTotais}`} cor={C.yellow}
                 sub="somados nos RDOs" />
      </div>

      {!tarefas.length && (
        <Alert role="status" aria-label="Como iniciar a medição">
          <AlertDescription>
            <div className="flex flex-col gap-3">
              <p><strong>Medição disponível sem Planejamento.</strong> Use “Confirmar medição” para medir as etapas do contrato de um terceirizado.</p>
              <p>Para acompanhar também o avanço físico oficial da obra, cadastre os serviços no Planejamento e vincule as etapas dos contratos.</p>
              <div className="flex flex-wrap gap-2">
                {onAbrirPlanejamento && <Btn size="sm" onClick={()=>onAbrirPlanejamento(obraId)}>Abrir Planejamento</Btn>}
                <Btn size="sm" v="ghost" onClick={iniciarMedicaoTerceiro}>Medir terceirizados</Btn>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabela de evolucao */}
      <RecordListPagination pagination={servicesPage} label="serviços"/>
      <div style={{ background: "var(--arcd-surface-card)", border: "var(--arcd-border-width) solid var(--arcd-border-default)", borderRadius: "var(--arcd-box-radius)", overflow: "hidden" }}>
        <div style={{ padding: "var(--arcd-space-3)", borderBottom: "var(--arcd-border-width) solid var(--arcd-border-default)" }}>
          <h3 className="arcd-heading-section">Evolução por serviço</h3>
          <p className="arcd-body-muted">A evolução por valor pondera o custo dos serviços vinculados. O Planejamento acompanha o avanço pela duração das tarefas.</p>
          <Inp label="Buscar serviço da medição" value={serviceSearch} onChange={setServiceSearch} placeholder="Nome do serviço"/>
        </div>
        {visibleServices.length === 0 ? (
          <p style={{ padding: "var(--arcd-space-5)", fontSize: "var(--arcd-type-body)", color: "var(--arcd-text-secondary)", textAlign: "center" }}>
            {serviceSearch?"Nenhum serviço corresponde à busca. Limpe o campo para ver todos.":"Sem serviços no planejamento desta obra."}
          </p>
        ) : servicesPage.rows.map(t => {
          const terceiro = avancoTerceiros.get(t.id);
          return <div key={t.id} style={{ padding: "var(--arcd-space-3)", borderTop: "var(--arcd-border-width) solid var(--arcd-border-default)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--arcd-space-2)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="brk" style={{ fontSize: "var(--arcd-type-body)", fontWeight:"var(--arcd-font-weight-semibold)", color: "var(--arcd-text-primary)" }}>{t.nome}</p>
                <div style={{ display: "flex", gap: "var(--arcd-space-2)", marginTop: "var(--arcd-space-half)", flexWrap: "wrap" }}>
                  <span style={{ fontSize:"var(--arcd-type-label)", fontWeight:"var(--arcd-font-weight-semibold)",
                                 color: t.origemProgresso === "diario" ? "var(--arcd-success-text)" : "var(--arcd-text-secondary)" }}>
                    {t.origemProgresso === "diario" ? "via diário"
                      : t.origemProgresso === "medicao_oficial" ? "medição oficial"
                      : t.origemProgresso === "medicao" ? "ajustado na medição"
                      : "manual"}
                  </span>
                  {t.diasTrabalhados > 0 && (
                    <span style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)" }}>{contar(t.diasTrabalhados,"dia trabalhado","dias trabalhados")}</span>
                  )}
                  {t.custo > 0 && <span style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)" }}>{fmt(t.custo)}</span>}
                  {terceiro && (
                    <span style={{ fontSize:"var(--arcd-type-label)", fontWeight:"var(--arcd-font-weight-semibold)", color: "var(--arcd-action-primary)" }}
                      title={terceiro.fontes.map(f => `${f.contrato} · ${f.etapa}: ${f.pct}%`).join("\n")}>
                      terceirizado: {terceiro.pct.toFixed(0)}% aprovado
                    </span>
                  )}
                </div>
              </div>
              {editando === t.id ? (
                <div style={{ display: "flex", gap: "var(--arcd-space-1)", alignItems: "center" }}>
                  <StandardInput type="number" defaultValue={t.progresso} min="0" max="100"
                         id={`prog-${t.id}`} style={{ width: 60, padding: "var(--arcd-space-1)", borderRadius: "var(--arcd-radius-control)",
                         border: "var(--arcd-border-width) solid var(--arcd-border-default)", fontSize: "var(--arcd-type-control)", textAlign: "center" }} />
                  <Btn size="sm" onClick={() => {
                    ajustarManual(); setEditando(null);
                  }}><Ic n="check" /></Btn>
                </div>
              ) : (
                <StandardButton variant="secondary" onClick={() => setEditando(t.id)} className="shrink-0">
                  <span style={{ fontSize: "var(--arcd-type-card-title)", fontWeight:"var(--arcd-font-weight-semibold)",
                                 color: t.progresso >= 100 ? "var(--arcd-success-text)" : "var(--arcd-action-primary)" }}>{t.progresso}%</span>
                  <Ic n="edit" s={13} color={C.muted} />
                </StandardButton>
              )}
            </div>
            <div style={{ marginTop: "var(--arcd-space-2)", height: 6, background: "var(--arcd-border-default)", borderRadius: "var(--arcd-radius-pill)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${t.progresso}%`,
                            background: t.progresso >= 100 ? "var(--arcd-success-text)" : "var(--arcd-action-primary)", borderRadius: "var(--arcd-radius-pill)" }} />
            </div>
          </div>;
        })}
      </div>

      <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)", lineHeight: "var(--arcd-line-height-normal)", padding: "var(--arcd-space-0) var(--arcd-space-1)" }}>
        O diário e as medições aprovadas dos terceirizados sugerem o avanço. O boletim técnico aprovado é a única
        fonte do avanço oficial e alimenta a curva S e o físico-financeiro; correções geram um novo boletim auditável.
      </p>

      {obraId && <section aria-label="Medição dos terceirizados">
        <TerceirosNaMedicao data={data} obraId={obraId} tarefas={tarefas} currentUser={currentUser}
          dispatchCommand={dispatchCommand} showToast={showToast} onAbrirTerceiro={abrirTerceiro} />
      </section>}

      {/* Boletim de medição: confirma o avanço contra o diário */}
      <div style={{ background: "var(--arcd-surface-card)", border: "var(--arcd-border-width) solid var(--arcd-border-default)", borderRadius: "var(--arcd-box-radius)", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--arcd-space-2)",
                      padding: "var(--arcd-space-3)", borderBottom: "var(--arcd-border-width) solid var(--arcd-border-default)", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "var(--arcd-type-body)", fontWeight:"var(--arcd-font-weight-semibold)", color: "var(--arcd-text-primary)", textTransform: "uppercase", letterSpacing: "var(--arcd-letter-spacing-body)" }}>
              Boletins de medição
            </p>
            <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)", marginTop: "var(--arcd-space-half)" }}>
              Confirma o avanço físico contra o diário e o congela como medição oficial
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onAbrirPlanejamento && <Btn size="sm" v="ghost" onClick={()=>onAbrirPlanejamento(obraId)}>Abrir Planejamento</Btn>}
            <Btn size="sm" onClick={abrirConfirmacao}>
              <Ic n="check" /> Confirmar medição
            </Btn>
          </div>
        </div>
        {medicoesObra.length === 0 ? (
          <p style={{ padding: "var(--arcd-space-4)", fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)", textAlign: "center" }}>
            Nenhuma medição confirmada. A medição fotografa o avanço aceito numa data.
          </p>
        ) : (
          [...medicoesObra].reverse().map(m => {
            const divergentes = m.itens.filter(i => Math.abs(i.pctConfirmado - i.pctDiario) > 0.01).length;
            const faturamento=(data.medicoes||[]).find(item=>item.medicaoTecnicaId===m.id&&item.status!=="cancelada");
            return (
              <div key={m.id} style={{ padding: "var(--arcd-space-3)", borderTop: "var(--arcd-border-width) solid var(--arcd-border-default)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--arcd-space-2)", flexWrap: "wrap" }}>
                  <div>
                    <p style={{ fontSize: "var(--arcd-type-body)", fontWeight:"var(--arcd-font-weight-semibold)", color: "var(--arcd-text-primary)" }}>
                      Medição {m.numero} · {fmtDateFull(m.data)}
                    </p>
                    <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)", marginTop: "var(--arcd-space-half)" }}>
                      {m.responsavel ? `${m.responsavel} · ` : ""}{contar(m.itens.length,"serviço","serviços")}
                      {divergentes > 0 && <span style={{ color: "var(--arcd-warning-text)", fontWeight:"var(--arcd-font-weight-semibold)" }}> · {contar(divergentes,"ajustado","ajustados")} vs diário</span>}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "var(--arcd-type-card-title)", fontWeight:"var(--arcd-font-weight-semibold)", color: "var(--arcd-action-primary)",
                                fontFamily: "var(--arcd-font-sans)" }}>{m.avancoFisico.toFixed(0)}%</p>
                    <p style={{ fontSize:"var(--arcd-type-caption)", color: "var(--arcd-text-secondary)" }}>físico confirmado</p>
                  </div>
                </div>
                {m.observacao && <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)", fontStyle: "italic", marginTop: "var(--arcd-space-1)" }}>"{m.observacao}"</p>}
                <div style={{ display: "flex", justifyContent: "flex-end", gap:"var(--arcd-space-1)", marginTop: "var(--arcd-space-2)" }}>
                  {faturamento
                    ? <Badge color={C.green}>FATURADA · {fmt(faturamento.valorPrevisto)}</Badge>
                    : <Btn size="sm" v="success" onClick={()=>abrirFaturamento(m)}>Gerar faturamento</Btn>}
                  <Btn size="sm" v="ghost" onClick={() => removerMedicaoObra(m)}>Remover</Btn>
                </div>
              </div>
            );
          })
        )}
      </div>

      {escolherTerceiro && <Modal title="Medir terceirizado" panelClass="measurement-entry-modal" onClose={()=>setEscolherTerceiro(false)}>
        <div className="measurement-contract-choices">
          <p>Escolha o contrato para registrar o percentual executado de cada etapa.</p>
          {contratosMedicao.map(contrato=><Btn key={contrato.id} v="ghost" full onClick={()=>abrirTerceiro(contrato.id, contrato.etapas.length > 0)}>
            <span>{contrato.nome}<small style={{display:"block"}}>{contrato.etapas.length ? `${pct1(contrato.avancoAprovado)} aprovado · ${contrato.etapas.length} etapas` : "Cadastrar etapas antes de medir"}</small></span>
            <Ic n="chevR" />
          </Btn>)}
          {!contratosMedicao.length && <p>Nenhum contrato de terceirizado por medição nesta obra. Cadastre o contrato e suas etapas em RH → Terceiros.</p>}
        </div>
      </Modal>}

      {/* Modal: confirmar medição contra o diário */}
      {confModal && (
        <Modal title={`Confirmar medição ${medicoesObra.length + 1}`} panelClass="measurement-entry-modal" onClose={() => setConfModal(false)} wide
          footer={<div className="measurement-entry-actions">
            <Btn v="ghost" full onClick={() => setConfModal(false)}>Cancelar</Btn>
            <Btn full onClick={salvarConfirmacao}><Ic n="check" /> Confirmar e congelar</Btn>
          </div>}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--arcd-space-3)" }}>
            <p style={{ fontSize:"var(--arcd-type-label)", color: "var(--arcd-text-secondary)", lineHeight: "var(--arcd-line-height-normal)" }}>
              Cada serviço abre com a proposta: o avanço aprovado do terceirizado vinculado, quando
              houver; senão, o do diário. Confirme ou corrija o valor que o fiscal aprova. A
              divergência aceita fica registrada no boletim, e o progresso do cronograma passa a
              ser o confirmado.
            </p>
            <Inp label="Data efetiva da medição" type="date" value={confData} onChange={setConfData}/>
            <div style={{ border: "var(--arcd-border-width) solid var(--arcd-border-default)", borderRadius: "var(--arcd-box-radius)", overflow: "hidden" }}>
              {tarefas.map(t => {
                const conf = Number(confPct[t.id]) || 0;
                const terc = avancoTerceiros.get(t.id);
                const div = Math.round((conf - propostaBoletim(t)) * 100) / 100;
                return (
                  <div key={t.id} className="measurement-entry-row">
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "var(--arcd-type-body)", fontWeight:"var(--arcd-font-weight-semibold)", color: "var(--arcd-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nome}</p>
                      <p style={{ fontSize:"var(--arcd-type-caption)", color: t.origemProgresso === "diario" ? "var(--arcd-success-text)" : "var(--arcd-text-secondary)" }}>
                        diário: {t.progresso || 0}%{t.origemProgresso !== "diario" ? " (manual)" : ""}
                        {terc && <span style={{ color: "var(--arcd-action-primary)", fontWeight:"var(--arcd-font-weight-semibold)" }}> · terceirizado aprovado: {terc.pct}%</span>}
                      </p>
                    </div>
                    <ProgressPercentageField label={`Percentual de ${t.nome}`} value={confPct[t.id] ?? ""} previous={propostaBoletim(t)}
                      onChange={(/** @type {string} */ value)=>setConfPct(p=>({...p,[t.id]:value}))} />
                    <span style={{ fontSize:"var(--arcd-type-label)", textAlign: "right", fontWeight:"var(--arcd-font-weight-semibold)",
                                   color: div > 0 ? "var(--arcd-action-primary)" : div < 0 ? "var(--arcd-danger-text)" : "var(--arcd-text-secondary)" }}>
                      {div === 0 ? "confere" : `${div > 0 ? "+" : ""}${div}%`}
                    </span>
                  </div>
                );
              })}
            </div>
            <Inp label="Responsável pela medição" value={confResp} onChange={setConfResp}
                 placeholder="Engenheiro / fiscal" />
            <Inp label="Observação" value={confObs} onChange={setConfObs} multiline
                 placeholder="Ex.: alvenaria do 2º pavimento medida a 60%, pendente verga" />
          </div>
        </Modal>
      )}
      {fatModal&&<Modal title={`Faturar medição técnica ${fatModal.numero}`} onClose={()=>setFatModal(null)}>
        <div style={{display:"flex",flexDirection:"column",gap:"var(--arcd-space-2)"}}>
          <div style={{padding:"var(--arcd-space-2)",border:"var(--arcd-border-width) solid color-mix(in srgb, var(--arcd-action-primary) 33%, transparent)",borderRadius:"var(--arcd-radius-control)",background:"color-mix(in srgb, var(--arcd-action-primary) 3%, transparent)"}}>
            <b style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-action-primary)"}}>Avanço físico confirmado: {Number(fatModal.avancoFisico||0).toFixed(1)}%</b>
            <p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)",marginTop:"var(--arcd-space-half)"}}>O valor é calculado pelo contrato e pelo avanço ainda não faturado; não há digitação manual.</p>
          </div>
          {faturamentoPreview?.ok&&"measurement" in faturamentoPreview&&faturamentoPreview.measurement?<div style={{padding:"var(--arcd-space-2)",border:"var(--arcd-border-width) solid color-mix(in srgb, var(--arcd-success-text) 33%, transparent)",borderRadius:"var(--arcd-radius-control)",background:"color-mix(in srgb, var(--arcd-success-text) 3%, transparent)"}}><p style={{fontSize:"var(--arcd-type-caption)",color:"var(--arcd-text-secondary)"}}>Faturamento incremental calculado</p><b style={{fontSize:"var(--arcd-type-card-title)",color:"var(--arcd-success-text)"}}>{fmt(faturamentoPreview.measurement.valorPrevisto)}</b></div>:<p style={{fontSize:"var(--arcd-type-label)",color:"var(--arcd-danger-text)"}}>{faturamentoPreview?.error}</p>}
          <Inp label="Competência" type="month" value={fatForm.competencia} onChange={competencia=>setFatForm(form=>({...form,competencia}))}/>
          <Inp label="Vencimento" type="date" value={fatForm.dataVencimento} onChange={dataVencimento=>setFatForm(form=>({...form,dataVencimento}))}/>
          <div style={{display:"flex",gap:"var(--arcd-space-2)"}}><Btn v="ghost" disabled={billingPending} full onClick={()=>setFatModal(null)}>Cancelar</Btn><Btn v="success" disabled={billingPending} full onClick={confirmarFaturamento}>{billingPending?"Gerando...":"Gerar faturamento"}</Btn></div>
        </div>
      </Modal>}
    </div>
  );
}
