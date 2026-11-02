import {describe,expect,it} from "vitest";
import {measurementDraftKey,readMeasurementDraft,removeMeasurementDraft,saveMeasurementDraft} from "./measurement-draft.js";

const scope={companyId:"empresa",userId:"u",obraId:"o",contractId:"c"};
const draft={measurementId:"m",baseSignature:"base",form:{data:"2026-10-31",observacao:"Em campo",pcts:{a:"45"},fotos:[{id:"foto",url:"https://exemplo/foto"}]}};
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};

describe("rascunho local de medição",()=>{
  it("recupera percentuais, observações e referências das fotos após reabrir",()=>{
    const storage=memory();expect(saveMeasurementDraft(scope,draft,storage).ok).toBe(true);
    expect(readMeasurementDraft(scope,storage).draft).toMatchObject(draft);
  });
  it("isola empresa, usuário, obra, contrato e correção",()=>{
    const storage=memory();saveMeasurementDraft(scope,draft,storage);
    for(const field of ["companyId","userId","obraId","contractId","editId"]){
      expect(readMeasurementDraft({...scope,[field]:"outra"},storage).draft).toBeNull();
    }
    expect(measurementDraftKey({...scope,userId:""})).toBeNull();
  });
  it("só remove o rascunho identificado",()=>{
    const storage=memory();saveMeasurementDraft(scope,draft,storage);saveMeasurementDraft({...scope,contractId:"c2"},draft,storage);
    removeMeasurementDraft(scope,storage);
    expect(readMeasurementDraft(scope,storage).draft).toBeNull();
    expect(readMeasurementDraft({...scope,contractId:"c2"},storage).draft).not.toBeNull();
  });
  it("informa falta de espaço sem afirmar que salvou",()=>{
    const storage={setItem:()=>{throw new Error("quota");}};
    expect(saveMeasurementDraft(scope,draft,storage)).toMatchObject({ok:false});
  });
  it("não sobrescreve nem apaga conteúdo corrompido durante a leitura",()=>{
    const storage=memory(),key=measurementDraftKey(scope);storage.setItem(key,"quebrado");
    expect(readMeasurementDraft(scope,storage).ok).toBe(false);
    expect(storage.getItem(key)).toBe("quebrado");
  });
});
