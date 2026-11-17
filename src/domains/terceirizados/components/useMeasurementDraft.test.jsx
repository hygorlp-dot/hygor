import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {useMeasurementDraft} from './useMeasurementDraft.js';
import {measurementDraftKey,readMeasurementDraft,saveMeasurementDraft} from '../measurement-draft.js';
const scope={userId:'qa',obraId:'work',contractId:'contract'},form={data:'2026-11-17',observacao:'',pcts:{s:'0'},fotos:[]};
let api;
function Harness(){const [value,setForm]=useState(form),[open,setOpen]=useState(true);const draft=useMeasurementDraft({open,form:value,baseSignature:'base'});api={draft,setForm,setOpen};return null;}
function mount(){const el=document.createElement('div'),root=createRoot(el);document.body.append(el);act(()=>root.render(<Harness/>));return ()=>{act(()=>root.unmount());el.remove();};}
const start=(extra={})=>act(()=>api.setForm(api.draft.start(scope,form,{measurementId:'measurement-qa',signature:'base',...extra})));
afterEach(()=>{localStorage.clear();vi.restoreAllMocks();});
it('protege a tentativa exata antes do envio e a restaura após desmontar',()=>{
 let unmount=mount();start();const command={type:'MEDICAO_TERCEIRO_REGISTRADA',idempotencyKey:'exact-qa-command',payload:{measurement:{id:'measurement-qa',total:500}}};act(()=>expect(api.draft.prepare(command)).toEqual(command));expect(readMeasurementDraft(scope).draft.attempt).toEqual(command);unmount();unmount=mount();start();expect(api.draft.session.attempt).toEqual(command);act(()=>expect(api.draft.prepare({...command,idempotencyKey:'different'})).toEqual(command));unmount();
});
it('limpar depois da confirmação não recria o rascunho ao desmontar',()=>{
 const unmount=mount();start();act(()=>api.setForm({...form,pcts:{s:'50'}}));act(()=>expect(api.draft.flush()).toBe(true));act(()=>api.draft.clear());unmount();expect(readMeasurementDraft(scope).draft).toBeNull();
});
it('quota impede proteger a tentativa sem afirmar sucesso nem apagar o conteúdo anterior',()=>{
 const unmount=mount();start();act(()=>api.draft.flush());const previous=localStorage.getItem(measurementDraftKey(scope));vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});act(()=>expect(api.draft.prepare({idempotencyKey:'attempt-qa'})).toBeNull());expect(localStorage.getItem(measurementDraftKey(scope))).toBe(previous);expect(api.draft.persistence.state).toBe('error');const exit=new Event('beforeunload',{cancelable:true});window.dispatchEvent(exit);expect(exit.defaultPrevented).toBe(true);unmount();
});
it('rascunho corrompido permanece bloqueado até descarte explícito',()=>{
 localStorage.setItem(measurementDraftKey(scope),'broken');const unmount=mount();start();act(()=>expect(api.draft.flush()).toBe(false));expect(localStorage.getItem(measurementDraftKey(scope))).toBe('broken');act(()=>expect(api.draft.discard()).toBe(true));unmount();expect(readMeasurementDraft(scope).draft).toBeNull();
});
it('resposta já confirmada encerra somente o rascunho correspondente sem reenvio',()=>{
 saveMeasurementDraft(scope,{measurementId:'measurement-qa',baseSignature:'base',form});const unmount=mount();start({submittedIds:['measurement-qa']});expect(api.draft.session.restored).toBe(false);expect(api.draft.session.attempt).toBeNull();unmount();
});
