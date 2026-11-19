import {expect,it} from 'vitest';
import {MAX_NIVEL} from './legacy-reference.js';
import {budgetHierarchyError} from './hierarchy.js';
import {buildBudgetTree,calculateBudgetTree,flattenBudgetTree,moveBudgetStage,budgetStageLevel} from './tree.js';
import {clonarEstruturaOrcamento,clonarCronogramaPlano} from './budget-clone.js';
import {detectarColunasImportacao,montarLinhasImportacao} from './budget-import-mapping.js';
import {applyBudgetImport,budgetImportHierarchyError} from './budget-import.js';
import {projectBudgetExport} from './calculations.js';
import {custoEtapa,ordemEtapasOrcamento} from '../planejamento/legacy-engine.js';
import {calculateMeasurementProgress,projectTechnicalMeasurementProgress} from '../medicoes/calculations.js';
import {buildFinancialLedger,selectDRE,selectCashFlow} from '../financeiro/ledger.js';
import {workStageCosts} from '../financeiro/work-stage-costs.js';
import {validateNoPhysicalDeletes,validateBudgetBaselinePolicy} from '../../../server/section-authorizations.js';
const budget=()=>({id:'b',obraId:'w',bdi:10,etapas:Array.from({length:6},(_,i)=>({id:'s'+i,nome:'Etapa '+(i+1),parentId:i?'s'+(i-1):''})),itens:[{id:'item',etapaId:'s5',descricao:'Serviço',unidade:'M2',quantidade:2,precoUnit:100}]});
const header=['Nível corrigido','Item','Fonte','Código','Descrição','Unidade','Quantidade','Custo unitário (sem BDI)'];
const rows=()=>[header,...Array.from({length:6},(_,i)=>[i?'Nível '+(i+1):'LOTE',Array(i+1).fill('1').join('.'),'','','Etapa '+(i+1),'','','']),['Serviço','1.1.1.1.1.1.1','SINAPI','10','Nome da planilha','M2',2,100]];
const parse=input=>{const {col,hIdx}=detectarColunasImportacao(input);return montarLinhasImportacao({rows:input,hIdx,col,orc:{fonte:'SINAPI'},basePorCodigo:new Map([['10',{descricao:'Nome da base',unidade:'M2',fonte:'SINAPI',precoUnit:100}]]),precoDoItem:i=>i.precoUnit,parseNumero:Number});};
let seq=0;const createId=()=>`new-${++seq}`;

it('usa seis níveis de etapas, item no sexto e numeração de item sem tratá-la como sétima etapa',()=>{
 const b=budget(),tree=calculateBudgetTree(b),flat=flattenBudgetTree(tree.arvore);
 expect(MAX_NIVEL).toBe(6);expect(budgetHierarchyError(b)).toBe('');
 expect(flat.filter(r=>r.tipo==='etapa').map(r=>r.nivel)).toEqual([1,2,3,4,5,6]);
 expect(flat.find(r=>r.id==='item').codigoItem).toBe('1.1.1.1.1.1.1');expect(tree.custoDireto).toBe(200);expect(tree.total).toBe(220);
 expect(flat.filter(r=>r.tipo==='item')).toHaveLength(1);expect(projectBudgetExport(b).totalCentavos).toBe(22000);
});
it('move e promove a subárvore completa sem mudar IDs, valores ou vínculos e recusa descendente no sétimo',()=>{
 const b=budget();expect(()=>moveBudgetStage([...b.etapas,{id:'extra'}],'s0','extra')).toThrow('6');
 const moved=moveBudgetStage(b.etapas,'s4','');expect(budgetStageLevel(moved,'s5')).toBe(2);
 expect(calculateBudgetTree({...b,etapas:moved}).total).toBe(220);expect(b.itens[0].etapaId).toBe('s5');
 expect(()=>moveBudgetStage(b.etapas,'s0','s5')).toThrow();
});
it.each([
 b=>b.etapas.push({id:'seven',parentId:'s5'}),b=>b.etapas[0].parentId='s5',b=>b.etapas[5].parentId='missing',
 b=>b.etapas.push({...b.etapas[0]}),b=>b.itens[0].etapaId='missing',b=>b.itens.push({...b.itens[0]}),
])('recusa origem inválida antes de copiar ou persistir (%#)',mutate=>{
 const b=budget();mutate(b);expect(budgetHierarchyError(b)).not.toBe('');expect(()=>clonarEstruturaOrcamento(b,createId)).toThrow();
 expect(validateNoPhysicalDeletes({},{orcamentos:[b]})).not.toBe('');
});
it('leitura de legado duplicado não entra em recursão infinita e metadado independente não regrava sua hierarquia',()=>{
 const b=budget();b.etapas.push({id:'s0',parentId:'s0'});expect(()=>buildBudgetTree(b.etapas,b.itens)).not.toThrow();
 expect(validateNoPhysicalDeletes({orcamentos:[b]},{orcamentos:[{...b,nome:'Conferir origem'}]})).toBe('');
 expect(budgetHierarchyError(undefined)).toBe('');expect(budgetHierarchyError(null)).toBe('');
});
it('legado inválido não pode ser aprovado nem adotado como nova baseline',()=>{
 const b=budget();b.etapas[5].parentId='missing';const approved={...b,versionStatus:'aprovado',lockedAt:'2026-11-14',approvedById:'admin'};
 expect(validateBudgetBaselinePolicy({orcamentos:[b]},{orcamentos:[approved]},{role:'admin'})).toContain('superior');
 expect(validateBudgetBaselinePolicy({orcamentos:[approved]},{orcamentos:[approved],budgetBaselines:[{obraId:'w',tipo:'controle',budgetId:'b'}]},{role:'admin'})).toContain('superior');
 const valid={...budget(),versionStatus:'aprovado',lockedAt:'2026-11-14',approvedById:'admin'};
 expect(validateBudgetBaselinePolicy({orcamentos:[budget()]},{orcamentos:[valid]},{role:'admin'})).toBe('');
});
it('copia seis níveis e cronograma com os mesmos IDs remapeados, preservando a origem',()=>{
 const b=budget(),source=structuredClone(b),copy=clonarEstruturaOrcamento(b,createId);
 expect(budgetHierarchyError(copy)).toBe('');expect(copy.itens[0].etapaId).toBe(copy.etapaIdMap.get('s5'));
 const plan=clonarCronogramaPlano({tarefas:[{id:'t',etapaId:'s5',inicio:'2026-11-01',fim:'2026-11-02'}]},copy.etapaIdMap,{hoje:'2026-11-14',gerarId:createId});
 expect(plan.tarefas[0].etapaId).toBe(copy.itens[0].etapaId);expect(plan.tarefas[0].inicio).toBe('2026-11-14');expect(b).toEqual(source);
});
it('importa a própria taxonomia exportada em seis níveis e reaproveita origem da base',()=>{
 const lines=parse(rows());expect(budgetImportHierarchyError(lines)).toBe('');
 const copy=applyBudgetImport({},lines,{createId});expect(copy.etapas).toHaveLength(6);expect(budgetStageLevel(copy.etapas,copy.itens[0].etapaId)).toBe(6);
 expect(copy.etapas.map(s=>s.nome)).toEqual(budget().etapas.map(s=>s.nome));expect(copy.itens[0]).toMatchObject({descricao:'Nome da base',unidade:'M2',quantidade:2,precoUnit:100});
 expect(calculateBudgetTree(copy).custoDireto).toBe(200);
});
it('mantém título numerado na etapa-pai após uma subetapa sem redirecionar serviços',()=>{
 const lines=[{kind:'etapa',nivel:1,ordem:'7',nome:'Cobertura'},{kind:'etapa',nivel:2,ordem:'7.3',nome:'Lajes'},
  {kind:'titulo',ordem:'7.4',descricao:'Nota de cobertura'},
  {kind:'item',ordem:'7.3.1',codigo:'10',quantidade:1,precoUnit:100}];
 const imported=applyBudgetImport({},lines,{createId});
 expect(imported.itens.map(item=>item.etapaId)).toEqual(imported.etapas.map(stage=>stage.id));
 expect(budgetImportHierarchyError(lines.map(row=>row.kind==='item'?{...row,ordem:'7.4'}:row))).toContain('etapa numerada anterior');
});
it('confere Tipo com a coluna numérica de nível, mesmo quando a numeração também coincide com essa coluna',()=>{
 const input=rows();input[0].push('Nível');input[6][8]=5;input[6][1]='1.1.1.1.2';input[7][1]='1.1.1.1.2.1';
 expect(budgetImportHierarchyError(parse(input))).toContain('Tipo e nível divergentes');
});
it.each([
 input=>input.splice(3,1),input=>input[6][0]='Nível 7',input=>input[6][1]='1.2.1.1.1.1',input=>input[7][1]='9.1',
 input=>input[2][1]='1',input=>input[6][1]='ilegível',
])('bloqueia salto, divergência e origem ambígua na prévia e na aplicação, sem promover para raiz (%#)',mutate=>{
 const input=rows();mutate(input);const lines=parse(input);expect(budgetImportHierarchyError(lines)).not.toBe('');
 const b=budget(),before=structuredClone(b);expect(()=>applyBudgetImport(b,lines,{createId})).toThrow();expect(b).toEqual(before);
});
it('preserva importação antiga de dois níveis sem numeração, unidade de item fora da base e pendências',()=>{
 const input=[['Código','Tipo','Descrição','Quantidade','Preço','Unidade'],['','Nível','Raiz','','',''],['','Subnível','Filha','','',''],['X','Produto','Sem base',2,50,'KG']];
 const lines=parse(input);expect(lines.at(-1).unidade).toBe('KG');expect(lines.at(-1).precoUnit).toBe(0);
 const copy=applyBudgetImport({},lines,{createId});expect(copy.itens[0].etapaId).toBe(copy.etapas[1].id);
 expect(applyBudgetImport({},lines,{createId,includePending:false}).itens).toEqual([]);
});
it('planejamento e medição técnica reutilizam o sexto nível sem novo custo ou pagamento no DRE',()=>{
 const b=budget(),data={obras:[{id:'w'}],orcamentos:[b],outrasDesp:[{id:'cost',obraId:'w',etapaId:'s5',data:'2026-11-01',valor:80}]};
 expect(custoEtapa(b,'s0')).toBe(200);expect(custoEtapa(b,'s5')).toBe(200);expect(ordemEtapasOrcamento(b)).toEqual(b.etapas.map(s=>s.id));
 const measurement={id:'m',obraId:'w',status:'aprovada',dataMedicao:'2026-11-14',itens:[{tarefaId:'t',etapaId:'s5',pctConfirmado:50,custo:200}]};
 expect(calculateMeasurementProgress(measurement.itens).physicalProgress).toBe(50);expect(projectTechnicalMeasurementProgress([measurement],'w')[0].progresso).toBe(50);
 const after={...data,medicoesObra:[measurement],orcamentos:[{...b,etapas:moveBudgetStage(b.etapas,'s4','')}]};
 expect(selectDRE(buildFinancialLedger(after))).toEqual(selectDRE(buildFinancialLedger(data)));expect(selectCashFlow(buildFinancialLedger(after))).toEqual(selectCashFlow(buildFinancialLedger(data)));
});
it('consolida o custo e o compromisso do item no sexto nível na raiz, uma única vez',()=>{
 const b=budget(),data={obras:[{id:'w'}],orcamentos:[b],budgetBaselines:[{obraId:'w',tipo:'controle',budgetId:'b',ativo:true}],
 pedidos:[{id:'p',obraId:'w',status:'enviado',itens:[{id:'pi',orcItemId:'item',qtd:1,precoUnit:50}]}],
 outrasDesp:[{id:'cost',obraId:'w',etapaId:'s5',data:'2026-11-01',valor:80}]};
 const result=workStageCosts(data,buildFinancialLedger(data),'w','2026-11-14');
 expect(result.rows.find(r=>r.id==='s0')).toMatchObject({budget:20000,incurred:8000,committed:5000});
 expect(result.totals.incurred).toBe(8000);expect(result.totals.budget).toBe(20000);expect(result.totals.committed).toBe(5000);
});
