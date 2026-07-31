import { describe, expect, it } from "vitest";
import { addConstraint, commitWorkPackage, createLookahead, releaseConstraint } from "./commands.js";

const base=()=>({id:"la-1",obraId:"obra-1",semanaInicio:"2026-07-27",semanaFim:"2026-09-06",horizonteSemanas:6,pacotes:[{id:"pac-1",descricao:"Alvenaria",restricaoIds:[],status:"nao_analisado"}],restricoes:[],compromissos:[]});
describe("Lookahead e restrições",()=>{
  it("aceita apenas horizonte configurado e mantém o pacote restrito",()=>{
    expect(createLookahead({...base(),horizonteSemanas:5}).ok).toBe(false);
    const added=addConstraint(base(),{id:"res-1",obraId:"obra-1",pacoteId:"pac-1",categoria:"material",descricao:"Bloco pendente",dataNecessidade:"2026-07-29",bloqueante:true},{actor:{id:"u1"},now:"2026-07-27T09:00:00.000Z"});
    expect(added.ok).toBe(true);
    expect(added.lookahead.pacotes[0]).toMatchObject({ready:false,status:"restrito",blockingConstraintIds:["res-1"]});
    expect(commitWorkPackage(added.lookahead,"pac-1",{now:"2026-07-27"})).toMatchObject({ok:false});
  });
  it("exige evidência para liberar e só então permite compromisso",()=>{
    const added=addConstraint(base(),{id:"res-1",obraId:"obra-1",pacoteId:"pac-1",categoria:"projeto",descricao:"Detalhe executivo",dataNecessidade:"2026-07-29",bloqueante:true},{now:"2026-07-27T09:00:00.000Z"});
    expect(releaseConstraint(added.lookahead,"res-1",{now:"2026-07-28"})).toMatchObject({ok:false});
    const released=releaseConstraint(added.lookahead,"res-1",{evidenceIds:["doc-1"],actor:{id:"u1",nome:"Ana"},now:"2026-07-28T10:00:00.000Z"});
    expect(released.lookahead.pacotes[0]).toMatchObject({ready:true,status:"pronto"});
    expect(commitWorkPackage(released.lookahead,"pac-1",{now:"2026-07-28"}).lookahead.pacotes[0]).toMatchObject({status:"comprometido",comprometido:true});
  });
});
