import {it,expect} from 'vitest';
import {employeeCostReport} from './employee-costs.js';
it('consolida por natureza, usa caixa canônico sem duplicar espelhos e não cria zero para holerite ausente',()=>{
  const data={employees:[{id:'e',name:'Operário',startDate:'2026-07-01',dailyRate:100,vtDaily:10}],attendance:{e:{'2026-09-01':{status:'P'}}},config:{},
    titulosFolha:[{id:'title',employeeId:'e',competencia:'2026-08',liquido:1000,liquidacoes:[{id:'s',valor:400,data:'2026-09-03',transacaoId:'bank'}]}],
    pagamentosFolha:[{id:'mirror',employeeId:'e',valor:400,data:'2026-09-03',transacaoId:'bank'},{id:'unknown',valor:40,data:'2026-09-04',transacaoId:'other'}],
    transacoes:[{id:'bank',data:'2026-09-03',valor:-400}],financialSettlements:[{id:'real',amount:7160}]};
  const before=JSON.stringify(data),report=employeeCostReport(data,'2026-09');
  expect(report.rows[0].cash).toBe(400);expect(report.rows[0].cashDetails).toHaveLength(1);expect(report.unallocated).toHaveLength(1);expect(report.rows[0].payroll).toBeNull();expect(report.rows[0].provision).toBeNull();expect(report.rows[0].pointDetails.find(d=>d.date==='2026-09-01')).toMatchObject({labor:100,benefits:10});expect(JSON.stringify(data)).toBe(before);
});
