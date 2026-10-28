import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("FIN 9.6 — wiring da imutabilidade de competência fechada",()=>{
  const api=readFileSync("api/data.js","utf8");

  const between=(startNeedle,endNeedle)=>{
    const start=api.indexOf(startNeedle);
    const end=api.indexOf(endNeedle,start+startNeedle.length);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return api.slice(start,end);
  };

  it("comando operacional valida a DRE fechada antes do save",()=>{
    const block=between(
      "const executarComandoOperacionalBloqueado=",
      "// Fase 1.5 reduzida",
    );
    expect(block).toContain("protectClosedDre");
    expect(block).toContain("if(protectClosedDre)");
    expect(block).toContain("validarImutabilidadeDreFechado");
    expect(block).toContain("before:current,after:executed.data");
    expect(block.indexOf("validarImutabilidadeDreFechado"))
      .toBeLessThan(block.indexOf('kind:"save",data:executed.data'));
    expect(api).toContain('code:"CLOSED_DRE_IMMUTABLE"');
    expect(api).not.toContain("carregarDreCanonicoNaTransacao");
  });

  it("conciliação preserva replay idempotente e bloqueia movimento de competência fechada",()=>{
    const block=between(
      'if(action==="reconciliation-command")',
      '// Ponto é persistido por fato',
    );
    expect(block).toContain("validarConciliacaoEmCompetenciaAberta");
    expect(block).toContain("validarImutabilidadeDreFechado");
    expect(block).toContain("CLOSED_DRE_TRANSACTION_REQUIRED");
    expect(block).toContain("closedCompetence");

    const replay=block.indexOf("if(already)return {idempotent:true");
    const periodGuard=block.indexOf("validarConciliacaoEmCompetenciaAberta");
    expect(replay).toBeGreaterThan(-1);
    expect(periodGuard).toBeGreaterThan(replay);

    const dreGuard=block.indexOf("validarImutabilidadeDreFechado");
    const save=block.indexOf('kind:"save",data:executed.data');
    expect(dreGuard).toBeGreaterThan(-1);
    expect(save).toBeGreaterThan(dreGuard);
  });

  it("fallback operacional sem PostgreSQL direto falha fechado após o primeiro fechamento",()=>{
    const block=between(
      'if(action==="operational-command")',
      '// FIN-002: fotografia em sombra',
    );
    expect(block).toContain("FINANCIAL_OPERATIONAL_COMMANDS.has(command.type)");
    expect(block).toContain("closedCompanyDreEntries(atual).length");
    expect(block).toContain("CLOSED_DRE_TRANSACTION_REQUIRED");
    expect(block.indexOf("CLOSED_DRE_TRANSACTION_REQUIRED"))
      .toBeLessThan(block.indexOf("const domainAlvo=rowForOperationalCommand"));
  });

  it("save-sections transacional valida a fotografia mesclada antes do commit",()=>{
    const block=between(
      'if (action === "save-sections")',
      '// ── 4b. Salvar blob completo',
    );
    expect(block).toContain("mutate:async({payload:current,updatedAt:lockedUpdatedAt,transaction})");
    expect(block).toContain("protegeDreFechado=sincronizaFinanceiro");
    expect(block).not.toContain('protegeDreFechado=sincronizaFinanceiro||chaves.includes("obras")');
    expect(block).toContain("if(protegeDreFechado)");
    expect(block).toContain("validarImutabilidadeDreFechado");
    expect(block).toContain("before:current,after:value");
    expect(block).toContain("closedDreChanges");
    expect(block).not.toContain("canonicalIssues");
  });

  it("sem conexão transacional, save-sections falha fechado se já houver competência encerrada",()=>{
    const block=between(
      'if (action === "save-sections")',
      '// ── 4b. Salvar blob completo',
    );
    expect(block).toContain("protegeDreFechado&&closedCompanyDreEntries(atual).length");
    expect(block).toContain("CLOSED_DRE_TRANSACTION_REQUIRED");
  });

  it("save completo de compatibilidade deixa de existir depois do primeiro fechamento",()=>{
    const block=between(
      'if (action === "save")',
      '// ── 5.',
    );
    expect(block).toContain("closedCompanyDreEntries(atual).length");
    expect(block).toContain("CLOSED_DRE_GRANULAR_REQUIRED");
    const guard=block.indexOf("CLOSED_DRE_GRANULAR_REQUIRED");
    const firstSave=block.indexOf("salvarVersao");
    expect(guard).toBeGreaterThan(-1);
    expect(firstSave).toBeGreaterThan(guard);
  });

  it("edição de ponto em competência fechada é recusada antes de qualquer update",()=>{
    const block=between(
      "const executarComandoPontoBloqueado=",
      "// Confere o PIN",
    );
    expect(block).toContain("validarPontoEmCompetenciaAberta(current,command)");
    expect(block).toContain("CLOSED_DRE_IMMUTABLE");
    expect(block.indexOf("validarPontoEmCompetenciaAberta"))
      .toBeLessThan(block.indexOf("update company_app_data"));
  });

  it("arquivar e restaurar quinzena provam invariância antes da RPC",()=>{
    const archive=between(
      'if (action === "archive-quinzena")',
      'if (action === "list-quinzena-archives")',
    );
    expect(api).toContain("validateClosedRepresentationPreservation");
    expect(archive).toContain("validarImutabilidadeDreFechadoLeitura");
    expect(archive).toContain("before:atual,after:novoPrincipal");
    expect(archive.indexOf("validarImutabilidadeDreFechadoLeitura"))
      .toBeLessThan(archive.indexOf("executarArquivoPontoTransacional"));

    const restore=between(
      'if (action === "restore-quinzena")',
      'return res.status(400).json({ error: "Ação desconhecida." });',
    );
    expect(restore).toContain("validarImutabilidadeDreFechadoLeitura");
    expect(restore).toContain("before:atual,after:novoPrincipal");
    expect(restore.indexOf("validarImutabilidadeDreFechadoLeitura"))
      .toBeLessThan(restore.indexOf("executarArquivoPontoTransacional"));
  });

  it("ponto preserva replay idempotente e bloqueia nova alteração histórica nos dois caminhos",()=>{
    const dedicated=between(
      "const executarComandoPontoBloqueado=",
      "// Confere o PIN",
    );
    expect(dedicated.indexOf("if(applied.idempotent)"))
      .toBeLessThan(dedicated.indexOf("validarPontoEmCompetenciaAberta(current,command)"));

    const block=between(
      "// Ponto é persistido por fato",
      "// Comandos operacionais usam versão",
    );
    expect(block).toContain("validarPontoEmCompetenciaAberta(base.payload,command)");
    expect(block).toContain("closedCompetence");
    expect(block.indexOf("if(applied.idempotent)"))
      .toBeLessThan(block.indexOf("validarPontoEmCompetenciaAberta(base.payload,command)"));
  });
});
