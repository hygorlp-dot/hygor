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
// ═══════════════════════════════════════════════════════════════════

const C = {
  bg: "#080808",
  surface: "#101010",
  card: "#161616",
  card2: "#1c1c1c",
  border: "#2a2a2a",
  yellow: "#f0df00",
  yellowD: "#b8a800",
  yellowDim: "#3a3600",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
  orange: "#f97316",
  purple: "#a855f7",
  text: "#f5f5f5",
  muted: "#777777",
  subtle: "#aaaaaa",
};

const CHART_COLORS = [C.yellow, C.green, C.blue, C.orange, C.purple, C.red, "#06b6d4", "#ec4899"];

const G = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{min-height:100%}
body{background:${C.bg};color:${C.text};font-family:'Barlow',Arial,sans-serif;-webkit-tap-highlight-color:transparent}
input,select,textarea,button{font-family:'Barlow',Arial,sans-serif}
button:disabled{opacity:.55;cursor:not-allowed!important}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:${C.surface}}
::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes fadeInUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
@keyframes spin{to{transform:rotate(360deg)}}
.anim{animation:fadeIn .25s ease}
.animUp{animation:fadeInUp .35s ease}
.no-scroll{overflow:hidden}
@media print{.no-print{display:none!important} body{background:#fff;color:#000}}
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
  },
  obras: [
    { id: uid(), name: "Obra 1", address: "", engineer: "", startDate: "", status: "active" },
    { id: uid(), name: "Obra 2", address: "", engineer: "", startDate: "", status: "active" },
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
    },
    obras: Array.isArray(d.obras) ? d.obras.map(o => ({
      id: o.id || uid(),
      name: o.name || "Obra sem nome",
      address: o.address || "",
      engineer: o.engineer || "",
      startDate: o.startDate || "",
      status: o.status || "active",
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

function Ic({ n, s = 16 }) {
  const map = {
    home: "⌂",
    users: "👥",
    clock: "⏱",
    dollar: "R$",
    chart: "◔",
    plus: "+",
    edit: "✎",
    trash: "×",
    x: "×",
    check: "✓",
    mail: "✉",
    lock: "🔒",
    unlock: "🔓",
    file: "▣",
    download: "⇩",
    copy: "⧉",
    money: "½",
    calendar: "▦",
    alert: "!",
    settings: "⚙",
    phone: "☎",
  };

  return (
    <span style={{ fontSize: s, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: s }}>
      {map[n] || "•"}
    </span>
  );
}

function Btn({ children, onClick, v = "primary", size = "md", full = false, disabled = false, type = "button", style = {} }) {
  const variants = {
    primary: { bg: C.yellow, color: C.bg, border: C.yellow },
    warning: { bg: C.yellow, color: C.bg, border: C.yellow },
    danger: { bg: C.red, color: "white", border: C.red },
    success: { bg: C.green, color: C.bg, border: C.green },
    info: { bg: C.blue, color: "white", border: C.blue },
    ghost: { bg: "transparent", color: C.text, border: C.border },
    dark: { bg: C.card, color: C.text, border: C.border },
  };
  const vv = variants[v] || variants.primary;
  const py = size === "sm" ? 7 : size === "lg" ? 13 : 10;
  const px = size === "sm" ? 10 : 14;

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
        fontWeight: 800,
        letterSpacing: 0.7,
        textTransform: "uppercase",
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        justifyContent: "center",
        fontSize: size === "sm" ? 12 : 14,
        transition: "all .15s ease",
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
          background: disabled ? C.surface : C.card,
          border: `1px solid ${C.border}`,
          color: C.text,
          padding: "11px 12px",
          outline: "none",
          fontSize: 14,
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
          background: disabled ? C.surface : C.card,
          border: `1px solid ${C.border}`,
          color: C.text,
          padding: "11px 12px",
          outline: "none",
          fontSize: 14,
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
      padding: "3px 7px",
      border: `1px solid ${color}66`,
      background: `${color}18`,
      color,
      fontSize: 10,
      fontWeight: 900,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginTop: 4,
      marginRight: 4,
    }}>
      {children}
    </span>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.border, margin: "10px 0" }} />;
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
        background: "rgba(0,0,0,.78)",
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
          background: C.surface,
          border: `1px solid ${C.border}`,
          boxShadow: "0 20px 80px rgba(0,0,0,.5)",
        }}
      >
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 16px",
          borderBottom: `1px solid ${C.border}`,
          background: C.card,
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
      background: C.card,
      border: `1px solid ${color}`,
      borderLeft: `5px solid ${color}`,
      color: C.text,
      padding: "12px 14px",
      boxShadow: "0 10px 40px rgba(0,0,0,.45)",
      fontSize: 13,
      fontWeight: 700,
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
  const { q1, q2 } = getQ(year, month);
  const qDays = day <= 15 ? q1 : q2;
  const todayIso = today();
  const activeEmps = data.employees.filter(e => e.active !== false);
  const activeObras = data.obras.filter(o => o.status !== "done");

  const presentes = activeEmps.filter(e => attStatus(data, e.id, todayIso) === "P").length;
  const faltas = activeEmps.filter(e => attStatus(data, e.id, todayIso) === "F").length;
  const meiodia = activeEmps.filter(e => attStatus(data, e.id, todayIso) === "M").length;
  const semReg = Math.max(0, activeEmps.length - presentes - faltas - meiodia);
  const checkPending = activeEmps.length > 0 && data.dailyCheckDate !== todayIso;

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
    <button onClick={() => tab && onTab(tab)} style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${color}`,
      padding: 14,
      textAlign: "left",
      color: C.text,
      cursor: tab ? "pointer" : "default",
      minHeight: 88,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ color, fontSize: 13, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</span>
        <Ic n={icon} s={18} />
      </div>
      <p style={{ fontFamily: "'Bebas Neue'", color, fontSize: 34, letterSpacing: 1 }}>{value}</p>
      {sub && <p style={{ color: C.muted, fontSize: 12 }}>{sub}</p>}
    </button>
  );

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 30, letterSpacing: 2, color: C.yellow }}>Painel Geral</h2>
        <p style={{ color: C.muted, fontSize: 13 }}>Resumo de equipes, obras e ponto diário</p>
      </div>

      {checkPending && (
        <button onClick={() => onTab("ponto")} style={{
          background: `${C.yellow}18`,
          border: `1px solid ${C.yellow}`,
          borderLeft: `5px solid ${C.yellow}`,
          color: C.yellow,
          padding: 14,
          cursor: "pointer",
          textAlign: "left",
        }}>
          <p style={{ fontFamily: "'Barlow Condensed'", fontSize: 18, fontWeight: 900, textTransform: "uppercase" }}>Verificação diária pendente</p>
          <p style={{ color: C.subtle, fontSize: 12 }}>Confirme movimentações de transferência/demissão antes de lançar o ponto.</p>
        </button>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <Stat label="Ativos" value={activeEmps.length} sub="trabalhadores" color={C.yellow} icon="users" tab="equipe" />
        <Stat label="Obras" value={activeObras.length} sub="em andamento" color={C.blue} icon="home" tab="obras" />
        <Stat label="Presentes" value={presentes} sub={`${semReg} sem registro hoje`} color={C.green} icon="check" tab="ponto" />
        <Stat label="Quinzena" value={fmt(qTotal)} sub={`${qDays.length} dias no período`} color={C.purple} icon="dollar" tab="folha" />
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>Presença — últimos 7 dias</h3>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last7}>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="d" stroke={C.muted} fontSize={11} />
              <YAxis stroke={C.muted} fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }} />
              <Bar dataKey="P" stackId="a" fill={C.green} />
              <Bar dataKey="M" stackId="a" fill={C.yellow} />
              <Bar dataKey="F" stackId="a" fill={C.red} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>Distribuição de hoje</h3>
        <div style={{ height: 210 }}>
          {pieData.length === 0 ? (
            <p style={{ color: C.muted }}>Sem dados de ponto hoje.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {pieData.map((entry, index) => <Cell key={entry.name} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        <Btn onClick={() => onTab("ponto")} full><Ic n="clock" /> Registrar ponto</Btn>
        <Btn onClick={() => onTab("folha")} v="success" full><Ic n="dollar" /> Gerar folha</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Obras
// ═══════════════════════════════════════════════════════════════════

function Obras({ data, update, showToast }) {
  const empty = { id: "", name: "", address: "", engineer: "", startDate: "", status: "active" };
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");

  const setField = key => value => setForm(f => ({ ...f, [key]: value }));

  const save = () => {
    if (!form.name.trim()) {
      showToast("Nome da obra obrigatório.", "error");
      return;
    }

    const payload = { ...form, id: form.id || uid() };
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
        return (
          <div key={o.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${st.c}`, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div>
                <p style={{ fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 18 }}>{o.name}</p>
                <Badge color={st.c}>{st.l}</Badge>
                <p style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>{count} trabalhador{count !== 1 ? "es" : ""} ativo{count !== 1 ? "s" : ""}</p>
                {o.address && <p style={{ color: C.subtle, fontSize: 12, marginTop: 4 }}>{o.address}</p>}
                {o.engineer && <p style={{ color: C.subtle, fontSize: 12 }}>Responsável: {o.engineer}</p>}
                {o.startDate && <p style={{ color: C.subtle, fontSize: 12 }}>Início: {fmtDateFull(o.startDate)}</p>}
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
                <Btn v="ghost" size="sm" onClick={() => { setForm(o); setModal(true); }}><Ic n="edit" /></Btn>
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

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 30, letterSpacing: 2, color: C.yellow }}>Registro de Ponto</h2>
        <p style={{ color: C.muted, fontSize: 13 }}>Marque a presença diária, finalize a obra e bloqueie alterações indevidas.</p>
      </div>

      <Inp label="Data" type="date" value={selDate} onChange={setSelDate} max={today()} />

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
          <div key={e.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${borderCol}`, padding: 13, opacity: cardLocked ? 0.86 : 1 }}>
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
                      background: status === st ? `${col}22` : "transparent",
                      color: status === st ? col : C.muted,
                      padding: "8px 4px",
                      cursor: "pointer",
                      fontFamily: "'Barlow Condensed'",
                      fontWeight: 900,
                      fontSize: 12,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                    }}>
                      <Ic n={icon} s={14} /> {label}
                    </button>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 5 }}>
                  <Btn v="warning" size="sm" full onClick={() => setMovementModal({ emp: e, mode: "transfer" })}>Transferir</Btn>
                  <Btn v="danger" size="sm" full onClick={() => setMovementModal({ emp: e, mode: "dismiss" })}>Demitir</Btn>
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
    const ws = XLSX.utils.aoa_to_sheet([["Folha de Pagamento", periodLabel], ["Data de pagamento", paymentDateLabel], ["Regra aplicada", paymentObs], [], header, ...body, total]);
    ws["!cols"] = [20, 15, 15, 8, 10, 8, 12, 15, 17, 14, 6, 10, 12, 10, 10, 10, 12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "Folha");
    XLSX.writeFile(wb, `arcd-folha-${year}-${String(month + 1).padStart(2, "0")}-Q${q}.xlsx`);
    showToast("Excel gerado.");
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
// Relatórios
// ═══════════════════════════════════════════════════════════════════

function Relatorios({ data }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const days = getDays(year, month);
  const obraName = id => data.obras.find(o => o.id === id)?.name || "—";

  const byObra = data.obras.map(o => {
    const emps = data.employees.filter(e => e.obra === o.id && e.active !== false);
    const presentes = emps.reduce((sum, e) => sum + days.filter(d => attStatus(data, e.id, d) === "P").length, 0);
    const faltas = emps.reduce((sum, e) => sum + days.filter(d => attStatus(data, e.id, d) === "F").length, 0);
    return { name: o.name, trabalhadores: emps.length, presentes, faltas };
  });

  const topCost = data.employees.map(e => {
    const total = days.reduce((s, d) => {
      const st = attStatus(data, e.id, d);
      if (st === "P") return s + Number(e.dailyRate || 0);
      if (st === "M") return s + Number(e.dailyRate || 0) * 0.5;
      return s;
    }, 0);
    return { name: e.name, obra: obraName(e.obra), total };
  }).filter(i => i.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 30, letterSpacing: 2, color: C.yellow }}>Relatórios</h2>
        <p style={{ color: C.muted, fontSize: 13 }}>Indicadores mensais de presença e custo.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Sel value={String(year)} onChange={v => setYear(Number(v))} options={Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => ({ v: String(y), l: String(y) }))} />
        <Sel value={String(month)} onChange={v => setMonth(Number(v))} options={Array.from({ length: 12 }, (_, i) => ({ v: String(i), l: fullMonth(i) }))} />
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", marginBottom: 8 }}>Presenças por obra</h3>
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

      <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 14 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed'", color: C.yellow, textTransform: "uppercase", marginBottom: 8 }}>Top custos do mês</h3>
        <div style={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={topCost}>
              <CartesianGrid stroke={C.border} vertical={false} />
              <XAxis dataKey="name" stroke={C.muted} fontSize={10} />
              <YAxis stroke={C.muted} fontSize={10} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, color: C.text }} formatter={v => fmt(v)} />
              <Line type="monotone" dataKey="total" stroke={C.yellow} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {topCost.map(i => (
        <div key={i.name} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.yellow}`, padding: 12, display: "flex", justifyContent: "space-between" }}>
          <div><p style={{ fontWeight: 900 }}>{i.name}</p><p style={{ color: C.muted, fontSize: 12 }}>{i.obra}</p></div>
          <p style={{ color: C.yellow, fontWeight: 900 }}>{fmt(i.total)}</p>
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

  const update = useCallback((next) => {
    const normalized = normalizeData(next);
    setData(normalized);
    supabaseSave(normalized).then(ok => {
      if (!ok) showToast("Não foi possível salvar no Supabase.", "error");
    }).catch(() => showToast("Erro ao salvar no Supabase.", "error"));
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
    { id: "relat", label: "Relatórios", icon: "chart" },
    { id: "config", label: "Config", icon: "settings" },
  ];

  if (loading || !data) {
    return (
      <>
        <style>{G}</style>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 44, height: 44, border: `4px solid ${C.border}`, borderTopColor: C.yellow, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 14px" }} />
            <h1 style={{ fontFamily: "'Bebas Neue'", color: C.yellow, letterSpacing: 2 }}>ArcD Obras</h1>
            <p style={{ color: C.muted }}>Carregando dados...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{G}</style>
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: 78 }}>
        <header className="no-print" style={{ position: "sticky", top: 0, zIndex: 50, background: C.bg, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ maxWidth: 980, margin: "0 auto", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <h1 style={{ fontFamily: "'Bebas Neue'", color: C.yellow, fontSize: 30, lineHeight: 1, letterSpacing: 2 }}>ArcD Obras</h1>
              <p style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7 }}>{data.config.productName || "Gestão de Equipes"}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ color: C.subtle, fontSize: 12 }}>{data.config.companyName || "ArcD Obras"}</p>
              <p style={{ color: C.muted, fontSize: 11 }}>{today().split("-").reverse().join("/")}</p>
            </div>
          </div>
        </header>

        <main style={{ maxWidth: 980, margin: "0 auto", padding: 14 }}>
          {tab === "home" && <Dashboard data={data} onTab={setTab} />}
          {tab === "obras" && <Obras data={data} update={update} showToast={showToast} />}
          {tab === "equipe" && <Equipe data={data} update={update} showToast={showToast} />}
          {tab === "ponto" && <Ponto data={data} update={update} showToast={showToast} />}
          {tab === "folha" && <Folha data={data} showToast={showToast} />}
          {tab === "relat" && <Relatorios data={data} />}
          {tab === "config" && <Config data={data} update={update} showToast={showToast} />}
        </main>

        <nav className="no-print" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.border}`, zIndex: 80 }}>
          <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  background: active ? `${C.yellow}12` : "transparent",
                  color: active ? C.yellow : C.muted,
                  border: 0,
                  borderTop: active ? `3px solid ${C.yellow}` : "3px solid transparent",
                  padding: "8px 2px 9px",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                }}>
                  <Ic n={t.icon} s={16} />
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
