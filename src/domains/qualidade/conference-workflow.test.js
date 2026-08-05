import { describe, expect, it } from "vitest";
import {
  conferenceCompletionCheck,
  conferenceProgress,
  conferenceQualityScore,
  filterConferenceFindings,
} from "./conference-workflow.js";

const finding = overrides => ({ id:"p1", status:"aberta", impacto:"medio", descricao:"Fissura", prazo:"2026-08-10", ...overrides });

describe("fluxo auditável da conferência técnica", () => {
  it("não trata vistoria vazia como concluída", () => {
    expect(conferenceProgress({ pendencias:[] })).toBe(0);
    expect(conferenceQualityScore({ pendencias:[] })).toBeNull();
    expect(conferenceCompletionCheck({ pendencias:[] }, { scopeReviewed:true, notes:"curto" }).ok).toBe(false);
  });

  it("aceita conclusão sem achados somente com declaração técnica", () => {
    const declaration={ scopeReviewed:true, notes:"Estrutura, instalações e acabamentos inspecionados." };
    expect(conferenceCompletionCheck({ pendencias:[] }, declaration).ok).toBe(true);
    expect(conferenceProgress({ pendencias:[], inspectionDeclaration:{ confirmedAt:"2026-08-05" } })).toBe(100);
    expect(conferenceQualityScore({ pendencias:[], inspectionDeclaration:{ confirmedAt:"2026-08-05" } })).toBe(10);
  });

  it("bloqueia conclusão enquanto houver correção aberta", () => {
    const result=conferenceCompletionCheck({ pendencias:[finding()] }, { scopeReviewed:true });
    expect(result.reason).toMatch(/valide todas/i);
  });

  it("calcula nota pela criticidade e reincidência, não por impressão inicial", () => {
    const conference={ pendencias:[finding({impacto:"critico",status:"resolvida"}),finding({id:"p2",status:"resolvida",validacoes:[{resultado:"nao_conforme"}]})] };
    expect(conferenceQualityScore(conference)).toBe(9.8);
  });

  it("filtra e prioriza itens críticos e vencidos", () => {
    const conference={ pendencias:[finding({id:"baixo",impacto:"baixo",prazo:"2026-08-20"}),finding({id:"critico",impacto:"critico",prazo:"2026-08-01",descricao:"Falha estrutural"})] };
    expect(filterConferenceFindings(conference,{},"2026-08-05")[0].id).toBe("critico");
    expect(filterConferenceFindings(conference,{onlyOverdue:true},"2026-08-05").map(item=>item.id)).toEqual(["critico"]);
    expect(filterConferenceFindings(conference,{query:"estrutural"},"2026-08-05")).toHaveLength(1);
  });
});
