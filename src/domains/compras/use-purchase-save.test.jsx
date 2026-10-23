import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { usePurchaseSave } from "./use-purchase-save";

let root,container,api;
function mount(dispatch){
  container=document.createElement("div");document.body.append(container);root=createRoot(container);
  function Harness(){api=usePurchaseSave(dispatch);return <p>{api.save.message}</p>;}
  act(()=>root.render(<Harness/>));
}
afterEach(()=>{act(()=>root?.unmount());container?.remove();});

it("bloqueia submissões simultâneas e só anuncia salvo após confirmação",async()=>{
  let finish;const raw=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));mount(raw);
  let first;act(()=>{first=api.dispatch({type:"save"});});
  expect(api.save.state).toBe("saving");
  await act(async()=>{expect(await api.dispatch({type:"duplicate"})).toMatchObject({ok:false});});
  expect(raw).toHaveBeenCalledTimes(1);
  await act(async()=>{finish({ok:true});await first;});
  expect(api.save.state).toBe("saved");
});
it("libera nova tentativa após rejeição e depois de erro de rede",async()=>{
  const raw=vi.fn().mockResolvedValueOnce({ok:false,reason:"Conflito"}).mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ok:true});mount(raw);
  await act(async()=>{await api.dispatch({});});expect(api.save).toMatchObject({state:"error",message:"Conflito"});
  await act(async()=>{await api.dispatch({});});expect(api.save.state).toBe("error");
  await act(async()=>{await api.dispatch({});});expect(api.save.state).toBe("saved");
  expect(raw).toHaveBeenCalledTimes(3);
});
it("não oferece escrita sem conexão",()=>{
  mount(null);expect(api.dispatch).toBeNull();
});
it("não anuncia confirmação quando o servidor não entrega resultado",async()=>{
  mount(vi.fn().mockResolvedValue(undefined));
  await act(async()=>{await api.dispatch({});});
  expect(api.save.state).toBe("error");
});
