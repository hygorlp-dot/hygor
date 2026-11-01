// @vitest-environment node
import {describe,expect,it} from 'vitest';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import SpreadsheetZip from './spreadsheet-zip.js';
import {openZip} from './zip-reader.js';

describe('ZIP das planilhas interoperável',()=>{
 it.each(['DEFLATE','STORE'])('gera %s legível pelo JSZip, preservando UTF-8 e binários',async compression=>{
  const zip=new SpreadsheetZip();
  zip.file('xl/texto.xml','Aço, aplicação 🔒 & João');
  zip.file('xl/media/imagem.bin',Uint8Array.from([0,255,13,10,128,1]));
  zip.file('xl/media/base64.bin','AP8NCg==',{base64:true});
  const output=await zip.generateAsync({type:'nodebuffer',compression});
  expect(Buffer.isBuffer(output)).toBe(true);
  const reference=await JSZip.loadAsync(output,{checkCRC32:true});
  expect(await reference.file('xl/texto.xml').async('string')).toBe('Aço, aplicação 🔒 & João');
  expect([...await reference.file('xl/media/imagem.bin').async('uint8array')]).toEqual([0,255,13,10,128,1]);
  expect([...await reference.file('xl/media/base64.bin').async('uint8array')]).toEqual([0,255,13,10]);
 });
 it('lê XLSX do ExcelJS original sem alterar fórmulas, textos ou arquivos binários',async()=>{
  const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Medição');
  sheet.addRow(['Ação',12.34]);sheet.getCell('C1').value={formula:'B1*2',result:24.68};
  const bytes=await book.xlsx.writeBuffer();
  const reference=await JSZip.loadAsync(bytes);const loaded=await SpreadsheetZip.loadAsync(bytes);
  for(const file of Object.values(reference.files).filter(file=>!file.dir)){
   expect(await loaded.files[file.name].async('nodebuffer'),file.name).toEqual(await file.async('nodebuffer'));
  }
 });
 it('indexa sem descompactar abas ignoradas e informa progresso ao ler a selecionada',async()=>{
  const zip=new JSZip();zip.file('selected.xml','<sheet>ação</sheet>');zip.file('ignored.xml','X'.repeat(50000));
  const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  const opened=await openZip(bytes);const progress=[];
  expect(opened.file('absent.xml')).toBeNull();
  expect(await opened.file('selected.xml').async('string',value=>progress.push(value.percent))).toBe('<sheet>ação</sheet>');
  expect(progress).toEqual([0,100]);
 });
 it('normaliza caminhos como JSZip sem expor protótipos herdados',async()=>{
  const zip=new JSZip();zip.file('../xl/sheet.xml','seguro');zip.file('__proto__','texto');
  const loaded=await openZip(await zip.generateAsync({type:'uint8array'}));
  expect(loaded.file('../xl/sheet.xml')).toBeNull();
  expect(await loaded.file('xl/sheet.xml').async('string')).toBe('seguro');
  expect(await loaded.file('__proto__').async('string')).toBe('texto');
 });
 it('rejeita ZIP inválido e tipos não suportados explicitamente',async()=>{
  await expect(openZip(new Uint8Array([1,2,3]))).rejects.toThrow();
  const zip=new SpreadsheetZip();zip.file('a.txt','a');
  await expect(zip.generateAsync({type:'unsupported'})).rejects.toThrow(/tipo/i);
 });
});
