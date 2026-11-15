// Obra e pessoas fictícias. Usado apenas pelos testes e servidor local de simulação.
import {portalFixture} from "./client-portal.fixture.js";
export function portalSimulationFixture(){
  const data=portalFixture(),work=data.obras[0];
  work.name="Casa Aurora · simulação completa";
  work.aditivosContrato=[{id:"aditivo-sim",numero:1,status:"aprovado",descricao:"Ampliação de escopo ilustrativa",valor:10000,prazoDias:5}];
  work.documentosOneDrive=[{id:"cronograma-sim",nome:"Cronograma ilustrativo.pdf",publicarCliente:true,url:"https://files.example.test/cronograma-simulacao.pdf"},{id:"interno",nome:"Documento interno reservado",publicarCliente:false,url:"https://files.example.test/interno.pdf"}];
  data.medicoesObra[0].avancoFisico=78;
  data.medicoes[0].percentualAcumulado=50;
  data.medicoes[0].recebimentos.push({id:"recebimento-futuro",data:"2026-11-18",valor:900});
  data.medicoes.push({id:"medicao-anterior",obraId:work.id,descricao:"Medição anterior ilustrativa",tipo:"percentual",status:"emitida",competencia:"2026-11",dataEmissao:"2026-11-04",dataVencimento:"2026-11-06",percentualAcumulado:40.9091,valorPrevisto:45000,recebimentos:[{id:"anterior-pago",data:"2026-11-06",valor:45000}]});
  data.employees=[{id:"equipe-sim-1",nome:"Pessoa fictícia A — dado privado",obra:work.id,dailyRate:100,vtDaily:10,startDate:"2026-11-12",active:true},{id:"equipe-sim-2",nome:"Pessoa fictícia B — dado privado",obra:work.id,dailyRate:200,vtDaily:20,startDate:"2026-11-12",active:true}];
  data.attendance=Object.fromEntries(data.employees.map(person=>[person.id,Object.fromEntries(["2026-11-12","2026-11-13","2026-11-18"].map(date=>[date,{status:"P",obraId:work.id}]))]));
  data.fornecedores.push({id:"f2",nome:"Fornecedor ilustrativo de esquadrias"});
  data.materiais.push({id:"janela-sim",descricao:"Janela ilustrativa",unidade:"UN"});
  data.pedidos.push({id:"pedido-sim-2",obraId:work.id,numero:"PC-SIM-002",status:"enviado",data:"2026-11-10",fornecedorId:"f2",itens:[{id:"item-sim-2",materialId:"janela-sim",orcNivel1Id:"alvenaria",qtd:2,precoUnit:1250,qtdRecebida:1}]});
  data.notasFiscais.push({id:"nf-sim-2",pedidoId:"pedido-sim-2",obraId:work.id,numero:"2002",status:"aprovada",categoria:"material",emissao:"2026-11-10",competencia:"2026-11",etapaId:"alvenaria",fornecedorId:"f2",valorBruto:2500,valorLiquido:2500,pagamentos:[{id:"pg-sim-2",data:"2026-11-11",valor:1800}],documentos:[{id:"doc-sim-2",nome:"Nota fiscal ilustrativa 2002.pdf",url:"https://files.example.test/nota-2002.pdf"}]});
  data.outrasDesp.push({id:"desp-sim-2",obraId:work.id,categoria:"outros",data:"2026-11-12",competencia:"2026-11",valor:600,status:"aprovada",etapaId:"alvenaria",descricao:"Despesa ilustrativa adicional"});
  data.caixaObra.push({id:"aporte-sim-2",obraId:work.id,data:"2026-11-10",tipo:"aporte",valor:2000},{id:"caixa-sim-2",obraId:work.id,data:"2026-11-11",tipo:"despesa",valor:1800,pedidoId:"pedido-sim-2",notaFiscalId:"nf-sim-2",pagamentoId:"pg-sim-2",desconsiderarDRE:true},{id:"aporte-futuro-sim",obraId:work.id,data:"2026-11-18",tipo:"aporte",valor:5000});
  data.rdos=Array.from({length:13},(_,index)=>({id:`diario-sim-${index+1}`,codigo:`SIM-${index+1}`,obraId:work.id,status:"concluido",data:`2026-11-${String(index+1).padStart(2,"0")}`,descricao:`Relato ilustrativo do dia ${index+1}: acompanhamento dos serviços da obra.`,clima:{manha:"sol",tarde:"nublado"},servicos:[{tarefaId:"alvenaria",descricao:"Alvenaria ilustrativa",unidade:"m²",quantidadeDia:10+index,progressoAte:30}],fotos:[{id:`imagem-sim-${index+1}`,url:"/brand/marcell/monogram-azul.svg",legenda:`Imagem demonstrativa do diário ${index+1}`,publicarCliente:true}]}));
  data.rdos.push({id:"diario-extra-sim",codigo:"SIM-13B",obraId:work.id,status:"concluido",data:"2026-11-13",descricao:"Segundo diário do mesmo dia — conferência ilustrativa.",servicos:[],fotos:[]},{id:"rascunho-sim",obraId:work.id,status:"rascunho",data:"2026-11-14",descricao:"Conteúdo privado não publicável",fotos:[]});
  data.obras.push({id:"outra-obra-sim",name:"Obra sem vínculo com este cliente"});
  data.rdos.push({id:"diario-outra-obra",obraId:"outra-obra-sim",status:"concluido",data:"2026-11-14",descricao:"Relato reservado de outra obra"});
  return data;
}
