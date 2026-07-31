// Títulos de folha são obrigações financeiras; não são uma segunda fonte de
// custo. O DRE continua lendo ponto/folha. Esta coleção só controla saldo,
// liquidação e evidência bancária.
import { paraCentavos } from "./calculations.js";
import { active } from "../financeiro/ledger.js";

export const normalizarDocumento = value => String(value || "").replace(/\D/g, "");

export const mascararDocumento = value => {
  const digits = normalizarDocumento(value);
  if (!digits) return "Não informado";
  if (digits.length === 11) return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
  if (digits.length === 14) return `${digits.slice(0, 2)}.***.***/****-${digits.slice(-2)}`;
  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
};

export const mascararChavePix = value => {
  const key = String(value || "").trim();
  if (!key) return "Não informada";
  if (key.includes("@")) {
    const [name, domain] = key.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return key.length <= 6 ? "***" : `${key.slice(0, 3)}***${key.slice(-3)}`;
};

export const totalLiquidadoFolha = title =>
  Array.isArray(title?.liquidacoes) && title.liquidacoes.length
    ? title.liquidacoes.filter(active).reduce((sum, item) => sum + Number(item.valor || 0), 0)
    : Number(title?.valorPago || 0);

export const situacaoTituloFolha = title => {
  const liquido = Number(title?.liquido || 0);
  const pago = totalLiquidadoFolha(title);
  if (liquido <= 0) return pago > 0 ? "pago" : "em_aberto";
  if (pago >= liquido - 0.01) return "pago";
  if (pago > 0) return "parcial";
  return "em_aberto";
};

export const saldoTituloFolha = title => Math.max(0, Number(title?.liquido || 0) - totalLiquidadoFolha(title));

export const tituloFolhaPendente = (data, employeeId, competencia = "") =>
  (data?.titulosFolha || []).find(title =>
    title.employeeId === employeeId &&
    (!competencia || title.competencia === competencia) &&
    situacaoTituloFolha(title) !== "pago"
  ) || null;

export const resumoTituloFolha = (title, employee = {}) => ({
  employeeId: title?.employeeId || "",
  funcionario: employee?.name || employee?.nome || title?.funcionarioNome || "Funcionário",
  cpfMascarado: mascararDocumento(employee?.cpf || employee?.documento || title?.documentoFuncionario),
  chavePixMascarada: mascararChavePix(employee?.pixKey || title?.chavePix),
  titularPix: employee?.pixHolder || title?.titularPix || employee?.name || employee?.nome || "",
  periodo: title?.periodoInicio && title?.periodoFim ? `${title.periodoInicio} a ${title.periodoFim}` : title?.competencia || "",
  bruto: Number(title?.bruto || 0), beneficios: Number(title?.beneficios || 0),
  adiantamentos: Number(title?.adiantamentos || 0), descontos: Number(title?.descontos || 0),
  liquido: Number(title?.liquido || 0), valorPago: totalLiquidadoFolha(title),
  saldo: saldoTituloFolha(title), status: situacaoTituloFolha(title),
  rateiosPorObra: Array.isArray(title?.rateiosPorObra) ? title.rateiosPorObra : [],
});

export const validarLiquidacaoFolha = (title, valor) => {
  const centavos = paraCentavos(valor);
  if (centavos <= 0) return "Informe um valor de liquidação maior que zero.";
  if (centavos > paraCentavos(saldoTituloFolha(title)) + 1) return "O valor supera o saldo do título de folha.";
  return "";
};
