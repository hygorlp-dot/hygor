import {readWorkAdministrationProjection} from './dre-projection.js';
import {selectCashFlow} from '../src/domains/financeiro/ledger.js';
import {clientTeamMonth} from './client-portal-team.js';
import {toCents} from '../src/domains/financeiro/facts.js';
import {clientContractMeasurements,clientMeasurementReceipts} from './client-portal-contract.js';

const money=value=>toCents(value)/100;
export function buildClientStatement({data,portal,projectId,month:requestedMonth,asOf,canonicalEvents=[],permissions={}}){
 const month=clientTeamMonth(requestedMonth,asOf),[year,m]=month.split('-').map(Number);
 const cutoff=month===asOf.slice(0,7)?asOf:`${month}-${String(new Date(Date.UTC(year,m,0)).getUTCDate()).padStart(2,'0')}`;
 const projection=readWorkAdministrationProjection(data,projectId,year,m-1,canonicalEvents,cutoff);
 const start=`${month}-01`,work=data.obras.find(item=>String(item.id)===projectId);
 const cash=selectCashFlow(projection.dre.ledger,{obraId:projectId,startDate:start,endDate:cutoff});
 const paid=new Map();
 for(const event of [...cash.events.filter(event=>event.effect==='cash_out'),...cash.thirdPartyEvents])paid.set(event.category,(paid.get(event.category)||0)+event.amountCents);
 const costs=portal.costSummaries?.[0];
 const available=permissions.viewCosts===true&&costs?.available===true;
 const categories=available?Object.entries(projection.dre.costByCategory||{}).map(([category,recognized])=>({category,recognized:money(recognized),paid:(paid.get(category)||0)/100})):[];
 for(const [category,cents]of paid)if(available&&!categories.some(row=>row.category===category))categories.push({category,recognized:0,paid:cents/100});
 const team=portal.administrationTeam?.find(item=>item.month===month);
 const movements=(portal.projectCashMovements||[]).filter(row=>row.date>=start&&row.date<=cutoff);
 const balanceBefore=portal.projectCashMovements?.find(row=>row.date<start)?.balance;
 // Use o saldo original do primeiro movimento para respeitar também a ordem
 // de movimentos no mesmo dia; não somar custos reconhecidos ao caixa.
 const incoming=row=>String(row.type).toLowerCase()==='aporte';
 const chronological=[...movements].reverse();
 const first=chronological[0];
 const opening=first?money(first.balance+(incoming(first)?-first.amount:first.amount)):balanceBefore??(portal.projectCashMovements?.some(row=>row.date>cutoff)?0:portal.projectCashSummary?.[0]?.balance)??null;
 const entries=movements.filter(incoming).reduce((sum,row)=>sum+toCents(row.amount),0)/100;
 const exits=movements.filter(row=>!incoming(row)).reduce((sum,row)=>sum+toCents(row.amount),0)/100;
 const issued=new Map(clientContractMeasurements(data,projectId,cutoff).map(row=>[String(row.id),row]));
 const charges=(portal.measurements||[]).filter(row=>row.period===month&&issued.has(row.id)).map(row=>({id:row.id,description:row.description||row.number,amount:row.amount,dueDate:row.dueDate,balance:Math.max(0,toCents(row.amount)-clientMeasurementReceipts(issued.get(row.id),cutoff).reduce((sum,receipt)=>sum+toCents(receipt.valor),0))/100}));
 const invoices=(portal.invoices||[]).filter(row=>String(row.issuedAt||'').slice(0,7)===month||movements.some(move=>move.invoiceId===row.id));
 const recognized=available?money(categories.reduce((sum,row)=>sum+row.recognized,0)):null;
 const additional=team?.workforce.additionalReserve==null||team?.workforce.additionalCharges==null?null:money(team.workforce.additionalReserve+team.workforce.additionalCharges);
 return {version:1,projectId,projectName:portal.project.name,month,start,asOf:cutoff,partial:cutoff<`${month}-${String(new Date(Date.UTC(year,m,0)).getUTCDate()).padStart(2,'0')}`,available,categories,recognized,
  simulation:data.config?.clientStatementSimulation===true,paid:available?money(categories.reduce((sum,row)=>sum+row.paid,0)):null,
  administration:permissions.viewFinancial?team?.administration||null:null,
  workforce:team?.workforce||null,
  passThrough:recognized===null||additional===null?null:money(recognized+additional),
  cash:permissions.viewProjectCash&&portal.projectCashSummary?.length?{opening,entries,exits,closing:opening===null?null:money(opening+entries-exits),movements}:null,
  charges:permissions.viewFinancial?charges:[],invoices,
  options:{equipment:projection.incluiEquipamentos===true,fieldEngineering:projection.incluiEngenhariaCampo===true,fieldEngineeringCategory:work.adminFieldEngineeringCategoryId||'',fieldEngineeringCost:projection.fieldEngineeringCost||0},
  channels:{email:'financeiro@marcelleng.com.br',whatsapp:'5581989751300',automaticDelivery:false},
  limitations:[!available?'Custos não liberados ou em conferência.':'',additional===null?'Reservas complementares não disponíveis para concluir o repasse.':'',!work.adminFieldEngineeringCategoryId?'Engenharia de campo sem categoria identificada no contrato; a equipe precisa conferir a classificação.':'',!permissions.viewProjectCash?'Extrato do caixa não liberado para este acesso.':''].filter(Boolean)};
}
