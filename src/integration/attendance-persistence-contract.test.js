import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";

const api=readFileSync(resolve(process.cwd(),"api/data.js"),"utf8");
const client=readFileSync(resolve(process.cwd(),"src/api.js"),"utf8");
const migration=readFileSync(resolve(process.cwd(),"migrations/006_attendance_archive_transaction.up.sql"),"utf8");
const rollback=readFileSync(resolve(process.cwd(),"migrations/006_attendance_archive_transaction.down.sql"),"utf8");

describe("contrato integrado de persistência do ponto",()=>{
  it("expõe comandos granulares e recusa a substituição das seções autoritativas",()=>{
    ["attendance-upsert","attendance-batch-upsert","attendance-daily-check","attendance-lock",
      "attendance-unlock-request","attendance-unlock-approve","attendance-unlock-reject"]
      .forEach(action=>expect(readFileSync(resolve(process.cwd(),"server/attendance-command.js"),"utf8")).toContain(action));
    expect(api).toContain("ATTENDANCE_GRANULAR_REQUIRED");
    expect(client).toContain('"attendance","attendanceLocks","unlockRequests","dailyCheckDate"');
    expect(api).toContain("result:applied.result");
    expect(api).not.toContain("result:applied.result,data:");
  });

  it("projeta respostas de merge antes de devolvê-las",()=>{
    expect(api).toContain("data:combinado?projectDataForUser(valor,usuario):undefined");
    expect(api).toContain("?projectDataForUser(valor,usuario):undefined");
  });

  it("arquiva e restaura principal, arquivo e auditoria em uma transação",()=>{
    expect(migration).toContain("create or replace function public.attendance_archive_transaction");
    expect(migration).toContain("create or replace function public.attendance_restore_transaction");
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into company_app_data");
    expect(migration).toContain("delete from company_app_data");
    expect(migration).toContain("insert into audit_events");
    expect(migration).toContain("coalesce(p_actor_role,'') not in ('admin','rh')");
    expect(migration).toContain("coalesce(p_actor_role,'')<>'admin'");
    expect(migration).toContain("to service_role");
    expect(rollback).toContain("drop function if exists public.attendance_archive_transaction");
    expect(rollback).toContain("drop function if exists public.attendance_restore_transaction");
    expect(api).toContain("executarArquivoPontoTransacional");
    const archiveRoute=api.slice(
      api.indexOf('action === "archive-quinzena"'),
      api.indexOf('action === "list-quinzena-archives"'),
    );
    expect(archiveRoute).not.toContain(".insert(");
    expect(archiveRoute).not.toContain(".update(");
  });

  it("possui diagnóstico específico para ambiente e RPCs ausentes",()=>{
    expect(api).toContain("PERSISTENCE_ENV_MISSING");
    expect(api).toContain("AUDIT_RPC_MIGRATION_REQUIRED");
    expect(api).toContain("ATTENDANCE_ARCHIVE_RPC_UNAVAILABLE");
  });

  it("achado de 21/08/2026: sincroniza a linha de Ponto após arquivar/restaurar, quando ela já existe",()=>{
    expect(api).toContain("const sincronizarPontoAposArquivo=async");
    const archiveRoute=api.slice(
      api.indexOf('action === "archive-quinzena"'),
      api.indexOf('action === "list-quinzena-archives"'),
    );
    expect(archiveRoute).toContain("await sincronizarPontoAposArquivo({rowVersions,novoPrincipal,actor:usuario,quinzenaId,action:\"attendance_archive_ponto_sync\"})");
    const restoreRoute=api.slice(api.indexOf('action === "restore-quinzena"'));
    expect(restoreRoute).toContain("await sincronizarPontoAposArquivo({rowVersions,novoPrincipal,actor:usuario,quinzenaId,action:\"attendance_restore_ponto_sync\"})");
  });
});
