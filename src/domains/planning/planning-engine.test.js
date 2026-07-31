import { describe, expect, it } from "vitest";
import { adaptLegacyPlanning, addWorkingDays, assessScheduleHealth, buildPhysicalCurve, calculateCriticalPath, calculatePhysicalProgress, canArchiveWbsNode, comparePlanningPilot, moveWbsNode, normalizeWbsTree, scheduleProject, validateActivityBudgetLinks, validatePhysicalWeights } from "./index.js";

const calendar={ id:"obra", workingDays:[1,2,3,4,5], holidays:["2026-07-09"] };
describe("Planning Engine parallel foundation", () => {
  it("normalizes an EAP and blocks cycles or archive with active children", () => {
    const nodes=[{id:"root",name:"Obra",type:"project",order:1},{id:"phase",name:"Estrutura",type:"phase",parentId:"root",order:1},{id:"task",name:"Concreto",type:"activity",parentId:"phase",order:1}];
    expect(normalizeWbsTree(nodes).nodes.map(node=>node.code)).toEqual(["1","1.1","1.1.1"]);
    expect(moveWbsNode(nodes,"root","task",1)).toMatchObject({ok:false});
    expect(canArchiveWbsNode(nodes,"phase")).toMatchObject({ok:false});
  });

  it("applies working calendars, holidays and dependencies without mutating source", () => {
    const activities=[{id:"a",name:"Fundação",duration:2,startDate:"2026-07-08"},{id:"b",name:"Estrutura",duration:2}];
    const result=scheduleProject({activities,dependencies:[{fromId:"a",toId:"b",type:"FS"}],calendars:[calendar],projectStart:"2026-07-08"});
    expect(result.activities.find(item=>item.id==="a")).toMatchObject({startDate:"2026-07-08",finishDate:"2026-07-10"});
    expect(result.activities.find(item=>item.id==="b")).toMatchObject({startDate:"2026-07-13",finishDate:"2026-07-14"});
    expect(activities[0]).not.toHaveProperty("finishDate");
    expect(addWorkingDays("2026-07-08",1,calendar)).toBe("2026-07-10");
  });

  it("supports SS and prevents dependency cycles", () => {
    const scheduled=scheduleProject({activities:[{id:"a",duration:3,startDate:"2026-07-06"},{id:"b",duration:1}],dependencies:[{fromId:"a",toId:"b",type:"SS",lag:1}],calendars:[calendar],projectStart:"2026-07-06"});
    expect(scheduled.activities.find(item=>item.id==="b").startDate).toBe("2026-07-07");
    expect(scheduleProject({activities:[{id:"a",duration:1},{id:"b",duration:1}],dependencies:[{fromId:"a",toId:"b"},{fromId:"b",toId:"a"}],calendars:[calendar],projectStart:"2026-07-06"}).errors[0]).toMatch(/cíclica/);
  });

  it("reports an unachievable finish restriction instead of silently moving the deadline", () => {
    const scheduled=scheduleProject({activities:[{id:"a",duration:3,startDate:"2026-07-06"}],calendars:[calendar],constraints:[{activityId:"a",type:"finish_no_later_than",date:"2026-07-07"}]});
    expect(scheduled.errors).toEqual(expect.arrayContaining([expect.stringMatching(/término/)]));
  });

  it("returns a validation error for an unscheduled network instead of throwing", () => {
    expect(scheduleProject({activities:[{id:"a",duration:1}],calendars:[calendar]})).toMatchObject({activities:[],errors:[expect.stringMatching(/início/)]});
  });

  it("adapts legacy planning only as a read model", () => {
    const result=adaptLegacyPlanning({obraId:"obra-a",planos:[{obraId:"obra-a",tarefas:[{id:"t1",nome:"Alvenaria",inicio:"2026-07-01",fim:"2026-07-03",progresso:25}]}]});
    expect(result).toMatchObject({source:"planos.tarefas",activities:[{id:"t1",projectId:"obra-a",percentComplete:25}]});
  });

  it("calculates CPM, total/free float and identifies a near-critical path", () => {
    const result=calculateCriticalPath({activities:[{id:"a",duration:2},{id:"b",duration:3},{id:"c",duration:4}],dependencies:[{fromId:"a",toId:"b",type:"FS"},{fromId:"a",toId:"c",type:"FS"}]});
    expect(result.projectDuration).toBe(6);
    expect(result.criticalPath).toEqual(["a","c"]);
    expect(result.activities.find(item=>item.id==="b")).toMatchObject({totalFloat:1,freeFloat:1});
    expect(result.nearCriticalPath).toEqual(["b"]);
  });

  it("reports schedule health without changing activities", () => {
    const source=[{id:"a",duration:25,status:"in_progress",percentComplete:20},{id:"b",duration:1,status:"not_started"}];
    const health=assessScheduleHealth({activities:source,calendars:[calendar,{id:"crew"}]});
    expect(health.score).toBeLessThan(100);
    expect(health.findings.map(item=>item.code)).toContain("missing_progress_method");
    expect(source[0]).not.toHaveProperty("critical");
  });

  it("derives physical progress only from an explicit and auditable method", () => {
    expect(calculatePhysicalProgress({method:"quantity",plannedQuantity:20,actualQuantity:5})).toMatchObject({valid:true,percent:25});
    expect(calculatePhysicalProgress({method:"milestone",milestones:[{id:"m1",weight:40,completed:true},{id:"m2",weight:60}]})).toMatchObject({valid:true,percent:40});
    expect(calculatePhysicalProgress({method:"controlled_manual",manualPercent:35})).toMatchObject({valid:false});
    expect(calculatePhysicalProgress({method:"approved_measurement",measurementPercent:35,approved:true,measurementId:"med-1"})).toMatchObject({valid:true,percent:35});
  });

  it("blocks incomplete physical weights and budget over-allocation without changing inputs", () => {
    const activities=[{id:"a",wbsId:"wp",physicalWeight:60,physicalWeightSource:"physical",budgetLinks:[{budgetItemId:"i1",allocationPercentage:60}]},{id:"b",wbsId:"wp",physicalWeight:40,physicalWeightSource:"budget_value",budgetLinks:[{budgetItemId:"i1",allocationPercentage:50}]}];
    expect(validatePhysicalWeights({activities})).toMatchObject({ok:true,groups:[{wbsId:"wp",total:100}]});
    const budgetLinks=validateActivityBudgetLinks({activities,budgetItems:[{id:"i1",total:1000}]});
    expect(budgetLinks.ok).toBe(false);
    expect(budgetLinks.issues.map(item=>item.code)).toContain("overallocation_percentage");
    expect(activities[0].budgetLinks[0]).toEqual({budgetItemId:"i1",allocationPercentage:60});
  });

  it("builds a physical-only planned versus actual curve without using financial facts", () => {
    const result=buildPhysicalCurve({
      activities:[{id:"a",physicalWeight:100,startDate:"2026-07-06",finishDate:"2026-07-10"}],
      checkpoints:["2026-07-03","2026-07-08","2026-07-10"], calendar,
      actualByActivity:{a:{valid:true,percent:30}},
    });
    expect(result.points).toEqual(expect.arrayContaining([
      expect.objectContaining({date:"2026-07-03",plannedPercent:0,actualPercent:30}),
      expect.objectContaining({date:"2026-07-08",plannedPercent:66.66666666666666,actualPercent:30}),
      expect.objectContaining({date:"2026-07-10",plannedPercent:100,actualPercent:30}),
    ]));
  });

  it("does not treat a missing approved percentage as a zero-percent measurement", () => {
    const result=buildPhysicalCurve({activities:[{id:"a",physicalWeight:100,startDate:"2026-07-06",finishDate:"2026-07-10"}],checkpoints:["2026-07-10"],calendar,actualByActivity:{a:{valid:true}}});
    expect(result.points[0]).toMatchObject({actualPercent:null,actualWeight:0});
  });

  it("compares a legacy plan in read-only mode before a migration decision", () => {
    const data={planos:[{obraId:"obra-p",tarefas:[{id:"a",nome:"Fundação",inicio:"2026-07-06",fim:"2026-07-07",duracao:2},{id:"b",nome:"Estrutura",inicio:"2026-07-08",fim:"2026-07-08",duracao:1,depende:["a"]}]}]};
    const pilot=comparePlanningPilot({data,obraId:"obra-p",calendar});
    expect(pilot).toMatchObject({ready:true,equal:true,source:"planos.tarefas",differences:[{activityId:"a",equal:true},{activityId:"b",equal:true}]});
    expect(data.planos[0].tarefas[0]).not.toHaveProperty("finishDate");
  });
});
