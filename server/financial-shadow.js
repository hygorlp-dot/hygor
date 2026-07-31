const inactiveStatuses = new Set([
  "cancelado", "cancelada", "cancelled", "canceled",
  "estornado", "estornada", "reversed",
  "arquivado", "arquivada", "deleted", "excluido", "excluida",
]);
const active = item => !inactiveStatuses.has(String(item?.status || "").toLowerCase());
const amount = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const isoDate = (value, fallback = "1970-01-01") => {
  const text = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-20`;
  return fallback;
};

const settlement = (legacyType, legacyId, value, date, transactionId = "") => ({
  legacyType, legacyId:String(legacyId), amount:amount(value), date:isoDate(date),
  bankTransactionLegacyId:String(transactionId || ""),
});

export const buildLegacyFinancialFacts = data => {
  const facts = [];
  const push = fact => {
    if (!fact.legacyId || !(fact.titleAmount > 0)) return;
    facts.push({
      obraId:"", contractId:"", partyId:"", dueDate:fact.date,
      recognizedAmount:0, settlements:[], metadata:{},
      ...fact,
      titleAmount:amount(fact.titleAmount),
      recognizedAmount:amount(fact.recognizedAmount),
      date:isoDate(fact.date),
      dueDate:isoDate(fact.dueDate || fact.date),
      settlements:(fact.settlements || []).filter(item => item.amount > 0),
    });
  };

  for (const item of (data?.medicoes || []).filter(active)) {
    const receipts = Array.isArray(item.recebimentos) && item.recebimentos.length
      ? item.recebimentos.filter(active).map(receipt => settlement("medicao_recebimento", receipt.id || `${item.id}:recebimento`, receipt.valor, receipt.data || item.dataPagamento, receipt.transacaoId))
      : (Number(item.valorRecebido || 0) > 0
        ? [settlement("medicao_recebimento", `${item.id}:legado`, item.valorRecebido, item.dataPagamento || item.dataVencimento, item.transacaoId)]
        : []);
    push({
      legacyType:"medicao", legacyId:String(item.id), category:"billed", direction:"receivable",
      obraId:String(item.obraId || ""), titleAmount:item.valorPrevisto,
      recognizedAmount:item.valorPrevisto, recognitionType:"revenue_recognized",
      date:item.dataEmissao || item.dataVencimento || item.competencia,
      dueDate:item.dataVencimento || item.competencia, settlements:receipts,
      metadata:{ descricao:item.descricao || "", competencia:item.competencia || "" },
    });
  }

  for (const item of (data?.payments || []).filter(active)) {
    push({
      legacyType:"recebimento_avulso", legacyId:String(item.id), category:"received", direction:"receivable",
      obraId:String(item.obraId || ""), titleAmount:item.amount, date:item.date,
      settlements:[settlement("recebimento_avulso", item.id, item.amount, item.date, item.transacaoId)],
      metadata:{ descricao:item.description || item.descricao || "" },
    });
  }

  for (const item of (data?.pagsTerceiros || []).filter(active)) {
    push({
      legacyType:"pagamento_terceiro", legacyId:String(item.id), category:"thirdParty", direction:"payable",
      // Quem desembolsou o dinheiro não muda a obra que recebeu o serviço.
      // Perder este vínculo deslocava um custo de obra para a empresa na carga
      // em sombra e impedia a conferência por obra antes de FIN-003.
      obraId:String(item.obraId || ""),
      titleAmount:item.amount || item.valor, recognizedAmount:item.amount || item.valor,
      recognitionType:"cost_recognized", date:item.date || item.data,
      settlements:[settlement("pagamento_terceiro", item.id, item.amount || item.valor, item.date || item.data, item.transacaoId)],
      metadata:{ pagador:item.pagador || "obra", terceirizadoId:item.tercId || "" },
    });
  }

  for (const item of (data?.outrasDesp || []).filter(active)) {
    push({
      legacyType:"despesa_obra", legacyId:String(item.id), category:"expenses", direction:"payable",
      obraId:String(item.obraId || ""), titleAmount:item.valor, recognizedAmount:item.valor,
      recognitionType:"cost_recognized", date:item.data || item.competencia,
      settlements:[settlement("despesa_obra", item.id, item.valor, item.data || item.competencia, item.transacaoId)],
      metadata:{ categoria:item.categoria || "", descricao:item.descricao || "" },
    });
  }

  for (const item of (data?.despesasEmpresa || []).filter(active)) {
    push({
      legacyType:"despesa_empresa", legacyId:String(item.id), category:"companyExpenses", direction:"payable",
      titleAmount:item.valor, recognizedAmount:item.valor, recognitionType:"cost_recognized",
      date:item.data || item.competencia,
      settlements:[settlement("despesa_empresa", item.id, item.valor, item.data || item.competencia, item.transacaoId)],
      metadata:{ categoria:item.categoria || "", descricao:item.descricao || "" },
    });
  }

  for (const item of (data?.pedidos || []).filter(active).filter(item => String(item.status || "").toLowerCase() !== "rascunho")) {
    const total = amount((item.itens || []).reduce((sum, row) =>
      sum + Number(row.quantidade || row.qtd || 0) * Number(row.precoUnit || row.preco || row.valorUnitario || 0), 0)
      || item.valorTotal || item.total);
    const payments = (item.pagamentos || []).filter(active).map(payment =>
      settlement("pagamento_pedido", payment.id || `${item.id}:${payment.data}`, payment.valor || payment.amount, payment.data, payment.transacaoId));
    push({
      legacyType:"pedido", legacyId:String(item.id), category:"purchases", direction:"payable",
      obraId:String(item.obraId || ""), titleAmount:total, recognizedAmount:total,
      recognitionType:"cost_recognized", date:item.data || item.criadoEm,
      dueDate:item.previsao || item.data, settlements:payments,
      metadata:{ numero:item.numero || "", fornecedorId:item.fornecedorId || "" },
    });
  }

  const bankTransactions = (data?.transacoes || []).filter(active).map(item => ({
    legacyId:String(item.id), amount:Math.abs(amount(item.valor)), direction:Number(item.valor) >= 0 ? "in" : "out",
    date:isoDate(item.data), description:item.descricao || "", obraId:String(item.obraId || ""),
    status:item.status === "ignorado" ? "ignored" : "pending",
    metadata:{ extratoId:item.extratoId || "", legacyStatus:item.status || "pendente" },
  })).filter(item => item.legacyId && item.amount > 0);

  return { facts, bankTransactions, dreSnapshots:buildDreProjectionRows(data) };
};

export const summarizeLegacyFinancialFacts = ({ facts = [] } = {}) => {
  const byScope = {};
  const ensure = obraId => byScope[obraId || "empresa"] ||= {
    billed:0, received:0, thirdParty:0, expenses:0, companyExpenses:0, purchases:0,
  };
  for (const fact of facts) {
    const row = ensure(fact.obraId);
    if (fact.category === "billed") row.billed += amount(fact.recognizedAmount);
    if (fact.category === "received" || fact.category === "billed") {
      row.received += amount((fact.settlements || []).reduce((sum, item) => sum + item.amount, 0));
    }
    if (["thirdParty", "expenses", "companyExpenses", "purchases"].includes(fact.category)) {
      row[fact.category] += amount(fact.recognizedAmount);
    }
  }
  Object.values(byScope).forEach(row => Object.keys(row).forEach(key => { row[key] = amount(row[key]); }));
  return byScope;
};

export const compareFinancialScopes = (legacy = {}, canonical = {}, tolerance = 0.01) => {
  const scopes = [...new Set([...Object.keys(legacy), ...Object.keys(canonical)])].sort();
  const metrics = ["billed", "received", "thirdParty", "expenses", "companyExpenses", "purchases"];
  const rows = [];
  for (const scope of scopes) {
    for (const metric of metrics) {
      const legacyAmount = amount(legacy[scope]?.[metric]);
      const canonicalAmount = amount(canonical[scope]?.[metric]);
      const difference = amount(canonicalAmount - legacyAmount);
      if (Math.abs(difference) > tolerance) rows.push({ scope, metric, legacyAmount, canonicalAmount, difference });
    }
  }
  return rows;
};

export const compareDreProjectionRows = (expectedRows = [], events = [], tolerance = 0.01) => {
  const canonical=new Map(events
    .filter(event=>event.event_type==="dre_snapshot"&&event.payload?.active!==false)
    .map(event=>[event.source_id,event.payload]));
  const divergences=[];
  const compare=(expected,actual,path,sourceId)=>{
    if(typeof expected==="number"){
      const difference=amount(Number(actual||0)-expected);
      if(Math.abs(difference)>tolerance)divergences.push({sourceId,path,expected:amount(expected),canonical:amount(actual),difference});
      return;
    }
    if(Array.isArray(expected)){
      if(!Array.isArray(actual)){
        divergences.push({sourceId,path,expected:"lista",canonical:actual??null});
        return;
      }
      if(expected.length!==actual.length){
        divergences.push({sourceId,path:`${path}.length`,expected:expected.length,canonical:actual.length});
        return;
      }
      expected.forEach((item,index)=>compare(item,actual[index],`${path}[${index}]`,sourceId));
      return;
    }
    if(expected&&typeof expected==="object"){
      for(const [key,value] of Object.entries(expected))compare(value,actual?.[key],path?`${path}.${key}`:key,sourceId);
      return;
    }
    if(expected!==actual)divergences.push({sourceId,path,expected,canonical:actual??null});
  };
  for(const row of expectedRows){
    const actual=canonical.get(row.sourceId);
    if(!actual){divergences.push({sourceId:row.sourceId,path:"",expected:"projeção",canonical:"ausente"});continue;}
    compare(row.payload,actual,"",row.sourceId);
  }
  return divergences;
};

export const summarizeCanonicalFinancialRows = ({ titles = [], settlements = [], events = [] } = {}) => {
  const result={};
  const ensure=scope=>result[scope||"empresa"]||={
    billed:0,received:0,thirdParty:0,expenses:0,companyExpenses:0,purchases:0,
  };
  const titleById=new Map(titles.map(title=>[title.id,title]));
  for(const event of events){
    if(!["revenue_recognized","cost_recognized"].includes(event.event_type))continue;
    if(event.payload?.active===false)continue;
    const row=ensure(event.payload?.obraId),category=event.payload?.category;
    if(category==="billed")row.billed+=Number(event.payload?.amount||0);
    else if(["thirdParty","expenses","companyExpenses","purchases"].includes(category))row[category]+=Number(event.payload?.amount||0);
  }
  for(const item of settlements.filter(row=>row.status==="active")){
    const title=titleById.get(item.title_id),category=title?.metadata?.category||item.metadata?.category;
    if(title?.direction==="receivable"&&["billed","received"].includes(category))ensure(title.obra_id).received+=Number(item.amount||0);
  }
  Object.values(result).forEach(row=>Object.keys(row).forEach(key=>{row[key]=amount(row[key]);}));
  return result;
};
import { buildDreProjectionRows } from "./dre-projection.js";
