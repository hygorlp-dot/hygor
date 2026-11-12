import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEquipeObras } from './useEquipeObras';
import { chamarPontoEletronico } from '../../api';

vi.mock('../../api', () => ({chamarPontoEletronico:vi.fn()}));
const valid = () => ({ok:true,pessoas:[],obras:[],limitacoes:[],fuso:'America/Recife',servidorMs:Date.now()});
let root, host, current;
async function mount() {
  host = document.createElement('div');
  root = createRoot(host);
  function Probe() { current = useEquipeObras(); return null; }
  await act(async()=>root.render(<Probe/>));
}
afterEach(async()=>{ if(root)await act(async()=>root.unmount()); root=null; host?.remove(); vi.clearAllMocks(); });

describe('atualização da equipe nas obras',()=>{
  it('recusa HTTP bem-sucedido com corpo incompleto sem derrubar a tela',async()=>{
    chamarPontoEletronico.mockResolvedValue({ok:true});
    await mount();
    expect(current.snapshot).toBeNull();
    expect(current.erro).toMatch(/resposta inválida/i);
    expect(current.carregando).toBe(false);
  });
  it('mantém a última consulta válida quando uma atualização vem corrompida',async()=>{
    const snapshot=valid();
    chamarPontoEletronico.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({...valid(),pessoas:null});
    await mount();
    await act(async()=>current.carregar());
    expect(current.snapshot).toEqual(snapshot);
    expect(current.erro).toMatch(/resposta inválida/i);
  });
  it('permite tentar novamente e remove o erro após resposta válida',async()=>{
    chamarPontoEletronico.mockResolvedValueOnce({...valid(),obras:{}}).mockResolvedValueOnce(valid());
    await mount();
    await act(async()=>current.carregar());
    expect(current.snapshot.pessoas).toEqual([]);
    expect(current.erro).toBe('');
  });
  it('remove dados anteriores quando a autorização é revogada',async()=>{
    chamarPontoEletronico.mockResolvedValueOnce(valid()).mockResolvedValueOnce({ok:false,status:403});
    await mount();
    await act(async()=>current.carregar());
    expect(current.snapshot).toBeNull();
    expect(current.erro).not.toBe('');
  });
});

describe('recuo automático da equipe', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  it('espera após 402 sem ignorar Atualizar manual e depois recupera', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    chamarPontoEletronico.mockResolvedValueOnce({ok:false,status:402}).mockResolvedValue(valid());
    await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(280_000); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online')); });
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(1);
    await act(async () => current.carregar());
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(2);
    expect(current.erro).toBe('');
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(3);
  });
  it('limita tentativas recusadas e permite recuperação automática após cinco minutos', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    chamarPontoEletronico.mockResolvedValueOnce(valid()).mockResolvedValue({ok:false,status:403});
    await mount();
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    expect(current.snapshot).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(299_999));
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(2);
    chamarPontoEletronico.mockResolvedValue(valid());
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(3);
    expect(current.snapshot).not.toBeNull();
  });
});
