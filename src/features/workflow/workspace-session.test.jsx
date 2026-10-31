import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach,expect,it} from "vitest";
import {WorkflowContext} from "./WorkflowNavigation.jsx";
import {useWorkspaceState} from "./workspace-session.jsx";
let root,container;
afterEach(()=>{act(()=>root?.unmount());container?.remove();root=null;container=null;});
function Screen({instance}){const [value,setValue]=useWorkspaceState("screen","filter","",instance);return <input aria-label="Filtro" value={value} onChange={e=>setValue(e.target.value)}/>;}
function render(views,instance,shown=true){if(!root){container=document.createElement("div");document.body.append(container);root=createRoot(container);}act(()=>root.render(<WorkflowContext.Provider value={{views}}>{shown&&<Screen instance={instance}/>}</WorkflowContext.Provider>));}
function fill(value){act(()=>{const input=container.querySelector("input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));});}
it("restaura o filtro após desmontar e remontar o módulo",()=>{const views=new Map();render(views,"a");fill("cimento");render(views,"a",false);render(views,"a");expect(container.querySelector("input").value).toBe("cimento");});
it("isola telas internas de obras diferentes mesmo sem remontar o componente",()=>{const views=new Map();render(views,"a");fill("cimento");render(views,"b");expect(container.querySelector("input").value).toBe("");fill("aço");render(views,"a");expect(container.querySelector("input").value).toBe("cimento");});
it("uma nova sessão não herda filtros da sessão anterior",()=>{render(new Map(),"a");fill("cimento");act(()=>root.unmount());root=null;container.remove();container=null;render(new Map(),"a");expect(container.querySelector("input").value).toBe("");});
