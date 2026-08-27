// Lê um PDF de projeto estrutural inteiramente no navegador (pdfjs-dist -
// mesmo motivo do worker do SINAPI/ORSE: um PDF de projeto real passa de
// 8MB, não dá para bloquear a tela nem mandar o arquivo inteiro para uma
// function serverless, que tem limite de payload bem menor que isso).
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
// `?url` é o padrão do Vite para pegar a URL final de um asset de um pacote
// (node_modules) sem depender de caminho relativo manual - pdf.worker.mjs é
// um arquivo pronto (sem import próprio para resolver), então só precisa
// ser copiado como asset, não empacotado como o worker do ORSE/SINAPI.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

async function extrairTextoPdf(bytes) {
  const documento = await getDocument({ data: bytes }).promise;
  const paginas = [];
  for (let numero = 1; numero <= documento.numPages; numero++) {
    const pagina = await documento.getPage(numero);
    const conteudo = await pagina.getTextContent();
    // Uma linha por item de texto (mesma granularidade do pdftotext sem
    // -layout, que é o formato usado para desenvolver e validar o parser).
    paginas.push(conteudo.items.map(item => item.str).join("\n"));
  }
  return paginas.join("\n\f\n");
}

self.onmessage = async ({ data }) => {
  try {
    const texto = await extrairTextoPdf(new Uint8Array(data.bytes));
    self.postMessage({ tipo: "concluido", texto });
  } catch (error) {
    self.postMessage({ tipo: "erro", mensagem: error?.message || "Não foi possível ler o PDF." });
  }
};
