import {describe,expect,it} from "vitest";
import {
  closedCompanyDreBySourceId,
  closedCompanyDreEntries,
  closedCompanyDreFor,
  overlayClosedCompanyDreYear,
} from "./financial-closing-read.js";

const data={
  fechamentosFinanceiros:[
    {
      id:"f-jul",competencia:"2026-07",status:"fechado",
      fechadoEm:"2026-08-01T09:00:00.000Z",fechadoPorId:"admin-1",
      snapshot:{canonicalDre:{
        sourceId:"2026-07:mes:company_dre",
        canonicalRevision:"rev-jul",sourceRevision:"src-jul",
        projectionVersion:"v1",payload:{ym:"2026-07",lucroLiquido:700},
      }},
    },
    {
      id:"f-ago-aberto",competencia:"2026-08",status:"aberto",
      snapshot:{canonicalDre:{payload:{ym:"2026-08",lucroLiquido:999}}},
    },
    {
      id:"f-set-sem-dre",competencia:"2026-09",status:"fechado",snapshot:{},
    },
  ],
};

describe("FIN 9.6 — leitura da DRE empresarial fechada",()=>{
  it("indexa apenas competências fechadas com snapshot canônico",()=>{
    const entries=closedCompanyDreEntries(data);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      competencia:"2026-07",closingId:"f-jul",canonicalRevision:"rev-jul",
      payload:{lucroLiquido:700},
    });
    expect(closedCompanyDreFor(data,2026,6)?.payload.lucroLiquido).toBe(700);
    expect(closedCompanyDreFor(data,2026,7)).toBeNull();
  });

  it("dados legados duplicados usam deterministicamente o fechamento mais recente",()=>{
    const duplicated={
      fechamentosFinanceiros:[
        ...data.fechamentosFinanceiros,
        {
          id:"f-jul-mais-novo",competencia:"2026-07",status:"fechado",
          fechadoEm:"2026-08-02T09:00:00.000Z",fechadoPorId:"admin-2",
          snapshot:{canonicalDre:{
            sourceId:"2026-07:mes:company_dre",
            canonicalRevision:"rev-jul-2",sourceRevision:"src-jul-2",
            projectionVersion:"v2",payload:{ym:"2026-07",lucroLiquido:701},
          }},
        },
      ],
    };
    const entries=closedCompanyDreEntries(duplicated);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      closingId:"f-jul-mais-novo",
      canonicalRevision:"rev-jul-2",
      payload:{lucroLiquido:701},
    });
  });

  it("resolve a fotografia pelo sourceId materializado",()=>{
    const map=closedCompanyDreBySourceId(data);
    expect(map.get("2026-07:mes:company_dre")).toMatchObject({
      competencia:"2026-07",payload:{lucroLiquido:700},
    });
  });

  it("sobrepõe somente o mês fechado no DRE anual",()=>{
    const live=Array.from({length:12},(_,month)=>({ym:`2026-${String(month+1).padStart(2,"0")}`,lucroLiquido:month}));
    const months=overlayClosedCompanyDreYear(data,2026,live);
    expect(months[6]).toEqual({ym:"2026-07",lucroLiquido:700});
    expect(months[7]).toEqual(live[7]);
    expect(months[8]).toEqual(live[8]);
  });

  it("não mistura fechamento de outro ano",()=>{
    const months=overlayClosedCompanyDreYear(data,2025,Array(12).fill(null));
    expect(months.every(item=>item===null)).toBe(true);
  });
});
