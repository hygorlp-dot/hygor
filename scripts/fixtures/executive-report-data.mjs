import {data as original} from './work-performance-data.mjs';
export const data=structuredClone(original);
const work=data.obras.find(row=>row.id==='a');work.contractStart='2026-10-01';work.startDate='2026-10-01';delete work.costPlanning;
data.notasFiscais[0].pagamentos=[{id:'ceo-invoice-payment',valor:6000,data:'2026-10-30'},{id:'ceo-client-payment',valor:1000,data:'2026-10-31',origem:'cliente_direto'}];
data.medicoes[0].recebimentos=[{id:'ceo-receipt',valor:10000,data:'2026-10-30'}];
data.pedidos=[{id:'ceo-order',obraId:'a',status:'enviado',data:'2026-10-01',itens:[{id:'ceo-order-item',orcNivel1Id:'forecast-stage',qtd:200,precoUnit:100,qtdRecebida:100}]}];
data.notasFiscais[0].pedidoId='ceo-order';
for(const person of data.employees.filter(item=>['daily-person-3','daily-person-4'].includes(item.id))){person.role='Ajudante';person.dailyRate=180;}
data.terceirizados=[{id:'ceo-electrician',obraId:'a',name:'Instalações elétricas · prestador fictício',specialty:'Eletricista',status:'ativo'}];
data.medicoesTerc=[{id:'ceo-third-measurement',tercId:'ceo-electrician',obraId:'a',etapaId:'forecast-stage',status:'aprovada',data:'2026-10-30',competencia:'2026-10',total:3000,descricao:'Instalações elétricas medidas · fictício',pagamentos:[{id:'ceo-third-payment',data:'2026-10-31',valor:1200}]}];
