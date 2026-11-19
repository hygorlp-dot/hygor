const fields=new Set(['obraId','obra_id','projectId','project_id','workId','obraAtualId','obraOrigemId','obraDestinoId','origemObraId','destinoObraId']);

// Also rejects old whole-company snapshots carried by clients that were open
// before the cutover. The caller cannot reinsert a transferred project's ID.
export function assertCompanyProjectScope(value,projectCompanies,companyId){
  if(!projectCompanies)return;
  const visit=(node,parent='')=>{
    if(!node||typeof node!=='object')return;
    for(const [key,item] of Object.entries(node)){
      const isReference=fields.has(key)||key==='obra'||key==='lastObra'||key==='id'&&parent==='obras';
      if(isReference&&typeof item==='string'&&Object.hasOwn(projectCompanies,item)&&projectCompanies[item]!==companyId){
        throw Object.assign(new Error('A edição contém uma obra de outra empresa. Atualize os dados da empresa selecionada antes de continuar.'),{status:403,code:'FOREIGN_COMPANY_PROJECT'});
      }
      if(item&&typeof item==='object')visit(item,Array.isArray(node)?parent:key);
    }
  };
  visit(value);
}
