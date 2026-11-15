import model from './administration-template.json' with {type:'json'};
export const user={id:'seller',nome:'Comercial de teste',role:'comercial',active:true};
export const admin={id:'admin',nome:'Administrador de teste',role:'admin',active:true};
const company={version:1,razaoSocial:'Empresa de teste',cnpj:'11.222.333/0001-81',endereco:'Endereço de teste',email:'teste@example.invalid',telefone:'000000000',representante:'Representante de teste',registroProfissional:'Registro de teste'};
export function recordFixture(){
  const dados={obra:{descricao:'Obra de teste',finalidade:'Uso próprio',endereco:'Endereço de teste',loteamento:'Loteamento de teste',lote:'1',quadra:'A',matricula:'Cadastro de teste',cartorio:'Cartório de teste',crea:'Registro de teste',art:'Referência de teste',area_construida:100},comercial:{},prazos:{}};
  for(const [key,value] of Object.entries(model.suggestions)){const [group,field]=key.split('.');if(dados[group])dados[group][field]=value;}
  dados.comercial.cgr=400000;
  return {titulo:'Contrato de teste',obraId:'w1',clienteId:'c1',responsavelId:user.id,partes:[{tipoPessoa:'PF',nome:'Pessoa de teste',documento:'529.982.247-25',endereco:'Endereço de teste',confirmado:true}],dados,confirmacoes:{obra:true,comercial:true,declaracoes:true,documentoExterno:true}};
}
export function fixture(){return {usuarios:[user,admin],obras:[{id:'w1',name:'Obra de teste',clienteId:'c1',version:2,areaM2:120,adminPercentage:10},{id:'w2',name:'Outra obra',clienteId:'c2'}],comercial:{clientes:[{id:'c1',nome:'Cliente de teste',leadId:'l1'},{id:'c2',nome:'Outro cliente',leadId:'l2'}],propostas:[]},commercialContractCompany:company,workFileCabinets:[{obraId:'w1',folders:[],documents:Array.from({length:7},(_,i)=>({id:`doc${i}`,name:`Documento de teste ${i}`,folderId:'',revisions:[{id:`rev${i}`,label:'v1',url:`https://example.invalid/test-${i}.pdf`,createdAt:'2026-11-01'}]}))}],commercialContractRecords:[]};}
export const files=()=>Array.from({length:6},(_,i)=>({documentId:`doc${i}`,revisionId:`rev${i}`,tipo:i===0?'para_assinatura':`anexo_${i}`,confirmado:true}));
