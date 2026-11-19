import { cotacaoMultiItens, decisoesDaCotacao, mapaDaCotacao } from "../src/domains/compras/quote-map.js";
import { statusPedido } from "../src/domains/compras/calculations.js";
import { isApprovedTechnicalMeasurement } from "../src/domains/medicoes/constants.js";
import { aditivosAprovados, valorAditivosAprovados, valorContratoVigente } from "../src/domains/obras/contract-amendments.js";
import {documentEvidenceInfo} from "../src/domains/financeiro/document-evidence.js";
import {protectedDocumentReference} from "../src/domains/financeiro/document-links.js";
import {parseCompanyFileReference} from '../src/domains/arquivos/company-file-reference.js';
import {avancoFisicoOficial} from "../src/domains/dre/calculations.js";
import {active,toCents} from "../src/domains/financeiro/facts.js";
import {workCashInternalTransfer,workCashNature} from "../src/domains/financeiro/work-cash.js";
import {clientContractMeasurements,clientMeasurementReceipts} from "./client-portal-contract.js";
import {uniquePortalRecords} from './client-portal-records.js';

const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === "string" ? value.trim() : "";
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const cappedPercent = value => Math.max(0, Math.min(100, number(value)));
const sharedInvoice=item=>active(item)&&!item.rascunho;
const byNewest = (a, b) => String(b?.data || b?.date || "").localeCompare(String(a?.data || a?.date || ""));

const safeUrl=value=>{try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password?url.href:"";}catch{return "";}};
function invoiceDocuments(invoice,obra){
  return list(invoice.documentos).filter(doc=>doc?.publicarCliente!==false).map((doc,index)=>{
    const id=text(doc.id)||`anexo-${index}`;
    const info=documentEvidenceInfo(doc,obra.oneDriveDriveId);
    const reference=info.reference;
    const url=reference?`/api/client/projects/${encodeURIComponent(obra.id)}/files/${encodeURIComponent(invoice.id)}/${encodeURIComponent(id)}`:safeUrl(doc.clientUrl||doc.url||doc.webUrl);
    return {id,title:text(doc.nome||doc.name||doc.legenda)||`Nota fiscal ${invoice.numero||""}`,url,...(reference?{reference}: {})};
  });
}

function receivedAmount(measurement,asOf) {
  return clientMeasurementReceipts(measurement,asOf).reduce((sum,receipt)=>sum+toCents(receipt.valor),0)/100;
}

function measurementPayments(measurements,asOf) {
  return measurements.flatMap(measurement => {
    const receipts = clientMeasurementReceipts(measurement,asOf);
    if (receipts.length) {
      return receipts.map((receipt, index) => ({
        domain: "payment",
        payload: {
          id: text(receipt.id) || `recebimento-${measurement.id}-${index}`,
          description: text(measurement.descricao) || text(measurement.competencia) || "Recebimento de medição",
          amount: number(receipt.valor),
          dueDate: text(receipt.data) || text(measurement.dataPagamento) || text(measurement.dataVencimento),
          clientStatus: "Recebido",
        },
      }));
    }
    return [];
  });
}

// Usa a mesma regra oficial do DRE/painel: medição técnica confirmada,
// depois medição percentual de cobrança. Sem ambas, usa o cronograma,
// ponderado pelos custos previstos quando há referência.
export function clientPortalProgress({ data = {}, obraId = "", tasks = [],asOf } = {}) {
  data={...data,medicoes:clientContractMeasurements(data,obraId,asOf||'9999-12-31'),medicoesObra:list(data.medicoesObra).filter(item=>!asOf||!item.dataMedicao||item.dataMedicao<=asOf)};
  const official=avancoFisicoOficial(data,obraId);
  const technical=list(data.medicoesObra).some(item=>String(item.obraId)===obraId&&active(item)&&(!item.status||isApprovedTechnicalMeasurement(item)));
  if(official!==null)return {value:Math.round(cappedPercent(official)*100)/100,source:technical?"medicao_tecnica":"medicao_percentual"};
  if (!tasks.length) return { value: null, source: "sem_dados" };
  const totalCost = tasks.reduce((sum, item) => sum + Math.max(0, number(item?.custo)), 0);
  const value = totalCost > 0
    ? tasks.reduce((sum, item) => sum + Math.max(0, number(item?.custo)) * cappedPercent(item?.progresso), 0) / totalCost
    : tasks.reduce((sum, item) => sum + cappedPercent(item?.progresso), 0) / tasks.length;
  return { value: Math.round(value*100)/100, source: totalCost > 0 ? "cronograma_ponderado" : "cronograma" };
}

/**
 * Monta somente o contrato editorial do Portal do Cliente. Nenhum array
 * financeiro operacional, custo, colaborador, conciliação ou dado bancário
 * atravessa esta fronteira.
 */
export function buildClientPortalPublicationRows({ data = {}, projectId, publishedAt = new Date().toISOString() } = {}) {
  data={...data,...Object.fromEntries(['rdos','caixaObra','pedidos','notasFiscais'].map(key=>[key,uniquePortalRecords(list(data[key]).filter(item=>String(item.obraId)===String(projectId)))]))};
  const asOf=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bahia",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(publishedAt));
  const obraId = String(projectId || "");
  const obra = list(data.obras).find(item => String(item?.id) === obraId);
  if (!obra) throw new Error("Obra não encontrada para publicação.");

  const portal = obra.portalCliente || {};
  const plano = list(data.planos).find(item => String(item?.obraId) === obraId);
  const allTasks = list(plano?.tarefas).filter(item => !item?.titulo);
  const tasks = allTasks;
  const progressPosition = clientPortalProgress({ data, obraId, tasks: allTasks,asOf });
  const progress=progressPosition.value;
  const reports = list(data.rdos)
    .filter(item => String(item?.obraId) === obraId && active(item) && item.publicarCliente!==false && ["concluido", "concluído"].includes(text(item?.status).toLowerCase()))
    .sort(byNewest)
    ;
  const measurements = clientContractMeasurements(data,obraId,asOf)
    .sort((a, b) => String(a?.competencia || "").localeCompare(String(b?.competencia || "")))
    ;
  const measured = measurements.reduce((sum, item) => sum + toCents(item?.valorPrevisto), 0)/100;
  const paid = measurements.reduce((sum, item) => sum + toCents(receivedAmount(item,asOf)), 0)/100;
  const contractOriginal = number(obra.contractValue);
  const suppliers = new Map(list(data.fornecedores).map(item => [String(item?.id), text(item?.nome) || "Fornecedor"]));
  const materials = new Map(list(data.materiais).map(item => [String(item?.id), {
    description:text(item?.descricao) || "Material",
    unit:text(item?.unidade) || "UN",
  }]));

  const rows = [{
    domain: "project_summary",
    payload: {
      name: text(obra.name) || "Obra",
      coverImage: text(obra.capaUrl),
      currentPhase: text(list(data.fases).find(fase=>fase.id===obra.faseId)?.nome),
      progress,
      progressSource:progressPosition.source,
      estimatedCompletion: text(obra.contractEnd),
      lastUpdate: publishedAt,
      message:text(portal.mensagem),
    },
  }];
  rows.push({domain:"publication_policy",payload:{
    publicarAdministracaoEquipe:portal.publicarAdministracaoEquipe===true,
    publicarCustos:portal.publicarCustos===true,publicarOrcamentoEtapas:portal.publicarOrcamentoEtapas===true,
    publicarCaixaObra:portal.publicarCaixaObra===true,publicarNotasFiscais:portal.publicarNotasFiscais===true,
    publicarCompras:portal.publicarCompras===true,
    publicarDiarios:portal.publicarFotos!==false,publicarFinanceiro:portal.publicarFinanceiro===true,
    publicarCronograma:portal.publicarCronograma!==false,
  }});

  if (portal.publicarCronograma !== false) {
    for (const item of tasks) {
      rows.push({
        domain: "timeline",
        payload: {
          id: text(item.id),
          phase: text(item.nome) || text(item.descricao) || "Etapa",
          clientStatus: cappedPercent(item.progresso) >= 100 ? "Concluído" : "Em andamento",
          plannedStart: text(item.inicio),
          plannedEnd: text(item.fim),
          progress: cappedPercent(item.progresso),
          lastUpdate: publishedAt,
        },
      });
    }
  }

  for (const report of reports) {
    if(portal.publicarDiarios??portal.publicarFotos!==false)rows.push({domain:"daily_report",payload:{
      id:text(report.id),code:String(report.codigo||""),date:text(report.data),summary:text(report.descricao),
      weather:{morning:text(report.clima?.manha),afternoon:text(report.clima?.tarde),night:text(report.clima?.noite)},
      services:list(report.servicos).map(service=>({
        description:text(service.descricao)||text(allTasks.find(task=>task.id===service.tarefaId)?.nome)||"Serviço executado",
        quantity:service.quantidadeDia===""||service.quantidadeDia==null?null:number(service.quantidadeDia),
        unit:text(service.unidade),progress:cappedPercent(service.progressoAte),
      })),
    }});
    if(portal.publicarDiarios??portal.publicarFotos!==false)rows.push({
      domain: "weekly_update",
      payload: {
        id: text(report.id),
        period: text(report.data),
        summary: text(report.descricao) || `Diário ${text(report.codigo) || "da obra"} publicado`,
        progress,
        publishedAt,
        authorName: "Equipe ARCD",
      },
    });
  }

  if (portal.publicarFotos !== false) {
    const photos = reports.flatMap(report => list(report.fotos)
      .filter(photo => photo?.publicarCliente !== false && text(photo?.clientUrl || photo?.url))
      .map((photo, index) => {
        const id=text(photo.id) || `foto-${report.id}-${index}`;
        const reference=parseCompanyFileReference(photo.clientUrl||photo.url)||protectedDocumentReference(photo.clientUrl||photo.url);
        return ({
        domain: "media",
        payload: {
          id,
          reportId:text(report.id),
          type: "image",
          clientUrl: reference?`/api/client/projects/${encodeURIComponent(obraId)}/media/${encodeURIComponent(id)}`:text(photo.clientUrl || photo.url),
          clientThumbnailUrl: reference?"":text(photo.clientThumbnailUrl || photo.thumbnailUrl),
          ...(reference?{reference}:{}),
          caption: text(photo.legenda) || text(report.descricao) || "Registro da obra",
          date: text(report.data),
          phase: text(photo.etapa),
          environment: text(photo.ambiente),
          category: text(photo.categoria) || "obra",
          authorName: "Equipe ARCD",
        },
      });}));
    rows.push(...photos);
  }

  // Aditivos aprovados aparecem em "Alterações aprovadas" (Onda 4.2): só o
  // que o cliente vê no contrato - sem justificativa interna nem autor.
  if (portal.publicarFinanceiro) {
    rows.push(...aditivosAprovados(obra).map(item => ({
      domain: "change_order",
      payload: {
        id: `aditivo-${item.id}`,
        title: `Aditivo ${item.numero || ""}`.trim(),
        description: text(item.descricao),
        status: "Aprovado",
        financialImpact: number(item.valor),
        scheduleImpactDays: Math.trunc(number(item.prazoDias)),
        publishedAt,
      },
    })));
  }

  if (portal.publicarFinanceiro) {
    rows.push({
      domain: "financial_summary",
      payload: {
        id: `resumo-${obraId}`,
        contractOriginal,
        approvedChanges: valorAditivosAprovados(obra),
        contractCurrent: valorContratoVigente(obra),
        measured,
        approved: measured,
        paid,
        openAmount: measurements.reduce((sum,item)=>sum+Math.max(0,toCents(item.valorPrevisto)-toCents(receivedAmount(item,asOf))),0)/100,
        balanceToMeasure: Math.max(0, valorContratoVigente(obra) - measured),
        asOf,
      },
    });
    for (const item of measurements) {
      const received = receivedAmount(item,asOf);
      rows.push({
        domain: "measurement",
        payload: {
          id: text(item.id),
          number: text(item.numeroParcela) || text(item.descricao) || text(item.competencia) || "Medição",
          period: text(item.competencia),
          description: text(item.descricao),
          clientStatus: received >= number(item.valorPrevisto) && number(item.valorPrevisto) > 0 ? "Recebida" : received > 0 ? "Recebida parcialmente" : "Em aberto",
          percentage: item.tipo==='percentual'?cappedPercent(item.percentualAcumulado??item.percentualPeriodo):null,
          clientAmount: number(item.valorPrevisto),
          dueDate: text(item.dataVencimento),
          publishedAt,
        },
      });
    }
    rows.push(...measurementPayments(measurements,asOf));
  }

  if (portal.publicarCaixaObra) {
    const invoices=portal.publicarNotasFiscais?list(data.notasFiscais).filter(invoice=>String(invoice.obraId)===obraId&&sharedInvoice(invoice)):[];
    const invoicesById=new Map(invoices.map(invoice=>[String(invoice.id),invoice]));
    const invoicesByOrder=new Map();
    for(const invoice of invoices)if(invoice.pedidoId){const key=String(invoice.pedidoId);invoicesByOrder.set(key,[...(invoicesByOrder.get(key)||[]),invoice]);}
    const chronological=list(data.caixaObra)
      .filter(item=>String(item?.obraId)===obraId && active(item) && item.data && item.data<=asOf)
      .sort((a,b)=>String(a?.data || "").localeCompare(String(b?.data || "")));
    let balanceCents=0;
    const movements=chronological.map(item=>{
      const amount=toCents(item.valor)/100;
      const internalTransfer=workCashInternalTransfer(item);
      balanceCents+=item.tipo==="aporte" ? toCents(item.valor) : -toCents(item.valor);
      const candidates=item.notaFiscalId?[invoicesById.get(String(item.notaFiscalId))].filter(Boolean):item.pedidoId?invoicesByOrder.get(String(item.pedidoId))||[]:[];
      const invoice=candidates.length===1?candidates[0]:null;
      return {
        domain:"cash_movement",
        payload:{
          id:text(item.id),
          date:text(item.data),
          type:item.tipo==="aporte" ? "Aporte" : "Despesa",
          category:internalTransfer ? workCashNature(item) : text(item.categoria) || text(invoice?.categoria) || (item.tipo==="aporte" ? "Aporte" : "Outros"),
          // A descrição de uma despesa paga por pedido/nota traz o número do pedido e
          // o fornecedor; sem "publicarCompras" o cliente não deve ver isso.
          description:internalTransfer ? workCashNature(item) : (item.pedidoId || item.notaFiscalId) && !portal.publicarCompras
            ? "Pagamento de compra de material"
            : text(item.descricao) || (item.tipo==="aporte" ? "Aporte para a obra" : invoice?`Pagamento da nota fiscal ${text(invoice.numero)}`:"Despesa da obra"),
          amount,
          balance:balanceCents/100,
          invoiceNumber:text(invoice?.numero),
          invoiceDocuments:invoice?invoiceDocuments(invoice,obra):[],
          invoiceLinkAmbiguous:candidates.length>1,
        },
      };
    });
    const totalContributions=chronological.filter(item=>item.tipo==="aporte").reduce((sum,item)=>sum+toCents(item.valor),0)/100;
    const totalExpenses=chronological.filter(item=>item.tipo!=="aporte").reduce((sum,item)=>sum+toCents(item.valor),0)/100;
    rows.push({
      domain:"cash_summary",
      payload:{id:`caixa-${obraId}`,totalContributions,totalExpenses,balance:balanceCents/100,asOf},
    });
    rows.push(...movements.reverse());
  }

  if (portal.publicarNotasFiscais) {
    rows.push(...list(data.notasFiscais)
      .filter(item=>String(item?.obraId)===obraId && sharedInvoice(item))
      .sort((a,b)=>String(b?.emissao || "").localeCompare(String(a?.emissao || "")))

      .map(item=>({
        domain:"invoice",
        payload:{
          id:text(item.id),
          type:text(item.tipo).toUpperCase() || "NF",
          number:text(item.numero) || "Sem número",
          issuedAt:text(item.emissao),
          dueDate:text(item.vencimento),
          supplierName:text(item.fornecedorNome) || suppliers.get(String(item.fornecedorId)) || "Fornecedor",
          description:text(item.descricao),
          category:text(item.categoria) || "Compras e serviços",
          grossAmount:number(item.valorBruto),
          netAmount:number(item.valorLiquido??item.valorBruto),
          clientStatus:text(item.status) || "Recebida",
          orderId:text(item.pedidoId),
          documents:invoiceDocuments(item,obra),
        },
      })));
  }

  if (portal.publicarCompras) {
    rows.push(...list(data.pedidos)
      .filter(item=>String(item?.obraId)===obraId && active(item) && text(item?.status).toLowerCase()!=="rascunho")
      .sort((a,b)=>String(b?.data || "").localeCompare(String(a?.data || "")))

      .map(item=>{
        const items=list(item.itens).map(entry=>{
          const material=materials.get(String(entry?.materialId));
          return {
            description:text(entry?.descricaoRef) || material?.description || "Material",
            // Quantidade e preço do pedido estão na unidade de COMPRA (saco, barra);
            // mostrar a unidade de referência (kg, m) enganava o cliente.
            unit:text(entry?.unidadeCompra) || text(entry?.unidadeRef) || material?.unit || "UN",
            quantity:number(entry?.qtd),
            receivedQuantity:number(entry?.qtdRecebida),
            unitPrice:number(entry?.precoUnit),
          };
        });
        return {
          domain:"purchase_order",
          payload:{
            id:text(item.id),
            number:text(item.numero) || "Pedido",
            date:text(item.data),
            expectedAt:text(item.previsao),
            supplierName:suppliers.get(String(item.fornecedorId)) || "Fornecedor",
            // O status gravado fica "enviado" até o fim; o cliente precisa ver o
            // andamento real da entrega (parcial / recebido).
            clientStatus:statusPedido(item) || "enviado",
            total:items.reduce((sum,entry)=>sum+entry.quantity*entry.unitPrice,0),
            items,
          },
        };
      }));
  }

  if (portal.publicarCotacoes) {
    rows.push(...list(data.cotacoes)
      .filter(item=>String(item?.obraId)===obraId && active(item))
      .sort((a,b)=>String(b?.data || "").localeCompare(String(a?.data || "")))

      .map(item=>{
        const material=materials.get(String(item.materialId));
        // Mapa de cotação (C1.3): vários itens, preço por item; o cliente vê o
        // total de cada fornecedor e quem venceu algum item.
        if(cotacaoMultiItens(item)){
          const mapa=mapaDaCotacao(item);
          const vencedoras=new Set(Object.values(decisoesDaCotacao(item)).map(decision=>String(decision?.propostaId||"")));
          return {
            domain:"quotation",
            payload:{
              id:text(item.id),
              date:text(item.data),
              clientStatus:text(item.status) || "Aberta",
              material:`${mapa.linhas.length} itens · ${material?.description || "Material"}`,
              unit:"itens",
              quantity:mapa.linhas.length,
              proposals:list(item.propostas).map(proposal=>({
                supplierName:suppliers.get(String(proposal?.fornecedorId)) || "Fornecedor",
                unitPrice:0,
                total:number(mapa.totaisPorProposta[proposal?.id]),
                leadTimeDays:number(proposal?.prazoDias),
                selected:vencedoras.has(String(proposal?.id || "")),
              })),
            },
          };
        }
        return {
          domain:"quotation",
          payload:{
            id:text(item.id),
            date:text(item.data),
            clientStatus:text(item.status) || "Aberta",
            material:material?.description || "Material",
            unit:material?.unit || "UN",
            quantity:number(item.qtd),
            proposals:list(item.propostas).map(proposal=>({
              supplierName:suppliers.get(String(proposal?.fornecedorId)) || "Fornecedor",
              unitPrice:number(proposal?.precoUnit),
              total:number(proposal?.precoUnit)*number(item.qtd),
              leadTimeDays:number(proposal?.prazoDias),
              selected:String(item.escolhida || "")===String(proposal?.id || ""),
            })),
          },
        };
      }));
  }

  if (portal.publicarDocumentos !== false) {
    rows.push(...list(obra.documentosOneDrive)
      .filter(document => document?.publicarCliente === true && text(document?.clientUrl || document?.url))

      .map((document, index) => {
        const id=text(document.id)||`documento-${index}`;
        const reference=protectedDocumentReference(document.clientUrl||document.url);
        return ({
        domain: "document",
        payload: {
          id,
          title: text(document.nome) || "Documento",
          category: text(document.categoria) || "Documento da obra",
          version: text(document.versao),
          clientStatus: "Publicado",
          publishedAt,
          clientUrl: reference?`/api/client/projects/${encodeURIComponent(obraId)}/documents/${encodeURIComponent(id)}`:text(document.clientUrl || document.url),
          ...(reference?{reference}:{}),
        },
      });}));
  }

  return rows;
}
