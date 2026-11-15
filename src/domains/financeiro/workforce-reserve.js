import {laborChargesConfig} from './labor-charges.js';
const money=value=>Math.round((value+Number.EPSILON)*100)/100;
// Modelo gerencial da planilha fornecida pelo usuário. SST/EPI/ASO são compras
// reais da obra, nunca parcelas desta reserva. Não altera reconhecimento no DRE.
export function workforceReserveConfig(config={}){
 const charges=laborChargesConfig(config),raw=config.workforceReserve||{};
 return {enabled:raw.enabled===true,employerPercent:raw.employerPercent??charges.inssPatronalPercent+charges.ratPercent*charges.fap+charges.terceirosPercent,fgtsPercent:raw.fgtsPercent??charges.fgtsPercent,finePercent:raw.finePercent??charges.multaFgtsPercent,tenureMonths:raw.tenureMonths??12,dismissalPercent:raw.dismissalPercent??90,noticePercent:raw.noticePercent??50,noticeDays:raw.noticeDays??30};
}
export function calculateWorkforceReserve(remuneration,config={}){
 const c=workforceReserveConfig(config),errors=[];
 for(const key of ['employerPercent','fgtsPercent','finePercent','dismissalPercent','noticePercent'])if(c[key]===''||!Number.isFinite(Number(c[key]))||Number(c[key])<0||Number(c[key])>100)errors.push('Confira os percentuais da reserva para repasse.');
 if(!(Number(c.tenureMonths)>0)||!Number.isFinite(Number(c.tenureMonths)))errors.push('Informe a permanência média em meses.');
 if(c.noticeDays===''||!Number.isFinite(Number(c.noticeDays))||Number(c.noticeDays)<0)errors.push('Informe os dias previstos de aviso.');
 if(!Number.isFinite(remuneration)||remuneration<0)errors.push('Confira a remuneração apropriada à obra.');
 if(errors.length)return {errors:[...new Set(errors)]};
 const base=remuneration,fgts=Number(c.fgtsPercent)/100,employer=Number(c.employerPercent)/100;
 const thirteenth=base/12,vacation=base/12*4/3;
 const chargesOnReserve=(thirteenth+vacation)*(employer+fgts);
 const notice=base*Number(c.noticeDays)/30/Number(c.tenureMonths)*Number(c.noticePercent)/100;
 const noticeFgts=notice*fgts;
 const noticeAccrual=(thirteenth+vacation)/Number(c.tenureMonths)*Number(c.noticeDays)/30*Number(c.noticePercent)/100;
 const fine=(base*fgts+(thirteenth+vacation)*fgts+noticeFgts+noticeAccrual*fgts)*Number(c.finePercent)/100*Number(c.dismissalPercent)/100;
 const components={thirteenth,vacation,chargesOnReserve,notice,noticeFgts,noticeAccrual,fine};
 const monthly=money(Object.values(components).reduce((sum,value)=>sum+value,0));
 const rounded=Object.fromEntries(Object.entries(components).map(([key,value])=>[key,money(value)]));
 return {...rounded,ordinaryCharges:money(base*(employer+fgts)),monthly,rounding:money(monthly-Object.values(rounded).reduce((sum,value)=>sum+value,0)),errors:[]};
}
