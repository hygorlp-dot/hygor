import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {LoadingState} from './LoadingState.jsx';
let root,el;
beforeEach(()=>{vi.useFakeTimers();el=document.createElement('div');document.body.append(el);root=createRoot(el);});
afterEach(()=>{act(()=>root.unmount());el.remove();vi.useRealTimers();});
it('aguarda a transição rápida e anuncia uma única espera com contexto',()=>{
 act(()=>root.render(<LoadingState label="compras"/>));expect(el.querySelector('.mrc-loading-state')).toBeTruthy();expect(el.querySelector('[role=status]')).toBeNull();act(()=>vi.advanceTimersByTime(199));expect(el.textContent).toBe('');act(()=>vi.advanceTimersByTime(1));const status=el.querySelector('[role=status]');expect(status.getAttribute('aria-label')).toBe('Carregando compras…');expect(el.querySelectorAll('[role=status]')).toHaveLength(1);expect(el.querySelector('span[aria-hidden=true]').textContent).toBe('Carregando compras…');expect(el.querySelector('[aria-busy=true]')).toBeNull();
});
it('remove a espera e o temporizador se o conteúdo chega antes do atraso',()=>{
 act(()=>root.render(<LoadingState label="folha"/>));act(()=>vi.advanceTimersByTime(70));act(()=>root.render(<h1>Folha disponível</h1>));expect(vi.getTimerCount()).toBe(0);act(()=>vi.advanceTimersByTime(500));expect(el.textContent).toBe('Folha disponível');expect(el.querySelector('[role=status]')).toBeNull();
});
it('atualiza o contexto de uma consulta ainda aberta sem acumular indicadores',()=>{
 act(()=>root.render(<LoadingState label="documento"/>));act(()=>vi.advanceTimersByTime(200));act(()=>root.render(<LoadingState label="PDF"/>));expect(el.querySelectorAll('[role=status]')).toHaveLength(1);expect(el.querySelector('[role=status]').getAttribute('aria-label')).toBe('Carregando PDF…');
});

it('mantém os textos do contrato anterior de title e description',()=>{
 act(()=>root.render(<LoadingState title="Preparando consulta" description="Mantenha os filtros."/>));act(()=>vi.advanceTimersByTime(200));expect(el.querySelector('[role=status]').getAttribute('aria-label')).toBe('Preparando consulta');expect(el.textContent).toContain('Mantenha os filtros.');
});
