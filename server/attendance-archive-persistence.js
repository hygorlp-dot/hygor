import crypto from "crypto";
import { currentCompany } from "./company-context.js";
import { encodeAppData } from "./data-codec.js";
import { DOMAIN_ROW, pickDomainFields } from "./domain-row-routing.js";

export function createAttendanceArchivePersistence({ db, key: KEY, pontoKey: PONTO_KEY, salvarComAuditoria }) {
  const listArchiveRows = async pattern => {
    const { data, error } = await db.from("company_app_data")
      .select("key, updated_at, value->meta").eq("company_id", currentCompany()).like("key", pattern);
    if (error) throw error;
    return data || [];
  };

  const readArchiveRow = async key => {
    const { data, error } = await db.from("company_app_data")
      .select("value, updated_at").eq("company_id", currentCompany()).eq("key", key).maybeSingle();
    if (error) throw error;
    return data;
  };

  const executarArquivoPontoTransacional=async({
    mode,mainKey=KEY,expectedUpdatedAt,mainValue,archiveKey,archiveValue,actor,before,after,
  })=>{
    const correlationId=crypto.randomUUID();
    const rpc=mode==="archive"?"attendance_archive_transaction":"attendance_restore_transaction";
    const args={
      p_company_id:currentCompany(),p_main_key:mainKey,p_archive_key:archiveKey,
      p_expected_updated_at:expectedUpdatedAt,p_main_value:encodeAppData(mainValue),
      p_actor_id:String(actor?.id||"system"),p_actor_name:String(actor?.nome||actor?.email||"Sistema"),
      p_actor_role:String(actor?.role||""),
      p_correlation_id:correlationId,p_before:before||{},p_after:after||{},
    };
    if(mode==="archive")args.p_archive_value=archiveValue||{};
    const {data,error}=await db.rpc(rpc,args);
    if(error){
      const wrapped=new Error(/PGRST202|schema cache|Could not find the function|does not exist/i.test(`${error.code||""} ${error.message||""}`)
        ?"A migration transacional do arquivo de ponto não foi aplicada."
        :"A transação do arquivo de ponto falhou.");
      wrapped.code=/migration/i.test(wrapped.message)?"ATTENDANCE_ARCHIVE_MIGRATION_REQUIRED":"ATTENDANCE_ARCHIVE_FAILED";
      throw wrapped;
    }
    const result=Array.isArray(data)?data[0]:data;
    return {
      applied:!!result?.applied,updatedAt:result?.updated_at||null,
      reason:String(result?.reason||""),correlationId,
    };
  };

  // Achado de 21/08/2026 (limitação documentada duas vezes sem correção -
  // ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): o arquivamento/restauração de
  // ponto sempre grava `attendance` na linha core (`p_main_key=KEY`, sem
  // roteamento por domínio), porque tornar attendance_archive_transaction/
  // attendance_restore_transaction (já uma RPC de duas chaves) ciente de um
  // terceiro alvo (a linha de Ponto) exigiria uma nova migration
  // transacional de três chaves - risco maior do que o benefício justifica
  // para uma ação rara (admin, periódica, não concorrente com o check-in
  // normal). Em vez disso, esta segunda escrita best-effort sincroniza a
  // cópia de `attendance` na linha própria de Ponto logo depois que a
  // transação principal já confirmou o arquivamento/restauração - fecha a
  // lacuna que fazia a leitura (que sempre prioriza a linha de Ponto sobre a
  // core para esse campo) ignorar o resultado. Se essa segunda escrita
  // falhar (ex.: conflito de versão por um check-in concorrente
  // raríssimo), o arquivamento em si já está correto e seguro na linha
  // core - só fica registrado no log do servidor, sem bloquear a resposta.
  // Achado de 22/08/2026 (Fase 1.5 reduzida): `attendance` saiu de
  // DOMAIN_FIELDS[PONTO], então pickDomainFields sozinho passou a devolver só
  // os 4 campos meta - esta função silenciosamente deixaria de sincronizar a
  // própria coisa para a qual existe. O arquivamento/restauração não conhece
  // obra por obra (a RPC opera a quinzena inteira, todos os funcionários), só
  // o resultado final consolidado (`novoPrincipal.attendance`, já com o
  // funcionário/data arquivado removido ou restaurado) - dividir esse
  // resultado por obra exigiria diferenciar antes/depois entrada a entrada,
  // risco maior do que uma ação rara e não concorrente justifica (mesma lógica
  // do comentário acima). Em vez disso, grava o blob completo como cópia
  // legada na própria linha de Ponto: para qualquer (funcionário,data) que
  // ainda não migrou para uma linha própria de obra, essa cópia já é a fonte
  // lida por lerLinha(); para quem já migrou, a linha de obra continua
  // vencendo a leitura (mergeAttendanceObjects) - a mesma tolerância de
  // "melhor esforço" que este best-effort já assumia antes desta fase.
  const sincronizarPontoAposArquivo=async({rowVersions,novoPrincipal,actor,quinzenaId,action})=>{
    if(rowVersions?.[DOMAIN_ROW.PONTO]==null)return;
    try{
      await salvarComAuditoria({
        key:PONTO_KEY,expectedUpdatedAt:rowVersions[DOMAIN_ROW.PONTO],
        value:{...pickDomainFields(novoPrincipal,DOMAIN_ROW.PONTO),attendance:novoPrincipal.attendance||{}},
        actor,action,before:{quinzenaId},after:{quinzenaId},
      });
    }catch(err){
      console.error(`Falha ao sincronizar attendance na linha de Ponto apos ${action}:`,err.message);
    }
  };

  return { executarArquivoPontoTransacional, sincronizarPontoAposArquivo, listArchiveRows, readArchiveRow };
}
