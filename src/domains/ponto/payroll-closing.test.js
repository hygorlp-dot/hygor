import {
  allocateNetByWork, applyPayrollClosingCommand, buildPayrollTitles, payrollClosingBlockers,
  payrollClosingDivergences, payrollPeriodKey, PAYROLL_CLOSING_COMMAND,
} from "./payroll-closing.js";
import { applyOperationalCommand } from "../sync/operational-commands.js";
import { buildFinancialLedger } from "../financeiro/ledger.js";
import { registrarPagamentoEConciliar } from "../conciliacao/mutations.js";

const NOW="2026-10-28T12:00:00.000Z";
const periodKey=payrollPeriodKey(2026,9,"1");
const closingId="fechamento-1";

// Linha no formato de calcRow (FolhaView) para um diarista em duas obras.
const row={
  id:"e1",name:"Antonio",cpf:"12345678901",pixKey:"antonio@pix",
  gross:1000,vt:60,vr:40,advances:100,unionDue:0,net:1000,
  obrasPorDia:[
    {obraId:"o1",obraName:"Casa A",netObra:666.666},
    {obraId:"o2",obraName:"Casa B",netObra:333.334},
  ],
};

const base=()=>({
  obras:[{id:"o1",name:"Casa A",contractType:"empreitada"},{id:"o2",name:"Casa B",contractType:"admin_only"}],
  employees:[{id:"e1",name:"Antonio",cpf:"12345678901",pixKey:"antonio@pix",active:true}],
  titulosFolha:[],pagamentosFolha:[],fechamentosFinanceiros:[],
  transacoes:[{id:"t1",extratoId:"ex1",data:"2026-10-20",valor:-1000,status:"pendente",chavePix:"antonio@pix"}],
  notasFiscais:[],pedidos:[],medicoes:[],medicoesTerc:[],terceirizados:[],caixaObra:[],
  outrasDesp:[],despesasEmpresa:[],historicoConc:[],reconciliationLinks:[],
});

const titles=()=>buildPayrollTitles({
  rows:[row],closingId,periodKey,periodoInicio:"2026-10-01",periodoFim:"2026-10-15",
  vencimento:"2026-10-20",payerForWork:obraId=>obraId==="o2"?"obra_administracao":"construtora",
});

const close=(data,payload={})=>applyPayrollClosingCommand(data,{
  type:PAYROLL_CLOSING_COMMAND.PAYROLL_FORTNIGHT_CLOSED,actorId:"rh",actorName:"RH",
  payload:{periodKey,closingId,titles:titles(),...payload},
},NOW);

describe("fechamento da quinzena da folha", () => {
  test("rateio por obra fecha exatamente com o líquido, em centavos", () => {
    const rateio=allocateNetByWork(100000,[{netObra:1},{netObra:1},{netObra:1}]);
    expect(rateio.map(item=>item.cents)).toEqual([33334,33333,33333]);
    expect(rateio.reduce((sum,item)=>sum+item.cents,0)).toBe(100000);
  });

  test("gera um título por funcionário com valor a receber, rateado e com pagador por obra", () => {
    const [title]=titles();
    expect(title.id).toBe(`${closingId}:e1`);
    expect(title.liquido).toBe(1000);
    expect(title.competencia).toBe("2026-10");
    expect(title.rateiosPorObra).toEqual([
      {obraId:"o1",obraNome:"Casa A",valor:666.67,pagador:"construtora"},
      {obraId:"o2",obraNome:"Casa B",valor:333.33,pagador:"obra_administracao"},
    ]);
    expect(buildPayrollTitles({rows:[{...row,net:0}],closingId,periodKey})).toEqual([]);
  });

  test("fecha a quinzena e não deixa fechar de novo sem reabrir", () => {
    const result=close(base());
    expect(result.ok).toBe(true);
    expect(result.data.titulosFolha).toHaveLength(1);
    expect(result.data.titulosFolha[0]).toMatchObject({status:"em_aberto",saldo:1000,version:1,fechadoFolhaPor:"RH"});
    const again=close(result.data,{closingId:"fechamento-2",titles:titles().map(t=>({...t,id:"fechamento-2:e1",closingId:"fechamento-2"}))});
    expect(again.ok).toBe(false);
    expect(again.reason).toMatch(/já está fechada/);
  });

  test("recusa rateio que não fecha com o líquido e vencimento em período financeiro fechado", () => {
    const [title]=titles();
    expect(close(base(),{titles:[{...title,rateiosPorObra:[{obraId:"o1",valor:900}]}]}).reason).toMatch(/não fecha/);
    const fechado={...base(),fechamentosFinanceiros:[{status:"fechado",dataInicio:"2026-10-01",dataFim:"2026-10-31"}]};
    expect(close(fechado).reason).toMatch(/período financeiro fechado/);
  });

  test("o razão reconhece a obrigação por obra, sem alerta de rateio", () => {
    const data=close(base()).data;
    const ledger=buildFinancialLedger(data);
    const payables=ledger.events.filter(e=>e.sourceType==="titulo_folha"&&e.effect==="payable_increase");
    expect(payables.map(e=>[e.obraId,e.amountCents])).toEqual([["o1",66667],["o2",33333]]);
    expect(ledger.issues.filter(i=>i.code?.startsWith("PAYROLL_"))).toEqual([]);
  });

  test("conciliar o PIX baixa o título e não gera 'pagamento sem título vinculado'", () => {
    const data=close(base()).data;
    const titleId=data.titulosFolha[0].id;
    const paid=registrarPagamentoEConciliar(data,{transacaoId:"t1",tipo:"tituloFolha",entidadeId:titleId,valor:1000,operador:{id:"fin",nome:"Financeiro"}});
    expect(paid.resumo.ok).toBe(true);
    expect(paid.data.titulosFolha[0].status).toBe("pago");
    const issues=buildFinancialLedger(paid.data).issues.map(i=>i.code);
    expect(issues).not.toContain("PAYROLL_PAYMENT_WITHOUT_TITLE");
  });

  test("reabrir exige motivo, cancela os títulos e é bloqueado se já houve pagamento", () => {
    const closed=close(base()).data;
    const reopen=(data,reason="Ponto corrigido")=>applyPayrollClosingCommand(data,{
      type:PAYROLL_CLOSING_COMMAND.PAYROLL_FORTNIGHT_REOPENED,actorId:"rh",actorName:"RH",payload:{periodKey,reason},
    },NOW);
    expect(reopen(closed,"").reason).toMatch(/motivo/);
    const reopened=reopen(closed);
    expect(reopened.ok).toBe(true);
    expect(reopened.data.titulosFolha[0]).toMatchObject({status:"cancelado",motivoCancelamento:"Ponto corrigido",version:2});
    expect(buildFinancialLedger(reopened.data).events.filter(e=>e.sourceType==="titulo_folha")).toEqual([]);
    expect(close(reopened.data,{closingId:"fechamento-2",titles:titles().map(t=>({...t,id:"fechamento-2:e1",closingId:"fechamento-2"}))}).ok).toBe(true);

    const paid=registrarPagamentoEConciliar(closed,{transacaoId:"t1",tipo:"tituloFolha",entidadeId:closed.titulosFolha[0].id,valor:1000,operador:{id:"fin",nome:"Financeiro"}}).data;
    expect(reopen(paid).reason).toMatch(/pagamento conciliado/);
  });

  test("divergência aparece quando o ponto muda depois do fechamento", () => {
    const closedTitles=titles();
    expect(payrollClosingDivergences(closedTitles,[row])).toEqual([]);
    expect(payrollClosingDivergences(closedTitles,[{...row,net:1150}])).toEqual([
      {employeeId:"e1",fechadoCents:100000,atualCents:115000},
    ]);
  });

  test("bloqueios de fechamento vêm da conferência da folha", () => {
    expect(payrollClosingBlockers({pendencias:[],rows:[row]})).toEqual([]);
    expect(payrollClosingBlockers({
      pendencias:[{id:"e1",semRegistro:["2026-10-02"],campos:[]}],
      rows:[{...row,pixKey:""}],
    })).toHaveLength(2);
  });

  test("passa pelo despachante operacional com recibo idempotente", () => {
    const command={
      type:PAYROLL_CLOSING_COMMAND.PAYROLL_FORTNIGHT_CLOSED,idempotencyKey:"idem-fechamento-1",now:NOW,
      actorId:"rh",actorName:"RH",payload:{periodKey,closingId,titles:titles()},
    };
    const first=applyOperationalCommand(base(),command);
    expect(first.ok).toBe(true);
    const second=applyOperationalCommand(first.data,command);
    expect(second.idempotent).toBe(true);
    expect(second.data.titulosFolha).toHaveLength(1);
  });
});
