import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ErroFiscal, exigir } from "./campos.js";

const executar = promisify(execFile);
const worker = fileURLToPath(new URL("../../../scripts/ponto-assinatura/assinador.py", import.meta.url));

// Adaptador para worker Python em infraestrutura privada, não para execução
// dentro da função Node da Vercel. Certificado nunca vai ao navegador.
export function criarAssinadorLocal({ python, ambiente = process.env } = {}) {
  exigir(typeof python === "string" && path.isAbsolute(python), "PYTHON_ASSINATURA_NAO_CONFIGURADO");
  return async ({ bytes, padrao, desenvolvedor }) => {
    exigir(["PAdES", "CAdES detached"].includes(padrao), "PADRAO_ASSINATURA_INVALIDO");
    exigir(ambiente.PONTO_ASSINATURA_CONFIG, "ASSINADOR_ICP_BRASIL_NAO_CONFIGURADO");
    // Comparar titularidade privada com o desenvolvedor do documento, antes de
    // assinar, sem devolver caminhos, certificado ou senha em mensagens de erro.
    let config;
    try { config = JSON.parse(await readFile(ambiente.PONTO_ASSINATURA_CONFIG, "utf8")); }
    catch { throw new ErroFiscal("CONFIGURACAO_ASSINATURA_INVALIDA"); }
    exigir(config.desenvolvedor?.tipo === desenvolvedor?.tipo && config.desenvolvedor?.numero === desenvolvedor?.numero, "CERTIFICADO_DE_OUTRO_DESENVOLVEDOR");
    const dir = await mkdtemp(path.join(tmpdir(), "marcell-assinatura-"));
    try {
      const input = path.join(dir, "entrada"), output = path.join(dir, "saida");
      await writeFile(input, bytes, { flag: "wx", mode: 0o600 });
      let stdout;
      try {
        ({ stdout } = await executar(python, [worker, "assinar", "--tipo", padrao === "PAdES" ? "pdf" : "cades", "--entrada", input, "--saida", output],
          { env: ambiente, timeout: 120_000, maxBuffer: 256_000, windowsHide: true }));
      } catch { throw new ErroFiscal("ASSINATURA_OU_CERTIFICADO_REPROVADO"); }
      let verificacao;
      try { verificacao = JSON.parse(stdout); } catch { throw new ErroFiscal("RESPOSTA_ASSINADOR_INVALIDA"); }
      return { bytes: await readFile(output), verificacao };
    } finally {
      // Somente o diretório temporário recém-criado por esta operação.
      exigir(path.dirname(path.resolve(dir)) === path.resolve(tmpdir()) && path.basename(dir).startsWith("marcell-assinatura-"), "TEMPORARIO_FORA_DO_ESCOPO");
      await rm(dir, { recursive: true, force: true });
    }
  };
}
