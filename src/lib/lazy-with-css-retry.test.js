// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { importWithCssRetry } from './lazy-with-css-retry.js';

const asset='/assets/conferencia-batidas-BJTRqjMZ.css';
const failure=()=>new Error(`Unable to preload CSS for ${asset}`);
afterEach(()=>{document.head.innerHTML='';vi.useRealTimers();});
const failedLink=(path=asset)=>{
  const link=document.createElement('link');link.rel='stylesheet';link.href=path;
  document.head.append(link);return link;
};
describe('recuperação de CSS antes de rejeitar React.lazy',()=>{
  it('aguarda o CSS real antes de repetir o import, sem recarregar a página',async()=>{
    failedLink();const module={default:()=>null};
    const load=vi.fn().mockRejectedValueOnce(failure()).mockResolvedValue(module);
    const pending=importWithCssRetry(load);await vi.waitFor(()=>expect(document.querySelector('link[data-arcd-css-retry]')).not.toBeNull());
    expect(load).toHaveBeenCalledTimes(1);
    const retry=document.querySelector('link[data-arcd-css-retry]');
    expect(new URL(retry.href).searchParams.has('_arcd_css_retry')).toBe(true);
    retry.dispatchEvent(new Event('load'));
    expect(await pending).toBe(module);expect(load).toHaveBeenCalledTimes(2);
  });
  it('recupera todas as folhas que falharam no mesmo preload',async()=>{
    failedLink();failedLink('/assets/second.css');
    const load=vi.fn().mockRejectedValueOnce(failure()).mockResolvedValue({default:null});
    const pending=importWithCssRetry(load);await vi.waitFor(()=>expect(document.querySelectorAll('[data-arcd-css-retry]')).toHaveLength(2));
    const links=[...document.querySelectorAll('[data-arcd-css-retry]')];
    links[0].dispatchEvent(new Event('load'));expect(load).toHaveBeenCalledTimes(1);
    links[1].dispatchEvent(new Event('load'));await pending;expect(load).toHaveBeenCalledTimes(2);
  });
  it('devolve a falha original se a segunda requisição falhar, sem laço',async()=>{
    failedLink();const error=failure();const load=vi.fn().mockRejectedValue(error);
    const pending=importWithCssRetry(load);const rejected=expect(pending).rejects.toBe(error);
    await vi.waitFor(()=>expect(document.querySelector('[data-arcd-css-retry]')).not.toBeNull());
    document.querySelector('[data-arcd-css-retry]').dispatchEvent(new Event('error'));
    await rejected;expect(load).toHaveBeenCalledTimes(1);
  });
  it('não repete erros de código ou de negócio',async()=>{
    const error=new Error('Falha na medição');const load=vi.fn().mockRejectedValue(error);
    await expect(importWithCssRetry(load)).rejects.toBe(error);expect(load).toHaveBeenCalledTimes(1);
  });
  it('encerra a tentativa se a rede não responder',async()=>{
    vi.useFakeTimers();failedLink();const error=failure();const load=vi.fn().mockRejectedValue(error);
    const pending=importWithCssRetry(load);const rejected=expect(pending).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(8000);await rejected;expect(load).toHaveBeenCalledTimes(1);
  });
});
