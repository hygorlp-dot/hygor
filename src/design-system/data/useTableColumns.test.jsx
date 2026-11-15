import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {tableColumnsKey,useTableColumns} from './useTableColumns.js';
const fields=[{key:'id',hideable:false},{key:'amount'},{key:'note'}];
let root,container;
const key=(user='a',company='c',list='fin')=>tableColumnsKey({id:user},{companyId:company},list);
function Probe({user='a',company='c',list='fin',columns=fields}){
 const state=useTableColumns(columns,key(user,company,list));
 return <div><output>{JSON.stringify(state.visible)}</output><span>{String(state.sessionOnly)}</span>{columns.map(c=><button key={c.key} onClick={()=>state.toggle(c.key)}>{c.key}</button>)}<button onClick={state.reset}>reset</button></div>;
}
function render(ui=<Probe/>){if(!root){container=document.createElement('div');document.body.append(container);root=createRoot(container);}act(()=>root.render(ui));return container;}
const click=name=>act(()=>[...container.querySelectorAll('button')].find(b=>b.textContent===name).click());
afterEach(()=>{if(root)act(()=>root.unmount());root=null;container?.remove();localStorage.clear();vi.restoreAllMocks();});
it('persiste somente identificadores de colunas opcionais e restaura a origem padrão',()=>{
 render();click('amount');expect(JSON.parse(localStorage.getItem(key()))).toEqual(['amount']);
 click('id');expect(container.querySelector('output').textContent).toBe('["id","note"]');
 click('reset');expect(localStorage.getItem(key())).toBeNull();expect(container.querySelector('output').textContent).toContain('amount');
});
it('separa empresa, usuário e lista sem reaproveitar a preferência da conta anterior',()=>{
 render();click('amount');
 for(const props of [{user:'b'},{company:'other'},{list:'stock'}]){render(<Probe {...props}/>);expect(container.querySelector('output').textContent).toContain('amount');}
 render();expect(container.querySelector('output').textContent).not.toContain('amount');
});
it('revalida esquema e obrigatórias, mostra colunas novas e ignora chaves removidas',()=>{
 localStorage.setItem(key(),JSON.stringify(['id','amount','removed']));
 render();expect(container.querySelector('output').textContent).toBe('["id","note"]');
 render(<Probe columns={[...fields,{key:'new'}]}/>);expect(container.querySelector('output').textContent).toContain('new');
 click('note');expect(JSON.parse(localStorage.getItem(key()))).toEqual(['amount','note']);
});
it('preferência inválida não oculta a lista e nenhuma configuração pode zerar campos',()=>{
 localStorage.setItem(key(),'{broken');render();expect(container.querySelector('output').textContent).toBe('["id","amount","note"]');
 render(<Probe list="one" columns={[{key:'one'}]}/>);click('one');expect(container.querySelector('output').textContent).toBe('["one"]');
});
it('continua em memória quando o navegador bloqueia leitura ou gravação',()=>{
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked');});
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked');});
 render();click('amount');expect(container.querySelector('output').textContent).toBe('["id","note"]');expect(container.querySelector('span').textContent).toBe('true');
});
it('sem empresa identificada mantém a escolha na sessão e não grava em escopo compartilhado',()=>{
 const write=vi.spyOn(Storage.prototype,'setItem');render(<Probe company=""/>);click('amount');
 expect(write).not.toHaveBeenCalled();expect(container.querySelector('output').textContent).not.toContain('amount');
 expect(tableColumnsKey(null,{companyId:'c'},'fin')).toBeNull();
});
it('sincroniza instâncias da mesma lista, sem misturar outro usuário',()=>{
 render(<><Probe/><Probe/><Probe user="b"/></>);
 act(()=>container.querySelectorAll('button')[1].click());
 expect([...container.querySelectorAll('output')].map(o=>JSON.parse(o.textContent).includes('amount'))).toEqual([false,false,true]);
});
