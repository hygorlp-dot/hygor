import {buildBudgetMaterialDemand} from '../suprimentos/calculations.js';
import {pedidoVivo} from '../compras/purchase-position.js';
import {conversionFactorOf,referenceQuantityOf} from '../compras/unit-conversion.js';
import {forecastStageRoot} from './forecast-duplication.js';
import {tarefasDaObra} from '../estoque/task-allocation.js';

const active=r=>r&&r.deletedAt==null&&r.ativo!==false&&!['cancelado','cancelada','estornado','estornada','rejeitado','rejeitada','arquivado','arquivada'].includes(String(r.status||'').toLowerCase());
const unit=v=>String(v||'').trim().toUpperCase().replace(/^UND$/,'UN');
const quantity=v=>Number.isFinite(Number(v))?Number(v):NaN;
const sign={entrada:1,devolucao:1,ajuste:1,consumo:-1,perda:-1};

// Somente fatos da obra: mudar saldo/reserva, composição, catálogo ou origem
// invalida uma revisão anterior, mesmo sem qualquer mudança no razão/DRE.
export function stockForecastBasis(data,obraId,budget){
 const demands=(budget?.etapas||[]).filter(s=>!s.parentId).flatMap(stage=>buildBudgetMaterialDemand({budget:{...budget,itens:(budget.itens||[]).filter(i=>forecastStageRoot(budget,i.etapaId)===stage.id)},materials:data.materiais||[]}).map(d=>[stage.id,d.materialId,d.codigo,unit(d.unidade),d.quantidade,d.custoTotal,d.vinculo,d.itemOrcamentoIds]));
 const materialIds=new Set([...demands.map(d=>d[1]),...(data.movEstoque||[]).filter(m=>m.obraId===obraId).map(m=>m.materialId)]);
 const scope=key=>(data[key]||[]).filter(r=>r.obraId===obraId);
 const refs=r=>[r.orcNivel1Id||'',r.etapaId||'',r.orcItemId||'',r.tarefaId||''];
 return {demands,movements:scope('movEstoque').map(m=>[m.id,m.materialId,m.tipo,quantity(m.qtd),active(m),...refs(m),m.pedidoId||'',m.pedidoItemId||'']),
  reservations:scope('reservasEstoque').map(r=>[r.id,r.materialId,quantity(r.quantidade??r.qtd),active(r),r.liberada===true,...refs(r)]),
  tasks:tarefasDaObra(data,obraId).map(t=>[t.id,t.etapaId||'']),
  materials:(data.materiais||[]).filter(m=>materialIds.has(m.id)).map(m=>[m.id,m.codigo||'',unit(m.unidade),active(m)]),
  orders:scope('pedidos').map(o=>[o.id,pedidoVivo(o),(o.itens||[]).map(i=>[i.id,i.materialId||'',quantity(i.qtd),quantity(i.qtdRecebida||0),conversionFactorOf(i),unit(i.unidadeRef),active(i),...refs(i)])])};
}

// Cobertura é quantidade, não um novo lançamento contábil. O preço orçado
// valoriza apenas a necessidade de reposição; não revaloriza o estoque/DRE.
export function stockForecast(data,obraId,budget){
 const root=id=>forecastStageRoot(budget,id),rows=[],issues=[];
 const movements=(data.movEstoque||[]).filter(m=>m.obraId===obraId&&active(m));
 const reservations=(data.reservasEstoque||[]).filter(r=>r.obraId===obraId&&active(r)&&r.liberada!==true);
 const orders=(data.pedidos||[]).filter(o=>o.obraId===obraId&&pedidoVivo(o));
 const tasks=tarefasDaObra(data,obraId);
 const materials=data.materiais||[];
 const stageOf=record=>root(record.orcNivel1Id||record.etapaId||budget?.itens?.find(i=>i.id===record.orcItemId)?.etapaId||tasks.find(t=>t.id===record.tarefaId)?.etapaId);
 for(const stage of (budget?.etapas||[]).filter(s=>!s.parentId)){
  const demands=buildBudgetMaterialDemand({budget:{...budget,itens:(budget.itens||[]).filter(i=>root(i.etapaId)===stage.id)},materials,tasks});
  for(const demand of demands)rows.push({...demand,id:`${stage.id}:${demand.materialId||demand.codigo||rows.length}`,stageId:stage.id,stage:stage.nome||stage.id,applied:0,physical:0,reserved:0,openOrders:0,issues:[],sources:[]});
 }
 const problem=(row,message)=>{if(!row.issues.includes(message))row.issues.push(message);};
 const materialRows=id=>rows.filter(r=>r.materialId===id);
 const target=(record,candidates)=>{
  const stage=stageOf(record);
  const explicit=[record.orcNivel1Id,record.etapaId,budget?.itens?.find(i=>i.id===record.orcItemId)?.etapaId,tasks.find(t=>t.id===record.tarefaId)?.etapaId].filter(Boolean).map(root);
  if(explicit.includes('unassigned')||record.orcItemId&&!budget?.itens?.some(i=>i.id===record.orcItemId)||record.tarefaId&&!tasks.some(t=>t.id===record.tarefaId)){
   candidates.forEach(row=>problem(row,'Etapa, item ou tarefa não existe na base atual; confira a origem.'));return null;
  }
  if(new Set(explicit).size>1){candidates.forEach(row=>problem(row,'Etapa, item ou tarefa divergem na origem; confira o vínculo.'));return null;}
  return stage!=='unassigned'?candidates.find(r=>r.stageId===stage):candidates.length===1?candidates[0]:null;
 };
 for(const row of rows){
  const material=materials.find(m=>m.id===row.materialId);
  if(row.vinculo!=='confirmado'||!material||!active(material))problem(row,'Vínculo do material pendente no orçamento.');
  if(!unit(row.unidade)||unit(row.unidade)!==unit(material?.unidade))problem(row,'Unidade do orçamento difere do cadastro do material.');
  for(const item of (budget?.itens||[]).filter(i=>row.itemOrcamentoIds.includes(i.id))){
   const inputs=buildBudgetMaterialDemand({budget:{...budget,itens:[item]},materials,tasks});
   if(inputs.some(input=>input.materialId===row.materialId&&unit(input.unidade)!==unit(row.unidade)))problem(row,'O mesmo material tem unidades diferentes na composição.');
  }
  if(!(row.quantidade>0)||!Number.isFinite(row.quantidade)||!(row.custoTotal>0)||!Number.isFinite(row.custoTotal))problem(row,'Quantidade ou preço de reposição indisponível no orçamento.');
 }
 for(const movement of movements){
  const candidates=materialRows(movement.materialId);if(!candidates.length)continue;
  const row=target(movement,candidates),q=quantity(movement.qtd);
  if(!row){candidates.forEach(r=>problem(r,'Movimento sem etapa inequívoca; confira a origem no Estoque.'));continue;}
  if(!Number.isFinite(q)||q<0||sign[movement.tipo]==null){problem(row,'Movimento com tipo ou quantidade inválida.');continue;}
  row.physical+=sign[movement.tipo]*q;
  if(movement.tipo==='consumo')row.applied+=q;
  if(movement.tipo==='devolucao')row.applied-=q;
  row.sources.push({type:'movimento',id:movement.id,pedidoId:movement.pedidoId||'',pedidoItemId:movement.pedidoItemId||'',quantity:q,tipo:movement.tipo});
  if(['entrada','ajuste'].includes(movement.tipo)){
   const order=orders.find(o=>o.id===movement.pedidoId),item=order?.itens?.find(i=>i.id===movement.pedidoItemId);
   if(!item||item.materialId!==row.materialId||stageOf(item)!==row.stageId||!(conversionFactorOf(item)>0)||unit(item.unidadeRef||materials.find(m=>m.id===row.materialId)?.unidade)!==unit(row.unidade))problem(row,'Entrada sem pedido e item compatíveis; confira a origem financeira antes de revisar.');
  }
 }
 for(const reservation of reservations){
  const candidates=materialRows(reservation.materialId);if(!candidates.length)continue;
  const row=target(reservation,candidates),q=quantity(reservation.quantidade??reservation.qtd);
  if(!row||!Number.isFinite(q)||q<0){candidates.forEach(r=>problem(r,'Reserva sem etapa ou quantidade válida; confira em Suprimentos.'));continue;}
  row.reserved+=q;
  row.sources.push({type:'reserva',id:reservation.id,quantity:q});
 }
 for(const order of orders)for(const item of order.itens||[]){
  const candidates=materialRows(item.materialId);if(!candidates.length||!active(item))continue;
  const row=target(item,candidates),q=quantity(item.qtd),received=quantity(item.qtdRecebida||0);
  if(!row){candidates.forEach(r=>problem(r,'Pedido sem etapa inequívoca; confira o vínculo com o orçamento.'));continue;}
  if(!(conversionFactorOf(item)>0)||unit(item.unidadeRef||materials.find(m=>m.id===row.materialId)?.unidade)!==unit(row.unidade)||!Number.isFinite(q)||!Number.isFinite(received)||q<0||received<0||received>q){problem(row,'Pedido com unidade, conversão ou recebimento inválido.');continue;}
  row.openOrders+=referenceQuantityOf(item,Math.max(0,q-received));
  const physicalReceived=movements.filter(m=>m.tipo==='entrada'&&m.pedidoId===order.id&&m.pedidoItemId===item.id).reduce((sum,m)=>sum+quantity(m.qtd),0);
  if(Math.abs(physicalReceived-referenceQuantityOf(item,received))>0.00001)problem(row,'Recebimento do pedido diverge das entradas físicas; confira Compras e Estoque.');
  row.sources.push({type:'pedido',id:order.id,itemId:item.id,quantity:referenceQuantityOf(item,Math.max(0,q-received))});
 }
 for(const row of rows){
  if(row.physical< -0.00001||row.applied< -0.00001||row.reserved>row.physical+0.00001||row.applied>row.quantidade+0.00001)problem(row,'Saldo, aplicação ou reserva exige conciliação no Estoque.');
  row.physical=Math.max(0,row.physical);row.applied=Math.max(0,row.applied);
  // Reserva da mesma etapa já está dentro do físico: não somar novamente.
  row.free=Math.max(0,row.physical-row.reserved);
  row.remainingQuantity=Math.max(0,row.quantidade-row.applied);
  row.covered=Math.min(row.remainingQuantity,row.physical);
  row.toBuy=Math.max(0,row.remainingQuantity-row.covered-row.openOrders);
  row.replacementCents=row.issues.length?null:Math.round(row.toBuy*row.custoTotal/row.quantidade*100);
  if(row.replacementCents!==null&&!Number.isSafeInteger(row.replacementCents)){problem(row,'Valor de reposição fora do limite seguro.');row.replacementCents=null;}
  issues.push(...row.issues.map(message=>({stageId:row.stageId,materialId:row.materialId,message:`${row.stage} · ${row.descricao}: ${message}`})));
 }
 return {rows,issues,byStage:new Map((budget?.etapas||[]).filter(s=>!s.parentId).map(s=>[s.id,rows.filter(r=>r.stageId===s.id).reduce((sum,r)=>sum+(r.replacementCents||0),0)]))};
}
