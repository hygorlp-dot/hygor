const PREFIX = "marcell:third-measurement-draft:v1:";

export function measurementDraftKey({companyId="",userId,obraId,contractId,editId=""} = {}) {
  if (!userId || !obraId || !contractId) return null;
  return PREFIX + JSON.stringify([String(companyId),String(userId),String(obraId),String(contractId),String(editId)]);
}

const storageOf = storage => storage ?? globalThis.localStorage;
const failure = () => ({ok:false,error:"Não foi possível salvar o rascunho neste aparelho. Mantenha esta tela aberta e tente novamente."});

export function readMeasurementDraft(scope, storage) {
  const key = measurementDraftKey(scope);
  if (!key) return {ok:false,error:"Identifique o usuário e o contrato para salvar um rascunho."};
  try {
    const raw = storageOf(storage).getItem(key);
    if (!raw) return {ok:true,draft:null};
    const draft = JSON.parse(raw);
    if (draft?.version !== 1 || draft.key !== key || !draft.measurementId || !draft.form
      || typeof draft.form.pcts !== "object" || !Array.isArray(draft.form.fotos)) {
      return {ok:false,error:"O rascunho salvo não pôde ser recuperado. Descarte-o para iniciar uma nova medição."};
    }
    return {ok:true,draft};
  } catch { return {ok:false,error:"Não foi possível ler o rascunho deste aparelho. Verifique o armazenamento do navegador."}; }
}

export function saveMeasurementDraft(scope, draft, storage) {
  const key = measurementDraftKey(scope);
  if (!key) return failure();
  try {
    const record = {...draft,key,version:1,updatedAt:new Date().toISOString()};
    storageOf(storage).setItem(key,JSON.stringify(record));
    return {ok:true,updatedAt:record.updatedAt};
  } catch { return failure(); }
}

export function removeMeasurementDraft(scope, storage) {
  const key = measurementDraftKey(scope);
  if (!key) return {ok:false,error:"Rascunho não identificado."};
  try { storageOf(storage).removeItem(key); return {ok:true}; }
  catch { return {ok:false,error:"Não foi possível remover o rascunho deste aparelho."}; }
}
