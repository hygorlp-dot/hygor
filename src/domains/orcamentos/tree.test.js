import { describe, expect, it } from "vitest";
import { reorderBudgetStage, moveBudgetStage, budgetStageLevel, budgetSubtreeIds, calculateBudgetTree, flattenBudgetTree } from "./tree";

describe("árvore canônica do orçamento", () => {
  it("move 16 para 7 e renumera filhos sem alterar vínculos ou itens",()=>{
    const etapas=Array.from({length:16},(_,i)=>({id:`s${i+1}`}));
    etapas.splice(3,0,{id:'child',parentId:'s16'});
    const moved=reorderBudgetStage(etapas,'s16',7);
    expect(moved.filter(s=>!s.parentId).map(s=>s.id)).toEqual(['s1','s2','s3','s4','s5','s6','s16','s7','s8','s9','s10','s11','s12','s13','s14','s15']);
    const flat=flattenBudgetTree(calculateBudgetTree({etapas:moved,itens:[{id:'item',etapaId:'child',quantidade:2,precoUnit:5}]}).arvore);
    expect(flat.find(s=>s.id==='item').codigoItem).toBe('7.1.1');
    expect(reorderBudgetStage(moved,'s16',16)).toEqual(etapas);
    expect(()=>reorderBudgetStage(etapas,'s16',17)).toThrow();
  });
  const budget = { bdi:10, etapas:[{id:"a"},{id:"b",parentId:"a"}], itens:[
    { id:"1", etapaId:"a", quantidade:1, precoUnit:100 },
    { id:"2", etapaId:"b", quantidade:1, precoUnit:50, bdi:20 },
  ] };

  it("faz rollup sem duplicar custo e respeita BDI do item", () => {
    const result = calculateBudgetTree(budget);
    expect(result).toMatchObject({ custoDireto:150, total:170, qtdItens:2 });
    expect(result.arvore[0]).toMatchObject({ custoDireto:150, total:170 });
    expect(flattenBudgetTree(result.arvore).filter(row => row.tipo === "item")).toHaveLength(2);
  });

  it("resolve descendentes e nível protegendo ciclos", () => {
    expect(budgetSubtreeIds(budget.etapas, "a")).toEqual(["a", "b"]);
    expect(budgetStageLevel(budget.etapas, "b")).toBe(2);
    expect(budgetStageLevel([{id:"a",parentId:"b"},{id:"b",parentId:"a"}], "a")).toBe(2);
  });

  it("move toda a subárvore e renumera sem alterar IDs, itens ou total", () => {
    const etapas = [...budget.etapas, {id:'c',nome:'Cobertura'}];
    const moved = moveBudgetStage(etapas,'a','c',5);
    expect(budgetStageLevel(moved,'b')).toBe(3);
    expect(etapas[0].parentId).toBeUndefined();
    const result=calculateBudgetTree({...budget,etapas:moved});
    expect(result.total).toBe(170);
    expect(flattenBudgetTree(result.arvore).find(r=>r.id==='2').codigoItem).toBe('1.1.1.1');
    const promoted=moveBudgetStage(moved,'a','',5);
    expect(budgetStageLevel(promoted,'b')).toBe(2);
  });

  it("rejeita ciclos, pai ausente e profundidade excedida por descendente",()=>{
    expect(()=>moveBudgetStage(budget.etapas,'a','b',5)).toThrow();
    expect(()=>moveBudgetStage(budget.etapas,'a','a',5)).toThrow();
    expect(()=>moveBudgetStage(budget.etapas,'a','missing',5)).toThrow();
    const etapas=[...budget.etapas,{id:'c'},{id:'d',parentId:'c'}];
    expect(()=>moveBudgetStage(etapas,'a','d',3)).toThrow('subetapas');
  });
});

