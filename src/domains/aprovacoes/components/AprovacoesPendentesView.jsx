// ===================================================================
// AprovacoesPendentesView — tela "Minhas aprovações pendentes",
// extraída de src/LegacyApp.jsx em 2026-08-18, mesma técnica já usada
// para os módulos anteriores (verbatim, mesma camada de dados, sem
// nova migration/RLS). Ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md.
// ===================================================================

import { useMemo, useState } from "react";
import { referenceTotalOf } from "../../compras/unit-conversion";
import { Btn, Ic, Inp, PageHero } from "../../../legacy/ui.jsx";
import { C } from "../../../legacy/palette.js";
import { SETORES_APROVACAO } from "../../administracao/LegacySettings.jsx";
import { fmt, uid } from "../../../legacy/format.js";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import {pendingApprovalStages,requestsWithoutApprovalFlow} from '../approval-inbox.js';
import {useWorkflow} from '../../../features/workflow/WorkflowNavigation.jsx';
import {podeAcessarAba} from '../../administracao/abas-acesso.js';
import {ScopeNote} from '../../../design-system/patterns/ScopeNote.jsx';
import {FormSection} from '../../../design-system/patterns/FormSection.jsx';
import {EmptyState} from '../../../design-system/patterns/FeedbackState.jsx';
import {Button} from '../../../design-system/primitives/Button.jsx';
import {fmtDateFull} from '../../../legacy/format.js';
import {TaskDisclosure} from '../../../design-system/patterns/TaskDisclosure.jsx';

// Rótulo legível da entidade por trás de uma instância de aprovação - hoje
// só conhece solicitação de compra (único tipo com resolvedores reais); um
// novo tipo cai no fallback genérico até ganhar sua própria descrição aqui.
const rotuloEntidadeAprovacao = (instancia, data) => {
  if (instancia.entidadeTipo === "solicitacaoCompra") {
    const sol = (data.solicitacoesCompra||[]).find(s => s.id === instancia.entidadeId);
    if (!sol) return "Solicitação de compra removida";
    const obraNome = (data.obras||[]).find(o => o.id === sol.obraId)?.name || "Obra";
    const valor = (sol.itens||[]).reduce((s,i)=>s+referenceTotalOf(i),0);
    return `Solicitação ${sol.numero} · ${obraNome} · ${fmt(valor)}`;
  }
  if (instancia.entidadeTipo === "pagamentoTerceiro") {
    const pag = (data.pagsTerceiros||[]).find(p => p.id === instancia.entidadeId);
    if (!pag) return "Pagamento de terceiro removido";
    return `Pagamento · ${pag.tercName||"Terceiro"} · ${fmt(pag.amount)}${pag.medicaoTercId?" · com medição":" · sem medição"}`;
  }
  return SETORES_APROVACAO.find(s => s.v === instancia.entidadeTipo)?.l || instancia.entidadeTipo;
};

// Painel de pendências - qualquer usuário elegível em qualquer etapa "em
// andamento" de qualquer instância, independente do setor. Fica de fora da
// Central do Administrador de propósito: quem decide não precisa ser admin.
function AprovacoesPendentes({ data, showToast, currentUser, dispatchCommand = null }) {
  const [justificativas, setJustificativas] = useState({});
  const {navigate}=useWorkflow();
  const pendentes=useMemo(()=>pendingApprovalStages(data,currentUser),[data.instanciasAprovacao,currentUser]);
  const semFluxo=requestsWithoutApprovalFlow(data,currentUser);
  const abrirSolicitacao=sol=>navigate?.('cmp',{obraId:sol.obraId},{record:{type:'purchaseRequest',id:sol.id}});

  // A decisão é um comando do servidor: ele grava o usuário autenticado como
  // aprovador e confere a elegibilidade (approval-commands.js). Antes, o
  // salvamento genérico desta coleção só funcionava para o administrador.
  const decidir = async (instancia, etapaId, decisao) => {
    const justificativa = justificativas[`${instancia.id}:${etapaId}`] || "";
    if (decisao === "reprovado" && !justificativa.trim()) { showToast("Informe o motivo da reprovação.", "error"); return; }
    if (!dispatchCommand) { showToast("Registrar a decisão exige conexão com o servidor.", "error"); return; }
    const result = await dispatchCommand(() => ({
      type: OPERATIONAL_COMMAND.APPROVAL_DECISION_RECORDED,
      idempotencyKey: `aprovacao-${instancia.id}-${etapaId}-${uid()}`,
      actorId: currentUser?.id||"", actorName: currentUser?.nome||"",
      payload: { instanciaId: instancia.id, etapaId, decisao, justificativa: justificativa.trim() },
    }));
    if (!result?.ok) { showToast(result?.reason||"O servidor não confirmou a decisão.", "error"); return; }
    setJustificativas(j => ({ ...j, [`${instancia.id}:${etapaId}`]: "" }));
    showToast(decisao==="aprovado" ? "Aprovação registrada." : "Reprovação registrada.");
  };

  return <div className="anim" style={{display:"flex",flexDirection:"column",gap:12}}>
    <PageHero eyebrow="Aprovações" title="Minhas aprovações pendentes" description="Etapas de qualquer processo onde você está entre os aprovadores elegíveis."/>
    <ScopeNote title="O que entra nesta fila">Somente etapas formais em andamento em que você é elegível agora.</ScopeNote>
    {!pendentes.length&&<EmptyState title="Nenhuma decisão formal pendente para você" description="Isso não significa que todas as solicitações de Compras estejam aprovadas. Confira abaixo os registros sem fluxo compatível, quando disponíveis no seu acesso."/>}
    {pendentes.map(({instancia,etapas})=><div key={instancia.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:12,display:"flex",flexDirection:"column",gap:9}}>
      <b style={{fontSize:"var(--arcd-type-label)",color:C.text}}>{rotuloEntidadeAprovacao(instancia,data)}</b>
      {instancia.entidadeTipo==='solicitacaoCompra'&&podeAcessarAba(currentUser,'cmp')&&navigate&&(()=>{const sol=(data.solicitacoesCompra||[]).find(s=>s.id===instancia.entidadeId&&(!currentUser.obraId||s.obraId===currentUser.obraId));return sol?<Button variant="secondary" onClick={()=>abrirSolicitacao(sol)}>Consultar solicitação · {sol.numero}</Button>:null;})()}
      {etapas.map(({etapa,resultado})=><div key={etapa.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:10,display:"flex",flexDirection:"column",gap:7}}>
        <p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:C.text}}>{etapa.nome||"Etapa de aprovação"}</p>
        {(resultado.autoaprovacaoDestacada||resultado.semAprovadorEncontrado) && <p style={{fontSize:"var(--arcd-type-caption)",color:C.yellowD}}>{resultado.autoaprovacaoDestacada?"Você é o próprio solicitante - autoaprovação permitida pela política.":"Sem aprovador elegível originalmente - encaminhado à fila do administrador."}</p>}
        <Inp label="Justificativa (obrigatória para reprovar)" value={justificativas[`${instancia.id}:${etapa.id}`]||""} onChange={v=>setJustificativas(j=>({...j,[`${instancia.id}:${etapa.id}`]:v}))} multiline/>
        <div style={{display:"flex",gap:8}}>
          <Btn v="danger" onClick={()=>decidir(instancia,etapa.id,"reprovado")}><Ic n="x"/> Reprovar</Btn>
          <Btn onClick={()=>decidir(instancia,etapa.id,"aprovado")}><Ic n="check"/> Aprovar</Btn>
        </div>
      </div>)}
    </div>)}
    {semFluxo.length>0&&<TaskDisclosure summary={`Solicitações sem fluxo de aprovação compatível (${semFluxo.length})`}><FormSection title="Solicitações sem fluxo de aprovação compatível" description="Não é possível decidir por esta fila. Consulte a solicitação e peça ao administrador para conferir o fluxo; nenhuma aprovação será criada automaticamente.">
     {semFluxo.map(sol=><FormSection key={sol.id} title={sol.numero} description={(data.obras||[]).find(o=>o.id===sol.obraId)?.name||'Obra não disponível'}>
      <p>Solicitante: {sol.solicitanteNome||'Não informado'} · Necessário em: {sol.necessidade?fmtDateFull(sol.necessidade):'Prazo não definido'}</p>
      <p>Próxima ação: conferir o registro e sua configuração de aprovação.</p>
      {navigate&&<Button variant="secondary" onClick={()=>abrirSolicitacao(sol)}>Abrir solicitação · {sol.numero}</Button>}
     </FormSection>)}
    </FormSection></TaskDisclosure>}
    <ScopeNote title="Consultas e decisões">A lista de Compras também contém solicitações em análise e etapas de outras pessoas. Uma mensagem no chat não registra uma aprovação.</ScopeNote>  </div>;
}

export default AprovacoesPendentes;
