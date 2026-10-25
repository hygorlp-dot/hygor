import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

export function executarFerramenta(cmd, args, options = {}) {
  // npm exposes its JS entry point; bypass .cmd and shell quoting on Windows.
  if (cmd === "node") return spawnSync(process.execPath, args, options);
  if (cmd === "npx" && process.platform === "win32") {
    const npmCli = process.env.npm_execpath;
    if (!npmCli) return { status: null, error: new Error("Execute pela raiz com npm run mobile:release-check."), stdout: "", stderr: "" };
    return spawnSync(process.execPath, [path.join(path.dirname(npmCli), "npx-cli.js"), ...args], options);
  }
  return spawnSync(cmd, args, options);
}

export function tamanhoDiretorio(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const file = path.join(dir, entry.name);
    return total + (entry.isDirectory() ? tamanhoDiretorio(file) : statSync(file).size);
  }, 0);
}

export function avaliarDoctor(result, { offline = false, ci = false } = {}) {
  if (result.error || result.signal || result.status === null) {
    return { ok: false, detalhe: result.error?.message || `expo-doctor interrompido: ${result.signal || "sem status"}` };
  }
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (result.status === 0) return { ok: true, detalhe: (output.match(/\d+\/\d+ checks passed/) || ["ok"])[0] };
  const failures = [...output.matchAll(/^✖ (.+)$/gm)].map(match => match[1].trim());
  const networkOnly = failures.length > 0 && failures.every(f => /Expo config .*schema|React Native Directory/i.test(f));
  if (offline && networkOnly) return { ok: !ci, detalhe: "Checks de rede não verificados offline", naoVerificado: failures };
  return { ok: false, detalhe: failures.join("; ") || `expo-doctor terminou com código ${result.status}` };
}
