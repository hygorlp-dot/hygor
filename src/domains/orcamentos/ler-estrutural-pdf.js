// Lê um PDF de projeto (estrutural, por enquanto) e devolve o texto puro -
// quem interpreta esse texto em sapatas, vigas etc. é o módulo de extração
// correspondente (ex.: estrutural-pdf-extrator.js), mantido separado e sem
// nenhuma dependência de PDF para ficar testável com uma string comum.
//
// NÃO embrulha isto num Worker próprio (ao contrário do SINAPI/ORSE): o
// pdf.js já gerencia seu próprio worker internamente via
// GlobalWorkerOptions.workerSrc. Rodar getDocument() de dentro de OUTRO
// worker nosso quebrava silenciosamente esse mecanismo - o pdf.js detecta
// que já está num contexto de worker e usa um modo interno de "worker falso"
// que também depende de self.onmessage, colidindo com o handler do nosso
// próprio worker (raiz real do "Não foi possível interpretar o PDF." visto
// em produção). Chamado do fluxo principal, o trabalho pesado ainda roda
// fora da thread principal - só que no worker do PRÓPRIO pdf.js, não no
// nosso.
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
// `?url` é o padrão do Vite para pegar a URL final de um asset de um pacote
// (node_modules) sem depender de caminho relativo manual.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function lerTextoPdf(arquivo) {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  let documento;
  try {
    documento = await getDocument({ data: bytes }).promise;
  } catch (error) {
    throw new Error(error?.message || "Não foi possível abrir o PDF. Confirme se o arquivo não está corrompido.");
  }
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
