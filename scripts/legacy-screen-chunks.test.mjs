import {describe,it,expect} from 'vitest';
import path from 'node:path';
import ts from 'typescript';
import {splitLegacyScreens} from './legacy-screen-chunks.mjs';

function evaluate(split,external={}){
  const modules=new Map(split.modules);modules.set('root',split.code);const cache=new Map();
  const require=id=>{
    if(id in external)return external[id];if(cache.has(id))return cache.get(id);
    if(!modules.has(id))throw Error('Unexpected import '+id);
    const exports={};cache.set(id,exports);
    const output=ts.transpileModule(modules.get(id),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','exports',output)(require,exports);return exports;
  };
  return {root:require('root'),cache};
}
const lazy=load=>({load});
describe('legacy screens compilation boundary',()=>{
 it('defers screen code, preserves named exports and shares helpers with the shell',async()=>{
  const source=`import {lazy} from 'loader';
    const label='Obra A';
    export const cents=value=>Math.round(value*100);
    function Screen({amount}){return {label,cost:cents(amount)};}
    export default function App(){return Screen;}`;
  const split=splitLegacyScreens(source,{groups:{finance:['Screen']}}),loaded=evaluate(split,{loader:{lazy}});
  expect(split.code).not.toContain('return {label,cost:');
  expect(loaded.cache.has('virtual:legacy-screen/finance.jsx')).toBe(false);
  expect(loaded.root.cents(12.34)).toBe(1234);
  const Screen=(await loaded.root.default().load()).default;
  expect(Screen({amount:12.34})).toEqual({label:'Obra A',cost:1234});
  expect(loaded.cache.has('virtual:legacy-screen/finance.jsx')).toBe(true);
 });
 it('resolves lexical scopes without confusing object properties, shorthand or parameters',async()=>{
  const source=`import {lazy} from 'loader';import {unused} from 'never';
    const amount=12;const workId='work-a';
    function Screen({amount}){const holder={amount:3};return {amount,workId,holder:holder.amount};}
    export default function App(){return Screen;}`;
  const loaded=evaluate(splitLegacyScreens(source,{groups:{ui:['Screen']}}),{loader:{lazy}});
  const Screen=(await loaded.root.default().load()).default;
  expect(Screen({amount:25})).toEqual({amount:25,workId:'work-a',holder:3});
 });
 it('retains a single mutable helper instance across the application and two screens',async()=>{
  const source=`import {lazy} from 'loader';let counter=0;export function next(){return ++counter;}
    function First(){return next();} function Second(){return next();}
    export default function App(){return [First,Second];}`;
  const loaded=evaluate(splitLegacyScreens(source,{groups:{first:['First'],second:['Second']}}),{loader:{lazy}});
  expect(loaded.root.next()).toBe(1);const [one,two]=loaded.root.default();
  expect((await one.load()).default()).toBe(2);expect((await two.load()).default()).toBe(3);
 });
 it('relocates relative static and dynamic imports from their original source directory',()=>{
  const filename=path.resolve('src/LegacyApp.jsx');
  const source=`import {lazy} from 'loader';import {amount} from './math.js';
    function Screen(){return import('./detail.jsx').then(()=>amount);}
    export default function App(){return Screen;}`;
  const split=splitLegacyScreens(source,{filename,groups:{ui:['Screen']}}),part=split.modules.get('virtual:legacy-screen/ui.jsx');
  expect(part).toContain(path.resolve('src/math.js').replaceAll('\\','/'));
  expect(part).toContain(path.resolve('src/detail.jsx').replaceAll('\\','/'));
 });
 it('fails closed when an entry is missing or would change an exported function contract',()=>{
  expect(()=>splitLegacyScreens('export function Public(){}',{groups:{ui:['Public']}})).toThrow('public export contract');
  expect(()=>splitLegacyScreens('export default function App(){}',{groups:{ui:['Missing']}})).toThrow('not a function');
 });
});
