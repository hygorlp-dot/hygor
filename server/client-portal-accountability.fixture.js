// Simulação independente: nenhuma importação de credenciais ou dados reais.
import {portalSimulationFixture} from './client-portal-simulation.fixture.js';
export function portalAccountabilityFixture(){
 const data=portalSimulationFixture(),work=data.obras[0];
 Object.assign(work,{name:'Casa Aurora · prestação de contas simulada',contractType:'admin_only',adminPercentage:12,adminBaseEquipamentos:false,adminBaseEngenhariaCampo:false,adminFieldEngineeringCategoryId:'engenharia_campo'});
 work.portalCliente.publicarAdministracaoEquipe=true;
 data.config.workforceReserve={enabled:true};
 data.config.clientStatementSimulation=true;
 data.categoriasDesp=[{v:'engenharia_campo',l:'Engenharia de campo'},{v:'material',l:'Materiais'},{v:'equipamento',l:'Equipamentos / Locação'},{v:'outros',l:'Outros'}];
 data.employees.forEach((person,index)=>Object.assign(person,{name:`Profissional fictício ${index+1}`,role:index?'Pedreiro':'Servente',remunerationMode:'daily'}));
 data.medicoesTerc=[{id:'terc-med-sim',obraId:work.id,tercId:'terc-sim',data:'2026-11-12',competencia:'2026-11',status:'aprovada',total:3000,descricao:'Serviço de instalações · simulação'}];
 data.notasFiscais.push(...[['epi-sim','material',180,'3001'],['rental-sim','equipamento',800,'3002']].map(([id,categoria,valor,numero])=>({id,obraId:work.id,categoria,numero,fornecedorId:'f1',emissao:'2026-11-12',competencia:'2026-11',valorBruto:valor,valorLiquido:valor,status:'aprovada',pagamentos:[{id:`pg-${id}`,data:'2026-11-12',valor}],documentos:[{id:`doc-${id}`,nome:`Nota fictícia ${numero}.pdf`,url:`/api/client/__simulation/invoice/${id}`}]})));
 data.outrasDesp.push({id:'engineering-sim',obraId:work.id,categoria:'engenharia_campo',descricao:'Engenharia de campo · simulação',data:'2026-11-13',competencia:'2026-11',valor:1200,pago:false});
 data.caixaObra.push({id:'cash-epi-sim',obraId:work.id,data:'2026-11-12',tipo:'despesa',categoria:'material',descricao:'EPI comprado · simulação',valor:180,notaFiscalId:'epi-sim',pagamentoId:'pg-epi-sim'},
 {id:'cash-rental-sim',obraId:work.id,data:'2026-11-12',tipo:'despesa',categoria:'equipamento',descricao:'Locação de betoneira · simulação',valor:800,notaFiscalId:'rental-sim',pagamentoId:'pg-rental-sim'});
 for(const note of data.notasFiscais)note.documentos=[{id:`doc-${note.id}`,driveId:'simulation-only',nome:`Nota fictícia ${note.numero}.pdf`}];
 data.medicoes.push({id:'admin-charge-sim',obraId:work.id,competencia:'2026-11',descricao:'Administração emitida · simulação',tipo:'valor',status:'emitida',dataEmissao:'2026-11-13',dataVencimento:'2026-11-20',valorPrevisto:500,valorAdminPct:500,recebimentos:[]});
 return data;
}
