// @ts-check
import { RECORD_COMMANDS } from "../src/domains/comercial/contracts/record-commands.js";
import { RENTAL_COMMAND_ROLES } from "../src/domains/equipamentos/rental-command-roles.js";
import { ACCOUNTING_COMMAND_TYPES } from "../src/domains/financeiro/accounting-indicators.js";
import { DOSSIER_COMMAND_TYPES } from "../src/domains/licenciamento/dossier.js";
import { BASELINE_COMMAND } from "../src/domains/planejamento/approved-baseline.js";
import { ENGINEERING_COMMAND_TYPES, ENGINEERING_ROLES } from "../src/domains/projetos/commands.js";
import { FILE_COMMAND_TYPES, FILE_ROLES } from "../src/domains/arquivos/commands.js";
import { OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";

/** @typedef {{ok: true} | {ok: false, status: 400 | 403, error: string}} RoleAuthorization */

export const FINANCIAL_COMMANDS = new Set(["CREATE_FINANCIAL_TITLE","REGISTER_SETTLEMENT","REVERSE_SETTLEMENT","CLOSE_ACCOUNTING_PERIOD"]);
/** @type {Record<string, readonly string[]>} */
export const FINANCIAL_COMMAND_ROLES = {
  CREATE_FINANCIAL_TITLE:["admin","financeiro"], REGISTER_SETTLEMENT:["admin","financeiro"],
  REVERSE_SETTLEMENT:["admin","financeiro"], CLOSE_ACCOUNTING_PERIOD:["admin"],
};
// Mesmo padrão de authorizeOperationalCommand, para o motor financeiro
// canônico (rota "financial-command").
/**
 * @param {string} commandType
 * @param {string} role
 * @returns {RoleAuthorization}
 */
export const authorizeFinancialCommand = (commandType, role) => {
  if (!FINANCIAL_COMMANDS.has(commandType)) return { ok:false, status:400, error:"Comando financeiro inválido." };
  if (!FINANCIAL_COMMAND_ROLES[commandType].includes(role)) return { ok:false, status:403, error:"Seu perfil não pode executar este comando financeiro." };
  return { ok:true };
};

/** @type {Record<string, readonly string[] | undefined>} */
export const OPERATIONAL_COMMAND_ROLES = {
  [RECORD_COMMANDS.SAVE]:['admin','comercial'],
  [RECORD_COMMANDS.REVIEW]:['admin','comercial'],
  [RECORD_COMMANDS.LINK_WORK]:['admin','comercial'],
  [RECORD_COMMANDS.REVISE]:['admin','comercial'],
  [RECORD_COMMANDS.DECIDE]:['admin'],
  [RECORD_COMMANDS.STATE]:['admin'],
  [RECORD_COMMANDS.COMPANY]:['admin'],
  ...Object.fromEntries([...ACCOUNTING_COMMAND_TYPES].map(type=>[type,['admin','financeiro']])),
  [BASELINE_COMMAND.SCHEDULE_BASELINE_PROPOSED]:['admin','diretoria','engenheiro','engenheiro_auditor','planejamento'],
  [BASELINE_COMMAND.SCHEDULE_BASELINE_APPROVED]:['admin','diretoria'],
  [OPERATIONAL_COMMAND.CLOSING_SOURCE_CORRECTED]:['admin','financeiro'],
  ...Object.fromEntries([...ENGINEERING_COMMAND_TYPES].map(type=>[type,ENGINEERING_ROLES])),
  ...Object.fromEntries([...FILE_COMMAND_TYPES].map(type=>[type,FILE_ROLES])),
  ...Object.fromEntries([...DOSSIER_COMMAND_TYPES].map(type=>[type,['admin','engenheiro']])),
  [OPERATIONAL_COMMAND.COST_ALLOCATION_SAVED]:['admin','financeiro'],
  [OPERATIONAL_COMMAND.COST_FORECAST_SAVED]:['admin','financeiro'],
  [OPERATIONAL_COMMAND.SERVICE_COMMITMENT_LINK_SAVED]:['admin','financeiro'],
  [OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CREATED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.TECHNICAL_MEASUREMENT_CANCELLED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.FIELD_REPORT_CHANGED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.FIELD_REPORT_CANCELLED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.FIELD_REPORT_REOPENED]:["admin"],
  [OPERATIONAL_COMMAND.PROGRESS_RECORD_SAVED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.PROGRESS_RECORD_CANCELLED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_COMPLETED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_CREATED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.WEEKLY_COMMITMENT_RELEASED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.PURCHASE_RECEIPT_RECORDED]:["admin","compras","financeiro","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.MANUAL_RECEIPT_CREATED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.MANUAL_RECEIPT_REVERSED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_SAVED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.CLIENT_MEASUREMENTS_GENERATED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_CANCELLED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_ADMIN_CLOSED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.CLIENT_MEASUREMENT_BILLED]:["admin","financeiro","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.COMMERCIAL_CONTRACT_ACTIVATED]:["admin","comercial"],
  [OPERATIONAL_COMMAND.PROJECT_EXPENSE_CREATED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.PROJECT_EXPENSE_CANCELLED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.COMPANY_EXPENSE_SAVED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.COMPANY_EXPENSE_CANCELLED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.COMPANY_RECURRING_EXPENSES_REPLICATED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.WORK_CASH_MOVEMENT_CREATED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.WORK_CASH_MOVEMENT_CANCELLED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.ORDER_PAYMENT_ALLOCATED]:["admin","financeiro","compras"],
  [OPERATIONAL_COMMAND.PAYABLE_PAYMENT_RECORDED]:["admin","financeiro","compras"],
  [OPERATIONAL_COMMAND.PURCHASE_PAYMENT_RECLASSIFIED]:["admin","financeiro","compras"],
  [OPERATIONAL_COMMAND.PAYABLE_PAYMENT_REVERSED]:["admin","financeiro","compras"],
  [OPERATIONAL_COMMAND.PURCHASE_CANCELLED]:["admin","financeiro","compras"],
  [OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IMPORTED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.BANK_IMPORT_REVERSED]:['admin'],
  [OPERATIONAL_COMMAND.BANK_STATEMENT_ACCOUNT_LINKED]:["admin"],
  [OPERATIONAL_COMMAND.BANK_TRANSACTIONS_IGNORED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.BANK_TRANSACTIONS_REOPENED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_PAYMENT_RECORDED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_PAYMENT_REVERSED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_RECORDED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_CANCELLED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_PAID]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_RETENTION_SAVED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_RETENTION_RELEASED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_RETENTION_PAID]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_APPROVED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_REJECTED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_MEASUREMENT_RESUBMITTED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_INVOICE_LINKED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.THIRD_PARTY_CONTRACT_STAGES_SAVED]:["admin","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.INVOICE_SAVED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.INVOICE_APPROVED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.INVOICE_REJECTED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.PURCHASE_ORDER_SAVED]:["admin","compras"],
  // Qualquer perfil que possa ser aprovador; quem decide é o motor, que só
  // aceita o usuário autenticado se ele estiver entre os elegíveis da etapa.
  [OPERATIONAL_COMMAND.APPROVAL_DECISION_RECORDED]:["admin","compras","financeiro","engenheiro","engenheiro_auditor","rh","diretoria"],
  [OPERATIONAL_COMMAND.PURCHASE_REQUEST_SAVED]:["admin","compras","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.PURCHASE_REQUEST_CANCELLED]:["admin","compras","engenheiro","engenheiro_auditor"],
  // Mesmos perfis que a tela libera (canManagePurchases) para assumir a solicitação.
  [OPERATIONAL_COMMAND.PURCHASE_REQUEST_ANALYSIS_STARTED]:["admin","compras","financeiro"],
  [OPERATIONAL_COMMAND.PURCHASE_REQUEST_SUPPLIER_CONTACTED]:["admin","compras","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.SUPPLIER_SAVED]:["admin","compras","financeiro"],
  [OPERATIONAL_COMMAND.SUPPLY_CONTRACT_SAVED]:["admin","compras"],
  [OPERATIONAL_COMMAND.SUPPLY_CONTRACT_CLOSED]:["admin","compras"],
  [OPERATIONAL_COMMAND.MATERIAL_SAVED]:["admin","compras","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.PURCHASE_ORDER_CREATED_FROM_QUOTE]:["admin","compras"],
  [OPERATIONAL_COMMAND.QUOTE_SUPPLIER_RESPONSE_REVIEWED]:["admin","compras"],
  [OPERATIONAL_COMMAND.QUOTE_SUPPLIER_DISPATCH_RECORDED]:["admin","compras"],
  [OPERATIONAL_COMMAND.QUOTE_SUPPLIER_DISPATCH_UPDATED]:["admin","compras"],
  [OPERATIONAL_COMMAND.QUOTE_MAP_DECIDED]:["admin","compras"],
  [OPERATIONAL_COMMAND.PURCHASE_ORDER_DOCUMENT_ATTACHED]:["admin","compras"],
  [OPERATIONAL_COMMAND.PURCHASE_ORDER_SENT_TO_SUPPLIER]:["admin","compras"],
  [OPERATIONAL_COMMAND.PURCHASE_ORDER_SUPPLIER_ACCEPTED]:["admin","compras"],
  [OPERATIONAL_COMMAND.PURCHASE_QUOTE_CANCELLED]:["admin","compras"],
  [OPERATIONAL_COMMAND.QUOTATION_SAVED]:["admin","compras"],
  [OPERATIONAL_COMMAND.PURCHASE_QUOTE_DOCUMENT_ATTACHED]:["admin","compras"],
  [OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CREATED]:["admin","rh"],
  [OPERATIONAL_COMMAND.PAYROLL_RESCISSION_CANCELLED]:["admin","rh"],
  [OPERATIONAL_COMMAND.EMPLOYEE_SAVED]:["admin","rh"],
  [OPERATIONAL_COMMAND.EMPLOYEE_PAY_MODE_SET]:["admin","rh"],
  [OPERATIONAL_COMMAND.PAYROLL_ADVANCE_CREATED]:["admin","rh"],
  [OPERATIONAL_COMMAND.PAYROLL_ADVANCE_CANCELLED]:["admin","rh"],
  [OPERATIONAL_COMMAND.PAYROLL_FORTNIGHT_CLOSED]:["admin","rh"],
  [OPERATIONAL_COMMAND.PAYROLL_FORTNIGHT_REOPENED]:["admin","rh"],
  // Aditivo muda a receita do contrato: registra quem cuida do contrato;
  // registrar a decisão do cliente é do administrador.
  [OPERATIONAL_COMMAND.CONTRACT_AMENDMENT_SAVED]:["admin","engenheiro","financeiro"],
  [OPERATIONAL_COMMAND.CONTRACT_AMENDMENT_DECIDED]:["admin"],
  [OPERATIONAL_COMMAND.CONTRACT_AMENDMENT_CANCELLED]:["admin","financeiro"],
  [OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED]:["admin"],
  [OPERATIONAL_COMMAND.PROJECT_SAVED]:["admin"],
  [OPERATIONAL_COMMAND.PROJECT_COVER_REMOVED]:["admin"],
  [OPERATIONAL_COMMAND.PROJECT_DELETED]:["admin"],
  [OPERATIONAL_COMMAND.PROJECT_PHASES_SAVED]:["admin"],
  [OPERATIONAL_COMMAND.LICENSE_CHECKLIST_SAVED]:["admin","engenheiro"],
  [OPERATIONAL_COMMAND.CONDOMINIUM_SAVED]:["admin","engenheiro"],
  [OPERATIONAL_COMMAND.MATERIAL_MOVEMENT_RECORDED]:["admin","compras","engenheiro","engenheiro_auditor","mestre"],
  [OPERATIONAL_COMMAND.SERVICE_EXECUTION_RECORDED]:["admin","compras","engenheiro","engenheiro_auditor","mestre"],
  [OPERATIONAL_COMMAND.MATERIAL_MOVEMENT_REVERSED]:["admin","compras","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.COMPOSITION_SAVED]:["admin","compras","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.COMPOSITION_DELETED]:["admin","compras","engenheiro","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.CONFERENCE_CREATED]:["admin","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.CONFERENCE_CANCELLED]:["admin","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.CONFERENCE_METADATA_UPDATED]:["admin","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.CONFERENCE_COMPLETED]:["admin","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.CONFERENCE_REOPENED]:["admin","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.CONFERENCE_FINDING_SAVED]:["admin","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.CONFERENCE_FINDING_CANCELLED]:["admin","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.CONFERENCE_FINDING_EVIDENCE_ADDED]:["admin","engenheiro_auditor","engenheiro"],
  [OPERATIONAL_COMMAND.CONFERENCE_FINDING_VALIDATED]:["admin","engenheiro_auditor"],
  [OPERATIONAL_COMMAND.QUALITY_PLAN_GENERATED]:["admin","engenheiro","engenheiro_auditor","qualidade"],
  [OPERATIONAL_COMMAND.QUALITY_ITEM_INSPECTED]:["admin","engenheiro","engenheiro_auditor","qualidade"],
  [OPERATIONAL_COMMAND.QUALITY_NONCONFORMITY_RESOLVED]:["admin","engenheiro","qualidade"],
  [OPERATIONAL_COMMAND.QUALITY_RECORD_RELEASED]:["admin","engenheiro","engenheiro_auditor","qualidade"],
  [OPERATIONAL_COMMAND.QUALITY_RECORD_DETAILS_UPDATED]:["admin","engenheiro","engenheiro_auditor","qualidade"],
  [OPERATIONAL_COMMAND.SAFETY_RISK_ANALYSIS_SAVED]:["admin","engenheiro","seguranca"],
  [OPERATIONAL_COMMAND.SAFETY_WORK_PERMIT_SAVED]:["admin","engenheiro","seguranca"],
  [OPERATIONAL_COMMAND.LOOKAHEAD_CREATED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_ADDED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre","qualidade","seguranca"],
  [OPERATIONAL_COMMAND.LOOKAHEAD_CONSTRAINT_RELEASED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre","qualidade","seguranca"],
  [OPERATIONAL_COMMAND.LOOKAHEAD_PACKAGE_COMMITTED]:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"],
  [OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_MIGRATED]:["admin"],
  [OPERATIONAL_COMMAND.EQUIPMENT_REGISTRY_CLASSIFIED]:["admin"],
  [OPERATIONAL_COMMAND.EQUIPMENT_SAVED]:["admin","engenheiro","engenheiro_auditor","compras","financeiro"],
  [OPERATIONAL_COMMAND.ASSET_SAVED]:["admin","financeiro","compras"],
  [OPERATIONAL_COMMAND.ASSETS_IMPORTED]:["admin","financeiro","compras"],
  [OPERATIONAL_COMMAND.ASSET_MOVED]:["admin","financeiro","compras"],
  [OPERATIONAL_COMMAND.ASSET_STATUS_CHANGED]:["admin","financeiro","compras"],
  [OPERATIONAL_COMMAND.EQUIPMENT_DEACTIVATED]:["admin","engenheiro","engenheiro_auditor","compras","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_OWNER_SAVED]:["admin","engenheiro","engenheiro_auditor","compras","financeiro"],
  // Papéis dos comandos de locação: fonte única compartilhada com a Central de locações.
  ...RENTAL_COMMAND_ROLES,
  [OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_SAVED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_MAINTENANCE_CANCELLED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_TRANSFERRED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_SAVED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_RESERVATION_CANCELLED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_UNAVAILABILITY_SAVED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
  [OPERATIONAL_COMMAND.EQUIPMENT_UNAVAILABILITY_CANCELLED]:["admin","engenheiro","engenheiro_auditor","financeiro"],
};
// Extraído do handler para ser testável sem mock de Supabase/HTTP - é o
// único ponto de rejeição por papel para comandos operacionais.
/**
 * @param {string} commandType
 * @param {string} role
 * @returns {RoleAuthorization}
 */
export const authorizeOperationalCommand = (commandType, role) => {
  const roles = OPERATIONAL_COMMAND_ROLES[commandType];
  if (!roles) return { ok:false, status:400, error:"Comando operacional inválido." };
  if (!roles.includes(role)) return { ok:false, status:403, error:"Seu perfil não pode executar este comando operacional." };
  return { ok:true };
};
