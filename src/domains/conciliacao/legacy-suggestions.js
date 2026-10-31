// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { today, fmtDate } from "../../legacy/format.js";
import { suggestClassificationRule } from "./classification-rules.js";
import { statusRecebimentoMedicao } from "./index.js";
import { getPayrollHolidays } from "../ponto/attendance-engine";
import { isEmployeeEmployedOnDate } from "../ponto/attendance-engine";
import { prIsWeekdayIso } from "../ponto/attendance-engine";
import { getHolidayPayRule } from "../ponto/attendance-engine";
import { attStatus } from "../ponto/attendance-engine";
import { hasEmployeePixNameEvidence } from "./pix-card";
import { getQ } from "../ponto/attendance-engine";


export const semAcentoConc = (s) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();


// "1.234,56" → 1234.56
export const parseBRConc = (v) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  const n = Number(s.replace(/[()]/g,"").replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,""));
  if (isNaN(n)) return 0;
  return neg && n > 0 ? -n : n;
};


// parseOFX foi consolidado em src/domains/conciliacao/calculations.js em
// 25/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md) - existiam duas
// implementações divergentes (esta e uma cópia simplificada, nunca usada,
// dentro do próprio calculations.js), e a divergência escondia que a
// extração de contraparte por PIX nunca rodava de fato. Importado do
// domínio agora, no topo deste arquivo.

// Chave de deduplicação: FITID quando existe; senão, impressão digital da linha.
export const chaveTransacao = (t) =>
  t.fitid ? `fit:${t.fitid}`
          : `h:${t.data}|${Number(t.valor).toFixed(2)}|${String(t.descricao).slice(0,40).toLowerCase()}`;


// Soma dos rateios. O fechamento (soma == valor da transação, 1 centavo) é
// verificado no componente, que precisa exibir a diferença ao vivo.
export const somaRateios = (rateios) =>
  (rateios||[]).reduce((s,r) => s + Number(r.valor||0), 0);



export const sugerirRateio = suggestClassificationRule;


// Distância em dias entre duas datas ISO
export const diasEntre = (a, b) => {
  if (!a || !b) return 999;
  return Math.abs(Math.round(
    (new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 86400000
  ));
};


//  Casamento entrada bancária  medição em aberto
//
// Devolve CANDIDATAS pontuadas, nunca uma decisão. Duas medições de mesmo
// valor e mesmo vencimento empatam - é aí que o palpite automático erraria
// metade das vezes, e por isso quem escolhe é o usuário.
export const sugerirMedicoes = (tr, data) => {
  const v = Number(tr.valor || 0);
  if (v <= 0) return [];                       // só entrada quita medição
  const desc = semAcentoConc(tr.descricao);
  const cands = [];

  (data.medicoes || []).filter(m => statusRecebimentoMedicao(m)!=="recebida").forEach(m => {
    const obra = (data.obras || []).find(o => o.id === m.obraId);
    const prev = Number(m.valorPrevisto || 0);
    if (prev <= 0) return;

    let score = 0;
    const motivos = [];

    // Valor
    const dif = Math.abs(prev - v);
    if (dif < 0.01)               { score += 100; motivos.push("valor exato"); }
    else if (dif / prev <= 0.01)  { score += 60;  motivos.push("valor ~1%"); }
    else if (dif / prev <= 0.05)  { score += 30;  motivos.push("valor ~5%"); }
    else if (v < prev)            { score += 10;  motivos.push("pagamento parcial"); }
    else return;                                 // recebeu MAIS que o previsto → não é esta

    // Proximidade do vencimento
    const d = diasEntre(tr.data, m.dataVencimento);
    if (d <= 3)       { score += 40; motivos.push(`${d}d do vencimento`); }
    else if (d <= 10) { score += 25; motivos.push(`${d}d do vencimento`); }
    else if (d <= 30) { score += 8; }
    else              { score -= 15; }

    // Nome do cliente ou da obra citado no extrato
    const prim = (s) => semAcentoConc(s).split(" ")[0];
    if (obra?.engineer && prim(obra.engineer) && desc.includes(prim(obra.engineer))) {
      score += 30; motivos.push("cliente na descrição");
    }
    if (obra?.name && prim(obra.name) && desc.includes(prim(obra.name))) {
      score += 25; motivos.push("obra na descrição");
    }

    if (score >= 40) {
      cands.push({ m, obra, score, motivos, parcial: v < prev - 0.01, prev });
    }
  });

  return cands.sort((a, b) => b.score - a.score).slice(0, 3);
};


// ==============================================================
//  CONCILIACAO DE MAO DE OBRA
//  Dado um DEBITO no extrato (pagamento a operario), sugere de qual
//  funcionario e - casando por VALOR ESPERADO (dias trabalhados no
//  ponto x diaria) e por NOME. O nome pode ser o do proprio operario
//  OU o do titular do PIX (pixHolder): e comum o pagamento cair na
//  conta da esposa ou de um terceiro, e isso precisa ser conciliavel.
// ==============================================================

// Quanto um funcionario deveria receber num periodo, pelo PONTO.
// Soma diarias (P=1, M=0.5) + beneficios, exatamente como o DRE conta.
export const valorEsperadoPonto = (data, emp, days) => {
  let bruto = 0, beneficios = 0, diasP = 0, diasM = 0;
  const year = days[0] ? Number(days[0].slice(0, 4)) : new Date().getFullYear();
  const holidays = getPayrollHolidays(data, year);
  days.forEach(d => {
    if (!isEmployeeEmployedOnDate(emp, d)) return;
    if (holidays.includes(d) && prIsWeekdayIso(d)) {
      bruto += Number(getHolidayPayRule(data, emp, d, holidays).amount || 0);
      return;
    }
    const st = attStatus(data, emp.id, d);
    if (st === "P") { bruto += Number(emp.dailyRate || 0); beneficios += Number(emp.vtDaily || 0) + Number(emp.vrDaily || 0); diasP++; }
    else if (st === "M") { bruto += Number(emp.dailyRate || 0) * .5; beneficios += (Number(emp.vtDaily || 0) + Number(emp.vrDaily || 0)) * .5; diasM++; }
  });
  return { bruto, beneficios, total: bruto + beneficios, diasP, diasM };
};


// Sugere de qual funcionario e um debito do extrato.
// tr: transacao (valor negativo = saida). days: periodo de referencia (a
// quinzena/mes do pagamento). Devolve candidatos com score e o alerta de
// divergencia de valor (recebeu diferente do que o ponto diz).
export const sugerirPagamentoMaoObra = (tr, data, days) => {
  const saida = Math.abs(Number(tr.valor || 0));
  if (Number(tr.valor || 0) >= 0 || saida <= 0) return [];   // so debito
  const desc = semAcentoConc(tr.descricao);
  const prim = (s) => semAcentoConc(s || "").split(" ")[0];
  const cands = [];

  // Nao filtrar pelo status atual: o valor esperado elimina automaticamente
  // quem nao trabalhou no periodo historico consultado.
  (data.employees || []).forEach(emp => {
    const esp = valorEsperadoPonto(data, emp, days);
    const nomeOuTitularNoPix=hasEmployeePixNameEvidence(tr,emp);
    // Sem nome/titular, um valor igual ou um número na descrição não basta
    // para sugerir que um PIX foi pagamento de mão de obra.
    if(!nomeOuTitularNoPix)return;

    let score = 0;
    const motivos = [];

    // Valor: compara com o total esperado (e tambem so o bruto, caso paguem
    // beneficios a parte).
    const difTotal = Math.abs(esp.total - saida);
    const difBruto = Math.abs(esp.bruto - saida);
    const dif = Math.min(difTotal, difBruto);
    const base = difTotal <= difBruto ? esp.total : esp.bruto;
    if (dif < 0.01)              { score += 100; motivos.push("valor exato do ponto"); }
    else if (base && dif/base <= 0.02) { score += 60; motivos.push("valor ~2% do ponto"); }
    else if (base && dif/base <= 0.08) { score += 25; motivos.push("valor proximo do ponto"); }

    score += 45;
    motivos.push("nome ou titular PIX confirmado na descrição");
    // Chave PIX citada.
    if (emp.pixKey && desc.includes(semAcentoConc(emp.pixKey).slice(0, 8))) {
      score += 20; motivos.push("chave PIX na descricao");
    }

    if (score >= 40) {
      // Divergencia: pagou diferente do que o ponto diz que deveria.
      const divergencia = dif >= 0.01 ? saida - esp.total : 0;
      if(esp.total<=0)motivos.push("sem valor registrado no ponto para a quinzena");
      cands.push({
        emp, score, motivos,
        esperado: esp.total, esperadoBruto: esp.bruto, pago: saida,
        diasTrabalhados: esp.diasP + esp.diasM * 0.5,
        divergencia,
        pagoATerceiro: !!(emp.pixHolder && prim(emp.pixHolder) &&
                          desc.includes(prim(emp.pixHolder)) &&
                          !desc.includes(prim(emp.name || ""))),
      });
    }
  });

  return cands.sort((a, b) => b.score - a.score).slice(0, 3);
};


export const periodoPontoDaTransacao = (iso) => {
  const referencia=iso || today();
  const y = Number(referencia.slice(0, 4)), m = Number(referencia.slice(5, 7)) - 1;
  const dia = Number(referencia.slice(8, 10));
  const { q1, q2 } = getQ(y, m);
  // Pagamentos no início do mês normalmente referem-se à segunda quinzena
  // anterior; nos demais casos, à quinzena corrente.
  const days=dia <= 7
    ? getQ(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1).q2
    : dia <= 20 ? q1 : q2;
  return {
    days,
    periodoPonto:days.length ? `${fmtDate(days[0])} a ${fmtDate(days[days.length-1])}` : "",
  };
};
