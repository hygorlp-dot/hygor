import { useCallback, useRef, useState } from "react";

export function usePurchaseSave(rawDispatch) {
  const lock = useRef(false);
  const [save, setSave] = useState({ state:"idle", message:"As alterações são confirmadas pelo servidor." });
  const dispatch = useCallback(async command => {
    if (lock.current) return {ok:false, reason:"Há uma operação sendo salva. Aguarde a confirmação."};
    lock.current = true;
    setSave({state:"saving",message:"Salvando… Aguarde a confirmação do servidor."});
    try {
      const result = await rawDispatch(command);
      setSave(result?.ok === true ? {state:"saved", message:"Salvo e confirmado pelo servidor."}
        : {state:"error", message:result?.reason || "Falha ao salvar. Seus dados continuam abertos; tente novamente."});
      return result;
    } catch {
      const reason = "Falha de conexão ao salvar. Confira sua conexão e tente novamente no formulário.";
      setSave({state:"error",message:reason});
      return {ok:false,reason};
    } finally { lock.current = false; }
  }, [rawDispatch]);
  return { save, dispatch:rawDispatch ? dispatch : null };
}
