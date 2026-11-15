// @vitest-environment node
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {rolldown} from 'rolldown';
import {expect,it} from 'vitest';
import {parseSync} from 'rolldown/utils';
import {sharedChartHelpers} from './shared-chart-helpers.mjs';
import {operationalChartScales} from './operational-chart-scales.mjs';

const path=name=>`/local/node_modules/recharts/es6/${name}.js`;
const importId=code=>code.match(/from "(shared-chart-helper:[^"]+)"/)[1];
const prelude=file=>{
 const source=readFileSync(new URL('../node_modules/recharts/es6/'+file,import.meta.url),'utf8');
 const first=parseSync(file,source).program.body.find(node=>node.type==='ImportDeclaration');
 return source.slice(0,first.start);
};
async function fixture(shared){
 const files={empty:'export {};',entry:`export * from '${path('a')}';export * from '${path('b')}';export * from '${path('arrays')}';`};
 for(const name of ['a','b'])files[path(name)]=prelude('cartesian/Bar.js')+`\nimport {} from 'empty';
 export const spread${name}=(left,right)=>_objectSpread({},left,right);
 export const type${name}=value=>_typeof(value);
 export function class${name}(){
  function Base(value){this.value=value;}
  function Child(value){_classCallCheck(this,Child);return _callSuper(this,Child,[value]);}
  _inherits(Child,Base);_createClass(Child,[{key:'twice',value:function(){return this.value*2;}}]);
  return new Child(7).twice();
 }`;
 files[path('arrays')]=prelude('util/ChartUtils.js')+`\nimport {} from 'empty';export const clone=value=>_toConsumableArray(value);`;
 const bundle=await rolldown({input:'entry',plugins:[{name:'fixture',resolveId:id=>id in files?id:null,load:id=>files[id]},...(shared?[sharedChartHelpers()]:[])]});
 try{
  const {output}=await bundle.generate({format:'cjs'}),code=output.find(item=>item.type==='chunk').code;
  const module={exports:{}};new Function('module','exports',code)(module,module.exports);
  return {api:module.exports,code};
 }finally{await bundle.close();}
}

it('compartilha declarações idênticas sem alterar spread, símbolos, descritores, classes e iteração',async()=>{
 const original=await fixture(false),shared=await fixture(true);
 const symbol=Symbol('chave'),left={a:1,[symbol]:2},right={};
 Object.defineProperty(right,'valor',{get:()=>3,enumerable:false,configurable:true});
 for(const name of ['a','b','a','b']){
  expect(shared.api['spread'+name](left,right)).toEqual(original.api['spread'+name](left,right));
  expect(Object.getOwnPropertyDescriptor(shared.api['spread'+name](left,right),'valor')).toEqual(Object.getOwnPropertyDescriptor(original.api['spread'+name](left,right),'valor'));
  expect(shared.api['type'+name](symbol)).toBe(original.api['type'+name](symbol));
  expect(shared.api['class'+name]()).toBe(original.api['class'+name]());
 }
 for(const value of [[1,2],new Set([1,2]),'ação',new Uint8Array([3,4])])expect(shared.api.clone(value)).toEqual(original.api.clone(value));
 expect(()=>shared.api.clone({a:1})).toThrow(TypeError);
 expect(shared.code.length).toBeLessThan(original.code.length);
 expect(shared.code.match(/Cannot call a class as a function/g)).toHaveLength(1);
});
it('normaliza somente diferenças de formatação, preserva corpo e sourcemap e ignora código do app',()=>{
 const plugin=sharedChartHelpers(),source='function _typeof(o) { return typeof o; }\nimport {} from "empty";export const read=v=>_typeof(v);';
 const a=plugin.transform(source,path('a')),b=plugin.transform(source.replace('{ return','{\n return'),path('b'));
 expect(importId(a.code)).toBe(importId(b.code));
 expect(plugin.load(plugin.resolveId(importId(a.code)))).toContain('typeof');
 const c=plugin.transform(source.replaceAll('(o)','(value)').replace('typeof o','typeof value'),path('c'));
 expect(importId(a.code)).toBe(importId(c.code));
 expect(a.map.sourcesContent).toContain(source);
 expect(a.code).toContain('export const read=v=>_typeof(v);');
 expect(plugin.transform(source,'/local/src/Chart.jsx')).toBeUndefined();
});
it('mantém variantes e dependências distintas em módulos distintos',()=>{
 const plugin=sharedChartHelpers();
 const source=value=>`function _typeof(o){return '${value}';}function _extends(o){return _typeof(o);}import {} from 'empty';export const read=_extends;`;
 const a=plugin.transform(source('a'),path('a')),b=plugin.transform(source('b'),path('b'));
 expect(a.code.match(/shared-chart-helper:[a-f0-9]+/g)).not.toEqual(b.code.match(/shared-chart-helper:[a-f0-9]+/g));
});
it('compartilha também auxiliares de módulos ES sem importações',()=>{
 const plugin=sharedChartHelpers(),source='function _typeof(o){return typeof o;}export const read=value=>_typeof(value);';
 expect(plugin.transform(source,path('standalone')).code).toContain('shared-chart-helper:');
 const real=readFileSync('node_modules/recharts/es6/chart/AccessibilityManager.js','utf8');
 expect(plugin.transform(real,path('AccessibilityManager')).code).toContain('export var AccessibilityManager');
});
it('conserva funções que capturam estado do módulo ou são reatribuídas fora dos auxiliares',()=>{
 const plugin=sharedChartHelpers();
 for(const source of [
  `const state=1;function _typeof(o){return state;}import {} from 'empty';export const read=_typeof;`,
  `function _typeof(o){return state;}import {} from 'empty';export const state=1;`,
  `function _typeof(o){return typeof o;}import {} from 'empty';_typeof=()=>1;`,
 ])expect(plugin.transform(source,path('guard'))).toBeUndefined();
});
it('não extrai funções de domínio e rejeita ciclos inesperados',()=>{
 const plugin=sharedChartHelpers();
 expect(plugin.transform(`function calculate(v){return v*2;}import {} from 'empty';export {calculate};`,path('business'))).toBeUndefined();
 expect(()=>plugin.transform(`function _typeof(v){return _extends(v);}function _extends(v){return _typeof(v);}import {} from 'empty';`,path('cycle'))).toThrow('Ciclo inesperado');
});

it('preserva o SVG de linhas, barras, áreas, pizza e composição da biblioteca real',async()=>{
 const require=createRequire(import.meta.url);
 const entry=`import {createElement as h} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
 import {LineChart,BarChart,AreaChart,PieChart,ComposedChart,Line,Bar,Area,Pie,XAxis,YAxis,CartesianGrid} from ${JSON.stringify(require.resolve('recharts/es6/index.js').replaceAll('\\','/'))};
 const data=[{mes:'Janeiro',receita:120,custo:80},{mes:'Fevereiro',receita:0,custo:35},{mes:'Março',receita:145,custo:90}];
 export function render(){return [
 h(LineChart,{width:600,height:360,data},h(XAxis,{dataKey:'mes'}),h(YAxis),h(CartesianGrid),h(Line,{dataKey:'receita',isAnimationActive:false}),h(Line,{dataKey:'custo',isAnimationActive:false})),
 h(BarChart,{width:600,height:360,data},h(XAxis,{dataKey:'mes'}),h(YAxis),h(Bar,{dataKey:'custo',isAnimationActive:false})),
 h(AreaChart,{width:600,height:360,data},h(XAxis,{dataKey:'mes'}),h(YAxis),h(Area,{dataKey:'receita',isAnimationActive:false})),
 h(PieChart,{width:600,height:360},h(Pie,{data,dataKey:'custo',nameKey:'mes',isAnimationActive:false,label:true})),
 h(ComposedChart,{width:600,height:360,data},h(XAxis,{dataKey:'mes'}),h(YAxis),h(Bar,{dataKey:'custo',isAnimationActive:false}),h(Line,{dataKey:'receita',isAnimationActive:false}))
 ].map(element=>renderToStaticMarkup(element));}`;
 const compile=async shared=>{
  const bundle=await rolldown({input:'charts-entry',platform:'node',external:['react','react-dom','react-dom/server'],plugins:[
   {name:'chart-fixture',resolveId:id=>id==='charts-entry'?id:null,load:id=>id==='charts-entry'?entry:null},
   ...(shared?[sharedChartHelpers(),operationalChartScales()]:[]),
  ]});
  try{
   const {output}=await bundle.generate({format:'cjs'}),module={exports:{}};
   new Function('module','exports','require',output.find(item=>item.type==='chunk').code)(module,module.exports,require);
   return module.exports.render();
  }finally{await bundle.close();}
 };
 const original=await compile(false),shared=await compile(true);
 expect(shared).toEqual(original);
 expect(shared).toHaveLength(5);
 for(const svg of shared){expect(svg).toContain('<svg');expect(svg).toContain('<path');}
 expect(shared[0]).toContain('Janeiro');
},30000);
