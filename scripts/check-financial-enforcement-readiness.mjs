import { financialEnforcementReadiness } from "../server/financial-write-policy.js";

const enforced=process.env.FINANCIAL_ENGINE_ENFORCE==="true";
const readiness=financialEnforcementReadiness();

if(enforced&&!readiness.ready){
  console.error(
    `FIN-003 não pode ser ativado: ${readiness.pending.length} seção(ões) ainda possuem escritores por snapshot: ${readiness.pending.join(", ")}.`
  );
  process.exit(1);
}

console.log(
  enforced
    ? "FIN-003: gate de escritores aprovado."
    : `FIN-003: enforcement desativado; ${readiness.pending.length} seção(ões) ainda aguardam migração.`
);
