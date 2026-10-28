import {describe,expect,it} from "vitest";
import {
  monthlyClosingPeriodFromCommand,
  prepareMonthlyFinancialClosing,
  previewMonthlyFinancialClosing,
} from "./financial-closing.js";

const command=(key="close-2026-07-abcdef")=>({
  type:"CLOSE_ACCOUNTING_PERIOD",
  idempotencyKey:key,
  payload:{startsOn:"2026-07-01",endsOn:"2026-07-31"},
});

describe("FIN 9.6 — fechamento mensal auditável",()=>{
  it("aceita somente o mês civil completo",()=>{
    expect(monthlyClosingPeriodFromCommand(command())).toEqual({
      ok:true,competencia:"2026-07",startsOn:"2026-07-01",endsOn:"2026-07-31",
    });
    expect(monthlyClosingPeriodFromCommand({
      ...command(),payload:{startsOn:"2026-07-02",endsOn:"2026-07-31"},
    })).toMatchObject({ok:false});
    expect(monthlyClosingPeriodFromCommand({
      ...command(),payload:{startsOn:"2026-07-01",endsOn:"2026-07-30"},
    })).toMatchObject({ok:false});
    expect(monthlyClosingPeriodFromCommand({
      ...command(),payload:{startsOn:"2028-02-01",endsOn:"2028-02-29"},
    })).toMatchObject({ok:true,competencia:"2028-02"});
  });

  it("congela a conferência incluindo fatos canônicos suplementares",()=>{
    const data={
      obras:[{id:"o1"}],
      medicoes:[{
        id:"m1",obraId:"o1",competencia:"2026-07",valorPrevisto:1000,
        dataEmissao:"2026-07-05",
      }],
      outrasDesp:[{
        id:"d1",obraId:"o1",competencia:"2026-07",valor:200,data:"2026-07-10",
      }],
    };
    const supplementalEvents=[{
      id:"canonical_title:n1:cost",effect:"cost",amountCents:5000,
      date:"2026-07-12",competence:"2026-07",obraId:"o1",category:"outros",
      description:"Custo nativo",sourceType:"canonical_title",sourceId:"n1",
    }];

    const canonicalDreSnapshot={
      sourceId:"2026-07:mes:company_dre",
      canonicalRevision:"rev-canonical",
      sourceRevision:"rev-data",
      projectionVersion:"v-test",
      payload:{ym:"2026-07",laborTotal:300,custoLocacoes:50,lucroLiquido:450},
    };
    const result=prepareMonthlyFinancialClosing({
      data,command:command(),actor:{id:"admin-1",nome:"Administrador"},
      supplementalEvents,canonicalDreSnapshot,requireCanonicalDre:true,
      now:"2026-08-01T09:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(result.idempotent).toBe(false);
    expect(result.closing).toMatchObject({
      id:"fechamento-2026-07",
      competencia:"2026-07",
      status:"fechado",
      fechadoPorId:"admin-1",
      idempotencyKey:"close-2026-07-abcdef",
      canonicalCommand:"CLOSE_ACCOUNTING_PERIOD",
      snapshot:{
        revenueCents:100000,
        costCents:25000,
        resultCents:75000,
      },
    });
    expect(result.closing.snapshot.eventIds).toContain("canonical_title:n1:cost");
    expect(result.closing.snapshot.canonicalDre).toMatchObject({
      sourceId:"2026-07:mes:company_dre",
      canonicalRevision:"rev-canonical",
      payload:{laborTotal:300,custoLocacoes:50,lucroLiquido:450},
    });
    expect(result.closing.conference.checks.every(check=>check.ok)).toBe(true);
    expect(result.data.fechamentosFinanceiros).toHaveLength(1);
  });

  it("caminho autoritativo recusa fechamento sem projeção DRE canônica",()=>{
    const result=prepareMonthlyFinancialClosing({
      data:{},command:command(),actor:{id:"admin"},requireCanonicalDre:true,
    });
    expect(result).toMatchObject({ok:false});
    expect(result.error).toMatch(/projeção canônica do DRE é obrigatória/i);
  });

  it("prévia usa a mesma conferência sem mutar o dataset",()=>{
    const data={
      medicoes:[{
        id:"m1",obraId:"o1",competencia:"2026-07",valorPrevisto:500,
        dataEmissao:"2026-07-05",
      }],
      fechamentosFinanceiros:[],
    };
    const before=structuredClone(data);
    const preview=previewMonthlyFinancialClosing({
      data,command:command(),actor:{id:"admin"},
      canonicalDreSnapshot:{
        sourceId:"2026-07:mes:company_dre",
        canonicalRevision:"rev-1",sourceRevision:"src-1",
        projectionVersion:"v1",payload:{lucroLiquido:500},
      },
      requireCanonicalDre:true,
      now:"2026-08-01T08:00:00.000Z",
    });

    expect(preview).toMatchObject({
      ok:true,alreadyClosed:false,
      period:{competencia:"2026-07"},
      closing:{
        status:"fechado",
        snapshot:{revenueCents:50000,canonicalDre:{canonicalRevision:"rev-1"}},
      },
    });
    expect(data).toEqual(before);
    expect(data.fechamentosFinanceiros).toHaveLength(0);
  });

  it("prévia de competência já fechada devolve o registro existente sem recriar",()=>{
    const existing={
      id:"fechamento-2026-07",competencia:"2026-07",status:"fechado",
      fechadoEm:"2026-08-01T07:00:00.000Z",snapshot:{resultCents:123},
      conference:{checks:[{code:"ok",ok:true}]},
    };
    const preview=previewMonthlyFinancialClosing({
      data:{fechamentosFinanceiros:[existing]},
      command:command(),actor:{id:"admin"},requireCanonicalDre:true,
    });
    expect(preview).toMatchObject({ok:true,alreadyClosed:true,closing:existing});
  });

  it("mesma chave é idempotente e chave diferente não duplica a competência",()=>{
    const first=prepareMonthlyFinancialClosing({
      data:{},command:command(),actor:{id:"admin"},
      now:"2026-08-01T09:00:00.000Z",
    });
    expect(first.ok).toBe(true);

    const replay=prepareMonthlyFinancialClosing({
      data:first.data,command:command(),actor:{id:"admin"},
      now:"2026-08-01T10:00:00.000Z",
    });
    expect(replay).toMatchObject({ok:true,idempotent:true});
    expect(replay.data.fechamentosFinanceiros).toHaveLength(1);
    expect(replay.closing.fechadoEm).toBe("2026-08-01T09:00:00.000Z");

    const duplicate=prepareMonthlyFinancialClosing({
      data:first.data,command:command("close-2026-07-other-key"),actor:{id:"admin"},
    });
    expect(duplicate).toMatchObject({ok:false});
    expect(duplicate.error).toMatch(/já possui fechamento/i);
  });

  it("não prepara fechamento quando o razão derivado possui erro de conferência",()=>{
    const data={
      medicoes:[{
        id:"m1",obraId:"o1",competencia:"2026-07",valorPrevisto:100,
        recebimentos:[
          {id:"r1",valor:100,data:"2026-07-10"},
          {id:"r2",valor:10,data:"2026-07-11"},
        ],
      }],
    };
    const result=prepareMonthlyFinancialClosing({data,command:command(),actor:{id:"admin"}});
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/pendências financeiras/i);
    expect(result.conference.ok).toBe(false);
  });
});
