import {data as original} from './executive-report-data.mjs';
export const data=structuredClone(original);
data.medicoes.push(
 {id:'kpi-overdue-receivable',obraId:'a',numero:'DEMO-VENCIDO',dataEmissao:'2026-10-15',competencia:'2026-10',dataVencimento:'2026-10-25',valorPrevisto:5000,descricao:'Medição fictícia com recebimento parcial',recebimentos:[{id:'kpi-partial-receipt',data:'2026-10-20',valor:2000}]},
 {id:'kpi-due-today',obraId:'a',numero:'DEMO-HOJE',dataEmissao:'2026-10-20',competencia:'2026-10',dataVencimento:'2026-11-02',valorPrevisto:1000,descricao:'Vence na referência fictícia',recebimentos:[]}
);
