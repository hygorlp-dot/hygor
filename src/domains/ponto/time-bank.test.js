import {describe,it,expect} from 'vitest';
import {formatTimeBankMinutes,timeBankBalanceMinutes,timeBankStatement} from './time-bank.js';

describe('banco de horas',()=>{
  it('soma saldos do ponto e ajustes ativos e preserva o extrato',()=>{
    const data={attendance:{e:{
      '2026-10-01':{status:'P',obraId:'A',bankMinutes:30,bankReason:'Excedente conferido'},
      '2026-10-02':{status:'P',obraId:'A',bankMinutes:-15,bankReason:'Compensacao'},
      '2026-10-03':{status:'F',obraId:'A',bankMinutes:90},
    }},timeBankAdjustments:[
      {id:'a',employeeId:'e',date:'2026-10-04',minutes:20,status:'active',reason:'Saldo inicial'},
      {id:'b',employeeId:'e',date:'2026-10-05',minutes:99,status:'reversed',reason:'Cancelado'},
    ]};
    expect(timeBankBalanceMinutes(data,'e')).toBe(35);
    expect(timeBankStatement(data,'e')).toHaveLength(3);
    expect(formatTimeBankMinutes(35)).toBe('+0h35');
    expect(formatTimeBankMinutes(-75)).toBe('−1h15');
  });
});
