// @ts-check
import { resolveEmployeeAttendanceObraId } from "../ponto/permissions.js";

/**
 * @typedef {{
 *   id?: string, obraId?: string, obra?: string, obraAtualId?: string,
 *   paraObraId?: string, deObraId?: string, employeeId?: string,
 *   funcionarioId?: string, tercId?: string, terceirizadoId?: string
 * }} WorkRecord
 *
 * @typedef {Record<string, unknown> & {
 *   obras?: WorkRecord[],
 *   employees?: (WorkRecord & {id: string})[],
 *   terceirizados?: WorkRecord[],
 *   equipamentos?: WorkRecord[],
 *   advances?: WorkRecord[],
 *   rescisoes?: WorkRecord[],
 *   attendance?: Record<string, Record<string, unknown>>
 * }} WorkSnapshot
 */

const CHAVES_ISOLADAS_OBRA=[
  "payments","medicoes","outrasDesp","caixaObra","notasFiscais","orcamentos",
  "conferencias","qualidadeRegistros","solicitacoesCompra","terceirizados",
  "medicoesTerc","contratosTerc","pagsTerceiros","planos","rdos","pedidos",
  "cotacoes","movEstoque","transacoes","licencas","locacoesEquip",
  "jobRiskAnalyses","workPermits","lookaheadWindows",
];

/**
 * @param {WorkRecord | null | undefined} registro
 * @param {string} obraId
 * @param {ReadonlySet<string | undefined>} idsFuncionarios
 * @param {ReadonlySet<string | undefined>} idsTerceiros
 */
const registroPertenceObra=(registro,obraId,idsFuncionarios=new Set(),idsTerceiros=new Set())=>{
  if(!registro||typeof registro!=="object")return false;
  if(registro.obraId!==undefined)return registro.obraId===obraId;
  if(registro.obra!==undefined)return registro.obra===obraId;
  if(registro.paraObraId!==undefined||registro.deObraId!==undefined)
    return registro.paraObraId===obraId||registro.deObraId===obraId;
  if(registro.employeeId!==undefined||registro.funcionarioId!==undefined)
    return idsFuncionarios.has(registro.employeeId||registro.funcionarioId);
  if(registro.tercId!==undefined||registro.terceirizadoId!==undefined)
    return idsTerceiros.has(registro.tercId||registro.terceirizadoId);
  return false;
};

/** @param {WorkSnapshot} data @param {string} obraId */
export function dadosDaObraIsolados(data,obraId){
  const funcionarios=(data.employees||[]).filter(e=>e.obra===obraId||
    Object.entries(data.attendance?.[e.id]||{}).some(([date,record])=>
      resolveEmployeeAttendanceObraId({data,employee:e,date,record})===obraId));
  const terceiros=(data.terceirizados||[]).filter(t=>t.obraId===obraId);
  /** @type {ReadonlySet<string | undefined>} */
  const idsFuncionarios=new Set(funcionarios.map(e=>e.id));
  const idsTerceiros=new Set(terceiros.map(t=>t.id));
  /** @type {WorkSnapshot} */
  const isolado={...data,obras:(data.obras||[]).filter(o=>o.id===obraId),employees:funcionarios,terceirizados:terceiros};
  CHAVES_ISOLADAS_OBRA.forEach(chave=>{
    const registros=data[chave];
    if(!Array.isArray(registros))return;
    isolado[chave]=registros.filter(item=>registroPertenceObra(item,obraId,idsFuncionarios,idsTerceiros));
  });
  isolado.equipamentos=(data.equipamentos||[]).filter(e=>!e.obraAtualId||e.obraAtualId===obraId);
  isolado.attendance=Object.fromEntries(Object.entries(data.attendance||{}).filter(([id])=>idsFuncionarios.has(id)));
  isolado.advances=(data.advances||[]).filter(a=>idsFuncionarios.has(a.employeeId||a.funcionarioId));
  isolado.rescisoes=(data.rescisoes||[]).filter(r=>idsFuncionarios.has(r.employeeId||r.funcionarioId));
  return isolado;
}

// Reaplica somente o recorte de uma obra sobre o dataset completo. Mantê-la
// fora do componente permite que callbacks funcionais sejam resolvidos sobre
// a versão mais recente do servidor, sem trazer de volta coleções antigas do
// painel isolado.
/** @param {WorkSnapshot} base @param {WorkSnapshot} proximos @param {string} obraId */
export function recomporDadosDaObra(base,proximos,obraId){
  // Um snapshot do painel traz todas as seções isoladas. Reaplicar as que
  // não mudaram reordena listas financeiras e provoca uma falsa mutação.
  const recorteOriginal=dadosDaObraIsolados(base,obraId);
  proximos=Object.fromEntries(Object.entries(proximos||{}).filter(([chave,valor])=>
    valor!==recorteOriginal[chave] && JSON.stringify(valor)!==JSON.stringify(recorteOriginal[chave])
  ));
  const funcionariosAtuais=(base.employees||[]).filter(e=>e.obra===obraId);
  const terceirosAtuais=(base.terceirizados||[]).filter(t=>t.obraId===obraId);
  /** @type {ReadonlySet<string | undefined>} */
  const idsFuncionarios=new Set(funcionariosAtuais.map(e=>e.id));
  const idsTerceiros=new Set(terceirosAtuais.map(t=>t.id));
  // Ponto é somente leitura neste adaptador; toda escrita usa os comandos
  // granulares e nunca recompõe/substitui a seção attendance.
  /** @type {WorkSnapshot} */
  const resultado={...base,...proximos,attendance:base.attendance};
  /**
   * @param {string} chave
   * @param {(item: WorkRecord) => boolean} predicado
   */
  const recompor=(chave,predicado)=>{
    const novos=proximos[chave];
    if(!Array.isArray(novos))return;
    const originais=/** @type {WorkRecord[]} */ (base[chave]||[]);
    const externos=originais.filter(item=>!predicado(item));
    resultado[chave]=[...externos,...novos];
  };
  recompor("obras",o=>o.id===obraId);
  recompor("employees",e=>e.obra===obraId);
  CHAVES_ISOLADAS_OBRA.forEach(chave=>recompor(chave,item=>registroPertenceObra(item,obraId,idsFuncionarios,idsTerceiros)));
  recompor("equipamentos",e=>!e.obraAtualId||e.obraAtualId===obraId);
  recompor("advances",a=>idsFuncionarios.has(a.employeeId||a.funcionarioId));
  recompor("rescisoes",r=>idsFuncionarios.has(r.employeeId||r.funcionarioId));
  return resultado;
}
