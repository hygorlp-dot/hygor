import {test,expect} from "@playwright/test";
import {build} from "vite";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";

// Compila uma entrada isolada com a configuração real de produção. A fixture
// fica somente no diretório de validação e nunca entra no build do aplicativo.
test.beforeAll(async()=>{
  await build({base:"/runtime-check/",build:{sourcemap:false,outDir:"build/operational-pilot-check/runtime-check",rollupOptions:{input:fileURLToPath(new URL("./fixtures/spreadsheet-runtime.html",import.meta.url))}}});
});
test("ExcelJS modular preserva XLSX, CSV e proteção no navegador",async({page})=>{
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/runtime-check/e2e/fixtures/spreadsheet-runtime.html");
  await page.waitForFunction(()=>window.spreadsheetRuntime);
  const result=await page.evaluate(async()=>{
    const {read,workbookFromTables}=window.spreadsheetRuntime;
    const workbook=workbookFromTables([{nome:"Cotação",colunas:[{titulo:"Material"},{titulo:"Valor",formato:'"R$" #,##0.00'},{titulo:"Entrega",formato:"dd/mm/yyyy"}],linhas:[["Aço, ação 🔒",1234.56,new Date("2026-10-31T12:00:00.000Z")]]}]);
    const sheet=workbook.getWorksheet("Cotação");
    await sheet.protect("Cotação 🔒",{spinCount:500});
    const protection={...sheet.sheetProtection};
    const bytes=await workbook.xlsx.writeBuffer();
    const imported=await read(bytes);
    const loaded=workbookFromTables([]);await loaded.xlsx.load(bytes);
    const csv=await workbook.csv.writeBuffer({sheetName:"Cotação"});
    const csvBook=workbookFromTables([]);await csvBook.csv.read(requireStream(csv));
    function requireStream(buffer){
      // O buffer CSV do ExcelJS é um stream do navegador. Reutilizamos a
      // própria saída XLSX do objeto para testar CSV sem API de arquivos Node.
      return {pipe(destination){destination.write(buffer);destination.end();return destination;}};
    }
    const restored=loaded.getWorksheet("Cotação");
    return {names:imported.SheetNames,rows:imported.Sheets["Cotação"].__rows,format:restored.getCell("B2").numFmt,frozen:restored.views[0].state,protection,restoredProtection:restored.sheetProtection,csv:csv.toString("utf8"),csvCell:csvBook.worksheets[0].getCell("A2").value};
  });
  expect(errors).toEqual([]);
  expect(result.names).toEqual(["Cotação"]);
  expect(result.rows[1]).toEqual(["Aço, ação 🔒",1234.56,new Date("2026-10-31T12:00:00.000Z")]);
  expect(result.format).toBe('"R$" #,##0.00');expect(result.frozen).toBe("frozen");
  expect(result.csv).toContain('"Aço, ação 🔒"');expect(result.csvCell).toBe("Aço, ação 🔒");
  const hash=(...buffers)=>createHash("sha512").update(Buffer.concat(buffers)).digest();
  let key=hash(Buffer.from(result.protection.saltValue,"base64"),Buffer.from("Cotação 🔒","utf16le"));
  for(let index=0;index<500;index++){const counter=Buffer.alloc(4);counter.writeUInt32LE(index,0);key=hash(key,counter);}
  expect(result.protection.hashValue).toBe(key.toString("base64"));
  expect(result.restoredProtection.hashValue).toBe(result.protection.hashValue);
});
