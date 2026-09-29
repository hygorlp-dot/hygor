// Barra nomes usados e nunca declarados/importados (ReferenceError em tempo
// de execução). Build e testes não pegam isso: o Vite aceita a variável solta
// e a tela só quebra quando o trecho roda. Em 29/09/2026 esta checagem achou
// 14 casos em Estoque, Conferência, Diário, Equipe e Modo TV, todos vindos de
// extrações de LegacyApp.jsx que levaram o uso e deixaram a definição para trás.
import { readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const CANNOT_FIND_NAME = new Set([2304, 2552]); // "Cannot find name" / "... Did you mean"

// Varre a pasta (não o git) para incluir arquivos novos ainda não versionados.
const files = readdirSync("src", { recursive: true })
  .map(file => String(file))
  .filter(file => /\.(js|jsx)$/.test(file) && !/\.(test|spec|stories)\.(js|jsx)$/.test(file))
  .map(file => path.resolve("src", file));

const program = ts.createProgram(files, {
  allowJs: true,
  checkJs: true,
  noEmit: true,
  skipLibCheck: true,
  jsx: ts.JsxEmit.Preserve,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
});

const findings = [];
for (const source of program.getSourceFiles()) {
  if (source.isDeclarationFile || !files.includes(path.resolve(source.fileName))) continue;
  for (const diagnostic of program.getSemanticDiagnostics(source)) {
    if (!CANNOT_FIND_NAME.has(diagnostic.code) || diagnostic.start == null) continue;
    const { line, character } = source.getLineAndCharacterOfPosition(diagnostic.start);
    const name = source.text.slice(diagnostic.start, diagnostic.start + diagnostic.length);
    findings.push(`${path.relative(process.cwd(), source.fileName)}:${line + 1}:${character + 1} ${name}`);
  }
}

if (findings.length) {
  console.error(`Nomes usados sem declaração nem import (quebram a tela em tempo de execução):\n- ${findings.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Nenhum nome solto em ${files.length} arquivos de src/.`);
}
