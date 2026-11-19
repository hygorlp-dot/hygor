import {describe,it,expect} from 'vitest';
import {contractsForLead} from '../../domains/comercial/contracts/lead-contract-links.js';
import {pendingApprovalStages,requestsWithoutApprovalFlow} from '../../domains/aprovacoes/approval-inbox.js';
import {conferenceTasks} from './sector-tasks.js';

const admin={id:'admin',role:'admin',active:true};
describe('vínculos da continuidade comercial',()=>{
 const data={comercial:{propostas:[{id:'p1',leadId:'l1'},{id:'p2',leadId:'l2'}],contratos:[{id:'old',leadId:'l1',obraId:'a'}]},commercialContractRecords:[{id:'right',propostaId:'p1',obraId:'a'},{id:'similar',titulo:'Mesmo nome',clienteId:'same',propostaId:'p2',obraId:'a'},{id:'unlinked',titulo:'Mesmo nome',obraId:'a'}]};
 it('vincula apenas por proposta salva ou leadId anterior',()=>{expect(contractsForLead(data,'l1',admin)).toEqual({records:[data.commercialContractRecords[0]],legacy:[data.comercial.contratos[0]]});});
 it('não associa um lead novo nem liga por cliente, obra ou título',()=>{expect(contractsForLead(data,'',admin)).toEqual({records:[],legacy:[]});expect(contractsForLead(data,'missing',admin).records).toEqual([]);});
 it('respeita o perfil e a obra dos contratos atuais',()=>{expect(contractsForLead(data,'l1',{...admin,role:'comercial',obraId:'b'})).toEqual({records:[],legacy:[]});expect(contractsForLead(data,'l1',{id:'viewer',role:'visualizador'}).records).toEqual([]);});
 it('não altera os dados consultados',()=>{const before=JSON.stringify(data);contractsForLead(data,'l1',admin);expect(JSON.stringify(data)).toBe(before);});
});
describe('fila pessoal de decisões',()=>{
 const instance={id:'i',entidadeTipo:'solicitacaoCompra',entidadeId:'s',status:'em_andamento',contexto:{obraId:'a'},snapshotPolitica:{etapas:[{id:'past'},{id:'now'},{id:'later'}]},resultadosEtapas:[{status:'concluida',aprovadoresElegiveis:[admin]},{status:'em_andamento',aprovadoresElegiveis:[admin]},{status:'pendente',aprovadoresElegiveis:[admin]}]};
 it('somente oferece a etapa em andamento onde o usuário é elegível',()=>{expect(pendingApprovalStages({instanciasAprovacao:[instance]},admin)[0].etapas.map(e=>e.etapa.id)).toEqual(['now']);expect(pendingApprovalStages({instanciasAprovacao:[instance]},{id:'other'})).toEqual([]);});
 it('tolera resultados e snapshot ausentes sem erro de inicialização',()=>{expect(pendingApprovalStages({instanciasAprovacao:[{...instance,resultadosEtapas:undefined},{...instance,snapshotPolitica:{}}]},admin)).toEqual([]);});
 it('não oferece decisões de outra obra',()=>{expect(pendingApprovalStages({instanciasAprovacao:[instance]},{...admin,obraId:'b'})).toEqual([]);});
 it('diagnostica vínculo ausente ou apontando a outra entidade',()=>{const requests=[{id:'s',status:'enviada',aprovacaoInstanciaId:'wrong',obraId:'a'},{id:'x',status:'cancelada'}];expect(requestsWithoutApprovalFlow({solicitacoesCompra:requests,instanciasAprovacao:[{...instance,id:'wrong',entidadeId:'other'}]},admin)).toEqual([requests[0]]);});
 it('não trata decisões concluídas ou sem política como fluxo faltante',()=>{const s={id:'s',status:'em_analise',aprovacaoInstanciaId:'i',obraId:'a'};for(const status of ['aprovada','reprovada'])expect(requestsWithoutApprovalFlow({solicitacoesCompra:[s],instanciasAprovacao:[{...instance,status,snapshotPolitica:null}]},admin)).toEqual([]);});
 it('não revela solicitações sem acesso a Compras',()=>{expect(requestsWithoutApprovalFlow({solicitacoesCompra:[{id:'s',status:'enviada'}]},{id:'v',role:'visualizador'})).toEqual([]);});
 it('identifica o legado com elegíveis mas sem snapshot e ignora registros removidos',()=>{
  const request={id:'s',status:'pendente',obraId:'a',aprovacaoInstanciaId:'i'};
  const data={solicitacoesCompra:[request,{...request,id:'removed',deletedAt:'2026-11-01'}],instanciasAprovacao:[{...instance,snapshotPolitica:null}]};
  expect(pendingApprovalStages(data,admin)).toEqual([]);expect(requestsWithoutApprovalFlow(data,admin)).toEqual([request]);
 });
});
describe('tarefas vinculadas à conferência',()=>{
 const data={obras:[{id:'a',name:'Obra A'}],conferencias:[{id:'c',codigo:1,obraId:'a',responsavel:'Auditor',pendencias:[{id:'one',descricao:'Ajustar',responsavelAjusteId:'eng',prazo:'2026-11-01'},{id:'two',descricao:'Outra',responsavelAjusteId:'other',status:'resolvida',resolvidoEm:'2026-11-02'}]}]};
 it('mantém ids, responsável, prazo e conclusão sem criar tarefa persistida',()=>{const before=JSON.stringify(data),tasks=conferenceTasks(data,admin);expect(tasks[0]).toMatchObject({conferenceId:'c',findingId:'one',workId:'a',deadline:'2026-11-01',terminal:false});expect(tasks[1]).toMatchObject({findingId:'two',terminal:true,resolvedAt:'2026-11-02'});expect(JSON.stringify(data)).toBe(before);});
 it('restringe engenheiro às suas pendências e ao escopo da obra',()=>{expect(conferenceTasks(data,{id:'eng',role:'engenheiro'}).map(t=>t.findingId)).toEqual(['one']);expect(conferenceTasks(data,{id:'eng',role:'engenheiro',obraId:'b'})).toEqual([]);});
 it('não expõe tarefas sem a aba ou perfil autorizado',()=>{expect(conferenceTasks(data,{id:'v',role:'visualizador'})).toEqual([]);expect(conferenceTasks(data,{id:'eng',role:'engenheiro',accessTabs:['home']})).toEqual([]);});
 it('não expõe tarefas a um usuário inativo',()=>{expect(conferenceTasks(data,{...admin,active:false})).toEqual([]);});
 it('uma vistoria cancelada não oferece correção em aberto',()=>{const tasks=conferenceTasks({...data,conferencias:[{...data.conferencias[0],status:'cancelada'}]},admin);expect(tasks.every(t=>t.terminal&&t.status==='cancelada')).toBe(true);});
});
