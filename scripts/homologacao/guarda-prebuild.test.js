// @vitest-environment node
//
// Guarda do prebuild da homologação: produção intocada; homologação só com
// variáveis do MESMO projeto (nunca o de produção) e banco provisionado.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { adaptadorPglite } from "../migracoes-ponto/adaptadores.mjs";
import { guardaPrebuild } from "./guarda-prebuild.mjs";

const SCRIPT = path.resolve(import.meta.dirname, "guarda-prebuild.mjs");
const jwt = ref => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: "service_role", ref })).toString("base64url")}.assinatura`;
const REF = "homologref0000000000";
const SEGREDO = "segredo-sintetico-que-nao-pode-aparecer";
const OK = {
  PONTO_AMBIENTE: "homologacao", SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_SERVICE_ROLE_KEY: jwt(REF),
  POSTGRES_URL_NON_POOLING: `postgres://postgres.${REF}:${SEGREDO}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`, CRON_SECRET: SEGREDO,
};
const naoConecta = () => { throw new Error("não devia conectar"); };
async function banco({ comentario, marcador }) {
  const pg = new PGlite();
  if (comentario) {
    const [{ nome }] = (await pg.query("select current_database() as nome")).rows;
    await pg.exec(`comment on database "${nome}" is '${comentario}'`);
  }
  if (marcador) await pg.exec(`create table public.arcd_ambiente (id boolean primary key, ambiente text not null); insert into public.arcd_ambiente values (true, '${marcador}');`);
  return { db: adaptadorPglite(pg), fechar: () => pg.close() };
}
const rodar = env => spawnSync(process.execPath, [SCRIPT], { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env }, encoding: "utf8", timeout: 60000 });

describe("guarda do prebuild da homologação", () => {
  it("produção (sem PONTO_AMBIENTE, 'producao' ou outro valor): ignora sem conectar em nada", async () => {
    for (const PONTO_AMBIENTE of [undefined, "", "producao", "PRODUCAO", "homolog", "piloto"]) {
      expect(await guardaPrebuild({ env: { ...OK, PONTO_AMBIENTE }, conectar: naoConecta })).toEqual({ acao: "ignorar", motivos: [] });
    }
  });

  it("como script no prebuild da PRODUÇÃO: sai 0 em silêncio (o deploy de produção não muda)", () => {
    for (const env of [{}, { PONTO_AMBIENTE: "producao" }, { PONTO_AMBIENTE: "producao", POSTGRES_URL_NON_POOLING: "postgres://x:y@127.0.0.1:1/z" }]) {
      const r = rodar(env);
      expect(r.status).toBe(0);
      expect(`${r.stdout}${r.stderr}`).toBe("");
    }
  });

  it("homologação com variáveis de outro projeto, faltando ou com segredo da produção: recusa sem conectar e sem exibir valores", async () => {
    const r = await guardaPrebuild({ env: { ...OK, POSTGRES_URL_NON_POOLING: OK.POSTGRES_URL_NON_POOLING.replace(REF, "outroprojeto0000000"), BACKUP_ENCRYPTION_KEY: SEGREDO, CRON_SECRET: "" }, conectar: naoConecta });
    expect(r.acao).toBe("recusar");
    const t = r.motivos.join(" | ");
    for (const esperado of [/POSTGRES_URL_NON_POOLING é de outro projeto/, /BACKUP_ENCRYPTION_KEY presente/, /CRON_SECRET ausente/]) expect(t).toMatch(esperado);
    expect(t).not.toContain(SEGREDO);
    expect(t).not.toContain(REF);
  });

  it("homologação com banco sem comentário/marcador: recusa (provisionar vem antes do primeiro deploy)", async () => {
    for (const estado of [{}, { comentario: "arcd-ponto-homologacao" }, { marcador: "homologacao" }, { comentario: "arcd-ponto-homologacao", marcador: "producao" }]) {
      const r = await guardaPrebuild({ env: OK, conectar: () => banco(estado) });
      expect(r.acao).toBe("recusar");
      expect(r.motivos.join(" ")).toMatch(/provisionar/);
    }
  }, 90000);

  it("homologação com variáveis do mesmo projeto e banco provisionado: segue", async () => {
    expect(await guardaPrebuild({ env: OK, conectar: () => banco({ comentario: "arcd-ponto-homologacao", marcador: "homologacao" }) })).toEqual({ acao: "ok", motivos: [] });
  }, 30000);

  it("banco inacessível: falha FECHADA, sem a URL na mensagem", async () => {
    const r = await guardaPrebuild({ env: OK, conectar: async () => { throw new Error(`connect ECONNREFUSED ${OK.POSTGRES_URL_NON_POOLING}`); } });
    expect(r.acao).toBe("recusar");
    expect(r.motivos.join(" ")).toMatch(/falha fechada/);
    expect(JSON.stringify(r)).not.toContain(SEGREDO);
  });

  it("é o PRIMEIRO passo do prebuild (antes de qualquer script que mexa em banco)", () => {
    const prebuild = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../package.json"), "utf8")).scripts.prebuild;
    expect(prebuild.startsWith("node scripts/homologacao/guarda-prebuild.mjs && ")).toBe(true);
  });

  it("como script na HOMOLOGAÇÃO com variáveis erradas: sai 1, lista os motivos e não exibe valores", () => {
    const r = rodar({ ...OK, SUPABASE_SERVICE_ROLE_KEY: jwt("outroprojeto0000000"), GEMINI_API_KEY: SEGREDO });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/DEPLOY RECUSADO/);
    expect(r.stderr).toMatch(/SUPABASE_SERVICE_ROLE_KEY é de outro projeto/);
    expect(r.stderr).toMatch(/GEMINI_API_KEY presente/);
    expect(`${r.stdout}${r.stderr}`).not.toContain(SEGREDO);
  });
});
