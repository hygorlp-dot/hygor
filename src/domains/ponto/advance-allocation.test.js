import {describe,expect,it} from "vitest";
import {allocateAdvancesByWork} from "./advance-allocation";
import {allocateUnionDueByWork,calculatePayrollSettlement} from "./union-dues";

const work=(bruto,diasTrabalhados,vt=0,vr=0)=>({bruto,diasTrabalhados,vt,vr});

describe("rateio de adiantamentos por obra",()=>{
  it("redistribui a parcela limitada e fecha os R$ 990 do caso de regressão",()=>{
    const input=[work(1000,10),work(10,1)];
    const rows=allocateAdvancesByWork(input,990);
    expect(rows.map(row=>row.advancesObra)).toEqual([980,10]);
    expect(rows.map(row=>row.netObra)).toEqual([20,0]);
    expect(input).toEqual([work(1000,10),work(10,1)]);
  });
  it("preserva a proporção por dias quando nenhuma obra atinge o limite",()=>{
    expect(allocateAdvancesByWork([work(1000,10),work(200,2)],120).map(row=>row.advancesObra)).toEqual([100,20]);
  });
  it.each([
    [[work(10,10),work(1000,1)],990],
    [[work(100,3),work(200,2),work(10,1)],400],
    [[work(10,0),work(100,0)],50],
    [[work(0,3),work(100,0,10,20)],120],
    [[work(100.01,1),work(200.02,1),work(300.03,1)],100.01],
    [[work(100,1)],0],
    [[],100],
  ])("conserva totais e limites para %j com adiantamento %s",(input,advance)=>{
    const gross=input.reduce((sum,row)=>sum+row.bruto,0);
    const benefits=input.reduce((sum,row)=>sum+row.vt+row.vr,0);
    const settlement=calculatePayrollSettlement({gross,benefits,advances:advance,unionDue:35});
    const rows=allocateAdvancesByWork(input,advance);
    expect(rows.reduce((sum,row)=>sum+row.advancesObra,0)).toBeCloseTo(Math.min(advance,gross+benefits),8);
    expect(rows.reduce((sum,row)=>sum+row.netObra,0)).toBeCloseTo(settlement.netBeforeUnion,8);
    for(const row of rows){
      expect(row.netObra).toBeGreaterThanOrEqual(0);
      expect(row.advancesObra).toBeGreaterThanOrEqual(0);
      expect(row.netObra+row.advancesObra).toBeCloseTo(row.bruto+row.vt+row.vr,8);
    }
    const afterUnion=allocateUnionDueByWork(rows,settlement.appliedUnionDue);
    expect(afterUnion.reduce((sum,row)=>sum+row.netObra,0)).toBeCloseTo(settlement.netPayable,8);
  });
});
