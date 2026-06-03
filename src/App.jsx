import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { loadData as supabaseLoad, saveData as supabaseSave } from "./supabase";

// ═══════════════════════════════════════════════════════════════════
// ARCD OBRAS — App.jsx auditado
// - Base compartilhada Supabase via supabase.js
// - Cadastro de obras, equipe, ponto, folha, relatórios e configurações
// - Transferência/demissão individual no ponto
// - Ponto sempre editável: conferência da obra não bloqueia ajustes posteriores
// - Solicitação de permissão por e-mail para hygorlp@gmail.com
// - Link de aprovação temporária por 30 minutos
// - Pagamento dia 20 para 1ª quinzena e dia 05 do mês seguinte para 2ª quinzena
// - Ajuste de pagamento por sábado/domingo/feriados
// - Feriados nacionais + Pernambuco + Caruaru
// - Regra: falta em dia útil imediatamente anterior/posterior perde feriado
// - Relatórios com gasto por obra, metragem quadrada e custo de mão de obra por m²
// - Interface reforçada para o Registro de Ponto, com ícones e navegação em destaque
// - Agente de IA para apoiar ponto, folha, obras, custos e alertas
// - Rebranding visual ARCD OBRA: linguagem gráfica geométrica, foco no ponto e navegação mais intuitiva
// ═══════════════════════════════════════════════════════════════════

const C = {
  bg: "#090907",
  surface: "#11110f",
  card: "#181713",
  card2: "#211f18",
  border: "#34301f",
  yellow: "#f6d833",
  yellowD: "#c39a16",
  yellowDim: "#30280d",
  green: "#52d273",
  red: "#ff5a47",
  blue: "#54a0ff",
  orange: "#ff9f1c",
  purple: "#b779ff",
  text: "#fff7d6",
  muted: "#8f8661",
  subtle: "#d7c98d",
  ivory: "#fff4c2",
  ink: "#050504",
  sand: "#c7b46a",
  line: "#4a4227",
  shadow: "rgba(0,0,0,.44)",
};

const CHART_COLORS = [C.yellow, C.green, C.blue, C.orange, C.purple, C.red, "#06b6d4", "#ec4899"];

const G = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600;700;800&display=swap');
:root{--bg:${C.bg};--surface:${C.surface};--card:${C.card};--yellow:${C.yellow};--text:${C.text};--muted:${C.muted}}
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{min-height:100%}
body{
  background:
    radial-gradient(circle at 16% 0%, ${C.yellow}15 0, transparent 24%),
    radial-gradient(circle at 100% 4%, ${C.orange}10 0, transparent 26%),
    linear-gradient(135deg, ${C.bg} 0%, #0d0c08 45%, #050504 100%);
  color:${C.text};font-family:'Barlow',Arial,sans-serif;-webkit-tap-highlight-color:transparent;
}
body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.12;background-image:linear-gradient(${C.yellow}22 1px, transparent 1px),linear-gradient(90deg, ${C.yellow}22 1px, transparent 1px);background-size:42px 42px;mask-image:linear-gradient(to bottom, black, transparent 80%)}
input,select,textarea,button{font-family:'Barlow',Arial,sans-serif}
button:disabled{opacity:.55;cursor:not-allowed!important}
button{touch-action:manipulation}
button:hover{filter:brightness(1.05);transform:translateY(-1px)}
button:active{transform:translateY(0) scale(.99)}
input:focus,select:focus,textarea:focus{outline:2px solid ${C.yellow}88;border-color:${C.yellow}!important;box-shadow:0 0 0 4px ${C.yellow}18}
.brand-slice{position:relative;overflow:hidden}.brand-slice:after{content:"";position:absolute;inset:auto -30px -26px auto;width:120px;height:120px;background:${C.yellow}16;transform:rotate(-18deg);border:1px solid ${C.yellow}25}
.point-pulse{box-shadow:0 0 0 0 ${C.yellow}44;animation:pulseYellow 2.2s infinite}
.lift-card{transition:transform .16s ease, border-color .16s ease, background .16s ease}.lift-card:hover{transform:translateY(-2px);border-color:${C.yellow}80;background:${C.card2}}
@keyframes pulseYellow{0%{box-shadow:0 0 0 0 ${C.yellow}44}70%{box-shadow:0 0 0 12px transparent}100%{box-shadow:0 0 0 0 transparent}}
::-webkit-scrollbar{width:7px;height:7px}
::-webkit-scrollbar-track{background:${C.surface}}
::-webkit-scrollbar-thumb{background:${C.line};border-radius:8px}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes fadeInUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
@keyframes spin{to{transform:rotate(360deg)}}
.anim{animation:fadeIn .25s ease}.animUp{animation:fadeInUp .35s ease}.no-scroll{overflow:hidden}
@media print{.no-print{display:none!important} body{background:#fff;color:#000} body:before{display:none}}
`;

// ═══════════════════════════════════════════════════════════════════
// Helpers gerais
// ═══════════════════════════════════════════════════════════════════

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const toLocalISODate = date => {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const today = () => toLocalISODate(new Date());

const fmt = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = iso => {
  if (!iso || typeof iso !== "string" || !iso.includes("-")) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

const fmtDateFull = iso => {
  if (!iso || typeof iso !== "string" || !iso.includes("-")) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const monthName = m => ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m] || "";
const fullMonth = m => ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][m] || "";

const getDays = (year, monthIndex) => {
  const days = [];
  const dt = new Date(year, monthIndex, 1, 12, 0, 0);

  while (dt.getMonth() === monthIndex) {
    days.push(toLocalISODate(dt));
    dt.setDate(dt.getDate() + 1);
  }

  return days;
};

// Configuração personalizável do período da folha (quinzenas).
// q2CloseDay === 0 significa "último dia do mês".
const PAYROLL_DEFAULTS = {
  q1OpenDay: 1,
  q1CloseDay: 15,
  q2OpenDay: 16,
  q2CloseDay: 0,
  q1PayDay: 20,
  q1PayMonth: "same", // "same" = mesmo mês | "next" = mês seguinte
  q2PayDay: 5,
  q2PayMonth: "next",
  adjustPayDate: true, // ajustar pagamento para dia útil (fim de semana/feriado)
};

const getPayrollSettings = config => {
  const p = (config && typeof config.payroll === "object" && config.payroll) || {};
  const day = (v, def) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 1 && n <= 31 ? n : def;
  };
  const closeDay = (v, def) => {
    if (v === 0 || v === "0" || v === "last" || v === "ultimo") return 0; // último dia do mês
    return day(v, def);
  };
  const payMonth = (v, def) => (v === "next" || v === "same" ? v : def);
  return {
    q1OpenDay: day(p.q1OpenDay, PAYROLL_DEFAULTS.q1OpenDay),
    q1CloseDay: day(p.q1CloseDay, PAYROLL_DEFAULTS.q1CloseDay),
    q2OpenDay: day(p.q2OpenDay, PAYROLL_DEFAULTS.q2OpenDay),
    q2CloseDay: closeDay(p.q2CloseDay, PAYROLL_DEFAULTS.q2CloseDay),
    q1PayDay: day(p.q1PayDay, PAYROLL_DEFAULTS.q1PayDay),
    q1PayMonth: payMonth(p.q1PayMonth, PAYROLL_DEFAULTS.q1PayMonth),
    q2PayDay: day(p.q2PayDay, PAYROLL_DEFAULTS.q2PayDay),
    q2PayMonth: payMonth(p.q2PayMonth, PAYROLL_DEFAULTS.q2PayMonth),
    adjustPayDate: p.adjustPayDate !== false,
  };
};

const getQ = (year, monthIndex, config) => {
  const s = getPayrollSettings(config);
  const all = getDays(year, monthIndex);
  const lastNum = Number(all[all.length - 1].split("-")[2]);
  const q1Close = Math.min(s.q1CloseDay, lastNum);
  const q2Close = s.q2CloseDay === 0 ? lastNum : Math.min(s.q2CloseDay, lastNum);
  const inRange = (d, from, to) => {
    const n = Number(d.split("-")[2]);
    return from <= to && n >= from && n <= to;
  };
  return {
    q1: all.filter(d => inRange(d, s.q1OpenDay, q1Close)),
    q2: all.filter(d => inRange(d, s.q2OpenDay, q2Close)),
    settings: s,
  };
};

// Identifica em qual quinzena configurada um dia (número) se encaixa.
const quinzenaForDay = (dayNum, config, lastNum = 31) => {
  const s = getPayrollSettings(config);
  const q2Close = s.q2CloseDay === 0 ? lastNum : s.q2CloseDay;
  if (dayNum >= s.q2OpenDay && dayNum <= q2Close) return "2";
  if (dayNum >= s.q1OpenDay && dayNum <= s.q1CloseDay) return "1";
  return dayNum <= s.q1CloseDay ? "1" : "2";
};

const fmtCPF = value => {
  const v = String(value || "").replace(/\D/g, "").slice(0, 11);
  return v
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const fmtPhone = value => {
  const v = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
};

const getAtt = (data, empId, date) => {
  const value = data?.attendance?.[empId]?.[date];
  if (!value) return null;
  if (typeof value === "string") return { status: value, ot: 0, note: "" };
  return {
    status: value.status || null,
    ot: Number(value.ot || 0),
    note: value.note || "",
  };
};

const attStatus = (data, empId, date) => getAtt(data, empId, date)?.status || null;

const isEmployeeEmployedOnDate = (employee, dateIso) => {
  if (!employee) return false;
  if (employee.startDate && dateIso < employee.startDate) return false;
  if (employee.endDate && dateIso > employee.endDate) return false;
  return true;
};

const escapeHtml = value => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#039;");

// ═══════════════════════════════════════════════════════════════════
// Feriados e calendário de pagamento
// ═══════════════════════════════════════════════════════════════════

const prDateAtNoon = (year, monthIndex, day) => new Date(year, monthIndex, day, 12, 0, 0);
const prIso = date => toLocalISODate(date);
const prParseIso = iso => {
  const [y, m, d] = iso.split("-").map(Number);
  return prDateAtNoon(y, m - 1, d);
};
const prAddDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return prDateAtNoon(d.getFullYear(), d.getMonth(), d.getDate());
};
const prUniqueDates = arr => [...new Set(arr.filter(Boolean))].sort();

const prEasterDate = year => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return prDateAtNoon(year, month, day);
};

const getOfficialHolidaysCaruaruPE = year => {
  const easter = prEasterDate(year);
  const goodFriday = prIso(prAddDays(easter, -2));
  const corpusChristi = prIso(prAddDays(easter, 60));

  return prUniqueDates([
    // Nacionais
    `${year}-01-01`,
    `${year}-04-21`,
    `${year}-05-01`,
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-11-20`,
    `${year}-12-25`,

    // Estadual — Pernambuco
    `${year}-03-06`,

    // Municipais — Caruaru
    goodFriday,
    `${year}-05-18`,
    corpusChristi,
    `${year}-06-24`,
    `${year}-09-15`,

    // São Pedro, 29/06, não foi incluído por ter sido substituído por Corpus Christi em 2024.
  ]);
};

const getPayrollHolidays = (data, year) => {
  const official = getOfficialHolidaysCaruaruPE(year);
  const custom = data?.config?.paymentHolidays || [];
  const customDates = custom
    .map(h => (typeof h === "string" ? h : h?.date || ""))
    .filter(Boolean);

  return prUniqueDates([...official, ...customDates]);
};

const prIsHoliday = (date, holidays) => holidays.includes(prIso(date));
const prIsWeekend = date => [0, 6].includes(date.getDay());
const prIsNonBusinessDay = (date, holidays) => prIsWeekend(date) || prIsHoliday(date, holidays);

const prPreviousBusinessDay = (date, holidays) => {
  let d = prAddDays(date, -1);
  while (prIsNonBusinessDay(d, holidays)) d = prAddDays(d, -1);
  return d;
};

const prNextBusinessDay = (date, holidays) => {
  let d = prAddDays(date, 1);
  while (prIsNonBusinessDay(d, holidays)) d = prAddDays(d, 1);
  return d;
};

const adjustPayrollPaymentDate = (baseDate, holidays) => {
  const day = baseDate.getDay();
  const isHoliday = prIsHoliday(baseDate, holidays);

  if (day === 6) return prPreviousBusinessDay(baseDate, holidays);
  if (day === 0) return prNextBusinessDay(baseDate, holidays);

  if (isHoliday) {
    const previousDay = prAddDays(baseDate, -1);
    if (previousDay.getDay() === 0) return prNextBusinessDay(baseDate, holidays);
    return prPreviousBusinessDay(baseDate, holidays);
  }

  return baseDate;
};

const getPayrollPaymentCalendar = (year, monthIndex, q, data) => {
  // Datas de pagamento definidas nas configurações (por quinzena).
  // Padrão: 1ª quinzena dia 20 (mesmo mês), 2ª quinzena dia 05 (mês seguinte).
  const s = getPayrollSettings(data?.config);
  const isQ1 = q === "1";
  const payDay = isQ1 ? s.q1PayDay : s.q2PayDay;
  const payMonthMode = isQ1 ? s.q1PayMonth : s.q2PayMonth;
  const offset = payMonthMode === "next" ? 1 : 0;
  const rawMonth = monthIndex + offset;
  const paymentYear = year + Math.floor(rawMonth / 12);
  const normalizedPaymentMonth = ((rawMonth % 12) + 12) % 12;
  const monthLen = new Date(paymentYear, normalizedPaymentMonth + 1, 0).getDate();
  const safeDay = Math.min(payDay, monthLen);
  const baseDate = prDateAtNoon(paymentYear, normalizedPaymentMonth, safeDay);
  const holidays = getPayrollHolidays(data, paymentYear);
  const adjustedDate = s.adjustPayDate ? adjustPayrollPaymentDate(baseDate, holidays) : baseDate;

  return {
    baseDate: prIso(baseDate),
    paymentDate: prIso(adjustedDate),
    adjusted: prIso(baseDate) !== prIso(adjustedDate),
  };
};

const prIsWeekdayIso = iso => {
  const day = prParseIso(iso).getDay();
  return day >= 1 && day <= 5;
};

const prPreviousWorkdayIso = (iso, holidays) => {
  let d = prAddDays(prParseIso(iso), -1);
  while (prIsNonBusinessDay(d, holidays)) d = prAddDays(d, -1);
  return prIso(d);
};

const prNextWorkdayIso = (iso, holidays) => {
  let d = prAddDays(prParseIso(iso), 1);
  while (prIsNonBusinessDay(d, holidays)) d = prAddDays(d, 1);
  return prIso(d);
};

const prIsMarkedAbsent = (data, empId, dateIso) => getAtt(data, empId, dateIso)?.status === "F";

const getHolidayPayRule = (data, employee, holidayIso, holidays) => {
  const before = prPreviousWorkdayIso(holidayIso, holidays);
  const after = prNextWorkdayIso(holidayIso, holidays);
  const missedBefore = prIsMarkedAbsent(data, employee.id, before);
  const missedAfter = prIsMarkedAbsent(data, employee.id, after);
  const losesHoliday = missedBefore || missedAfter;

  return {
    holidayIso,
    before,
    after,
    missedBefore,
    missedAfter,
    losesHoliday,
    amount: losesHoliday ? 0 : Number(employee.dailyRate || 0),
  };
};

// ═══════════════════════════════════════════════════════════════════
// Bloqueio de ponto por obra/data e permissões
// ═══════════════════════════════════════════════════════════════════

const attendanceLockKey = (obraId, date) => `${date}__${obraId}`;
const getAttendanceLock = (data, obraId, date) => data?.attendanceLocks?.[attendanceLockKey(obraId, date)] || null;
// Bloqueio desativado: o ponto continua editável mesmo após finalizar/fechar a obra.
// Mantido como função para preservar todas as chamadas existentes sem efeito de bloqueio.
const isAttendanceLocked = () => false;

const hasApprovedUnlock = (data, obraId, date) => {
  const now = new Date();
  return (data?.unlockRequests || []).some(r =>
    r.obraId === obraId &&
    r.date === date &&
    r.status === "approved" &&
    r.validUntil &&
    new Date(r.validUntil) > now
  );
};

const canEditAttendance = (data, obraId, date) => !isAttendanceLocked(data, obraId, date) || hasApprovedUnlock(data, obraId, date);

const buildPermissionEmail = ({ to, obraName, date, employeeName, reason, approvalLink }) => {
  const subject = `Permissão para alterar ponto - ${obraName} - ${fmtDateFull(date)}`;
  const body = [
    "Solicitação de permissão para alteração de ponto.",
    "",
    `Obra: ${obraName}`,
    `Data do ponto: ${fmtDateFull(date)}`,
    employeeName ? `Trabalhador: ${employeeName}` : "Trabalhador: todos / não especificado",
    "",
    "Motivo informado:",
    reason || "Não informado.",
    "",
    "Para aprovar a alteração por 30 minutos, acesse o link abaixo:",
    approvalLink,
    "",
    "Observação: a aprovação pelo link exige que o aprovador tenha acesso ao sistema.",
    "",
    "Solicitação gerada automaticamente pelo sistema ArcD Obras.",
  ].join("\n");

  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

// ═══════════════════════════════════════════════════════════════════
// Controle de ponto cadastrado por obra
// ═══════════════════════════════════════════════════════════════════

const getAttendanceStatusForDate = (data, empId, date) => getAtt(data, empId, date)?.status || null;

const isValidAttendanceStatus = status => status === "P" || status === "M" || status === "F";

const getObraAttendanceSummary = (data, date) => {
  const activeObras = (data?.obras || []).filter(o => o.status !== "done");
  const activeEmployees = (data?.employees || []).filter(e => e.active !== false);

  return activeObras.map(obra => {
    const employees = activeEmployees.filter(e => e.obra === obra.id && isEmployeeEmployedOnDate(e, date));
    const registeredEmployees = employees.filter(e => isValidAttendanceStatus(getAttendanceStatusForDate(data, e.id, date)));
    const missingEmployees = employees.filter(e => !isValidAttendanceStatus(getAttendanceStatusForDate(data, e.id, date)));

    return {
      obraId: obra.id,
      obraName: obra.name,
      totalEmployees: employees.length,
      registeredCount: registeredEmployees.length,
      missingCount: missingEmployees.length,
      completed: employees.length > 0 && missingEmployees.length === 0,
      hasTeam: employees.length > 0,
      missingEmployees,
    };
  });
};

const getAttendanceCompletionMessage = summary => {
  const obrasWithTeam = summary.filter(o => o.hasTeam);
  const pendingObras = summary.filter(o => o.hasTeam && !o.completed);
  const completedObras = summary.filter(o => o.hasTeam && o.completed);
  const obrasWithoutTeam = summary.filter(o => !o.hasTeam);

  return {
    allDone: obrasWithTeam.length > 0 && pendingObras.length === 0,
    pendingObras,
    completedObras,
    obrasWithoutTeam,
    totalWithTeam: obrasWithTeam.length,
  };
};

// ═══════════════════════════════════════════════════════════════════
// Dados padrão e normalização
// ═══════════════════════════════════════════════════════════════════

const DEFAULT = () => ({
  userName: "",
  config: {
    companyName: "ArcD Obras",
    productName: "Gestão de Equipes",
    hrEmail: "",
    hrName: "",
    cnpj: "",
    approverEmail: "hygorlp@gmail.com",
    paymentHolidays: [],
    payroll: { ...PAYROLL_DEFAULTS },
  },
  obras: [
    { id: uid(), name: "Obra 1", address: "", engineer: "", startDate: "", status: "active", areaM2: 0 },
    { id: uid(), name: "Obra 2", address: "", engineer: "", startDate: "", status: "active", areaM2: 0 },
  ],
  employees: [],
  attendance: {},
  advances: [],
  attendanceLocks: {},
  unlockRequests: [],
  dailyCheckDate: "",
  changeLog: [],
});

const normalizeData = incoming => {
  const base = DEFAULT();
  const d = incoming && typeof incoming === "object" ? incoming : {};

  return {
    ...base,
    ...d,
    config: {
      ...base.config,
      ...(d.config || {}),
      approverEmail: d.config?.approverEmail || "hygorlp@gmail.com",
      paymentHolidays: Array.isArray(d.config?.paymentHolidays) ? d.config.paymentHolidays : [],
      payroll: getPayrollSettings(d.config),
    },
    obras: Array.isArray(d.obras) ? d.obras.map(o => ({
      id: o.id || uid(),
      name: o.name || "Obra sem nome",
      address: o.address || "",
      engineer: o.engineer || "",
      startDate: o.startDate || "",
      status: o.status || "active",
      areaM2: Number(o.areaM2 || 0),
    })) : base.obras,
    employees: Array.isArray(d.employees) ? d.employees.map(e => ({
      id: e.id || uid(),
      name: e.name || "",
      role: e.role || "",
      cpf: e.cpf || "",
      phone: e.phone || "",
      pixKey: e.pixKey || "",
      pixType: e.pixType || "",
      pixHolder: e.pixHolder || "",
      dailyRate: Number(e.dailyRate || 0),
      vtDaily: Number(e.vtDaily || 0),
      vrDaily: Number(e.vrDaily || 0),
      obra: e.obra || "",
      active: e.active !== false,
      startDate: e.startDate || "",
      endDate: e.endDate || "",
      terminationReason: e.terminationReason || "",
      lastObra: e.lastObra || "",
    })) : [],
    attendance: d.attendance || {},
    advances: Array.isArray(d.advances) ? d.advances : [],
    attendanceLocks: d.attendanceLocks || {},
    unlockRequests: Array.isArray(d.unlockRequests) ? d.unlockRequests : [],
    dailyCheckDate: d.dailyCheckDate || "",
    changeLog: Array.isArray(d.changeLog) ? d.changeLog : [],
  };
};

// ═══════════════════════════════════════════════════════════════════
// UI base
// ═══════════════════════════════════════════════════════════════════

function Ic({ n, s = 16, color }) {
  const map = {
    home: "⌂",
    users: "▥",
    clock: "◷",
    dollar: "$",
    chart: "◔",
    ia: "✦",
    brain: "✦",
    robot: "◎",
    plus: "+",
    edit: "✎",
    trash: "×",
    x: "×",
    check: "✓",
    mail: "✉",
    lock: "▣",
    unlock: "▢",
    file: "▤",
    download: "↓",
    copy: "⧉",
    money: "½",
    calendar: "▦",
    alert: "!",
    settings: "⚙",
    phone: "☎",
  };

  return (
    <span
      aria-hidden="true"
      style={{
        width: s + 4,
        height: s + 4,
        fontSize: s,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: color || `var(--ic-color, ${C.yellow})`,
        fontWeight: 900,
        fontFamily: "'Barlow Condensed', Arial, sans-serif",
      }}
    >
      {map[n] || "•"}
    </span>
  );
}

function BrandMark({ compact = false, dark = false }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <div
        style={{
          width: compact ? 34 : 42,
          height: compact ? 34 : 42,
          background: C.yellow,
          color: C.ink,
          display: "grid",
          placeItems: "center",
          fontFamily: "'Bebas Neue', Arial, sans-serif",
          fontSize: compact ? 22 : 28,
          letterSpacing: -1,
          boxShadow: `8px 8px 0 ${dark ? "rgba(0,0,0,.18)" : C.yellowDim}`,
          transform: "skew(-7deg)",
          flex: "0 0 auto",
        }}
      >
        A
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: "'Bebas Neue', Arial, sans-serif", color: dark ? C.ink : C.yellow, fontSize: compact ? 24 : 30, lineHeight: .9, letterSpacing: 1.6 }}>
          ARCD OBRA
        </p>
        {!compact && (
          <p style={{ color: dark ? "rgba(5,5,4,.72)" : C.muted, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.4 }}>
            Ponto · Equipe · Custo
          </p>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 2 }}>
      <div>
        {eyebrow && <p style={{ color: C.yellow, fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 3 }}>{eyebrow}</p>}
        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, lineHeight: .95, letterSpacing: 1.6, color: C.text }}>{title}</h2>
        {subtitle && <p style={{ color: C.muted, fontSize: 13, marginTop: 5 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Btn({ children, onClick, v = "primary", size = "md", full = false, disabled = false, type = "button", style = {} }) {
  const variants = {
    primary: { bg: C.yellow, color: C.ink, border: C.yellow, shadow: `${C.yellow}28` },
    warning: { bg: C.yellow, color: C.ink, border: C.yellow, shadow: `${C.yellow}28` },
    danger: { bg: C.red, color: "white", border: C.red, shadow: `${C.red}22` },
    success: { bg: C.green, color: C.ink, border: C.green, shadow: `${C.green}18` },
    info: { bg: C.blue, color: "white", border: C.blue, shadow: `${C.blue}20` },
    ghost: { bg: "rgba(255,255,255,.02)", color: C.text, border: C.line, shadow: "transparent" },
    dark: { bg: C.card2, color: C.text, border: C.line, shadow: "transparent" },
  };
  const vv = variants[v] || variants.primary;
  const py = size === "sm" ? 8 : size === "lg" ? 15 : 11;
  const px = size === "sm" ? 11 : 15;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: full ? "100%" : "auto",
        border: `1.5px solid ${vv.border}`,
        background: vv.bg,
        color: vv.color,
        padding: `${py}px ${px}px`,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Barlow Condensed', Arial, sans-serif",
        fontWeight: 900,
        letterSpacing: 0.85,
        textTransform: "uppercase",
        display: "inline-flex",
        gap: 7,
        alignItems: "center",
        justifyContent: "center",
        fontSize: size === "sm" ? 12 : 14,
        borderRadius: 14,
        boxShadow: `0 10px 26px ${vv.shadow}`,
        transition: "transform .15s ease, filter .15s ease, box-shadow .15s ease",
        "--ic-color": v === "primary" || v === "warning" || v === "success" ? C.ink : C.yellow,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Inp({ label, value, onChange, type = "text", placeholder = "", max, min, disabled = false, multiline = false }) {
  const Comp = multiline ? "textarea" : "input";

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <span style={{ color: C.subtle, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>}
      <Comp
        type={multiline ? undefined : type}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        max={max}
        min={min}
        disabled={disabled}
        rows={multiline ? 4 : undefined}
        style={{
          width: "100%",
          background: disabled ? C.surface : C.card2,
          border: `1px solid ${C.line}`,
          color: C.text,
          padding: "12px 13px",
          outline: "none",
          fontSize: 14,
          borderRadius: 14,
          resize: "vertical",
        }}
      />
    </label>
  );
}

function Sel({ label, value, onChange, options = [], disabled = false }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <span style={{ color: C.subtle, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>}
      <select
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%",
          background: disabled ? C.surface : C.card2,
          border: `1px solid ${C.line}`,
          color: C.text,
          padding: "12px 13px",
          outline: "none",
          fontSize: 14,
          borderRadius: 14,
        }}
      >
        {options.map(o => <option key={String(o.v)} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

function Badge({ children, color = C.yellow }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "4px 8px",
      border: `1px solid ${color}66`,
      background: `${color}18`,
      color,
      fontSize: 10,
      fontWeight: 900,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginTop: 4,
      marginRight: 4,
      borderRadius: 999,
    }}>
      {children}
    </span>
  );
}

function Divider() {
  return <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.line}, transparent)`, margin: "12px 0" }} />;
}

function Modal({ title, children, onClose, wide = false }) {
  useEffect(() => {
    document.body.classList.add("no-scroll");
    return () => document.body.classList.remove("no-scroll");
  }, []);

  return (
    <div
      className="no-print"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "rgba(5,5,4,.78)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 14,
      }}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="animUp"
        style={{
          width: "100%",
          maxWidth: wide ? 720 : 460,
          maxHeight: "92vh",
          overflowY: "auto",
          background: `linear-gradient(180deg, ${C.card2}, ${C.surface})`,
          border: `1px solid ${C.line}`,
          borderRadius: 22,
          boxShadow: `0 24px 90px ${C.shadow}`,
        }}
      >
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 16px",
          borderBottom: `1px solid ${C.border}`,
          background: C.card2,
        }}>
          <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, fontSize: 20, letterSpacing: 0.8, textTransform: "uppercase" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: C.text, fontSize: 24, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const color = toast.type === "error" ? C.red : toast.type === "warn" ? C.yellow : C.green;
  return (
    <div className="no-print" style={{
      position: "fixed",
      left: "50%",
      bottom: 18,
      transform: "translateX(-50%)",
      zIndex: 1200,
      maxWidth: "calc(100vw - 28px)",
      background: `linear-gradient(180deg, ${C.card2}, ${C.card})`,
      border: `1px solid ${color}`,
      borderLeft: `5px solid ${color}`,
      color: C.text,
      padding: "12px 14px",
      boxShadow: "0 10px 40px rgba(0,0,0,.45)",
      fontSize: 13,
      fontWeight: 800,
      borderRadius: 16,
    }}>
      {toast.msg}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════════

function Dashboard({ data, onTab }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const { q1, q2 } = getQ(year, month, data.config);
  const qDays = quinzenaForDay(day, data.config, new Date(year, month + 1, 0).getDate()) === "1" ? q1 : q2;
  const todayIso = today();
  const activeEmps = data.employees.filter(e => e.active !== false);
  const activeObras = data.obras.filter(o => o.status !== "done");

  const presentes = activeEmps.filter(e => attStatus(data, e.id, todayIso) === "P").length;
  const faltas = activeEmps.filter(e => attStatus(data, e.id, todayIso) === "F").length;
  const meiodia = activeEmps.filter(e => attStatus(data, e.id, todayIso) === "M").length;
  const semReg = Math.max(0, activeEmps.length - presentes - faltas - meiodia);
  const checkPending = activeEmps.length > 0 && data.dailyCheckDate !== todayIso;
  const todayCompletion = activeEmps.length ? Math.round(((presentes + faltas + meiodia) / activeEmps.length) * 100) : 0;

  const qTotal = activeEmps.reduce((sum, e) => {
    const empValue = qDays.reduce((s, d) => {
      const st = attStatus(data, e.id, d);
      if (st === "P") return s + Number(e.dailyRate || 0);
      if (st === "M") return s + Number(e.dailyRate || 0) * 0.5;
      return s;
    }, 0);
    return sum + empValue;
  }, 0);

  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const iso = toLocalISODate(dt);
    last7.push({
      d: fmtDate(iso),
      P: activeEmps.filter(e => attStatus(data, e.id, iso) === "P").length,
      M: activeEmps.filter(e => attStatus(data, e.id, iso) === "M").length,
      F: activeEmps.filter(e => attStatus(data, e.id, iso) === "F").length,
    });
  }

  const pieData = [
    { name: "Presente", value: presentes, color: C.green },
    { name: "Meio dia", value: meiodia, color: C.yellow },
    { name: "Falta", value: faltas, color: C.red },
    { name: "Sem registro", value: semReg, color: C.muted },
  ].filter(i => i.value > 0);

  const Stat = ({ label, value, sub, color, icon, tab }) => (
    <button onClick={() => tab && onTab(tab)} className="lift-card" style={{
      background: `linear-gradient(180deg, ${C.card2}, ${C.card})`,
      border: `1px solid ${C.line}`,
      borderTop: `4px solid ${color}`,
      padding: 14,
      borderRadius: 18,
      textAlign: "left",
      color: C.text,
      cursor: tab ? "pointer" : "default",
      minHeight: 104,
      boxShadow: `0 12px 34px ${C.shadow}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ color: C.subtle, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.1 }}>{label}</span>
        <Ic n={icon} s={20} color={color} />
      </div>
      <p style={{ fontFamily: "'Bebas Neue'", color, fontSize: 36, letterSpacing: 1, lineHeight: .95, marginTop: 8 }}>{value}</p>
      {sub && <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{sub}</p>}
    </button>
  );

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="brand-slice" style={{
        background: `linear-gradient(135deg, ${C.yellow} 0%, ${C.yellowD} 58%, #5d4b0d 100%)`,
        color: C.ink,
        borderRadius: 24,
        padding: 18,
        border: `1px solid ${C.yellow}`,
        boxShadow: `0 20px 60px ${C.yellow}1f`,
      }}>
        <BrandMark dark />
        <div style={{ display: "grid", gridTemplateColumns: "1.25fr .75fr", gap: 14, alignItems: "end", marginTop: 18 }}>
          <div>
            <p style={{ fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.4, fontSize: 11, opacity: .72 }}>Ação principal</p>
            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 46, lineHeight: .88, letterSpacing: 1.8 }}>Registrar o ponto sem ruído.</h2>
            <p style={{ fontWeight: 700, fontSize: 13, marginTop: 9, maxWidth: 520 }}>Obras, equipes, folha e custos em uma leitura rápida. O ponto é o centro da operação.</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: 58, lineHeight: .85 }}>{todayCompletion}%</p>
            <p style={{ fontWeight: 900, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>do ponto hoje</p>
          </div>
        </div>
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Btn onClick={() => onTab("ponto")} v="dark" full style={{ background: C.ink, color: C.yellow, borderColor: C.ink, "--ic-color": C.yellow }}><Ic n="clock" /> Abrir ponto</Btn>
          <Btn onClick={() => onTab("ia")} v="ghost" full style={{ borderColor: "rgba(5,5,4,.35)", color: C.ink, background: "rgba(5,5,4,.08)", "--ic-color": C.ink }}><Ic n="brain" /> Agente IA</Btn>
        </div>
      </div>

      {checkPending && (
        <button onClick={() => onTab("ponto")} className="lift-card" style={{
          background: `${C.yellow}14`,
          border: `1px solid ${C.yellow}88`,
          borderLeft: `6px solid ${C.yellow}`,
          color: C.yellow,
          borderRadius: 18,
          padding: 14,
          cursor: "pointer",
          textAlign: "left",
        }}>
          <p style={{ fontFamily: "'Barlow Condensed'", fontSize: 18, fontWeight: 900, textTransform: "uppercase" }}>Verificação diária pendente</p>
          <p style={{ color: C.subtle, fontSize: 12 }}>Confirme transferência/demissão antes de lançar o ponto.</p>
        </button>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Stat label="Trabalhadores" value={activeEmps.length} sub="ativos" color={C.yellow} icon="users" tab="equipe" />
        <Stat label="Obras" value={activeObras.length} sub="em andamento" color={C.blue} icon="home" tab="obras" />
        <Stat label="Presentes" value={presentes} sub={`${semReg} sem registro hoje`} color={C.green} icon="check" tab="ponto" />
        <Stat label="Quinzena" value={fmt(qTotal)} sub={`${qDays.length} dias no período`} color={C.purple} icon="dollar" tab="folha" />
      </div>

      <div className="lift-card" style={{ background: `linear-gradient(180deg, ${C.card2}, ${C.card})`, border: `1px solid ${C.line}`, padding: 14, borderRadius: 20 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Presença — últimos 7 dias</h3>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last7}>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="d" stroke={C.muted} fontSize={11} />
              <YAxis stroke={C.muted} fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.line}`, color: C.text }} />
              <Bar dataKey="P" stackId="a" fill={C.green} radius={[6, 6, 0, 0]} />
              <Bar dataKey="M" stackId="a" fill={C.yellow} />
              <Bar dataKey="F" stackId="a" fill={C.red} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="lift-card" style={{ background: `linear-gradient(180deg, ${C.card2}, ${C.card})`, border: `1px solid ${C.line}`, padding: 14, borderRadius: 20 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Distribuição de hoje</h3>
        <div style={{ height: 210 }}>
          {pieData.length === 0 ? (
            <p style={{ color: C.muted }}>Sem dados de ponto hoje.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {pieData.map((entry, index) => <Cell key={entry.name} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.line}`, color: C.text }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        <Btn onClick={() => onTab("ponto")} full><Ic n="clock" /> Registrar ponto</Btn>
        <Btn onClick={() => onTab("relat")} v="ghost" full><Ic n="chart" /> Ver custos</Btn>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// Obras
// ═══════════════════════════════════════════════════════════════════

function Obras({ data, update, showToast }) {
  const empty = { id: "", name: "", address: "", engineer: "", startDate: "", status: "active", areaM2: "" };
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");

  const setField = key => value => setForm(f => ({ ...f, [key]: value }));

  const save = () => {
    if (!form.name.trim()) {
      showToast("Nome da obra obrigatório.", "error");
      return;
    }

    const areaM2 = Number(form.areaM2 || 0);

    if (areaM2 < 0) {
      showToast("A metragem quadrada não pode ser negativa.", "error");
      return;
    }

    const payload = {
      ...form,
      id: form.id || uid(),
      areaM2,
    };

    const obras = form.id ? data.obras.map(o => (o.id === form.id ? payload : o)) : [...data.obras, payload];
    update({ ...data, obras });
    setModal(false);
    showToast(form.id ? "Obra atualizada." : "Obra cadastrada.");
  };

  const remove = id => {
    if (data.employees.some(e => e.obra === id || e.lastObra === id)) {
      showToast("Não é possível apagar obra com histórico de funcionários.", "error");
      return;
    }
    if (!window.confirm("Remover obra?")) return;
    update({ ...data, obras: data.obras.filter(o => o.id !== id) });
    showToast("Obra removida.");
  };

  const list = data.obras.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
  const statusMap = {
    active: { l: "Ativa", c: C.green },
    paused: { l: "Pausada", c: C.yellow },
    done: { l: "Concluída", c: C.muted },
  };

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 30, letterSpacing: 2, color: C.yellow }}>Obras</h2>
          <p style={{ color: C.muted, fontSize: 13 }}>{data.obras.length} cadastradas</p>
        </div>
        <Btn onClick={() => { setForm(empty); setModal(true); }}><Ic n="plus" /> Nova</Btn>
      </div>

      <Inp value={search} onChange={setSearch} placeholder="Buscar obra..." />

      {list.map(o => {
        const count = data.employees.filter(e => e.active !== false && e.obra === o.id).length;
        const st = statusMap[o.status] || statusMap.active;
        const area = Number(o.areaM2 || 0);
        return (
          <div key={o.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${st.c}`, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 18 }}>{o.name}</p>
                <Badge color={st.c}>{st.l}</Badge>
                <p style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>{count} trabalhador{count !== 1 ? "es" : ""} ativo{count !== 1 ? "s" : ""}</p>
                {area > 0 && <p style={{ color: C.yellow, fontSize: 12, marginTop: 4 }}>Área: {area.toLocaleString("pt-BR")} m²</p>}
                {o.address && <p style={{ color: C.subtle, fontSize: 12, marginTop: 4 }}>{o.address}</p>}
                {o.engineer && <p style={{ color: C.subtle, fontSize: 12 }}>Responsável: {o.engineer}</p>}
                {o.startDate && <p style={{ color: C.subtle, fontSize: 12 }}>Início: {fmtDateFull(o.startDate)}</p>}
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
                <Btn v="ghost" size="sm" onClick={() => { setForm({ ...o, areaM2: String(o.areaM2 || "") }); setModal(true); }}><Ic n="edit" /></Btn>
                <Btn v="danger" size="sm" onClick={() => remove(o.id)}><Ic n="trash" /></Btn>
              </div>
            </div>
          </div>
        );
      })}

      {modal && (
        <Modal title={form.id ? "Editar obra" : "Nova obra"} onClose={() => setModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Inp label="Nome *" value={form.name} onChange={setField("name")} />
            <Inp label="Metragem quadrada (m²)" type="number" value={form.areaM2} onChange={setField("areaM2")} placeholder="Ex.: 250" />
            <Inp label="Endereço" value={form.address} onChange={setField("address")} />
            <Inp label="Responsável" value={form.engineer} onChange={setField("engineer")} />
            <Inp label="Data de início" type="date" value={form.startDate} onChange={setField("startDate")} />
            <Sel label="Status" value={form.status} onChange={setField("status")} options={[
              { v: "active", l: "Ativa" },
              { v: "paused", l: "Pausada" },
              { v: "done", l: "Concluída" },
            ]} />
            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="ghost" onClick={() => setModal(false)} full>Cancelar</Btn>
              <Btn onClick={save} full><Ic n="check" /> Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Equipe
// ═══════════════════════════════════════════════════════════════════

function Equipe({ data, update, showToast }) {
  const emptyEmp = {
    id: "",
    name: "",
    role: "",
    cpf: "",
    phone: "",
    pixKey: "",
    pixType: "",
    pixHolder: "",
    dailyRate: "",
    vtDaily: "",
    vrDaily: "",
    obra: "",
    active: true,
    startDate: "",
    endDate: "",
    terminationReason: "",
    lastObra: "",
  };

  const [modal, setModal] = useState(false);
  const [advModal, setAdvModal] = useState(null);
  const [form, setForm] = useState(emptyEmp);
  const [search, setSearch] = useState("");
  const [filterObra, setFilterObra] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [advForm, setAdvForm] = useState({ amount: "", description: "", date: today() });

  const F = key => value => setForm(f => ({ ...f, [key]: value }));
  const obraName = id => data.obras.find(o => o.id === id)?.name || "—";
  const empAdvances = id => data.advances.filter(a => a.empId === id);

  const saveEmp = () => {
    if (!form.name.trim() || !form.dailyRate || !form.startDate || !form.obra) {
      showToast("Nome, admissão, diária e obra são obrigatórios.", "error");
      return;
    }

    if (form.active === false && !form.endDate) {
      showToast("Informe a data de término para inativar/demitir.", "error");
      return;
    }

    const before = data.employees.find(e => e.id === form.id);
    const payload = {
      ...form,
      id: form.id || uid(),
      dailyRate: Number(form.dailyRate || 0),
      vtDaily: Number(form.vtDaily || 0),
      vrDaily: Number(form.vrDaily || 0),
      active: form.active !== false,
      endDate: form.active === false ? form.endDate : "",
      terminationReason: form.active === false ? (form.terminationReason || "Inativado") : "",
      lastObra: form.active === false ? (before?.obra || form.obra) : (form.lastObra || ""),
    };

    const changeLog = [...data.changeLog];

    if (!form.id) {
      changeLog.push({ id: uid(), date: today(), type: "created", empId: payload.id, empName: payload.name, message: `Funcionário cadastrado: ${payload.name}` });
    }

    if (before && before.obra !== payload.obra) {
      changeLog.push({ id: uid(), date: today(), type: "transfer", empId: payload.id, empName: payload.name, from: obraName(before.obra), to: obraName(payload.obra), message: `${payload.name} transferido de ${obraName(before.obra)} para ${obraName(payload.obra)}` });
    }

    if (before && before.active !== false && payload.active === false) {
      changeLog.push({ id: uid(), date: payload.endDate || today(), type: "dismissal", empId: payload.id, empName: payload.name, from: obraName(before.obra), message: `${payload.name} inativado/demitido em ${fmtDateFull(payload.endDate)}` });
    }

    const employees = form.id ? data.employees.map(e => (e.id === form.id ? payload : e)) : [...data.employees, payload];
    update({ ...data, employees, changeLog });
    setModal(false);
    showToast(form.id ? "Funcionário atualizado." : "Funcionário cadastrado.");
  };

  const archiveEmp = id => {
    const emp = data.employees.find(e => e.id === id);
    if (!emp) return;
    if (!window.confirm(`Inativar ${emp.name}? O histórico será preservado.`)) return;
    const endDate = window.prompt("Data de término no formato AAAA-MM-DD:", today());
    if (!endDate) {
      showToast("Data de término obrigatória.", "error");
      return;
    }

    const employees = data.employees.map(e => e.id === id ? { ...e, active: false, endDate, terminationReason: "Inativado", lastObra: e.obra } : e);
    const changeLog = [...data.changeLog, { id: uid(), date: endDate, type: "dismissal", empId: emp.id, empName: emp.name, from: obraName(emp.obra), message: `${emp.name} inativado em ${fmtDateFull(endDate)}` }];
    update({ ...data, employees, changeLog });
    showToast("Funcionário inativado com histórico preservado.");
  };

  const saveAdv = () => {
    if (!advForm.amount || isNaN(Number(advForm.amount))) {
      showToast("Valor do adiantamento inválido.", "error");
      return;
    }
    const advances = [...data.advances, { id: uid(), empId: advModal, date: advForm.date || today(), amount: Number(advForm.amount), description: advForm.description || "Adiantamento" }];
    update({ ...data, advances });
    setAdvModal(null);
    setAdvForm({ amount: "", description: "", date: today() });
    showToast("Adiantamento registrado.");
  };

  const removeAdv = id => {
    if (!window.confirm("Remover adiantamento?")) return;
    update({ ...data, advances: data.advances.filter(a => a.id !== id) });
  };

  const list = data.employees
    .filter(e => showInactive || e.active !== false)
    .filter(e => filterObra === "all" || e.obra === filterObra || e.lastObra === filterObra)
    .filter(e => [e.name, e.role, e.cpf, e.phone].join(" ").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 30, letterSpacing: 2, color: C.yellow }}>Equipe</h2>
          <p style={{ color: C.muted, fontSize: 13 }}>{data.employees.length} cadastrados · {data.employees.filter(e => e.active !== false).length} ativos</p>
        </div>
        <Btn onClick={() => { setForm({ ...emptyEmp, obra: data.obras[0]?.id || "" }); setModal(true); }}><Ic n="plus" /> Novo</Btn>
      </div>

      <Inp value={search} onChange={setSearch} placeholder="Buscar por nome, função, CPF ou telefone..." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
        <Sel value={filterObra} onChange={setFilterObra} options={[{ v: "all", l: "Todas as obras" }, ...data.obras.map(o => ({ v: o.id, l: o.name }))]} />
        <Btn v={showInactive ? "warning" : "ghost"} onClick={() => setShowInactive(v => !v)}>{showInactive ? "Com inativos" : "Só ativos"}</Btn>
      </div>

      {list.length === 0 && <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20, textAlign: "center", color: C.muted }}>Nenhum funcionário encontrado.</div>}

      {list.map(e => {
        const advs = empAdvances(e.id);
        const totalAdv = advs.reduce((s, a) => s + Number(a.amount || 0), 0);
        const exp = expandedId === e.id;
        return (
          <div key={e.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${e.active === false ? C.muted : C.yellow}` }}>
            <div style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <button onClick={() => setExpandedId(exp ? null : e.id)} style={{ flex: 1, background: "transparent", border: 0, color: C.text, textAlign: "left", cursor: "pointer" }}>
                  <p style={{ fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 18 }}>{e.name}</p>
                  <p style={{ color: C.muted, fontSize: 12 }}>{obraName(e.obra)}{e.role ? ` · ${e.role}` : ""}</p>
                  <div style={{ marginTop: 4 }}>
                    {e.active === false && <Badge color={C.muted}>Inativo</Badge>}
                    <Badge color={C.yellow}>{fmt(e.dailyRate)}/dia</Badge>
                    {totalAdv > 0 && <Badge color={C.red}>Adiant. {fmt(totalAdv)}</Badge>}
                  </div>
                </button>
                <div style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
                  <Btn v="ghost" size="sm" onClick={() => { setForm({ ...e, dailyRate: String(e.dailyRate || ""), vtDaily: String(e.vtDaily || ""), vrDaily: String(e.vrDaily || "") }); setModal(true); }}><Ic n="edit" /></Btn>
                  {e.active !== false && <Btn v="danger" size="sm" onClick={() => archiveEmp(e.id)}><Ic n="x" /></Btn>}
                </div>
              </div>
            </div>

            {exp && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: 14, background: C.surface }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <p style={{ color: C.subtle, fontSize: 12 }}>CPF: {e.cpf || "—"}</p>
                  <p style={{ color: C.subtle, fontSize: 12 }}>Telefone: {e.phone || "—"}</p>
                  <p style={{ color: C.subtle, fontSize: 12 }}>PIX: {e.pixKey || "—"}</p>
                  <p style={{ color: C.subtle, fontSize: 12 }}>Admissão: {fmtDateFull(e.startDate)}</p>
                  {e.endDate && <p style={{ color: C.red, fontSize: 12 }}>Término: {fmtDateFull(e.endDate)}</p>}
                </div>

                <Divider />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <p style={{ color: C.yellow, fontFamily: "'Barlow Condensed'", fontWeight: 900, textTransform: "uppercase" }}>Adiantamentos</p>
                  <Btn v="warning" size="sm" onClick={() => setAdvModal(e.id)}><Ic n="plus" /> Novo</Btn>
                </div>
                {advs.length === 0 && <p style={{ color: C.muted, fontSize: 12 }}>Nenhum adiantamento.</p>}
                {advs.map(a => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, padding: "7px 0" }}>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: 13 }}>{a.description}</p>
                      <p style={{ color: C.muted, fontSize: 11 }}>{fmtDateFull(a.date)}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ color: C.red, fontWeight: 900 }}>{fmt(a.amount)}</span>
                      <Btn v="danger" size="sm" onClick={() => removeAdv(a.id)}><Ic n="trash" /></Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {modal && (
        <Modal title={form.id ? "Editar funcionário" : "Novo funcionário"} onClose={() => setModal(false)} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1/-1" }}><Inp label="Nome completo *" value={form.name} onChange={F("name")} /></div>
            <Inp label="Função" value={form.role} onChange={F("role")} />
            <Inp label="Admissão *" type="date" value={form.startDate} onChange={F("startDate")} />
            <Inp label="Diária *" type="number" value={form.dailyRate} onChange={F("dailyRate")} />
            <Sel label="Obra *" value={form.obra} onChange={F("obra")} options={[{ v: "", l: "Selecione" }, ...data.obras.map(o => ({ v: o.id, l: o.name }))]} />
            <Sel label="Status" value={String(form.active !== false)} onChange={v => F("active")(v === "true")} options={[{ v: "true", l: "Ativo" }, { v: "false", l: "Inativo / Demitido" }]} />
            <Inp label="VT diário" type="number" value={form.vtDaily} onChange={F("vtDaily")} />
            <Inp label="VR diário" type="number" value={form.vrDaily} onChange={F("vrDaily")} />
            <Inp label="CPF" value={form.cpf} onChange={v => F("cpf")(fmtCPF(v))} />
            <Inp label="Telefone" value={form.phone} onChange={v => F("phone")(fmtPhone(v))} />
            <Inp label="Tipo PIX" value={form.pixType} onChange={F("pixType")} />
            <Inp label="Titular PIX" value={form.pixHolder} onChange={F("pixHolder")} />
            <div style={{ gridColumn: "1/-1" }}><Inp label="Chave PIX" value={form.pixKey} onChange={F("pixKey")} /></div>

            {form.active === false && (
              <>
                <Inp label="Data de término *" type="date" value={form.endDate} onChange={F("endDate")} />
                <Inp label="Motivo" value={form.terminationReason} onChange={F("terminationReason")} />
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Btn v="ghost" onClick={() => setModal(false)} full>Cancelar</Btn>
            <Btn onClick={saveEmp} full><Ic n="check" /> Salvar</Btn>
          </div>
        </Modal>
      )}

      {advModal && (
        <Modal title="Novo adiantamento" onClose={() => setAdvModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Inp label="Valor *" type="number" value={advForm.amount} onChange={v => setAdvForm(f => ({ ...f, amount: v }))} />
            <Inp label="Descrição" value={advForm.description} onChange={v => setAdvForm(f => ({ ...f, description: v }))} />
            <Inp label="Data" type="date" value={advForm.date} onChange={v => setAdvForm(f => ({ ...f, date: v }))} />
            <div style={{ display: "flex", gap: 8 }}>
              <Btn v="ghost" onClick={() => setAdvModal(null)} full>Cancelar</Btn>
              <Btn v="warning" onClick={saveAdv} full><Ic n="check" /> Registrar</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Modal de movimentação individual
// ═══════════════════════════════════════════════════════════════════

function WorkerMovementModal({ data, update, showToast, employee, initialMode = "transfer", onClose }) {
  const [mode, setMode] = useState(initialMode);
  const [newObra, setNewObra] = useState("");
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState("Demitido");

  const activeObras = data.obras.filter(o => o.status !== "done");
  const obraName = id => data.obras.find(o => o.id === id)?.name || "—";

  const saveTransfer = () => {
    if (!newObra) {
      showToast("Selecione a nova obra.", "error");
      return;
    }
    if (newObra === employee.obra) {
      showToast("Selecione uma obra diferente da atual.", "error");
      return;
    }

    const from = obraName(employee.obra);
    const to = obraName(newObra);
    const employees = data.employees.map(emp => emp.id === employee.id ? {
      ...emp,
      obra: newObra,
      lastObra: emp.obra,
      active: true,
      endDate: "",
      terminationReason: "",
    } : emp);

    const changeLog = [...data.changeLog, { id: uid(), date: today(), type: "transfer", empId: employee.id, empName: employee.name, from, to, message: `${employee.name} transferido de ${from} para ${to}` }];
    update({ ...data, employees, changeLog, dailyCheckDate: today() });
    showToast(`${employee.name} transferido para ${to}.`);
    onClose();
  };

  const saveDismissal = () => {
    if (!endDate) {
      showToast("Informe a data de término.", "error");
      return;
    }

    const from = obraName(employee.obra);
    const employees = data.employees.map(emp => emp.id === employee.id ? {
      ...emp,
      active: false,
      endDate,
      terminationReason: reason || "Demitido",
      lastObra: emp.obra,
    } : emp);

    const changeLog = [...data.changeLog, { id: uid(), date: endDate, type: "dismissal", empId: employee.id, empName: employee.name, from, message: `${employee.name} demitido/inativado em ${fmtDateFull(endDate)}` }];
    update({ ...data, employees, changeLog, dailyCheckDate: today() });
    showToast(`${employee.name} demitido/inativado.`);
    onClose();
  };

  return (
    <Modal title={mode === "transfer" ? "Transferir trabalhador" : "Demitir trabalhador"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${mode === "transfer" ? C.yellow : C.red}`, padding: 12 }}>
          <p style={{ fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 18 }}>{employee.name}</p>
          <p style={{ color: C.muted, fontSize: 12 }}>Obra atual: {obraName(employee.obra)}{employee.role ? ` · ${employee.role}` : ""}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Btn v={mode === "transfer" ? "warning" : "ghost"} onClick={() => setMode("transfer")} full>Transferir</Btn>
          <Btn v={mode === "dismiss" ? "danger" : "ghost"} onClick={() => setMode("dismiss")} full>Demitir</Btn>
        </div>
        {mode === "transfer" ? (
          <Sel label="Nova obra *" value={newObra} onChange={setNewObra} options={[{ v: "", l: "Selecione" }, ...activeObras.filter(o => o.id !== employee.obra).map(o => ({ v: o.id, l: o.name }))]} />
        ) : (
          <>
            <Inp label="Data de término *" type="date" value={endDate} onChange={setEndDate} />
            <Inp label="Motivo" value={reason} onChange={setReason} />
          </>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="ghost" onClick={onClose} full>Cancelar</Btn>
          <Btn v={mode === "transfer" ? "warning" : "danger"} onClick={mode === "transfer" ? saveTransfer : saveDismissal} full>
            <Ic n="check" /> {mode === "transfer" ? "Confirmar transferência" : "Confirmar demissão"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function UnlockRequestModal({ data, update, showToast, obraId, date, employee, onClose }) {
  const [reason, setReason] = useState("");
  const obra = data.obras.find(o => o.id === obraId);
  const obraName = obra?.name || "—";
  const approverEmail = data.config.approverEmail || "hygorlp@gmail.com";

  const sendRequest = () => {
    if (!reason.trim()) {
      showToast("Informe o motivo da solicitação.", "error");
      return;
    }

    const requestId = uid();
    const approvalLink = `${window.location.origin}${window.location.pathname}?approve_unlock=${encodeURIComponent(requestId)}`;
    const request = {
      id: requestId,
      obraId,
      obraName,
      date,
      employeeId: employee?.id || "",
      employeeName: employee?.name || "",
      reason,
      status: "pending",
      requestedAt: new Date().toISOString(),
      requestedTo: approverEmail,
      approvalLink,
    };

    const unlockRequests = [...data.unlockRequests, request];
    const changeLog = [...data.changeLog, { id: uid(), date: today(), type: "unlock_request", empId: employee?.id || "", empName: employee?.name || "", message: `Solicitação de alteração de ponto enviada para ${obraName} em ${fmtDateFull(date)}.` }];
    update({ ...data, unlockRequests, changeLog });

    window.location.href = buildPermissionEmail({
      to: approverEmail,
      obraName,
      date,
      employeeName: employee?.name || "",
      reason,
      approvalLink,
    });

    showToast("Solicitação registrada e e-mail preparado.");
    onClose();
  };

  return (
    <Modal title="Solicitar permissão" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.yellow}`, padding: 12 }}>
          <p style={{ fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 18 }}>{obraName}</p>
          <p style={{ color: C.muted, fontSize: 12 }}>Data bloqueada: {fmtDateFull(date)}</p>
          {employee?.name && <p style={{ color: C.muted, fontSize: 12 }}>Trabalhador: {employee.name}</p>}
          <p style={{ color: C.subtle, fontSize: 12, marginTop: 6 }}>A solicitação será enviada para {approverEmail}.</p>
        </div>
        <Inp label="Motivo da alteração *" value={reason} onChange={setReason} multiline placeholder="Ex.: ponto lançado errado, funcionário em obra diferente, ajuste solicitado pelo responsável..." />
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="ghost" onClick={onClose} full>Cancelar</Btn>
          <Btn v="warning" onClick={sendRequest} full><Ic n="mail" /> Enviar solicitação</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Ponto
// ═══════════════════════════════════════════════════════════════════

function Ponto({ data, update, showToast }) {
  const [selDate, setSelDate] = useState(today());
  const [filterObra, setFilterObra] = useState("all");
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [otModal, setOtModal] = useState(null);
  const [otHours, setOtHours] = useState("0");
  const [movementModal, setMovementModal] = useState(null);
  const [unlockModal, setUnlockModal] = useState(null);
  const [lastAllDoneNotification, setLastAllDoneNotification] = useState("");

  const activeEmployees = data.employees.filter(e => e.active !== false);
  const dailyCheckPending = selDate === today() && activeEmployees.length > 0 && data.dailyCheckDate !== today();
  const obraName = id => data.obras.find(o => o.id === id)?.name || "—";
  const selectedObra = filterObra !== "all" ? data.obras.find(o => o.id === filterObra) : null;
  const selectedObraCanEdit = selectedObra ? canEditAttendance(data, selectedObra.id, selDate) : true;
  const obraAttendanceSummary = getObraAttendanceSummary(data, selDate);
  const attendanceCompletion = getAttendanceCompletionMessage(obraAttendanceSummary);

  useEffect(() => {
    const notificationKey = `${selDate}__all_done`;

    if (attendanceCompletion.allDone && lastAllDoneNotification !== notificationKey) {
      showToast("Todos os pontos de todas as obras foram cadastrados!", "success");
      setLastAllDoneNotification(notificationKey);
    }
  }, [selDate, attendanceCompletion.allDone, lastAllDoneNotification]);

  const list = data.employees
    .filter(e => e.active !== false)
    .filter(e => filterObra === "all" || e.obra === filterObra)
    .sort((a, b) => a.name.localeCompare(b.name));

  const requireDailyCheck = () => {
    if (!dailyCheckPending) return false;
    showToast("Antes de lançar o ponto, confirme se a equipe permanece sem alterações ou movimente o trabalhador individualmente.", "warn");
    return true;
  };

  const requireUnlocked = employee => {
    const obraId = employee?.obra || filterObra;
    if (!obraId || obraId === "all") return false;
    if (canEditAttendance(data, obraId, selDate)) return false;

    setUnlockModal({ obraId, date: selDate, employee: employee || null });
    showToast("Este ponto já foi finalizado. Solicite permissão para alterar.", "warn");
    return true;
  };

  const confirmTeamWithoutChanges = () => {
    update({
      ...data,
      dailyCheckDate: today(),
      changeLog: [...data.changeLog, { id: uid(), date: today(), type: "daily_check", message: "Verificação diária concluída: equipe sem alterações." }],
    });
    showToast("Equipe confirmada sem alterações.");
  };

  const finalizeObraAttendance = () => {
    if (filterObra === "all") {
      showToast("Selecione uma obra específica para concluir a conferência.", "error");
      return;
    }

    const obra = data.obras.find(o => o.id === filterObra);
    if (!obra) return;

    const obraSummary = getObraAttendanceSummary(data, selDate).find(o => o.obraId === filterObra);
    const missingNames = obraSummary?.missingEmployees?.map(e => e.name).join(", ") || "";
    const msg = obraSummary && obraSummary.missingCount > 0
      ? `Existem ${obraSummary.missingCount} trabalhador(es) sem registro nesta obra:\n\n${missingNames}\n\nDeseja concluir a conferência mesmo assim?`
      : `Concluir a conferência do ponto da obra "${obra.name}" em ${fmtDateFull(selDate)}?`;

    if (!window.confirm(`${msg}\n\nVocê poderá ajustar o ponto normalmente depois, sem precisar de permissão.`)) return;

    const changeLog = [...data.changeLog, { id: uid(), date: today(), type: "attendance_review", message: `Conferência do ponto concluída: ${obra.name} em ${fmtDateFull(selDate)}.` }];
    update({ ...data, changeLog });
    showToast("Conferência concluída. O ponto continua liberado para ajustes.");
  };

  const setAtt = (empId, status) => {
    const emp = data.employees.find(e => e.id === empId);
    if (requireDailyCheck()) return;
    if (requireUnlocked(emp)) return;

    const prev = getAtt(data, empId, selDate) || { status: null, ot: 0, note: "" };
    const nextStatus = prev.status === status ? null : status;
    update({
      ...data,
      attendance: {
        ...data.attendance,
        [empId]: {
          ...(data.attendance[empId] || {}),
          [selDate]: { ...prev, status: nextStatus },
        },
      },
    });
  };

  const saveNote = () => {
    const emp = data.employees.find(e => e.id === noteModal);
    if (requireDailyCheck()) return;
    if (requireUnlocked(emp)) return;

    const prev = getAtt(data, noteModal, selDate) || { status: null, ot: 0, note: "" };
    update({
      ...data,
      attendance: {
        ...data.attendance,
        [noteModal]: {
          ...(data.attendance[noteModal] || {}),
          [selDate]: { ...prev, note: noteText },
        },
      },
    });
    setNoteModal(null);
    showToast("Observação salva.");
  };

  const saveOT = () => {
    const emp = data.employees.find(e => e.id === otModal);
    if (requireDailyCheck()) return;
    if (requireUnlocked(emp)) return;

    const prev = getAtt(data, otModal, selDate) || { status: null, ot: 0, note: "" };
    update({
      ...data,
      attendance: {
        ...data.attendance,
        [otModal]: {
          ...(data.attendance[otModal] || {}),
          [selDate]: { ...prev, ot: Number(otHours || 0) },
        },
      },
    });
    setOtModal(null);
    showToast("Hora extra registrada.");
  };

  const markAll = status => {
    if (requireDailyCheck()) return;
    if (filterObra === "all") {
      showToast("Selecione uma obra específica para marcar todos.", "error");
      return;
    }
    if (selectedObra && !selectedObraCanEdit) {
      setUnlockModal({ obraId: selectedObra.id, date: selDate, employee: null });
      showToast("Este ponto já foi finalizado. Solicite permissão para alterar.", "warn");
      return;
    }

    const attendance = { ...data.attendance };
    list.forEach(e => {
      attendance[e.id] = {
        ...(attendance[e.id] || {}),
        [selDate]: { ...(getAtt(data, e.id, selDate) || {}), status },
      };
    });
    update({ ...data, attendance });
    showToast("Ponto marcado para todos.");
  };

  const counts = { P: 0, M: 0, F: 0 };
  list.forEach(e => {
    const st = attStatus(data, e.id, selDate);
    if (st) counts[st] = (counts[st] || 0) + 1;
  });
  const semReg = Math.max(0, list.length - counts.P - counts.M - counts.F);
  const registeredCount = counts.P + counts.M + counts.F;
  const completionPct = list.length ? Math.round((registeredCount / list.length) * 100) : 0;

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        className="point-pulse"
        style={{
          background: `linear-gradient(135deg, ${C.yellow} 0%, ${C.yellowD} 52%, #5a5200 100%)`,
          color: C.bg,
          border: `1px solid ${C.yellow}`,
          padding: 18,
          borderRadius: 18,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -18,
            top: -22,
            fontFamily: "'Bebas Neue'",
            fontSize: 118,
            lineHeight: 1,
            color: "rgba(0,0,0,.12)",
            pointerEvents: "none",
          }}
        >
          PONTO
        </div>

        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, opacity: .78 }}>Função principal do app</p>
            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 42, letterSpacing: 2, lineHeight: .95 }}>Registro de Ponto</h2>
            <p style={{ fontSize: 13, fontWeight: 700, marginTop: 6, maxWidth: 500 }}>
              Lance presença, meio dia ou falta por trabalhador. Os ajustes podem ser feitos a qualquer momento, mesmo após concluir a conferência.
            </p>
          </div>

          <div style={{ minWidth: 92, textAlign: "right" }}>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: 42, lineHeight: 1 }}>{completionPct}%</p>
            <p style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: .8 }}>cadastrado</p>
          </div>
        </div>

        <div style={{ position: "relative", marginTop: 14, height: 8, background: "rgba(0,0,0,.22)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${completionPct}%`, background: C.bg, borderRadius: 99, transition: "width .25s ease" }} />
        </div>

        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
          {[
            ["Data", fmtDateFull(selDate)],
            ["Obra", selectedObra?.name || "Todas"],
            ["Equipe", `${registeredCount}/${list.length}`],
          ].map(([label, value]) => (
            <div key={label} style={{ background: "rgba(0,0,0,.18)", padding: 9, borderRadius: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", opacity: .74 }}>{label}</p>
              <p style={{ fontWeight: 900, fontSize: 13 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.yellow}55`, borderLeft: `5px solid ${C.yellow}`, padding: 12, borderRadius: 14 }}>
        <Inp label="Data do ponto" type="date" value={selDate} onChange={setSelDate} max={today()} />
      </div>

      <div
        style={{
          background: attendanceCompletion.allDone ? `${C.green}18` : `${C.yellow}18`,
          border: `1.5px solid ${attendanceCompletion.allDone ? C.green : C.yellow}`,
          borderLeft: `5px solid ${attendanceCompletion.allDone ? C.green : C.yellow}`,
          padding: 12,
        }}
      >
        <p
          style={{
            color: attendanceCompletion.allDone ? C.green : C.yellow,
            fontFamily: "'Barlow Condensed'",
            fontWeight: 900,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {attendanceCompletion.allDone ? "Todos os pontos foram cadastrados" : "Existem obras com ponto pendente"}
        </p>

        {attendanceCompletion.allDone ? (
          <p style={{ color: C.subtle, fontSize: 12 }}>
            Todas as obras com equipe ativa já possuem ponto lançado em {fmtDateFull(selDate)}.
          </p>
        ) : (
          <>
            <p style={{ color: C.subtle, fontSize: 12, marginBottom: 8 }}>
              Obras faltando cadastrar ponto em {fmtDateFull(selDate)}:
            </p>

            {attendanceCompletion.pendingObras.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 12 }}>Nenhuma obra com equipe ativa nesta data.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {attendanceCompletion.pendingObras.map(o => (
                  <button
                    key={o.obraId}
                    onClick={() => setFilterObra(o.obraId)}
                    style={{
                      background: C.card,
                      border: `1px solid ${C.border}`,
                      borderLeft: `4px solid ${C.red}`,
                      color: C.text,
                      padding: "9px 10px",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <strong style={{ color: C.red }}>{o.obraName}</strong>
                    <span style={{ color: C.muted, fontSize: 12 }}> · {o.missingCount} trabalhador(es) sem ponto</span>
                    {o.missingEmployees.length > 0 && (
                      <p style={{ color: C.subtle, fontSize: 11, marginTop: 3 }}>
                        Faltando: {o.missingEmployees.map(e => e.name).join(", ")}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {attendanceCompletion.completedObras.length > 0 && (
          <p style={{ color: C.green, fontSize: 11, marginTop: 8 }}>
            Obras completas: {attendanceCompletion.completedObras.map(o => o.obraName).join(", ")}
          </p>
        )}

        {attendanceCompletion.obrasWithoutTeam.length > 0 && (
          <p style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>
            Sem equipe ativa: {attendanceCompletion.obrasWithoutTeam.map(o => o.obraName).join(", ")}
          </p>
        )}
      </div>

      {dailyCheckPending && (
        <div style={{ background: `${C.yellow}18`, border: `1.5px solid ${C.yellow}`, borderLeft: `5px solid ${C.yellow}`, padding: 12 }}>
          <p style={{ color: C.yellow, fontFamily: "'Barlow Condensed'", fontWeight: 900, textTransform: "uppercase", marginBottom: 6 }}>Verificação obrigatória pendente</p>
          <p style={{ color: C.subtle, fontSize: 12, marginBottom: 10 }}>Se algum trabalhador foi transferido ou demitido, use os botões do card do próprio trabalhador.</p>
          <Btn v="ghost" onClick={confirmTeamWithoutChanges} full>Confirmar equipe sem alterações hoje</Btn>
        </div>
      )}

      <Sel label="Obra" value={filterObra} onChange={setFilterObra} options={[{ v: "all", l: "Todas as obras" }, ...data.obras.map(o => ({ v: o.id, l: o.name }))]} />

      {filterObra === "all" && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.yellow}`, padding: 12 }}>
          <p style={{ color: C.yellow, fontWeight: 900, fontSize: 13 }}>Selecione uma obra específica para marcar todos e concluir a conferência do ponto.</p>
        </div>
      )}

      {selectedObra && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.green}`, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ color: C.green, fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 17, textTransform: "uppercase" }}>
            Ponto aberto para edição
          </p>
          <p style={{ color: C.subtle, fontSize: 12 }}>Obra: {selectedObra.name} · Data: {fmtDateFull(selDate)}</p>
          <Btn v="success" onClick={finalizeObraAttendance} full><Ic n="check" /> Concluir conferência da obra</Btn>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {[
          ["P", counts.P, C.green, "Pres."],
          ["–", semReg, C.muted, "S/reg"],
          ["M", counts.M, C.yellow, "½ dia"],
          ["F", counts.F, C.red, "Falta"],
        ].map(([k, n, col, label]) => (
          <div key={k} style={{ background: C.card, border: `1px solid ${col}55`, borderTop: `3px solid ${col}`, padding: 8, textAlign: "center" }}>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: 25, color: col, letterSpacing: 1 }}>{n}</p>
            <p style={{ color: C.muted, fontSize: 10 }}>{label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn v="success" size="sm" onClick={() => markAll("P")} full><Ic n="check" /> Todos presentes</Btn>
        <Btn v="danger" size="sm" onClick={() => markAll("F")} full><Ic n="x" /> Todos com falta</Btn>
      </div>

      {list.length === 0 && <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 18, color: C.muted, textAlign: "center" }}>Nenhum trabalhador ativo nesta seleção.</div>}

      {list.map(e => {
        const att = getAtt(data, e.id, selDate);
        const status = att?.status;
        const ot = Number(att?.ot || 0);
        const note = att?.note || "";
        const cardLocked = isAttendanceLocked(data, e.obra, selDate) && !canEditAttendance(data, e.obra, selDate);
        const borderCol = cardLocked ? C.red : status === "P" ? C.green : status === "M" ? C.yellow : status === "F" ? C.red : C.border;

        return (
          <div key={e.id} style={{ background: `linear-gradient(180deg, ${C.card}, ${C.surface})`, border: `1px solid ${C.border}`, borderLeft: `5px solid ${borderCol}`, padding: 14, opacity: cardLocked ? 0.86 : 1, borderRadius: 16, boxShadow: status ? `0 10px 28px ${borderCol}12` : "none" }}>
            <div style={{ marginBottom: 9 }}>
              <p style={{ fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 17 }}>{e.name}</p>
              <p style={{ color: C.muted, fontSize: 12 }}>{obraName(e.obra)}{e.role ? ` · ${e.role}` : ""}</p>
              {cardLocked && <Badge color={C.red}><Ic n="lock" s={11} /> Bloqueado</Badge>}
              {ot > 0 && <Badge color={C.purple}>{ot}h extra</Badge>}
              {note && <p style={{ color: C.subtle, fontSize: 12, marginTop: 5, fontStyle: "italic" }}>“{note}”</p>}
            </div>

            {cardLocked ? (
              <Btn v="warning" size="sm" full onClick={() => setUnlockModal({ obraId: e.obra, date: selDate, employee: e })}><Ic n="mail" /> Solicitar permissão</Btn>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginBottom: 8 }}>
                  {[
                    ["P", "check", C.green, "Presente"],
                    ["M", "money", C.yellow, "Meio dia"],
                    ["F", "x", C.red, "Falta"],
                  ].map(([st, icon, col, label]) => (
                    <button key={st} onClick={() => setAtt(e.id, st)} style={{
                      border: `2px solid ${status === st ? col : C.border}`,
                      background: status === st ? `linear-gradient(180deg, ${col}33, ${col}18)` : C.surface,
                      color: status === st ? col : C.subtle,
                      padding: "12px 4px",
                      cursor: "pointer",
                      fontFamily: "'Barlow Condensed'",
                      fontWeight: 900,
                      fontSize: 12,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 5,
                      borderRadius: 12,
                      boxShadow: status === st ? `0 0 0 2px ${col}22` : "none",
                      "--ic-color": status === st ? col : C.yellow,
                    }}>
                      <Ic n={icon} s={14} /> {label}
                    </button>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 5 }}>
                  <Btn v="warning" size="sm" full onClick={() => setMovementModal({ emp: e, mode: "transfer" })}><Ic n="home" /> Transferir</Btn>
                  <Btn v="danger" size="sm" full onClick={() => setMovementModal({ emp: e, mode: "dismiss" })}><Ic n="x" /> Demitir</Btn>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  <Btn v="ghost" size="sm" full onClick={() => { if (requireDailyCheck()) return; if (requireUnlocked(e)) return; setOtModal(e.id); setOtHours(String(ot)); }}><Ic n="clock" /> Hora extra</Btn>
                  <Btn v="ghost" size="sm" full onClick={() => { if (requireDailyCheck()) return; if (requireUnlocked(e)) return; setNoteModal(e.id); setNoteText(note); }}><Ic n="edit" /> Observação</Btn>
                </div>
              </>
            )}
          </div>
        );
      })}

      {movementModal && <WorkerMovementModal data={data} update={update} showToast={showToast} employee={movementModal.emp} initialMode={movementModal.mode} onClose={() => setMovementModal(null)} />}
      {unlockModal && <UnlockRequestModal data={data} update={update} showToast={showToast} obraId={unlockModal.obraId} date={unlockModal.date} employee={unlockModal.employee} onClose={() => setUnlockModal(null)} />}

      {noteModal && (
        <Modal title="Observação" onClose={() => setNoteModal(null)}>
          <Inp label="Observação" value={noteText} onChange={setNoteText} multiline />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn v="ghost" onClick={() => setNoteModal(null)} full>Cancelar</Btn>
            <Btn onClick={saveNote} full><Ic n="check" /> Salvar</Btn>
          </div>
        </Modal>
      )}

      {otModal && (
        <Modal title="Horas extras" onClose={() => setOtModal(null)}>
          <Inp label="Quantidade de horas" type="number" value={otHours} onChange={setOtHours} />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn v="ghost" onClick={() => setOtModal(null)} full>Cancelar</Btn>
            <Btn v="info" onClick={saveOT} full><Ic n="check" /> Registrar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Folha
// ═══════════════════════════════════════════════════════════════════

function Folha({ data, showToast }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [q, setQ] = useState(quinzenaForDay(now.getDate(), data.config, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()));
  const [filterObra, setFilterObra] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const { q1, q2 } = getQ(year, month, data.config);
  const days = q === "1" ? q1 : q2;
  const paymentHolidays = getPayrollHolidays(data, year);
  const holidaysInPeriod = days.filter(d => paymentHolidays.includes(d) && prIsWeekdayIso(d));
  const paymentInfo = getPayrollPaymentCalendar(year, month, q, data);
  const paymentDateLabel = fmtDateFull(paymentInfo.paymentDate);
  const paymentBaseLabel = fmtDateFull(paymentInfo.baseDate);
  const paymentObs = paymentInfo.adjusted ? `Ajustado de ${paymentBaseLabel} para ${paymentDateLabel}` : "Data normal de pagamento";
  const obraName = id => data.obras.find(o => o.id === id)?.name || "—";
  const periodLabel = `${q === "1" ? "1ª" : "2ª"} Quinzena de ${fullMonth(month)} ${year}`;
  const periodRangeLabel = days.length ? `${fmtDateFull(days[0])} a ${fmtDateFull(days[days.length - 1])}` : "Período sem dias (verifique a abertura/fechamento nas configurações)";

  const calcRow = employee => {
    let gross = 0;
    let presentes = 0;
    let meiodia = 0;
    let faltas = 0;
    let semRegistro = 0;
    let ot = 0;
    let vt = 0;
    let vr = 0;

    days.forEach(d => {
      if (!isEmployeeEmployedOnDate(employee, d)) return;
      if (holidaysInPeriod.includes(d)) return;

      const a = getAtt(data, employee.id, d);
      const st = a?.status;
      const extra = Number(a?.ot || 0);

      if (st === "P") {
        gross += Number(employee.dailyRate || 0);
        presentes++;
        ot += extra;
        vt += Number(employee.vtDaily || 0);
        vr += Number(employee.vrDaily || 0);
      } else if (st === "M") {
        gross += Number(employee.dailyRate || 0) * 0.5;
        meiodia++;
        ot += extra;
        vt += Number(employee.vtDaily || 0) * 0.5;
        vr += Number(employee.vrDaily || 0) * 0.5;
      } else if (st === "F") {
        faltas++;
      } else {
        semRegistro++;
      }
    });

    const employeeHolidays = holidaysInPeriod.filter(h => isEmployeeEmployedOnDate(employee, h));
    const holidayRules = employeeHolidays.map(h => getHolidayPayRule(data, employee, h, paymentHolidays));
    const feriadosPagos = holidayRules.filter(h => !h.losesHoliday).length;
    const feriadosPerdidos = holidayRules.filter(h => h.losesHoliday).length;
    const holidayPay = holidayRules.reduce((s, h) => s + h.amount, 0);
    gross += holidayPay;

    const advTotal = data.advances
      .filter(a => a.empId === employee.id && a.date >= days[0] && a.date <= days[days.length - 1])
      .reduce((s, a) => s + Number(a.amount || 0), 0);

    return {
      ...employee,
      gross,
      presentes,
      meiodia,
      faltas,
      semRegistro,
      ot,
      vt,
      vr,
      feriadosPagos,
      feriadosPerdidos,
      holidayPay,
      holidayRules,
      advances: advTotal,
      net: gross + vt + vr - advTotal,
      days: days.length,
    };
  };

  const hasAttendanceInPeriod = e => days.some(d => {
    const a = getAtt(data, e.id, d);
    return a?.status || a?.ot || a?.note;
  });

  const belongsToSelectedObra = e => filterObra === "all" || e.obra === filterObra || e.lastObra === filterObra;

  const rows = data.employees
    .filter(belongsToSelectedObra)
    .filter(e => e.active !== false || hasAttendanceInPeriod(e))
    .map(calcRow)
    .filter(r => r.presentes > 0 || r.meiodia > 0 || r.faltas > 0 || r.feriadosPagos > 0 || r.feriadosPerdidos > 0 || r.advances > 0 || r.gross > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const T = {
    gross: rows.reduce((s, r) => s + r.gross, 0),
    vt: rows.reduce((s, r) => s + r.vt, 0),
    vr: rows.reduce((s, r) => s + r.vr, 0),
    advances: rows.reduce((s, r) => s + r.advances, 0),
    net: rows.reduce((s, r) => s + r.net, 0),
    holidayPay: rows.reduce((s, r) => s + r.holidayPay, 0),
    feriadosPagos: rows.reduce((s, r) => s + r.feriadosPagos, 0),
    feriadosPerdidos: rows.reduce((s, r) => s + r.feriadosPerdidos, 0),
  };

  const printPDF = () => {
    const html = `
      <html>
        <head>
          <title>Folha - ${escapeHtml(periodLabel)}</title>
          <style>
            body{font-family:Arial,sans-serif;padding:30px;color:#111}
            h1,h2{margin:0 0 8px 0}
            p{margin:4px 0}
            table{width:100%;border-collapse:collapse;margin-top:20px;font-size:10px}
            th,td{border:1px solid #ccc;padding:5px;text-align:left}
            th{background:#f0f0f0}
            .total{font-weight:bold;background:#f7f7f7}
            .signatures{margin-top:50px;display:flex;justify-content:space-between;gap:40px}
            .signature{flex:1;border-top:1px solid #111;padding-top:8px;text-align:center}
          </style>
        </head>
        <body>
          <h1>${escapeHtml(data.config.companyName || "ArcD Obras")}</h1>
          ${data.config.cnpj ? `<p>CNPJ: ${escapeHtml(data.config.cnpj)}</p>` : ""}
          <h2>Folha de Pagamento — ${escapeHtml(periodLabel)}</h2>
          <p><strong>Período de apuração:</strong> ${escapeHtml(periodRangeLabel)}</p>
          <p><strong>Data de pagamento:</strong> ${escapeHtml(paymentDateLabel)}</p>
          <p><strong>Regra aplicada:</strong> ${escapeHtml(paymentObs)}</p>
          <table>
            <thead>
              <tr>
                <th>Funcionário</th><th>Cargo</th><th>Obra</th><th>P</th><th>M</th><th>F</th><th>S/R</th><th>FP</th><th>FD</th><th>Valor Feriado</th><th>HE</th><th>Diária</th><th>Bruto</th><th>VT</th><th>VR</th><th>Adiant.</th><th>Líquido</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.role || "-")}</td><td>${escapeHtml(obraName(r.obra))}</td>
                  <td>${r.presentes}</td><td>${r.meiodia}</td><td>${r.faltas}</td><td>${r.semRegistro}</td><td>${r.feriadosPagos}</td><td>${r.feriadosPerdidos}</td>
                  <td>R$ ${r.holidayPay.toFixed(2)}</td><td>${r.ot || 0}h</td><td>R$ ${Number(r.dailyRate || 0).toFixed(2)}</td><td>R$ ${r.gross.toFixed(2)}</td><td>R$ ${r.vt.toFixed(2)}</td><td>R$ ${r.vr.toFixed(2)}</td><td>R$ ${r.advances.toFixed(2)}</td><td>R$ ${r.net.toFixed(2)}</td>
                </tr>`).join("")}
              <tr class="total"><td colspan="12">TOTAL — ${rows.length} funcionário(s)</td><td>R$ ${T.gross.toFixed(2)}</td><td>R$ ${T.vt.toFixed(2)}</td><td>R$ ${T.vr.toFixed(2)}</td><td>R$ ${T.advances.toFixed(2)}</td><td>R$ ${T.net.toFixed(2)}</td></tr>
            </tbody>
          </table>
          <div class="signatures"><div class="signature">Responsável RH: ${escapeHtml(data.config.hrName || "_______________________")}</div><div class="signature">Aprovado por</div></div>
          <p style="margin-top:30px;">Data: ___/___/_____</p>
          <script>window.print();</script>
        </body>
      </html>
    `;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };

  const exportXLS = () => {
    const wb = XLSX.utils.book_new();
    const header = ["Funcionário", "Cargo", "Obra", "Pres.", "Meio Dia", "Faltas", "Sem Registro", "Feriados Pagos", "Feriados Perdidos", "Valor Feriado", "HE", "Diária", "Bruto", "VT", "VR", "Adiant.", "Líquido"];
    const body = rows.map(r => [r.name, r.role || "", obraName(r.obra), r.presentes, r.meiodia, r.faltas, r.semRegistro, r.feriadosPagos, r.feriadosPerdidos, r.holidayPay, r.ot, r.dailyRate, r.gross, r.vt, r.vr, r.advances, r.net]);
    const total = ["TOTAL", "", "", rows.reduce((s, r) => s + r.presentes, 0), rows.reduce((s, r) => s + r.meiodia, 0), rows.reduce((s, r) => s + r.faltas, 0), rows.reduce((s, r) => s + r.semRegistro, 0), T.feriadosPagos, T.feriadosPerdidos, T.holidayPay, rows.reduce((s, r) => s + r.ot, 0), "", T.gross, T.vt, T.vr, T.advances, T.net];
    const ws = XLSX.utils.aoa_to_sheet([["Folha de Pagamento", periodLabel], ["Período de apuração", periodRangeLabel], ["Data de pagamento", paymentDateLabel], ["Regra aplicada", paymentObs], [], header, ...body, total]);
    ws["!cols"] = [20, 15, 15, 8, 10, 8, 12, 15, 17, 14, 6, 10, 12, 10, 10, 10, 12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "Folha");
    XLSX.writeFile(wb, `arcd-folha-${year}-${String(month + 1).padStart(2, "0")}-Q${q}.xlsx`);
    showToast("Excel gerado.");
  };

  const buildText = () => [
    "FOLHA DE PAGAMENTO — ARCD OBRAS",
    data.config.companyName || "",
    periodLabel,
    `Apuração: ${periodRangeLabel}`,
    `Pagamento: ${paymentDateLabel}`,
    paymentObs,
    "",
    ...rows.map(r => `• ${r.name} (${obraName(r.obra)}): ${fmt(r.net)} | ${r.feriadosPagos}FP ${r.feriadosPerdidos}FD`),
    "",
    `TOTAL LÍQUIDO: ${fmt(T.net)}`,
    `FERIADOS PAGOS: ${T.feriadosPagos}`,
    `FERIADOS PERDIDOS: ${T.feriadosPerdidos}`,
    `VALOR TOTAL DE FERIADOS: ${fmt(T.holidayPay)}`,
    `${rows.length} funcionário(s)`,
    `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
  ].join("\n");

  const years = [];
  for (let i = now.getFullYear() - 1; i <= now.getFullYear() + 2; i++) years.push({ v: String(i), l: String(i) });

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 30, letterSpacing: 2, color: C.yellow }}>Folha de Pagamento</h2>
        <p style={{ color: C.muted, fontSize: 13 }}>Período e datas de pagamento personalizáveis em Ajustes › Período da folha.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Sel value={String(year)} onChange={v => setYear(Number(v))} options={years} />
        <Sel value={String(month)} onChange={v => setMonth(Number(v))} options={Array.from({ length: 12 }, (_, i) => ({ v: String(i), l: fullMonth(i) }))} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Sel value={q} onChange={setQ} options={[{ v: "1", l: "1ª quinzena" }, { v: "2", l: "2ª quinzena" }]} />
        <Sel value={filterObra} onChange={setFilterObra} options={[{ v: "all", l: "Todas as obras" }, ...data.obras.map(o => ({ v: o.id, l: o.name }))]} />
      </div>

      <div style={{ background: `linear-gradient(135deg, ${C.yellow}, ${C.yellowD})`, color: C.bg, padding: 18, border: `1px solid ${C.yellow}` }}>
        <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", opacity: 0.78 }}>Total líquido</p>
        <p style={{ fontFamily: "'Bebas Neue'", fontSize: 38, letterSpacing: 2 }}>{fmt(T.net)}</p>
        <p style={{ fontSize: 12, fontWeight: 700 }}>{rows.length} funcionário(s) · {periodLabel}</p>
        <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.86 }}>Apuração: {periodRangeLabel}</p>
        <p style={{ fontSize: 14, fontWeight: 900, marginTop: 6 }}>Pagamento: {paymentDateLabel}</p>
        <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.86 }}>{paymentObs}</p>
        {(T.feriadosPagos + T.feriadosPerdidos) > 0 && <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.86, marginTop: 4 }}>Feriados: {T.feriadosPagos} pago(s), {T.feriadosPerdidos} perdido(s) · Valor: {fmt(T.holidayPay)}</p>}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 12, fontWeight: 700 }}>
          <span>Bruto: {fmt(T.gross)}</span>
          {T.vt > 0 && <span>VT: {fmt(T.vt)}</span>}
          {T.vr > 0 && <span>VR: {fmt(T.vr)}</span>}
          {T.advances > 0 && <span>Adiant.: -{fmt(T.advances)}</span>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Btn v="ghost" onClick={printPDF}><Ic n="file" /> PDF / Imprimir</Btn>
        <Btn v="success" onClick={exportXLS}><Ic n="download" /> Excel .xlsx</Btn>
        <Btn v="info" onClick={() => window.open(`mailto:${data.config.hrEmail || ""}?subject=${encodeURIComponent("Folha - " + periodLabel)}&body=${encodeURIComponent(buildText())}`)}><Ic n="mail" /> E-mail</Btn>
        <Btn v="success" onClick={() => navigator.clipboard.writeText(buildText()).then(() => showToast("Copiado.")).catch(() => showToast("Erro ao copiar.", "error"))}><Ic n="copy" /> WhatsApp</Btn>
      </div>

      {rows.length === 0 && <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20, textAlign: "center", color: C.muted }}>Nenhum funcionário com movimentação nesta quinzena.</div>}

      {rows.map(r => (
        <div key={r.id}>
          <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.yellow}`, padding: 14, width: "100%", cursor: "pointer", color: C.text, textAlign: "left", display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div>
              <p style={{ fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 17 }}>{r.name}</p>
              <p style={{ color: C.muted, fontSize: 12 }}>{obraName(r.obra)} · {r.presentes}P {r.meiodia}M {r.faltas}F {r.semRegistro}S/R · {r.feriadosPagos}FP {r.feriadosPerdidos}FD{r.ot > 0 ? ` · ${r.ot}h` : ""}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 19, color: C.yellow }}>{fmt(r.net)}</p>
              {r.advances > 0 && <p style={{ color: C.red, fontSize: 11 }}>-{fmt(r.advances)}</p>}
            </div>
          </button>

          {expandedId === r.id && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderTop: 0, padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                {[
                  ["Diária", fmt(r.dailyRate)], ["Bruto", fmt(r.gross)], ["VT+VR", fmt(r.vt + r.vr)], ["Adiant.", fmt(r.advances), C.red], ["Líquido", fmt(r.net), C.yellow], ["HE", `${r.ot}h`], ["Feriados pagos", r.feriadosPagos], ["Feriados perdidos", r.feriadosPerdidos, C.red], ["Valor feriado", fmt(r.holidayPay), C.green],
                ].map(([label, value, color]) => (
                  <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, padding: 8 }}>
                    <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase" }}>{label}</p>
                    <p style={{ color: color || C.text, fontWeight: 900 }}>{value}</p>
                  </div>
                ))}
              </div>

              {r.holidayRules.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ color: C.yellow, fontFamily: "'Barlow Condensed'", fontWeight: 900, textTransform: "uppercase", marginBottom: 6 }}>Regra de feriados</p>
                  {r.holidayRules.map(h => (
                    <p key={h.holidayIso} style={{ color: h.losesHoliday ? C.red : C.green, fontSize: 12, marginBottom: 3 }}>
                      {fmtDateFull(h.holidayIso)}: {h.losesHoliday ? "perdido" : "pago"} · anterior {fmtDateFull(h.before)}{h.missedBefore ? " faltou" : " ok"} · posterior {fmtDateFull(h.after)}{h.missedAfter ? " faltou" : " ok"}
                    </p>
                  ))}
                </div>
              )}

              {r.pixKey && <p style={{ color: C.subtle, fontSize: 12, marginBottom: 10 }}>PIX: {r.pixKey}</p>}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(43px, 1fr))", gap: 4 }}>
                {days.map(d => {
                  const a = getAtt(data, r.id, d);
                  const st = a?.status;
                  const isHoliday = holidaysInPeriod.includes(d) && isEmployeeEmployedOnDate(r, d);
                  const col = isHoliday ? C.blue : st === "P" ? C.green : st === "M" ? C.yellow : st === "F" ? C.red : C.muted;
                  return (
                    <div key={d} style={{ background: C.card, border: `1px solid ${C.border}`, padding: 5, textAlign: "center" }}>
                      <p style={{ color: C.muted, fontSize: 9 }}>{fmtDate(d)}</p>
                      <p style={{ color: col, fontWeight: 900 }}>{isHoliday ? "FER" : st || "–"}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Relatórios
// ═══════════════════════════════════════════════════════════════════

function Relatorios({ data }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [filterObra, setFilterObra] = useState("all");

  const days = getDays(year, month);
  const obraName = id => data.obras.find(o => o.id === id)?.name || "—";
  const payrollHolidays = getPayrollHolidays(data, year);
  const holidaysInMonth = days.filter(d => payrollHolidays.includes(d) && prIsWeekdayIso(d));

  const obraCostRows = data.obras.map(o => {
    const emps = data.employees.filter(e => e.obra === o.id || e.lastObra === o.id);
    const activeEmps = emps.filter(e => e.active !== false && e.obra === o.id);

    let presentes = 0;
    let meiodia = 0;
    let faltas = 0;
    let semRegistro = 0;
    let laborCost = 0;
    let benefitCost = 0;
    let holidayPay = 0;

    emps.forEach(e => {
      const belongsNow = e.obra === o.id;
      const hasAnyAttendance = days.some(d => !!getAtt(data, e.id, d));

      // Observação: a estrutura atual do ponto não grava a obra por dia.
      // Portanto, para relatórios históricos, o custo é atribuído à obra atual do trabalhador.
      // lastObra serve apenas para manter vínculo de histórico após demissão/arquivamento.
      if (!belongsNow && !hasAnyAttendance) return;

      days.forEach(d => {
        if (!isEmployeeEmployedOnDate(e, d)) return;
        if (holidaysInMonth.includes(d)) return;

        const a = getAtt(data, e.id, d);
        const s = a?.status;

        if (s === "P") {
          presentes++;
          laborCost += Number(e.dailyRate || 0);
          benefitCost += Number(e.vtDaily || 0) + Number(e.vrDaily || 0);
        } else if (s === "M") {
          meiodia++;
          laborCost += Number(e.dailyRate || 0) * 0.5;
          benefitCost += (Number(e.vtDaily || 0) + Number(e.vrDaily || 0)) * 0.5;
        } else if (s === "F") {
          faltas++;
        } else if (belongsNow && e.active !== false) {
          semRegistro++;
        }
      });

      holidaysInMonth.forEach(h => {
        if (!isEmployeeEmployedOnDate(e, h)) return;
        if (!belongsNow && e.active !== false) return;
        const rule = getHolidayPayRule(data, e, h, payrollHolidays);
        holidayPay += Number(rule.amount || 0);
      });
    });

    const areaM2 = Number(o.areaM2 || 0);
    laborCost += holidayPay;
    const totalCost = laborCost + benefitCost;
    const laborCostPerM2 = areaM2 > 0 ? laborCost / areaM2 : 0;
    const totalCostPerM2 = areaM2 > 0 ? totalCost / areaM2 : 0;

    return {
      id: o.id,
      name: o.name,
      areaM2,
      trabalhadores: activeEmps.length,
      presentes,
      meiodia,
      faltas,
      semRegistro,
      laborCost,
      benefitCost,
      holidayPay,
      totalCost,
      laborCostPerM2,
      totalCostPerM2,
    };
  });

  const filteredRows = obraCostRows.filter(r => filterObra === "all" || r.id === filterObra);

  const totals = filteredRows.reduce((acc, r) => ({
    areaM2: acc.areaM2 + r.areaM2,
    trabalhadores: acc.trabalhadores + r.trabalhadores,
    presentes: acc.presentes + r.presentes,
    meiodia: acc.meiodia + r.meiodia,
    faltas: acc.faltas + r.faltas,
    semRegistro: acc.semRegistro + r.semRegistro,
    laborCost: acc.laborCost + r.laborCost,
    benefitCost: acc.benefitCost + r.benefitCost,
    holidayPay: acc.holidayPay + r.holidayPay,
    totalCost: acc.totalCost + r.totalCost,
  }), {
    areaM2: 0,
    trabalhadores: 0,
    presentes: 0,
    meiodia: 0,
    faltas: 0,
    semRegistro: 0,
    laborCost: 0,
    benefitCost: 0,
    holidayPay: 0,
    totalCost: 0,
  });

  const totalLaborCostPerM2 = totals.areaM2 > 0 ? totals.laborCost / totals.areaM2 : 0;
  const totalCostPerM2 = totals.areaM2 > 0 ? totals.totalCost / totals.areaM2 : 0;

  const byObra = filteredRows.map(r => ({
    name: r.name,
    trabalhadores: r.trabalhadores,
    presentes: r.presentes,
    faltas: r.faltas,
    custo: r.laborCost,
    custoTotal: r.totalCost,
    custoM2: r.laborCostPerM2,
  }));

  const topCost = data.employees.map(e => {
    if (filterObra !== "all" && e.obra !== filterObra && e.lastObra !== filterObra) return null;

    let total = 0;

    days.forEach(d => {
      if (!isEmployeeEmployedOnDate(e, d)) return;
      if (holidaysInMonth.includes(d)) return;
      const st = attStatus(data, e.id, d);
      if (st === "P") total += Number(e.dailyRate || 0);
      if (st === "M") total += Number(e.dailyRate || 0) * 0.5;
    });

    holidaysInMonth.forEach(h => {
      if (!isEmployeeEmployedOnDate(e, h)) return;
      total += Number(getHolidayPayRule(data, e, h, payrollHolidays).amount || 0);
    });

    return { name: e.name, obra: obraName(e.obra), total };
  }).filter(i => i && i.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);

  const exportObraCosts = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Relatório de gasto por obra", `${fullMonth(month)} ${year}`],
      ["Filtro", filterObra === "all" ? "Todas as obras" : obraName(filterObra)],
      [],
      [
        "Obra",
        "Área (m²)",
        "Trabalhadores ativos",
        "Presenças",
        "Meio dia",
        "Faltas",
        "Sem registro",
        "Mão de obra",
        "Feriados pagos",
        "VT/VR",
        "Total com benefícios",
        "Mão de obra por m²",
        "Total por m²",
      ],
      ...filteredRows.map(r => [
        r.name,
        r.areaM2,
        r.trabalhadores,
        r.presentes,
        r.meiodia,
        r.faltas,
        r.semRegistro,
        r.laborCost,
        r.holidayPay,
        r.benefitCost,
        r.totalCost,
        r.laborCostPerM2,
        r.totalCostPerM2,
      ]),
      [
        "TOTAL",
        totals.areaM2,
        totals.trabalhadores,
        totals.presentes,
        totals.meiodia,
        totals.faltas,
        totals.semRegistro,
        totals.laborCost,
        totals.holidayPay,
        totals.benefitCost,
        totals.totalCost,
        totalLaborCostPerM2,
        totalCostPerM2,
      ],
    ]);

    ws["!cols"] = [22, 10, 16, 10, 10, 10, 12, 14, 14, 12, 18, 18, 14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "Gasto por Obra");
    XLSX.writeFile(wb, `arcd-gasto-obra-${year}-${String(month + 1).padStart(2, "0")}.xlsx`);
  };

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 30, letterSpacing: 2, color: C.yellow }}>Relatórios</h2>
        <p style={{ color: C.muted, fontSize: 13 }}>Indicadores mensais de presença, gasto por obra e custo de mão de obra por m².</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Sel value={String(year)} onChange={v => setYear(Number(v))} options={Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => ({ v: String(y), l: String(y) }))} />
        <Sel value={String(month)} onChange={v => setMonth(Number(v))} options={Array.from({ length: 12 }, (_, i) => ({ v: String(i), l: fullMonth(i) }))} />
      </div>

      <Sel
        label="Filtrar gasto por obra"
        value={filterObra}
        onChange={setFilterObra}
        options={[{ v: "all", l: "Todas as obras" }, ...data.obras.map(o => ({ v: o.id, l: o.name }))]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {[
          ["Mão de obra", fmt(totals.laborCost), C.yellow],
          ["Custo / m²", totals.areaM2 > 0 ? fmt(totalLaborCostPerM2) : "Sem área", totals.areaM2 > 0 ? C.green : C.muted],
          ["Total com VT/VR", fmt(totals.totalCost), C.blue],
          ["Área considerada", `${totals.areaM2.toLocaleString("pt-BR")} m²`, C.subtle],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: `3px solid ${color}`, padding: 12 }}>
            <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", fontWeight: 800, letterSpacing: .6 }}>{label}</p>
            <p style={{ color, fontFamily: "'Barlow Condensed'", fontSize: 22, fontWeight: 900 }}>{value}</p>
          </div>
        ))}
      </div>

      <Btn onClick={exportObraCosts} v="success" full>
        <Ic n="download" s={15} />
        Exportar gasto por obra
      </Btn>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", marginBottom: 8 }}>Gasto de mão de obra por obra</h3>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byObra}>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="name" stroke={C.muted} fontSize={10} />
              <YAxis stroke={C.muted} fontSize={10} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }} formatter={v => fmt(v)} />
              <Bar dataKey="custo" name="Mão de obra" fill={C.yellow} />
              <Bar dataKey="custoTotal" name="Total c/ VT-VR" fill={C.blue} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", marginBottom: 8 }}>Presenças e faltas por obra</h3>
        <div style={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byObra}>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="name" stroke={C.muted} fontSize={10} />
              <YAxis stroke={C.muted} fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }} />
              <Bar dataKey="presentes" fill={C.green} />
              <Bar dataKey="faltas" fill={C.red} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filteredRows.map(r => (
          <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.yellow}`, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 17 }}>{r.name}</p>
                <p style={{ color: C.muted, fontSize: 12 }}>
                  Área: {r.areaM2 > 0 ? `${r.areaM2.toLocaleString("pt-BR")} m²` : "não cadastrada"} · {r.trabalhadores} trabalhador(es)
                </p>
                <p style={{ color: C.subtle, fontSize: 12 }}>
                  {r.presentes}P {r.meiodia}M {r.faltas}F {r.semRegistro}S/R
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ color: C.yellow, fontWeight: 900 }}>{fmt(r.laborCost)}</p>
                <p style={{ color: r.areaM2 > 0 ? C.green : C.muted, fontSize: 12, fontWeight: 800 }}>
                  {r.areaM2 > 0 ? `${fmt(r.laborCostPerM2)}/m²` : "sem m²"}
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 10 }}>
              {[
                ["Feriados pagos", fmt(r.holidayPay), C.green],
                ["VT/VR", fmt(r.benefitCost), C.blue],
                ["Total", fmt(r.totalCost), C.yellow],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 8 }}>
                  <p style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>{label}</p>
                  <p style={{ color, fontWeight: 900 }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", marginBottom: 8 }}>Top custos do mês</h3>
        {topCost.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>Nenhum custo lançado no período.</p>}
        {topCost.map(i => (
          <div key={`${i.name}-${i.obra}`} style={{ borderTop: `1px solid ${C.border}`, padding: "9px 0", display: "flex", justifyContent: "space-between" }}>
            <div><p style={{ fontWeight: 900 }}>{i.name}</p><p style={{ color: C.muted, fontSize: 12 }}>{i.obra}</p></div>
            <p style={{ color: C.yellow, fontWeight: 900 }}>{fmt(i.total)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// Agente de IA — apoio operacional
// Funciona com análise local do app e, se existir backend /api/ai-agent,
// usa o endpoint de IA sem expor chave no navegador.
// ═══════════════════════════════════════════════════════════════════

const agentNormalize = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

const agentDateLabel = iso => fmtDateFull(iso) || "—";

const getAgentMonthCostByObra = (data, year = new Date().getFullYear(), month = new Date().getMonth()) => {
  const days = getDays(year, month);
  const holidays = getPayrollHolidays(data, year);
  const holidaysInMonth = days.filter(d => holidays.includes(d) && prIsWeekdayIso(d));

  return (data.obras || []).map(obra => {
    let laborCost = 0;
    let benefitCost = 0;
    let presentes = 0;
    let meiodia = 0;
    let faltas = 0;
    let semRegistro = 0;

    (data.employees || []).forEach(emp => {
      if (emp.obra !== obra.id && emp.lastObra !== obra.id) return;

      days.forEach(day => {
        if (!isEmployeeEmployedOnDate(emp, day)) return;
        if (holidaysInMonth.includes(day)) return;
        const status = attStatus(data, emp.id, day);

        if (status === "P") {
          presentes++;
          laborCost += Number(emp.dailyRate || 0);
          benefitCost += Number(emp.vtDaily || 0) + Number(emp.vrDaily || 0);
        } else if (status === "M") {
          meiodia++;
          laborCost += Number(emp.dailyRate || 0) * 0.5;
          benefitCost += (Number(emp.vtDaily || 0) + Number(emp.vrDaily || 0)) * 0.5;
        } else if (status === "F") {
          faltas++;
        } else if (emp.active !== false && emp.obra === obra.id) {
          semRegistro++;
        }
      });

      holidaysInMonth.forEach(h => {
        if (!isEmployeeEmployedOnDate(emp, h)) return;
        if (emp.obra !== obra.id) return;
        laborCost += Number(getHolidayPayRule(data, emp, h, holidays).amount || 0);
      });
    });

    const areaM2 = Number(obra.areaM2 || 0);
    const totalCost = laborCost + benefitCost;

    return {
      obraId: obra.id,
      obraName: obra.name,
      areaM2,
      laborCost,
      benefitCost,
      totalCost,
      laborCostPerM2: areaM2 > 0 ? laborCost / areaM2 : 0,
      totalCostPerM2: areaM2 > 0 ? totalCost / areaM2 : 0,
      presentes,
      meiodia,
      faltas,
      semRegistro,
    };
  }).sort((a, b) => b.totalCost - a.totalCost);
};

const buildAgentContext = data => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayIso = today();
  const activeEmployees = (data.employees || []).filter(e => e.active !== false);
  const activeObras = (data.obras || []).filter(o => o.status !== "done");
  const attendanceSummary = getObraAttendanceSummary(data, todayIso);
  const completion = getAttendanceCompletionMessage(attendanceSummary);
  const costs = getAgentMonthCostByObra(data, currentYear, currentMonth);
  const pendingUnlocks = (data.unlockRequests || []).filter(r => r.status === "pending");
  const noArea = activeObras.filter(o => !Number(o.areaM2 || 0));
  const noTeam = activeObras.filter(o => !activeEmployees.some(e => e.obra === o.id));
  const incompleteEmployees = activeEmployees.filter(e =>
    !e.name || !e.role || !e.obra || !e.startDate || !Number(e.dailyRate || 0)
  );
  const missingPointEmployees = completion.pendingObras.flatMap(o =>
    o.missingEmployees.map(e => ({ name: e.name, obra: o.obraName }))
  );
  const paymentInfo = getPayrollPaymentCalendar(
    currentYear,
    currentMonth,
    quinzenaForDay(now.getDate(), data.config, new Date(currentYear, currentMonth + 1, 0).getDate()),
    data
  );

  return {
    today: todayIso,
    companyName: data.config?.companyName || "ArcD Obras",
    totalObras: (data.obras || []).length,
    activeObras: activeObras.length,
    totalEmployees: (data.employees || []).length,
    activeEmployees: activeEmployees.length,
    pendingPointObras: completion.pendingObras.map(o => ({
      obraName: o.obraName,
      missingCount: o.missingCount,
      missingEmployees: o.missingEmployees.map(e => e.name),
    })),
    completedPointObras: completion.completedObras.map(o => o.obraName),
    allPointsDoneToday: completion.allDone,
    missingPointEmployees,
    pendingUnlocks: pendingUnlocks.map(r => ({ obraName: r.obraName, date: r.date, employeeName: r.employeeName || "Todos / obra", reason: r.reason })),
    noAreaObras: noArea.map(o => o.name),
    noTeamObras: noTeam.map(o => o.name),
    incompleteEmployees: incompleteEmployees.slice(0, 30).map(e => ({
      name: e.name,
      role: e.role || "sem função",
      obra: activeObras.find(o => o.id === e.obra)?.name || "sem obra",
      missing: [
        !e.role ? "função" : "",
        !e.obra ? "obra" : "",
        !e.startDate ? "data de admissão" : "",
        !Number(e.dailyRate || 0) ? "diária" : "",
      ].filter(Boolean),
    })),
    monthlyCosts: costs.slice(0, 10).map(c => ({
      obraName: c.obraName,
      laborCost: c.laborCost,
      totalCost: c.totalCost,
      areaM2: c.areaM2,
      laborCostPerM2: c.laborCostPerM2,
      totalCostPerM2: c.totalCostPerM2,
    })),
    paymentDate: paymentInfo.paymentDate,
    paymentBaseDate: paymentInfo.baseDate,
    paymentAdjusted: paymentInfo.adjusted,
  };
};

const agentFormatPendingPoints = ctx => {
  if (ctx.allPointsDoneToday) {
    return `Todos os pontos de hoje (${agentDateLabel(ctx.today)}) estão cadastrados nas obras com equipe ativa.`;
  }

  if (!ctx.pendingPointObras.length) {
    return `Não encontrei obras com equipe ativa pendente de ponto em ${agentDateLabel(ctx.today)}.`;
  }

  return [
    `Existem ${ctx.pendingPointObras.length} obra(s) com ponto pendente hoje (${agentDateLabel(ctx.today)}):`,
    ...ctx.pendingPointObras.map(o => `• ${o.obraName}: ${o.missingCount} trabalhador(es) sem ponto — ${o.missingEmployees.join(", ")}`),
  ].join("\n");
};

const agentFormatCosts = ctx => {
  if (!ctx.monthlyCosts.length) return "Ainda não há custo de mão de obra lançado no mês atual.";

  return [
    "Resumo de gasto de mão de obra por obra no mês atual:",
    ...ctx.monthlyCosts.map(c => {
      const m2 = c.areaM2 > 0 ? ` · ${fmt(c.laborCostPerM2)}/m² mão de obra` : " · área m² não cadastrada";
      return `• ${c.obraName}: ${fmt(c.laborCost)} mão de obra | ${fmt(c.totalCost)} com benefícios${m2}`;
    }),
  ].join("\n");
};

const agentFormatIncompletes = ctx => {
  const parts = [];

  if (ctx.incompleteEmployees.length) {
    parts.push("Funcionários ativos com cadastro incompleto:");
    parts.push(...ctx.incompleteEmployees.map(e => `• ${e.name}: falta ${e.missing.join(", ")}.`));
  }

  if (ctx.noAreaObras.length) {
    parts.push("\nObras sem metragem cadastrada:");
    parts.push(...ctx.noAreaObras.map(name => `• ${name}`));
  }

  if (ctx.noTeamObras.length) {
    parts.push("\nObras ativas sem equipe vinculada:");
    parts.push(...ctx.noTeamObras.map(name => `• ${name}`));
  }

  return parts.length ? parts.join("\n") : "Não encontrei pendências cadastrais relevantes nos dados atuais.";
};

const agentFormatPayroll = ctx => {
  const obs = ctx.paymentAdjusted
    ? `A data base ${agentDateLabel(ctx.paymentBaseDate)} foi ajustada para ${agentDateLabel(ctx.paymentDate)}.`
    : `A data de pagamento permanece em ${agentDateLabel(ctx.paymentDate)}.`;

  return [
    `Próximo pagamento calculado: ${agentDateLabel(ctx.paymentDate)}.`,
    obs,
    `Pontos de hoje: ${ctx.allPointsDoneToday ? "todos cadastrados" : `${ctx.pendingPointObras.length} obra(s) pendente(s)`}.`,
    ctx.pendingUnlocks.length ? `Há ${ctx.pendingUnlocks.length} solicitação(ões) de permissão pendente(s).` : "Não há solicitação de permissão pendente.",
  ].join("\n");
};

const agentFormatPriorities = ctx => {
  const priorities = [];

  if (ctx.pendingPointObras.length) priorities.push(`Finalizar ponto de ${ctx.pendingPointObras.length} obra(s) pendente(s).`);
  if (ctx.pendingUnlocks.length) priorities.push(`Analisar ${ctx.pendingUnlocks.length} solicitação(ões) de alteração de ponto.`);
  if (ctx.noAreaObras.length) priorities.push(`Cadastrar metragem de ${ctx.noAreaObras.length} obra(s) para custo por m².`);
  if (ctx.incompleteEmployees.length) priorities.push(`Corrigir cadastro de ${ctx.incompleteEmployees.length} funcionário(s) ativo(s).`);
  if (!priorities.length) priorities.push("Não há alertas críticos. Mantenha a rotina de finalizar o ponto por obra ao fim do dia.");

  return [
    "Prioridades sugeridas pelo agente:",
    ...priorities.map((p, i) => `${i + 1}. ${p}`),
  ].join("\n");
};

const generateLocalAgentAnswer = (data, question) => {
  const ctx = buildAgentContext(data);
  const q = agentNormalize(question);

  if (!q.trim()) return agentFormatPriorities(ctx);
  if (q.includes("ponto") || q.includes("falt") || q.includes("pendente") || q.includes("cadastrar")) return agentFormatPendingPoints(ctx);
  if (q.includes("custo") || q.includes("gasto") || q.includes("m2") || q.includes("metro") || q.includes("obra")) return agentFormatCosts(ctx);
  if (q.includes("cadastro") || q.includes("incompleto") || q.includes("diaria") || q.includes("metragem")) return agentFormatIncompletes(ctx);
  if (q.includes("folha") || q.includes("pagamento") || q.includes("feriado") || q.includes("salario")) return agentFormatPayroll(ctx);
  if (q.includes("prioridade") || q.includes("risco") || q.includes("alerta") || q.includes("resumo")) return agentFormatPriorities(ctx);

  return [
    "Análise geral do agente:",
    agentFormatPriorities(ctx),
    "",
    agentFormatPendingPoints(ctx),
    "",
    agentFormatPayroll(ctx),
  ].join("\n");
};

async function askRemoteAgentIfAvailable(data, question) {
  try {
    const response = await fetch("/api/ai-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        context: buildAgentContext(data),
      }),
    });

    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return payload?.answer || null;
  } catch {
    return null;
  }
}

function AgenteIA({ data, showToast, onTab }) {
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const initialAnswer = useMemo(() => generateLocalAgentAnswer(data, "prioridades"), [data]);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Sou o Agente IA da ArcD Obras. Posso ajudar com ponto pendente, folha, custo por obra, custo por m², cadastros incompletos e alertas operacionais.",
    },
    { role: "assistant", text: initialAnswer },
  ]);

  const ctx = useMemo(() => buildAgentContext(data), [data]);

  const quickPrompts = [
    "O que falta no ponto de hoje?",
    "Quais obras estão gastando mais?",
    "Quais cadastros estão incompletos?",
    "Resumo da folha e pagamento",
    "Quais são as prioridades de hoje?",
  ];

  const sendQuestion = async (question = input) => {
    const q = String(question || "").trim();
    if (!q) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setThinking(true);

    const remote = await askRemoteAgentIfAvailable(data, q);
    const answer = remote || generateLocalAgentAnswer(data, q);

    setMessages(prev => [...prev, { role: "assistant", text: answer }]);
    setThinking(false);
  };

  const copyLastAnswer = () => {
    const last = [...messages].reverse().find(m => m.role === "assistant")?.text || "";
    if (!last) return;
    navigator.clipboard.writeText(last).then(() => showToast("Resposta copiada.")).catch(() => showToast("Erro ao copiar.", "error"));
  };

  const goToPendingPoint = () => {
    onTab?.("ponto");
    if (ctx.pendingPointObras.length) showToast("Abra a obra pendente no filtro do ponto.", "warn");
  };

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          background: `linear-gradient(135deg, ${C.yellow}, ${C.yellowD})`,
          color: C.bg,
          border: `1px solid ${C.yellow}`,
          padding: 16,
          borderRadius: 14,
          boxShadow: `0 16px 36px ${C.yellow}22`,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.78 }}>
          Assistente operacional
        </p>
        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 36, letterSpacing: 2, lineHeight: 1 }}>
          Agente IA ArcD
        </h2>
        <p style={{ fontSize: 13, fontWeight: 700, maxWidth: 720 }}>
          Analisa ponto, folha, obras, pendências, custo por obra e custo de mão de obra por m².
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {[
          [ctx.allPointsDoneToday ? "Ponto completo" : "Ponto pendente", ctx.allPointsDoneToday ? "Todas as obras" : `${ctx.pendingPointObras.length} obra(s)`, ctx.allPointsDoneToday ? C.green : C.red],
          ["Funcionários ativos", ctx.activeEmployees, C.yellow],
          ["Solicitações", ctx.pendingUnlocks.length, ctx.pendingUnlocks.length ? C.red : C.green],
          ["Obras sem m²", ctx.noAreaObras.length, ctx.noAreaObras.length ? C.orange : C.green],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: `3px solid ${color}`, padding: 12, borderRadius: 12 }}>
            <p style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", fontWeight: 900 }}>{label}</p>
            <p style={{ color, fontFamily: "'Barlow Condensed'", fontSize: 23, fontWeight: 900 }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Btn v="warning" onClick={goToPendingPoint} full><Ic n="clock" /> Ir para Ponto</Btn>
        <Btn v="ghost" onClick={() => onTab?.("relat")} full><Ic n="chart" /> Ver Relatórios</Btn>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14, borderRadius: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, fontSize: 18, textTransform: "uppercase", marginBottom: 10 }}>
          Perguntas rápidas
        </h3>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {quickPrompts.map(p => (
            <button
              key={p}
              onClick={() => sendQuestion(p)}
              style={{
                background: C.surface,
                color: C.text,
                border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${C.yellow}`,
                padding: "8px 10px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 12, borderRadius: 14, minHeight: 300 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, fontSize: 18, textTransform: "uppercase" }}>
            Conversa com o agente
          </h3>
          <Btn v="ghost" size="sm" onClick={copyLastAnswer}><Ic n="copy" /> Copiar</Btn>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9, maxHeight: 390, overflowY: "auto", paddingRight: 3 }}>
          {messages.map((m, idx) => (
            <div
              key={`${m.role}-${idx}`}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "stretch",
                maxWidth: m.role === "user" ? "86%" : "100%",
                background: m.role === "user" ? C.yellow : C.surface,
                color: m.role === "user" ? C.bg : C.text,
                border: `1px solid ${m.role === "user" ? C.yellow : C.border}`,
                borderLeft: m.role === "assistant" ? `4px solid ${C.yellow}` : undefined,
                borderRadius: 12,
                padding: "10px 12px",
                whiteSpace: "pre-wrap",
                fontSize: 13,
                lineHeight: 1.35,
              }}
            >
              {m.text}
            </div>
          ))}
          {thinking && (
            <div style={{ color: C.yellow, fontSize: 12, fontWeight: 800, padding: "6px 2px" }}>
              Agente analisando dados...
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
        <Inp
          value={input}
          onChange={setInput}
          placeholder="Pergunte: quais obras faltam ponto? qual maior custo por m²?"
        />
        <Btn onClick={() => sendQuestion()} disabled={thinking || !input.trim()}>
          <Ic n="brain" /> Enviar
        </Btn>
      </div>

      <p style={{ color: C.muted, fontSize: 11, lineHeight: 1.35 }}>
        O agente usa os dados já cadastrados no sistema. Se existir uma rota segura <strong>/api/ai-agent</strong>, ele usa IA generativa; caso contrário, responde com análise local automática, sem expor chaves no navegador.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Configurações / aprovações
// ═══════════════════════════════════════════════════════════════════

function Config({ data, update, showToast }) {
  const [form, setForm] = useState(data.config);
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const setField = key => value => setForm(f => ({ ...f, [key]: value }));
  const pr = getPayrollSettings(form);
  const setPayroll = key => value => setForm(f => ({ ...f, payroll: { ...getPayrollSettings(f), [key]: value } }));
  const prPreviewBase = new Date();
  const prPreview = getQ(prPreviewBase.getFullYear(), prPreviewBase.getMonth(), form);
  const prRange = arr => (arr.length ? `${fmtDate(arr[0])} a ${fmtDate(arr[arr.length - 1])}` : "vazio");
  const dayOptions = Array.from({ length: 31 }, (_, i) => ({ v: String(i + 1), l: String(i + 1) }));
  const closeOptions = [{ v: "0", l: "Último dia do mês" }, ...dayOptions];
  const payMonthOptions = [{ v: "same", l: "Mesmo mês" }, { v: "next", l: "Mês seguinte" }];
  const holidays = getPayrollHolidays(data, holidayYear);

  const saveConfig = () => {
    update({ ...data, config: { ...data.config, ...form } });
    showToast("Configurações salvas.");
  };

  const approveRequest = id => {
    const validUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const unlockRequests = data.unlockRequests.map(r => r.id === id ? { ...r, status: "approved", approvedAt: new Date().toISOString(), validUntil } : r);
    const req = data.unlockRequests.find(r => r.id === id);
    const changeLog = [...data.changeLog, { id: uid(), date: today(), type: "unlock_approved", message: `Permissão aprovada para ${req?.obraName || "obra"} em ${fmtDateFull(req?.date)} até ${new Date(validUntil).toLocaleTimeString("pt-BR")}.` }];
    update({ ...data, unlockRequests, changeLog });
    showToast("Permissão aprovada por 30 minutos.");
  };

  const rejectRequest = id => {
    const unlockRequests = data.unlockRequests.map(r => r.id === id ? { ...r, status: "rejected", rejectedAt: new Date().toISOString() } : r);
    update({ ...data, unlockRequests });
    showToast("Solicitação recusada.");
  };

  const pending = data.unlockRequests.filter(r => r.status === "pending").slice().reverse();
  const recent = data.unlockRequests.slice().reverse().slice(0, 12);

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arcd-obras-backup-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exportado.");
  };

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 30, letterSpacing: 2, color: C.yellow }}>Configurações</h2>
        <p style={{ color: C.muted, fontSize: 13 }}>Dados da empresa, aprovações e calendário.</p>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", marginBottom: 10 }}>Empresa</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="Empresa" value={form.companyName} onChange={setField("companyName")} />
          <Inp label="Produto" value={form.productName} onChange={setField("productName")} />
          <Inp label="CNPJ" value={form.cnpj} onChange={setField("cnpj")} />
          <Inp label="Responsável RH" value={form.hrName} onChange={setField("hrName")} />
          <Inp label="E-mail RH" value={form.hrEmail} onChange={setField("hrEmail")} />
          <Inp label="E-mail aprovador" value={form.approverEmail} onChange={setField("approverEmail")} />
        </div>
        <div style={{ marginTop: 12 }}><Btn onClick={saveConfig}><Ic n="check" /> Salvar configurações</Btn></div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", marginBottom: 4 }}>Período da folha</h3>
        <p style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>Defina os dias de abertura e fechamento de cada quinzena e as datas de pagamento. Vale para a visualização e para a exportação (PDF, Excel, e-mail e WhatsApp).</p>

        <p style={{ color: C.subtle, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>1ª quinzena</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Sel label="Dia de abertura" value={String(pr.q1OpenDay)} onChange={v => setPayroll("q1OpenDay")(Number(v))} options={dayOptions} />
          <Sel label="Dia de fechamento" value={String(pr.q1CloseDay)} onChange={v => setPayroll("q1CloseDay")(Number(v))} options={dayOptions} />
          <Sel label="Dia de pagamento" value={String(pr.q1PayDay)} onChange={v => setPayroll("q1PayDay")(Number(v))} options={dayOptions} />
          <Sel label="Pagamento no" value={pr.q1PayMonth} onChange={v => setPayroll("q1PayMonth")(v)} options={payMonthOptions} />
        </div>

        <p style={{ color: C.subtle, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "14px 0 8px" }}>2ª quinzena</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Sel label="Dia de abertura" value={String(pr.q2OpenDay)} onChange={v => setPayroll("q2OpenDay")(Number(v))} options={dayOptions} />
          <Sel label="Dia de fechamento" value={String(pr.q2CloseDay)} onChange={v => setPayroll("q2CloseDay")(Number(v))} options={closeOptions} />
          <Sel label="Dia de pagamento" value={String(pr.q2PayDay)} onChange={v => setPayroll("q2PayDay")(Number(v))} options={dayOptions} />
          <Sel label="Pagamento no" value={pr.q2PayMonth} onChange={v => setPayroll("q2PayMonth")(v)} options={payMonthOptions} />
        </div>

        <div style={{ marginTop: 14 }}>
          <Sel label="Ajustar pagamento para dia útil (fim de semana/feriado)" value={pr.adjustPayDate ? "on" : "off"} onChange={v => setPayroll("adjustPayDate")(v === "on")} options={[{ v: "on", l: "Sim, evitar sábado/domingo/feriado" }, { v: "off", l: "Não, manter o dia exato" }]} />
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.yellow}`, padding: 12, marginTop: 14 }}>
          <p style={{ color: C.subtle, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Prévia ({fullMonth(prPreviewBase.getMonth())} {prPreviewBase.getFullYear()})</p>
          <p style={{ color: prPreview.q1.length ? C.text : C.red, fontSize: 13 }}>1ª quinzena: {prRange(prPreview.q1)} ({prPreview.q1.length} dia(s))</p>
          <p style={{ color: prPreview.q2.length ? C.text : C.red, fontSize: 13 }}>2ª quinzena: {prRange(prPreview.q2)} ({prPreview.q2.length} dia(s))</p>
          {(prPreview.q1.length === 0 || prPreview.q2.length === 0) && <p style={{ color: C.red, fontSize: 12, marginTop: 6 }}>Atenção: uma das quinzenas ficou vazia. Verifique se o dia de abertura é menor ou igual ao de fechamento.</p>}
        </div>

        <div style={{ marginTop: 12 }}><Btn onClick={saveConfig}><Ic n="check" /> Salvar período da folha</Btn></div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", marginBottom: 10 }}>Solicitações pendentes</h3>
        {pending.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>Nenhuma solicitação pendente.</p>}
        {pending.map(r => (
          <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.yellow}`, padding: 12, marginBottom: 8 }}>
            <p style={{ fontWeight: 900 }}>{r.obraName} · {fmtDateFull(r.date)}</p>
            <p style={{ color: C.muted, fontSize: 12 }}>{r.employeeName || "Todos / obra"}</p>
            <p style={{ color: C.subtle, fontSize: 12, marginTop: 5 }}>{r.reason}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Btn v="success" size="sm" onClick={() => approveRequest(r.id)}><Ic n="unlock" /> Aprovar 30 min</Btn>
              <Btn v="danger" size="sm" onClick={() => rejectRequest(r.id)}><Ic n="x" /> Recusar</Btn>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", marginBottom: 10 }}>Histórico de permissões</h3>
        {recent.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>Sem solicitações registradas.</p>}
        {recent.map(r => (
          <div key={r.id} style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 0" }}>
            <p style={{ color: r.status === "approved" ? C.green : r.status === "rejected" ? C.red : C.yellow, fontWeight: 900, fontSize: 13 }}>{String(r.status || "pending").toUpperCase()} · {r.obraName} · {fmtDateFull(r.date)}</p>
            <p style={{ color: C.muted, fontSize: 12 }}>{r.employeeName || "Todos / obra"} · {r.reason}</p>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", marginBottom: 10 }}>Feriados considerados</h3>
        <Sel value={String(holidayYear)} onChange={v => setHolidayYear(Number(v))} options={Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => ({ v: String(y), l: String(y) }))} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6, marginTop: 10 }}>
          {holidays.map(h => <Badge key={h} color={C.blue}>{fmtDateFull(h)}</Badge>)}
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", marginBottom: 10 }}>Backup</h3>
        <Btn v="ghost" onClick={exportBackup}><Ic n="download" /> Exportar backup JSON</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// App principal
// ═══════════════════════════════════════════════════════════════════

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const approvalHandledRef = useRef(false);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const update = useCallback(async (next) => {
    const normalized = normalizeData(next);

    // Atualização otimista para manter a interface rápida.
    setData(normalized);

    try {
      const result = await supabaseSave(normalized);

      if (result && typeof result === "object" && result.reason === "STALE_DATA") {
        const fresh = await supabaseLoad();
        setData(normalizeData(fresh || normalized));
        showToast(
          "A base foi alterada por outro usuário. Recarreguei os dados para evitar apagar alocações ou pontos fechados.",
          "error"
        );
        return;
      }

      if (result !== true) {
        showToast("Não foi possível salvar no Supabase. Confira a conexão antes de continuar.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao salvar no Supabase. Nenhuma alteração remota foi confirmada.", "error");
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const loaded = await supabaseLoad();
        if (!active) return;
        setData(normalizeData(loaded || DEFAULT()));
      } catch (err) {
        console.error(err);
        if (active) {
          setData(normalizeData(DEFAULT()));
          showToast("Erro ao carregar dados. Base padrão criada.", "warn");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [showToast]);

  useEffect(() => {
    if (!data || loading || approvalHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get("approve_unlock");
    if (!requestId) return;
    approvalHandledRef.current = true;

    const req = data.unlockRequests.find(r => r.id === requestId);
    if (!req) {
      showToast("Solicitação de permissão não encontrada.", "error");
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      return;
    }

    if (req.status === "approved" && req.validUntil && new Date(req.validUntil) > new Date()) {
      showToast("Essa permissão já está aprovada e vigente.");
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      return;
    }

    const ok = window.confirm(`Aprovar alteração do ponto por 30 minutos?\n\nObra: ${req.obraName}\nData: ${fmtDateFull(req.date)}\nTrabalhador: ${req.employeeName || "Todos / obra"}`);
    if (!ok) {
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      return;
    }

    const validUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const unlockRequests = data.unlockRequests.map(r => r.id === requestId ? { ...r, status: "approved", approvedAt: new Date().toISOString(), validUntil } : r);
    const changeLog = [...data.changeLog, { id: uid(), date: today(), type: "unlock_approved_link", message: `Permissão aprovada via link para ${req.obraName} em ${fmtDateFull(req.date)}.` }];
    update({ ...data, unlockRequests, changeLog });
    showToast("Permissão aprovada por 30 minutos.");
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
  }, [data, loading, showToast, update]);

  const tabs = [
    { id: "home", label: "Painel", icon: "home" },
    { id: "obras", label: "Obras", icon: "home" },
    { id: "equipe", label: "Equipe", icon: "users" },
    { id: "ponto", label: "Ponto", icon: "clock" },
    { id: "folha", label: "Folha", icon: "dollar" },
    { id: "relat", label: "Custos", icon: "chart" },
    { id: "ia", label: "IA", icon: "brain" },
    { id: "config", label: "Ajustes", icon: "settings" },
  ];

  if (loading || !data) {
    return (
      <>
        <style>{G}</style>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 44, height: 44, border: `4px solid ${C.border}`, borderTopColor: C.yellow, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 14px" }} />
            <BrandMark />
            <p style={{ color: C.muted, marginTop: 14 }}>Carregando operação...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{G}</style>
      <div style={{ minHeight: "100vh", background: "transparent", color: C.text, paddingBottom: 92 }}>
        <header className="no-print" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(9,9,7,.86)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <BrandMark compact />
            <button
              onClick={() => setTab("ponto")}
              style={{
                background: tab === "ponto" ? C.yellow : `${C.yellow}16`,
                color: tab === "ponto" ? C.ink : C.yellow,
                border: `1px solid ${C.yellow}`,
                borderRadius: 999,
                padding: "9px 13px",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                cursor: "pointer",
                fontFamily: "'Barlow Condensed'",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: .8,
                "--ic-color": tab === "ponto" ? C.ink : C.yellow,
              }}
            >
              <Ic n="clock" /> Ponto agora
            </button>
          </div>
        </header>

        <main style={{ maxWidth: 1080, margin: "0 auto", padding: 14 }}>
          {tab === "home" && <Dashboard data={data} onTab={setTab} />}
          {tab === "obras" && <Obras data={data} update={update} showToast={showToast} />}
          {tab === "equipe" && <Equipe data={data} update={update} showToast={showToast} />}
          {tab === "ponto" && <Ponto data={data} update={update} showToast={showToast} />}
          {tab === "folha" && <Folha data={data} showToast={showToast} />}
          {tab === "relat" && <Relatorios data={data} />}
          {tab === "ia" && <AgenteIA data={data} showToast={showToast} onTab={setTab} />}
          {tab === "config" && <Config data={data} update={update} showToast={showToast} />}
        </main>

        <nav className="no-print" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(17,17,15,.92)", backdropFilter: "blur(18px)", borderTop: `1px solid ${C.line}`, zIndex: 80 }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", gap: 7, overflowX: "auto", padding: "8px 10px 10px" }}>
            {tabs.map(t => {
              const active = tab === t.id;
              const isMainPoint = t.id === "ponto";
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  minWidth: isMainPoint ? 92 : 72,
                  background: isMainPoint ? (active ? C.yellow : `${C.yellow}18`) : active ? `${C.yellow}13` : "transparent",
                  color: isMainPoint ? (active ? C.ink : C.yellow) : active ? C.yellow : C.muted,
                  border: isMainPoint ? `1px solid ${C.yellow}` : `1px solid ${active ? C.yellow + "55" : "transparent"}`,
                  borderRadius: 16,
                  padding: isMainPoint ? "10px 8px" : "9px 7px",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: .4,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  boxShadow: isMainPoint ? `0 0 28px ${C.yellow}20` : "none",
                  "--ic-color": isMainPoint ? (active ? C.ink : C.yellow) : C.yellow,
                  flex: "0 0 auto",
                }}>
                  <Ic n={t.icon} s={isMainPoint ? 21 : 17} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
      <Toast toast={toast} />
    </>
  );
}
