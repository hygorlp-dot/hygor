export const COMPANY_CONFIG_COMMAND = Object.freeze({
  COMPANY_CONFIG_SAVED:"CONFIGURACAO_EMPRESA_SALVA",
});

export const COMPANY_CONFIG_COMMAND_TYPES =
  new Set(Object.values(COMPANY_CONFIG_COMMAND));

const fail = reason => ({ ok:false, reason });
const versionOf = config => Number(config?.version || 0);
const emailIsValid = value =>
  !String(value || "").trim()
  || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
const percentageIsValid = value =>
  Number.isFinite(Number(value || 0))
  && Number(value || 0) >= 0
  && Number(value || 0) <= 100;

export const applyCompanyConfigCommand = (
  data = {},
  command = {},
  now = new Date().toISOString(),
) => {
  if (!COMPANY_CONFIG_COMMAND_TYPES.has(command.type)) return null;
  const current = data.config || {};
  if (versionOf(current) !== Number(command.expectedVersion || 0)) {
    return fail("As configurações foram alteradas por outra pessoa. Atualize a tela.");
  }
  const raw = command.payload?.config || {};
  const companyName = String(raw.companyName ?? current.companyName ?? "").trim();
  if (!companyName) return fail("Informe o nome da empresa.");
  if (!emailIsValid(raw.hrEmail ?? current.hrEmail)
      || !emailIsValid(raw.approverEmail ?? current.approverEmail)) {
    return fail("Informe endereços de e-mail válidos.");
  }
  const percentageFields = [
    "aliquotaISS",
    "aliquotaPIS",
    "aliquotaCOFINS",
    "aliquotaIR",
    "aliquotaCSLL",
  ];
  if (percentageFields.some(field =>
    !percentageIsValid(raw[field] ?? current[field] ?? 0)
  )) {
    return fail("As alíquotas precisam estar entre 0% e 100%.");
  }
  const holidays = raw.paymentHolidays ?? current.paymentHolidays ?? [];
  if (!Array.isArray(holidays)
      || holidays.some(value => !/^\d{4}-\d{2}-\d{2}$/.test(String(value)))) {
    return fail("A lista de feriados contém uma data inválida.");
  }
  const actorId = String(command.actorId || "");
  if (!actorId) return fail("Sessão do usuário indisponível para salvar as configurações.");
  const actorName = String(command.actorName || "").trim() || "Administrador";
  const config = {
    ...current,
    ...raw,
    companyName,
    productName:String(raw.productName ?? current.productName ?? "").trim(),
    hrEmail:String(raw.hrEmail ?? current.hrEmail ?? "").trim().toLowerCase(),
    approverEmail:String(
      raw.approverEmail ?? current.approverEmail ?? "",
    ).trim().toLowerCase(),
    paymentHolidays:[...new Set(holidays.map(String))].sort(),
    ...Object.fromEntries(
      percentageFields.map(field => [
        field,
        Number(raw[field] ?? current[field] ?? 0),
      ]),
    ),
    version:versionOf(current) + 1,
    updatedAt:now,
    updatedById:actorId,
    updatedBy:actorName,
  };
  return {
    ok:true,
    entityId:"company-config",
    data:{ ...data, config },
  };
};
