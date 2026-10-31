import {expect,it} from 'vitest';
import {previewCompanyRecurrences,shiftRecurringDueDate} from './recurrence-preview.js';
import {replicateCompanyRecurringExpenses} from '../dre/mutations.js';
const expense={id:'a',competencia:'2026-01',categoria:'software',descricao:'Sistema',fornecedor:'Loja',valor:100,recorrente:true,vencimento:'2026-01-31',pago:true,dataPagamento:'2026-01-31',documento:'NF 1',documentos:[{id:'pdf'}]};
const scope={fromCompetence:'2026-01',toCompetence:'2026-02'};
const actor={id:'fin',nome:'Financeiro'};

it('prevê calendário, ano bissexto e deslocamento de vencimento no mês seguinte',()=>{
  expect(shiftRecurringDueDate('2026-01-31',1)).toBe('2026-02-28');
  expect(shiftRecurringDueDate('2028-01-31',1)).toBe('2028-02-29');
  expect(shiftRecurringDueDate('2026-02-10',1)).toBe('2026-03-10');
  expect(()=>shiftRecurringDueDate('2026-02-31',1)).toThrow();
  expect(previewCompanyRecurrences({},{fromCompetence:'2026-13',toCompetence:'2027-01'}).error).toBeTruthy();
});
it('ignora repetições no destino e no lote, preservando fornecedores distintos',()=>{
  const data={despesasEmpresa:[expense,{...expense,id:'b',descricao:' SISTEMA '},{...expense,id:'c',fornecedor:'Outro'},{...expense,id:'existing',competencia:'2026-02',descricao:'sistema'}]};
  const plan=previewCompanyRecurrences(data,scope);
  expect(plan.rows.filter(row=>row.eligible).map(row=>row.source.id)).toEqual(['c']);
  expect(plan.rows.filter(row=>row.duplicate)).toHaveLength(2);
});
it('confirma seleção sem reutilizar baixas, vínculos bancários ou documentos',()=>{
  const data={despesasEmpresa:[{...expense,transacaoId:'tx',conciliado:true},{...expense,id:'b',descricao:'Outro sistema'}]};
  const plan=previewCompanyRecurrences(data,scope);
  const copied=replicateCompanyRecurringExpenses({data,...scope,actor,ids:['new'],sourceIds:['a'],previewFingerprint:plan.fingerprint});
  expect(copied.copied).toBe(1);
  expect(copied.despesasEmpresa.at(-1)).toMatchObject({id:'new',recurrenceSeriesId:'a',vencimento:'2026-02-28',pago:false,transacaoId:'',documento:'',documentos:[]});
  expect(data.despesasEmpresa).toHaveLength(2);
});
it('recusa prévia desatualizada e não duplica uma confirmação repetida',()=>{
  const data={despesasEmpresa:[expense]},plan=previewCompanyRecurrences(data,scope);
  const request={...scope,actor,ids:['new'],sourceIds:['a'],previewFingerprint:plan.fingerprint};
  expect(()=>replicateCompanyRecurringExpenses({data:{despesasEmpresa:[{...expense,valor:200}]},...request})).toThrow(/prévia mudou/);
  const copied=replicateCompanyRecurringExpenses({data,...request});
  expect(()=>replicateCompanyRecurringExpenses({data:copied,...request,ids:['another']})).toThrow(/prévia mudou/);
  expect(()=>replicateCompanyRecurringExpenses({data,...request,sourceIds:['unknown']})).toThrow(/seleção/);
});
