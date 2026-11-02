import {describe,expect,it} from "vitest";
import {measurementApprovalStatus,measurementBaseSignature,measurementProgressSummary,thirdPartyMeasurementFinancialPanels} from "./measurement-workspace.js";

const stages=[{id:"a",valor:20000},{id:"b",valor:10000}];
const base=()=>({obras:[{id:"o"}],terceirizados:[{id:"c",obraId:"o",retISS:5,retISSQuem:"fonte"}],
  medicoesTerc:[{id:"m",tercId:"c",obraId:"o",status:"aprovada",total:3000,data:"2026-10-20",itens:[]}],pagsTerceiros:[],notasFiscais:[]});

describe("resumo da medição",()=>{
  it("distingue anterior, avanço atual, acumulado e saldo em centavos",()=>{
    const result=measurementProgressSummary(stages,{a:"45",b:"0"},{a:30,b:0});
    expect(result).toMatchObject({previousCents:600000,incrementCents:300000,currentCents:900000,remainingCents:2100000,invalid:false});
    expect(result.rows[0]).toMatchObject({previous:30,current:45,remainingCents:1100000});
  });
  it("sinaliza redução e campo vazio e aceita decimal com vírgula",()=>{
    expect(measurementProgressSummary(stages,{a:"29",b:""},{a:30}).invalid).toBe(true);
    expect(measurementProgressSummary(stages,{a:"30,5",b:"0"},{a:30}).incrementCents).toBe(10000);
  });
  it("arredonda o incremento como o comando do servidor",()=>{
    const result=measurementProgressSummary([{id:"a",valor:123.45}],{a:"62.25"},{a:20});
    expect(result.incrementCents).toBe(Math.round(12345*42.25/100));
  });
  it("detecta alterações de contrato, base ou versão da correção",()=>{
    const contract={version:1,etapas:stages};
    const signature=measurementBaseSignature(contract,{a:20});
    expect(measurementBaseSignature(contract,{a:30})).not.toBe(signature);
    expect(measurementBaseSignature({...contract,version:2},{a:20})).not.toBe(signature);
    expect(measurementBaseSignature(contract,{a:20},{id:"m",version:2})).not.toBe(measurementBaseSignature(contract,{a:20},{id:"m",version:1}));
  });
});

describe("painel financeiro somente leitura",()=>{
  it("mantém medição pendente sem obrigação e sem confundir com rascunho local",()=>{
    const data=base();data.medicoesTerc[0].status="rascunho";
    expect(thirdPartyMeasurementFinancialPanels(data).get("m")).toMatchObject({approval:{label:"Aguardando aprovação"},financial:{label:"Não liberada"},recognizedCents:0});
  });
  it("usa baixas parciais do razão e preserva os valores históricos de retenção",()=>{
    const data=base();data.pagsTerceiros=[{id:"p",medicaoTercId:"m",obraId:"o",tercId:"c",amount:1000,liquido:950,issRetido:50,inssRetido:0,date:"2026-10-21",conciliado:false,status:"ativo"}];
    const panel=thirdPartyMeasurementFinancialPanels(data).get("m");
    expect(panel).toMatchObject({recognizedCents:300000,settledCents:100000,balanceCents:200000,financial:{label:"Baixa parcial"},reconciliation:"Pendente de conciliação"});
    expect(panel.payments[0]).toMatchObject({netCents:95000,issCents:5000});
    expect(panel.preview).toBeNull();
  });
  it("reconhece pagamento pela NF vinculada uma vez e não duplica custo ou baixa",()=>{
    const data=base();data.medicoesTerc[0].notaFiscalId="nf";
    data.notasFiscais=[{id:"nf",obraId:"o",medicaoTercId:"m",valorBruto:3000,emissao:"2026-10-20",status:"aprovada",pagamentos:[{id:"p",valor:3000,data:"2026-10-21",conciliado:true}]}];
    data.pagsTerceiros=[{id:"p",medicaoTercId:"m",amount:3000,date:"2026-10-21"}];
    expect(thirdPartyMeasurementFinancialPanels(data).get("m")).toMatchObject({recognizedCents:300000,settledCents:300000,balanceCents:0,financial:{label:"Baixada"},reconciliation:"Conciliada"});
  });
  it("não inventa documento de outra obra e preserva o efeito de arquivamento",()=>{
    const data=base();data.medicoesTerc[0]={...data.medicoesTerc[0],status:"arquivada",notaFiscalId:"nf"};
    data.notasFiscais=[{id:"nf",obraId:"outra",valorBruto:3000,status:"aprovada"}];
    expect(thirdPartyMeasurementFinancialPanels(data).get("m")).toMatchObject({recognizedCents:300000,missingInvoice:true,approval:{label:"Arquivada"}});
    expect(measurementApprovalStatus({status:"cancelada"}).label).toBe("Cancelada");
  });
  it("não altera os fatos ou registra novos eventos",()=>{
    const data=base();const before=JSON.stringify(data);
    thirdPartyMeasurementFinancialPanels(data);
    expect(JSON.stringify(data)).toBe(before);
  });
});
