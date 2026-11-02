// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { today } from "../../legacy/format.js";
import { C } from "../../legacy/palette.js";
import { diasCorridos } from "../planejamento/legacy-engine.js";


// Prazo da obra: dado contractStart/contractEnd, devolve % de tempo decorrido,
// dias restantes e um rotulo/cor. null se nao ha datas de contrato.
export const prazoObra = (obra) => {
  const ini = obra?.contractStart, fim = obra?.contractEnd;
  if (!ini || !fim) return null;
  const hoje = today();
  const totalDias = diasCorridos(ini, fim);
  if (totalDias <= 0) return null;
  const decorridos = Math.max(0, Math.min(totalDias, diasCorridos(ini, hoje)));
  const pct = (decorridos / totalDias) * 100;
  // Diferenca ASSINADA em dias (negativa se o prazo ja passou). diasCorridos
  // trava em zero, entao calculamos direto aqui.
  const restam = Math.round((new Date(fim + "T00:00:00") - new Date(hoje + "T00:00:00")) / 86400000);
  let rotulo, cor;
  if (restam < 0)      { rotulo = `atrasada ${Math.abs(restam)}d`; cor = C.red; }
  else if (restam === 0) { rotulo = "vence hoje"; cor = C.orange; }
  else if (restam <= 15) { rotulo = `faltam ${restam}d`; cor = C.orange; }
  else                 { rotulo = `faltam ${restam}d`; cor = C.blue; }
  return { pct: Math.min(pct, 100), restam, totalDias, decorridos, rotulo, cor };
};
