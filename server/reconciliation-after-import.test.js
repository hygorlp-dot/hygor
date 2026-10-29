import {expect,it,vi} from "vitest";
import {applyOperationalCommand,OPERATIONAL_COMMAND} from "../src/domains/sync/operational-commands.js";
import {reconcileImportedStatement} from "./reconciliation-after-import.js";
const actor={id:"fin",role:"financeiro",nome:"Financeiro"};
const fixture=()=>({fornecedores:[{id:"f",nome:"Loja",chavePix:"loja@pix"}],notasFiscais:[{id:"n",fornecedorId:"f",status:"aprovada",valorLiquido:300,vencimento:"2026-10-20",pagamentos:[]}],transacoes:[],extratos:[],obras:[],pedidos:[],historicoConc:[]});
const row=(id,overrides={})=>({id,chave:id,descricao:"Pix",data:"2026-10-20",valor:-300,chavePix:"loja@pix",fitid:id,status:"pendente",...overrides});
const command=rows=>({type:OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IMPORTED,idempotencyKey:"bank-import-server-test-0001",actorId:actor.id,actorRole:actor.role,payload:{statement:{id:"ex",arquivo:"extrato.ofx"},transactions:rows}});
const run=async(data,cmd,guard)=>reconcileImportedStatement(applyOperationalCommand(data,cmd),cmd,actor,guard);
it("importa e concilia no servidor sem comando do navegador; repetir não duplica pagamento",async()=>{
 const cmd=command([row("t"),row("unknown",{chavePix:"nao@pix",valor:-10})]);
 const result=await run(fixture(),cmd);
 expect(result.ok).toBe(true);expect(result.summary).toMatchObject({automaticallyReconciled:1,pendingReview:1});
 expect(result.data.notasFiscais[0].pagamentos).toHaveLength(1);
 expect(result.data.transacoes[0]).toMatchObject({status:"conciliado",automacaoConciliacao:{regra:"pix-identidade-valor-referencia-v1"}});
 expect(result.data.reconciliationCommandLog).toHaveLength(1);
 const again=await run(result.data,cmd);expect(again.data.notasFiscais[0].pagamentos).toHaveLength(1);
});
it("mantém dois movimentos disputando o mesmo título para revisão",async()=>{
 const result=await run(fixture(),command([row("a"),row("b")]));
 expect(result.summary.automaticallyReconciled).toBe(0);expect(result.data.notasFiscais[0].pagamentos).toHaveLength(0);
});
it("preserva a importação quando a guarda financeira bloqueia a conciliação",async()=>{
 const guard=vi.fn().mockResolvedValue({ok:false,error:"Competência fechada"});
 const result=await run(fixture(),command([row("t")]),guard);
 expect(guard).toHaveBeenCalledOnce();expect(result.summary.pendingReview).toBe(1);expect(result.data.notasFiscais[0].pagamentos).toHaveLength(0);
});
it("não executa com perfil não financeiro",async()=>{
 const cmd=command([row("t")]);const result=await reconcileImportedStatement(applyOperationalCommand(fixture(),cmd),cmd,{role:"rh"});
 expect(result.summary.automaticallyReconciled).toBe(0);
});
