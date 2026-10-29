import { marcellReportHtml } from "./marcell-report.js";
const amount=value=>value==null?null:value/100;
const escape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
export function laborProjectionSheets(r) {
  const t=r.totals;
  const names=new Map((r.people||[]).map(person=>[person.id,person.name]));
  const personName=id=>names.get(id)||id;
  const sheets=[{name:"Resumo",rows:[["Relatório","Projeção de mão de obra"],["Quinzena",r.period.key],["Início",r.period.start],["Fim",r.period.end],["Corte",r.cutoff],["Fuso",r.timeZone],["Pagamento",r.payment.paymentDate],["Histórico inicial",r.period.historyStart],["Histórico final",r.period.historyEnd],["Atualizado",r.updatedAt],["Versão",r.version],["Metodologia",r.methodology.version],["Filtros",JSON.stringify(r.filters)],["Terceirizados fora da projeção",r.thirdParties?.excludedCount||0],["Motivo",r.thirdParties?.reason||""],...[["Custo esperado",t.totalCents],["Apurado",t.knownCents],["Programado",t.scheduledCents],["Estimativa futura",t.estimatedCents],["Pendências provisórias",t.pendingCents],["Total parcial estimável",t.partialCents],["Reserva integral",t.reserveCents],["Encargos já incluídos",t.chargesCents],["Diferença entre cenários",t.scenarioDifferenceCents]].map(([label,value])=>[label,amount(value)]),["Pessoas distintas",t.employeeCount],["Parcelas sem base",t.unknown],["Responsável: construtora",amount(r.responsibility.costBuilderCents)],["Responsável: obras por administração",amount(r.responsibility.costAdministrationCents)],["Líquido",amount(r.cash.netCents)],["Saldo aos funcionários",amount(r.cash.balanceCents)],["Retenções sem vencimento confirmado",amount(r.cash.retentionCents)],...r.warnings.map(warning=>["Ressalva",warning])]},
    {name:"Obras e Administração",rows:[["Centro","Pessoas distintas","Dias restantes (pessoas)","Taxa mínima aplicada","Taxa máxima aplicada","Origem das taxas","Apurado","Programado","Estimado","Pendente provisório","Total","Reserva","Previstos históricos","Observados","F","M","Afastamentos","Pendentes históricos","Cobertura"],...r.works.map(w=>[w.label,w.employeeCount,w.remainingDays,w.rateMin,w.rateMax,w.rateOrigins.join(", "),...[w.knownCents,w.scheduledCents,w.estimatedCents,w.pendingCents,w.totalCents,w.reserveCents].map(amount),w.coverage.expected,w.coverage.observed,w.coverage.absences,w.coverage.half,w.coverage.leaves,w.coverage.pending,w.coverage.coverage])]},
    {name:"Histórico",rows:[["Início","Fim"],...r.period.intervals.map(i=>[i.start,i.end]),["Arquivos ausentes",r.coverage.missingArchives.join(", ")],["Conflitos",r.coverage.conflicts],["Falha de leitura",r.coverage.readError||"Nenhuma"]]}];
  if(r.canSeePeople){
    sheets.push({name:"Pessoas autorizadas",rows:[["Pessoa","Função","Área","Modalidade","Origem da taxa","Taxa","Cobertura individual","Observados individuais","Intervalos com dados","Total","Reserva","Líquido","Saldo"],...r.people.map(p=>[p.name,p.role,p.area,p.mode,p.history.origin,p.history.rate,p.history.personal.coverage,p.history.personal.observed,p.history.personal.intervalsWithData,...[p.totals.totalCents,p.totals.reserveCents,p.cash.netCents,p.cash.balanceCents].map(amount)])]});
    sheets[2].rows.push([], ["Pessoa","Início","Fim","Previstos","Observados","F","M","Afastamentos","Pendentes"],...r.people.flatMap(p=>p.history.personal.intervals.map(i=>[p.name,i.start,i.end,i.expected,i.observed,i.absences,i.half,i.leaves,i.pending])));
    sheets.push({name:"Memória de cálculo",rows:[["Funcionário","Data","Obra ID","Área","Modalidade","Parcela","Situação","Origem","Taxa","Origem da taxa","Custo","Reserva","Remuneração com encargos","Benefícios","Encargos já incluídos","Condicional"],...r.memory.map(d=>[personName(d.employeeId),d.date,d.obraId,d.area,d.mode,d.partition,d.status,d.source,d.rate,d.rateOrigin,...[d.expectedCents,d.reserveCents,d.laborCents,d.benefitsCents,d.chargesCents].map(amount),d.conditional?"Sim":"Não"])]});
    sheets.push({name:"Pendências",rows:[["Funcionário","Data","Obra ID","Motivo"],...r.pending.map(p=>[personName(p.employeeId),p.date,p.obraId,p.reason])]});
  }else sheets.push({name:"Pendências",rows:[["Pendências agregadas",r.pendingSummary],["Detalhamento individual","Não autorizado para este perfil"]]});
  return sheets;
}
export function laborProjectionHtml(report) {
  const sheets=laborProjectionSheets(report);
  const body=sheets.map(sheet=>{
    const blocks=[];let block=[];
    for(const row of sheet.rows){
      if(!row.length||(block.length&&row.length!==block[0].length)){if(block.length)blocks.push(block);block=[];}
      if(row.length)block.push(row);
    }
    if(block.length)blocks.push(block);
    return `<section><h2>${escape(sheet.name)}</h2>${blocks.map(rows=>`<table data-report-table-name="${escape(sheet.name)}"><thead><tr>${rows[0].map(value=>`<th>${escape(value)}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map(row=>`<tr>${row.map((value,index)=>`<td>${escape(typeof value==="number"?value.toLocaleString("pt-BR",{maximumFractionDigits:/taxa|cobertura/i.test(String(rows[0][index]))?6:2}):value??"Indisponível")}</td>`).join("")}</tr>`).join("")}</tbody></table>`).join("")}</section>`;
  }).join("");
  return marcellReportHtml(`<!doctype html><html lang="pt-BR"><head><title>Projeção de mão de obra</title><style>@page{size:A3 landscape;margin:12mm}body{font:12px Arial}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccd3da;padding:6px;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}section{margin-top:16px}</style></head><body><h1>Projeção de mão de obra</h1><p>Valores monetários em reais (R$). Taxas e cobertura em frações de 0 a 1. Taxa ponderada F ÷ (P + M + F); mínimo de 20 dias e 80% de cobertura, depois grupo comparável, ou taxa indisponível. Aplica-se somente às estimativas, nunca ao apurado nem ao salário CLT. A reserva integral é cenário, não teto.</p>${body}</body></html>`,{adjustableTables:true});
}
