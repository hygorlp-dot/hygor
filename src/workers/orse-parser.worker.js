// Worker fino: só decodifica os bytes (latin1) e delega ao motor de
// parsing testável em src/domains/orcamentos/orse-parser.js. Espelha
// src/workers/sinapi-parser.worker.js.
import { decodificarLatin1, montarExtracaoOrse } from "../domains/orcamentos/orse-parser.js";

self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ tipo: "etapa", mensagem: "Lendo TB_INSUMO e TB_INSUMO_PRECO..." });
    const insumoTxt = decodificarLatin1(data.insumo);
    const insumoPrecoTxt = decodificarLatin1(data.insumoPreco);

    self.postMessage({ tipo: "etapa", mensagem: "Lendo TB_SERVICO e TB_SERVICO_PRECO..." });
    const servicoTxt = decodificarLatin1(data.servico);
    const servicoPrecoTxt = decodificarLatin1(data.servicoPreco);

    self.postMessage({ tipo: "etapa", mensagem: "Lendo TB_COMPOSICAO (detalhamento analítico)..." });
    const composicaoTxt = decodificarLatin1(data.composicao);

    self.postMessage({ tipo: "etapa", mensagem: "Organizando composições e insumos..." });
    const extraida = montarExtracaoOrse({ insumoTxt, insumoPrecoTxt, servicoTxt, servicoPrecoTxt, composicaoTxt });
    self.postMessage({ tipo: "concluido", extraida });
  } catch (error) {
    self.postMessage({ tipo: "erro", mensagem: error?.message || "Não foi possível ler os arquivos oficiais do ORSE." });
  }
};
