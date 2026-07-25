import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { readSelectedXlsxSheets } from "./xlsx-selective-reader";

describe("readSelectedXlsxSheets", () => {
  it("lê apenas as abas SINAPI solicitadas e preserva valores e fórmulas", async () => {
    const source = new ExcelJS.Workbook();
    const csd = source.addWorksheet("CSD");
    csd.addRow(["Competência", "06/2026"]);
    csd.addRow(["Código", "Descrição", "Unidade", "PE"]);
    csd.addRow([101, "SERVIÇO TESTE", "UN", 12.34]);
    csd.getCell("A4").value = { formula:"MATCH(202)", result:0 };
    csd.getCell("B4").value = "SERVIÇO COM FÓRMULA";
    csd.getCell("C4").value = "M";
    csd.getCell("D4").value = 25;

    const icd = source.addWorksheet("ICD");
    icd.addRow(["Código do insumo", "Descrição do insumo", "Unidade", "PE"]);
    for (let index = 1; index <= 5000; index += 1) {
      icd.addRow([index, `INSUMO ${index}`, "UN", index / 100]);
    }
    source.addWorksheet("Aba não utilizada").addRow(["não deve ser carregada"]);

    const buffer = await source.xlsx.writeBuffer();
    const progress = [];
    const result = await readSelectedXlsxSheets(buffer, {
      sheets:["CSD", "ICD"],
      onProgress:event => progress.push(event),
    });

    expect(result.SheetNames).toEqual(["CSD", "ICD"]);
    expect(result.Sheets.CSD.__rows[2]).toEqual([101, "SERVIÇO TESTE", "UN", 12.34]);
    expect(result.Sheets.CSD.A4).toMatchObject({ v:0, f:"MATCH(202)" });
    expect(result.Sheets.ICD.__rows).toHaveLength(5001);
    expect(result.Sheets.ICD.__rows[5000][1]).toBe("INSUMO 5000");
    expect(progress.some(event => event.sheetName === "ICD" && event.rows >= 4500)).toBe(true);
    expect(result.Sheets["Aba não utilizada"]).toBeUndefined();
  });
});
