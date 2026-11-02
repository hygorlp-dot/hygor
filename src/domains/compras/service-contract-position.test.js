import {expect,it} from "vitest";
import {serviceContractPositions,serviceContractsTotals} from "./service-contract-position";
import {buildFinancialLedger,selectDRE,selectCashFlow} from "../financeiro/ledger";
import {applyOperationalCommand,OPERATIONAL_COMMAND} from "../sync/operational-commands";
const fixture=()=>({obras:[{id:"a"},{id:"b"}],terceirizados:[{id:"t",obraId:"a",name:"Prestador",active:true,tipoContrato:"medicao",contractValue:1000,etapas:[{id:"e",nome:"Etapa",valor:1000}]}],medicoesTerc:[{id:"m",tercId:"t",obraId:"a",data:"2026-10-01",status:"aprovada",total:500,itens:[{etapaId:"e",pctAcum:50}]}],pagsTerceiros:[],notasFiscais:[]});
const row=d=>serviceContractPositions(d,{workIds:["a"]})[0];
it("consulta não grava dados nem cria efeitos financeiros",()=>{
 const d=fixture(),before=JSON.stringify(d),ledgerBefore=buildFinancialLedger(d);const r=row(d);
 expect(r).toMatchObject({contractCents:100000,approvedCents:50000,paidCents:0,balanceCents:50000,progress:50});
 expect(JSON.stringify(d)).toBe(before);expect(buildFinancialLedger(d)).toEqual(ledgerBefore);
});
it("a mesma baixa espelhada na nota e em Terceiros conta uma vez",()=>{
 const d=fixture(),pg={id:"pg",valor:200,amount:200,date:"2026-10-02",data:"2026-10-02",obraId:"a",tercId:"t",medicaoTercId:"m",status:"ativo"};
 d.pagsTerceiros=[pg];d.medicoesTerc[0].notaFiscalId="nf";d.notasFiscais=[{id:"nf",obraId:"a",medicaoTercId:"m",numero:"1",status:"aprovada",emissao:"2026-10-01",valorBruto:500,pagamentos:[pg]}];
 expect(row(d)).toMatchObject({approvedCents:50000,paidCents:20000,balanceCents:30000});
 expect(selectDRE(buildFinancialLedger(d),{obraId:"a"}).costCents).toBe(50000);expect(selectCashFlow(buildFinancialLedger(d),{obraId:"a"}).cashOutCents).toBe(20000);
});
it("rascunhos ficam em revisão e rejeitados não viram obrigação",()=>{
 const d=fixture();d.medicoesTerc.push({...d.medicoesTerc[0],id:"pending",status:"rascunho",total:100},{...d.medicoesTerc[0],id:"rejected",status:"rejeitada",total:999});
 expect(row(d)).toMatchObject({measuredCents:60000,pendingCents:10000,approvedCents:50000,counts:{pending:1,rejected:1,toPay:1}});
});
it("estorno reabre o saldo, sem novo custo",()=>{
 const d=fixture();d.pagsTerceiros=[{id:"pg",tercId:"t",medicaoTercId:"m",obraId:"a",date:"2026-10-02",amount:500,status:"estornado"}];
 expect(row(d)).toMatchObject({approvedCents:50000,paidCents:0,balanceCents:50000});
});
it("isola obras e não inclui medições a receber de clientes",()=>{
 const d=fixture();d.terceirizados.push({...d.terceirizados[0],id:"other",obraId:"b"});d.medicoes=[{id:"client",obraId:"a",valorPrevisto:99999,status:"emitida"}];
 expect(serviceContractPositions(d,{workIds:[]})).toEqual([]);expect(serviceContractPositions(d,{workIds:["a"]})).toHaveLength(1);expect(row(d).approvedCents).toBe(50000);
 d.medicoesTerc.push({...d.medicoesTerc[0],id:"mismatch",obraId:"b",total:99999});expect(row(d).approvedCents).toBe(50000);expect(row(d).issues.map(i=>i.code)).toContain("CONTRACT_MEASUREMENT_WORK_MISMATCH");
});
it("arquivo preserva fatos; inclusão de contratos arquivados é explícita",()=>{
 const d=fixture();d.terceirizados[0].status="arquivado";d.medicoesTerc[0].status="arquivada";
 expect(serviceContractPositions(d,{workIds:["a"]})).toEqual([]);expect(serviceContractPositions(d,{workIds:["a"],includeInactive:true})[0]).toMatchObject({approvedCents:50000,canMeasure:false});
});
it("pagamento sem medição é mostrado separado e não baixa obrigação por aproximação",()=>{
 const d=fixture();d.pagsTerceiros=[{id:"advance",tercId:"t",obraId:"a",date:"2026-10-02",amount:200,status:"ativo",reconhecerCusto:false}];
 const r=row(d);expect(r).toMatchObject({paidCents:0,balanceCents:50000});expect(r.unallocated).toHaveLength(1);expect(serviceContractsTotals([r]).balanceCents).toBe(50000);
});
it("não associa nota sem identificação ou vínculo por coincidência de campos vazios",()=>{
 const d=fixture();d.notasFiscais=[{obraId:"a",status:"aprovada",valorBruto:500,documentos:[{nome:"Documento sem vínculo"}]}];
 expect(row(d).invoices).toEqual([]);
});
it("escopo sem obra válida não expõe contratos sem obra",()=>{
 const d=fixture();d.terceirizados[0].obraId="";expect(serviceContractPositions(d,{workIds:[""]})).toEqual([]);
});
it("aprovar, pagar, repetir e vincular nota reutiliza os comandos existentes sem duplicar",()=>{
 const d=fixture();d.usuarios=[{id:"admin",role:"admin",nome:"Admin",active:true}];d.medicoesTerc[0]={...d.medicoesTerc[0],status:"rascunho",version:1};
 const cmd=(type,payload,key,expectedVersion)=>({type,payload,idempotencyKey:key,expectedVersion,actorId:"admin",actorName:"Admin",actorRole:"admin"});
 const approve=applyOperationalCommand(d,cmd(OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_APPROVED,{measurementId:"m"},"contract-approve-0001",1));expect(approve.ok,approve.reason).toBe(true);
 const payCommand=cmd(OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_PAID,{measurementId:"m",payment:{id:"pg",date:"2026-10-02",pagador:"empresa"},riskAccepted:true},"contract-payment-0001",2);
 const paid=applyOperationalCommand(approve.data,payCommand);expect(paid.ok,paid.reason).toBe(true);
 const repeated=applyOperationalCommand(paid.data,payCommand);expect(repeated.ok).toBe(true);expect(repeated.idempotent).toBe(true);expect(repeated.data.pagsTerceiros).toHaveLength(1);
 const beforeLink={...paid.data,notasFiscais:[{id:"nf",obraId:"a",status:"aprovada",valorBruto:500,emissao:"2026-10-01",version:0}]};
 const linked=applyOperationalCommand(beforeLink,cmd(OPERATIONAL_COMMAND.THIRD_PARTY_INVOICE_LINKED,{measurementId:"m",invoiceId:"nf",expectedMeasurementVersion:paid.data.medicoesTerc[0].version,expectedInvoiceVersion:0},"contract-invoice-0001"));expect(linked.ok,linked.reason).toBe(true);
 expect(row(linked.data)).toMatchObject({approvedCents:50000,paidCents:50000,balanceCents:0});expect(selectDRE(buildFinancialLedger(linked.data),{obraId:"a"}).costCents).toBe(50000);
 expect(selectCashFlow(buildFinancialLedger(linked.data),{obraId:"a"}).cashOutCents).toBe(50000);
});
