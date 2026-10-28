// MEI is a legal service-provider contract, NOT an employment remuneration mode.
// Keep this data outside CLT/daily attendance and payroll calculations.
export const MEI_SCOPE = Object.freeze({ ADMINISTRATIVO: "administrativo", TERCEIRIZADO: "terceirizado" });
const iso = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(String(value) + "T12:00:00Z"));
const cents = value => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : NaN;
const digits = value => String(value || "").replace(/\D/g, "");
export function validCnpj(value) {
  const d = digits(value);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const check = length => {
    const weights = length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const sum = weights.reduce((acc,w,i) => acc + Number(d[i]) * w,0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return Number(d[12]) === check(12) && Number(d[13]) === check(13);
}
export function validateMeiContract(contract, obras = []) {
  const errors = {};
  if (!String(contract?.providerName || "").trim()) errors.providerName = "Informe a razão social ou nome empresarial.";
  if (!validCnpj(contract?.cnpj)) errors.cnpj = "Informe um CNPJ válido.";
  if (!String(contract?.service || "").trim()) errors.service = "Informe o serviço contratado.";
  if (!Object.values(MEI_SCOPE).includes(contract?.scope)) errors.scope = "Escolha Administrativo ou Terceirizado.";
  if (contract?.scope === MEI_SCOPE.ADMINISTRATIVO && contract?.obraId) errors.obraId = "O administrativo não deve ser vinculado artificialmente a uma obra.";
  if (contract?.scope === MEI_SCOPE.TERCEIRIZADO && (!contract?.obraId || !obras.some(o => String(o.id) === String(contract.obraId)))) errors.obraId = "Selecione uma obra válida.";
  if (!["mensal", "contrato"].includes(contract?.frequency)) errors.frequency = "Selecione mensal ou contrato.";
  if (!(cents(contract?.fixedAmount) > 0)) errors.fixedAmount = "Informe um valor fixo positivo.";
  if (!iso(contract?.startDate)) errors.startDate = "Informe o início da vigência.";
  if (contract?.endDate && (!iso(contract.endDate) || contract.endDate < contract.startDate)) errors.endDate = "Informe um fim de vigência válido.";
  return errors;
}
export function createMeiContract(draft, obras = []) {
  const errors = validateMeiContract(draft, obras);
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, contract: {
    ...draft,
    cnpj: digits(draft.cnpj),
    fixedAmount: cents(draft.fixedAmount) / 100,
    obraId: draft.scope === MEI_SCOPE.ADMINISTRATIVO ? "" : String(draft.obraId),
    status: "ativo",
    kind: "mei_service_contract",
  } };
}
export function meiCostCenter(contract) {
  return contract?.scope === MEI_SCOPE.ADMINISTRATIVO
    ? { type: "administrativo", obraId: null }
    : { type: "obra", obraId: contract?.obraId || null };
}
