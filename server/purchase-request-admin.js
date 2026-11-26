import { currentCompany } from "./company-context.js";
import { DOMAIN_ROW } from "./domain-row-routing.js";

// A consulta acompanha a gravação ao vivo, sem histórico de sincronização em lote.
export async function handlePurchaseRequestsReport({ db, usuario, res }) {
  if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores consultam a projeção de solicitações de compra."});
  const [{ count, error: countError }, { data: sample, error: sampleError }] = await Promise.all([
    db.from("purchase_requests").select("*", { count: "exact", head: true }).eq("company_id", currentCompany()),
    db.from("purchase_requests").select("*").eq("company_id", currentCompany())
      .order("updated_at", { ascending: false }).limit(10),
  ]);
  if (countError) throw countError;
  if (sampleError) throw sampleError;
  return res.status(200).json({ ok:true, count: count || 0, sample: sample || [] });
}

// A limpeza alcança somente registros de teste na base legada e seus materiais.
// A migration 013 revoga a exclusão direta da tabela relacional purchase_requests.
export async function handlePurchaseRequestTestCleanup({
  req, res, usuario, atual, rowVersions, executarMutacaoEmpresaBloqueada,
}) {
  if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores limpam registros de teste."});
  if(!process.env.POSTGRES_URL_NON_POOLING)return res.status(503).json({error:"A conexão direta do Supabase não está configurada."});
  const id=String(req.body?.id||"");
  if(!id)return res.status(400).json({error:"Informe o id do registro de teste."});
  const outcome=await executarMutacaoEmpresaBloqueada({
    actor:usuario,action:"purchase_request_test_blob_cleanup",
    domain:DOMAIN_ROW.CORE,linha:{payload:atual,rowVersions},
    mutate:async({payload:current})=>{
      const record=(current.solicitacoesCompra||[]).find(item=>String(item?.id)===id);
      if(!record)return {kind:"error",status:404,error:"Registro não encontrado no blob."};
      if(!/^TESTE-/.test(String(record.numero||"")))return {
        kind:"error",status:400,
        error:"Só registros com numero começando em 'TESTE-' podem ser removidos por aqui.",
      };
      const nextData={
        ...current,
        solicitacoesCompra:(current.solicitacoesCompra||[]).filter(item=>String(item?.id)!==id),
        materiais:(current.materiais||[]).filter(item=>String(item?.solicitacaoOrigemId||"")!==id),
      };
      return {kind:"save",data:nextData,before:{purchaseRequestId:id},after:{removed:true}};
    },
  });
  if(outcome.kind==="error")return res.status(outcome.status||400).json({error:outcome.error});
  return res.status(200).json({ ok:true, removed:id });
}
