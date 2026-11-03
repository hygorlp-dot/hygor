import {data as original} from './schedule-indicators-data.mjs';
export const data=structuredClone(original);
const plan=data.planos.find(row=>row.obraId==='a');plan.tarefas[0].fim='2026-12-05';plan.diasSemana=[0,1,2,3,4,5,6];plan.feriados=[];
const budget=data.orcamentos.find(row=>row.id==='budget-a');budget.versionStatus='aprovado';budget.lockedAt='2026-10-01T12:00:00Z';
