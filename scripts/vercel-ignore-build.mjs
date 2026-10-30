// Ignored Build Step da Vercel (vercel.json → ignoreCommand).
// Código 1 = construir; código 0 = pular. Decisão do dono em 29/10/2026:
// prévia só para a main (produção) e para branches com PR aberto. Branches
// enviadas apenas como cópia de segurança não gastam a cota diária de builds.
export function shouldBuild(env = process.env) {
  if (env.VERCEL_ENV === "production") return { build: true, reason: "produção (main)" };
  if (String(env.VERCEL_GIT_PULL_REQUEST_ID || "").trim()) return { build: true, reason: `PR #${env.VERCEL_GIT_PULL_REQUEST_ID}` };
  return { build: false, reason: `branch ${env.VERCEL_GIT_COMMIT_REF || "desconhecida"} sem PR aberto` };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("vercel-ignore-build.mjs")) {
  const decision = shouldBuild();
  console.log(`${decision.build ? "Construindo" : "Pulando build"}: ${decision.reason}.`);
  process.exit(decision.build ? 1 : 0);
}
