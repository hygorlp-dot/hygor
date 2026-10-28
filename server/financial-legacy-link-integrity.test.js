import {describe,expect,it,vi} from "vitest";
import {findStaleFinancialLegacyLinks} from "./financial-legacy-link-integrity.js";

describe("FIN 9.6 — integridade dos hashes legados",()=>{
  it("usa o mesmo md5 do jsonb gravado pela migration e normaliza o resultado",async()=>{
    const facts=[{legacyType:"pedido",legacyId:"p1",titleAmount:100}];
    const sql=vi.fn(async(strings,...values)=>{
      const statement=strings.join("?");
      expect(statement).toContain("md5(incoming.fact::text)");
      expect(statement).toContain("link.record_hash is distinct from");
      expect(values[0]).toEqual(facts);
      expect(values[1]).toBe("arcd");
      return [{
        legacy_type:"pedido",legacy_id:"p1",
        stored_hash:"antigo",current_hash:"atual",
      }];
    });
    sql.json=value=>value;

    await expect(findStaleFinancialLegacyLinks({
      sql,companyId:"arcd",facts,
    })).resolves.toEqual([{
      legacyType:"pedido",legacyId:"p1",
      storedHash:"antigo",currentHash:"atual",
    }]);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("exige conexão PostgreSQL para a prova exata do hash",async()=>{
    await expect(findStaleFinancialLegacyLinks({
      sql:null,companyId:"arcd",facts:[],
    })).rejects.toThrow(/PostgreSQL obrigatória/i);
  });
});
