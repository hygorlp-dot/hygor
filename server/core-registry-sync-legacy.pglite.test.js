// @vitest-environment node
//
// Teste de execução real (não apenas asserções de texto) para a RPC
// `core_registry_sync_legacy` criada em migrations/007_create_core_registry_projection.up.sql.
//
// Usa @electric-sql/pglite (Postgres compilado para WASM, roda em processo,
// sem Docker) para de fato aplicar as migrações e chamar a função PL/pgSQL,
// permitindo detectar bugs de SQL (coluna errada, lógica de loop invertida,
// alvo de ON CONFLICT incorreto etc.) que os testes existentes — que só
// verificam se o texto do .sql "contains" certos trechos — não conseguem
// pegar.
//
// A infixação ".pglite." no nome do arquivo existe para permitir filtrar
// facilmente esta (mais lenta) classe de testes no futuro, ex.:
//   npx vitest run server/core-registry-sync-legacy.pglite.test.js
//
// Notas de ambiente:
// - O suíte de testes do projeto roda em jsdom por padrão (vite.config.mjs).
//   O diretório `// @vitest-environment node` acima força este arquivo a
//   rodar em ambiente Node puro, que é onde o WASM do pglite roda sem
//   atrito. Não foi necessário nenhum --pool=forks adicional neste ambiente
//   Windows; se algum dia o carregamento do WASM falhar em CI, tente rodar
//   este arquivo com `npx vitest run --pool=forks server/core-registry-sync-legacy.pglite.test.js`.
// - pglite não tem autenticação multi-role via JWT como o PostgREST do
//   Supabase, então não dá para testar RLS "de ponta a ponta" por aqui. Mas
//   ele executa DDL de grant/revoke e roles reais, o que basta para validar
//   a lógica de upsert/arquivamento/constraints das funções — o gap real de
//   hoje, já que essas RPCs nunca chegam a rodar nos testes atuais.
// - As migrações da Supabase pressupõem os papéis padrão dela (anon,
//   authenticated, service_role) e a tabela company_app_data (criada fora
//   da pasta migrations/, historicamente direto no Supabase). Este arquivo
//   cria um estado mínimo equivalente antes de aplicar as migrações reais,
//   sem alterar nenhum arquivo em migrations/.

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");

const AUDIT_EVENTS_MIGRATION_SQL = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "20260725_append_only_audit.sql"),
  "utf8",
);
const CORE_REGISTRY_MIGRATION_SQL = fs.readFileSync(
  path.join(MIGRATIONS_DIR, "007_create_core_registry_projection.up.sql"),
  "utf8",
);

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

let db;

beforeEach(async () => {
  db = new PGlite({ extensions: { pgcrypto } });

  // Papéis padrão do Supabase, referenciados pelos GRANT/REVOKE das
  // migrações reais (anon/authenticated/service_role não existem por
  // padrão em um Postgres "cru").
  await db.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role;
      end if;
    end $$;
  `);

  // company_app_data é criada fora de migrations/ (direto no Supabase).
  // A migração de audit_events referencia seu %rowtype em
  // company_save_with_audit, então precisamos de um stub mínimo para que
  // o arquivo real compile sem alterações.
  await db.exec(`
    create table if not exists public.company_app_data (
      company_id text not null,
      key text not null,
      value jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now(),
      updated_by text,
      primary key (company_id, key)
    );
  `);

  // audit_events precisa existir antes da migração 007, cujo
  // core_registry_sync_legacy insere nela ao final.
  await db.exec(AUDIT_EVENTS_MIGRATION_SQL);
  await db.exec(CORE_REGISTRY_MIGRATION_SQL);
});

afterEach(async () => {
  await db.close();
});

function buildSnapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    complete: true,
    projects: [],
    employees: [],
    employeeAssignments: [],
    employeeIdentifiers: [],
    suppliers: [],
    thirdPartyProfiles: [],
    thirdPartyContracts: [],
    ...overrides,
  };
}

async function syncLegacy(companyId, actorId, snapshot) {
  return db.query(
    "select core_registry_sync_legacy($1, $2, $3::jsonb) as result",
    [companyId, actorId, JSON.stringify(snapshot)],
  );
}

describe("core_registry_sync_legacy (execução real via pglite)", () => {
  it("grava projetos e funcionários reais com os valores corretos", async () => {
    const snapshot = buildSnapshot({
      projects: [
        {
          id: "obra-1",
          name: "Residencial Alfa",
          code: "RA-01",
          status: "active",
          active: true,
          engineerId: "eng-1",
          sourceVersion: 3,
          sourceHash: HASH_A,
          payload: { foo: "bar" },
        },
      ],
      employees: [
        {
          id: "func-1",
          name: "João da Silva",
          roleTitle: "Pedreiro",
          workArea: "campo",
          active: true,
          sourceHash: HASH_B,
        },
      ],
    });

    const { rows } = await syncLegacy("empresa-1", "ator-1", snapshot);
    expect(rows[0].result).toMatchObject({ projects: 1, employees: 1 });

    const project = (
      await db.query(
        "select id, name, code, status, active, engineer_id, source_version, payload from core_projects where company_id = $1 and id = $2",
        ["empresa-1", "obra-1"],
      )
    ).rows[0];
    expect(project).toMatchObject({
      id: "obra-1",
      name: "Residencial Alfa",
      code: "RA-01",
      status: "active",
      active: true,
      engineer_id: "eng-1",
      source_version: 3,
      payload: { foo: "bar" },
    });

    const employee = (
      await db.query(
        "select id, name, role_title, work_area, active from core_employees where company_id = $1 and id = $2",
        ["empresa-1", "func-1"],
      )
    ).rows[0];
    expect(employee).toMatchObject({
      id: "func-1",
      name: "João da Silva",
      role_title: "Pedreiro",
      work_area: "campo",
      active: true,
    });

    // O evento append-only precisa ter sido registrado na mesma
    // transação, com o resultado agregado retornado pela função.
    const auditRow = (
      await db.query(
        "select action, actor_id, source from public.audit_events where company_id = $1",
        ["empresa-1"],
      )
    ).rows[0];
    expect(auditRow).toMatchObject({
      action: "core_registry_shadow_synced",
      actor_id: "ator-1",
      source: "migration/007",
    });
  });

  it("arquiva (não apaga) registros ausentes numa nova sincronização", async () => {
    const firstSnapshot = buildSnapshot({
      projects: [
        { id: "obra-1", name: "Obra Um", sourceHash: HASH_A },
        { id: "obra-2", name: "Obra Dois", sourceHash: HASH_B },
      ],
    });
    await syncLegacy("empresa-1", "ator-1", firstSnapshot);

    const afterFirst = (
      await db.query(
        "select id, active, archived_at from core_projects where company_id = $1 order by id",
        ["empresa-1"],
      )
    ).rows;
    expect(afterFirst).toHaveLength(2);
    expect(afterFirst.every(row => row.active && row.archived_at === null)).toBe(true);

    // Segunda sincronização só traz obra-1: obra-2 deve ser arquivada,
    // não removida da tabela.
    const secondSnapshot = buildSnapshot({
      projects: [{ id: "obra-1", name: "Obra Um", sourceHash: HASH_A }],
    });
    await syncLegacy("empresa-1", "ator-1", secondSnapshot);

    const afterSecond = (
      await db.query(
        "select id, active, archived_at is not null as is_archived from core_projects where company_id = $1 order by id",
        ["empresa-1"],
      )
    ).rows;
    expect(afterSecond).toHaveLength(2);

    const obraUm = afterSecond.find(row => row.id === "obra-1");
    const obraDois = afterSecond.find(row => row.id === "obra-2");

    expect(obraUm).toMatchObject({ active: true, is_archived: false });
    expect(obraDois).toMatchObject({ active: false, is_archived: true });
  });

  it("recupera (desarquiva) um registro que volta a aparecer no snapshot", async () => {
    await syncLegacy(
      "empresa-1",
      "ator-1",
      buildSnapshot({ projects: [{ id: "obra-1", name: "Obra Um", sourceHash: HASH_A }] }),
    );
    // some do snapshot -> arquiva
    await syncLegacy("empresa-1", "ator-1", buildSnapshot({ projects: [] }));
    let row = (
      await db.query(
        "select active, archived_at is not null as is_archived from core_projects where company_id = $1 and id = $2",
        ["empresa-1", "obra-1"],
      )
    ).rows[0];
    expect(row).toMatchObject({ active: false, is_archived: true });

    // volta a aparecer -> desarquiva
    await syncLegacy(
      "empresa-1",
      "ator-1",
      buildSnapshot({ projects: [{ id: "obra-1", name: "Obra Um", sourceHash: HASH_A }] }),
    );
    row = (
      await db.query(
        "select active, archived_at is not null as is_archived from core_projects where company_id = $1 and id = $2",
        ["empresa-1", "obra-1"],
      )
    ).rows[0];
    expect(row).toMatchObject({ active: true, is_archived: false });
  });

  it("rejeita company_id ou actor_id vazios com a exceção esperada", async () => {
    const snapshot = buildSnapshot();

    await expect(syncLegacy("", "ator-1", snapshot)).rejects.toThrow(
      /core_registry_invalid_actor_or_company/,
    );
    await expect(syncLegacy("empresa-1", "  ", snapshot)).rejects.toThrow(
      /core_registry_invalid_actor_or_company/,
    );
  });

  it("rejeita snapshot incompleto ou com schemaVersion incorreta", async () => {
    await expect(
      syncLegacy("empresa-1", "ator-1", buildSnapshot({ complete: false })),
    ).rejects.toThrow(/core_registry_invalid_snapshot/);

    await expect(
      syncLegacy("empresa-1", "ator-1", buildSnapshot({ schemaVersion: 2 })),
    ).rejects.toThrow(/core_registry_invalid_snapshot/);
  });
});
