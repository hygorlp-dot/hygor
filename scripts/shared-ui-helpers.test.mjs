// @vitest-environment node
import {expect,it} from 'vitest';
import {rolldown} from 'rolldown';
import {sharedUiHelpers} from './shared-ui-helpers.mjs';
const header='var __defProp = Object.defineProperty;\nvar __name = (target, value) => __defProp(target, "name", { value, configurable: true });';
it('compartilha auxiliares preservando identidade, nome e descritor em módulos distintos',async()=>{
 const files={entry:'export {makeA} from "/node_modules/@radix-ui/a/index.mjs";export {makeB} from "/node_modules/@radix-ui/b/index.mjs";'};
 for(const letter of ['A','B'])files[`/node_modules/@radix-ui/${letter.toLowerCase()}/index.mjs`]=header+`\nexport const make${letter}=()=>{const target=function(){};const result=__name(target,"Nome${letter}");return {same:target===result,name:result.name,descriptor:Object.getOwnPropertyDescriptor(result,'name')};};`;
 const bundle=await rolldown({input:'entry',plugins:[{name:'fixture',resolveId:id=>id in files?id:null,load:id=>files[id]},sharedUiHelpers()]});
 try{const {output}=await bundle.generate({format:'cjs'}),code=output.find(o=>o.type==='chunk').code,module={exports:{}};new Function('module','exports',code)(module,module.exports);
  for(const letter of ['A','B'])expect(module.exports['make'+letter]()).toEqual({same:true,name:'Nome'+letter,descriptor:{value:'Nome'+letter,configurable:true,enumerable:false,writable:false}});
  expect(code.match(/defineProperty\(target, "name"/g)).toHaveLength(1);
 }finally{await bundle.close();}
});
it('ignora outras bibliotecas e alterações de contrato ou reatribuições',()=>{
 const plugin=sharedUiHelpers(),file='/node_modules/@radix-ui/a/index.mjs';
 expect(plugin.transform(header,'/src/Component.mjs')).toBeUndefined();
 expect(plugin.transform(header.replace('configurable: true','configurable: false'),file)).toBeUndefined();
 expect(plugin.transform(header+'\n__name=other;',file)).toBeUndefined();
});
