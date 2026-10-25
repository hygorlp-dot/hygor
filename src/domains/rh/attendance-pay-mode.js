import {validateCPF} from '../data/brazilian-documents.js';
import {validDate} from './date-validation.js';
import {getQ} from '../ponto/attendance-engine.js';

export function payModeRegistrationIssues(employee,mode,effectiveFrom){
  if(!employee)return ['Selecione um funcionário cadastrado.'];
  const issues=[];
  if(!employee.name?.trim())issues.push('Nome completo');
  if(!validateCPF(employee.cpf))issues.push('CPF válido');
  if(!employee.role?.trim())issues.push('Função');
  if(!validDate(employee.startDate))issues.push('Data de admissão');
  if(!employee.phone?.trim())issues.push('Telefone');
  if(employee.workArea!=='administrativo'&&!employee.obra)issues.push('Lotação na obra ou área administrativa');
  if(!(Number(employee.dailyRate)>0))issues.push('Valor da diária / referência para custeio');
  if(!(Number(employee.workdayHours)>0)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(employee.workStart||''))issues.push('Jornada e horário de início');
  if(!(employee.pixKey?.trim()&&employee.pixHolder?.trim()&&employee.pixType?.trim())&&String(employee.paymentInstructions||'').trim().length<10)issues.push('Dados PIX completos ou instrução de pagamento');
  if(mode==='clt'){
    if(!(Number(employee.monthlySalary)>0))issues.push('Salário contratual mensal');
    if(!employee.cltPayroll?.profile?.registration?.trim())issues.push('Matrícula');
    if(!/^\d{6}$/.test(String(employee.cltPayroll?.profile?.cbo||'').replace(/\D/g,'')))issues.push('CBO (seis dígitos)');
    if(!['professional','helper'].includes(employee.cltPayroll?.profile?.category))issues.push('Categoria na CCT');
    if(!validDate(employee.examExpiresAt)||employee.examExpiresAt<effectiveFrom)issues.push('Validade do ASO na vigência escolhida');
  }
  return issues;
}
export function latestClosedPayrollDate(data,employee){
  const dates=[];
  for(const [period,draft] of Object.entries(employee?.cltPayroll?.drafts||{}))if(draft.confirmed&&/^\d{4}-\d{2}$/.test(period))dates.push(new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7)),0)).toISOString().slice(0,10));
  for(const [key,archive] of Object.entries(data.quinzenasArquivadas||{})){
    if(validDate(archive.fim)){dates.push(archive.fim);continue;}
    const match=/^(\d{4})-(\d{2})-Q([12])$/.exec(key);if(match){const q=getQ(Number(match[1]),Number(match[2])-1);dates.push((match[3]==='1'?q.q1:q.q2).at(-1));}
  }
  for(const title of data.titulosFolha||[])if(String(title.employeeId)===String(employee.id)&&!['cancelado','cancelada','estornado','estornada'].includes(title.status)){
    if(validDate(title.periodoFim))dates.push(title.periodoFim);
    else if(/^\d{4}-(0[1-9]|1[0-2])$/.test(title.competencia))dates.push(new Date(Date.UTC(Number(title.competencia.slice(0,4)),Number(title.competencia.slice(5,7)),0)).toISOString().slice(0,10));
  }
  return dates.sort().at(-1)||'';
}
export function attendancePayModeDecision(data,command,now){
  const {employeeId,mode,effectiveFrom,reason}=command.payload||{};
  const employee=(data.employees||[]).find(e=>String(e.id)===String(employeeId));
  if(!employee)return {ok:false,reason:'Funcionário não encontrado.'};
  if(!['daily','clt'].includes(mode))return {ok:false,reason:'Modalidade inválida.'};
  if(!validDate(effectiveFrom)||effectiveFrom<employee.startDate)return {ok:false,reason:'Informe uma vigência válida, igual ou posterior à admissão.'};
  if(employee.active===false||employee.endDate&&employee.endDate<effectiveFrom)return {ok:false,reason:'O funcionário não tem vínculo ativo na vigência escolhida.'};
  const missing=payModeRegistrationIssues(employee,mode,effectiveFrom);
  if(missing.length)return {ok:false,reason:`Complete o cadastro: ${missing.join('; ')}.`};
  const closed=latestClosedPayrollDate(data,employee);
  if(closed&&effectiveFrom<=closed)return {ok:false,reason:`A vigência deve ser posterior a ${closed}; folhas fechadas são preservadas.`};
  if(mode===(employee.remunerationMode||'daily'))return {ok:false,reason:'Esta modalidade já está definida no cadastro.'};
  if(String(reason||'').trim().length<10)return {ok:false,reason:'Registre a justificativa contratual da alteração (ao menos 10 caracteres).'};
  const decisions=[...(employee.payModeDecisions||[]),{mode,effectiveFrom,reason:String(reason).trim().slice(0,1000),changedAt:now,changedBy:command.actorId,source:'attendance'}];
  return {ok:true,employee:{...employee,remunerationMode:mode,remunerationEffectiveFrom:effectiveFrom,payModeDecisions:decisions}};
}
