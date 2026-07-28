import { describe,expect,it } from "vitest";
import { archiveLeadForDeletion, isVisibleLead } from "./leads.js";

describe("exclusão auditável de leads",()=>{
  it("retira o lead da operação e preserva fatos vinculados",()=>{
    const commercial={
      leads:[{id:"l1",nome:"Cliente",status:"ativo",etapa:"qualificacao",historico:[]}],
      atividades:[{id:"a1",leadId:"l1",status:"pendente"}],
      reunioes:[{id:"r1",leadId:"l1",status:"realizada"},{id:"r2",leadId:"l1",status:"agendada"}],
      propostas:[{id:"p1",leadId:"l1"}],
      contratos:[{id:"c1",leadId:"l1"}],
      opportunities:[{id:"o1",leadId:"l1",stage:"proposta",version:2}],
      stageEvents:[],
    };
    const result=archiveLeadForDeletion(commercial,{
      leadId:"l1",actor:{id:"u1",nome:"Hygor"},now:"2026-07-28T19:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    expect(isVisibleLead(result.commercial.leads[0])).toBe(false);
    expect(result.commercial.leads[0]).toMatchObject({
      status:"arquivado",etapa:"arquivado",deletedById:"u1",
      deletedAt:"2026-07-28T19:00:00.000Z",
    });
    expect(result.commercial.atividades[0].status).toBe("cancelada");
    expect(result.commercial.reunioes.map(item=>item.status)).toEqual(["realizada","cancelada"]);
    expect(result.commercial.propostas).toEqual(commercial.propostas);
    expect(result.commercial.contratos).toEqual(commercial.contratos);
    expect(result.commercial.opportunities[0]).toMatchObject({stage:"arquivado",probability:0,version:3});
    expect(result.commercial.stageEvents).toHaveLength(1);
  });

  it("é idempotente para um lead já excluído",()=>{
    const commercial={leads:[{id:"l1",status:"arquivado",deletedAt:"2026-07-28"}]};
    const result=archiveLeadForDeletion(commercial,{leadId:"l1"});
    expect(result).toMatchObject({ok:true,idempotent:true,commercial});
  });
});
