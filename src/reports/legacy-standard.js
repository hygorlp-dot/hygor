// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { monthName, fmtDateFull, fmt, escapeHtml } from "../legacy/format.js";
import { MARCELL_LOGO } from "../brand/identity.js";
import { getDays } from "../domains/ponto/attendance-engine";
import { prIsWeekdayIso } from "../domains/ponto/attendance-engine";
import { isEmployeeEmployedOnDate } from "../domains/ponto/attendance-engine";
import { attStatus } from "../domains/ponto/attendance-engine";
import { isLeaveStatus } from "../domains/ponto/attendance-status";
import { marcellReportHtml } from "./marcell-report.js";


// Resolvedores concretos do motor de aprovação para o app ARCD: como este
// app ainda não tem cargo/hierarquia/departamento/centro de custo cadastrados,
// cada resolvedor devolve [] quando o conceito não existe de verdade na base -
// isso é o comportamento CORRETO (aciona a contingência configurada na etapa,
// nunca inventa um aprovador). Não presume nenhum cargo fixo além do que já
// existe em `usuarios[].role` (admin/financeiro/compras/engenheiro/rh/...).
// Genéricos por natureza (não dependem de nada específico de Compras) -
// reutilizados por qualquer entidadeTipo, ver MOTORES_APROVACAO_POR_ENTIDADE.
//
// ARCD OBRAS - aplicação legada em migração incremental por domínio
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
// - Relatórios com gasto por obra, metragem quadrada e custo de mão de obra por m
// - Interface reforçada para o Registro de Ponto, com ícones e navegação em destaque
// - Agente de IA para apoiar ponto, folha, obras, custos e alertas
// - Rebranding visual ARCD OBRA: linguagem gráfica geométrica, foco no ponto e navegação mais intuitiva
//

export const ARCD_LOGO = MARCELL_LOGO;


// A tela Equipe foi extraída para
// src/domains/rh/components/EquipeView.jsx em 2026-08-20.

//
// FICHA DO FUNCIONÁRIO - resumo de frequência, ranking e histórico
// (gerarFichaFuncionarioPDF é usada pela EquipeView extraída acima e por
// outro consumidor mais abaixo neste arquivo - fica exportada aqui)
//

// Frequência mês a mês (últimos N meses em que o funcionário esteve
// vinculado), reaproveitando a mesma leitura dia a dia da Folha
// (getAtt/isEmployeeEmployedOnDate), mas agregando por competência em vez de
// calcular valores de pagamento.
export function calcFrequenciaMensalFuncionario(data, employee, meses = 12) {
  const hoje = new Date();
  const resultado = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const year = d.getFullYear(), month = d.getMonth();
    const dias = getDays(year, month).filter(prIsWeekdayIso);
    let presentes = 0, meiodia = 0, faltas = 0, semRegistro = 0, diasNoVinculo = 0;
    dias.forEach(dia => {
      if (!isEmployeeEmployedOnDate(employee, dia)) return;
      diasNoVinculo++;
      const st = attStatus(data, employee.id, dia);
      if (st === "P") presentes++;
      else if (st === "M") meiodia++;
      else if (st === "F") faltas++;
      else if (isLeaveStatus(st)) return;
      else semRegistro++;
    });
    if (diasNoVinculo === 0) continue;
    resultado.push({
      label: `${monthName(month)}/${String(year).slice(2)}`,
      presentes, meiodia, faltas, semRegistro, diasNoVinculo,
      pctPresenca: ((presentes + meiodia * 0.5) / diasNoVinculo) * 100,
    });
  }
  return resultado;
}


// Ranking de frequência entre todos os funcionários com vínculo na janela
// analisada (mesma leitura, mas comparando todo mundo para posicionar o
// funcionário da ficha).
export function calcRankingFrequencia(data, meses = 3) {
  const hoje = new Date();
  const janela = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    janela.push(...getDays(d.getFullYear(), d.getMonth()).filter(prIsWeekdayIso));
  }
  return (data.employees || []).map(emp => {
    let presentes = 0, meiodia = 0, faltas = 0, diasNoVinculo = 0;
    janela.forEach(dia => {
      if (!isEmployeeEmployedOnDate(emp, dia)) return;
      diasNoVinculo++;
      const st = attStatus(data, emp.id, dia);
      if (st === "P") presentes++;
      else if (st === "M") meiodia++;
      else if (st === "F") faltas++;
    });
    return { emp, presentes, meiodia, faltas, diasNoVinculo, pct: diasNoVinculo ? ((presentes + meiodia * 0.5) / diasNoVinculo) * 100 : null };
  })
    .filter(l => l.diasNoVinculo > 0)
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))
    .map((l, i) => ({ ...l, posicao: i + 1 }));
}


export const FICHA_TIPO_LABEL = {
  created: "Cadastro", transfer: "Transferência de obra", dismissal: "Desligamento",
  promotion: "Mudança de função", salary_change: "Alteração de diária",
  employee_archived: "Cadastro arquivado", reactivation: "Reativação",
  editou: "Edição de cadastro",
};


export function gerarFichaFuncionarioPDF(data, employee, showToast) {
  const frequencia = calcFrequenciaMensalFuncionario(data, employee, 12);
  const ranking = calcRankingFrequencia(data, 3);
  const posicaoRanking = ranking.find(l => l.emp.id === employee.id);
  const historico = (data.changeLog || [])
    .filter(e => e.empId === employee.id)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  const totalPresencas = frequencia.reduce((s, f) => s + f.presentes + f.meiodia * 0.5, 0);
  const totalDias = frequencia.reduce((s, f) => s + f.diasNoVinculo, 0);
  const totalFaltas = frequencia.reduce((s, f) => s + f.faltas, 0);
  const pctGeral = totalDias ? (totalPresencas / totalDias) * 100 : 0;

  const tempoCasa = (() => {
    if (!employee.startDate) return "-";
    const ini = new Date(employee.startDate + "T12:00:00");
    const fim = employee.endDate ? new Date(employee.endDate + "T12:00:00") : new Date();
    const meses = Math.max(0, Math.round((fim - ini) / (1000 * 60 * 60 * 24 * 30.44)));
    const anos = Math.floor(meses / 12), restM = meses % 12;
    return anos > 0 ? `${anos} ano(s) e ${restM} mês(es)` : `${restM} mês(es)`;
  })();

  const obraAtual = (data.obras || []).find(o => o.id === employee.obra)?.name || "-";

  const html = montarRelatorioPadraoHtml({
    data,
    titulo: "Ficha do funcionário",
    subtitulo: employee.name,
    paisagem: false,
    meta: [
      { label: "Função", value: employee.role || "-" },
      { label: "CPF", value: employee.cpf || "-" },
      { label: "Obra atual", value: employee.active === false ? "Desligado" : obraAtual },
      { label: "Admissão", value: employee.startDate ? fmtDateFull(employee.startDate) : "-" },
      ...(employee.active === false ? [
        { label: "Desligamento", value: employee.endDate ? fmtDateFull(employee.endDate) : "-" },
        { label: "Motivo", value: employee.terminationReason || "-" },
      ] : []),
      { label: "Tempo de casa", value: tempoCasa },
    ],
    kpis: [
      { label: "Presença (12 meses)", value: `${pctGeral.toFixed(1)}%` },
      { label: "Faltas (12 meses)", value: String(totalFaltas) },
      { label: "Ranking de frequência", value: posicaoRanking ? `${posicaoRanking.posicao}º de ${ranking.length}` : "Sem dados" },
      { label: "Diária atual", value: fmt(Number(employee.dailyRate || 0)) },
    ],
    tabelas: [
      {
        titulo: "Frequência mensal (últimos 12 meses)",
        headers: ["Mês", { label: "Presenças", num: true }, { label: "Meios período", num: true }, { label: "Faltas", num: true }, { label: "Sem registro", num: true }, { label: "% presença", num: true }],
        rows: frequencia.map(f => [
          escapeHtml(f.label), escapeHtml(String(f.presentes)), escapeHtml(String(f.meiodia)),
          escapeHtml(String(f.faltas)), escapeHtml(String(f.semRegistro)), escapeHtml(`${f.pctPresenca.toFixed(1)}%`),
        ]),
        vazio: "Sem lançamentos de ponto no período.",
      },
      {
        titulo: "Histórico de alterações",
        headers: ["Data", "Tipo", "Descrição", "Operador"],
        rows: historico.map(h => [
          escapeHtml(fmtDateFull(h.date)), escapeHtml(FICHA_TIPO_LABEL[h.type] || h.type),
          escapeHtml(h.message || "-"), escapeHtml(h.operador || "Sistema"),
        ]),
        vazio: "Nenhuma alteração registrada para este funcionário.",
      },
    ],
    legenda: "Ranking de frequência compara a % de presença (presença + meio período × 0,5, sobre dias úteis de vínculo) dos últimos 3 meses entre todos os funcionários com registro no período. Mudanças de função e diária só aparecem no histórico a partir de quando passaram a ser registradas pelo sistema.",
  });
  abrirRelatorioPadrao(html, showToast);
}


// Layout único de relatório em PDF/impressão para o app inteiro - mesmo
// cabeçalho, grade de KPIs, tabelas e assinaturas do relatório de Folha de
// Pagamento (a referência de layout limpo). Todo relatório novo deve montar
// seu HTML a partir daqui em vez de inventar CSS próprio; os textos das
// células já devem chegar formatados/escapados pelo chamador (mesma
// convenção usada nos templates existentes).
export function montarRelatorioPadraoHtml({
  data, titulo, subtitulo = "", meta = [], kpis = [], tabelas = [], legenda = "",
  assinaturas = [], paisagem = true,
}) {
  const metaHtml = meta.filter(Boolean).map(m => `<p><strong>${escapeHtml(m.label)}:</strong> ${escapeHtml(m.value)}</p>`).join("");
  const kpisHtml = kpis.length ? `<div class="kpis">${kpis.map(k => `<div class="kpi"><span>${escapeHtml(k.label)}</span><b>${escapeHtml(k.value)}</b></div>`).join("")}</div>` : "";
  const linhaCelulas = (headers, row) => row.map((cell, ci) => `<td${headers[ci]?.num ? ' class="num"' : ""}>${cell}</td>`).join("");
  const tabelasHtml = tabelas.map((t, i) => `
    <div class="${i === 0 ? "" : "section"}">
      ${t.titulo ? `<h3>${escapeHtml(t.titulo)}</h3>` : ""}
      ${t.descricao ? `<p style="font-size:11px;color:#555">${escapeHtml(t.descricao)}</p>` : ""}
      <table>
        <thead><tr>${t.headers.map(h => `<th${h.num ? ' class="num"' : ""}>${escapeHtml(typeof h === "string" ? h : h.label)}</th>`).join("")}</tr></thead>
        <tbody>
          ${t.rows.length ? t.rows.map(row => `<tr>${linhaCelulas(t.headers, row)}</tr>`).join("") : `<tr><td colspan="${t.headers.length}" class="vazio">${escapeHtml(t.vazio || "Nenhum registro encontrado.")}</td></tr>`}
        </tbody>
        ${t.totalRow ? `<tfoot><tr class="total">${linhaCelulas(t.headers, t.totalRow)}</tr></tfoot>` : ""}
      </table>
    </div>
  `).join("");
  const assinaturasHtml = assinaturas.length ? `<div class="signatures">${assinaturas.map(a => `<div class="signature">${escapeHtml(a)}</div>`).join("")}</div>` : "";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title>
<style>
@page{size:A4 ${paisagem ? "landscape" : "portrait"};margin:10mm}
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;margin:0;color:#111;font-size:10px}
h1,h2,h3{margin:0 0 8px 0}
p{margin:4px 0}
.cabecalho{border-bottom:3px solid #d4af37;padding-bottom:10px;margin-bottom:10px;display:flex;align-items:center;gap:14px}
.cabecalho img.logo{height:46px;max-width:140px;object-fit:contain;flex-shrink:0}
.cabecalho .titulos{flex:1;min-width:0}
.meta{display:flex;gap:18px;flex-wrap:wrap;color:#333}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:7px;margin:10px 0}
.kpi{border:1px solid #bbb;border-top:3px solid #d4af37;padding:7px;background:#fafafa}
.kpi span{display:block;font-size:8px;text-transform:uppercase;color:#666;font-weight:bold}
.kpi b{display:block;font-size:14px;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:8px;table-layout:auto}
thead{display:table-header-group}
tfoot{display:table-footer-group}
tr{break-inside:avoid;page-break-inside:avoid}
th,td{border:1px solid #aaa;padding:4px;text-align:left;vertical-align:middle}
th{background:#e8e8e8;font-size:7.5px;text-transform:uppercase;white-space:nowrap}
td.num,th.num{text-align:right;white-space:nowrap}
.total{font-weight:bold;background:#fff8d6}
.vazio{text-align:center;padding:16px;color:#666;font-style:italic}
.section{margin-top:18px;padding-top:10px;border-top:3px solid #d4af37;break-before:page;page-break-before:always}
.legenda{font-size:8px;color:#555;margin-top:5px}
.signatures{margin-top:32px;display:flex;justify-content:space-between;gap:40px;break-inside:avoid}
.signature{flex:1;border-top:1px solid #111;padding-top:8px;text-align:center}
@media screen{body{padding:24px;max-width:1400px;margin:auto}}
</style></head><body>
<div class="cabecalho">
  <img class="logo" src="${data.config?.companyImageUrl || data.config?.logoUrl || ARCD_LOGO}" alt="Logo"/>
  <div class="titulos">
    <h1>${escapeHtml(data.config?.companyName || "ArcD Obras")}</h1>
    ${data.config?.cnpj ? `<p>CNPJ: ${escapeHtml(data.config.cnpj)}</p>` : ""}
    <h2>${escapeHtml(titulo)}${subtitulo ? ` - ${escapeHtml(subtitulo)}` : ""}</h2>
    <div class="meta">${metaHtml}</div>
  </div>
</div>
${kpisHtml}
${legenda ? `<p class="legenda">${escapeHtml(legenda)}</p>` : ""}
${tabelasHtml}
${assinaturasHtml}
<p style="margin-top:${assinaturas.length ? 30 : 16}px;color:#999;font-size:9px">Gerado por ${escapeHtml(data.config?.companyName || "MARCELL")} em ${new Date().toLocaleString("pt-BR")}</p>
</body></html>`;
}


// Abre o HTML do relatório numa aba nova e já dispara a impressão - mesmo
// comportamento (e mesmo aviso de pop-up bloqueado) usado pela Folha.
export function abrirRelatorioPadrao(html, showToast) {
  const w = window.open("", "_blank");
  if (!w) { showToast?.("Não foi possível abrir a impressão. Permita pop-ups para este aplicativo e tente novamente.", "error"); return; }
  w.document.open(); w.document.write(marcellReportHtml(html)); w.document.close(); w.focus();
  window.setTimeout(() => w.print(), 300);
}
