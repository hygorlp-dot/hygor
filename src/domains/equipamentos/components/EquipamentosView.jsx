// ===================================================================
// EquipamentosView — tela de Equipamentos extraída de LegacyApp.jsx
//
// Extraído verbatim (mesmo corpo, mesma lógica) de src/LegacyApp.jsx em
// 2026-08-17, mesma técnica já usada para Orçamento, Conciliação,
// Terceiros, Compras, Planejamento, CentralAdministrador, Comercial,
// Folha e Medições — mesma camada de dados (blob company_app_data +
// comandos OPERATIONAL_COMMAND.EQUIPMENT_*), sem nova migration/RLS. Ver
// docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md.
// ===================================================================

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import {
  ARCD_LOGO, Badge, Btn, C, CampoCNPJ, escapeHtml, Ic, Inp, MiniKpi, Modal,
  MONTHS, PageHero, Sel, TabRow, abrirRelatorioPadrao, diasCorridos, fmt,
  fmtDate, fmtDateFull, maiusculoOrcamento, montarRelatorioPadraoHtml,
  today, uid,
} from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { listarBasesReferencia, pesquisarInsumosReferencia } from "../../../api";
import { consolidateReferenceBases as consolidarBasesReferencia } from "../../orcamentos/reference-bases";
import { getDays } from "../../ponto/attendance-engine";
import {
  calcEquipamentosMes, calcEquipamentosPorObra, calcEquipMes, cobrancaLocacao,
  diasLocacaoNoPeriodo, disponibilidadeNoDia, melhorTarifa, PACOTES_TARIFA,
  picoUsoNoPeriodo, tarifasCustoDaLocacao, tarifasDaLocacao, textoComposicao,
} from "../calculations";
import {
  availabilityOnDate, buildEquipmentUnavailability, EQUIPMENT_UNAVAILABILITY_LABEL,
  isActiveUnavailability, rentalAvailability,
} from "../availability";
import { EQUIPMENT_IMAGE_OPTIONS, equipmentImageFor } from "../images";
import { deriveEquipmentLocations, physicalIdentityForRecord } from "../registry";
import { availableRentalTransitions, normalizeRentalState, rentalStateLabel } from "../rental-lifecycle";
import {
  RENTAL_CHECKPOINT_TYPE, rentalDeliveryBalance, rentalDispatchBalance, rentalReturnBalance,
} from "../rental-checkpoints";
import { buildRentalPeriodicCharge, rentalChargeSummary } from "../rental-charges";

const LazyEquipmentBillingReports = lazy(() => import("../EquipmentBillingReports"));

// Linha da grade de um equipamento: um registro por dia do periodo, so para
// enxergar ONDE ele estava. O dinheiro NAO sai daqui: como a tarifa pode ser
// semanal/quinzenal/mensal, o valor do dia isolado nao existe - o total vem
// do contrato inteiro (ver resumoLocacaoEquip).
const gradeLocacaoEquip = (data, equipId, days) => {
  const locacoes = (data.locacoesEquip || []).filter(l => l.equipamentoId === equipId);
  return (days || []).map(iso => {
    // Item de lote pode estar em VARIAS obras no mesmo dia - pegamos todas.
    const doDia = locacoes.filter(l => l.inicio && l.inicio <= iso && (!l.fim || l.fim >= iso));
    if (!doDia.length) {
      return { data: iso, locado: false, obraId: "", locId: "", unidades: 0, obras: [] };
    }
    const unidades = doDia.reduce((s, l) => s + Math.max(1, Number(l.quantidade || 1)), 0);
    const obras = [...new Set(doDia.map(l => l.obraId).filter(Boolean))];
    return {
      data: iso, locado: true,
      // obraId/locId apontam para a principal (maior quantidade), so para a cor
      // e o clique; a lista completa fica em `obras`.
      obraId: doDia.slice().sort((a,b)=>Number(b.quantidade||1)-Number(a.quantidade||1))[0].obraId,
      locId:  doDia.slice().sort((a,b)=>Number(b.quantidade||1)-Number(a.quantidade||1))[0].id,
      unidades, obras, varias: obras.length > 1,
    };
  });
};

// Resumo do periodo: dias locado/ocioso, ocupacao e o resultado financeiro.
// A receita e apurada POR CONTRATO (dias dele dentro do periodo), usando a
// combinacao de tarifas mais barata - nunca somando "diarias".
const resumoLocacaoEquip = (data, equipId, days) => {
  const grade = gradeLocacaoEquip(data, equipId, days);
  const diasLocado = grade.filter(g => g.locado).length;
  const obras = [...new Set(grade.flatMap(g => g.obras || []))];

  const equip = (data.equipamentos || []).find(e => e.id === equipId);
  const pi = days?.[0] || "";
  const pf = days?.[days.length - 1] || "";
  let receita = 0, custo = 0, desconto = 0;
  const porContrato = [];
  if (pi && pf) {
    (data.locacoesEquip || []).filter(l => l.equipamentoId === equipId).forEach(l => {
      const dias = diasLocacaoNoPeriodo(l, pi, pf);
      if (!dias) return;
      const cob = cobrancaLocacao(l, equip, dias);
      const cst = melhorTarifa(tarifasCustoDaLocacao(l, equip), dias).total;
      receita += cob.liquido; custo += cst; desconto += cob.desconto;
      porContrato.push({ locId: l.id, obraId: l.obraId, dias, ...cob, custo: cst });
    });
  }

  return {
    grade, diasLocado,
    diasOciosos: grade.length - diasLocado,
    ocupacaoPct: grade.length ? (diasLocado / grade.length) * 100 : 0,
    receita, custo, desconto, resultado: receita - custo,
    porContrato,
    obras,                       // obras por onde passou no periodo
    transferencias: Math.max(0, obras.length - 1),   // trocou de obra no periodo
  };
};

function EquipmentImage({equipment,preview=false}) {
  const visual=equipmentImageFor(equipment);
  return <figure className={`equipment-photo${preview?" equipment-photo--preview":""}`} data-source={visual.source}>
    <div className="equipment-photo__placeholder" aria-hidden="true">
      <Ic n="wrench" s={preview?24:20}/>
      <span>Escolha o tipo visual</span>
    </div>
    {visual.src&&<img
      key={visual.src}
      src={visual.src}
      alt={`Uma unidade de ${equipment?.nome||"equipamento"}`}
      loading={preview?"eager":"lazy"}
      onError={event=>{event.currentTarget.hidden=true;event.currentTarget.parentElement.dataset.source="missing";}}
    />}
    <figcaption>{visual.label}</figcaption>
  </figure>;
}

export default function Equipamentos({ data, update, showToast, currentUser, dispatchCommand, obraIdFixo="", contexto="engenharia" }) {
  const { formGrid } = useBreakpoint();
  const now = new Date();
  const [aba, setAba] = useState(contexto==="financeiro"?"gestao":"frota");   // frota | gestao | locacoes | manutencao | relatorio
  const [ym, setYm]   = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);

  const [equipModal, setEquipModal] = useState(null);
  const [donoModal,  setDonoModal]  = useState(null);
  const [locModal,   setLocModal]   = useState(null);
  const [manutModal, setManutModal] = useState(null);
  const [indispModal,setIndispModal]=useState(null);
  const [transfModal,setTransfModal]= useState(null);
  const [physicalReview,setPhysicalReview]=useState(null);
  const [rentalCheckpointModal,setRentalCheckpointModal]=useState(null);
  const [rentalAmendmentModal,setRentalAmendmentModal]=useState(null);
  const [rentalReplacementModal,setRentalReplacementModal]=useState(null);
  const [rentalChargeModal,setRentalChargeModal]=useState(null);
  const [rentalMeasurementModal,setRentalMeasurementModal]=useState(null);
  const [rentalInvoiceModal,setRentalInvoiceModal]=useState(null);
  const [busca, setBusca] = useState("");
  const [filtroObraGestao, setFiltroObraGestao] = useState(obraIdFixo||"all");   // filtro da grade de gestao
  const [basesSinapiEquip,setBasesSinapiEquip]=useState([]);
  const [baseSinapiEquipId,setBaseSinapiEquipId]=useState("");
  const [buscaSinapiEquip,setBuscaSinapiEquip]=useState("");
  const [resultadosSinapiEquip,setResultadosSinapiEquip]=useState([]);
  const [carregandoSinapiEquip,setCarregandoSinapiEquip]=useState(false);
  const [avisoSinapiEquip,setAvisoSinapiEquip]=useState("");
  const [salvandoEquipamento,setSalvandoEquipamento]=useState("");

  const obraName = id => (data.obras||[]).find(o=>o.id===id)?.name || "—";
  const donoName = id => id ? ((data.proprietariosEquip||[]).find(p=>p.id===id)?.nome || "Terceiro") : "Empresa";
  const equipName = id => (data.equipamentos||[]).find(e=>e.id===id)?.nome || "—";

  const equipamentosAtivos = (data.equipamentos||[]).filter(e=>e.ativo!==false);
  const equipamentos = equipamentosAtivos
    .filter(e=>[e.nome,e.categoria,e.patrimonio,donoName(e.proprietarioId)].join(" ").toLowerCase().includes(busca.toLowerCase()))
    .sort((a,b)=>a.nome.localeCompare(b.nome));

  const rel = useMemo(()=>calcEquipamentosMes(data, ym), [data, ym]);
  const relPorObra = useMemo(()=>calcEquipamentosPorObra(data, ym), [data, ym]);
  const [fleetYear,fleetMonth]=ym.split("-").map(Number);
  const fleetPeriodDays=getDays(fleetYear,fleetMonth-1);
  const totalUnidades=equipamentosAtivos.reduce((soma,equipamento)=>soma+Math.max(1,Number(equipamento.quantidadeTotal||1)),0);
  const periodRentals=(data.locacoesEquip||[]).filter(locacao=>
    locacao.status!=="cancelada"&&diasLocacaoNoPeriodo(locacao,fleetPeriodDays[0],fleetPeriodDays.at(-1))>0);
  const periodPeakUsage=fleetPeriodDays.reduce((peak,iso)=>Math.max(peak,
    equipamentosAtivos.reduce((sum,equipamento)=>sum+disponibilidadeNoDia(data,equipamento,iso).emUso,0)),0);
  const periodFreeUnits=Math.max(0,totalUnidades-periodPeakUsage);
  const locacoesAtivas=(data.locacoesEquip||[]).filter(locacao=>locacao.status!=="cancelada"&&!locacao.fim);
  const physicalRegistry=useMemo(()=>deriveEquipmentLocations(data,today()),[data]);
  const physicalMigration=Number(data.equipmentRegistryMigration?.version||0)>=1;

  const STATUS_EQUIP = {
    disponivel:{l:"Disponível",c:C.green},
    locado:    {l:"Locado",    c:C.blue},
    manutencao:{l:"Manutenção",c:C.orange},
    bloqueado: {l:"Bloqueado",c:C.red},
    avariado:  {l:"Avariado",c:C.red},
    aguardando_inspecao:{l:"Aguardando inspeção",c:C.orange},
    inativo:   {l:"Inativo",   c:C.muted},
  };

  useEffect(()=>{
    if(!equipModal) return;
    let ativo=true;
    listarBasesReferencia().then(resultado=>{
      if(!ativo) return;
      if(!resultado.ok){
        setAvisoSinapiEquip(resultado.error||"Não foi possível carregar as bases SINAPI.");
        return;
      }
      const bases=consolidarBasesReferencia((resultado.bases||[])
        .filter(base=>base.status==="ready"&&String(base.fonte||"").toUpperCase()==="SINAPI"));
      setBasesSinapiEquip(bases);
      setBaseSinapiEquipId(atual=>equipModal.sinapiReferenciaId||atual||bases[0]?.id||"");
    });
    return()=>{ativo=false;};
  },[!!equipModal]);

  useEffect(()=>{
    if(!equipModal) return;
    let ativo=true;
    const termo=buscaSinapiEquip.trim();
    if(!baseSinapiEquipId||termo.length<2){
      setResultadosSinapiEquip([]);setCarregandoSinapiEquip(false);
      return()=>{ativo=false;};
    }
    setCarregandoSinapiEquip(true);setAvisoSinapiEquip("");
    const timer=window.setTimeout(async()=>{
      const resposta=await pesquisarInsumosReferencia([baseSinapiEquipId],termo,"INSUMO");
      if(!ativo) return;
      if(resposta.ok){
        const palavrasEquip=/EQUIP|MAQUIN|BETONEIRA|ANDAIME|MARTELETE|SERRA|FURADEIRA|COMPACTADOR|GERADOR|GUINCHO|ESCAVADEIRA|RETROESCAVADEIRA|CAMINH[AÃ]O|TRATOR|PLATAFORMA|BOMBA|VIBRADOR|MISTURADOR|ROMPEDOR|ESMERILHADEIRA/i;
        const itens=(resposta.items||[]).filter(item=>{
          const texto=[item.grupo,item.tipo,item.categoria,item.descricao].filter(Boolean).join(" ");
          return item.tipoItem==="INSUMO"&&palavrasEquip.test(texto);
        });
        setResultadosSinapiEquip(itens);
        setAvisoSinapiEquip(resposta.warning||(!itens.length?"Nenhum equipamento encontrado. Tente o nome técnico, como betoneira, compactador ou gerador.":""));
      }else{
        setResultadosSinapiEquip([]);
        setAvisoSinapiEquip(resposta.error||"Não foi possível consultar o SINAPI.");
      }
      setCarregandoSinapiEquip(false);
    },260);
    return()=>{ativo=false;window.clearTimeout(timer);};
  },[buscaSinapiEquip,baseSinapiEquipId,!!equipModal]);

  const gerarPatrimonioSinapi=(codigo)=>{
    const raiz=`EQP-${String(codigo||"SINAPI").replace(/[^a-zA-Z0-9]/g,"").toUpperCase()}`;
    const usados=new Set((data.equipamentos||[]).filter(e=>e.id!==equipModal?.id).map(e=>String(e.patrimonio||"").toUpperCase()));
    if(!usados.has(raiz)) return raiz;
    let numero=2;
    while(usados.has(`${raiz}-${String(numero).padStart(2,"0")}`)) numero++;
    return `${raiz}-${String(numero).padStart(2,"0")}`;
  };

  const selecionarEquipamentoSinapi=(item)=>{
    const base=basesSinapiEquip.find(b=>b.id===baseSinapiEquipId);
    const preco=(base?.desonerado===false?Number(item.precoNao||0):Number(item.precoDes||0))
      ||Number(item.precoDes||0)||Number(item.precoNao||0);
    setEquipModal(f=>({
      ...f,
      nome:f.nome||maiusculoOrcamento(item.descricao||""),
      categoria:f.categoria||"Equipamento SINAPI",
      patrimonio:f.patrimonio||gerarPatrimonioSinapi(item.codigo),
      sinapiReferenciaId:baseSinapiEquipId,
      sinapiFonte:maiusculoOrcamento(item.fonte||base?.fonte||"SINAPI"),
      sinapiCodigo:maiusculoOrcamento(item.codigo||""),
      sinapiDescricao:maiusculoOrcamento(item.descricao||""),
      sinapiUnidade:maiusculoOrcamento(item.unidade||"UN"),
      sinapiPreco:preco,
      sinapiDataBase:item.dataBase||base?.dataBase||"",
      sinapiUf:item.uf||base?.uf||"",
      sinapiDesonerado:base?.desonerado!==false,
    }));
    setBuscaSinapiEquip("");setResultadosSinapiEquip([]);
  };

  // ---- Ações de gravação ----
  const salvarEquip = async(f) => {
    if(!f.nome){ showToast("Informe o nome do equipamento.","error"); return; }
    if(f.imagemUrl&&!/^https:\/\//i.test(String(f.imagemUrl).trim())){
      showToast("A foto original precisa usar uma URL segura iniciada por https://.","error");
      return;
    }
    // Normaliza as quatro tarifas (cobradas e pagas) para numero.
    const numTar = (t) => ({
      dia:Math.max(0,Number(t?.dia||0)), semana:Math.max(0,Number(t?.semana||0)),
      quinzena:Math.max(0,Number(t?.quinzena||0)), mes:Math.max(0,Number(t?.mes||0)),
    });
    const tarifas = numTar(f.tarifas);
    const tarifasCusto = numTar(f.tarifasCusto);
    const eq = { ...f, tarifas, tarifasCusto,
      quantidadeTotal: Math.max(1, Number(f.quantidadeTotal || 1)),
      // Mantem os campos antigos coerentes com a tarifa diaria (retrocompat).
      valorDiaria:tarifas.dia, custoDiaria:tarifasCusto.dia,
      valorAquisicao:Number(f.valorAquisicao||0),
      sinapiPreco:Number(f.sinapiPreco||0) };
    const id=f.id||uid(),isEdit=!!f.id;
    setSalvandoEquipamento("equipamento");
    try{
      const result=await dispatchCommand?.(atual=>{
        const current=(atual.equipamentos||[]).find(item=>item.id===id);
        return {type:OPERATIONAL_COMMAND.EQUIPMENT_SAVED,idempotencyKey:`equipamento-salvar-${id}-${uid()}`,
          expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{equipment:{...eq,id,ativo:current?.ativo!==false}}};
      });
      if(!result?.ok){showToast(result?.reason||"Não foi possível salvar o equipamento.","error");return;}
      setEquipModal(null); showToast(isEdit?"Equipamento atualizado.":"Equipamento cadastrado.");
    }catch(error){
      showToast(error?.message||"O servidor não respondeu ao cadastrar o equipamento.","error");
    }finally{
      setSalvandoEquipamento("");
    }
  };
  const materializarCadastroFisico=async()=>{
    if(!window.confirm("Criar o cadastro separado de modelos, lotes e unidades? Os equipamentos e históricos atuais serão preservados."))return;
    setSalvandoEquipamento("cadastro-fisico");
    try{
      const result=await dispatchCommand?.(atual=>({
        type:OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_MIGRATED,
        idempotencyKey:`cadastro-fisico-equipamentos-${uid()}`,
        expectedVersion:Number(atual.equipmentRegistryMigration?.version||0),
        actorId:currentUser?.id||"",actorName:currentUser?.nome||"",payload:{},
      }));
      if(!result?.ok){showToast(result?.reason||"Não foi possível materializar o cadastro físico.","error");return;}
      showToast("Cadastro físico criado. Equipamentos e históricos legados foram preservados.");
    }catch(error){showToast(error?.message||"O servidor não respondeu ao criar o cadastro físico.","error");}
    finally{setSalvandoEquipamento("");}
  };
  const salvarRevisaoFisica=async form=>{
    const source=(data.equipamentos||[]).find(item=>String(item.id)===String(form.equipmentId));
    if(!source){showToast("Equipamento de origem não encontrado.","error");return;}
    const tags=String(form.assetTags||"").split(/[;,\n]/).map(value=>value.trim()).filter(Boolean);
    const result=await dispatchCommand?.(atual=>({
      type:OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_CLASSIFIED,
      idempotencyKey:`cadastro-fisico-classificar-${form.equipmentId}-${uid()}`,
      expectedVersion:Number(atual.equipmentRegistryRevision||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{equipmentId:form.equipmentId,kind:form.kind,
        lot:{id:`legacy-lot:${form.equipmentId}`,quantity:Number(source.quantidadeTotal||1),unit:form.unit||"un",lotCode:form.lotCode||`LOTE-${form.equipmentId}`},
        units:tags.map((assetTag,index)=>({id:`unit:${form.equipmentId}:${index+1}`,assetTag,status:"disponivel"}))},
    }));
    if(!result?.ok){showToast(result?.reason||"Não foi possível revisar a classificação física.","error");return;}
    setPhysicalReview(null);showToast("Classificação física revisada e salva.");
  };
  const excluirEquip = async(e) => {
    const locacaoAberta=(data.locacoesEquip||[]).some(locacao=>
      locacao.equipamentoId===e.id&&locacao.status!=="cancelada"&&!locacao.fim);
    if(locacaoAberta){
      showToast("Encerre a locação em aberto antes de excluir o equipamento.","error");
      return;
    }
    const possuiHistorico=(data.locacoesEquip||[]).some(locacao=>locacao.equipamentoId===e.id)
      ||(data.manutencoesEquip||[]).some(manutencao=>manutencao.equipamentoId===e.id)
      ||(data.transferenciasEquip||[]).some(transferencia=>transferencia.equipamentoId===e.id);
    const explicacao=possuiHistorico
      ?"Ele sairá da frota ativa, mas locações, cobranças e manutenções anteriores serão preservadas."
      :"Ele sairá da frota ativa.";
    if(!window.confirm(`Excluir "${e.nome}"?\n\n${explicacao}`)) return;
    setSalvandoEquipamento("exclusao");
    try{
      const result=await dispatchCommand?.(atual=>{
        const current=(atual.equipamentos||[]).find(item=>item.id===e.id);
        return {type:OPERATIONAL_COMMAND.EQUIPMENT_DEACTIVATED,idempotencyKey:`equipamento-inativar-${e.id}-${uid()}`,
          expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{equipmentId:e.id,reason:"Excluído da frota pelo cadastro de equipamentos"}};
      });
      if(!result?.ok){showToast(result?.reason||"Não foi possível excluir o equipamento.","error");return;}
      setEquipModal(null);
      showToast(possuiHistorico?"Equipamento excluído da frota. O histórico foi preservado.":"Equipamento excluído da frota.");
    }catch(error){
      showToast(error?.message||"O servidor não respondeu ao excluir o equipamento.","error");
    }finally{
      setSalvandoEquipamento("");
    }
  };

  const salvarDono = (f) => {
    if(!f.nome){ showToast("Informe o nome do proprietário.","error"); return; }
    const lista = f.id
      ? (data.proprietariosEquip||[]).map(x=>x.id===f.id?{...x,...f}:x)
      : [...(data.proprietariosEquip||[]), {...f, id:uid(), tipo:"terceiro", ativo:true}];
    update({...data, proprietariosEquip:lista});
    setDonoModal(null); showToast("Proprietário salvo.");
  };

  const salvarLoc = async(f) => {
    if(!f.equipamentoId||!f.obraId||!f.inicio){ showToast("Escolha equipamento, obra e data de início.","error"); return; }
    const numTar = (t) => ({
      dia:Math.max(0,Number(t?.dia||0)), semana:Math.max(0,Number(t?.semana||0)),
      quinzena:Math.max(0,Number(t?.quinzena||0)), mes:Math.max(0,Number(t?.mes||0)),
    });
    const loc = { ...f,
      quantidade: Math.max(1, Number(f.quantidade || 1)),
      equipmentUnitIds:Array.isArray(f.equipmentUnitIds)?f.equipmentUnitIds:[],
      equipmentLotId:f.equipmentLotId||"",
      tarifas:numTar(f.tarifas), tarifasCusto:numTar(f.tarifasCusto),
      valorDiaria:Number(f.valorDiaria||0), custoDiaria:Number(f.custoDiaria||0),
      descontoPct:Number(f.descontoPct||0), descontoValor:Number(f.descontoValor||0) };
    const id=f.id||uid(),isEdit=!!f.id;
    setSalvandoEquipamento("locacao");
    try{
      const result=await dispatchCommand?.(atual=>{
        const current=(atual.locacoesEquip||[]).find(item=>item.id===id);
        return {type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_SAVED,idempotencyKey:`locacao-equipamento-salvar-${id}-${uid()}`,
          expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{rental:{...loc,id}}};
      });
      if(!result?.ok){showToast(result?.reason||"Não foi possível salvar a locação.","error");return;}
      setLocModal(null); showToast(isEdit?"Locação atualizada.":"Locação registrada.");
    }catch(error){
      showToast(error?.message||"O servidor não respondeu ao registrar a locação.","error");
    }finally{
      setSalvandoEquipamento("");
    }
  };
  const encerrarLoc = async(l) => {
    const fim = window.prompt("Data de término (AAAA-MM-DD):", today());
    if(!fim) return;
    const result=await dispatchCommand?.(atual=>{
      const current=(atual.locacoesEquip||[]).find(item=>item.id===l.id);
      return {type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CLOSED,idempotencyKey:`locacao-equipamento-encerrar-${l.id}-${uid()}`,
        expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{rentalId:l.id,endDate:fim}};
    });
    if(!result?.ok){showToast(result?.reason||"Não foi possível encerrar a locação.","error");return;}
    showToast("Locação encerrada.");
  };
  const excluirLoc = async(l) => {
    const equipamento=equipName(l.equipamentoId);
    const obra=obraName(l.obraId);
    if(!window.confirm(`Excluir a locação de "${equipamento}" em "${obra}"?\n\nEla deixará de compor a ocupação e a cobrança dos relatórios. O cancelamento permanecerá no histórico de auditoria.`))return;
    setSalvandoEquipamento("exclusao-locacao");
    try{
      const result=await dispatchCommand?.(atual=>{
        const current=(atual.locacoesEquip||[]).find(item=>item.id===l.id);
        return {type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CANCELLED,
          idempotencyKey:`locacao-equipamento-cancelar-${l.id}-${uid()}`,
          expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{rentalId:l.id,reason:"Excluída pelo controle de locações"}};
      });
      if(!result?.ok){showToast(result?.reason||"Não foi possível excluir a locação.","error");return;}
      setLocModal(null);showToast("Locação excluída. A frota e os relatórios foram atualizados.");
    }catch(error){
      showToast(error?.message||"O servidor não respondeu ao excluir a locação.","error");
    }finally{
      setSalvandoEquipamento("");
    }
  };
  const transicionarLocacao=async(l,nextState)=>{
    setSalvandoEquipamento(`transicao-${l.id}`);
    try{
      const result=await dispatchCommand?.(atual=>{
        const current=(atual.locacoesEquip||[]).find(item=>item.id===l.id);
        return {type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_TRANSITIONED,
          idempotencyKey:`locacao-equipamento-transicao-${l.id}-${nextState}-${uid()}`,
          expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{rentalId:l.id,nextState,reason:""}};
      });
      if(!result?.ok){showToast(result?.reason||"Não foi possível avançar o ciclo da locação.","error");return;}
      showToast(`Locação atualizada para ${rentalStateLabel(nextState)}.`);
    }catch(error){showToast(error?.message||"O servidor não respondeu ao atualizar a locação.","error");}
    finally{setSalvandoEquipamento("");}
  };
  const CHECKPOINT_BY_STATE={ready_for_dispatch:RENTAL_CHECKPOINT_TYPE.SEPARATION,
    in_transport:RENTAL_CHECKPOINT_TYPE.DISPATCH,delivered:RENTAL_CHECKPOINT_TYPE.DELIVERY,
    returned:RENTAL_CHECKPOINT_TYPE.RETURN,under_inspection:RENTAL_CHECKPOINT_TYPE.INSPECTION};
  const CHECKPOINT_LABEL={separation:"Separação",partial_dispatch:"Expedição parcial",dispatch:"Expedição",
    partial_delivery:"Entrega parcial",delivery:"Entrega",partial_return:"Devolução parcial",return:"Devolução",inspection:"Inspeção",adjustment:"Conclusão do ajuste"};
  const prepararTransicaoLocacao=(rental,nextState)=>{
    const type=CHECKPOINT_BY_STATE[nextState];
    const recorded=(rental.rentalCheckpoints||[]).some(item=>item.type===type&&item.status!=="cancelled");
    if(!type||recorded){transicionarLocacao(rental,nextState);return;}
    const work=(data.obras||[]).find(item=>item.id===rental.obraId);
    const balance=type===RENTAL_CHECKPOINT_TYPE.DISPATCH?rentalDispatchBalance(rental,rental.rentalCheckpoints||[])
      :type===RENTAL_CHECKPOINT_TYPE.DELIVERY?rentalDeliveryBalance(rental,rental.rentalCheckpoints||[])
      :type===RENTAL_CHECKPOINT_TYPE.RETURN?rentalReturnBalance(rental,rental.rentalCheckpoints||[]):null;
    const movedIds=balance?.movedUnitIds||balance?.returnedUnitIds||[];
    const availableUnitIds=(rental.equipmentUnitIds||[]).filter(id=>!movedIds.includes(String(id)));
    setRentalCheckpointModal({rentalId:rental.id,nextState,type,date:today(),quantity:balance?.remainingQuantity||Number(rental.quantidade||1),
      equipmentUnitIds:balance?availableUnitIds:[...(rental.equipmentUnitIds||[])],accessories:"",hourMeter:"",fuel:"",condition:"",
      photos:"",responsible:currentUser?.nome||"",receivedBy:"",address:work?.address||work?.endereco||"",
      acceptance:"",cleaning:"",damages:"",missingItems:"",needsAdjustment:false,notes:""});
  };
  const prepararDevolucaoParcial=rental=>{
    const balance=rentalReturnBalance(rental,rental.rentalCheckpoints||[]);
    const availableUnitIds=(rental.equipmentUnitIds||[]).filter(id=>!balance.returnedUnitIds.includes(String(id)));
    const work=(data.obras||[]).find(item=>item.id===rental.obraId);
    setRentalCheckpointModal({rentalId:rental.id,nextState:"pickup_requested",type:RENTAL_CHECKPOINT_TYPE.PARTIAL_RETURN,
      date:today(),quantity:1,equipmentUnitIds:availableUnitIds.length?[availableUnitIds[0]]:[],accessories:"",hourMeter:"",
      fuel:"",condition:"",photos:"",responsible:currentUser?.nome||"",receivedBy:"",address:work?.address||work?.endereco||"",
      acceptance:"",cleaning:"",damages:"",missingItems:"",needsAdjustment:false,notes:""});
  };
  const prepararMovimentacaoParcial=(rental,type)=>{
    const balance=type===RENTAL_CHECKPOINT_TYPE.PARTIAL_DISPATCH?rentalDispatchBalance(rental,rental.rentalCheckpoints||[])
      :rentalDeliveryBalance(rental,rental.rentalCheckpoints||[]);
    const availableUnitIds=(rental.equipmentUnitIds||[]).filter(id=>!balance.movedUnitIds.includes(String(id)));
    const work=(data.obras||[]).find(item=>item.id===rental.obraId);
    setRentalCheckpointModal({rentalId:rental.id,nextState:rental.lifecycleState,type,date:today(),quantity:1,
      equipmentUnitIds:availableUnitIds.length?[availableUnitIds[0]]:[],accessories:"",hourMeter:"",fuel:"",condition:"",
      photos:"",responsible:currentUser?.nome||"",receivedBy:"",address:work?.address||work?.endereco||"",
      acceptance:"",cleaning:"",damages:"",missingItems:"",needsAdjustment:false,notes:""});
  };
  const prepararConclusaoAjuste=rental=>setRentalCheckpointModal({rentalId:rental.id,nextState:"awaiting_adjustment",
    type:RENTAL_CHECKPOINT_TYPE.ADJUSTMENT,date:today(),quantity:Number(rental.quantidade||1),equipmentUnitIds:[...(rental.equipmentUnitIds||[])],
    accessories:"",hourMeter:"",fuel:"",condition:"",photos:"",responsible:currentUser?.nome||"",receivedBy:"",address:"",
    acceptance:"",cleaning:"",damages:"",missingItems:"",needsAdjustment:false,notes:""});
  const salvarChecklistLocacao=async form=>{
    setSalvandoEquipamento(`checklist-${form.rentalId}`);
    try{
      const result=await dispatchCommand?.(atual=>{
        const current=(atual.locacoesEquip||[]).find(item=>item.id===form.rentalId);
        return {type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHECKPOINT_RECORDED,
          idempotencyKey:`locacao-checklist-${form.rentalId}-${form.type}-${uid()}`,
          expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{rentalId:form.rentalId,checkpoint:{...form,quantity:Number(form.quantity||0),
            hourMeter:Number(form.hourMeter||0),accessories:String(form.accessories||"").split(/[,;\n]/).map(value=>value.trim()).filter(Boolean),
            photos:String(form.photos||"").split(/\n/).map(value=>value.trim()).filter(Boolean),
            damages:String(form.damages||"").split(/[,;\n]/).map(value=>value.trim()).filter(Boolean),
            missingItems:String(form.missingItems||"").split(/[,;\n]/).map(value=>value.trim()).filter(Boolean),
            needsAdjustment:form.needsAdjustment===true||form.needsAdjustment==="true"}}};
      });
      if(!result?.ok){showToast(result?.reason||"Não foi possível salvar o checklist.","error");return;}
      setRentalCheckpointModal(null);showToast(`${CHECKPOINT_LABEL[form.type]} registrada. A locação já pode avançar.`);
    }catch(error){showToast(error?.message||"O servidor não respondeu ao salvar o checklist.","error");}
    finally{setSalvandoEquipamento("");}
  };
  const prepararAditivoLocacao=rental=>setRentalAmendmentModal({
    rentalId:rental.id,type:"extension",currentEnd:rental.plannedEndDate||rental.dataPrevistaFim||rental.inicio||"",
    newEndDate:"",startDate:"",endDate:"",reason:"",
  });
  const salvarAditivoLocacao=async form=>{
    setSalvandoEquipamento(`aditivo-${form.rentalId}`);
    try{
      const result=await dispatchCommand?.(atual=>{
        const current=(atual.locacoesEquip||[]).find(item=>item.id===form.rentalId);
        return {type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_AMENDED,
          idempotencyKey:`locacao-aditivo-${form.rentalId}-${form.type}-${uid()}`,
          expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
          payload:{rentalId:form.rentalId,amendment:{type:form.type,newEndDate:form.newEndDate,
            startDate:form.startDate,endDate:form.endDate,reason:form.reason}}};
      });
      if(!result?.ok){showToast(result?.reason||"Não foi possível salvar o aditivo.","error");return;}
      setRentalAmendmentModal(null);showToast(form.type==="renewal"?"Renovação registrada.":"Prorrogação registrada.");
    }catch(error){showToast(error?.message||"O servidor não respondeu ao salvar o aditivo.","error");}
    finally{setSalvandoEquipamento("");}
  };
  const salvarSubstituicaoLocacao=async form=>{
    setSalvandoEquipamento(`substituicao-${form.rentalId}`);
    try{const result=await dispatchCommand?.(atual=>{const current=(atual.locacoesEquip||[]).find(item=>item.id===form.rentalId);return {
      type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_UNIT_REPLACED,idempotencyKey:`locacao-substituicao-${form.rentalId}-${uid()}`,
      expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{rentalId:form.rentalId,replacement:form}};});
      if(!result?.ok){showToast(result?.reason||"Não foi possível substituir a unidade.","error");return;}
      setRentalReplacementModal(null);showToast("Unidade substituída. O histórico da locação foi preservado.");
    }catch(error){showToast(error?.message||"O servidor não respondeu ao substituir a unidade.","error");}
    finally{setSalvandoEquipamento("");}
  };
  const salvarLinhaCobranca=async form=>{
    const quantity=Number(String(form.quantity||"").replace(",",".")),unitPrice=Number(String(form.unitPrice||"").replace(",","."));
    const discount=Number(String(form.discountAmount||0).replace(",",".")),tax=Number(String(form.taxAmount||0).replace(",","."));
    if(!form.description||!form.unit||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(unitPrice)||unitPrice<0){showToast("Preencha descrição, quantidade, unidade e preço.","error");return;}
    const id=uid();setSalvandoEquipamento(`cobranca-${form.rentalId}`);
    try{const result=await dispatchCommand?.(atual=>({type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_ITEM_SAVED,
      idempotencyKey:`locacao-cobranca-${id}`,expectedVersion:0,actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{chargeItem:{id,rentalId:form.rentalId,workId:form.workId,type:form.type,description:form.description,
        quantityMilli:Math.round(quantity*1000),unit:form.unit,unitPriceCents:Math.round(unitPrice*100),
        discountAmountCents:Math.round(Math.max(0,discount)*100),taxAmountCents:Math.round(Math.max(0,tax)*100),
        competence:form.competence,source:"manual",status:"open"}}}));
      if(!result?.ok){showToast(result?.reason||"Não foi possível salvar a linha de cobrança.","error");return;}
      setRentalChargeModal(null);showToast("Linha de cobrança adicionada sem emitir faturamento.");
    }catch(error){showToast(error?.message||"O servidor não respondeu ao salvar a cobrança.","error");}
    finally{setSalvandoEquipamento("");}
  };
  const prepararMedicaoLocacao=rental=>{
    const competence=String(rental.inicio||ym).slice(0,7)||ym,[year,month]=competence.split("-").map(Number);
    const monthEnd=`${competence}-${String(new Date(year,month,0).getDate()).padStart(2,"0")}`;
    setRentalMeasurementModal({rentalId:rental.id,competence,utilizationStart:rental.inicio||`${competence}-01`,
      utilizationEnd:rental.fim||rental.plannedEndDate||monthEnd,fixedDiscount:"0"});
  };
  const salvarMedicaoLocacao=async form=>{
    setSalvandoEquipamento(`medicao-${form.rentalId}`);
    try{const result=await dispatchCommand?.(atual=>{const current=(atual.locacoesEquip||[]).find(item=>item.id===form.rentalId);return {
      type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_CHARGE_MEASURED,idempotencyKey:`locacao-medicao-${form.rentalId}-${form.competence}-${uid()}`,
      expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{rentalId:form.rentalId,competence:form.competence,utilizationStart:form.utilizationStart,
        utilizationEnd:form.utilizationEnd,fixedDiscountCents:Math.round(Math.max(0,Number(String(form.fixedDiscount||0).replace(",","."))||0)*100)}};});
      if(!result?.ok){showToast(result?.reason||"Não foi possível medir a cobrança.","error");return;}
      setRentalMeasurementModal(null);showToast("Cobrança medida. Emissão e vencimento continuam pendentes.");
    }catch(error){showToast(error?.message||"O servidor não respondeu ao medir a cobrança.","error");}
    finally{setSalvandoEquipamento("");}
  };
  const prepararFaturaLocacao=rental=>{
    const eligible=(data.rentalChargeItems||[]).filter(item=>item.rentalId===rental.id&&["open","measured"].includes(item.status));
    if(!eligible.length){showToast("Não existem linhas abertas ou medidas para faturar.","error");return;}
    const competence=eligible[0].competence,items=eligible.filter(item=>item.competence===competence),issueDate=today(),due=new Date(`${issueDate}T00:00:00Z`);due.setUTCDate(due.getUTCDate()+10);
    setRentalInvoiceModal({rentalId:rental.id,workId:rental.obraId,competence,number:`FAT-${competence.replace("-","")}-${String((data.rentalInvoices||[]).length+1).padStart(3,"0")}`,
      issueDate,dueDate:due.toISOString().slice(0,10),chargeItemIds:items.map(item=>item.id)});
  };
  const salvarFaturaLocacao=async form=>{
    const id=uid();setSalvandoEquipamento(`fatura-${form.rentalId}`);
    try{const result=await dispatchCommand?.(()=>({type:OPERATIONAL_COMMAND.EQUIPMENT_RENTAL_INVOICE_ISSUED,
      idempotencyKey:`locacao-fatura-${id}`,expectedVersion:0,actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
      payload:{invoice:{...form,id}}}));
      if(!result?.ok){showToast(result?.reason||"Não foi possível emitir a fatura.","error");return;}
      setRentalInvoiceModal(null);showToast("Fatura emitida com saldo em aberto. Nenhum recebimento foi registrado.");
    }catch(error){showToast(error?.message||"O servidor não respondeu ao emitir a fatura.","error");}
    finally{setSalvandoEquipamento("");}
  };

  const salvarManut = async(f) => {
    if(!f.equipamentoId||!f.data||!f.custo){ showToast("Preencha equipamento, data e custo.","error"); return; }
    const m = { ...f, custo:Number(f.custo||0) };
    const id=f.id||uid();
    const result=await dispatchCommand?.(atual=>{
      const current=(atual.manutencoesEquip||[]).find(item=>item.id===id);
      return {type:OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED,idempotencyKey:`manutencao-equipamento-salvar-${id}-${uid()}`,
        expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{maintenance:{...m,id}}};
    });
    if(!result?.ok){showToast(result?.reason||"Não foi possível salvar a manutenção.","error");return;}
    setManutModal(null); showToast("Manutenção registrada.");
  };

  const salvarIndisponibilidade=async(f)=>{
    if(!f.equipmentId||!f.startDate||!f.endDate||!f.reason){showToast("Preencha equipamento, período e motivo.","error");return;}
    const id=f.id||uid();
    const isReservation=f.type==="reservation";
    const result=await dispatchCommand?.(atual=>{
      const current=(atual.equipmentUnavailability||[]).find(item=>item.id===id);
      return {type:isReservation?OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_SAVED:OPERATIONAL_COMMAND.EQUIPMENT_UNAVAILABILITY_SAVED,
        idempotencyKey:`indisponibilidade-equipamento-salvar-${id}-${uid()}`,
        expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{unavailability:{...f,id,quantity:Math.max(1,Number(f.quantity||1))}}};
    });
    if(!result?.ok){showToast(result?.reason||"Não foi possível salvar a indisponibilidade.","error");return;}
    setIndispModal(null);showToast(isReservation?"Reserva registrada.":"Indisponibilidade registrada.");
  };

  const cancelarIndisponibilidade=async(item)=>{
    if(!window.confirm(`Cancelar ${EQUIPMENT_UNAVAILABILITY_LABEL[item.type]||"indisponibilidade"}: ${item.reason}?`))return;
    const isReservation=item.type==="reservation";
    const result=await dispatchCommand?.(atual=>{
      const current=(atual.equipmentUnavailability||[]).find(entry=>entry.id===item.id);
      return {type:isReservation?OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_CANCELLED:OPERATIONAL_COMMAND.EQUIPMENT_UNAVAILABILITY_CANCELLED,
        idempotencyKey:`indisponibilidade-equipamento-cancelar-${item.id}-${uid()}`,
        expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{unavailabilityId:item.id,reason:"Cancelada no calendário de disponibilidade"}};
    });
    if(!result?.ok){showToast(result?.reason||"Não foi possível cancelar a indisponibilidade.","error");return;}
    showToast("Indisponibilidade cancelada.");
  };

  const salvarTransf = async(f) => {
    if(!f.equipamentoId||!f.paraObraId){ showToast("Escolha o equipamento e a obra de destino.","error"); return; }
    const id=uid();
    const result=await dispatchCommand?.(atual=>{
      const current=(atual.equipamentos||[]).find(item=>item.id===f.equipamentoId);
      return {type:OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED,idempotencyKey:`equipamento-transferir-${f.equipamentoId}-${uid()}`,
        expectedVersion:Number(current?.version||0),actorId:currentUser?.id||"",actorName:currentUser?.nome||"",
        payload:{transfer:{...f,id,data:f.data||today()}}};
    });
    if(!result?.ok){showToast(result?.reason||"Não foi possível transferir o equipamento.","error");return;}
    setTransfModal(null); showToast(`Transferido para ${obraName(f.paraObraId)}.`);
  };

  // ---- Formulários vazios ----
  const equipVazio = { nome:"", categoria:"", patrimonio:"", proprietarioId:"", tarifas:{dia:"",semana:"",quinzena:"",mes:""}, tarifasCusto:{dia:"",semana:"",quinzena:"",mes:""}, quantidadeTotal:1, valorDiaria:"", custoDiaria:"", status:"disponivel", obraAtualId:obraIdFixo||"", aquisicao:"", valorAquisicao:"", sinapiReferenciaId:"", sinapiFonte:"", sinapiCodigo:"", sinapiDescricao:"", sinapiUnidade:"", sinapiPreco:"", sinapiDataBase:"", sinapiUf:"", sinapiDesonerado:true, imagemUrl:"", imagemTipo:"auto", obs:"" };
  const donoVazio  = { nome:"", documento:"", telefone:"", email:"", chavePix:"", obs:"" };
  const locVazio   = { equipamentoId:"", equipmentLotId:"",equipmentUnitIds:[],obraId:obraIdFixo||"", inicio:today(), fim:"", quantidade:1, tarifaNegociada:false, regraTarifaria:"best_combination", tarifas:{dia:0,semana:0,quinzena:0,mes:0}, tarifasCusto:{dia:0,semana:0,quinzena:0,mes:0}, valorDiaria:"", custoDiaria:"", descontoPct:"", descontoValor:"", obs:"" };
  const manutVazio = { equipamentoId:"",equipmentLotId:"",equipmentUnitIds:[],data:today(), inicio:today(), fim:today(), quantidade:1, status:"programada", tipo:"corretiva", descricao:"", custo:"", pagoPor:"empresa", fornecedor:"", obs:"" };
  const indispVazio={equipmentId:"",equipmentUnitId:"",quantity:1,type:"reservation",startDate:today(),endDate:today(),reason:"",status:"ativa",workId:""};
  const transfVazio= { equipamentoId:"",equipmentLotId:"",equipmentUnitIds:[],quantidade:1,deLocationId:"depot",paraObraId:"", data:today(), responsavel:"", obs:"" };

  const obraOpts  = [{v:"",l:"Selecione a obra"}, ...(data.obras||[]).map(o=>({v:o.id,l:o.name}))];
  const equipOpts = [{v:"",l:"Selecione o equipamento"}, ...(data.equipamentos||[]).filter(e=>e.ativo!==false).map(e=>({
    v:e.id,l:[e.nome,e.patrimonio||e.categoria||"sem patrimônio",donoName(e.proprietarioId)].join(" · "),
  }))];
  const donoOpts  = [{v:"",l:"Empresa (própria)"}, ...(data.proprietariosEquip||[]).filter(p=>p.ativo!==false).map(p=>({v:p.id,l:p.nome}))];

  const mesLabel = (() => { const [y,m]=ym.split("-"); return `${MONTHS[Number(m)-1]} ${y}`; })();
  const mesesOpts = Array.from({length:12},(_,i)=>{ const d=new Date(now.getFullYear(),now.getMonth()-i,1); const v=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; return {v,l:`${MONTHS[d.getMonth()]} ${d.getFullYear()}`}; });

  return (
    <div className={`anim equipment-center ${contexto==="financeiro"?"is-financial":""}`} style={{display:"flex",flexDirection:"column",gap:12}}>
      <PageHero
        eyebrow={contexto==="financeiro"?"Financeiro · ativos e locações":"Engenharia"}
        title={contexto==="financeiro"?"Central de locação de equipamentos":"Equipamentos"}
        description={contexto==="financeiro"
          ?"Disponibilidade, alocação, manutenção e cobrança por obra em uma única operação auditável."
          :`${equipamentosAtivos.length} equipamento(s) ativo(s) · custos integrados à obra.`}
        stats={contexto==="financeiro"?[
          {label:"Frota ativa",value:`${totalUnidades} un.`,detail:`${equipamentosAtivos.length} cadastro(s)`,color:C.text},
          {label:"Em uso no mês",value:`${periodPeakUsage} un.`,detail:`${periodRentals.length} locação(ões) em ${mesLabel}`,color:periodPeakUsage?C.blue:C.muted},
          {label:"Livres no mês",value:`${periodFreeUnits} un.`,detail:"Disponibilidade no pico de ocupação",color:periodFreeUnits?C.green:C.orange},
          {label:"Receita no mês",value:fmt(rel.total.receita),detail:mesLabel,color:C.green},
        ]:undefined}
        actions={<>
          {contexto==="financeiro"&&<Btn size="sm" disabled={!equipamentosAtivos.length} onClick={()=>setLocModal(locVazio)}
            title={equipamentosAtivos.length?"Criar uma nova locação":"Cadastre um equipamento antes de criar a locação"}>
            <Ic n="plus"/> Nova locação
          </Btn>}
          {contexto==="financeiro"&&<Btn size="sm" v="ghost" disabled={!equipamentosAtivos.length} onClick={()=>setIndispModal(indispVazio)}><Ic n="calendar"/> Reservar / bloquear</Btn>}
          <Btn size="sm" v={contexto==="financeiro"?"ghost":"primary"} onClick={()=>setEquipModal(equipVazio)}><Ic n="wrench"/> Novo equipamento</Btn>
          <Btn size="sm" v="ghost" onClick={()=>setDonoModal(donoVazio)}><Ic n="user"/> Proprietários</Btn>
        </>}
      />

      {/* Abas internas */}
      <TabRow tabs={[
        {v:"frota",l:"Frota",icon:"wrench",count:equipamentosAtivos.length},
        {v:"fisico",l:"Cadastro físico",icon:"layers",count:physicalRegistry.units.length+physicalRegistry.lots.length},
        {v:"gestao",l:"Mapa de ocupação",icon:"calendar",count:locacoesAtivas.length},
        {v:"locacoes",l:"Locações",icon:"building",count:(data.locacoesEquip||[]).length},
        {v:"manutencao",l:"Manutenção",icon:"settings",count:(data.manutencoesEquip||[]).length},
        {v:"relatorio",l:"Cobrança por obra",icon:"chart"},
      ]} active={aba} onChange={setAba}/>

      {/* ---------- FROTA ---------- */}
      {aba==="frota" && <>
        <div className="equipment-toolbar">
          <Inp label="Pesquisar na frota" value={busca} onChange={setBusca} placeholder="Nome, categoria, patrimônio ou proprietário..."/>
          <Sel label="Competência dos resultados" value={ym} onChange={setYm} options={mesesOpts}/>
        </div>
        {equipamentos.length===0
          ? <div className="equipment-empty-state">
              <span><Ic n="wrench" s={19}/></span>
              <div><p>{busca?"Nenhum equipamento encontrado":"Nenhum equipamento ativo"}</p><small>{busca?"Revise o termo pesquisado ou limpe o campo.":"Cadastre o primeiro item da frota para começar a controlar locações e cobranças."}</small></div>
              {!busca&&<Btn size="sm" onClick={()=>setEquipModal(equipVazio)}><Ic n="plus"/> Cadastrar equipamento</Btn>}
            </div>
          : <div className="equipment-fleet-grid" style={{gridTemplateColumns:formGrid(2)}}>
            {equipamentos.map(e=>{
              const st = STATUS_EQUIP[e.status]||STATUS_EQUIP.disponivel;
              const proprio = !e.proprietarioId;
              const fin = calcEquipMes(data, e.id, ym);
              return (
                <article key={e.id} className="equipment-fleet-card" data-status={e.status||"disponivel"}>
                  <EquipmentImage equipment={e}/>
                  <div className="equipment-fleet-card__body">
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:6}}>
                    <div style={{minWidth:0}}>
                      <p style={{fontSize:13,fontWeight:800,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.nome}</p>
                      <p style={{fontSize:9.5,color:C.muted}}>{e.categoria||"Sem categoria"}{e.patrimonio?` · ${e.patrimonio}`:""}</p>
                    </div>
                    <span style={{fontSize:8.5,fontWeight:800,color:st.c,background:`${st.c}14`,padding:"2px 7px",borderRadius:99,flexShrink:0,textTransform:"uppercase",height:"fit-content"}}>{st.l}</span>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:7}}>
                    <span style={{fontSize:8.5,fontWeight:700,color:proprio?C.green:C.purple,background:`${proprio?C.green:C.purple}12`,padding:"2px 6px",borderRadius:5}}>{proprio?"PRÓPRIO":`DE ${donoName(e.proprietarioId).toUpperCase()}`}</span>
                    {e.sinapiCodigo&&<span style={{fontSize:8.5,fontWeight:750,color:C.blue,background:`${C.blue}0C`,border:`1px solid ${C.blue}28`,padding:"2px 6px",borderRadius:5}}>SINAPI {e.sinapiCodigo}</span>}
                    {e.status==="locado" && e.obraAtualId && <span style={{fontSize:8.5,color:C.muted,padding:"2px 0"}}>em {obraName(e.obraAtualId)}</span>}
                  </div>
                  {e.sinapiCodigo&&Number(e.valorAquisicao||0)>0&&Number(e.sinapiPreco||0)>0&&(()=>{
                    const variacao=(Number(e.valorAquisicao)-Number(e.sinapiPreco))/Number(e.sinapiPreco)*100;
                    return <p style={{fontSize:9,color:C.muted,marginBottom:7}}>Compra <b style={{color:variacao>0?C.red:C.green}}>{Math.abs(variacao).toFixed(1)}% {variacao>0?"acima":"abaixo"}</b> da referência SINAPI.</p>;
                  })()}
                  {(() => {
                    const dp = picoUsoNoPeriodo(data, e, fleetPeriodDays);
                    const tf = e.tarifas || {};
                    const menor = PACOTES_TARIFA.filter(p=>Number(tf[p.id]||0)>0)
                      .map(p=>`${p.label} ${fmt(tf[p.id])}`).join(" · ");
                    return (<>
                      {/* Estoque do item: total, quantos na rua e quantos livres */}
                      {dp.total > 1 && (
                        <div style={{display:"flex",gap:6,marginBottom:7,flexWrap:"wrap"}}>
                          {[["Total",dp.total,C.muted],["Em uso",dp.pico,C.blue],
                            ["Livre",dp.livreNoPico,dp.livreNoPico<0?C.red:dp.livreNoPico===0?C.orange:C.green]].map(([l,v,cor])=>(
                            <span key={l} style={{fontSize:9,color:C.muted,background:C.surface,
                                  border:`1px solid ${C.border}`,borderRadius:6,padding:"3px 7px"}}>
                              {l} <b style={{color:cor,fontSize:10.5}}>{v}</b>
                            </span>
                          ))}
                          {dp.excedido && (
                            <span style={{fontSize:9,fontWeight:800,color:C.red,background:`${C.red}12`,
                                  borderRadius:6,padding:"3px 7px"}}>alocado além do que existe</span>
                          )}
                        </div>
                      )}
                      <div style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:9.5,color:C.muted,paddingTop:6,borderTop:`1px solid ${C.line}`}}>
                        <span style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {menor || <span style={{color:C.orange}}>sem tarifa</span>}
                        </span>
                        <span style={{whiteSpace:"nowrap"}}>Lucro no mês <b style={{color:fin.lucro>=0?C.green:C.red}}>{fmt(fin.lucro)}</b></span>
                      </div>
                    </>);
                  })()}
                  <div className="equipment-card-actions">
                    <Btn size="sm" v="ghost" onClick={()=>setEquipModal(e)} title={`Editar ${e.nome}`}><Ic n="edit"/> Editar</Btn>
                    <Btn size="sm" v="ghost" onClick={()=>setLocModal({...locVazio, equipamentoId:e.id, valorDiaria:e.valorDiaria, custoDiaria:e.custoDiaria, obraId:e.obraAtualId})}>Locar</Btn>
                    <Btn size="sm" v="ghost" onClick={()=>{
                      const lot=physicalRegistry.lots.find(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===String(e.id));
                      const unit=physicalRegistry.units.find(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===String(e.id));
                      const assetId=lot?.id||unit?.id;
                      const position=physicalRegistry.allocations.find(item=>(item.lotId||item.unitId)===assetId);
                      setTransfModal({...transfVazio,equipamentoId:e.id,equipmentLotId:lot?.id||"",equipmentUnitIds:unit?[unit.id]:[],deLocationId:position?.locationId||"depot"});
                    }}>Transferir</Btn>
                    <Btn size="sm" v="ghost" onClick={()=>setManutModal({...manutVazio, equipamentoId:e.id})}>Manutenção</Btn>
                    <Btn size="sm" v="danger" disabled={!!salvandoEquipamento} onClick={()=>excluirEquip(e)}
                      title="Excluir equipamento da frota" ariaLabel={`Excluir ${e.nome}`}>
                      <Ic n="trash"/> Excluir
                    </Btn>
                  </div>
                  </div>
                </article>
              );
            })}
          </div>}
      </>}

      {/* ---------- CADASTRO FÍSICO: MODELO, LOTE E UNIDADE ---------- */}
      {aba==="fisico" && <>
        <div className="equipment-section-heading">
          <div>
            <p>Identidade e localização física</p>
            <small>Posição derivada das alocações em {fmtDate(today())}; o cadastro legado permanece preservado.</small>
          </div>
          {!physicalMigration&&currentUser?.role==="admin"&&<Btn size="sm" disabled={salvandoEquipamento==="cadastro-fisico"} onClick={materializarCadastroFisico}>
            <Ic n="layers"/> {salvandoEquipamento==="cadastro-fisico"?"Criando...":"Materializar cadastro"}
          </Btn>}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:8}}>
          <MiniKpi label="Modelos" value={String(physicalRegistry.models.length)} cor={C.text} sub="produto ou classe"/>
          <MiniKpi label="Lotes" value={String(physicalRegistry.lots.length)} cor={C.blue} sub="controle por quantidade"/>
          <MiniKpi label="Unidades físicas" value={String(physicalRegistry.units.length)} cor={C.green} sub="ativos individualizados"/>
          <MiniKpi label="Revisão manual" value={String(physicalRegistry.report.ambiguous.length)} cor={physicalRegistry.report.ambiguous.length?C.orange:C.green} sub="classificação ambígua"/>
        </div>

        <div style={{padding:"10px 12px",border:`1px solid ${physicalMigration?C.green:C.blue}55`,borderRadius:9,background:`${physicalMigration?C.green:C.blue}09`}}>
          <p style={{fontSize:10.5,color:physicalMigration?C.green:C.blue,fontWeight:800}}>{physicalMigration?"Cadastro físico materializado e versionado.":"Prévia compatível calculada a partir da frota atual."}</p>
          <p style={{fontSize:9.5,color:C.muted,marginTop:3}}>A localização abaixo não usa o campo legado de obra atual; ela é composta por locações, reservas, manutenções e bloqueios ativos.</p>
        </div>

        {physicalRegistry.report.manualReview.length>0&&<div style={{border:`1px solid ${C.orange}66`,borderRadius:9,background:`${C.orange}0B`,padding:"11px 13px"}}>
          <p style={{fontSize:10.5,fontWeight:850,color:C.orange}}>Registros que exigem revisão</p>
          <div style={{display:"grid",gap:5,marginTop:7}}>{physicalRegistry.report.manualReview.map(item=>{
            const source=(data.equipamentos||[]).find(equipment=>String(equipment.id)===String(item.equipmentId));
            return <div key={item.equipmentId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,fontSize:9.5,color:C.muted}}><span><b style={{color:C.text}}>{source?.nome||item.equipmentId}</b> — {item.reason}</span>{physicalMigration&&currentUser?.role==="admin"&&<Btn size="sm" v="ghost" onClick={()=>setPhysicalReview({equipmentId:item.equipmentId,kind:Number(source?.quantidadeTotal||1)>1?"lot":"unit",lotCode:`LOTE-${item.equipmentId}`,unit:"un",assetTags:source?.patrimonio||""})}>Revisar</Btn>}</div>;
          })}</div>
        </div>}

        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:9}}>
          {physicalRegistry.models.map(model=>{
            const lots=physicalRegistry.lots.filter(item=>item.modelId===model.id);
            const units=physicalRegistry.units.filter(item=>item.modelId===model.id);
            const assetIds=new Set([...lots.map(item=>item.id),...units.map(item=>item.id)]);
            const allocations=physicalRegistry.allocations.filter(item=>assetIds.has(item.lotId||item.unitId));
            return <article key={model.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 13px"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"start"}}>
                <div style={{minWidth:0}}><p style={{fontSize:12.5,fontWeight:850,color:C.text}}>{model.name}</p><p style={{fontSize:9,color:C.muted,marginTop:2}}>{model.category||"Sem categoria"}{model.manufacturer?` · ${model.manufacturer}`:""}</p></div>
                <span style={{fontSize:8,fontWeight:800,color:units.length?C.green:C.blue,background:`${units.length?C.green:C.blue}12`,borderRadius:99,padding:"3px 7px",whiteSpace:"nowrap"}}>{units.length?`${units.length} unidade(s)`:`${lots.reduce((sum,lot)=>sum+Number(lot.quantity||0),0)} em lote`}</span>
              </div>
              <div style={{display:"grid",gap:5,marginTop:10}}>{allocations.map(allocation=>{
                const label=allocation.type==="work"?obraName(allocation.locationId):allocation.type==="depot"?"Depósito":allocation.type==="maintenance"?"Manutenção":allocation.type==="transport"?"Em transporte":allocation.type==="exceeded"?"Conflito de quantidade":"Bloqueado";
                const color=allocation.type==="work"?C.blue:allocation.type==="depot"?C.green:allocation.type==="exceeded"?C.red:C.orange;
                const unit=allocation.unitId?units.find(item=>item.id===allocation.unitId):null;
                return <div key={allocation.key} style={{display:"flex",justifyContent:"space-between",gap:8,padding:"6px 8px",borderRadius:7,background:`${color}0B`,border:`1px solid ${color}28`}}>
                  <span style={{fontSize:9.5,color:C.muted}}><b style={{color}}>{label}</b>{unit?.assetTag?` · ${unit.assetTag}`:""}</span><b style={{fontSize:10.5,color}}>{allocation.quantity} un.</b>
                </div>;
              })}</div>
              {!allocations.length&&<p style={{fontSize:9.5,color:C.muted,marginTop:10}}>Sem posição física disponível.</p>}
            </article>;
          })}
        </div>
      </>}

      {/* ---------- LOCAÇÕES ---------- */}
      {/* ---------- GESTAO DE LOCACAO: grade dia a dia, no estilo do ponto ---------- */}
      {aba==="gestao" && (()=>{
        const [ano,mes] = ym.split("-").map(Number);
        const diasMes = getDays(ano, mes-1);
        const calendarEvents=buildEquipmentUnavailability(data).filter(isActiveUnavailability);
        const eventosNoDia=(equipmentId,iso)=>calendarEvents.filter(event=>
          event.equipmentId===equipmentId&&event.startDate<=iso&&(!event.endDate||event.endDate>=iso));
        const siglaTipo={rental:"L",reservation:"R",maintenance:"M",inspection:"I",transport:"T",damage:"A",administrative_block:"B",quarantine:"Q"};
        const corTipo={rental:C.blue,reservation:C.purple,maintenance:C.orange,inspection:C.yellowD,transport:C.green,damage:C.red,administrative_block:C.red,quarantine:C.muted};
        const filtroObraEfetivo = obraIdFixo || filtroObraGestao;
        const linhas = equipamentos.map(e => ({ eq:e, r:resumoLocacaoEquip(data, e.id, diasMes) }))
          .filter(l => filtroObraEfetivo==="all" || l.r.obras.includes(filtroObraEfetivo));
        const tot = linhas.reduce((a,l)=>({
          receita:a.receita+l.r.receita, custo:a.custo+l.r.custo,
          locado:a.locado+l.r.diasLocado, ocioso:a.ocioso+l.r.diasOciosos,
        }),{receita:0,custo:0,locado:0,ocioso:0});
        const ocupGeral = (tot.locado+tot.ocioso)>0 ? (tot.locado/(tot.locado+tot.ocioso))*100 : 0;
        // Uma cor por obra, para bater o olho e ver o equipamento trocando de obra.
        const CORES_OBRA = [C.blue,C.green,C.purple,C.orange,C.yellowD,C.red];
        const corDaObra = id => {
          const idx = (data.obras||[]).findIndex(o=>o.id===id);
          return idx<0 ? C.muted : CORES_OBRA[idx % CORES_OBRA.length];
        };
        const diaCurto = iso => iso.slice(8,10);
        const ehFimSemana = iso => { const d=new Date(iso+"T00:00:00").getDay(); return d===0||d===6; };

        return (<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
            <Sel label="Mês" value={ym} onChange={setYm} options={mesesOpts}/>
            {obraIdFixo
              ? <Inp label="Obra" value={(data.obras||[]).find(o=>o.id===obraIdFixo)?.name||"Obra atual"} onChange={()=>{}} disabled/>
              : <Sel label="Obra" value={filtroObraGestao} onChange={setFiltroObraGestao}
                   options={[{v:"all",l:"Todas as obras"},...(data.obras||[]).map(o=>({v:o.id,l:o.name}))]}/>
            }
            <Inp label="Buscar" value={busca} onChange={setBusca} placeholder="Nome, categoria, patrimônio..."/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
            <MiniKpi label="Ocupação da frota" value={`${ocupGeral.toFixed(0)}%`}
                     cor={ocupGeral>=70?C.green:ocupGeral>=40?C.orange:C.red}
                     sub={`${tot.locado} dia(s) locado(s)`}/>
            <MiniKpi label="Dias ociosos" value={String(tot.ocioso)} cor={tot.ocioso>0?C.orange:C.green}
                     sub="equipamento parado"/>
            <MiniKpi label="Receita do período" value={fmt(tot.receita)} cor={C.green}/>
            <MiniKpi label="Resultado" value={fmt(tot.receita-tot.custo)}
                     cor={(tot.receita-tot.custo)>=0?C.green:C.red} sub="receita - custo de terceiro"/>
          </div>

          <p style={{fontSize:10.5,color:C.muted,padding:"0 2px",lineHeight:1.5}}>
            Cada linha é um equipamento e cada coluna um dia. A cor indica em qual obra ele estava;
            <b> · </b> é dia parado. Toque num equipamento para abrir a locação.
          </p>

          {linhas.length===0
            ? <div style={{padding:24,textAlign:"center",color:C.muted,fontSize:12}}>Nenhum equipamento no filtro.</div>
            : <div style={{overflow:"auto",border:`1px solid ${C.border}`,borderRadius:8,background:C.card,maxHeight:"70vh"}}>
              <table style={{borderCollapse:"separate",borderSpacing:0,fontSize:11}}>
                <thead>
                  <tr>
                    <th style={{position:"sticky",left:0,top:0,zIndex:3,background:C.surface,textAlign:"left",
                                padding:"7px 9px",borderBottom:`1px solid ${C.border}`,borderRight:`1px solid ${C.border}`,
                                minWidth:150,fontSize:10,color:C.muted,textTransform:"uppercase"}}>Equipamento</th>
                    {diasMes.map(d=>(
                      <th key={d} style={{position:"sticky",top:0,zIndex:2,background:ehFimSemana(d)?`${C.blue}10`:C.surface,
                                          padding:"7px 0",minWidth:42,borderBottom:`1px solid ${C.border}`,
                                          fontSize:9,color:C.muted,fontWeight:700}}>{diaCurto(d)}</th>
                    ))}
                    {["Dias","Ocup.","Receita","Result."].map(h=>(
                      <th key={h} style={{position:"sticky",top:0,zIndex:2,background:C.surface,padding:"7px 9px",
                                          borderBottom:`1px solid ${C.border}`,borderLeft:`1px solid ${C.border}`,
                                          fontSize:9.5,color:C.muted,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({eq,r})=>(
                    <tr key={eq.id}>
                      <td onClick={()=>setEquipModal(eq)} title="Abrir o equipamento"
                          style={{position:"sticky",left:0,zIndex:1,background:C.card,padding:"6px 9px",
                                  borderBottom:`1px solid ${C.line}`,borderRight:`1px solid ${C.border}`,cursor:"pointer"}}>
                        <p style={{fontSize:11.5,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:150}}>{eq.nome}</p>
                        <p style={{fontSize:9,color:C.muted,whiteSpace:"nowrap"}}>
                          {donoName(eq.proprietarioId)}
                          {Number(eq.quantidadeTotal||1)>1 && (()=>{
                            const pk = picoUsoNoPeriodo(data, eq, diasMes);
                            return <span style={{color:pk.excedido?C.red:C.muted}}>
                              {" · "}pico {pk.pico}/{pk.total}{pk.excedido?" (estourou)":""}
                            </span>;
                          })()}
                          {r.transferencias>0?` · ${r.transferencias} obra(s)`:""}
                        </p>
                      </td>
                      {r.grade.map(g=>{
                        const eventos=eventosNoDia(eq.id,g.data);
                        const disponibilidade=availabilityOnDate(data,eq,g.data);
                        const estourou=disponibilidade.livre===0&&eventos.reduce((sum,event)=>sum+Number(event.quantity||0),0)>disponibilidade.total;
                        const resumoTipos=["rental","reservation","maintenance","inspection","transport","damage","administrative_block","quarantine"]
                          .map(type=>{const qtd=eventos.filter(event=>event.type===type).reduce((sum,event)=>sum+Number(event.quantity||0),0);return qtd?`${siglaTipo[type]}${qtd}`:"";}).filter(Boolean);
                        const titulo=`${fmtDateFull(g.data)} · ${eventos.length?eventos.map(event=>`${EQUIPMENT_UNAVAILABILITY_LABEL[event.type]||event.type}: ${event.reason}`).join(" · "):"Livre"} · ${disponibilidade.livre}/${disponibilidade.total} livre(s)`;
                        const principal=eventos.find(event=>event.affectsCapacity!==false)||eventos[0];
                        return (
                          <td key={g.data} title={titulo}
                              onClick={()=>{
                                if(!principal)return;
                                if(principal.rentalId){const rental=(data.locacoesEquip||[]).find(item=>item.id===principal.rentalId);if(rental)setLocModal(rental);return;}
                                if(principal.maintenanceId){const maintenance=(data.manutencoesEquip||[]).find(item=>item.id===principal.maintenanceId);if(maintenance)setManutModal(maintenance);return;}
                                const explicit=(data.equipmentUnavailability||[]).find(item=>item.id===principal.id);if(explicit)setIndispModal(explicit);
                              }}
                              style={{textAlign:"center",padding:"6px 0",borderBottom:`1px solid ${C.line}`,
                                      background:estourou?`${C.red}35`:principal?`${corTipo[principal.type]||C.muted}24`:ehFimSemana(g.data)?`${C.blue}08`:"transparent",
                                      cursor:principal?"pointer":"default"}}>
                            <span style={{display:"block",fontSize:8,fontWeight:800,color:estourou?C.red:principal?(corTipo[principal.type]||C.text):C.muted}}>{resumoTipos.join(" ")||"—"}</span>
                            <span style={{display:"block",fontSize:7.5,color:disponibilidade.livre?C.green:C.red}}>livre {disponibilidade.livre}</span>
                          </td>
                        );
                      })}
                      <td style={{padding:"6px 9px",textAlign:"center",borderBottom:`1px solid ${C.line}`,borderLeft:`1px solid ${C.border}`,fontWeight:700,color:C.text}}>{r.diasLocado}</td>
                      <td style={{padding:"6px 9px",textAlign:"center",borderBottom:`1px solid ${C.line}`,
                                  color:r.ocupacaoPct>=70?C.green:r.ocupacaoPct>=40?C.orange:C.red,fontWeight:700}}>{r.ocupacaoPct.toFixed(0)}%</td>
                      <td style={{padding:"6px 9px",textAlign:"right",borderBottom:`1px solid ${C.line}`,color:C.green,fontWeight:700,whiteSpace:"nowrap"}}>{fmt(r.receita)}</td>
                      <td style={{padding:"6px 9px",textAlign:"right",borderBottom:`1px solid ${C.line}`,
                                  color:r.resultado>=0?C.text:C.red,fontWeight:800,whiteSpace:"nowrap"}}>{fmt(r.resultado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}

          {/* Legenda das obras */}
          {(data.obras||[]).length>0 && (
            <div style={{display:"flex",gap:10,flexWrap:"wrap",padding:"0 2px"}}>
              {(data.obras||[]).filter(o=>linhas.some(l=>l.r.obras.includes(o.id))).map(o=>(
                <span key={o.id} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:10,color:C.muted}}>
                  <span style={{width:9,height:9,borderRadius:2,background:corDaObra(o.id)}}/>{o.name}
                </span>
              ))}
            </div>
          )}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",padding:"0 2px"}}>
            {Object.entries(siglaTipo).map(([type,sigla])=><span key={type} style={{fontSize:9.5,color:corTipo[type]||C.muted,fontWeight:750}}>{sigla} = {EQUIPMENT_UNAVAILABILITY_LABEL[type]}</span>)}
          </div>
        </>);
      })()}

      {aba==="locacoes" && <>
        <div className="equipment-section-heading">
          <div><p>Histórico de locações</p><small>{locacoesAtivas.length} em andamento · {(data.locacoesEquip||[]).length} no histórico</small></div>
          <Btn size="sm" onClick={()=>setLocModal(locVazio)}><Ic n="plus"/> Nova locação</Btn>
        </div>
        {(data.locacoesEquip||[]).length===0
          ? <div className="equipment-empty-state"><span><Ic n="calendar" s={19}/></span><div><p>Nenhuma locação registrada</p><small>Escolha um equipamento e uma obra para iniciar o histórico de cobrança.</small></div></div>
          : <div className="equipment-record-list">
            {[...(data.locacoesEquip||[])].sort((a,b)=>(b.inicio||"").localeCompare(a.inicio||"")).map(l=>{
              const cancelada=l.status==="cancelada";
              const emAberto = !cancelada&&!l.fim;
              const lifecycleState=normalizeRentalState(l.lifecycleState||l.status);
              const chargeSummary=rentalChargeSummary(data.rentalChargeItems||[],{rentalId:l.id});
              const measuredCompetences=(data.rentalChargeItems||[]).filter(item=>item.rentalId===l.id&&item.status==="measured").map(item=>item.competence);
              const rentalInvoices=(data.rentalInvoices||[]).filter(item=>item.rentalId===l.id&&item.status!=="cancelled");
              const lifecycleNext=availableRentalTransitions(lifecycleState,{checkpoints:l.rentalCheckpoints||[]})
                .filter(state=>!["cancelled","closed"].includes(state));
              return (
                <article key={l.id} className="equipment-record" data-active={emAberto}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                    <div style={{minWidth:0}}>
                      <p style={{fontSize:12.5,fontWeight:800,color:C.text}}>
                        {equipName(l.equipamentoId)}
                        {Number(l.quantidade||1)>1 && (
                          <span style={{fontSize:10.5,color:C.blue,fontWeight:800,marginLeft:6}}>
                            {l.quantidade} un
                          </span>
                        )}
                      </p>
                      <p style={{fontSize:9.5,color:cancelada?C.red:C.muted}}>{obraName(l.obraId)} · {fmtDate(l.inicio)} {cancelada?"→ excluída":l.fim?`→ ${fmtDate(l.fim)}`:"→ em andamento"}</p>
                      <span style={{display:"inline-flex",marginTop:5,padding:"3px 7px",borderRadius:99,fontSize:8.5,fontWeight:850,color:cancelada?C.red:C.blue,background:`${cancelada?C.red:C.blue}12`}}>
                        CICLO · {rentalStateLabel(lifecycleState).toUpperCase()}
                      </span>
                      {l.plannedEndDate&&<p style={{fontSize:9,color:C.muted,marginTop:4}}>Término planejado: {fmtDate(l.plannedEndDate)}</p>}
                      {chargeSummary.netAmountCents!==0&&<p style={{fontSize:9,color:chargeSummary.netAmountCents>=0?C.green:C.red,marginTop:3}}>Linhas preparadas: {fmt(chargeSummary.netAmountCents/100)}</p>}
                      {measuredCompetences.length>0&&<p style={{fontSize:9,color:C.blue,marginTop:3}}>Medida: {measuredCompetences.join(", ")}</p>}
                      {rentalInvoices.length>0&&<p style={{fontSize:9,color:C.orange,marginTop:3}}>Faturado: {fmt(rentalInvoices.reduce((sum,item)=>sum+Number(item.netAmountCents||0),0)/100)} · em aberto {fmt(rentalInvoices.reduce((sum,item)=>sum+Number(item.openAmountCents||0),0)/100)}</p>}
                    </div>
                    {(() => {
                      const eqL = (data.equipamentos||[]).find(x=>x.id===l.equipamentoId);
                      const tf  = tarifasDaLocacao(l, eqL);
                      const dias = l.inicio ? diasCorridos(l.inicio, l.fim || today()) + 1 : 0;
                      const cob = dias ? cobrancaLocacao(l, eqL, dias) : null;
                      return (
                        <div style={{textAlign:"right"}}>
                          {cob && !cob.semTarifa
                            ? <>
                                <p style={{fontSize:12,fontWeight:800,color:C.yellowD}}>{fmt(cob.liquido)}</p>
                                <p style={{fontSize:9,color:C.muted}}>{dias} dia(s) · {textoComposicao(cob.composicao)}</p>
                              </>
                            : <p style={{fontSize:11,color:C.orange}}>sem tarifa</p>}
                          {cob && cob.desconto>0.005 && <p style={{fontSize:9,color:C.orange}}>desc {fmt(cob.desconto)}</p>}
                          <p style={{fontSize:8.5,color:C.muted,marginTop:2}}>
                            {PACOTES_TARIFA.filter(p=>Number(tf?.[p.id]||0)>0).map(p=>`${p.label} ${fmt(tf[p.id])}`).join(" · ")}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="equipment-record-actions">
                    {!cancelada&&<Btn size="sm" v="ghost" onClick={()=>setLocModal(l)}><Ic n="edit"/> Editar</Btn>}
                    {!cancelada&&<Btn size="sm" v="ghost" disabled={!!salvandoEquipamento} onClick={()=>setRentalChargeModal({rentalId:l.id,workId:l.obraId,type:"freight",description:"",quantity:"1",unit:"un",unitPrice:"",discountAmount:"0",taxAmount:"0",competence:ym})}>Adicionar cobrança</Btn>}
                    {!cancelada&&<Btn size="sm" v="ghost" disabled={!!salvandoEquipamento} onClick={()=>prepararMedicaoLocacao(l)}>Medir competência</Btn>}
                    {!cancelada&&(data.rentalChargeItems||[]).some(item=>item.rentalId===l.id&&["open","measured"].includes(item.status))&&<Btn size="sm" v="ghost" disabled={!!salvandoEquipamento} onClick={()=>prepararFaturaLocacao(l)}>Emitir fatura</Btn>}
                    {emAberto&&["contracted","delivered","active","pickup_requested"].includes(lifecycleState)&&<Btn size="sm" v="ghost" disabled={!!salvandoEquipamento} onClick={()=>prepararAditivoLocacao(l)}>Prorrogar / renovar</Btn>}
                    {emAberto&&(l.equipmentUnitIds||[]).length>0&&["separating","ready_for_dispatch","in_transport","delivered","active","pickup_requested"].includes(lifecycleState)&&<Btn size="sm" v="ghost" disabled={!!salvandoEquipamento} onClick={()=>setRentalReplacementModal({rentalId:l.id,outgoingUnitId:l.equipmentUnitIds[0],incomingUnitId:"",date:today(),reason:"",notes:""})}>Substituir unidade</Btn>}
                    {emAberto&&lifecycleState==="ready_for_dispatch"&&rentalDispatchBalance(l,l.rentalCheckpoints||[]).remainingQuantity>1&&<Btn size="sm" v="ghost" disabled={!!salvandoEquipamento} onClick={()=>prepararMovimentacaoParcial(l,RENTAL_CHECKPOINT_TYPE.PARTIAL_DISPATCH)}>Expedição parcial</Btn>}
                    {emAberto&&lifecycleState==="in_transport"&&rentalDeliveryBalance(l,l.rentalCheckpoints||[]).remainingQuantity>1&&<Btn size="sm" v="ghost" disabled={!!salvandoEquipamento} onClick={()=>prepararMovimentacaoParcial(l,RENTAL_CHECKPOINT_TYPE.PARTIAL_DELIVERY)}>Entrega parcial</Btn>}
                    {emAberto&&lifecycleState==="awaiting_adjustment"&&!(l.rentalCheckpoints||[]).some(item=>item.type===RENTAL_CHECKPOINT_TYPE.ADJUSTMENT&&item.status!=="cancelled")&&<Btn size="sm" v="ghost" disabled={!!salvandoEquipamento} onClick={()=>prepararConclusaoAjuste(l)}>Registrar ajuste concluído</Btn>}
                    {emAberto&&lifecycleState==="pickup_requested"&&rentalReturnBalance(l,l.rentalCheckpoints||[]).remainingQuantity>1&&<Btn size="sm" v="ghost" disabled={!!salvandoEquipamento} onClick={()=>prepararDevolucaoParcial(l)}>Devolução parcial</Btn>}
                    {emAberto&&lifecycleNext.map(nextState=>{
                      const checkpointType=CHECKPOINT_BY_STATE[nextState];
                      const recorded=(l.rentalCheckpoints||[]).some(item=>item.type===checkpointType&&item.status!=="cancelled");
                      return <Btn key={nextState} size="sm" v="ghost" disabled={!!salvandoEquipamento}
                        onClick={()=>prepararTransicaoLocacao(l,nextState)}>
                        {checkpointType&&!recorded?`Checklist: ${CHECKPOINT_LABEL[checkpointType]}`:`Avançar: ${rentalStateLabel(nextState)}`}
                      </Btn>;
                    })}
                    {emAberto&&(!l.lifecycleState||lifecycleState==="under_inspection"||(lifecycleState==="awaiting_adjustment"&&(l.rentalCheckpoints||[]).some(item=>item.type===RENTAL_CHECKPOINT_TYPE.ADJUSTMENT&&item.status!=="cancelled")))&&<Btn size="sm" v="ghost" onClick={()=>encerrarLoc(l)}>Encerrar</Btn>}
                    {!cancelada&&<Btn size="sm" v="danger" disabled={!!salvandoEquipamento} onClick={()=>excluirLoc(l)}><Ic n="trash"/> Excluir</Btn>}
                  </div>
                </article>
              );
            })}
          </div>}
      </>}

      {/* ---------- MANUTENÇÃO ---------- */}
      {aba==="manutencao" && <>
        <div className="equipment-section-heading">
          <div><p>Histórico de manutenção</p><small>Custos preventivos e corretivos vinculados à frota</small></div>
          <Btn size="sm" onClick={()=>setManutModal(manutVazio)}><Ic n="plus"/> Registrar manutenção</Btn>
        </div>
        {(data.manutencoesEquip||[]).length===0
          ? <div className="equipment-empty-state"><span><Ic n="settings" s={19}/></span><div><p>Nenhuma manutenção registrada</p><small>Registre serviços e custos para acompanhar a disponibilidade real da frota.</small></div></div>
          : <div className="equipment-record-list">
            {[...(data.manutencoesEquip||[])].sort((a,b)=>(b.data||"").localeCompare(a.data||"")).map(m=>(
              <article key={m.id} className="equipment-record" data-maintenance={m.tipo||"corretiva"}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                  <div style={{minWidth:0}}>
                    <p style={{fontSize:12.5,fontWeight:800,color:C.text}}>{equipName(m.equipamentoId)}</p>
                    <p style={{fontSize:9.5,color:C.muted}}>{fmtDate(m.data)} · {m.tipo}{m.descricao?` · ${m.descricao}`:""}</p>
                    <p style={{fontSize:9,color:C.muted,marginTop:1}}>Pago por {m.pagoPor==="proprietario"?"proprietário":"empresa"}{m.fornecedor?` · ${m.fornecedor}`:""}</p>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <p style={{fontSize:12,fontWeight:800,color:C.red}}>{fmt(m.custo)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>}
      </>}

      {/* ---------- RELATÓRIO MENSAL ---------- */}
      {aba==="relatorio" && <Suspense fallback={<div className="equipment-report-empty"><strong>Preparando relatórios</strong><p>Organizando dados gerenciais e memórias por obra...</p></div>}>
        <LazyEquipmentBillingReports
          data={data}
          monthly={rel}
          matrix={relPorObra}
          period={ym}
          periodLabel={mesLabel}
          periodOptions={mesesOpts}
          onPeriodChange={setYm}
          ownerName={donoName}
          logoSrc={data.config?.companyImageUrl||data.config?.logoUrl||ARCD_LOGO}
          formatCurrency={fmt}
          formatDate={fmtDate}
          formatComposition={textoComposicao}
          onPrintManagement={()=>imprimirRelEquipGerencial(data,ym,mesLabel,rel,relPorObra,donoName,showToast)}
          onPrintWork={obra=>imprimirRelEquipObra(data,ym,mesLabel,relPorObra,obra,showToast)}
          onExportManagement={()=>exportarRelEquipPorObra(data,ym,relPorObra,{donoName})}
          onExportWork={obra=>exportarRelEquipObraDetalhado(data,ym,relPorObra,obra)}
          onEditRental={rentalId=>{
            const rental=(data.locacoesEquip||[]).find(item=>item.id===rentalId);
            if(rental)setLocModal(rental);
          }}
          onDeleteRental={rentalId=>{
            const rental=(data.locacoesEquip||[]).find(item=>item.id===rentalId);
            if(rental)excluirLoc(rental);
          }}
          onAddRentalToWork={work=>setLocModal({...locVazio,obraId:work?.id||obraIdFixo||""})}
        />
      </Suspense>}

      {/* ===== MODAIS ===== */}
      {equipModal && (
        <Modal title={equipModal.id?"Editar equipamento":"Novo equipamento"} onClose={()=>{setEquipModal(null);setBuscaSinapiEquip("");setResultadosSinapiEquip([]);setAvisoSinapiEquip("");}} wide>
          <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
            <div className="equipment-sinapi-reference" style={{gridColumn:"1/-1"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap",marginBottom:9}}>
                <div>
                  <p style={{fontSize:11.5,fontWeight:900,color:C.text}}>Referência de compra SINAPI</p>
                  <p style={{fontSize:9.5,color:C.muted,marginTop:2}}>Consulte somente equipamentos, vincule o código oficial e compare o preço de aquisição.</p>
                </div>
                {equipModal.sinapiCodigo&&<Badge color={C.blue}>SINAPI {equipModal.sinapiCodigo}</Badge>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
                <Sel label="Base SINAPI" value={baseSinapiEquipId} onChange={v=>{setBaseSinapiEquipId(v);setBuscaSinapiEquip("");setResultadosSinapiEquip([]);}}
                  options={[{v:"",l:basesSinapiEquip.length?"Selecione a base":"Nenhuma base SINAPI pronta"},...basesSinapiEquip.map(b=>({v:b.id,l:`${b.dataBase||"Sem data"}${b.uf?` · ${b.uf}`:""} · ${b.desonerado===false?"não desonerada":"desonerada"}`}))]}/>
                <Inp label="Pesquisar equipamento" value={buscaSinapiEquip} onChange={setBuscaSinapiEquip} placeholder="Código, betoneira, compactador, gerador..."/>
              </div>
              {(carregandoSinapiEquip||avisoSinapiEquip||resultadosSinapiEquip.length>0)&&<div style={{marginTop:7,maxHeight:210,overflowY:"auto",background:C.card,border:`1px solid ${C.border}`,borderRadius:5}}>
                {carregandoSinapiEquip&&<p style={{fontSize:10,color:C.blue,padding:9}}>Consultando equipamentos no SINAPI...</p>}
                {avisoSinapiEquip&&<p style={{fontSize:10,color:C.orange,padding:9,lineHeight:1.45}}>{avisoSinapiEquip}</p>}
                {resultadosSinapiEquip.map((item,index)=>{
                  const base=basesSinapiEquip.find(b=>b.id===baseSinapiEquipId);
                  const preco=(base?.desonerado===false?Number(item.precoNao||0):Number(item.precoDes||0))||Number(item.precoDes||0)||Number(item.precoNao||0);
                  return <button type="button" key={`${item.codigo}-${index}`} onClick={()=>selecionarEquipamentoSinapi(item)} style={{display:"grid",gridTemplateColumns:"90px minmax(0,1fr) 110px",gap:8,width:"100%",alignItems:"center",padding:"8px 9px",border:0,borderTop:index?`1px solid ${C.line}`:"none",background:"transparent",cursor:"pointer",textAlign:"left"}}>
                    <b style={{fontSize:9.5,color:C.blue}}>{item.codigo}</b>
                    <span style={{fontSize:10.5,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.descricao}</span>
                    <b style={{fontSize:9.5,color:C.yellowD,textAlign:"right"}}>{fmt(preco)}/{item.unidade||"UN"}</b>
                  </button>;
                })}
              </div>}
              {equipModal.sinapiCodigo&&<div style={{marginTop:9,display:"grid",gridTemplateColumns:formGrid(3),gap:7}}>
                <div style={{padding:"8px 9px",background:C.card,border:`1px solid ${C.border}`,borderRadius:5}}><p style={{fontSize:8.5,color:C.muted,textTransform:"uppercase",fontWeight:800}}>Referência SINAPI</p><b style={{fontSize:12,color:C.text}}>{fmt(Number(equipModal.sinapiPreco||0))}</b><p style={{fontSize:8.5,color:C.muted}}>{equipModal.sinapiUnidade||"UN"} · {equipModal.sinapiDataBase||"sem data"}{equipModal.sinapiUf?` · ${equipModal.sinapiUf}`:""}</p></div>
                <div style={{padding:"8px 9px",background:C.card,border:`1px solid ${C.border}`,borderRadius:5}}><p style={{fontSize:8.5,color:C.muted,textTransform:"uppercase",fontWeight:800}}>Valor de compra</p><b style={{fontSize:12,color:C.text}}>{Number(equipModal.valorAquisicao||0)>0?fmt(Number(equipModal.valorAquisicao)):"A informar"}</b><p style={{fontSize:8.5,color:C.muted}}>valor efetivamente negociado</p></div>
                {(()=>{
                  const ref=Number(equipModal.sinapiPreco||0),compra=Number(equipModal.valorAquisicao||0);
                  const diferenca=compra-ref,pct=ref>0&&compra>0?diferenca/ref*100:0;
                  const cor=diferenca>0?C.red:C.green;
                  return <div style={{padding:"8px 9px",background:C.card,border:`1px solid ${C.border}`,borderRadius:5}}><p style={{fontSize:8.5,color:C.muted,textTransform:"uppercase",fontWeight:800}}>Comparação</p>{ref>0&&compra>0?<><b style={{fontSize:12,color:cor}}>{diferenca>0?"+":""}{fmt(diferenca)} · {pct>0?"+":""}{pct.toFixed(1)}%</b><p style={{fontSize:8.5,color:C.muted}}>{diferenca>0?"acima da referência":"abaixo da referência"}</p></>:<><b style={{fontSize:11,color:C.muted}}>Aguardando valor</b><p style={{fontSize:8.5,color:C.muted}}>preencha a aquisição</p></>}</div>;
                })()}
                <p style={{gridColumn:"1/-1",fontSize:8.5,color:C.muted,lineHeight:1.4}}>Referência gerencial. Confirme unidade, especificação, data-base, frete e condições comerciais antes de decidir a compra.</p>
              </div>}
            </div>
            <section className="equipment-image-editor" style={{gridColumn:"1/-1"}}>
              <EquipmentImage equipment={equipModal} preview/>
              <div className="equipment-image-editor__content">
                <div>
                  <p className="equipment-image-editor__eyebrow">Identificação visual da frota</p>
                  <h3>Uma unidade, sem cenário</h3>
                  <p>A imagem automática acompanha o nome do equipamento. Se houver uma foto real de catálogo em fundo branco, informe a URL e ela terá prioridade.</p>
                </div>
                <div className="equipment-image-editor__fields">
                  <Sel label="Imagem automática" value={equipModal.imagemTipo||"auto"}
                    onChange={v=>setEquipModal(f=>({...f,imagemTipo:v}))}
                    options={EQUIPMENT_IMAGE_OPTIONS}/>
                  <Inp label="URL da foto original (opcional)" type="url" value={equipModal.imagemUrl||""}
                    onChange={v=>setEquipModal(f=>({...f,imagemUrl:v}))}
                    placeholder="https://.../equipamento.webp"/>
                </div>
                {!!equipModal.imagemUrl&&<Btn size="sm" v="ghost" onClick={()=>setEquipModal(f=>({...f,imagemUrl:""}))}>
                  Usar novamente a imagem IA
                </Btn>}
              </div>
            </section>
            <Inp label="Nome *" value={equipModal.nome} onChange={v=>setEquipModal(f=>({...f,nome:v}))} placeholder="Ex.: Betoneira 400L"/>
            <Inp label="Categoria" value={equipModal.categoria} onChange={v=>setEquipModal(f=>({...f,categoria:v}))} placeholder="Concretagem, Elevação..."/>
            <Inp label="Patrimônio / série" value={equipModal.patrimonio} onChange={v=>setEquipModal(f=>({...f,patrimonio:v}))}/>
            <Inp label="Quantidade que a empresa tem" type="number" min="1"
                 value={equipModal.quantidadeTotal ?? 1}
                 onChange={v=>setEquipModal(f=>({...f,quantidadeTotal:v}))}
                 placeholder="1"/>
            <Sel label="Proprietário" value={equipModal.proprietarioId} onChange={v=>setEquipModal(f=>({...f,proprietarioId:v}))} options={donoOpts}/>
            {/* TABELA DE TARIFAS: dia, semana, quinzena e mes. Deixe zerado o que
                nao for oferecido. Na cobranca o sistema monta a combinacao mais
                barata para o periodo - nunca cobra a mais que a modalidade menor. */}
            <div style={{gridColumn:"1/-1",background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 13px"}}>
              <p style={{fontSize:11,fontWeight:800,color:C.text,marginBottom:3}}>Tarifas cobradas do cliente</p>
              <p style={{fontSize:10,color:C.muted,marginBottom:9,lineHeight:1.45}}>
                Preencha só as modalidades que você oferece. Quando o período puder ser
                cobrado de mais de um jeito, o sistema usa sempre o <b>menor valor</b>.
              </p>
              <div style={{display:"grid",gridTemplateColumns:formGrid(4),gap:8}}>
                {[["dia","Por dia"],["semana","Por semana"],["quinzena","Por quinzena"],["mes","Por mês"]].map(([k,l])=>(
                  <Inp key={k} label={`${l} (R$)`} type="number" min="0"
                       value={equipModal.tarifas?.[k] ?? ""}
                       onChange={v=>setEquipModal(f=>({...f,tarifas:{...(f.tarifas||{}),[k]:v}}))}/>
                ))}
              </div>
              {(() => {
                const t = equipModal.tarifas || {};
                const algum = ["dia","semana","quinzena","mes"].some(k=>Number(t[k]||0)>0);
                if (!algum) return <p style={{fontSize:10,color:C.muted,marginTop:8}}>Opcional no cadastro. Você pode informar a tarifa agora ou negociar ao criar a locação.</p>;
                // Previa: quanto sai um mes cheio pela combinacao mais barata.
                const p30 = melhorTarifa(t, 30);
                return (
                  <p style={{fontSize:10,color:C.muted,marginTop:8}}>
                    Exemplo: 30 dias sairiam <b style={{color:C.green}}>{fmt(p30.total)}</b> ({textoComposicao(p30.composicao)}).
                  </p>
                );
              })()}
            </div>

            {(equipModal.proprietarioId || Number(equipModal.custoDiaria)>0) && (
              <div style={{gridColumn:"1/-1",background:`${C.red}07`,border:`1px solid ${C.red}33`,borderRadius:9,padding:"11px 13px"}}>
                <p style={{fontSize:11,fontWeight:800,color:C.text,marginBottom:3}}>Tarifas pagas ao proprietário (terceiro)</p>
                <p style={{fontSize:10,color:C.muted,marginBottom:9}}>Deixe zerado se o equipamento for da empresa.</p>
                <div style={{display:"grid",gridTemplateColumns:formGrid(4),gap:8}}>
                  {[["dia","Por dia"],["semana","Por semana"],["quinzena","Por quinzena"],["mes","Por mês"]].map(([k,l])=>(
                    <Inp key={k} label={`${l} (R$)`} type="number" min="0"
                         value={equipModal.tarifasCusto?.[k] ?? ""}
                         onChange={v=>setEquipModal(f=>({...f,tarifasCusto:{...(f.tarifasCusto||{}),[k]:v}}))}/>
                  ))}
                </div>
              </div>
            )}
            <Sel label="Situação" value={equipModal.status} onChange={v=>setEquipModal(f=>({...f,status:v}))} options={Object.entries(STATUS_EQUIP).map(([v,o])=>({v,l:o.l}))}/>
            <Sel label="Obra atual" value={equipModal.obraAtualId} onChange={v=>setEquipModal(f=>({...f,obraAtualId:v}))} options={obraOpts}/>
            <Inp label="Data de aquisição" type="date" value={equipModal.aquisicao} onChange={v=>setEquipModal(f=>({...f,aquisicao:v}))}/>
            <Inp label="Valor de aquisição (R$)" type="number" value={equipModal.valorAquisicao} onChange={v=>setEquipModal(f=>({...f,valorAquisicao:v}))}/>
            <div style={{gridColumn:"1/-1"}}><Inp label="Observações" value={equipModal.obs} onChange={v=>setEquipModal(f=>({...f,obs:v}))} multiline/></div>
            <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:equipModal.id?"minmax(140px,.35fr) minmax(200px,1fr)":"1fr",gap:8}}>
              {equipModal.id&&<Btn full v="danger" loading={salvandoEquipamento==="exclusao"} disabled={!!salvandoEquipamento}
                onClick={()=>excluirEquip(equipModal)}><Ic n="trash"/> {salvandoEquipamento==="exclusao"?"Excluindo...":"Excluir equipamento"}</Btn>}
              <Btn full loading={salvandoEquipamento==="equipamento"} disabled={!!salvandoEquipamento}
                onClick={()=>salvarEquip(equipModal)}>{salvandoEquipamento==="equipamento"?"Salvando equipamento...":"Salvar equipamento"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {donoModal && (
        <Modal title={donoModal.id?"Editar proprietário":"Novo proprietário (terceiro)"} onClose={()=>setDonoModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Inp label="Nome *" value={donoModal.nome} onChange={v=>setDonoModal(f=>({...f,nome:v}))}/>
            <CampoCNPJ label="CNPJ (busca) / CPF" value={donoModal.documento} onChange={v=>setDonoModal(f=>({...f,documento:v}))}
              onEncontrado={d=>setDonoModal(f=>({...f, nome:f.nome||d.nome, telefone:f.telefone||d.telefone, email:f.email||d.email }))}/>
            <Inp label="Telefone" value={donoModal.telefone} onChange={v=>setDonoModal(f=>({...f,telefone:v}))}/>
            <Inp label="E-mail" value={donoModal.email} onChange={v=>setDonoModal(f=>({...f,email:v}))}/>
            <Inp label="Chave Pix" value={donoModal.chavePix} onChange={v=>setDonoModal(f=>({...f,chavePix:v}))}/>
            <Inp label="Observações" value={donoModal.obs} onChange={v=>setDonoModal(f=>({...f,obs:v}))} multiline/>
            <Btn full onClick={()=>salvarDono(donoModal)}>Salvar proprietário</Btn>
          </div>
        </Modal>
      )}

      {physicalReview&&(()=>{const source=(data.equipamentos||[]).find(item=>String(item.id)===String(physicalReview.equipmentId));const expected=Math.max(1,Number(source?.quantidadeTotal||1));return <Modal title={`Revisar cadastro físico · ${source?.nome||"Equipamento"}`} onClose={()=>setPhysicalReview(null)}>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <Sel label="Classificação *" value={physicalReview.kind} onChange={v=>setPhysicalReview(form=>({...form,kind:v}))} options={[{v:"lot",l:"Lote controlado por quantidade"},{v:"unit",l:"Unidades físicas individualizadas"}]}/>
          {physicalReview.kind==="lot"?<><Inp label="Identificação do lote *" value={physicalReview.lotCode} onChange={v=>setPhysicalReview(form=>({...form,lotCode:v}))}/><Inp label="Unidade de controle" value={physicalReview.unit} onChange={v=>setPhysicalReview(form=>({...form,unit:v}))}/><p style={{fontSize:9.5,color:C.muted}}>Quantidade preservada do cadastro: <b>{expected}</b>.</p></>:<><Inp label={`Patrimônios / séries (${expected}) *`} value={physicalReview.assetTags} onChange={v=>setPhysicalReview(form=>({...form,assetTags:v}))} multiline placeholder="Separe por vírgula ou uma linha por unidade"/><p style={{fontSize:9.5,color:C.muted}}>Informe exatamente {expected} identificação(ões) única(s).</p></>}
          <Btn full onClick={()=>salvarRevisaoFisica(physicalReview)}>Salvar classificação física</Btn>
        </div>
      </Modal>;})()}

      {rentalInvoiceModal&&(()=>{const rental=(data.locacoesEquip||[]).find(item=>item.id===rentalInvoiceModal.rentalId);const eligible=(data.rentalChargeItems||[]).filter(item=>item.rentalId===rentalInvoiceModal.rentalId&&item.competence===rentalInvoiceModal.competence&&["open","measured"].includes(item.status));const selected=eligible.filter(item=>(rentalInvoiceModal.chargeItemIds||[]).includes(item.id)),total=selected.reduce((sum,item)=>sum+Number(item.netAmountCents||0),0);return <Modal title={`Emitir fatura · ${equipName(rental?.equipamentoId)}`} onClose={()=>setRentalInvoiceModal(null)} wide>
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
          <div style={{gridColumn:"1/-1",padding:"9px 11px",border:`1px solid ${C.orange}44`,borderRadius:8,background:`${C.orange}08`}}><p style={{fontSize:10.5,fontWeight:850,color:C.orange}}>EMISSÃO · AINDA NÃO RECEBIDA</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>A emissão congela as linhas selecionadas e cria saldo em aberto, sem movimentar banco.</p></div>
          <Inp label="Número da fatura *" value={rentalInvoiceModal.number} onChange={v=>setRentalInvoiceModal(form=>({...form,number:v}))}/>
          <Inp label="Competência *" type="month" disabled value={rentalInvoiceModal.competence} onChange={()=>{}}/>
          <Inp label="Data de emissão *" type="date" value={rentalInvoiceModal.issueDate} onChange={v=>setRentalInvoiceModal(form=>({...form,issueDate:v}))}/>
          <Inp label="Vencimento *" type="date" value={rentalInvoiceModal.dueDate} onChange={v=>setRentalInvoiceModal(form=>({...form,dueDate:v}))}/>
          <div style={{gridColumn:"1/-1",border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px"}}><p style={{fontSize:9.5,fontWeight:850,color:C.text}}>LINHAS DA FATURA</p>{eligible.map(item=>{const checked=(rentalInvoiceModal.chargeItemIds||[]).includes(item.id);return <label key={item.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"7px 0",fontSize:10.5,borderBottom:`1px solid ${C.line}`}}><span><input type="checkbox" checked={checked} onChange={()=>setRentalInvoiceModal(form=>({...form,chargeItemIds:checked?form.chargeItemIds.filter(id=>id!==item.id):[...form.chargeItemIds,item.id]}))} style={{marginRight:7}}/>{item.description}</span><b>{fmt(Number(item.netAmountCents||0)/100)}</b></label>;})}</div>
          <div style={{gridColumn:"1/-1",display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:900,color:C.orange}}><span>Total faturado</span><span>{fmt(total/100)}</span></div>
          <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><Btn v="ghost" full onClick={()=>setRentalInvoiceModal(null)}>Cancelar</Btn><Btn full disabled={!!salvandoEquipamento||!selected.length||total<=0} loading={salvandoEquipamento===`fatura-${rentalInvoiceModal.rentalId}`} onClick={()=>salvarFaturaLocacao(rentalInvoiceModal)}>Emitir com saldo aberto</Btn></div>
        </div>
      </Modal>;})()}

      {rentalMeasurementModal&&(()=>{const rental=(data.locacoesEquip||[]).find(item=>item.id===rentalMeasurementModal.rentalId),equipment=(data.equipamentos||[]).find(item=>item.id===rental?.equipamentoId);const preview=buildRentalPeriodicCharge({rental,equipment,utilizationStart:rentalMeasurementModal.utilizationStart,utilizationEnd:rentalMeasurementModal.utilizationEnd,competence:rentalMeasurementModal.competence,fixedDiscountCents:Math.round((Number(String(rentalMeasurementModal.fixedDiscount||0).replace(",","."))||0)*100)});return <Modal title={`Medir competência · ${equipName(rental?.equipamentoId)}`} onClose={()=>setRentalMeasurementModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
          <div style={{gridColumn:"1/-1",padding:"9px 11px",border:`1px solid ${C.blue}44`,borderRadius:8,background:`${C.blue}08`}}><p style={{fontSize:10.5,fontWeight:850,color:C.blue}}>MEDIÇÃO CONTRATUAL · NÃO FATURADA</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>Utilização, competência, emissão e pagamento permanecem etapas separadas.</p></div>
          <Inp label="Competência *" type="month" value={rentalMeasurementModal.competence} onChange={v=>setRentalMeasurementModal(form=>({...form,competence:v}))}/>
          <Inp label="Desconto fixo desta medição (R$)" value={rentalMeasurementModal.fixedDiscount} onChange={v=>setRentalMeasurementModal(form=>({...form,fixedDiscount:v}))}/>
          <Inp label="Início da utilização *" type="date" value={rentalMeasurementModal.utilizationStart} onChange={v=>setRentalMeasurementModal(form=>({...form,utilizationStart:v}))}/>
          <Inp label="Fim da utilização *" type="date" value={rentalMeasurementModal.utilizationEnd} onChange={v=>setRentalMeasurementModal(form=>({...form,utilizationEnd:v}))}/>
          <div style={{gridColumn:"1/-1",padding:"10px 12px",border:`1px solid ${preview.ok?C.green:C.red}44`,borderRadius:8}}>{preview.ok?<><p style={{fontSize:9.5,color:C.muted}}>Regra: {preview.record.billingRule} · bruto {fmt(preview.record.grossAmountCents/100)} · descontos {fmt(preview.record.discountAmountCents/100)}</p><p style={{fontSize:14,fontWeight:900,color:C.green,marginTop:3}}>Líquido medido: {fmt(preview.record.netAmountCents/100)}</p></>:<p style={{fontSize:10.5,color:C.red}}>{preview.reason}</p>}</div>
          <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><Btn v="ghost" full onClick={()=>setRentalMeasurementModal(null)}>Cancelar</Btn><Btn full disabled={!!salvandoEquipamento||!preview.ok} loading={salvandoEquipamento===`medicao-${rentalMeasurementModal.rentalId}`} onClick={()=>salvarMedicaoLocacao(rentalMeasurementModal)}>Confirmar medição</Btn></div>
        </div>
      </Modal>;})()}

      {rentalChargeModal&&(()=>{const rental=(data.locacoesEquip||[]).find(item=>item.id===rentalChargeModal.rentalId);const quantity=Number(String(rentalChargeModal.quantity||0).replace(",","."))||0,price=Number(String(rentalChargeModal.unitPrice||0).replace(",","."))||0,discount=Number(String(rentalChargeModal.discountAmount||0).replace(",","."))||0,tax=Number(String(rentalChargeModal.taxAmount||0).replace(",","."))||0;const preview=Math.round((quantity*price-discount+tax)*100)/100;return <Modal title={`Adicionar cobrança · ${equipName(rental?.equipamentoId)}`} onClose={()=>setRentalChargeModal(null)} wide>
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
          <div style={{gridColumn:"1/-1",padding:"9px 11px",border:`1px solid ${C.yellowD}44`,borderRadius:8,background:`${C.yellowD}08`}}><p style={{fontSize:10.5,fontWeight:850,color:C.yellowD}}>LINHA PREPARADA · NÃO FATURADA</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>{obraName(rental?.obraId)} · esta inclusão não gera título nem lançamento bancário.</p></div>
          <Sel label="Tipo *" value={rentalChargeModal.type} onChange={v=>setRentalChargeModal(form=>({...form,type:v}))} options={[{v:"rental",l:"Locação"},{v:"mobilization",l:"Mobilização"},{v:"demobilization",l:"Desmobilização"},{v:"freight",l:"Frete"},{v:"operator",l:"Operador"},{v:"fuel",l:"Combustível"},{v:"cleaning",l:"Limpeza"},{v:"insurance",l:"Seguro"},{v:"accessory",l:"Acessório"},{v:"overtime",l:"Hora excedente"},{v:"late_fee",l:"Atraso"},{v:"damage",l:"Avaria"},{v:"lost_item",l:"Item perdido"},{v:"adjustment",l:"Ajuste"},{v:"discount",l:"Desconto"},{v:"reversal",l:"Estorno"}]}/>
          <Inp label="Competência *" type="month" value={rentalChargeModal.competence} onChange={v=>setRentalChargeModal(form=>({...form,competence:v}))}/>
          <div style={{gridColumn:"1/-1"}}><Inp label="Descrição *" value={rentalChargeModal.description} onChange={v=>setRentalChargeModal(form=>({...form,description:v}))}/></div>
          <Inp label="Quantidade *" value={rentalChargeModal.quantity} onChange={v=>setRentalChargeModal(form=>({...form,quantity:v}))}/>
          <Inp label="Unidade *" value={rentalChargeModal.unit} onChange={v=>setRentalChargeModal(form=>({...form,unit:v}))}/>
          <Inp label="Preço unitário (R$) *" value={rentalChargeModal.unitPrice} onChange={v=>setRentalChargeModal(form=>({...form,unitPrice:v}))}/>
          <Inp label="Desconto (R$)" value={rentalChargeModal.discountAmount} onChange={v=>setRentalChargeModal(form=>({...form,discountAmount:v}))}/>
          <Inp label="Imposto (R$)" value={rentalChargeModal.taxAmount} onChange={v=>setRentalChargeModal(form=>({...form,taxAmount:v}))}/>
          <div style={{display:"flex",alignItems:"end",justifyContent:"flex-end",fontSize:12,fontWeight:850,color:["discount","reversal"].includes(rentalChargeModal.type)?C.red:C.green}}>Líquido previsto: {fmt(["discount","reversal"].includes(rentalChargeModal.type)?-Math.max(0,preview):Math.max(0,preview))}</div>
          <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><Btn v="ghost" full onClick={()=>setRentalChargeModal(null)}>Cancelar</Btn><Btn full disabled={!!salvandoEquipamento} loading={salvandoEquipamento===`cobranca-${rentalChargeModal.rentalId}`} onClick={()=>salvarLinhaCobranca(rentalChargeModal)}>Salvar linha</Btn></div>
        </div>
      </Modal>;})()}

      {rentalAmendmentModal&&(()=>{const rental=(data.locacoesEquip||[]).find(item=>item.id===rentalAmendmentModal.rentalId);return <Modal
        title={`Prorrogar ou renovar · ${equipName(rental?.equipamentoId)}`} onClose={()=>setRentalAmendmentModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
          <div style={{gridColumn:"1/-1",padding:"9px 11px",border:`1px solid ${C.blue}44`,borderRadius:8,background:`${C.blue}08`}}>
            <p style={{fontSize:10.5,fontWeight:850,color:C.blue}}>ADITIVO DE PRAZO AUDITÁVEL</p>
            <p style={{fontSize:9.5,color:C.muted,marginTop:2}}>{obraName(rental?.obraId)} · término planejado atual: {fmtDate(rentalAmendmentModal.currentEnd)}</p>
            <p style={{fontSize:9,color:C.muted,marginTop:2}}>As tarifas e os descontos negociados permanecem congelados. O encerramento real não será alterado.</p>
          </div>
          <Sel label="Tipo de aditivo *" value={rentalAmendmentModal.type} onChange={v=>setRentalAmendmentModal(form=>({...form,type:v}))} options={[{v:"extension",l:"Prorrogação"},{v:"renewal",l:"Renovação"}]}/>
          {rentalAmendmentModal.type==="extension"
            ?<Inp label="Novo término planejado *" type="date" value={rentalAmendmentModal.newEndDate} onChange={v=>setRentalAmendmentModal(form=>({...form,newEndDate:v}))}/>
            :<><Inp label="Início da renovação *" type="date" value={rentalAmendmentModal.startDate} onChange={v=>setRentalAmendmentModal(form=>({...form,startDate:v}))}/><Inp label="Fim da renovação *" type="date" value={rentalAmendmentModal.endDate} onChange={v=>setRentalAmendmentModal(form=>({...form,endDate:v}))}/></>}
          <div style={{gridColumn:"1/-1"}}><Inp label="Motivo" value={rentalAmendmentModal.reason} onChange={v=>setRentalAmendmentModal(form=>({...form,reason:v}))} multiline/></div>
          <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><Btn v="ghost" full onClick={()=>setRentalAmendmentModal(null)}>Cancelar</Btn><Btn full disabled={!!salvandoEquipamento} loading={salvandoEquipamento===`aditivo-${rentalAmendmentModal.rentalId}`} onClick={()=>salvarAditivoLocacao(rentalAmendmentModal)}>Salvar aditivo</Btn></div>
        </div>
      </Modal>;})()}

      {rentalReplacementModal&&(()=>{const rental=(data.locacoesEquip||[]).find(item=>item.id===rentalReplacementModal.rentalId);const modelIds=new Set(physicalRegistry.models.filter(item=>String(item.legacySourceId||"")===String(rental?.equipamentoId)).map(item=>String(item.id)));const unitOptions=physicalRegistry.units.filter(item=>modelIds.has(String(item.modelId))).map(item=>({v:item.id,l:item.assetTag||item.serialNumber||item.id}));return <Modal title={`Substituir unidade · ${equipName(rental?.equipamentoId)}`} onClose={()=>setRentalReplacementModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
          <Sel label="Unidade atual *" value={rentalReplacementModal.outgoingUnitId} onChange={v=>setRentalReplacementModal(form=>({...form,outgoingUnitId:v}))} options={unitOptions.filter(item=>(rental?.equipmentUnitIds||[]).includes(item.v))}/>
          <Sel label="Unidade substituta *" value={rentalReplacementModal.incomingUnitId} onChange={v=>setRentalReplacementModal(form=>({...form,incomingUnitId:v}))} options={[{v:"",l:"Selecione"},...unitOptions.filter(item=>!(rental?.equipmentUnitIds||[]).includes(item.v))]}/>
          <Inp label="Data *" type="date" value={rentalReplacementModal.date} onChange={v=>setRentalReplacementModal(form=>({...form,date:v}))}/>
          <Inp label="Motivo *" value={rentalReplacementModal.reason} onChange={v=>setRentalReplacementModal(form=>({...form,reason:v}))}/>
          <div style={{gridColumn:"1/-1"}}><Inp label="Observações" value={rentalReplacementModal.notes} onChange={v=>setRentalReplacementModal(form=>({...form,notes:v}))} multiline/></div>
          <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><Btn v="ghost" full onClick={()=>setRentalReplacementModal(null)}>Cancelar</Btn><Btn full disabled={!!salvandoEquipamento} onClick={()=>salvarSubstituicaoLocacao(rentalReplacementModal)}>Confirmar substituição</Btn></div>
        </div>
      </Modal>;})()}

      {rentalCheckpointModal&&(()=>{const rental=(data.locacoesEquip||[]).find(item=>item.id===rentalCheckpointModal.rentalId);const returnFlow=[RENTAL_CHECKPOINT_TYPE.RETURN,RENTAL_CHECKPOINT_TYPE.INSPECTION].includes(rentalCheckpointModal.type);return <Modal
        title={`${CHECKPOINT_LABEL[rentalCheckpointModal.type]} · ${equipName(rental?.equipamentoId)}`} onClose={()=>setRentalCheckpointModal(null)} wide>
        <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
          <div style={{gridColumn:"1/-1",padding:"9px 11px",border:`1px solid ${C.blue}44`,borderRadius:8,background:`${C.blue}08`}}>
            <p style={{fontSize:10.5,fontWeight:850,color:C.blue}}>EVIDÊNCIA OPERACIONAL OBRIGATÓRIA</p>
            <p style={{fontSize:9.5,color:C.muted,marginTop:2}}>{obraName(rental?.obraId)} · {rentalStateLabel(rental?.lifecycleState||rental?.status)} → {rentalStateLabel(rentalCheckpointModal.nextState)}</p>
          </div>
          <Inp label="Data *" type="date" value={rentalCheckpointModal.date} onChange={v=>setRentalCheckpointModal(form=>({...form,date:v}))}/>
          <Inp label="Quantidade *" type="number" min="1" disabled={(rentalCheckpointModal.equipmentUnitIds||[]).length>0} value={rentalCheckpointModal.quantity} onChange={v=>setRentalCheckpointModal(form=>({...form,quantity:v}))}/>
          {(rental?.equipmentUnitIds||[]).length>0&&<div style={{gridColumn:"1/-1",padding:"8px 10px",border:`1px solid ${C.border}`,borderRadius:7}}><p style={{fontSize:9,color:C.muted,fontWeight:800}}>UNIDADES FÍSICAS</p>{[RENTAL_CHECKPOINT_TYPE.PARTIAL_DISPATCH,RENTAL_CHECKPOINT_TYPE.PARTIAL_DELIVERY,RENTAL_CHECKPOINT_TYPE.PARTIAL_RETURN].includes(rentalCheckpointModal.type)?<div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>{(rental.equipmentUnitIds||[]).filter(id=>{const balance=rentalCheckpointModal.type===RENTAL_CHECKPOINT_TYPE.PARTIAL_DISPATCH?rentalDispatchBalance(rental,rental.rentalCheckpoints||[]):rentalCheckpointModal.type===RENTAL_CHECKPOINT_TYPE.PARTIAL_DELIVERY?rentalDeliveryBalance(rental,rental.rentalCheckpoints||[]):rentalReturnBalance(rental,rental.rentalCheckpoints||[]);return !(balance.movedUnitIds||balance.returnedUnitIds||[]).includes(String(id));}).map(unitId=>{const selected=(rentalCheckpointModal.equipmentUnitIds||[]).includes(unitId);const unit=physicalRegistry.units.find(item=>item.id===unitId);return <label key={unitId} style={{display:"inline-flex",gap:5,alignItems:"center",fontSize:9.5}}><input type="checkbox" checked={selected} onChange={()=>setRentalCheckpointModal(form=>{const ids=selected?form.equipmentUnitIds.filter(id=>id!==unitId):[...form.equipmentUnitIds,unitId];return {...form,equipmentUnitIds:ids,quantity:Math.max(1,ids.length)};})}/>{unit?.assetTag||unitId}</label>;})}</div>:<p style={{fontSize:10.5,color:C.text,marginTop:3}}>{physicalIdentityForRecord(data,{equipmentUnitIds:rentalCheckpointModal.equipmentUnitIds},(data.equipamentos||[]).find(item=>item.id===rental?.equipamentoId)).label}</p>}</div>}
          <Inp label="Acessórios" value={rentalCheckpointModal.accessories} onChange={v=>setRentalCheckpointModal(form=>({...form,accessories:v}))} placeholder="Separe por vírgula"/>
          <Inp label="Horímetro" type="number" min="0" value={rentalCheckpointModal.hourMeter} onChange={v=>setRentalCheckpointModal(form=>({...form,hourMeter:v}))}/>
          <Inp label="Combustível" value={rentalCheckpointModal.fuel} onChange={v=>setRentalCheckpointModal(form=>({...form,fuel:v}))} placeholder="Ex.: cheio, 3/4, 50%"/>
          <Inp label="Condição aparente" value={rentalCheckpointModal.condition} onChange={v=>setRentalCheckpointModal(form=>({...form,condition:v}))}/>
          {rentalCheckpointModal.type!==RENTAL_CHECKPOINT_TYPE.SEPARATION&&<Inp label="Responsável pela movimentação *" value={rentalCheckpointModal.responsible} onChange={v=>setRentalCheckpointModal(form=>({...form,responsible:v}))}/>}
          {[RENTAL_CHECKPOINT_TYPE.PARTIAL_DELIVERY,RENTAL_CHECKPOINT_TYPE.DELIVERY].includes(rentalCheckpointModal.type)&&<><Inp label="Responsável pelo recebimento *" value={rentalCheckpointModal.receivedBy} onChange={v=>setRentalCheckpointModal(form=>({...form,receivedBy:v}))}/><Inp label="Endereço da entrega *" value={rentalCheckpointModal.address} onChange={v=>setRentalCheckpointModal(form=>({...form,address:v}))}/><Inp label="Assinatura ou aceite" value={rentalCheckpointModal.acceptance} onChange={v=>setRentalCheckpointModal(form=>({...form,acceptance:v}))}/></>}
          {returnFlow&&<><Sel label="Limpeza" value={rentalCheckpointModal.cleaning} onChange={v=>setRentalCheckpointModal(form=>({...form,cleaning:v}))} options={[{v:"",l:"Não informado"},{v:"dispensada",l:"Dispensada"},{v:"realizada",l:"Realizada"},{v:"necessária",l:"Necessária"}]}/><Sel label="Necessita ajuste" value={String(rentalCheckpointModal.needsAdjustment)} onChange={v=>setRentalCheckpointModal(form=>({...form,needsAdjustment:v}))} options={[{v:"false",l:"Não"},{v:"true",l:"Sim"}]}/><Inp label="Avarias" value={rentalCheckpointModal.damages} onChange={v=>setRentalCheckpointModal(form=>({...form,damages:v}))} placeholder="Separe por vírgula"/><Inp label="Itens faltantes" value={rentalCheckpointModal.missingItems} onChange={v=>setRentalCheckpointModal(form=>({...form,missingItems:v}))} placeholder="Separe por vírgula"/></>}
          <div style={{gridColumn:"1/-1"}}><Inp label="Fotos (uma URL por linha)" value={rentalCheckpointModal.photos} onChange={v=>setRentalCheckpointModal(form=>({...form,photos:v}))} multiline/></div>
          <div style={{gridColumn:"1/-1"}}><Inp label="Observações" value={rentalCheckpointModal.notes} onChange={v=>setRentalCheckpointModal(form=>({...form,notes:v}))} multiline/></div>
          <div style={{gridColumn:"1/-1",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><Btn v="ghost" full onClick={()=>setRentalCheckpointModal(null)}>Cancelar</Btn><Btn full disabled={!!salvandoEquipamento} loading={salvandoEquipamento===`checklist-${rentalCheckpointModal.rentalId}`} onClick={()=>salvarChecklistLocacao(rentalCheckpointModal)}>Salvar checklist</Btn></div>
        </div>
      </Modal>;})()}

      {locModal && (
        <Modal title={locModal.id?"Editar locação":"Nova locação"} onClose={()=>setLocModal(null)} wide>
          <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
            <Sel label="Equipamento *" value={locModal.equipamentoId} onChange={v=>{
              const e=(data.equipamentos||[]).find(x=>x.id===v);
              const lot=physicalRegistry.lots.find(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===String(v));
              setLocModal(f=>({...f,equipamentoId:v,equipmentLotId:lot?.id||"",equipmentUnitIds:[],quantidade:1,
                valorDiaria:f.valorDiaria||e?.valorDiaria||"",custoDiaria:f.custoDiaria||e?.custoDiaria||""}));
            }} options={equipOpts}/>
            <Sel label="Obra *" value={locModal.obraId} onChange={v=>setLocModal(f=>({...f,obraId:v}))} options={obraOpts}/>
            <Inp label="Início *" type="date" value={locModal.inicio} onChange={v=>setLocModal(f=>({...f,inicio:v}))}/>
            <Inp label="Término (vazio = em andamento)" type="date" value={locModal.fim} onChange={v=>setLocModal(f=>({...f,fim:v}))}/>

            {/* QUANTIDADE: itens de lote (andaime, plataforma) vao varios para
                a mesma obra. Mostra quantos ainda estao livres na frota. */}
            {(() => {
              const eqQ = (data.equipamentos||[]).find(x=>x.id===locModal.equipamentoId);
              if (!eqQ) return null;
              const individualized=physicalRegistry.units.some(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===String(eqQ.id));
              const availability=rentalAvailability({data,equipment:eqQ,rental:locModal,exceptRentalId:locModal.id});
              const {total,rented:emUsoOutros,unavailable,free:livre,requested:pedido,exceeded:estoura}=availability;
              const periodo=`${fmtDate(locModal.inicio||today())} a ${locModal.fim?fmtDate(locModal.fim):"em aberto"}`;
              return (
                <div style={{gridColumn:"1/-1"}}>
                  <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8,alignItems:"end"}}>
                    <Inp label="Quantidade para esta obra *" type="number" min="1"
                         disabled={individualized}
                         value={locModal.quantidade ?? 1}
                         onChange={v=>setLocModal(f=>({...f,quantidade:v}))}/>
                    <div style={{background:estoura?`${C.red}0C`:C.surface,
                                 border:`1px solid ${estoura?C.red+"55":C.border}`,
                                 borderRadius:9,padding:"9px 12px"}}>
                      <p style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:.5,fontWeight:800}}>Disponibilidade de {periodo}</p>
                      <p style={{fontSize:12,color:C.text,marginTop:3}}>
                        <b>{total}</b> total · <b>{emUsoOutros}</b> locada(s) · <b>{unavailable}</b> indisponível(is) ·{" "}
                        <b style={{color:livre>0?C.green:C.red}}>{livre}</b> livre(s)
                      </p>
                      {estoura && (
                        <p style={{fontSize:10.5,color:C.red,fontWeight:700,marginTop:4,lineHeight:1.4}}>
                          Solicitação de {pedido} unidade(s) bloqueada: há somente {livre} livre(s) no período.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            {locModal.equipamentoId&&(()=>{
              const sourceId=String(locModal.equipamentoId);
              const units=physicalRegistry.units.filter(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===sourceId);
              const lots=physicalRegistry.lots.filter(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===sourceId);
              if(!units.length&&!lots.length)return null;
              return <div style={{gridColumn:"1/-1",padding:"10px 12px",border:`1px solid ${C.blue}38`,borderRadius:9,background:`${C.blue}07`}}>
                <p style={{fontSize:10.5,fontWeight:850,color:C.blue}}>Identificação física</p>
                {lots.length>0&&<div style={{marginTop:7}}><Sel label="Lote" value={locModal.equipmentLotId||lots[0]?.id||""}
                  onChange={v=>setLocModal(form=>({...form,equipmentLotId:v,equipmentUnitIds:[]}))}
                  options={lots.map(lot=>({v:lot.id,l:`${lot.lotCode||lot.id} · ${lot.quantity} ${lot.unit||"un"}`}))}/></div>}
                {units.length>0&&<div style={{marginTop:7}}><p style={{fontSize:9.5,fontWeight:800,color:C.text,marginBottom:6}}>Unidades desta locação</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{units.map(unit=>{
                    const selected=(locModal.equipmentUnitIds||[]).includes(unit.id);
                    return <label key={unit.id} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 8px",border:`1px solid ${selected?C.blue:C.border}`,borderRadius:7,background:selected?`${C.blue}10`:C.card,fontSize:9.5,color:C.text,cursor:"pointer"}}>
                      <input type="checkbox" checked={selected} onChange={()=>setLocModal(form=>{
                        const current=form.equipmentUnitIds||[];
                        const next=selected?current.filter(id=>id!==unit.id):[...current,unit.id];
                        return {...form,equipmentUnitIds:next,equipmentLotId:"",quantidade:Math.max(1,next.length)};
                      })} style={{accentColor:C.blue}}/>{unit.assetTag||unit.serialNumber||unit.id}
                    </label>;
                  })}</div>
                  <p style={{fontSize:9,color:C.muted,marginTop:6}}>A quantidade acompanha o número de unidades marcadas.</p>
                </div>}
              </div>;
            })()}
            {/* Tarifas: por padrao usa a tabela do equipamento. Marque para
                negociar um preco so para esta obra. */}
            {(() => {
              const eq = (data.equipamentos||[]).find(x=>x.id===locModal.equipamentoId);
              const snapshotCongelado=!!locModal.commercialSnapshot;
              const usaProprias = locModal.tarifaNegociada===true
                || PACOTES_TARIFA.some(p => Number(locModal.tarifas?.[p.id]||0) > 0);
              const tarifasEfetivas = tarifasDaLocacao(locModal, eq);
              // Dias do contrato (se tiver fim); senao mostra a previa de 30 dias.
              const diasContrato = locModal.inicio && locModal.fim
                ? diasCorridos(locModal.inicio, locModal.fim) + 1 : 0;
              const diasPrevia = diasContrato || 30;
              const cob = cobrancaLocacao({...locModal, tarifas:tarifasEfetivas}, eq, diasPrevia);
              return (
                <div style={{gridColumn:"1/-1",display:"flex",flexDirection:"column",gap:9}}>
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 13px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:8}}>
                      <p style={{fontSize:11,fontWeight:800,color:C.text}}>Tarifas desta locação</p>
                      {!snapshotCongelado&&<label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.muted,cursor:"pointer"}}>
                        <input type="checkbox" checked={usaProprias}
                          onChange={e=>setLocModal(f=>({...f,
                            tarifaNegociada:e.target.checked,
                            tarifas: e.target.checked ? {...(eq?.tarifas||{})} : {dia:0,semana:0,quinzena:0,mes:0}}))}
                          style={{width:15,height:15,accentColor:C.yellowD,cursor:"pointer"}}/>
                        Negociar preço só para esta obra
                      </label>}
                    </div>
                    {snapshotCongelado ? <p style={{fontSize:10.5,color:C.blue,lineHeight:1.5}}>
                      Condições comerciais congeladas em {locModal.commercialSnapshot.negociadoEm?fmtDate(String(locModal.commercialSnapshot.negociadoEm).slice(0,10)):"data não registrada"}
                      {locModal.commercialSnapshot.negociadoPor?` por ${locModal.commercialSnapshot.negociadoPor}`:""}. Alterações no cadastro do equipamento não modificam este contrato.
                    </p> : usaProprias ? (
                      <div style={{display:"grid",gridTemplateColumns:formGrid(4),gap:8}}>
                        {[["dia","Por dia"],["semana","Por semana"],["quinzena","Por quinzena"],["mes","Por mês"]].map(([k,l])=>(
                          <Inp key={k} label={`${l} (R$)`} type="number" min="0"
                               value={locModal.tarifas?.[k] ?? ""}
                               onChange={v=>setLocModal(f=>({...f,tarifas:{...(f.tarifas||{}),[k]:v}}))}/>
                        ))}
                      </div>
                    ) : (
                      <p style={{fontSize:10.5,color:C.muted,lineHeight:1.5}}>
                        Usando a tabela do cadastro:{" "}
                        {PACOTES_TARIFA.filter(p=>Number(tarifasEfetivas?.[p.id]||0)>0)
                          .map(p=>`${p.label} ${fmt(tarifasEfetivas[p.id])}`).join(" · ") || "nenhuma tarifa cadastrada"}
                      </p>
                    )}
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
                    <Sel label="Regra de cobrança *" disabled={snapshotCongelado} value={locModal.commercialSnapshot?.regraTarifaria||locModal.regraTarifaria||"best_combination"} onChange={v=>setLocModal(f=>({...f,regraTarifaria:v}))} options={[{v:"best_combination",l:"Melhor combinação tarifária"},{v:"calendar_day",l:"Por dia corrido"},{v:"business_day",l:"Por dia útil"},{v:"minimum_daily",l:"Diária mínima"},{v:"tariff_week",l:"Semana tarifária"},{v:"tariff_fortnight",l:"Quinzena tarifária"},{v:"thirty_day_month",l:"Mês de 30 dias"},{v:"civil_month",l:"Mês civil"},{v:"anniversary_cycle",l:"Ciclo por aniversário"}]}/>
                    <Inp label="Desconto ao cliente (%)" type="number" min="0" max="100" disabled={snapshotCongelado} value={locModal.descontoPct} onChange={v=>setLocModal(f=>({...f,descontoPct:v}))}/>
                    <Inp label="Desconto fixo (R$)" type="number" min="0" disabled={snapshotCongelado} value={locModal.descontoValor} onChange={v=>setLocModal(f=>({...f,descontoValor:v}))}/>
                  </div>

                  {/* Previa do que sera cobrado */}
                  <div style={{background:`${C.green}0A`,border:`1px solid ${C.green}44`,borderRadius:9,padding:"11px 13px"}}>
                    <p style={{fontSize:10,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>
                      {diasContrato ? `Cobrança do período (${diasContrato} dia${diasContrato>1?"s":""})` : "Simulação para 30 dias"}
                    </p>
                    {cob.semTarifa
                      ? <p style={{fontSize:11.5,color:C.orange}}>Sem tarifa cadastrada para este equipamento.</p>
                      : (<>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,color:C.text}}>
                          <span>{textoComposicao(cob.composicao)}{cob.quantidade>1?` × ${cob.quantidade} un`:""}</span>
                          <span style={{fontWeight:700}}>{fmt(cob.bruto)}</span>
                        </div>
                        {cob.quantidade>1 && (
                          <p style={{fontSize:9.5,color:C.muted,marginTop:2}}>
                            {fmt(cob.brutoUnitario)} por unidade
                          </p>
                        )}
                        {cob.desconto > 0.005 && (
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.orange,marginTop:3}}>
                            <span>Desconto</span><span>- {fmt(cob.desconto)}</span>
                          </div>
                        )}
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:800,
                                     color:C.green,marginTop:6,paddingTop:6,borderTop:`1px solid ${C.green}33`}}>
                          <span>Total</span><span>{fmt(cob.liquido)}</span>
                        </div>
                        <p style={{fontSize:9.5,color:C.muted,marginTop:5,lineHeight:1.45}}>
                          Combinação mais barata entre as modalidades cadastradas.
                          Para a cobrança, 1 mês tarifário corresponde a 30 dias; um período de 31 dias soma 1 mês + 1 diária.
                        </p>
                      </>)}
                  </div>
                </div>
              );
            })()}
            <div style={{gridColumn:"1/-1"}}><Inp label="Observações" value={locModal.obs} onChange={v=>setLocModal(f=>({...f,obs:v}))} multiline/></div>
            <div style={{gridColumn:"1/-1"}}><Btn full loading={salvandoEquipamento==="locacao"} disabled={!!salvandoEquipamento} onClick={()=>salvarLoc(locModal)}>{salvandoEquipamento==="locacao"?"Salvando locação...":"Salvar locação"}</Btn></div>
          </div>
        </Modal>
      )}

      {manutModal && (
        <Modal title="Manutenção" onClose={()=>setManutModal(null)} wide>
          <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
            <Sel label="Equipamento *" value={manutModal.equipamentoId} onChange={v=>{
              const lot=physicalRegistry.lots.find(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===String(v));
              setManutModal(f=>({...f,equipamentoId:v,equipmentLotId:lot?.id||"",equipmentUnitIds:[],quantidade:1}));
            }} options={equipOpts}/>
            <Inp label="Início *" type="date" value={manutModal.inicio||manutModal.data} onChange={v=>setManutModal(f=>({...f,inicio:v,data:v}))}/>
            <Inp label="Término *" type="date" value={manutModal.fim||manutModal.inicio||manutModal.data} onChange={v=>setManutModal(f=>({...f,fim:v}))}/>
            <Inp label="Unidades indisponíveis *" type="number" min="1"
              disabled={physicalRegistry.units.some(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===String(manutModal.equipamentoId))}
              value={manutModal.quantidade||1} onChange={v=>setManutModal(f=>({...f,quantidade:v}))}/>
            {manutModal.equipamentoId&&(()=>{
              const sourceId=String(manutModal.equipamentoId);
              const units=physicalRegistry.units.filter(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===sourceId);
              const lots=physicalRegistry.lots.filter(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===sourceId);
              return <div style={{gridColumn:"1/-1",padding:"10px 12px",border:`1px solid ${C.orange}38`,borderRadius:9,background:`${C.orange}07`}}>
                <p style={{fontSize:10.5,fontWeight:850,color:C.orange}}>Ativo que ficará indisponível</p>
                {lots.length>0&&<div style={{marginTop:7}}><Sel label="Lote" value={manutModal.equipmentLotId||lots[0]?.id||""} onChange={v=>setManutModal(form=>({...form,equipmentLotId:v,equipmentUnitIds:[]}))} options={lots.map(lot=>({v:lot.id,l:`${lot.lotCode||lot.id} · ${lot.quantity} ${lot.unit||"un"}`}))}/></div>}
                {units.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:7}}>{units.map(unit=>{
                  const selected=(manutModal.equipmentUnitIds||[]).includes(unit.id);
                  return <label key={unit.id} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 8px",border:`1px solid ${selected?C.orange:C.border}`,borderRadius:7,background:selected?`${C.orange}10`:C.card,fontSize:9.5,cursor:"pointer"}}><input type="checkbox" checked={selected} onChange={()=>setManutModal(form=>{const current=form.equipmentUnitIds||[];const next=selected?current.filter(id=>id!==unit.id):[...current,unit.id];return {...form,equipmentUnitIds:next,equipmentLotId:"",quantidade:Math.max(1,next.length)};})} style={{accentColor:C.orange}}/>{unit.assetTag||unit.serialNumber||unit.id}</label>;
                })}</div>}
              </div>;
            })()}
            <Sel label="Tipo" value={manutModal.tipo} onChange={v=>setManutModal(f=>({...f,tipo:v}))} options={[{v:"corretiva",l:"Corretiva"},{v:"preventiva",l:"Preventiva"}]}/>
            <Inp label="Custo (R$) *" type="number" value={manutModal.custo} onChange={v=>setManutModal(f=>({...f,custo:v}))}/>
            <Sel label="Pago por" value={manutModal.pagoPor} onChange={v=>setManutModal(f=>({...f,pagoPor:v}))} options={[{v:"empresa",l:"Empresa"},{v:"proprietario",l:"Proprietário (terceiro)"}]}/>
            <Inp label="Fornecedor / oficina" value={manutModal.fornecedor} onChange={v=>setManutModal(f=>({...f,fornecedor:v}))}/>
            <div style={{gridColumn:"1/-1"}}><Inp label="Descrição" value={manutModal.descricao} onChange={v=>setManutModal(f=>({...f,descricao:v}))} multiline/></div>
            <div style={{gridColumn:"1/-1"}}><Btn full onClick={()=>salvarManut(manutModal)}>Registrar manutenção</Btn></div>
          </div>
        </Modal>
      )}

      {indispModal && (
        <Modal title={indispModal.id?"Editar indisponibilidade":"Reservar ou bloquear equipamento"} onClose={()=>setIndispModal(null)} wide>
          <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:8}}>
            <Sel label="Equipamento *" value={indispModal.equipmentId} onChange={v=>setIndispModal(f=>({...f,equipmentId:v}))} options={equipOpts}/>
            <Sel label="Tipo *" value={indispModal.type} onChange={v=>setIndispModal(f=>({...f,type:v}))} options={[
              {v:"reservation",l:"Reserva"},{v:"inspection",l:"Inspeção"},{v:"transport",l:"Transporte"},
              {v:"damage",l:"Avaria"},{v:"administrative_block",l:"Bloqueio administrativo"},{v:"quarantine",l:"Quarentena"},
            ]}/>
            <Inp label="Início *" type="date" value={indispModal.startDate} onChange={v=>setIndispModal(f=>({...f,startDate:v}))}/>
            <Inp label="Término *" type="date" value={indispModal.endDate} onChange={v=>setIndispModal(f=>({...f,endDate:v}))}/>
            <Inp label="Quantidade *" type="number" min="1" value={indispModal.quantity||1} onChange={v=>setIndispModal(f=>({...f,quantity:v}))}/>
            <Sel label="Obra (opcional)" value={indispModal.workId||""} onChange={v=>setIndispModal(f=>({...f,workId:v}))} options={obraOpts}/>
            <div style={{gridColumn:"1/-1"}}><Inp label="Motivo *" value={indispModal.reason} onChange={v=>setIndispModal(f=>({...f,reason:v}))} multiline/></div>
            <div style={{gridColumn:"1/-1",display:"flex",gap:8,justifyContent:"flex-end"}}>
              {indispModal.id&&isActiveUnavailability(indispModal)&&<Btn v="danger" onClick={()=>{cancelarIndisponibilidade(indispModal);setIndispModal(null);}}><Ic n="trash"/> Cancelar</Btn>}
              <Btn onClick={()=>salvarIndisponibilidade(indispModal)}><Ic n="check"/> Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {transfModal && (
        <Modal title="Transferir equipamento" onClose={()=>setTransfModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Sel label="Equipamento *" value={transfModal.equipamentoId} onChange={v=>{
              const lot=physicalRegistry.lots.find(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===String(v));
              const position=physicalRegistry.allocations.find(item=>item.lotId===lot?.id);
              setTransfModal(f=>({...f,equipamentoId:v,equipmentLotId:lot?.id||"",equipmentUnitIds:[],quantidade:1,deLocationId:position?.locationId||"depot"}));
            }} options={equipOpts}/>
            {transfModal.equipamentoId&&(()=>{
              const sourceId=String(transfModal.equipamentoId);
              const units=physicalRegistry.units.filter(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===sourceId);
              const lots=physicalRegistry.lots.filter(item=>String(item.legacySourceId||item.sourceEquipmentId||"")===sourceId);
              const selectedAssets=new Set([transfModal.equipmentLotId,...(transfModal.equipmentUnitIds||[])].filter(Boolean));
              const positions=physicalRegistry.allocations.filter(item=>selectedAssets.has(item.lotId||item.unitId)&&item.type!=="exceeded");
              const locationOptions=[...new Set(positions.map(item=>item.locationId))].map(id=>({v:id,l:id==="depot"?"Depósito":obraName(id)}));
              return <div style={{padding:"9px 10px",border:`1px solid ${C.blue}38`,borderRadius:8,background:`${C.blue}07`,display:"grid",gap:7}}>
                {lots.length>0&&<Sel label="Lote" value={transfModal.equipmentLotId||lots[0]?.id||""} onChange={v=>setTransfModal(form=>({...form,equipmentLotId:v,equipmentUnitIds:[]}))} options={lots.map(lot=>({v:lot.id,l:`${lot.lotCode||lot.id} · ${lot.quantity} ${lot.unit||"un"}`}))}/>}
                {units.length>0&&<div><p style={{fontSize:9.5,fontWeight:800,color:C.text,marginBottom:5}}>Patrimônio(s)</p><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{units.map(unit=>{const selected=(transfModal.equipmentUnitIds||[]).includes(unit.id);return <label key={unit.id} style={{fontSize:9.5,padding:"5px 7px",border:`1px solid ${selected?C.blue:C.border}`,borderRadius:6,cursor:"pointer"}}><input type="checkbox" checked={selected} onChange={()=>setTransfModal(form=>{const current=form.equipmentUnitIds||[];const next=selected?current.filter(id=>id!==unit.id):[...current,unit.id];const firstPosition=physicalRegistry.allocations.find(item=>item.unitId===next[0]);return {...form,equipmentUnitIds:next,equipmentLotId:"",quantidade:Math.max(1,next.length),deLocationId:firstPosition?.locationId||"depot"};})} style={{accentColor:C.blue,marginRight:5}}/>{unit.assetTag||unit.id}</label>;})}</div></div>}
                <Inp label="Quantidade" type="number" min="1" disabled={units.length>0} value={transfModal.quantidade||1} onChange={v=>setTransfModal(form=>({...form,quantidade:v}))}/>
                <Sel label="Origem física" value={transfModal.deLocationId||locationOptions[0]?.v||"depot"} onChange={v=>setTransfModal(form=>({...form,deLocationId:v}))} options={locationOptions.length?locationOptions:[{v:"depot",l:"Depósito"}]}/>
              </div>;
            })()}
            <Sel label="Para a obra *" value={transfModal.paraObraId} onChange={v=>setTransfModal(f=>({...f,paraObraId:v}))} options={obraOpts}/>
            <Inp label="Data" type="date" value={transfModal.data} onChange={v=>setTransfModal(f=>({...f,data:v}))}/>
            <Inp label="Responsável" value={transfModal.responsavel} onChange={v=>setTransfModal(f=>({...f,responsavel:v}))}/>
            <Inp label="Observações" value={transfModal.obs} onChange={v=>setTransfModal(f=>({...f,obs:v}))} multiline/>
            <Btn full onClick={()=>salvarTransf(transfModal)}>Confirmar transferência</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Exporta a mesma matriz exibida na tela: equipamento nas linhas, obra nas
// colunas e medidas separadas para dias, diárias-unidade e cobrança.
const exportarRelEquipPorObra = (data, ym, rel, helpers) => {
  const cabecalho=["Equipamento","Identidade física","Quantidade da frota","Dono"];
  rel.obras.forEach(obra=>cabecalho.push(
    `${obra.name} - dias`,
    `${obra.name} - diárias-unidade`,
    `${obra.name} - cobrança`,
    `${obra.name} - repasse`,
    `${obra.name} - descontos`,
    `${obra.name} - resultado`,
  ));
  cabecalho.push("Total diárias-unidade","Total cobrança","Total repasse","Total descontos","Total resultado");
  const linhas=[cabecalho];
  rel.linhas.filter(linha=>linha.total.unidadeDias>0||linha.total.receita>0||linha.total.custoDono>0).forEach(linha=>{
    const registro=[
      linha.equip.nome,
      physicalIdentityForRecord(data,{},linha.equip).label,
      Math.max(1,Number(linha.equip.quantidadeTotal||1)),
      linha.equip.proprietarioId?helpers.donoName(linha.equip.proprietarioId):"Empresa",
    ];
    rel.obras.forEach(obra=>{
      const celula=linha.porObra[obra.id];
      registro.push(
        celula.dias,
        celula.unidadeDias,
        celula.receita.toFixed(2),
        celula.custoDono.toFixed(2),
        celula.descontos.toFixed(2),
        celula.lucro.toFixed(2),
      );
    });
    registro.push(
      linha.total.unidadeDias,
      linha.total.receita.toFixed(2),
      linha.total.custoDono.toFixed(2),
      linha.total.descontos.toFixed(2),
      linha.total.lucro.toFixed(2),
    );
    linhas.push(registro);
  });
  const totais=["TOTAL","","",""];
  rel.obras.forEach(obra=>{
    const totalObra=rel.totaisPorObra[obra.id];
    totais.push(
      totalObra.dias,
      totalObra.unidadeDias,
      totalObra.receita.toFixed(2),
      totalObra.custoDono.toFixed(2),
      totalObra.descontos.toFixed(2),
      totalObra.lucro.toFixed(2),
    );
  });
  totais.push(
    rel.total.unidadeDias,
    rel.total.receita.toFixed(2),
    rel.total.custoDono.toFixed(2),
    rel.total.descontos.toFixed(2),
    rel.total.lucro.toFixed(2),
  );
  linhas.push(totais);
  baixarCsv(linhas,`equipamentos-gerencial-${ym}.csv`);
};

const exportarRelEquipObraDetalhado=(data,ym,rel,obra)=>{
  if(!obra)return;
  const linhas=[[
    "Obra","Equipamento","Identidade física","Localização","Início cobrado","Fim cobrado",
    "Situação","Quantidade","Dias","Diárias-unidade","Composição tarifária",
    "Valor bruto","Desconto","Cobrança líquida","Observação",
  ]];
  rel.linhas.forEach(linha=>{
    (linha.porObra[obra.id]?.detalhes||[]).forEach(detalhe=>linhas.push([
      obra.name,
      linha.equip.nome,
      physicalIdentityForRecord(data,detalhe,linha.equip).label,
      obra.name,
      detalhe.inicio,
      detalhe.fim,
      detalhe.status==="em_andamento"?"Em andamento":"Encerrada",
      detalhe.quantidade,
      detalhe.dias,
      detalhe.unidadeDias,
      detalhe.semTarifa?"Sem tarifa":textoComposicao(detalhe.composicao),
      detalhe.bruto.toFixed(2),
      detalhe.descontos.toFixed(2),
      detalhe.receita.toFixed(2),
      detalhe.observacao,
    ]));
  });
  const total=rel.totaisPorObra[obra.id]||{};
  linhas.push([
    "TOTAL","","","","","","","","",Number(total.unidadeDias||0),"",
    (Number(total.receita||0)+Number(total.descontos||0)).toFixed(2),
    Number(total.descontos||0).toFixed(2),
    Number(total.receita||0).toFixed(2),
    "",
  ]);
  const nomeSeguro=String(obra.name||"obra").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"").toLowerCase();
  baixarCsv(linhas,`equipamentos-${nomeSeguro}-${ym}.csv`);
};

const baixarCsv=(linhas,nomeArquivo)=>{
  const csv = linhas.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomeArquivo; a.click();
  URL.revokeObjectURL(url);
};

function imprimirRelEquipGerencial(data,ym,mesLabel,monthly,matrix,donoName,showToast){
  const pct=(parte,total)=>Number(total||0)>0?(Number(parte||0)/Number(total))*100:0;
  const dias=Math.floor((Date.parse(`${matrix.fim}T00:00:00Z`)-Date.parse(`${matrix.inicio}T00:00:00Z`))/86400000)+1;
  const unidades=(data.equipamentos||[]).filter(item=>item.ativo!==false)
    .reduce((sum,item)=>sum+Math.max(1,Number(item.quantidadeTotal||1)),0);
  const capacidade=unidades*dias;
  const detalhes=matrix.linhas.flatMap(linha=>matrix.obras.flatMap(obra=>
    (linha.porObra[obra.id]?.detalhes||[]).map(detalhe=>({linha,obra,detalhe}))));
  const obras=matrix.obras.map(obra=>{
    const total=matrix.totaisPorObra[obra.id];
    const daObra=detalhes.filter(item=>item.obra.id===obra.id);
    return {obra,total,locacoes:daObra.length,equipamentos:new Set(daObra.map(item=>item.linha.equip.id)).size};
  }).filter(item=>item.total.unidadeDias>0||item.total.receita>0||item.total.custoDono>0)
    .sort((a,b)=>b.total.receita-a.total.receita);
  const equipamentos=monthly.linhas.filter(linha=>linha.receita>0||linha.custo>0||linha.diasTotais>0)
    .slice().sort((a,b)=>b.receita-a.receita);
  const proprietariosPorObra=(()=>{
    const agrupado=new Map();
    detalhes.filter(item=>item.linha.equip.proprietarioId).forEach(item=>{
      const proprietarioId=item.linha.equip.proprietarioId;
      const chave=`${proprietarioId}:${item.obra.id}`;
      const atual=agrupado.get(chave)||{
        proprietarioId,
        proprietario:donoName(proprietarioId),
        obra:item.obra,
        equipamentos:new Set(),
        locacoes:0,
        unidadeDias:0,
        valor:0,
      };
      atual.equipamentos.add(item.linha.equip.id);
      atual.locacoes++;
      atual.unidadeDias+=Number(item.detalhe.unidadeDias||0);
      atual.valor+=Number(item.detalhe.custoDono||0);
      agrupado.set(chave,atual);
    });
    return [...agrupado.values()].map(item=>({...item,quantidadeEquipamentos:item.equipamentos.size}))
      .sort((a,b)=>String(a.proprietario).localeCompare(String(b.proprietario))
        ||String(a.obra.name).localeCompare(String(b.obra.name)));
  })();
  const html=montarRelatorioPadraoHtml({
    data,
    titulo:"Relatório gerencial de locações",
    subtitulo:mesLabel,
    meta:[
      {label:"Competência",value:ym},
      {label:"Obras movimentadas",value:String(obras.length)},
      {label:"Locações no período",value:String(detalhes.length)},
      {label:"Frota ativa",value:`${unidades} unidade(s)`},
    ],
    kpis:[
      {label:"Receita líquida",value:fmt(monthly.total.receita)},
      {label:"Custo total",value:fmt(monthly.total.custo)},
      {label:"Resultado",value:fmt(monthly.total.lucro)},
      {label:"Margem",value:`${pct(monthly.total.lucro,monthly.total.receita).toFixed(1)}%`},
      {label:"Utilização",value:`${pct(matrix.total.unidadeDias,capacidade).toFixed(1)}%`},
      {label:"Descontos",value:fmt(monthly.total.descontos)},
    ],
    legenda:`Base de utilização: ${matrix.total.unidadeDias} de ${capacidade} diárias-unidade. Resultado das obras considera cobrança menos repasse ao proprietário; o resultado gerencial também deduz ${fmt(monthly.total.manut)} de manutenção paga pela empresa.`,
    tabelas:[
      {
        titulo:"Resultado por obra",
        descricao:"Centros de resultado ordenados pela cobrança líquida.",
        headers:["Obra",{label:"Locações",num:true},{label:"Equip.",num:true},{label:"Diárias-un.",num:true},{label:"Bruto",num:true},{label:"Descontos",num:true},{label:"Cobrança",num:true},{label:"Repasse",num:true},{label:"Resultado",num:true},{label:"Margem",num:true}],
        rows:obras.map(item=>[
          escapeHtml(item.obra.name),
          String(item.locacoes),
          String(item.equipamentos),
          String(item.total.unidadeDias),
          escapeHtml(fmt(item.total.receita+item.total.descontos)),
          escapeHtml(fmt(item.total.descontos)),
          escapeHtml(fmt(item.total.receita)),
          escapeHtml(fmt(item.total.custoDono)),
          escapeHtml(fmt(item.total.lucro)),
          `${pct(item.total.lucro,item.total.receita).toFixed(1)}%`,
        ]),
        totalRow:[
          "TOTAL",
          String(detalhes.length),
          String(new Set(detalhes.map(item=>item.linha.equip.id)).size),
          String(matrix.total.unidadeDias),
          escapeHtml(fmt(matrix.total.receita+matrix.total.descontos)),
          escapeHtml(fmt(matrix.total.descontos)),
          escapeHtml(fmt(matrix.total.receita)),
          escapeHtml(fmt(matrix.total.custoDono)),
          escapeHtml(fmt(matrix.total.lucro)),
          `${pct(matrix.total.lucro,matrix.total.receita).toFixed(1)}%`,
        ],
      },
      {
        titulo:"Rentabilidade por equipamento",
        descricao:"Receita, repasses, manutenção e resultado de cada item da frota.",
        headers:["Equipamento","Identidade física","Proprietário",{label:"Dias contrato",num:true},{label:"Diárias-un.",num:true},{label:"Receita",num:true},{label:"Descontos",num:true},{label:"Repasse",num:true},{label:"Manutenção",num:true},{label:"Resultado",num:true},{label:"Margem",num:true}],
        rows:equipamentos.map(linha=>[
          escapeHtml(linha.equip.nome),
          escapeHtml(physicalIdentityForRecord(data,{},linha.equip).label),
          escapeHtml(linha.proprio?"Empresa":donoName(linha.equip.proprietarioId)),
          String(linha.diasContrato),
          String(linha.unidadeDias),
          escapeHtml(fmt(linha.receita)),
          escapeHtml(fmt(linha.descontos)),
          escapeHtml(fmt(linha.custoDono)),
          escapeHtml(fmt(linha.manut)),
          escapeHtml(fmt(linha.lucro)),
          `${pct(linha.lucro,linha.receita).toFixed(1)}%`,
        ]),
        totalRow:[
          "TOTAL","","","","",
          escapeHtml(fmt(monthly.total.receita)),
          escapeHtml(fmt(monthly.total.descontos)),
          escapeHtml(fmt(monthly.total.custoDono)),
          escapeHtml(fmt(monthly.total.manut)),
          escapeHtml(fmt(monthly.total.lucro)),
          `${pct(monthly.total.lucro,monthly.total.receita).toFixed(1)}%`,
        ],
      },
      {
        titulo:"Valores a pagar por proprietário e obra",
        descricao:"Demonstrativo interno calculado pelas tarifas de custo das locações de terceiros.",
        headers:["Proprietário","Obra",{label:"Equip.",num:true},{label:"Locações",num:true},{label:"Diárias-un.",num:true},{label:"Valor a receber",num:true}],
        rows:proprietariosPorObra.map(item=>[
          escapeHtml(item.proprietario),
          escapeHtml(item.obra.name),
          String(item.quantidadeEquipamentos),
          String(item.locacoes),
          String(item.unidadeDias),
          item.valor>0?escapeHtml(fmt(item.valor)):"TARIFA DE CUSTO AUSENTE",
        ]),
        totalRow:[
          "TOTAL","","","","",
          escapeHtml(fmt(proprietariosPorObra.reduce((sum,item)=>sum+item.valor,0))),
        ],
        vazio:"Nenhum equipamento de terceiros movimentado nesta competência.",
      },
    ],
  });
  abrirRelatorioPadrao(html,showToast);
}

function imprimirRelEquipObra(data,ym,mesLabel,matrix,obra,showToast){
  if(!obra)return;
  const total=matrix.totaisPorObra[obra.id]||{};
  const detalhes=matrix.linhas.flatMap(linha=>(linha.porObra[obra.id]?.detalhes||[]).map(detalhe=>({
    linha,detalhe,
  }))).sort((a,b)=>String(a.linha.equip.nome||"").localeCompare(String(b.linha.equip.nome||""))
    ||String(a.detalhe.inicio||"").localeCompare(String(b.detalhe.inicio||"")));
  const equipamentos=new Set(detalhes.map(item=>item.linha.equip.id)).size;
  const html=montarRelatorioPadraoHtml({
    data,
    titulo:"Relatório de cobrança de equipamentos",
    subtitulo:obra.name,
    meta:[
      {label:"Competência",value:`${mesLabel} (${ym})`},
      {label:"Obra",value:obra.name},
      obra.address||obra.endereco?{label:"Endereço",value:obra.address||obra.endereco}:null,
      obra.engineer?{label:"Responsável",value:obra.engineer}:null,
    ],
    kpis:[
      {label:"Cobrança líquida",value:fmt(total.receita)},
      {label:"Valor bruto",value:fmt(Number(total.receita||0)+Number(total.descontos||0))},
      {label:"Descontos",value:fmt(total.descontos)},
      {label:"Equipamentos",value:String(equipamentos)},
      {label:"Locações",value:String(detalhes.length)},
      {label:"Diárias-unidade",value:String(total.unidadeDias||0)},
    ],
    legenda:"Memória de cobrança calculada por contrato dentro da competência. Um mês tarifário corresponde a 30 dias; períodos de 31 dias incluem 1 diária adicional. Informações internas de propriedade, repasse e margem não integram este relatório da obra.",
    tabelas:[{
      titulo:"Memória detalhada das locações",
      headers:["Equipamento","Identidade física","Localização","Período","Situação",{label:"Qtd.",num:true},{label:"Dias contrato",num:true},{label:"Diárias-un.",num:true},"Composição",{label:"Bruto",num:true},{label:"Desconto",num:true},{label:"Cobrança",num:true}],
      rows:detalhes.map(({linha,detalhe})=>[
        escapeHtml(linha.equip.nome),
        escapeHtml(physicalIdentityForRecord(data,detalhe,linha.equip).label),
        escapeHtml(obra.name),
        `${escapeHtml(fmtDate(detalhe.inicio))} a ${escapeHtml(fmtDate(detalhe.fim))}`,
        escapeHtml(detalhe.status==="em_andamento"?"Em andamento":"Encerrada"),
        String(detalhe.quantidade),
        String(detalhe.dias),
        String(detalhe.unidadeDias),
        escapeHtml(detalhe.semTarifa?"Sem tarifa":textoComposicao(detalhe.composicao)),
        escapeHtml(fmt(detalhe.bruto)),
        escapeHtml(fmt(detalhe.descontos)),
        escapeHtml(fmt(detalhe.receita)),
      ]),
      totalRow:[
        "TOTAL","","","","","",
        String(total.dias||0),
        String(total.unidadeDias||0),
        "",
        escapeHtml(fmt(Number(total.receita||0)+Number(total.descontos||0))),
        escapeHtml(fmt(total.descontos)),
        escapeHtml(fmt(total.receita)),
      ],
      vazio:`Nenhuma locação faturada para ${obra.name} nesta competência.`,
    }],
    assinaturas:["Responsável pela locação","Responsável pela obra"],
  });
  abrirRelatorioPadrao(html,showToast);
}
