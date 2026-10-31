// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { toLocalISODate } from "../domains/ponto/attendance-engine";
import { SUPPLIER_CATEGORIES as RAMOS_FORNECIMENTO } from "../domains/suppliers/categories";
import { sessionContext } from "../lib/session-context.js";



//
// Helpers gerais
//

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);


export const today = () => toLocalISODate(new Date());


export const fmt = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Formato compacto para KPIs executivos: R$ 2,4 mi / R$ 850 mil. Mantém a leitura
// rápida sem encher o card de dígitos. Para valores pequenos, cai no fmt normal.
export const fmtCompact = n => {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  const sinal = v < 0 ? "-" : "";
  if (abs >= 1e6) return `${sinal}R$ ${(abs/1e6).toFixed(abs>=1e7?0:1).replace(".",",")} mi`;
  if (abs >= 1e3) return `${sinal}R$ ${(abs/1e3).toFixed(0)} mil`;
  return fmt(v);
};


export const fmtDate = iso => {
  if (!iso || typeof iso !== "string" || !iso.includes("-")) return "-";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};


export const fmtDateFull = iso => {
  if (!iso || typeof iso !== "string" || !iso.includes("-")) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};


export const monthName = m => ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m] || "";

export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const fullMonth = m => ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][m] || "";

// Mes/ano curto a partir de uma data ISO: "ago/26". Usado na regua do Gantt.
export const fmtMesAno = iso => {
  if (!iso) return "";
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const d = new Date(iso + "T00:00:00");
  return `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
};


// fmtCPF/fmtPhone moveram para EquipeView.jsx/RescisaoView.jsx em
// 2026-08-20 (únicos consumidores).

export const escapeHtml = value => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#039;");


//
// Dados padrão e normalização
//

//  Especialidades de terceirizados
// Ramos de fornecimento. Um fornecedor pode atender varios (uma casa de
// construcao vende de tudo; uma serralheria so metais). Serve para filtrar a
// busca e para o sistema sugerir de quem comprar cada material.
export const rotuloRamo = v => RAMOS_FORNECIMENTO.find(r => r.v === v)?.l || v;


export const maiusculoOrcamento = valor => String(valor ?? "").toLocaleUpperCase("pt-BR");

export const formatarCodigoArcd = numero => `MARCELL${String(numero).padStart(3,"0")}`;

export const numeroCodigoArcd = codigo => Number(/^ARCD(\d+)$/i.exec(String(codigo||"").trim())?.[1] || 0);

export const proximoCodigoArcd = data => {
  const codigos=[...(data?.materiais||[]),...(data?.composicoes||[]),...(data?.composicoesEmpresa||[])];
  const maior=codigos.reduce((max,item)=>Math.max(max,numeroCodigoArcd(item.codigo)),0);
  return formatarCodigoArcd(maior+1);
};

export const obraContextoSalvo = () => typeof window!=="undefined" ? (sessionContext.getItem("arcd_obra_contexto")||"") : "";


export const compactNumber = value => {
  const n = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", {
    notation: Math.abs(n) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
};


// A tela de Terceiros (cadastro e pagamentos semanais) foi extraída para
// src/domains/terceirizados/components/TerceirosView.jsx em 2026-08-15 -
// importada como `Terceiros` abaixo, mesmo nome de sempre.

export const compLabel = ym => {
  if (!ym) return "-";
  const [y, m] = ym.split("-");
  return `${fullMonth(Number(m)-1)} ${y}`;
};
