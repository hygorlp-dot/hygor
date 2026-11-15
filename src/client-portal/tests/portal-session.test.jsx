import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach,it,expect,vi} from "vitest";
import ClientPortalApp from "../app/ClientPortalApp.jsx";
import {ClientPortalRouter} from "../app/ClientPortalRouter.jsx";
import {navigatePortal} from "../routes.js";
const roots=[];
async function render(ui){const node=document.createElement("div");document.body.append(node);const root=createRoot(node);roots.push([root,node]);await act(async()=>{root.render(ui);});return node;}
afterEach(()=>{for(const[root,node]of roots.splice(0)){act(()=>root.unmount());node.remove();}vi.restoreAllMocks();window.history.replaceState({},"","/");});
const response=(body,status=200)=>({ok:status<400,status,json:async()=>body});
const session={user:{id:"u"},projects:[{projectId:"a",name:"Obra A",permissions:{viewProgress:true,viewMedia:true,viewWeeklyUpdates:true}},{projectId:"b",name:"Obra B",permissions:{viewFinancial:true}}]};
const portal=id=>({project:{id,name:`Obra ${id.toUpperCase()}`,progress:50},timeline:[{id:"t",phase:`Etapa ${id}`}],dailyReports:[{id:"r",date:"2026-11-14",summary:"Relato sem imagem",services:[]}],publishedMedia:[]});
it("atualiza URL, volta pelo histórico e troca a obra sem mostrar dados anteriores",async()=>{
  vi.spyOn(globalThis,"fetch").mockImplementation(async url=>String(url).endsWith("auth/session")?response(session):response({portal:portal(String(url).includes("/a/")?"a":"b")}));
  const node=await render(<ClientPortalApp/>);
  expect(window.location.pathname).toBe("/cliente/obra/a");
  const progress=[...node.querySelectorAll("button")].find(button=>button.textContent==="Avanço físico");
  await act(async()=>progress.click());expect(window.location.pathname).toBe("/cliente/obra/a/progresso");expect(node.textContent).toContain("Etapa a");
  await act(async()=>navigatePortal("/cliente/obra/a"));
  const select=node.querySelector('select');
  await act(async()=>{select.value="b";select.dispatchEvent(new Event("change",{bubbles:true}));});
  expect(window.location.pathname).toBe("/cliente/obra/b");expect(node.textContent).toContain("Obra B");expect(node.textContent).not.toContain("Etapa a");
});
it("não usa token compartilhado para contornar o login",async()=>{
  window.history.replaceState({},"","/cliente/obra/a?token=legado");
  const fetch=vi.spyOn(globalThis,"fetch").mockResolvedValue(response({},401));
  const node=await render(<ClientPortalApp/>);
  expect(node.textContent).toContain("Entrar no portal");expect(fetch.mock.calls.every(([url])=>url==="/api/client/auth/session")).toBe(true);
});
it("bloqueia conteúdo de rota direta sem a permissão exigida",async()=>{
  window.history.replaceState({},"","/cliente/obra/a/financeiro");
  const node=await render(<ClientPortalRouter portalData={{...portal("a"),financialSummary:[{contractCurrent:999999}]}} permissions={{}}/>);
  expect(node.textContent).toContain("Área indisponível");expect(node.textContent).not.toContain("999.999");
});
it("apresenta diários sem fotos e preserva o registro no dia correto",async()=>{
  window.history.replaceState({},"","/cliente/obra/a/diario");
  const node=await render(<ClientPortalRouter portalData={portal("a")} permissions={session.projects[0].permissions}/>);
  expect(node.textContent).toContain("Relato sem imagem");expect(node.textContent).toContain("Nenhuma foto liberada neste diário.");expect(node.textContent).toContain("14 de nov. de 2026");
});
it("limpa o conteúdo e pede nova entrada quando o servidor informa sessão expirada",async()=>{
  const fetch=vi.spyOn(globalThis,"fetch").mockImplementation(async url=>String(url).endsWith("auth/session")?response(session):response({portal:portal("a")}));
  const node=await render(<ClientPortalApp/>);expect(node.textContent).toContain("Obra A");
  fetch.mockImplementation(async url=>String(url).endsWith("auth/session")?response(session):response({error:"Sessão expirada"},401));
  await act(async()=>[...node.querySelectorAll("button")].find(button=>button.textContent==="Atualizar consulta").click());
  expect(node.textContent).toContain("Sua sessão terminou");expect(node.textContent).not.toContain("Obra A");
});
