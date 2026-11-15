import MagicString from 'magic-string';

// Auxiliares gerados pelo esbuild nas distribuições Radix instaladas.
// Preserva inclusive Function.name e seus descritores; compartilha somente
// o par idêntico de declarações, não os componentes ou seus estados.
const header='var __defProp = Object.defineProperty;\nvar __name = (target, value) => __defProp(target, "name", { value, configurable: true });';
const id='\0shared-ui-names';
export function sharedUiHelpers(){return {
 name:'shared-ui-helpers',apply:'build',enforce:'pre',
 resolveId(source){if(source==='shared-ui-names')return id;},
 load(source){if(source===id)return 'const defineProperty=Object.defineProperty;const name=(target,value)=>defineProperty(target,"name",{value,configurable:true});export {defineProperty,name};';},
 transform(source,file){
  if(!file.replaceAll('\\','/').includes('/node_modules/@radix-ui/')||!file.endsWith('.mjs'))return;
  const normalized=source.replaceAll('\r\n','\n'),start=normalized.indexOf(header);
  if(start<0||/\b__(?:name|defProp)\s*=/.test(normalized.slice(start+header.length)))return;
  const result=new MagicString(normalized);
  result.overwrite(start,start+header.length,'import {defineProperty as __defProp,name as __name} from "shared-ui-names";');
  return {code:result.toString(),map:result.generateMap({hires:true,source:file,includeContent:true})};
 },
};}
