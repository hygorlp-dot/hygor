import {buildRequestedDreProjectionRows} from "./dre-projection.js";
import {validateClosedCompanyDreMutation} from "./closed-dre-mutation-guard.js";
import {createMonthlyClosingSnapshot} from "../src/domains/financeiro/workflows.js";
import {ATTENDANCE_COMMAND} from "./attendance-command.js";

export const CORE_KEY="arced_ponto_v1";
export const POINT_KEY=`${CORE_KEY}__ponto`;
export const EQUIPMENT_KEY=`${CORE_KEY}__equipamentos`;
export const TEST_NOW="2026-08-02T12:00:00.000Z";
export const TEST_ADMIN={id:"admin",nome:"Administrador",role:"admin"};

export const openCompanySource=()=>({
  obras:[{id:"o1",name:"Obra 1",status:"active",contractType:"fixed",contractValue:10000}],
  employees:[{id:"e1",name:"Equipe",obra:"o1",active:true,startDate:"2020-01-01",dailyRate:100}],
  config:{},attendance:{},attendanceLocks:{},unlockRequests:[],attendanceOperationReceipts:[],
  medicoes:[],payments:[],pedidos:[],notasFiscais:[],pagsTerceiros:[],medicoesTerc:[],
  despesasEmpresa:[],outrasDesp:[],transacoes:[],titulosFolha:[],pagamentosFolha:[],
  equipamentos:[{id:"eq1",nome:"Betoneira"}],locacoesEquip:[],
  manutencoesEquip:[{id:"maint1",equipamentoId:"eq1",obraId:"o1",data:"2026-07-10",custo:250,pagoPor:"empresa",status:"concluida"}],
  fechamentosFinanceiros:[],
});

export const withJulyClosing=data=>{
  const dre=buildRequestedDreProjectionRows(data,[{year:2026,month:6,period:"mes",scope:"company_dre"}])[0];
  const result=createMonthlyClosingSnapshot(data,{
    competencia:"2026-07",actor:TEST_ADMIN,closedAt:"2026-08-01T09:00:00.000Z",
    canonicalDreSnapshot:{sourceId:dre.sourceId,payload:dre.payload},
  });
  if(!result.ok)throw new Error(result.error);
  return {...data,fechamentosFinanceiros:[result.closing]};
};

export const staleCompanyLine=data=>({
  payload:data,
  rowVersions:{core:"2026-07-31T10:00:00.000Z",ponto:"2026-07-31T10:00:00.000Z",equipamentos:"2026-07-31T10:00:00.000Z"},
});

export const pointCommand=(overrides={})=>({
  action:ATTENDANCE_COMMAND.UPSERT,operationId:"10000000-0000-4000-8000-000000000001",
  employeeId:"e1",date:"2026-07-10",selectedObraId:"o1",record:{status:"P",obraId:"o1"},
  ...overrides,
});

// Mesmo before/after e guarda usados pelo callback operacional, com a
// mutação financeira reduzida a um cancelamento real de manutenção.
export const cancelMaintenance=({payload})=>{
  const after={...payload,manutencoesEquip:payload.manutencoesEquip.map(row=>({...row,status:"cancelada"}))};
  const validation=validateClosedCompanyDreMutation({before:payload,after});
  if(!validation.ok)return {kind:"error",status:409,code:"CLOSED_DRE_IMMUTABLE",closedDreChanges:validation.changes};
  return {kind:"save",data:after};
};
