// Projeção de leitura do blob legado. Enquanto os domínios ainda compartilham
// um único documento, a fronteira de segurança precisa existir no servidor:
// esconder menus no React não impede que o navegador leia o JSON inteiro.

const ROLE_SECTIONS = Object.freeze({
  engenheiro:["obras","condominios","licencas","orcamentos","budgetBaselines","planos","rdos","conferencias","qualidadeRegistros","medicoesObra","medicoesTecnicas","materiais","estoque","movEstoque","solicitacoesCompra","pedidos","cotacoes","fornecedores","terceirizados","equipamentos","locacoesEquip","employees","attendance","attendanceLocks","unlockRequests","caixaObra","baseFavoritos","composicoesEmpresa","suprimentosConfig","curvaAbcSnapshots","planosSuprimento","marcosSuprimento","alertasSuprimento","reservasEstoque"],
  engenheiro_auditor:["obras","condominios","licencas","orcamentos","budgetBaselines","planos","rdos","conferencias","qualidadeRegistros","medicoesObra","medicoesTecnicas","materiais","estoque","movEstoque","solicitacoesCompra","pedidos","cotacoes","fornecedores","terceirizados","equipamentos","locacoesEquip","employees","attendance","attendanceLocks","unlockRequests","caixaObra","baseFavoritos","composicoesEmpresa","suprimentosConfig","curvaAbcSnapshots","planosSuprimento","marcosSuprimento","alertasSuprimento","reservasEstoque"],
  compras:["obras","materiais","estoque","movEstoque","solicitacoesCompra","pedidos","cotacoes","fornecedores","notasFiscais","equipamentos","baseFavoritos","planos","suprimentosConfig","curvaAbcSnapshots","planosSuprimento","marcosSuprimento","alertasSuprimento","reservasEstoque"],
  financeiro:["obras","equipamentos","locacoesEquip","terceirizados","pagsTerceiros","payments","medicoes","outrasDesp","despesasEmpresa","caixaObra","notasFiscais","documentosMovimentacoes","transacoes","reconciliationLinks","orcamentos","budgetBaselines","pedidos","fornecedores","titulosFolha","pagamentosFolha","rescisoes","quinzenasArquivadas","archivedLaborCosts","employees","attendance","medicoesObra","fechamentosFinanceiros"],
  rh:["obras","employees","attendance","attendanceLocks","unlockRequests","advances","titulosFolha","pagamentosFolha","rescisoes","quinzenasArquivadas","archivedLaborCosts","terceirizados"],
  comercial:["obras","comercial"],
  visualizador:["obras"],
});

const sanitizeObra = obra => {
  const { portalCliente, oneDriveDriveId, oneDriveFolderId, oneDriveFolders, oneDriveUrl, ...safe } = obra || {};
  return safe;
};
const sanitizeUser = (user, self = false) => {
  const { pin, authUserId, email, maxDesconto, ...safe } = user || {};
  return self ? { ...safe, email: email || "", maxDesconto:Number(maxDesconto || 0) } : safe;
};
const sanitizeEmployee = (employee, role = "") => {
  if(role === "rh") return employee;
  // Engenharia, compras e financeiro precisam da identificação operacional,
  // não de documentos pessoais ou coordenadas bancárias do colaborador.
  const {
    cpf,rg,pis,ctps,email,telefone,phone,celular,endereco,address,
    banco,agencia,conta,contaBancaria,bankAccount,bankAgency,...safe
  }=employee||{};
  return safe;
};
const hasObra = (item, allowed) => !allowed.size || allowed.has(String(item?.obraId || item?.obra || ""));
const filterByObra = (value, allowed) => Array.isArray(value) ? value.filter(item => hasObra(item, allowed)) : value;

export const projectDataForUser = (payload = {}, user = {}) => {
  if (user.role === "admin") return payload;
  const allowedSections = new Set(ROLE_SECTIONS[user.role] || []);
  const allowedObras = new Set(user.obraId ? [String(user.obraId)] : []);
  const out = {};

  // Apenas o perfil atual traz preferências de acesso; hashes, e-mails de
  // terceiros e identificadores de autenticação nunca atravessam a API.
  out.usuarios = (payload.usuarios || [])
    .filter(item => item.id === user.id || !allowedObras.size || String(item.obraId || "") === String(user.obraId))
    .map(item => sanitizeUser(item, item.id === user.id));

  for (const key of allowedSections) {
    const value = payload[key];
    if (value === undefined) continue;
    if (key === "obras") { out.obras = (value || []).filter(item => hasObra({ obraId:item.id }, allowedObras)).map(sanitizeObra); continue; }
    if (key === "employees") { out.employees=(value||[]).filter(item=>hasObra(item,allowedObras)).map(item=>sanitizeEmployee(item,user.role)); continue; }
    if (key === "attendance") {
      const permittedEmployees = new Set((payload.employees || []).filter(item => hasObra(item, allowedObras)).map(item => String(item.id)));
      // A lotação do colaborador não basta: ele pode ter apontamentos em mais
      // de uma obra. Filtra cada dia para não revelar produção de outra obra.
      out.attendance = Object.fromEntries(Object.entries(value || {}).flatMap(([employeeId,days])=>{
        if(!permittedEmployees.has(String(employeeId)))return [];
        const scopedDays=Object.fromEntries(Object.entries(days||{}).filter(([,record])=>
          typeof record!=="object"||record===null||(!record.obraId&&!record.obra)||hasObra(record,allowedObras)));
        return Object.keys(scopedDays).length?[[employeeId,scopedDays]]:[];
      }));
      continue;
    }
    if (key === "comercial") {
      out.comercial = Object.fromEntries(Object.entries(value || {}).map(([name, records]) => [name, Array.isArray(records)
        ? records.filter(record => !record.responsavelId || record.responsavelId === user.id || hasObra(record, allowedObras)) : records]));
      continue;
    }
    out[key] = filterByObra(value, allowedObras);
  }
  return out;
};

export const publicUser = user => ({
  id:user.id, nome:user.nome, role:user.role, email:user.email || "", obraId:user.obraId || "",
  accessTabs:Array.isArray(user.accessTabs) ? user.accessTabs : null,
});
