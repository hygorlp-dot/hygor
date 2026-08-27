import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));

import { getDocument } from "pdfjs-dist";
import { lerTextoPdf } from "./ler-estrutural-pdf";

const arquivoFalso = () => ({ arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer) });

const paginaFalsa = linhas => ({
  getTextContent: () => Promise.resolve({ items: linhas.map(str => ({ str })) }),
});

describe("lerTextoPdf", () => {
  beforeEach(() => { getDocument.mockReset(); });

  it("junta o texto de todas as páginas, uma linha por item", async () => {
    getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: numero => Promise.resolve(paginaFalsa([`página ${numero} linha 1`, `página ${numero} linha 2`])),
      }),
    });
    const texto = await lerTextoPdf(arquivoFalso());
    expect(texto).toContain("página 1 linha 1");
    expect(texto).toContain("página 1 linha 2");
    expect(texto).toContain("página 2 linha 1");
  });

  it("lança um erro claro quando o PDF não abre", async () => {
    getDocument.mockReturnValue({ promise: Promise.reject(new Error("Invalid PDF structure.")) });
    await expect(lerTextoPdf(arquivoFalso())).rejects.toThrow("Invalid PDF structure.");
  });

  it("usa uma mensagem padrão quando o erro do pdf.js não tem texto", async () => {
    getDocument.mockReturnValue({ promise: Promise.reject({}) });
    await expect(lerTextoPdf(arquivoFalso())).rejects.toThrow(/não foi possível abrir o pdf/i);
  });
});
