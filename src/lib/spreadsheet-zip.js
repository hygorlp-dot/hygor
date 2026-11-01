import {zipSync,strToU8} from 'fflate';
import {Buffer} from 'buffer';
import {openZip} from './zip-reader.js';

async function bytesOf(input,options={}){
 const value=await input;
 if(typeof value==='string')return options.base64?new Uint8Array(Buffer.from(value,'base64')):options.binary?new Uint8Array(Buffer.from(value,'binary')):strToU8(value);
 if(value?.arrayBuffer)return new Uint8Array(await value.arrayBuffer());
 if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
 return new Uint8Array(value);
}
function outputOf(bytes,type='uint8array'){
 if(type==='nodebuffer')return Buffer.from(bytes);
 if(type==='uint8array')return bytes;
 if(type==='arraybuffer')return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 if(type==='base64')return Buffer.from(bytes).toString('base64');
 if(type==='blob')return new Blob([bytes],{type:'application/zip'});
 throw new Error(`Tipo de saída ZIP não suportado: ${type}.`);
}

// Apenas o contrato utilizado pelo ExcelJS no navegador: file, loadAsync,
// files/entry.async e generateAsync. Não substitui a API geral do JSZip.
export default class SpreadsheetZip{
 constructor(){this.files=Object.create(null);}
 file(name,data,options={}){
  if(arguments.length===1)return Object.hasOwn(this.files,name)?this.files[name]:null;
  this.files[name]={name,data,options};return this;
 }
 static async loadAsync(bytes){
  const zip=await openZip(bytes);
  for(const file of Object.values(zip.files)){
   const read=file.async;
   file.async=async(type,onProgress)=>type==='string'?read('string',onProgress):outputOf(await read('uint8array',onProgress),type);
  }
  return zip;
 }
 async generateAsync(options={},onProgress){
  const entries=Object.create(null),files=Object.values(this.files);
  for(let index=0;index<files.length;index++){
   const file=files[index];
   const compression=file.options.compression||options.compression||'STORE';
   if(!['STORE','DEFLATE'].includes(compression))throw new Error(`Compressão ZIP não suportada: ${compression}.`);
   const level=compression==='STORE'?0:file.options.compressionOptions?.level??options.compressionOptions?.level??6;
   entries[file.name]=[await bytesOf(file.data,file.options),{level}];
   onProgress?.({percent:Math.round((index/files.length)*100),currentFile:file.name});
  }
  const output=outputOf(zipSync(entries),options.type);
  onProgress?.({percent:100,currentFile:null});return output;
 }
}
