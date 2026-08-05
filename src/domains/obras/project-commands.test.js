import { describe, expect, it } from "vitest";
import {
  applyProjectCommand,
  PROJECT_COMMAND,
} from "./project-commands.js";

const command = (type, payload, expectedVersion = 0) => ({
  type,
  payload,
  expectedVersion,
  idempotencyKey:"project-command-key-0001",
  actorId:"admin-1",
  actorName:"Administrador",
});

describe("comandos transacionais de obra", () => {
  it("cria e versiona os dados contratuais da obra", () => {
    const result = applyProjectCommand(
      { obras:[] },
      command(PROJECT_COMMAND.PROJECT_SAVED, {
        project:{
          id:"obra-1", name:"B2-04", contractValue:1358000,
          adminPercentage:10, hasCaixa:true, contractStart:"2026-07-01",
          contractEnd:"2027-12-30",
        },
      }),
      "2026-07-30T12:00:00.000Z",
    );
    expect(result.ok).toBe(true);
    expect(result.data.obras[0]).toMatchObject({
      id:"obra-1", name:"B2-04", contractValue:1358000,
      adminPercentage:10, hasCaixa:true, version:1,
      updatedById:"admin-1",
    });
  });

  it("recusa versão antiga e valores contratuais inválidos", () => {
    const data = { obras:[{ id:"obra-1", name:"B2-04", version:2 }] };
    expect(applyProjectCommand(
      data,
      command(PROJECT_COMMAND.PROJECT_SAVED, {
        project:{ id:"obra-1", name:"B2-04", contractValue:10 },
      }, 1),
    )).toMatchObject({ ok:false });
    expect(applyProjectCommand(
      { obras:[] },
      command(PROJECT_COMMAND.PROJECT_SAVED, {
        project:{ id:"obra-2", name:"K1-02", contractValue:-1 },
      }),
    )).toMatchObject({ ok:false });
  });

  it("exclui somente obra sem histórico e com a versão atual", () => {
    const data = { obras:[{ id:"obra-1", name:"B2-04", version:3 }] };
    const result = applyProjectCommand(
      data,
      command(PROJECT_COMMAND.PROJECT_DELETED, { projectId:"obra-1" }, 3),
    );
    expect(result.ok).toBe(true);
    expect(result.data.obras).toEqual([]);

    const linked = {
      ...data,
      payments:[{ id:"p-1", obraId:"obra-1" }],
    };
    expect(applyProjectCommand(
      linked,
      command(PROJECT_COMMAND.PROJECT_DELETED, { projectId:"obra-1" }, 3),
    )).toMatchObject({ ok:false });
  });

  it("salva fases de forma versionada, preserva as obras e registra auditoria", () => {
    const data={
      fases:[{id:"antiga",nome:"Antiga",ordem:0}],
      fasesVersion:2,
      obras:[{id:"obra-1",name:"B2-04",faseId:"removida"}],
    };
    const result=applyProjectCommand(data,command(PROJECT_COMMAND.PROJECT_PHASES_SAVED,{phases:[
      {id:"execucao",nome:"Execução",ordem:9},
      {id:"entrega",nome:"Entrega",ordem:3},
    ]},2),"2026-08-05T12:00:00.000Z");
    expect(result).toMatchObject({ok:true,data:{fasesVersion:3}});
    expect(result.data.fases.map(item=>item.ordem)).toEqual([0,1]);
    expect(result.data.obras[0].faseId).toBe("execucao");
    expect(result.data.projectPhaseAudit.at(-1)).toMatchObject({byId:"admin-1",at:"2026-08-05T12:00:00.000Z"});
  });

  it("recusa conflitos e fases inválidas sem alterar o estado", () => {
    const data={fases:[{id:"atual",nome:"Atual",ordem:0}],fasesVersion:4,obras:[]};
    expect(applyProjectCommand(data,command(PROJECT_COMMAND.PROJECT_PHASES_SAVED,{phases:[{id:"nova",nome:"Nova"}]},3))).toMatchObject({ok:false});
    expect(applyProjectCommand(data,command(PROJECT_COMMAND.PROJECT_PHASES_SAVED,{phases:[]},4))).toMatchObject({ok:false});
  });

  it("registra mudança de fase no histórico operacional da obra", () => {
    const data={obras:[{id:"obra-1",name:"B2-04",faseId:"planejamento",version:1}]};
    const result=applyProjectCommand(data,command(PROJECT_COMMAND.PROJECT_SAVED,{project:{id:"obra-1",name:"B2-04",faseId:"execucao"}},1),"2026-08-05T13:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.obras[0].operationalHistory).toContainEqual(expect.objectContaining({type:"phase_changed",from:"planejamento",to:"execucao"}));
  });
});
