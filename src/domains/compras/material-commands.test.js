import {describe,expect,it} from "vitest";
import {applyMaterialCommand,MATERIAL_COMMAND} from "./material-commands.js";
const command=(material,expectedVersion=0)=>({type:MATERIAL_COMMAND.MATERIAL_SAVED,actorId:"u-1",actorName:"Compras",expectedVersion,payload:{material}});
describe("comando transacional do catálogo de insumos",()=>{
  it("cria, edita e preserva os demais insumos",()=>{const first=applyMaterialCommand({materiais:[{id:"m-0",codigo:"A",descricao:"Existente"}]},command({id:"m-1",codigo:"B",descricao:" Aço ",unidade:"kg",precoMedio:8}));expect(first.ok).toBe(true);expect(first.data.materiais).toHaveLength(2);const edited=applyMaterialCommand(first.data,command({...first.data.materiais[1],descricao:"Aço CA-50"},1));expect(edited.data.materiais[1]).toMatchObject({descricao:"Aço CA-50",version:2});});
  it("recusa código duplicado e versão antiga",()=>{const data={materiais:[{id:"m-1",codigo:"A",descricao:"Um",version:2}]};expect(applyMaterialCommand(data,command({id:"m-2",codigo:"a",descricao:"Dois"})).ok).toBe(false);expect(applyMaterialCommand(data,command({id:"m-1",codigo:"A",descricao:"Editado"},1)).ok).toBe(false);});
});
