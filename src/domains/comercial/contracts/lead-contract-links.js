import {mayReadContract} from './record-commands.js';

// Only saved proposal/lead identifiers establish this relationship. Names,
// shared clients and work names are not evidence of the same negotiation.
export function contractsForLead(data,leadId,user){
 if(!leadId||!mayReadContract({obraId:user?.obraId},user))return {records:[],legacy:[]};
 const proposals=new Set((data.comercial?.propostas||[]).filter(p=>p.leadId===leadId).map(p=>p.id));
 return {
  records:(data.commercialContractRecords||[]).filter(row=>mayReadContract(row,user)&&!!row.propostaId&&proposals.has(row.propostaId)),
  legacy:(data.comercial?.contratos||[]).filter(row=>row.leadId===leadId&&(!user?.obraId||row.obraId===user.obraId)),
 };
}
