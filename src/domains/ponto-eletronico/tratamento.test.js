import {describe,it,expect} from 'vitest';
import {receivedDayQueue,appropriationReview,intervalKey,defaultReviewInterval,receivedClockPreview} from './tratamento.js';
const interval={inicio:'2026-10-01T10:00:00Z',fim:'2026-10-01T15:00:00Z',obraApropriadaId:'A'};
describe('conferência de capturas recebidas',()=>{
  it('dia sem sincronização não vira falta nem pendência salarial presumida',()=>{
    expect(receivedDayQueue({day:'2026-10-01',summary:[{employeeId:'e',batidas:[],situacao:'sem_batida'}]})).toEqual([]);
  });
  it('marca recebimento tardio, ausência de par e identificação para análise sem mudar origem',()=>{
    const source={employeeId:'e',nome:'Operário',alertas:1,batidas:[{id:'1',marcadoEm:'2026-10-01T10:00:00Z',recebidoEm:'2026-10-02T12:00:00Z'}]};const original=structuredClone(source);
    const [row]=receivedDayQueue({day:'2026-10-01',summary:[source]});
    expect(row.reasons.join(' ')).toContain('sem par');expect(row.reasons.join(' ')).toContain('outro dia');expect(row.pointStatus).toBeNull();expect(source).toEqual(original);
  });
  it('apropriar não é fechar ponto nem quitar pagamento',()=>{
    const [row]=receivedDayQueue({day:'2026-10-01',summary:[{employeeId:'e',batidas:[{},{}]}],appropriations:[{...interval,employeeId:'e',data:'2026-10-01',status:'ativa'}]});
    expect(row.intervals).toHaveLength(1);expect(row.reasons.join(' ')).toContain('Ainda não consta');expect(row.needsReview).toBe(true);
  });
  it('importado sai da pendência e batida tardia volta para revisão sem alterar o ponto',()=>{
    const args={day:'2026-10-01',summary:[{employeeId:'e',batidas:[{id:'1'},{id:'2'}]}],appropriations:[{...interval,id:'a',version:1,employeeId:'e',data:'2026-10-01',status:'ativa'}],data:{attendance:{e:{'2026-10-01':{status:'P',obraId:'A',mobileSource:{eventIds:['1','2'],appropriations:[{id:'a',version:1}]}}}}}};
    expect(receivedDayQueue(args)[0].needsReview).toBe(false);args.summary[0].batidas.push({id:'3'});expect(receivedDayQueue(args)[0].needsReview).toBe(true);expect(args.data.attendance.e['2026-10-01'].mobileSource.eventIds).toEqual(['1','2']);
  });
  it('não permite um intervalo cancelado passar por conferido',()=>{
    const review=appropriationReview({marcacoes:[{eventId:'1'}],intervalos:[interval]},[{...interval,status:'cancelada'}]);expect(review.pending).toHaveLength(1);
  });
  it('reconhece o mesmo instante com formatos equivalentes e evita nova criação',()=>{
    const saved={...interval,id:'a',inicio:'2026-10-01T10:00:00.000Z',status:'ativa'};
    const review=appropriationReview({marcacoes:[{}],intervalos:[interval]},[saved]);expect(review.pending).toEqual([]);expect(review.candidates[0].existing.id).toBe('a');
  });
  it('sinaliza chegada de novas capturas em vez de ignorar intervalos já apropriados',()=>{
    const review=appropriationReview({marcacoes:[{}],intervalos:[{...interval,fim:'2026-10-01T16:00:00Z'}]},[{...interval,status:'ativa'}]);expect(review.warnings.join(' ')).toContain('diferentes');
  });
  it('não inventa intervalo para batida sem saída ou registro legado',()=>{
    expect(appropriationReview({marcacoes:[{}],avisos:[{}]},[]).warnings.join(' ')).toContain('sem saída');expect(appropriationReview({},[]).warnings.join(' ')).toContain('legados');
  });
  it('proposta mantém funcionário, data e captura; grava só a apropriação externa',()=>{
    const result=defaultReviewInterval(interval,'e','2026-10-01');expect(result).toMatchObject({employeeId:'e',data:'2026-10-01',origem:'proposta_capturas',obraApropriadaId:'A'});expect(result).not.toHaveProperty('status');expect(intervalKey(result)).toBe(intervalKey(interval));
  });
  it('prévia mostra duas ou quatro batidas sem inferir presença ou horas extras',()=>{
    const marks=['10:00','15:00','16:00','20:00'].map((time,index)=>({eventId:String(index),marcadoEm:`2026-10-01T${time}:00Z`,obraCapturaId:'A'}));
    expect(receivedClockPreview({marcacoes:marks},'2026-10-01')).toMatchObject({ok:true,entrada:'07:00:00',intervaloSaida:'12:00:00',intervaloRetorno:'13:00:00',saida:'17:00:00',workedMinutes:540});
    expect(receivedClockPreview({marcacoes:marks},'2026-10-01')).not.toHaveProperty('ot');
    expect(receivedClockPreview({marcacoes:marks.slice(0,3)},'2026-10-01').ok).toBe(false);
    expect(receivedClockPreview({marcacoes:[marks[0],{...marks[1],obraCapturaId:'B'}]},'2026-10-01').ok).toBe(false);
  });
});
