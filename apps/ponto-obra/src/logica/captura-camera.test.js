// @vitest-environment node
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {capturarFotoComPrazo} from './captura-camera.js';
beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers());
it('devolve uma foto normal e encerra o timer',async()=>{
 const photo={uri:'photo'},take=vi.fn().mockResolvedValue(photo);expect(await capturarFotoComPrazo({takePictureAsync:take},{quality:0.8})).toBe(photo);expect(vi.getTimerCount()).toBe(0);
});
it('a alternativa autorizada do encarregado recebe falhou sem ficar presa na câmera',async()=>{
 const pending=capturarFotoComPrazo({takePictureAsync:()=>new Promise(()=>{})},{}).catch(()=>({falhou:true}));await vi.advanceTimersByTimeAsync(8000);expect(await pending).toEqual({falhou:true});
});
it('rejeição da câmera é preservada e limpa o prazo',async()=>{
 const error=new Error('camera');await expect(capturarFotoComPrazo({takePictureAsync:()=>Promise.reject(error)},{})).rejects.toBe(error);expect(vi.getTimerCount()).toBe(0);
});
