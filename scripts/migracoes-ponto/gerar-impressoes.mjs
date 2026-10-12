// Gera scripts/migracoes-ponto/impressoes.json: a impressão digital do
// catálogo do ponto (validacao.mjs, impressaoDigital) depois de cada versão,
// aplicando as PRÓPRIAS migrations num banco limpo (PGlite). O gate de
// deploy compara produção com isto. Rodar depois de criar uma migration:
//   node scripts/migracoes-ponto/gerar-impressoes.mjs
// O teste livro.test.js refaz a geração e falha se o arquivo estiver velho.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { PAPEIS_SUPABASE, lerMigration } from "../../server/ponto-eletronico/banco-pglite.test-helper.js";
import { adaptadorPglite } from "./adaptadores.mjs";
import { OBJETOS, impressaoDigital } from "./validacao.mjs";

export async function gerarImpressoes() {
  const pg = new PGlite({ extensions: { pgcrypto } });
  try {
    await pg.exec(PAPEIS_SUPABASE);
    const db = adaptadorPglite(pg), saida = {};
    for (const arquivo of Object.keys(OBJETOS)) {
      await pg.exec(lerMigration(arquivo));
      saida[arquivo.slice(0, 3)] = await impressaoDigital(db);
    }
    return saida;
  } finally {
    await pg.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const destino = new URL("./impressoes.json", import.meta.url);
  fs.writeFileSync(destino, `${JSON.stringify(await gerarImpressoes(), null, 2)}\n`);
  process.stdout.write(`impressões digitais gravadas em ${fileURLToPath(destino)}\n`);
}
