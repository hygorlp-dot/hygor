import {describe,it,expect} from 'vitest';
import {reviewContractWorkLink,applyWorkSuggestionsToDraft} from './work-links.js';

const user={id:'commercial-test',role:'comercial',active:true};
const work={id:'obra-a',version:3,clienteId:'cliente-a',name:'Obra de teste',areaM2:120,address:'Endereço de teste',engineerId:'eng-a',adminPercentage:12,contractValue:500000,contractStart:'2026-12-01',contractEnd:'2027-12-01'};
const contract={id:'contract-test',obraId:'obra-a',clienteId:'cliente-a',status:'rascunho',dados:{obra:{area_construida:100},comercial:{cgr:480000,teto:60000,taxa_administracao:10}},confirmacoes:{obra:true,comercial:true}};
const review=(c=contract,w=work,u=user)=>reviewContractWorkLink({contract:c,work:w,user:u});
const apply=(extra={})=>applyWorkSuggestionsToDraft({contract,work,user,selectedFields:['area_construida'],expectedWorkVersion:3,...extra});

describe('Cruzamento contratual com o cadastro da obra',()=>{
  it('mostra área divergente e conserva os valores de ambas as origens',()=>{
    expect(review().comparisons.find(row=>row.key==='area_construida')).toMatchObject({contractValue:100,workValue:120,status:'divergente'});
    expect(contract.dados.obra.area_construida).toBe(100);
  });
  it('não usa o valor cadastrado como CGR ou teto e não altera a obra',()=>{
    const before=JSON.stringify(work);
    const result=apply();
    expect(result.contract.dados.comercial).toEqual(contract.dados.comercial);
    expect(result.contract.obraReferencia.registeredContractValue).toBe(500000);
    expect(JSON.stringify(work)).toBe(before);
  });
  it('aproveita somente os campos selecionados e exige reconfirmação',()=>{
    const result=apply();
    expect(result.contract.dados.obra.area_construida).toBe(120);
    expect(result.contract.dados.obra.endereco).toBeUndefined();
    expect(result.contract.confirmacoes).toEqual({obra:false,comercial:false});
    expect(contract.confirmacoes.obra).toBe(true);
  });
  it('permite selecionar explicitamente a taxa sem recalcular teto ou CGR',()=>{
    const result=apply({selectedFields:['taxa_administracao']});
    expect(result.contract.dados.comercial).toEqual({cgr:480000,teto:60000,taxa_administracao:12});
  });
  it.each(['aprovado','aguardando_assinatura','assinado','cancelado','encerrado'])('preserva a versão em %s',status=>{
    expect(apply({contract:{...contract,status}}).ok).toBe(false);
  });
  it('recusa aproveitamento após atualização concorrente da obra',()=>{
    expect(apply({expectedWorkVersion:2}).ok).toBe(false);
  });
  it('recusa obra diferente mesmo quando o nome coincide',()=>{
    expect(review(contract,{...work,id:'obra-b'}).ok).toBe(false);
  });
  it('recusa cliente diferente mesmo quando a obra coincide',()=>{
    expect(review(contract,{...work,clienteId:'cliente-b'}).ok).toBe(false);
  });
  it('recusa usuário restrito a outra obra',()=>{
    expect(review(contract,work,{...user,obraId:'obra-b'}).ok).toBe(false);
  });
  it.each(['engenheiro','financeiro','visualizador'])('recusa o perfil %s no cruzamento comercial',role=>{
    expect(review(contract,work,{...user,role}).ok).toBe(false);
  });
  it('não transforma ausência de área em zero',()=>{
    expect(review(contract,{...work,areaM2:undefined}).comparisons.find(row=>row.key==='area_construida')).toMatchObject({workValue:null,status:'ausente_na_obra'});
  });
  it.each([-1,'inválido',Infinity])('não permite aproveitar área inválida: %s',areaM2=>{
    expect(apply({work:{...work,areaM2}}).ok).toBe(false);
  });
  it('distingue zero cadastrado de ausência de valor',()=>{
    expect(review(contract,{...work,adminPercentage:0}).comparisons.find(row=>row.key==='taxa_administracao').workValue).toBe(0);
  });
  it('não converte prazo previsto em início efetivo nem conclusão definitiva',()=>{
    const result=apply();
    expect(result.contract.dados.prazos).toBeUndefined();
    expect(result.contract.obraReferencia.plannedStart).toBe(work.contractStart);
  });
  it('recusa campos não mapeados e seleção vazia',()=>{
    expect(apply({selectedFields:['contractValue']}).ok).toBe(false);
    expect(apply({selectedFields:[]}).ok).toBe(false);
  });
});
