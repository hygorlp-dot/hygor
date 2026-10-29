import { describe, expect, it, vi } from "vitest";
import { marcellReportHtml } from "./marcell-report.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const parse = html => new DOMParser().parseFromString(html, "text/html");
const sample = `<!doctype html><html><head><title>Cobrança</title><style>@page{size:A4 landscape;margin:10mm}</style></head><body><h1>Empresa legal cadastrada</h1><p>CNPJ 12.345.678/0001-90 · Obra B2-04</p><table><thead><tr><th>Descrição</th><th>Total</th></tr></thead><tbody><tr><td>Locação com desconto</td><td>R$ 1.234,56</td></tr><tr><td>Saldo negativo</td><td>-R$ 17,90</td></tr><tr><td>Sem lançamento</td><td>R$ 0,00</td></tr></tbody><tfoot><tr><td>Total</td><td>R$ 1.216,66</td></tr></tfoot></table><footer>Assinatura do responsável</footer></body></html>`;

describe("identidade dos relatórios MARCELL", () => {
  it("remove a assinatura antiga do cabeçalho e rodapé sem substituir dados de tabelas ou CNPJ", () => {
    const raw = sample.replace("Empresa legal cadastrada", "ArcD Construtech")
      .replace("Assinatura do responsável", "Gerado por ARCD Obras")
      .replace("Locação com desconto", "Documento de ArcD Construtech")
      .replace("</body>", "<p>Observação: conferir o documento de ArcD Construtech.</p></body>");
    const result = marcellReportHtml(raw), doc = parse(result);
    expect(doc.querySelector("h1").textContent).toBe("MARCELL");
    expect(doc.querySelector("footer").textContent).toBe("Gerado por MARCELL");
    expect(doc.querySelector("p").textContent).toContain("12.345.678/0001-90");
    expect(doc.body.textContent).toContain("Observação: conferir o documento de ArcD Construtech.");
    expect([...doc.querySelectorAll("td")].map(e => e.textContent)).toEqual([...parse(raw).querySelectorAll("td")].map(e => e.textContent));
    expect(doc.querySelectorAll(".mrc-report-watermark")).toHaveLength(1);
    expect(doc.querySelector(".mrc-report-watermark").getAttribute("aria-hidden")).toBe("true");
    expect(doc.querySelector(".mrc-report-watermark img").src).toBe(doc.querySelector(".mrc-report-logo").src);
    expect(marcellReportHtml(result)).toBe(result);
  });
  it("preserva todas as células, valores, identificação legal, assinatura e orientação", () => {
    const styled = marcellReportHtml(sample);
    const before = parse(sample), after = parse(styled);
    expect([...after.querySelectorAll("th,td")].map(e => e.textContent)).toEqual([...before.querySelectorAll("th,td")].map(e => e.textContent));
    expect(after.querySelector("h1").textContent).toBe(before.querySelector("h1").textContent);
    expect(after.querySelector("p").textContent).toBe(before.querySelector("p").textContent);
    expect(after.querySelector("footer").textContent).toBe(before.querySelector("footer").textContent);
    expect(styled).toContain("size:A4 landscape;margin:10mm");
    expect(after.querySelectorAll(".mrc-report-logo")).toHaveLength(1);
    expect(marcellReportHtml(styled)).toBe(styled);
  });

  it("substitui a marca antiga, usa fontes locais e preserva fotos e paginação A2", () => {
    const old = sample.replace("<h1>", '<div class="logo-box">ArcD</div><img src="/foto-obra.jpg" alt="Obra"><h1>').replace("</head>", '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans"></head>');
    const styled = parse(marcellReportHtml(old));
    expect(styled.querySelectorAll(".mrc-report-logo")).toHaveLength(1);
    expect(styled.querySelector('img[alt="Obra"]').getAttribute("src")).toBe("/foto-obra.jpg");
    expect(styled.querySelector('link[href*="googleapis"]')).toBeNull();
    const a2 = parse(marcellReportHtml('<html><head><style>@page{size:A2 landscape;margin:8mm}</style></head><body><section class="page">Folha 1</section><section class="page">Folha 2</section></body></html>'));
    expect(a2.body.dataset.marcellFormat).toBe("a2");
    expect(a2.querySelectorAll("section.page .mrc-report-logo")).toHaveLength(2);
    expect(a2.querySelectorAll("section.page")).toHaveLength(2);
    expect(a2.querySelector("#marcell-report-theme").textContent).toContain("size:594mm 420mm");
  });

  it("só dispara a impressão quando a fonte e a logo terminaram de carregar", async () => {
    const script = parse(marcellReportHtml(sample)).querySelector("script").textContent;
    let fontReady, logoReady;
    const print = vi.fn();
    const win = { print };
    const doc = { fonts: { load: () => Promise.resolve([]), ready: new Promise(resolve => { fontReady = resolve; }) }, querySelectorAll: () => [{ decode: () => new Promise(resolve => { logoReady = resolve; }) }] };
    Function("window", "document", script)(win, doc);
    const pending = win.print();
    expect(print).not.toHaveBeenCalled();
    fontReady();
    await vi.waitFor(() => expect(logoReady).toBeTypeOf("function"));
    expect(print).not.toHaveBeenCalled();
    logoReady();
    await pending;
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("usa A3 apenas nos anexos largos, mantendo todas as colunas", () => {
    const cells = Array.from({ length: 22 }, (_, i) => `<th>Coluna ${i + 1}</th>`).join("");
    const raw = sample.replace("<th>Descrição</th><th>Total</th>", cells);
    const styled = marcellReportHtml(raw);
    expect(styled).toContain("size:A3 landscape");
    expect(parse(styled).querySelectorAll("th")).toHaveLength(22);
    expect(parse(styled).body.dataset.marcellFormat).toBe("wide");
  });

  it("incorpora as fontes oficiais sem modificá-las nem depender de uma URL externa", () => {
    for (const face of ["Regular", "Bold"]) {
      const name = `NimbusSans-${face}.woff2`;
      expect(readFileSync(resolve(`src/reports/assets/${name}`))).toEqual(readFileSync(resolve(`public/fonts/marcell/${name}`)));
    }
    expect(marcellReportHtml(sample)).toContain("data:font/woff2;base64,");
  });
});
