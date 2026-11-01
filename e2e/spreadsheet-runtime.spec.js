import {test,expect} from "@playwright/test";
import {build} from "vite";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import ExcelJS from "exceljs";
import JSZip from "jszip";

// Compila uma entrada isolada com a configuração real de produção. A fixture
// fica somente no diretório de validação e nunca entra no build do aplicativo.
test.beforeAll(async({},testInfo)=>{
  if(testInfo.project.name==='bundle-spreadsheet-dev')return;
  await build({base:"/runtime-check/",build:{sourcemap:false,outDir:`${process.env.SPREADSHEET_RUNTIME_BUILD_ROOT||'build/operational-pilot-check'}/runtime-check`,rollupOptions:{input:fileURLToPath(new URL("./fixtures/spreadsheet-runtime.html",import.meta.url))}}});
});
test("ExcelJS modular preserva XLSX, CSV e proteção no navegador",async({page})=>{
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(test.info().project.name==='bundle-spreadsheet-dev'?'/e2e/fixtures/spreadsheet-runtime.html':"/runtime-check/e2e/fixtures/spreadsheet-runtime.html");
  await page.waitForFunction(()=>window.spreadsheetRuntime);
  const result=await page.evaluate(async()=>{
    const {read,workbookFromTables}=window.spreadsheetRuntime;
    const workbook=workbookFromTables([{nome:"Cotação",colunas:[{titulo:"Material"},{titulo:"Valor",formato:'"R$" #,##0.00'},{titulo:"Entrega",formato:"dd/mm/yyyy"}],linhas:[["Aço, ação 🔒",1234.56,new Date("2026-10-31T12:00:00.000Z")]]}]);
    const sheet=workbook.getWorksheet("Cotação");
    sheet.getCell('D1').value='Fórmula';sheet.getCell('D2').value={formula:'B2*2',result:2469.12};
    sheet.getCell('A3').value='Linha\n"citada"';sheet.getCell('B3').value=-17.9;
    sheet.getCell('A2').note='Conferir aplicação e medição';
    const image=workbook.addImage({base64:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',extension:'png'});
    sheet.addImage(image,'F1:F2');
    sheet.addConditionalFormatting({ref:'B2:B3',rules:[{type:'dataBar',cfvo:[{type:'min'},{type:'max'}],color:{argb:'FF336699'}}]});
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
    return {names:imported.SheetNames,rows:imported.Sheets["Cotação"].__rows,format:restored.getCell("B2").numFmt,frozen:restored.views[0].state,protection,restoredProtection:restored.sheetProtection,csv:csv.toString("utf8"),csvCell:csvBook.worksheets[0].getCell("A2").value,csvMultiline:csvBook.worksheets[0].getCell('A3').value,bytes:Array.from(new Uint8Array(bytes))};
  });
  expect(errors).toEqual([]);
  expect(result.names).toEqual(["Cotação"]);
  expect(result.rows[1]).toEqual(["Aço, ação 🔒",1234.56,new Date("2026-10-31T12:00:00.000Z"),2469.12]);
  expect(result.format).toBe('"R$" #,##0.00');expect(result.frozen).toBe("frozen");
  expect(result.csv).toContain('"Aço, ação 🔒"');expect(result.csvCell).toBe("Aço, ação 🔒");
  const hash=(...buffers)=>createHash("sha512").update(Buffer.concat(buffers)).digest();
  let key=hash(Buffer.from(result.protection.saltValue,"base64"),Buffer.from("Cotação 🔒","utf16le"));
  for(let index=0;index<500;index++){const counter=Buffer.alloc(4);counter.writeUInt32LE(index,0);key=hash(key,counter);}
  expect(result.protection.hashValue).toBe(key.toString("base64"));
  expect(result.restoredProtection.hashValue).toBe(result.protection.hashValue);
  expect(result.csvMultiline).toBe('Linha\n"citada"');
  // Oráculos Node originais: o teste não depende só do round-trip do adaptador.
  const zip=await JSZip.loadAsync(Buffer.from(result.bytes),{checkCRC32:true});
  expect(Object.keys(zip.files).some(name=>name.startsWith('xl/media/'))).toBe(true);
  const original=new ExcelJS.Workbook();await original.xlsx.load(Buffer.from(result.bytes));
  const originalSheet=original.getWorksheet('Cotação');
  expect(originalSheet.getCell('D2').value).toEqual({formula:'B2*2',result:2469.12});
  expect(originalSheet.getCell('A2').note).toBe('Conferir aplicação e medição');
  expect(originalSheet.getImages()).toHaveLength(1);
  expect(originalSheet.conditionalFormattings[0].rules[0].x14Id).toMatch(/^\{[0-9A-F-]{36}\}$/);
});
