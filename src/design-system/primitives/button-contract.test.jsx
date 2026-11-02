import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import {Button as UiButton} from '../../components/ui/button.jsx';
import {Button as DesignButton} from './Button.jsx';
import {Btn,Inp,Sel,PageHero} from '../../LegacyApp.jsx';
import {PageHeader} from '../patterns/PageHeader.jsx';
it('as três APIs compartilham papéis e mantêm a intenção das variantes antigas',()=>{
 const el=document.createElement('div'),root=createRoot(el);
 try{act(()=>root.render(<><UiButton variant="outline">A</UiButton><DesignButton variant="secondary">B</DesignButton><Btn v="ghost">C</Btn><UiButton variant="destructive">D</UiButton><DesignButton variant="danger">E</DesignButton><Btn v="danger">F</Btn></>));expect([...el.querySelectorAll('button')].map(b=>b.dataset.mrcRole)).toEqual(['secondary','secondary','secondary','destructive','destructive','destructive']);expect([...el.querySelectorAll('button')].every(b=>b.classList.contains('mrc-button'))).toBe(true);}finally{act(()=>root.unmount());}
});
it('carregamento bloqueia reenvio, preserva rótulo acessível e não submete pelo adaptador',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el);let calls=0,submits=0;
 try{act(()=>root.render(<form onSubmit={e=>{e.preventDefault();submits++;}}><Btn ariaLabel="Confirmar pagamento" loading="Salvando…" onClick={()=>calls++}>Confirmar</Btn><DesignButton onClick={()=>calls++}>Consultar</DesignButton><UiButton type="submit">Enviar</UiButton></form>));const buttons=el.querySelectorAll('button');expect(buttons[0].disabled).toBe(true);expect(buttons[0].getAttribute('aria-busy')).toBe('true');expect(buttons[0].getAttribute('aria-label')).toBe('Confirmar pagamento');act(()=>{buttons[0].click();buttons[1].click();});expect(calls).toBe(1);expect(submits).toBe(0);act(()=>buttons[2].click());expect(submits).toBe(1);}finally{act(()=>root.unmount());el.remove();}
});
it('asChild desabilitado bloqueia também o handler do filho e mantém a referência',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el);const ref=React.createRef();let calls=0;
 try{act(()=>root.render(<UiButton asChild disabled ref={ref}><a href="#record" onClick={()=>calls++}>Abrir registro</a></UiButton>));expect(ref.current.tagName).toBe('A');expect(ref.current.getAttribute('aria-disabled')).toBe('true');expect(ref.current.tabIndex).toBe(-1);act(()=>ref.current.click());expect(calls).toBe(0);}finally{act(()=>root.unmount());el.remove();}
});
it('cabeçalho legado pode ser seção sem repetir o título principal',()=>{
 const el=document.createElement('div'),root=createRoot(el);
 try{act(()=>root.render(<><PageHeader title="Financeiro"/><PageHero headingLevel={2} title="Notas fiscais"/><PageHeader headingLevel={3} title="Documentos pendentes"/></>));expect(el.querySelectorAll('h1')).toHaveLength(1);expect(el.querySelector('h2').textContent).toBe('Notas fiscais');expect(el.querySelector('h3').textContent).toBe('Documentos pendentes');}finally{act(()=>root.unmount());}
});
it('campos legados mantêm valor, referência, limites, opção bloqueada e erro associado',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el),ref=React.createRef();
 try{act(()=>root.render(<><Inp label="Valor pago" type="number" value="100" min="1" max="500" inputRef={ref} onChange={()=>{}} error="Confira o valor"/><Sel label="Origem" value="empresa" onChange={()=>{}} options={[{v:'empresa',l:'Empresa'},{v:'obra',l:'Caixa da obra',disabled:true}]}/></>));expect(ref.current.value).toBe('100');expect(ref.current.min).toBe('1');expect(ref.current.max).toBe('500');expect(ref.current.labels[0].textContent).toBe('Valor pago');const error=el.querySelector('[role=alert]');expect(ref.current.getAttribute('aria-describedby')).toContain(error.id);expect(el.querySelector('select').value).toBe('empresa');expect(el.querySelector('option[value=obra]').disabled).toBe(true);}finally{act(()=>root.unmount());el.remove();}
});
