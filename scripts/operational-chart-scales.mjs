import {parseSync} from 'rolldown/utils';
const axes=new Set(['XAxis','YAxis','ZAxis','PolarAngleAxis','PolarRadiusAxis']);
const supported=new Set(['auto','linear','point','band']);
function walk(node,fn){if(!node||typeof node!=='object')return;if(node.type)fn(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>walk(child,fn));else if(value&&typeof value==='object')walk(value,fn);}
export function assertOperationalAxes(source,file){
 if(!source.includes('recharts'))return;
 const ast=parseSync(file,source,{lang:file.endsWith('.tsx')?'tsx':file.endsWith('.ts')?'ts':file.endsWith('.jsx')?'jsx':'js'});
 if(ast.errors.length)throw Error(`Não foi possível conferir escalas de gráficos: ${file}`);
 const locals=new Set(),namespaces=new Set();
 for(const node of ast.program.body)if(node.type==='ImportDeclaration'&&String(node.source.value).includes('recharts'))for(const spec of node.specifiers){
  if(spec.type==='ImportNamespaceSpecifier')namespaces.add(spec.local.name);
  if(axes.has(spec.imported?.name))locals.add(spec.local.name);
 }
 const isAxis=node=>locals.has(node?.name)||node?.type==='JSXMemberExpression'&&namespaces.has(node.object.name)&&axes.has(node.property.name)||node?.type==='MemberExpression'&&namespaces.has(node.object.name)&&axes.has(node.property.name);
 const allowed=value=>supported.has(value?.value)||['ArrowFunctionExpression','FunctionExpression'].includes(value?.type);
 const fail=()=>{throw Error(`Escala ou propriedades dinâmicas de eixo exigem revisão do adaptador de gráficos: ${file}`);};
 walk(ast.program,node=>{
  if(node.type==='JSXOpeningElement'&&isAxis(node.name))for(const attr of node.attributes){if(attr.type==='JSXSpreadAttribute')fail();if(attr.name?.name==='scale'&&!allowed(attr.value?.expression||attr.value))fail();}
  if(node.type==='CallExpression'&&isAxis(node.arguments?.[0])){
   const props=node.arguments[1];if(props&&props.type!=='ObjectExpression'&&props.type!=='NullLiteral'&&props.value!==null)fail();
   for(const prop of props?.properties||[]){if(prop.type==='SpreadElement')fail();if((prop.key?.name||prop.key?.value)==='scale'&&!allowed(prop.value))fail();}
  }
 });
}
export function operationalChartScales(){
 const modules=new Map();
 return {name:'operational-chart-scales',apply:'build',enforce:'pre',
  buildStart(){modules.clear();},
  transform(source,id){if(id.replaceAll('\\','/').includes('/src/')&&/\.[jt]sx?$/.test(id)&&!id.includes('.test.'))assertOperationalAxes(source,id);},
  async resolveId(source,importer){
   if(source!=='victory-vendor/d3-scale'||!importer?.replaceAll('\\','/').includes('/node_modules/recharts/'))return;
   const resolved=await this.resolve(source,importer,{skipSelf:true});if(!resolved)throw Error('Biblioteca de escalas não encontrada.');
   const key='\0operational-chart-scales:'+resolved.id;modules.set(key,resolved.id);return key;
  },
  load(id){if(!modules.has(id))return;
   return `export {scaleLinear,scaleBand,scalePoint} from ${JSON.stringify(modules.get(id))};
   function unsupported(){throw Error('Esta escala exige revisão do adaptador de gráficos do ERP.');}
   export {unsupported as scaleIdentity,unsupported as scaleLog,unsupported as scaleSymlog,unsupported as scalePow,unsupported as scaleSqrt,unsupported as scaleRadial,unsupported as scaleOrdinal,unsupported as scaleQuantile,unsupported as scaleQuantize,unsupported as scaleThreshold,unsupported as scaleTime,unsupported as scaleUtc,unsupported as scaleSequential,unsupported as scaleSequentialLog,unsupported as scaleSequentialPow,unsupported as scaleSequentialSqrt,unsupported as scaleSequentialSymlog,unsupported as scaleSequentialQuantile,unsupported as scaleDiverging,unsupported as scaleDivergingLog,unsupported as scaleDivergingPow,unsupported as scaleDivergingSqrt,unsupported as scaleDivergingSymlog};`;
  },
 };
}
