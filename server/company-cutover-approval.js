import {cutoverHash,requireCutover} from './company-cutover.js';
export const CUTOVER_EVIDENCE_CHECKS=Object.freeze(['catalog','identities','privateFiles','privatePhotos','privateHistoryArchive','backupRestore','dre','releaseCode']);
export function assertCompanyCutoverApproval(bundle,approval,{now=Date.now()}={}){
 requireCutover(bundle.preservation?.version===1,'Aplicação real exige preservação dos controles vivos.');
 requireCutover(approval?.version===1&&approval.action==='apply-company-separation-once'&&approval.packageId===bundle.id&&approval.targetHash===cutoverHash(bundle.after),'Aprovação não corresponde ao pacote e ao alvo.');
 requireCutover(/^[a-f0-9]{40}$/.test(approval.releaseCommit||''),'Commit consolidado não certificado.');
 const captured=Date.parse(approval.capturedAt),expires=Date.parse(approval.expiresAt);
 requireCutover(Number.isFinite(captured)&&Number.isFinite(expires)&&captured<=now&&now-captured<=15*60*1000&&expires>now&&expires-captured<=15*60*1000,'Corte expirado ou intervalo inválido; recapturar antes da aplicação.');
 for(const key of CUTOVER_EVIDENCE_CHECKS)requireCutover(approval.checks?.[key]?.status==='verified'&&/^[a-f0-9]{64}$/.test(approval.checks[key].evidenceSha256||''),`Evidência de implantação ausente: ${key}.`);
 return approval;
}
