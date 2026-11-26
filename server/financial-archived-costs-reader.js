import { currentCompany } from "./company-context.js";
import { archivedLaborKeys, rebuildArchivedLaborCosts } from "./financial-archived-costs-source.js";

export function createArchivedLaborReader({ db, key: KEY }) {
  const carregarCustosArquivados = async payload => {
    const expected=archivedLaborKeys(payload,KEY);
    if(!expected.length)return {data:{...payload,archivedLaborCosts:{}},missing:[],rebuilt:0};
    const {data:linhas,error}=await db.from("company_app_data")
      .select("key,value").eq("company_id",currentCompany()).in("key",expected.map(item=>item.key));
    if(error)throw error;
    return rebuildArchivedLaborCosts({data:payload,archiveRows:linhas||[],key:KEY});
  };

  const anexarCustosArquivados = async payload =>
    (await carregarCustosArquivados(payload)).data;

  const exigirCustosArquivados = async payload => {
    const rebuilt=await carregarCustosArquivados(payload);
    if(rebuilt.missing.length){
      const error=new Error("Existem quinzenas arquivadas sem o arquivo imutável correspondente.");
      error.code="ARCHIVED_LABOR_SOURCE_MISSING";
      error.missing=rebuilt.missing;
      throw error;
    }
    return rebuilt.data;
  };

  const carregarCustosArquivadosNaTransacao=async(transaction,payload)=>{
    const expected=archivedLaborKeys(payload,KEY);
    if(!expected.length)return {data:{...payload,archivedLaborCosts:{}},missing:[],rebuilt:0};
    // O fechamento já trava a core antes daqui. Arquivar/restaurar quinzena
    // também precisa da core, então os marcadores não podem mudar enquanto
    // esta fotografia lê os arquivos imutáveis.
    const linhas=await transaction`
      select key,value
        from company_app_data
       where company_id=${currentCompany()}
         and key like ${`${KEY}__arq__%`}
       order by key
    `;
    return rebuildArchivedLaborCosts({data:payload,archiveRows:linhas||[],key:KEY});
  };

  return { anexarCustosArquivados, exigirCustosArquivados, carregarCustosArquivadosNaTransacao };
}
