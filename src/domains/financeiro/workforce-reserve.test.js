import {it,expect} from 'vitest';
import {calculateWorkforceReserve} from './workforce-reserve.js';
it.each([[2406.8,746.11,827.11],[1810.6,561.29,622.23]])('reproduz os blocos B/C da referência para base %s, sem incluir SST', (base,charges,reserve)=>{
 const result=calculateWorkforceReserve(base);
 expect(result.errors).toEqual([]);expect(result.ordinaryCharges).toBe(charges);expect(result.monthly).toBe(reserve);
 const {ordinaryCharges,monthly,rounding,errors,...parts}=result;
 expect(Math.round((Object.values(parts).reduce((sum,v)=>sum+v,0)+rounding)*100)/100).toBe(monthly);
});
it('recalcula as premissas e preserva percentuais zero explícitos',()=>{
 const result=calculateWorkforceReserve(2406.8,{workforceReserve:{employerPercent:0,fgtsPercent:0,finePercent:0,noticePercent:0}});
 expect(result.ordinaryCharges).toBe(0);expect(result.chargesOnReserve).toBe(0);expect(result.fine).toBe(0);expect(result.monthly).toBe(467.99);
 expect(calculateWorkforceReserve(100,{workforceReserve:{tenureMonths:0}}).errors.length).toBeGreaterThan(0);
});
