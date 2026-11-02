import {unzipSync,strFromU8} from 'fflate';

const safePath=name=>{
 const parts=[];
 for(const part of name.split('/')){
  if(part==='..')parts.pop();
  else if(part!=='.'&&part!=='')parts.push(part);
 }
 return parts.join('/')+(name.endsWith('/')&&parts.length?'/':'');
};

// Indexar o diretório não expande os XMLs. Cada aba só é descompactada
// quando solicitada, preservando o uso seletivo de memória no SINAPI.
export async function openZip(input){
 const source=await input;
 const bytes=ArrayBuffer.isView(source)?new Uint8Array(source.buffer,source.byteOffset,source.byteLength):new Uint8Array(source);
 const files=Object.create(null);
 unzipSync(bytes,{filter(info){
  const name=safePath(info.name);
  files[name]={name,dir:info.name.endsWith('/'),async:async(type='string',onProgress)=>{
   onProgress?.({percent:0,currentFile:name});
   const output=unzipSync(bytes,{filter:file=>file.name===info.name})[info.name];
   onProgress?.({percent:100,currentFile:name});
   if(type==='string')return strFromU8(output);
   if(type==='uint8array')return output;
   if(type==='arraybuffer')return output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength);
   throw new Error(`Tipo de leitura ZIP não suportado: ${type}.`);
  }};
  return false;
 }});
 return {files,file:name=>Object.hasOwn(files,name)?files[name]:null};
}
