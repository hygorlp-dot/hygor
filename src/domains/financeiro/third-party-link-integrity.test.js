import {describe,it,expect} from 'vitest';
import {linkThirdPartyInvoice} from './workflows.js';
import {applyThirdPartyCommand,THIRD_PARTY_COMMAND} from './third-party-commands.js';
import {buildFinancialLedger,selectDRE} from './ledger.js';
import {validateOperationalCommandScope} from '../../../server/operational-command-policy.js';

const fixture=()=>({obras:[{id:'a'},{id:'b'}],medicoesTerc:[{id:'m',obraId:'a',total:1000,status:'aprovada',version:1,data:'2026-11-01'}],notasFiscais:[{id:'nf',obraId:'b',valorBruto:1000,status:'aprovada',version:1,emissao:'2026-11-01'}]});
const command=()=>({type:THIRD_PARTY_COMMAND.THIRD_PARTY_INVOICE_LINKED,actorId:'u',actorName:'Operador',expectedVersion:1,payload:{measurementId:'m',invoiceId:'nf',expectedMeasurementVersion:1,expectedInvoiceVersion:1}});
describe('vínculo fiscal de terceiro: integridade das duas origens',()=>{
 it('rejeita obras diferentes e preserva os dois custos e as versões',()=>{
  const data=fixture(),before=structuredClone(data);
  expect(applyThirdPartyCommand(data,command())).toMatchObject({ok:false,reason:expect.stringMatching(/mesma obra/)});
  expect(data).toEqual(before);
  const ledger=buildFinancialLedger(data);
  for(const obraId of ['a','b'])expect(selectDRE(ledger,{obraId,competence:'2026-11'}).costCents).toBe(100000);
 });
 it.each(['admin','financeiro'])('a política rejeita cruzamento mesmo para %s',role=>{
  expect(validateOperationalCommandScope({data:fixture(),user:{id:'u',role,active:true,obraId:role==='financeiro'?'a':''},command:command()}).ok).toBe(false);
 });
 it('não atribui silenciosamente a obra de nota sem identificação',()=>{
  const data=fixture();delete data.notasFiscais[0].obraId;
  expect(linkThirdPartyInvoice(data,{medicaoTercId:'m',notaFiscalId:'nf'})).toMatchObject({ok:false});
 });
 it('rejeita rateio fiscal para outra obra',()=>{
  const data=fixture();data.notasFiscais[0].obraId='a';data.notasFiscais[0].rateios=[{obraId:'b',valor:1000}];
  expect(linkThirdPartyInvoice(data,{medicaoTercId:'m',notaFiscalId:'nf'})).toMatchObject({ok:false});
 });
 it('vínculo válido reconhece uma vez e atualiza as duas versões',()=>{
  const data=fixture();data.notasFiscais[0].obraId='a';
  const result=applyThirdPartyCommand(data,command());expect(result.ok).toBe(true);
  expect(result.data.medicoesTerc[0].version).toBe(2);expect(result.data.notasFiscais[0].version).toBe(2);
  expect(selectDRE(buildFinancialLedger(result.data),{obraId:'a',competence:'2026-11'}).costCents).toBe(100000);
 });
});
