import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
vi.mock('../../../LegacyApp',()=>({
  Btn:({children,onClick,disabled})=><button onClick={onClick} disabled={disabled}>{children}</button>,
  Inp:({label,value,onChange,disabled})=><label>{label}<input value={value} disabled={disabled} onInput={e=>onChange(e.target.value)}/></label>,
  Sel:({label,value,onChange,options,disabled})=><label>{label}<select value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></label>,
  Modal:({children,title})=><section aria-label={title}>{children}</section>,
}));
vi.mock('../../../api.js',()=>({chamarPontoEletronico:vi.fn()}));
import ReceivedPointReview from './ReceivedPointReview.jsx';
const interval={inicio:'2026-10-01T10:00:00Z',fim:'2026-10-01T15:00:00Z',obraApropriadaId:'A'};
async function setup({existing=[],canEdit=true,fail=false,dispatchAttendanceCommand,data={},trustedTime=true}={}){
  const calls=[];const request=vi.fn(async(action,body)=>{calls.push({action,body});if(action==='ponto-apropriacao-propor')return {ok:true,marcacoes:[{eventId:'1',marcadoEm:interval.inicio,obraCapturaId:'A',horaConfiavel:trustedTime},{eventId:'2',marcadoEm:interval.fim,obraCapturaId:'A',horaConfiavel:trustedTime}],intervalos:[interval],avisos:[]};if(action==='ponto-apropriacoes')return {ok:true,apropriacoes:existing};if(action==='ponto-apropriacao-salvar')return fail?{ok:false,error:'Falha simulada'}:{ok:true,id:'saved',version:1};return {ok:true,auditoria:[]};});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>{root.render(<ReceivedPointReview employeeId="e" name="Operário" day="2026-10-01" works={[{id:'A',name:'Obra A'}]} canEdit={canEdit} data={data} dispatchAttendanceCommand={dispatchAttendanceCommand} request={request}/>);});
  return {host,calls,close:()=>{act(()=>root.unmount());host.remove();}};
}
it('conferência exige confirmação e grava o intervalo sem alterar marcação/folha',async()=>{
  const f=await setup();const button=[...f.host.querySelectorAll('button')].find(b=>b.textContent==='Conferir intervalo');expect(button.disabled).toBe(true);
  await act(async()=>f.host.querySelector('input[type=checkbox]').click());expect(button.disabled).toBe(false);await act(async()=>button.click());
  expect(f.calls.filter(c=>c.action==='ponto-apropriacao-salvar')).toHaveLength(1);expect(f.calls.find(c=>c.action==='ponto-apropriacao-salvar').body.apropriacao).toMatchObject({employeeId:'e',data:'2026-10-01',inicio:interval.inicio});expect(f.host.textContent).toContain('Já conferido');expect(f.calls.some(c=>c.action.startsWith('attendance'))).toBe(false);f.close();
});
it('dia conferido exige classificação/confirmacão e importa IDs e versões sem redigitar horários',async()=>{
  const dispatch=vi.fn().mockResolvedValueOnce({ok:false,reason:'Resposta indisponível'}).mockResolvedValueOnce({ok:true});
  const f=await setup({existing:[{...interval,id:'a',version:1,status:'ativa'}],dispatchAttendanceCommand:dispatch});
  const button=[...f.host.querySelectorAll('button')].find(b=>b.textContent==='Aprovar e registrar no ponto');expect(button.disabled).toBe(true);
  const fieldset=f.host.querySelector('fieldset'),select=fieldset.querySelector('select');await act(async()=>{select.value='P';select.dispatchEvent(new Event('change',{bubbles:true}));});
  const note=[...fieldset.querySelectorAll('label')].find(l=>l.textContent==='Justificativa da conferência').querySelector('input');await act(async()=>{note.value='Jornada aprovada';note.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>fieldset.querySelector('input[type=checkbox]').click());await act(async()=>button.click());expect(f.host.querySelector('[role=alert]').textContent).toContain('indisponível');await act(async()=>button.click());
  expect(dispatch).toHaveBeenCalledTimes(2);expect(dispatch.mock.calls[0][0]).toEqual(dispatch.mock.calls[1][0]);expect(dispatch.mock.calls[0][0]).toMatchObject({action:'attendance-import-mobile',sourceEventIds:['1','2'],appropriationVersions:[{id:'a',version:1}],status:'P',ot:0,atrasoMin:0});expect(dispatch.mock.calls[0][0]).not.toHaveProperty('record');expect(f.host.textContent).toContain('Dia registrado no ponto');f.close();
});
it('dia existente ou fechado não habilita importação e consulta não exibe aprovação',async()=>{
  for(const options of [{data:{attendance:{e:{'2026-10-01':'P'}}}},{data:{attendanceLocks:{'2026-10-01__A':{locked:true}}}},{canEdit:false},{trustedTime:false}]){
    const f=await setup({...options,existing:[{...interval,id:'a',version:1,status:'ativa'}],dispatchAttendanceCommand:vi.fn()});expect([...f.host.querySelectorAll('button')].some(b=>b.textContent==='Aprovar e registrar no ponto')).toBe(false);f.close();
  }
});
it('consulta não habilita escrita e uma falha não exibe sucesso',async()=>{
  const f=await setup({canEdit:false});expect(f.host.querySelector('input[type=checkbox]')).toBeNull();expect([...f.host.querySelectorAll('button')].find(b=>b.textContent==='Conferir intervalo').disabled).toBe(true);f.close();
  const g=await setup({fail:true});await act(async()=>g.host.querySelector('input[type=checkbox]').click());await act(async()=>[...g.host.querySelectorAll('button')].find(b=>b.textContent==='Conferir intervalo').click());expect(g.host.querySelector('[role=alert]').textContent).toContain('Falha simulada');expect(g.host.textContent).not.toContain('Já conferido');g.close();
});
