import {it,expect} from 'vitest';
import {cancelThirdPartyMeasurement} from './third-party-payment-mutations.js';
import {buildFinancialLedger,selectDRE,selectAccountsPayable} from './ledger.js';
const fixture=()=>({obras:[{id:'a'}],medicoesTerc:[{id:'m',obraId:'a',status:'aprovada',total:1000,data:'2026-11-01',notaFiscalId:'nf'}],notasFiscais:[{id:'nf',obraId:'a',status:'aprovada',valorBruto:1000,emissao:'2026-11-01',medicaoTercId:'m'}]});
it('bloqueia cancelamento com nota reconhecida, sem alterar custo e obrigação',()=>{
 const data=fixture(),before=structuredClone(data);
 expect(()=>cancelThirdPartyMeasurement({data,measurementId:'m',reason:'Correção',actor:{id:'u'}})).toThrow(/nota fiscal/i);
 expect(data).toEqual(before);const ledger=buildFinancialLedger(data);
 expect(selectDRE(ledger,{competence:'2026-11'}).costCents).toBe(100000);
 expect(selectAccountsPayable(ledger,{}).balanceCents).toBe(100000);
});
it.each(['cancelada','rascunho','rejeitada'])('denuncia vínculo legado com medição %s e mantém a nota reconhecida',status=>{
 const data=fixture();data.medicoesTerc[0].status=status;
 const ledger=buildFinancialLedger(data);
 expect(selectDRE(ledger,{competence:'2026-11'}).costCents).toBe(100000);
 expect(ledger.issues).toContainEqual(expect.objectContaining({code:'INVALID_THIRD_PARTY_INVOICE_LINK',severity:'error'}));
});
it('permite cancelar após regularização explícita da nota',()=>{
 const data=fixture();data.notasFiscais[0].status='rejeitada';
 const result=cancelThirdPartyMeasurement({data,measurementId:'m',reason:'Nota regularizada',actor:{id:'u'}});
 expect(result.medicoesTerc[0].status).toBe('cancelada');expect(selectDRE(buildFinancialLedger(result),{}).costCents).toBe(0);
});
