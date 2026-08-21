import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { legacyFinancialFactsChanged, LEGACY_FINANCIAL_FACT_FIELDS } from "../api/data.js";

const api=readFileSync(resolve(process.cwd(),"api/data.js"),"utf8");

describe("serialização sistêmica das mutações da empresa",()=>{
  it("bloqueia e relê a linha antes de calcular qualquer mutação",()=>{
    const start=api.indexOf("const executarMutacaoEmpresaBloqueada=");
    const end=api.indexOf("// Confere o PIN",start);
    const implementation=api.slice(start,end);
    expect(start).toBeGreaterThan(0);
    expect(implementation).toContain("for update");
    expect(implementation.indexOf("for update")).toBeLessThan(
      implementation.indexOf("await mutate("),
    );
    expect(api).toContain("financial_save_with_sync(");
    expect(api).toContain("insert into audit_events(");
  });

  it("mantém a precisão integral do updated_at dentro do PostgreSQL",()=>{
    const start=api.indexOf("const gravarMutacaoNaTransacao=");
    const end=api.indexOf("// Todos os escritores",start);
    const implementation=api.slice(start,end);
    expect(implementation).toContain("select updated_at");
    expect(implementation).toContain("where company_id=${COMPANY} and key=${key}");
    expect(implementation).not.toContain("${locked.updated_at}");
  });

  it("desvia todos os comandos operacionais para a fila do banco antes do fallback CAS",()=>{
    const route=api.slice(api.indexOf('if(action==="operational-command")'));
    expect(route.indexOf("if(process.env.POSTGRES_URL_NON_POOLING)")).toBeLessThan(
      route.indexOf("const persistir=async"),
    );
    expect(route).toContain("executarComandoOperacionalBloqueado({");
    expect(route).toContain("projectChangedSectionsPatch(");
    expect(route).toContain("outcome.basePayload,outcome.data");
  });

  it("aplica a mesma serialização ao ponto, conciliação e cadastros legados",()=>{
    const attendance=api.slice(api.indexOf("if(ATTENDANCE_COMMANDS.has(action))"));
    const reconciliation=api.slice(api.indexOf('if(action==="reconciliation-command")'));
    const sections=api.slice(api.indexOf('if (action === "save-sections")'));
    expect(attendance).toContain("executarMutacaoEmpresaBloqueada({");
    expect(reconciliation).toContain("executarMutacaoEmpresaBloqueada({");
    expect(sections).toContain("executarMutacaoEmpresaBloqueada({");
  });

  it("gravarMutacaoNaTransacao nunca pede a reconstrução do DRE (o self-heal da leitura já cobre)",()=>{
    const start=api.indexOf("const gravarMutacaoNaTransacao=");
    const end=api.indexOf("// Todos os escritores",start);
    const implementation=api.slice(start,end);
    expect(implementation).toContain("includeDreSnapshots:false");
    expect((implementation.match(/financial_save_with_sync/g)||[]).length).toBe(1);
  });

  it("executarMutacaoEmpresaBloqueada passa o valor recém-travado (não a leitura sem lock) como basePayload",()=>{
    const start=api.indexOf("const executarMutacaoEmpresaBloqueada=");
    const end=api.indexOf("// Uma alteração real",start);
    const implementation=api.slice(start,end);
    expect(implementation).toContain("basePayload:freshSlice");
  });

  it("achado de 21/08/2026: executarMutacaoEmpresaBloqueada roteia por domínio (não trava mais sempre KEY)",()=>{
    const start=api.indexOf("const executarMutacaoEmpresaBloqueada=");
    const end=api.indexOf("// Uma alteração real",start);
    const implementation=api.slice(start,end);
    expect(implementation).toContain("domain=DOMAIN_ROW.CORE");
    expect(implementation).toContain("linhaEfetivaParaEscrita(domain,linha.rowVersions)");
    expect(implementation).toContain("keyForDomain(effectiveDomain)");
    expect(implementation).toContain("SPLITTABLE_DOMAINS.map(");
  });

  it("executarComandoOperacionalBloqueado e o handler de ponto passam o domínio correto",()=>{
    const opCommand=api.slice(api.indexOf("const executarComandoOperacionalBloqueado="));
    expect(opCommand).toContain("domain:rowForOperationalCommand(command.type)");
    const attendance=api.slice(api.indexOf("if(ATTENDANCE_COMMANDS.has(action))"));
    expect(attendance).toContain("domain:rowForAttendanceCommand()");
  });
});

describe("legacyFinancialFactsChanged - achado de 21/08/2026 (bloat de sincronização financeira)",()=>{
  it("é falso quando nenhum dos 7 campos legados muda (ex.: EMPLOYEE_SAVED alterando só dados cadastrais)",()=>{
    const before={employees:[{id:"e1",nome:"Ana"}],config:{companyName:"ARCD"}};
    const after={employees:[{id:"e1",nome:"Ana Paula"}],config:{companyName:"ARCD"}};
    expect(legacyFinancialFactsChanged(before,after)).toBe(false);
  });

  it("é verdadeiro quando algum dos 7 campos muda (ex.: novo pagamento em pagsTerceiros)",()=>{
    const before={pagsTerceiros:[]};
    const after={pagsTerceiros:[{id:"t1",amount:100}]};
    expect(legacyFinancialFactsChanged(before,after)).toBe(true);
  });

  it("compara os 7 campos individualmente - mudar transacoes não mascara nem é mascarado por medicoes",()=>{
    const before={medicoes:[{id:"m1",valorPrevisto:100}],transacoes:[]};
    const afterSoTransacoes={medicoes:[{id:"m1",valorPrevisto:100}],transacoes:[{id:"tr1"}]};
    const afterSoMedicoes={medicoes:[{id:"m1",valorPrevisto:200}],transacoes:[]};
    expect(legacyFinancialFactsChanged(before,afterSoTransacoes)).toBe(true);
    expect(legacyFinancialFactsChanged(before,afterSoMedicoes)).toBe(true);
    expect(legacyFinancialFactsChanged(before,before)).toBe(false);
  });

  it("não inclui employees/config/obras/equipamentos - mudar dailyRate de um funcionário não deve pular a auditoria simples silenciosamente, mas depende do self-heal do DRE na leitura (financial-dre-report), não desta lista",()=>{
    // Documenta a decisão deliberada (ver server/dre-projection.js e
    // labor-cost-engine.js): dreSnapshots depende de employees/config/obras/
    // equipamentos/rescisoes, nenhum destes protegido por esta lista. Por
    // isso o caminho de escrita NUNCA reconstrói dreSnapshots (sempre
    // includeDreSnapshots:false) - o self-heal por leitura é quem garante a
    // correção, independente do que esta lista cobre.
    expect(LEGACY_FINANCIAL_FACT_FIELDS).not.toContain("employees");
    expect(LEGACY_FINANCIAL_FACT_FIELDS).not.toContain("config");
    expect(LEGACY_FINANCIAL_FACT_FIELDS).not.toContain("obras");
    expect(LEGACY_FINANCIAL_FACT_FIELDS).not.toContain("equipamentos");
    const before={employees:[{id:"e1",dailyRate:100}]};
    const after={employees:[{id:"e1",dailyRate:180}]};
    expect(legacyFinancialFactsChanged(before,after)).toBe(false);
  });
});
