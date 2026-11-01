// @vitest-environment node
import {it,expect} from 'vitest';
import {applyAutomaticAttendanceAllocation} from './attendance-auto-allocation.js';
import {resolveHistoricalEmployeeObraId} from '../src/domains/ponto/permissions.js';
const context={now:'2026-11-01T12:00:00Z',operationId:'op',actorId:'rh',actorName:'RH'};
const base=()=>({employees:[{id:'e',name:'QA',role:'Servente',obra:'a',active:true,version:1}],obras:[{id:'a',name:'A'},{id:'b',name:'B'}],
 attendance:{e:{'2026-10-28':{status:'P',obraId:'a'},'2026-10-29':{status:'P',obraId:'b'},'2026-10-30':{status:'M',obraId:'b'},'2026-11-01':{status:'P',obraId:'b'}}},
 payments:[{id:'preservado',amount:7160}],changeLog:[]});
const apply=(data=base(),entries=[{employeeId:'e',date:'2026-11-01'}])=>applyAutomaticAttendanceAllocation(data,entries,context);
it('transfere qualquer função após três dias distintos; preserva ponto, pagamentos e histórico anterior',()=>{
 const data=base(),before=JSON.stringify(data),r=apply(data);
 expect(r.data.employees[0]).toMatchObject({obra:'b',version:2});expect(r.transfers).toHaveLength(1);
 expect(JSON.stringify(data)).toBe(before);expect(r.data.payments).toBe(data.payments);expect(r.data.attendance).toBe(data.attendance);
 expect(resolveHistoricalEmployeeObraId({employee:r.data.employees[0],date:'2026-10-28',transferEvents:r.data.changeLog,obras:data.obras})).toBe('a');
 expect(apply(r.data).transfers).toEqual([]);
});
it.each(['Pedreiro','Servente','Engenheiro','Mestre','Administrativo'])('a regra independe da função: %s',role=>{
 const d=base();d.employees[0].role=role;expect(apply(d).data.employees[0].obra).toBe('b');
});
it('não transfere antes do terceiro dia, nem soma três batidas do mesmo dia',()=>{
 const d=base();delete d.attendance.e['2026-10-29'];expect(apply(d).transfers).toEqual([]);
});
it('presença em outra obra ou registro legado sem obra impede a sequência',()=>{
 for(const record of [{status:'P',obraId:'a'},'P']){const d=base();d.attendance.e['2026-10-30']=record;expect(apply(d).transfers).toEqual([]);}
});
it('folgas e faltas não contam como dias trabalhados',()=>{
 const d=base();d.attendance.e['2026-10-30']={status:'F',obraId:'b'};expect(apply(d).transfers).toEqual([]);
});
it('preserva desligados, sem obra, destino encerrado e decisões manuais posteriores',()=>{
 const variants=[d=>d.employees[0].active=false,d=>d.employees[0].endDate='2026-11-01',d=>d.employees[0].obra='',d=>d.obras[1].active=false,
 d=>d.changeLog.push({type:'transfer',empId:'e',date:'2026-10-31',fromId:'b',toId:'a'})];
 for(const change of variants){const d=base();change(d);expect(apply(d).transfers).toEqual([]);}
});
it.each(['paused','done','inactive','concluída','cancelada'])('não transfere para obra indisponível: %s',status=>{
 const d=base();d.obras[1].status=status;expect(apply(d).transfers).toEqual([]);
});
it('não dispara ao alterar ponto histórico nem usa dias futuros',()=>{
 expect(apply(base(),[{employeeId:'e',date:'2026-10-29'}]).transfers).toEqual([]);
 const d=base();d.attendance.e['2026-11-02']={status:'P',obraId:'b'};delete d.attendance.e['2026-10-29'];expect(apply(d).transfers).toEqual([]);
});
