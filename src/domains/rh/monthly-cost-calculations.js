// Simulador de custo mensal por trabalhador (Profissional e Servente).
// Fórmulas reproduzem a planilha "Custo_Mensal_Profissional_Servente_Marcell"
// (CCT Caruaru 2026/2028, Simples Nacional Anexo IV). Percentuais ficam em
// fração (0,2 = 20%); a tela converte para exibição.

export const DEFAULT_MONTHLY_COST_PREMISES = Object.freeze({
  salP:2406.8, salS:1810.6, horas:220, dias:22,
  cpp:.2, rat:.03, fap:1, terc:0, fgts:.08, multa:.4,
  perm:12, semJusta:.9, avisoInd:.5, diasAviso:30,
  cafe:8.78, almoco:14.04, cesta:65, tarifa:5, passagens:2, descVT:.06, ferr:57.94, usaFerr:0,
  asoAdm:180, asoPer:150, asoDem:70, trein:150, unif:110, epi:45, seguro:12, sst:15,
  diasAno:260, diasFer:22, feriados:11, folgas:4, faltas:4, hDia:8.8,
  inss1:1621, inss2:2902.84, inss3:4354.27, inss4:8475.55, taxaAssist:.02,
});

// Cesta da CCT cl. 18ª só é devida para salário-base até este valor.
export const BASKET_SALARY_CAP = 4500;

// Igual ao ROUND(x;2) do Excel: 1621 × 7,5% = 121,575 deve virar 121,58, mas
// em ponto flutuante vale 121,57499…; toPrecision(15) remove esse resíduo.
const round2 = value => Math.round(Number((value * 100).toPrecision(15))) / 100;

// Aceita premissas salvas pelo navegador: mantém só chaves conhecidas com
// número finito e completa o resto com o padrão.
export const normalizeMonthlyCostPremises = (saved = {}) => {
  const premises = { ...DEFAULT_MONTHLY_COST_PREMISES };
  if (!saved || typeof saved !== "object") return premises;
  Object.keys(premises).forEach(key => {
    const value = Number(saved[key]);
    if (saved[key] !== null && saved[key] !== "" && Number.isFinite(value)) premises[key] = value;
  });
  return premises;
};

export const productiveHoursPerMonth = P =>
  (P.diasAno - P.diasFer - P.feriados - P.folgas - P.faltas) * P.hDia / 12;

export const employeeInss = (salary, P) => round2(
  Math.min(salary, P.inss1) * .075
  + Math.max(0, Math.min(salary, P.inss2) - P.inss1) * .09
  + Math.max(0, Math.min(salary, P.inss3) - P.inss2) * .12
  + Math.max(0, Math.min(salary, P.inss4) - P.inss3) * .14,
);

export const calculateMonthlyWorkerCost = (P, salary, { professional = false } = {}) => {
  const s = Number(salary) || 0;
  const o = { s };
  // B. Encargos mensais sobre a folha
  o.cpp = s * P.cpp;
  o.rat = s * P.rat * P.fap;
  o.terc = s * P.terc;
  o.fgts = s * P.fgts;
  o.B = o.cpp + o.rat + o.terc + o.fgts;
  // C. Provisões de 13º, férias e rescisão
  o.d13 = s / 12;
  o.fer = s / 12 * 4 / 3;
  o.encProv = (o.d13 + o.fer) * (P.cpp + P.rat * P.fap + P.terc + P.fgts);
  o.aviso = s * P.diasAviso / 30 / P.perm * P.avisoInd;
  o.fgtsAviso = o.aviso * P.fgts;
  o.proj = (o.d13 + o.fer) / P.perm * P.diasAviso / 30 * P.avisoInd;
  o.multa = (o.fgts + (o.d13 + o.fer) * P.fgts + o.fgtsAviso + o.proj * P.fgts) * P.multa * P.semJusta;
  o.C = o.d13 + o.fer + o.encProv + o.aviso + o.fgtsAviso + o.proj + o.multa;
  // D. Benefícios da CCT
  o.cafe = P.cafe * P.dias;
  o.almoco = P.almoco * P.dias;
  o.cesta = s <= BASKET_SALARY_CAP ? P.cesta : 0;
  o.vt = Math.max(0, P.tarifa * P.passagens * P.dias - s * P.descVT);
  o.ferr = professional ? P.ferr * P.usaFerr : 0;
  o.D = o.cafe + o.almoco + o.cesta + o.vt + o.ferr;
  // E. Saúde e segurança do trabalho
  o.aso = (P.asoAdm + P.asoDem) / P.perm + P.asoPer / 12;
  o.trein = P.trein / P.perm;
  o.unif = 2 * P.unif / 8;
  o.epi = P.epi;
  o.seguro = P.seguro;
  o.sst = P.sst;
  o.E = o.aso + o.trein + o.unif + o.epi + o.seguro + o.sst;
  o.total = s + o.B + o.C + o.D + o.E;
  o.hProd = productiveHoursPerMonth(P);
  // Caixa mensal: o que sai do caixa sem as provisões
  o.inssRat = o.cpp + o.rat + o.terc;
  o.des = s + o.inssRat + o.fgts + o.D + o.E;
  o.eco = o.des + o.C;
  // Visão do trabalhador (contracheque estimado)
  o.inssEmp = employeeInss(s, P);
  o.vtEmp = round2(Math.min(s * P.descVT, P.tarifa * P.passagens * P.dias));
  o.taxa = round2(Math.min(s, P.salP) * P.taxaAssist);
  o.irrf = 0;
  o.liq = s - o.inssEmp - o.vtEmp - o.taxa - o.irrf;
  return o;
};

export const calculateMonthlyCrewCost = (premises = DEFAULT_MONTHLY_COST_PREMISES) => {
  const P = normalizeMonthlyCostPremises(premises);
  const professional = calculateMonthlyWorkerCost(P, P.salP, { professional:true });
  const helper = calculateMonthlyWorkerCost(P, P.salS);
  const crew = Object.fromEntries(Object.keys(professional).map(key => [key, professional[key] + helper[key]]));
  // Horas produtivas da dupla são a soma das duas pessoas; o custo por hora
  // produtiva da dupla é o custo da equipe por hora de relógio.
  const hours = professional.hProd;
  const ratio = (a, b) => a / b;
  return {
    premises:P,
    professional,
    helper,
    crew,
    indicators:{
      multiplier:{ professional:ratio(professional.total, professional.s), helper:ratio(helper.total, helper.s), crew:ratio(crew.total, crew.s) },
      chargesOnSalary:{ professional:ratio(professional.B + professional.C, professional.s), helper:ratio(helper.B + helper.C, helper.s), crew:ratio(crew.B + crew.C, crew.s) },
      costPerPaidHour:{ professional:professional.total / P.horas, helper:helper.total / P.horas, crew:crew.total / P.horas },
      productiveHours:{ professional:hours, helper:hours, crew:hours * 2 },
      costPerProductiveHour:{ professional:professional.total / hours, helper:helper.total / hours, crew:crew.total / hours },
    },
  };
};
