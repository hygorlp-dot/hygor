import { describe, expect, it } from "vitest";
import { confirmedClassificationContext } from "./classification-context.js";

describe("classificação de vínculos já confirmados", () => {
  it("recupera a categoria da despesa original sem depender de candidatas pendentes", () => {
    const context=confirmedClassificationContext({despesasEmpresa:[{id:"expense",categoria:"software",descricao:"Licença do projeto"}]},{id:"bank",status:"conciliado",vinculo:{tipo:"despesasEmpresa",id:"expense"}});
    expect(context).toEqual({categories:["software"],works:[],text:"Licença do projeto"});
  });
  it("resolve vínculos parciais de folha pelo título e pelo pagamento avulso", () => {
    const data={titulosFolha:[{id:"title",employeeId:"emp",rateiosPorObra:[{obraId:"work"}]}],pagamentosFolha:[{id:"legacy-payment",employeeId:"emp"}],employees:[{id:"emp",name:"Ana Souza",obra:"work"}],reconciliationLinks:[
      {transactionId:"bank-title",status:"active",sourceType:"pagamento_folha",sourceId:"title"},
      {transactionId:"bank-legacy",status:"active",sourceType:"pagamento_folha",sourceId:"legacy-payment"},
    ]};
    for(const id of ["bank-title","bank-legacy"]){
      expect(confirmedClassificationContext(data,{id,status:"conciliado"})).toEqual({categories:["mao_obra"],works:["work"],text:"Ana Souza"});
    }
  });
  it("preserva obras de nota rateada e categoria do pagamento de terceiro parcial", () => {
    const data={notasFiscais:[{id:"invoice",categoria:"material",rateios:[{obraId:"work-a"},{obraId:"work-b"}]}],medicoesTerc:[{id:"measurement",obraId:"work-c"}],reconciliationLinks:[
      {transactionId:"bank",status:"active",sourceType:"pagamento_nota",sourceId:"invoice"},
      {transactionId:"bank",status:"active",sourceType:"pagamento_terceiro",sourceId:"measurement"},
      {transactionId:"bank",status:"reversed",sourceType:"despesa_empresa",sourceId:"old"},
    ]};
    expect(confirmedClassificationContext(data,{id:"bank",status:"parcial"})).toEqual({categories:["material","terceirizado"],works:["work-a","work-b","work-c"],text:""});
  });
});
