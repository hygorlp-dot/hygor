import {it,expect} from 'vitest';
import {applyOperationalCommand,OPERATIONAL_COMMAND} from '../sync/operational-commands';
import {buildFinancialLedger} from './ledger';
import {validateOperationalCommandScope} from '../../../server/operational-command-policy';
import {authorizeOperationalCommand} from '../../../api/data';
const sources=[['pedido','pedidos'],['medicao','medicoes'],['despesa_empresa','despesasEmpresa'],['outra_despesa','outrasDesp']];
const record={id:'r',obraId:'a',numero:'1',descricao:'Origem de teste',data:'2026-10-01',competencia:'2026-10',status:'ativo',valor:100,valorPrevisto:100,tipo:'livre',version:2,itens:[{id:'i',materialId:'m',qtd:2,precoUnit:50,qtdRecebida:0}],recebimentos:[],pagamentos:[]};
const command=(type,changes={documentos:[{url:'https://example.test/original.pdf',nome:'Original'}]})=>({type:OPERATIONAL_COMMAND.CLOSING_SOURCE_CORRECTED,idempotencyKey:`closing-correction-${type}`,expectedVersion:2,actorId:'admin',actorName:'Administrador',payload:{sourceType:type,sourceId:'r',changes,reason:'Evidência conferida na origem'}});
const amounts=data=>buildFinancialLedger(data).events.map(e=>[e.id,e.effect,e.amountCents,e.obraId,e.sourceId]);
for(const [type,key] of sources)it(`corrige ${type} sem mudar fatos monetários e sem repetir a operação`,()=>{
 const data={obras:[{id:'a'}],[key]:[{...record,status:type==='pedido'?'enviado':'ativo'}]};const cmd=command(type);
 expect(authorizeOperationalCommand(cmd.type,'admin')).toMatchObject({ok:true});expect(authorizeOperationalCommand(cmd.type,'compras')).toMatchObject({ok:false});
 expect(validateOperationalCommandScope({user:{role:'admin'},data,command:cmd})).toMatchObject({ok:true});
 const result=applyOperationalCommand(data,cmd);expect(result.ok).toBe(true);expect(amounts(result.data)).toEqual(amounts(data));expect(result.data[key][0].version).toBe(3);expect(result.data[key][0].historicoCorrecoesFechamento).toHaveLength(1);
 const repeated=applyOperationalCommand(result.data,cmd);expect(repeated.idempotent).toBe(true);expect(repeated.data[key]).toHaveLength(1);expect(repeated.data[key][0].version).toBe(3);
});
it('recusa versão antiga, alterações financeiras, período fechado e endereço inseguro',()=>{
 const data={obras:[{id:'a'}],outrasDesp:[record]};const cmd=command('outra_despesa');
 expect(applyOperationalCommand(data,{...cmd,expectedVersion:1})).toMatchObject({ok:false,code:'VERSION_CONFLICT'});
 expect(applyOperationalCommand(data,command('outra_despesa',{valor:999})).ok).toBe(false);
 expect(applyOperationalCommand(data,command('outra_despesa',{documentos:[{url:'javascript:alert(1)'}]})).ok).toBe(false);
 expect(applyOperationalCommand({...data,fechamentosFinanceiros:[{status:'fechado',competencia:'2026-10'}]},cmd).ok).toBe(false);
 expect(validateOperationalCommandScope({user:{role:'financeiro',obraId:'b'},data,command:cmd}).ok).toBe(false);
 expect(validateOperationalCommandScope({user:{role:'engenheiro'},data,command:cmd}).ok).toBe(false);
});
