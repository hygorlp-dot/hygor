#!/usr/bin/env node
// Ativa os hooks versionados em .githooks/ (pre-push) para este clone.
// Roda no "prepare" do npm; em CI, na Vercel ou fora de um repositório git
// não faz nada - lá quem barra é o próprio pipeline.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";

if (process.env.CI || process.env.VERCEL || !existsSync(".git")) process.exit(0);
try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
  try { chmodSync(".githooks/pre-push", 0o755); } catch { /* Windows: o Git for Windows não precisa */ }
  console.log("Hooks do ARCD ativos: .githooks/pre-push (lint, arquitetura, testes e build antes de cada push).");
} catch {
  // git ausente: nada a ativar
}
