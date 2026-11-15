import {expect,it} from 'vitest';
import {stockForecast} from './stock-forecast.js';
import {buildFinancialLedger,selectDRE} from './ledger.js';
import {workStageCosts} from './work-stage-costs.js';
import {costPlanningFingerprint} from './cost-control.js';
import {costAtCompletion} from './management-forecasts.js';
import {montarRecebimento} from '../compras/receipt.js';
import {projectDataForUser} from '../../../server/data-projection.js';
import {applyOperationalCommand} from '../sync/operational-commands.js';
import {SERVICE_LINK_COMMAND,serviceLinkSources} from './service-forecast.js';

const fixture=()=>({obras:[{id:'w',name:'Casa',startDate:'2026-01-01'}],budgetBaselines:[{obraId:'w',tipo:'controle',ativo:true,budgetId:'b'}],
 orcamentos:[{id:'b',obraId:'w',etapas:[{id:'s',nome:'Estrutura'}],itens:[{id:'i',etapaId:'s',descricao:'Concreto',quantidade:100,precoUnit:10,materialId:'m',unidade:'UN'}]}],
 materiais:[{id:'m',descricao:'Concreto',unidade:'UN',precoMedio:10}],pedidos:[{id:'o',obraId:'w',status:'parcial',data:'2026-10-01',itens:[{id:'l',materialId:'m',qtd:60,qtdRecebida:60,precoUnit:10,unidadeRef:'UN',orcItemId:'i',orcNivel1Id:'s'}]}],
 movEstoque:[{id:'r',obraId:'w',materialId:'m',tipo:'entrada',qtd:60,valorUnit:10,pedidoId:'o',pedidoItemId:'l',orcItemId:'i',orcNivel1Id:'s',data:'2026-10-02'}],reservasEstoque:[],notasFiscais:[]});
const coverage=d=>stockForecast(d,'w',d.orcamentos[0]);
const report=d=>workStageCosts(d,buildFinancialLedger(d),'w','2026-10-31');
const stage=d=>report(d).rows.find(r=>r.id==='s');
const invoice=d=>{d.notasFiscais=[{id:'n',obraId:'w',pedidoId:'o',status:'aprovada',emissao:'2026-10-03',valorBruto:600}];return d;};

it('entrada recebida sem nota cobre quantidade, preserva obrigação e não reconhece custo no DRE',()=>{
 const d=fixture(),before=structuredClone(d);expect(coverage(d).rows[0]).toMatchObject({quantidade:100,physical:60,openOrders:0,toBuy:40,replacementCents:40000,issues:[]});
 expect(stage(d)).toMatchObject({incurred:0,openCommitted:60000,materialFloor:100000,automaticRemaining:100000,forecast:100000});
 expect(selectDRE(buildFinancialLedger(d),{obraId:'w'}).events.filter(e=>e.effect==='cost')).toEqual([]);expect(d).toEqual(before);
});
it('nota reconhecida reduz compromisso; estoque faturado não desconta o custo duas vezes',()=>{
 const d=invoice(fixture());expect(stage(d)).toMatchObject({incurred:60000,openCommitted:0,materialReplacement:40000,automaticRemaining:40000,forecast:100000});
 expect(costAtCompletion(d,{workIds:['w'],asOf:'2026-10-31'})[0].forecast).toBe(100000);
});
it('consumo por tarefa, reserva e perda alteram cobertura sem criar outro custo ou pagamento',()=>{
 const d=invoice(fixture()),before=buildFinancialLedger(d);
 d.planos=[{obraId:'w',tarefas:[{id:'task',etapaId:'s',nome:'Aplicação'}]}];
 d.movEstoque.push({id:'c',obraId:'w',materialId:'m',tipo:'consumo',qtd:20,tarefaId:'task'});
 d.reservasEstoque=[{id:'reserve',obraId:'w',materialId:'m',quantidade:10,etapaId:'s'}];
 expect(coverage(d).rows[0]).toMatchObject({applied:20,physical:40,reserved:10,free:30,toBuy:40});
 d.movEstoque.push({id:'loss',obraId:'w',materialId:'m',tipo:'perda',qtd:5,etapaId:'s'});
 expect(coverage(d).rows[0]).toMatchObject({applied:20,physical:35,toBuy:45,replacementCents:45000});
 expect(stage(d)).toMatchObject({incurred:60000,forecast:105000});expect(buildFinancialLedger(d)).toEqual(before);
});
it('devolução de aplicação e estorno de consumo preservam quantidade total necessária',()=>{
 const d=fixture();d.movEstoque.push({id:'c',obraId:'w',materialId:'m',tipo:'consumo',qtd:20,etapaId:'s'},{id:'return',obraId:'w',materialId:'m',tipo:'devolucao',qtd:5,etapaId:'s'});
 expect(coverage(d).rows[0]).toMatchObject({applied:15,physical:45,toBuy:40});
 d.movEstoque[1].status='estornada';d.movEstoque[2].status='estornada';
 expect(coverage(d).rows[0]).toMatchObject({applied:0,physical:60,toBuy:40});
});
it('pedido a receber cobre necessidade uma vez e conversão usa unidade de referência da origem',()=>{
 const d=fixture();d.pedidos[0].itens[0]={...d.pedidos[0].itens[0],qtd:10,qtdRecebida:6,precoUnit:100,unidadeCompra:'CX',unidadeRef:'UN',fatorConversao:10};
 expect(coverage(d).rows[0]).toMatchObject({physical:60,openOrders:40,toBuy:0,issues:[]});
 expect(stage(d)).toMatchObject({openCommitted:100000,materialFloor:100000,forecast:100000});
 d.movEstoque[0].status='estornada';d.pedidos[0].itens[0].qtdRecebida=0;
 expect(coverage(d).rows[0]).toMatchObject({physical:0,openOrders:100,toBuy:0,issues:[]});
});
it('reutiliza movimentos gerados pelo recebimento real, sem digitar material, valor, unidade ou etapa',()=>{
 const d=fixture(),order=d.pedidos[0];order.itens[0].qtdRecebida=0;d.movEstoque=[];
 const receipt=montarRecebimento(order,{l:30},{quando:'2026-10-02',novoId:()=> 'receipt'});
 d.movEstoque=receipt.stockEntries;order.itens[0].qtdRecebida=30;
 expect(coverage(d).rows[0]).toMatchObject({physical:30,openOrders:30,toBuy:40,issues:[]});
 expect(d.movEstoque[0]).toMatchObject({pedidoId:'o',pedidoItemId:'l',orcItemId:'i',orcNivel1Id:'s'});
});
it('entrada manual sem origem financeira impede total gerencial até revisão explícita, sem custo fictício',()=>{
 const d=fixture();delete d.movEstoque[0].pedidoId;
 expect(coverage(d).issues[0].message).toContain('origem financeira');
 expect(costAtCompletion(d,{workIds:['w'],asOf:'2026-10-31'})[0].forecast).toBeNull();
 const r=stage(d);d.obras[0].costPlanning={stages:{s:{remainingCents:100000,contingencyCents:0,budgetId:'b',fingerprint:costPlanningFingerprint(d,'w'),asOf:'2026-10-31',basis:{incurred:r.incurred,committed:r.committed,budget:r.budget}}}};
 expect(costAtCompletion(d,{workIds:['w'],asOf:'2026-10-31'})[0].forecast).toBe(100000);
 expect(stage(d).incurred).toBe(0);
});
it('material compartilhado não usa a mesma quantidade em duas etapas; etapa inválida não recebe fallback',()=>{
 const d=fixture();d.orcamentos[0].etapas.push({id:'p',nome:'Pintura'});d.orcamentos[0].itens.push({...d.orcamentos[0].itens[0],id:'ip',etapaId:'p'});
 delete d.movEstoque[0].orcItemId;delete d.movEstoque[0].orcNivel1Id;
 const r=coverage(d);expect(r.rows.map(row=>row.physical)).toEqual([0,0]);expect(r.rows.every(row=>row.replacementCents===null)).toBe(true);
 d.movEstoque[0].orcNivel1Id='removed';expect(coverage(d).issues.length).toBeGreaterThan(0);
});
it.each(['unit','conversion','receipt','reserve','negative'])('divergência %s pede revisão sem inventar valor',type=>{
 const d=fixture();
 if(type==='unit')d.orcamentos[0].itens[0].unidade='KG';
 if(type==='conversion')Object.assign(d.pedidos[0].itens[0],{unidadeCompra:'CX',fatorConversao:0});
 if(type==='receipt')d.pedidos[0].itens[0].qtdRecebida=30;
 if(type==='reserve')d.reservasEstoque=[{obraId:'w',materialId:'m',quantidade:70,etapaId:'s'}];
 if(type==='negative')d.movEstoque.push({obraId:'w',materialId:'m',tipo:'perda',qtd:80,etapaId:'s'});
 expect(coverage(d).rows[0].replacementCents).toBeNull();expect(coverage(d).issues.length).toBeGreaterThan(0);
});
it('isola obra, rascunhos, cancelamentos e reservas liberadas',()=>{
 const d=fixture();d.movEstoque.push({id:'other',obraId:'other',materialId:'m',tipo:'entrada',qtd:999},{id:'cancel',obraId:'w',materialId:'m',tipo:'consumo',qtd:60,status:'cancelada'});
 d.reservasEstoque=[{obraId:'w',materialId:'m',quantidade:999,liberada:true}];
 d.pedidos.push({...d.pedidos[0],id:'draft',status:'rascunho'});
 expect(coverage(d).rows[0]).toMatchObject({physical:60,applied:0,reserved:0,openOrders:0,toBuy:40,issues:[]});
});
it('unidades misturadas na mesma composição não viram cobertura ou preço confirmado',()=>{
 const d=fixture();delete d.orcamentos[0].itens[0].materialId;
 d.orcamentos[0].itens[0].insumos=[{materialId:'m',coef:1,precoUnit:10,unidade:'UN'},{materialId:'m',coef:1,precoUnit:10,unidade:'KG'}];
 expect(coverage(d).rows[0]).toMatchObject({vinculo:'pendente',replacementCents:null});
});
it('conflito entre etapa explícita e item não é resolvido por precedência silenciosa',()=>{
 const d=fixture();d.orcamentos[0].etapas.push({id:'p',nome:'Pintura'});d.movEstoque[0].orcNivel1Id='p';
 expect(coverage(d).issues.some(issue=>issue.message.includes('divergem na origem'))).toBe(true);
 expect(coverage(d).rows[0].replacementCents).toBeNull();
});
it('referência removida não usa etapa única como fallback para movimento nem pedido',()=>{
 for(const field of ['orcNivel1Id','orcItemId','tarefaId']){
  const d=fixture();d.movEstoque[0][field]='removed';
  expect(coverage(d).rows[0].replacementCents).toBeNull();
 }
 const d=fixture();d.pedidos[0].itens[0].orcNivel1Id='removed';
 expect(coverage(d).rows[0].replacementCents).toBeNull();
});
it('estoque, reservas, tarefas e composição invalidam base manual mesmo sem alterar DRE',()=>{
 const d=fixture(),fingerprint=costPlanningFingerprint(d,'w'),ledger=buildFinancialLedger(d);
 d.reservasEstoque.push({obraId:'w',materialId:'m',quantidade:5,etapaId:'s'});
 expect(costPlanningFingerprint(d,'w')).not.toBe(fingerprint);expect(buildFinancialLedger(d)).toEqual(ledger);
 const next=costPlanningFingerprint(d,'w');d.orcamentos[0].itens[0].insumos=[{materialId:'m',coeficiente:2,unidade:'UN',precoUnit:10}];
 expect(costPlanningFingerprint(d,'w')).not.toBe(next);
});
it('financeiro restrito vê a mesma cobertura e identidade econômica do servidor, sem recadastrar fontes',()=>{
 const d=invoice(fixture());d.materiais[0].notaInterna='não relevante';
 const projected=projectDataForUser(d,{id:'f',role:'financeiro',obraId:'w'});
 expect(coverage(projected)).toEqual(coverage(d));
 expect(costPlanningFingerprint(projected,'w')).toBe(costPlanningFingerprint(d,'w'));
 const basis=costPlanningFingerprint(d,'w');d.materiais.push({id:'unrelated',unidade:'KG'});expect(costPlanningFingerprint(d,'w')).toBe(basis);
});
it('pedido de material declarado no contrato não reabre saldo já descontado pela medição',()=>{
 const d=fixture();d.terceirizados=[{id:'t',obraId:'w',name:'Fornecimento e aplicação',tipoContrato:'medicao',active:true,contractValue:1000,etapas:[{id:'e',valor:1000}]}];
 d.medicoesTerc=[{id:'m',tercId:'t',obraId:'w',status:'aprovada',data:'2026-10-01',total:500}];
 const result=applyOperationalCommand(d,{type:SERVICE_LINK_COMMAND,actorId:'f',actorRole:'financeiro',expectedVersion:0,idempotencyKey:'stock-contract-0001',payload:{obraId:'w',contractId:'t',budgetId:'b',stageId:'s',orderIds:['o'],confirmOverlap:true,sources:serviceLinkSources(d,'t',['o']),note:'Mesmo fornecimento contratado'}});
 expect(result.ok,result.reason).toBe(true);expect(stage(result.data)).toMatchObject({incurred:50000,serviceCommitted:50000,materialReplacement:40000,materialFloor:40000,automaticRemaining:50000,forecast:100000});
});
