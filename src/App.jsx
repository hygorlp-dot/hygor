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
// - Bloqueio do ponto por obra/data após finalização
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

const getQ = (year, monthIndex) => {
  const all = getDays(year, monthIndex);
  return {
    q1: all.filter(d => Number(d.split("-")[2]) <= 15),
    q2: all.filter(d => Number(d.split("-")[2]) > 15),
  };
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
  // 1ª quinzena do mês selecionado paga dia 20 do mesmo mês.
  // 2ª quinzena do mês selecionado paga dia 05 do mês seguinte.
  const paymentMonth = q === "1" ? monthIndex : monthIndex + 1;
  const paymentYear = paymentMonth > 11 ? year + 1 : year;
  const normalizedPaymentMonth = paymentMonth > 11 ? 0 : paymentMonth;
  const baseDay = q === "1" ? 20 : 5;
  const baseDate = prDateAtNoon(paymentYear, normalizedPaymentMonth, baseDay);
  const holidays = getPayrollHolidays(data, paymentYear);
  const adjustedDate = adjustPayrollPaymentDate(baseDate, holidays);

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
const isAttendanceLocked = (data, obraId, date) => !!getAttendanceLock(data, obraId, date)?.locked;

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

// ─── Especialidades de terceirizados ────────────────────────────────
const SPECIALTIES = [
  { v: "eletricista",  l: "Eletricista",  emoji: "⚡", color: "#f6d833" },
  { v: "encanador",    l: "Encanador",    emoji: "🔧", color: "#54a0ff" },
  { v: "serralheiro",  l: "Serralheiro",  emoji: "🔩", color: "#ff9f1c" },
  { v: "armador",      l: "Armador",      emoji: "🏗",  color: "#b779ff" },
  { v: "outros",       l: "Outros",       emoji: "👷",  color: "#8f8661" },
];
const specInfo = v => SPECIALTIES.find(s => s.v === v) || { l: "Outros", emoji: "👷", color: "#8f8661" };

// Retorna a sexta-feira da semana atual, navegável por weekOffset
const getFridayOfWeek = (weekOffset = 0) => {
  const d = new Date();
  const day = d.getDay(); // 0=Dom..6=Sab
  const toFri = (5 - day + 7) % 7;
  const adjusted = (day === 0 || day === 6) ? toFri - 7 : toFri;
  d.setDate(d.getDate() + adjusted + weekOffset * 7);
  return toLocalISODate(d);
};

const getWeekRange = (fridayIso) => {
  const fri = new Date(fridayIso + "T12:00:00");
  const mon = new Date(fri); mon.setDate(fri.getDate() - 4);
  return { start: toLocalISODate(mon), end: fridayIso };
};


const CONTRACT_TYPES = [
  { v: "fixed_labor",       l: "Preço fechado — MO" },
  { v: "fixed_labor_admin", l: "Preço fechado — MO + % Admin" },
  { v: "admin_only",        l: "Somente administração (% Admin)" },
];

const CONTRACT_LABELS = {
  fixed_labor:       "MO Fechado",
  fixed_labor_admin: "MO + Admin",
  admin_only:        "Só Admin",
};

const DEFAULT = () => ({
  userName: "",
  config: {
    companyName: "ArcD Obras",
    productName: "Gestão de Equipes",
    hrEmail: "",
    hrName: "",
    hrPhone: "",
    cnpj: "",
    approverEmail: "hygorlp@gmail.com",
    paymentHolidays: [],
  },
  obras: [
    { id: uid(), name: "Obra 1", address: "", engineer: "", startDate: "", status: "active", areaM2: 0, contractType: "fixed_labor", contractValue: 0, adminPercentage: 0 },
    { id: uid(), name: "Obra 2", address: "", engineer: "", startDate: "", status: "active", areaM2: 0, contractType: "fixed_labor", contractValue: 0, adminPercentage: 0 },
  ],
  employees: [],
  attendance: {},
  advances: [],
  payments: [],
  terceirizados: [],
  pagsTerceiros: [],
  rescisoes: [],
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
      hrPhone: d.config?.hrPhone || "",
      paymentHolidays: Array.isArray(d.config?.paymentHolidays) ? d.config.paymentHolidays : [],
    },
    obras: Array.isArray(d.obras) ? d.obras.map(o => ({
      id: o.id || uid(),
      name: o.name || "Obra sem nome",
      address: o.address || "",
      engineer: o.engineer || "",
      startDate: o.startDate || "",
      status: o.status || "active",
      areaM2: Number(o.areaM2 || 0),
      contractType: o.contractType || "fixed_labor",
      contractValue: Number(o.contractValue || 0),
      adminPercentage: Number(o.adminPercentage || 0),
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
    payments: Array.isArray(d.payments) ? d.payments : [],
    terceirizados: Array.isArray(d.terceirizados) ? d.terceirizados.map(t => ({
      id: t.id || uid(),
      name: t.name || "",
      specialty: t.specialty || "outros",
      obraId: t.obraId || "",
      contractValue: Number(t.contractValue || 0),
      weeklyRate: Number(t.weeklyRate || 0),
      phone: t.phone || "",
      pixKey: t.pixKey || "",
      notes: t.notes || "",
      active: t.active !== false,
      startDate: t.startDate || "",
    })) : [],
    pagsTerceiros: Array.isArray(d.pagsTerceiros) ? d.pagsTerceiros : [],
    rescisoes: Array.isArray(d.rescisoes) ? d.rescisoes : [],
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
    terc: "◈",
    pay: "₽",
    week: "◫",
    chevL: "‹",
    chevR: "›",
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

// ═══════════════════════════════════════════════════════════════════
// HELPERS FINANCEIROS
// ═══════════════════════════════════════════════════════════════════

const calcObraLaborCost = (data, obraId, days) => {
  const year = days[0] ? Number(days[0].slice(0,4)) : new Date().getFullYear();
  const holidays = getPayrollHolidays(data, year);
  const holidaysInPeriod = days.filter(d => holidays.includes(d) && prIsWeekdayIso(d));
  let laborCost = 0, benefitCost = 0;
  data.employees.forEach(e => {
    if (e.obra !== obraId && e.lastObra !== obraId) return;
    days.forEach(d => {
      if (!isEmployeeEmployedOnDate(e, d)) return;
      if (holidaysInPeriod.includes(d)) return;
      const st = attStatus(data, e.id, d);
      if (st === "P") { laborCost += Number(e.dailyRate||0); benefitCost += Number(e.vtDaily||0)+Number(e.vrDaily||0); }
      else if (st === "M") { laborCost += Number(e.dailyRate||0)*.5; benefitCost += (Number(e.vtDaily||0)+Number(e.vrDaily||0))*.5; }
    });
    holidaysInPeriod.forEach(h => {
      if (!isEmployeeEmployedOnDate(e, h) || e.obra !== obraId) return;
      laborCost += Number(getHolidayPayRule(data, e, h, holidays).amount||0);
    });
  });
  return { laborCost, benefitCost, totalCost: laborCost + benefitCost };
};

const calcObraRevenue = (obra, laborCost) => {
  const ct = obra.contractType || "fixed_labor";
  const cv = Number(obra.contractValue||0);
  const ap = Number(obra.adminPercentage||0)/100;
  let revenue = 0;
  if (ct === "fixed_labor")       revenue = cv;
  else if (ct === "fixed_labor_admin") revenue = cv + laborCost * ap;
  else if (ct === "admin_only")   revenue = laborCost * ap;
  const margin = revenue - laborCost;
  const marginPct = revenue > 0 ? (margin/revenue)*100 : 0;
  const commitment = cv > 0 ? (laborCost/cv)*100 : null;
  return { revenue, margin, marginPct, commitment };
};

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD — redesenhado
// ═══════════════════════════════════════════════════════════════════

function Dashboard({ data, onTab }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const { q1, q2 } = getQ(year, month);
  const qDays = day <= 15 ? q1 : q2;
  const todayIso = today();
  const activeEmps = data.employees.filter(e => e.active !== false);
  const activeObras = data.obras.filter(o => o.status !== "done");

  const presentes = activeEmps.filter(e => attStatus(data, e.id, todayIso) === "P").length;
  const faltas   = activeEmps.filter(e => attStatus(data, e.id, todayIso) === "F").length;
  const meiodia  = activeEmps.filter(e => attStatus(data, e.id, todayIso) === "M").length;
  const semReg   = Math.max(0, activeEmps.length - presentes - faltas - meiodia);
  const checkPending = activeEmps.length > 0 && data.dailyCheckDate !== todayIso;
  const todayCompletion = activeEmps.length ? Math.round(((presentes+faltas+meiodia)/activeEmps.length)*100) : 0;

  const qTotal = activeEmps.reduce((sum,e) => sum + qDays.reduce((s,d) => {
    const st = attStatus(data,e.id,d);
    if(st==="P") return s+Number(e.dailyRate||0);
    if(st==="M") return s+Number(e.dailyRate||0)*.5;
    return s;
  },0), 0);

  // KPIs financeiros do mês — memoizados para não travar o UI a cada re-render
  const { totalLaborMonth, totalRevenueMonth } = useMemo(() => {
    const mdays = getDays(year, month);
    let labor = 0, revenue = 0;
    data.obras.filter(o => o.status !== "done").forEach(o => {
      const { laborCost } = calcObraLaborCost(data, o.id, mdays);
      labor   += laborCost;
      revenue += calcObraRevenue(o, laborCost).revenue;
    });
    return { totalLaborMonth: labor, totalRevenueMonth: revenue };
  }, [data, year, month]); // roda só quando data/mês mudam, não em todo re-render

  const monthPayments = (data.payments||[]).filter(p => p.date && p.date.startsWith(`${year}-${String(month+1).padStart(2,"0")}`));
  const monthReceived = monthPayments.reduce((s,p) => s+Number(p.amount||0), 0);

  const last7 = [];
  for(let i=6;i>=0;i--){
    const dt=new Date(); dt.setDate(dt.getDate()-i);
    const iso=toLocalISODate(dt);
    last7.push({ d:fmtDate(iso), P:activeEmps.filter(e=>attStatus(data,e.id,iso)==="P").length, M:activeEmps.filter(e=>attStatus(data,e.id,iso)==="M").length, F:activeEmps.filter(e=>attStatus(data,e.id,iso)==="F").length });
  }

  const pieData = [
    {name:"Presente",value:presentes,color:C.green},
    {name:"Meio dia",value:meiodia,color:C.yellow},
    {name:"Falta",value:faltas,color:C.red},
    {name:"Sem registro",value:semReg,color:C.muted},
  ].filter(i=>i.value>0);

  const KpiCard = ({label,value,sub,color,icon,tab}) => (
    <button onClick={()=>tab&&onTab(tab)} className="lift-card" style={{
      background:`linear-gradient(160deg,${C.card2} 0%,${C.card} 100%)`,
      border:`1px solid ${C.line}`,borderTop:`3px solid ${color}`,
      padding:"14px 12px",borderRadius:18,textAlign:"left",color:C.text,
      cursor:tab?"pointer":"default",boxShadow:`0 8px 28px ${C.shadow}`,
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{color:C.muted,fontSize:10,fontWeight:900,textTransform:"uppercase",letterSpacing:1}}>{label}</span>
        <Ic n={icon} s={16} color={color}/>
      </div>
      <p style={{fontFamily:"'Bebas Neue'",color,fontSize:28,letterSpacing:.5,lineHeight:1}}>{value}</p>
      {sub&&<p style={{color:C.muted,fontSize:11,marginTop:4}}>{sub}</p>}
    </button>
  );

  return (
    <div className="anim" style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* Hero banner */}
      <div style={{
        background:`linear-gradient(135deg,${C.yellow} 0%,${C.yellowD} 55%,#4a3c0a 100%)`,
        color:C.ink,borderRadius:22,padding:"18px 20px",
        border:`1px solid ${C.yellow}`,boxShadow:`0 24px 60px ${C.yellow}20`,
        position:"relative",overflow:"hidden",
      }}>
        <div style={{position:"absolute",right:-10,top:-20,fontFamily:"'Bebas Neue'",fontSize:110,lineHeight:1,opacity:.08,pointerEvents:"none",color:C.ink}}>ARCD</div>
        <BrandMark dark/>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:14,alignItems:"flex-end",marginTop:16}}>
          <div>
            <p style={{fontSize:11,fontWeight:900,letterSpacing:1.2,textTransform:"uppercase",opacity:.7}}>Central de operações</p>
            <h2 style={{fontFamily:"'Bebas Neue'",fontSize:40,lineHeight:.9,letterSpacing:1.6,margin:"4px 0 8px"}}>Ponto · Equipe · Resultado.</h2>
            <p style={{fontSize:12,fontWeight:700,opacity:.8}}>Controle em tempo real. Decisão com dado.</p>
          </div>
          <div style={{textAlign:"right"}}>
            <p style={{fontFamily:"'Bebas Neue'",fontSize:52,lineHeight:.9,letterSpacing:1}}>{todayCompletion}%</p>
            <p style={{fontSize:10,fontWeight:900,textTransform:"uppercase",letterSpacing:.8,opacity:.75}}>ponto hoje</p>
          </div>
        </div>
        <div style={{marginTop:14,height:6,background:"rgba(0,0,0,.18)",borderRadius:99,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${todayCompletion}%`,background:C.ink,borderRadius:99,transition:"width .3s"}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}>
          <Btn onClick={()=>onTab("ponto")} v="dark" full style={{background:C.ink,color:C.yellow,borderColor:C.ink,"--ic-color":C.yellow}}>
            <Ic n="clock"/> Registrar Ponto
          </Btn>
          <Btn onClick={()=>onTab("fin")} v="ghost" full style={{borderColor:"rgba(5,5,4,.3)",color:C.ink,background:"rgba(5,5,4,.1)","--ic-color":C.ink}}>
            <Ic n="dollar"/> Financeiro
          </Btn>
        </div>
      </div>

      {checkPending && (
        <button onClick={()=>onTab("ponto")} className="lift-card" style={{
          background:`${C.yellow}12`,border:`1px solid ${C.yellow}`,borderLeft:`5px solid ${C.yellow}`,
          color:C.yellow,borderRadius:16,padding:"12px 14px",cursor:"pointer",textAlign:"left",
        }}>
          <p style={{fontFamily:"'Barlow Condensed'",fontSize:16,fontWeight:900,textTransform:"uppercase"}}>⚡ Verificação diária pendente</p>
          <p style={{color:C.subtle,fontSize:12,marginTop:2}}>Confirme ou movimente a equipe antes de lançar o ponto.</p>
        </button>
      )}

      {/* KPIs operacionais */}
      <div>
        <p style={{fontSize:10,fontWeight:900,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Operacional — hoje</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
          <KpiCard label="Trabalhadores" value={activeEmps.length} sub={`${activeObras.length} obras ativas`} color={C.yellow} icon="users" tab="equipe"/>
          <KpiCard label="Presentes hoje" value={presentes} sub={`${semReg} sem registro`} color={C.green} icon="check" tab="ponto"/>
          <KpiCard label="Custo quinzena" value={fmt(qTotal)} sub={`${qDays.length} dias`} color={C.purple} icon="dollar" tab="folha"/>
          <KpiCard label="Faltas hoje" value={faltas} sub={`${meiodia} meio período`} color={faltas>0?C.red:C.muted} icon="alert" tab="ponto"/>
        </div>
      </div>

      {/* KPIs financeiros */}
      <div>
        <p style={{fontSize:10,fontWeight:900,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Financeiro — mês atual</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
          <KpiCard label="Receita esperada" value={fmt(totalRevenueMonth)} sub="calculada por contrato" color={C.green} icon="dollar" tab="fin"/>
          <KpiCard label="Recebido" value={fmt(monthReceived)} sub={`${monthPayments.length} pagamento(s)`} color={C.blue} icon="check" tab="fin"/>
          <KpiCard label="Custo MO" value={fmt(totalLaborMonth)} sub="mão de obra própria" color={C.orange} icon="users" tab="relat"/>
          <KpiCard label="Margem estimada" value={fmt(totalRevenueMonth-totalLaborMonth)} sub={totalRevenueMonth>0?`${Math.round(((totalRevenueMonth-totalLaborMonth)/totalRevenueMonth)*100)}% da receita`:"—"} color={totalRevenueMonth>totalLaborMonth?C.green:C.red} icon="chart" tab="fin"/>
        </div>
      </div>

      {/* Gráfico 7 dias */}
      <div className="lift-card" style={{background:`linear-gradient(180deg,${C.card2},${C.card})`,border:`1px solid ${C.line}`,padding:14,borderRadius:20}}>
        <h3 style={{fontFamily:"'Barlow Condensed'",color:C.yellow,textTransform:"uppercase",letterSpacing:1,marginBottom:8,fontSize:16}}>
          Presença — últimos 7 dias
        </h3>
        <div style={{height:200}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last7} barSize={18}>
              <CartesianGrid stroke={C.border} vertical={false}/>
              <XAxis dataKey="d" stroke={C.muted} fontSize={11}/>
              <YAxis stroke={C.muted} fontSize={11} allowDecimals={false}/>
              <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.line}`,color:C.text,borderRadius:10}}/>
              <Bar dataKey="P" name="Presente" stackId="a" fill={C.green} radius={[6,6,0,0]}/>
              <Bar dataKey="M" name="Meio dia" stackId="a" fill={C.yellow}/>
              <Bar dataKey="F" name="Falta"    stackId="a" fill={C.red} radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribuição do dia */}
      {pieData.length > 0 && (
        <div className="lift-card" style={{background:`linear-gradient(180deg,${C.card2},${C.card})`,border:`1px solid ${C.line}`,padding:14,borderRadius:20}}>
          <h3 style={{fontFamily:"'Barlow Condensed'",color:C.yellow,textTransform:"uppercase",letterSpacing:1,marginBottom:8,fontSize:16}}>Distribuição de hoje</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",alignItems:"center",gap:12}}>
            <div style={{height:180}}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={68} paddingAngle={3}>
                    {pieData.map((e,i)=><Cell key={e.name} fill={e.color||CHART_COLORS[i]}/>)}
                  </Pie>
                  <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.line}`,color:C.text}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {pieData.map(i=>(
                <div key={i.name} style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:10,height:10,borderRadius:3,background:i.color,flexShrink:0}}/>
                  <div>
                    <p style={{fontSize:11,fontWeight:700,color:C.text}}>{i.name}</p>
                    <p style={{fontFamily:"'Bebas Neue'",fontSize:20,color:i.color,lineHeight:1}}>{i.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alertas ativos */}
      {(() => {
        const alerts = buildQuickAlerts(data);
        if (alerts.length === 0) return null;
        const msg = buildAlertMessage(data);
        const phone = data.config.hrPhone || "";
        const waUrl = phone
          ? `https://wa.me/${phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`
          : `https://wa.me/?text=${encodeURIComponent(msg)}`;
        return (
          <div style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:16,overflow:"hidden"}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.line}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <p style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:15,color:C.text,textTransform:"uppercase",letterSpacing:.5}}>🔔 {alerts.length} alerta(s) ativo(s)</p>
              <a href={waUrl} target="_blank" rel="noreferrer" style={{
                background:"#25D366",color:"#fff",border:"none",padding:"6px 12px",
                fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:12,letterSpacing:.5,
                cursor:"pointer",borderRadius:8,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5,
              }}>📲 Enviar WhatsApp</a>
            </div>
            {alerts.map((a,i)=>(
              <div key={i} style={{padding:"9px 14px",borderBottom:i<alerts.length-1?`1px solid ${C.line}`:"none",borderLeft:`4px solid ${a.color}`,display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:16,flexShrink:0}}>{a.icon}</span>
                <div>
                  <p style={{fontWeight:700,fontSize:13,color:C.text}}>{a.title}</p>
                  <p style={{fontSize:11,color:C.muted,marginTop:2}}>{a.sub}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Widget terceirizados — esta sexta */}
      {(() => {
        const fri = getFridayOfWeek(0);
        const { start: ws } = getWeekRange(fri);
        const activeTerc = (data.terceirizados||[]).filter(t => t.active !== false);
        const pending = activeTerc.filter(t => !(data.pagsTerceiros||[]).some(p=>p.tercId===t.id&&p.date>=ws&&p.date<=fri));
        if(activeTerc.length === 0) return null;
        return (
          <button onClick={()=>onTab("terc")} className="lift-card" style={{
            background:`${C.orange}12`, border:`1px solid ${C.orange}55`,
            borderLeft:`5px solid ${C.orange}`, padding:"12px 14px",
            borderRadius:16, textAlign:"left", color:C.text, cursor:"pointer",
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <p style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:16, textTransform:"uppercase", color:C.orange }}>
                  💰 Pagamentos desta sexta — {fmtDateFull(fri)}
                </p>
                {pending.length > 0 ? (
                  <p style={{ fontSize:12, color:C.subtle, marginTop:3 }}>
                    {pending.length} pendente(s) · {fmt(pending.reduce((s,t)=>s+Number(t.weeklyRate||0),0))} a pagar
                  </p>
                ) : (
                  <p style={{ fontSize:12, color:C.green, marginTop:3 }}>✓ Todos os {activeTerc.length} terceirizados já foram pagos</p>
                )}
              </div>
              <div style={{ background:pending.length>0?C.orange:C.green, color:C.ink, borderRadius:999, padding:"4px 10px", fontFamily:"'Bebas Neue'", fontSize:18, letterSpacing:1 }}>
                {pending.length>0?pending.length:"✓"}
              </div>
            </div>
          </button>
        );
      })()}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Btn onClick={()=>onTab("ponto")} full><Ic n="clock"/> Registrar ponto</Btn>
        <Btn onClick={()=>onTab("fin")} v="ghost" full><Ic n="dollar"/> Ver financeiro</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FINANCEIRO — KPIs por obra, receitas e contratos
// ═══════════════════════════════════════════════════════════════════

function Financeiro({ data, update, showToast }) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [filterObra, setFilterObra] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ obraId:"", date:today(), amount:"", description:"" });
  const PF = k => v => setPayForm(f=>({...f,[k]:v}));

  const days = getDays(year, month);
  const years = Array.from({length:4},(_,i)=>now.getFullYear()-1+i).map(y=>({v:String(y),l:String(y)}));

  // Calcula KPIs por obra — inclui terceirizados
  const periodStart = days[0] || "";
  const periodEnd   = days[days.length-1] || "";

  const obraRows = data.obras
    .filter(o => filterObra==="all" || o.id===filterObra)
    .map(o => {
      const {laborCost, benefitCost, totalCost} = calcObraLaborCost(data, o.id, days);
      const tercCost = calcObraTercCost(data, o.id, periodStart, periodEnd);
      const totalLaborAll = laborCost + tercCost;
      const {revenue, margin: marginMO, marginPct: marginPctMO, commitment} = calcObraRevenue(o, laborCost);
      const marginReal = revenue - totalLaborAll;
      const marginRealPct = revenue > 0 ? (marginReal/revenue)*100 : 0;
      const received = (data.payments||[])
        .filter(p => p.obraId===o.id && p.date && p.date.slice(0,7)===`${year}-${String(month+1).padStart(2,"0")}`)
        .reduce((s,p)=>s+Number(p.amount||0), 0);
      const receivedTotal = (data.payments||[])
        .filter(p => p.obraId===o.id)
        .reduce((s,p)=>s+Number(p.amount||0), 0);
      const activeEmps = data.employees.filter(e=>e.active!==false&&e.obra===o.id).length;
      const activeTercCount = (data.terceirizados||[]).filter(t=>t.active!==false&&t.obraId===o.id).length;
      return {
        ...o, laborCost, benefitCost, totalCost, tercCost, totalLaborAll,
        revenue, margin: marginReal, marginPct: marginRealPct, marginMO, marginPctMO,
        commitment, received, receivedTotal, activeEmps, activeTercCount,
      };
    });

  const T = {
    revenue:  obraRows.reduce((s,r)=>s+r.revenue,      0),
    labor:    obraRows.reduce((s,r)=>s+r.laborCost,     0),
    terc:     obraRows.reduce((s,r)=>s+r.tercCost,      0),
    margin:   obraRows.reduce((s,r)=>s+r.margin,        0),
    received: obraRows.reduce((s,r)=>s+r.received,      0),
  };
  const totalMarginPct = T.revenue>0 ? (T.margin/T.revenue)*100 : 0;

  // Receitas do período filtrado
  const allPayments = (data.payments||[])
    .filter(p => (filterObra==="all"||p.obraId===filterObra))
    .sort((a,b)=>b.date.localeCompare(a.date));

  // Gráfico: receita vs custo MO por obra
  const chartData = obraRows.map(r=>({
    name: r.name.length>12 ? r.name.slice(0,12)+"…" : r.name,
    Receita: Math.round(r.revenue),
    CustoMO: Math.round(r.laborCost),
    Margem:  Math.round(r.margin),
  }));

  // Gráfico: receitas por mês (últimos 6 meses) — memoizado
  const monthlyChart = useMemo(() => Array.from({length:6},(_,i)=>{
    const d=new Date(year,month-5+i,1);
    const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const rec=(data.payments||[]).filter(p=>(filterObra==="all"||p.obraId===filterObra)&&p.date&&p.date.startsWith(ym)).reduce((s,p)=>s+Number(p.amount||0),0);
    const mdays=getDays(d.getFullYear(),d.getMonth());
    const cost=data.obras.filter(o=>filterObra==="all"||o.id===filterObra).reduce((s,o)=>s+calcObraLaborCost(data,o.id,mdays).laborCost,0);
    const terc=(data.pagsTerceiros||[]).filter(p=>(filterObra==="all"||p.obraId===filterObra)&&p.date&&p.date.startsWith(ym)).reduce((s,p)=>s+Number(p.amount||0),0);
    return { mes:`${monthName(d.getMonth())}/${String(d.getFullYear()).slice(2)}`, Recebido:Math.round(rec), CustoMO:Math.round(cost), Terceiros:Math.round(terc) };
  }), [data, year, month, filterObra]);

  const savePayment = () => {
    if(!payForm.obraId||!payForm.amount||isNaN(Number(payForm.amount))){
      showToast("Preencha obra, data e valor.","error"); return;
    }
    const payments=[...(data.payments||[]),{id:uid(),obraId:payForm.obraId,date:payForm.date,amount:Number(payForm.amount),description:payForm.description||"Recebimento"}];
    update({...data,payments});
    setPayModal(false);
    setPayForm({obraId:"",date:today(),amount:"",description:""});
    showToast("Recebimento registrado.");
  };

  const removePayment = id => {
    if(!window.confirm("Remover recebimento?")) return;
    update({...data,payments:(data.payments||[]).filter(p=>p.id!==id)});
    showToast("Removido.");
  };

  const exportXLS = () => {
    const wb=XLSX.utils.book_new();
    // Aba KPIs
    const h1=["Obra","Tipo Contrato","Valor Contrato","Custo MO","Custo MO+Ben","Receita Esperada","Margem","Margem %","Recebido (mês)","Comprometimento %"];
    const b1=obraRows.map(r=>[r.name,CONTRACT_LABELS[r.contractType]||r.contractType,r.contractValue,r.laborCost,r.totalCost,r.revenue,r.margin,r.marginPct.toFixed(1)+"%",r.received,r.commitment!=null?r.commitment.toFixed(1)+"%":"—"]);
    const ws1=XLSX.utils.aoa_to_sheet([[`KPIs Financeiros — ${fullMonth(month)} ${year}`],[],h1,...b1,["TOTAL","","",T.labor,"",T.revenue,T.margin,(totalMarginPct).toFixed(1)+"%",T.received,""]]);
    ws1["!cols"]=[22,16,14,12,14,16,12,10,14,14].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb,ws1,"KPIs por Obra");
    // Aba recebimentos
    const h2=["Data","Obra","Valor","Descrição"];
    const b2=allPayments.map(p=>[p.date,data.obras.find(o=>o.id===p.obraId)?.name||"—",p.amount,p.description]);
    const ws2=XLSX.utils.aoa_to_sheet([["Recebimentos registrados"],[],h2,...b2]);
    ws2["!cols"]=[12,22,12,30].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb,ws2,"Recebimentos");
    XLSX.writeFile(wb,`arcd-financeiro-${year}-${String(month+1).padStart(2,"0")}.xlsx`);
    showToast("Excel exportado.");
  };

  const obraName = id => data.obras.find(o=>o.id===id)?.name||"—";

  const StatusBar = ({pct, color=C.green}) => (
    <div style={{height:6,background:C.surface,borderRadius:99,overflow:"hidden",marginTop:6}}>
      <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:pct>100?C.red:color,borderRadius:99,transition:"width .3s"}}/>
    </div>
  );

  return (
    <div className="anim" style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Header */}
      <div style={{
        background:`linear-gradient(135deg,${C.green}22 0%,${C.card} 60%)`,
        border:`1px solid ${C.green}44`,borderLeft:`5px solid ${C.green}`,
        padding:"16px 18px",borderRadius:18,
      }}>
        <p style={{fontSize:11,fontWeight:900,color:C.green,textTransform:"uppercase",letterSpacing:1.2,marginBottom:4}}>Gestão financeira</p>
        <h2 style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:2,color:C.text,lineHeight:1}}>Financeiro por Obra</h2>
        <p style={{color:C.muted,fontSize:13,marginTop:4}}>KPIs de margem, contrato, custo MO e recebimentos.</p>
      </div>

      {/* Filtros */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Sel value={String(year)} onChange={v=>setYear(Number(v))} options={years}/>
        <Sel value={String(month)} onChange={v=>setMonth(Number(v))} options={Array.from({length:12},(_,i)=>({v:String(i),l:fullMonth(i)}))}/>
      </div>
      <Sel value={filterObra} onChange={setFilterObra} options={[{v:"all",l:"Todas as obras"},...data.obras.map(o=>({v:o.id,l:o.name}))]}/>

      {/* KPI totais */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
        {[
          ["Receita esperada", fmt(T.revenue),                C.green,  "dollar"],
          ["Recebido",         fmt(T.received),               C.blue,   "check"],
          ["Custo MO própria", fmt(T.labor),                  C.orange, "users"],
          ["Custo terceiros",  fmt(T.terc),                   C.purple, "terc"],
          ["Total trabalho",   fmt(T.labor+T.terc),           C.red,    "users"],
          ["Margem real",      `${fmt(T.margin)} (${totalMarginPct.toFixed(0)}%)`, T.margin>=0?C.green:C.red, "chart"],
        ].map(([l,v,c,ic])=>(
          <div key={l} style={{background:C.card,border:`1px solid ${C.line}`,borderTop:`3px solid ${c}`,padding:"12px 14px",borderRadius:16}}>
            <p style={{fontSize:10,fontWeight:900,color:C.muted,textTransform:"uppercase",letterSpacing:.8}}>{l}</p>
            <p style={{fontFamily:"'Bebas Neue'",color:c,fontSize:22,lineHeight:1.1,marginTop:4,letterSpacing:.5}}>{v}</p>
          </div>
        ))}
      </div>

      {/* Gráfico receita vs custo */}
      {chartData.length>0 && (
        <div style={{background:C.card,border:`1px solid ${C.line}`,padding:14,borderRadius:18}}>
          <p style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:15,color:C.yellow,textTransform:"uppercase",marginBottom:10}}>Receita vs Custo MO por obra</p>
          <div style={{height:220}}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={14}>
                <CartesianGrid stroke={C.border} vertical={false}/>
                <XAxis dataKey="name" stroke={C.muted} fontSize={10}/>
                <YAxis stroke={C.muted} fontSize={10} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.line}`,color:C.text,borderRadius:10}} formatter={v=>fmt(v)}/>
                <Bar dataKey="Receita" fill={C.green} radius={[6,6,0,0]}/>
                <Bar dataKey="CustoMO" fill={C.orange} radius={[6,6,0,0]}/>
                <Bar dataKey="Margem"  fill={C.blue}   radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Gráfico mensal recebimentos vs custo */}
      <div style={{background:C.card,border:`1px solid ${C.line}`,padding:14,borderRadius:18}}>
        <p style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:15,color:C.yellow,textTransform:"uppercase",marginBottom:10}}>Recebimentos × Custos — 6 meses</p>
        <div style={{height:200}}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyChart}>
              <CartesianGrid stroke={C.border} vertical={false}/>
              <XAxis dataKey="mes" stroke={C.muted} fontSize={10}/>
              <YAxis stroke={C.muted} fontSize={10} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
              <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.line}`,color:C.text,borderRadius:10}} formatter={v=>fmt(v)}/>
              <Line type="monotone" dataKey="Recebido"   stroke={C.green}  strokeWidth={2} dot={{r:3,fill:C.green}}/>
              <Line type="monotone" dataKey="CustoMO"    stroke={C.orange} strokeWidth={2} dot={{r:3,fill:C.orange}}/>
              <Line type="monotone" dataKey="Terceiros"  stroke={C.purple} strokeWidth={2} dot={{r:3,fill:C.purple}} strokeDasharray="4 2"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fluxo de caixa */}
      <FluxoCaixa data={data}/>

      {/* Cards por obra */}
      <p style={{fontSize:10,fontWeight:900,color:C.muted,textTransform:"uppercase",letterSpacing:1}}>Análise por obra — {fullMonth(month)} {year}</p>
      {obraRows.map(r => {
        const exp = expanded===r.id;
        const marginColor = r.margin>=0 ? C.green : C.red;
        const commitColor = r.commitment!=null&&r.commitment>100 ? C.red : r.commitment!=null&&r.commitment>80 ? C.orange : C.green;
        return (
          <div key={r.id} style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:16,overflow:"hidden"}}>
            <button onClick={()=>setExpanded(exp?null:r.id)} style={{
              width:"100%",background:"transparent",border:0,color:C.text,
              padding:"14px 16px",textAlign:"left",cursor:"pointer",
              borderLeft:`5px solid ${marginColor}`,
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1}}>
                  <p style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:18,letterSpacing:.3}}>{r.name}</p>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
                    <Badge color={C.yellow}>{CONTRACT_LABELS[r.contractType]||r.contractType}</Badge>
                    {r.contractValue>0 && <Badge color={C.subtle}>Contrato: {fmt(r.contractValue)}</Badge>}
                    <Badge color={C.muted}>{r.activeEmps} MO · {r.activeTercCount} terceiros</Badge>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <p style={{fontFamily:"'Bebas Neue'",fontSize:22,color:r.margin>=0?C.green:C.red,letterSpacing:.5,lineHeight:1}}>{fmt(r.margin)}</p>
                  <p style={{fontSize:10,color:C.muted,marginTop:2}}>margem real {r.marginPct.toFixed(0)}%</p>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginTop:10}}>
                {[
                  ["Receita",fmt(r.revenue),C.green],
                  ["Custo MO",fmt(r.laborCost),C.orange],
                  ["Recebido",fmt(r.received),C.blue],
                ].map(([l,v,c])=>(
                  <div key={l} style={{background:C.surface,padding:"6px 8px",borderRadius:10}}>
                    <p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:700}}>{l}</p>
                    <p style={{fontSize:13,fontWeight:900,color:c}}>{v}</p>
                  </div>
                ))}
              </div>
              {r.commitment!=null && (
                <div style={{marginTop:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <p style={{fontSize:10,color:C.muted}}>Comprometimento do contrato</p>
                    <p style={{fontSize:10,fontWeight:900,color:commitColor}}>{r.commitment.toFixed(1)}%</p>
                  </div>
                  <StatusBar pct={r.commitment} color={commitColor}/>
                </div>
              )}
            </button>

            {exp && (
              <div style={{borderTop:`1px solid ${C.line}`,padding:"14px 16px",background:C.surface,display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {[
                    ["Contrato",fmt(r.contractValue),C.subtle],
                    ["Admin %",r.adminPercentage>0?`${r.adminPercentage}%`:"—",C.subtle],
                    ["Área",r.areaM2>0?`${r.areaM2.toLocaleString("pt-BR")} m²`:"—",C.subtle],
                    ["Custo MO própria",fmt(r.laborCost),C.orange],
                    ["Custo terceiros",fmt(r.tercCost),C.purple],
                    ["Total trabalho",fmt(r.totalLaborAll),C.red],
                    ["Benefícios",fmt(r.benefitCost),C.muted],
                    ["Total recebido",fmt(r.receivedTotal),C.blue],
                    ["Margem s/ terc",fmt(r.marginMO),r.marginMO>=0?C.yellow:C.red],
                    ["Receita",fmt(r.revenue),C.green],
                    ["Margem real",fmt(r.margin),r.margin>=0?C.green:C.red],
                    ["Saldo contrato",fmt(r.contractValue-r.laborCost),r.contractValue-r.laborCost>=0?C.green:C.red],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{background:C.card,border:`1px solid ${C.line}`,padding:"8px 10px",borderRadius:10}}>
                      <p style={{fontSize:9,color:C.muted,textTransform:"uppercase",fontWeight:700,marginBottom:3}}>{l}</p>
                      <p style={{fontSize:13,fontWeight:900,color:c}}>{v}</p>
                    </div>
                  ))}
                </div>
                {r.contractType==="fixed_labor_admin"&&<p style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>Receita = Contrato ({fmt(r.contractValue)}) + {r.adminPercentage}% sobre MO ({fmt(r.laborCost)})</p>}
                {r.contractType==="admin_only"&&<p style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>Receita = {r.adminPercentage}% sobre MO total ({fmt(r.laborCost)})</p>}
                {r.contractType==="fixed_labor"&&<p style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>Receita = valor fixo do contrato ({fmt(r.contractValue)})</p>}
              </div>
            )}
          </div>
        );
      })}
      {obraRows.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:C.muted}}>Nenhuma obra com dados no período.</div>}

      {/* Recebimentos */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
        <p style={{fontSize:10,fontWeight:900,color:C.muted,textTransform:"uppercase",letterSpacing:1}}>Recebimentos registrados</p>
        <Btn onClick={()=>setPayModal(true)} size="sm"><Ic n="plus"/> Novo</Btn>
      </div>

      {allPayments.length===0&&<div style={{background:C.card,border:`1px solid ${C.line}`,padding:"20px",textAlign:"center",color:C.muted,borderRadius:14}}>Nenhum recebimento registrado ainda.</div>}
      {allPayments.map(p=>(
        <div key={p.id} style={{background:C.card,border:`1px solid ${C.line}`,borderLeft:`4px solid ${C.green}`,padding:"12px 14px",borderRadius:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <div>
            <p style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:16}}>{p.description}</p>
            <p style={{color:C.muted,fontSize:12}}>{obraName(p.obraId)} · {fmtDateFull(p.date)}</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <p style={{fontFamily:"'Bebas Neue'",fontSize:20,color:C.green,letterSpacing:.5}}>{fmt(p.amount)}</p>
            <Btn v="danger" size="sm" onClick={()=>removePayment(p.id)}><Ic n="trash"/></Btn>
          </div>
        </div>
      ))}

      <Btn onClick={exportXLS} v="success" full><Ic n="download"/> Exportar Excel (KPIs + Recebimentos)</Btn>

      {payModal&&(
        <Modal title="Registrar recebimento" onClose={()=>setPayModal(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Sel label="Obra *" value={payForm.obraId} onChange={PF("obraId")} options={[{v:"",l:"Selecione a obra"},...data.obras.map(o=>({v:o.id,l:o.name}))]}/>
            <Inp label="Data *" type="date" value={payForm.date} onChange={PF("date")}/>
            <Inp label="Valor recebido (R$) *" type="number" value={payForm.amount} onChange={PF("amount")} placeholder="0,00"/>
            <Inp label="Descrição" value={payForm.description} onChange={PF("description")} placeholder="Ex.: Medição #1, parcela 50%..."/>
            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>setPayModal(false)} full>Cancelar</Btn>
              <Btn v="success" onClick={savePayment} full><Ic n="check"/> Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Obras
// ═══════════════════════════════════════════════════════════════════

function Obras({ data, update, showToast }) {
  const empty = { id: "", name: "", address: "", engineer: "", startDate: "", status: "active", areaM2: "", contractType: "fixed_labor", contractValue: "", adminPercentage: "" };
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
      contractValue: Number(form.contractValue || 0),
      adminPercentage: Number(form.adminPercentage || 0),
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
                {o.contractValue > 0 && <Badge color={C.green}>{CONTRACT_LABELS[o.contractType]||"Contrato"}: {fmt(o.contractValue)}</Badge>}
                {(o.contractType==="fixed_labor_admin"||o.contractType==="admin_only") && o.adminPercentage > 0 && <Badge color={C.purple}>{o.adminPercentage}% admin</Badge>}
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
            <div style={{ gridColumn:"1/-1", height:1, background:`linear-gradient(90deg,transparent,${C.line},transparent)`, margin:"4px 0" }}/>
            <div style={{ gridColumn:"1/-1" }}>
              <p style={{ fontSize:11, fontWeight:700, color:C.yellow, textTransform:"uppercase", letterSpacing:.7, marginBottom:8 }}>Contrato financeiro</p>
            </div>
            <Sel label="Tipo de contrato" value={form.contractType} onChange={setField("contractType")} options={CONTRACT_TYPES}/>
            <Inp label="Valor do contrato (R$)" type="number" value={form.contractValue} onChange={setField("contractValue")} placeholder="0,00"/>
            {(form.contractType === "fixed_labor_admin" || form.contractType === "admin_only") && (
              <Inp label="% de administração" type="number" value={form.adminPercentage} onChange={setField("adminPercentage")} placeholder="Ex.: 12"/>
            )}
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
      changeLog.push({
        id: uid(),
        date: today(),
        type: "transfer",
        empId: payload.id,
        empName: payload.name,
        from: obraName(before.obra),
        to: obraName(payload.obra),
        fromId: before.obra,   // ← ID gravado
        toId: payload.obra,    // ← ID gravado
        message: `${payload.name} transferido de ${obraName(before.obra)} para ${obraName(payload.obra)}`,
      });
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
    if (!employee.obra) {
      showToast("Este trabalhador não tem obra atual definida. Edite o cadastro dele na aba Equipe.", "error");
      return;
    }
    if (newObra === employee.obra) {
      showToast("Selecione uma obra diferente da atual.", "error");
      return;
    }
    const obraDestino = data.obras.find(o => o.id === newObra);
    if (!obraDestino) {
      showToast("Obra de destino não encontrada. Atualize a página.", "error");
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

    const changeLog = [...data.changeLog, {
      id: uid(),
      date: today(),
      type: "transfer",
      empId: employee.id,
      empName: employee.name,
      from,
      to,
      fromId: employee.obra,  // ← ID gravado para busca confiável
      toId: newObra,          // ← ID gravado para busca confiável
      message: `${employee.name} transferido de ${from} para ${to}`,
    }];
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
  const selectedObraLocked = selectedObra ? isAttendanceLocked(data, selectedObra.id, selDate) : false;
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
      showToast("Selecione uma obra específica para finalizar o ponto.", "error");
      return;
    }

    const obra = data.obras.find(o => o.id === filterObra);
    if (!obra) return;

    const obraSummary = getObraAttendanceSummary(data, selDate).find(o => o.obraId === filterObra);
    const missingNames = obraSummary?.missingEmployees?.map(e => e.name).join(", ") || "";
    const msg = obraSummary && obraSummary.missingCount > 0
      ? `Existem ${obraSummary.missingCount} trabalhador(es) sem registro nesta obra:\n\n${missingNames}\n\nDeseja finalizar mesmo assim?`
      : `Finalizar o ponto da obra "${obra.name}" em ${fmtDateFull(selDate)}?`;

    if (!window.confirm(`${msg}\n\nDepois disso, alterações precisarão de permissão.`)) return;

    const key = attendanceLockKey(filterObra, selDate);
    const attendanceLocks = {
      ...data.attendanceLocks,
      [key]: {
        id: key,
        obraId: filterObra,
        obraName: obra.name,
        date: selDate,
        locked: true,
        lockedAt: new Date().toISOString(),
      },
    };
    const changeLog = [...data.changeLog, { id: uid(), date: today(), type: "attendance_lock", message: `Ponto finalizado e bloqueado: ${obra.name} em ${fmtDateFull(selDate)}.` }];
    update({ ...data, attendanceLocks, changeLog });
    showToast("Ponto da obra finalizado e bloqueado.");
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
              Lance presença, meio dia ou falta por trabalhador. Finalize a obra para bloquear alterações.
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
          <p style={{ color: C.yellow, fontWeight: 900, fontSize: 13 }}>Selecione uma obra específica para marcar todos e finalizar/bloquear o ponto.</p>
        </div>
      )}

      {selectedObra && (
        <div style={{ background: selectedObraLocked ? `${C.red}18` : C.card, border: `1px solid ${selectedObraLocked ? C.red : C.border}`, borderLeft: `4px solid ${selectedObraLocked ? C.red : C.green}`, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ color: selectedObraLocked ? C.red : C.green, fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 17, textTransform: "uppercase" }}>
            {selectedObraLocked ? "Ponto finalizado e bloqueado" : "Ponto aberto para edição"}
          </p>
          <p style={{ color: C.subtle, fontSize: 12 }}>Obra: {selectedObra.name} · Data: {fmtDateFull(selDate)}</p>
          {selectedObraLocked ? (
            <Btn v="warning" onClick={() => setUnlockModal({ obraId: selectedObra.id, date: selDate, employee: null })} full><Ic n="mail" /> Solicitar permissão para alterar</Btn>
          ) : (
            <Btn v="danger" onClick={finalizeObraAttendance} full><Ic n="lock" /> Finalizar ponto da obra</Btn>
          )}
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
  const [q, setQ] = useState(now.getDate() <= 15 ? "1" : "2");
  const [filterObra, setFilterObra] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const { q1, q2 } = getQ(year, month);
  const days = q === "1" ? q1 : q2;
  const paymentHolidays = getPayrollHolidays(data, year);
  const holidaysInPeriod = days.filter(d => paymentHolidays.includes(d) && prIsWeekdayIso(d));
  const paymentInfo = getPayrollPaymentCalendar(year, month, q, data);
  const paymentDateLabel = fmtDateFull(paymentInfo.paymentDate);
  const paymentBaseLabel = fmtDateFull(paymentInfo.baseDate);
  const paymentObs = paymentInfo.adjusted ? `Ajustado de ${paymentBaseLabel} para ${paymentDateLabel}` : "Data normal de pagamento";
  const obraName = id => data.obras.find(o => o.id === id)?.name || "—";
  const periodLabel = `${q === "1" ? "1ª" : "2ª"} Quinzena de ${fullMonth(month)} ${year}`;

  // ── Reconstrói a obra do operário em uma data específica via changeLog ──
  const getEmpObraIdOnDate = (employee, dateIso) => {
    const transfers = (data.changeLog || [])
      .filter(t => t.type === "transfer" && t.empId === employee.id && t.date)
      .sort((a, b) => b.date.localeCompare(a.date)); // desc — mais recente primeiro

    let obraId = employee.obra || employee.lastObra || "";

    for (const t of transfers) {
      if (t.date > dateIso) {
        // Usa fromId (gravado nas novas entradas) ou fallback por nome (entradas antigas)
        if (t.fromId) {
          obraId = t.fromId;
        } else {
          const found = data.obras.find(o => o.name === t.from);
          if (found) obraId = found.id;
        }
      } else {
        break; // transferências anteriores à data não afetam
      }
    }
    return obraId;
  };

  const calcRow = employee => {
    let gross = 0;
    let presentes = 0;
    let meiodia = 0;
    let faltas = 0;
    let semRegistro = 0;
    let ot = 0;
    let vt = 0;
    let vr = 0;
    // mapa: obraId → { presentes, meiodia, faltas, dias }
    const obrasPorDia = {};

    const addToObra = (obraId, tipo) => {
      if (!obrasPorDia[obraId]) obrasPorDia[obraId] = { presentes: 0, meiodia: 0, faltas: 0 };
      if (tipo === "P") obrasPorDia[obraId].presentes++;
      else if (tipo === "M") obrasPorDia[obraId].meiodia++;
      else if (tipo === "F") obrasPorDia[obraId].faltas++;
    };

    days.forEach(d => {
      if (!isEmployeeEmployedOnDate(employee, d)) return;
      if (holidaysInPeriod.includes(d)) return;

      const a = getAtt(data, employee.id, d);
      const st = a?.status;
      const extra = Number(a?.ot || 0);
      const obraId = getEmpObraIdOnDate(employee, d);

      if (st === "P") {
        gross += Number(employee.dailyRate || 0);
        presentes++;
        ot += extra;
        vt += Number(employee.vtDaily || 0);
        vr += Number(employee.vrDaily || 0);
        addToObra(obraId, "P");
      } else if (st === "M") {
        gross += Number(employee.dailyRate || 0) * 0.5;
        meiodia++;
        ot += extra;
        vt += Number(employee.vtDaily || 0) * 0.5;
        vr += Number(employee.vrDaily || 0) * 0.5;
        addToObra(obraId, "M");
      } else if (st === "F") {
        faltas++;
        addToObra(obraId, "F");
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

    const periIni = days.length > 0 ? days[0] : "";
    const periFim = days.length > 0 ? days[days.length - 1] : "";
    const advTotal = data.advances
      .filter(a => a.empId === employee.id && periIni && periFim && a.date >= periIni && a.date <= periFim)
      .reduce((s, a) => s + Number(a.amount || 0), 0);

    // Converte mapa para array ordenado por dias trabalhados desc
    const obrasPorDiaArr = Object.entries(obrasPorDia)
      .map(([obraId, v]) => ({
        obraId,
        obraName: data.obras.find(o => o.id === obraId)?.name || "—",
        presentes: v.presentes,
        meiodia: v.meiodia,
        faltas: v.faltas,
        totalDias: v.presentes + v.meiodia + v.faltas,
      }))
      .sort((a, b) => b.totalDias - a.totalDias);

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
      obrasPorDia: obrasPorDiaArr,
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
    // Monta a tabela de detalhe por obra para o PDF
    const detalheRows = [];
    rows.forEach(r => {
      if (r.obrasPorDia.length <= 1) {
        const o = r.obrasPorDia[0] || { obraName: obraName(r.obra), presentes: 0, meiodia: 0, faltas: 0, totalDias: 0 };
        detalheRows.push(`<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.role || "-")}</td><td>${escapeHtml(o.obraName)}</td><td>${o.presentes}</td><td>${o.meiodia}</td><td>${o.faltas}</td><td>${o.totalDias}</td></tr>`);
      } else {
        r.obrasPorDia.forEach((o, i) => {
          detalheRows.push(`<tr${i === 0 ? ` style="border-top:2px solid #f0df00"` : ""}><td>${i === 0 ? escapeHtml(r.name) : ""}</td><td>${i === 0 ? escapeHtml(r.role || "-") : ""}</td><td>${escapeHtml(o.obraName)}</td><td>${o.presentes}</td><td>${o.meiodia}</td><td>${o.faltas}</td><td>${o.totalDias}</td></tr>`);
        });
        detalheRows.push(`<tr style="background:#fffde7;font-style:italic"><td></td><td></td><td><b>Total ${escapeHtml(r.name)}</b></td><td><b>${r.presentes}</b></td><td><b>${r.meiodia}</b></td><td><b>${r.faltas}</b></td><td><b>${r.presentes + r.meiodia + r.faltas}</b></td></tr>`);
      }
    });

    const html = `
      <html>
        <head>
          <title>Folha - ${escapeHtml(periodLabel)}</title>
          <style>
            body{font-family:Arial,sans-serif;padding:30px;color:#111}
            h1,h2,h3{margin:0 0 8px 0}
            p{margin:4px 0}
            table{width:100%;border-collapse:collapse;margin-top:12px;font-size:10px}
            th,td{border:1px solid #ccc;padding:5px;text-align:left}
            th{background:#f0f0f0}
            .total{font-weight:bold;background:#f7f7f7}
            .section{margin-top:36px;padding-top:16px;border-top:3px solid #f0df00}
            .signatures{margin-top:50px;display:flex;justify-content:space-between;gap:40px}
            .signature{flex:1;border-top:1px solid #111;padding-top:8px;text-align:center}
          </style>
        </head>
        <body>
          <h1>${escapeHtml(data.config.companyName || "ArcD Obras")}</h1>
          ${data.config.cnpj ? `<p>CNPJ: ${escapeHtml(data.config.cnpj)}</p>` : ""}
          <h2>Folha de Pagamento — ${escapeHtml(periodLabel)}</h2>
          <p><strong>Data de pagamento:</strong> ${escapeHtml(paymentDateLabel)}</p>
          <p><strong>Regra aplicada:</strong> ${escapeHtml(paymentObs)}</p>

          <!-- Tabela principal -->
          <table>
            <thead>
              <tr>
                <th>Funcionário</th><th>Cargo</th><th>Obra Atual</th><th>P</th><th>M</th><th>F</th><th>S/R</th><th>FP</th><th>FD</th><th>Valor Feriado</th><th>HE</th><th>Diária</th><th>Bruto</th><th>VT</th><th>VR</th><th>Adiant.</th><th>Líquido</th>
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

          <!-- Tabela de detalhe por obra -->
          <div class="section">
            <h3>Detalhe de Dias Trabalhados por Obra</h3>
            <p style="font-size:11px;color:#555">Período: ${escapeHtml(fmtDateFull(days[0]))} a ${escapeHtml(fmtDateFull(days[days.length - 1]))}</p>
            <table>
              <thead>
                <tr>
                  <th>Funcionário</th><th>Cargo</th><th>Obra</th><th>Presentes</th><th>Meio Dia</th><th>Faltas</th><th>Total c/ Registro</th>
                </tr>
              </thead>
              <tbody>
                ${detalheRows.join("")}
              </tbody>
            </table>
          </div>

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

    // ── Aba 1: Folha resumo (igual ao original) ────────────────────
    const header = ["Funcionário", "Cargo", "Obra Atual", "Pres.", "Meio Dia", "Faltas", "Sem Registro", "Feriados Pagos", "Feriados Perdidos", "Valor Feriado", "HE", "Diária", "Bruto", "VT", "VR", "Adiant.", "Líquido"];
    const body = rows.map(r => [r.name, r.role || "", obraName(r.obra), r.presentes, r.meiodia, r.faltas, r.semRegistro, r.feriadosPagos, r.feriadosPerdidos, r.holidayPay, r.ot, r.dailyRate, r.gross, r.vt, r.vr, r.advances, r.net]);
    const total = ["TOTAL", "", "", rows.reduce((s, r) => s + r.presentes, 0), rows.reduce((s, r) => s + r.meiodia, 0), rows.reduce((s, r) => s + r.faltas, 0), rows.reduce((s, r) => s + r.semRegistro, 0), T.feriadosPagos, T.feriadosPerdidos, T.holidayPay, rows.reduce((s, r) => s + r.ot, 0), "", T.gross, T.vt, T.vr, T.advances, T.net];
    const ws1 = XLSX.utils.aoa_to_sheet([
      ["Folha de Pagamento", periodLabel],
      ["Data de pagamento", paymentDateLabel],
      ["Regra aplicada", paymentObs],
      [],
      header,
      ...body,
      total,
    ]);
    ws1["!cols"] = [20, 15, 15, 8, 10, 8, 12, 15, 17, 14, 6, 10, 12, 10, 10, 10, 12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, "Folha");

    // ── Aba 2: Detalhe de dias por obra ────────────────────────────
    const header2 = ["Funcionário", "Cargo", "Obra", "Presentes", "Meio Dia", "Faltas", "Total Dias c/ Registro"];
    const body2 = [];
    rows.forEach(r => {
      if (r.obrasPorDia.length === 0) {
        body2.push([r.name, r.role || "", obraName(r.obra), 0, 0, 0, 0]);
      } else if (r.obrasPorDia.length === 1) {
        const o = r.obrasPorDia[0];
        body2.push([r.name, r.role || "", o.obraName, o.presentes, o.meiodia, o.faltas, o.totalDias]);
      } else {
        // Várias obras — primeira linha com nome do funcionário
        r.obrasPorDia.forEach((o, i) => {
          body2.push([i === 0 ? r.name : "", i === 0 ? (r.role || "") : "", o.obraName, o.presentes, o.meiodia, o.faltas, o.totalDias]);
        });
        // Subtotal do funcionário
        body2.push(["", "", `↳ TOTAL ${r.name}`, r.presentes, r.meiodia, r.faltas, r.presentes + r.meiodia + r.faltas]);
        body2.push([]); // linha em branco entre funcionários
      }
    });

    const ws2 = XLSX.utils.aoa_to_sheet([
      ["Detalhe de Dias por Obra", periodLabel],
      ["Período", `${fmtDateFull(days[0])} a ${fmtDateFull(days[days.length - 1])}`],
      [],
      header2,
      ...body2,
    ]);
    ws2["!cols"] = [22, 15, 20, 10, 10, 8, 18].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, "Dias por Obra");

    XLSX.writeFile(wb, `arcd-folha-${year}-${String(month + 1).padStart(2, "0")}-Q${q}.xlsx`);
    showToast("Excel gerado com 2 abas.");
  };

  const buildText = () => [
    "FOLHA DE PAGAMENTO — ARCD OBRAS",
    data.config.companyName || "",
    periodLabel,
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
        <p style={{ color: C.muted, fontSize: 13 }}>Cálculo automático quinzenal com feriados e datas de pagamento.</p>
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
// HELPER — custo de terceiros por obra/período
// ═══════════════════════════════════════════════════════════════════

const calcObraTercCost = (data, obraId, periodStart, periodEnd) => {
  return (data.pagsTerceiros || [])
    .filter(p => p.obraId === obraId && p.date >= periodStart && p.date <= periodEnd)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
};

// ═══════════════════════════════════════════════════════════════════
// ALERTAS WHATSAPP — gerador de mensagens
// ═══════════════════════════════════════════════════════════════════

const buildAlertMessage = (data) => {
  const todayIso = today();
  const fri = getFridayOfWeek(0);
  const { start: ws } = getWeekRange(fri);
  const nowD = new Date();
  const day  = nowD.getDate();
  const lines = [
    `🏗️ *${data.config.companyName || "ArcD Obras"} — Alertas*`,
    `📅 ${fmtDateFull(todayIso)}`,
    "",
  ];

  // Terceirizados pendentes esta sexta
  const activeTerc = (data.terceirizados||[]).filter(t => t.active !== false);
  const pendingTerc = activeTerc.filter(t =>
    !(data.pagsTerceiros||[]).some(p => p.tercId===t.id && p.date>=ws && p.date<=fri)
  );
  if (pendingTerc.length > 0) {
    const total = pendingTerc.reduce((s,t) => s+Number(t.weeklyRate||0), 0);
    lines.push(`💰 *PAGAMENTOS DESTA SEXTA (${fmtDateFull(fri)})*`);
    pendingTerc.forEach(t => {
      const on = data.obras.find(o=>o.id===t.obraId)?.name || "—";
      lines.push(`• ${t.name} (${on}) — ${fmt(t.weeklyRate)}`);
    });
    lines.push(`*Total: ${fmt(total)}*`);
    lines.push("");
  }

  // Ponto pendente hoje
  const summary = getObraAttendanceSummary(data, todayIso);
  const pendingPonto = summary.filter(o => o.hasTeam && !o.completed);
  if (pendingPonto.length > 0) {
    lines.push(`📋 *PONTO PENDENTE HOJE*`);
    pendingPonto.forEach(o => {
      const names = o.missingEmployees.slice(0,3).map(e=>e.name).join(", ");
      const extra = o.missingEmployees.length > 3 ? ` +${o.missingEmployees.length-3}` : "";
      lines.push(`• ${o.obraName}: ${o.missingCount} sem registro (${names}${extra})`);
    });
    lines.push("");
  }

  // Alertas de contrato >80%
  const now2 = new Date();
  const mdays = getDays(now2.getFullYear(), now2.getMonth());
  const contractAlerts = data.obras
    .filter(o => o.status !== "done" && o.contractValue > 0)
    .map(o => {
      const { laborCost } = calcObraLaborCost(data, o.id, mdays);
      const pct = (laborCost / o.contractValue) * 100;
      return { name: o.name, pct, saldo: o.contractValue - laborCost };
    })
    .filter(o => o.pct > 80)
    .sort((a,b) => b.pct - a.pct);
  if (contractAlerts.length > 0) {
    lines.push(`⚠️ *CONTRATOS COM ATENÇÃO*`);
    contractAlerts.forEach(o =>
      lines.push(`• ${o.name}: ${o.pct.toFixed(0)}% comprometido — saldo ${fmt(o.saldo)}`)
    );
    lines.push("");
  }

  // Folha em breve
  if (day >= 14 && day <= 16) {
    lines.push(`💼 *FOLHA EM BREVE — 1ª quinzena*`);
    lines.push(`• Pagamento previsto dia 20. Confirme todos os pontos.`);
    lines.push("");
  }
  if (day >= 29 || day <= 3) {
    lines.push(`💼 *FOLHA EM BREVE — 2ª quinzena*`);
    lines.push(`• Pagamento previsto dia 05. Confirme todos os pontos.`);
    lines.push("");
  }

  if (lines.length <= 4) lines.push("✅ Nenhum alerta pendente no momento.");
  lines.push(`_Enviado via ArcD Obras_`);
  return lines.join("\n");
};

const buildQuickAlerts = (data) => {
  const todayIso = today();
  const fri = getFridayOfWeek(0);
  const { start: ws } = getWeekRange(fri);
  const alerts = [];

  // Terceirizados pendentes
  const activeTerc = (data.terceirizados||[]).filter(t => t.active !== false);
  const pendingTerc = activeTerc.filter(t =>
    !(data.pagsTerceiros||[]).some(p => p.tercId===t.id && p.date>=ws && p.date<=fri)
  );
  if (pendingTerc.length > 0) {
    alerts.push({
      type: "payment", color: "#ff9f1c", icon: "💰",
      title: `${pendingTerc.length} terceirizado(s) a pagar esta sexta`,
      sub: `${fmtDateFull(fri)} · Total ${fmt(pendingTerc.reduce((s,t)=>s+Number(t.weeklyRate||0),0))}`,
    });
  }

  // Ponto pendente
  const summary = getObraAttendanceSummary(data, todayIso);
  const pendingPonto = summary.filter(o => o.hasTeam && !o.completed);
  if (pendingPonto.length > 0) {
    alerts.push({
      type: "ponto", color: "#ff5a47", icon: "📋",
      title: `Ponto pendente em ${pendingPonto.length} obra(s)`,
      sub: pendingPonto.map(o=>`${o.obraName}: ${o.missingCount}`).join(" · "),
    });
  }

  // Contratos em alerta
  const now2 = new Date();
  const mdays = getDays(now2.getFullYear(), now2.getMonth());
  const contractAlerts = data.obras
    .filter(o => o.status !== "done" && o.contractValue > 0)
    .map(o => {
      const { laborCost } = calcObraLaborCost(data, o.id, mdays);
      return { name: o.name, pct: (laborCost/o.contractValue)*100 };
    })
    .filter(o => o.pct > 80);
  if (contractAlerts.length > 0) {
    alerts.push({
      type: "contract", color: "#f6d833", icon: "⚠️",
      title: `${contractAlerts.length} contrato(s) acima de 80%`,
      sub: contractAlerts.map(o=>`${o.name}: ${o.pct.toFixed(0)}%`).join(" · "),
    });
  }
  return alerts;
};

// ═══════════════════════════════════════════════════════════════════
// FLUXO DE CAIXA
// ═══════════════════════════════════════════════════════════════════

function FluxoCaixa({ data }) {
  const now = new Date();
  const [months, setMonths] = useState(6);

  // Calcula histórico real + projeção futura
  const cashflow = useMemo(() => {
    const result = [];
    for (let i = -(months-1); i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const ym = `${y}-${String(m+1).padStart(2,"0")}`;
      const mdays = getDays(y, m);
      const isFuture = d > new Date(now.getFullYear(), now.getMonth(), 1);

      if (!isFuture) {
        // Real
        const received = (data.payments||[]).filter(p=>p.date?.startsWith(ym)).reduce((s,p)=>s+Number(p.amount||0),0);
        const laborCost = data.obras.reduce((s,o)=>s+calcObraLaborCost(data,o.id,mdays).laborCost,0);
        const tercCost = (data.pagsTerceiros||[]).filter(p=>p.date?.startsWith(ym)).reduce((s,p)=>s+Number(p.amount||0),0);
        const totalOut = laborCost + tercCost;
        result.push({ mes: monthName(m)+"/"+String(y).slice(2), received, laborCost, tercCost, totalOut, balance: received-totalOut, isProjection: false, isCurrent: i===0 });
      } else {
        // Projeção
        const workDays = mdays.filter(d=>{const wd=new Date(d+"T12:00:00").getDay();return wd>=1&&wd<=6;}).length;
        const activeEmps = data.employees.filter(e=>e.active!==false);
        const laborEst = activeEmps.reduce((s,e)=>s+Number(e.dailyRate||0)*workDays*0.82,0);
        const tercEst = (data.terceirizados||[]).filter(t=>t.active!==false).reduce((s,t)=>s+Number(t.weeklyRate||0)*4.3,0);
        const revenueEst = data.obras.filter(o=>o.status!=="done").reduce((s,o)=>{const{laborCost}=calcObraLaborCost(data,o.id,mdays);return s+calcObraRevenue(o,laborCost).revenue;},0);
        result.push({ mes: monthName(m)+"/"+String(y).slice(2), received: revenueEst, laborCost: laborEst, tercCost: tercEst, totalOut: laborEst+tercEst, balance: revenueEst-(laborEst+tercEst), isProjection: true, isCurrent: false });
      }
    }
    return result;
  }, [data, months]);

  const maxVal = Math.max(...cashflow.map(c=>Math.max(c.received,c.totalOut,1)));
  const totalReceived = cashflow.filter(c=>!c.isProjection).reduce((s,c)=>s+c.received,0);
  const totalOut = cashflow.filter(c=>!c.isProjection).reduce((s,c)=>s+c.totalOut,0);
  const projReceived = cashflow.filter(c=>c.isProjection).reduce((s,c)=>s+c.received,0);
  const projOut = cashflow.filter(c=>c.isProjection).reduce((s,c)=>s+c.totalOut,0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <p style={{fontSize:11,fontWeight:900,color:C.blue,textTransform:"uppercase",letterSpacing:1}}>Histórico + Projeção</p>
          <h3 style={{fontFamily:"'Bebas Neue'",fontSize:26,letterSpacing:1.5,color:C.text}}>Fluxo de Caixa</h3>
        </div>
        <Sel value={String(months)} onChange={v=>setMonths(Number(v))} options={[{v:"3",l:"3 meses"},{v:"6",l:"6 meses"},{v:"12",l:"12 meses"}]}/>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
        {[
          ["Recebido (real)", fmt(totalReceived),    C.green],
          ["Saída (real)",    fmt(totalOut),          C.red],
          ["Receita proj.",   fmt(projReceived),      C.blue],
          ["Saída proj.",     fmt(projOut),           C.orange],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:C.card,border:`1px solid ${C.line}`,borderTop:`3px solid ${c}`,padding:"10px 12px",borderRadius:14}}>
            <p style={{fontSize:9,fontWeight:900,color:C.muted,textTransform:"uppercase"}}>{l}</p>
            <p style={{fontFamily:"'Bebas Neue'",color:c,fontSize:22,lineHeight:1.1,marginTop:3}}>{v}</p>
          </div>
        ))}
      </div>

      {/* Gráfico visual (barras CSS customizadas) */}
      <div style={{background:C.card,border:`1px solid ${C.line}`,padding:14,borderRadius:18}}>
        <p style={{fontSize:11,fontWeight:900,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Receita × Saída por mês</p>
        <div style={{display:"flex",gap:6,alignItems:"flex-end",height:140}}>
          {cashflow.map((c,i)=>{
            const hRec = Math.round((c.received/maxVal)*120);
            const hOut = Math.round((c.totalOut/maxVal)*120);
            const isPos = c.balance >= 0;
            return (
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <div style={{display:"flex",gap:2,alignItems:"flex-end",height:120}}>
                  <div style={{width:12,height:hRec||2,background:c.isProjection?C.blue+"88":C.green,borderRadius:"3px 3px 0 0",transition:"height .3s"}}/>
                  <div style={{width:12,height:hOut||2,background:c.isProjection?C.orange+"88":C.red,borderRadius:"3px 3px 0 0",transition:"height .3s"}}/>
                </div>
                <p style={{fontSize:8,color:c.isCurrent?C.yellow:c.isProjection?C.blue:C.muted,fontWeight:c.isCurrent?900:700,textAlign:"center",whiteSpace:"nowrap"}}>{c.mes}</p>
                <div style={{width:12,height:3,background:isPos?C.green:C.red,borderRadius:99}}/>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap"}}>
          {[["▮ Recebido/Proj",C.green],["▮ Saída/Proj",C.red],["▮ Projeção",C.blue+"88"]].map(([l,c])=>(
            <p key={l} style={{fontSize:10,color:c,fontWeight:700}}>{l}</p>
          ))}
          <p style={{fontSize:10,color:C.muted}}>▬ Saldo (verde=positivo)</p>
        </div>
      </div>

      {/* Tabela mês a mês */}
      <div style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:16,overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.line}`,display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr 1fr 1fr",gap:4}}>
          {["Mês","Recebido","MO","Terceiros","Saldo"].map(h=>(
            <p key={h} style={{fontSize:9,fontWeight:900,color:C.muted,textTransform:"uppercase"}}>{h}</p>
          ))}
        </div>
        {cashflow.map((c,i)=>(
          <div key={i} style={{
            padding:"9px 14px",
            borderBottom:i<cashflow.length-1?`1px solid ${C.line}`:"none",
            display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr 1fr 1fr",gap:4,
            background:c.isCurrent?`${C.yellow}0a`:c.isProjection?`${C.blue}07`:"transparent",
          }}>
            <p style={{fontSize:12,fontWeight:c.isCurrent?900:600,color:c.isCurrent?C.yellow:c.isProjection?C.blue:C.text}}>
              {c.mes}{c.isProjection?" *":""}{c.isCurrent?" ◀":""}
            </p>
            <p style={{fontSize:12,color:C.green,fontWeight:700}}>{fmt(c.received)}</p>
            <p style={{fontSize:12,color:C.orange}}>{fmt(c.laborCost)}</p>
            <p style={{fontSize:12,color:C.purple}}>{fmt(c.tercCost)}</p>
            <p style={{fontSize:12,color:c.balance>=0?C.green:C.red,fontWeight:900}}>{fmt(c.balance)}</p>
          </div>
        ))}
        <div style={{padding:"8px 14px",background:C.surface,borderTop:`2px solid ${C.line}`}}>
          <p style={{fontSize:9,color:C.muted}}>* Projeção: MO estimada com 82% de presença · Terceiros com 4,3 semanas/mês</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TERCEIROS — cadastro e pagamentos semanais
// ═══════════════════════════════════════════════════════════════════

function Terceiros({ data, update, showToast }) {
  const emptyT = { id:"", name:"", specialty:"eletricista", obraId:"", contractValue:"", weeklyRate:"", phone:"", pixKey:"", notes:"", startDate:today() };
  const [view,        setView]        = useState("cadastro");
  const [weekOffset,  setWeekOffset]  = useState(0);
  const [modal,       setModal]       = useState(false);
  const [form,        setForm]        = useState(emptyT);
  const [payModal,    setPayModal]    = useState(null);
  const [payAmount,   setPayAmount]   = useState("");
  const [payDesc,     setPayDesc]     = useState("");
  const [filterObra,  setFilterObra]  = useState("all");
  const [filterSpec,  setFilterSpec]  = useState("all");
  const [expanded,    setExpanded]    = useState(null);

  const F = k => v => setForm(f => ({ ...f, [k]: v }));
  const obraName = id => data.obras.find(o => o.id === id)?.name || "—";

  const friday     = getFridayOfWeek(weekOffset);
  const { start: weekStart, end: weekEnd } = getWeekRange(friday);
  const allTerc    = data.terceirizados || [];
  const activeTerc = allTerc.filter(t => t.active !== false);

  const wasPaidThisWeek = id =>
    (data.pagsTerceiros || []).some(p => p.tercId === id && p.date >= weekStart && p.date <= weekEnd);
  const thisWeekPay = id =>
    (data.pagsTerceiros || []).find(p => p.tercId === id && p.date >= weekStart && p.date <= weekEnd);

  // KPIs
  const totalWeekly     = activeTerc.reduce((s, t) => s + Number(t.weeklyRate || 0), 0);
  const totalContracts  = allTerc.reduce((s, t) => s + Number(t.contractValue || 0), 0);
  const totalPaidAll    = (data.pagsTerceiros || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingCount    = activeTerc.filter(t => !wasPaidThisWeek(t.id)).length;
  const pendingTotal    = activeTerc.filter(t => !wasPaidThisWeek(t.id)).reduce((s,t) => s+Number(t.weeklyRate||0), 0);

  const filteredTerc = allTerc
    .filter(t => filterObra === "all" || t.obraId === filterObra)
    .filter(t => filterSpec === "all" || t.specialty === filterSpec)
    .sort((a, b) => a.name.localeCompare(b.name));

  const saveTerc = () => {
    if (!form.name.trim()) { showToast("Nome obrigatório.", "error"); return; }
    const payload = { ...form, id: form.id || uid(), weeklyRate: Number(form.weeklyRate || 0), contractValue: Number(form.contractValue || 0) };
    const terceirizados = form.id ? allTerc.map(t => t.id === form.id ? payload : t) : [...allTerc, payload];
    update({ ...data, terceirizados });
    setModal(false);
    showToast(form.id ? "Terceirizado atualizado." : "Terceirizado cadastrado.");
  };

  const removeTerc = id => {
    if (!window.confirm("Remover terceirizado? O histórico de pagamentos será mantido.")) return;
    update({ ...data, terceirizados: allTerc.filter(t => t.id !== id) });
    showToast("Terceirizado removido.");
  };

  const toggleActive = id => {
    const terceirizados = allTerc.map(t => t.id === id ? { ...t, active: !t.active } : t);
    update({ ...data, terceirizados });
    showToast("Status atualizado.");
  };

  const savePay = terc => {
    const amount = Number(payAmount || terc.weeklyRate || 0);
    if (!amount) { showToast("Informe o valor.", "error"); return; }
    const pagsTerceiros = [...(data.pagsTerceiros || []), {
      id: uid(), tercId: terc.id, tercName: terc.name, specialty: terc.specialty,
      obraId: terc.obraId, date: friday, amount, description: payDesc || `Pagamento semanal ${fmtDateFull(friday)}`,
    }];
    update({ ...data, pagsTerceiros });
    setPayModal(null); setPayAmount(""); setPayDesc("");
    showToast(`${terc.name} — pagamento registrado.`);
  };

  const removePay = id => {
    if (!window.confirm("Remover pagamento?")) return;
    update({ ...data, pagsTerceiros: (data.pagsTerceiros || []).filter(p => p.id !== id) });
    showToast("Pagamento removido.");
  };

  const paidThisWeekAmount = activeTerc.reduce((s, t) => {
    const p = thisWeekPay(t.id);
    return s + (p ? Number(p.amount) : 0);
  }, 0);

  // ── JSX ────────────────────────────────────────────────────────
  return (
    <div className="anim" style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Header */}
      <div style={{
        background:`linear-gradient(135deg,${C.orange}22 0%,${C.card} 60%)`,
        border:`1px solid ${C.orange}44`, borderLeft:`5px solid ${C.orange}`,
        padding:"16px 18px", borderRadius:18,
      }}>
        <p style={{ fontSize:11, fontWeight:900, color:C.orange, textTransform:"uppercase", letterSpacing:1.2, marginBottom:4 }}>Subcontratados</p>
        <h2 style={{ fontFamily:"'Bebas Neue'", fontSize:34, letterSpacing:2, color:C.text, lineHeight:1 }}>Terceirizados</h2>
        <p style={{ color:C.muted, fontSize:13, marginTop:4 }}>Contratos, especialidades e pagamentos toda sexta-feira.</p>
      </div>

      {/* KPI bar */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
        {[
          ["Ativos",       activeTerc.length,     C.orange, "terc"],
          ["Custo/semana", fmt(totalWeekly),       C.yellow, "dollar"],
          ["Total contratos", fmt(totalContracts), C.green,  "dollar"],
          ["Total pago",   fmt(totalPaidAll),      C.blue,   "check"],
        ].map(([l,v,c,ic]) => (
          <div key={l} style={{ background:C.card, border:`1px solid ${C.line}`, borderTop:`3px solid ${c}`, padding:"12px 14px", borderRadius:16 }}>
            <p style={{ fontSize:10, fontWeight:900, color:C.muted, textTransform:"uppercase", letterSpacing:.8 }}>{l}</p>
            <p style={{ fontFamily:"'Bebas Neue'", color:c, fontSize:26, lineHeight:1.1, marginTop:4 }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Sub-nav */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
        {[["cadastro","👷 Cadastro"],["pagamentos","💰 Pagamentos"]].map(([v,l]) => (
          <button key={v} onClick={() => setView(v)} style={{
            padding:"11px 0", border:`2px solid ${view===v ? C.orange : C.line}`,
            background: view===v ? `${C.orange}18` : "transparent",
            color: view===v ? C.orange : C.muted,
            fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:14, letterSpacing:.5,
            cursor:"pointer", borderRadius:12,
          }}>{l}</button>
        ))}
      </div>

      {/* ── VIEW: CADASTRO ─────────────────────────────────────── */}
      {view === "cadastro" && (<>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <p style={{ fontSize:10, fontWeight:900, color:C.muted, textTransform:"uppercase", letterSpacing:1 }}>
            {filteredTerc.length} terceirizado(s)
          </p>
          <Btn onClick={() => { setForm(emptyT); setModal(true); }} size="sm"><Ic n="plus"/> Novo</Btn>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <Sel value={filterSpec} onChange={setFilterSpec} options={[{v:"all",l:"Todas especialidades"},...SPECIALTIES.map(s=>({v:s.v,l:s.emoji+" "+s.l}))]}/>
          <Sel value={filterObra} onChange={setFilterObra} options={[{v:"all",l:"Todas as obras"},...data.obras.map(o=>({v:o.id,l:o.name}))]}/>
        </div>

        {filteredTerc.length === 0 && (
          <div style={{ background:C.card, border:`1px solid ${C.line}`, padding:24, textAlign:"center", color:C.muted, borderRadius:14 }}>
            Nenhum terceirizado cadastrado.
          </div>
        )}

        {/* Agrupado por obra */}
        {data.obras
          .filter(o => filteredTerc.some(t => t.obraId===o.id))
          .map(obra => {
            const obraTerc = filteredTerc.filter(t => t.obraId===obra.id);
            const obraPago = obraTerc.reduce((s,t) => s+(data.pagsTerceiros||[]).filter(p=>p.tercId===t.id).reduce((s2,p)=>s2+Number(p.amount||0),0), 0);
            const obraWeekly = obraTerc.filter(t=>t.active!==false).reduce((s,t)=>s+Number(t.weeklyRate||0),0);
            return (
              <div key={obra.id}>
                {/* Cabeçalho da obra */}
                <div style={{
                  background:`linear-gradient(90deg,${C.orange}18,transparent)`,
                  borderLeft:`4px solid ${C.orange}`,borderBottom:`1px solid ${C.line}`,
                  padding:"8px 14px",borderRadius:"12px 12px 0 0",marginBottom:-1,
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                }}>
                  <div>
                    <p style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:16,color:C.orange}}>{obra.name}</p>
                    <p style={{fontSize:11,color:C.muted,marginTop:1}}>{obraTerc.length} terceirizado(s) · {fmt(obraWeekly)}/semana · {fmt(obraPago)} pago total</p>
                  </div>
                  <Badge color={C.orange}>{obraTerc.filter(t=>t.active!==false).length} ativos</Badge>
                </div>

                {obraTerc.map(t => {
                  const sp = specInfo(t.specialty);
                  const pago = (data.pagsTerceiros||[]).filter(p=>p.tercId===t.id).reduce((s,p)=>s+Number(p.amount||0),0);
                  const saldo = Number(t.contractValue||0) - pago;
                  const pct = t.contractValue>0 ? Math.min((pago/t.contractValue)*100, 100) : 0;
                  const exp = expanded === t.id;
                  return (
                    <div key={t.id} style={{ background:C.card, border:`1px solid ${C.line}`, borderRadius: exp?"0":"0", overflow:"hidden", opacity:t.active===false?0.6:1, marginBottom:1 }}>
                      <button onClick={() => setExpanded(exp ? null : t.id)} style={{
                        width:"100%", background:"transparent", border:0, color:C.text,
                        padding:"12px 16px", textAlign:"left", cursor:"pointer",
                        borderLeft:`5px solid ${sp.color}`,
                      }}>
                        <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                              <span style={{ fontSize:16 }}>{sp.emoji}</span>
                              <p style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:17 }}>{t.name}</p>
                              {t.active === false && <Badge color={C.muted}>Inativo</Badge>}
                            </div>
                            <p style={{ color:C.muted, fontSize:11 }}>{sp.l}</p>
                            <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:3 }}>
                              {t.weeklyRate>0 && <Badge color={C.orange}>{fmt(t.weeklyRate)}/sem</Badge>}
                              {t.contractValue>0 && <Badge color={C.subtle}>Contrato: {fmt(t.contractValue)}</Badge>}
                            </div>
                          </div>
                          <div style={{ textAlign:"right", flexShrink:0 }}>
                            <p style={{ fontFamily:"'Bebas Neue'", fontSize:18, color:saldo>=0?C.green:C.red, lineHeight:1 }}>{fmt(saldo)}</p>
                            <p style={{ fontSize:10, color:C.muted }}>saldo</p>
                          </div>
                        </div>
                        {t.contractValue>0 && (
                          <div style={{ marginTop:6 }}>
                            <div style={{ height:4, background:C.surface, borderRadius:99, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${pct}%`, background:pct>90?C.red:C.green, borderRadius:99 }}/>
                            </div>
                          </div>
                        )}
                      </button>

                      {exp && (
                        <div style={{ borderTop:`1px solid ${C.line}`, padding:"12px 16px", background:C.surface, display:"flex", flexDirection:"column", gap:10 }}>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                            {[["Pago total",fmt(pago),C.blue],["Saldo",fmt(saldo),saldo>=0?C.green:C.red],["Semanal",fmt(t.weeklyRate),C.orange]].map(([l,v,c])=>(
                              <div key={l} style={{ background:C.card, border:`1px solid ${C.line}`, padding:"8px 10px", borderRadius:10 }}>
                                <p style={{ fontSize:9, color:C.muted, textTransform:"uppercase", fontWeight:700 }}>{l}</p>
                                <p style={{ fontSize:14, fontWeight:900, color:c }}>{v}</p>
                              </div>
                            ))}
                          </div>
                          {t.phone && <p style={{ fontSize:12, color:C.subtle }}>📞 {t.phone}</p>}
                          {t.pixKey && <p style={{ fontSize:12, color:C.subtle }}>PIX: {t.pixKey}</p>}
                          {t.notes && <p style={{ fontSize:12, color:C.muted, fontStyle:"italic" }}>"{t.notes}"</p>}
                          <p style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase" }}>Últimos pagamentos</p>
                          {(data.pagsTerceiros||[]).filter(p=>p.tercId===t.id).slice(-5).reverse().map(p=>(
                            <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:`1px solid ${C.line}`, paddingBottom:6 }}>
                              <div>
                                <p style={{ fontSize:13, fontWeight:700 }}>{p.description}</p>
                                <p style={{ fontSize:11, color:C.muted }}>{fmtDateFull(p.date)}</p>
                              </div>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <p style={{ color:C.green, fontWeight:900 }}>{fmt(p.amount)}</p>
                                <Btn v="danger" size="sm" onClick={()=>removePay(p.id)}><Ic n="trash"/></Btn>
                              </div>
                            </div>
                          ))}
                          {!(data.pagsTerceiros||[]).some(p=>p.tercId===t.id) && (
                            <p style={{ fontSize:12, color:C.muted }}>Nenhum pagamento registrado.</p>
                          )}
                          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                            <Btn size="sm" v="warning" onClick={()=>{setPayModal(t);setPayAmount(String(t.weeklyRate||""));}}>
                              <Ic n="dollar"/> Registrar pagamento
                            </Btn>
                            <Btn size="sm" v="ghost" onClick={()=>{setForm({...t,weeklyRate:String(t.weeklyRate||""),contractValue:String(t.contractValue||"")});setModal(true);}}>
                              <Ic n="edit"/> Editar
                            </Btn>
                            <Btn size="sm" v={t.active===false?"success":"dark"} onClick={()=>toggleActive(t.id)}>
                              {t.active===false?"Reativar":"Inativar"}
                            </Btn>
                            <Btn size="sm" v="danger" onClick={()=>removeTerc(t.id)}><Ic n="trash"/></Btn>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{height:8}}/>
              </div>
            );
          })
        }

        {/* Sem obra definida */}
        {filteredTerc.filter(t=>!t.obraId).length > 0 && (
          <div>
            <div style={{borderLeft:`4px solid ${C.muted}`,padding:"8px 14px",marginBottom:4}}>
              <p style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,color:C.muted}}>Sem obra definida</p>
            </div>
            {filteredTerc.filter(t=>!t.obraId).map(t=>{
              const sp=specInfo(t.specialty);
              return(
                <div key={t.id} style={{background:C.card,border:`1px solid ${C.line}`,borderLeft:`4px solid ${sp.color}`,padding:"12px 14px",borderRadius:12,marginBottom:4}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <p style={{fontWeight:700}}>{sp.emoji} {t.name}</p>
                    <Btn size="sm" v="ghost" onClick={()=>{setForm({...t,weeklyRate:String(t.weeklyRate||""),contractValue:String(t.contractValue||"")});setModal(true);}}>
                      <Ic n="edit"/>
                    </Btn>
                  </div>
                  <p style={{fontSize:11,color:C.muted,marginTop:3}}>Nenhuma obra vinculada — edite para vincular</p>
                </div>
              );
            })}
          </div>
        )}
      </>)}

      {/* ── VIEW: PAGAMENTOS ───────────────────────────────────── */}
      {view === "pagamentos" && (<>
        {/* Navegador de semana */}
        <div style={{ background:C.card, border:`1px solid ${C.line}`, borderTop:`3px solid ${C.orange}`, padding:"14px 16px", borderRadius:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <button onClick={()=>setWeekOffset(w=>w-1)} style={{ background:"transparent", border:`1px solid ${C.line}`, color:C.text, padding:"6px 14px", cursor:"pointer", borderRadius:10, fontWeight:900, fontSize:18 }}>‹</button>
            <div style={{ textAlign:"center" }}>
              <p style={{ fontFamily:"'Bebas Neue'", fontSize:24, color:C.orange, letterSpacing:1, lineHeight:1 }}>
                💰 Sexta-feira
              </p>
              <p style={{ fontFamily:"'Bebas Neue'", fontSize:32, color:C.text, letterSpacing:1, lineHeight:1 }}>
                {fmtDateFull(friday)}
              </p>
              <p style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                Semana: {fmtDateFull(weekStart)} → {fmtDateFull(weekEnd)}
              </p>
            </div>
            <button onClick={()=>setWeekOffset(w=>w+1)} style={{ background:"transparent", border:`1px solid ${C.line}`, color:C.text, padding:"6px 14px", cursor:"pointer", borderRadius:10, fontWeight:900, fontSize:18 }}>›</button>
          </div>

          {/* Status da semana */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:4 }}>
            {[
              ["Pagos",      `${activeTerc.length - pendingCount}/${activeTerc.length}`, C.green ],
              ["Pendentes",  fmt(pendingTotal),  pendingCount>0 ? C.red : C.green ],
              ["Pago semana",fmt(paidThisWeekAmount), C.blue ],
            ].map(([l,v,c])=>(
              <div key={l} style={{ background:C.surface, padding:"8px 10px", borderRadius:10, textAlign:"center" }}>
                <p style={{ fontSize:9, color:C.muted, textTransform:"uppercase", fontWeight:900 }}>{l}</p>
                <p style={{ fontFamily:"'Bebas Neue'", fontSize:20, color:c, letterSpacing:.5 }}>{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Lista de terceirizados com status de pagamento */}
        {activeTerc.length === 0 && (
          <div style={{ background:C.card, border:`1px solid ${C.line}`, padding:24, textAlign:"center", color:C.muted, borderRadius:14 }}>
            Nenhum terceirizado ativo. Cadastre na aba Cadastro.
          </div>
        )}

        {activeTerc
          .filter(t => filterObra==="all" || t.obraId===filterObra)
          .sort((a,b) => {
            // Pendentes primeiro
            const pa = wasPaidThisWeek(a.id), pb = wasPaidThisWeek(b.id);
            if(pa !== pb) return pa ? 1 : -1;
            return a.name.localeCompare(b.name);
          })
          .map(t => {
            const sp = specInfo(t.specialty);
            const paid = wasPaidThisWeek(t.id);
            const paidEntry = thisWeekPay(t.id);
            return (
              <div key={t.id} style={{
                background: paid ? `${C.green}10` : C.card,
                border: `1px solid ${paid ? C.green+"44" : C.line}`,
                borderLeft: `5px solid ${paid ? C.green : C.orange}`,
                padding:"14px 16px", borderRadius:16,
                display:"flex", justifyContent:"space-between", alignItems:"center", gap:12,
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:16 }}>{sp.emoji}</span>
                    <p style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:17 }}>{t.name}</p>
                    {paid && <Badge color={C.green}>✓ Pago</Badge>}
                  </div>
                  <p style={{ fontSize:12, color:C.muted }}>{sp.l} · {obraName(t.obraId)}</p>
                  {paid && paidEntry && (
                    <p style={{ fontSize:12, color:C.green, marginTop:3 }}>
                      {fmt(paidEntry.amount)} · {fmtDateFull(paidEntry.date)}
                    </p>
                  )}
                  {!paid && t.weeklyRate>0 && (
                    <p style={{ fontSize:12, color:C.orange, marginTop:3, fontWeight:700 }}>
                      Previsto: {fmt(t.weeklyRate)}
                    </p>
                  )}
                </div>
                <div style={{ flexShrink:0 }}>
                  {!paid ? (
                    <Btn v="warning" onClick={()=>{setPayModal(t);setPayAmount(String(t.weeklyRate||""));}}>
                      <Ic n="dollar"/> Pagar
                    </Btn>
                  ) : (
                    <Btn v="ghost" size="sm" onClick={()=>paidEntry&&removePay(paidEntry.id)}>
                      <Ic n="x"/> Desfazer
                    </Btn>
                  )}
                </div>
              </div>
            );
          })
        }

        <Sel value={filterObra} onChange={setFilterObra} options={[{v:"all",l:"Todas as obras"},...data.obras.map(o=>({v:o.id,l:o.name}))]}/>
      </>)}

      {/* Modal: cadastro */}
      {modal && (
        <Modal title={form.id?"Editar terceirizado":"Novo terceirizado"} onClose={()=>setModal(false)} wide>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ gridColumn:"1/-1" }}><Inp label="Nome completo *" value={form.name} onChange={F("name")}/></div>
            <Sel label="Especialidade *" value={form.specialty} onChange={F("specialty")} options={SPECIALTIES.map(s=>({v:s.v,l:s.emoji+" "+s.l}))}/>
            <Sel label="Obra *" value={form.obraId} onChange={F("obraId")} options={[{v:"",l:"Selecione"},...data.obras.map(o=>({v:o.id,l:o.name}))]}/>
            <Inp label="Valor contrato (R$)" type="number" value={form.contractValue} onChange={F("contractValue")} placeholder="0,00"/>
            <Inp label="Valor semanal (R$)" type="number" value={form.weeklyRate} onChange={F("weeklyRate")} placeholder="Ex: 2000"/>
            <Inp label="Telefone" value={form.phone} onChange={F("phone")} placeholder="(81) 9XXXX-XXXX"/>
            <Inp label="Chave PIX" value={form.pixKey} onChange={F("pixKey")}/>
            <Inp label="Data de início" type="date" value={form.startDate} onChange={F("startDate")}/>
            <div style={{ gridColumn:"1/-1" }}><Inp label="Observações" value={form.notes} onChange={F("notes")} multiline placeholder="Informações sobre o serviço, escopo..."/></div>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:16 }}>
            <Btn v="ghost" onClick={()=>setModal(false)} full>Cancelar</Btn>
            <Btn onClick={saveTerc} full><Ic n="check"/> Salvar</Btn>
          </div>
        </Modal>
      )}

      {/* Modal: registrar pagamento */}
      {payModal && (
        <Modal title={`Pagamento — ${payModal.name}`} onClose={()=>{setPayModal(null);setPayAmount("");setPayDesc("");}}>
          <div style={{ background:C.card, border:`1px solid ${C.line}`, borderLeft:`4px solid ${C.orange}`, padding:"10px 14px", borderRadius:12, marginBottom:12 }}>
            <p style={{ fontSize:12, color:C.muted }}>{specInfo(payModal.specialty).emoji} {specInfo(payModal.specialty).l} · {obraName(payModal.obraId)}</p>
            <p style={{ fontSize:13, color:C.orange, fontWeight:700, marginTop:2 }}>Sexta-feira: {fmtDateFull(friday)}</p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <Inp label="Valor (R$) *" type="number" value={payAmount} onChange={setPayAmount} placeholder={`Sugerido: ${fmt(payModal.weeklyRate)}`}/>
            <Inp label="Descrição" value={payDesc} onChange={setPayDesc} placeholder={`Pagamento semanal ${fmtDateFull(friday)}`}/>
            <div style={{ display:"flex", gap:8 }}>
              <Btn v="ghost" onClick={()=>setPayModal(null)} full>Cancelar</Btn>
              <Btn v="warning" onClick={()=>savePay(payModal)} full><Ic n="check"/> Confirmar pagamento</Btn>
            </div>
          </div>
        </Modal>
      )}
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
    now.getDate() <= 15 ? "1" : "2",
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
    // Terceirizados
    activeTerc: (data.terceirizados||[]).filter(t=>t.active!==false).length,
    tercPendingThisWeek: (() => {
      const fri = getFridayOfWeek(0);
      const {start: ws} = getWeekRange(fri);
      return (data.terceirizados||[]).filter(t=>t.active!==false&&!(data.pagsTerceiros||[]).some(p=>p.tercId===t.id&&p.date>=ws&&p.date<=fri)).length;
    })(),
    tercWeeklyTotal: (data.terceirizados||[]).filter(t=>t.active!==false).reduce((s,t)=>s+Number(t.weeklyRate||0),0),
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
// RESCISÃO — cálculo e PDF
// ═══════════════════════════════════════════════════════════════════

const TIPOS_RESCISAO = [
  { v: "sem_justa_causa",   l: "Dispensa sem justa causa (empregador)" },
  { v: "justa_causa",       l: "Dispensa por justa causa" },
  { v: "pedido_demissao",   l: "Pedido de demissão (funcionário)" },
  { v: "acordo_mutuo",      l: "Acordo mútuo (art. 484-A CLT)" },
  { v: "termino_contrato",  l: "Término de contrato de prazo determinado" },
];

const TIPO_LABEL = Object.fromEntries(TIPOS_RESCISAO.map(t => [t.v, t.l]));

const calcRescisao = (form) => {
  const { admissao, demissao, valorMensal, diasNoMes, tipo,
    incluirSaldo, incluir13, incluirFerias, incluirAviso, descAdiantamento, descOutros } = form;
  if (!admissao || !demissao) return null;

  const dataAdm = new Date(admissao + "T12:00:00");
  const dataDem = new Date(demissao + "T12:00:00");
  if (dataDem < dataAdm) return null;

  // Tempo de serviço
  let anos = dataDem.getFullYear() - dataAdm.getFullYear();
  let meses = dataDem.getMonth() - dataAdm.getMonth();
  let dias  = dataDem.getDate()  - dataAdm.getDate();
  if (dias < 0)  { meses--; dias += 30; }
  if (meses < 0) { anos--;  meses += 12; }
  const totalMeses = anos * 12 + meses;
  const diasResto  = dias;
  // Avos = meses completos + 1 se fração ≥ 15 dias
  const avos13     = totalMeses + (diasResto >= 15 ? 1 : 0);
  const avosFerias = avos13; // mesma base

  const vm  = Number(valorMensal || 0);
  const dd  = Number(diasNoMes || 0);
  const descAdiant = Number(descAdiantamento || 0);
  const descOut    = Number(descOutros || 0);

  const saldoSalario   = incluirSaldo  ? (vm / 30) * dd : 0;
  const dec13          = incluir13     ? (vm / 12) * avos13 : 0;
  const feriasBruto    = incluirFerias ? (vm / 12) * avosFerias : 0;
  const feriasTotal    = feriasBruto * (4 / 3); // com 1/3 constitucional
  const aviso          = incluirAviso && tipo === "sem_justa_causa" ? vm : 0;
  const avisoAcordo    = incluirAviso && tipo === "acordo_mutuo"    ? vm * 0.5 : 0;
  const avisoPrevio    = aviso + avisoAcordo;
  const totalBruto     = saldoSalario + dec13 + feriasTotal + avisoPrevio;
  const totalDesc      = descAdiant + descOut;
  const totalLiquido   = Math.max(0, totalBruto - totalDesc);

  return {
    anos, totalMeses, diasResto, avos13, avosFerias,
    saldoSalario, dec13, feriasBruto, feriasTotal, avisoPrevio,
    totalBruto, totalDesc, totalLiquido,
  };
};

function Rescisao({ data, update, showToast }) {
  const emptyForm = {
    empId: "", empName: "", empCPF: "", empFuncao: "", obraName: "",
    admissao: "", demissao: today(), valorMensal: "", diasNoMes: "",
    tipo: "sem_justa_causa",
    incluirSaldo: true, incluir13: true, incluirFerias: true,
    incluirAviso: false,
    descAdiantamento: "", descOutros: "", obsDesc: "",
    obs: "",
  };

  const [form, setForm]       = useState(emptyForm);
  const [history, setHistory] = useState(false); // toggle
  const F = k => v => setForm(f => ({ ...f, [k]: v }));

  // Ao selecionar funcionário da lista
  const selectEmp = empId => {
    if (!empId) { setForm(f => ({ ...f, empId:"", empName:"", empCPF:"", empFuncao:"", obraName:"", admissao:"", valorMensal:"", diasNoMes:"" })); return; }
    const emp = data.employees.find(e => e.id === empId);
    if (!emp) return;
    const obra = data.obras.find(o => o.id === emp.obra);
    const vm   = Number(emp.dailyRate || 0) * 26; // 26 dias úteis/mês
    const pendAdv = (data.advances||[]).filter(a => a.empId === empId).reduce((s,a)=>s+Number(a.amount||0),0);
    setForm(f => ({
      ...f,
      empId, empName: emp.name, empCPF: emp.cpf||"",
      empFuncao: emp.role||"", obraName: obra?.name||"",
      admissao: emp.startDate||"",
      valorMensal: String(Math.round(vm)),
      descAdiantamento: pendAdv > 0 ? String(pendAdv) : "",
    }));
  };

  const calc = calcRescisao(form);

  // Salvar rescisão
  const salvar = () => {
    if (!form.empName.trim() || !calc) { showToast("Preencha os dados obrigatórios.", "error"); return; }
    const rec = {
      id: uid(), ...form,
      ...calc,
      createdAt: new Date().toISOString(),
    };
    update({ ...data, rescisoes: [...(data.rescisoes||[]), rec] });
    showToast("Rescisão salva no histórico.");
  };

  // Gerar PDF
  const gerarPDF = () => {
    if (!calc) { showToast("Complete o cálculo primeiro.", "error"); return; }
    const c = calc;
    const tempoStr = `${c.anos > 0 ? c.anos+"a " : ""}${c.totalMeses % 12}m ${c.diasResto}d`;
    const rows = [
      form.incluirSaldo  && ["Saldo de salário",   `${form.diasNoMes} dias em ${fmtDateFull(form.demissao)}`, c.saldoSalario],
      form.incluir13     && [`13º salário proporcional`, `${c.avos13}/12 avos`, c.dec13],
      form.incluirFerias && [`Férias proporcionais + 1/3`, `${c.avosFerias}/12 avos × 4/3`, c.feriasTotal],
      form.incluirAviso  && c.avisoPrevio > 0 && ["Aviso prévio", "30 dias", c.avisoPrevio],
    ].filter(Boolean);
    const descs = [
      Number(form.descAdiantamento||0) > 0 && ["Adiantamentos", Number(form.descAdiantamento)],
      Number(form.descOutros||0) > 0       && [form.obsDesc||"Outros descontos", Number(form.descOutros)],
    ].filter(Boolean);

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Rescisão — ${escapeHtml(form.empName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Arial',sans-serif;color:#111;background:#fff;padding:32px;font-size:12px}
  .header{display:flex;align-items:center;gap:16px;padding-bottom:16px;border-bottom:3px solid #111;margin-bottom:20px}
  .logo-box{background:#080808;color:#f6d833;padding:10px 16px;font-family:Georgia,serif;font-size:26px;font-weight:900;letter-spacing:2px;flex-shrink:0}
  .company-info h1{font-size:18px;font-weight:900;letter-spacing:1px}
  .company-info p{font-size:11px;color:#555;margin-top:3px}
  h2{font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin:18px 0 10px;border-bottom:1px solid #ccc;padding-bottom:5px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-bottom:16px}
  .info-item p.lbl{font-size:10px;color:#777;text-transform:uppercase;font-weight:700;letter-spacing:.5px}
  .info-item p.val{font-size:13px;font-weight:600;margin-top:1px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th{background:#111;color:#fff;padding:8px 10px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  td{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px}
  td.right{text-align:right;font-weight:700}
  tr.desc td{color:#c00}
  tr.subtotal td{background:#f5f5f5;font-weight:900;font-size:13px}
  tr.total td{background:#111;color:#fff;font-size:15px;font-weight:900;padding:12px 10px}
  .ext-valor{font-size:12px;color:#555;margin:10px 0 20px;font-style:italic}
  .declaracao{background:#f9f9f9;border:1px solid #ddd;padding:14px;margin:20px 0;font-size:11px;line-height:1.6}
  .signs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}
  .sign-box{border-top:1px solid #111;padding-top:8px;text-align:center}
  .sign-box p{font-size:11px;color:#333;margin-top:4px}
  .sign-box .name{font-weight:900;font-size:13px;margin-top:2px}
  .footer{margin-top:30px;text-align:center;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:10px}
  @media print{button{display:none!important}}
</style>
</head>
<body>
<button onclick="window.print()" style="position:fixed;top:10px;right:10px;background:#111;color:#f6d833;border:none;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;z-index:99">🖨 Imprimir / PDF</button>

<div class="header">
  <div class="logo-box">ArcD</div>
  <div class="company-info">
    <h1>${escapeHtml(data.config.companyName||"ArcD Construtora")}</h1>
    ${data.config.cnpj?`<p>CNPJ: ${escapeHtml(data.config.cnpj)}</p>`:""}
    <p>Recibo de Rescisão de Contrato de Trabalho</p>
  </div>
</div>

<h2>Dados do Trabalhador</h2>
<div class="info-grid">
  <div class="info-item"><p class="lbl">Nome</p><p class="val">${escapeHtml(form.empName)}</p></div>
  <div class="info-item"><p class="lbl">CPF</p><p class="val">${escapeHtml(form.empCPF||"—")}</p></div>
  <div class="info-item"><p class="lbl">Função</p><p class="val">${escapeHtml(form.empFuncao||"—")}</p></div>
  <div class="info-item"><p class="lbl">Obra</p><p class="val">${escapeHtml(form.obraName||"—")}</p></div>
  <div class="info-item"><p class="lbl">Data de Admissão</p><p class="val">${fmtDateFull(form.admissao)||"—"}</p></div>
  <div class="info-item"><p class="lbl">Data de Rescisão</p><p class="val">${fmtDateFull(form.demissao)||"—"}</p></div>
  <div class="info-item"><p class="lbl">Tempo de Serviço</p><p class="val">${tempoStr}</p></div>
  <div class="info-item"><p class="lbl">Motivo</p><p class="val">${escapeHtml(TIPO_LABEL[form.tipo]||form.tipo)}</p></div>
  <div class="info-item"><p class="lbl">Valor Mensal</p><p class="val">R$ ${Number(form.valorMensal||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</p></div>
</div>

<h2>Demonstrativo de Valores</h2>
<table>
  <thead><tr><th>Verba</th><th>Base de Cálculo</th><th style="text-align:right">Valor (R$)</th></tr></thead>
  <tbody>
    ${rows.map(([v,b,val])=>`<tr><td>${escapeHtml(v)}</td><td style="color:#555">${escapeHtml(b)}</td><td class="right">R$ ${Number(val).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>`).join("")}
    <tr class="subtotal"><td colspan="2">Subtotal de Vencimentos</td><td class="right">R$ ${c.totalBruto.toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>
    ${descs.map(([v,val])=>`<tr class="desc"><td>(-) ${escapeHtml(v)}</td><td></td><td class="right">R$ ${Number(val).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>`).join("")}
    <tr class="total"><td colspan="2">TOTAL LÍQUIDO A RECEBER</td><td class="right">R$ ${c.totalLiquido.toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>
  </tbody>
</table>

<p class="ext-valor">Valor por extenso: <strong>${valorPorExtenso(c.totalLiquido)}</strong></p>

${form.obs?`<div class="declaracao"><strong>Observações:</strong> ${escapeHtml(form.obs)}</div>`:""}

<div class="declaracao">
  Declaro ter recebido da empresa <strong>${escapeHtml(data.config.companyName||"ArcD Construtora")}</strong> a importância acima discriminada,
  referente à rescisão do meu contrato de trabalho, dando plena, geral e irrevogável quitação de todos
  os valores acima mencionados, nada mais tendo a reclamar a qualquer título.
  <br><br>
  <strong>Caruaru – PE, ${new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"})}</strong>
</div>

<div class="signs">
  <div class="sign-box">
    <p class="name">${escapeHtml(form.empName)}</p>
    <p>Trabalhador(a)</p>
    <p>CPF: ${escapeHtml(form.empCPF||"________________")}</p>
  </div>
  <div class="sign-box">
    <p class="name">${escapeHtml(data.config.hrName||"Responsável")}</p>
    <p>${escapeHtml(data.config.companyName||"ArcD Construtora")}</p>
    ${data.config.cnpj?`<p>CNPJ: ${escapeHtml(data.config.cnpj)}</p>`:""}
  </div>
</div>

<div class="footer">Documento gerado pelo ArcD Ponto PRO · ${new Date().toLocaleString("pt-BR")} · Via do empregador / Via do trabalhador</div>
</body></html>`;
    const w = window.open("","_blank");
    w.document.write(html);
    w.document.close();
  };

  // Valor por extenso (simplificado até 999.999,99)
  function valorPorExtenso(n) {
    if(!n||isNaN(n)) return "zero reais";
    const inteiro = Math.floor(n);
    const centavos = Math.round((n - inteiro)*100);
    const u = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
    const d = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
    const c = ["","cem","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];
    function grupo(n) {
      if(n===0) return "";
      if(n===100) return "cem";
      const cent = Math.floor(n/100), dez = Math.floor((n%100)/10), un = n%10;
      const parts = [];
      if(cent) parts.push(c[cent]);
      if(dez>=2){ parts.push(d[dez]); if(un) parts.push(u[un]); }
      else if(dez===1||un) parts.push(u[Math.floor(n%100)>19?un:n%100]);
      return parts.join(" e ");
    }
    const mil = Math.floor(inteiro/1000), resto = inteiro%1000;
    const partes = [];
    if(mil>0) partes.push((mil===1?"mil":grupo(mil)+" mil"));
    if(resto>0) partes.push(grupo(resto)+(resto===1?" real":" reais"));
    if(partes.length===0) partes.push("zero reais");
    if(centavos>0) partes.push(grupo(centavos)+(centavos===1?" centavo":" centavos"));
    return partes.join(" e ");
  }

  const activeEmps = data.employees.filter(e => e.active !== false);
  const rescisoes  = (data.rescisoes||[]).slice().reverse();

  return (
    <div className="anim" style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${C.red}22 0%,${C.card} 65%)`,border:`1px solid ${C.red}44`,borderLeft:`5px solid ${C.red}`,padding:"16px 18px",borderRadius:18}}>
        <p style={{fontSize:11,fontWeight:900,color:C.red,textTransform:"uppercase",letterSpacing:1.2,marginBottom:4}}>Documentos</p>
        <h2 style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:2,color:C.text,lineHeight:1}}>Cálculo de Rescisão</h2>
        <p style={{color:C.muted,fontSize:13,marginTop:4}}>Gere o cálculo e o PDF para assinatura do trabalhador.</p>
      </div>

      {/* Selecionar funcionário */}
      <div style={{background:C.card,border:`1px solid ${C.line}`,borderTop:`3px solid ${C.yellow}`,padding:14,borderRadius:16,display:"flex",flexDirection:"column",gap:10}}>
        <p style={{fontSize:11,fontWeight:900,color:C.yellow,textTransform:"uppercase",letterSpacing:.8}}>① Trabalhador</p>
        <Sel label="Selecionar da lista (ou preencha manualmente abaixo)"
          value={form.empId}
          onChange={selectEmp}
          options={[{v:"",l:"— Preenchimento manual —"},...activeEmps.map(e=>({v:e.id,l:`${e.name}${e.role?" · "+e.role:""}`}))]}
        />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Nome completo *" value={form.empName} onChange={F("empName")} placeholder="Nome do trabalhador"/>
          <Inp label="CPF" value={form.empCPF} onChange={v=>F("empCPF")(fmtCPF(v))} placeholder="000.000.000-00"/>
          <Inp label="Função" value={form.empFuncao} onChange={F("empFuncao")} placeholder="Pedreiro, servente..."/>
          <Inp label="Obra" value={form.obraName} onChange={F("obraName")} placeholder="Nome da obra"/>
        </div>
      </div>

      {/* Datas e valores */}
      <div style={{background:C.card,border:`1px solid ${C.line}`,borderTop:`3px solid ${C.orange}`,padding:14,borderRadius:16,display:"flex",flexDirection:"column",gap:10}}>
        <p style={{fontSize:11,fontWeight:900,color:C.orange,textTransform:"uppercase",letterSpacing:.8}}>② Período e Valores</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Data de admissão *"  type="date" value={form.admissao}    onChange={F("admissao")}/>
          <Inp label="Data de rescisão *"  type="date" value={form.demissao}    onChange={F("demissao")}/>
          <Inp label="Valor mensal (R$) *" type="number" value={form.valorMensal} onChange={F("valorMensal")} placeholder="Diária × 26 dias"/>
          <Inp label="Dias trabalhados no mês" type="number" value={form.diasNoMes} onChange={F("diasNoMes")} placeholder="Ex: 12"/>
        </div>
        <Sel label="Motivo da rescisão *" value={form.tipo} onChange={F("tipo")} options={TIPOS_RESCISAO}/>
        {form.admissao && form.demissao && calc && (
          <div style={{background:`${C.yellow}12`,border:`1px solid ${C.yellow}33`,padding:"10px 14px",borderRadius:10}}>
            <p style={{fontSize:12,color:C.yellow,fontWeight:700}}>
              ⏱ {calc.anos > 0 ? `${calc.anos} ano(s), ` : ""}{calc.totalMeses % 12} mês(es) e {calc.diasResto} dia(s) de serviço
              · <span style={{color:C.subtle}}>{calc.avos13} avo(s) para 13º e férias</span>
            </p>
          </div>
        )}
      </div>

      {/* Verbas */}
      <div style={{background:C.card,border:`1px solid ${C.line}`,borderTop:`3px solid ${C.green}`,padding:14,borderRadius:16,display:"flex",flexDirection:"column",gap:10}}>
        <p style={{fontSize:11,fontWeight:900,color:C.green,textTransform:"uppercase",letterSpacing:.8}}>③ Verbas rescisórias</p>
        {[
          ["incluirSaldo",  "Saldo de salário",              true],
          ["incluir13",     "13º salário proporcional",      true],
          ["incluirFerias", "Férias proporcionais + 1/3",    true],
          ["incluirAviso",  "Aviso prévio (30 dias)",        false],
        ].map(([key, label, def]) => (
          <label key={key} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"8px 10px",background:form[key]?`${C.green}0d`:"transparent",borderRadius:10,border:`1px solid ${form[key]?C.green+"33":C.line}`}}>
            <div onClick={()=>F(key)(!form[key])} style={{width:20,height:20,border:`2px solid ${form[key]?C.green:C.muted}`,background:form[key]?C.green:"transparent",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"}}>
              {form[key] && <span style={{color:C.ink,fontSize:13,fontWeight:900,lineHeight:1}}>✓</span>}
            </div>
            <div style={{flex:1}}>
              <p style={{fontSize:13,fontWeight:700,color:form[key]?C.text:C.muted}}>{label}</p>
              {calc && form[key] && (
                <p style={{fontSize:11,color:C.green,marginTop:1}}>
                  {key==="incluirSaldo"  && `${form.diasNoMes||0} dias × R$ ${Number((Number(form.valorMensal||0)/30)).toFixed(2)} = ${fmt(calc.saldoSalario)}`}
                  {key==="incluir13"     && `${calc.avos13}/12 × ${fmt(Number(form.valorMensal||0))} = ${fmt(calc.dec13)}`}
                  {key==="incluirFerias" && `${calc.avosFerias}/12 × ${fmt(Number(form.valorMensal||0))} × 4/3 = ${fmt(calc.feriasTotal)}`}
                  {key==="incluirAviso"  && (form.tipo==="sem_justa_causa"||form.tipo==="acordo_mutuo") && `${fmt(calc.avisoPrevio)}`}
                  {key==="incluirAviso"  && form.tipo!=="sem_justa_causa" && form.tipo!=="acordo_mutuo" && <span style={{color:C.red}}>não aplicável neste tipo de rescisão</span>}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>

      {/* Descontos */}
      <div style={{background:C.card,border:`1px solid ${C.line}`,borderTop:`3px solid ${C.red}`,padding:14,borderRadius:16,display:"flex",flexDirection:"column",gap:10}}>
        <p style={{fontSize:11,fontWeight:900,color:C.red,textTransform:"uppercase",letterSpacing:.8}}>④ Descontos</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Adiantamentos (R$)" type="number" value={form.descAdiantamento} onChange={F("descAdiantamento")} placeholder="0,00"/>
          <Inp label="Outros descontos (R$)" type="number" value={form.descOutros} onChange={F("descOutros")} placeholder="0,00"/>
        </div>
        {Number(form.descOutros||0)>0 && <Inp label="Descrição dos outros descontos" value={form.obsDesc} onChange={F("obsDesc")} placeholder="Ex.: materiais, equipamentos..."/>}
      </div>

      {/* Resultado */}
      {calc ? (
        <div style={{background:`linear-gradient(135deg,${C.yellow} 0%,${C.yellowD} 60%,#4a3c0a 100%)`,color:C.ink,padding:"18px 20px",borderRadius:18,border:`1px solid ${C.yellow}`}}>
          <p style={{fontSize:11,fontWeight:900,letterSpacing:1.2,textTransform:"uppercase",opacity:.75}}>Total líquido a receber</p>
          <p style={{fontFamily:"'Bebas Neue'",fontSize:48,letterSpacing:1,lineHeight:.95}}>{fmt(calc.totalLiquido)}</p>
          <p style={{fontSize:12,fontWeight:700,marginTop:6,opacity:.85}}>{valorPorExtenso(calc.totalLiquido)}</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:14}}>
            {[
              ["Vencimentos",fmt(calc.totalBruto)],
              ["Descontos",  fmt(calc.totalDesc)],
              ["Líquido",    fmt(calc.totalLiquido)],
            ].map(([l,v])=>(
              <div key={l} style={{background:"rgba(0,0,0,.15)",padding:"8px 10px",borderRadius:10}}>
                <p style={{fontSize:9,fontWeight:900,textTransform:"uppercase",opacity:.7}}>{l}</p>
                <p style={{fontWeight:900,fontSize:15}}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{background:C.card,border:`1px solid ${C.line}`,padding:20,textAlign:"center",color:C.muted,borderRadius:14}}>
          Preencha nome, datas e valor mensal para calcular.
        </div>
      )}

      {/* Observações e ações */}
      <Inp label="Observações (aparece no documento)" value={form.obs} onChange={F("obs")} multiline placeholder="Informações adicionais, acordos, pendências..."/>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Btn v="ghost" onClick={()=>setForm(emptyForm)} full><Ic n="x"/> Limpar</Btn>
        <Btn v="danger" onClick={gerarPDF} full disabled={!calc}><Ic n="file"/> Gerar PDF</Btn>
      </div>
      <Btn onClick={salvar} full disabled={!calc}><Ic n="check"/> Salvar no histórico</Btn>

      {/* Histórico */}
      <button onClick={()=>setHistory(h=>!h)} style={{background:"transparent",border:`1px solid ${C.line}`,color:C.muted,padding:"10px 14px",cursor:"pointer",borderRadius:12,fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,textTransform:"uppercase",letterSpacing:.5,textAlign:"left"}}>
        {history?"▲ Ocultar":"▼ Ver"} histórico de rescisões ({rescisoes.length})
      </button>

      {history && rescisoes.length === 0 && (
        <div style={{background:C.card,border:`1px solid ${C.line}`,padding:16,textAlign:"center",color:C.muted,borderRadius:14}}>
          Nenhuma rescisão salva ainda.
        </div>
      )}

      {history && rescisoes.map(r => (
        <div key={r.id} style={{background:C.card,border:`1px solid ${C.line}`,borderLeft:`4px solid ${C.red}`,padding:"12px 16px",borderRadius:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
            <div>
              <p style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:17}}>{r.empName}</p>
              <p style={{fontSize:11,color:C.muted,marginTop:2}}>
                {r.empFuncao&&`${r.empFuncao} · `}{r.obraName&&`${r.obraName} · `}
                {fmtDateFull(r.admissao)} → {fmtDateFull(r.demissao)}
              </p>
              <p style={{fontSize:11,color:C.subtle,marginTop:2}}>{TIPO_LABEL[r.tipo]||r.tipo}</p>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <p style={{fontFamily:"'Bebas Neue'",fontSize:22,color:C.yellow,letterSpacing:.5}}>{fmt(r.totalLiquido)}</p>
              <p style={{fontSize:10,color:C.muted}}>{new Date(r.createdAt).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
          <div style={{display:"flex",gap:6,marginTop:10}}>
            <Btn size="sm" v="ghost" onClick={()=>{setForm({...r});setHistory(false);}}>
              <Ic n="edit"/> Reabrir
            </Btn>
            <Btn size="sm" v="danger" onClick={()=>{
              const html2 = ""; // Re-uses gerarPDF logic via form re-open
              showToast("Reabra o cadastro e clique em Gerar PDF.");
            }}>
              <Ic n="file"/> PDF
            </Btn>
            <Btn size="sm" v="danger" onClick={()=>{
              if(!window.confirm("Remover esta rescisão do histórico?")) return;
              update({...data,rescisoes:(data.rescisoes||[]).filter(rc=>rc.id!==r.id)});
              showToast("Removida.");
            }}><Ic n="trash"/></Btn>
          </div>
        </div>
      ))}
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
          <Inp label="WhatsApp RH (c/ DDI)" value={form.hrPhone} onChange={setField("hrPhone")} placeholder="5581999990000" />
          <Inp label="E-mail aprovador" value={form.approverEmail} onChange={setField("approverEmail")} />
        </div>
        <div style={{ marginTop: 12 }}><Btn onClick={saveConfig}><Ic n="check" /> Salvar configurações</Btn></div>
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
    { id: "home",   label: "Painel",    icon: "home"     },
    { id: "obras",  label: "Obras",     icon: "home"     },
    { id: "equipe", label: "Equipe",    icon: "users"    },
    { id: "terc",   label: "Terceiros", icon: "terc"     },
    { id: "ponto",  label: "Ponto",     icon: "clock"    },
    { id: "folha",  label: "Folha",     icon: "dollar"   },
    { id: "resc",   label: "Rescisão",  icon: "file"     },
    { id: "fin",    label: "Fin.",      icon: "chart"    },
    { id: "relat",  label: "Custos",    icon: "chart"    },
    { id: "ia",     label: "IA",        icon: "brain"    },
    { id: "config", label: "Ajustes",   icon: "settings" },
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
          {tab === "home"   && <Dashboard data={data} onTab={setTab} />}
          {tab === "obras"  && <Obras data={data} update={update} showToast={showToast} />}
          {tab === "equipe" && <Equipe data={data} update={update} showToast={showToast} />}
          {tab === "terc"   && <Terceiros data={data} update={update} showToast={showToast} />}
          {tab === "ponto"  && <Ponto data={data} update={update} showToast={showToast} />}
          {tab === "folha"  && <Folha data={data} showToast={showToast} />}
          {tab === "resc"   && <Rescisao data={data} update={update} showToast={showToast} />}
          {tab === "fin"    && <Financeiro data={data} update={update} showToast={showToast} />}
          {tab === "relat"  && <Relatorios data={data} />}
          {tab === "ia"     && <AgenteIA data={data} showToast={showToast} onTab={setTab} />}
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
