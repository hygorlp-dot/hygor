import {it,expect} from 'vitest';
import {reviewMonthlyPayslip,cltBatchReport} from './clt-closing.js';
import {newCltDraft} from './clt-payslip.js';
it('lote só contém holerites salvos e válidos; adiantamento corrigido invalida',()=>{
  const draft={...newCltDraft('2026-09',{salary:2406.8}),paymentDate:'2026-09-30',registration:'001',cbo:'715210',workedDays:22,confirmed:true};
  const employee={id:'e',name:'Operário QA',cpf:'000',startDate:'2026-05-01',remunerationMode:'clt',cltPayroll:{drafts:{'2026-09':draft}}};
  const data={config:{companyName:'Empresa QA',cnpj:'00'},employees:[employee]},ok=reviewMonthlyPayslip(data,employee,'2026-09');expect(ok.errors).toEqual([]);
  const html=cltBatchReport(data,[ok,{...ok,employee:{...employee,name:'BLOQUEADO'},errors:['Pendente']}]);expect(html).toContain('Operário QA');expect(html).not.toContain('BLOQUEADO');expect((html.match(/<!doctype/gi)||[])).toHaveLength(1);
  draft.advanceIds=['a'];draft.advances=[{id:'a',date:'2026-09-15',amount:100}];data.advances=[{id:'a',empId:'e',date:'2026-09-15',amount:150}];
  expect(reviewMonthlyPayslip(data,employee,'2026-09').errors.join(' ')).toContain('Adiantamento alterado');
});
