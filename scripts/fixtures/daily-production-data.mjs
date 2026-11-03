import {data as original,profile} from './management-forecasts-data.mjs';
export {profile};
export const engineer={...profile,id:'daily-engineer',nome:'Engenheira da obra · demonstração',email:'engenharia@local.test',role:'engenheiro',obraId:'a',active:true};
export const data=structuredClone(original);
data.usuarios=[profile,engineer];
data.obras.find(work=>work.id==='a').engineerId=engineer.id;
data.employees=Array.from({length:4},(_,index)=>({id:`daily-person-${index+1}`,name:`Profissional fictício ${index+1}`,obra:'a',role:'Pedreiro',active:true,startDate:'2026-10-01',workdayHours:8,workStart:'07:00',remunerationMode:'daily',dailyRate:240,vtDaily:0,vrDaily:0,workArea:'campo'}));
data.attendance=Object.fromEntries(data.employees.map(person=>[person.id,{'2026-10-30':{status:'P',obraId:'a',entrada:'07:00',intervaloSaida:'12:00',intervaloRetorno:'13:00',saida:'16:00'},'2026-11-01':{status:'P',obraId:'a',entrada:'07:00',intervaloSaida:'12:00',intervaloRetorno:'13:00',saida:'16:00'}}]));
for(const person of data.employees)data.attendance[person.id]['2026-11-02']={...data.attendance[person.id]['2026-11-01']};
data.planos=[{id:'daily-plan',obraId:'a',budgetId:'budget-a',tarefas:[{id:'daily-task',nome:'Alvenaria · demonstração fictícia',etapaId:'forecast-stage',inicio:'2026-10-01',fim:'2026-11-27',progresso:25}],marcos:[]}];
data.rdos=[{id:'daily-report',codigo:1,version:1,productionVersion:1,obraId:'a',data:'2026-10-30',status:'concluido',descricao:'Produção medida pela engenharia na demonstração local.',clima:{manha:'bom',tarde:'bom',noite:'bom'},responsavelId:engineer.id,responsavel:engineer.nome,revisaoEngenheiro:{aprovado:true,engenheiroId:engineer.id,engenheiro:engineer.nome,revisadoEm:'2026-10-30T20:00:00Z'},servicos:[{tarefaId:'daily-task',etapaId:'forecast-stage',descricao:'Alvenaria · demonstração fictícia',budgetId:'budget-a',budgetItemId:'forecast-service',budgetQuantity:1200,unidade:'M²',quantidadeDia:100,progressoAte:25,equipe:data.employees.map(person=>person.id),tercIds:[],horasPorPessoa:{}}],presencas:[],efetivo:[],terceirizados:[],equipamentos:[],anexos:[],fotos:[]}];
// Normalize the synthetic unit exactly like the app's existing budget fixture.
data.rdos[0].servicos[0].unidade=data.orcamentos.find(budget=>budget.id==='budget-a').itens[0].unidade;

// Team present without a control budget: exercises recovery without manual fields.
data.employees.push({...data.employees[0],id:'daily-unmapped',name:'Profissional fictício sem levantamento',obra:'b'});
data.attendance['daily-unmapped']={'2026-11-01':{...data.attendance['daily-person-1']['2026-11-01'],obraId:'b'}};

export const splitData=structuredClone(data);
const splitBudget=splitData.orcamentos.find(budget=>budget.id==='budget-a');
splitBudget.itens.push({...splitBudget.itens[0],id:'daily-second-item',descricao:'Revestimento fictício'});
splitData.planos[0].tarefas.push({...splitData.planos[0].tarefas[0],id:'daily-second-task',nome:'Revestimento fictício'});
const splitLog=splitData.rdos[0];
splitLog.servicos[0].horasPorPessoa=Object.fromEntries(splitData.employees.filter(person=>person.obra==='a').map(person=>[person.id,4]));
splitLog.servicos.push({...structuredClone(splitLog.servicos[0]),tarefaId:'daily-second-task',budgetItemId:'daily-second-item',descricao:'Revestimento fictício',quantidadeDia:50,progressoAte:10});
export const legacyData=structuredClone(data);
delete legacyData.rdos[0].productionVersion;
legacyData.rdos[0].servicos=legacyData.rdos[0].servicos.map(({tarefaId,etapaId,descricao,progressoAte,equipe})=>({tarefaId,etapaId,descricao,progressoAte,equipe}));
