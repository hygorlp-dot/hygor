import {data as original} from './financial-kpis-data.mjs';
export const data=structuredClone(original);
const plan=data.planos.find(row=>row.obraId==='a');
plan.tarefas[0].fim='2026-10-29';
const extra=[['prazo-concluido','Fundação concluída · fictícia','2026-10-22'],['prazo-sem-medicao','Instalações sem levantamento · fictícias','2026-10-28'],['prazo-hoje','Conferência da laje · fictícia','2026-11-02'],['prazo-proximo','Entrega de cobertura · fictícia','2026-11-05']];
for(const [id,nome,fim] of extra)plan.tarefas.push({id,nome,inicio:'2026-10-01',fim,progresso:100});
plan.baselineData='2026-10-01';
plan.baseline=plan.tarefas.map(task=>({tarefaId:task.id,nome:task.nome,inicio:task.inicio,fim:task.id==='prazo-proximo'?'2026-11-03':task.fim,custo:0}));
plan.marcos=[{id:'prazo-marco',nome:'Vistoria da estrutura · fictícia',data:'2026-11-06'}];
// A legacy reviewed diary provides task evidence, without allocating budget
// production or hours a second time. It is never sent to production.
data.rdos.push({id:'prazo-diario-fundacao',obraId:'a',data:'2026-10-24',status:'concluido',revisaoEngenheiro:{aprovado:true},servicos:[{tarefaId:'prazo-concluido',progressoAte:100}],clima:{manha:'bom',tarde:'bom'}});
