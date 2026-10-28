// Fechamento da quinzena da folha (diaristas).
//
// Fechar = congelar o que a Folha calculou e transformar cada líquido em uma
// obrigação financeira (`titulosFolha`), já rateada por obra. O razão
// (financeiro/ledger.js) e a conciliação (conciliacao/mutations.js) já leem
// esse formato; até aqui ninguém o gravava, e todo pagamento de folha caía
// como "pagamento sem título vinculado".
//
// O título é só a obrigação: o custo de mão de obra continua sendo
// reconhecido pelo ponto (payrollCostRecognizedByAttendance no ledger).
import { isDateInClosedPeriod } from "../financeiro/workflows.js";
import { totalLiquidadoFolha } from "../conciliacao/payroll.js";

export const PAYROLL_CLOSING_COMMAND = Object.freeze({
  PAYROLL_FORTNIGHT_CLOSED:"QUINZENA_FOLHA_FECHADA",
  PAYROLL_FORTNIGHT_REOPENED:"QUINZENA_FOLHA_REABERTA",
});

export const PAYROLL_CLOSING_COMMAND_TYPES = new Set(Object.values(PAYROLL_CLOSING_COMMAND));

const fail=reason=>({ok:false,reason});
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""));
const toCents=value=>Math.round(Number(value||0)*100);
const versionOf=item=>Number(item?.version||0);

export const payrollPeriodKey=(year,monthIndex,cycle)=>
  `${year}-${String(Number(monthIndex)+1).padStart(2,"0")}-Q${cycle==="1"?"1":"2"}`;
export const isPayrollPeriodKey=value=>/^\d{4}-(0[1-9]|1[0-2])-Q[12]$/.test(String(value||""));

const isCancelled=title=>String(title?.status||"").toLowerCase()==="cancelado";
export const activePayrollTitlesForPeriod=(data={},periodKey="")=>
  (data.titulosFolha||[]).filter(title=>title?.periodKey===periodKey&&!isCancelled(title));

// Distribui o líquido (em centavos) entre as obras na proporção do líquido de
// cada uma, pelo maior resto: a soma do rateio fecha exatamente com o título,
// que é o que o ledger confere (PAYROLL_ALLOCATION_MISMATCH tolera 1 centavo).
export const allocateNetByWork=(netCents,works=[])=>{
  const weights=works.map(work=>Math.max(0,Number(work.netObra||0)));
  const totalWeight=weights.reduce((sum,value)=>sum+value,0);
  if(netCents<=0||!works.length)return [];
  if(totalWeight<=0)return [{...works[0],cents:netCents}];
  const raw=weights.map(weight=>netCents*weight/totalWeight);
  const rows=works.map((work,index)=>({...work,cents:Math.floor(raw[index]),rest:raw[index]-Math.floor(raw[index])}));
  let missing=netCents-rows.reduce((sum,row)=>sum+row.cents,0);
  [...rows].sort((a,b)=>b.rest-a.rest).forEach(row=>{if(missing>0){row.cents+=1;missing-=1;}});
  return rows.filter(row=>row.cents>0).map(({rest,...row})=>row);
};

// rows: linhas calculadas pela Folha (calcRow) SEM filtro de obra.
// payerForWork: devolve quem paga a parcela da obra (payrollPayerForWork).
export const buildPayrollTitles=({
  rows=[],closingId,periodKey,periodoInicio,periodoFim,vencimento,payerForWork=()=>"",
})=>rows.filter(row=>toCents(row.net)>0).map(row=>{
  const netCents=toCents(row.net);
  const rateio=allocateNetByWork(netCents,row.obrasPorDia||[]);
  return {
    id:`${closingId}:${row.id}`,
    closingId,periodKey,
    employeeId:String(row.id),
    funcionarioNome:row.name||row.nome||"",
    documentoFuncionario:row.cpf||"",
    competencia:String(periodoFim||"").slice(0,7),
    periodoInicio,periodoFim,vencimento,
    bruto:toCents(row.gross)/100,
    beneficios:toCents(Number(row.vt||0)+Number(row.vr||0))/100,
    adiantamentos:toCents(row.advances)/100,
    descontos:toCents(row.unionDue)/100,
    liquido:netCents/100,
    rateiosPorObra:rateio.map(work=>({
      obraId:work.obraId||"",obraNome:work.obraName||"",
      valor:work.cents/100,pagador:payerForWork(work.obraId)||"",
    })),
  };
});

// Divergência entre o que foi fechado e o que a Folha calcula agora (ponto,
// adiantamento ou feriado alterados depois do fechamento).
export const payrollClosingDivergences=(titles=[],rows=[])=>{
  const current=new Map(rows.map(row=>[String(row.id),toCents(row.net)]));
  const closed=new Map(titles.map(title=>[String(title.employeeId),toCents(title.liquido)]));
  const ids=new Set([...current.keys(),...closed.keys()]);
  return [...ids].map(employeeId=>({
    employeeId,fechadoCents:closed.get(employeeId)||0,atualCents:current.get(employeeId)||0,
  })).filter(item=>Math.abs(item.fechadoCents-item.atualCents)>1);
};

// Bloqueios para fechar a quinzena, a partir da conferência que a Folha já faz
// (pendenciasRelatorio: dias sem registro e cadastros sem PIX/obra/diária).
// Devolve a lista de motivos; lista vazia = pode fechar.
export const payrollClosingBlockers=({pendencias=[],rows=[]}={})=>{
  const blockers=[];
  const semRegistro=pendencias.filter(item=>(item.semRegistro||[]).length>0);
  if(semRegistro.length)blockers.push(`${semRegistro.length} funcionário(s) com dia sem registro de ponto.`);
  const semPix=rows.filter(row=>toCents(row.net)>0&&!String(row.pixKey||"").trim());
  if(semPix.length)blockers.push(`${semPix.length} funcionário(s) com valor a receber e sem chave PIX.`);
  return blockers;
};

export const payrollClosingCommandObraId=()=>"";

const closeFortnight=(data,command,now)=>{
  const payload=command.payload||{};
  const periodKey=String(payload.periodKey||"");
  const closingId=String(payload.closingId||"").trim();
  const titles=Array.isArray(payload.titles)?payload.titles:[];
  if(!isPayrollPeriodKey(periodKey))return fail("Quinzena inválida para fechamento.");
  if(closingId.length<8)return fail("Fechamento sem identificação.");
  if(activePayrollTitlesForPeriod(data,periodKey).length)return fail("Esta quinzena já está fechada. Reabra antes de fechar de novo.");
  if(!titles.length)return fail("Não há valor a pagar nesta quinzena.");
  const existingIds=new Set((data.titulosFolha||[]).map(title=>String(title.id)));
  const employees=new Map((data.employees||[]).map(employee=>[String(employee.id),employee]));
  const normalized=[];
  for(const raw of titles){
    const employeeId=String(raw?.employeeId||"");
    const id=`${closingId}:${employeeId}`;
    if(!employees.has(employeeId))return fail("O fechamento contém funcionário inexistente.");
    if(String(raw.id)!==id||existingIds.has(id))return fail("Título de folha duplicado no fechamento.");
    if(raw.periodKey!==periodKey||raw.closingId!==closingId)return fail("Título de folha de outra quinzena.");
    const liquidoCents=toCents(raw.liquido);
    if(liquidoCents<=0)return fail("Título de folha sem valor líquido.");
    const rateio=Array.isArray(raw.rateiosPorObra)?raw.rateiosPorObra:[];
    const rateioCents=rateio.reduce((sum,item)=>sum+toCents(item.valor),0);
    if(!rateio.length||Math.abs(rateioCents-liquidoCents)>1)return fail(`O rateio por obra de ${raw.funcionarioNome||employeeId} não fecha com o líquido.`);
    if(!validDate(raw.vencimento)||!validDate(raw.periodoInicio)||!validDate(raw.periodoFim))return fail("Informe período e vencimento válidos.");
    if(isDateInClosedPeriod(data,raw.vencimento))return fail("O vencimento da folha cai em período financeiro fechado.");
    normalized.push({
      ...raw,id,employeeId,status:"em_aberto",liquidacoes:[],valorPago:0,saldo:liquidoCents/100,
      version:1,fechadoFolhaEm:now,fechadoFolhaPorId:String(command.actorId||""),
      fechadoFolhaPor:String(command.actorName||""),
    });
  }
  return {ok:true,entityId:closingId,data:{...data,titulosFolha:[...(data.titulosFolha||[]),...normalized]}};
};

const reopenFortnight=(data,command,now)=>{
  const payload=command.payload||{};
  const periodKey=String(payload.periodKey||"");
  const reason=String(payload.reason||"").trim();
  if(!isPayrollPeriodKey(periodKey))return fail("Quinzena inválida para reabertura.");
  if(!reason)return fail("Informe o motivo da reabertura da quinzena.");
  const open=activePayrollTitlesForPeriod(data,periodKey);
  if(!open.length)return fail("Esta quinzena não está fechada.");
  const expected=payload.expectedVersions||{};
  if(open.some(title=>expected[title.id]!=null&&Number(expected[title.id])!==versionOf(title))){
    return fail("A folha foi alterada por outra pessoa. Atualize a tela.");
  }
  const paid=open.filter(title=>totalLiquidadoFolha(title)>0);
  if(paid.length)return fail(`${paid.length} título(s) desta quinzena já têm pagamento conciliado. Desfaça a conciliação antes de reabrir.`);
  if(open.some(title=>isDateInClosedPeriod(data,title.vencimento)))return fail("O vencimento da folha cai em período financeiro fechado.");
  const ids=new Set(open.map(title=>title.id));
  return {
    ok:true,entityId:periodKey,
    data:{...data,titulosFolha:(data.titulosFolha||[]).map(title=>ids.has(title.id)?{
      ...title,status:"cancelado",motivoCancelamento:reason,canceladoEm:now,
      canceladoPorId:String(command.actorId||""),canceladoPor:String(command.actorName||""),
      version:versionOf(title)+1,
    }:title)},
  };
};

export const applyPayrollClosingCommand=(data={},command={},now=new Date().toISOString())=>{
  if(!PAYROLL_CLOSING_COMMAND_TYPES.has(command.type))return null;
  return command.type===PAYROLL_CLOSING_COMMAND.PAYROLL_FORTNIGHT_CLOSED
    ? closeFortnight(data,command,now)
    : reopenFortnight(data,command,now);
};
