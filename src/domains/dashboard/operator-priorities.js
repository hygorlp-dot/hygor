// @ts-check
import { contar } from "../../design-system/copy.js";
import { allowedTabsForUser } from "../administracao/abas-acesso.js";
import { statusRecebimentoMedicao } from "../conciliacao/index.js";
import { attStatus } from "../ponto/attendance-engine.js";
import { isValidAttendanceStatus } from "../ponto/attendance-status.js";
import { resolveEmployeeAttendanceObraId } from "../ponto/permissions.js";
import { dashboardActiveWorks } from "./gestao-a-vista.js";
import { priorityContext } from "./priority-context.js";

/** @typedef {string|number} RecordId */
/** @typedef {{id?: RecordId, role?: string, obraId?: RecordId, nome?: string, accessTabs?: string[]|null}} DashboardUser */
/** @typedef {{id: RecordId, name?: string, status?: string, engineerId?: RecordId, engineer?: string}} DashboardWork */
/** @typedef {{obraId?: RecordId, status?: string}} WorkRecord */
/** @typedef {{id: RecordId, obra?: RecordId, active?: boolean, pixKey?: string, dailyRate?: string|number}} DashboardEmployee */
/** @typedef {{status?: string, obraId?: RecordId, responsavelAjusteId?: RecordId, impacto?: string, fotos?: {tipo?: string}[]}} DashboardFinding */
/**
 * @typedef {object} DashboardData
 * @property {DashboardWork[]} [obras]
 * @property {(WorkRecord & {data?: string})[]} [rdos]
 * @property {DashboardEmployee[]} [employees]
 * @property {(WorkRecord & {responsavelId?: RecordId})[]} [qualidadeRegistros]
 * @property {{obraId?: RecordId, responsavelId?: RecordId, pendencias?: DashboardFinding[]}[]} [conferencias]
 * @property {(WorkRecord & {prioridade?: string, necessidade?: string})[]} [solicitacoesCompra]
 * @property {(WorkRecord & {previsao?: string})[]} [pedidos]
 * @property {WorkRecord[]} [transacoes]
 * @property {(WorkRecord & {divergencias?: unknown[]})[]} [notasFiscais]
 * @property {(WorkRecord & {dataVencimento?: string, [key:string]: unknown})[]} [medicoes]
 * @property {{atividades?: {status?: string, responsavelId?: RecordId, dataHora?: string}[], leads?: {etapa?: string, responsavelId?: RecordId, proximaAtividadeEm?: string}[]}} [comercial]
 */
/** @typedef {ReturnType<typeof priorityContext>} PriorityContext */
/** @typedef {{id: string, setor: string, titulo: string, detalhe: string, quantidade: number, severidade: 1|2|3, tab: string, icon: string, color: string} & Partial<PriorityContext>} OperatorPriority */
/** @typedef {{blue: string, orange: string, purple: string, red: string, yellowD: string, green: string}} PriorityColors */

/**
 * @param {DashboardData} data
 * @param {DashboardUser|null|undefined} currentUser
 * @returns {DashboardWork[]}
 */
export const obrasDoDiarioNoDashboard=(data,currentUser)=>{
  const role=currentUser?.role,userId=currentUser?.id;
  const obrasAtivas=/** @type {DashboardWork[]} */ (dashboardActiveWorks(data,currentUser?.obraId));
  if(currentUser?.obraId||role!=="engenheiro")return obrasAtivas;
  const atribuidas=obrasAtivas.filter(o=>(userId&&o.engineerId===userId)||(currentUser?.nome&&o.engineer===currentUser.nome));
  return atribuidas.length?atribuidas:obrasAtivas;
};

/**
 * @param {DashboardData} data
 * @param {DashboardUser|null|undefined} currentUser
 * @param {PriorityColors} C
 * @param {string} hoje
 * @returns {OperatorPriority[]}
 */
export const construirFilaOperador=(data,currentUser,C,hoje)=>{
  const role=currentUser?.role||"visualizador",userId=currentUser?.id||"";
  const acessos=new Set(allowedTabsForUser(currentUser));
  const escopoEngenharia=obrasDoDiarioNoDashboard(data,currentUser);
  /** @type {Set<RecordId|undefined>} */
  const idsObras=new Set(escopoEngenharia.map(o=>o.id));
  const workNames=new Map((data.obras||[]).filter(o=>!currentUser?.obraId||String(o.id)===String(currentUser.obraId)).map(o=>[String(o.id),o.name]));
  /** @type {OperatorPriority[]} */
  const fila=[];
  /** @type {(id: string, setor: string, titulo: string, detalhe: string, quantidade: number, severidade: 1|2|3, tab: string, icon: string, color: string, contexto?: PriorityContext) => void} */
  const incluir=(id,setor,titulo,detalhe,quantidade,severidade,tab,icon,color,contexto)=>{
    if(!quantidade||!acessos.has(tab))return;
    fila.push({id,setor,titulo,detalhe,quantidade,severidade,tab,icon,color,...contexto});
  };

  if(role==="admin"||["engenheiro","engenheiro_auditor"].includes(role)||acessos.has("rdo")){
    const diariosConcluidos=new Set((data.rdos||[]).filter(r=>r.data===hoje&&r.status==="concluido").map(r=>String(r.obraId)));
    const semRdo=escopoEngenharia.filter(o=>!diariosConcluidos.has(String(o.id)));
    incluir("rdo-hoje","Engenharia","Diário de obra do dia",`${contar(semRdo.length,"obra","obras")} sem diário concluído`,semRdo.length,2,"rdo","clipboard",C.blue,
      priorityContext(semRdo.map(o=>({obraId:o.id})),workNames,()=>hoje,"Referência"));
    const equipe=(data.employees||[]).filter(e=>e.active!==false&&(!idsObras.size||idsObras.has(e.obra)));
    const semPonto=equipe.filter(e=>!isValidAttendanceStatus(attStatus(data,e.id,hoje)));
    incluir("ponto-hoje","Campo","Apontamentos de equipe incompletos",`${semPonto.length} de ${contar(equipe.length,"profissional","profissionais")} sem situação registrada hoje`,semPonto.length,semPonto.length===equipe.length?3:2,"ponto","clock",C.orange,
      priorityContext(semPonto.map(employee=>({obraId:resolveEmployeeAttendanceObraId({data,employee,date:hoje,record:null})})),workNames,()=>hoje,"Referência"));
    const fichas=(data.qualidadeRegistros||[]).filter(q=>idsObras.has(q.obraId)&&q.status!=="aprovada"&&(role==="admin"||!q.responsavelId||q.responsavelId===userId));
    incluir("qualidade","Qualidade","FVS/FVM aguardando inspeção",`${contar(fichas.filter(q=>q.status==="reprovada").length,"ficha reprovada","fichas reprovadas")} a corrigir`,fichas.length,fichas.some(q=>q.status==="reprovada")?3:1,"obras","check",C.purple,priorityContext(fichas,workNames));
    const patologias=(data.conferencias||[]).flatMap(c=>(c.pendencias||[]).filter(p=>p.status!=="resolvida"&&(role==="admin"||(role==="engenheiro_auditor"&&c.responsavelId===userId)||(role==="engenheiro"&&p.responsavelAjusteId===userId))).map(p=>({...p,obraId:c.obraId})));
    incluir("patologias","Qualidade","Patologias e inconformidades abertas",`${contar(patologias.filter(p=>p.impacto==="critico").length,"crítica","críticas")} · ${patologias.filter(p=>!(p.fotos||[]).some(f=>f.tipo==="ajuste")).length} aguardando foto`,patologias.length,patologias.some(p=>p.impacto==="critico")?3:2,"conferencia","alert",C.red,priorityContext(patologias,workNames));
  }

  if(role==="admin"||role==="compras"||acessos.has("cmp")){
    const solicitacoes=(data.solicitacoesCompra||[]).filter(s=>(/** @type {(string|undefined)[]} */ (["enviada","em_analise"])).includes(s.status));
    const urgentes=solicitacoes.filter(s=>s.prioridade==="urgente").length;
    const volume=urgentes?contar(urgentes,"urgente","urgentes"):contar(solicitacoes.length,"solicitação","solicitações");
    incluir("solicitacoes","Compras","Solicitações aguardando processamento",`${volume} para cotar ou transformar em pedido`,solicitacoes.length,urgentes?3:2,"cmp","cart",C.orange,
      priorityContext(solicitacoes,workNames,s=>s.necessidade,"Data necessária mais antiga"));
    const pedidos=(data.pedidos||[]).filter(p=>!(/** @type {(string|undefined)[]} */ (["recebido","cancelado"])).includes(p.status));
    incluir("pedidos","Compras","Pedidos ainda não concluídos",`${pedidos.filter(p=>p.status==="parcial").length} com recebimento parcial`,pedidos.length,pedidos.some(p=>p.status==="parcial")?2:1,"cmp","box",C.yellowD,
      priorityContext(pedidos,workNames,p=>p.previsao,"Previsão mais antiga"));
  }

  if(role==="admin"||role==="financeiro"||acessos.has("conc")){
    const conciliacoes=(data.transacoes||[]).filter(t=>t.status==="pendente");
    incluir("conciliacao","Financeiro","Movimentos sem conciliação",`${contar(conciliacoes.length,"lançamento","lançamentos")} ainda sem obra/categoria confirmada`,conciliacoes.length,conciliacoes.length>10?3:2,"conc","receipt",C.purple);
    const notas=(data.notasFiscais||[]).filter(n=>n.status==="recebida");
    incluir("fiscal","Financeiro","Notas aguardando conferência",`${contar(notas.filter(n=>n.divergencias?.length).length,"documento","documentos")} com divergência de pedido ou recebimento`,notas.length,notas.some(n=>n.divergencias?.length)?3:2,"fin","fileText",C.red,priorityContext(notas,workNames));
    const med=(data.medicoes||[]).filter(m=>statusRecebimentoMedicao(m)!=="recebida"&&(!m.dataVencimento||m.dataVencimento<=hoje));
    incluir("medicoes","Financeiro","Medições a receber",contar(med.filter(m=>m.dataVencimento&&m.dataVencimento<hoje).length,"vencida","vencidas"),med.length,med.some(m=>m.dataVencimento&&m.dataVencimento<hoje)?3:1,"medicoes","ruler",C.green,
      priorityContext(med,workNames,m=>m.dataVencimento,"Vencimento mais antigo"));
  }

  if(role==="admin"||role==="rh"||acessos.has("ponto_geral")){
    const ativos=(data.employees||[]).filter(e=>e.active!==false);
    const semPonto=ativos.filter(e=>!isValidAttendanceStatus(attStatus(data,e.id,hoje)));
    incluir("rh-ponto","RH","Fechamento diário do ponto",`${semPonto.length} de ${contar(ativos.length,"cadastro","cadastros")} sem apontamento`,semPonto.length,semPonto.length===ativos.length?3:2,"ponto_geral","users",C.green,
      priorityContext(semPonto.map(employee=>({obraId:resolveEmployeeAttendanceObraId({data,employee,date:hoje,record:null})})),workNames,()=>hoje,"Referência"));
    const incompletos=ativos.filter(e=>!e.pixKey||!e.dailyRate||!e.obra);
    incluir("rh-cadastro","RH","Cadastros de equipe incompletos",`${incompletos.filter(e=>!e.pixKey).length} sem PIX · ${incompletos.filter(e=>!e.obra).length} sem lotação`,incompletos.length,1,"equipe","user",C.blue);
  }

  if(role==="admin"||role==="comercial"||acessos.has("com_tarefas")){
    const atividades=(data.comercial?.atividades||[]).filter(a=>a.status!=="concluida"&&(role==="admin"||!a.responsavelId||a.responsavelId===userId));
    const atrasadas=atividades.filter(a=>a.dataHora&&a.dataHora<new Date().toISOString());
    incluir("comercial-atividades","Comercial","Follow-ups e atividades pendentes",`${contar(atrasadas.length,"atividade","atividades")} fora do prazo`,atividades.length,atrasadas.length?3:1,"com_tarefas","funnel",C.green);
    const leads=(data.comercial?.leads||[]).filter(l=>!(/** @type {(string|undefined)[]} */ (["perdido","arquivado","transferido"])).includes(l.etapa)&&(role==="admin"||!l.responsavelId||l.responsavelId===userId)&&!l.proximaAtividadeEm);
    incluir("comercial-leads","Comercial","Leads sem próximo passo",`${contar(leads.length,"oportunidade","oportunidades")} precisam de data e ação definida`,leads.length,2,"com_leads","target",C.orange);
  }
  return fila.sort((a,b)=>b.severidade-a.severidade||b.quantidade-a.quantidade);
};
