import { isDateInClosedPeriod } from "../financeiro/workflows.js";
import { validDate } from "./date-validation.js";
import {
  calculateRescission,
  RESCISSION_TYPE_LABEL,
} from "./rescission-calculations.js";

export const RESCISSION_COMMAND = Object.freeze({
  PAYROLL_RESCISSION_CREATED:"RESCISAO_TRABALHISTA_CRIADA",
  PAYROLL_RESCISSION_CANCELLED:"RESCISAO_TRABALHISTA_CANCELADA",
});

export const RESCISSION_COMMAND_TYPES = new Set(Object.values(RESCISSION_COMMAND));

const fail = reason => ({ ok:false, reason });
const versionOf = item => Number(item?.version || 0);
const byId = (data, id) => (data.rescisoes || []).find(item => String(item.id) === String(id));
const active = item => !["cancelada", "cancelado", "estornada", "estornado"].includes(String(item?.status || "").toLowerCase());
const nonNegativeNumber = value => Number.isFinite(Number(value)) && Number(value) >= 0;

export const rescissionCommandObraId = (data = {}, command = {}) => {
  const payload = command.payload || {};
  if (command.type === RESCISSION_COMMAND.PAYROLL_RESCISSION_CREATED) {
    const record = payload.rescission || {};
    const employee = (data.employees || []).find(item => String(item.id) === String(record.empId || ""));
    return String(employee?.obra || record.obraId || "");
  }
  return String(byId(data, payload.rescissionId)?.obraId || "");
};

const createRescission = (data, command, now) => {
  const raw = command.payload?.rescission || {};
  const id = String(raw.id || "");
  if (!id || byId(data, id)) return fail("A rescisão precisa de uma identificação única.");
  if (!String(command.actorId || "")) return fail("Sessão do usuário indisponível para registrar a rescisão.");
  const employee = (data.employees || []).find(item => String(item.id) === String(raw.empId || ""));
  if (raw.empId && !employee) return fail("O funcionário informado não existe.");
  const obraId = String(employee?.obra || raw.obraId || "");
  const obra = (data.obras || []).find(item => String(item.id) === obraId);
  if (obraId && !obra) return fail("A obra da rescisão não existe.");
  const input = {
    empId:String(employee?.id || raw.empId || ""),
    empName:String(employee?.name || raw.empName || "").trim(),
    empCPF:String(employee?.cpf || raw.empCPF || "").trim(),
    empFuncao:String(employee?.role || raw.empFuncao || "").trim(),
    obraId,
    obraName:String(obra?.name || raw.obraName || "").trim(),
    admissao:String(employee?.startDate || raw.admissao || ""),
    demissao:String(raw.demissao || ""),
    valorMensal:Number(raw.valorMensal || 0),
    diasNoMes:Number(raw.diasNoMes || 0),
    tipo:String(raw.tipo || ""),
    valorFixoAcordo:Number(raw.valorFixoAcordo || 0),
    incluirSaldo:raw.incluirSaldo === true,
    incluir13:raw.incluir13 === true,
    incluirFerias:raw.incluirFerias === true,
    incluirAviso:raw.incluirAviso === true,
    descAdiantamento:Number(raw.descAdiantamento || 0),
    descOutros:Number(raw.descOutros || 0),
    obsDesc:String(raw.obsDesc || "").trim(),
    obs:String(raw.obs || "").trim(),
  };
  if (!input.empName) return fail("Informe o trabalhador da rescisão.");
  if (!validDate(input.admissao) || !validDate(input.demissao)) return fail("Informe datas válidas de admissão e rescisão.");
  if (!RESCISSION_TYPE_LABEL[input.tipo]) return fail("O motivo da rescisão é inválido.");
  if (!nonNegativeNumber(input.valorMensal) || !nonNegativeNumber(input.valorFixoAcordo)
      || !nonNegativeNumber(input.descAdiantamento) || !nonNegativeNumber(input.descOutros)) {
    return fail("Os valores da rescisão não podem ser negativos ou inválidos.");
  }
  const workedDays = input.diasNoMes;
  if (!Number.isFinite(workedDays) || workedDays < 0 || workedDays > 31) {
    return fail("Os dias trabalhados no mês precisam estar entre 0 e 31.");
  }
  if (input.tipo === "acordo_interno" && !(Number(input.valorFixoAcordo || input.valorMensal || 0) > 0)) {
    return fail("Informe o valor mensal do acordo interno.");
  }
  if (input.tipo !== "acordo_interno" && !(Number(input.valorMensal || 0) > 0)) {
    return fail("Informe um valor mensal positivo.");
  }
  const calculation = calculateRescission(input);
  if (!calculation) return fail("A data de rescisão não pode anteceder a admissão.");
  if (isDateInClosedPeriod(data, input.demissao)) return fail("O período financeiro desta rescisão está fechado.");
  const record = {
    ...input,
    id,
    ...calculation,
    status:"ativa",
    version:1,
    createdAt:now,
    createdById:String(command.actorId || ""),
    createdBy:String(command.actorName || "").trim() || "Usuário autenticado",
  };
  return { ok:true, data:{ ...data, rescisoes:[...(data.rescisoes || []), record] }, entityId:id };
};

const cancelRescission = (data, command, now) => {
  const payload = command.payload || {};
  const id = String(payload.rescissionId || "");
  const current = byId(data, id);
  if (!current) return fail("Rescisão não encontrada.");
  if (!active(current)) return fail("A rescisão já está cancelada.");
  if (versionOf(current) !== Number(command.expectedVersion)) {
    return fail("A rescisão foi alterada por outra pessoa. Atualize a tela.");
  }
  const reason = String(payload.reason || "").trim();
  if (reason.length < 3) return fail("Informe o motivo do cancelamento da rescisão.");
  if (current.transacaoId || current.reconciliationLinkId) {
    return fail("Desfaça a conciliação financeira antes de cancelar esta rescisão.");
  }
  if (isDateInClosedPeriod(data, current.demissao)) {
    return fail("O período financeiro desta rescisão está fechado.");
  }
  const cancelled = {
    ...current,
    status:"cancelada",
    motivoCancelamento:reason,
    canceladoEm:now,
    canceladoPorId:String(command.actorId || ""),
    canceladoPor:String(command.actorName || "").trim() || "Usuário autenticado",
    version:versionOf(current) + 1,
  };
  return {
    ok:true,
    data:{ ...data, rescisoes:(data.rescisoes || []).map(item => String(item.id) === id ? cancelled : item) },
    entityId:id,
  };
};

export const applyRescissionCommand = (data = {}, command = {}, now = new Date().toISOString()) => {
  if (!RESCISSION_COMMAND_TYPES.has(command.type)) return null;
  if (command.type === RESCISSION_COMMAND.PAYROLL_RESCISSION_CREATED) return createRescission(data, command, now);
  return cancelRescission(data, command, now);
};
