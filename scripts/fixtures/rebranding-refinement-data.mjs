import {data as appData,profile} from "./rebranding-app-data.mjs";
export {profile};

// Synthetic records for local visual review. No production data or credentials.
export const data=structuredClone(appData);
data.materiais=[{id:'cement',codigo:'MAT-1',descricao:'Cimento Portland CP II — saco de 50 kg',unidade:'SC',ativo:true,estoqueMin:10,precoMedio:38},{id:'steel',codigo:'MAT-2',descricao:'Aço CA-50 para armação de pilares e vigas',unidade:'KG',ativo:true,estoqueMin:50,precoMedio:12.5}];
data.movEstoque=[{id:'stock-a',tipo:'entrada',obraId:'a',materialId:'cement',qtd:25,valorUnit:38,data:'2026-10-28'},{id:'stock-b',tipo:'entrada',obraId:'a',materialId:'steel',qtd:120,valorUnit:12.5,data:'2026-10-28'}];
data.equipamentos=[{id:'eq-a',nome:'Betoneira profissional de 400 litros com motor elétrico',categoria:'Concreto',patrimonio:'EQ-001',ativo:true,status:'disponivel',quantidade:2,valorDiaria:80,custoDiaria:15},{id:'eq-b',nome:'Martelete perfurador e rompedor industrial',categoria:'Ferramentas',patrimonio:'EQ-002',ativo:true,status:'disponivel',quantidade:1,valorDiaria:50,custoDiaria:10}];
data.companyAssets=[{id:'asset-a',name:'Notebook para engenharia e planejamento de obras',assetTag:'PAT-000001',category:'Informática',active:true,status:'em_uso',acquisitionValue:6850,location:{type:'empresa',label:'Escritório de engenharia'},invoice:{number:'98765'},version:1},{id:'asset-b',name:'Impressora multifuncional de rede',assetTag:'PAT-000002',category:'Informática',active:true,status:'ativo',acquisitionValue:2450,location:{type:'empresa',label:'Sede administrativa'},invoice:{},version:1}];
