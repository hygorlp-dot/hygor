// ===================================================================
// FolhaView — tela de Folha de pagamento extraída de LegacyApp.jsx
//
// Extraído verbatim (mesmo corpo, mesma lógica) de src/LegacyApp.jsx em
// 2026-08-16, seguindo o mesmo padrão dos módulos anteriores. Mesma
// camada de dados, sem nova migration/RLS. Ver
// docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #8.
// ===================================================================

import { useEffect, useMemo, useState } from "react";
import {
  Btn, C, Ic, Inp, Modal, PageHero, Sel, XLSX,
  carregarXLSX, escapeHtml, fmt, fmtDate, fmtDateFull, today, uid,
} from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import {
  getAtt, getDays, getHolidayPayRule, getPayrollHolidays,
  getPayrollPaymentCalendar, getQ, isEmployeeEmployedOnDate,
  prIsWeekdayIso, prUniqueDates, toLocalISODate,
} from "../attendance-engine";
import { calculateAttendanceDayCost } from "../payroll";
import { splitPayrollResponsibility } from "../payroll-responsibility";
import {
  allocateUnionDueByWork, calculatePayrollSettlement, calculateUnionDue,
  normalizeRoleKey, normalizeUnionDuesConfig, summarizeUnionDues, UNION_DUE_GROUP,
} from "../union-dues";
import { advanceDeductionForPeriod } from "../../rh/advance-commands";

function Folha({ data, showToast, onTab, currentUser, dispatchCommand }) {
  const now = new Date();
  const refInicial = now.getDate() <= 5 ? new Date(now.getFullYear(), now.getMonth()-1, 1) : now;
  const [year, setYear] = useState(refInicial.getFullYear());
  const [month, setMonth] = useState(refInicial.getMonth());
  const [q, setQ] = useState(now.getDate() >= 6 && now.getDate() <= 20 ? "1" : "2");
  const [filterObra, setFilterObra] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [relatorioPendente, setRelatorioPendente] = useState("");
  const [payrollView,setPayrollView]=useState("payroll");
  const [unionDraft,setUnionDraft]=useState(()=>normalizeUnionDuesConfig(data.config?.unionDues));
  const [savingUnion,setSavingUnion]=useState(false);
  useEffect(()=>setUnionDraft(normalizeUnionDuesConfig(data.config?.unionDues)),[data.config?.unionDues]);

  const { q1, q2 } = useMemo(() => getQ(year, month), [year, month]);
  // Folha e espelho diario seguem a mesma grade da gestao: segunda a sexta.
  // Isso impede sabados e domingos de virarem "sem registro".
  // diasCiclo/days/holidaysInPeriod ficam memoizados com referencia estavel
  // entre renders (nao so o valor) - "rows" mais abaixo depende deles, e sem
  // isso o array seria recriado a cada render e a memoizacao de "rows" nunca
  // "bateria" (deps sempre "diferentes" mesmo com o mesmo conteudo).
  const diasCiclo = useMemo(() => q === "1" ? q1 : q2, [q, q1, q2]);
  const days = useMemo(() => diasCiclo.filter(prIsWeekdayIso), [diasCiclo]);
  const paymentHolidays = useMemo(() =>
    prUniqueDates([...new Set(diasCiclo.map(d=>Number(d.slice(0,4))))].flatMap(ano=>getPayrollHolidays(data,ano))),
    [diasCiclo, data.config?.paymentHolidays]);
  const holidaysInPeriod = useMemo(() =>
    days.filter(d => paymentHolidays.includes(d) && prIsWeekdayIso(d)),
    [days, paymentHolidays]);
  const paymentInfo = getPayrollPaymentCalendar(year, month, q, data);
  const paymentDateLabel = fmtDateFull(paymentInfo.paymentDate);
  const paymentBaseLabel = fmtDateFull(paymentInfo.baseDate);
  const paymentObs = paymentInfo.adjusted ? `Ajustado de ${paymentBaseLabel} para ${paymentDateLabel}` : "Data normal de pagamento";
  const obraName = id => data.obras.find(o => o.id === id)?.name || "-";
  const periodLabel = `${q === "1" ? "1ª" : "2ª"} Quinzena de ${fullMonth(month)} ${year}`;

  //  Reconstrói a obra do operário em uma data específica via changeLog 
  const getEmpObraIdOnDate = (employee, dateIso) => {
    const transfers = (data.changeLog || [])
      .filter(t => t.type === "transfer" && t.empId === employee.id && t.date)
      .sort((a, b) => b.date.localeCompare(a.date)); // desc - mais recente primeiro

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
    let overtimePay = 0;
    let vt = 0;
    let vr = 0;
    // Mapa por obra efetivamente registrada no ponto. Alem dos dias, guarda
    // os valores que podem ser atribuidos com seguranca a cada canteiro.
    const obrasPorDia = {};

    const addToObra = (obraId, tipo, valores = {}) => {
      const chave = obraId || "__sem_obra__";
      if (!obrasPorDia[chave]) obrasPorDia[chave] = {
        obraId: obraId || "", presentes: 0, meiodia: 0, faltas: 0,
        semRegistro: 0, feriadosPagos: 0, feriadosPerdidos: 0,
        valorDias: 0, valorFeriados: 0, overtimePay:0, vt: 0, vr: 0, ot: 0,
      };
      const o = obrasPorDia[chave];
      if (tipo === "P") o.presentes++;
      else if (tipo === "M") o.meiodia++;
      else if (tipo === "F") o.faltas++;
      else if (tipo === "S") o.semRegistro++;
      else if (tipo === "HP") o.feriadosPagos++;
      else if (tipo === "HD") o.feriadosPerdidos++;
      o.valorDias += Number(valores.valorDias || 0);
      o.valorFeriados += Number(valores.valorFeriados || 0);
      o.overtimePay += Number(valores.overtimePay || 0);
      o.vt += Number(valores.vt || 0);
      o.vr += Number(valores.vr || 0);
      o.ot += Number(valores.ot || 0);
    };

    days.forEach(d => {
      if (!isEmployeeEmployedOnDate(employee, d)) return;
      if (holidaysInPeriod.includes(d)) return;

      const a = getAtt(data, employee.id, d);
      const st = a?.status;
      const extra = Number(a?.ot || 0);
      // Registro novo: usa a obra carimbada no proprio ponto. Registro antigo:
      // reconstrucao por lotacao/transferencia preserva o historico.
      const obraId = a?.obraId || getEmpObraIdOnDate(employee, d);

      if (st === "P") {
        const custo=calculateAttendanceDayCost({employee,record:a,config:data.config});
        gross += custo.laborCost;
        overtimePay += custo.overtimePay;
        presentes++;
        ot += extra;
        vt += Number(employee.vtDaily || 0);
        vr += Number(employee.vrDaily || 0);
        addToObra(obraId, "P", { valorDias:custo.basePay-custo.delayDeduction, overtimePay:custo.overtimePay,
          vt:Number(employee.vtDaily||0), vr:Number(employee.vrDaily||0), ot:extra });
      } else if (st === "M") {
        const custo=calculateAttendanceDayCost({employee,record:a,config:data.config});
        gross += custo.laborCost;
        overtimePay += custo.overtimePay;
        meiodia++;
        ot += extra;
        vt += Number(employee.vtDaily || 0) * 0.5;
        vr += Number(employee.vrDaily || 0) * 0.5;
        addToObra(obraId, "M", { valorDias:custo.basePay-custo.delayDeduction, overtimePay:custo.overtimePay,
          vt:Number(employee.vtDaily||0)*0.5, vr:Number(employee.vrDaily||0)*0.5, ot:extra });
      } else if (st === "F") {
        faltas++;
        addToObra(obraId, "F");
      } else {
        semRegistro++;
        addToObra(obraId, "S");
      }
    });

    const employeeHolidays = holidaysInPeriod.filter(h => isEmployeeEmployedOnDate(employee, h));
    const holidayRules = employeeHolidays.map(h => getHolidayPayRule(data, employee, h, paymentHolidays));
    const feriadosPagos = holidayRules.filter(h => !h.losesHoliday).length;
    const feriadosPerdidos = holidayRules.filter(h => h.losesHoliday).length;
    const holidayPay = holidayRules.reduce((s, h) => s + h.amount, 0);
    gross += holidayPay;
    holidayRules.forEach(h => {
      const obraId = getEmpObraIdOnDate(employee, h.holidayIso);
      addToObra(obraId, h.losesHoliday ? "HD" : "HP", {
        valorFeriados: Number(h.amount || 0),
      });
    });

    const periIni = diasCiclo.length > 0 ? diasCiclo[0] : "";
    const periFim = diasCiclo.length > 0 ? diasCiclo[diasCiclo.length - 1] : "";
    const advTotal = (data.advances||[])
      .filter(a => a.empId === employee.id)
      .reduce((sum,advance)=>sum+advanceDeductionForPeriod(advance,periIni,periFim),0);
    const unionResult=calculateUnionDue({employee,config:data.config?.unionDues,payrollCycle:q,periodEnd:periFim,hasPayrollMovement:gross>0||advTotal>0});

    // Converte mapa para array ordenado por dias trabalhados desc
    const obrasPorDiaArr = Object.values(obrasPorDia)
      .map(v => ({
        ...v,
        obraName: data.obras.find(o => o.id === v.obraId)?.name || "Sem obra identificada",
        // Dia trabalhado equivalente: meio periodo vale 0,5; falta nao conta.
        diasTrabalhados: v.presentes + (v.meiodia * 0.5),
        totalRegistros: v.presentes + v.meiodia + v.faltas,
        bruto: v.valorDias + v.valorFeriados + v.overtimePay,
        custoDireto: v.valorDias + v.valorFeriados + v.overtimePay + v.vt + v.vr,
      }))
      .sort((a, b) => b.diasTrabalhados - a.diasTrabalhados || a.obraName.localeCompare(b.obraName));

    // Rateio do adiantamento entre as obras, proporcional aos dias trabalhados
    // em cada uma. O adiantamento e do funcionario no periodo, nao de uma obra
    // especifica; ao filtrar por obra, cada canteiro absorve a parcela que lhe
    // cabe para o liquido por obra fechar com o liquido total.
    const totalDiasFunc = obrasPorDiaArr.reduce((s, o) => s + o.diasTrabalhados, 0);
    obrasPorDiaArr.forEach((o, i) => {
      // bruto da obra + VT/VR da obra - parcela do adiantamento
      let advObra;
      if (totalDiasFunc > 0) {
        advObra = advTotal * (o.diasTrabalhados / totalDiasFunc);
      } else {
        advObra = i === 0 ? advTotal : 0;   // sem dias: joga tudo na primeira
      }
      o.advancesObra = advObra;
      o.netObra = o.bruto + o.vt + o.vr - advObra;
    });
    // Ajuste de arredondamento: garante que a soma dos liquidos por obra
    // seja exatamente o liquido do funcionario (evita centavos perdidos).
    const somaNetObras = obrasPorDiaArr.reduce((s, o) => s + o.netObra, 0);
    const settlement=calculatePayrollSettlement({gross,benefits:vt+vr,advances:advTotal,unionDue:unionResult.amount});
    const netBeforeUnion = settlement.netBeforeUnion;
    if (obrasPorDiaArr.length && Math.abs(somaNetObras - netBeforeUnion) > 0.001) {
      obrasPorDiaArr[0].netObra += (netBeforeUnion - somaNetObras);
    }
    const obrasLiquidas=allocateUnionDueByWork(obrasPorDiaArr,settlement.appliedUnionDue);

    return {
      ...employee,
      gross,
      presentes,
      meiodia,
      faltas,
      semRegistro,
      ot,
      overtimePay,
      vt,
      vr,
      feriadosPagos,
      feriadosPerdidos,
      holidayPay,
      holidayRules,
      advances: advTotal,
      unionDue:settlement.appliedUnionDue,
      requestedUnionDue:settlement.requestedUnionDue,
      unionDueGroup:unionResult.group,
      netBeforeUnion,
      net: settlement.netPayable,
      days: days.length,
      obrasPorDia: obrasLiquidas,
    };
  };

  const hasAttendanceInPeriod = e => days.some(d => {
    const a = getAtt(data, e.id, d);
    return a?.status || a?.ot || a?.note;
  });

  const belongsToSelectedObra = e => {
    if (filterObra === "all") return true;
    return days.some(d => {
      if (!isEmployeeEmployedOnDate(e, d)) return false;
      const a = getAtt(data, e.id, d);
      const temLancamento = !!a?.status || holidaysInPeriod.includes(d);
      const obraDoDia = a?.obraId || getEmpObraIdOnDate(e, d);
      return temLancamento && obraDoDia === filterObra;
    });
  };

  // "rows" roda calcRow (soma dia a dia do periodo) por funcionario - o
  // calculo mais caro da tela. Sem useMemo, refazia tudo a cada render (ex.:
  // digitar em qualquer campo de um modal aberto por cima da folha).
  const rows = useMemo(() => data.employees
    .filter(belongsToSelectedObra)
    .filter(e => e.active !== false || hasAttendanceInPeriod(e))
    .map(calcRow)
    .filter(r => r.presentes > 0 || r.meiodia > 0 || r.faltas > 0 || r.feriadosPagos > 0 || r.feriadosPerdidos > 0 || r.advances > 0 || r.gross > 0)
    .sort((a, b) => a.name.localeCompare(b.name)),
    [data.employees, data.attendance, data.changeLog, data.obras, data.advances, data.config?.unionDues, days, holidaysInPeriod, filterObra, q]);

  // Valores EFETIVOS de uma linha conforme o filtro de obra. Com "all", usa os
  // totais do funcionario. Com uma obra selecionada, usa apenas a parcela
  // daquela obra (bruto, VT, VR, adiantamento rateado e liquido por obra) - e
  // ai o Total Liquido fecha pela OBRA, nao pela equipe toda.
  const valEfetivos = (r) => {
    if (filterObra === "all") {
      return { gross:r.gross, overtimePay:r.overtimePay, vt:r.vt, vr:r.vr, advances:r.advances, unionDue:r.unionDue, netBeforeUnion:r.netBeforeUnion, net:r.net,
               presentes:r.presentes, meiodia:r.meiodia, faltas:r.faltas,
               semRegistro:r.semRegistro, feriadosPagos:r.feriadosPagos,
               feriadosPerdidos:r.feriadosPerdidos, holidayPay:r.holidayPay };
    }
    const o = (r.obrasPorDia || []).find(x => x.obraId === filterObra);
    if (!o) return { gross:0, overtimePay:0, vt:0, vr:0, advances:0, unionDue:0, netBeforeUnion:0, net:0, presentes:0, meiodia:0,
                     faltas:0, semRegistro:0, feriadosPagos:0, feriadosPerdidos:0, holidayPay:0 };
    return {
      gross: o.bruto, overtimePay:o.overtimePay, vt: o.vt, vr: o.vr, advances: o.advancesObra, unionDue:o.unionDueObra||0, netBeforeUnion:o.netBeforeUnionObra||o.netObra, net:o.netObra,
      presentes: o.presentes, meiodia: o.meiodia, faltas: o.faltas,
      semRegistro: o.semRegistro, feriadosPagos: o.feriadosPagos,
      feriadosPerdidos: o.feriadosPerdidos, holidayPay: o.valorFeriados,
    };
  };

  // Conferencia previa do relatorio. A validacao usa todos os funcionarios
  // vinculados ao periodo/obra, inclusive quem ainda nao aparece na folha por
  // nao possuir nenhum apontamento.
  const funcionariosParaConferencia = useMemo(() => (data.employees || [])
    .filter(e => days.some(d => isEmployeeEmployedOnDate(e, d)))
    .filter(e => e.active !== false || hasAttendanceInPeriod(e) || (e.endDate && e.endDate >= (days[0] || "")))
    .filter(e => filterObra === "all" || e.obra === filterObra || e.lastObra === filterObra || days.some(d => {
      if (!isEmployeeEmployedOnDate(e, d)) return false;
      const a = getAtt(data, e.id, d);
      return (a?.obraId || getEmpObraIdOnDate(e, d)) === filterObra;
    }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [data.employees, data.attendance, data.changeLog, data.obras, days, filterObra]);

  const hojeConferencia = today();
  const pendenciasRelatorio = useMemo(() => funcionariosParaConferencia.map(e => {
    const datasEsperadas = days.filter(d => {
      if (d > hojeConferencia || !isEmployeeEmployedOnDate(e, d) || holidaysInPeriod.includes(d)) return false;
      if (filterObra === "all") return true;
      const a = getAtt(data, e.id, d);
      return (a?.obraId || getEmpObraIdOnDate(e, d)) === filterObra;
    });
    const semRegistro = datasEsperadas.filter(d => !["P", "M", "F"].includes(getAtt(data, e.id, d)?.status));
    const temObraNoPeriodo = datasEsperadas.some(d => {
      const a = getAtt(data, e.id, d);
      return !!(a?.obraId || getEmpObraIdOnDate(e, d));
    });
    const campos = [];
    if (!String(e.pixKey || "").trim()) campos.push("PIX");
    if (!temObraNoPeriodo && !e.obra && !e.lastObra) campos.push("obra");
    if (!(Number(e.dailyRate || 0) > 0)) campos.push("valor da diaria");
    return {
      id: e.id,
      nome: e.name || "Funcionario sem nome",
      semRegistro,
      nenhumRegistro: datasEsperadas.length > 0 && semRegistro.length === datasEsperadas.length,
      campos,
    };
  }).filter(p => p.semRegistro.length > 0 || p.campos.length > 0),
    [funcionariosParaConferencia, data.attendance, data.changeLog, data.obras, days, holidaysInPeriod, filterObra, hojeConferencia]);

  const totalDiasSemRegistro = pendenciasRelatorio.reduce((s, p) => s + p.semRegistro.length, 0);
  const totalSemPix = pendenciasRelatorio.filter(p => p.campos.includes("PIX")).length;

  const T = {
    gross: rows.reduce((s, r) => s + valEfetivos(r).gross, 0),
    overtimePay: rows.reduce((s, r) => s + valEfetivos(r).overtimePay, 0),
    vt: rows.reduce((s, r) => s + valEfetivos(r).vt, 0),
    vr: rows.reduce((s, r) => s + valEfetivos(r).vr, 0),
    advances: rows.reduce((s, r) => s + valEfetivos(r).advances, 0),
    unionDue: rows.reduce((s, r) => s + valEfetivos(r).unionDue, 0),
    net: rows.reduce((s, r) => s + valEfetivos(r).net, 0),
    holidayPay: rows.reduce((s, r) => s + valEfetivos(r).holidayPay, 0),
    feriadosPagos: rows.reduce((s, r) => s + valEfetivos(r).feriadosPagos, 0),
    feriadosPerdidos: rows.reduce((s, r) => s + valEfetivos(r).feriadosPerdidos, 0),
  };
  const unionSummary=summarizeUnionDues(rows.map(r=>{
    const result=calculateUnionDue({employee:r,config:unionDraft,payrollCycle:q,periodEnd:diasCiclo.at(-1)||"",hasPayrollMovement:r.gross>0||r.advances>0});
    const settlement=calculatePayrollSettlement({gross:r.gross,benefits:r.vt+r.vr,advances:r.advances,unionDue:result.amount});
    return {...r,unionDue:filterObra==="all"?settlement.appliedUnionDue:0,unionDueGroup:result.group};
  }));
  const roleCatalog=useMemo(()=>[...new Set((data.employees||[]).map(e=>String(e.role||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),[data.employees]);
  const saveUnionConfig=async()=>{
    if(unionDraft.enabled&&!unionDraft.effectiveFrom){showToast("Informe a vigência inicial para proteger folhas anteriores.","error");return;}
    setSavingUnion(true);
    try{
      const config=normalizeUnionDuesConfig({...unionDraft,updatedAt:new Date().toISOString(),updatedBy:currentUser?.name||currentUser?.email||"Usuário"});
      const result=await dispatchCommand(atual=>({
        type:OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED,
        idempotencyKey:`configuracao-sindicato-${uid()}`,
        expectedVersion:Number(atual.config?.version||0),
        payload:{config:{...atual.config,unionDues:config}},
      }));
      if(!result?.ok)throw new Error(result?.reason||"O servidor não confirmou a configuração sindical.");
      showToast("Configuração sindical salva e aplicada à folha.");
    }catch(error){showToast(error?.message||"Não foi possível salvar a configuração sindical.","error");}
    finally{setSavingUnion(false);}
  };

  // Linhas consolidadas: uma combinacao unica de funcionario + obra. Este e
  // o numero que responde quantos dias a pessoa efetivamente trabalhou em
  // cada canteiro, sem contar faltas e ponderando meio periodo como 0,5.
  const detalheObraFuncionario = rows.flatMap(r =>
    r.obrasPorDia
      .filter(o => filterObra === "all" || o.obraId === filterObra)
      .map(o => ({
        empId:r.id, funcionario:r.name, cargo:r.role || "", diaria:Number(r.dailyRate || 0),
        ...o,
      }))
  ).sort((a,b) => a.obraName.localeCompare(b.obraName) || a.funcionario.localeCompare(b.funcionario));

  // Responsabilidade financeira segue o contrato da obra efetivamente
  // carimbada no ponto, não apenas a lotação atual do funcionário. Somente
  // admin_only é pago/reembolsado pela obra; contratos fixos, mistos,
  // administrativo e apontamentos sem obra permanecem com a construtora.
  const responsabilidadeFolha=splitPayrollResponsibility({
    allocations:detalheObraFuncionario,
    works:data.obras||[],
  });

  // Resumo gerencial por obra, calculado a partir do mesmo detalhamento.
  const resumoPorObraMap = new Map();
  detalheObraFuncionario.forEach(l => {
    if (!resumoPorObraMap.has(l.obraId)) resumoPorObraMap.set(l.obraId, {
      obraId:l.obraId, obraName:l.obraName, funcionarios:new Set(), presentes:0,
      meiodia:0, diasTrabalhados:0, faltas:0, semRegistro:0, feriadosPagos:0,
      feriadosPerdidos:0, valorDias:0, valorFeriados:0, ot:0, vt:0, vr:0,
      overtimePay:0,
      bruto:0, custoDireto:0,
    });
    const o = resumoPorObraMap.get(l.obraId);
    if (l.diasTrabalhados > 0 || l.feriadosPagos > 0) o.funcionarios.add(l.empId);
    ["presentes","meiodia","diasTrabalhados","faltas","semRegistro","feriadosPagos",
     "feriadosPerdidos","valorDias","valorFeriados","overtimePay","ot","vt","vr","bruto","custoDireto"]
      .forEach(k => { o[k] += Number(l[k] || 0); });
  });
  const resumoPorObra = [...resumoPorObraMap.values()]
    .map(o => ({...o, funcionarios:o.funcionarios.size}))
    .sort((a,b) => a.obraName.localeCompare(b.obraName));

  // Espelho diario auditavel. Inclui sem registro e feriados para que o total
  // consolidado possa ser conferido data a data no Excel.
  const pontoDiario = rows.flatMap(r => days.map(d => {
    if (!isEmployeeEmployedOnDate(r, d)) return null;
    const feriado = holidaysInPeriod.includes(d);
    const regraFer = feriado ? (r.holidayRules || []).find(h => h.holidayIso === d) : null;
    const a = feriado ? null : getAtt(data, r.id, d);
    const obraId = a?.obraId || getEmpObraIdOnDate(r, d);
    if (filterObra !== "all" && obraId !== filterObra) return null;
    const st = feriado ? (regraFer?.losesHoliday ? "Feriado perdido" : "Feriado pago")
      : a?.status === "P" ? "Presente" : a?.status === "M" ? "Meio periodo"
      : a?.status === "F" ? "Falta" : "Sem registro";
    const equivalente = a?.status === "P" ? 1 : a?.status === "M" ? 0.5 : 0;
    const custoDia=feriado?null:calculateAttendanceDayCost({employee:r,record:a,config:data.config});
    const valorDia = feriado ? Number(regraFer?.amount || 0) : Number(custoDia?.laborCost || 0);
    const valorVT = feriado ? 0 : Number(r.vtDaily || 0) * equivalente;
    const valorVR = feriado ? 0 : Number(r.vrDaily || 0) * equivalente;
    return {
      data:d, diaSemana:["Domingo","Segunda","Terca","Quarta","Quinta","Sexta","Sabado"][new Date(d+"T00:00:00").getDay()],
      funcionario:r.name, cargo:r.role || "", obraId,
      obraName:data.obras.find(o => o.id === obraId)?.name || "Sem obra identificada",
      status:st, equivalente, ot:Number(a?.ot || 0), diaria:Number(r.dailyRate || 0),
      valorDia, vt:valorVT, vr:valorVR, totalDia:valorDia+valorVT+valorVR,
      observacao:a?.note || "",
    };
  }).filter(Boolean)).sort((a,b) => a.data.localeCompare(b.data) || a.obraName.localeCompare(b.obraName) || a.funcionario.localeCompare(b.funcionario));

  const printPDF = () => {
    // Monta a tabela de detalhe por obra para o PDF
    const detalheRows = detalheObraFuncionario.map(l =>
      `<tr><td>${escapeHtml(l.obraName)}</td><td>${escapeHtml(l.funcionario)}</td>`+
      `<td>${escapeHtml(l.cargo || "-")}</td><td>${l.presentes}</td><td>${l.meiodia}</td>`+
      `<td><b>${l.diasTrabalhados.toFixed(1).replace(".",",")}</b></td><td>${l.faltas}</td>`+
      `<td>${l.semRegistro}</td><td>${l.feriadosPagos}</td><td class="num">${escapeHtml(fmt(l.bruto))}</td></tr>`
    );

    const linhasFolha = rows.length ? rows.map(r => { const v = valEfetivos(r); return `
      <tr>
        <td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.role || "-")}</td><td>${escapeHtml(filterObra === "all" ? obraName(r.obra) : obraName(filterObra))}</td>
        <td class="num">${v.presentes}</td><td class="num">${v.meiodia}</td><td class="num"><b>${(v.presentes + v.meiodia * 0.5).toFixed(1).replace(".", ",")}</b></td>
        <td class="num">${v.faltas}</td><td class="num">${v.semRegistro}</td><td class="num">${v.feriadosPagos}</td><td class="num">${v.feriadosPerdidos}</td>
        <td class="num">${escapeHtml(fmt(v.holidayPay))}</td><td class="num">${r.ot || 0}h</td><td class="num">${escapeHtml(fmt(Number(r.dailyRate || 0)))}</td>
        <td class="num">${escapeHtml(fmt(v.gross))}</td><td class="num">${escapeHtml(fmt(v.vt))}</td><td class="num">${escapeHtml(fmt(v.vr))}</td><td class="num">${escapeHtml(fmt(v.advances))}</td><td class="num">${escapeHtml(fmt(v.unionDue))}</td><td class="num"><b>${escapeHtml(fmt(v.net))}</b></td>
      </tr>`; }).join("") : `<tr><td colspan="19" class="vazio">Nenhum lançamento encontrado para o período selecionado.</td></tr>`;

    const linhasResponsabilidade = lista => lista.map(l=>`<tr>
      <td>${escapeHtml(l.obraName)}</td><td>${escapeHtml(l.funcionario)}</td><td>${escapeHtml(l.cargo||"-")}</td>
      <td class="num">${l.diasTrabalhados.toFixed(1).replace(".",",")}</td>
      <td class="num">${escapeHtml(fmt(l.bruto))}</td><td class="num">${escapeHtml(fmt(l.vt+l.vr))}</td>
      <td class="num">${escapeHtml(fmt(l.advancesObra))}</td><td class="num">${escapeHtml(fmt(l.unionDueObra||0))}</td><td class="num"><b>${escapeHtml(fmt(l.netObra))}</b></td>
    </tr>`).join("");

    const html = `<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Folha - ${escapeHtml(periodLabel)}</title>
          <style>
            @page{size:A4 landscape;margin:10mm}
            *{box-sizing:border-box}
            body{font-family:Arial,sans-serif;margin:0;color:#111;font-size:10px}
            h1,h2,h3{margin:0 0 8px 0}
            p{margin:4px 0}
            .cabecalho{border-bottom:3px solid #d4af37;padding-bottom:10px;margin-bottom:10px}
            .meta{display:flex;gap:18px;flex-wrap:wrap;color:#333}
            .kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin:10px 0}
            .kpi{border:1px solid #bbb;border-top:3px solid #d4af37;padding:7px;background:#fafafa}
            .kpi span{display:block;font-size:8px;text-transform:uppercase;color:#666;font-weight:bold}
            .kpi b{display:block;font-size:14px;margin-top:2px}
            table{width:100%;border-collapse:collapse;margin-top:8px;font-size:8px;table-layout:auto}
            thead{display:table-header-group}
            tfoot{display:table-footer-group}
            tr{break-inside:avoid;page-break-inside:avoid}
            th,td{border:1px solid #aaa;padding:4px;text-align:left;vertical-align:middle}
            th{background:#e8e8e8;font-size:7.5px;text-transform:uppercase;white-space:nowrap}
            td.num{text-align:right;white-space:nowrap}
            .total{font-weight:bold;background:#fff8d6}
            .vazio{text-align:center;padding:16px;color:#666;font-style:italic}
            .section{margin-top:18px;padding-top:10px;border-top:3px solid #d4af37;break-before:page;page-break-before:always}
            .legenda{font-size:8px;color:#555;margin-top:5px}
            .signatures{margin-top:32px;display:flex;justify-content:space-between;gap:40px;break-inside:avoid}
            .signature{flex:1;border-top:1px solid #111;padding-top:8px;text-align:center}
            @media screen{body{padding:24px;max-width:1400px;margin:auto}}
          </style>
        </head>
        <body>
          <div class="cabecalho">
            <h1>${escapeHtml(data.config.companyName || "ArcD Obras")}</h1>
            ${data.config.cnpj ? `<p>CNPJ: ${escapeHtml(data.config.cnpj)}</p>` : ""}
            <h2>Folha de Pagamento - ${escapeHtml(periodLabel)}</h2>
            <div class="meta">
              <p><strong>Período:</strong> ${escapeHtml(fmtDateFull(days[0]))} a ${escapeHtml(fmtDateFull(days[days.length-1]))}</p>
              <p><strong>Pagamento:</strong> ${escapeHtml(paymentDateLabel)}</p>
              <p><strong>Regra:</strong> ${escapeHtml(paymentObs)}</p>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi"><span>Funcionários</span><b>${rows.length}</b></div>
            <div class="kpi"><span>Dias trabalhados</span><b>${rows.reduce((s,r)=>s+r.presentes+r.meiodia*0.5,0).toFixed(1).replace(".",",")}</b></div>
            <div class="kpi"><span>Total bruto</span><b>${escapeHtml(fmt(T.gross))}</b></div>
            <div class="kpi"><span>Líquido a pagar aos funcionários</span><b>${escapeHtml(fmt(T.net))}</b></div>
            <div class="kpi"><span>Obras de administração</span><b>${escapeHtml(fmt(responsabilidadeFolha.totals.administrationWorks))}</b></div>
            <div class="kpi"><span>Construtora</span><b>${escapeHtml(fmt(responsabilidadeFolha.totals.builder))}</b></div>
          </div>
          <p class="legenda">P = presença integral · M = meio período · F = falta · S/R = sem registro · FP = feriado pago · FD = feriado perdido</p>

          <!-- Tabela principal -->
          <table>
            <thead>
              <tr>
                <th>Funcionário</th><th>Cargo</th><th>Obra Atual</th><th>P</th><th>M</th><th>Dias Trab.</th><th>F</th><th>S/R</th><th>FP</th><th>FD</th><th>Valor Feriado</th><th>HE</th><th>Diária</th><th>Bruto</th><th>VT</th><th>VR</th><th>Adiant.</th><th>Sindicato</th><th>Líquido</th>
              </tr>
            </thead>
            <tbody>
              ${linhasFolha}
            </tbody>
            <tfoot>
              <tr class="total"><td colspan="13">TOTAL - ${rows.length} funcionário(s)</td><td class="num">${escapeHtml(fmt(T.gross))}</td><td class="num">${escapeHtml(fmt(T.vt))}</td><td class="num">${escapeHtml(fmt(T.vr))}</td><td class="num">${escapeHtml(fmt(T.advances))}</td><td class="num">${escapeHtml(fmt(T.unionDue))}</td><td class="num">${escapeHtml(fmt(T.net))}</td></tr>
            </tfoot>
          </table>

          <div class="section">
            <h3>Valores a pagar pelas obras de administração</h3>
            <p style="font-size:11px;color:#555">Somente parcelas alocadas por ponto em obras do tipo “Somente Administração”.</p>
            <table><thead><tr><th>Obra</th><th>Funcionário</th><th>Cargo</th><th>Dias</th><th>Bruto</th><th>VT + VR</th><th>Adiant.</th><th>Sindicato</th><th>Líquido a pagar</th></tr></thead>
              <tbody>${linhasResponsabilidade(responsabilidadeFolha.administrationWorks)||`<tr><td colspan="9" class="vazio">Nenhum valor de folha atribuído a obras de administração.</td></tr>`}</tbody>
              <tfoot><tr class="total"><td colspan="8">TOTAL DAS OBRAS DE ADMINISTRAÇÃO</td><td class="num">${escapeHtml(fmt(responsabilidadeFolha.totals.administrationWorks))}</td></tr></tfoot>
            </table>
          </div>

          <div class="section">
            <h3>Valores a pagar pela construtora</h3>
            <p style="font-size:11px;color:#555">Contratos fixos ou mistos, equipe administrativa e apontamentos sem obra identificada.</p>
            <table><thead><tr><th>Obra / centro</th><th>Funcionário</th><th>Cargo</th><th>Dias</th><th>Bruto</th><th>VT + VR</th><th>Adiant.</th><th>Sindicato</th><th>Líquido a pagar</th></tr></thead>
              <tbody>${linhasResponsabilidade(responsabilidadeFolha.builder)||`<tr><td colspan="9" class="vazio">Nenhum valor atribuído diretamente à construtora.</td></tr>`}</tbody>
              <tfoot><tr class="total"><td colspan="8">TOTAL DA CONSTRUTORA</td><td class="num">${escapeHtml(fmt(responsabilidadeFolha.totals.builder))}</td></tr></tfoot>
            </table>
          </div>

          <!-- Tabela de detalhe por obra -->
          <div class="section">
            <h3>Detalhe de Dias Trabalhados por Obra</h3>
            <p style="font-size:11px;color:#555">Período: ${escapeHtml(fmtDateFull(days[0]))} a ${escapeHtml(fmtDateFull(days[days.length - 1]))}</p>
            <table>
              <thead>
                <tr>
                  <th>Obra</th><th>Funcionário</th><th>Cargo</th><th>Presentes</th><th>Meio Dia</th><th>Dias Trabalhados</th><th>Faltas</th><th>Sem Registro</th><th>Feriados Pagos</th><th>Bruto Alocado</th>
                </tr>
              </thead>
              <tbody>
                ${detalheRows.join("") || `<tr><td colspan="10" class="vazio">Nenhum apontamento por obra encontrado para o período selecionado.</td></tr>`}
              </tbody>
            </table>
          </div>

          <div class="signatures"><div class="signature">Responsável RH: ${escapeHtml(data.config.hrName || "_______________________")}</div><div class="signature">Aprovado por</div></div>
          <p style="margin-top:30px;">Data: ___/___/_____</p>
        </body>
      </html>
    `;
    const w = window.open("", "_blank");
    if (!w) {
      showToast("Não foi possível abrir a impressão. Permita pop-ups para este aplicativo e tente novamente.", "error");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    window.setTimeout(() => w.print(), 300);
  };

  // Exportacao tecnica: folha financeira + consolidacao por obra +
  // funcionario/obra + espelho diario. Mantemos os valores numericos para que
  // o operador possa somar, filtrar e montar tabelas dinamicas no Excel.
  const exportXLSDetalhado = async () => {
    await carregarXLSX();
    const wb = XLSX.utils.book_new();

    const header1 = ["Funcionário", "Cargo", "Obra Atual", "Pres.", "Meio Dia", "Dias Trabalhados",
      "Faltas", "Sem Registro", "Feriados Pagos", "Feriados Perdidos", "Valor Feriado",
      "HE", "Diária", "Bruto", "VT", "VR", "Adiant.", "Sindicato", "Líquido"];
    const body1 = rows.map(r => { const v = valEfetivos(r); return [r.name, r.role || "", filterObra === "all" ? obraName(r.obra) : obraName(filterObra), v.presentes, v.meiodia,
      (v.presentes + v.meiodia*0.5), v.faltas, v.semRegistro, v.feriadosPagos,
      v.feriadosPerdidos, v.holidayPay, r.ot, r.dailyRate, v.gross, v.vt, v.vr, v.advances, v.unionDue, v.net]; });
    const total1 = ["TOTAL", "", "",
      rows.reduce((s,r)=>s+Number(valEfetivos(r).presentes||0),0),
      rows.reduce((s,r)=>s+Number(valEfetivos(r).meiodia||0),0),
      rows.reduce((s,r)=>{const v=valEfetivos(r);return s+Number(v.presentes||0)+Number(v.meiodia||0)*0.5;},0),
      rows.reduce((s,r)=>s+Number(valEfetivos(r).faltas||0),0), rows.reduce((s,r)=>s+Number(valEfetivos(r).semRegistro||0),0),
      T.feriadosPagos, T.feriadosPerdidos, T.holidayPay, rows.reduce((s,r)=>s+Number(r.ot||0),0),
      "", T.gross, T.vt, T.vr, T.advances, T.unionDue, T.net];
    const ws1 = XLSX.utils.aoa_to_sheet([
      ["Folha de Pagamento", periodLabel], ["Data de pagamento", paymentDateLabel],
      ["Regra aplicada", paymentObs], ["Critério de dias", "Presença = 1 dia; meio período = 0,5; falta e feriado = 0 dia trabalhado."],
      [], header1, ...body1, total1,
    ]);
    ws1["!cols"] = [24,18,20,8,10,16,8,13,15,17,15,8,12,14,12,12,12,12,14].map(w=>({wch:w}));
    if (body1.length) ws1["!autofilter"] = {ref:`A6:S${6+body1.length}`};
    XLSX.utils.book_append_sheet(wb, ws1, "Folha");

    const header2 = ["Obra", "Funcionários Alocados", "Presenças Integrais", "Meios Períodos",
      "Dias Trabalhados Equivalentes", "Faltas", "Sem Registro", "Feriados Pagos",
      "Feriados Perdidos", "HE", "Valor dos Dias", "Valor dos Feriados", "Bruto", "VT", "VR", "Custo Direto"];
    const body2 = resumoPorObra.map(o => [o.obraName, o.funcionarios, o.presentes, o.meiodia,
      o.diasTrabalhados, o.faltas, o.semRegistro, o.feriadosPagos, o.feriadosPerdidos,
      o.ot, o.valorDias, o.valorFeriados, o.bruto, o.vt, o.vr, o.custoDireto]);
    const total2 = ["TOTAL", resumoPorObra.reduce((s,o)=>s+o.funcionarios,0),
      ...["presentes","meiodia","diasTrabalhados","faltas","semRegistro","feriadosPagos",
          "feriadosPerdidos","ot","valorDias","valorFeriados","bruto","vt","vr","custoDireto"]
        .map(k => resumoPorObra.reduce((s,o)=>s+Number(o[k]||0),0))];
    const ws2 = XLSX.utils.aoa_to_sheet([
      ["Resumo da Folha por Obra", periodLabel],
      ["Período", `${fmtDateFull(days[0])} a ${fmtDateFull(days[days.length-1])}`],
      ["Critério", "Dia trabalhado equivalente = presença integral + 0,5 por meio período. Faltas não contam."],
      [], header2, ...body2, total2,
    ]);
    ws2["!cols"] = [26,18,18,16,24,9,13,15,17,8,15,17,14,12,12,15].map(w=>({wch:w}));
    if (body2.length) ws2["!autofilter"] = {ref:`A5:P${5+body2.length}`};
    XLSX.utils.book_append_sheet(wb, ws2, "Resumo por Obra");

    const responsabilidadeHeader=["Responsável pelo pagamento","Obra / centro","Funcionário","Cargo","Tipo de contrato","Dias trabalhados","Bruto","VT","VR","Adiantamento rateado","Desconto sindical","Líquido a pagar"];
    const responsabilidadeBody=responsabilidadeFolha.rows.map(l=>[
      l.payer==="obra_administracao"?"Obra de administração":"Construtora",
      l.obraName,l.funcionario,l.cargo,l.contractType||"sem obra",l.diasTrabalhados,
      l.bruto,l.vt,l.vr,l.advancesObra,l.unionDueObra||0,l.netObra,
    ]);
    const wsResponsabilidade=XLSX.utils.aoa_to_sheet([
      ["Responsabilidade pelo pagamento da folha",periodLabel],
      ["Regra","Somente admin_only é atribuído à obra; contratos fixos/mistos e administrativo ficam com a construtora."],
      ["Total obras de administração",responsabilidadeFolha.totals.administrationWorks],
      ["Total construtora",responsabilidadeFolha.totals.builder],
      ["Total conciliado",responsabilidadeFolha.totals.total],
      [],responsabilidadeHeader,...responsabilidadeBody,
      ["TOTAL","","","","","","","","","",T.unionDue,responsabilidadeFolha.totals.total],
    ]);
    wsResponsabilidade["!cols"]=[24,26,24,18,20,18,14,12,12,20,20,18].map(w=>({wch:w}));
    if(responsabilidadeBody.length)wsResponsabilidade["!autofilter"]={ref:`A7:L${7+responsabilidadeBody.length}`};
    XLSX.utils.book_append_sheet(wb,wsResponsabilidade,"Responsabilidade");

    const header3 = ["Obra", "Funcionário", "Cargo", "Presenças Integrais", "Meios Períodos",
      "Dias Trabalhados Equivalentes", "Faltas", "Sem Registro", "Feriados Pagos",
      "Feriados Perdidos", "HE", "Diária", "Valor dos Dias", "Valor dos Feriados",
      "Bruto Alocado", "VT", "VR", "Custo Direto"];
    const body3 = detalheObraFuncionario.map(l => [l.obraName, l.funcionario, l.cargo,
      l.presentes, l.meiodia, l.diasTrabalhados, l.faltas, l.semRegistro,
      l.feriadosPagos, l.feriadosPerdidos, l.ot, l.diaria, l.valorDias,
      l.valorFeriados, l.bruto, l.vt, l.vr, l.custoDireto]);
    const ws3 = XLSX.utils.aoa_to_sheet([
      ["Folha por Obra e Funcionário", periodLabel],
      ["Período", `${fmtDateFull(days[0])} a ${fmtDateFull(days[days.length-1])}`],
      ["Observação", "Adiantamentos e líquido permanecem na aba Folha, pois o adiantamento não possui obra vinculada."],
      ["Critério", "Meio período equivale a 0,5 dia trabalhado; faltas e feriados não são dias trabalhados."],
      [], header3, ...body3,
    ]);
    ws3["!cols"] = [26,24,18,18,16,24,9,13,15,17,8,12,15,17,15,12,12,15].map(w=>({wch:w}));
    if (body3.length) ws3["!autofilter"] = {ref:`A6:R${6+body3.length}`};
    XLSX.utils.book_append_sheet(wb, ws3, "Funcionario por Obra");

    const header4 = ["Data", "Dia da Semana", "Funcionário", "Cargo", "Obra", "Status",
      "Dia Equivalente", "HE", "Diária", "Valor do Dia/Feriado", "VT", "VR", "Total Direto", "Observação"];
    const body4 = pontoDiario.map(l => [l.data, l.diaSemana, l.funcionario, l.cargo, l.obraName,
      l.status, l.equivalente, l.ot, l.diaria, l.valorDia, l.vt, l.vr, l.totalDia, l.observacao]);
    const ws4 = XLSX.utils.aoa_to_sheet([
      ["Espelho Diário por Obra e Funcionário", periodLabel],
      ["Período", `${fmtDateFull(days[0])} a ${fmtDateFull(days[days.length-1])}`],
      [], header4, ...body4,
    ]);
    ws4["!cols"] = [12,15,24,18,26,17,15,8,12,20,12,12,15,30].map(w=>({wch:w}));
    if (body4.length) ws4["!autofilter"] = {ref:`A4:N${4+body4.length}`};
    XLSX.utils.book_append_sheet(wb, ws4, "Ponto Diario");

    const unionBody=rows.map(r=>[r.name,r.role||"",r.unionDueGroup===UNION_DUE_GROUP.PROFESSIONAL?"Profissional":r.unionDueGroup===UNION_DUE_GROUP.HELPER?"Ajudante":"Isento",r.unionDue,r.netBeforeUnion,r.net]);
    const wsUnion=XLSX.utils.aoa_to_sheet([
      ["Descontos sindicais",periodLabel],["Vigência",data.config?.unionDues?.effectiveFrom||"Não definida"],["Sindicato a recolher",T.unionDue],[],
      ["Funcionário","Função","Classificação","Desconto sindical","Líquido antes do sindicato","Líquido final"],...unionBody,
    ]);
    wsUnion["!cols"]=[26,20,18,20,24,18].map(w=>({wch:w}));
    if(unionBody.length)wsUnion["!autofilter"]={ref:`A5:F${5+unionBody.length}`};
    XLSX.utils.book_append_sheet(wb,wsUnion,"Sindicato");

    await XLSX.writeFile(wb, `arcd-folha-${year}-${String(month+1).padStart(2,"0")}-Q${q}.xlsx`);
    showToast("Excel gerado com 6 abas, incluindo responsabilidade e sindicato.");
  };

  const executarRelatorio = tipo => {
    if (tipo === "pdf") printPDF();
    else exportXLSDetalhado();
  };

  const solicitarRelatorio = tipo => {
    if (pendenciasRelatorio.length > 0) {
      setRelatorioPendente(tipo);
      return;
    }
    executarRelatorio(tipo);
  };

  const continuarComPendencias = () => {
    const tipo = relatorioPendente;
    setRelatorioPendente("");
    executarRelatorio(tipo);
  };

  const buildText = () => [
    "FOLHA DE PAGAMENTO - ARCD OBRAS",
    data.config.companyName || "",
    periodLabel,
    `Pagamento: ${paymentDateLabel}`,
    paymentObs,
    "",
    ...rows.map(r => { const v = valEfetivos(r); return `- ${r.name} (${filterObra === "all" ? obraName(r.obra) : obraName(filterObra)}): ${fmt(v.net)} | ${v.feriadosPagos}FP ${v.feriadosPerdidos}FD`; }),
    "",
    `TOTAL LÍQUIDO: ${fmt(T.net)}`,
    `SINDICATO A RECOLHER: ${fmt(T.unionDue)}`,
    `OBRAS DE ADMINISTRAÇÃO: ${fmt(responsabilidadeFolha.totals.administrationWorks)}`,
    `CONSTRUTORA: ${fmt(responsabilidadeFolha.totals.builder)}`,
    `FERIADOS PAGOS: ${T.feriadosPagos}`,
    `FERIADOS PERDIDOS: ${T.feriadosPerdidos}`,
    `VALOR TOTAL DE FERIADOS: ${fmt(T.holidayPay)}`,
    `${rows.length} funcionário(s)`,
    `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
  ].join("\n");

  const years = [];
  for (let i = now.getFullYear() - 1; i <= now.getFullYear() + 2; i++) years.push({ v: String(i), l: String(i) });

  return (
    <div className="anim payroll-workspace">
      <PageHero
        eyebrow="Recursos humanos"
        title="Folha de Pagamento"
        description="Conferência quinzenal da equipe, dos apontamentos e do valor líquido por obra."
        alert={pendenciasRelatorio.length?{
          tone:"danger",
          text:`${pendenciasRelatorio.length} funcionário(s) exigem conferência antes do fechamento`,
        }:{
          tone:"success",
          text:"Folha pronta para conferência e exportação",
        }}
        stats={[
          {label:"Líquido a pagar",value:fmt(T.net),detail:`Após ${fmt(T.unionDue)} de sindicato`,color:C.yellow},
          {label:"Valor bruto",value:fmt(T.gross),detail:`VT + VR: ${fmt(T.vt+T.vr)}`},
          {label:"Funcionários",value:rows.length,detail:filterObra==="all"?"Todas as obras":obraName(filterObra)},
          {label:"Pagamento",value:paymentDateLabel,detail:paymentObs,color:paymentInfo.adjusted?C.orange:C.green},
        ]}
        actions={pendenciasRelatorio.length?<Btn v="warning" onClick={()=>onTab?.("ponto_geral")}><Ic n="alert"/> Revisar ponto</Btn>:null}
      />

      <nav className="payroll-view-tabs" aria-label="Áreas da folha">
        <button type="button" aria-current={payrollView==="payroll"?"page":undefined} onClick={()=>setPayrollView("payroll")}><Ic n="file"/> Folha da quinzena</button>
        <button type="button" aria-current={payrollView==="union"?"page":undefined} onClick={()=>setPayrollView("union")}><Ic n="building"/> Sindicato</button>
      </nav>

      {payrollView==="union"&&<section className="payroll-union" aria-labelledby="union-title">
        <header className="payroll-union__header">
          <div><h3 id="union-title">Desconto e recolhimento sindical</h3><p>Defina uma regra por função. O valor reduz o líquido do funcionário e fica separado como sindicato a recolher pela construtora.</p></div>
          <label className="payroll-union__switch"><input type="checkbox" checked={unionDraft.enabled} onChange={e=>setUnionDraft(d=>({...d,enabled:e.target.checked}))}/><span>{unionDraft.enabled?"Regra ativa":"Regra inativa"}</span></label>
        </header>
        <div className="payroll-union__notice" role="note"><Ic n="alert"/><span>Aplique o desconto somente quando houver autorização ou base legal válida. A vigência impede que competências anteriores sejam recalculadas.</span></div>
        <div className="payroll-union__fields">
          <Inp label="Valor — Profissional (R$)" type="number" value={String(unionDraft.professionalValue||"")} onChange={v=>setUnionDraft(d=>({...d,professionalValue:Math.max(0,Number(v||0))}))}/>
          <Inp label="Valor — Ajudante (R$)" type="number" value={String(unionDraft.helperValue||"")} onChange={v=>setUnionDraft(d=>({...d,helperValue:Math.max(0,Number(v||0))}))}/>
          <Sel label="Frequência" value={unionDraft.frequency} onChange={v=>setUnionDraft(d=>({...d,frequency:v}))} options={[{v:"monthly",l:"Uma vez por mês"},{v:"every_payroll",l:"Em cada quinzena"}]}/>
          {unionDraft.frequency==="monthly"&&<Sel label="Quinzena do desconto" value={unionDraft.monthlyCycle} onChange={v=>setUnionDraft(d=>({...d,monthlyCycle:v}))} options={[{v:"1",l:"1ª quinzena"},{v:"2",l:"2ª quinzena"}]}/>}
          <Inp label="Vigência inicial" type="date" value={unionDraft.effectiveFrom} onChange={v=>setUnionDraft(d=>({...d,effectiveFrom:v}))}/>
        </div>
        <div className="payroll-union__roles">
          <div className="payroll-section-heading"><div><h3>Classificação das funções</h3><p>Cargos não classificados permanecem isentos para evitar desconto indevido.</p></div><span className="payroll-scope-chip">{roleCatalog.length} função(ões)</span></div>
          {roleCatalog.length===0?<div className="payroll-union__empty">Cadastre funcionários e suas funções para classificá-los.</div>:roleCatalog.map(role=>{
            const key=normalizeRoleKey(role);const count=(data.employees||[]).filter(e=>normalizeRoleKey(e.role)===key).length;
            return <div className="payroll-union__role" key={key}><div><strong>{role}</strong><span>{count} funcionário(s)</span></div><select aria-label={`Classificação sindical de ${role}`} value={unionDraft.roleGroups[key]||UNION_DUE_GROUP.EXEMPT} onChange={e=>setUnionDraft(d=>({...d,roleGroups:{...d.roleGroups,[key]:e.target.value}}))}><option value={UNION_DUE_GROUP.PROFESSIONAL}>Profissional</option><option value={UNION_DUE_GROUP.HELPER}>Ajudante</option><option value={UNION_DUE_GROUP.EXEMPT}>Isento</option></select></div>;
          })}
        </div>
        <footer className="payroll-union__footer"><div><span>Prévia desta quinzena</span><strong>{fmt(unionSummary.total)}</strong><small>{unionSummary.professionals} profissional(is) · {unionSummary.helpers} ajudante(s)</small></div><Btn v="primary" disabled={savingUnion} onClick={saveUnionConfig}><Ic n="check"/>{savingUnion?" Salvando…":" Salvar regra sindical"}</Btn></footer>
      </section>}

      {payrollView==="payroll"&&<>

      <section className="payroll-controls" aria-label="Competência e escopo da folha">
        <div className="payroll-section-heading">
          <div>
            <h3>Competência e escopo</h3>
            <p>{fmtDateFull(days[0])} a {fmtDateFull(days[days.length-1])}</p>
          </div>
          <span className="payroll-scope-chip">{filterObra==="all"?"Consolidado da empresa":obraName(filterObra)}</span>
        </div>
        <div className="payroll-filter-grid">
          <Sel label="Ano" value={String(year)} onChange={v => setYear(Number(v))} options={years} />
          <Sel label="Mês de referência" value={String(month)} onChange={v => setMonth(Number(v))} options={Array.from({ length: 12 }, (_, i) => ({ v: String(i), l: fullMonth(i) }))} />
          <Sel label="Ciclo da folha" value={q} onChange={setQ} options={[{ v: "1", l: "1ª quinzena · 06 a 20" }, { v: "2", l: "2ª quinzena · 21 a 05" }]} />
          <Sel label="Obra" value={filterObra} onChange={setFilterObra} options={[{ v: "all", l: "Todas as obras" }, ...data.obras.map(o => ({ v: o.id, l: o.name }))]} />
        </div>
      </section>

      <section className="payroll-summary-strip" aria-label="Composição do pagamento">
        <div><span>Dias + horas extras</span><strong>{fmt(T.gross-T.holidayPay)}</strong></div>
        <div><span>Feriados</span><strong>{fmt(T.holidayPay)}</strong><small>{T.feriadosPagos} pago(s) · {T.feriadosPerdidos} perdido(s)</small></div>
        <div><span>Benefícios</span><strong>{fmt(T.vt+T.vr)}</strong><small>VT {fmt(T.vt)} · VR {fmt(T.vr)}</small></div>
        <div><span>Adiantamentos</span><strong data-tone={T.advances>0?"danger":"neutral"}>{T.advances>0?`− ${fmt(T.advances)}`:fmt(0)}</strong></div>
        <div><span>Sindicato</span><strong data-tone={T.unionDue>0?"danger":"neutral"}>{T.unionDue>0?`− ${fmt(T.unionDue)}`:fmt(0)}</strong><small>{filterObra==="all"?"A recolher pela construtora":"Desconto rateado nesta obra"}</small></div>
        <div className="payroll-summary-strip__net"><span>Líquido a pagar</span><strong>{fmt(T.net)}</strong><small>Valor final dos pagamentos aos funcionários</small></div>
      </section>

      <section className="payroll-actionbar" aria-label="Ações da folha">
        <div>
          <h3>Relatórios e compartilhamento</h3>
          <p>Os arquivos respeitam a competência e a obra selecionadas acima.</p>
        </div>
        <div className="payroll-actions">
          <Btn v="primary" onClick={() => solicitarRelatorio("excel")}><Ic n="download" /> Exportar Excel</Btn>
          <Btn v="ghost" onClick={() => solicitarRelatorio("pdf")}><Ic n="file" /> Gerar PDF</Btn>
          <Btn v="ghost" onClick={() => window.open(`mailto:${data.config.hrEmail || ""}?subject=${encodeURIComponent("Folha - " + periodLabel)}&body=${encodeURIComponent(buildText())}`)}><Ic n="mail" /> Enviar por e-mail</Btn>
          <Btn v="ghost" onClick={() => navigator.clipboard.writeText(buildText()).then(() => showToast("Resumo copiado.")).catch(() => showToast("Não foi possível copiar o resumo.", "error"))}><Ic n="copy" /> Copiar resumo</Btn>
        </div>
      </section>

      <div className="payroll-list-heading">
        <div><h3>Funcionários da quinzena</h3><p>Abra uma linha para conferir composição, obras e espelho diário.</p></div>
        <span>{rows.length} registro(s)</span>
      </div>

      {rows.length === 0 && <div className="payroll-empty"><Ic n="users" s={22}/><strong>Nenhuma movimentação nesta quinzena</strong><p>Revise a competência ou abra a gestão do ponto para lançar as presenças.</p><Btn v="ghost" onClick={()=>onTab?.("ponto_geral")}>Abrir gestão do ponto</Btn></div>}

      {rows.map(r => {
        const v = valEfetivos(r);
        const workedDays=(v.presentes+v.meiodia*0.5).toFixed(1).replace(".",",");
        const hasIssue=v.semRegistro>0||v.faltas>0;
        return (
        <article key={r.id} className="payroll-person" data-expanded={expandedId===r.id}>
          <button
            type="button"
            className="payroll-person__trigger"
            aria-expanded={expandedId===r.id}
            aria-controls={`payroll-detail-${r.id}`}
            onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
          >
            <div className="payroll-person__identity">
              <span className="payroll-person__chevron" aria-hidden="true"><Ic n="chevron" s={13}/></span>
              <div>
                <p className="payroll-person__name">{r.name}</p>
                <p className="payroll-person__work">{filterObra === "all" ? obraName(r.obra) : obraName(filterObra)} · {workedDays} dia(s) equivalente(s)</p>
              </div>
            </div>
            <div className="payroll-person__signals" aria-label="Resumo do ponto">
              <span data-tone="success">{v.presentes} presente(s)</span>
              {v.meiodia>0&&<span data-tone="warning">{v.meiodia} meio(s)</span>}
              {v.faltas>0&&<span data-tone="danger">{v.faltas} falta(s)</span>}
              {v.semRegistro>0&&<span data-tone="danger">{v.semRegistro} sem registro</span>}
              {!hasIssue&&<span data-tone="neutral">Ponto conferido</span>}
            </div>
            <div className="payroll-person__amount">
              <small>Líquido a pagar</small>
              <strong>{fmt(v.net)}</strong>
              {v.advances > 0 && <span>Adiantamento: − {fmt(v.advances)}</span>}
              {v.unionDue > 0 && <span>Sindicato: − {fmt(v.unionDue)}</span>}
            </div>
          </button>

          {expandedId === r.id && (
            <div id={`payroll-detail-${r.id}`} className="payroll-person__detail">
              {filterObra !== "all" && (r.obrasPorDia||[]).length > 1 && (
                <p className="payroll-scope-note">
                  Valores referentes apenas a <b>{obraName(filterObra)}</b>. Este funcionário também trabalhou em outras obras na quinzena; o líquido total dele é {fmt(r.net)}.
                </p>
              )}
              <div className="payroll-detail-metrics">
                {[
                  ["Diária", fmt(r.dailyRate)], ["Bruto", fmt(v.gross)], ["VT+VR", fmt(v.vt + v.vr)], ["Adiant.", fmt(v.advances), C.red], ["Antes do sindicato", fmt(v.netBeforeUnion)], ["Sindicato", `− ${fmt(v.unionDue)}`, C.red], ["Líquido a pagar", fmt(v.net), C.yellowD], ["HE", `${r.ot}h · ${fmt(v.overtimePay)}`, C.purple], ["Feriados pagos", v.feriadosPagos], ["Feriados perdidos", v.feriadosPerdidos, C.red], ["Valor feriado", fmt(v.holidayPay), C.green],
                ].map(([label, value, color]) => (
                  <div key={label} className="payroll-detail-metric">
                    <p>{label}</p>
                    <strong style={{color:color||C.text}}>{value}</strong>
                  </div>
                ))}
              </div>

              {r.holidayRules.length > 0 && (
                <section className="payroll-detail-section">
                  <h4>Regra de feriados</h4>
                  {r.holidayRules.map(h => (
                    <div key={h.holidayIso} className="payroll-holiday-rule" data-tone={h.losesHoliday?"danger":"success"}>
                      <strong>{fmtDateFull(h.holidayIso)} · {h.losesHoliday ? "Feriado perdido" : "Feriado pago"}</strong>
                      <span>Anterior: {fmtDateFull(h.before)} ({h.missedBefore ? "falta" : "presença"}) · Posterior: {fmtDateFull(h.after)} ({h.missedAfter ? "falta" : "presença"})</span>
                    </div>
                  ))}
                </section>
              )}

              {r.obrasPorDia.filter(o => filterObra === "all" || o.obraId === filterObra).length > 0 && (
                <section className="payroll-detail-section">
                  <h4>Dias trabalhados por obra</h4>
                  <div className="payroll-project-grid">
                    {r.obrasPorDia.filter(o => filterObra === "all" || o.obraId === filterObra).map(o => (
                      <div key={o.obraId || "sem-obra"} className="payroll-project-row">
                        <div><strong>{o.obraName}</strong><span>{o.presentes} integral(is) + {o.meiodia} meio(s) · {o.faltas} falta(s)</span></div>
                        <b>{o.diasTrabalhados.toFixed(1).replace(".",",")} dia(s)</b>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {r.pixKey && <p className="payroll-pix"><span>Chave PIX</span><b>{r.pixKey}</b></p>}

              <section className="payroll-detail-section">
                <h4>Espelho diário</h4>
                <div className="payroll-day-grid">
                {days.map(d => {
                  const a = getAtt(data, r.id, d);
                  const st = a?.status;
                  const isHoliday = holidaysInPeriod.includes(d) && isEmployeeEmployedOnDate(r, d);
                  const col = isHoliday ? C.blue : st === "P" ? C.green : st === "M" ? C.yellow : st === "F" ? C.red : C.muted;
                  return (
                    <div key={d} className="payroll-day" title={fmtDateFull(d)}>
                      <span>{fmtDate(d)}</span>
                      <strong style={{color:col}}>{isHoliday ? "FER" : st || "—"}</strong>
                    </div>
                  );
                })}
                </div>
              </section>
              </div>
          )}
        </article>
        );
      })}

      {relatorioPendente && (
        <Modal title="Conferência antes de gerar o relatório" onClose={() => setRelatorioPendente("")} wide>
          <div className="payroll-review">
            <div className="payroll-review__summary">
              <span><Ic n="alert" s={16}/></span>
              <div>
                <h3>Há informações pendentes nesta quinzena</h3>
                <p>
                  {pendenciasRelatorio.length} funcionário(s) para conferir · {totalDiasSemRegistro} dia(s) sem registro · {totalSemPix} PIX ausente(s).
                </p>
                <small>Sábados, domingos e feriados não são considerados ausência de registro.</small>
              </div>
            </div>

            <div className="payroll-review__list">
              {pendenciasRelatorio.map(p => (
                <div key={p.id} className="payroll-review__item">
                  <strong>{p.nome}</strong>
                  {p.semRegistro.length > 0 && (
                    <p data-tone="danger">
                      {p.nenhumRegistro ? "Nenhum ponto registrado" : `${p.semRegistro.length} dia(s) sem ponto`}: {p.semRegistro.slice(0,8).map(fmtDate).join(", ")}{p.semRegistro.length > 8 ? ` e mais ${p.semRegistro.length - 8}` : ""}
                    </p>
                  )}
                  {p.campos.length > 0 && <p data-tone="warning">Dados faltando: {p.campos.join(", ")}.</p>}
                </div>
              ))}
            </div>

            <p className="payroll-review__help">Corrija as informações agora ou gere o arquivo mantendo as pendências claramente identificadas.</p>
            <div className="payroll-review__actions">
              <Btn v="primary" onClick={() => { setRelatorioPendente(""); onTab?.("ponto_geral"); }}>Corrigir ponto</Btn>
              <Btn v="ghost" onClick={() => { setRelatorioPendente(""); onTab?.("equipe"); }}>Preencher PIX / cadastro</Btn>
              <Btn v="warning" onClick={continuarComPendencias}>Gerar com pendências</Btn>
            </div>
          </div>
        </Modal>
      )}
      </>}
    </div>
  );
}

export default Folha;
