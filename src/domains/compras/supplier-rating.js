// Avaliação de fornecedor (C2.3): nota de 0 a 10 dos últimos 12 meses.
//
// Fórmula (documentada em docs/compras-avaliacao-fornecedor.md):
//   pontualidade  = 10 × remessas no prazo ÷ remessas avaliadas (C2.2: cada
//                   remessa vencida ou já atendida; vencida e não entregue
//                   conta como atrasada)
//   notas fiscais = 10 × notas sem divergência ÷ notas do fornecedor (a
//                   divergência é a da conferência pedido × recebimento ×
//                   nota gravada na própria nota)
//   cancelamentos = 10 × pedidos não cancelados ÷ pedidos emitidos
//   nota final    = média ponderada 50% / 30% / 20%. Critério sem nenhum
//                   registro no período fica de fora e os pesos dos demais
//                   são redistribuídos; sem registro algum, não há nota.
import { entregasAvaliadas } from "./delivery-schedule.js";

export const PESOS_AVALIACAO=Object.freeze({pontualidade:0.5,notas:0.3,cancelamentos:0.2});
export const JANELA_AVALIACAO_DIAS=365;

const umDecimal=valor=>Math.round(valor*10)/10;
const inicioJanela=hoje=>new Date(Date.parse(`${hoje}T00:00:00Z`)-JANELA_AVALIACAO_DIAS*86400000).toISOString().slice(0,10);
const criterio=(positivos,total)=>total?{nota:umDecimal(10*positivos/total),positivos,total}:{nota:null,positivos:0,total:0};

// Mesma lista que o razão e o comando de nota tratam como inativa
// (financeiro/ledger.js, invoice-commands.js): nota rejeitada ou estornada não conta.
const STATUS_NOTA_INATIVA=["cancelada","cancelado","estornada","estornado","rejeitada","rejeitado"];

export const avaliacaoFornecedor=(data,fornecedorId,hoje)=>{
  const inicio=inicioJanela(hoje);
  const doFornecedor=item=>String(item?.fornecedorId||"")===String(fornecedorId);
  const pedidos=(data?.pedidos||[]).filter(pedido=>doFornecedor(pedido)&&pedido.status!=="rascunho"
    &&String(pedido.data||"").slice(0,10)>=inicio);

  const entregas=entregasAvaliadas(pedidos,hoje).filter(entrega=>entrega.data>=inicio);
  const notasFiscais=(data?.notasFiscais||[]).filter(nota=>doFornecedor(nota)
    &&!STATUS_NOTA_INATIVA.includes(String(nota.status||"").toLowerCase())
    &&String(nota.emissao||nota.data||"").slice(0,10)>=inicio);

  const criterios={
    pontualidade:criterio(entregas.filter(entrega=>entrega.noPrazo).length,entregas.length),
    notas:criterio(notasFiscais.filter(nota=>!(nota.divergencias||[]).length).length,notasFiscais.length),
    cancelamentos:criterio(pedidos.filter(pedido=>pedido.status!=="cancelado").length,pedidos.length),
  };
  const usados=Object.entries(criterios).filter(([,c])=>c.nota!==null);
  const pesoTotal=usados.reduce((sum,[chave])=>sum+PESOS_AVALIACAO[chave],0);
  const nota=pesoTotal?umDecimal(usados.reduce((sum,[chave,c])=>sum+c.nota*PESOS_AVALIACAO[chave],0)/pesoTotal):null;
  return {fornecedorId:String(fornecedorId),nota,criterios,
    base:criterios.pontualidade.total+criterios.notas.total+criterios.cancelamentos.total};
};

export const avaliacoesFornecedores=(data,hoje)=>new Map((data?.fornecedores||[])
  .map(fornecedor=>[String(fornecedor.id),avaliacaoFornecedor(data,fornecedor.id,hoje)]));

export const textoNotaFornecedor=avaliacao=>avaliacao?.nota==null
  ?"sem histórico"
  :avaliacao.nota.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1});

export const explicacaoNotaFornecedor=avaliacao=>{
  if(!avaliacao||avaliacao.nota==null)return "Sem pedidos, entregas ou notas nos últimos 12 meses.";
  const {pontualidade,notas,cancelamentos}=avaliacao.criterios;
  const parte=(rotulo,c,texto)=>c.total?`${rotulo} ${textoNotaFornecedor({nota:c.nota})} (${c.positivos}/${c.total} ${texto})`:`${rotulo}: sem registro`;
  return [parte("Prazo",pontualidade,"remessas no prazo"),parte("Notas",notas,"sem divergência"),
    parte("Cancelamentos",cancelamentos,"pedidos mantidos")].join(" · ");
};
