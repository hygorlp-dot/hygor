import { describe, expect, it } from "vitest";
import { canonicalDreEvents, buildIntegratedDreManagement, validateNativeDreCommand } from "./financial-dre-integration.js";
import { buildRequestedDreProjectionRows } from "./dre-projection.js";
import { applyReconciliationCommand, RECONCILIATION_COMMAND } from "./reconciliation-command.js";
import { authorizeReconciliationCommand } from "./reconciliation-policy.js";

const title={id:"native",direction:"receivable",status:"settled",original_amount:100,competence:"2026-10-01",obra_id:"work",metadata:{financialKind:"revenue"}};
const paid={id:"real-settlement",title_id:"native",status:"active",amount:40,settlement_date:"2026-10-02"};
describe("API nativa e DRE usam os mesmos fatos",()=>{
  it("valida centavos, natureza, direção e referências antes de acessar o banco",()=>{
    const payload={amount:100,direction:"payable",financialKind:"cost"};
    const validate=fields=>validateNativeDreCommand({type:"CREATE_FINANCIAL_TITLE",payload:{...payload,...fields}});
    expect(validate({})).toBe("");
    for(const fields of [{amount:0},{amount:1.001},{amount:Infinity},{direction:"receivable"},{financialKind:""},{legacyId:0},{legacyType:""}])expect(validate(fields)).not.toBe("");
    expect(validateNativeDreCommand({type:"REGISTER_SETTLEMENT",payload:{titleId:"malformed",amount:1}})).toMatch(/Identificador/);
    expect(validateNativeDreCommand({type:"REVERSE_SETTLEMENT",payload:{settlementId:"malformed"}})).toMatch(/Identificador/);
    expect(validateNativeDreCommand({type:"REGISTER_SETTLEMENT",payload:{titleId:"12345678-1234-1234-1234-123456789012",amount:1.25}})).toBe("");
    expect(validateNativeDreCommand({type:"REGISTER_SETTLEMENT",payload:{titleId:"12345678-1234-1234-1234-123456789012",amount:1.25,legacyId:"forged"}})).toMatch(/reservados/);
  });
  it("separa competência e caixa, sem reaproveitar projeções legadas",()=>{
    const native=canonicalDreEvents({titles:[title,{...title,id:"legacy",metadata:{legacyId:"old"}}],settlements:[paid]});
    expect(native.events).toHaveLength(4);
    expect(native.events.filter(event=>["revenue","cost","cash_in","cash_out"].includes(event.effect)).map(event=>[event.effect,event.amountCents])).toEqual([["revenue",10000],["cash_in",4000]]);
    const source={obras:[{id:"work",name:"Work",contractType:"fixed_labor"}],employees:[],attendance:{}};
    const [report]=buildRequestedDreProjectionRows(source,[{year:2026,month:9,scope:"work"}],native.events);
    expect(report.payload).toMatchObject({faturamento:100,entradasCaixa:40,contasReceber:60});
    expect(canonicalDreEvents({titles:[title],settlements:[{...paid,status:"reversed"}]}).revision).not.toBe(native.revision);
  });
  it("aporte/financiamento produz caixa e nunca receita; classificação desconhecida fica explícita",()=>{
    const funding=canonicalDreEvents({titles:[{...title,metadata:{financialKind:"funding"}}],settlements:[paid]});
    expect(funding.events.filter(event=>["revenue","cost","cash_in","cash_out"].includes(event.effect)).map(event=>event.effect)).toEqual(["cash_in"]);
    const unknown=canonicalDreEvents({titles:[{...title,metadata:{}}],settlements:[paid]});
    expect(unknown.issues[0].code).toBe("NATIVE_TITLE_WITHOUT_DRE_CLASSIFICATION");
    expect(unknown.events.filter(event=>["revenue","cost","cash_in","cash_out"].includes(event.effect)).map(event=>event.effect)).toEqual(["cash_in"]);
  });
  it("concilia saldo a pagar e detalhamento da despesa da obra",()=>{
    const native=canonicalDreEvents({titles:[{...title,direction:"payable",metadata:{financialKind:"cost"}}],settlements:[paid]});
    const [row]=buildRequestedDreProjectionRows({obras:[{id:"work"}]},[{year:2026,month:9,scope:"work"}],native.events);
    expect(row.payload).toMatchObject({totalCustos:100,outrasTotal:100,saidasCaixa:40,contasPagar:60});
  });
  it("leva receitas e despesas nativas corporativas ao DRE da empresa e ao consolidado",()=>{
    const native=canonicalDreEvents({titles:[{...title,obra_id:"",id:"company-revenue"},{...title,obra_id:"",id:"company-cost",direction:"payable",original_amount:25,metadata:{financialKind:"cost",dreCategory:"software"}}]});
    const rows=buildRequestedDreProjectionRows({obras:[]},[{year:2026,month:9,scope:"company_dre"},{year:2026,month:9,scope:"empresa"}],native.events);
    expect(rows[0].payload).toMatchObject({receitaCorporativa:100,faturamentoTotal:100,totalDespOp:25,lucroLiquido:75,contasPagar:25,contasReceber:100});
    expect(rows[0].payload.despEmp[0]).toMatchObject({native:true,pago:false,categoria:"software",valor:25});
    expect(rows[1].payload).toMatchObject({faturamento:100,totalCustos:25,lucroBruto:75});
  });
  it("mantém competência do título e caixa no mês efetivo da liquidação",()=>{
    const native=canonicalDreEvents({titles:[title],settlements:[{...paid,settlement_date:"2026-11-02"}]});
    const [row]=buildRequestedDreProjectionRows({obras:[{id:"work"}]},[{year:2026,month:10,scope:"work"}],native.events);
    expect(row.payload).toMatchObject({faturamento:0,entradasCaixa:40,contasReceber:60});
  });
  it("desconta vínculos nativos do saldo bancário do gestor",()=>{
    const report=buildIntegratedDreManagement({transacoes:[{id:"bank",valor:100,status:"pendente"}]},
      {events:[],issues:[],revision:"r",banks:[{id:"uuid",metadata:{legacyId:"bank"}}],links:[{bank_transaction_id:"uuid",amount:40,status:"active"}]});
    expect(report.banks[0]).toMatchObject({allocatedCents:4000,remainingCents:6000});
  });
  it.each(Object.values(RECONCILIATION_COMMAND))("mantém o aporte de 7160 pendente em %s",type=>{
    const data={transacoes:[{id:"mt7l9lt5xrta",valor:7160,status:"pendente"}]};
    expect(applyReconciliationCommand(data,{type,payload:{transactionId:"mt7l9lt5xrta"}}).resumo.ok).toBe(false);
  });
  it("reserva a associação parcial para financeiro/admin sem restrição de obra",()=>{
    const command={type:"LINK_PARTIAL_CASH"};
    expect(authorizeReconciliationCommand({},command,{role:"admin"}).ok).toBe(true);
    expect(authorizeReconciliationCommand({},command,{role:"rh"}).ok).toBe(false);
    expect(authorizeReconciliationCommand({},command,{role:"financeiro",obraId:"work"}).ok).toBe(false);
  });
});
