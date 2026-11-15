import {act,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {SaveRecovery} from './SaveRecovery.jsx';
import {snapshotJournal} from './snapshot-journal.js';
vi.mock('./snapshot-journal.js',()=>({snapshotJournal:{readLatest:vi.fn()},recoveryTab:()=> 'local-test',canRecoverSnapshot:()=>false,expandSnapshot:vi.fn()}));
let root,host,events,release;
const queue={hasPending:()=>false,getFailure:()=>null};
function Harness(){
 const [ready,setReady]=useState(false),[available,setAvailable]=useState(false);
 useEffect(()=>{events.push({ready,available});},[ready,available]);
 return <SaveRecovery user={{id:'u',role:'admin'}} queue={queue} state="idle" open={false} pageId="plan" onReady={setReady} onAvailable={setAvailable} onOpen={()=>{}}/>;
}
beforeEach(()=>{events=[];snapshotJournal.readLatest.mockReset();snapshotJournal.readLatest.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();});
it('does not expose an automatic-save window while loading a protected edit',async()=>{
 await act(async()=>root.render(<Harness/>));expect(events).toEqual([{ready:false,available:false}]);
 await act(async()=>release({revision:'protected',createdAt:'2026-11-15T12:00:00Z'}));
 expect(events.at(-1)).toEqual({ready:true,available:true});
 expect(events.some(event=>event.ready&&!event.available)).toBe(false);
});
it('allows automatic preparation only after an empty journal has been read',async()=>{
 await act(async()=>root.render(<Harness/>));expect(events.some(event=>event.ready)).toBe(false);
 await act(async()=>release(null));expect(events.at(-1)).toEqual({ready:true,available:false});
});
it('keeps initialization blocked when the local read fails',async()=>{
 snapshotJournal.readLatest.mockRejectedValue(new Error('storage denied'));await act(async()=>root.render(<Harness/>));
 expect(events.at(-1)).toEqual({ready:false,available:true});expect(events.some(event=>event.ready)).toBe(false);
});
it('ignores an older empty read that finishes after a newer protected edit',async()=>{
 const completions=[];snapshotJournal.readLatest.mockImplementation(()=>new Promise(resolve=>completions.push(resolve)));
 await act(async()=>root.render(<Harness/>));await act(async()=>window.dispatchEvent(new Event('focus')));
 await act(async()=>completions[1]({revision:'latest',createdAt:'2026-11-15T12:00:00Z'}));
 await act(async()=>completions[0](null));expect(events.at(-1)).toEqual({ready:true,available:true});expect(events.some(event=>event.ready&&!event.available)).toBe(false);
});
