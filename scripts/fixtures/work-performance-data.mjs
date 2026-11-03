import {data as original} from './daily-production-data.mjs';
export const data=structuredClone(original);
const base=data.rdos[0];
function log(id,date,quantity,progress){const row=structuredClone(base);row.id=id;row.data=date;row.servicos[0].quantidadeDia=quantity;row.servicos[0].progressoAte=progress;return row;}
data.rdos=[log('kpi-before','2026-10-23',160,10),log('kpi-one','2026-10-29',80,20),log('daily-report','2026-10-30',120,30)];
for(const person of data.employees.filter(person=>person.obra==='a'))for(const date of ['2026-10-23','2026-10-29'])data.attendance[person.id][date]={...data.attendance[person.id]['2026-10-30']};
data.weeklyCommitments=[
 {id:'kpi-plan-ontime',descricao:'Alvenaria entregue no prazo · fictícia',obraId:'a',activityId:'daily-task',data:'2026-10-30',quantidadePrometida:100,status:'concluido'},
 {id:'kpi-plan-late',descricao:'Complemento entregue após o prazo · fictício',obraId:'a',activityId:'daily-task',data:'2026-10-30',quantidadePrometida:20,status:'concluido'},
 {id:'kpi-plan-blocked',descricao:'Frente bloqueada desde o planejamento · fictícia',obraId:'a',activityId:'daily-task',data:'2026-10-31',quantidadePrometida:10,status:'bloqueado'},
 {id:'kpi-plan-pending',descricao:'Fechamento pendente · fictício',obraId:'a',activityId:'daily-task',data:'2026-10-23',quantidadePrometida:10,status:'concluido'},
 {id:'kpi-plan-current',descricao:'Compromisso da semana atual · fictício',obraId:'a',activityId:'daily-task',data:'2026-11-04',quantidadePrometida:100,status:'aberto'},
];
data.progressRecords=[
 {id:'kpi-evidence-ontime',obraId:'a',activityId:'daily-task',commitmentId:'kpi-plan-ontime',data:'2026-10-30',quantity:100,status:'confirmado'},
 {id:'kpi-evidence-late',obraId:'a',activityId:'daily-task',commitmentId:'kpi-plan-late',data:'2026-11-01',quantity:20,status:'confirmado'},
];
